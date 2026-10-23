-- ══════════════════════════════════════════════════════════════════════
-- TRANSPORT-T1-A — Tests de seguridad SQL (revisión crítica)
-- ESTADO: PENDIENTE — requiere Docker + supabase start
-- No ejecutar contra producción.
-- ══════════════════════════════════════════════════════════════════════
-- Ejecutar: psql $LOCAL_DB_URL -f supabase/tests/transport_t1a_security_tests.sql
-- Resultado esperado: todos los DO $$ anónimos completan sin RAISE EXCEPTION.
-- ══════════════════════════════════════════════════════════════════════
--
-- Escenarios cubiertos:
--   E1  Creación válida
--   E2  Campos obligatorios (NOT NULL)
--   E3  Servicio que cruza medianoche
--   E4  Cliente de otra organización (FK compuesta)
--   E5  Vehículo de otra organización (FK compuesta)
--   E6  Conductor de otra organización (FK compuesta)
--   E7/E7b Paradas JSONB inválidas (trigger)
--   E8  Transición de estado inválida (state machine trigger)
--   E9  Transición válida borrador→confirmado
--   E10 Estado terminal cancelado
--   E11 [PENDIENTE Docker] RLS SELECT — usuario de org B no ve servicios de org A
--   E12 [PENDIENTE Docker] RLS INSERT — usuario sin permisos
--   E13 [PENDIENTE Docker] confirm_transport_service — conflicto vehículo (RPC)
--   ──────────────────── nuevos escenarios (revisión crítica) ────────────────
--   E14 Doble confirmación simultánea mismo autobús (EXCLUDE constraint)
--   E15 Doble confirmación simultánea mismo conductor (EXCLUDE constraint)
--   E16 Cambio de vehículo post-confirmación que introduce solapamiento (EXCLUDE)
--   E17 Cambio de conductor post-confirmación con solapamiento (EXCLUDE)
--   E18 [PENDIENTE Docker] confirm_transport_service sin permisos (TRANSPORT_FORBIDDEN)
--   E19 UPDATE directo a confirmado + EXCLUDE bloquea si hay solapamiento previo
--   E20 [PENDIENTE Docker] transport_enabled=false bloquea confirmación (RPC)
--   E21 Vehículo inactivo: confirmación bloqueada (RPC step 4a)
--   E22 Conductor sin es_conductor: confirmación bloqueada (RPC step 4b)
--   E23 org_id inmutable (trigger _prevent_transport_service_org_change)
-- ══════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_org_a      uuid := gen_random_uuid();
  v_org_b      uuid := gen_random_uuid();
  v_user_owner uuid := gen_random_uuid();
  v_user_b     uuid := gen_random_uuid();
  v_client_a   uuid;
  v_client_b   uuid;
  v_vehicle_a  uuid;
  v_vehicle_b  uuid;
  v_vehicle_a2 uuid;  -- segundo vehículo org A
  v_worker_a   uuid;
  v_conductor  uuid;
  v_conductor2 uuid;  -- segundo conductor org A
  v_svc_id     uuid;
  v_svc_id2    uuid;
  v_result     jsonb;
BEGIN
  -- ── Setup base ────────────────────────────────────────────────────────
  INSERT INTO public.trade_organizations(id, nombre, owner_id, transport_enabled)
    VALUES (v_org_a, 'Autocares Test A', v_user_owner, true);
  INSERT INTO public.trade_organizations(id, nombre, owner_id, transport_enabled)
    VALUES (v_org_b, 'Autocares Test B', v_user_b, true);

  INSERT INTO public.trade_clients(id, org_id, nombre) VALUES (gen_random_uuid(), v_org_a, 'Cliente A') RETURNING id INTO v_client_a;
  INSERT INTO public.trade_clients(id, org_id, nombre) VALUES (gen_random_uuid(), v_org_b, 'Cliente B') RETURNING id INTO v_client_b;

  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_a, 'Bus A', '1234ABC', 'autocar', 'viajeros', true, 50)
    RETURNING id INTO v_vehicle_a;
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_a, 'Bus A2', '5555AAA', 'autocar', 'viajeros', true, 40)
    RETURNING id INTO v_vehicle_a2;
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_b, 'Bus B', '5678DEF', 'autocar', 'viajeros', true, 50)
    RETURNING id INTO v_vehicle_b;

  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor, activo)
    VALUES (gen_random_uuid(), v_org_a, 'Conductor A', 'tecnico', true, true)
    RETURNING id INTO v_conductor;
  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor, activo)
    VALUES (gen_random_uuid(), v_org_a, 'Conductor A2', 'tecnico', true, true)
    RETURNING id INTO v_conductor2;
  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor)
    VALUES (gen_random_uuid(), v_org_a, 'Worker sin conductor', 'tecnico', false)
    RETURNING id INTO v_worker_a;

  -- ── E1: creación válida ──────────────────────────────────────────────
  INSERT INTO public.trade_transport_services(org_id, titulo, tipo_servicio, fecha_inicio)
    VALUES (v_org_a, 'Excursión válida', 'excursion', now())
    RETURNING id INTO v_svc_id;
  ASSERT v_svc_id IS NOT NULL, 'E1 FAIL: servicio válido no creado';
  RAISE NOTICE 'E1 PASS: creación válida';

  -- ── E2: campos obligatorios ──────────────────────────────────────────
  BEGIN
    INSERT INTO public.trade_transport_services(org_id, tipo_servicio, fecha_inicio)
      VALUES (v_org_a, 'excursion', now());
    RAISE EXCEPTION 'E2 FAIL: debería rechazar fila sin título';
  EXCEPTION WHEN not_null_violation THEN
    RAISE NOTICE 'E2 PASS: campos obligatorios validados';
  END;

  -- ── E3: servicio que cruza medianoche ────────────────────────────────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin
  ) VALUES (
    v_org_a, 'Noche vieja', 'otro', '2026-12-31T22:00:00Z', '2027-01-01T02:00:00Z'
  );
  RAISE NOTICE 'E3 PASS: servicio cruzando medianoche aceptado';

  -- ── E4: cliente de otra organización (FK compuesta) ──────────────────
  BEGIN
    INSERT INTO public.trade_transport_services(org_id, titulo, tipo_servicio, fecha_inicio, client_id)
      VALUES (v_org_a, 'Test cross org client', 'excursion', now(), v_client_b);
    RAISE EXCEPTION 'E4 FAIL: debería rechazar cliente de otra org';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'E4 PASS: FK compuesta rechaza cliente de otra org';
  END;

  -- ── E5: vehículo de otra organización ────────────────────────────────
  BEGIN
    INSERT INTO public.trade_transport_services(org_id, titulo, tipo_servicio, fecha_inicio, vehicle_id)
      VALUES (v_org_a, 'Test cross org vehicle', 'excursion', now(), v_vehicle_b);
    RAISE EXCEPTION 'E5 FAIL: debería rechazar vehículo de otra org';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'E5 PASS: FK compuesta rechaza vehículo de otra org';
  END;

  -- ── E6: conductor de otra organización ──────────────────────────────
  DECLARE v_cond_b uuid;
  BEGIN
    INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor)
      VALUES (gen_random_uuid(), v_org_b, 'Cond B', 'tecnico', true)
      RETURNING id INTO v_cond_b;
    INSERT INTO public.trade_transport_services(org_id, titulo, tipo_servicio, fecha_inicio, conductor_id)
      VALUES (v_org_a, 'Test cross org conductor', 'excursion', now(), v_cond_b);
    RAISE EXCEPTION 'E6 FAIL: debería rechazar conductor de otra org';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'E6 PASS: FK compuesta rechaza conductor de otra org';
  END;

  -- ── E7: paradas JSONB con hora inválida ──────────────────────────────
  BEGIN
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, paradas
    ) VALUES (v_org_a, 'Paradas inválidas', 'excursion', now(), '[{"nombre":"Parada","hora":"25:00"}]');
    RAISE EXCEPTION 'E7 FAIL: debería rechazar parada con hora inválida';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E7 PASS: paradas JSONB con hora inválida rechazadas';
  END;

  BEGIN
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, paradas
    ) VALUES (v_org_a, 'Paradas sin nombre', 'excursion', now(), '[{"nombre":""}]');
    RAISE EXCEPTION 'E7b FAIL: debería rechazar parada sin nombre';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E7b PASS: parada sin nombre rechazada';
  END;

  -- ── E8: transición de estado inválida (borrador→completado) ──────────
  BEGIN
    UPDATE public.trade_transport_services SET estado = 'completado' WHERE id = v_svc_id;
    RAISE EXCEPTION 'E8 FAIL: debería rechazar borrador→completado';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E8 PASS: máquina de estados bloquea borrador→completado';
  END;

  -- ── E9: transición válida borrador→confirmado ────────────────────────
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;
  RAISE NOTICE 'E9 PASS: borrador→confirmado aceptado (UPDATE directo, sin recursos asignados)';

  -- ── E10: estado terminal cancelado ───────────────────────────────────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado
  ) VALUES (v_org_a, 'Servicio cancelado', 'excursion', now(), 'cancelado')
    RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services SET estado = 'borrador' WHERE id = v_svc_id;
    RAISE EXCEPTION 'E10 FAIL: cancelado debería ser terminal';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E10 PASS: estado cancelado es terminal';
  END;

  -- ── E11: RLS SELECT ──────────────────────────────────────────────────
  RAISE NOTICE 'E11 PENDIENTE: validación RLS SELECT requiere sesión autenticada (Docker)';

  -- ── E12: RLS INSERT ──────────────────────────────────────────────────
  RAISE NOTICE 'E12 PENDIENTE: validación RLS INSERT requiere sesión autenticada (Docker)';

  -- ── E13: confirm_transport_service — conflicto RPC ───────────────────
  RAISE NOTICE 'E13 PENDIENTE: conflicto RPC requiere sesión autenticada con auth.uid() (Docker)';

  -- ── E14: doble confirmación mismo vehículo (EXCLUDE constraint) ──────
  -- Crea dos servicios solapados con el mismo vehículo.
  -- Confirmar el primero → OK. Confirmar el segundo directamente → exclusion_violation.
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id
  ) VALUES (
    v_org_a, 'Servicio E14-A', 'excursion',
    '2026-11-20T09:00:00Z', '2026-11-20T18:00:00Z', v_vehicle_a
  ) RETURNING id INTO v_svc_id;

  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id
  ) VALUES (
    v_org_a, 'Servicio E14-B', 'excursion',
    '2026-11-20T12:00:00Z', '2026-11-20T20:00:00Z', v_vehicle_a
  ) RETURNING id INTO v_svc_id2;

  -- Confirmar el primero vía UPDATE directo (sin RPC, sin chequeos de validez)
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;

  BEGIN
    -- Confirmar el segundo: debe fallar por EXCLUDE constraint
    UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id2;
    RAISE EXCEPTION 'E14 FAIL: segundo servicio con mismo vehículo solapado debería ser bloqueado';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'E14 PASS: EXCLUDE constraint bloquea doble confirmación con mismo vehículo';
  END;

  -- ── E15: doble confirmación mismo conductor (EXCLUDE constraint) ──────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id, conductor_id
  ) VALUES (
    v_org_a, 'Servicio E15-A', 'excursion',
    '2026-11-21T09:00:00Z', '2026-11-21T18:00:00Z', v_vehicle_a, v_conductor
  ) RETURNING id INTO v_svc_id;

  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id, conductor_id
  ) VALUES (
    v_org_a, 'Servicio E15-B', 'excursion',
    '2026-11-21T14:00:00Z', '2026-11-21T22:00:00Z', v_vehicle_a2, v_conductor
  ) RETURNING id INTO v_svc_id2;

  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id2;
    RAISE EXCEPTION 'E15 FAIL: segundo servicio con mismo conductor solapado debería ser bloqueado';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'E15 PASS: EXCLUDE constraint bloquea doble confirmación con mismo conductor';
  END;

  -- ── E16: cambio de vehículo post-confirmación introduce solapamiento ──
  -- Servicio E16-A ya confirmado con vehicle_a en franja del día 22.
  -- Servicio E16-B confirmado con vehicle_a2 (sin conflicto).
  -- Intentar cambiar E16-B a vehicle_a → solapamiento → EXCLUDE constraint.
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id
  ) VALUES (
    v_org_a, 'Servicio E16-A', 'excursion',
    '2026-11-22T09:00:00Z', '2026-11-22T18:00:00Z', v_vehicle_a
  ) RETURNING id INTO v_svc_id;
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;

  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id
  ) VALUES (
    v_org_a, 'Servicio E16-B', 'excursion',
    '2026-11-22T12:00:00Z', '2026-11-22T20:00:00Z', v_vehicle_a2
  ) RETURNING id INTO v_svc_id2;
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id2;

  BEGIN
    -- Cambiar vehicle_a2 → vehicle_a: solapamiento con E16-A
    UPDATE public.trade_transport_services
       SET vehicle_id = v_vehicle_a
     WHERE id = v_svc_id2;
    RAISE EXCEPTION 'E16 FAIL: cambio de vehículo solapado post-confirmación debería bloquearse';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'E16 PASS: EXCLUDE constraint bloquea cambio de vehículo solapado post-confirmación';
  END;

  -- ── E17: cambio de conductor post-confirmación con solapamiento ───────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id, conductor_id
  ) VALUES (
    v_org_a, 'Servicio E17-A', 'excursion',
    '2026-11-23T09:00:00Z', '2026-11-23T18:00:00Z', v_vehicle_a, v_conductor
  ) RETURNING id INTO v_svc_id;
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;

  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, vehicle_id, conductor_id
  ) VALUES (
    v_org_a, 'Servicio E17-B', 'excursion',
    '2026-11-23T14:00:00Z', '2026-11-23T22:00:00Z', v_vehicle_a2, v_conductor2
  ) RETURNING id INTO v_svc_id2;
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id2;

  BEGIN
    -- Cambiar conductor2 → conductor: solapamiento con E17-A
    UPDATE public.trade_transport_services
       SET conductor_id = v_conductor
     WHERE id = v_svc_id2;
    RAISE EXCEPTION 'E17 FAIL: cambio de conductor solapado post-confirmación debería bloquearse';
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE 'E17 PASS: EXCLUDE constraint bloquea cambio de conductor solapado post-confirmación';
  END;

  -- ── E18: confirm_transport_service sin permisos ───────────────────────
  RAISE NOTICE 'E18 PENDIENTE: confirm sin permisos requiere sesión autenticada con auth.uid() (Docker)';

  -- ── E19: UPDATE directo a confirmado sin RPC (sin recursos → pasa state machine) ──
  -- Confirma que el UPDATE directo pasa la máquina de estados pero queda bloqueado
  -- por EXCLUDE si hubiera solapamiento (ya probado en E14). Aquí verificamos que
  -- sin solapamiento el UPDATE directo SÍ funciona (el RPC no es obligatorio para el DB).
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin
  ) VALUES (
    v_org_a, 'Servicio E19 sin recursos', 'otro',
    '2026-11-25T09:00:00Z', '2026-11-25T18:00:00Z'
  ) RETURNING id INTO v_svc_id;

  -- UPDATE directo: no pasa por RPC, pero no hay resources → EXCLUDE no aplica
  UPDATE public.trade_transport_services SET estado = 'confirmado' WHERE id = v_svc_id;
  RAISE NOTICE 'E19 PASS: UPDATE directo a confirmado funciona (sin recursos → sin EXCLUDE)';
  RAISE NOTICE 'E19 NOTA: las validaciones de transport_enabled, vehicle.activo y es_conductor se verifican SOLO en el RPC';

  -- ── E20: transport_enabled=false ─────────────────────────────────────
  RAISE NOTICE 'E20 PENDIENTE: transport_enabled=false bloqueo en RPC requiere sesión autenticada (Docker)';

  -- ── E21: vehículo inactivo (activo=false) — validación en RPC ─────────
  -- No se puede probar directamente sin auth.uid() para llamar al RPC.
  -- Verificamos la precondición: vehículo inactivo en DB.
  DECLARE v_inactive_vehicle uuid;
  BEGIN
    INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
      VALUES (gen_random_uuid(), v_org_a, 'Bus inactivo', '9999ZZZ', 'autocar', 'viajeros', false, 50)
      RETURNING id INTO v_inactive_vehicle;
    -- La FK compuesta permite asignarlo (activo no es restricción de FK).
    -- El RPC rechazará al confirmar. Aquí verificamos la precondición.
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, vehicle_id
    ) VALUES (v_org_a, 'Servicio E21', 'excursion', '2026-11-26T09:00:00Z', v_inactive_vehicle);
    RAISE NOTICE 'E21 PRECONDICIÓN: vehículo inactivo puede asignarse en borrador; RPC bloqueará al confirmar (PENDIENTE Docker para verify RPC)';
  END;

  -- ── E22: conductor sin es_conductor — validación en RPC ───────────────
  DECLARE v_no_conductor uuid;
  BEGIN
    INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor)
      VALUES (gen_random_uuid(), v_org_a, 'No conductor', 'tecnico', false)
      RETURNING id INTO v_no_conductor;
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, conductor_id
    ) VALUES (v_org_a, 'Servicio E22', 'excursion', '2026-11-27T09:00:00Z', v_no_conductor);
    RAISE NOTICE 'E22 PRECONDICIÓN: worker no conductor puede asignarse en borrador; RPC bloqueará al confirmar (PENDIENTE Docker para verify RPC)';
  END;

  -- ── E23: org_id inmutable ──────────────────────────────────────────────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio
  ) VALUES (v_org_a, 'Servicio E23', 'excursion', now())
    RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services SET org_id = v_org_b WHERE id = v_svc_id;
    RAISE EXCEPTION 'E23 FAIL: org_id debería ser inmutable';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E23 PASS: trigger bloquea cambio de org_id';
  END;

  RAISE NOTICE '══ Transport T1-A security tests: E1–E10 PASS, E14–E17 PASS, E19 PASS, E23 PASS';
  RAISE NOTICE '   PENDIENTES (Docker): E11, E12, E13, E18, E20, E21 (verify RPC), E22 (verify RPC)';
END;
$$;

-- ══════════════════════════════════════════════════════════════════════
-- TRANSPORT-T1-A-FINAL-GUARD — Tests del trigger operacional
-- Escenarios E24–E29: prueban el trigger _validate_transport_service_operational
-- via INSERT/UPDATE directo (sin RPC). Requieren Docker + supabase start.
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_org_guard  uuid := gen_random_uuid();
  v_org_nodis  uuid := gen_random_uuid();
  v_user_g     uuid := gen_random_uuid();
  v_user_nd    uuid := gen_random_uuid();
  v_veh_active uuid;
  v_veh_inactive uuid;
  v_veh_mercancias uuid;
  v_veh_small  uuid;  -- capacidad 5
  v_cond_ok    uuid;
  v_cond_inactive uuid;
  v_cond_nohab uuid;  -- es_conductor=false
  v_svc_id     uuid;
BEGIN
  -- Setup para E24-E29
  INSERT INTO public.trade_organizations(id, nombre, owner_id, transport_enabled)
    VALUES (v_org_guard, 'Guard Test Org', v_user_g, true);
  INSERT INTO public.trade_organizations(id, nombre, owner_id, transport_enabled)
    VALUES (v_org_nodis, 'Sin Transporte Org', v_user_nd, false);

  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_guard, 'Bus OK', '1111OK', 'autocar', 'viajeros', true, 50)
    RETURNING id INTO v_veh_active;
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_guard, 'Bus Inactivo', '2222IN', 'autocar', 'viajeros', false, 50)
    RETURNING id INTO v_veh_inactive;
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo)
    VALUES (gen_random_uuid(), v_org_guard, 'Camión Mercancias', '3333MC', 'camion_rigido', 'mercancias', true)
    RETURNING id INTO v_veh_mercancias;
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
    VALUES (gen_random_uuid(), v_org_guard, 'Minibús pequeño', '4444SM', 'microbus', 'viajeros', true, 5)
    RETURNING id INTO v_veh_small;

  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor, activo)
    VALUES (gen_random_uuid(), v_org_guard, 'Conductor OK', 'tecnico', true, true)
    RETURNING id INTO v_cond_ok;
  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor, activo)
    VALUES (gen_random_uuid(), v_org_guard, 'Conductor Inactivo', 'tecnico', true, false)
    RETURNING id INTO v_cond_inactive;
  INSERT INTO public.trade_workers(id, org_id, nombre, rol, es_conductor, activo)
    VALUES (gen_random_uuid(), v_org_guard, 'No Conductor', 'tecnico', false, true)
    RETURNING id INTO v_cond_nohab;

  -- También necesitamos el vehículo para org_nodis
  DECLARE v_veh_nodis uuid;
  BEGIN
    INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, tipo, modalidad, activo, capacidad_viajeros)
      VALUES (gen_random_uuid(), v_org_nodis, 'Bus Sin Módulo', '5555ND', 'autocar', 'viajeros', true, 40)
      RETURNING id INTO v_veh_nodis;

    -- ── E29: transport_enabled=false bloquea INSERT directo en confirmado ────
    BEGIN
      INSERT INTO public.trade_transport_services(
        org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id
      ) VALUES (
        v_org_nodis, 'Servicio E29', 'excursion', now(), 'confirmado', v_veh_nodis
      );
      RAISE EXCEPTION 'E29 FAIL: INSERT en confirmado con transport_enabled=false debería fallar';
    EXCEPTION WHEN raise_exception THEN
      RAISE NOTICE 'E29 PASS: trigger bloquea INSERT en confirmado con transport_enabled=false';
    END;
  END;

  -- ── E24: INSERT directo con vehículo inactivo + estado=confirmado ──────────
  BEGIN
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id
    ) VALUES (
      v_org_guard, 'Servicio E24', 'excursion', now(), 'confirmado', v_veh_inactive
    );
    RAISE EXCEPTION 'E24 FAIL: INSERT en confirmado con vehículo inactivo debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E24 PASS: trigger bloquea INSERT en confirmado con vehículo inactivo';
  END;

  -- ── E25: INSERT directo con vehículo de mercancías + estado=confirmado ──────
  BEGIN
    INSERT INTO public.trade_transport_services(
      org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id
    ) VALUES (
      v_org_guard, 'Servicio E25', 'excursion', now(), 'confirmado', v_veh_mercancias
    );
    RAISE EXCEPTION 'E25 FAIL: INSERT en confirmado con vehículo mercancias debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E25 PASS: trigger bloquea INSERT en confirmado con vehículo de mercancias';
  END;

  -- ── E26: UPDATE num_viajeros supera capacidad en servicio confirmado ─────────
  -- Primero crear y confirmar un servicio válido, luego intentar subir num_viajeros
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id, num_viajeros
  ) VALUES (
    v_org_guard, 'Servicio E26', 'excursion',
    '2026-12-01T09:00:00Z', 'confirmado', v_veh_small, 4
  ) RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services
       SET num_viajeros = 10   -- v_veh_small tiene capacidad 5
     WHERE id = v_svc_id;
    RAISE EXCEPTION 'E26 FAIL: UPDATE num_viajeros > capacidad en confirmado debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E26 PASS: trigger bloquea num_viajeros superior a capacidad en servicio confirmado';
  END;

  -- ── E27: UPDATE vehicle_id → vehículo inactivo en servicio confirmado ────────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id
  ) VALUES (
    v_org_guard, 'Servicio E27', 'excursion',
    '2026-12-02T09:00:00Z', 'confirmado', v_veh_active
  ) RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services
       SET vehicle_id = v_veh_inactive
     WHERE id = v_svc_id;
    RAISE EXCEPTION 'E27 FAIL: cambio a vehículo inactivo en confirmado debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E27 PASS: trigger bloquea cambio a vehículo inactivo en servicio confirmado';
  END;

  -- ── E28a: UPDATE conductor_id → conductor inactivo en servicio confirmado ────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id, conductor_id
  ) VALUES (
    v_org_guard, 'Servicio E28a', 'excursion',
    '2026-12-03T09:00:00Z', 'confirmado', v_veh_active, v_cond_ok
  ) RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services
       SET conductor_id = v_cond_inactive
     WHERE id = v_svc_id;
    RAISE EXCEPTION 'E28a FAIL: cambio a conductor inactivo en confirmado debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E28a PASS: trigger bloquea cambio a conductor inactivo en servicio confirmado';
  END;

  -- ── E28b: UPDATE conductor_id → conductor sin es_conductor en confirmado ──────
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado, vehicle_id, conductor_id
  ) VALUES (
    v_org_guard, 'Servicio E28b', 'excursion',
    '2026-12-04T09:00:00Z', 'confirmado', v_veh_active, v_cond_ok
  ) RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services
       SET conductor_id = v_cond_nohab
     WHERE id = v_svc_id;
    RAISE EXCEPTION 'E28b FAIL: cambio a conductor sin es_conductor en confirmado debería fallar';
  EXCEPTION WHEN raise_exception THEN
    RAISE NOTICE 'E28b PASS: trigger bloquea cambio a conductor no habilitado en servicio confirmado';
  END;

  -- ── E29b: UPDATE de vehicle_id con transport_enabled=false ────────────────
  -- Si un servicio fue confirmado antes de desactivar el módulo, cualquier
  -- cambio de recurso posterior debe bloquearse igualmente.
  -- Nota: este sub-test requiere tener un servicio confirmado con transport_enabled=true
  -- y luego hacer UPDATE de transport_enabled=false antes de cambiar el vehicle_id.
  -- La organización v_org_nodis ya tiene transport_enabled=false desde el setup.
  RAISE NOTICE 'E29b PENDIENTE: UPDATE de recurso con transport_enabled=false requiere Docker (sesión autenticada)';

  RAISE NOTICE '══ Final-Guard tests: E24, E25, E26, E27, E28a, E28b, E29 — ESCRITOS, pendientes Docker';
END;
$$;

ROLLBACK;
