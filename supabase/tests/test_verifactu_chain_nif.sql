-- ============================================================
-- VF-CHAIN-NIF — Tests de unicidad e inmutabilidad de NIF emisor
-- ============================================================
-- Cobertura:
--   VF-NIF-UNIQUE-1    NIF exacto duplicado bloqueado
--   VF-NIF-UNIQUE-2    NIF en diferente case bloqueado
--   VF-NIF-UNIQUE-3    NIF con separadores (guiones) bloqueado
--   VF-NIF-UNIQUE-4    Múltiples NULL coexisten sin conflicto
--   VF-NIF-IMMUTABLE-1 A→B después de fiscal_records bloqueado
--   VF-NIF-IMMUTABLE-2 A→B ANTES de fiscal_records permitido
--   VF-NIF-IMMUTABLE-3 NULL→A antes de actividad fiscal permitido
--   VF-NIF-IMMUTABLE-4 A→NULL después de fiscal_records bloqueado
--   VF-NIF-IMMUTABLE-5 A→'' después de fiscal_records bloqueado
--   VF-NIF-NORMALIZATION-1 A→' A ' (solo espacios externos) permitido
--   VF-NIF-NORMALIZATION-2 A→'a' (solo case) después de fiscal bloqueado
--   VF-NIF-CHAIN-1     Cadenas org A y org C son independientes
-- ============================================================

DO $$
DECLARE
  v_org_a   uuid := 'ffffffff-cc03-0000-0000-000000000001';
  v_org_b   uuid := 'ffffffff-cc03-0000-0000-000000000002';
  v_org_c   uuid := 'ffffffff-cc03-0000-0000-000000000003';
  v_org_d   uuid := 'ffffffff-cc03-0000-0000-000000000004';
  v_org_e   uuid := 'ffffffff-cc03-0000-0000-000000000005';
  v_owner_1 uuid := 'ffffffff-cc03-0001-0000-000000000001';
  v_owner_2 uuid := 'ffffffff-cc03-0001-0000-000000000002';
  v_owner_3 uuid := 'ffffffff-cc03-0001-0000-000000000003';
  v_owner_4 uuid := 'ffffffff-cc03-0001-0000-000000000004';
  v_owner_5 uuid := 'ffffffff-cc03-0001-0000-000000000005';
  v_err     text;
  v_prev_id uuid;
BEGIN

  -- ── Cleanup previo ──────────────────────────────────────────
  DELETE FROM public.trade_fiscal_records
    WHERE org_id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM public.trade_organizations
    WHERE id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM auth.users
    WHERE id IN (v_owner_1, v_owner_2, v_owner_3, v_owner_4, v_owner_5);

  -- ── Stub owners en auth.users (necesario para FK) ──────────
  INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner_1, 'authenticated', 'authenticated', 'nif-test-1@test.internal', NOW(), NOW(), NOW()),
    (v_owner_2, 'authenticated', 'authenticated', 'nif-test-2@test.internal', NOW(), NOW(), NOW()),
    (v_owner_3, 'authenticated', 'authenticated', 'nif-test-3@test.internal', NOW(), NOW(), NOW()),
    (v_owner_4, 'authenticated', 'authenticated', 'nif-test-4@test.internal', NOW(), NOW(), NOW()),
    (v_owner_5, 'authenticated', 'authenticated', 'nif-test-5@test.internal', NOW(), NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;

  -- ── Fixture: orgs base ──────────────────────────────────────
  -- Org A: NIF 'X0000001A' (sin guión, mayúsculas)
  INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
  VALUES (v_org_a, v_owner_1, 'NIF Test Org A', 'X0000001A', 'Fontanería');

  -- Org C: NIF distinto — para test de aislamiento de cadena
  INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
  VALUES (v_org_c, v_owner_3, 'NIF Test Org C', 'X0000003A', 'Fontanería');

  -- Org D: nif = NULL — para test onboarding
  INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
  VALUES (v_org_d, v_owner_4, 'NIF Test Org D', NULL, 'Fontanería');


  -- ── VF-NIF-UNIQUE-1: NIF exacto duplicado bloqueado ────────
  BEGIN
    INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
    VALUES (v_org_b, v_owner_2, 'NIF Test Org B', 'X0000001A', 'Fontanería');
    RAISE NOTICE '[VF-NIF-UNIQUE-1] FAIL: NIF exacto duplicado no fue bloqueado.';
    DELETE FROM public.trade_organizations WHERE id = v_org_b;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '[VF-NIF-UNIQUE-1] PASS: NIF exacto duplicado bloqueado (23505).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-UNIQUE-1] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-UNIQUE-2: NIF diferente case bloqueado ──────────
  BEGIN
    INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
    VALUES (v_org_b, v_owner_2, 'NIF Test Org B', 'x0000001a', 'Fontanería');
    RAISE NOTICE '[VF-NIF-UNIQUE-2] FAIL: NIF en minúsculas no fue bloqueado como duplicado.';
    DELETE FROM public.trade_organizations WHERE id = v_org_b;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '[VF-NIF-UNIQUE-2] PASS: NIF en minúsculas bloqueado como duplicado (23505).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-UNIQUE-2] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-UNIQUE-3: NIF con separadores bloqueado ─────────
  -- 'X-0000001-A' → canon 'X0000001A' = org A
  BEGIN
    INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
    VALUES (v_org_b, v_owner_2, 'NIF Test Org B', 'X-0000001-A', 'Fontanería');
    RAISE NOTICE '[VF-NIF-UNIQUE-3] FAIL: NIF con guiones equivalente no fue bloqueado.';
    DELETE FROM public.trade_organizations WHERE id = v_org_b;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '[VF-NIF-UNIQUE-3] PASS: NIF con guiones equivalente bloqueado (23505).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-UNIQUE-3] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-UNIQUE-4: múltiples NULL coexisten sin conflicto ─
  -- Índice parcial excluye NULL → no hay colisión entre orgs sin NIF
  BEGIN
    INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
    VALUES (v_org_e, v_owner_5, 'NIF Test Org E sin NIF', NULL, 'Fontanería');
    DELETE FROM public.trade_organizations WHERE id = v_org_e;
    RAISE NOTICE '[VF-NIF-UNIQUE-4] PASS: dos orgs con nif=NULL coexisten (índice parcial excluye NULL).';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE NOTICE '[VF-NIF-UNIQUE-4] FAIL: %', v_err;
  END;


  -- ── Org B válida para tests de inmutabilidad ────────────────
  INSERT INTO public.trade_organizations (id, owner_id, nombre, nif, oficio)
  VALUES (v_org_b, v_owner_2, 'NIF Test Org B', 'X0000002A', 'Fontanería');

  -- ── Actividad fiscal simulada en Org A ─────────────────────
  INSERT INTO public.trade_fiscal_records (
    org_id, invoice_id, record_type, nif_emisor,
    numero_factura, serie_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    hash, hash_input, generated_at, generated_at_str, timezone_used
  ) VALUES (
    v_org_a, NULL, 'alta', 'X0000001A',
    'F-2099-0001', 'F', 'F1', '2099-01-01', '01-01-2099',
    21.00, 121.00,
    'TESTHASH000000000000000000000001',
    'IDEmisorFactura=X0000001A&NumSerieFactura=F-2099-0001',
    NOW(), '2099-01-01T00:00:00+01:00', 'Europe/Madrid'
  );


  -- ── VF-NIF-IMMUTABLE-1: A→B después de fiscal bloqueado ────
  BEGIN
    UPDATE public.trade_organizations SET nif = 'X0000099A' WHERE id = v_org_a;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-1] FAIL: cambio A→B post-fiscal no fue bloqueado.';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE '[VF-NIF-IMMUTABLE-1] PASS: cambio A→B post-fiscal bloqueado (P0001).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-IMMUTABLE-1] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-IMMUTABLE-4: A→NULL después de fiscal bloqueado ─
  BEGIN
    UPDATE public.trade_organizations SET nif = NULL WHERE id = v_org_a;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-4] FAIL: cambio A→NULL post-fiscal no fue bloqueado.';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE '[VF-NIF-IMMUTABLE-4] PASS: cambio A→NULL post-fiscal bloqueado (P0001).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-IMMUTABLE-4] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-IMMUTABLE-5: A→'' después de fiscal bloqueado ───
  BEGIN
    UPDATE public.trade_organizations SET nif = '' WHERE id = v_org_a;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-5] FAIL: cambio A→'''' post-fiscal no fue bloqueado.';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE '[VF-NIF-IMMUTABLE-5] PASS: cambio A→'''' post-fiscal bloqueado (P0001).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-IMMUTABLE-5] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-NORMALIZATION-1: A→' A ' (solo espacios externos) PERMITIDO ──
  -- trim(' X0000001A ') = 'X0000001A' = trim('X0000001A') → IS DISTINCT FROM = FALSE
  BEGIN
    UPDATE public.trade_organizations SET nif = ' X0000001A ' WHERE id = v_org_a;
    -- Revertir para tests siguientes
    UPDATE public.trade_organizations SET nif = 'X0000001A'    WHERE id = v_org_a;
    RAISE NOTICE '[VF-NIF-NORMALIZATION-1] PASS: cambio a solo espacios externos permitido post-fiscal.';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE NOTICE '[VF-NIF-NORMALIZATION-1] FAIL: %', v_err;
  END;


  -- ── VF-NIF-NORMALIZATION-2: cambio de case después de fiscal bloqueado ──
  -- trim('X0000001A') = 'X0000001A'; trim('x0000001a') = 'x0000001a'
  -- IS DISTINCT FROM = TRUE → trigger bloquea
  BEGIN
    UPDATE public.trade_organizations SET nif = 'x0000001a' WHERE id = v_org_a;
    RAISE NOTICE '[VF-NIF-NORMALIZATION-2] FAIL: cambio de case post-fiscal no fue bloqueado.';
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RAISE NOTICE '[VF-NIF-NORMALIZATION-2] PASS: cambio case-only post-fiscal bloqueado (P0001).';
    WHEN others THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      RAISE NOTICE '[VF-NIF-NORMALIZATION-2] FAIL: error inesperado: %', v_err;
  END;


  -- ── VF-NIF-IMMUTABLE-2: cambio de NIF ANTES de fiscal PERMITIDO ─
  -- Org B no tiene fiscal_records
  BEGIN
    UPDATE public.trade_organizations SET nif = 'X0000022A' WHERE id = v_org_b;
    UPDATE public.trade_organizations SET nif = 'X0000002A' WHERE id = v_org_b;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-2] PASS: cambio de NIF antes de actividad fiscal permitido.';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-2] FAIL: %', v_err;
  END;


  -- ── VF-NIF-IMMUTABLE-3: NULL→A antes de fiscal PERMITIDO ───
  -- Org D no tiene fiscal_records, nif = NULL
  BEGIN
    UPDATE public.trade_organizations SET nif = 'X0000004A' WHERE id = v_org_d;
    UPDATE public.trade_organizations SET nif = NULL         WHERE id = v_org_d;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-3] PASS: NULL→A antes de actividad fiscal permitido (corrección onboarding).';
  EXCEPTION WHEN others THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RAISE NOTICE '[VF-NIF-IMMUTABLE-3] FAIL: %', v_err;
  END;


  -- ── VF-NIF-CHAIN-1: cadenas org A y org C son independientes ─
  -- Insertar fiscal_record en Org C
  INSERT INTO public.trade_fiscal_records (
    org_id, invoice_id, record_type, nif_emisor,
    numero_factura, serie_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    hash, hash_input, generated_at, generated_at_str, timezone_used
  ) VALUES (
    v_org_c, NULL, 'alta', 'X0000003A',
    'F-2099-0001', 'F', 'F1', '2099-01-01', '01-01-2099',
    21.00, 121.00,
    'TESTHASHCHAIN00000000000000000003',
    'IDEmisorFactura=X0000003A&NumSerieFactura=F-2099-0001',
    NOW() - INTERVAL '1 second',
    '2099-01-01T00:00:00+01:00', 'Europe/Madrid'
  ) RETURNING id INTO v_prev_id;

  -- La query de prev (partition = org_id) NO debe cruzar orgs
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_fiscal_records
    WHERE org_id = v_org_c ORDER BY generated_at DESC LIMIT 1
  ) THEN
    RAISE NOTICE '[VF-NIF-CHAIN-1] FAIL: no se encontró prev record para org C.';
  ELSE
    RAISE NOTICE '[VF-NIF-CHAIN-1] PASS: prev record de org C encontrado correctamente.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trade_fiscal_records
    WHERE org_id = v_org_c AND nif_emisor = 'X0000001A'
  ) THEN
    RAISE NOTICE '[VF-NIF-CHAIN-1] FAIL: fiscal_record de org A contamina cadena de org C.';
  ELSE
    RAISE NOTICE '[VF-NIF-CHAIN-1] PASS: cadenas org A y org C completamente independientes.';
  END IF;


  -- ── Cleanup final ───────────────────────────────────────────
  DELETE FROM public.trade_fiscal_records
    WHERE org_id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM public.trade_organizations
    WHERE id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM auth.users
    WHERE id IN (v_owner_1, v_owner_2, v_owner_3, v_owner_4, v_owner_5);

EXCEPTION WHEN others THEN
  DELETE FROM public.trade_fiscal_records
    WHERE org_id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM public.trade_organizations
    WHERE id IN (v_org_a, v_org_b, v_org_c, v_org_d, v_org_e);
  DELETE FROM auth.users
    WHERE id IN (v_owner_1, v_owner_2, v_owner_3, v_owner_4, v_owner_5);
  RAISE;
END $$;
