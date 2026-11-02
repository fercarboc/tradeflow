-- =============================================================================
-- TX-MC-1 — TEST CONCURRENCIA RPC REAL
-- src/test/transport/tx-mc1-rpc-concurrency.sql
--
-- Ejecutar el SETUP primero (este archivo), luego usar el runner PowerShell:
--   scripts/tx-mc1-concurrent-runner.ps1
--
-- Este archivo crea el esquema, datos de prueba y las funciones de "sesión"
-- que los workers paralelos invocan.
--
-- Escenarios:
--   CONC-01A: confirm_transport_trip A vs confirm_transport_service B (mismo recurso mixto)
--   CONC-01B: confirm_transport_service B primero vs confirm_transport_trip A segundo
--   CONC-02:  conductor compartido, vehículos distintos
-- =============================================================================

\set ON_ERROR_STOP on

-- ── Preludio ──────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    current_setting('test.current_uid', true)::uuid,
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

-- ── Limpiar estado previo ──────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.trade_transport_trips      CASCADE;
DROP TABLE IF EXISTS public.trade_transport_services   CASCADE;
DROP TABLE IF EXISTS public.trade_org_members          CASCADE;
DROP TABLE IF EXISTS public.trade_workers              CASCADE;
DROP TABLE IF EXISTS public.trade_vehicles             CASCADE;
DROP TABLE IF EXISTS public.trade_organizations        CASCADE;
DROP TYPE  IF EXISTS public.tipo_carga_mercancias      CASCADE;
DROP TABLE IF EXISTS public.conc_results               CASCADE;

-- ── Tablas dependencia ────────────────────────────────────────────────────────
CREATE TABLE public.trade_organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                text NOT NULL,
  owner_id            uuid REFERENCES auth.users(id),
  transport_enabled   boolean NOT NULL DEFAULT false,
  transport_modalidad text CHECK (transport_modalidad IN ('viajeros','mercancias','reparto','combinada'))
);

CREATE TABLE public.trade_vehicles (
  id                 uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  matricula          text NOT NULL,
  modalidad          text NOT NULL CHECK (modalidad IN ('viajeros','mercancias','reparto','mixto')),
  activo             boolean NOT NULL DEFAULT true,
  capacidad_viajeros int,
  PRIMARY KEY (id),
  UNIQUE (org_id, id)
);

CREATE TABLE public.trade_workers (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  es_conductor boolean DEFAULT false,
  activo       boolean NOT NULL DEFAULT true,
  PRIMARY KEY (id),
  UNIQUE (org_id, id)
);

CREATE TABLE public.trade_org_members (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rol     text NOT NULL CHECK (rol IN ('owner','admin','member')),
  activo  boolean NOT NULL DEFAULT true
);

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
  CONSTRAINT tts_vehicle_org_fk  FOREIGN KEY (org_id, vehicle_id)  REFERENCES public.trade_vehicles(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_conductor_org_fk FOREIGN KEY (org_id, conductor_id) REFERENCES public.trade_workers(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_fecha_orden CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_no_vehicle_overlap EXCLUDE USING gist (
    vehicle_id WITH =, tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (vehicle_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_no_conductor_overlap EXCLUDE USING gist (
    conductor_id WITH =, tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (conductor_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

-- ── Migraciones TX-MC-1 (inline) ─────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='tipo_carga_mercancias') THEN
    CREATE TYPE public.tipo_carga_mercancias AS ENUM ('paletizado','carga_general','frigorifica','peligrosas','especial','otro');
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
  km_inicio    int, km_fin int,
  km_realizados int GENERATED ALWAYS AS (CASE WHEN km_fin IS NOT NULL AND km_inicio IS NOT NULL THEN km_fin - km_inicio ELSE NULL END) STORED,
  incidencias  text, observaciones_cierre text,
  cerrado_at   timestamptz,
  cerrado_por  uuid REFERENCES auth.users(id),
  odometro_inicio int, odometro_final int,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ttt_vehicle_org_fk   FOREIGN KEY (org_id, vehicle_id)   REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttt_conductor_org_fk FOREIGN KEY (org_id, conductor_id) REFERENCES public.trade_workers(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT ttt_fecha_orden     CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),
  CONSTRAINT ttt_precio_positivo CHECK (precio_acordado IS NULL OR precio_acordado >= 0)
);

ALTER TABLE public.trade_transport_trips
  ADD CONSTRAINT ttt_no_vehicle_overlap EXCLUDE USING gist (
    vehicle_id WITH =, tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (vehicle_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

ALTER TABLE public.trade_transport_trips
  ADD CONSTRAINT ttt_no_conductor_overlap EXCLUDE USING gist (
    conductor_id WITH =, tstzrange(fecha_inicio, fecha_fin, '[)') WITH &&
  ) WHERE (conductor_id IS NOT NULL AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL);

-- Triggers trade_transport_trips
CREATE OR REPLACE FUNCTION public._update_transport_trip_timestamp() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NEW.updated_at=now(); RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public._update_transport_trip_timestamp() FROM PUBLIC;
CREATE TRIGGER trg_transport_trip_updated_at BEFORE UPDATE ON public.trade_transport_trips FOR EACH ROW EXECUTE FUNCTION public._update_transport_trip_timestamp();

CREATE OR REPLACE FUNCTION public._validate_transport_trip_fsm() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN RETURN NEW; END IF;
  IF NEW.estado=OLD.estado THEN RETURN NEW; END IF;
  CASE OLD.estado
    WHEN 'borrador'   THEN IF NEW.estado NOT IN ('confirmado','cancelado') THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de borrador solo se puede pasar a confirmado o cancelado'; END IF;
    WHEN 'confirmado' THEN IF NEW.estado NOT IN ('en_curso','cancelado') THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de confirmado solo se puede pasar a en_curso o cancelado'; END IF;
    WHEN 'en_curso'   THEN IF NEW.estado NOT IN ('completado','cancelado') THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de en_curso solo se puede pasar a completado o cancelado'; END IF;
    WHEN 'completado' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje completado es un estado terminal';
    WHEN 'cancelado'  THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje cancelado es un estado terminal';
    ELSE RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado desconocido: %', OLD.estado;
  END CASE;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._validate_transport_trip_fsm() FROM PUBLIC;
CREATE TRIGGER trg_transport_trip_fsm BEFORE UPDATE OF estado ON public.trade_transport_trips FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_fsm();

CREATE OR REPLACE FUNCTION public._prevent_transport_trip_org_change() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.org_id<>OLD.org_id THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: org_id de un viaje de transporte es inmutable'; END IF; RETURN NEW; END; $$;
REVOKE ALL ON FUNCTION public._prevent_transport_trip_org_change() FROM PUBLIC;
CREATE TRIGGER trg_ttt_immutable_org BEFORE UPDATE OF org_id ON public.trade_transport_trips FOR EACH ROW EXECUTE FUNCTION public._prevent_transport_trip_org_change();

CREATE OR REPLACE FUNCTION public._validate_transport_trip_operational() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_vehicle public.trade_vehicles; v_worker public.trade_workers;
BEGIN
  IF NEW.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id=NEW.org_id AND transport_enabled=true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;
  IF (NEW.vehicle_id IS NOT NULL OR NEW.conductor_id IS NOT NULL) AND NEW.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un viaje con vehículo o conductor asignados';
  END IF;
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles WHERE id=NEW.vehicle_id AND org_id=NEW.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización'; END IF;
    IF NOT v_vehicle.activo THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo=false)'; END IF;
    IF v_vehicle.modalidad NOT IN ('mercancias','reparto','mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para mercancías (modalidad: %)', v_vehicle.modalidad;
    END IF;
  END IF;
  IF NEW.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.trade_workers WHERE id=NEW.conductor_id AND org_id=NEW.org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no pertenece a esta organización'; END IF;
    IF NOT COALESCE(v_worker.es_conductor, false) THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el trabajador asignado no está habilitado como conductor'; END IF;
    IF v_worker.activo IS NOT DISTINCT FROM false THEN RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no está activo'; END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._validate_transport_trip_operational() FROM PUBLIC;
CREATE TRIGGER trg_ttt_validate_operational BEFORE INSERT OR UPDATE OF estado, vehicle_id, conductor_id ON public.trade_transport_trips FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_operational();

CREATE OR REPLACE FUNCTION public._protect_confirmed_trip_fields() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NEW.vehicle_id   IS DISTINCT FROM OLD.vehicle_id   THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id en estado %.', OLD.estado; END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id en estado %.', OLD.estado; END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio en estado %.', OLD.estado; END IF;
  IF NEW.fecha_fin    IS DISTINCT FROM OLD.fecha_fin    THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin en estado %.', OLD.estado; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._protect_confirmed_trip_fields() FROM PUBLIC;
CREATE TRIGGER trg_ttt_protect_confirmed_fields BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin ON public.trade_transport_trips FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_trip_fields();

CREATE OR REPLACE FUNCTION public._protect_completed_transport_trip() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN RAISE EXCEPTION 'El viaje % ya está completado y no puede modificarse', OLD.id; END; $$;
REVOKE ALL ON FUNCTION public._protect_completed_transport_trip() FROM PUBLIC;
CREATE TRIGGER trg_protect_completed_trip BEFORE UPDATE ON public.trade_transport_trips FOR EACH ROW WHEN (OLD.estado='completado') EXECUTE FUNCTION public._protect_completed_transport_trip();

-- Trigger inmutabilidad en trade_transport_services
CREATE OR REPLACE FUNCTION public._protect_confirmed_service_fields() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.estado NOT IN ('confirmado','en_curso') THEN RETURN NEW; END IF;
  IF NEW.vehicle_id   IS DISTINCT FROM OLD.vehicle_id   THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id en servicio estado %.', OLD.estado; END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id en servicio estado %.', OLD.estado; END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio en servicio estado %.', OLD.estado; END IF;
  IF NEW.fecha_fin    IS DISTINCT FROM OLD.fecha_fin    THEN RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin en servicio estado %.', OLD.estado; END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._protect_confirmed_service_fields() FROM PUBLIC;
CREATE TRIGGER trg_tts_protect_confirmed_fields BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin ON public.trade_transport_services FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_service_fields();

-- RPCs
CREATE OR REPLACE FUNCTION public.confirm_transport_trip(p_trip_id uuid, p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_trip          public.trade_transport_trips%ROWTYPE;
  v_org_modalidad text;
  v_conflicts     jsonb := '[]'::jsonb;
  v_svc_conflict  record;
  v_range         tstzrange;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id=p_org_id AND transport_enabled=true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: transport_enabled=false'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id=p_org_id AND owner_id=auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members WHERE org_id=p_org_id AND user_id=auth.uid() AND rol IN ('owner','admin') AND activo=true
  ) THEN RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos'; END IF;
  SELECT * INTO v_trip FROM public.trade_transport_trips WHERE id=p_trip_id AND org_id=p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND'; END IF;
  IF v_trip.estado<>'borrador' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado=%', v_trip.estado; END IF;
  SELECT transport_modalidad INTO v_org_modalidad FROM public.trade_organizations WHERE id=p_org_id;
  IF COALESCE(v_org_modalidad,'') NOT IN ('mercancias','reparto','combinada') THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: modalidad=%', COALESCE(v_org_modalidad,'nula'); END IF;
  -- LOCK recursos: vehicle → conductor (orden estable)
  IF v_trip.vehicle_id   IS NOT NULL THEN PERFORM 1 FROM public.trade_vehicles WHERE id=v_trip.vehicle_id   FOR UPDATE; END IF;
  IF v_trip.conductor_id IS NOT NULL THEN PERFORM 1 FROM public.trade_workers  WHERE id=v_trip.conductor_id FOR UPDATE; END IF;
  IF (v_trip.vehicle_id IS NOT NULL OR v_trip.conductor_id IS NOT NULL) AND v_trip.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: fecha_fin requerida'; END IF;
  IF v_trip.fecha_fin IS NOT NULL THEN v_range := tstzrange(v_trip.fecha_inicio, v_trip.fecha_fin, '[)'); END IF;
  -- Cross-table check dirección A: trips → services
  IF v_trip.vehicle_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin FROM public.trade_transport_services
      WHERE org_id=p_org_id AND vehicle_id=v_trip.vehicle_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','vehiculo','id',v_svc_conflict.id,'titulo',v_svc_conflict.titulo,'tabla','servicios');
    END LOOP;
  END IF;
  IF v_trip.conductor_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin FROM public.trade_transport_services
      WHERE org_id=p_org_id AND conductor_id=v_trip.conductor_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','conductor','id',v_svc_conflict.id,'titulo',v_svc_conflict.titulo,'tabla','servicios');
    END LOOP;
  END IF;
  IF jsonb_array_length(v_conflicts)>0 THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  BEGIN
    UPDATE public.trade_transport_trips SET estado='confirmado', updated_at=now() WHERE id=p_trip_id AND org_id=p_org_id;
  EXCEPTION WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok',false,'conflictos',jsonb_build_array(jsonb_build_object('tipo','conflicto_concurrente','titulo','EXCLUDE constraint')));
  END;
  RETURN jsonb_build_object('ok',true,'tabla','trips');
END; $$;
REVOKE ALL ON FUNCTION public.confirm_transport_trip(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_transport_trip(uuid,uuid) TO PUBLIC;

CREATE OR REPLACE FUNCTION public.confirm_transport_service(p_service_id uuid, p_org_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_svc           public.trade_transport_services%ROWTYPE;
  v_vehicle       public.trade_vehicles;
  v_worker        public.trade_workers;
  v_conflicts     jsonb;
  v_trip_conflict record;
  v_range         tstzrange;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_organizations WHERE id=p_org_id AND transport_enabled=true) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: transport_enabled=false'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id=p_org_id AND owner_id=auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members WHERE org_id=p_org_id AND user_id=auth.uid() AND rol IN ('owner','admin') AND activo=true
  ) THEN RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos'; END IF;
  SELECT * INTO v_svc FROM public.trade_transport_services WHERE id=p_service_id AND org_id=p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_NOT_FOUND'; END IF;
  IF v_svc.estado<>'borrador' THEN RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado=%', v_svc.estado; END IF;
  -- LOCK recursos: vehicle → conductor (orden estable — igual que confirm_transport_trip)
  IF v_svc.vehicle_id   IS NOT NULL THEN PERFORM 1 FROM public.trade_vehicles WHERE id=v_svc.vehicle_id   FOR UPDATE; END IF;
  IF v_svc.conductor_id IS NOT NULL THEN PERFORM 1 FROM public.trade_workers  WHERE id=v_svc.conductor_id FOR UPDATE; END IF;
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles WHERE id=v_svc.vehicle_id AND org_id=p_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: vehículo no pertenece a la org'; END IF;
    IF NOT v_vehicle.activo THEN RAISE EXCEPTION 'TRANSPORT_INVALID: vehículo inactivo'; END IF;
    IF v_vehicle.modalidad NOT IN ('viajeros','mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: vehículo no apto para viajeros (modalidad: %)', v_vehicle.modalidad; END IF;
  END IF;
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.trade_workers WHERE id=v_svc.conductor_id AND org_id=p_org_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORT_INVALID: conductor no pertenece a la org'; END IF;
    IF NOT COALESCE(v_worker.es_conductor,false) THEN RAISE EXCEPTION 'TRANSPORT_INVALID: es_conductor=false'; END IF;
    IF v_worker.activo IS NOT DISTINCT FROM false THEN RAISE EXCEPTION 'TRANSPORT_INVALID: conductor inactivo'; END IF;
  END IF;
  IF (v_svc.vehicle_id IS NOT NULL OR v_svc.conductor_id IS NOT NULL) AND v_svc.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: fecha_fin requerida'; END IF;
  IF v_svc.fecha_fin IS NOT NULL THEN v_range := tstzrange(v_svc.fecha_inicio, v_svc.fecha_fin, '[)'); END IF;
  -- Check within-table vehículo
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('tipo','vehiculo','id',id,'tabla','servicios')) INTO v_conflicts
    FROM public.trade_transport_services
    WHERE vehicle_id=v_svc.vehicle_id AND id<>p_service_id AND estado IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range;
    IF v_conflicts IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Cross-table vehículo dirección B: services → trips
  IF v_svc.vehicle_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo FROM public.trade_transport_trips
      WHERE org_id=p_org_id AND vehicle_id=v_svc.vehicle_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','vehiculo','id',v_trip_conflict.id,'titulo',v_trip_conflict.titulo,'tabla','viajes');
    END LOOP;
    IF jsonb_array_length(v_conflicts)>0 THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Check within-table conductor
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('tipo','conductor','id',id,'tabla','servicios')) INTO v_conflicts
    FROM public.trade_transport_services
    WHERE conductor_id=v_svc.conductor_id AND id<>p_service_id AND estado IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range;
    IF v_conflicts IS NOT NULL THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  -- Cross-table conductor dirección B: services → trips
  IF v_svc.conductor_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo FROM public.trade_transport_trips
      WHERE org_id=p_org_id AND conductor_id=v_svc.conductor_id
        AND estado IN ('confirmado','en_curso') AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio,fecha_fin,'[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object('tipo','conductor','id',v_trip_conflict.id,'titulo',v_trip_conflict.titulo,'tabla','viajes');
    END LOOP;
    IF jsonb_array_length(v_conflicts)>0 THEN RETURN jsonb_build_object('ok',false,'conflictos',v_conflicts); END IF;
  END IF;
  BEGIN
    UPDATE public.trade_transport_services SET estado='confirmado', updated_at=now() WHERE id=p_service_id AND org_id=p_org_id;
  EXCEPTION WHEN exclusion_violation THEN
    RETURN jsonb_build_object('ok',false,'conflictos',jsonb_build_array(jsonb_build_object('tipo','conflicto_concurrente','titulo','EXCLUDE constraint')));
  END;
  RETURN jsonb_build_object('ok',true,'tabla','servicios');
END; $$;
REVOKE ALL ON FUNCTION public.confirm_transport_service(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_transport_service(uuid,uuid) TO PUBLIC;

-- ── Datos de test ──────────────────────────────────────────────────────────────
INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000001')  -- owner
ON CONFLICT DO NOTHING;

INSERT INTO public.trade_organizations (id, name, owner_id, transport_enabled, transport_modalidad) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'OrgCombinada', '00000000-0000-0000-0000-000000000001', true, 'combinada');

-- Vehículos: mixto (sirve para viajeros y mercancías) y mercancias puro
INSERT INTO public.trade_vehicles (id, org_id, matricula, modalidad, activo, capacidad_viajeros) VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'MIXT-001', 'mixto',      true, 8),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'MERC-001', 'mercancias', true, NULL),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'VIAJ-001', 'viajeros',   true, 12);

-- Conductores
INSERT INTO public.trade_workers (id, org_id, nombre, es_conductor, activo) VALUES
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Conductor A', true, true),
  ('cccccccc-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Conductor B', true, true);

-- ── SCENARIO CONC-01A: Trip vs Service (mismo vehículo mixto, mismo conductor) ──
-- Trip T1: MIXT-001 + Conductor A, 2030-01-15 08:00-16:00
INSERT INTO public.trade_transport_trips (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id) VALUES
  ('11111111-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'CONC01-Trip', 'Madrid', 'Barcelona',
   '2030-01-15 08:00:00+00', '2030-01-15 16:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001');

-- Service S1: MIXT-001 + Conductor A, 2030-01-15 10:00-18:00 (solapante)
INSERT INTO public.trade_transport_services (id, org_id, titulo, fecha_inicio, fecha_fin, vehicle_id, conductor_id) VALUES
  ('22222222-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
   'CONC01-Service',
   '2030-01-15 10:00:00+00', '2030-01-15 18:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001');

-- ── SCENARIO CONC-02: Conductor compartido, vehículos distintos ───────────────
-- Trip T2: MERC-001 + Conductor A, 2030-02-10 08:00-16:00
INSERT INTO public.trade_transport_trips (id, org_id, titulo, origen, destino, fecha_inicio, fecha_fin, vehicle_id, conductor_id) VALUES
  ('11111111-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'CONC02-Trip', 'Sevilla', 'Bilbao',
   '2030-02-10 08:00:00+00', '2030-02-10 16:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000002',  -- MERC-001
   'cccccccc-0000-0000-0000-000000000001'); -- Conductor A

-- Service S2: VIAJ-001 + Conductor A, 2030-02-10 10:00-18:00 (distinto vehículo, mismo conductor)
INSERT INTO public.trade_transport_services (id, org_id, titulo, fecha_inicio, fecha_fin, vehicle_id, conductor_id) VALUES
  ('22222222-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
   'CONC02-Service',
   '2030-02-10 10:00:00+00', '2030-02-10 18:00:00+00',
   'bbbbbbbb-0000-0000-0000-000000000003',  -- VIAJ-001
   'cccccccc-0000-0000-0000-000000000001'); -- Conductor A (mismo)

-- ── Bypass protection triggers (migration 20261102120000) ─────────────────────
CREATE OR REPLACE FUNCTION public._prevent_direct_trip_confirmation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.estado = 'confirmado' AND OLD.estado <> 'confirmado' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: confirmación directa no permitida; use confirm_transport_trip().'
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
      RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: confirmación directa no permitida; use confirm_transport_service().'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public._prevent_direct_service_confirmation() FROM PUBLIC;
CREATE TRIGGER trg_tts_block_direct_confirmation
  BEFORE UPDATE OF estado ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._prevent_direct_service_confirmation();

-- Rol para test authenticated (con grants equivalentes a Supabase producción)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'CREATE ROLE authenticated';
  END IF;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_transport_trips    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trade_transport_services TO authenticated;
GRANT SELECT ON public.trade_organizations TO authenticated;
GRANT SELECT ON public.trade_vehicles      TO authenticated;
GRANT SELECT ON public.trade_workers       TO authenticated;

-- ── Tabla de resultados para los workers ─────────────────────────────────────
CREATE TABLE public.conc_results (
  scenario  text,
  direction text,
  worker    text,
  result    jsonb,
  ts        timestamptz DEFAULT now()
);
GRANT ALL ON public.conc_results TO PUBLIC;

\echo 'SETUP COMPLETE'
\echo 'Run: scripts/tx-mc1-concurrent-runner.ps1'
