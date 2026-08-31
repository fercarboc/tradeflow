-- ═══════════════════════════════════════════════════════════════════════
-- VF-2-FIX — Tests de máquina de estados, inmutabilidad tipo_factura_vf
--             y numeración por ejercicio.
-- Ejecutar en rama de test (no producción).
-- UUIDs prefijo ffffffff-cc0X-: reservados para VF-2 tests.
-- ═══════════════════════════════════════════════════════════════════════

-- ── SETUP: usuarios auth de test ─────────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES
  ('ffffffff-cc01-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf2-sm@trabflow-test.internal',  now(), now(), now()),
  ('ffffffff-cc02-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf2-num@trabflow-test.internal', now(), now(), now())
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-1: Borrador → Borrador (edición de campos no fiscales)
--               Debe ser permitido por el trigger v4.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc01-0000-0000-000000000002';
  v_usr uuid := 'ffffffff-cc01-0000-0000-000000000001';
  v_cli uuid := 'ffffffff-cc01-0000-0000-000000000003';
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000004';
BEGIN
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org, 'Test VF2-SM', 'B22222201', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente VF2-SM', '22222201A', 'Calle SM 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    100.00, 21.00, 'Cliente VF2-SM', '22222201A',
    'Calle SM 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO UPDATE SET estado = 'Borrador', concepto = NULL;

  -- Editar concepto (campo no fiscal) en un Borrador: debe permitirse.
  UPDATE public.trade_invoices SET concepto = 'Edición de prueba' WHERE id = v_inv;

  RAISE NOTICE '[VF-SM-1] PASS: Borrador→Borrador (edición concepto) permitida.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-SM-1] FAIL: edición de borrador bloqueada inesperadamente: % (%)', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-2: Borrador → Pagada directa — DEBE BLOQUEARSE
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc01-0000-0000-000000000002';
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000004';
  v_blocked boolean := false;
BEGIN
  -- Reusar la factura Borrador del test anterior.
  BEGIN
    UPDATE public.trade_invoices SET estado = 'Pagada' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-SM-2] FAIL: Borrador→Pagada no fue bloqueado. El trigger v4 no está activo.';
  END IF;

  RAISE NOTICE '[VF-SM-2] PASS: Borrador→Pagada bloqueado (SQLSTATE P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-3: Borrador → Pendiente directa — DEBE BLOQUEARSE
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc01-0000-0000-000000000002';
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000004';
  v_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices SET estado = 'Pendiente' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-SM-3] FAIL: Borrador→Pendiente no fue bloqueado.';
  END IF;

  RAISE NOTICE '[VF-SM-3] PASS: Borrador→Pendiente bloqueado (SQLSTATE P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-4: Borrador → Devuelta directa — DEBE BLOQUEARSE
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc01-0000-0000-000000000002';
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000004';
  v_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices SET estado = 'Devuelta' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-SM-4] FAIL: Borrador→Devuelta no fue bloqueado.';
  END IF;

  RAISE NOTICE '[VF-SM-4] PASS: Borrador→Devuelta bloqueado (SQLSTATE P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-5: tipo_factura_vf NO modificable post-emisión
-- Insertar una factura Emitida directamente (el INSERT no dispara el
-- trigger de UPDATE), luego intentar modificar tipo_factura_vf.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc01-0000-0000-000000000002';
  v_cli uuid := 'ffffffff-cc01-0000-0000-000000000003';
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000010';
  v_blocked boolean := false;
BEGIN
  -- Insertar factura Emitida (simula post-fn_emitir_factura)
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, tipo_factura_vf, serie,
    numero, fecha, fecha_emision,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    verifactu_hash
  ) VALUES (
    v_inv, v_org, v_cli, 'Emitida', 'ordinaria', 'F1', 'F',
    'F-2026-TEST-SM5', current_date, now(),
    100.00, 21.00, 'Cliente VF2-SM', '22222201A',
    'Calle SM 1', '28001', 'Madrid', 'Madrid',
    'AABBCCDD00112233AABBCCDD00112233AABBCCDD00112233AABBCCDD00112233'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Intentar modificar tipo_factura_vf en una Emitida — debe fallar.
  BEGIN
    UPDATE public.trade_invoices SET tipo_factura_vf = 'R1' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-SM-5] FAIL: tipo_factura_vf modificado en Emitida — trigger v4 no protege el campo.';
  END IF;

  RAISE NOTICE '[VF-SM-5] PASS: tipo_factura_vf inmutable en Emitida (SQLSTATE P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-SM-6: Emitida → Borrador — DEBE BLOQUEARSE (regresión v3→v4)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_inv uuid := 'ffffffff-cc01-0000-0000-000000000010';
  v_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices SET estado = 'Borrador' WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION '[VF-SM-6] FAIL: Emitida→Borrador no fue bloqueado.';
  END IF;

  RAISE NOTICE '[VF-SM-6] PASS: Emitida→Borrador bloqueado (SQLSTATE P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-NUM-1: Primera emisión del año — número F-YYYY-0001
-- Org nueva (sin historial) emite su primera factura.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org   uuid := 'ffffffff-cc02-0000-0000-000000000002';
  v_usr   uuid := 'ffffffff-cc02-0000-0000-000000000001';
  v_cli   uuid := 'ffffffff-cc02-0000-0000-000000000003';
  v_inv1  uuid := 'ffffffff-cc02-0000-0000-000000000004';
  v_result jsonb;
  v_numero text;
  v_year  int;
  v_expected text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  v_expected := 'F-' || v_year || '-0001';

  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org, 'Test VF2-NUM', 'B22222202', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente NUM', '22222202A', 'Calle NUM 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv1, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    300.00, 21.00, 'Cliente NUM', '22222202A',
    'Calle NUM 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv1, v_org) INTO v_result;
  v_numero := v_result->>'numero';

  IF v_numero IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      '[VF-NUM-1] FAIL: esperado %, obtenido %.', v_expected, v_numero;
  END IF;

  RAISE NOTICE '[VF-NUM-1] PASS: primera factura del ejercicio → %', v_numero;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-NUM-2: Segunda emisión — F-YYYY-0002 (serie F, misma org)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org   uuid := 'ffffffff-cc02-0000-0000-000000000002';
  v_cli   uuid := 'ffffffff-cc02-0000-0000-000000000003';
  v_inv2  uuid := 'ffffffff-cc02-0000-0000-000000000005';
  v_result jsonb;
  v_numero text;
  v_year  int;
  v_expected text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  v_expected := 'F-' || v_year || '-0002';

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv2, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    150.00, 21.00, 'Cliente NUM', '22222202A',
    'Calle NUM 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv2, v_org) INTO v_result;
  v_numero := v_result->>'numero';

  IF v_numero IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      '[VF-NUM-2] FAIL: esperado %, obtenido %.', v_expected, v_numero;
  END IF;

  RAISE NOTICE '[VF-NUM-2] PASS: segunda factura del ejercicio → %', v_numero;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-NUM-3: Series F / M / R independientes
-- Factura M-YYYY-0001 no está contaminada por conteo de serie F.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org   uuid := 'ffffffff-cc02-0000-0000-000000000002';
  v_cli   uuid := 'ffffffff-cc02-0000-0000-000000000003';
  v_inv_m uuid := 'ffffffff-cc02-0000-0000-000000000006';
  v_result jsonb;
  v_numero text;
  v_year  int;
  v_expected text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  v_expected := 'M-' || v_year || '-0001';

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv_m, v_org, v_cli, 'Borrador', 'contrato_cuota', 'M',
    80.00, 21.00, 'Cliente NUM', '22222202A',
    'Calle NUM 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv_m, v_org) INTO v_result;
  v_numero := v_result->>'numero';

  IF v_numero IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      '[VF-NUM-3] FAIL: esperado %, obtenido %. Series deben ser independientes.', v_expected, v_numero;
  END IF;

  RAISE NOTICE '[VF-NUM-3] PASS: serie M independiente de serie F → %', v_numero;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-NUM-4: Facturas históricas (fecha_emision NULL) NO cuentan
-- en el ejercicio actual. Bug pre-v8: COUNT sin filtro de año.
--
-- Setup: insertar 3 Emitidas "históricas" con fecha_emision NULL y
--        2 Emitidas de ejercicio anterior (fecha_emision año pasado).
-- Org nueva para aislar el conteo.
-- Resultado esperado: la siguiente emisión real = F-YYYY-0001.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org   uuid := 'ffffffff-cc02-0000-0000-000000000020';
  v_usr   uuid := 'ffffffff-cc02-0000-0000-000000000001';
  v_cli   uuid := 'ffffffff-cc02-0000-0000-000000000023';
  v_inv   uuid := 'ffffffff-cc02-0000-0000-000000000024';
  v_result jsonb;
  v_numero text;
  v_year  int;
  v_expected text;
BEGIN
  v_year := EXTRACT(YEAR FROM now())::int;
  v_expected := 'F-' || v_year || '-0001';

  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org, 'Test VF2-NUM-Hist', 'B22222220', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  -- 3 facturas históricas (fecha_emision NULL — preexistentes al sistema VeriFactu)
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie, numero,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    fecha_emision
  ) VALUES
    ('ffffffff-cc02-0000-0000-0000000000a1', v_org, v_cli, 'Pagada', 'ordinaria', 'F', 'F-HIST-001',
     100.00, 21.00, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid', NULL),
    ('ffffffff-cc02-0000-0000-0000000000a2', v_org, v_cli, 'Pagada', 'ordinaria', 'F', 'F-HIST-002',
     200.00, 21.00, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid', NULL),
    ('ffffffff-cc02-0000-0000-0000000000a3', v_org, v_cli, 'Emitida', 'ordinaria', 'F', 'F-HIST-003',
     300.00, 21.00, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- 2 facturas del ejercicio anterior
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie, numero,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    fecha_emision
  ) VALUES
    ('ffffffff-cc02-0000-0000-0000000000b1', v_org, v_cli, 'Pagada', 'ordinaria', 'F',
     'F-' || (v_year - 1) || '-0001',
     100.00, 21.00, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid',
     make_timestamptz(v_year - 1, 6, 15, 10, 0, 0, 'Europe/Madrid')),
    ('ffffffff-cc02-0000-0000-0000000000b2', v_org, v_cli, 'Pagada', 'ordinaria', 'F',
     'F-' || (v_year - 1) || '-0002',
     200.00, 21.00, 'Cliente Hist', '22222220A', 'Calle Hist 1', '28001', 'Madrid', 'Madrid',
     make_timestamptz(v_year - 1, 9, 20, 10, 0, 0, 'Europe/Madrid'))
  ON CONFLICT (id) DO NOTHING;

  -- Borrador a emitir en el ejercicio actual
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    500.00, 21.00, 'Cliente Hist', '22222220A',
    'Calle Hist 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv, v_org) INTO v_result;
  v_numero := v_result->>'numero';

  -- Sin el filtro de ejercicio (bug v7), el COUNT daría 5 → F-YYYY-0006.
  -- Con el filtro de ejercicio (fix v8), el COUNT da 0 → F-YYYY-0001.
  IF v_numero IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      '[VF-NUM-4] FAIL: esperado % (filtro ejercicio activo), obtenido % '
      '(bug cross-year: históricas o año anterior contaron).',
      v_expected, v_numero;
  END IF;

  RAISE NOTICE '[VF-NUM-4] PASS: históricas y ejercicio anterior excluidos del COUNT → %', v_numero;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════
-- VF-2-FIX.3 — Tests del emission guard (invariant v5) y timezone v9
-- UUIDs prefijo ffffffff-cc03-*: reservados para VF-GUARD tests.
-- UUIDs prefijo ffffffff-cc04-*: reservados para VF-TIMEZONE tests.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-1: UPDATE Borrador→Emitida sin fiscal_record — BLOQUEADO
-- La v4 dejaba pasar esta transición. La v5 la debe bloquear.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_usr uuid := 'ffffffff-cc01-0000-0000-000000000001';
  v_cli uuid := 'ffffffff-cc03-0000-0000-000000000003';
  v_inv uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_blocked boolean := false;
BEGIN
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org, 'Test VF2-Guard', 'B33333301', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente Guard', '33333301A', 'Calle Guard 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, tipo_factura_vf, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv, v_org, v_cli, 'Borrador', 'ordinaria', 'F1', 'F',
    100.00, 21.00, 'Cliente Guard', '33333301A',
    'Calle Guard 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO UPDATE SET estado = 'Borrador', fiscal_record_id = NULL, verifactu_hash = NULL, numero = 'BORRADOR-G1';

  -- Intento directo Borrador → Emitida sin registro fiscal: debe fallar en v5.
  BEGIN
    UPDATE public.trade_invoices
    SET estado = 'Emitida', numero = 'F-TEST-GUARD-1'
    WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      '[VF-GUARD-1] FAIL: Borrador→Emitida sin registro fiscal no fue bloqueado. '
      'El trigger v5 (invariant guard) no está activo o no funciona.';
  END IF;

  RAISE NOTICE '[VF-GUARD-1] PASS: Borrador→Emitida sin fiscal_record bloqueado (P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-2: UPDATE con fiscal_record_id inventado — BLOQUEADO
-- Se pasa un UUID que no existe en trade_fiscal_records.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_inv uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_fake_fr uuid := 'ffffffff-cc03-dead-beef-000000000099';
  v_blocked boolean := false;
BEGIN
  BEGIN
    UPDATE public.trade_invoices
    SET estado = 'Emitida',
        numero = 'F-TEST-GUARD-2',
        fiscal_record_id = v_fake_fr,
        verifactu_hash = 'FAKEHASH00000000000000000000000000000000000000000000000000000000'
    WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      '[VF-GUARD-2] FAIL: UUID de fiscal_record inexistente no fue detectado. '
      'El invariant guard no verifica la existencia del registro.';
  END IF;

  RAISE NOTICE '[VF-GUARD-2] PASS: fiscal_record_id inexistente bloqueado (P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-3: Fiscal record de otra factura (misma org) — BLOQUEADO
-- El record existe pero su invoice_id no coincide con NEW.id.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org  uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_cli  uuid := 'ffffffff-cc03-0000-0000-000000000003';
  v_inv  uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_inv2 uuid := 'ffffffff-cc03-0000-0000-000000000005';
  v_fr   uuid := 'ffffffff-cc03-0000-0000-000000000010';
  v_blocked boolean := false;
BEGIN
  -- Crear otra factura Emitida de la que viene el registro fiscal
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, tipo_factura_vf, serie,
    numero, fecha_emision,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    verifactu_hash
  ) VALUES (
    v_inv2, v_org, v_cli, 'Emitida', 'ordinaria', 'F1', 'F',
    'F-TEST-OTHER', now(),
    200.00, 21.00, 'Cliente Guard', '33333301A',
    'Calle Guard 1', '28001', 'Madrid', 'Madrid',
    'OTHERHASH0000000000000000000000000000000000000000000000000000000A'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insertar registro fiscal legítimo asociado a v_inv2 (no a v_inv)
  INSERT INTO public.trade_fiscal_records (
    id, org_id, invoice_id, record_type,
    nif_emisor, numero_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    hash, hash_input, generated_at, generated_at_str
  ) VALUES (
    v_fr, v_org, v_inv2, 'alta',
    'B33333301', 'F-TEST-OTHER', 'F1',
    current_date, to_char(current_date, 'DD-MM-YYYY'),
    42.00, 242.00,
    'OTHERHASH0000000000000000000000000000000000000000000000000000000A',
    'IDEmisorFactura=B33333301&...', now(), 'TEST'
  )
  ON CONFLICT DO NOTHING;

  -- Intentar usar el fiscal_record de v_inv2 para emitir v_inv — debe bloquearse.
  BEGIN
    UPDATE public.trade_invoices
    SET estado = 'Emitida',
        numero = 'F-TEST-GUARD-3',
        fiscal_record_id = v_fr,
        verifactu_hash = 'OTHERHASH0000000000000000000000000000000000000000000000000000000A'
    WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      '[VF-GUARD-3] FAIL: Registro fiscal de otra factura (invoice_id diferente) no fue detectado.';
  END IF;

  RAISE NOTICE '[VF-GUARD-3] PASS: fiscal_record de otra factura bloqueado (P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-4: Fiscal record de otra organización — BLOQUEADO
-- El record existe pero su org_id no coincide con NEW.org_id.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_a uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_org_b uuid := 'ffffffff-cc03-0000-0000-000000000020';
  v_usr   uuid := 'ffffffff-cc01-0000-0000-000000000001';
  v_cli_a uuid := 'ffffffff-cc03-0000-0000-000000000003';
  v_cli_b uuid := 'ffffffff-cc03-0000-0000-000000000030';
  v_inv_a uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_inv_b uuid := 'ffffffff-cc03-0000-0000-000000000040';
  v_fr_b  uuid := 'ffffffff-cc03-0000-0000-000000000050';
  v_blocked boolean := false;
BEGIN
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org_b, 'OtherOrg Guard', 'B33333302', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli_b, v_org_b, 'Cliente OtherOrg', '33333302A', 'Calle B 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, tipo_factura_vf, serie,
    numero, fecha_emision,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    verifactu_hash
  ) VALUES (
    v_inv_b, v_org_b, v_cli_b, 'Emitida', 'ordinaria', 'F1', 'F',
    'F-TEST-ORGB-1', now(),
    100.00, 21.00, 'Cliente OtherOrg', '33333302A',
    'Calle B 1', '28001', 'Madrid', 'Madrid',
    'ORGBHASH000000000000000000000000000000000000000000000000000000000B'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_fiscal_records (
    id, org_id, invoice_id, record_type,
    nif_emisor, numero_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    hash, hash_input, generated_at, generated_at_str
  ) VALUES (
    v_fr_b, v_org_b, v_inv_b, 'alta',
    'B33333302', 'F-TEST-ORGB-1', 'F1',
    current_date, to_char(current_date, 'DD-MM-YYYY'),
    21.00, 121.00,
    'ORGBHASH000000000000000000000000000000000000000000000000000000000B',
    'IDEmisorFactura=B33333302&...', now(), 'TEST'
  )
  ON CONFLICT DO NOTHING;

  -- Intentar usar el fiscal_record de org_b para emitir una factura de org_a — debe bloquearse.
  BEGIN
    UPDATE public.trade_invoices
    SET estado = 'Emitida',
        numero = 'F-TEST-GUARD-4',
        fiscal_record_id = v_fr_b,
        verifactu_hash = 'ORGBHASH000000000000000000000000000000000000000000000000000000000B'
    WHERE id = v_inv_a;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      '[VF-GUARD-4] FAIL: Registro fiscal de otra organización (org_id diferente) no fue detectado.';
  END IF;

  RAISE NOTICE '[VF-GUARD-4] PASS: fiscal_record de otra org bloqueado (P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-5: Hash incorrecto en verifactu_hash — BLOQUEADO
-- El fiscal_record existe y coincide en todos los campos excepto el hash.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_cli uuid := 'ffffffff-cc03-0000-0000-000000000003';
  v_inv uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_fr  uuid := 'ffffffff-cc03-0000-0000-000000000060';
  v_blocked boolean := false;
BEGIN
  -- Insertar registro fiscal cuyo hash es HASHOK pero la factura pondrá WRONGHASH.
  INSERT INTO public.trade_fiscal_records (
    id, org_id, invoice_id, record_type,
    nif_emisor, numero_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    hash, hash_input, generated_at, generated_at_str
  ) VALUES (
    v_fr, v_org, v_inv, 'alta',
    'B33333301', 'F-TEST-GUARD-5', 'F1',
    current_date, to_char(current_date, 'DD-MM-YYYY'),
    21.00, 121.00,
    'CORRECTHASH0000000000000000000000000000000000000000000000000000001',
    'IDEmisorFactura=B33333301&...', now(), 'TEST'
  )
  ON CONFLICT DO NOTHING;

  BEGIN
    UPDATE public.trade_invoices
    SET estado = 'Emitida',
        numero = 'F-TEST-GUARD-5',
        tipo_factura_vf = 'F1',
        fiscal_record_id = v_fr,
        verifactu_hash = 'WRONGHASH00000000000000000000000000000000000000000000000000000002'
    WHERE id = v_inv;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = 'P0001' THEN
      v_blocked := true;
    ELSE
      RAISE;
    END IF;
  END;

  IF NOT v_blocked THEN
    RAISE EXCEPTION
      '[VF-GUARD-5] FAIL: Hash diferente entre factura y registro fiscal no fue detectado. '
      'El invariant guard debe verificar fr.hash = NEW.verifactu_hash.';
  END IF;

  RAISE NOTICE '[VF-GUARD-5] PASS: hash incorrecto bloqueado (P0001).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-GUARD-6: Ruta legítima via fn_emitir_factura — PERMITIDO
-- Usa la org del test VF-NUM (ffffffff-cc02-*) que ya tiene VF config.
-- Emite una factura nueva — el trigger v5 debe dejarla pasar.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org    uuid := 'ffffffff-cc02-0000-0000-000000000002';
  v_cli    uuid := 'ffffffff-cc02-0000-0000-000000000003';
  v_inv    uuid := 'ffffffff-cc03-0000-0000-000000000070';
  v_result jsonb;
  v_estado text;
BEGIN
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    250.00, 21.00, 'Cliente NUM', '22222202A',
    'Calle NUM 1', '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  -- fn_emitir_factura crea el fiscal_record y luego hace UPDATE estado=Emitida.
  -- El trigger v5 debe verificar el fiscal_record y permitir la transición.
  SELECT public.fn_emitir_factura(v_inv, v_org) INTO v_result;

  SELECT estado INTO v_estado FROM public.trade_invoices WHERE id = v_inv;

  IF v_estado IS DISTINCT FROM 'Emitida' THEN
    RAISE EXCEPTION
      '[VF-GUARD-6] FAIL: fn_emitir_factura legítima no pudo emitir. Estado final: %', v_estado;
  END IF;

  RAISE NOTICE '[VF-GUARD-6] PASS: ruta fn_emitir_factura legítima → estado=Emitida. Número: %',
    v_result->>'numero';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-TIMEZONE-1: Factura emitida a las 23:30 UTC del 31-dic
--   (= 00:30 CET del 01-ene siguiente) obtiene número del año NUEVO.
--
-- Prueba conceptual: simula el escenario de year-boundary creando una
-- factura con fecha_emision en 31-dic UTC / 01-ene local y verificando
-- que el COUNT con AT TIME ZONE la clasifica en el año nuevo.
--
-- NOTA: fn_emitir_factura v9 usa v_local_ts para derivar v_year, por lo
-- que el número asignado siempre pertenece al año local. Este test
-- valida la lógica del COUNT, no la emisión real a medianoche.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org       uuid := 'ffffffff-cc04-0000-0000-000000000002';
  v_usr       uuid := 'ffffffff-cc01-0000-0000-000000000001';
  v_cli       uuid := 'ffffffff-cc04-0000-0000-000000000003';
  v_year_prev int  := EXTRACT(YEAR FROM now())::int - 1;
  -- 31-dic año-anterior a las 23:30 UTC = 00:30 CET del 01-ene año actual
  v_boundary  timestamptz;
  v_local_ts  timestamp;
  v_local_year int;
  v_utc_year   int;
BEGIN
  v_boundary   := make_timestamptz(v_year_prev, 12, 31, 23, 30, 0, 'UTC');
  v_local_ts   := v_boundary AT TIME ZONE 'Europe/Madrid';
  v_local_year := EXTRACT(YEAR FROM v_local_ts)::int;
  v_utc_year   := EXTRACT(YEAR FROM v_boundary AT TIME ZONE 'UTC')::int;

  -- El año UTC es v_year_prev (31-dic), el año local es v_year_prev+1 (01-ene).
  IF v_utc_year IS NOT DISTINCT FROM v_local_year THEN
    RAISE NOTICE '[VF-TIMEZONE-1] SKIP: el timestamp elegido no es cross-year en Europe/Madrid; ajustar lógica de test.';
    RETURN;
  END IF;

  -- Insertar factura Emitida con esa fecha_emision UTC (simula emisión en la frontera).
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id)
  VALUES (v_org, 'Test VF2-TZ', 'B44444401', v_usr)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente TZ', '44444401A', 'Calle TZ 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  -- Insertar como Emitida históricamente con fecha_emision en el boundary.
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie, numero,
    subtotal, iva_pct, razon_social_cliente, nif_cliente,
    direccion_cliente, cp_cliente, localidad_cliente, provincia_cliente,
    fecha_emision
  ) VALUES (
    'ffffffff-cc04-0000-0000-000000000010',
    v_org, v_cli, 'Emitida', 'ordinaria', 'F',
    'F-TZ-BOUNDARY',
    100.00, 21.00, 'Cliente TZ', '44444401A',
    'Calle TZ 1', '28001', 'Madrid', 'Madrid',
    v_boundary
  )
  ON CONFLICT (id) DO NOTHING;

  -- COUNT usando AT TIME ZONE: debe clasificar esta factura en el año LOCAL (v_year_prev+1).
  DECLARE
    v_count_local int;
    v_count_utc   int;
    v_year_new    int := v_year_prev + 1;
  BEGIN
    SELECT COUNT(*) INTO v_count_local
    FROM public.trade_invoices
    WHERE org_id = v_org
      AND serie = 'F'
      AND estado != 'Borrador'
      AND EXTRACT(YEAR FROM (fecha_emision AT TIME ZONE 'Europe/Madrid')) = v_year_new;

    SELECT COUNT(*) INTO v_count_utc
    FROM public.trade_invoices
    WHERE org_id = v_org
      AND serie = 'F'
      AND estado != 'Borrador'
      AND EXTRACT(YEAR FROM fecha_emision) = v_year_new;

    -- Local: 1 (correcto — factura del nuevo año fiscal)
    -- UTC:   0 (incorrecto — la factura todavía era del año viejo en UTC)
    IF v_count_local != 1 THEN
      RAISE EXCEPTION
        '[VF-TIMEZONE-1] FAIL: COUNT con AT TIME ZONE debe ser 1, obtenido: %', v_count_local;
    END IF;
    IF v_count_utc != 0 THEN
      RAISE EXCEPTION
        '[VF-TIMEZONE-1] FAIL: COUNT UTC debe ser 0 en año nuevo (la factura cayó en UTC el año viejo), obtenido: %', v_count_utc;
    END IF;

    RAISE NOTICE
      '[VF-TIMEZONE-1] PASS: factura boundary 31-dic 23:30 UTC → clasificada en año local % '
      '(COUNT local=%, COUNT UTC=%)',
      v_year_new, v_count_local, v_count_utc;
  END;
END;
$$;
