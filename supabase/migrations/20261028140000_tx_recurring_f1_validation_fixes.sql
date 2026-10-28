
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-RECURRING-F1-VALIDATION-FIX — Correcciones post-validación
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Corrección identificada durante validación estática (2026-10-28):
--
-- BUG: En el handler WHEN unique_violation de materialize_transport_occurrence,
--      si la re-query a trade_transport_occurrence_links no encuentra fila
--      (race condition extrema: otro proceso eliminó el enlace justo después
--      de que la UNIQUE constraint disparase), la función devuelve:
--        { ok: true, idempotent: true, service_id: null }
--      El caller no puede distinguir éxito real de este estado anómalo.
--
-- FIX: Añadir comprobación IS NULL después de la re-query; si el enlace
--      no se encuentra, devolver error en lugar de un service_id nulo.
--
-- Sin cambios en tablas, índices, RLS, ni datos existentes.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.materialize_transport_occurrence(
  p_org_id      uuid,
  p_schedule_id uuid,
  p_fecha       date,
  p_sentido     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid              uuid;
  v_schedule         public.trade_transport_schedules;
  v_exception        public.trade_transport_schedule_exceptions;
  v_has_exception    boolean := false;
  v_link_service_id  uuid;
  v_service_id       uuid;
  v_fecha_inicio     timestamptz;
  v_fecha_fin        timestamptz;
  v_hora_salida      time;
  v_hora_llegada     time;
  v_vehicle_id       uuid;
  v_conductor_id     uuid;
  v_paradas          jsonb;
  v_origen           jsonb;
  v_destino          jsonb;
  v_dia_semana       smallint;
  v_tz               text;
  v_titulo           text;
  v_origen_txt       text;
  v_destino_txt      text;
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

  -- ── PASO 6: Calcular timestamps ────────────────────────────────────────
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

  IF v_has_exception AND v_exception.tipo IN ('cambio_horario','cambio_itinerario') THEN
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

  v_fecha_inicio := (p_fecha::text || ' ' || v_hora_salida::text)::timestamp
                    AT TIME ZONE v_tz;

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
    END IF;
  END IF;

  -- ── PASO 8: Comprobar idempotencia ────────────────────────────────────
  SELECT service_id INTO v_link_service_id
    FROM public.trade_transport_occurrence_links
   WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok',        true,
      'idempotent', true,
      'service_id', v_link_service_id
    );
  END IF;

  -- ── PASO 9: Crear servicio e insertar enlace en la misma transacción ──
  v_titulo := v_schedule.nombre
    || ' — ' || to_char(p_fecha, 'DD/MM/YYYY')
    || CASE p_sentido
         WHEN 'ida'    THEN ' (ida)'
         WHEN 'vuelta' THEN ' (vuelta)'
         ELSE ''
       END;

  v_origen_txt  := COALESCE(
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
    org_id,
    client_id,
    titulo,
    tipo_servicio,
    estado,
    fecha_inicio,
    fecha_fin,
    origen,
    destino,
    paradas,
    num_viajeros,
    vehicle_id,
    conductor_id,
    precio_acordado,
    observaciones,
    schedule_id,
    schedule_fecha,
    schedule_sentido
  ) VALUES (
    p_org_id,
    v_schedule.client_id,
    v_titulo,
    v_schedule.tipo_servicio,
    'borrador',
    v_fecha_inicio,
    v_fecha_fin,
    v_origen_txt,
    v_destino_txt,
    v_paradas,
    v_schedule.num_viajeros::int,
    v_vehicle_id,
    v_conductor_id,
    v_schedule.precio_referencia,
    NULL,
    p_schedule_id,
    p_fecha,
    p_sentido
  )
  RETURNING id INTO v_service_id;

  INSERT INTO public.trade_transport_occurrence_links (
    org_id,
    schedule_id,
    service_id,
    fecha,
    sentido
  ) VALUES (
    p_org_id,
    p_schedule_id,
    v_service_id,
    p_fecha,
    p_sentido
  );

  -- ── PASO 10: Devolver resultado ───────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',         true,
    'idempotent', false,
    'service_id', v_service_id
  );

EXCEPTION
  WHEN unique_violation THEN
    -- Carrera: otro proceso materializó la misma ocurrencia concurrentemente.
    -- Re-query para obtener el service_id del enlace ganador.
    SELECT service_id INTO v_link_service_id
      FROM public.trade_transport_occurrence_links
     WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;
    -- FIX: si la re-query no devuelve fila (race condition extrema: enlace eliminado
    -- justo después de la unique_violation), devolver error en lugar de service_id:null.
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

REVOKE ALL ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text)
  TO authenticated;

COMMENT ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text) IS
  'TX-RECURRING-F1: Materializa una ocurrencia de plantilla recurrente en un servicio '
  'puntual. Atómico, idempotente vía UNIQUE(schedule_id, fecha, sentido). '
  'Devuelve {ok, idempotent, service_id} o {ok:false, error}. '
  'FIX v2: concurrent unique_violation handler retorna error si re-query devuelve NULL.';
