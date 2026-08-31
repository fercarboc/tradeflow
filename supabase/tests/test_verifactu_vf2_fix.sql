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
