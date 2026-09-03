-- ═══════════════════════════════════════════════════════════════════════
-- VF-AEAT-CHAIN — Tests de partición de cadena por org_id + nif_emisor
-- Valida fn_emitir_factura v10 (mig 20260903152628).
-- Ejecutar en rama de test (no producción).
-- UUIDs prefijo ffffffff-ca0X-: reservados para VF-AEAT-CHAIN tests.
-- ═══════════════════════════════════════════════════════════════════════

-- ── SETUP: Usuarios auth de test ──────────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES
  ('ffffffff-ca01-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf-chain-1@trabflow-test.internal', now(), now(), now()),
  ('ffffffff-ca02-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf-chain-2@trabflow-test.internal', now(), now(), now()),
  ('ffffffff-ca03-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf-chain-3@trabflow-test.internal', now(), now(), now())
ON CONFLICT (id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-CHAIN-1: Primera emisión
--   fn_emitir_factura v10 → fiscal_record con nif_emisor = trim(org.nif)
--   is_primer_registro = true (no hay registro previo)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org  uuid := 'ffffffff-ca01-0000-0000-000000000002';
  v_usr  uuid := 'ffffffff-ca01-0000-0000-000000000001';
  v_cli  uuid := 'ffffffff-ca01-0000-0000-000000000003';
  v_inv  uuid := 'ffffffff-ca01-0000-0000-000000000004';
  v_result     jsonb;
  v_nif_stored text;
BEGIN
  -- Org con NIF con espacios (trim debe limpiarlos)
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
  VALUES (v_org, 'Test CHAIN-1', ' B11111101 ', v_usr, 'Europe/Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli, v_org, 'Cliente CHAIN-1', '11111101A', 'Calle 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    100.00, 21.00, 21.00, 121.00,
    'Cliente CHAIN-1', '11111101A', 'Calle 1',
    '28001', 'Madrid', 'Madrid'
  ) ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv, v_org) INTO v_result;

  -- Verificar is_primer_registro
  IF NOT (v_result->>'is_primer_registro')::boolean THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-1] FAIL: is_primer_registro=false (esperado: true).';
  END IF;

  -- Verificar nif_emisor almacenado = trim del NIF de la org
  SELECT nif_emisor INTO v_nif_stored
  FROM public.trade_fiscal_records
  WHERE invoice_id = v_inv AND org_id = v_org;

  IF v_nif_stored IS DISTINCT FROM 'B11111101' THEN
    RAISE EXCEPTION
      '[VF-AEAT-CHAIN-1] FAIL: nif_emisor almacenado=% (esperado: B11111101).',
      COALESCE(v_nif_stored, 'NULL');
  END IF;

  RAISE NOTICE '[VF-AEAT-CHAIN-1] PASS: primera emisión → is_primer_registro=true, nif_emisor=B11111101 (trim aplicado).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-CHAIN-1] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-CHAIN-2: Segunda emisión misma org/NIF
--   fn_emitir_factura v10 → step 8 encuentra el registro anterior
--   con nif_emisor matching → encadenamiento correcto
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org  uuid := 'ffffffff-ca01-0000-0000-000000000002'; -- misma org que CHAIN-1
  v_cli  uuid := 'ffffffff-ca01-0000-0000-000000000003';
  v_inv2 uuid := 'ffffffff-ca01-0000-0000-000000000005';
  v_result        jsonb;
  v_prev_rec_id   uuid;
  v_first_rec_id  uuid;
BEGIN
  -- Obtener id del fiscal_record creado en CHAIN-1
  SELECT id INTO v_first_rec_id
  FROM public.trade_fiscal_records
  WHERE org_id = v_org
  ORDER BY generated_at ASC
  LIMIT 1;

  IF v_first_rec_id IS NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-2] SETUP FAIL: no existe fiscal_record de CHAIN-1.';
  END IF;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv2, v_org, v_cli, 'Borrador', 'ordinaria', 'F',
    200.00, 21.00, 42.00, 242.00,
    'Cliente CHAIN-1', '11111101A', 'Calle 1',
    '28001', 'Madrid', 'Madrid'
  ) ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv2, v_org) INTO v_result;

  -- La segunda factura NO debe ser primera en la cadena
  IF (v_result->>'is_primer_registro')::boolean THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-2] FAIL: is_primer_registro=true en segunda emisión (esperado: false).';
  END IF;

  -- Verificar que previous_record_id apunta al registro de CHAIN-1
  SELECT previous_record_id INTO v_prev_rec_id
  FROM public.trade_fiscal_records
  WHERE invoice_id = v_inv2 AND org_id = v_org;

  IF v_prev_rec_id IS DISTINCT FROM v_first_rec_id THEN
    RAISE EXCEPTION
      '[VF-AEAT-CHAIN-2] FAIL: previous_record_id=% (esperado: %).',
      COALESCE(v_prev_rec_id::text, 'NULL'), v_first_rec_id;
  END IF;

  RAISE NOTICE '[VF-AEAT-CHAIN-2] PASS: segunda emisión encadena con la primera (previous_record_id correcto).';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-CHAIN-2] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-CHAIN-3: Org diferente, NIF diferente → cadena propia
--   La segunda org tiene su primer registro como primer_registro=true,
--   sin encadenamiento con los registros de otra org.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org2 uuid := 'ffffffff-ca02-0000-0000-000000000002';
  v_usr2 uuid := 'ffffffff-ca02-0000-0000-000000000001';
  v_cli2 uuid := 'ffffffff-ca02-0000-0000-000000000003';
  v_inv3 uuid := 'ffffffff-ca02-0000-0000-000000000004';
  v_result      jsonb;
  v_prev_rec_id uuid;
BEGIN
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
  VALUES (v_org2, 'Test CHAIN-3', 'B22222202', v_usr2, 'Europe/Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_cli2, v_org2, 'Cliente CHAIN-3', '22222202A', 'Calle 3', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_inv3, v_org2, v_cli2, 'Borrador', 'ordinaria', 'F',
    300.00, 21.00, 63.00, 363.00,
    'Cliente CHAIN-3', '22222202A', 'Calle 3',
    '28001', 'Madrid', 'Madrid'
  ) ON CONFLICT (id) DO NOTHING;

  SELECT public.fn_emitir_factura(v_inv3, v_org2) INTO v_result;

  -- Primera factura de esta org → primer_registro = true
  IF NOT (v_result->>'is_primer_registro')::boolean THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-3] FAIL: is_primer_registro=false para nueva org (esperado: true).';
  END IF;

  -- previous_record_id debe ser NULL (sin encadenamiento con org ajena)
  SELECT previous_record_id INTO v_prev_rec_id
  FROM public.trade_fiscal_records
  WHERE invoice_id = v_inv3 AND org_id = v_org2;

  IF v_prev_rec_id IS NOT NULL THEN
    RAISE EXCEPTION
      '[VF-AEAT-CHAIN-3] FAIL: previous_record_id=% (esperado: NULL). Cadenas de orgs distintas se mezclaron.',
      v_prev_rec_id;
  END IF;

  RAISE NOTICE '[VF-AEAT-CHAIN-3] PASS: org distinta → cadena independiente, previous_record_id=NULL.';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-CHAIN-3] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-CHAIN-4: Paso 8 — consulta directa verifica partición
--   Simula el comportamiento del paso 8 directamente en SQL.
--   Con org_id + nif_emisor de org 1 → devuelve el registro de org 1.
--   Con org_id + nif_emisor de org 2 → devuelve el registro de org 2.
--   La query del paso 8 es determinística: nunca cruza org_id ni nif_emisor.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org1 uuid := 'ffffffff-ca01-0000-0000-000000000002';
  v_org2 uuid := 'ffffffff-ca02-0000-0000-000000000002';
  v_nif1 text := 'B11111101';
  v_nif2 text := 'B22222202';
  v_prev_org1 record;
  v_prev_org2 record;
BEGIN
  -- Simular paso 8 para org1/nif1
  SELECT id, numero_factura, nif_emisor, org_id
  INTO v_prev_org1
  FROM public.trade_fiscal_records
  WHERE org_id = v_org1 AND nif_emisor = v_nif1
  ORDER BY generated_at DESC LIMIT 1;

  IF v_prev_org1 IS NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-4] FAIL: no se encontró registro para org1/nif1 (esperado: los 2 de CHAIN-1 y CHAIN-2).';
  END IF;

  IF v_prev_org1.org_id IS DISTINCT FROM v_org1 OR v_prev_org1.nif_emisor IS DISTINCT FROM v_nif1 THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-4] FAIL: paso 8 devolvió registro de otra partición (org=%, nif=%).',
      v_prev_org1.org_id, v_prev_org1.nif_emisor;
  END IF;

  -- Simular paso 8 para org2/nif2
  SELECT id, numero_factura, nif_emisor, org_id
  INTO v_prev_org2
  FROM public.trade_fiscal_records
  WHERE org_id = v_org2 AND nif_emisor = v_nif2
  ORDER BY generated_at DESC LIMIT 1;

  IF v_prev_org2 IS NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-4] FAIL: no se encontró registro para org2/nif2.';
  END IF;

  IF v_prev_org2.org_id IS DISTINCT FROM v_org2 OR v_prev_org2.nif_emisor IS DISTINCT FROM v_nif2 THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-4] FAIL: paso 8 devolvió registro de otra partición para org2.';
  END IF;

  -- Verificar que los registros son de orgs distintas (no hay contaminación cruzada)
  IF v_prev_org1.id = v_prev_org2.id THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-4] FAIL: paso 8 devolvió el mismo registro para ambas orgs.';
  END IF;

  RAISE NOTICE '[VF-AEAT-CHAIN-4] PASS: paso 8 aísla cadenas por org_id+nif_emisor. Org1→%, Org2→%.',
    v_prev_org1.numero_factura, v_prev_org2.numero_factura;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-CHAIN-4] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AEAT-CHAIN-5: F-2026-0001 y F-2026-0002 intactos (READ ONLY)
--   Los registros fiscales reales no deben verse alterados por VF-PROD-1.
--   nif_emisor = 13789524N, previous_record_id correcto.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_real_org uuid := '89d05f11-6115-470d-bdac-37d38b9925c0';
  v_fr1_id   uuid := '5f734b32-58f6-41e6-a100-2a1e7e2a10df'; -- F-2026-0001
  v_fr2_id   uuid := 'c044a6ee-cdf2-47ed-8cb1-0d3e5bd38b7b'; -- F-2026-0002
  v_fr1      record;
  v_fr2      record;
BEGIN
  SELECT id, org_id, nif_emisor, numero_factura, previous_record_id, hash
  INTO v_fr1
  FROM public.trade_fiscal_records
  WHERE id = v_fr1_id;

  IF v_fr1 IS NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0001 no encontrado en trade_fiscal_records.';
  END IF;

  IF v_fr1.org_id IS DISTINCT FROM v_real_org THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0001 org_id=% (esperado: %).', v_fr1.org_id, v_real_org;
  END IF;

  IF v_fr1.nif_emisor IS DISTINCT FROM '13789524N' THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0001 nif_emisor=% (esperado: 13789524N).', v_fr1.nif_emisor;
  END IF;

  IF v_fr1.previous_record_id IS NOT NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0001 previous_record_id=% (esperado: NULL).', v_fr1.previous_record_id;
  END IF;

  SELECT id, org_id, nif_emisor, numero_factura, previous_record_id
  INTO v_fr2
  FROM public.trade_fiscal_records
  WHERE id = v_fr2_id;

  IF v_fr2 IS NULL THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0002 no encontrado.';
  END IF;

  IF v_fr2.previous_record_id IS DISTINCT FROM v_fr1_id THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0002 previous_record_id=% (esperado: %).', v_fr2.previous_record_id, v_fr1_id;
  END IF;

  IF v_fr2.nif_emisor IS DISTINCT FROM '13789524N' THEN
    RAISE EXCEPTION '[VF-AEAT-CHAIN-5] FAIL: F-2026-0002 nif_emisor=% (esperado: 13789524N).', v_fr2.nif_emisor;
  END IF;

  RAISE NOTICE '[VF-AEAT-CHAIN-5] PASS: F-2026-0001 y F-2026-0002 intactos. nif_emisor=13789524N, encadenamiento correcto.';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-AEAT-CHAIN-5] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- CLEANUP VF-AEAT-CHAIN
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_orgs uuid[] := ARRAY[
    'ffffffff-ca01-0000-0000-000000000002'::uuid,
    'ffffffff-ca02-0000-0000-000000000002'::uuid,
    'ffffffff-ca03-0000-0000-000000000002'::uuid
  ];
  v_test_users uuid[] := ARRAY[
    'ffffffff-ca01-0000-0000-000000000001'::uuid,
    'ffffffff-ca02-0000-0000-000000000001'::uuid,
    'ffffffff-ca03-0000-0000-000000000001'::uuid
  ];
BEGIN
  DELETE FROM public.trade_verifactu_outbox    WHERE org_id = ANY(v_test_orgs);
  DELETE FROM public.trade_fiscal_records      WHERE org_id = ANY(v_test_orgs);
  DELETE FROM public.trade_org_verifactu_config WHERE org_id = ANY(v_test_orgs);
  DELETE FROM public.trade_invoices            WHERE org_id = ANY(v_test_orgs);
  DELETE FROM public.trade_clients             WHERE org_id = ANY(v_test_orgs);
  DELETE FROM public.trade_organizations       WHERE id     = ANY(v_test_orgs);
  DELETE FROM auth.users                       WHERE id     = ANY(v_test_users);

  RAISE NOTICE '[CLEANUP-CHAIN] Datos de test VF-AEAT-CHAIN eliminados.';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[CLEANUP-CHAIN] Advertencia: % (fiscal_records son append-only).', SQLERRM;
END;
$$;
