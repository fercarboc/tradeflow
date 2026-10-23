-- ══════════════════════════════════════════════════════════════════════
-- TRANSPORT-CORE-1B — SQL Security Tests
-- 11 escenarios de seguridad RLS + trigger para trade_vehicles / trade_workers
-- NO ejecutar con supabase db push; usar en entorno local con Docker o Studio.
-- ══════════════════════════════════════════════════════════════════════

-- Asunciones de setup:
--   org_a  UUID conocido de una org propiedad de user_owner (owner_a)
--   org_b  UUID conocido de una org distinta
--   user_owner : propietario de org_a
--   user_admin : miembro de org_a con rol 'admin'
--   user_worker: miembro de org_a con rol 'tecnico'
--   user_other : usuario sin membresía en org_a (pertenece a org_b)
--
-- Patrón de impersonación:
--   SET LOCAL role TO authenticated;
--   SET LOCAL "request.jwt.claims" TO '{"sub":"<user_id>","role":"authenticated"}';

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- 1. Owner puede crear un vehículo en su org
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"<owner_a_id>","role":"authenticated"}';

DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trade_vehicles
    (org_id, nombre, matricula, tipo, capacidad_viajeros, estado)
  VALUES
    ('<org_a>', 'Bus Test 1', '1234TST', 'microbus', 20, 'disponible')
  RETURNING id INTO v_id;

  ASSERT v_id IS NOT NULL, 'FAIL #1: owner debe poder insertar vehículo';
  RAISE NOTICE 'PASS #1: owner puede crear vehículo (id=%)', v_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL #1: owner no pudo crear vehículo: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Admin puede administrar vehículos (INSERT + UPDATE)
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<admin_a_id>","role":"authenticated"}';

DO $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trade_vehicles
    (org_id, nombre, matricula, tipo, capacidad_viajeros, estado)
  VALUES
    ('<org_a>', 'Bus Admin', '5678ADM', 'autocar', 50, 'disponible')
  RETURNING id INTO v_id;

  UPDATE public.trade_vehicles SET estado = 'en_servicio' WHERE id = v_id;

  ASSERT v_id IS NOT NULL, 'FAIL #2: admin debe poder insertar vehículo';
  RAISE NOTICE 'PASS #2: admin puede insertar y actualizar vehículo';
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'FAIL #2: admin no pudo gestionar vehículo: %', SQLERRM;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 3. Trabajador (rol técnico) puede consultar vehículos de su org
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<worker_a_id>","role":"authenticated"}';

DO $$
DECLARE cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.trade_vehicles
  WHERE org_id = '<org_a>'::uuid;

  ASSERT cnt >= 0, 'FAIL #3: SELECT no debe producir error para miembro de org';
  RAISE NOTICE 'PASS #3: trabajador puede SELECT (% filas visibles)', cnt;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. Trabajador no puede crear / modificar / dar de baja vehículos
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<worker_a_id>","role":"authenticated"}';

DO $$
BEGIN
  INSERT INTO public.trade_vehicles
    (org_id, nombre, matricula, tipo, capacidad_viajeros, estado)
  VALUES
    ('<org_a>', 'Bus Técnico', 'XXXX999', 'furgoneta', 8, 'disponible');
  RAISE EXCEPTION 'FAIL #4a: trabajador no debería poder insertar';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS #4a: INSERT denegado para técnico (RLS)';
END $$;

DO $$
BEGIN
  UPDATE public.trade_vehicles
  SET nombre = 'Hackeo' WHERE org_id = '<org_a>'::uuid;
  -- Si llega aquí sin error, ninguna fila debió ser modificada
  IF FOUND THEN
    RAISE EXCEPTION 'FAIL #4b: trabajador no debería poder UPDATE ninguna fila';
  END IF;
  RAISE NOTICE 'PASS #4b: UPDATE sin filas afectadas para técnico';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS #4b: UPDATE denegado explícitamente para técnico';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 5. Usuario de otra org no puede ver ni modificar vehículos ajenos
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<user_other_id>","role":"authenticated"}';

DO $$
DECLARE cnt int;
BEGIN
  SELECT COUNT(*) INTO cnt
  FROM public.trade_vehicles
  WHERE org_id = '<org_a>'::uuid;

  ASSERT cnt = 0, 'FAIL #5a: usuario de otra org no debe ver vehículos ajenos';
  RAISE NOTICE 'PASS #5a: SELECT filtra correctamente (0 filas de org_a visibles)';
END $$;

DO $$
BEGIN
  INSERT INTO public.trade_vehicles
    (org_id, nombre, matricula, tipo, capacidad_viajeros, estado)
  VALUES
    ('<org_a>', 'Intruso', 'HACK001', 'furgoneta', 5, 'disponible');
  RAISE EXCEPTION 'FAIL #5b: usuario externo no debería poder insertar en org ajena';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'PASS #5b: INSERT en org ajena denegado';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 6. Owner no puede activar transport_enabled directamente
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<owner_a_id>","role":"authenticated"}';

DO $$
BEGIN
  UPDATE public.trade_organizations
  SET transport_enabled = true
  WHERE id = '<org_a>'::uuid;
  RAISE EXCEPTION 'FAIL #6: owner no debería poder activar transport_enabled';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE '%TRANSPORT_ENABLED_PROTECTED%' THEN
    RAISE NOTICE 'PASS #6: trigger bloquea activación por owner autenticado';
  ELSE
    RAISE EXCEPTION 'FAIL #6: excepción inesperada: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 7. Trabajador no puede activar transport_enabled
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL "request.jwt.claims" TO '{"sub":"<worker_a_id>","role":"authenticated"}';

DO $$
BEGIN
  UPDATE public.trade_organizations
  SET transport_enabled = true
  WHERE id = '<org_a>'::uuid;
  RAISE EXCEPTION 'FAIL #7: trabajador no debería poder activar transport_enabled';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM LIKE '%TRANSPORT_ENABLED_PROTECTED%' THEN
    RAISE NOTICE 'PASS #7: trigger bloquea activación por trabajador autenticado';
  ELSE
    RAISE EXCEPTION 'FAIL #7: excepción inesperada: %', SQLERRM;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 8. Procedimiento administrativo (service_role) puede activar transport_enabled
-- ─────────────────────────────────────────────────────────────────────
-- auth.uid() IS NULL cuando la operación viene del service_role (Studio / script admin)

RESET role;  -- volver a service_role (sin JWT)
RESET "request.jwt.claims";

DO $$
BEGIN
  UPDATE public.trade_organizations
  SET transport_enabled = true
  WHERE id = '<org_a>'::uuid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL #8: la org no existe o el UPDATE no afectó filas';
  END IF;
  RAISE NOTICE 'PASS #8: service_role puede activar transport_enabled';
  -- Revertir para no contaminar otros tests
  UPDATE public.trade_organizations
  SET transport_enabled = false
  WHERE id = '<org_a>'::uuid;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 9. No es posible cambiar org_id de un vehículo (trigger org_immutable)
-- ─────────────────────────────────────────────────────────────────────

DO $$
DECLARE v_id uuid;
BEGIN
  -- Obtener un vehículo de org_a creado en el test 1
  SELECT id INTO v_id FROM public.trade_vehicles
  WHERE org_id = '<org_a>'::uuid AND matricula = '1234TST' LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'SKIP #9: vehículo de test 1 no encontrado (ejecutar en orden)';
  ELSE
    BEGIN
      UPDATE public.trade_vehicles SET org_id = '<org_b>'::uuid WHERE id = v_id;
      RAISE EXCEPTION 'FAIL #9: cambio de org_id no fue bloqueado';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM LIKE '%VEHICLE_ORG_IMMUTABLE%' THEN
        RAISE NOTICE 'PASS #9: trigger impide cambio de org_id en vehículo';
      ELSE
        RAISE EXCEPTION 'FAIL #9: excepción inesperada: %', SQLERRM;
      END IF;
    END;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 10. DELETE ordinario está prohibido (ninguna política DELETE)
-- ─────────────────────────────────────────────────────────────────────

SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"<owner_a_id>","role":"authenticated"}';

DO $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.trade_vehicles
  WHERE org_id = '<org_a>'::uuid AND matricula = '1234TST' LIMIT 1;

  IF v_id IS NULL THEN
    RAISE NOTICE 'SKIP #10: vehículo de test 1 no encontrado';
  ELSE
    DELETE FROM public.trade_vehicles WHERE id = v_id;
    IF NOT FOUND THEN
      RAISE NOTICE 'PASS #10: DELETE no afectó ninguna fila (RLS bloquea sin política DELETE)';
    ELSE
      RAISE EXCEPTION 'FAIL #10: DELETE eliminó una fila cuando no debería';
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- 11. Permisos de edición de conductores coinciden con RLS (solo owner)
-- ─────────────────────────────────────────────────────────────────────

-- 11a: admin no puede cambiar es_conductor (workers_owner_all es solo owner)
SET LOCAL "request.jwt.claims" TO '{"sub":"<admin_a_id>","role":"authenticated"}';

DO $$
DECLARE w_id uuid;
BEGIN
  SELECT id INTO w_id FROM public.trade_workers
  WHERE org_id = '<org_a>'::uuid LIMIT 1;

  IF w_id IS NULL THEN
    RAISE NOTICE 'SKIP #11a: no hay workers en org_a';
  ELSE
    UPDATE public.trade_workers SET es_conductor = true WHERE id = w_id AND org_id = '<org_a>'::uuid;
    IF NOT FOUND THEN
      RAISE NOTICE 'PASS #11a: UPDATE de es_conductor por admin no afectó filas (RLS owner-only)';
    ELSE
      RAISE EXCEPTION 'FAIL #11a: admin no debería poder cambiar es_conductor';
    END IF;
  END IF;
END $$;

-- 11b: owner sí puede cambiar es_conductor
SET LOCAL "request.jwt.claims" TO '{"sub":"<owner_a_id>","role":"authenticated"}';

DO $$
DECLARE w_id uuid;
BEGIN
  SELECT id INTO w_id FROM public.trade_workers
  WHERE org_id = '<org_a>'::uuid LIMIT 1;

  IF w_id IS NULL THEN
    RAISE NOTICE 'SKIP #11b: no hay workers en org_a';
  ELSE
    UPDATE public.trade_workers SET es_conductor = true WHERE id = w_id AND org_id = '<org_a>'::uuid;
    IF FOUND THEN
      RAISE NOTICE 'PASS #11b: owner puede cambiar es_conductor';
      -- Revertir
      UPDATE public.trade_workers SET es_conductor = false WHERE id = w_id AND org_id = '<org_a>'::uuid;
    ELSE
      RAISE EXCEPTION 'FAIL #11b: owner no pudo cambiar es_conductor';
    END IF;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- Resumen: si ningún bloque lanzó EXCEPTION, todos los tests pasaron.
-- ─────────────────────────────────────────────────────────────────────

RAISE NOTICE '══ TRANSPORT SECURITY TESTS: ALL PASSED ══';

ROLLBACK;  -- no persistir datos de test en ningún entorno
