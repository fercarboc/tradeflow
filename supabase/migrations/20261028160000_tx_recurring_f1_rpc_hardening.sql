
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-RECURRING-F1-RPC-HARDENING — Cierre de riesgos residuales
-- ══════════════════════════════════════════════════════════════════════════════
--
-- RIESGO A (ttol_delete):
--   La migración 120000 creó la política ttol_delete que permite a admins borrar
--   directamente un enlace en trade_transport_occurrence_links. Esto puede
--   provocar:
--     1. Desincronización entre el servicio puntual existente y la plantilla.
--     2. Re-materialización posterior del mismo viaje → datos duplicados.
--     3. Posible brecha de auditoría (sin registro de por qué se borró).
--   La migración 150000 eliminó ttol_insert (C6-GAP) pero mantuvo ttol_delete.
--   Este commit corrige ese gap.
--
--   Decisión: eliminar ttol_delete. El borrado de un enlace debe realizarse
--   exclusivamente vía una futura RPC transaccional y auditada (F3+).
--   Como capa adicional, REVOCAR DML directo a nivel de tabla para authenticated.
--
-- RIESGO B (firma 4 parámetros):
--   La migración 150000 crea materialize_transport_occurrence con 5 parámetros
--   (p_utc_offset_minutes DEFAULT NULL). PostgreSQL trata esto como un NUEVO
--   OVERLOAD que coexiste con la firma de 4 parámetros de la migración 140000.
--   Un llamador que pase 4 args usa el overload antiguo sin validación DST.
--   REVOKE/GRANT de 150000 solo aplican al overload de 5 params.
--
--   Decisión: eliminar la firma de 4 parámetros. La firma de 5 con DEFAULT NULL
--   es 100% compatible hacia atrás para llamadores sin utc_offset_minutes.
--
-- RIESGO C (validación p_utc_offset_minutes):
--   La versión actual de materialize_transport_occurrence acepta cualquier
--   entero como p_utc_offset_minutes sin validar que sea uno de los dos offsets
--   posibles para la hora ambigua. Añadir validación explícita.
--
-- SIN CAMBIOS: tablas Fleet-2A, Stripe, VeriFactu, facturación.
-- DEPENDENCIAS: requiere migraciones 120000, 140000 y 150000 aplicadas.
-- ══════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- A. Eliminar ttol_delete + REVOKE DML directo en occurrence_links
-- ════════════════════════════════════════════════════════════════════════════

-- A1: Eliminar política DELETE directa
DROP POLICY IF EXISTS "ttol_delete" ON public.trade_transport_occurrence_links;

-- A2: REVOCAR INSERT/UPDATE/DELETE a nivel de tabla para authenticated y anon.
--     Aunque sin política RLS el acceso ya estaría bloqueado, REVOKE garantiza
--     el bloqueo incluso ante futuros cambios de política.
--     SELECT se mantiene (lo concede la política ttol_select).
REVOKE INSERT, UPDATE, DELETE
  ON public.trade_transport_occurrence_links
  FROM authenticated, anon;

COMMENT ON TABLE public.trade_transport_occurrence_links IS
  'Puente entre plantilla recurrente y servicio materializado. '
  'INSERT: EXCLUSIVAMENTE vía RPC materialize_transport_occurrence (SECURITY DEFINER). '
  'DELETE: SOLO vía futura RPC de reset administrativo (F3+). Directo bloqueado. '
  'SELECT: todos los miembros de la org (política ttol_select). '
  'UPDATE: no permitido.';


-- ════════════════════════════════════════════════════════════════════════════
-- B. Eliminar firma de 4 parámetros (overload legacy sin controles DST)
-- ════════════════════════════════════════════════════════════════════════════

-- Después de este DROP, la firma de 5 parámetros con DEFAULT NULL resuelve
-- todas las llamadas: con 4 args posicionales, p_utc_offset_minutes = NULL.
-- PostgREST omite el parámetro si el cliente no lo provee → mismo efecto.

DROP FUNCTION IF EXISTS public.materialize_transport_occurrence(uuid, uuid, date, text);


-- ════════════════════════════════════════════════════════════════════════════
-- C. Reescritura con validación de p_utc_offset_minutes
-- ════════════════════════════════════════════════════════════════════════════
--
-- Cambios respecto a la versión de 150000:
--   · PASO 6B: cuando la hora es AMBIGUOUS y se provee p_utc_offset_minutes,
--     validar que el valor sea exactamente offset_summer_minutes o
--     offset_winter_minutes (los dos únicos válidos para esa fecha y TZ).
--     Un offset fuera de estos dos devuelve TRANSPORT_DST_INVALID_OFFSET.
--   · Sin otros cambios de lógica.
--   · Todos los pasos anteriores (auth, validaciones de período, sentido,
--     excepciones, tipos modificado/cambio_*, DST NONEXISTENT, AMBIGUOUS sin
--     hint, idempotencia, INSERT, BUG-F1-V1 fix) se preservan idénticos.

CREATE OR REPLACE FUNCTION public.materialize_transport_occurrence(
  p_org_id              uuid,
  p_schedule_id         uuid,
  p_fecha               date,
  p_sentido             text,
  p_utc_offset_minutes  integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid               uuid;
  v_schedule          public.trade_transport_schedules;
  v_exception         public.trade_transport_schedule_exceptions;
  v_has_exception     boolean := false;
  v_link_service_id   uuid;
  v_service_id        uuid;
  v_fecha_inicio      timestamptz;
  v_fecha_fin         timestamptz;
  v_hora_salida       time;
  v_hora_llegada      time;
  v_vehicle_id        uuid;
  v_conductor_id      uuid;
  v_paradas           jsonb;
  v_origen            jsonb;
  v_destino           jsonb;
  v_dia_semana        smallint;
  v_tz                text;
  v_titulo            text;
  v_origen_txt        text;
  v_destino_txt       text;
  v_local_salida      timestamp;
  v_dst_check         jsonb;
  v_fecha_inicio_set  boolean := false;
BEGIN
  -- ── PASO 1: Autenticación ─────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TRANSPORT_AUTH: autenticación requerida');
  END IF;

  -- ── PASO 2: Autorización + transporte habilitado + plantilla ─────────
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND owner_id = v_uid
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id AND user_id = v_uid
       AND rol IN ('owner','admin') AND activo = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_FORBIDDEN: no autorizado para esta organización');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND transport_enabled = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización');
  END IF;

  SELECT * INTO v_schedule
    FROM public.trade_transport_schedules
   WHERE id = p_schedule_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_NOT_FOUND: plantilla no encontrada en esta organización');
  END IF;

  IF v_schedule.estado <> 'activo' THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_INVALID: la plantilla no está en estado activo (estado actual: '
      || v_schedule.estado || ')');
  END IF;

  -- ── PASO 3: Validar fecha, día de semana y período ────────────────────
  IF p_fecha < v_schedule.periodo_inicio THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_INVALID: fecha anterior al inicio del período de la plantilla ('
      || v_schedule.periodo_inicio || ')');
  END IF;

  IF v_schedule.periodo_fin IS NOT NULL AND p_fecha > v_schedule.periodo_fin THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_INVALID: fecha posterior al fin del período de la plantilla ('
      || v_schedule.periodo_fin || ')');
  END IF;

  v_dia_semana := EXTRACT(isodow FROM p_fecha)::smallint;
  IF NOT (v_dia_semana = ANY(v_schedule.dias_semana)) THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_INVALID: la fecha no corresponde a un día de circulación de la plantilla (día ISO: '
      || v_dia_semana || ')');
  END IF;

  -- ── PASO 4: Aplicar excepciones ───────────────────────────────────────
  SELECT * INTO v_exception
    FROM public.trade_transport_schedule_exceptions
   WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;

  v_has_exception := FOUND;

  IF v_has_exception AND v_exception.tipo IN ('no_circula','suspendido') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_SUSPENDED: este servicio no circula en la fecha indicada (tipo excepción: '
      || v_exception.tipo || ')');
  END IF;

  -- ── PASO 5: Validar sentido ────────────────────────────────────────────
  IF p_sentido NOT IN ('ida','vuelta','unico') THEN
    RETURN jsonb_build_object('ok', false, 'error',
      'TRANSPORT_INVALID: sentido debe ser ''ida'', ''vuelta'' o ''unico''');
  END IF;

  IF v_schedule.vuelta_habilitada THEN
    IF p_sentido = 'unico' THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'TRANSPORT_INVALID: la plantilla tiene vuelta habilitada; usa sentido ''ida'' o ''vuelta''');
    END IF;
  ELSE
    IF p_sentido <> 'unico' THEN
      RETURN jsonb_build_object('ok', false, 'error',
        'TRANSPORT_INVALID: la plantilla no tiene vuelta habilitada; usa sentido ''unico''');
    END IF;
  END IF;

  -- ── PASO 6A: Seleccionar campos por sentido + aplicar overrides ───────
  v_tz := COALESCE(v_schedule.timezone, 'Europe/Madrid');

  IF p_sentido = 'vuelta' THEN
    v_hora_salida  := v_schedule.hora_salida_vuelta;
    v_hora_llegada := v_schedule.hora_llegada_vuelta;
    v_paradas      := v_schedule.paradas_vuelta;
    v_origen       := v_schedule.destino_ida;
    v_destino      := v_schedule.origen_ida;
  ELSE
    v_hora_salida  := v_schedule.hora_salida_ida;
    v_hora_llegada := v_schedule.hora_llegada_ida;
    v_paradas      := v_schedule.paradas_ida;
    v_origen       := v_schedule.origen_ida;
    v_destino      := v_schedule.destino_ida;
  END IF;

  IF v_has_exception AND v_exception.tipo IN ('cambio_horario','cambio_itinerario','modificado') THEN
    IF v_exception.overrides ? 'hora_salida' THEN
      v_hora_salida := (v_exception.overrides->>'hora_salida')::time;
    END IF;
    IF v_exception.overrides ? 'hora_llegada' THEN
      v_hora_llegada := (v_exception.overrides->>'hora_llegada')::time;
    END IF;
    IF v_exception.overrides ? 'paradas' THEN
      v_paradas := v_exception.overrides->'paradas';
    END IF;
    IF v_exception.overrides ? 'origen' THEN
      v_origen := v_exception.overrides->'origen';
    END IF;
    IF v_exception.overrides ? 'destino' THEN
      v_destino := v_exception.overrides->'destino';
    END IF;
  END IF;

  -- ── PASO 6B: DST check en hora de salida ─────────────────────────────
  v_local_salida := (p_fecha::text || ' ' || v_hora_salida::text)::timestamp;
  v_dst_check    := public._classify_dst_time(v_local_salida, v_tz);

  IF v_dst_check->>'type' = 'NONEXISTENT' THEN
    RETURN jsonb_build_object(
      'ok',    false,
      'error', 'TRANSPORT_DST_NONEXISTENT: la hora de salida ' || v_hora_salida::text
               || ' del ' || p_fecha::text || ' no existe en ' || v_tz
               || ' (cambio horario de primavera). '
               || 'Usa una hora anterior a 02:00 o posterior a 03:00, o actualiza la plantilla.'
    );
  ELSIF v_dst_check->>'type' = 'AMBIGUOUS' THEN
    IF p_utc_offset_minutes IS NULL THEN
      RETURN jsonb_build_object(
        'ok',                      false,
        'error',                   'TRANSPORT_DST_AMBIGUOUS: la hora de salida ' || v_hora_salida::text
                                   || ' del ' || p_fecha::text || ' es ambigua en ' || v_tz
                                   || ' (cambio horario de otoño). '
                                   || 'Especifica utc_offset_minutes para desambiguar.',
        'dst_offset_summer_minutes', (v_dst_check->>'offset_summer_minutes')::int,
        'dst_offset_winter_minutes', (v_dst_check->>'offset_winter_minutes')::int
      );
    ELSIF p_utc_offset_minutes NOT IN (
      (v_dst_check->>'offset_summer_minutes')::int,
      (v_dst_check->>'offset_winter_minutes')::int
    ) THEN
      -- Riesgo C: offset inválido para esta fecha y zona horaria
      RETURN jsonb_build_object(
        'ok',                      false,
        'error',                   'TRANSPORT_DST_INVALID_OFFSET: el offset ' || p_utc_offset_minutes
                                   || ' min no es válido para ' || v_tz
                                   || ' en ' || p_fecha::text
                                   || '. Offsets válidos: verano='
                                   || (v_dst_check->>'offset_summer_minutes')
                                   || ' min, invierno='
                                   || (v_dst_check->>'offset_winter_minutes') || ' min.',
        'dst_offset_summer_minutes', (v_dst_check->>'offset_summer_minutes')::int,
        'dst_offset_winter_minutes', (v_dst_check->>'offset_winter_minutes')::int
      );
    ELSE
      v_fecha_inicio     := v_local_salida AT TIME ZONE make_interval(mins => p_utc_offset_minutes);
      v_fecha_inicio_set := true;
    END IF;
  END IF;

  IF NOT v_fecha_inicio_set THEN
    v_fecha_inicio := v_local_salida AT TIME ZONE v_tz;
  END IF;

  -- ── PASO 6C: Hora de llegada ───────────────────────────────────────────
  IF v_hora_llegada IS NOT NULL THEN
    IF v_hora_llegada <= v_hora_salida THEN
      v_fecha_fin := ((p_fecha + 1)::text || ' ' || v_hora_llegada::text)::timestamp
                     AT TIME ZONE v_tz;
    ELSE
      v_fecha_fin := (p_fecha::text || ' ' || v_hora_llegada::text)::timestamp
                     AT TIME ZONE v_tz;
    END IF;
  ELSE
    v_fecha_fin := NULL;
  END IF;

  -- ── PASO 7: Resolver vehículo y conductor ─────────────────────────────
  v_vehicle_id   := v_schedule.vehicle_id;
  v_conductor_id := v_schedule.conductor_id;

  IF v_has_exception THEN
    IF v_exception.tipo = 'cambio_conductor' AND v_exception.overrides ? 'conductor_id' THEN
      v_conductor_id := (v_exception.overrides->>'conductor_id')::uuid;
    ELSIF v_exception.tipo = 'cambio_vehiculo' AND v_exception.overrides ? 'vehicle_id' THEN
      v_vehicle_id := (v_exception.overrides->>'vehicle_id')::uuid;
    ELSIF v_exception.tipo = 'modificado' THEN
      IF v_exception.overrides ? 'conductor_id' THEN
        v_conductor_id := (v_exception.overrides->>'conductor_id')::uuid;
      END IF;
      IF v_exception.overrides ? 'vehicle_id' THEN
        v_vehicle_id := (v_exception.overrides->>'vehicle_id')::uuid;
      END IF;
    END IF;
  END IF;

  -- ── PASO 8: Comprobar idempotencia ────────────────────────────────────
  SELECT service_id INTO v_link_service_id
    FROM public.trade_transport_occurrence_links
   WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',         true,
      'idempotent', true,
      'service_id', v_link_service_id
    );
  END IF;

  -- ── PASO 9: Crear servicio + enlace (transacción implícita) ───────────
  v_titulo := v_schedule.nombre
    || ' — ' || to_char(p_fecha, 'DD/MM/YYYY')
    || CASE p_sentido
         WHEN 'ida'    THEN ' (ida)'
         WHEN 'vuelta' THEN ' (vuelta)'
         ELSE ''
       END;

  v_origen_txt := COALESCE(
    NULLIF(trim(v_origen->>'nombre_lugar'), ''),
    NULLIF(trim(v_origen->>'localidad'), ''),
    NULLIF(trim(v_origen->>'calle'), ''),
    v_origen::text
  );
  v_destino_txt := COALESCE(
    NULLIF(trim(v_destino->>'nombre_lugar'), ''),
    NULLIF(trim(v_destino->>'localidad'), ''),
    NULLIF(trim(v_destino->>'calle'), ''),
    v_destino::text
  );

  INSERT INTO public.trade_transport_services (
    org_id, client_id, titulo, tipo_servicio, estado,
    fecha_inicio, fecha_fin, origen, destino, paradas,
    num_viajeros, vehicle_id, conductor_id, precio_acordado,
    observaciones, schedule_id, schedule_fecha, schedule_sentido
  ) VALUES (
    p_org_id, v_schedule.client_id, v_titulo, v_schedule.tipo_servicio, 'borrador',
    v_fecha_inicio, v_fecha_fin, v_origen_txt, v_destino_txt, v_paradas,
    v_schedule.num_viajeros::int, v_vehicle_id, v_conductor_id, v_schedule.precio_referencia,
    NULL, p_schedule_id, p_fecha, p_sentido
  )
  RETURNING id INTO v_service_id;

  INSERT INTO public.trade_transport_occurrence_links (
    org_id, schedule_id, service_id, fecha, sentido
  ) VALUES (
    p_org_id, p_schedule_id, v_service_id, p_fecha, p_sentido
  );

  -- ── PASO 10: Resultado ────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',         true,
    'idempotent', false,
    'service_id', v_service_id
  );

EXCEPTION
  WHEN unique_violation THEN
    SELECT service_id INTO v_link_service_id
      FROM public.trade_transport_occurrence_links
     WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;
    -- BUG-F1-V1 FIX: NULL guard en race condition extrema
    IF v_link_service_id IS NULL THEN
      RETURN jsonb_build_object(
        'ok',    false,
        'error', 'TRANSPORT_CONCURRENT_ERROR: colisión de concurrencia irrecuperable; reintenta la operación'
      );
    END IF;
    RETURN jsonb_build_object(
      'ok',         true,
      'idempotent', true,
      'service_id', v_link_service_id
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text, integer)
  TO authenticated;

COMMENT ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text, integer) IS
  'TX-RECURRING-F1 v4 (hardening): materializa ocurrencia de plantilla recurrente. '
  'Única firma: 5 parámetros con p_utc_offset_minutes DEFAULT NULL (4-param overload eliminado). '
  'DST: NONEXISTENT rechazado, AMBIGUOUS exige elección validada contra offsets reales de la TZ. '
  'Riesgos cerrados: A (ttol_delete + REVOKE DML), B (overload 4-param), C (validación offset). '
  'BUG-F1-V1 preservado.';
