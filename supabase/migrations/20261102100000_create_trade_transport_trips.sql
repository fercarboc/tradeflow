-- TX-MC-1: trade_transport_trips — Gestión operativa de viajes de mercancías
-- Entidad separada de trade_transport_services (Viajeros).
-- FSM: borrador → confirmado → en_curso → completado | cancelado
-- Vehículos válidos: mercancias | reparto | mixto (NOT viajeros).
-- Cross-table overlap (ambas direcciones) resuelto mediante SELECT FOR UPDATE
-- sobre trade_vehicles/trade_workers antes de comprobar disponibilidad.
-- Ver también migration 20261102110000 que parchea confirm_transport_service.
--
-- PREDEPLOY SECURITY REVIEW (2026-11-02):
--   P0-1: EXCLUDE reescrito como ADD CONSTRAINT EXCLUDE USING gist (sintaxis correcta)
--   P0-2: EXCLUDE sin COALESCE; fecha_fin IS NOT NULL en WHERE (STABLE workaround PG17)
--   P0-3: RLS corregido: col rol (no role), añadido activo=true
--   P0-4: FK compuestas DEFERRABLE en lugar de CHECK subqueries
--   P0-CONCURRENCIA: SELECT FOR UPDATE vehicle→conductor (stable order) en confirm RPC
--   P1-A: transport_enabled + permission checks en confirm/complete RPCs
--   P1-B: REVOKE ALL ON FUNCTION FROM PUBLIC en funciones internas
--   P1-C: Trigger operacional completo (activo, es_conductor, fecha_fin)
--   P1-D: Trigger org_id inmutabilidad
--   P1-E: fecha_fin obligatoria cuando recursos asignados al confirmar
--   P1-F: EXCEPTION WHEN exclusion_violation en confirm_transport_trip
--   P1-G: transport_modalidad check (org debe ser mercancias|reparto|combinada)
--   P1-H: Trigger _protect_confirmed_trip_fields (campos inmutables en confirmado/en_curso)

-- ── Extensión btree_gist (ya activa desde trade_transport_services) ──────────
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Tipo de carga ─────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_carga_mercancias') THEN
    CREATE TYPE public.tipo_carga_mercancias AS ENUM (
      'paletizado',
      'carga_general',
      'frigorifica',
      'peligrosas',
      'especial',
      'otro'
    );
  END IF;
END $$;

-- ── Tabla principal ────────────────────────────────────────────────────────────

CREATE TABLE public.trade_transport_trips (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,

  -- Referencia humana y título
  referencia    text,
  titulo        text NOT NULL CHECK (char_length(trim(titulo)) >= 1),

  -- Ruta
  origen        text NOT NULL,
  destino       text NOT NULL,

  -- Fechas
  fecha_inicio  timestamptz NOT NULL,
  fecha_fin     timestamptz,

  -- Recursos asignados — FK compuestas garantizan pertenencia a la misma org.
  -- DEFERRABLE para permitir inserts con referencias que se resuelven al final de la tx.
  vehicle_id    uuid,
  conductor_id  uuid,

  -- Carga
  tipo_carga    public.tipo_carga_mercancias NOT NULL DEFAULT 'carga_general',
  peso_kg       numeric(10,2),
  volumen_m3    numeric(8,3),
  num_bultos    int,

  -- Comercial
  precio_acordado numeric(10,2),
  cliente_nombre  text,
  observaciones   text,

  -- Estado FSM
  estado        text NOT NULL DEFAULT 'borrador'
                CHECK (estado IN ('borrador','confirmado','en_curso','completado','cancelado')),

  -- Parte real (post-cierre)
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

  -- Odómetro
  odometro_inicio    int,
  odometro_final     int,

  -- Auditoría
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- FK compuestas: vehicle y conductor deben pertenecer a la misma org.
  -- trade_vehicles(org_id, id) y trade_workers(org_id, id) tienen UNIQUE ya creado
  -- en 20261023150000_create_trade_transport_services.sql.
  CONSTRAINT ttt_vehicle_org_fk FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  CONSTRAINT ttt_conductor_org_fk FOREIGN KEY (org_id, conductor_id)
    REFERENCES public.trade_workers(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  -- fecha_fin > fecha_inicio
  CONSTRAINT ttt_fecha_orden CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio),

  -- precio no negativo
  CONSTRAINT ttt_precio_positivo CHECK (precio_acordado IS NULL OR precio_acordado >= 0)
);

-- ── Índices de consulta ───────────────────────────────────────────────────────

CREATE INDEX idx_ttt_org_fecha ON public.trade_transport_trips (org_id, fecha_inicio DESC);
CREATE INDEX idx_ttt_org_estado ON public.trade_transport_trips (org_id, estado);
CREATE INDEX idx_ttt_vehicle ON public.trade_transport_trips (vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_ttt_conductor ON public.trade_transport_trips (conductor_id) WHERE conductor_id IS NOT NULL;

-- ── EXCLUDE constraints (within-table concurrent overlap) ─────────────────────
-- DISEÑO igual que trade_transport_services:
--   - Sin COALESCE: `timestamptz + interval` es STABLE en PostgreSQL 17 (no IMMUTABLE),
--     lo que impediría crear el índice GiST. Se usa fecha_fin explícita.
--   - WHERE fecha_fin IS NOT NULL: garantiza que el índice solo opera sobre rangos cerrados.
--   - El trigger _validate_transport_trip_operational impone fecha_fin IS NOT NULL
--     cuando se confirma un viaje con vehículo o conductor asignados.

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

-- ── Trigger updated_at ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._update_transport_trip_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._update_transport_trip_timestamp() FROM PUBLIC;

CREATE TRIGGER trg_transport_trip_updated_at
  BEFORE UPDATE ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._update_transport_trip_timestamp();

-- ── FSM trigger ────────────────────────────────────────────────────────────────
-- Transiciones válidas: borrador→confirmado|cancelado,
--   confirmado→en_curso|cancelado, en_curso→completado|cancelado.

CREATE OR REPLACE FUNCTION public._validate_transport_trip_fsm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

  CASE OLD.estado
    WHEN 'borrador' THEN
      IF NEW.estado NOT IN ('confirmado','cancelado') THEN
        RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de borrador solo se puede pasar a confirmado o cancelado';
      END IF;
    WHEN 'confirmado' THEN
      IF NEW.estado NOT IN ('en_curso','cancelado') THEN
        RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de confirmado solo se puede pasar a en_curso o cancelado';
      END IF;
    WHEN 'en_curso' THEN
      IF NEW.estado NOT IN ('completado','cancelado') THEN
        RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: de en_curso solo se puede pasar a completado o cancelado';
      END IF;
    WHEN 'completado' THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje completado es un estado terminal';
    WHEN 'cancelado' THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un viaje cancelado es un estado terminal';
    ELSE
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado desconocido: %', OLD.estado;
  END CASE;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_transport_trip_fsm() FROM PUBLIC;

CREATE TRIGGER trg_transport_trip_fsm
  BEFORE UPDATE OF estado ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_fsm();

-- ── Trigger: org_id inmutable ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._prevent_transport_trip_org_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: org_id de un viaje de transporte es inmutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._prevent_transport_trip_org_change() FROM PUBLIC;

CREATE TRIGGER trg_ttt_immutable_org
  BEFORE UPDATE OF org_id ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._prevent_transport_trip_org_change();

-- ── Trigger: validación operacional de recursos ───────────────────────────────
-- Garantiza que ningún viaje confirmado/en_curso persista con:
--   · transport_enabled = false en la org
--   · fecha_fin = NULL cuando hay vehículo o conductor asignado
--     (requerido para que los EXCLUDE constraints operen sobre rangos cerrados)
--   · Vehículo inactivo o con modalidad incompatible (solo mercancias/reparto/mixto)
--   · Conductor sin es_conductor=true o inactivo
-- Aplica en INSERT y en UPDATE de campos relevantes.

CREATE OR REPLACE FUNCTION public._validate_transport_trip_operational()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vehicle public.trade_vehicles;
  v_worker  public.trade_workers;
BEGIN
  -- Solo valida cuando el estado resultante sea confirmado o en_curso
  IF NEW.estado NOT IN ('confirmado','en_curso') THEN
    RETURN NEW;
  END IF;

  -- transport_enabled obligatorio
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
    WHERE id = NEW.org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- fecha_fin obligatoria cuando hay recursos asignados
  -- (necesario para que EXCLUDE constraints funcionen con tstzrange cerrado)
  IF (NEW.vehicle_id IS NOT NULL OR NEW.conductor_id IS NOT NULL) AND NEW.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un viaje con vehículo o conductor asignados';
  END IF;

  -- Validez del vehículo
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles
    WHERE id = NEW.vehicle_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización';
    END IF;
    IF NOT v_vehicle.activo THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)';
    END IF;
    IF v_vehicle.modalidad NOT IN ('mercancias', 'reparto', 'mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para mercancías (modalidad: %)', v_vehicle.modalidad;
    END IF;
  END IF;

  -- Validez del conductor
  IF NEW.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker FROM public.trade_workers
    WHERE id = NEW.conductor_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no pertenece a esta organización';
    END IF;
    IF NOT COALESCE(v_worker.es_conductor, false) THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el trabajador asignado no está habilitado como conductor (es_conductor = false)';
    END IF;
    IF v_worker.activo IS NOT DISTINCT FROM false THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el conductor asignado no está activo';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_transport_trip_operational() FROM PUBLIC;

CREATE TRIGGER trg_ttt_validate_operational
  BEFORE INSERT OR UPDATE OF estado, vehicle_id, conductor_id
  ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_trip_operational();

-- ── Trigger: campos clave inmutables en confirmado/en_curso ───────────────────
-- Una vez confirmado o iniciado, vehicle_id, conductor_id, fecha_inicio y
-- fecha_fin no pueden modificarse mediante UPDATE directo.
-- Propósito: garantizar que los EXCLUDE constraints y los locks del RPC
-- no puedan eludirse cambiando los campos después de la confirmación.
-- Para replanificar: cancelar el viaje y crear uno nuevo.

CREATE OR REPLACE FUNCTION public._protect_confirmed_trip_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado NOT IN ('confirmado', 'en_curso') THEN
    RETURN NEW;
  END IF;
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin no puede modificarse en estado %. Cancela el viaje y crea uno nuevo.', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._protect_confirmed_trip_fields() FROM PUBLIC;

CREATE TRIGGER trg_ttt_protect_confirmed_fields
  BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin
  ON public.trade_transport_trips
  FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_trip_fields();

-- ── Protección de viaje completado (inmutable tras completar) ─────────────────

CREATE OR REPLACE FUNCTION public._protect_completed_transport_trip()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'El viaje % ya está completado y no puede modificarse', OLD.id;
END;
$$;

REVOKE ALL ON FUNCTION public._protect_completed_transport_trip() FROM PUBLIC;

CREATE TRIGGER trg_protect_completed_trip
  BEFORE UPDATE ON public.trade_transport_trips
  FOR EACH ROW
  WHEN (OLD.estado = 'completado')
  EXECUTE FUNCTION public._protect_completed_transport_trip();

-- ── RPC: confirm_transport_trip ────────────────────────────────────────────────
-- Diseño en capas (igual que confirm_transport_service):
--   1. transport_enabled: la org debe tener el módulo activo.
--   2. Permisos: solo owner/admin pueden confirmar.
--   3. Bloqueo FOR UPDATE del viaje.
--   4. Validación de estado (solo borrador).
--   5. fecha_fin obligatoria cuando hay recursos asignados.
--   6. Detección informativa de conflictos cross-table en trade_transport_services
--      (vehículos/conductores mixto en orgs combinadas).
--   7. UPDATE a confirmado; EXCLUDE constraints actúan como backstop atómico
--      para confirmaciones concurrentes dentro de la misma tabla.
--
-- CONCURRENCIA CROSS-TABLE (RESUELTA — paso 3c):
--   Ambas RPCs (confirm_transport_trip y confirm_transport_service) adquieren
--   SELECT FOR UPDATE sobre trade_vehicles → trade_workers en ese orden ANTES
--   de los checks de disponibilidad. Bajo READ COMMITTED, el segundo confirm
--   que comparta un recurso mixto bloquea en el lock hasta que el primero
--   commitea, y luego ve el estado confirmado en su lectura cross-table.
--   Orden estable en ambas RPCs → sin deadlocks posibles.

CREATE OR REPLACE FUNCTION public.confirm_transport_trip(
  p_trip_id uuid,
  p_org_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip          public.trade_transport_trips%ROWTYPE;
  v_org_modalidad text;
  v_conflicts     jsonb := '[]'::jsonb;
  v_svc_conflict  record;
  v_range         tstzrange;
BEGIN
  -- 1. transport_enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
    WHERE id = p_org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- 2. Permisos: owner o admin activo
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
      WHERE org_id = p_org_id AND user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este viaje';
  END IF;

  -- 3. Bloquear el viaje para actualización atómica
  SELECT * INTO v_trip
  FROM public.trade_transport_trips
  WHERE id = p_trip_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: viaje no encontrado';
  END IF;

  IF v_trip.estado <> 'borrador' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se pueden confirmar viajes en borrador (estado actual: %)', v_trip.estado;
  END IF;

  -- 3b. Modalidad: la org debe tener operativa de mercancías autorizada.
  -- transport_modalidad valores: viajeros | mercancias | reparto | combinada.
  -- Una org viajeros pura no puede operar viajes de mercancías.
  SELECT transport_modalidad INTO v_org_modalidad
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF COALESCE(v_org_modalidad, '') NOT IN ('mercancias', 'reparto', 'combinada') THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: organización sin modalidad de mercancías (transport_modalidad: %)',
      COALESCE(v_org_modalidad, 'nula');
  END IF;

  -- 3c. Bloqueo transaccional de recursos — SELECT FOR UPDATE (orden estable: vehicle → conductor).
  --
  -- MECANISMO: adquirir lock exclusivo sobre las filas de trade_vehicles y trade_workers
  -- ANTES de comprobar disponibilidad. confirm_transport_service (migration 20261102110000)
  -- aplica el MISMO ORDEN. Resultado: dos confirms simultáneos sobre el mismo recurso
  -- se serializan; el segundo verá el conflicto tras desbloquearse.
  --
  -- AUSENCIA DE DEADLOCK: el orden de adquisición (vehicle primero, conductor después)
  -- es idéntico en ambas RPCs. Imposible que TX1 tenga vehicle y espere conductor
  -- mientras TX2 tiene conductor y espera vehicle.
  --
  -- GRANULARIDAD: el lock es por fila de recurso. Una org con N vehículos puede
  -- confirmar N viajes en paralelo siempre que no compartan recursos.
  IF v_trip.vehicle_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_vehicles WHERE id = v_trip.vehicle_id FOR UPDATE;
  END IF;
  IF v_trip.conductor_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_workers WHERE id = v_trip.conductor_id FOR UPDATE;
  END IF;

  -- 4. fecha_fin obligatoria cuando hay recursos asignados
  IF (v_trip.vehicle_id IS NOT NULL OR v_trip.conductor_id IS NOT NULL) AND v_trip.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un viaje con vehículo o conductor asignados';
  END IF;

  -- 5. Rango temporal del viaje (solo si fecha_fin IS NOT NULL)
  IF v_trip.fecha_fin IS NOT NULL THEN
    v_range := tstzrange(v_trip.fecha_inicio, v_trip.fecha_fin, '[)');
  END IF;

  -- 6. Solapamiento cross-table en trade_transport_services (vehículos mixto / orgs combinadas)
  IF v_trip.vehicle_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin
      FROM public.trade_transport_services
      WHERE org_id = p_org_id
        AND vehicle_id = v_trip.vehicle_id
        AND estado IN ('confirmado', 'en_curso')
        AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'tipo',         'vehiculo',
        'id',           v_svc_conflict.id,
        'titulo',       v_svc_conflict.titulo,
        'fecha_inicio', v_svc_conflict.fecha_inicio,
        'fecha_fin',    v_svc_conflict.fecha_fin,
        'tabla',        'servicios'
      );
    END LOOP;
  END IF;

  IF v_trip.conductor_id IS NOT NULL AND v_trip.fecha_fin IS NOT NULL THEN
    FOR v_svc_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin
      FROM public.trade_transport_services
      WHERE org_id = p_org_id
        AND conductor_id = v_trip.conductor_id
        AND estado IN ('confirmado', 'en_curso')
        AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'tipo',         'conductor',
        'id',           v_svc_conflict.id,
        'titulo',       v_svc_conflict.titulo,
        'fecha_inicio', v_svc_conflict.fecha_inicio,
        'fecha_fin',    v_svc_conflict.fecha_fin,
        'tabla',        'servicios'
      );
    END LOOP;
  END IF;

  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
  END IF;

  -- 7. Confirmar; EXCLUDE constraint es el backstop para confirmaciones concurrentes
  BEGIN
    UPDATE public.trade_transport_trips
    SET estado = 'confirmado'
    WHERE id = p_trip_id AND org_id = p_org_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'conflictos', jsonb_build_array(jsonb_build_object(
          'tipo',         'conflicto_concurrente',
          'id',           NULL,
          'titulo',       'Conflicto detectado: recurso confirmado simultáneamente por otra sesión',
          'fecha_inicio', v_trip.fecha_inicio,
          'fecha_fin',    v_trip.fecha_fin,
          'tabla',        'viajes'
        ))
      );
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_transport_trip(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_transport_trip(uuid, uuid) TO authenticated;

-- ── RPC: complete_transport_trip ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_transport_trip(
  p_trip_id uuid,
  p_org_id  uuid,
  p_parte   jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trade_transport_trips%ROWTYPE;
BEGIN
  -- 1. transport_enabled
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
    WHERE id = p_org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- 2. Permisos: owner o admin activo
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
      WHERE org_id = p_org_id AND user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para completar este viaje';
  END IF;

  -- 3. Bloquear fila
  SELECT * INTO v_trip
  FROM public.trade_transport_trips
  WHERE id = p_trip_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: viaje no encontrado';
  END IF;

  IF v_trip.estado <> 'en_curso' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se puede completar un viaje en_curso (estado actual: %)', v_trip.estado;
  END IF;

  UPDATE public.trade_transport_trips
  SET
    estado               = 'completado',
    hora_real_salida     = COALESCE((p_parte->>'hora_real_salida')::timestamptz, hora_real_salida),
    hora_real_llegada    = COALESCE((p_parte->>'hora_real_llegada')::timestamptz, hora_real_llegada),
    km_inicio            = COALESCE((p_parte->>'km_inicio')::int, km_inicio),
    km_fin               = COALESCE((p_parte->>'km_fin')::int, km_fin),
    odometro_inicio      = COALESCE((p_parte->>'odometro_inicio')::int, odometro_inicio),
    odometro_final       = COALESCE((p_parte->>'odometro_final')::int, odometro_final),
    incidencias          = COALESCE(p_parte->>'incidencias', incidencias),
    observaciones_cierre = COALESCE(p_parte->>'observaciones_cierre', observaciones_cierre),
    cerrado_at           = now(),
    cerrado_por          = auth.uid()
  WHERE id = p_trip_id AND org_id = p_org_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transport_trip(uuid, uuid, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.complete_transport_trip(uuid, uuid, jsonb) TO authenticated;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_transport_trips ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la organización (patrón igual que trade_transport_services)
CREATE POLICY "trips_select_org_members" ON public.trade_transport_trips
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- INSERT: propietario o admin activo
CREATE POLICY "trips_insert_org_admin" ON public.trade_transport_trips
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  );

-- UPDATE: propietario o admin activo
CREATE POLICY "trips_update_org_admin" ON public.trade_transport_trips
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  );

-- Sin DELETE físico (usar cancelado)
