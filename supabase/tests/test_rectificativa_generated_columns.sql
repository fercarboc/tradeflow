-- ============================================================
-- PH0-INVOICE-RECTIFY-ERROR-1 — Tests SQL
-- Verifica que fn_crear_factura_rectificativa funciona correctamente
-- tras eliminar iva_importe/total del INSERT (GENERATED ALWAYS).
-- Ejecutar en entorno local aislado. NO en producción.
-- ============================================================

BEGIN;

-- ── Helpers ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _assert(tag text, cond bool, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT cond THEN
    RAISE EXCEPTION '[FAIL] % — %', tag, msg;
  ELSE
    RAISE NOTICE '[PASS] %', tag;
  END IF;
END;
$$;

-- ── Fixtures ──────────────────────────────────────────────────────────────
-- Org de test (aislada)
INSERT INTO public.trade_organizations (id, nombre, owner_id, nif)
VALUES (
  'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
  'Test Org Rectificativa',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'B00000001'
)
ON CONFLICT (id) DO NOTHING;

-- Cliente de test
INSERT INTO public.trade_clients (id, org_id, nombre)
VALUES (
  'bbbbbbbb-rect-0000-0000-000000000001'::uuid,
  'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
  'Cliente Rectificativa Test'
)
ON CONFLICT (id) DO NOTHING;

-- Factura Borrador (para test de rechazo)
INSERT INTO public.trade_invoices (
  id, org_id, client_id, estado, tipo_factura, serie, numero,
  subtotal, iva_pct,
  razon_social_cliente, nif_cliente
) VALUES (
  'cccccccc-rect-0000-0000-000000000001'::uuid,
  'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
  'bbbbbbbb-rect-0000-0000-000000000001'::uuid,
  'Borrador', 'normal', 'F', 'RECT-TEST-001',
  1000.00, 21,
  'Cliente Rectificativa Test', 'B00000001'
)
ON CONFLICT (id) DO NOTHING;

-- Factura Emitida con IVA 21% (para test de creación)
INSERT INTO public.trade_invoices (
  id, org_id, client_id, estado, tipo_factura, serie, numero,
  subtotal, iva_pct,
  razon_social_cliente, nif_cliente, fecha_emision
) VALUES (
  'cccccccc-rect-0000-0000-000000000002'::uuid,
  'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
  'bbbbbbbb-rect-0000-0000-000000000001'::uuid,
  'Emitida', 'normal', 'F', 'RECT-TEST-002',
  1000.00, 21,
  'Cliente Rectificativa Test', 'B00000001',
  CURRENT_DATE
)
ON CONFLICT (id) DO NOTHING;

-- Líneas de la factura Emitida
INSERT INTO public.trade_invoice_lines (factura_id, descripcion, cantidad, precio_unitario, subtotal, tipo, orden)
VALUES (
  'cccccccc-rect-0000-0000-000000000002'::uuid,
  'Servicio instalación', 1, 1000.00, 1000.00, 'mano_de_obra', 1
)
ON CONFLICT DO NOTHING;

-- Factura Emitida con IVA 10% (para test de redondeo)
INSERT INTO public.trade_invoices (
  id, org_id, client_id, estado, tipo_factura, serie, numero,
  subtotal, iva_pct,
  razon_social_cliente, nif_cliente, fecha_emision
) VALUES (
  'cccccccc-rect-0000-0000-000000000003'::uuid,
  'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
  'bbbbbbbb-rect-0000-0000-000000000001'::uuid,
  'Emitida', 'normal', 'F', 'RECT-TEST-003',
  333.33, 10,
  'Cliente Rectificativa Test', 'B00000001',
  CURRENT_DATE
)
ON CONFLICT (id) DO NOTHING;

-- ── Test RECT-01: Factura Borrador debe ser rechazada ─────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000001'::uuid,
      'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
      'R4', 'Test rechazo Borrador'
    );
    RAISE EXCEPTION '[FAIL] RECT-01 — Debió rechazar factura Borrador';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Borrador%' THEN
      RAISE NOTICE '[PASS] RECT-01 — Borrador rechazado correctamente: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '[FAIL] RECT-01 — Error inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- ── Test RECT-02: Creación de rectificativa sobre Emitida (IVA 21%) ───────
DO $$
DECLARE
  v_result  jsonb;
  v_rect_id uuid;
  v_rect    record;
BEGIN
  v_result := public.fn_crear_factura_rectificativa(
    'cccccccc-rect-0000-0000-000000000002'::uuid,
    'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
    'R1', 'Error en factura original'
  );
  v_rect_id := (v_result->>'rectificativa_id')::uuid;

  SELECT * INTO v_rect FROM public.trade_invoices WHERE id = v_rect_id;

  PERFORM _assert('RECT-02a', v_rect.id IS NOT NULL,                  'rectificativa creada');
  PERFORM _assert('RECT-02b', v_rect.estado = 'Borrador',            'estado=Borrador');
  PERFORM _assert('RECT-02c', v_rect.tipo_factura = 'rectificativa', 'tipo_factura=rectificativa');
  PERFORM _assert('RECT-02d', v_rect.tipo_factura_vf = 'R1',         'tipo_factura_vf=R1');
  PERFORM _assert('RECT-02e', v_rect.tipo_rectificativa = 'I',       'tipo_rectificativa=I');
  PERFORM _assert('RECT-02f', v_rect.subtotal = -1000.00,            'subtotal negativo');
  PERFORM _assert('RECT-02g', v_rect.iva_pct = 21,                   'iva_pct preservado');
  -- GENERATED ALWAYS: iva_importe = -1000.00 * 21 / 100 = -210.00
  PERFORM _assert('RECT-02h', v_rect.iva_importe = -210.00,          'iva_importe=-210.00 (GENERATED)');
  -- GENERATED ALWAYS: total = -1000.00 * (1 + 21/100) = -1210.00
  PERFORM _assert('RECT-02i', v_rect.total = -1210.00,               'total=-1210.00 (GENERATED)');
  PERFORM _assert('RECT-02j', v_rect.rectifica_factura_id = 'cccccccc-rect-0000-0000-000000000002'::uuid, 'rectifica_factura_id correcto');
  PERFORM _assert('RECT-02k', v_rect.org_id = 'aaaaaaaa-rect-0000-0000-000000000001'::uuid, 'org_id correcto (aislamiento)');
  PERFORM _assert('RECT-02l', v_rect.serie = 'R',                    'serie=R');
  PERFORM _assert('RECT-02m', v_rect.motivo_rectificacion = 'Error en factura original', 'motivo correcto');

  -- Líneas de la rectificativa deben ser negativas
  PERFORM _assert('RECT-02n',
    (SELECT COUNT(*) FROM public.trade_invoice_lines WHERE factura_id = v_rect_id) = 1,
    '1 línea en rectificativa');
  PERFORM _assert('RECT-02o',
    (SELECT subtotal FROM public.trade_invoice_lines WHERE factura_id = v_rect_id LIMIT 1) = -1000.00,
    'línea.subtotal negativo');

  -- Factura original no modificada
  PERFORM _assert('RECT-02p',
    (SELECT estado FROM public.trade_invoices WHERE id = 'cccccccc-rect-0000-0000-000000000002'::uuid) = 'Emitida',
    'factura original no modificada');
END $$;

-- ── Test RECT-03: Redondeo decimal (IVA 10%, subtotal 333.33) ─────────────
DO $$
DECLARE
  v_result  jsonb;
  v_rect_id uuid;
  v_rect    record;
BEGIN
  v_result := public.fn_crear_factura_rectificativa(
    'cccccccc-rect-0000-0000-000000000003'::uuid,
    'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
    'R4', 'Cancelación por acuerdo'
  );
  v_rect_id := (v_result->>'rectificativa_id')::uuid;
  SELECT * INTO v_rect FROM public.trade_invoices WHERE id = v_rect_id;

  -- iva_importe = -333.33 * 10 / 100 = -33.333 → redondeado a -33.33
  PERFORM _assert('RECT-03a', v_rect.subtotal = -333.33,             'subtotal=-333.33');
  PERFORM _assert('RECT-03b', v_rect.iva_importe = -33.33,           'iva_importe=-33.33 (redondeo 2dp)');
  -- total = -333.33 * 1.10 = -366.663 → redondeado a -366.66
  PERFORM _assert('RECT-03c', v_rect.total = -366.663,               'total=-366.663 (GENERATED exacto)');
END $$;

-- ── Test RECT-04: No se puede rectificar dos veces ────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000002'::uuid,
      'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
      'R1', 'Segunda rectificativa (debe fallar)'
    );
    RAISE EXCEPTION '[FAIL] RECT-04 — Debió rechazar segunda rectificativa';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Ya existe%' THEN
      RAISE NOTICE '[PASS] RECT-04 — Segunda rectificativa rechazada: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '[FAIL] RECT-04 — Error inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- ── Test RECT-05: Aislamiento entre organizaciones ────────────────────────
-- Intento de rectificar factura de org_A usando org_B (distinta)
DO $$
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000003'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000099'::uuid,  -- org que no existe / no es la dueña
      'R4', 'Test aislamiento'
    );
    RAISE EXCEPTION '[FAIL] RECT-05 — Debió rechazar acceso de org ajena';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%no encontrada%' OR SQLERRM LIKE '%no autorizado%' OR SQLERRM LIKE '%Acceso%' THEN
      RAISE NOTICE '[PASS] RECT-05 — Aislamiento de org correcto: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '[FAIL] RECT-05 — Error inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- ── Test RECT-06: tipo_factura_vf inválido ────────────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000003'::uuid,
      'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
      'F1', 'Tipo inválido'
    );
    RAISE EXCEPTION '[FAIL] RECT-06 — Debió rechazar tipo_factura_vf=F1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%no válido%' THEN
      RAISE NOTICE '[PASS] RECT-06 — tipo_factura_vf inválido rechazado: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '[FAIL] RECT-06 — Error inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- ── Test RECT-07: motivo vacío ────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000003'::uuid,
      'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
      'R4', '   '
    );
    RAISE EXCEPTION '[FAIL] RECT-07 — Debió rechazar motivo vacío';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%obligatorio%' THEN
      RAISE NOTICE '[PASS] RECT-07 — Motivo vacío rechazado: %', SQLERRM;
    ELSE
      RAISE EXCEPTION '[FAIL] RECT-07 — Error inesperado: %', SQLERRM;
    END IF;
  END;
END $$;

-- ── Test RECT-08: Sin registros parciales tras error ─────────────────────
DO $$
DECLARE
  v_count_before int;
  v_count_after  int;
BEGIN
  SELECT COUNT(*) INTO v_count_before FROM public.trade_invoices
  WHERE org_id = 'aaaaaaaa-rect-0000-0000-000000000001'::uuid AND tipo_factura = 'rectificativa';

  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'cccccccc-rect-0000-0000-000000000001'::uuid,  -- Borrador → falla
      'aaaaaaaa-rect-0000-0000-000000000001'::uuid,
      'R4', 'Test sin registros parciales'
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  SELECT COUNT(*) INTO v_count_after FROM public.trade_invoices
  WHERE org_id = 'aaaaaaaa-rect-0000-0000-000000000001'::uuid AND tipo_factura = 'rectificativa';

  PERFORM _assert('RECT-08', v_count_after = v_count_before, 'sin registros parciales tras error');
END $$;

ROLLBACK;
