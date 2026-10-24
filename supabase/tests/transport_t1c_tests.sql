-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSPORT-T1-C: Tests SQL — parte de servicio y cierre transaccional
-- ══════════════════════════════════════════════════════════════════════════════
-- Ejecutar con: psql -f supabase/tests/transport_t1c_tests.sql
-- Requiere: migrations T1-A + T1-C aplicadas, datos de prueba básicos.
-- ══════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

BEGIN;

-- ── Fixtures ──────────────────────────────────────────────────────────────────

CREATE TEMP TABLE _t1c_results (id int, label text, pass bool, detail text);

DO $$
DECLARE
  v_org_id       uuid := gen_random_uuid();
  v_owner_id     uuid := gen_random_uuid();
  v_member_id    uuid := gen_random_uuid();
  v_vehicle_id   uuid := gen_random_uuid();
  v_conductor_id uuid := gen_random_uuid();
  v_svc_id       uuid;
  v_svc_borrador uuid;
  v_svc_completado uuid;
  v_result       jsonb;
  v_count        int;
  v_km           numeric;
  v_estado       text;
  v_cerrado_at   text;
BEGIN

  -- Org con transport_enabled
  INSERT INTO public.trade_organizations(id, nombre, owner_id, transport_enabled)
  VALUES (v_org_id, 'Empresa Test T1C', v_owner_id, true);

  -- Vehículo
  INSERT INTO public.trade_vehicles(id, org_id, nombre, matricula, modalidad, tipo, activo, estado)
  VALUES (v_vehicle_id, v_org_id, 'Bus Test', 'TEST-001', 'viajeros', 'autocar', true, 'disponible');

  -- Trabajador conductor
  INSERT INTO public.trade_workers(id, org_id, nombre, es_conductor, activo)
  VALUES (v_conductor_id, v_org_id, 'Conductor Test', true, true);

  -- Servicio en_curso para pruebas de cierre
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin,
    vehicle_id, conductor_id, num_viajeros, estado
  ) VALUES (
    v_org_id, 'Servicio T1C Test', 'traslado_privado',
    now() - interval '2h', now() + interval '1h',
    v_vehicle_id, v_conductor_id, 30, 'en_curso'
  ) RETURNING id INTO v_svc_id;

  -- Servicio completado para prueba de inmutabilidad
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin,
    vehicle_id, conductor_id, num_viajeros, estado,
    hora_real_salida, hora_real_llegada, km_reales, cerrado_at, cerrado_por
  ) VALUES (
    v_org_id, 'Servicio Completado T1C', 'traslado_privado',
    now() - interval '5h', now() - interval '3h',
    v_vehicle_id, v_conductor_id, 25, 'completado',
    now() - interval '4h45m', now() - interval '3h15m', 45.5, now(), v_owner_id
  ) RETURNING id INTO v_svc_completado;

  -- Servicio borrador para prueba estado inválido
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, fecha_fin, estado
  ) VALUES (
    v_org_id, 'Servicio Borrador T1C', 'traslado_privado',
    now() + interval '1d', now() + interval '1d' + interval '3h', 'borrador'
  ) RETURNING id INTO v_svc_borrador;

  -- ── Test T1C-01: complete_transport_service con owner ─────────────────────

  BEGIN
    SELECT auth.uid() INTO STRICT v_result;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Simulamos owner ejecutando la RPC mediante set_claim (en entorno real usaríamos supabase.rpc)
  -- Aquí verificamos directamente los constraints y trigger

  -- ── T1C-01: Constraint km_reales no negativo ──────────────────────────────
  BEGIN
    UPDATE public.trade_transport_services
    SET km_reales = -1, estado = 'completado'
    WHERE id = v_svc_id;
    INSERT INTO _t1c_results VALUES(1, 'T1C-01 km negativo rechazado', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(1, 'T1C-01 km negativo rechazado', true, SQLERRM);
  END;

  -- ── T1C-02: Constraint horas incoherentes ─────────────────────────────────
  BEGIN
    UPDATE public.trade_transport_services
    SET hora_real_salida  = now(),
        hora_real_llegada = now() - interval '1h',
        estado = 'completado'
    WHERE id = v_svc_id;
    INSERT INTO _t1c_results VALUES(2, 'T1C-02 llegada < salida rechazada', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(2, 'T1C-02 llegada < salida rechazada', true, SQLERRM);
  END;

  -- ── T1C-03: Trigger protege servicio completado (UPDATE directo) ──────────
  BEGIN
    UPDATE public.trade_transport_services
    SET titulo = 'Modificado ilegalmente'
    WHERE id = v_svc_completado;
    INSERT INTO _t1c_results VALUES(3, 'T1C-03 UPDATE directo en completado rechazado', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(3, 'T1C-03 UPDATE directo en completado rechazado', SQLERRM LIKE '%TRANSPORT_IMMUTABLE%', SQLERRM);
  END;

  -- ── T1C-04: Trigger protege completado ante cambio de km ──────────────────
  BEGIN
    UPDATE public.trade_transport_services
    SET km_reales = 999
    WHERE id = v_svc_completado;
    INSERT INTO _t1c_results VALUES(4, 'T1C-04 km UPDATE en completado rechazado', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(4, 'T1C-04 km UPDATE en completado rechazado', SQLERRM LIKE '%TRANSPORT_IMMUTABLE%', SQLERRM);
  END;

  -- ── T1C-05: Trigger protege completado ante cambio de estado ─────────────
  BEGIN
    UPDATE public.trade_transport_services
    SET estado = 'cancelado'
    WHERE id = v_svc_completado;
    INSERT INTO _t1c_results VALUES(5, 'T1C-05 estado UPDATE en completado rechazado', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(5, 'T1C-05 estado UPDATE en completado rechazado', SQLERRM LIKE '%TRANSPORT_IMMUTABLE%', SQLERRM);
  END;

  -- ── T1C-06: Columnas parte almacenadas correctamente ─────────────────────
  -- Insertamos directamente como owner (sin auth session, bypass del RPC para test de BD)
  UPDATE public.trade_transport_services
  SET estado               = 'completado',
      hora_real_salida     = now() - interval '90m',
      hora_real_llegada    = now() - interval '10m',
      km_reales            = 52.3,
      incidencias          = 'Retardo de 10 min en recogida',
      observaciones_cierre = 'Servicio completado sin incidencias graves',
      cerrado_at           = now(),
      cerrado_por          = v_owner_id
  WHERE id = v_svc_id;

  SELECT km_reales, estado INTO v_km, v_estado
  FROM public.trade_transport_services WHERE id = v_svc_id;

  INSERT INTO _t1c_results VALUES(
    6, 'T1C-06 campos parte almacenados',
    v_km = 52.3 AND v_estado = 'completado',
    format('km=%s estado=%s', v_km, v_estado)
  );

  -- ── T1C-07: cerrado_at no nulo tras cierre ────────────────────────────────
  SELECT cerrado_at::text INTO v_cerrado_at
  FROM public.trade_transport_services WHERE id = v_svc_id;

  INSERT INTO _t1c_results VALUES(
    7, 'T1C-07 cerrado_at no nulo',
    v_cerrado_at IS NOT NULL,
    v_cerrado_at
  );

  -- ── T1C-08: cerrado_por registrado ────────────────────────────────────────
  SELECT cerrado_por::text INTO v_cerrado_at
  FROM public.trade_transport_services WHERE id = v_svc_id;

  INSERT INTO _t1c_results VALUES(
    8, 'T1C-08 cerrado_por registrado',
    v_cerrado_at = v_owner_id::text,
    v_cerrado_at
  );

  -- ── T1C-09: incidencias almacenadas ───────────────────────────────────────
  SELECT incidencias INTO v_cerrado_at
  FROM public.trade_transport_services WHERE id = v_svc_id;

  INSERT INTO _t1c_results VALUES(
    9, 'T1C-09 incidencias almacenadas',
    v_cerrado_at = 'Retardo de 10 min en recogida',
    v_cerrado_at
  );

  -- ── T1C-10: observaciones_cierre almacenadas ─────────────────────────────
  SELECT observaciones_cierre INTO v_cerrado_at
  FROM public.trade_transport_services WHERE id = v_svc_id;

  INSERT INTO _t1c_results VALUES(
    10, 'T1C-10 observaciones_cierre almacenadas',
    v_cerrado_at = 'Servicio completado sin incidencias graves',
    v_cerrado_at
  );

  -- ── T1C-11: Servicio ya completado — trigger bloquea nuevo UPDATE ─────────
  BEGIN
    UPDATE public.trade_transport_services
    SET observaciones_cierre = 'Intento de re-cierre'
    WHERE id = v_svc_id;
    INSERT INTO _t1c_results VALUES(11, 'T1C-11 re-cierre bloqueado', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(11, 'T1C-11 re-cierre bloqueado', SQLERRM LIKE '%TRANSPORT_IMMUTABLE%', SQLERRM);
  END;

  -- ── T1C-12: hora_real_llegada = hora_real_salida rechazada ────────────────
  -- Creamos un svc de prueba específico
  INSERT INTO public.trade_transport_services(
    org_id, titulo, tipo_servicio, fecha_inicio, estado
  ) VALUES (
    v_org_id, 'Svc horas iguales', 'traslado_privado', now(), 'en_curso'
  ) RETURNING id INTO v_svc_id;

  BEGIN
    UPDATE public.trade_transport_services
    SET hora_real_salida  = '2026-10-23T09:00:00Z',
        hora_real_llegada = '2026-10-23T09:00:00Z',
        estado = 'completado'
    WHERE id = v_svc_id;
    INSERT INTO _t1c_results VALUES(12, 'T1C-12 llegada = salida rechazada', false, 'debió lanzar excepción');
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO _t1c_results VALUES(12, 'T1C-12 llegada = salida rechazada', true, SQLERRM);
  END;

  -- ── T1C-13: RPC complete_transport_service existe en BD ──────────────────
  SELECT COUNT(*) INTO v_count
  FROM pg_proc
  WHERE proname = 'complete_transport_service'
    AND pronamespace = 'public'::regnamespace;

  INSERT INTO _t1c_results VALUES(
    13, 'T1C-13 RPC complete_transport_service existe',
    v_count >= 1,
    format('count=%s', v_count)
  );

  -- ── T1C-14: _protect_completed_transport_service trigger existe ───────────
  SELECT COUNT(*) INTO v_count
  FROM pg_trigger
  WHERE tgname = 'trg_tts_protect_completed'
    AND tgrelid = 'public.trade_transport_services'::regclass;

  INSERT INTO _t1c_results VALUES(
    14, 'T1C-14 trigger trg_tts_protect_completed existe',
    v_count = 1,
    format('count=%s', v_count)
  );

  -- ── T1C-15: Columnas parte existen en trade_transport_services ────────────
  SELECT COUNT(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_transport_services'
    AND column_name IN (
      'hora_real_salida', 'hora_real_llegada', 'km_reales',
      'incidencias', 'observaciones_cierre', 'cerrado_at', 'cerrado_por'
    );

  INSERT INTO _t1c_results VALUES(
    15, 'T1C-15 las 7 columnas de parte existen',
    v_count = 7,
    format('columnas encontradas=%s/7', v_count)
  );

END;
$$;

-- ── Informe de resultados ─────────────────────────────────────────────────────

\echo ''
\echo '══════════════════════════════════════════════════════'
\echo ' TRANSPORT-T1-C: Parte de servicio y cierre           '
\echo '══════════════════════════════════════════════════════'

SELECT
  id,
  CASE WHEN pass THEN '✓ PASS' ELSE '✗ FAIL' END AS resultado,
  label,
  detail
FROM _t1c_results
ORDER BY id;

\echo ''

SELECT
  COUNT(*) FILTER (WHERE pass)  AS pass,
  COUNT(*) FILTER (WHERE NOT pass) AS fail,
  COUNT(*) AS total
FROM _t1c_results;

\echo '══════════════════════════════════════════════════════'

DO $$
DECLARE v_fail int;
BEGIN
  SELECT COUNT(*) INTO v_fail FROM _t1c_results WHERE NOT pass;
  IF v_fail > 0 THEN
    RAISE EXCEPTION 'T1C: % test(s) fallaron', v_fail;
  END IF;
END;
$$;

ROLLBACK;
