
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-RECURRING-F2 — Proyección de ocurrencias por calendario
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Introduce la función get_transport_schedule_projection, una RPC de solo
-- lectura que calcula las ocurrencias esperadas de una plantilla recurrente
-- para un rango de fechas, aplica las excepciones correspondientes y señala
-- cuáles ya han sido materializadas.
--
-- Esta función es la base para:
--   · Mostrar en Agenda los viajes pendientes sin duplicar los materializados.
--   · Proyectar la carga de trabajo futura (semana, mes, período).
--   · Permitir al operador ver de un vistazo qué servicios necesitan confirmarse.
--
-- PURAMENTE DE LECTURA — no realiza ningún INSERT, UPDATE ni DELETE.
-- SIN CAMBIOS: tablas Fleet-2A, Stripe, VeriFactu, facturación.
-- DEPENDENCIAS: requiere migraciones F1 (120000–160000) aplicadas.
-- ══════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════
-- Tipo de retorno compuesto
-- ════════════════════════════════════════════════════════════════════════════

CREATE TYPE public.transport_projection_row AS (
  fecha               date,
  sentido             text,        -- 'ida' | 'vuelta' | 'unico'
  status              text,        -- 'pending' | 'materialized' | 'suspended' | 'no_circula'
  service_id          uuid,        -- null si status = 'pending' | 'suspended' | 'no_circula'
  exception_tipo      text,        -- null si no hay excepción
  exception_motivo    text,        -- null si no hay motivo registrado
  hora_salida         time,        -- efectiva (tras aplicar excepción)
  hora_llegada        time,        -- efectiva (puede ser null)
  conductor_id        uuid,        -- efectivo (puede ser null)
  vehicle_id          uuid,        -- efectivo (puede ser null)
  origen              jsonb,       -- efectivo
  destino             jsonb        -- efectivo
);

COMMENT ON TYPE public.transport_projection_row IS
  'Fila de resultado de get_transport_schedule_projection. '
  'Representa una ocurrencia esperada (ida o vuelta) para una fecha concreta. '
  'status: pending=no materializado, materialized=tiene service_id, '
  'suspended=excepción suspende/cancela, no_circula=excepción no_circula.';


-- ════════════════════════════════════════════════════════════════════════════
-- RPC get_transport_schedule_projection
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_transport_schedule_projection(
  p_org_id      uuid,
  p_schedule_id uuid,
  p_desde       date,
  p_hasta       date
)
RETURNS SETOF public.transport_projection_row
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid       uuid;
  v_schedule  public.trade_transport_schedules;
  v_fecha     date;
  v_sentidos  text[];
  v_sentido   text;
  v_exception public.trade_transport_schedule_exceptions;
  v_has_exc   boolean;
  v_link_sid  uuid;
  v_row       public.transport_projection_row;
BEGIN
  -- ── PASO 1: Autenticación ─────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_AUTH: autenticación requerida';
  END IF;

  -- ── PASO 2: Autorización ──────────────────────────────────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND owner_id = v_uid
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id AND user_id = v_uid AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: no autorizado para esta organización';
  END IF;

  -- ── PASO 3: Cargar plantilla ──────────────────────────────────────────
  SELECT * INTO v_schedule
    FROM public.trade_transport_schedules
   WHERE id = p_schedule_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: plantilla no encontrada en esta organización';
  END IF;

  -- ── PASO 4: Validar rango ─────────────────────────────────────────────
  IF p_desde > p_hasta THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: p_desde (%) es posterior a p_hasta (%)', p_desde, p_hasta;
  END IF;

  IF p_hasta - p_desde > 366 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: el rango solicitado supera 366 días; consulta en períodos más cortos';
  END IF;

  -- ── PASO 5: Iterar días ───────────────────────────────────────────────
  FOR v_fecha IN
    SELECT d::date
      FROM generate_series(
        GREATEST(p_desde, v_schedule.periodo_inicio),
        LEAST(
          p_hasta,
          COALESCE(v_schedule.periodo_fin, p_hasta)
        ),
        '1 day'::interval
      ) AS d
  LOOP
    -- Solo días de circulación de la plantilla
    CONTINUE WHEN NOT (
      EXTRACT(isodow FROM v_fecha)::smallint = ANY(v_schedule.dias_semana)
    );

    -- Determinar sentidos a emitir
    IF v_schedule.vuelta_habilitada THEN
      v_sentidos := ARRAY['ida', 'vuelta'];
    ELSE
      v_sentidos := ARRAY['unico'];
    END IF;

    FOREACH v_sentido IN ARRAY v_sentidos LOOP
      -- Inicializar fila
      v_row.fecha        := v_fecha;
      v_row.sentido      := v_sentido;
      v_row.service_id   := NULL;
      v_row.exception_tipo   := NULL;
      v_row.exception_motivo := NULL;

      -- Campos efectivos (base)
      IF v_sentido = 'vuelta' THEN
        v_row.hora_salida  := v_schedule.hora_salida_vuelta;
        v_row.hora_llegada := v_schedule.hora_llegada_vuelta;
        v_row.origen       := v_schedule.destino_ida;
        v_row.destino      := v_schedule.origen_ida;
      ELSE
        v_row.hora_salida  := v_schedule.hora_salida_ida;
        v_row.hora_llegada := v_schedule.hora_llegada_ida;
        v_row.origen       := v_schedule.origen_ida;
        v_row.destino      := v_schedule.destino_ida;
      END IF;
      v_row.conductor_id := v_schedule.conductor_id;
      v_row.vehicle_id   := v_schedule.vehicle_id;

      -- ── Buscar excepción ─────────────────────────────────────────────
      SELECT * INTO v_exception
        FROM public.trade_transport_schedule_exceptions
       WHERE schedule_id = p_schedule_id AND fecha = v_fecha AND sentido = v_sentido;
      v_has_exc := FOUND;

      IF v_has_exc THEN
        v_row.exception_tipo   := v_exception.tipo;
        v_row.exception_motivo := v_exception.motivo;

        -- Excepciones que cancelan el servicio
        IF v_exception.tipo = 'no_circula' THEN
          v_row.status := 'no_circula';
          RETURN NEXT v_row;
          CONTINUE;
        ELSIF v_exception.tipo = 'suspendido' THEN
          v_row.status := 'suspended';
          RETURN NEXT v_row;
          CONTINUE;
        END IF;

        -- Aplicar overrides de horario/itinerario/modificado
        IF v_exception.tipo IN ('cambio_horario', 'cambio_itinerario', 'modificado') THEN
          IF v_exception.overrides ? 'hora_salida' THEN
            v_row.hora_salida := (v_exception.overrides->>'hora_salida')::time;
          END IF;
          IF v_exception.overrides ? 'hora_llegada' THEN
            v_row.hora_llegada := (v_exception.overrides->>'hora_llegada')::time;
          END IF;
          IF v_exception.overrides ? 'origen' THEN
            v_row.origen := v_exception.overrides->'origen';
          END IF;
          IF v_exception.overrides ? 'destino' THEN
            v_row.destino := v_exception.overrides->'destino';
          END IF;
        END IF;

        -- Aplicar overrides de conductor/vehículo
        IF v_exception.tipo = 'cambio_conductor' AND v_exception.overrides ? 'conductor_id' THEN
          v_row.conductor_id := (v_exception.overrides->>'conductor_id')::uuid;
        ELSIF v_exception.tipo = 'cambio_vehiculo' AND v_exception.overrides ? 'vehicle_id' THEN
          v_row.vehicle_id := (v_exception.overrides->>'vehicle_id')::uuid;
        ELSIF v_exception.tipo = 'modificado' THEN
          IF v_exception.overrides ? 'conductor_id' THEN
            v_row.conductor_id := (v_exception.overrides->>'conductor_id')::uuid;
          END IF;
          IF v_exception.overrides ? 'vehicle_id' THEN
            v_row.vehicle_id := (v_exception.overrides->>'vehicle_id')::uuid;
          END IF;
        END IF;
      END IF;

      -- ── Verificar materialización ────────────────────────────────────
      SELECT service_id INTO v_link_sid
        FROM public.trade_transport_occurrence_links
       WHERE schedule_id = p_schedule_id AND fecha = v_fecha AND sentido = v_sentido;

      IF FOUND THEN
        v_row.status     := 'materialized';
        v_row.service_id := v_link_sid;
      ELSE
        v_row.status := 'pending';
      END IF;

      RETURN NEXT v_row;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.get_transport_schedule_projection(uuid, uuid, date, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_transport_schedule_projection(uuid, uuid, date, date)
  TO authenticated;

COMMENT ON FUNCTION public.get_transport_schedule_projection(uuid, uuid, date, date) IS
  'TX-RECURRING-F2: proyecta ocurrencias esperadas de una plantilla recurrente '
  'para el rango [p_desde, p_hasta] (máx. 366 días). '
  'Aplica excepciones (overrides horario/itinerario/conductor/vehículo; '
  'cancela si no_circula o suspendido). '
  'Señala cada ocurrencia como pending, materialized, suspended o no_circula. '
  'Solo lectura — no escribe nada. Base para Agenda y carga de trabajo.';
