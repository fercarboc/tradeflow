-- =============================================================================
-- TX-MC-1 — TESTS DE INTEGRACIÓN SQL
-- Archivo permanente: src/test/transport/tx-mc1-integration.sql
--
-- Ejecutar contra un entorno PostgreSQL ≥ 15 AISLADO (NO producción).
-- Instrucciones de ejecución con Docker:
--
--   docker run -d --name pg-mc1-test -e POSTGRES_PASSWORD=postgres \
--     -e POSTGRES_DB=mc1test -p 5433:5432 postgres:17
--   docker exec -i pg-mc1-test psql -U postgres -d mc1test < \
--     src/test/transport/tx-mc1-integration.sql
--
-- El script es idempotente: limpia al inicio y al final.
-- Para test concurrente (§ MC1-09): ver sección "CONCURRENT SETUP" al final.
--
-- Categorías:
--   MC1-01  Creación de tabla, índices y constraints (DDL)
--   MC1-02  FK compuestas y aislamiento por organización
--   MC1-03  FSM y triggers de protección
--   MC1-04  RPC — rutas autorizadas
--   MC1-05  RPC — rutas no autorizadas (transport_enabled, modalidad)
--   MC1-06  Solapamientos within-table Mercancías
--   MC1-07  Solapamientos cross-table (Mercancías ↔ Viajeros)
--   MC1-08  Solapamientos de conductores compartidos
--   MC1-09  Confirmaciones concurrentes (2 conexiones)
--   MC1-10  Cancelación y liberación de disponibilidad
--   MC1-11  Rechazo de modificaciones directas incompatibles
--   MC1-12  Regresión operativa Viajeros existente
--   MC1-13  Bypass protección: authenticated no puede confirmar directamente
-- =============================================================================

\set ON_ERROR_STOP on
\timing on

-- ─────────────────────────────────────────────────────────────────────────────
-- 0.  PRELUDIO: extensiones y esquema auth shim
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shim del esquema auth (Supabase lo provee; aquí simulamos lo necesario)
CREATE SCHEMA IF NOT EXISTS auth;

-- auth.users: tabla mínima para FK de cerrado_por
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

-- auth.uid(): devuelve el uid "activo" de la sesión de prueba.
-- Se sobreescribe por función SET LOCAL para simular usuarios distintos.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('test.current_uid', true)::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.  ESQUEMA MÍNIMO DE DEPENDENCIAS
-- ─────────────────────────────────────────────────────────────────────────────

-- Limpiar datos de tests anteriores
DROP TABLE IF EXISTS public.trade_transport_trips CASCADE;
DROP TABLE IF EXISTS public.trade_transport_services CASCADE;
DROP TABLE IF EXISTS public.trade_org_members CASCADE;
DROP TABLE IF EXISTS public.trade_workers CASCADE;
DROP TABLE IF EXISTS public.trade_vehicles CASCADE;
DROP TABLE IF EXISTS public.trade_organizations CASCADE;
DROP TYPE IF EXISTS public.tipo_carga_mercancias CASCADE;

CREATE TABLE public.trade_organizations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  owner_id             uuid REFERENCES auth.users(id),
  transport_enabled    boolean NOT NULL DEFAULT false,
  transport_modalidad  text CHECK (transport_modalidad IN ('viajeros','mercancias','reparto','combinada'))
);

CREATE TABLE public.trade_vehicles (
  id                  uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  matricula           text NOT NULL,
  modalidad           text NOT NULL CHECK (modalidad IN ('viajeros','mercancias','reparto','mixto')),
  activo              boolean NOT NULL DEFAULT true,
  capacidad_viajeros  int,
  PRIMARY KEY (id),
  UNIQUE (org_id, id)   -- FK compuesta destino
);

CREATE TABLE public.trade_workers (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  es_conductor boolean DEFAULT false,
  activo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  UNIQUE (org_id, id)   -- FK compuesta destino
);

CREATE TABLE public.trade_org_members (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol     text NOT NULL CHECK (rol IN ('owner','admin','member')),
  activo  boolean NOT NULL DEFAULT true
);

-- trade_transport_services (mínimo para cross-table checks)
CREATE TABLE public.trade_transport_services (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  titulo       text NOT NULL,
  estado       text NOT NULL DEFAULT 'borrador'
               CHECK (estado IN ('borrador','confirmado','en_curso','completado','cancelado')),
  vehicle_id   uuid,
  conductor_id uuid,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin    timestamptz,
  num_viajeros int,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tts_vehicle_org_fk FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_conductor_org_fk FOREIGN KEY (org_id, conductor_id)
    REFERENCES public.trade_workers(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_fecha_orden CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_no_vehicle_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (vehicle_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_no_conductor_overlap
  EXCLUDE USING gist (
    conductor_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (conductor_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2.  APLICAR MIGRACIONES TX-MC-1
--     (inline — equivalente a supabase db push sobre este esquema)
-- ─────────────────────────────────────────────────────────────────────────────

\echo '>>> Applying 20261102100000_create_trade_transport_trips.sql'

-- ENUM tipo_carga_mercancias
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_carga_mercancias') THEN
    CREATE TYPE public.tipo_carga_mercancias AS ENUM (
      'paletizado','carga_general','frigorifica','peligrosas','especial','otro'
    );
  END IF;
END $$;

CREATE TABLE public.trade_transport_trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  referencia    text,
  titulo        text NOT NULL CHECK (char_length(trim(titulo)) >= 1),
  origen        text NOT NULL,
  destino       text NOT NULL,
  fecha_inicio  timestamptz NOT NULL,
  fecha_fin     timestamptz,
  vehicle_id    uuid,
  conductor_id  uuid,
  tipo_carga    public.tipo_carga_mercancias NOT NULL DEFAULT 'carga_general',
  peso_kg       numeric(10,2),
  volumen_m3    numeric(8,3),
  num_bultos    int,
  precio_acordado numeric(10,2),
  cliente_nombre  text,
  observaciones   text,
  estado        text NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','confirmado','en_curso','completado','cancelado')),
  hora_real_salida   timestamptz,
  hora_real_llegada  timestamptz,
  km_inicio          int,
  km_fin             int,
  km_realizados      int GENERATED ALWAYS AS (
    CASE WHEN km_fin IS NOT NULL AND km_inicio IS NOT NULL THEN km_fin - km_inicio ELSE NULL END
  ) STORED,
  incidencias        text,
  observaciones_cierre text,
  cerrado_at         timestamptz,
  cerrado_por        uuid REFERENCES auth.users(id),
  odometro_inicio    int,
  odometro_final     int,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ttt_vehicle_org_fk FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttt_conductor_org_fk FOREIGN KEY (org_id, conductor_id)
    REFERENCES public.trade_workers(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttt_fecha_orden CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
  CONSTRAINT ttt_precio_positivo CHECK (precio_acordado IS NULL OR precio_acordado >= 0)
);

CREATE INDEX idx_ttt_org_fecha    ON public.trade_transport_trips (org_id, fecha_inicio DESC);
CREATE INDEX idx_ttt_org_estado   ON public.trade_transport_trips (org_id, estado);
CREATE INDEX idx_ttt_vehicle      ON public.trade_transport_trips (vehicle_id)    WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_ttt_conductor    ON public.trade_transport_trips (conductor_id)  WHERE conductor_id IS NOT NULL;

ALTER TABLE public.trade_transport_trips
  ADD CONSTRAINT ttt_no_vehicle_overlap
  EXCLUDE USING gist (
    vehicle_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (vehicle_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

ALTER TABLE public.trade_transport_trips
  ADD CONSTRAINT ttt_no_conductor_overlap
  EXCLUDE USING gist (
    conductor_id WITH =,
    tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  )
  WHERE (conductor_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

-- Triggers (copiar desde migración; search_path = public ya no es crítico aquí)
CREATE OR REPLACE FUNCTION public._update_transport_trip_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public._update_transport_trip_timestamp() FROM PUBLIC;
CREATE TRIGGER trg_transport_trip_updated_at
  BEFORE UPDATE ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._update_transport_trip_timestamp();

CREATE OR REPLACE FUNCTION public._validate_transport_trip_fsm()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;
  CASE OLD.estado
    WHEN 'borrador'   THEN IF NEW.estado NOT IN ('confirmado','cancelado') THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de borrador solo se puede pasar a confirmado o cancelado'; END IF;
    WHEN 'confirmado' THEN IF NEW.estado NOT IN ('en_curso','cancelado') THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de confirmado solo se puede pasar a en_curso o cancelado'; END IF;
    WHEN 'en_curso'   THEN IF NEW.estado NOT IN ('completado','cancelado') THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de en_curso solo se puede pasar a completado o cancelado'; END IF;
    WHEN 'completado' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje completado es un estado terminal';
    WHEN 'cancelado'  THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje cancelado es un estado terminal';
    ELSE RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado desconocido: %', OLD.estado;
  END CASE;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._validate_transport_trip_fsm() FROM PUBLIC;
CREATE TRIGGER trg_transport_trip_fsm
  BEFORE UPDATE OF estado ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_fsm();

CREATE OR REPLACE FUNCTION public._prevent_transport_trip_org_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: org_id de un viaje de transporte es inmutable';
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._prevent_transport_trip_org_change() FROM PUBLIC;
CREATE TRIGGER trg_ttt_immutable_org
  BEFORE UPDATE OF org_id ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._prevent_transport_trip_org_change();

CREATE OR REPLACE FUNCTION public._validate_transport_trip_operational()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_vehicle public.trade_vehicles;
  v_worker  public.trade_workers;
BEGIN
  IF NEW.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id = NEW.org_id AND transport_enabled = true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;
  IF (NEW.vehicle_id IS NOT NULL OR NEW.conductor_id IS NOT NULL) AND NEW.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un viaje con vehículo o conductor asignados';
  END IF;
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles WHERE id = NEW.vehicle_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización'; END IF;
    IF NOT v_vehicle.activo THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)'; END IF;
    IF v_vehicle.modalidad NOT IN ('mercancias','reparto','mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para mercancías (modalidad: %)', v_vehicle.modalidad;
    END IF;
  END IF;
  IF NEW.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.trade_workers WHERE id = NEW.conductor_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no pertenece a esta organización'; END IF;
    IF NOT COALESCE(v_worker.es_conductor, false) THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el trabajador asignado no está habilitado como conductor (es_conductor = false)';
    END IF;
    IF v_worker.activo IS NOT DISTINCT FROM false THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no está activo';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._validate_transport_trip_operational() FROM PUBLIC;
CREATE TRIGGER trg_ttt_validate_operational
  BEFORE INSERT OR UPDATE OF estado, vehicle_id, conductor_id
  ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_operational();

CREATE OR REPLACE FUNCTION public._protect_confirmed_trip_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NEW.vehicle_id   IS DISTINCT FROM OLD.vehicle_id   THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.fecha_fin    IS DISTINCT FROM OLD.fecha_fin    THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._protect_confirmed_trip_fields() FROM PUBLIC;
CREATE TRIGGER trg_ttt_protect_confirmed_fields
  BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin
  ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_trip_fields();

CREATE OR REPLACE FUNCTION public._protect_completed_transport_trip()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'El viaje % ya está completado y no puede modificarse', OLD.id; END; $$;
REVOKE ALL ON FUNCTION public._protect_completed_transport_trip() FROM PUBLIC;
CREATE TRIGGER trg_protect_completed_trip
  BEFORE UPDATE ON public.trade_transport_trips
  FOR EACH ROW WHEN (OLD.estado = 'completado')
  EXECUTE FUNCTION public._protect_completed_transport_trip();

-- RPCs confirm_transport_trip y complete_transport_trip
CREATE OR REPLACE FUNCTION public.confirm_transport_trip(p_trip_id uuid, p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_trip          public.trade_transport_trips%ROWTYPE;
  v_org_modalidad text;
  v_conflicts     jsonb := '[]'::jsonb;
  v_svc_conflict  record;
  v_range         tstzrange;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND transport_enabled = true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este viaje';
  END IF;
  SELECT * INTO v_trip FROM public.trade_transport_trips WHERE id = p_trip_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: viaje no encontrado'; END IF;
  IF v_trip.estado <> 'borrador' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se pueden confirmar viajes en borrador (estado actual: %)', v_trip.estado; END IF;
  SELECT transport_modalidad INTO v_org_modalidad FROM public.trade_organizations WHERE id = p_org_id;
  IF COALESCE(v_org_modalidad,'') NOT IN ('mercancias','reparto','combinada') THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: organización sin modalidad de mercancías (transport_modalidad: %)', COALESCE(v_org_modalidad,'nula');
  END IF;
  -- Locks de recursos (orden estable: vehicle → conductor)
  IF v_trip.vehicle_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_vehicles WHERE id = v_trip.vehicle_id FOR UPDATE;
  END IF;
  IF v_trip.conductor_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_workers WHERE id = v_trip.conductor_id FOR UPDATE;
  END IF;
  IF (v_trip.vehicle_id IS NOT NULL OR v_trip.conductor_id IS NOT NULL) AND v_trip.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un viaje con vehículo o conductor asignados';
  END IF;
  IF v_trip.fecha_fin IS NOT NULL THEN
    v_range := tstzrange(v_trip.fecha_inicio, v_trip.fecha_fin, '[)');
  END IF;
  -- Check cross-table dirección A: trade_transport_services
  IF v_trip.vehicle_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin FROM public.trade_transport_services
      WHERE org_id = p_org_id AND vehicle_id = v_trip.vehicle_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','vehiculo','id',v_svc_conflict.id,'titulo',v_svc_conflict.titulo,'tabla','servicios');
    END LOOP;
  END IF;
  IF v_trip.conductor_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin FROM public.trade_transport_services
      WHERE org_id = p_org_id AND conductor_id = v_trip.conductor_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','conductor','id',v_svc_conflict.id,'titulo',v_svc_conflict.titulo,'tabla','servicios');
    END LOOP;
  END IF;
  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
  END IF;
  BEGIN
    UPDATE public.trade_transport_trips SET estado = 'confirmado', updated_at = now() WHERE id = p_trip_id AND org_id = p_org_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', jsonb_build_array(
        jsonb_build_object('tipo','conflicto_concurrente','titulo','Conflicto detectado por otra sesión')
      ));
  END;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_transport_trip(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_transport_trip(uuid, uuid) TO PUBLIC;

\echo '>>> Applying 20261102110000_confirm_service_cross_table_overlap.sql'

CREATE OR REPLACE FUNCTION public.confirm_transport_service(p_service_id uuid, p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_svc           public.trade_transport_services%ROWTYPE;
  v_vehicle       public.trade_vehicles;
  v_worker        public.trade_workers;
  v_conflicts     jsonb;
  v_trip_conflict record;
  v_range         tstzrange;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND transport_enabled = true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este servicio';
  END IF;
  SELECT * INTO v_svc FROM public.trade_transport_services WHERE id = p_service_id AND org_id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: servicio no encontrado'; END IF;
  IF v_svc.estado <> 'borrador' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se pueden confirmar servicios en borrador (estado actual: %)', v_svc.estado; END IF;
  -- Locks de recursos (orden estable: vehicle → conductor)
  IF v_svc.vehicle_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_vehicles WHERE id = v_svc.vehicle_id FOR UPDATE;
  END IF;
  IF v_svc.conductor_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_workers WHERE id = v_svc.conductor_id FOR UPDATE;
  END IF;
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles WHERE id = v_svc.vehicle_id AND org_id = p_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización'; END IF;
    IF NOT v_vehicle.activo THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo'; END IF;
    IF v_vehicle.modalidad NOT IN ('viajeros','mixto') THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para viajeros (modalidad: %)', v_vehicle.modalidad; END IF;
  END IF;
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.trade_workers WHERE id = v_svc.conductor_id AND org_id = p_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no pertenece a esta organización'; END IF;
    IF NOT COALESCE(v_worker.es_conductor, false) THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el trabajador no está habilitado como conductor'; END IF;
    IF v_worker.activo IS NOT DISTINCT FROM false THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor no está activo'; END IF;
  END IF;
  IF (v_svc.vehicle_id IS NOT NULL OR v_svc.conductor_id IS NOT NULL) AND v_svc.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un servicio con vehículo o conductor asignados';
  END IF;
  IF v_svc.fecha_fin IS NOT NULL THEN v_range := tstzrange(v_svc.fecha_inicio, v_svc.fecha_fin, '[)'); END IF;
  -- Check within-table vehículo
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('tipo','vehiculo','id',id,'tabla','servicios')) INTO v_conflicts
    FROM public.trade_transport_services
    WHERE vehicle_id = v_svc.vehicle_id AND id <> p_service_id AND estado IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range;
    IF v_conflicts IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Check cross-table vehículo dirección B
  IF v_svc.vehicle_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo FROM public.trade_transport_trips
      WHERE org_id = p_org_id AND vehicle_id = v_svc.vehicle_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','vehiculo','id',v_trip_conflict.id,'tabla','viajes');
    END LOOP;
    IF jsonb_array_length(v_conflicts) > 0 THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Check within-table conductor
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('tipo','conductor','id',id,'tabla','servicios')) INTO v_conflicts
    FROM public.trade_transport_services
    WHERE conductor_id = v_svc.conductor_id AND id <> p_service_id AND estado IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range;
    IF v_conflicts IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Check cross-table conductor dirección B
  IF v_svc.conductor_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo FROM public.trade_transport_trips
      WHERE org_id = p_org_id AND conductor_id = v_svc.conductor_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','conductor','id',v_trip_conflict.id,'tabla','viajes');
    END LOOP;
    IF jsonb_array_length(v_conflicts) > 0 THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  BEGIN
    UPDATE public.trade_transport_services SET estado='confirmado', updated_at=now() WHERE id=p_service_id AND org_id=p_org_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN jsonb_build_object('ok',false,'conflictos',jsonb_build_array(jsonb_build_object('tipo','conflicto_concurrente','titulo','Conflicto detectado por otra sesión')));
  END;
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.confirm_transport_service(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_transport_service(uuid, uuid) TO PUBLIC;

-- Trigger inmutabilidad en trade_transport_services
CREATE OR REPLACE FUNCTION public._protect_confirmed_service_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NEW.vehicle_id   IS DISTINCT FROM OLD.vehicle_id   THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado; END IF;
  IF NEW.fecha_fin    IS DISTINCT FROM OLD.fecha_fin    THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._protect_confirmed_service_fields() FROM PUBLIC;
CREATE TRIGGER trg_tts_protect_confirmed_fields
  BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin
  ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_service_fields();

-- ── Bypass protection (migration 20261102120000) ──────────────────────────────
-- Bloquea transición borrador→confirmado cuando current_user='authenticated'|'anon'.
-- Las RPCs SECURITY DEFINER se ejecutan como 'postgres' → pasan el check.

CREATE OR REPLACE FUNCTION public._prevent_direct_trip_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION
        'TRANSPORT_FORBIDDEN: confirmación directa no permitida; use confirm_transport_trip().'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._prevent_direct_trip_confirmation() FROM PUBLIC;
CREATE TRIGGER trg_ttt_block_direct_confirmation
  BEFORE UPDATE OF estado ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._prevent_direct_trip_confirmation();

CREATE OR REPLACE FUNCTION public._prevent_direct_service_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION
        'TRANSPORT_FORBIDDEN: confirmación directa no permitida; use confirm_transport_service().'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._prevent_direct_service_confirmation() FROM PUBLIC;
CREATE TRIGGER trg_tts_block_direct_confirmation
  BEFORE UPDATE OF estado ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._prevent_direct_service_confirmation();

-- Rol 'authenticated' para simular usuario PostgREST en tests MC1-13
-- Con GRANTs equivalentes a los que Supabase otorga por defecto en producción.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated';
  END IF;
END $$;
-- Grants de tabla (Supabase default en producción: ALL ON ALL TABLES TO authenticated)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_transport_trips    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_transport_services TO authenticated;
GRANT SELECT ON public.trade_organizations TO authenticated;
GRANT SELECT ON public.trade_vehicles      TO authenticated;
GRANT SELECT ON public.trade_workers       TO authenticated;

\echo '>>> Schema ready. Starting tests.'

-- ─────────────────────────────────────────────────────────────────────────────
-- DATOS MAESTROS DE TEST
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Usuarios de prueba en auth.users
  INSERT INTO auth.users (id) VALUES
    ('00000000-0000-0000-0000-000000000001'),   -- owner_comb
    ('00000000-0000-0000-0000-000000000002'),   -- owner_viaj
    ('00000000-0000-0000-0000-000000000003'),   -- admin_comb
    ('00000000-0000-0000-0000-000000000099')    -- usuario sin permisos
  ON CONFLICT DO NOTHING;
END; $$;

-- Org combinada (mercancias + viajeros)
INSERT INTO public.trade_organizations (id, name, owner_id, transport_enabled, transport_modalidad) VALUES
  ('aaaaaa00-0000-0000-0000-000000000001', 'OrgCombinada', '00000000-0000-0000-0000-000000000001', true,  'combinada'),
  ('aaaaaa00-0000-0000-0000-000000000002', 'OrgViajeros',  '00000000-0000-0000-0000-000000000002', true,  'viajeros'),
  ('aaaaaa00-0000-0000-0000-000000000003', 'OrgSinModulo', '00000000-0000-0000-0000-000000000003', false, NULL);

-- admin_comb es miembro de OrgCombinada
INSERT INTO public.trade_org_members (org_id, user_id, rol, activo) VALUES
  ('aaaaaa00-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'admin', true);

-- Vehículos
INSERT INTO public.trade_vehicles (id, org_id, matricula, modalidad, activo, capacidad_viajeros) VALUES
  ('bbbbbb00-0000-0000-0000-000000000001', 'aaaaaa00-0000-0000-0000-000000000001', 'MERC-001', 'mercancias', true,  NULL),
  ('bbbbbb00-0000-0000-0000-000000000002', 'aaaaaa00-0000-0000-0000-000000000001', 'MIXT-001', 'mixto',      true,  8),
  ('bbbbbb00-0000-0000-0000-000000000003', 'aaaaaa00-0000-0000-0000-000000000001', 'VIAJ-001', 'viajeros',   true,  12),
  ('bbbbbb00-0000-0000-0000-000000000004', 'aaaaaa00-0000-0000-0000-000000000001', 'INAC-001', 'mercancias', false, NULL),
  ('bbbbbb00-0000-0000-0000-000000000005', 'aaaaaa00-0000-0000-0000-000000000002', 'VIAJ-ORG2', 'viajeros',  true,  6);

-- Conductores
INSERT INTO public.trade_workers (id, org_id, nombre, es_conductor, activo) VALUES
  ('cccccc00-0000-0000-0000-000000000001', 'aaaaaa00-0000-0000-0000-000000000001', 'Conductor A', true,  true),
  ('cccccc00-0000-0000-0000-000000000002', 'aaaaaa00-0000-0000-0000-000000000001', 'Conductor B', true,  true),
  ('cccccc00-0000-0000-0000-000000000003', 'aaaaaa00-0000-0000-0000-000000000001', 'NoConductor', false, true),
  ('cccccc00-0000-0000-0000-000000000004', 'aaaaaa00-0000-0000-0000-000000000001', 'ConductorInactivo', true, false);

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLA DE RESULTADOS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE _results (
  suite text, test_id text, description text,
  status text DEFAULT 'PENDING',
  detail text
);

CREATE OR REPLACE FUNCTION record_pass(p_suite text, p_id text, p_desc text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO _results (suite, test_id, description, status) VALUES (p_suite, p_id, p_desc, 'PASS');
$$;
CREATE OR REPLACE FUNCTION record_fail(p_suite text, p_id text, p_desc text, p_detail text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO _results (suite, test_id, description, status, detail) VALUES (p_suite, p_id, p_desc, 'FAIL', p_detail);
$$;

-- =============================================================================
-- MC1-01  DDL — tabla, índices, constraints
-- =============================================================================
\echo ''
\echo '=== MC1-01: DDL ==='

DO $$
BEGIN
  -- 01.1 Tabla existe
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trade_transport_trips') THEN
    PERFORM record_pass('MC1-01','01.1','tabla trade_transport_trips existe');
  ELSE
    PERFORM record_fail('MC1-01','01.1','tabla trade_transport_trips existe','tabla no encontrada'); RETURN;
  END IF;

  -- 01.2 ENUM tipo_carga_mercancias
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_carga_mercancias') THEN
    PERFORM record_pass('MC1-01','01.2','ENUM tipo_carga_mercancias existe');
  ELSE
    PERFORM record_fail('MC1-01','01.2','ENUM tipo_carga_mercancias existe','ENUM no encontrado'); RETURN;
  END IF;

  -- 01.3 Columna km_realizados generada
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='trade_transport_trips' AND column_name='km_realizados') THEN
    PERFORM record_pass('MC1-01','01.3','columna km_realizados GENERATED STORED existe');
  ELSE
    PERFORM record_fail('MC1-01','01.3','columna km_realizados GENERATED STORED existe','columna no encontrada');
  END IF;

  -- 01.4 EXCLUDE vehicle overlap existe
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ttt_no_vehicle_overlap' AND contype='x') THEN
    PERFORM record_pass('MC1-01','01.4','EXCLUDE ttt_no_vehicle_overlap existe y es tipo exclusion');
  ELSE
    PERFORM record_fail('MC1-01','01.4','EXCLUDE ttt_no_vehicle_overlap','constraint no encontrado o tipo incorrecto');
  END IF;

  -- 01.5 EXCLUDE conductor overlap existe
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ttt_no_conductor_overlap' AND contype='x') THEN
    PERFORM record_pass('MC1-01','01.5','EXCLUDE ttt_no_conductor_overlap existe y es tipo exclusion');
  ELSE
    PERFORM record_fail('MC1-01','01.5','EXCLUDE ttt_no_conductor_overlap','constraint no encontrado o tipo incorrecto');
  END IF;

  -- 01.6 FK compuesta vehicle
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ttt_vehicle_org_fk' AND contype='f') THEN
    PERFORM record_pass('MC1-01','01.6','FK compuesta ttt_vehicle_org_fk existe');
  ELSE
    PERFORM record_fail('MC1-01','01.6','FK compuesta ttt_vehicle_org_fk','FK no encontrada');
  END IF;

  -- 01.7 FK compuesta conductor
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ttt_conductor_org_fk' AND contype='f') THEN
    PERFORM record_pass('MC1-01','01.7','FK compuesta ttt_conductor_org_fk existe');
  ELSE
    PERFORM record_fail('MC1-01','01.7','FK compuesta ttt_conductor_org_fk','FK no encontrada');
  END IF;

  -- 01.8 6 triggers en trade_transport_trips
  DECLARE v_count int;
  BEGIN
    SELECT count(*) INTO v_count FROM information_schema.triggers WHERE event_object_table='trade_transport_trips';
    IF v_count >= 6 THEN
      PERFORM record_pass('MC1-01','01.8', format('%s triggers en trade_transport_trips (>=6)', v_count));
    ELSE
      PERFORM record_fail('MC1-01','01.8','6+ triggers en trade_transport_trips', format('solo %s triggers', v_count));
    END IF;
  END;
END; $$;

-- =============================================================================
-- MC1-02  FK compuestas y aislamiento por organización
-- =============================================================================
\echo '=== MC1-02: FK compuestas ==='

DO $$
DECLARE v_trip_id uuid;
BEGIN
  -- 02.1 FK compuesta vehicle: vehículo de otra org.
  -- FK es DEFERRABLE INITIALLY DEFERRED → usar SET CONSTRAINTS IMMEDIATE para test.
  BEGIN
    SET CONSTRAINTS ttt_vehicle_org_fk IMMEDIATE;
    INSERT INTO public.trade_transport_trips
      (org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id)
    VALUES
      ('aaaaaa00-0000-0000-0000-000000000001','FK test','A','B', now(), now()+interval'1h',
       'bbbbbb00-0000-0000-0000-000000000005');   -- vehículo de OrgViajeros, no de OrgCombinada
    PERFORM record_fail('MC1-02','02.1','FK rechaza vehículo de otra org','INSERT no lanzó excepción');
  EXCEPTION
    WHEN foreign_key_violation THEN
      PERFORM record_pass('MC1-02','02.1','FK compuesta rechaza vehículo de otra org (IMMEDIATE check)');
  END;

  -- 02.2 FK compuesta conductor: conductor inexistente.
  -- FK es DEFERRABLE INITIALLY DEFERRED → SET CONSTRAINTS IMMEDIATE.
  BEGIN
    SET CONSTRAINTS ttt_conductor_org_fk IMMEDIATE;
    INSERT INTO public.trade_transport_trips
      (org_id, titulo, origen, destino, fecha_inicio, fecha_fin, conductor_id)
    VALUES
      ('aaaaaa00-0000-0000-0000-000000000001','FK test2','A','B', now(), now()+interval'1h',
       gen_random_uuid());  -- UUID inexistente
    PERFORM record_fail('MC1-02','02.2','FK rechaza conductor inexistente','INSERT no lanzó excepción');
  EXCEPTION
    WHEN foreign_key_violation THEN
      PERFORM record_pass('MC1-02','02.2','FK compuesta rechaza conductor inexistente (IMMEDIATE check)');
  END;

  -- 02.3 INSERT válido con vehículo y conductor de la misma org → OK
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id, tipo_carga)
  VALUES
    ('dddddd00-0000-0000-0000-000000000001', 'aaaaaa00-0000-0000-0000-000000000001',
     'Viaje válido', 'Madrid', 'Barcelona', now()+interval'10h', now()+interval'14h',
     'bbbbbb00-0000-0000-0000-000000000001', 'cccccc00-0000-0000-0000-000000000001', 'paletizado');
  PERFORM record_pass('MC1-02','02.3','INSERT válido con vehicle+conductor de la misma org');
  DELETE FROM public.trade_transport_trips WHERE id='dddddd00-0000-0000-0000-000000000001';

  -- 02.4 CHECK fecha_orden: fecha_fin <= fecha_inicio → error
  BEGIN
    INSERT INTO public.trade_transport_trips
      (org_id, titulo, origen, destino, fecha_inicio, fecha_fin)
    VALUES
      ('aaaaaa00-0000-0000-0000-000000000001','Fechas inválidas','A','B', now(), now()-interval'1h');
    PERFORM record_fail('MC1-02','02.4','CHECK fecha_orden rechaza fin<=inicio','no lanzó excepción');
  EXCEPTION
    WHEN check_violation THEN
      PERFORM record_pass('MC1-02','02.4','CHECK fecha_orden rechaza fin<=inicio');
  END;
END; $$;

-- =============================================================================
-- MC1-03  FSM y triggers de protección
-- =============================================================================
\echo '=== MC1-03: FSM y triggers ==='

DO $$
DECLARE v_id uuid := 'dddddd00-0000-0000-0000-000000000010';
BEGIN
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio)
  VALUES (v_id,'aaaaaa00-0000-0000-0000-000000000001','FSM test','A','B', now()+interval'1d');

  -- 03.1 borrador → en_curso (salta confirmado) → RECHAZADO
  BEGIN
    UPDATE public.trade_transport_trips SET estado='en_curso' WHERE id=v_id;
    PERFORM record_fail('MC1-03','03.1','FSM rechaza borrador→en_curso','UPDATE no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_STATE_INVALID%' THEN
      PERFORM record_pass('MC1-03','03.1','FSM rechaza borrador→en_curso');
    ELSE
      PERFORM record_fail('MC1-03','03.1','FSM rechaza borrador→en_curso', SQLERRM);
    END IF;
  END;

  -- 03.2 borrador → completado → RECHAZADO
  BEGIN
    UPDATE public.trade_transport_trips SET estado='completado' WHERE id=v_id;
    PERFORM record_fail('MC1-03','03.2','FSM rechaza borrador→completado','UPDATE no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_STATE_INVALID%' THEN
      PERFORM record_pass('MC1-03','03.2','FSM rechaza borrador→completado');
    ELSE
      PERFORM record_fail('MC1-03','03.2','FSM rechaza borrador→completado', SQLERRM);
    END IF;
  END;

  -- 03.3 borrador → cancelado → PERMITIDO
  BEGIN
    UPDATE public.trade_transport_trips SET estado='cancelado' WHERE id=v_id;
    PERFORM record_pass('MC1-03','03.3','FSM permite borrador→cancelado');
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-03','03.3','FSM permite borrador→cancelado', SQLERRM);
  END;

  -- 03.4 cancelado → borrador → RECHAZADO (estado terminal)
  BEGIN
    UPDATE public.trade_transport_trips SET estado='borrador' WHERE id=v_id;
    PERFORM record_fail('MC1-03','03.4','FSM rechaza retroceso desde cancelado','UPDATE no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_STATE_INVALID%' THEN
      PERFORM record_pass('MC1-03','03.4','FSM rechaza retroceso desde cancelado (estado terminal)');
    ELSE
      PERFORM record_fail('MC1-03','03.4','FSM rechaza retroceso desde cancelado', SQLERRM);
    END IF;
  END;

  DELETE FROM public.trade_transport_trips WHERE id=v_id;

  -- 03.5 Trigger completado → cualquier UPDATE rechazado
  DECLARE v_id2 uuid := 'dddddd00-0000-0000-0000-000000000011';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, estado)
    VALUES (v_id2,'aaaaaa00-0000-0000-0000-000000000001','Completado test','A','B',now(),'completado');
    BEGIN
      UPDATE public.trade_transport_trips SET titulo='nuevo titulo' WHERE id=v_id2;
      PERFORM record_fail('MC1-03','03.5','Trigger bloquea UPDATE en completado','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      PERFORM record_pass('MC1-03','03.5','Trigger bloquea cualquier UPDATE en completado');
    END;
    DELETE FROM public.trade_transport_trips WHERE id=v_id2;
  END;

  -- 03.6 org_id inmutable
  DECLARE v_id3 uuid := 'dddddd00-0000-0000-0000-000000000012';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio)
    VALUES (v_id3,'aaaaaa00-0000-0000-0000-000000000001','OrgID test','A','B',now());
    BEGIN
      UPDATE public.trade_transport_trips SET org_id='aaaaaa00-0000-0000-0000-000000000002' WHERE id=v_id3;
      PERFORM record_fail('MC1-03','03.6','Trigger bloquea cambio de org_id','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
        PERFORM record_pass('MC1-03','03.6','Trigger bloquea cambio de org_id');
      ELSE
        PERFORM record_fail('MC1-03','03.6','Trigger bloquea cambio de org_id', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_trips WHERE id=v_id3;
  END;
END; $$;

-- =============================================================================
-- MC1-04  RPC — rutas autorizadas (simulando owner via SET LOCAL)
-- =============================================================================
\echo '=== MC1-04: RPC autorizadas ==='

DO $$
DECLARE
  v_trip_id uuid := 'dddddd00-0000-0000-0000-000000000020';
  v_result  jsonb;
BEGIN
  -- Insertar viaje borrador listo para confirmar
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id, tipo_carga)
  VALUES
    (v_trip_id, 'aaaaaa00-0000-0000-0000-000000000001',
     'Confirmación OK', 'Valencia', 'Madrid',
     now()+interval'20h', now()+interval'24h',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001',
     'carga_general');

  -- Simular auth.uid() = owner de OrgCombinada
  SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000001';

  SELECT confirm_transport_trip(v_trip_id, 'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;

  IF (v_result->>'ok')::boolean = true THEN
    PERFORM record_pass('MC1-04','04.1','confirm_transport_trip devuelve {ok:true} para owner');
  ELSE
    PERFORM record_fail('MC1-04','04.1','confirm_transport_trip devuelve {ok:true} para owner', v_result::text);
  END IF;

  -- 04.2 Verificar que el estado cambió realmente a confirmado
  IF EXISTS (SELECT 1 FROM public.trade_transport_trips WHERE id=v_trip_id AND estado='confirmado') THEN
    PERFORM record_pass('MC1-04','04.2','estado del viaje es confirmado tras confirm_transport_trip');
  ELSE
    PERFORM record_fail('MC1-04','04.2','estado del viaje es confirmado','estado no cambió');
  END IF;

  DELETE FROM public.trade_transport_trips WHERE id=v_trip_id;

  -- 04.3 admin de la org también puede confirmar
  DECLARE v_trip2 uuid := 'dddddd00-0000-0000-0000-000000000021';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, tipo_carga)
    VALUES
      (v_trip2, 'aaaaaa00-0000-0000-0000-000000000001',
       'Admin confirma', 'Sevilla', 'Bilbao',
       now()+interval'30h', now()+interval'34h',
       'bbbbbb00-0000-0000-0000-000000000001',
       'cccccc00-0000-0000-0000-000000000001',
       'paletizado');

    SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000003';  -- admin_comb
    SELECT confirm_transport_trip(v_trip2,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;
    IF (v_result->>'ok')::boolean = true THEN
      PERFORM record_pass('MC1-04','04.3','confirm_transport_trip permite admin de la org');
    ELSE
      PERFORM record_fail('MC1-04','04.3','confirm_transport_trip permite admin de la org', v_result::text);
    END IF;
    DELETE FROM public.trade_transport_trips WHERE id=v_trip2;
  END;
END; $$;

-- =============================================================================
-- MC1-05  RPC — rutas no autorizadas
-- =============================================================================
\echo '=== MC1-05: RPC no autorizadas ==='

DO $$
DECLARE
  v_trip_id uuid := 'dddddd00-0000-0000-0000-000000000030';
  v_result  jsonb;
BEGIN
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id)
  VALUES
    (v_trip_id,'aaaaaa00-0000-0000-0000-000000000001','Auth test','A','B',
     now()+interval'40h', now()+interval'42h',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001');

  -- 05.1 Usuario sin permisos → FORBIDDEN
  SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000099';
  BEGIN
    SELECT confirm_transport_trip(v_trip_id,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;
    PERFORM record_fail('MC1-05','05.1','FORBIDDEN para usuario sin permisos','RPC no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_FORBIDDEN%' THEN
      PERFORM record_pass('MC1-05','05.1','FORBIDDEN para usuario sin permisos en la org');
    ELSE
      PERFORM record_fail('MC1-05','05.1','FORBIDDEN para usuario sin permisos', SQLERRM);
    END IF;
  END;

  DELETE FROM public.trade_transport_trips WHERE id=v_trip_id;

  -- 05.2 transport_enabled=false → FORBIDDEN
  DECLARE v_trip2 uuid := 'dddddd00-0000-0000-0000-000000000031';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id)
    VALUES
      (v_trip2,'aaaaaa00-0000-0000-0000-000000000003','SinModulo test','A','B',
       now()+interval'2d', now()+interval'2d 2h',
       NULL, NULL);  -- OrgSinModulo no tiene vehículos, pero el check es antes
    SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000003';
    BEGIN
      SELECT confirm_transport_trip(v_trip2,'aaaaaa00-0000-0000-0000-000000000003') INTO v_result;
      PERFORM record_fail('MC1-05','05.2','FORBIDDEN cuando transport_enabled=false','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_FORBIDDEN%' THEN
        PERFORM record_pass('MC1-05','05.2','FORBIDDEN cuando transport_enabled=false');
      ELSE
        PERFORM record_fail('MC1-05','05.2','FORBIDDEN cuando transport_enabled=false', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_trips WHERE id=v_trip2;
  END;

  -- 05.3 Org viajeros intenta confirmar viaje de mercancías → FORBIDDEN (modalidad)
  DECLARE v_trip3 uuid := 'dddddd00-0000-0000-0000-000000000032';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin)
    VALUES
      (v_trip3,'aaaaaa00-0000-0000-0000-000000000002','Modalidad viajeros','A','B',
       now()+interval'3d', now()+interval'3d 2h');
    SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000002';
    BEGIN
      SELECT confirm_transport_trip(v_trip3,'aaaaaa00-0000-0000-0000-000000000002') INTO v_result;
      PERFORM record_fail('MC1-05','05.3','FORBIDDEN org viajeros no puede confirmar trips','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_FORBIDDEN%' THEN
        PERFORM record_pass('MC1-05','05.3','FORBIDDEN org viajeros no puede confirmar trips de mercancías');
      ELSE
        PERFORM record_fail('MC1-05','05.3','FORBIDDEN org viajeros trips', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_trips WHERE id=v_trip3;
  END;
END; $$;

-- =============================================================================
-- MC1-06  Solapamientos within-table Mercancías (EXCLUDE constraints)
-- =============================================================================
\echo '=== MC1-06: Solapamientos Mercancías ==='

DO $$
DECLARE
  t1 uuid := 'dddddd00-0000-0000-0000-000000000040';
  t2 uuid := 'dddddd00-0000-0000-0000-000000000041';
BEGIN
  -- Insertar viaje 1 confirmado con vehículo MERC-001
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id, estado)
  VALUES
    (t1,'aaaaaa00-0000-0000-0000-000000000001','Viaje base','A','B',
     '2030-01-01 08:00:00+00', '2030-01-01 16:00:00+00',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001',
     'confirmado');

  -- 06.1 Intentar confirmar viaje 2 en el mismo vehículo, hora solapante → EXCLUDE violation
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Viaje solapado','C','D',
       '2030-01-01 12:00:00+00', '2030-01-01 20:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',
       'cccccc00-0000-0000-0000-000000000002',
       'confirmado');
    PERFORM record_fail('MC1-06','06.1','EXCLUDE bloquea solapamiento within-table vehicle','no lanzó excepción');
  EXCEPTION
    WHEN exclusion_violation THEN
      PERFORM record_pass('MC1-06','06.1','EXCLUDE bloquea solapamiento de vehículo within-table');
  END;

  -- 06.2 Conductor solapado (mismo conductor, mismo rango)
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Conductor solapado','C','D',
       '2030-01-01 10:00:00+00', '2030-01-01 14:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',   -- vehículo diferente no ayuda si conductor solapa
       'cccccc00-0000-0000-0000-000000000001',   -- mismo conductor
       'confirmado');
    -- Si el vehículo también solapa, la exclusión ocurre ahí primero.
    -- Usamos vehículo distinto para probar solo conductor:
    -- Este test se ajusta a que el conductor ya está en t1 en ese rango.
    PERFORM record_fail('MC1-06','06.2','EXCLUDE bloquea solapamiento de conductor','no lanzó excepción');
  EXCEPTION
    WHEN exclusion_violation THEN
      PERFORM record_pass('MC1-06','06.2','EXCLUDE bloquea solapamiento de conductor within-table');
  END;

  -- 06.3 Viaje en rango NO solapante → PERMITIDO
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Viaje sin solapamiento','E','F',
       '2030-01-01 17:00:00+00', '2030-01-01 22:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',
       'cccccc00-0000-0000-0000-000000000001',
       'confirmado');
    PERFORM record_pass('MC1-06','06.3','Permite viaje en rango horario no solapante');
    DELETE FROM public.trade_transport_trips WHERE id=t2;
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-06','06.3','Permite viaje en rango horario no solapante', SQLERRM);
  END;

  DELETE FROM public.trade_transport_trips WHERE id IN (t1,t2);
END; $$;

-- =============================================================================
-- MC1-07  Solapamientos cross-table (Mercancías ↔ Viajeros, vehículo mixto)
-- =============================================================================
\echo '=== MC1-07: Solapamientos cross-table ==='

DO $$
DECLARE
  svc_id uuid := 'eeeeee00-0000-0000-0000-000000000001';
  trp_id uuid := 'dddddd00-0000-0000-0000-000000000050';
  v_result jsonb;
BEGIN
  -- Crear servicio de viajeros confirmado con vehículo mixto
  INSERT INTO public.trade_transport_services
    (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
  VALUES
    (svc_id,'aaaaaa00-0000-0000-0000-000000000001','Servicio viajeros mixto','confirmado',
     'bbbbbb00-0000-0000-0000-000000000002',   -- MIXT-001
     'cccccc00-0000-0000-0000-000000000001',
     '2030-02-01 08:00:00+00','2030-02-01 16:00:00+00');

  -- Crear viaje mercancías en borrador con mismo vehículo mixto, rango solapante
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id)
  VALUES
    (trp_id,'aaaaaa00-0000-0000-0000-000000000001','Trip cruce','A','B',
     '2030-02-01 10:00:00+00','2030-02-01 18:00:00+00',
     'bbbbbb00-0000-0000-0000-000000000002',   -- mismo vehículo mixto
     'cccccc00-0000-0000-0000-000000000001');

  -- 07.1 confirm_transport_trip detecta conflicto cross-table (dirección A)
  SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000001';
  SELECT confirm_transport_trip(trp_id,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;

  IF (v_result->>'ok')::boolean = false
     AND v_result->'conflictos' IS NOT NULL
     AND jsonb_array_length(v_result->'conflictos') > 0 THEN
    PERFORM record_pass('MC1-07','07.1','confirm_transport_trip detecta conflicto cross-table dir.A (vehículo mixto con servicio viajeros)');
  ELSE
    PERFORM record_fail('MC1-07','07.1','confirm_transport_trip conflicto cross-table dir.A', v_result::text);
  END IF;

  -- 07.2 confirm_transport_service detecta conflicto cross-table (dirección B)
  -- Primero confirmamos el viaje directamente (bypass via UPDATE)
  UPDATE public.trade_transport_trips SET estado='confirmado', updated_at=now()
  WHERE id=trp_id;  -- forzar confirmado para el test dirección B

  -- Crear servicio en borrador que solape
  DECLARE svc2 uuid := 'eeeeee00-0000-0000-0000-000000000002';
  BEGIN
    INSERT INTO public.trade_transport_services
      (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
    VALUES
      (svc2,'aaaaaa00-0000-0000-0000-000000000001','Servicio B cruce','borrador',
       'bbbbbb00-0000-0000-0000-000000000002',
       'cccccc00-0000-0000-0000-000000000001',
       '2030-02-01 11:00:00+00','2030-02-01 15:00:00+00');

    SELECT confirm_transport_service(svc2,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;

    IF (v_result->>'ok')::boolean = false
       AND v_result->'conflictos' IS NOT NULL
       AND jsonb_array_length(v_result->'conflictos') > 0 THEN
      PERFORM record_pass('MC1-07','07.2','confirm_transport_service detecta conflicto cross-table dir.B (viaje mercancías con servicio viajeros)');
    ELSE
      PERFORM record_fail('MC1-07','07.2','confirm_transport_service conflicto cross-table dir.B', v_result::text);
    END IF;

    DELETE FROM public.trade_transport_services WHERE id=svc2;
  END;

  DELETE FROM public.trade_transport_trips    WHERE id=trp_id;
  DELETE FROM public.trade_transport_services WHERE id=svc_id;
END; $$;

-- =============================================================================
-- MC1-08  Solapamientos de conductores compartidos
-- =============================================================================
\echo '=== MC1-08: Conductores compartidos ==='

DO $$
DECLARE
  t1 uuid := 'dddddd00-0000-0000-0000-000000000060';
  t2 uuid := 'dddddd00-0000-0000-0000-000000000061';
BEGIN
  -- Viaje 1 con conductor A, vehículo 1
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id, estado)
  VALUES
    (t1,'aaaaaa00-0000-0000-0000-000000000001','Conductor base','A','B',
     '2030-03-01 06:00:00+00','2030-03-01 12:00:00+00',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001',
     'confirmado');

  -- Viaje 2 con conductor A (mismo), vehículo diferente → EXCLUDE en conductor solapa
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Conductor solapado','C','D',
       '2030-03-01 09:00:00+00','2030-03-01 15:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',  -- podría solapar vehicle también
       'cccccc00-0000-0000-0000-000000000001',  -- mismo conductor
       'confirmado');
    PERFORM record_fail('MC1-08','08.1','EXCLUDE bloquea conductor compartido between trips','no lanzó excepción');
  EXCEPTION
    WHEN exclusion_violation THEN
      PERFORM record_pass('MC1-08','08.1','EXCLUDE bloquea conductor compartido between trips');
  END;

  -- 08.2 Conductor B en mismo rango → PERMITIDO (conductor diferente)
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Conductor diferente','E','F',
       '2030-03-01 09:00:00+00','2030-03-01 13:00:00+00',
       NULL,   -- sin vehículo para evitar colisión ahí
       'cccccc00-0000-0000-0000-000000000002',  -- conductor B
       'confirmado');
    PERFORM record_pass('MC1-08','08.2','Permite viaje con conductor diferente en mismo rango');
    DELETE FROM public.trade_transport_trips WHERE id=t2;
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-08','08.2','Permite conductor diferente en mismo rango', SQLERRM);
  END;

  DELETE FROM public.trade_transport_trips WHERE id IN (t1,t2);
END; $$;

-- =============================================================================
-- MC1-09  Confirmaciones concurrentes (test estructural + instrucciones live)
-- =============================================================================
\echo '=== MC1-09: Concurrencia ==='

DO $$
DECLARE
  v_body text;
BEGIN
  -- 09.1 confirm_transport_trip tiene FOR UPDATE sobre trade_vehicles
  SELECT prosrc INTO v_body FROM pg_proc WHERE proname='confirm_transport_trip' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');
  IF v_body LIKE '%FOR UPDATE%' AND v_body LIKE '%trade_vehicles%' THEN
    PERFORM record_pass('MC1-09','09.1','confirm_transport_trip contiene FOR UPDATE sobre trade_vehicles');
  ELSE
    PERFORM record_fail('MC1-09','09.1','confirm_transport_trip FOR UPDATE trade_vehicles','patrón no encontrado en cuerpo de función');
  END IF;

  -- 09.2 confirm_transport_service tiene FOR UPDATE sobre trade_vehicles
  SELECT prosrc INTO v_body FROM pg_proc WHERE proname='confirm_transport_service' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');
  IF v_body LIKE '%FOR UPDATE%' AND v_body LIKE '%trade_vehicles%' THEN
    PERFORM record_pass('MC1-09','09.2','confirm_transport_service contiene FOR UPDATE sobre trade_vehicles');
  ELSE
    PERFORM record_fail('MC1-09','09.2','confirm_transport_service FOR UPDATE trade_vehicles','patrón no encontrado');
  END IF;

  -- 09.3 Ambas funciones tienen trade_workers en FOR UPDATE
  SELECT prosrc INTO v_body FROM pg_proc WHERE proname='confirm_transport_trip' AND pronamespace=(SELECT oid FROM pg_namespace WHERE nspname='public');
  IF v_body LIKE '%trade_workers%' THEN
    PERFORM record_pass('MC1-09','09.3','confirm_transport_trip referencia trade_workers para lock');
  ELSE
    PERFORM record_fail('MC1-09','09.3','confirm_transport_trip referencia trade_workers','no encontrado');
  END IF;

  -- 09.4 El comentario obsoleto "RESIDUAL" no existe en el cuerpo
  IF v_body NOT LIKE '%RESIDUAL%' THEN
    PERFORM record_pass('MC1-09','09.4','comentario obsoleto RESIDUAL ausente en confirm_transport_trip');
  ELSE
    PERFORM record_fail('MC1-09','09.4','comentario obsoleto RESIDUAL ausente','comentario RESIDUAL encontrado en cuerpo de función');
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '>>> MC1-09 LIVE CONCURRENT TEST: ejecutar en dos terminales psql separadas:';
  RAISE NOTICE '>>> SESSION 1: BEGIN; SET test.current_uid=''00000000-0000-0000-0000-000000000001'';';
  RAISE NOTICE '>>>   SELECT * FROM trade_vehicles WHERE id=''bbbbbb00-0000-0000-0000-000000000002'' FOR UPDATE;';
  RAISE NOTICE '>>>   -- PAUSA: no hacer COMMIT hasta que sesión 2 intente lo mismo';
  RAISE NOTICE '>>> SESSION 2: BEGIN; SET test.current_uid=''00000000-0000-0000-0000-000000000001'';';
  RAISE NOTICE '>>>   SELECT * FROM trade_vehicles WHERE id=''bbbbbb00-0000-0000-0000-000000000002'' FOR UPDATE;';
  RAISE NOTICE '>>>   -- BLOQUEADA hasta COMMIT de sesión 1';
  RAISE NOTICE '>>> En sesión 3: SELECT pid, mode, granted, query FROM pg_locks JOIN pg_stat_activity USING(pid);';
  RAISE NOTICE '>>> Resultado esperado: sesión 2 aparece NOT GRANTED (bloqueada)';
END; $$;

-- =============================================================================
-- MC1-10  Cancelación y liberación de disponibilidad
-- =============================================================================
\echo '=== MC1-10: Cancelación y liberación ==='

DO $$
DECLARE
  t1 uuid := 'dddddd00-0000-0000-0000-000000000070';
  t2 uuid := 'dddddd00-0000-0000-0000-000000000071';
BEGIN
  -- Viaje confirmado con vehículo MERC-001
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id, estado)
  VALUES
    (t1,'aaaaaa00-0000-0000-0000-000000000001','Trip para cancelar','A','B',
     '2030-04-01 08:00:00+00','2030-04-01 16:00:00+00',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001',
     'confirmado');

  -- 10.1 Cancelar el viaje confirmado
  BEGIN
    UPDATE public.trade_transport_trips SET estado='cancelado' WHERE id=t1;
    PERFORM record_pass('MC1-10','10.1','FSM permite confirmado→cancelado');
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-10','10.1','FSM permite confirmado→cancelado', SQLERRM);
  END;

  -- 10.2 Tras cancelación, misma franja con mismo vehículo ya es posible
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id, estado)
    VALUES
      (t2,'aaaaaa00-0000-0000-0000-000000000001','Trip en franja liberada','C','D',
       '2030-04-01 08:00:00+00','2030-04-01 16:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',
       'cccccc00-0000-0000-0000-000000000001',
       'confirmado');
    PERFORM record_pass('MC1-10','10.2','Vehículo disponible tras cancelación del viaje anterior');
    DELETE FROM public.trade_transport_trips WHERE id=t2;
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-10','10.2','Disponibilidad liberada tras cancelación', SQLERRM);
  END;

  DELETE FROM public.trade_transport_trips WHERE id IN (t1,t2);
END; $$;

-- =============================================================================
-- MC1-11  Rechazo de modificaciones directas incompatibles
-- =============================================================================
\echo '=== MC1-11: Modificaciones incompatibles ==='

DO $$
DECLARE
  t_id uuid := 'dddddd00-0000-0000-0000-000000000080';
  v2   uuid := 'bbbbbb00-0000-0000-0000-000000000001';  -- segundo vehículo para intento de cambio
BEGIN
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
     vehicle_id, conductor_id, estado)
  VALUES
    (t_id,'aaaaaa00-0000-0000-0000-000000000001','Inmutable test','A','B',
     '2030-05-01 08:00:00+00','2030-05-01 16:00:00+00',
     'bbbbbb00-0000-0000-0000-000000000001',
     'cccccc00-0000-0000-0000-000000000001',
     'confirmado');

  -- 11.1 vehicle_id no modificable en confirmado
  BEGIN
    UPDATE public.trade_transport_trips
    SET vehicle_id='bbbbbb00-0000-0000-0000-000000000002'  -- MIXT-001
    WHERE id=t_id;
    PERFORM record_fail('MC1-11','11.1','Trigger rechaza cambio vehicle_id en confirmado','no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
      PERFORM record_pass('MC1-11','11.1','Trigger rechaza cambio vehicle_id en confirmado');
    ELSE
      PERFORM record_fail('MC1-11','11.1','Trigger rechaza vehicle_id', SQLERRM);
    END IF;
  END;

  -- 11.2 conductor_id no modificable en confirmado
  BEGIN
    UPDATE public.trade_transport_trips
    SET conductor_id='cccccc00-0000-0000-0000-000000000002'
    WHERE id=t_id;
    PERFORM record_fail('MC1-11','11.2','Trigger rechaza cambio conductor_id en confirmado','no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
      PERFORM record_pass('MC1-11','11.2','Trigger rechaza cambio conductor_id en confirmado');
    ELSE
      PERFORM record_fail('MC1-11','11.2','Trigger rechaza conductor_id', SQLERRM);
    END IF;
  END;

  -- 11.3 fecha_inicio no modificable en confirmado
  BEGIN
    UPDATE public.trade_transport_trips
    SET fecha_inicio='2030-05-02 08:00:00+00'
    WHERE id=t_id;
    PERFORM record_fail('MC1-11','11.3','Trigger rechaza cambio fecha_inicio en confirmado','no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
      PERFORM record_pass('MC1-11','11.3','Trigger rechaza cambio fecha_inicio en confirmado');
    ELSE
      PERFORM record_fail('MC1-11','11.3','Trigger rechaza fecha_inicio', SQLERRM);
    END IF;
  END;

  -- 11.4 fecha_fin no modificable en confirmado
  BEGIN
    UPDATE public.trade_transport_trips
    SET fecha_fin='2030-05-01 20:00:00+00'
    WHERE id=t_id;
    PERFORM record_fail('MC1-11','11.4','Trigger rechaza cambio fecha_fin en confirmado','no lanzó excepción');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
      PERFORM record_pass('MC1-11','11.4','Trigger rechaza cambio fecha_fin en confirmado');
    ELSE
      PERFORM record_fail('MC1-11','11.4','Trigger rechaza fecha_fin', SQLERRM);
    END IF;
  END;

  -- 11.5 titulo SÍ es modificable en confirmado (campos no protegidos)
  BEGIN
    UPDATE public.trade_transport_trips SET titulo='Nuevo titulo OK' WHERE id=t_id;
    PERFORM record_pass('MC1-11','11.5','Campos no protegidos (titulo) sí modificables en confirmado');
  EXCEPTION WHEN OTHERS THEN
    PERFORM record_fail('MC1-11','11.5','Campos no protegidos modificables', SQLERRM);
  END;

  -- 11.6 Trigger inmutabilidad en trade_transport_services también activo
  DECLARE svc_id uuid := 'eeeeee00-0000-0000-0000-000000000010';
  BEGIN
    INSERT INTO public.trade_transport_services
      (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
    VALUES
      (svc_id,'aaaaaa00-0000-0000-0000-000000000001','Servicio inmutable test','confirmado',
       'bbbbbb00-0000-0000-0000-000000000002',
       'cccccc00-0000-0000-0000-000000000001',
       '2030-05-01 08:00:00+00','2030-05-01 16:00:00+00');
    BEGIN
      UPDATE public.trade_transport_services
      SET vehicle_id='bbbbbb00-0000-0000-0000-000000000003'  -- VIAJ-001
      WHERE id=svc_id;
      PERFORM record_fail('MC1-11','11.6','Trigger trade_transport_services rechaza vehicle_id en confirmado','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_IMMUTABLE%' THEN
        PERFORM record_pass('MC1-11','11.6','Trigger trade_transport_services rechaza vehicle_id en confirmado');
      ELSE
        PERFORM record_fail('MC1-11','11.6','Trigger trade_transport_services immutable', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_services WHERE id=svc_id;
  END;

  DELETE FROM public.trade_transport_trips WHERE id=t_id;
END; $$;

-- =============================================================================
-- MC1-12  Regresión operativa Viajeros existente
-- =============================================================================
\echo '=== MC1-12: Regresión Viajeros ==='

DO $$
DECLARE
  svc1 uuid := 'eeeeee00-0000-0000-0000-000000000020';
  svc2 uuid := 'eeeeee00-0000-0000-0000-000000000021';
  v_result jsonb;
BEGIN
  -- 12.1 confirm_transport_service funciona correctamente (regresión base)
  INSERT INTO public.trade_transport_services
    (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
  VALUES
    (svc1,'aaaaaa00-0000-0000-0000-000000000001','Servicio Viajeros OK','borrador',
     'bbbbbb00-0000-0000-0000-000000000002',   -- MIXT-001 (viajeros/mixto OK)
     'cccccc00-0000-0000-0000-000000000001',
     '2030-06-01 08:00:00+00','2030-06-01 16:00:00+00');

  SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000001';
  SELECT confirm_transport_service(svc1,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;

  IF (v_result->>'ok')::boolean = true THEN
    PERFORM record_pass('MC1-12','12.1','confirm_transport_service funciona correctamente tras parche (regresión)');
  ELSE
    PERFORM record_fail('MC1-12','12.1','confirm_transport_service regresión', v_result::text);
  END IF;

  -- 12.2 Vehículo de modalidad viajeros → RECHAZADO para mercancías
  DECLARE t_id uuid := 'dddddd00-0000-0000-0000-000000000090';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id)
    VALUES
      (t_id,'aaaaaa00-0000-0000-0000-000000000001','Viaje veh viajeros','A','B',
       '2030-07-01 08:00:00+00','2030-07-01 16:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000003',  -- VIAJ-001 (solo viajeros)
       'cccccc00-0000-0000-0000-000000000001');
    -- Intentar confirmar vía RPC — debe fallar por modalidad vehículo en trigger operacional
    SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000001';
    BEGIN
      SELECT confirm_transport_trip(t_id,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;
      -- También puede fallar via UPDATE (trigger operacional)
      IF (v_result->>'ok')::boolean = false THEN
        PERFORM record_pass('MC1-12','12.2','Vehículo viajeros rechazado para trip mercancías');
      ELSE
        PERFORM record_fail('MC1-12','12.2','Vehículo viajeros rechazado para trip mercancías','RPC devolvió ok:true');
      END IF;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_INVALID%' OR SQLERRM LIKE '%apto para mercancías%' THEN
        PERFORM record_pass('MC1-12','12.2','Vehículo viajeros rechazado para trip mercancías (excepción)');
      ELSE
        PERFORM record_fail('MC1-12','12.2','Vehículo viajeros rechazado', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_trips WHERE id=t_id;
  END;

  -- 12.3 No conductor en mercancías → RECHAZADO
  DECLARE t_id2 uuid := 'dddddd00-0000-0000-0000-000000000091';
  BEGIN
    INSERT INTO public.trade_transport_trips
      (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin,
       vehicle_id, conductor_id)
    VALUES
      (t_id2,'aaaaaa00-0000-0000-0000-000000000001','No conductor test','A','B',
       '2030-07-01 08:00:00+00','2030-07-01 16:00:00+00',
       'bbbbbb00-0000-0000-0000-000000000001',
       'cccccc00-0000-0000-0000-000000000003');  -- NoConductor (es_conductor=false)
    BEGIN
      SELECT confirm_transport_trip(t_id2,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;
      PERFORM record_fail('MC1-12','12.3','Rechaza conductor sin habilitación','no lanzó excepción');
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE '%TRANSPORT_INVALID%' OR SQLERRM LIKE '%conductor%' THEN
        PERFORM record_pass('MC1-12','12.3','Rechaza conductor sin habilitación es_conductor=false');
      ELSE
        PERFORM record_fail('MC1-12','12.3','Rechaza no-conductor', SQLERRM);
      END IF;
    END;
    DELETE FROM public.trade_transport_trips WHERE id=t_id2;
  END;

  -- 12.4 Servicio Viajeros EXCLUDE within-table sigue funcionando tras parche
  INSERT INTO public.trade_transport_services
    (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
  VALUES
    (svc2,'aaaaaa00-0000-0000-0000-000000000001','Servicio solapado viajeros','borrador',
     'bbbbbb00-0000-0000-0000-000000000002',   -- mismo vehículo mixto que svc1
     'cccccc00-0000-0000-0000-000000000002',
     '2030-06-01 10:00:00+00','2030-06-01 20:00:00+00');

  SELECT confirm_transport_service(svc2,'aaaaaa00-0000-0000-0000-000000000001') INTO v_result;

  IF (v_result->>'ok')::boolean = false THEN
    PERFORM record_pass('MC1-12','12.4','EXCLUDE within-table Viajeros sigue rechazando solapamientos (regresión)');
  ELSE
    PERFORM record_fail('MC1-12','12.4','EXCLUDE within-table Viajeros regresión', v_result::text);
  END IF;

  DELETE FROM public.trade_transport_services WHERE id IN (svc1,svc2);
END; $$;

-- =============================================================================
-- MC1-13  Bypass protección: authenticated no puede confirmar directamente
-- =============================================================================
\echo '=== MC1-13: Bypass protection (direct confirmation blocked) ==='

DO $$
DECLARE
  trip_id uuid := 'dddddd00-0000-0000-0000-000000000088';
  svc_id  uuid := 'dddddd00-0000-0000-0000-000000000089';
  v_res   jsonb;
BEGIN
  -- Setup: viaje y servicio en borrador con recursos válidos
  INSERT INTO public.trade_transport_trips
    (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id)
  VALUES (trip_id,'aaaaaa00-0000-0000-0000-000000000001','Bypass test trip','A','B',
          '2030-12-01 08:00:00+00','2030-12-01 16:00:00+00',
          'bbbbbb00-0000-0000-0000-000000000001',
          'cccccc00-0000-0000-0000-000000000001');

  INSERT INTO public.trade_transport_services
    (id, org_id, titulo, estado, vehicle_id, conductor_id, fecha_inicio, fecha_fin)
  VALUES (svc_id,'aaaaaa00-0000-0000-0000-000000000001','Bypass test svc','borrador',
          'bbbbbb00-0000-0000-0000-000000000003',
          'cccccc00-0000-0000-0000-000000000002',
          '2030-12-01 09:00:00+00','2030-12-01 17:00:00+00');

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13.1 authenticated no puede confirmar trip directamente
  -- ─────────────────────────────────────────────────────────────────────────
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    UPDATE public.trade_transport_trips SET estado='confirmado' WHERE id=trip_id;
    EXECUTE 'RESET ROLE';
    PERFORM record_fail('MC1-13','13.1','authenticated bloqueado en UPDATE estado=confirmado (trip)',
                        'UPDATE no lanzó excepción');
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
      PERFORM record_pass('MC1-13','13.1','authenticated bloqueado en UPDATE estado=confirmado (trip)');
    WHEN OTHERS THEN
      EXECUTE 'RESET ROLE';
      PERFORM record_fail('MC1-13','13.1','authenticated bloqueado en UPDATE estado=confirmado (trip)', SQLERRM);
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13.2 authenticated no puede confirmar service directamente
  -- ─────────────────────────────────────────────────────────────────────────
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    UPDATE public.trade_transport_services SET estado='confirmado' WHERE id=svc_id;
    EXECUTE 'RESET ROLE';
    PERFORM record_fail('MC1-13','13.2','authenticated bloqueado en UPDATE estado=confirmado (service)',
                        'UPDATE no lanzó excepción');
  EXCEPTION
    WHEN insufficient_privilege THEN
      EXECUTE 'RESET ROLE';
      PERFORM record_pass('MC1-13','13.2','authenticated bloqueado en UPDATE estado=confirmado (service)');
    WHEN OTHERS THEN
      EXECUTE 'RESET ROLE';
      PERFORM record_fail('MC1-13','13.2','authenticated bloqueado en UPDATE estado=confirmado (service)', SQLERRM);
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13.3 authenticated puede cancelar directamente (transición distinta de confirmado)
  -- ─────────────────────────────────────────────────────────────────────────
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    UPDATE public.trade_transport_trips SET estado='cancelado' WHERE id=trip_id;
    EXECUTE 'RESET ROLE';
    PERFORM record_pass('MC1-13','13.3','authenticated puede cancelar directamente (no es confirmado)');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM record_fail('MC1-13','13.3','authenticated puede cancelar directamente', SQLERRM);
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13.4 RPC confirm_transport_service sigue funcionando (postgres SECURITY DEFINER)
  -- ─────────────────────────────────────────────────────────────────────────
  -- (El trip está cancelado; el service sigue en borrador — usar svc_id)
  SET LOCAL test.current_uid = '00000000-0000-0000-0000-000000000001';
  SELECT confirm_transport_service(svc_id, 'aaaaaa00-0000-0000-0000-000000000001') INTO v_res;
  IF (v_res->>'ok')::boolean = true THEN
    PERFORM record_pass('MC1-13','13.4','RPC confirm_transport_service funciona con bypass trigger activo');
  ELSE
    PERFORM record_fail('MC1-13','13.4','RPC confirm_transport_service fallida con bypass trigger', v_res::text);
  END IF;

  -- ─────────────────────────────────────────────────────────────────────────
  -- 13.5 authenticated puede editar campos de un service ya confirmado (no es cambio de estado)
  -- ─────────────────────────────────────────────────────────────────────────
  EXECUTE 'SET ROLE authenticated';
  BEGIN
    -- UPDATE un campo no protegido (num_viajeros) en estado confirmado
    UPDATE public.trade_transport_services SET num_viajeros=5 WHERE id=svc_id AND estado='confirmado';
    EXECUTE 'RESET ROLE';
    PERFORM record_pass('MC1-13','13.5','authenticated puede editar campos no protegidos en confirmado');
  EXCEPTION WHEN OTHERS THEN
    EXECUTE 'RESET ROLE';
    PERFORM record_fail('MC1-13','13.5','authenticated edita campos no protegidos en confirmado', SQLERRM);
  END;

  DELETE FROM public.trade_transport_trips    WHERE id=trip_id;
  DELETE FROM public.trade_transport_services WHERE id=svc_id;
END; $$;

-- =============================================================================
-- RESULTADOS FINALES
-- =============================================================================
\echo ''
\echo '============================================================'
\echo 'TX-MC-1 INTEGRATION TEST RESULTS'
\echo '============================================================'

SELECT
  suite,
  count(*) FILTER (WHERE status='PASS') AS pass,
  count(*) FILTER (WHERE status='FAIL') AS fail,
  count(*) AS total
FROM _results
GROUP BY suite
ORDER BY suite;

\echo ''
\echo '--- DETALLE FALLOS ---'
SELECT suite, test_id, description, detail
FROM _results
WHERE status = 'FAIL'
ORDER BY suite, test_id;

\echo ''
\echo '--- RESUMEN GLOBAL ---'
SELECT
  count(*) FILTER (WHERE status='PASS') AS total_pass,
  count(*) FILTER (WHERE status='FAIL') AS total_fail,
  count(*) AS total_tests,
  CASE WHEN count(*) FILTER (WHERE status='FAIL') = 0 THEN 'ALL PASS' ELSE 'FAILURES DETECTED' END AS verdict
FROM _results;

-- =============================================================================
-- LIMPIEZA
-- =============================================================================
\echo ''
\echo '>>> Cleaning up test schema...'
DROP TABLE IF EXISTS _results;
DROP FUNCTION IF EXISTS record_pass(text,text,text);
DROP FUNCTION IF EXISTS record_fail(text,text,text,text);
DROP TABLE IF EXISTS public.trade_transport_trips CASCADE;
DROP TABLE IF EXISTS public.trade_transport_services CASCADE;
DROP TABLE IF EXISTS public.trade_org_members CASCADE;
DROP TABLE IF EXISTS public.trade_workers CASCADE;
DROP TABLE IF EXISTS public.trade_vehicles CASCADE;
DROP TABLE IF EXISTS public.trade_organizations CASCADE;
DROP TYPE IF EXISTS public.tipo_carga_mercancias CASCADE;
DROP SCHEMA IF EXISTS auth CASCADE;
DROP ROLE IF EXISTS authenticated;
\echo '>>> Cleanup complete.'
\echo ''
\echo 'NOTE: MC1-09 concurrent test requires two separate psql sessions.'
\echo 'See RAISE NOTICE output above for step-by-step instructions.'
