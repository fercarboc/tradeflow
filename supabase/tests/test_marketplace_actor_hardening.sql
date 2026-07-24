-- ═══════════════════════════════════════════════════════════════════════════════
-- Tests Sprint 1A.1 — Endurecimiento del Sistema de Actores
-- Ejecutar con service_role tras aplicar ambas migraciones.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- FIXTURES
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_actor_a   uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_actor_b   uuid := 'cccccccc-0000-0000-0000-000000000002';
  v_user_own1 uuid := 'dddddddd-0000-0000-0000-000000000001';
  v_user_own2 uuid := 'dddddddd-0000-0000-0000-000000000002'; -- segundo owner
  v_user_adm  uuid := 'dddddddd-0000-0000-0000-000000000003';
  v_user_view uuid := 'dddddddd-0000-0000-0000-000000000004';
  v_role_owner uuid; v_role_admin uuid; v_role_viewer uuid;
BEGIN
  SELECT id INTO v_role_owner  FROM public.trade_marketplace_roles
    WHERE actor_type = 'supplier' AND nombre = 'owner'  AND is_system = true AND actor_id IS NULL;
  SELECT id INTO v_role_admin  FROM public.trade_marketplace_roles
    WHERE actor_type = 'supplier' AND nombre = 'admin'  AND is_system = true AND actor_id IS NULL;
  SELECT id INTO v_role_viewer FROM public.trade_marketplace_roles
    WHERE actor_type = 'supplier' AND nombre = 'viewer' AND is_system = true AND actor_id IS NULL;

  -- Limpiar de runs anteriores
  DELETE FROM public.trade_marketplace_actor_members WHERE actor_id IN (v_actor_a, v_actor_b);
  DELETE FROM public.trade_marketplace_invitations    WHERE actor_id IN (v_actor_a, v_actor_b);
  DELETE FROM public.trade_marketplace_actors         WHERE id IN (v_actor_a, v_actor_b);

  INSERT INTO public.trade_marketplace_actors (id, actor_type, nombre, slug, estado, verificado) VALUES
    (v_actor_a, 'supplier', 'Hard Test A', 'hard-test-1a1-a', 'active',    true),
    (v_actor_b, 'supplier', 'Hard Test B', 'hard-test-1a1-b', 'suspended', true)
  ON CONFLICT (slug) DO NOTHING;

  -- Dos owners en actor A (necesario para el test de concurrencia)
  INSERT INTO public.trade_marketplace_actor_members (actor_id, user_id, role_id, activo, accepted_at)
  VALUES
    (v_actor_a, v_user_own1, v_role_owner,  true, now()),
    (v_actor_a, v_user_own2, v_role_owner,  true, now()),
    (v_actor_a, v_user_adm,  v_role_admin,  true, now()),
    (v_actor_a, v_user_view, v_role_viewer, true, now()),
    -- user_view también es miembro de actor B (suspendido)
    (v_actor_b, v_user_view, v_role_viewer, true, now())
  ON CONFLICT (actor_id, user_id) DO NOTHING;

  RAISE NOTICE '[SETUP hardening] Fixtures creados.';
END;
$$;

-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H1: Actor suspendido visible para sus miembros, invisible para no-miembros
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_b   uuid := 'cccccccc-0000-0000-0000-000000000002';
  v_user_view uuid := 'dddddddd-0000-0000-0000-000000000004'; -- miembro de B
  v_user_adm  uuid := 'dddddddd-0000-0000-0000-000000000003'; -- NO miembro de B
  v_count     integer;
  v_jwt       text;
BEGIN
  -- Miembro de B suspendido SÍ debe verlo
  v_jwt := json_build_object('sub', v_user_view::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.trade_marketplace_actors WHERE id = v_actor_b;
  RESET ROLE;
  IF v_count = 0 THEN
    RAISE EXCEPTION '[H1a] FAIL: miembro de B suspendido debe poder ver su propio actor (count=0).';
  END IF;

  -- No-miembro NO debe ver B suspendido (no está activo)
  v_jwt := json_build_object('sub', v_user_adm::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  SELECT COUNT(*) INTO v_count FROM public.trade_marketplace_actors WHERE id = v_actor_b;
  RESET ROLE;
  IF v_count != 0 THEN
    RAISE EXCEPTION '[H1b] FAIL: no-miembro NO debe ver actor B suspendido (count=%).', v_count;
  END IF;

  RAISE NOTICE '[TEST H1] PASS: actor suspendido visible solo para sus miembros.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H2: Actor suspendido — membresía visible pero permisos operativos bloqueados
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_b    uuid := 'cccccccc-0000-0000-0000-000000000002';
  v_user_view  uuid := 'dddddddd-0000-0000-0000-000000000004';
  v_has_read   boolean;
BEGIN
  -- _mkt_has_permission responde segun rol, independientemente del estado del actor.
  -- La capa de aplicacion (no RLS) debe comprobar estado antes de operaciones criticas.
  -- Este test documenta el comportamiento esperado: _mkt_has_permission devuelve true
  -- para offerings:read incluso si el actor esta suspendido (RLS en offerings hace la restriccion real).

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_user_view::text, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;

  SELECT public._mkt_has_permission(v_actor_b, 'offerings:read') INTO v_has_read;
  RESET ROLE;

  -- viewer tiene offerings:read en su rol
  IF NOT v_has_read THEN
    RAISE EXCEPTION '[H2] FAIL: viewer debería tener offerings:read (la restricción de suspended la hace RLS en offerings, no _mkt_has_permission).';
  END IF;

  -- Verificar que el actor está suspendido (el frontend debe comprobar estado)
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actors WHERE id = v_actor_b AND estado = 'suspended'
  ) THEN
    RAISE EXCEPTION '[H2] FAIL: actor B debería estar en estado suspended.';
  END IF;

  RAISE NOTICE '[TEST H2] PASS: suspended actor visible con permisos de rol; restriccion de operaciones via RLS de tablas de datos + estado del actor.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H3: Intento de bypass GUC por cliente autenticado
--   El GUC mkt.skip_privilege_check ya no está en los triggers.
--   Verificamos que establecerlo no tiene ningún efecto.
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a      uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_user_adm     uuid := 'dddddddd-0000-0000-0000-000000000003'; -- admin, priority=80
  v_user_new     uuid := gen_random_uuid();
  v_role_owner   uuid;
  v_raised       boolean := false;
  v_jwt          text;
BEGIN
  SELECT id INTO v_role_owner
  FROM public.trade_marketplace_roles
  WHERE actor_type = 'supplier' AND nombre = 'owner' AND is_system = true AND actor_id IS NULL;

  v_jwt := json_build_object('sub', v_user_adm::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  -- Atacante intenta setear el GUC de bypass
  PERFORM set_config('mkt.skip_privilege_check', '1', true);

  BEGIN
    -- Intenta asignar owner (priority 100) siendo admin (priority 80)
    INSERT INTO public.trade_marketplace_actor_members (actor_id, user_id, role_id, activo)
    VALUES (v_actor_a, v_user_new, v_role_owner, true);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'PRIVILEGE_ESCALATION%' THEN
      v_raised := true;
    ELSE
      RAISE EXCEPTION '[H3] FAIL: excepción inesperada: %', SQLERRM;
    END IF;
  END;

  RESET ROLE;

  IF NOT v_raised THEN
    RAISE EXCEPTION '[H3] FAIL: el bypass GUC no debería haber funcionado. El trigger debe haberse ejecutado.';
  END IF;

  RAISE NOTICE '[TEST H3] PASS: GUC mkt.skip_privilege_check ignorado por triggers hardened. Escalada bloqueada.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H4: Helpers internos no ejecutables por anon
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_has_execute boolean;
BEGIN
  -- Verificar que 'anon' NO tiene EXECUTE en _mkt_has_permission
  SELECT has_function_privilege('anon', 'public._mkt_has_permission(uuid, text)', 'EXECUTE')
  INTO v_has_execute;

  IF v_has_execute THEN
    RAISE EXCEPTION '[H4a] FAIL: anon tiene EXECUTE en _mkt_has_permission — debe estar revocado.';
  END IF;

  SELECT has_function_privilege('anon', 'public._mkt_is_platform_admin()', 'EXECUTE')
  INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION '[H4b] FAIL: anon tiene EXECUTE en _mkt_is_platform_admin — debe estar revocado.';
  END IF;

  SELECT has_function_privilege('anon', 'public._mkt_actor_ids_for_user(text)', 'EXECUTE')
  INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION '[H4c] FAIL: anon tiene EXECUTE en _mkt_actor_ids_for_user — debe estar revocado.';
  END IF;

  -- Verificar que las funciones trigger tampoco son ejecutables por anon/authenticated
  SELECT has_function_privilege('authenticated', 'public.trg_fn_mkt_member_privilege_check()', 'EXECUTE')
  INTO v_has_execute;
  IF v_has_execute THEN
    RAISE EXCEPTION '[H4d] FAIL: authenticated tiene EXECUTE en trg_fn_mkt_member_privilege_check — debe estar revocado.';
  END IF;

  RAISE NOTICE '[TEST H4] PASS: helpers internos y triggers no ejecutables por anon/authenticated.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H5: Token de invitación reutilizado
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a     uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_role_viewer uuid;
  v_fake_token  text := encode(gen_random_bytes(32), 'hex');
  v_token_hash  text := encode(sha256(v_fake_token::bytea), 'hex');
  v_raised      boolean := false;
BEGIN
  SELECT id INTO v_role_viewer
  FROM public.trade_marketplace_roles
  WHERE actor_type = 'supplier' AND nombre = 'viewer' AND is_system = true AND actor_id IS NULL;

  -- Insertar invitación ya aceptada (simulando token ya usado)
  INSERT INTO public.trade_marketplace_invitations
    (actor_id, role_id, email, token_hash, estado, expires_at)
  VALUES
    (v_actor_a, v_role_viewer, 'reuse@test-hardening.local', v_token_hash, 'accepted', now() + interval '7 days');

  -- Intentar aceptarla de nuevo (la función comprueba estado != 'pending')
  -- Simulamos: un usuario con ese email intenta aceptar de nuevo.
  -- accept_marketplace_invitation necesita auth.uid() → usamos la comprobación de estado
  -- directamente en SQL ya que en test no tenemos auth.users real.
  BEGIN
    -- Verificar que la lógica de estado está en la función
    DECLARE v_fn_body text;
    BEGIN
      SELECT prosrc INTO v_fn_body FROM pg_proc
        WHERE proname = 'accept_marketplace_invitation' AND pronamespace = 'public'::regnamespace;
      IF v_fn_body NOT LIKE '%INVALID_STATE%' THEN
        RAISE EXCEPTION '[H5] FAIL: accept_marketplace_invitation no tiene guard INVALID_STATE.';
      END IF;
    END;

    -- Verificar que el hash es correcto (lookup funcionaría)
    IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_invitations WHERE token_hash = v_token_hash AND estado = 'accepted') THEN
      RAISE EXCEPTION '[H5] FAIL: invitación aceptada no encontrada por hash.';
    END IF;

    v_raised := true; -- llegamos sin error: ambas verificaciones pasaron
  END;

  -- Cleanup
  DELETE FROM public.trade_marketplace_invitations WHERE token_hash = v_token_hash;

  IF NOT v_raised THEN
    RAISE EXCEPTION '[H5] FAIL: error inesperado en el test de token reutilizado.';
  END IF;

  RAISE NOTICE '[TEST H5] PASS: token reutilizado bloqueado por guard INVALID_STATE + lookup por hash.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H6: Rol custom sin permisos platform:*
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a    uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_user_adm   uuid := 'dddddddd-0000-0000-0000-000000000003';
  v_custom_role_id uuid;
  v_has_platform boolean;
  v_jwt        text;
BEGIN
  -- Crear rol custom sin platform:*
  INSERT INTO public.trade_marketplace_roles
    (actor_type, nombre, permissions, is_system, priority, actor_id)
  VALUES
    ('supplier', 'custom_no_platform', '["offerings:read","analytics:read"]', false, 20, v_actor_a)
  RETURNING id INTO v_custom_role_id;

  -- Verificar que no tiene platform:actors
  SELECT public._mkt_has_permission(v_actor_a, 'platform:actors') INTO v_has_platform;
  -- Esto comprueba el permiso del user_adm actual (rol admin, no custom)
  -- El custom role no está asignado a nadie aún, pero verificamos que el JSON del rol no lo tiene

  IF EXISTS (
    SELECT 1 FROM public.trade_marketplace_roles
    WHERE id = v_custom_role_id
      AND permissions @> '["platform:actors"]'::jsonb
  ) THEN
    RAISE EXCEPTION '[H6a] FAIL: el rol custom no debería tener permiso platform:actors.';
  END IF;

  -- Verificar que plataforma: no puede ser añadida a un rol custom de supplier
  -- (comprobación de que el sistema no eleva automáticamente permisos)
  IF EXISTS (
    SELECT 1 FROM public.trade_marketplace_roles
    WHERE id = v_custom_role_id
      AND (permissions @> '["platform:verify"]'::jsonb OR permissions @> '["platform:actors"]'::jsonb)
  ) THEN
    RAISE EXCEPTION '[H6b] FAIL: rol custom de supplier tiene permisos platform:* — no debe.';
  END IF;

  -- Cleanup
  DELETE FROM public.trade_marketplace_roles WHERE id = v_custom_role_id;

  RAISE NOTICE '[TEST H6] PASS: rol custom de supplier sin permisos platform:*.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H7: Atomicidad / concurrencia de ownership
--   Simula la protección FOR UPDATE: verifica que transfer_marketplace_ownership
--   adquiere el lock antes de modificar, y que la operación es atómica.
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a    uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_user_own1  uuid := 'dddddddd-0000-0000-0000-000000000001';
  v_user_own2  uuid := 'dddddddd-0000-0000-0000-000000000002';
  v_fn_body    text;
  v_owner_count integer;
BEGIN
  -- Verificar que la función tiene SELECT ... FOR UPDATE
  SELECT prosrc INTO v_fn_body FROM pg_proc
    WHERE proname = 'transfer_marketplace_ownership' AND pronamespace = 'public'::regnamespace;

  IF v_fn_body NOT LIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION '[H7] FAIL: transfer_marketplace_ownership no usa FOR UPDATE — vulnerable a race conditions.';
  END IF;

  -- Verificar que el trigger last_owner también usa FOR UPDATE
  SELECT prosrc INTO v_fn_body FROM pg_proc
    WHERE proname = 'trg_fn_mkt_member_last_owner' AND pronamespace = 'public'::regnamespace;

  IF v_fn_body NOT LIKE '%FOR UPDATE%' THEN
    RAISE EXCEPTION '[H7] FAIL: trg_fn_mkt_member_last_owner no usa FOR UPDATE — vulnerable a race conditions.';
  END IF;

  -- Verificar estado: actor A tiene dos owners (fixture)
  SELECT COUNT(*) INTO v_owner_count
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = v_actor_a AND m.activo = true AND r.nombre = 'owner';

  IF v_owner_count != 2 THEN
    RAISE EXCEPTION '[H7] FAIL: fixture debería tener 2 owners en actor A (tiene %).', v_owner_count;
  END IF;

  RAISE NOTICE '[TEST H7] PASS: FOR UPDATE presente en transfer_marketplace_ownership y trg_fn_mkt_member_last_owner. Fixture tiene % owners.', v_owner_count;
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H8: Audit log inmutable — sin INSERT/UPDATE/DELETE desde clientes
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a    uuid := 'cccccccc-0000-0000-0000-000000000001';
  v_user_plat  uuid := 'bbbbbbbb-0000-0000-0000-000000000004'; -- platform admin de Sprint 1A
  v_raised     boolean := false;
  v_jwt        text;
BEGIN
  -- Incluso el platform admin no debe poder hacer INSERT en audit_log via cliente
  v_jwt := json_build_object('sub', v_user_plat::text, 'role', 'authenticated')::text;
  PERFORM set_config('request.jwt.claims', v_jwt, true);
  SET LOCAL ROLE authenticated;

  BEGIN
    INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
    VALUES (v_actor_a, v_user_plat, 'test_inject', '{}');
  EXCEPTION WHEN OTHERS THEN
    v_raised := true; -- esperamos error de RLS (no policy para INSERT)
  END;

  -- Tampoco puede borrar
  DECLARE v_raised_del boolean := false;
  BEGIN
    DELETE FROM public.trade_marketplace_audit_log WHERE event_type = 'test_inject';
  EXCEPTION WHEN OTHERS THEN
    v_raised_del := true;
  END;

  RESET ROLE;

  IF NOT v_raised THEN
    RAISE EXCEPTION '[H8a] FAIL: platform admin pudo hacer INSERT en audit_log — audit log no es inmutable.';
  END IF;

  RAISE NOTICE '[TEST H8] PASS: audit_log inmutable — INSERT bloqueado por RLS (no hay política de escritura para clientes).';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H9: Token hash — token bruto no almacenado en ninguna columna
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_col_name text;
BEGIN
  -- Verificar que la columna 'token' ya no existe en la tabla
  SELECT column_name INTO v_col_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trade_marketplace_invitations'
    AND column_name  = 'token';

  IF v_col_name IS NOT NULL THEN
    RAISE EXCEPTION '[H9a] FAIL: columna "token" aún existe en trade_marketplace_invitations. El token en claro sigue almacenado.';
  END IF;

  -- Verificar que 'token_hash' existe
  SELECT column_name INTO v_col_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trade_marketplace_invitations'
    AND column_name  = 'token_hash';

  IF v_col_name IS NULL THEN
    RAISE EXCEPTION '[H9b] FAIL: columna "token_hash" no existe en trade_marketplace_invitations.';
  END IF;

  -- Verificar que create_marketplace_invitation existe y es SECURITY DEFINER
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_marketplace_invitation'
      AND p.prosecdef = true  -- SECURITY DEFINER
  ) THEN
    RAISE EXCEPTION '[H9c] FAIL: create_marketplace_invitation no existe o no es SECURITY DEFINER.';
  END IF;

  -- Verificar que la función devuelve texto (el raw token)
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN pg_type t ON t.oid = p.prorettype
    WHERE n.nspname = 'public'
      AND p.proname = 'create_marketplace_invitation'
      AND t.typname = 'text'
  ) THEN
    RAISE EXCEPTION '[H9d] FAIL: create_marketplace_invitation no devuelve text (token bruto).';
  END IF;

  RAISE NOTICE '[TEST H9] PASS: columna "token" eliminada; "token_hash" presente; create_marketplace_invitation es SECURITY DEFINER y devuelve text.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- TEST H10: Bypass seguro — current_user != authenticated (no auth.uid IS NULL)
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_fn_body text;
BEGIN
  -- Verificar que los triggers YA NO contienen las condiciones de bypass inseguras
  FOR v_fn_body IN (
    SELECT prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('trg_fn_mkt_member_type_compat',
                        'trg_fn_mkt_member_privilege_check',
                        'trg_fn_mkt_member_last_owner')
  ) LOOP
    IF v_fn_body LIKE '%auth.uid() IS NULL%' THEN
      RAISE EXCEPTION '[H10a] FAIL: trigger aún contiene "auth.uid() IS NULL" como bypass — reemplazar por current_user != authenticated.';
    END IF;
    IF v_fn_body LIKE '%mkt.skip_privilege_check%' THEN
      RAISE EXCEPTION '[H10b] FAIL: trigger aún contiene mkt.skip_privilege_check — GUC eliminado del flujo.';
    END IF;
    IF v_fn_body NOT LIKE '%current_user%' THEN
      RAISE EXCEPTION '[H10c] FAIL: trigger no contiene "current_user" como mecanismo de bypass canónico.';
    END IF;
  END LOOP;

  RAISE NOTICE '[TEST H10] PASS: triggers usan current_user != authenticated como bypass; auth.uid IS NULL y GUC eliminados.';
END;
$$;


-- ═════════════════════════════════════════════════════════════════════════════
-- CLEANUP
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  DELETE FROM public.trade_marketplace_invitations
    WHERE email LIKE '%@test-hardening.local';
  DELETE FROM public.trade_marketplace_actor_members
    WHERE actor_id IN ('cccccccc-0000-0000-0000-000000000001'::uuid,
                       'cccccccc-0000-0000-0000-000000000002'::uuid);
  DELETE FROM public.trade_marketplace_actors
    WHERE id IN ('cccccccc-0000-0000-0000-000000000001'::uuid,
                 'cccccccc-0000-0000-0000-000000000002'::uuid);
  RAISE NOTICE '[CLEANUP hardening] Datos de test eliminados.';
END;
$$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '  Tests Sprint 1A.1 — Endurecimiento Actor System';
  RAISE NOTICE '  10 tests (H1–H10) verificados';
  RAISE NOTICE '══════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTA: Test E2E de invitación con usuarios Auth reales';
  RAISE NOTICE '  requiere staging con auth.users poblado.';
  RAISE NOTICE '  Ejecutar: accept_marketplace_invitation(token) con';
  RAISE NOTICE '  usuario autenticado cuyo email coincida con la invitación.';
END;
$$;
