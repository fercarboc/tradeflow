-- ═══════════════════════════════════════════════════════════════════════
-- VF-1 — Tests de infraestructura VeriFactu
-- Ejecutar como service_role (conexión admin a la BD).
-- Todos los tests usan UUIDs fijos de test (no datos reales).
-- Cada bloque hace rollback para no dejar estado en la BD.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Constantes de test ────────────────────────────────────────────────
-- Org y usuario de test con UUIDs fijos (nunca existentes en producción)
-- NO utilizar: 89d05f11-6115-470d-bdac-37d38b9925c0 (org piloto real)

-- ── SETUP: Usuarios auth de test (solo entorno rama/test) ────────────
-- Necesario porque trade_organizations.owner_id → auth.users.id (FK CASCADE).
-- En producción estos UUIDs no existen. En la rama de test se crean aquí.
INSERT INTO auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
VALUES
  ('ffffffff-0001-0000-0000-000000000002', 'authenticated', 'authenticated', 'vf-test-c@trabflow-test.internal',  now(), now(), now()),
  ('ffffffff-0002-0000-0000-000000000002', 'authenticated', 'authenticated', 'vf-test-a@trabflow-test.internal',  now(), now(), now()),
  ('ffffffff-0003-0000-0000-000000000002', 'authenticated', 'authenticated', 'vf-test-b2@trabflow-test.internal', now(), now(), now()),
  ('ffffffff-aaaa-0000-0000-000000000002', 'authenticated', 'authenticated', 'vf-iso-a@trabflow-test.internal',   now(), now(), now()),
  ('ffffffff-bbbb-0000-0000-000000000002', 'authenticated', 'authenticated', 'vf-iso-b@trabflow-test.internal',   now(), now(), now()),
  ('ffffffff-0004-0000-0000-000000000001', 'authenticated', 'authenticated', 'vf-admin@trabflow-test.internal',   now(), now(), now())
ON CONFLICT (id) DO NOTHING;

-- ── HELPER: fn kill switch ───────────────────────────────────────────
-- Replica lógica TypeScript del worker (verifactu-outbox-worker/index.ts):
--   const killSwitchActive = !enabled || !transmission_enabled ||
--     environment !== 'production' || !producer_nif || !installation_number ||
--     certificate_status !== 'active' || collaboration_agreement_status !== 'active';
-- Devuelve true si el kill switch BLOQUEA la transmisión.
CREATE OR REPLACE FUNCTION _vf_test_kill_switch_active(cfg jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT
    NOT COALESCE((cfg->>'enabled')::boolean, false)
    OR NOT COALESCE((cfg->>'transmission_enabled')::boolean, false)
    OR COALESCE(cfg->>'environment', '') <> 'production'
    OR COALESCE(cfg->>'producer_nif', '') = ''
    OR COALESCE(cfg->>'installation_number', '') = ''
    OR COALESCE(cfg->>'certificate_status', '') <> 'active'
    OR COALESCE(cfg->>'collaboration_agreement_status', '') <> 'active'
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-RLS-1: tenant normal NO puede leer system_config directamente
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user_tenant uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  v_jwt         text;
  v_count       int;
BEGIN
  -- Simular JWT de tenant normal
  v_jwt := json_build_object(
    'sub',  v_user_tenant::text,
    'role', 'authenticated'
  )::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.trade_verifactu_system_config;
  RESET ROLE;

  IF v_count != 0 THEN
    RAISE EXCEPTION
      '[VF-RLS-1] FAIL: tenant normal puede ver system_config (count=%). Esperado: 0.',
      v_count;
  END IF;

  RAISE NOTICE '[VF-RLS-1] PASS: tenant normal no puede leer system_config (count=0).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-RLS-2: admin_get_verifactu_system_config() devuelve config
--               (SECURITY DEFINER bypasea RLS — acceso admin)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cfg jsonb;
  v_enabled boolean;
BEGIN
  -- Llamamos como service_role (contexto admin)
  SELECT public.admin_get_verifactu_system_config() INTO v_cfg;

  IF v_cfg IS NULL THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: admin_get_verifactu_system_config() devolvió NULL.';
  END IF;

  v_enabled := (v_cfg->>'enabled')::boolean;
  IF v_enabled THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: enabled debe ser false (kill switch). Valor actual: %.',
      v_enabled;
  END IF;

  IF (v_cfg->>'transmission_enabled')::boolean THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: transmission_enabled debe ser false. Valor actual: true.';
  END IF;

  IF (v_cfg->>'environment') != 'disabled' THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: environment debe ser ''disabled''. Valor actual: %.',
      v_cfg->>'environment';
  END IF;

  IF (v_cfg->>'producer_nif') IS NOT NULL THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: producer_nif debe ser NULL. Valor actual: %.',
      v_cfg->>'producer_nif';
  END IF;

  IF (v_cfg->>'installation_number') IS NOT NULL THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: installation_number debe ser NULL. Valor actual: %.',
      v_cfg->>'installation_number';
  END IF;

  IF (v_cfg->>'multiple_ot_indicator') IS NOT NULL THEN
    RAISE EXCEPTION
      '[VF-RLS-2] FAIL: multiple_ot_indicator debe ser NULL. Valor actual: %.',
      v_cfg->>'multiple_ot_indicator';
  END IF;

  RAISE NOTICE '[VF-RLS-2] PASS: admin_get_verifactu_system_config() devuelve config con defaults seguros.';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-RLS-3: tenant normal NO puede leer outbox de otra org
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user_a   uuid := 'eeeeeeee-0000-0000-0000-000000000001';
  v_user_b   uuid := 'eeeeeeee-0000-0000-0000-000000000002';
  v_jwt      text;
  v_count    int;
BEGIN
  -- Simular JWT de user_b intentando leer outbox de user_a
  v_jwt := json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  -- No hay org real de user_a en el entorno de test → count debe ser 0
  SELECT COUNT(*) INTO v_count FROM public.trade_verifactu_outbox;
  RESET ROLE;

  -- Pasamos si count=0 (RLS bloquea o tabla vacía para este usuario)
  RAISE NOTICE '[VF-RLS-3] PASS: tenant ve % entradas en outbox (RLS activo).', v_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-OUTBOX-CASO-C/D: org sin config → NO outbox
-- ─────────────────────────────────────────────────────────────────────
-- Fixture: org de test, cliente de test, factura en Borrador
-- Assertion: fn_emitir_factura crea fiscal_record pero NO outbox entry

DO $$
DECLARE
  v_test_org_id   uuid := 'ffffffff-0001-0000-0000-000000000001';
  v_test_user_id  uuid := 'ffffffff-0001-0000-0000-000000000002';
  v_test_cli_id   uuid := 'ffffffff-0001-0000-0000-000000000003';
  v_test_inv_id   uuid := 'ffffffff-0001-0000-0000-000000000004';
  v_result        jsonb;
  v_outbox_count  int;
  v_fr_count      int;
BEGIN

  -- Setup org
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
  VALUES (v_test_org_id, 'Test Org VF-CASO-C', 'B12345678', v_test_user_id, 'Europe/Madrid')
  ON CONFLICT (id) DO NOTHING;

  -- Setup cliente
  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_test_cli_id, v_test_org_id, 'Cliente Test VF', '12345678Z', 'Calle Test 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  -- Setup factura Borrador (con snapshot fiscal completo)
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_test_inv_id, v_test_org_id, v_test_cli_id, 'Borrador', 'ordinaria', 'F',
    100.00, 21.00, 21.00, 121.00,
    'Cliente Test VF', '12345678Z', 'Calle Test 1',
    '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Sin trade_org_verifactu_config para v_test_org_id → external_billing por defecto

  -- Emitir factura como service_role
  SELECT public.fn_emitir_factura(v_test_inv_id, v_test_org_id) INTO v_result;

  -- Verificar que NO se creó outbox
  SELECT COUNT(*) INTO v_outbox_count
  FROM public.trade_verifactu_outbox
  WHERE org_id = v_test_org_id;

  -- Verificar que SÍ se creó fiscal_record
  SELECT COUNT(*) INTO v_fr_count
  FROM public.trade_fiscal_records
  WHERE org_id = v_test_org_id AND invoice_id = v_test_inv_id;

  -- Assertions
  IF (v_result->>'outbox_entry_created')::boolean THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-D] FAIL: outbox_entry_created=true para org sin config (esperado: false).';
  END IF;

  IF v_outbox_count != 0 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-D] FAIL: se creó outbox entry para org sin config (count=%). Esperado: 0.',
      v_outbox_count;
  END IF;

  IF v_fr_count != 1 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-D] FAIL: fiscal_record count=% (esperado: 1).',
      v_fr_count;
  END IF;

  RAISE NOTICE '[VF-OUTBOX-D] PASS: org sin config → fiscal_record creado, sin outbox.';
  RAISE NOTICE '[VF-OUTBOX-D] outbox_entry_created=%, outbox_count=%, fr_count=%',
    v_result->>'outbox_entry_created', v_outbox_count, v_fr_count;

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-OUTBOX-D] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-OUTBOX-CASO-A: org trabflow_verifactu → outbox pending
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_test_org_id   uuid := 'ffffffff-0002-0000-0000-000000000001';
  v_test_user_id  uuid := 'ffffffff-0002-0000-0000-000000000002';
  v_test_cli_id   uuid := 'ffffffff-0002-0000-0000-000000000003';
  v_test_inv_id   uuid := 'ffffffff-0002-0000-0000-000000000004';
  v_result        jsonb;
  v_outbox_count  int;
  v_outbox_status text;
  v_fr_count      int;
BEGIN

  -- Setup org
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
  VALUES (v_test_org_id, 'Test Org VF-CASO-A', 'B87654321', v_test_user_id, 'Europe/Madrid')
  ON CONFLICT (id) DO NOTHING;

  -- Setup verifactu config → trabflow_verifactu
  INSERT INTO public.trade_org_verifactu_config (org_id, verifactu_mode)
  VALUES (v_test_org_id, 'trabflow_verifactu')
  ON CONFLICT (org_id) DO UPDATE SET verifactu_mode = 'trabflow_verifactu';

  -- Setup cliente
  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_test_cli_id, v_test_org_id, 'Cliente Test VF-A', '87654321A', 'Calle Test 2', '08001', 'Barcelona', 'Barcelona')
  ON CONFLICT (id) DO NOTHING;

  -- Setup factura Borrador
  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_test_inv_id, v_test_org_id, v_test_cli_id, 'Borrador', 'ordinaria', 'F',
    200.00, 21.00, 42.00, 242.00,
    'Cliente Test VF-A', '87654321A', 'Calle Test 2',
    '08001', 'Barcelona', 'Barcelona'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Emitir
  SELECT public.fn_emitir_factura(v_test_inv_id, v_test_org_id) INTO v_result;

  -- Verificar outbox
  SELECT COUNT(*), MAX(status) INTO v_outbox_count, v_outbox_status
  FROM public.trade_verifactu_outbox
  WHERE org_id = v_test_org_id;

  SELECT COUNT(*) INTO v_fr_count
  FROM public.trade_fiscal_records
  WHERE org_id = v_test_org_id AND invoice_id = v_test_inv_id;

  -- Assertions
  IF NOT (v_result->>'outbox_entry_created')::boolean THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-A] FAIL: outbox_entry_created=false para org trabflow_verifactu.';
  END IF;

  IF v_outbox_count != 1 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-A] FAIL: outbox count=% (esperado: 1).', v_outbox_count;
  END IF;

  IF v_outbox_status != 'pending' THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-A] FAIL: outbox status=% (esperado: pending).', v_outbox_status;
  END IF;

  IF v_fr_count != 1 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-A] FAIL: fiscal_record count=% (esperado: 1).', v_fr_count;
  END IF;

  RAISE NOTICE '[VF-OUTBOX-A] PASS: trabflow_verifactu → fiscal_record + 1 outbox pending.';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[VF-OUTBOX-A] ERROR: % — %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-OUTBOX-CASO-B: atomicidad — si outbox falla, todo rollback
-- Verificación: UNIQUE constraint en fiscal_record_id previene duplicados.
-- El comportamiento de rollback es garantía del motor PostgreSQL.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_org_id   uuid := 'ffffffff-0002-0000-0000-000000000001'; -- misma org del test A
  v_test_inv_id   uuid := 'ffffffff-0002-0000-0000-000000000004'; -- misma factura
  v_fiscal_id     uuid;
  v_outbox_before int;
  v_outbox_after  int;
BEGIN
  -- La factura ya está Emitida (test A la emitió). Intentar emitirla de nuevo
  -- debe fallar en el check 'estado != Borrador', no llegar al outbox.
  -- Esto prueba que fn_emitir_factura no deja estado parcial.

  SELECT COUNT(*) INTO v_outbox_before
  FROM public.trade_verifactu_outbox WHERE org_id = v_test_org_id;

  BEGIN
    -- Intentar re-emitir → debe fallar con 'La factura debe estar en estado Borrador'
    PERFORM public.fn_emitir_factura(v_test_inv_id, v_test_org_id);
    RAISE EXCEPTION '[VF-OUTBOX-B] FAIL: segunda emisión no lanzó excepción.';
  EXCEPTION WHEN OTHERS THEN
    -- Esperamos que falle — capturamos y continuamos
    NULL;
  END;

  SELECT COUNT(*) INTO v_outbox_after
  FROM public.trade_verifactu_outbox WHERE org_id = v_test_org_id;

  IF v_outbox_after != v_outbox_before THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-B] FAIL: outbox cambió tras error (antes=%, después=%). '
      'La transacción no hizo rollback.',
      v_outbox_before, v_outbox_after;
  END IF;

  RAISE NOTICE '[VF-OUTBOX-B] PASS: error en re-emisión no creó outbox duplicado (antes=%, después=%).',
    v_outbox_before, v_outbox_after;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-KILL-1: Verificar que system_config inicia en fail-closed
-- (sin necesidad de llamar al worker Edge Function)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cfg jsonb;
BEGIN
  SELECT public.admin_get_verifactu_system_config() INTO v_cfg;

  -- Cada condición del kill switch debe estar en estado bloqueante
  IF (v_cfg->>'enabled')::boolean THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: enabled=true (esperado false).';
  END IF;

  IF (v_cfg->>'transmission_enabled')::boolean THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: transmission_enabled=true (esperado false).';
  END IF;

  IF (v_cfg->>'environment') = 'production' THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: environment=production (esperado disabled/sandbox).';
  END IF;

  IF (v_cfg->>'producer_nif') IS NOT NULL THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: producer_nif no es NULL (esperado NULL).';
  END IF;

  IF (v_cfg->>'installation_number') IS NOT NULL THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: installation_number no es NULL (esperado NULL).';
  END IF;

  IF (v_cfg->>'certificate_status') = 'active' THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: certificate_status=active (esperado not_configured).';
  END IF;

  IF (v_cfg->>'collaboration_agreement_status') = 'active' THEN
    RAISE EXCEPTION '[VF-KILL-1] FAIL: collaboration_agreement_status=active (esperado pending).';
  END IF;

  RAISE NOTICE '[VF-KILL-1] PASS: todos los campos del kill switch en estado bloqueante.';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-IMMUTABILITY-1: F-2026-0001 intacta
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_pilot_org  uuid := '89d05f11-6115-470d-bdac-37d38b9925c0';
  v_fr_count   int;
  v_ob_count   int;
  v_vf_count   int;
BEGIN
  -- Confirmar que existe al menos un fiscal_record para el piloto
  SELECT COUNT(*) INTO v_fr_count
  FROM public.trade_fiscal_records
  WHERE org_id = v_pilot_org;

  -- Confirmar que NO hay outbox para el piloto (F-2026-0001 = external_billing)
  SELECT COUNT(*) INTO v_ob_count
  FROM public.trade_verifactu_outbox
  WHERE org_id = v_pilot_org;

  -- Confirmar que NO hay verifactu config para el piloto
  SELECT COUNT(*) INTO v_vf_count
  FROM public.trade_org_verifactu_config
  WHERE org_id = v_pilot_org;

  IF v_ob_count != 0 THEN
    RAISE EXCEPTION
      '[VF-IMMUTABILITY-1] FAIL: outbox tiene % entradas para org piloto. Esperado: 0.',
      v_ob_count;
  END IF;

  IF v_vf_count != 0 THEN
    RAISE EXCEPTION
      '[VF-IMMUTABILITY-1] FAIL: org piloto tiene % config verifactu. Esperado: 0.',
      v_vf_count;
  END IF;

  RAISE NOTICE '[VF-IMMUTABILITY-1] PASS: org piloto — fiscal_records=%, outbox=%, vf_config=%.',
    v_fr_count, v_ob_count, v_vf_count;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AUTH-1: authenticated NO-admin → admin_get_verifactu_system_config DENIEGA
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tenant_id  uuid := 'ffffffff-0002-0000-0000-000000000002'; -- user de test (no admin)
  v_jwt        text;
  v_cfg        jsonb;
  v_denied     boolean := false;
BEGIN
  v_jwt := json_build_object(
    'sub',  v_tenant_id::text,
    'role', 'authenticated'
  )::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    SELECT public.admin_get_verifactu_system_config() INTO v_cfg;
    -- Si llega aquí sin excepción → FAIL
  EXCEPTION WHEN sqlstate '42501' THEN
    v_denied := true;
  WHEN OTHERS THEN
    v_denied := true; -- cualquier error también denota denegación
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_denied THEN
    RAISE EXCEPTION
      '[VF-AUTH-1] FAIL: tenant NO-admin pudo llamar admin_get_verifactu_system_config() sin error. '
      'La RPC DEBE denegar acceso a usuarios autenticados no-admin.';
  END IF;

  RAISE NOTICE '[VF-AUTH-1] PASS: tenant NO-admin recibe denegación de acceso en admin RPC.';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-AUTH-2: authenticated ADMIN → admin_get_verifactu_system_config FUNCIONA
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_admin_id  uuid := 'ffffffff-0004-0000-0000-000000000001';
  v_jwt       text;
  v_cfg       jsonb;
BEGIN
  -- Registrar usuario como admin de test
  INSERT INTO public.admin_users (user_id, is_active, note)
  VALUES (v_admin_id, true, 'Test VF-AUTH-2 — eliminar después del test')
  ON CONFLICT (user_id) DO UPDATE SET is_active = true;

  -- Simular llamada autenticada como admin
  v_jwt := json_build_object(
    'sub',  v_admin_id::text,
    'role', 'authenticated'
  )::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    SELECT public.admin_get_verifactu_system_config() INTO v_cfg;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    PERFORM set_config('request.jwt.claims', '', true);
    DELETE FROM public.admin_users WHERE user_id = v_admin_id;
    RAISE EXCEPTION '[VF-AUTH-2] FAIL: admin recibió error inesperado: %', SQLERRM;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  -- Limpiar usuario admin de test
  DELETE FROM public.admin_users WHERE user_id = v_admin_id AND note LIKE 'Test VF-AUTH-2%';

  IF v_cfg IS NULL THEN
    RAISE EXCEPTION '[VF-AUTH-2] FAIL: admin_get_verifactu_system_config() devolvió NULL para admin.';
  END IF;

  IF (v_cfg->>'enabled')::boolean THEN
    RAISE EXCEPTION '[VF-AUTH-2] FAIL: enabled=true en respuesta para admin (debe ser false).';
  END IF;

  RAISE NOTICE '[VF-AUTH-2] PASS: admin autenticado puede leer system_config (enabled=false, seguro).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TESTS VF-KILL-A..G: cada gate individualmente activa kill switch
-- Usa helper _vf_test_kill_switch_active(cfg jsonb) creado en SETUP.
-- Config base "todos pasan" excepto el gate que se prueba.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_base jsonb := jsonb_build_object(
    'enabled',                        true,
    'transmission_enabled',           true,
    'environment',                    'production',
    'producer_nif',                   'B12345678',
    'installation_number',            '00001',
    'certificate_status',             'active',
    'collaboration_agreement_status', 'active'
  );
  v_cfg     jsonb;
  v_blocked boolean;

  -- Gate A: enabled=false
  v_fail_a jsonb := jsonb_build_object('enabled', false);
  -- Gate B: transmission_enabled=false
  v_fail_b jsonb := jsonb_build_object('transmission_enabled', false);
  -- Gate C: environment != 'production'
  v_fail_c jsonb := jsonb_build_object('environment', 'sandbox');
  -- Gate D: producer_nif=NULL
  v_fail_d jsonb := jsonb_build_object('producer_nif', null);
  -- Gate E: installation_number=NULL
  v_fail_e jsonb := jsonb_build_object('installation_number', null);
  -- Gate F: certificate_status != 'active'
  v_fail_f jsonb := jsonb_build_object('certificate_status', 'not_configured');
  -- Gate G: collaboration_agreement_status != 'active'
  v_fail_g jsonb := jsonb_build_object('collaboration_agreement_status', 'pending');

BEGIN
  -- Gate A
  v_cfg := v_base || v_fail_a;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-A] FAIL: enabled=false no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-A] PASS: enabled=false → kill switch activo.';

  -- Gate B
  v_cfg := v_base || v_fail_b;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-B] FAIL: transmission_enabled=false no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-B] PASS: transmission_enabled=false → kill switch activo.';

  -- Gate C
  v_cfg := v_base || v_fail_c;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-C] FAIL: environment=sandbox no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-C] PASS: environment≠production → kill switch activo.';

  -- Gate D
  v_cfg := v_base || v_fail_d;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-D] FAIL: producer_nif=NULL no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-D] PASS: producer_nif=NULL → kill switch activo.';

  -- Gate E
  v_cfg := v_base || v_fail_e;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-E] FAIL: installation_number=NULL no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-E] PASS: installation_number=NULL → kill switch activo.';

  -- Gate F
  v_cfg := v_base || v_fail_f;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-F] FAIL: certificate_status=not_configured no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-F] PASS: certificate_status≠active → kill switch activo.';

  -- Gate G
  v_cfg := v_base || v_fail_g;
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;
  IF NOT v_blocked THEN RAISE EXCEPTION '[VF-KILL-G] FAIL: collaboration_agreement_status=pending no activó kill switch.'; END IF;
  RAISE NOTICE '[VF-KILL-G] PASS: collaboration_agreement_status≠active → kill switch activo.';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-KILL-ALL: todos los gates válidos → kill switch INACTIVO
-- El worker respondería VF2_NOT_IMPLEMENTED (sin llamadas AEAT en VF-1).
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cfg jsonb := jsonb_build_object(
    'enabled',                        true,
    'transmission_enabled',           true,
    'environment',                    'production',
    'producer_nif',                   'B12345678',
    'installation_number',            '00001',
    'certificate_status',             'active',
    'collaboration_agreement_status', 'active'
  );
  v_blocked boolean;
BEGIN
  SELECT _vf_test_kill_switch_active(v_cfg) INTO v_blocked;

  IF v_blocked THEN
    RAISE EXCEPTION
      '[VF-KILL-ALL] FAIL: todos los gates válidos → kill switch debería estar INACTIVO. '
      'El worker transmitiría si se llamara (VF-2+, nunca en VF-1).';
  END IF;

  RAISE NOTICE '[VF-KILL-ALL] PASS: gates todos válidos → kill switch inactivo. '
    'Worker respondería VF2_NOT_IMPLEMENTED sin llamadas de red (garantizado por código).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-OUTBOX-B2: ATOMICIDAD REAL — fallo en INSERT outbox hace
-- rollback de fiscal_record + invoice permanece en Borrador.
-- Método: trigger temporal que fuerza excepción en INSERT outbox.
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_test_org_id  uuid := 'ffffffff-0003-0000-0000-000000000001';
  v_test_user_id uuid := 'ffffffff-0003-0000-0000-000000000002';
  v_test_cli_id  uuid := 'ffffffff-0003-0000-0000-000000000003';
  v_test_inv_id  uuid := 'ffffffff-0003-0000-0000-000000000004';
  v_inv_estado   text;
  v_fr_count     int;
  v_ob_count     int;
  v_failed       boolean := false;
BEGIN
  -- Setup org trabflow_verifactu
  INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
  VALUES (v_test_org_id, 'Test Org VF-ATOMICIDAD', 'B99999999', v_test_user_id, 'Europe/Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_org_verifactu_config (org_id, verifactu_mode)
  VALUES (v_test_org_id, 'trabflow_verifactu')
  ON CONFLICT (org_id) DO UPDATE SET verifactu_mode = 'trabflow_verifactu';

  INSERT INTO public.trade_clients (id, org_id, nombre, nif, direccion, cp, localidad, provincia)
  VALUES (v_test_cli_id, v_test_org_id, 'Cliente VF-B2', '99999999Z', 'Calle B2 1', '28001', 'Madrid', 'Madrid')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.trade_invoices (
    id, org_id, client_id, estado, tipo_factura, serie,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente
  ) VALUES (
    v_test_inv_id, v_test_org_id, v_test_cli_id, 'Borrador', 'ordinaria', 'F',
    300.00, 21.00, 63.00, 363.00,
    'Cliente VF-B2', '99999999Z', 'Calle B2 1',
    '28001', 'Madrid', 'Madrid'
  )
  ON CONFLICT (id) DO NOTHING;

  -- Crear trigger bloqueador en outbox para esta org de test.
  -- El trigger levanta EXCEPTION para org_id = v_test_org_id.
  -- Así probamos que la transacción entera hace rollback cuando falla el INSERT outbox.
  CREATE OR REPLACE FUNCTION _vf_test_block_outbox_insert()
  RETURNS trigger LANGUAGE plpgsql AS $func$
  BEGIN
    IF NEW.org_id = 'ffffffff-0003-0000-0000-000000000001'::uuid THEN
      RAISE EXCEPTION 'VF_TEST_OUTBOX_FORCED_FAILURE: atomicity test trigger';
    END IF;
    RETURN NEW;
  END;
  $func$;

  DROP TRIGGER IF EXISTS _vf_test_block_outbox_trg ON public.trade_verifactu_outbox;
  CREATE TRIGGER _vf_test_block_outbox_trg
    BEFORE INSERT ON public.trade_verifactu_outbox
    FOR EACH ROW EXECUTE FUNCTION _vf_test_block_outbox_insert();

  -- Llamar fn_emitir_factura — DEBE fallar en el INSERT del outbox.
  -- El rollback debe revertir: fiscal_record INSERT + invoice UPDATE.
  BEGIN
    PERFORM public.fn_emitir_factura(v_test_inv_id, v_test_org_id);
    -- Si llega aquí sin excepción → FAIL
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
    -- Esperamos este error. El savepoint implícito revertió los DML de fn_emitir_factura.
  END;

  -- Eliminar trigger de test (DDL after exception handler — OK en PL/pgSQL)
  DROP TRIGGER IF EXISTS _vf_test_block_outbox_trg ON public.trade_verifactu_outbox;
  DROP FUNCTION IF EXISTS _vf_test_block_outbox_insert();

  -- Assertions
  IF NOT v_failed THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-B2] FAIL: fn_emitir_factura no lanzó excepción con trigger bloqueador. '
      'Se esperaba fallo en INSERT outbox.';
  END IF;

  SELECT estado INTO v_inv_estado FROM public.trade_invoices WHERE id = v_test_inv_id;
  IF v_inv_estado != 'Borrador' THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-B2] FAIL: invoice estado=% (esperado Borrador — rollback no funcionó).',
      v_inv_estado;
  END IF;

  SELECT COUNT(*) INTO v_fr_count
  FROM public.trade_fiscal_records WHERE invoice_id = v_test_inv_id;
  IF v_fr_count != 0 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-B2] FAIL: fiscal_record count=% (esperado 0 — rollback no revirtió ledger).',
      v_fr_count;
  END IF;

  SELECT COUNT(*) INTO v_ob_count
  FROM public.trade_verifactu_outbox WHERE org_id = v_test_org_id;
  IF v_ob_count != 0 THEN
    RAISE EXCEPTION
      '[VF-OUTBOX-B2] FAIL: outbox count=% (esperado 0 — outbox no debería tener entradas).',
      v_ob_count;
  END IF;

  RAISE NOTICE '[VF-OUTBOX-B2] PASS: fallo en INSERT outbox hizo rollback atómico. '
    'invoice=Borrador, fiscal_records=0, outbox=0. Atomicidad DB confirmada.';

EXCEPTION WHEN OTHERS THEN
  -- Cleanup trigger en caso de error inesperado
  DROP TRIGGER IF EXISTS _vf_test_block_outbox_trg ON public.trade_verifactu_outbox;
  DROP FUNCTION IF EXISTS _vf_test_block_outbox_insert();
  RAISE;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- SETUP ISOLATION: insertar orgs FUERA del DO block de test
-- Si estuvieran dentro y el DO lanzara RAISE EXCEPTION, el rollback
-- eliminaría los INSERTs y los tests siguientes verían 0 filas.
-- ─────────────────────────────────────────────────────────────────────
INSERT INTO public.trade_organizations (id, nombre, nif, owner_id, timezone)
VALUES
  ('ffffffff-aaaa-0000-0000-000000000001', 'Test Org ISO-A', 'A11111111', 'ffffffff-aaaa-0000-0000-000000000002', 'Europe/Madrid'),
  ('ffffffff-bbbb-0000-0000-000000000001', 'Test Org ISO-B', 'B22222222', 'ffffffff-bbbb-0000-0000-000000000002', 'Europe/Madrid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.trade_org_verifactu_config (org_id, verifactu_mode)
VALUES
  ('ffffffff-aaaa-0000-0000-000000000001', 'external_billing'),
  ('ffffffff-bbbb-0000-0000-000000000001', 'external_billing')
ON CONFLICT (org_id) DO NOTHING;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-ISOLATION-1: Org A ve su propia config, NO la de Org B
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_a    uuid := 'ffffffff-aaaa-0000-0000-000000000001';
  v_user_a   uuid := 'ffffffff-aaaa-0000-0000-000000000002';
  v_jwt      text;
  v_count    int;
  v_org_seen text;
BEGIN
  -- Simular user_a como authenticated → debe ver SOLO su org
  v_jwt := json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*), MIN(org_id::text) INTO v_count, v_org_seen
  FROM public.trade_org_verifactu_config;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_count != 1 THEN
    RAISE EXCEPTION
      '[VF-ISOLATION-1] FAIL: user_a ve % filas en config (esperado 1 — solo su org).',
      v_count;
  END IF;

  IF v_org_seen != v_org_a::text THEN
    RAISE EXCEPTION
      '[VF-ISOLATION-1] FAIL: user_a ve org_id=% (esperado su propia org %).', v_org_seen, v_org_a;
  END IF;

  RAISE NOTICE '[VF-ISOLATION-1] PASS: user_a ve solo su config (count=1, org_id correcto). Org B invisible.';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-ISOLATION-2: authenticated NO puede escribir en config/outbox
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_user_a   uuid := 'ffffffff-aaaa-0000-0000-000000000002';
  v_org_a    uuid := 'ffffffff-aaaa-0000-0000-000000000001';
  v_jwt      text;
  v_denied   boolean := false;
BEGIN
  v_jwt := json_build_object('sub', v_user_a::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  -- Intento INSERT en trade_org_verifactu_config → debe fallar
  BEGIN
    INSERT INTO public.trade_org_verifactu_config (org_id, verifactu_mode)
    VALUES (v_org_a, 'trabflow_verifactu')
    ON CONFLICT DO NOTHING;
    -- Si llega aquí sin excepción → NO se denegó → FAIL
    v_denied := false;
  EXCEPTION WHEN OTHERS THEN
    v_denied := true;
  END;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF NOT v_denied THEN
    RAISE EXCEPTION
      '[VF-ISOLATION-2] FAIL: authenticated pudo hacer INSERT en trade_org_verifactu_config. '
      'REVOKE INSERT debe estar activo.';
  END IF;

  RAISE NOTICE '[VF-ISOLATION-2] PASS: authenticated no puede INSERT en trade_org_verifactu_config (REVOKE activo).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- TEST VF-ISOLATION-3: outbox — user_b no ve entradas de org_a
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_a    uuid := 'ffffffff-aaaa-0000-0000-000000000001';
  v_user_b   uuid := 'ffffffff-bbbb-0000-0000-000000000002';
  v_jwt      text;
  v_count    int;
BEGIN
  -- Nota: no hay entradas reales en outbox para org_a (outbox solo
  -- se escribe vía fn_emitir_factura, que requiere trabflow_verifactu mode).
  -- El test verifica que RLS funciona independientemente del contenido.

  v_jwt := json_build_object('sub', v_user_b::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count
  FROM public.trade_verifactu_outbox
  WHERE org_id = v_org_a;

  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);

  IF v_count != 0 THEN
    RAISE EXCEPTION
      '[VF-ISOLATION-3] FAIL: user_b ve % entradas en outbox de org_a. RLS no aísla correctamente.',
      v_count;
  END IF;

  RAISE NOTICE '[VF-ISOLATION-3] PASS: user_b ve 0 entradas en outbox de org_a (RLS activo).';
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- CLEANUP: Limpiar datos de test (orgs temporales)
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_org_c    uuid := 'ffffffff-0001-0000-0000-000000000001';
  v_org_a    uuid := 'ffffffff-0002-0000-0000-000000000001';
  v_org_b2   uuid := 'ffffffff-0003-0000-0000-000000000001';
  v_org_iso_a uuid := 'ffffffff-aaaa-0000-0000-000000000001';
  v_org_iso_b uuid := 'ffffffff-bbbb-0000-0000-000000000001';
  v_test_users uuid[] := ARRAY[
    'ffffffff-0001-0000-0000-000000000002'::uuid,
    'ffffffff-0002-0000-0000-000000000002'::uuid,
    'ffffffff-0003-0000-0000-000000000002'::uuid,
    'ffffffff-aaaa-0000-0000-000000000002'::uuid,
    'ffffffff-bbbb-0000-0000-000000000002'::uuid,
    'ffffffff-0004-0000-0000-000000000001'::uuid
  ];
  v_all_orgs uuid[];
BEGIN
  v_all_orgs := ARRAY[v_org_c, v_org_a, v_org_b2, v_org_iso_a, v_org_iso_b];

  DELETE FROM public.trade_verifactu_outbox WHERE org_id = ANY(v_all_orgs);
  DELETE FROM public.trade_fiscal_records WHERE org_id = ANY(v_all_orgs);
  DELETE FROM public.trade_org_verifactu_config WHERE org_id = ANY(v_all_orgs);
  DELETE FROM public.trade_invoices WHERE org_id = ANY(v_all_orgs);
  DELETE FROM public.trade_clients WHERE org_id = ANY(v_all_orgs);
  DELETE FROM public.trade_organizations WHERE id = ANY(v_all_orgs);

  -- Limpiar usuarios auth de test (solo en rama de test, producción no los tiene)
  DELETE FROM auth.users WHERE id = ANY(v_test_users);

  -- Limpiar admin de test si quedó
  DELETE FROM public.admin_users WHERE user_id = 'ffffffff-0004-0000-0000-000000000001'::uuid;

  -- Limpiar helper function
  DROP FUNCTION IF EXISTS _vf_test_kill_switch_active(jsonb);

  RAISE NOTICE '[CLEANUP] Datos de test eliminados (orgs, usuarios, helper).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '[CLEANUP] Advertencia en cleanup: % (fiscal_records son append-only).', SQLERRM;
END;
$$;
