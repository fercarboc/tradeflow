-- ============================================================
-- VF-RECT-49..57 — Test suite tipo_rectificativa (I/S)
-- VF-RECTIFICATIVAS-IMPL FASE 1B
--
-- IMPORTANTE:
--   • Todos los tests corren en una transacción ROLLBACK.
--   • NO usar org real de Pedro (89d05f11-...).
--   • Org QA temporal creada en la transacción.
-- ============================================================

BEGIN;

SET client_min_messages = WARNING;

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
-- FIXTURE
-- ════════════════════════════════════════════════════════════

INSERT INTO public.trade_organizations (id, name, nif, owner_id, timezone)
VALUES (
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'QA Tipo Rectificativa Org',
  'B88888888',
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Europe/Madrid'
);

INSERT INTO public.trade_clients (id, org_id, nombre, nif, email)
VALUES (
  'cccccccc-1111-0000-0000-000000000001'::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'Cliente QA TipoRect SL',
  'B11111111',
  'qa-tiporect@test.com'
);

-- Factura emitida base
INSERT INTO public.trade_invoices (
  id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
  razon_social_cliente, nif_cliente, direccion_cliente,
  cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
  client_id, fecha, fecha_emision,
  subtotal, iva_pct, iva_importe, total,
  verifactu_hash, verifactu_generated_at
) VALUES (
  'eeeeeeee-0000-0000-0000-000000000001'::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'F', 'F-2026-0100', 'Emitida', 'factura', 'F1',
  'Cliente QA TipoRect SL', 'B11111111', 'Calle Prueba 99',
  '28001', 'Madrid', 'Madrid', 'España',
  'cccccccc-1111-0000-0000-000000000001'::uuid,
  '2026-08-01', NOW() - INTERVAL '1 day',
  2000.00, 21, 420.00, 2420.00,
  'BBCCDDEE00112233BBCCDDEE00112233BBCCDDEE00112233BBCCDDEE00112233',
  NOW() - INTERVAL '1 day'
);

-- Factura ordinaria en Borrador (para VF-RECT-50)
INSERT INTO public.trade_invoices (
  id, org_id, serie, numero, estado, tipo_factura,
  razon_social_cliente, nif_cliente, direccion_cliente,
  cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
  client_id, fecha, subtotal, iva_pct, iva_importe, total
) VALUES (
  'eeeeeeee-0000-0000-0000-000000000002'::uuid,
  'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
  'F', 'BORRADOR-F-QA50', 'Borrador', 'factura',
  'Cliente QA TipoRect SL', 'B11111111', 'Calle Prueba 99',
  '28001', 'Madrid', 'Madrid', 'España',
  'cccccccc-1111-0000-0000-000000000001'::uuid,
  '2026-08-01', 800.00, 21, 168.00, 968.00
);

-- ════════════════════════════════════════════════════════════
-- VF-RECT-49: Rectificativa creada → tipo_rectificativa='I'
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_res jsonb; v_id uuid; v_inv record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R1',
    'VF-RECT-49: tipo_rectificativa test'
  );
  v_id := (v_res->>'rectificativa_id')::uuid;
  SELECT * INTO v_inv FROM public.trade_invoices WHERE id = v_id;

  PERFORM _assert('VF-RECT-49a', v_inv.tipo_rectificativa = 'I',
    'tipo_rectificativa debe ser I: ' || COALESCE(v_inv.tipo_rectificativa, 'NULL'));
  PERFORM _assert('VF-RECT-49b', (v_res->>'tipo_rectificativa') = 'I',
    'JSON devuelto incluye tipo_rectificativa=I');

  DELETE FROM public.trade_invoice_lines WHERE factura_id = v_id;
  DELETE FROM public.trade_invoices WHERE id = v_id;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-50: Factura ordinaria → tipo_rectificativa IS NULL
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_inv record;
BEGIN
  SELECT * INTO v_inv FROM public.trade_invoices
    WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid;

  PERFORM _assert('VF-RECT-50', v_inv.tipo_rectificativa IS NULL,
    'Factura ordinaria debe tener tipo_rectificativa NULL: '
    || COALESCE(v_inv.tipo_rectificativa, 'NULL (correcto)'));
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-51: fn_emitir rechaza rectificativa con NULL
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_id uuid; v_ok boolean := false;
BEGIN
  -- Insertar manualmente con tipo_rectificativa NULL (no pasó por fn_crear)
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id, motivo_rectificacion
    -- tipo_rectificativa omitida → NULL
  ) VALUES (
    'eeeeeeee-0000-0000-0000-000000000010'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-NULLTR', 'Borrador', 'rectificativa', 'R1',
    'Cliente QA TipoRect SL', 'B11111111', 'Calle Prueba 99',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-1111-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -2000.00, 21, -420.00, -2420.00,
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'tipo_rectificativa NULL test'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'eeeeeeee-0000-0000-0000-000000000010'::uuid,
      'bbbbbbbb-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-51', v_ok,
    'fn_emitir debe rechazar rectificativa con tipo_rectificativa NULL');
  DELETE FROM public.trade_invoices WHERE id = 'eeeeeeee-0000-0000-0000-000000000010'::uuid;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-52: fn_emitir rechaza tipo_rectificativa='S'
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_ok boolean := false;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, serie, numero, estado, tipo_factura, tipo_factura_vf,
    tipo_rectificativa,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    client_id, fecha, subtotal, iva_pct, iva_importe, total,
    rectifica_factura_id, motivo_rectificacion
  ) VALUES (
    'eeeeeeee-0000-0000-0000-000000000011'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R', 'BORRADOR-R-SUBST', 'Borrador', 'rectificativa', 'R1',
    'S',  -- por sustitución — no soportado en MVP
    'Cliente QA TipoRect SL', 'B11111111', 'Calle Prueba 99',
    '28001', 'Madrid', 'Madrid', 'España',
    'cccccccc-1111-0000-0000-000000000001'::uuid,
    CURRENT_DATE, -2000.00, 21, -420.00, -2420.00,
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'tipo S test'
  );
  BEGIN
    PERFORM public.fn_emitir_factura(
      'eeeeeeee-0000-0000-0000-000000000011'::uuid,
      'bbbbbbbb-0000-0000-0000-000000000001'::uuid
    );
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;
  PERFORM _assert('VF-RECT-52', v_ok,
    'fn_emitir debe rechazar tipo_rectificativa=S en MVP');
  DELETE FROM public.trade_invoices WHERE id = 'eeeeeeee-0000-0000-0000-000000000011'::uuid;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-53: ledger guarda tipo_rectificativa='I'
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_res jsonb; v_rect_id uuid; v_fr record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R1',
    'VF-RECT-53: ledger tipo_rectificativa'
  );
  v_rect_id := (v_res->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(
    v_rect_id,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );
  SELECT * INTO v_fr FROM public.trade_fiscal_records WHERE invoice_id = v_rect_id;

  PERFORM _assert('VF-RECT-53a', v_fr.tipo_rectificativa = 'I',
    'Ledger: tipo_rectificativa=I: ' || COALESCE(v_fr.tipo_rectificativa, 'NULL'));
  PERFORM _assert('VF-RECT-53b', v_fr.tipo_factura_vf = 'R1',
    'Ledger: tipo_factura_vf=R1 (campo distinto)');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-54: hash_input NO contiene TipoRectificativa
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_res jsonb; v_rect_id uuid; v_fr record;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R4',
    'VF-RECT-54: hash no incluye TipoRectificativa'
  );
  v_rect_id := (v_res->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(
    v_rect_id,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );
  SELECT * INTO v_fr FROM public.trade_fiscal_records WHERE invoice_id = v_rect_id;

  PERFORM _assert('VF-RECT-54a',
    v_fr.hash_input NOT LIKE '%TipoRectificativa%',
    'hash_input NO debe contener TipoRectificativa');
  PERFORM _assert('VF-RECT-54b',
    v_fr.hash_input LIKE '%&TipoFactura=R4%',
    'hash_input SÍ debe contener TipoFactura=R4');
  -- Los 8 campos canónicos deben estar presentes
  PERFORM _assert('VF-RECT-54c',
    v_fr.hash_input LIKE '%IDEmisorFactura=%'
      AND v_fr.hash_input LIKE '%NumSerieFactura=%'
      AND v_fr.hash_input LIKE '%FechaExpedicionFactura=%'
      AND v_fr.hash_input LIKE '%CuotaTotal=%'
      AND v_fr.hash_input LIKE '%ImporteTotal=%'
      AND v_fr.hash_input LIKE '%Huella=%'
      AND v_fr.hash_input LIKE '%FechaHoraHusoGenRegistro=%',
    'hash_input contiene los 8 campos canónicos AEAT');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-55: hash es reproducible (mismo input → mismo hash)
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_res jsonb; v_rect_id uuid; v_fr record; v_hash_recalc text;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R2',
    'VF-RECT-55: hash reproducible'
  );
  v_rect_id := (v_res->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(
    v_rect_id,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );
  SELECT * INTO v_fr FROM public.trade_fiscal_records WHERE invoice_id = v_rect_id;

  -- Recalcular el hash desde el hash_input almacenado
  v_hash_recalc := upper(encode(
    extensions.digest(convert_to(v_fr.hash_input, 'UTF8'), 'sha256'),
    'hex'
  ));

  PERFORM _assert('VF-RECT-55',
    v_hash_recalc = v_fr.hash,
    'Hash es reproducible desde hash_input almacenado');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-56: tipo_rectificativa inmutable post-emisión
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_res jsonb; v_rect_id uuid; v_ok boolean := false;
BEGIN
  v_res := public.fn_crear_factura_rectificativa(
    'eeeeeeee-0000-0000-0000-000000000001'::uuid,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid,
    'R3',
    'VF-RECT-56: inmutabilidad tipo_rectificativa'
  );
  v_rect_id := (v_res->>'rectificativa_id')::uuid;
  PERFORM public.fn_emitir_factura(
    v_rect_id,
    'bbbbbbbb-0000-0000-0000-000000000001'::uuid
  );

  -- Intentar modificar tipo_rectificativa post-emisión
  BEGIN
    UPDATE public.trade_invoices
      SET tipo_rectificativa = 'S'
      WHERE id = v_rect_id;
  EXCEPTION WHEN OTHERS THEN
    v_ok := true;
  END;

  PERFORM _assert('VF-RECT-56', v_ok,
    'Trigger debe bloquear modificación de tipo_rectificativa en factura emitida');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- VF-RECT-57: CHECK constraint acepta I/S, rechaza otros
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE v_ok_invalid boolean := false; v_ok_i boolean; v_ok_s boolean;
BEGIN
  -- Rechaza valor inválido
  BEGIN
    UPDATE public.trade_invoices
      SET tipo_rectificativa = 'X'
      WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_ok_invalid := true;
  END;
  PERFORM _assert('VF-RECT-57a', v_ok_invalid,
    'CHECK rechaza tipo_rectificativa=X');

  -- Acepta I
  BEGIN
    UPDATE public.trade_invoices SET tipo_rectificativa = 'I'
      WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid AND estado = 'Borrador';
    v_ok_i := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok_i := false;
  END;
  PERFORM _assert('VF-RECT-57b', v_ok_i, 'CHECK acepta tipo_rectificativa=I');

  -- Acepta S (reservado para futuro)
  BEGIN
    UPDATE public.trade_invoices SET tipo_rectificativa = 'S'
      WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid AND estado = 'Borrador';
    v_ok_s := true;
  EXCEPTION WHEN OTHERS THEN
    v_ok_s := false;
  END;
  PERFORM _assert('VF-RECT-57c', v_ok_s, 'CHECK acepta tipo_rectificativa=S (futuro)');

  -- Acepta NULL (facturas ordinarias)
  UPDATE public.trade_invoices SET tipo_rectificativa = NULL
    WHERE id = 'eeeeeeee-0000-0000-0000-000000000002'::uuid AND estado = 'Borrador';
  PERFORM _assert('VF-RECT-57d', true, 'NULL aceptado en tipo_rectificativa (facturas ordinarias)');
END;
$$;

-- ════════════════════════════════════════════════════════════
-- RESULTADO
-- ════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_total  int; v_passed int; v_failed int; v_rec record;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE passed), COUNT(*) FILTER (WHERE NOT passed)
  INTO v_total, v_passed, v_failed
  FROM _test_results;

  RAISE NOTICE '══════════════════════════════════════════';
  RAISE NOTICE 'VF-RECT-49..57 — RESULTADO: % / % PASS', v_passed, v_total;
  IF v_failed > 0 THEN
    RAISE NOTICE '── FALLOS:';
    FOR v_rec IN SELECT * FROM _test_results WHERE NOT passed ORDER BY test_id LOOP
      RAISE NOTICE '  FAIL [%]: %', v_rec.test_id, v_rec.message;
    END LOOP;
  END IF;
  RAISE NOTICE '══════════════════════════════════════════';
END;
$$;

ROLLBACK;
