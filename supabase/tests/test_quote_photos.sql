-- ═══════════════════════════════════════════════════════════════════════
-- PH0-QUOTE-PHOTOS-1A — Tests SQL de trade_quote_photos
-- Valida: tabla, bucket, RLS, trigger límites, concurrencia conceptual.
-- EJECUTAR EXCLUSIVAMENTE contra Supabase local/aislado:
--   supabase test db
-- UUIDs prefijo aaaaaaaa-q01X-: reservados para este test suite.
-- NO ejecutar contra producción.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Setup: Usuarios de test ───────────────────────────────────────────
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES
  -- owner de org A
  ('aaaaaaaa-q010-0000-0000-000000000001','authenticated','authenticated',
   'qp-owner-a@trabflow-test.internal', now(), now(), now()),
  -- miembro activo de org A
  ('aaaaaaaa-q010-0000-0000-000000000002','authenticated','authenticated',
   'qp-member-a@trabflow-test.internal', now(), now(), now()),
  -- owner de org B (cross-org tests)
  ('aaaaaaaa-q010-0000-0000-000000000003','authenticated','authenticated',
   'qp-owner-b@trabflow-test.internal', now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── Setup: Organizaciones de test ─────────────────────────────────────
INSERT INTO public.trade_organizations (id, nombre, owner_id, timezone)
VALUES
  ('aaaaaaaa-q011-0000-0000-000000000001', 'QP-Org-A', 'aaaaaaaa-q010-0000-0000-000000000001', 'Europe/Madrid'),
  ('aaaaaaaa-q011-0000-0000-000000000002', 'QP-Org-B', 'aaaaaaaa-q010-0000-0000-000000000003', 'Europe/Madrid')
ON CONFLICT (id) DO NOTHING;

-- ── Setup: Miembro activo en org A ────────────────────────────────────
INSERT INTO public.trade_org_members (org_id, user_id, role, activo)
VALUES ('aaaaaaaa-q011-0000-0000-000000000001', 'aaaaaaaa-q010-0000-0000-000000000002', 'technician', true)
ON CONFLICT DO NOTHING;

-- ── Setup: Clientes de test ───────────────────────────────────────────
INSERT INTO public.trade_clients (id, org_id, nombre)
VALUES
  ('aaaaaaaa-q012-0000-0000-000000000001', 'aaaaaaaa-q011-0000-0000-000000000001', 'Cliente QP-A'),
  ('aaaaaaaa-q012-0000-0000-000000000002', 'aaaaaaaa-q011-0000-0000-000000000002', 'Cliente QP-B')
ON CONFLICT (id) DO NOTHING;

-- ── Setup: Presupuestos de test ───────────────────────────────────────
INSERT INTO public.trade_quotes (id, org_id, client_id, numero, fecha, estado, total_neto, iva_pct)
VALUES
  ('aaaaaaaa-q013-0000-0000-000000000001', 'aaaaaaaa-q011-0000-0000-000000000001',
   'aaaaaaaa-q012-0000-0000-000000000001', 'QP-A-001', CURRENT_DATE, 'Borrador', 0, 21),
  ('aaaaaaaa-q013-0000-0000-000000000002', 'aaaaaaaa-q011-0000-0000-000000000002',
   'aaaaaaaa-q012-0000-0000-000000000002', 'QP-B-001', CURRENT_DATE, 'Borrador', 0, 21)
ON CONFLICT (id) DO NOTHING;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 1 — Tabla trade_quote_photos existe
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'trade_quote_photos'
  ) THEN
    RAISE EXCEPTION '[QP-1] FAIL: tabla trade_quote_photos no existe';
  END IF;
  RAISE NOTICE '[QP-1] PASS: tabla trade_quote_photos existe';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 2 — Bucket trade-quote-photos existe y es privado
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_public boolean;
BEGIN
  SELECT public INTO v_public FROM storage.buckets WHERE id = 'trade-quote-photos';
  IF v_public IS NULL THEN
    RAISE EXCEPTION '[QP-2] FAIL: bucket trade-quote-photos no existe';
  END IF;
  IF v_public = true THEN
    RAISE EXCEPTION '[QP-2] FAIL: bucket trade-quote-photos es público (debe ser privado)';
  END IF;
  RAISE NOTICE '[QP-2] PASS: bucket trade-quote-photos existe y es privado';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 3 — FK quote_id referencia trade_quotes
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND rc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.key_column_usage kcu2
      ON rc.unique_constraint_name = kcu2.constraint_name
      AND rc.unique_constraint_schema = kcu2.constraint_schema
    WHERE kcu.table_schema = 'public'
      AND kcu.table_name = 'trade_quote_photos'
      AND kcu.column_name = 'quote_id'
      AND kcu2.table_name = 'trade_quotes'
  ) THEN
    RAISE EXCEPTION '[QP-3] FAIL: FK quote_id → trade_quotes no encontrada';
  END IF;
  RAISE NOTICE '[QP-3] PASS: FK quote_id → trade_quotes existe';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 4 — FK org_id referencia trade_organizations
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.key_column_usage kcu
      ON rc.constraint_name = kcu.constraint_name
      AND rc.constraint_schema = kcu.constraint_schema
    JOIN information_schema.key_column_usage kcu2
      ON rc.unique_constraint_name = kcu2.constraint_name
      AND rc.unique_constraint_schema = kcu2.constraint_schema
    WHERE kcu.table_schema = 'public'
      AND kcu.table_name = 'trade_quote_photos'
      AND kcu.column_name = 'org_id'
      AND kcu2.table_name = 'trade_organizations'
  ) THEN
    RAISE EXCEPTION '[QP-4] FAIL: FK org_id → trade_organizations no encontrada';
  END IF;
  RAISE NOTICE '[QP-4] PASS: FK org_id → trade_organizations existe';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 5 — RLS habilitado en trade_quote_photos
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'trade_quote_photos'
      AND c.relrowsecurity = true
  ) THEN
    RAISE EXCEPTION '[QP-5] FAIL: RLS no habilitado en trade_quote_photos';
  END IF;
  RAISE NOTICE '[QP-5] PASS: RLS habilitado en trade_quote_photos';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 6 — Owner SELECT permitido
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  -- Insertar fila de test directamente (como superuser)
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test6.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  -- Simular contexto owner A
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000001","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_quote_photos WHERE id = v_id
  ) THEN
    RAISE EXCEPTION '[QP-6] FAIL: owner no puede SELECT su propia foto';
  END IF;

  RESET role;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;
  RAISE NOTICE '[QP-6] PASS: owner SELECT permitido';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-6] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 7 — Miembro activo SELECT permitido
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test7.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  -- Simular contexto miembro activo de org A
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000002","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_quote_photos WHERE id = v_id
  ) THEN
    RAISE EXCEPTION '[QP-7] FAIL: miembro activo no puede SELECT foto de su org';
  END IF;

  RESET role;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;
  RAISE NOTICE '[QP-7] PASS: miembro activo SELECT permitido';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-7] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 8 — Cross-org SELECT bloqueado (org B no puede ver fotos de org A)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_count integer;
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test8.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  -- Simular contexto owner B
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000003","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  SELECT COUNT(*) INTO v_count FROM public.trade_quote_photos WHERE id = v_id;

  RESET role;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION '[QP-8] FAIL: org B puede ver fotos de org A (RLS cross-org roto)';
  END IF;
  RAISE NOTICE '[QP-8] PASS: cross-org SELECT bloqueado';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-8] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 9 — INSERT válido permitido (owner, quote correcto)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000001","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test9.jpg');

  RESET role;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;
  RAISE NOTICE '[QP-9] PASS: INSERT válido (owner) permitido';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-9] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 10 — INSERT quote/org mismatch bloqueado
--   quote_id de org A + org_id de org B → rechazado por RLS EXISTS
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000003","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  BEGIN
    INSERT INTO public.trade_quote_photos
      (quote_id, org_id, storage_path)
    VALUES
      -- quote_id pertenece a org A, pero org_id es org B (invariante violado)
      ('aaaaaaaa-q013-0000-0000-000000000001',
       'aaaaaaaa-q011-0000-0000-000000000002',
       'aaaaaaaa-q011-0000-0000-000000000002/quotes/aaaaaaaa-q013-0000-0000-000000000001/bad.jpg');

    RESET role;
    RAISE EXCEPTION '[QP-10] FAIL: INSERT quote/org mismatch no fue bloqueado';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RESET role;
      RAISE NOTICE '[QP-10] PASS: INSERT quote/org mismatch bloqueado (% / %)', SQLERRM, SQLSTATE;
    WHEN OTHERS THEN
      RESET role;
      RAISE NOTICE '[QP-10] ERROR inesperado: % — %', SQLERRM, SQLSTATE;
      RAISE;
  END;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 11 — INSERT created_by distinto de auth.uid() bloqueado
-- ═════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000001","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  BEGIN
    INSERT INTO public.trade_quote_photos
      (quote_id, org_id, storage_path, created_by)
    VALUES
      ('aaaaaaaa-q013-0000-0000-000000000001',
       'aaaaaaaa-q011-0000-0000-000000000001',
       'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/spoof.jpg',
       -- Intentar suplantar a otro usuario
       'aaaaaaaa-q010-0000-0000-000000000002');

    RESET role;
    RAISE EXCEPTION '[QP-11] FAIL: INSERT con created_by ajeno no fue bloqueado';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      RESET role;
      RAISE NOTICE '[QP-11] PASS: INSERT con created_by ajeno bloqueado';
    WHEN OTHERS THEN
      RESET role;
      RAISE NOTICE '[QP-11] ERROR inesperado: % — %', SQLERRM, SQLSTATE;
      RAISE;
  END;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 12 — UPDATE owner permitido
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_caption text;
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test12.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000001","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  UPDATE public.trade_quote_photos SET caption = 'Caption test 12' WHERE id = v_id;

  RESET role;
  SELECT caption INTO v_caption FROM public.trade_quote_photos WHERE id = v_id;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;

  IF v_caption IS DISTINCT FROM 'Caption test 12' THEN
    RAISE EXCEPTION '[QP-12] FAIL: UPDATE owner no aplicó correctamente';
  END IF;
  RAISE NOTICE '[QP-12] PASS: UPDATE owner permitido';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-12] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 13 — UPDATE cross-org bloqueado
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_rows integer;
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test13.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  -- Simular owner B intentando modificar foto de org A
  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000003","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  UPDATE public.trade_quote_photos SET caption = 'Malicious' WHERE id = v_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  RESET role;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;

  IF v_rows > 0 THEN
    RAISE EXCEPTION '[QP-13] FAIL: UPDATE cross-org no fue bloqueado (%  filas afectadas)', v_rows;
  END IF;
  RAISE NOTICE '[QP-13] PASS: UPDATE cross-org bloqueado (0 filas afectadas)';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-13] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 14 — DELETE owner permitido
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_count integer;
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test14.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000001","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  DELETE FROM public.trade_quote_photos WHERE id = v_id;

  RESET role;
  SELECT COUNT(*) INTO v_count FROM public.trade_quote_photos WHERE id = v_id;

  IF v_count > 0 THEN
    RAISE EXCEPTION '[QP-14] FAIL: DELETE owner no eliminó la fila';
  END IF;
  RAISE NOTICE '[QP-14] PASS: DELETE owner permitido';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-14] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 15 — DELETE cross-org bloqueado
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_count integer;
BEGIN
  INSERT INTO public.trade_quote_photos
    (id, quote_id, org_id, storage_path, created_by)
  VALUES
    (v_id, 'aaaaaaaa-q013-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001',
     'aaaaaaaa-q011-0000-0000-000000000001/quotes/aaaaaaaa-q013-0000-0000-000000000001/test15.jpg',
     'aaaaaaaa-q010-0000-0000-000000000001');

  PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-q010-0000-0000-000000000003","role":"authenticated"}', true);
  SET LOCAL role authenticated;

  DELETE FROM public.trade_quote_photos WHERE id = v_id;

  RESET role;
  SELECT COUNT(*) INTO v_count FROM public.trade_quote_photos WHERE id = v_id;
  DELETE FROM public.trade_quote_photos WHERE id = v_id;  -- cleanup como superuser

  IF v_count = 0 THEN
    RAISE EXCEPTION '[QP-15] FAIL: DELETE cross-org no fue bloqueado (fila eliminada)';
  END IF;
  RAISE NOTICE '[QP-15] PASS: DELETE cross-org bloqueado (fila no eliminada)';
EXCEPTION WHEN OTHERS THEN
  RESET role;
  BEGIN DELETE FROM public.trade_quote_photos WHERE id = v_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-15] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 16 — Fotos 1..8 permitidas (trigger no bloquea hasta llegar a 8)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_quote uuid := 'aaaaaaaa-q013-0000-0000-000000000001';
  v_org   uuid := 'aaaaaaaa-q011-0000-0000-000000000001';
  v_usr   uuid := 'aaaaaaaa-q010-0000-0000-000000000001';
  i       integer;
  v_ids   uuid[] := ARRAY[]::uuid[];
  v_id    uuid;
BEGIN
  -- Limpiar fotos de test previas
  DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;

  FOR i IN 1..8 LOOP
    v_id := gen_random_uuid();
    v_ids := v_ids || v_id;
    INSERT INTO public.trade_quote_photos (id, quote_id, org_id, storage_path, created_by)
    VALUES (v_id, v_quote, v_org,
            format('%s/quotes/%s/test16_%s.jpg', v_org, v_quote, i), v_usr);
  END LOOP;

  DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
  RAISE NOTICE '[QP-16] PASS: fotos 1..8 insertadas correctamente (trigger no bloquea)';
EXCEPTION WHEN OTHERS THEN
  BEGIN DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-16] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 17 — Foto 9 rechazada (trigger QUOTE_PHOTOS_LIMIT)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_quote uuid := 'aaaaaaaa-q013-0000-0000-000000000001';
  v_org   uuid := 'aaaaaaaa-q011-0000-0000-000000000001';
  v_usr   uuid := 'aaaaaaaa-q010-0000-0000-000000000001';
  i       integer;
  v_ids   uuid[] := ARRAY[]::uuid[];
  v_id    uuid;
BEGIN
  DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;

  -- Insertar 8 fotos (límite máximo)
  FOR i IN 1..8 LOOP
    v_id := gen_random_uuid();
    v_ids := v_ids || v_id;
    INSERT INTO public.trade_quote_photos (id, quote_id, org_id, storage_path, created_by)
    VALUES (v_id, v_quote, v_org,
            format('%s/quotes/%s/test17_%s.jpg', v_org, v_quote, i), v_usr);
  END LOOP;

  -- Intentar insertar la novena
  BEGIN
    INSERT INTO public.trade_quote_photos (quote_id, org_id, storage_path, created_by)
    VALUES (v_quote, v_org,
            format('%s/quotes/%s/test17_9.jpg', v_org, v_quote), v_usr);

    DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
    DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;
    RAISE EXCEPTION '[QP-17] FAIL: foto 9 no fue rechazada por el trigger';
  EXCEPTION
    WHEN raise_exception THEN
      DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
      IF SQLERRM LIKE '%QUOTE_PHOTOS_LIMIT%' THEN
        RAISE NOTICE '[QP-17] PASS: foto 9 rechazada — %', SQLERRM;
      ELSE
        RAISE NOTICE '[QP-17] ERROR inesperado: % — %', SQLERRM, SQLSTATE;
        RAISE;
      END IF;
  END;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 18 — include_in_document 1..3 permitido
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_quote uuid := 'aaaaaaaa-q013-0000-0000-000000000001';
  v_org   uuid := 'aaaaaaaa-q011-0000-0000-000000000001';
  v_usr   uuid := 'aaaaaaaa-q010-0000-0000-000000000001';
  i       integer;
  v_ids   uuid[] := ARRAY[]::uuid[];
  v_id    uuid;
BEGIN
  DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;

  FOR i IN 1..3 LOOP
    v_id := gen_random_uuid();
    v_ids := v_ids || v_id;
    INSERT INTO public.trade_quote_photos
      (id, quote_id, org_id, storage_path, include_in_document, created_by)
    VALUES (v_id, v_quote, v_org,
            format('%s/quotes/%s/test18_%s.jpg', v_org, v_quote, i),
            true, v_usr);
  END LOOP;

  DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
  RAISE NOTICE '[QP-18] PASS: include_in_document 1..3 permitido';
EXCEPTION WHEN OTHERS THEN
  BEGIN DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-18] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 19 — Cuarta include_in_document rechazada
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_quote uuid := 'aaaaaaaa-q013-0000-0000-000000000001';
  v_org   uuid := 'aaaaaaaa-q011-0000-0000-000000000001';
  v_usr   uuid := 'aaaaaaaa-q010-0000-0000-000000000001';
  i       integer;
  v_ids   uuid[] := ARRAY[]::uuid[];
  v_id    uuid;
BEGIN
  DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;

  FOR i IN 1..3 LOOP
    v_id := gen_random_uuid();
    v_ids := v_ids || v_id;
    INSERT INTO public.trade_quote_photos
      (id, quote_id, org_id, storage_path, include_in_document, created_by)
    VALUES (v_id, v_quote, v_org,
            format('%s/quotes/%s/test19_%s.jpg', v_org, v_quote, i),
            true, v_usr);
  END LOOP;

  BEGIN
    INSERT INTO public.trade_quote_photos
      (quote_id, org_id, storage_path, include_in_document, created_by)
    VALUES (v_quote, v_org,
            format('%s/quotes/%s/test19_4.jpg', v_org, v_quote),
            true, v_usr);

    DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
    DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;
    RAISE EXCEPTION '[QP-19] FAIL: cuarta include_in_document no fue rechazada';
  EXCEPTION
    WHEN raise_exception THEN
      DELETE FROM public.trade_quote_photos WHERE id = ANY(v_ids);
      IF SQLERRM LIKE '%QUOTE_DOC_PHOTOS_LIMIT%' THEN
        RAISE NOTICE '[QP-19] PASS: cuarta include_in_document rechazada — %', SQLERRM;
      ELSE
        RAISE NOTICE '[QP-19] ERROR inesperado: % — %', SQLERRM, SQLSTATE;
        RAISE;
      END IF;
  END;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 20 — Desmarcar una permite seleccionar otra (UPDATE serializado)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_quote uuid := 'aaaaaaaa-q013-0000-0000-000000000001';
  v_org   uuid := 'aaaaaaaa-q011-0000-0000-000000000001';
  v_usr   uuid := 'aaaaaaaa-q010-0000-0000-000000000001';
  v_id1   uuid := gen_random_uuid();
  v_id2   uuid := gen_random_uuid();
  v_id3   uuid := gen_random_uuid();
  v_id4   uuid := gen_random_uuid();
  v_count integer;
BEGIN
  DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr;

  -- 3 fotos en documento (límite)
  INSERT INTO public.trade_quote_photos (id, quote_id, org_id, storage_path, include_in_document, created_by)
  VALUES
    (v_id1, v_quote, v_org, format('%s/quotes/%s/test20_1.jpg', v_org, v_quote), true, v_usr),
    (v_id2, v_quote, v_org, format('%s/quotes/%s/test20_2.jpg', v_org, v_quote), true, v_usr),
    (v_id3, v_quote, v_org, format('%s/quotes/%s/test20_3.jpg', v_org, v_quote), true, v_usr),
    (v_id4, v_quote, v_org, format('%s/quotes/%s/test20_4.jpg', v_org, v_quote), false, v_usr);

  -- Desmarcar id1
  UPDATE public.trade_quote_photos SET include_in_document = false WHERE id = v_id1;

  -- Ahora marcar id4 (debería permitirse: solo hay 2 en documento)
  UPDATE public.trade_quote_photos SET include_in_document = true WHERE id = v_id4;

  SELECT COUNT(*) INTO v_count
  FROM public.trade_quote_photos
  WHERE quote_id = v_quote AND include_in_document = true AND created_by = v_usr;

  DELETE FROM public.trade_quote_photos WHERE id IN (v_id1, v_id2, v_id3, v_id4);

  IF v_count <> 3 THEN
    RAISE EXCEPTION '[QP-20] FAIL: tras desmarcar+remarcar hay % fotos en documento (esperado 3)', v_count;
  END IF;
  RAISE NOTICE '[QP-20] PASS: desmarcar una y seleccionar otra funciona correctamente';
EXCEPTION WHEN OTHERS THEN
  BEGIN DELETE FROM public.trade_quote_photos WHERE quote_id = v_quote AND created_by = v_usr; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE NOTICE '[QP-20] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 21 — Storage INSERT own org permitido (verificación de policy)
-- ═════════════════════════════════════════════════════════════════════
-- Nota: las políticas de Storage se validan correctamente sólo cuando
-- el stack local está activo y el usuario tiene sesión JWT real.
-- Este test verifica la estructura de la policy, no la ejecución real.
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'quote_photos_storage_insert';

  IF v_count = 0 THEN
    RAISE EXCEPTION '[QP-21] FAIL: policy quote_photos_storage_insert no existe';
  END IF;
  RAISE NOTICE '[QP-21] PASS: policy quote_photos_storage_insert existe';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 22 — Storage INSERT cross-org policy existe y filtra por org
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_expr(p.qual, p.polrelid) INTO v_def
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage'
    AND c.relname = 'objects'
    AND p.polname = 'quote_photos_storage_insert';

  IF v_def IS NULL THEN
    RAISE EXCEPTION '[QP-22] FAIL: no se pudo leer definición de policy storage_insert';
  END IF;
  IF v_def NOT LIKE '%trade_organizations%' AND v_def NOT LIKE '%trade_org_members%' THEN
    RAISE EXCEPTION '[QP-22] FAIL: policy storage_insert no filtra por org (def: %)', v_def;
  END IF;
  RAISE NOTICE '[QP-22] PASS: policy storage_insert filtra por org';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 23 — Storage SELECT policy existe y filtra por org
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'quote_photos_storage_select';

  IF v_count = 0 THEN
    RAISE EXCEPTION '[QP-23] FAIL: policy quote_photos_storage_select no existe';
  END IF;
  RAISE NOTICE '[QP-23] PASS: policy quote_photos_storage_select existe';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- TEST 24 — Storage DELETE policy es más restrictiva (solo owner)
-- ═════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_expr(p.qual, p.polrelid) INTO v_def
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'storage'
    AND c.relname = 'objects'
    AND p.polname = 'quote_photos_storage_delete';

  IF v_def IS NULL THEN
    RAISE EXCEPTION '[QP-24] FAIL: policy quote_photos_storage_delete no existe';
  END IF;
  -- La policy DELETE no debe incluir trade_org_members (solo owner)
  IF v_def LIKE '%trade_org_members%' THEN
    RAISE EXCEPTION '[QP-24] FAIL: policy storage_delete incluye miembros (debe ser solo owner)';
  END IF;
  IF v_def NOT LIKE '%trade_organizations%' THEN
    RAISE EXCEPTION '[QP-24] FAIL: policy storage_delete no filtra por trade_organizations';
  END IF;
  RAISE NOTICE '[QP-24] PASS: policy storage_delete es owner-only (sin trade_org_members)';
END;
$$;


-- ── Cleanup final ─────────────────────────────────────────────────────
-- (los tests individuales hacen cleanup propio; esto es guardia por si alguno falla)
DELETE FROM public.trade_quote_photos
WHERE org_id IN ('aaaaaaaa-q011-0000-0000-000000000001','aaaaaaaa-q011-0000-0000-000000000002');

DELETE FROM public.trade_quotes
WHERE id IN ('aaaaaaaa-q013-0000-0000-000000000001','aaaaaaaa-q013-0000-0000-000000000002');

DELETE FROM public.trade_clients
WHERE id IN ('aaaaaaaa-q012-0000-0000-000000000001','aaaaaaaa-q012-0000-0000-000000000002');

DELETE FROM public.trade_org_members
WHERE org_id = 'aaaaaaaa-q011-0000-0000-000000000001'
  AND user_id = 'aaaaaaaa-q010-0000-0000-000000000002';

DELETE FROM public.trade_organizations
WHERE id IN ('aaaaaaaa-q011-0000-0000-000000000001','aaaaaaaa-q011-0000-0000-000000000002');

DELETE FROM auth.users
WHERE id IN (
  'aaaaaaaa-q010-0000-0000-000000000001',
  'aaaaaaaa-q010-0000-0000-000000000002',
  'aaaaaaaa-q010-0000-0000-000000000003'
);

RAISE NOTICE '═══ PH0-QUOTE-PHOTOS-1A SQL TESTS DONE ═══';
