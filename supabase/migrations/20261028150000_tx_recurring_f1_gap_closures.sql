
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-RECURRING-F1 GAP CLOSURES — Cierre de C6, E y F antes de F2
-- ══════════════════════════════════════════════════════════════════════════════
--
-- A. C6-GAP: Eliminar política INSERT directa en occurrence_links.
--    La creación de enlaces solo puede ocurrir a través de la RPC SECURITY DEFINER
--    materialize_transport_occurrence. El trigger ON DELETE CASCADE del servicio
--    y la política DELETE existente permiten el flujo legítimo de borrado/reset.
--
-- B. E-GAP: Añadir tipo 'modificado' a excepciones.
--    Permite combinar cambios de conductor, vehículo, horario e itinerario en una
--    sola excepción por (schedule_id, fecha, sentido).
--
-- C. F-GAP: Manejo de DST en materialización.
--    - Rechaza horas inexistentes (cambio primavera) con error comprensible.
--    - Exige elección explícita para horas ambiguas (cambio otoño).
--    - Nota: el informe de validación afirmó que PostgreSQL elige determinísticamente
--      el offset de verano para horas ambiguas. Esto es INCORRECTO: el comportamiento
--      depende de la versión de la librería TZ y no está garantizado. La implementación
--      correcta es detectar la ambigüedad y exigir elección explícita.
--
-- DEPENDENCIAS: requiere migración 20261028120000 aplicada (tablas F1 existentes).
-- SIN CAMBIOS: tablas Fleet-2A, Stripe, VeriFactu, facturación.
-- ══════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- A. C6-GAP — Eliminar política INSERT directa en occurrence_links
-- ════════════════════════════════════════════════════════════════════════════
-- La política ttol_insert permitía a admins insertar enlaces directamente,
-- saltándose las validaciones de la RPC (período, día de semana, suspensiones,
-- DST, idempotencia). Tras eliminarla, solo la RPC SECURITY DEFINER puede crear.
--
-- La política ttol_delete se mantiene: un admin puede borrar un enlace para
-- permitir la re-materialización (reset manual por operador del sistema).
-- El ON DELETE CASCADE del FK service_id elimina el enlace cuando se borra
-- el servicio, sin necesidad de política de usuario.

DROP POLICY IF EXISTS "ttol_insert" ON public.trade_transport_occurrence_links;

COMMENT ON TABLE public.trade_transport_occurrence_links IS
  'Puente entre plantilla y servicio materializado. '
  'INSERT: SOLO vía RPC materialize_transport_occurrence (SECURITY DEFINER). '
  'DELETE: permitido a admins para reset manual. '
  'ON DELETE CASCADE desde trade_transport_services: el borrado del servicio borra el enlace.';


-- ════════════════════════════════════════════════════════════════════════════
-- B. E-GAP — Tipo 'modificado': excepción combinada
-- ════════════════════════════════════════════════════════════════════════════


-- ── B1. Extender CHECK constraint en tipo ─────────────────────────────────────
-- Elimina y recrea el CHECK (PostgreSQL no soporta ALTER de CHECK inline).

ALTER TABLE public.trade_transport_schedule_exceptions
  DROP CONSTRAINT IF EXISTS trade_transport_schedule_exceptions_tipo_check;

ALTER TABLE public.trade_transport_schedule_exceptions
  ADD CONSTRAINT trade_transport_schedule_exceptions_tipo_check
  CHECK (tipo IN (
    'no_circula',
    'suspendido',
    'cambio_horario',
    'cambio_conductor',
    'cambio_vehiculo',
    'cambio_itinerario',
    'modificado'
  ));


-- ── B2. Actualizar trigger de validación de overrides ─────────────────────────
-- Añade whitelist para 'modificado': cualquier combinación de los campos de
-- conductor, vehículo, horario e itinerario (unión de todos los tipos).

CREATE OR REPLACE FUNCTION public._validate_schedule_exception_overrides()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_forbidden  text[]   := ARRAY['org_id','id','schedule_id','fecha','sentido','tipo','created_at'];
  v_key        text;
  v_allowed    text[];
BEGIN
  -- overrides debe ser un objeto JSON (no array, no escalar)
  IF jsonb_typeof(NEW.overrides) <> 'object' THEN
    RAISE EXCEPTION 'SCHEDULE_EXCEPTION_INVALID: overrides debe ser un objeto JSON, no %',
      jsonb_typeof(NEW.overrides);
  END IF;

  -- Claves prohibidas (protección contra inyección de campos de seguridad)
  FOREACH v_key IN ARRAY v_forbidden
  LOOP
    IF NEW.overrides ? v_key THEN
      RAISE EXCEPTION 'SCHEDULE_EXCEPTION_INVALID: la clave "%" está prohibida en overrides', v_key;
    END IF;
  END LOOP;

  -- Claves permitidas según tipo
  CASE NEW.tipo
    WHEN 'no_circula', 'suspendido' THEN
      IF NEW.overrides <> '{}'::jsonb THEN
        RAISE EXCEPTION 'SCHEDULE_EXCEPTION_INVALID: tipo % no admite overrides; usa overrides={}', NEW.tipo;
      END IF;
    WHEN 'cambio_horario' THEN
      v_allowed := ARRAY['hora_salida','hora_llegada'];
    WHEN 'cambio_conductor' THEN
      v_allowed := ARRAY['conductor_id'];
    WHEN 'cambio_vehiculo' THEN
      v_allowed := ARRAY['vehicle_id'];
    WHEN 'cambio_itinerario' THEN
      v_allowed := ARRAY['hora_salida','hora_llegada','paradas','origen','destino'];
    WHEN 'modificado' THEN
      -- Unión de todos los tipos de recursos + horario + itinerario
      v_allowed := ARRAY[
        'conductor_id', 'vehicle_id',
        'hora_salida', 'hora_llegada',
        'paradas', 'origen', 'destino'
      ];
    ELSE
      RAISE EXCEPTION 'SCHEDULE_EXCEPTION_INVALID: tipo desconocido: %', NEW.tipo;
  END CASE;

  -- Para tipos que tienen overrides, ninguna clave fuera de v_allowed
  IF v_allowed IS NOT NULL THEN
    FOR v_key IN SELECT jsonb_object_keys(NEW.overrides)
    LOOP
      IF NOT (v_key = ANY(v_allowed)) THEN
        RAISE EXCEPTION
          'SCHEDULE_EXCEPTION_INVALID: clave "%" no permitida para tipo %; claves válidas: %',
          v_key, NEW.tipo, array_to_string(v_allowed, ', ');
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_schedule_exception_overrides() FROM PUBLIC;


-- ════════════════════════════════════════════════════════════════════════════
-- C. F-GAP — DST: función de clasificación de hora local
-- ════════════════════════════════════════════════════════════════════════════
--
-- Clasifica una hora local en una zona horaria IANA:
--   VALID      → hora única, conversión automática
--   NONEXISTENT → hora en la brecha de primavera (no existe en la zona horaria)
--   AMBIGUOUS  → hora en la hora repetida de otoño (dos conversiones UTC posibles)
--
-- Algoritmo para NONEXISTENT:
--   Si convertir local→UTC y de vuelta a local cambia el valor, la hora fue
--   ajustada: no existe y PostgreSQL la normalizó silenciosamente.
--
-- Algoritmo para AMBIGUOUS:
--   Calcula el offset UTC en p_local y en (p_local + 1h).
--   Si el offset decrece dentro de la hora siguiente, los relojes retrocedieron:
--   p_local está en la hora repetida (ambigua).
--   El offset se calcula como: epoch(hora_local_como_UTC) - epoch(UTC_real).
--
-- CORRECCIÓN DEL INFORME PREVIO:
--   El informe de validación TX-RECURRING-F1 afirmó que "PostgreSQL
--   determinísticamente elige el offset de verano" para horas ambiguas.
--   Esto es INCORRECTO. El comportamiento depende de la versión de libicu/TZDB
--   y no está garantizado por la especificación SQL ni por PostgreSQL.
--   Esta función detecta la ambigüedad y la rechaza sin asumir ningún offset.

CREATE OR REPLACE FUNCTION public._classify_dst_time(
  p_local  timestamp,
  p_tz     text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_utc          timestamptz;
  v_back         timestamp;
  v_utc_p1h      timestamptz;
  v_offset_secs  numeric;
  v_offset_p1h   numeric;
BEGIN
  -- PASO 1: Convertir local → UTC (PostgreSQL elige una interpretación)
  v_utc  := p_local AT TIME ZONE p_tz;

  -- PASO 2: Round-trip UTC → local
  v_back := v_utc AT TIME ZONE p_tz;

  -- PASO 3: Si el round-trip no coincide, la hora no existe (brecha de primavera)
  IF v_back <> p_local THEN
    RETURN jsonb_build_object(
      'type',     'NONEXISTENT',
      'local',    p_local::text,
      'adjusted', v_back::text
    );
  END IF;

  -- PASO 4: Detectar hora repetida (otoño)
  --
  -- Offset UTC en p_local (en segundos):
  --   EXTRACT(EPOCH FROM timestamp_sin_tz) trata el timestamp como UTC.
  --   La diferencia epoch(local_como_UTC) - epoch(UTC_real) = offset.
  v_offset_secs := EXTRACT(EPOCH FROM p_local)::numeric
                 - EXTRACT(EPOCH FROM v_utc)::numeric;

  -- Offset UTC en (p_local + 1h)
  v_utc_p1h    := (p_local + INTERVAL '1 hour') AT TIME ZONE p_tz;
  v_offset_p1h := EXTRACT(EPOCH FROM (p_local + INTERVAL '1 hour'))::numeric
                - EXTRACT(EPOCH FROM v_utc_p1h)::numeric;

  -- Si el offset disminuye en la próxima hora: los relojes retrocedieron,
  -- la hora actual está en la zona de repetición (ambigua).
  IF v_offset_secs > v_offset_p1h THEN
    RETURN jsonb_build_object(
      'type',                   'AMBIGUOUS',
      'local',                  p_local::text,
      'utc_if_unresolved',      v_utc::text,
      'offset_summer_minutes',  (v_offset_secs / 60)::int,
      'offset_winter_minutes',  (v_offset_p1h  / 60)::int
    );
  END IF;

  -- Hora normal: conversión única
  RETURN jsonb_build_object(
    'type', 'VALID',
    'utc',  v_utc::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public._classify_dst_time(timestamp, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public._classify_dst_time(timestamp, text) TO authenticated;

COMMENT ON FUNCTION public._classify_dst_time(timestamp, text) IS
  'Clasifica una hora local: VALID / NONEXISTENT (brecha de primavera) / AMBIGUOUS (hora repetida de otoño). '
  'Usa round-trip y comparación de offsets UTC. '
  'NOTA: no asume el comportamiento de PostgreSQL con horas ambiguas; detecta y rechaza explícitamente.';


-- ════════════════════════════════════════════════════════════════════════════
-- D. Reescritura completa de materialize_transport_occurrence
--    (preserva BUG-F1-V1 fix + añade DST + añade tipo 'modificado')
-- ════════════════════════════════════════════════════════════════════════════
--
-- Cambios respecto a 20261028140000:
--   · Nuevo parámetro p_utc_offset_minutes (DEFAULT NULL): permite al llamador
--     especificar el offset UTC explícito cuando la hora es ambigua (DST otoño).
--     Compatible con versiones anteriores: DEFAULT NULL no rompe llamadores existentes.
--   · PASO 4: tipo 'modificado' aplica overrides de hora/itinerario (como cambio_itinerario).
--   · PASO 6: DST check usando _classify_dst_time antes de construir v_fecha_inicio.
--   · PASO 7: tipo 'modificado' aplica conductor_id y vehicle_id combinados.
--   · BUG-F1-V1 preservado: handler unique_violation comprueba NULL antes de retornar.

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

  -- ── PASO 6A: Seleccionar campos por sentido + aplicar overrides de horario/itinerario ──
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

  -- Overrides de horario e itinerario: cambio_horario, cambio_itinerario, modificado
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
               || ' (cambio horario de primavera: los relojes avanzan de 02:00 a 03:00). '
               || 'Usa una hora anterior a 02:00 o posterior a 03:00, o actualiza la plantilla.'
    );
  ELSIF v_dst_check->>'type' = 'AMBIGUOUS' THEN
    IF p_utc_offset_minutes IS NULL THEN
      RETURN jsonb_build_object(
        'ok',                      false,
        'error',                   'TRANSPORT_DST_AMBIGUOUS: la hora de salida ' || v_hora_salida::text
                                   || ' del ' || p_fecha::text || ' es ambigua en ' || v_tz
                                   || ' (cambio horario de otoño: esa hora ocurre dos veces). '
                                   || 'Especifica utc_offset_minutes para desambiguar.',
        'dst_offset_summer_minutes', (v_dst_check->>'offset_summer_minutes')::int,
        'dst_offset_winter_minutes', (v_dst_check->>'offset_winter_minutes')::int
      );
    ELSE
      -- Offset explícito: interpreta la hora local como si estuviera en ese offset UTC
      v_fecha_inicio := v_local_salida AT TIME ZONE make_interval(mins => p_utc_offset_minutes);
      v_fecha_inicio_set := true;
    END IF;
  END IF;

  -- Hora válida (o ya resuelta con offset explícito)
  IF NOT v_fecha_inicio_set THEN
    v_fecha_inicio := v_local_salida AT TIME ZONE v_tz;
  END IF;

  -- ── PASO 6C: Calcular hora de llegada (sin DST check por ahora, F3) ──
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
      -- Modificación combinada: aplica conductor y/o vehículo independientemente
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

  -- ── PASO 9: Crear servicio e insertar enlace ──────────────────────────
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
    org_id, client_id, titulo, tipo_servicio, estado,
    fecha_inicio, fecha_fin, origen, destino, paradas,
    num_viajeros, vehicle_id, conductor_id, precio_acordado,
    observaciones, schedule_id, schedule_fecha, schedule_sentido
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
    org_id, schedule_id, service_id, fecha, sentido
  ) VALUES (
    p_org_id, p_schedule_id, v_service_id, p_fecha, p_sentido
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
    -- BUG-F1-V1 FIX (20261028140000): si la re-query no encuentra fila, devolver error
    -- en lugar de service_id:null.
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

-- Compatibilidad regresiva: la versión de 4 parámetros queda sin función,
-- PostgREST usará la versión de 5 con p_utc_offset_minutes DEFAULT NULL.

COMMENT ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text, integer) IS
  'TX-RECURRING-F1 v3: materializa ocurrencia de plantilla recurrente. '
  'Atómico, idempotente (UNIQUE schedule_id+fecha+sentido). '
  'p_utc_offset_minutes: offset explícito para horas DST ambiguas (otoño). '
  'Devuelve {ok, idempotent, service_id} o {ok:false, error, [dst_offset_*]}. '
  'GAPs cerrados: C6 (INSERT RLS), E (tipo modificado), F (DST check). '
  'BUG-F1-V1 preservado: unique_violation handler con NULL guard.';
