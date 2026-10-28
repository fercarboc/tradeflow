
-- ══════════════════════════════════════════════════════════════════════════════
-- TX-RECURRING-F1 — Plantillas de rutas recurrentes (ruta escolar / trabajadores)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Tablas nuevas:
--   trade_transport_schedules            — plantilla maestra (regla + recursos habituales)
--   trade_transport_schedule_exceptions  — excepciones por fecha y sentido
--   trade_transport_occurrence_links     — enlace plantilla ↔ servicio materializado
--   trade_transport_stop_favorites       — paradas reutilizables de la organización
--
-- Extensión de trade_transport_services:
--   + schedule_id, schedule_fecha, schedule_sentido (nullable → no rompe servicios puntuales)
--
-- RPC:
--   materialize_transport_occurrence — 10 pasos atómicos, idempotente, SECURITY DEFINER
--
-- INVARIANTES:
--   · Ningún servicio puntual existente se modifica.
--   · Los partes cerrados (completado) están protegidos por el trigger existente.
--   · Nunca se materializan servicios sobre rutas suspendidas (no_circula / suspendido).
--   · La materialización siempre deja el servicio en estado 'borrador'; el operador
--     confirma explícitamente mediante confirm_transport_service.
--   · Idempotencia garantizada por UNIQUE(schedule_id, fecha, sentido) en occurrence_links.
--   · Zona horaria explícita (IANA) almacenada en la plantilla; cálculo de timestamptz
--     con AT TIME ZONE para soporte de horario de verano y turnos de medianoche.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Prerrequisito: UNIQUE(org_id, id) en trade_transport_schedules ────────────
-- Necesario para FK compuestas desde exceptions y occurrence_links,
-- garantizando aislamiento multitenant sin depender solo de filtros en app.
-- (Se añade después de CREATE TABLE más abajo con DO $$ ... $$)


-- ════════════════════════════════════════════════════════════════════════════
-- 1. TABLA: trade_transport_schedules
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_transport_schedules (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,

  -- Identidad
  nombre                text        NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 200),
  tipo_servicio         text        NOT NULL DEFAULT 'ruta_escolar'
                                    CHECK (tipo_servicio IN (
                                      'ruta_escolar','excursion','traslado_privado',
                                      'aeropuerto','otro','traslado_empresa','circuito',
                                      'viaje_multidia','transporte_trabajadores','lanzadera',
                                      'congreso_evento','servicio_deportivo','asociacion_grupo'
                                    )),
  estado                text        NOT NULL DEFAULT 'borrador'
                                    CHECK (estado IN ('borrador','activo','pausado','finalizado')),
  client_id             uuid,

  -- Período de vigencia
  periodo_inicio        date        NOT NULL,
  periodo_fin           date,
  CONSTRAINT ttsch_periodo_check CHECK (periodo_fin IS NULL OR periodo_fin >= periodo_inicio),

  -- Cadencia semanal: enteros ISO-8601 (1=lunes … 7=domingo), sin duplicados
  dias_semana           smallint[]  NOT NULL,
  CONSTRAINT ttsch_dias_nonempty CHECK (array_length(dias_semana, 1) BETWEEN 1 AND 7),

  -- Zona horaria IANA (default: Spain peninsular, cubre DST automáticamente)
  timezone              text        NOT NULL DEFAULT 'Europe/Madrid',

  -- ── Ida (siempre presente) ─────────────────────────────────────────────
  hora_salida_ida       time        NOT NULL,
  hora_llegada_ida      time,
  origen_ida            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  destino_ida           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  paradas_ida           jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- ── Vuelta (opcional) ─────────────────────────────────────────────────
  vuelta_habilitada     boolean     NOT NULL DEFAULT false,
  hora_salida_vuelta    time,
  hora_llegada_vuelta   time,
  paradas_vuelta        jsonb       NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT ttsch_vuelta_hora_check CHECK (
    NOT vuelta_habilitada OR hora_salida_vuelta IS NOT NULL
  ),

  -- Capacidad habitual
  num_viajeros          smallint    CHECK (num_viajeros IS NULL OR num_viajeros > 0),

  -- Recursos habituales (nullable: se puede materializar sin asignarlos)
  vehicle_id            uuid,
  conductor_id          uuid,

  -- Precio de referencia (informativo)
  precio_referencia     numeric(10,2) CHECK (precio_referencia IS NULL OR precio_referencia >= 0),

  observaciones         text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- FK compuestas: garantiza same-org aunque el usuario sea owner de varias orgs
  CONSTRAINT ttsch_client_org_fk FOREIGN KEY (org_id, client_id)
    REFERENCES public.trade_clients(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttsch_vehicle_org_fk FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttsch_conductor_org_fk FOREIGN KEY (org_id, conductor_id)
    REFERENCES public.trade_workers(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED
);

-- UNIQUE(org_id, id) para FK compuestas desde hijas
DO $$ BEGIN
  ALTER TABLE public.trade_transport_schedules
    ADD CONSTRAINT trade_transport_schedules_org_id_id_key UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ttsch_org
  ON public.trade_transport_schedules(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_ttsch_tipo
  ON public.trade_transport_schedules(org_id, tipo_servicio) WHERE estado = 'activo';
CREATE INDEX IF NOT EXISTS idx_ttsch_periodo
  ON public.trade_transport_schedules(periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_ttsch_vehicle
  ON public.trade_transport_schedules(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ttsch_conductor
  ON public.trade_transport_schedules(conductor_id) WHERE conductor_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_ttsch_updated
  BEFORE UPDATE ON public.trade_transport_schedules
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- 2. TABLA: trade_transport_schedule_exceptions
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_transport_schedule_exceptions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- org_id denormalizado para RLS eficiente (siempre = schedule.org_id)
  org_id      uuid        NOT NULL,
  schedule_id uuid        NOT NULL,
  fecha       date        NOT NULL,
  -- 'unico' para rutas sin vuelta; 'ida'/'vuelta' para ida+vuelta
  sentido     text        NOT NULL DEFAULT 'unico'
              CHECK (sentido IN ('ida','vuelta','unico')),
  tipo        text        NOT NULL
              CHECK (tipo IN (
                'no_circula','suspendido',
                'cambio_horario','cambio_conductor',
                'cambio_vehiculo','cambio_itinerario'
              )),
  -- Overrides JSONB: validados por trigger _validate_schedule_exception_overrides
  -- Claves permitidas según tipo:
  --   cambio_horario:     hora_salida, hora_llegada
  --   cambio_conductor:   conductor_id
  --   cambio_vehiculo:    vehicle_id
  --   cambio_itinerario:  hora_salida, hora_llegada, paradas, origen, destino
  --   no_circula/suspendido: {} vacío
  -- Claves prohibidas: org_id, id, schedule_id, fecha, sentido, tipo, created_at
  overrides   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  motivo      text,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Una sola excepción por (plantilla, fecha, sentido)
  UNIQUE (schedule_id, fecha, sentido),

  -- FK compuesta: garantiza que la excepción pertenece a la misma org que la plantilla
  CONSTRAINT ttse_schedule_org_fk FOREIGN KEY (org_id, schedule_id)
    REFERENCES public.trade_transport_schedules(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ttse_schedule_fecha
  ON public.trade_transport_schedule_exceptions(schedule_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ttse_org
  ON public.trade_transport_schedule_exceptions(org_id, fecha);

-- ── Trigger: validación de overrides JSONB ──────────────────────────────────
-- Garantiza a nivel de DB que overrides no inyecte columnas de seguridad
-- (org_id, id, schedule_id, …) y que las claves sean coherentes con el tipo.

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

CREATE TRIGGER trg_ttse_validate_overrides
  BEFORE INSERT OR UPDATE OF overrides, tipo ON public.trade_transport_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public._validate_schedule_exception_overrides();

-- ── Trigger: org_id consistente con la plantilla ─────────────────────────────

CREATE OR REPLACE FUNCTION public._validate_schedule_exception_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verifica que org_id en la excepción coincide con org_id en la plantilla
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_transport_schedules
     WHERE id = NEW.schedule_id AND org_id = NEW.org_id
  ) THEN
    RAISE EXCEPTION
      'SCHEDULE_EXCEPTION_INVALID: org_id (%) no coincide con el org_id de la plantilla (schedule_id: %)',
      NEW.org_id, NEW.schedule_id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_schedule_exception_org() FROM PUBLIC;

CREATE TRIGGER trg_ttse_validate_org
  BEFORE INSERT OR UPDATE OF org_id, schedule_id ON public.trade_transport_schedule_exceptions
  FOR EACH ROW EXECUTE FUNCTION public._validate_schedule_exception_org();


-- ════════════════════════════════════════════════════════════════════════════
-- 3. TABLA: trade_transport_occurrence_links
-- ════════════════════════════════════════════════════════════════════════════
-- Puente entre la plantilla y el servicio materializado.
-- UNIQUE(schedule_id, fecha, sentido) es el mecanismo de idempotencia.
-- ON DELETE CASCADE en service_id: si se elimina el servicio, se puede volver a
-- materializar. ON DELETE RESTRICT en schedule_id: no se puede eliminar la
-- plantilla si tiene servicios materializados.

CREATE TABLE IF NOT EXISTS public.trade_transport_occurrence_links (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL,
  schedule_id uuid        NOT NULL,
  service_id  uuid        NOT NULL REFERENCES public.trade_transport_services(id) ON DELETE CASCADE,
  fecha       date        NOT NULL,
  sentido     text        NOT NULL CHECK (sentido IN ('ida','vuelta','unico')),
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Fence de idempotencia: nunca dos servicios para la misma ocurrencia
  UNIQUE (schedule_id, fecha, sentido),

  -- FK compuesta: garantiza que el enlace pertenece a la misma org que la plantilla
  CONSTRAINT ttol_schedule_org_fk FOREIGN KEY (org_id, schedule_id)
    REFERENCES public.trade_transport_schedules(org_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_ttol_schedule_fecha
  ON public.trade_transport_occurrence_links(schedule_id, fecha);
CREATE INDEX IF NOT EXISTS idx_ttol_service
  ON public.trade_transport_occurrence_links(service_id);
CREATE INDEX IF NOT EXISTS idx_ttol_org_fecha
  ON public.trade_transport_occurrence_links(org_id, fecha);


-- ════════════════════════════════════════════════════════════════════════════
-- 4. TABLA: trade_transport_stop_favorites
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_transport_stop_favorites (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre      text        NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 150),
  tipo_lugar  text        CHECK (tipo_lugar IS NULL OR tipo_lugar IN (
                            'hotel','aeropuerto','estacion','colegio','asociacion',
                            'empresa','domicilio','recinto_deportivo','aparcamiento','otro'
                          )),
  -- location: estructura TransportLocation serializada en JSONB
  location    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  activo      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ttsf_org
  ON public.trade_transport_stop_favorites(org_id, activo);

CREATE OR REPLACE TRIGGER trg_ttsf_updated
  BEFORE UPDATE ON public.trade_transport_stop_favorites
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- 5. EXTENSIÓN: trade_transport_services (schedule backlink)
-- ════════════════════════════════════════════════════════════════════════════
-- Columnas nullable: no rompen servicios puntuales ni partes cerrados existentes.
-- schedule_sentido: CHECK independiente del CHECK en occurrence_links para
-- mantener coherencia incluso sin el enlace (borrado en cascada del enlace).

ALTER TABLE public.trade_transport_services
  ADD COLUMN IF NOT EXISTS schedule_id      uuid
    REFERENCES public.trade_transport_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS schedule_fecha   date,
  ADD COLUMN IF NOT EXISTS schedule_sentido text
    CHECK (schedule_sentido IS NULL OR schedule_sentido IN ('ida','vuelta','unico'));

-- Índice parcial: acelera la vista de servicios asociados a una plantilla
CREATE INDEX IF NOT EXISTS idx_tts_schedule
  ON public.trade_transport_services(schedule_id, schedule_fecha)
  WHERE schedule_id IS NOT NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS — trade_transport_schedules
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttsch_select" ON public.trade_transport_schedules
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

CREATE POLICY "ttsch_insert" ON public.trade_transport_schedules
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttsch_update" ON public.trade_transport_schedules
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttsch_delete" ON public.trade_transport_schedules
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 7. RLS — trade_transport_schedule_exceptions
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_schedule_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttse_select" ON public.trade_transport_schedule_exceptions
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

CREATE POLICY "ttse_insert" ON public.trade_transport_schedule_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttse_update" ON public.trade_transport_schedule_exceptions
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttse_delete" ON public.trade_transport_schedule_exceptions
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS — trade_transport_occurrence_links
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_occurrence_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttol_select" ON public.trade_transport_occurrence_links
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

CREATE POLICY "ttol_insert" ON public.trade_transport_occurrence_links
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttol_delete" ON public.trade_transport_occurrence_links
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 9. RLS — trade_transport_stop_favorites
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_stop_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ttsf_select" ON public.trade_transport_stop_favorites
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

CREATE POLICY "ttsf_insert" ON public.trade_transport_stop_favorites
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttsf_update" ON public.trade_transport_stop_favorites
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

CREATE POLICY "ttsf_delete" ON public.trade_transport_stop_favorites
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 10. RPC: materialize_transport_occurrence
-- ════════════════════════════════════════════════════════════════════════════
--
-- Materializa una ocurrencia de una plantilla recurrente en un servicio puntual.
-- Proceso de 10 pasos, atómico, idempotente.
--
-- Parámetros:
--   p_org_id      — organización del operador
--   p_schedule_id — ID de la plantilla
--   p_fecha       — fecha local de la ocurrencia (date, YYYY-MM-DD)
--   p_sentido     — 'ida' | 'vuelta' | 'unico'
--
-- Respuesta exitosa:
--   { ok: true,  idempotent: false, service_id: uuid }
--   { ok: true,  idempotent: true,  service_id: uuid }  — ya existía
-- Respuesta de error:
--   { ok: false, error: "TRANSPORT_XXX: descripción" }
--
-- NOTA: el servicio se crea siempre en estado 'borrador'. El operador debe
-- llamar a confirm_transport_service para que los EXCLUDE constraints de
-- solapamiento sean evaluados.

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
  -- Verifica que el usuario sea owner o admin de p_org_id
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

  -- Carga plantilla
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

  -- EXTRACT(isodow) devuelve 1 (lunes) … 7 (domingo) para cualquier fecha
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

  -- Rutas sin vuelta usan sentido 'unico'; rutas ida+vuelta usan 'ida' o 'vuelta'
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
    v_origen       := v_schedule.destino_ida;   -- vuelta: origen = destino de ida
    v_destino      := v_schedule.origen_ida;    -- vuelta: destino = origen de ida
  ELSE
    v_hora_salida  := v_schedule.hora_salida_ida;
    v_hora_llegada := v_schedule.hora_llegada_ida;
    v_paradas      := v_schedule.paradas_ida;
    v_origen       := v_schedule.origen_ida;
    v_destino      := v_schedule.destino_ida;
  END IF;

  -- Aplicar overrides de excepción en hora/itinerario
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

  -- Construir timestamptz: combinamos fecha + hora interpretada en la TZ de la plantilla.
  -- AT TIME ZONE convierte timestamp local → timestamptz, gestionando el DST.
  v_fecha_inicio := (p_fecha::text || ' ' || v_hora_salida::text)::timestamp
                    AT TIME ZONE v_tz;

  IF v_hora_llegada IS NOT NULL THEN
    -- Turno de medianoche: si llegada ≤ salida, la llegada es al día siguiente
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
  -- La cláusula UNIQUE en trade_transport_occurrence_links es la red de seguridad
  -- para concurrencia real (dos sesiones simultáneas). Aquí hacemos la
  -- comprobación optimista previa para no llegar al INSERT si ya existe.
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
  -- Título legible: "Nombre plantilla — DD/MM/AAAA (ida/vuelta)"
  v_titulo := v_schedule.nombre
    || ' — ' || to_char(p_fecha, 'DD/MM/YYYY')
    || CASE p_sentido
         WHEN 'ida'    THEN ' (ida)'
         WHEN 'vuelta' THEN ' (vuelta)'
         ELSE ''
       END;

  -- Extrae texto representativo para origin/destino (trade_transport_services usa text)
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
    'borrador',          -- El operador confirma explícitamente; no autoconfirmar
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
    -- Recuperar el service_id del enlace existente y devolver éxito idempotente.
    SELECT service_id INTO v_link_service_id
      FROM public.trade_transport_occurrence_links
     WHERE schedule_id = p_schedule_id AND fecha = p_fecha AND sentido = p_sentido;
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

-- ── Comentario funcional del RPC ────────────────────────────────────────────
COMMENT ON FUNCTION public.materialize_transport_occurrence(uuid, uuid, date, text) IS
  'TX-RECURRING-F1: Materializa una ocurrencia de plantilla recurrente en un servicio '
  'puntual. Atómico, idempotente vía UNIQUE(schedule_id, fecha, sentido). '
  'Devuelve {ok, idempotent, service_id} o {ok:false, error}.';
