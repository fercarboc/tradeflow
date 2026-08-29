-- ============================================================
-- VF-RECT-21..48 — Test suite de facturas rectificativas
-- VF-RECTIFICATIVAS-IMPL FASE 1
--
-- IMPORTANTE:
--   • Todos los tests corren en una transacción ROLLBACK.
--   • NO usar la org real de Pedro (89d05f11-...).
--   • Se usa una org QA temporal creada dentro de la transacción.
--   • Requiere rol service_role o superuser para SET LOCAL ROLE.
--
-- Ejecución:
--   psql -h <host> -U postgres -d postgres -f vf-rect-21-48.sql
-- ============================================================

BEGIN;

-- ── Setup: silenciar avisos NOTICE en algunos entornos ────────
SET client_min_messages = WARNING;

-- ── Helper: función de aserción inline ───────────────────────
CREATE TEMP TABLE IF NOT EXISTS _test_results (
  test_id    text,
  passed     boolean,
  message    text
);

CREATE OR REPLACE FUNCTION _assert(
  p_test_id text,
  p_cond    boolean,
  p_msg     text DEFAULT 'sin detalle'
) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO _test_results VALUES (p_test_id, p_cond, p_msg);
  IF NOT p_cond THEN
    RAISE WARNING 'FAIL [%]: %', p_test_id, p_msg;
  END IF;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- FIXTURE: Org QA + datos de prueba
-- ════════════════════════════════════════════════════════════

-- Org QA (no usa org de Pedro)
INSERT INTO public.trade_organizations (id, name, nif, owner_id, timezone)
VALUES (
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'QA Test Org Rectificativas',
  'B99999999',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Europe/Madrid'
);

-- Cliente QA
INSERT INTO public.trade_clients (id, org_id, nombre, nif, email)
VALUES (
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'Cliente QA Rectificativas SL',
  'B12345678',
  'qa@test.com'
);

-- Factura ordinaria emitida (base para rectificar)
INSERT INTO public.trade_invoices (
  id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
  razon_social_cliente, nif_cliente, direccion_cliente,
  cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
  client_id, fecha, fecha_emision,
  subtotal, iva_pct, iva_importe, total,
  verifactu_hash, verifactu_generated_at, fiscal_record_id
) VALUES (
  'ffffffff-0000-0000-0000-000000000001'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'F', 'F-2026-0001', 'Emitida', 'factura', 'F1',
  'Cliente QA Rectificativas SL', 'B12345678', 'Calle Mayor 1',
  '28001', 'Madrid', 'Madrid', 'España',
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  '2026-08-01', NOW() - INTERVAL '1 day',
  1000.00, 21, 210.00, 1210.00,
  'AABBCCDD00112233AABBCCDD00112233AABBCCDD00112233AABBCCDD00112233',
  NOW() - INTERVAL '1 day',
  NULL -- sin fiscal_record (fixture simplificado)
);

-- Líneas de la factura original
INSERT INTO public.trade_invoice_lines (factura_id, descripcion, cantidad, precio_unitario, subtotal)
VALUES
  ('ffffffff-0000-0000-0000-000000000001'::uuid, 'Servicio de instalación', 2, 400.00, 800.00),
  ('ffffffff-0000-0000-0000-000000000001'::uuid, 'Material', 1, 200.00, 200.00);

-- Factura en Borrador (para tests de validación)
INSERT INTO public.trade_invoices (
  id, org_id, serie, numero, estado, tipo_factura,
  razon_social_cliente, nif_cliente, direccion_cliente,
  cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
  client_id, fecha, subtotal, iva_pct, iva_importe, total
) VALUES (
  'ffffffff-0000-0000-0000-000000000002'::uuid,
  'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
  'F', 'BORRADOR-F-XXXX', 'Borrador', 'factura',
  'Cliente QA', 'B12345678', 'Calle Mayor 1',
  '28001', 'Madrid', 'Madrid', 'España',
  'cccccccc-0000-0000-0000-000000000001'::uuid,
  '2026-08-01', 500.00, 21, 105.00, 605.00
);

-- ════════════════════════════════════════════════════════════
-- GRUPO A: fn_crear_factura_rectificativa — casos felices
-- ════════════════════════════════════════════════════════════

-- VF-RECT-21: Crear rectificativa R1 → devuelve jsonb con rectificativa_id
DO $$
DECLARE v_res jsonb; v_id uuid;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1',
    'Error en precio unitario'
  );
  PERFORM _assert('VF-RECT-21', v_res IS NOT NULL, 'fn_crear debe devolver jsonb');
  PERFORM _assert('VF-RECT-21b', (v_res->>'tipo_factura_vf') = 'R1', 'tipo_factura_vf debe ser R1');
  -- Limpiar para siguientes tests
  DELETE FROM public.trade_invoice_lines WHERE invoice_id = (v_res->>'rectificativa_id')::uuid;
  DELETE FROM public.trade_invoices WHERE id = (v_res->>'rectificativa_id')::uuid;
END;
$$;

-- VF-RECT-22: Crear R4 → série='R', estado='Borrador', importes negativos
DO $$
DECLARE v_res jsonb; v_id uuid; v_inv record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R4',
    'Cancelación por acuerdo comercial'
  );
  v_id := (v_res->>'rectificativa_id')::uuid;
  SELECT * INTO v_inv FROM public.trade_invoices WHERE id = v_id;
  PERFORM _assert('VF-RECT-22a', v_inv.serie = 'R', 'Serie debe ser R');
  PERFORM _assert('VF-RECT-22b', v_inv.estado = 'Borrador', 'Estado inicial debe ser Borrador');
  PERFORM _assert('VF-RECT-22c', v_inv.tipo_factura = 'rectificativa', 'tipo_factura=rectificativa');
  PERFORM _assert('VF-RECT-22d', v_inv.tipo_factura_vf = 'R4', 'tipo_factura_vf=R4');
  PERFORM _assert('VF-RECT-22e', v_inv.subtotal < 0, 'subtotal negativo');
  PERFORM _assert('VF-RECT-22f', v_inv.iva_importe < 0, 'iva_importe negativo');
  PERFORM _assert('VF-RECT-22g', v_inv.total < 0, 'total negativo');
  PERFORM _assert('VF-RECT-22h', v_inv.rectifica_factura_id = 'ffffffff-0000-0000-0000-000000000001'::uuid, 'rectifica_factura_id correcto');
  DELETE FROM public.trade_invoice_lines WHERE factura_id = v_id;
  DELETE FROM public.trade_invoices WHERE id = v_id;
END;
$$;

-- VF-RECT-23: Snapshot de datos del cliente copiado completamente
DO $$
DECLARE v_res jsonb; v_id uuid; v_inv record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1',
    'Test snapshot cliente'
  );
  v_id := (v_res->>'rectificativa_id')::uuid;
  SELECT * INTO v_inv FROM public.trade_invoices WHERE id = v_id;
  PERFORM _assert('VF-RECT-23a', v_inv.razon_social_cliente = 'Cliente QA Rectificativas SL', 'razon_social_cliente copiada');
  PERFORM _assert('VF-RECT-23b', v_inv.nif_cliente = 'B12345678', 'nif_cliente copiado');
  PERFORM _assert('VF-RECT-23c', v_inv.direccion_cliente = 'Calle Mayor 1', 'direccion_cliente copiada');
  PERFORM _assert('VF-RECT-23d', v_inv.cp_cliente = '28001', 'cp_cliente copiado (GAP-RECT-1)');
  PERFORM _assert('VF-RECT-23e', v_inv.localidad_cliente = 'Madrid', 'localidad_cliente copiada');
  PERFORM _assert('VF-RECT-23f', v_inv.provincia_cliente = 'Madrid', 'provincia_cliente copiada');
  PERFORM _assert('VF-RECT-23g', v_inv.pais_cliente = 'España', 'pais_cliente copiado');
  DELETE FROM public.trade_invoice_lines WHERE factura_id = v_id;
  DELETE FROM public.trade_invoices WHERE id = v_id;
END;
$$;

-- VF-RECT-24: Líneas de la rectificativa son clon negativo
DO $$
DECLARE v_res jsonb; v_id uuid; v_line record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1',
    'Test líneas negativas'
  );
  v_id := (v_res->>'rectificativa_id')::uuid;
  SELECT * INTO v_line FROM public.trade_invoice_lines
    WHERE factura_id = v_id ORDER BY precio_unitario LIMIT 1;
  PERFORM _assert('VF-RECT-24a', v_line.precio_unitario < 0, 'precio_unitario negativo');
  PERFORM _assert('VF-RECT-24b', v_line.subtotal < 0, 'subtotal línea negativo');
  PERFORM _assert('VF-RECT-24c', v_line.cantidad > 0, 'cantidad positiva (clon negativo)');
  DELETE FROM public.trade_invoice_lines WHERE factura_id = v_id;
  DELETE FROM public.trade_invoices WHERE id = v_id;
END;
$$;

-- VF-RECT-25: Número provisional tiene formato BORRADOR-R-XXXXXXXX
DO $$
DECLARE v_res jsonb; v_prov text;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R2',
    'Test número provisional'
  );
  v_prov := v_res->>'numero_provisional';
  PERFORM _assert('VF-RECT-25', v_prov LIKE 'BORRADOR-R-%', 'Número provisional con prefijo BORRADOR-R-: ' || v_prov);
  DELETE FROM public.trade_invoice_lines WHERE invoice_id = (v_res->>'rectificativa_id')::uuid;
  DELETE FROM public.trade_invoices WHERE id = (v_res->>'rectificativa_id')::uuid;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO B: fn_crear_factura_rectificativa — validaciones error
-- ════════════════════════════════════════════════════════════

-- VF-RECT-26: R5 bloqueado explícitamente
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R5', 'intento R5'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-26', v_ok, 'R5 debe lanzar excepción');
END;
$$;

-- VF-RECT-27: Tipo F1 bloqueado (solo R1-R4)
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'F1', 'intento F1'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-27', v_ok, 'F1 como tipo_factura_vf debe lanzar excepción');
END;
$$;

-- VF-RECT-28: Motivo vacío bloqueado
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R1', ''
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-28', v_ok, 'Motivo vacío debe lanzar excepción');
END;
$$;

-- VF-RECT-29: Motivo NULL bloqueado
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R1', NULL
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-29', v_ok, 'Motivo NULL debe lanzar excepción');
END;
$$;

-- VF-RECT-30: Rectificar factura Borrador bloqueado
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000002'::uuid,  -- borrador
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R1', 'intento sobre borrador'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-30', v_ok, 'Rectificar Borrador debe lanzar excepción');
END;
$$;

-- VF-RECT-31: Factura no encontrada (org incorrecta)
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      '99999999-9999-9999-9999-999999999999'::uuid,  -- org inexistente
      'R1', 'cross-org'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-31', v_ok, 'Cross-org debe lanzar excepción');
END;
$$;

-- VF-RECT-32: Duplicado bloqueado (crear segunda rectificativa sobre misma original)
DO $$
DECLARE v_res jsonb; v_ok boolean := false; v_id uuid;
BEGIN
  -- Crear primera rectificativa
  v_res := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'primera rectificativa'
  );
  v_id := (v_res->>'rectificativa_id')::uuid;
  -- Intentar crear segunda
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      'ffffffff-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R1', 'segunda rectificativa (debe fallar)'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-32', v_ok, 'Segunda rectificativa duplicada debe bloquearse');
  -- Limpiar
  DELETE FROM public.trade_invoice_lines WHERE factura_id = v_id;
  DELETE FROM public.trade_invoices WHERE id = v_id;
END;
$$;

-- VF-RECT-33: Rectificar una rectificativa bloqueado
DO $$
DECLARE v_res1 jsonb; v_id1 uuid; v_ok boolean := false;
BEGIN
  -- Crear rectificativa
  v_res1 := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'rectificativa base'
  );
  v_id1 := (v_res1->>'rectificativa_id')::uuid;
  -- Marcar como emitida para pasar el filtro estado != Borrador
  UPDATE public.trade_invoices SET estado = 'Emitida' WHERE id = v_id1;
  -- Intentar rectificar la rectificativa
  BEGIN
    PERFORM public.fn_crear_factura_rectificativa(
      v_id1,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
      'R1', 'rectificar rectificativa (debe fallar)'
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-33', v_ok, 'Rectificar una rectificativa debe bloquearse');
  DELETE FROM public.trade_invoice_lines WHERE invoice_id = v_id1;
  DELETE FROM public.trade_invoices WHERE id = v_id1;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO C: fn_emitir_factura v6 — emisión de rectificativas
-- ════════════════════════════════════════════════════════════

-- VF-RECT-34: Emitir rectificativa R1 → número R-YYYY-XXXX
DO $$
DECLARE v_res_crear jsonb; v_rect_id uuid; v_res_emitir jsonb; v_inv record;
BEGIN
  -- Crear
  v_res_crear := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'Error en importe — emitir test'
  );
  v_rect_id := (v_res_crear->>'rectificativa_id')::uuid;

  -- Emitir
  v_res_emitir := public.fn_emitir_factura(
    v_rect_id,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid
  );
  SELECT * INTO v_inv FROM public.trade_invoices WHERE id = v_rect_id;

  PERFORM _assert('VF-RECT-34a', v_inv.estado = 'Emitida', 'Estado = Emitida');
  PERFORM _assert('VF-RECT-34b', v_inv.numero LIKE 'R-%', 'Número comienza por R-: ' || v_inv.numero);
  PERFORM _assert('VF-RECT-34c', v_inv.numero ~ '^R-[0-9]{4}-[0-9]{4}$', 'Número formato R-YYYY-NNNN: ' || v_inv.numero);
  PERFORM _assert('VF-RECT-34d', v_inv.verifactu_hash IS NOT NULL, 'Hash VeriFactu generado');
  PERFORM _assert('VF-RECT-34e', v_inv.tipo_factura_vf = 'R1', 'tipo_factura_vf persiste R1');
  PERFORM _assert('VF-RECT-34f', (v_res_emitir->>'tipo_factura_vf') = 'R1', 'Result JSON incluye tipo_factura_vf');
  PERFORM _assert('VF-RECT-34g', v_inv.fiscal_record_id IS NOT NULL, 'fiscal_record_id asignado');
END;
$$;

-- VF-RECT-35: tipo_factura_vf en el registro fiscal = R1 (ledger)
DO $$
DECLARE v_res_crear jsonb; v_rect_id uuid; v_fr record;
BEGIN
  v_res_crear := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'ledger tipo_factura_vf test'
  );
  v_rect_id := (v_res_crear->>'rectificativa_id')::uuid;
  -- Limpiar posibles rectificativas anteriores para evitar conflicto de duplicate guard
  -- (en este punto de la transacción pueden haber quedado de tests anteriores ya limpios)
  PERFORM public.fn_emitir_factura(v_rect_id, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  SELECT * INTO v_fr FROM public.trade_fiscal_records
    WHERE invoice_id = v_rect_id;
  PERFORM _assert('VF-RECT-35a', v_fr.tipo_factura_vf = 'R1', 'Ledger: tipo_factura_vf=R1');
  PERFORM _assert('VF-RECT-35b', v_fr.record_type = 'alta', 'Ledger: record_type=alta (NOT anulacion)');
  PERFORM _assert('VF-RECT-35c', v_fr.importe_total < 0, 'Ledger: importe_total negativo para rectificativa');
  PERFORM _assert('VF-RECT-35d', v_fr.cuota_iva < 0, 'Ledger: cuota_iva negativa para rectificativa');
END;
$$;

-- VF-RECT-36: Encadenamiento — hash_anterior de la rect = hash de la última F
DO $$
DECLARE v_res_crear jsonb; v_rect_id uuid; v_last_hash text; v_rect_inv record;
BEGIN
  -- Obtener último hash antes de emitir la rectificativa
  SELECT hash INTO v_last_hash
  FROM public.trade_fiscal_records
  WHERE org_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
  ORDER BY generated_at DESC LIMIT 1;

  v_res_crear := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R3', 'test encadenamiento'
  );
  v_rect_id := (v_res_crear->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(v_rect_id, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);

  SELECT * INTO v_rect_inv FROM public.trade_invoices WHERE id = v_rect_id;
  PERFORM _assert('VF-RECT-36',
    v_rect_inv.verifactu_hash_anterior IS NOT DISTINCT FROM v_last_hash,
    'Encadenamiento correcto: hash_anterior = último hash de org'
  );
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO D: fn_emitir_factura v6 — bloqueos en emisión
-- ════════════════════════════════════════════════════════════

-- VF-RECT-37: Emitir rect sin tipo_factura_vf → error
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id, motivo_rectificacion
    -- tipo_factura_vf omitido intencionalmente
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-BADTEST', 'Borrador', 'rectificativa',
    'Cliente QA', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -1000.00, 21, -210.00, -1210.00,
    'ffffffff-0000-0000-0000-000000000001'::uuid, 'motivo test'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'dddddddd-0000-0000-0000-000000000001'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-37', v_ok, 'Sin tipo_factura_vf debe bloquearse');
  DELETE FROM public.trade_invoices WHERE id = 'dddddddd-0000-0000-0000-000000000001'::uuid;
END;
$$;

-- VF-RECT-38: Emitir rect sin motivo_rectificacion → error
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id
    -- motivo_rectificacion omitido
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000002'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-NOMOTIV', 'Borrador', 'rectificativa', 'R1',
    'Cliente QA', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -1000.00, 21, -210.00, -1210.00,
    'ffffffff-0000-0000-0000-000000000001'::uuid
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'dddddddd-0000-0000-0000-000000000002'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-38', v_ok, 'Sin motivo debe bloquearse');
  DELETE FROM public.trade_invoices WHERE id = 'dddddddd-0000-0000-0000-000000000002'::uuid;
END;
$$;

-- VF-RECT-39: Emitir rect con serie F (no R) → error
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id, motivo_rectificacion
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000003'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'F', 'BORRADOR-F-BADSER', 'Borrador', 'rectificativa', 'R1',
    'Cliente QA', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -1000.00, 21, -210.00, -1210.00,
    'ffffffff-0000-0000-0000-000000000001'::uuid, 'serie incorrecta'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'dddddddd-0000-0000-0000-000000000003'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-39', v_ok, 'Serie F en rectificativa debe bloquearse');
  DELETE FROM public.trade_invoices WHERE id = 'dddddddd-0000-0000-0000-000000000003'::uuid;
END;
$$;

-- VF-RECT-40: Emitir rect sin rectifica_factura_id → error
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    motivo_rectificacion
    -- rectifica_factura_id omitido
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000004'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-NOREF', 'Borrador', 'rectificativa', 'R1',
    'Cliente QA', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -1000.00, 21, -210.00, -1210.00,
    'sin referencia original'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'dddddddd-0000-0000-0000-000000000004'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-40', v_ok, 'Sin rectifica_factura_id debe bloquearse');
  DELETE FROM public.trade_invoices WHERE id = 'dddddddd-0000-0000-0000-000000000004'::uuid;
END;
$$;

-- VF-RECT-41: Emitir rect con original en Borrador → error
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id, motivo_rectificacion
  ) VALUES (
    'dddddddd-0000-0000-0000-000000000005'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-ORIGBOR', 'Borrador', 'rectificativa', 'R1',
    'Cliente QA', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -500.00, 21, -105.00, -605.00,
    'ffffffff-0000-0000-0000-000000000002'::uuid,  -- original en Borrador
    'original es borrador'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'dddddddd-0000-0000-0000-000000000005'::uuid,
      'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-41', v_ok, 'Original en Borrador debe bloquearse');
  DELETE FROM public.trade_invoices WHERE id = 'dddddddd-0000-0000-0000-000000000005'::uuid;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO E: Inmutabilidad — trg_protect_emitted_invoice
-- ════════════════════════════════════════════════════════════

-- VF-RECT-42: No se puede modificar numero de factura emitida ordinaria
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices SET numero = 'HACK-0001'
    WHERE id = 'ffffffff-0000-0000-0000-000000000001'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-42', v_ok, 'Trigger bloquea modificación de numero en emitida');
END;
$$;

-- VF-RECT-43: No se puede modificar tipo_factura_vf de factura emitida
DO $$
DECLARE v_res_crear jsonb; v_rect_id uuid; v_ok boolean := false;
BEGIN
  v_res_crear := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'test inmutabilidad tipo_factura_vf'
  );
  v_rect_id := (v_res_crear->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(v_rect_id, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  BEGIN
    UPDATE public.trade_invoices SET tipo_factura_vf = 'R4' WHERE id = v_rect_id;
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-43', v_ok, 'Trigger bloquea modificación de tipo_factura_vf en emitida');
END;
$$;

-- VF-RECT-44: No se puede modificar verifactu_hash de factura emitida
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices SET verifactu_hash = 'HAXXXX'
    WHERE id = 'ffffffff-0000-0000-0000-000000000001'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-44', v_ok, 'Trigger bloquea modificación de verifactu_hash en emitida');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO F: Numeración serie R
-- ════════════════════════════════════════════════════════════

-- VF-RECT-45: Segunda rectificativa emitida → número R-YYYY-0002
-- (Requiere dos originales distintos o limpiar el duplicate guard)
DO $$
DECLARE
  v_orig2_id uuid := 'ffffffff-0000-0000-0000-000000000010'::uuid;
  v_res1 jsonb; v_res2 jsonb;
  v_id1 uuid; v_id2 uuid;
  v_num1 text; v_num2 text;
BEGIN
  -- Crear segunda factura emitida para tener dos originales distintos
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, fecha_emision,
    subtotal, iva_pct, iva_importe, total,
    verifactu_hash, verifactu_generated_at
  ) VALUES (
    v_orig2_id,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'F', 'F-2026-0002', 'Emitida', 'factura', 'F1',
    'Cliente QA Rectificativas SL', 'B12345678', 'Calle Mayor 1',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-0000-0000-0000-000000000001'::uuid,
    '2026-08-02', NOW() - INTERVAL '2 hours',
    500.00, 21, 105.00, 605.00,
    'EEFF001122334455EEFF001122334455EEFF001122334455EEFF001122334455',
    NOW() - INTERVAL '2 hours'
  );

  -- Rectificativa 1 sobre original 1
  v_res1 := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'primera rect numeración'
  );
  v_id1 := (v_res1->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(v_id1, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  SELECT numero INTO v_num1 FROM public.trade_invoices WHERE id = v_id1;

  -- Rectificativa 2 sobre original 2
  v_res2 := public.fn_crear_factura_rectificativa(
    v_orig2_id,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R4', 'segunda rect numeración'
  );
  v_id2 := (v_res2->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(v_id2, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  SELECT numero INTO v_num2 FROM public.trade_invoices WHERE id = v_id2;

  PERFORM _assert('VF-RECT-45a', v_num1 ~ '^R-[0-9]{4}-[0-9]{4}$', 'Num1 formato correcto: ' || v_num1);
  PERFORM _assert('VF-RECT-45b', v_num2 ~ '^R-[0-9]{4}-[0-9]{4}$', 'Num2 formato correcto: ' || v_num2);
  PERFORM _assert('VF-RECT-45c', v_num1 != v_num2, 'Números distintos: ' || v_num1 || ' vs ' || v_num2);
  -- El segundo número debe ser mayor (correlativo)
  PERFORM _assert('VF-RECT-45d',
    split_part(v_num2, '-', 3)::int > split_part(v_num1, '-', 3)::int,
    'Numeración correlativa: ' || v_num1 || ' → ' || v_num2
  );
END;
$$;

-- ════════════════════════════════════════════════════════════
-- GRUPO G: Validaciones tipo_factura_vf en schema
-- ════════════════════════════════════════════════════════════

-- VF-RECT-46: CHECK constraint rechaza tipo_factura_vf='Z9'
DO $$
DECLARE v_ok boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices
    SET tipo_factura_vf = 'Z9'
    WHERE id = 'ffffffff-0000-0000-0000-000000000002'::uuid  -- borrador, no protegida por trigger
      AND estado = 'Borrador';
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-46', v_ok, 'CHECK constraint rechaza tipo_factura_vf inválido');
END;
$$;

-- VF-RECT-47: CHECK constraint acepta F1, R1, R2, R3, R4
DO $$
DECLARE v_tipos text[] := ARRAY['F1','R1','R2','R3','R4'];
  v_tipo text; v_ok boolean;
BEGIN
  FOREACH v_tipo IN ARRAY v_tipos LOOP
    BEGIN
      UPDATE public.trade_invoices SET tipo_factura_vf = v_tipo
      WHERE id = 'ffffffff-0000-0000-0000-000000000002'::uuid AND estado = 'Borrador';
      v_ok := true;
    EXCEPTION WHEN OTHERS THEN
      v_ok := false;
    END;
    PERFORM _assert('VF-RECT-47-' || v_tipo, v_ok, 'CHECK acepta tipo_factura_vf=' || v_tipo);
  END LOOP;
  -- Restaurar NULL
  UPDATE public.trade_invoices SET tipo_factura_vf = NULL
  WHERE id = 'ffffffff-0000-0000-0000-000000000002'::uuid AND estado = 'Borrador';
END;
$$;

-- VF-RECT-48: Hash input de rectificativa incluye TipoFactura=R1 (no F1)
DO $$
DECLARE v_res_crear jsonb; v_rect_id uuid; v_fr record;
BEGIN
  v_res_crear := public.fn_crear_factura_rectificativa(
    'ffffffff-0000-0000-0000-000000000001'::uuid,
    'aaaaaaaa-0000-0000-0000-000000000001'::uuid,
    'R1', 'test hash input TipoFactura'
  );
  v_rect_id := (v_res_crear->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(v_rect_id, 'aaaaaaaa-0000-0000-0000-000000000001'::uuid);
  SELECT * INTO v_fr FROM public.trade_fiscal_records WHERE invoice_id = v_rect_id;
  PERFORM _assert('VF-RECT-48a',
    v_fr.hash_input LIKE '%&TipoFactura=R1%',
    'Hash input contiene TipoFactura=R1 (no F1): ' || left(v_fr.hash_input, 120)
  );
  PERFORM _assert('VF-RECT-48b',
    v_fr.hash_input NOT LIKE '%&TipoFactura=F1%',
    'Hash input NO contiene TipoFactura=F1'
  );
END;
$$;

-- ════════════════════════════════════════════════════════════
-- RESULTADO FINAL
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_total   int;
  v_passed  int;
  v_failed  int;
  v_rec     record;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE passed), COUNT(*) FILTER (WHERE NOT passed)
  INTO v_total, v_passed, v_failed
  FROM _test_results;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'VF-RECT-21..48 — RESULTADO: % / % PASS', v_passed, v_total;
  IF v_failed > 0 THEN
    RAISE NOTICE '── FALLOS:';
    FOR v_rec IN SELECT * FROM _test_results WHERE NOT passed ORDER BY test_id LOOP
      RAISE NOTICE '  FAIL [%]: %', v_rec.test_id, v_rec.message;
    END LOOP;
  END IF;
  RAISE NOTICE '══════════════════════════════════════════';
END;
$$;

-- ════════════════════════════════════════════════════════════
-- ROLLBACK — ningún dato persiste en la BD
-- ════════════════════════════════════════════════════════════
ROLLBACK;
