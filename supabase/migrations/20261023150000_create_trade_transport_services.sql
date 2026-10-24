
-- ══════════════════════════════════════════════════════════════════════
-- TRANSPORT-T1-A — Servicios puntuales de transporte de viajeros
-- ══════════════════════════════════════════════════════════════════════

-- btree_gist: permite usar UUID en operadores GiST para constraints EXCLUDE.
-- Necesario para tts_no_vehicle_overlap y tts_no_conductor_overlap.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ── Prerrequisitos: UNIQUE(org_id, id) para FK compuestas ────────────
-- Necesarios para garantizar integridad multitenant en la tabla de
-- servicios sin depender únicamente de filtros en capa de aplicación.
-- La restricción es siempre cierta (id es PK global) y añade un índice
-- que también acelera consultas filtradas por org_id.

DO $$ BEGIN
  ALTER TABLE public.trade_workers  ADD CONSTRAINT trade_workers_org_id_id_key  UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.trade_vehicles ADD CONSTRAINT trade_vehicles_org_id_id_key UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.trade_quotes   ADD CONSTRAINT trade_quotes_org_id_id_key   UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

-- trade_clients ya tiene ADD CONSTRAINT trade_clients_org_id_id_key
-- desde migration 20260906132829_client_locations_m1.sql

-- ── Tabla principal ───────────────────────────────────────────────────
-- Entidad separada de trade_jobs: origen/destino, num_viajeros, km,
-- asignación directa vehículo+conductor, precio cerrado, paradas JSONB.
-- Soporta servicios que cruzan medianoche (fecha_fin puede ser > fecha_inicio).

CREATE TABLE public.trade_transport_services (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,

  -- Orígenes opcionales (composite FK garantiza same-org)
  quote_id          uuid,
  client_id         uuid,

  -- Descripción
  titulo            text        NOT NULL,
  tipo_servicio     text        NOT NULL DEFAULT 'excursion'
                                CHECK (tipo_servicio IN (
                                  'ruta_escolar','excursion','traslado_empresa',
                                  'traslado_privado','aeropuerto','otro')),

  -- Estado operativo: borrador → confirmado → en_curso → completado
  estado            text        NOT NULL DEFAULT 'borrador'
                                CHECK (estado IN (
                                  'borrador','confirmado','en_curso',
                                  'completado','cancelado')),

  -- Programación (timestamptz soporta cruce de medianoche y zonas horarias)
  fecha_inicio      timestamptz NOT NULL,
  fecha_fin         timestamptz,

  -- Ruta
  origen            text,
  destino           text,
  -- Paradas: [{nombre: string, hora?: "HH:MM", direccion?: string}]
  -- El trigger _validate_transport_stops verifica el formato antes de INSERT/UPDATE.
  paradas           jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Capacidad
  num_viajeros      int         CHECK (num_viajeros IS NULL OR num_viajeros > 0),

  -- Asignación (composite FK: garantiza vehicle/conductor pertenecen a org_id)
  vehicle_id        uuid,
  conductor_id      uuid,

  -- Económico (precio comercial cerrado; NO genera factura ni IVA automático)
  precio_acordado   numeric(10,2) CHECK (precio_acordado IS NULL OR precio_acordado >= 0),

  -- Notas
  observaciones     text,

  -- Auditoría
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- ── Integridad multitenant mediante FK compuestas ─────────────────
  -- Si quote_id/client_id/vehicle_id/conductor_id son no nulos,
  -- deben pertenecer a la misma org_id que el servicio.
  CONSTRAINT tts_quote_org_fk    FOREIGN KEY (org_id, quote_id)
    REFERENCES public.trade_quotes(org_id, id)   ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_client_org_fk   FOREIGN KEY (org_id, client_id)
    REFERENCES public.trade_clients(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_vehicle_org_fk  FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT tts_conductor_org_fk FOREIGN KEY (org_id, conductor_id)
    REFERENCES public.trade_workers(org_id, id)  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,

  -- fecha_fin debe ser posterior a fecha_inicio si se indica
  CONSTRAINT tts_fecha_coherente CHECK (fecha_fin IS NULL OR fecha_fin > fecha_inicio)
);

CREATE INDEX idx_tts_org_fecha    ON public.trade_transport_services(org_id, fecha_inicio);
CREATE INDEX idx_tts_estado       ON public.trade_transport_services(org_id, estado);
CREATE INDEX idx_tts_vehicle      ON public.trade_transport_services(vehicle_id)    WHERE vehicle_id IS NOT NULL;
CREATE INDEX idx_tts_conductor    ON public.trade_transport_services(conductor_id)  WHERE conductor_id IS NOT NULL;
CREATE INDEX idx_tts_client       ON public.trade_transport_services(org_id, client_id) WHERE client_id IS NOT NULL;

-- ── Constraints de exclusión: sin solapamiento de recursos ────────────
-- Impide que dos servicios confirmados/en_curso compartan vehículo o conductor
-- en el mismo intervalo. Aplica también a cambios de vehicle_id/conductor_id
-- post-confirmación. Require btree_gist para indexar UUID con '=' en GiST.
--
-- DISEÑO: se usa tstzrange(fecha_inicio, fecha_fin, '[)') sin COALESCE.
-- La expresión `timestamptz + interval` es STABLE (no IMMUTABLE) en PostgreSQL 17,
-- lo que impediría crear el índice GiST. En su lugar se exige fecha_fin explícita
-- para todo servicio confirmado/en_curso que tenga recursos asignados.
-- La cláusula WHERE filtra solo filas con fecha_fin IS NOT NULL, garantizando
-- que el índice nunca indexa rangos abiertos ni llama a funciones STABLE.
-- Los servicios sin vehículo ni conductor pueden tener fecha_fin NULL (sin reserva
-- efectiva de recurso, no generan exclusión).

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_no_vehicle_overlap
  EXCLUDE USING gist (
    vehicle_id   WITH =,
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

-- ── Trigger: updated_at ───────────────────────────────────────────────

CREATE OR REPLACE TRIGGER trg_tts_updated
  BEFORE UPDATE ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- ── Trigger: validación de paradas JSONB ─────────────────────────────
-- Acepta [] o [{nombre: string, hora?: "HH:MM", direccion?: string}].
-- Rechaza filas sin nombre en cada parada o con hora en formato inválido.

CREATE OR REPLACE FUNCTION public._validate_transport_stops()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parada jsonb;
  hora_val text;
BEGIN
  IF jsonb_typeof(NEW.paradas) <> 'array' THEN
    RAISE EXCEPTION 'TRANSPORT_STOPS_INVALID: paradas debe ser un array JSON';
  END IF;
  FOR parada IN SELECT * FROM jsonb_array_elements(NEW.paradas)
  LOOP
    IF parada->>'nombre' IS NULL OR trim(parada->>'nombre') = '' THEN
      RAISE EXCEPTION 'TRANSPORT_STOPS_INVALID: cada parada requiere un campo "nombre" no vacío';
    END IF;
    hora_val := parada->>'hora';
    IF hora_val IS NOT NULL AND hora_val !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
      RAISE EXCEPTION 'TRANSPORT_STOPS_INVALID: campo "hora" debe estar en formato HH:MM (ej. "08:30")';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_transport_stops() FROM PUBLIC;

CREATE TRIGGER trg_tts_validate_stops
  BEFORE INSERT OR UPDATE OF paradas ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_stops();

-- ── Trigger: máquina de estados ──────────────────────────────────────
-- Transiciones válidas:
--   borrador   → confirmado | cancelado
--   confirmado → en_curso   | cancelado
--   en_curso   → completado | cancelado
--   completado → (terminal)
--   cancelado  → (terminal)

CREATE OR REPLACE FUNCTION public._validate_transport_state_machine()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- En INSERT no hay OLD; el CHECK de columna ya valida los valores.
  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  -- Sin cambio de estado: no hay nada que validar.
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
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un servicio completado es un estado terminal';
    WHEN 'cancelado' THEN
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: un servicio cancelado es un estado terminal';
    ELSE
      RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: estado desconocido: %', OLD.estado;
  END CASE;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._validate_transport_state_machine() FROM PUBLIC;

CREATE TRIGGER trg_tts_state_machine
  BEFORE UPDATE OF estado ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_state_machine();

-- ── Trigger: org_id inmutable ─────────────────────────────────────────
-- Impide mover un servicio a otra org aunque el usuario sea owner/admin de ambas.

CREATE OR REPLACE FUNCTION public._prevent_transport_service_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.org_id <> OLD.org_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: org_id de un servicio de transporte es inmutable';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._prevent_transport_service_org_change() FROM PUBLIC;

CREATE TRIGGER trg_tts_immutable_org
  BEFORE UPDATE OF org_id ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._prevent_transport_service_org_change();

-- ── Trigger: validación operacional de recursos ───────────────────────
-- Garantiza a nivel de DB que ningún servicio confirmado o en_curso persista con:
--   · Vehículo inactivo o sin modalidad viajeros/mixto o capacidad insuficiente
--   · Conductor inactivo o sin es_conductor=true
--   · Organización con transport_enabled=false
-- Aplica en INSERT y en UPDATE de los campos relevantes, cubriendo el UPDATE
-- directo que no pase por el RPC (owner/admin autorizados por RLS).
-- Limitación documentada: si un vehículo o conductor se desactiva DESPUÉS de
-- que el servicio ya estaba confirmado, el servicio existente no se invalida
-- automáticamente. Solo nuevas transiciones o cambios de recurso son bloqueados.

CREATE OR REPLACE FUNCTION public._validate_transport_service_operational()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vehicle public.trade_vehicles;
  v_worker  public.trade_workers;
BEGIN
  -- Solo valida cuando el estado resultante sea confirmado o en_curso
  IF NEW.estado NOT IN ('confirmado','en_curso') THEN
    RETURN NEW;
  END IF;

  -- transport_enabled: requerido para cualquier escritura sobre servicio confirmado/en_curso,
  -- incluidos cambios de recurso (vehicle_id, conductor_id, num_viajeros) sin cambio de estado.
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = NEW.org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- fecha_fin obligatoria cuando hay recursos asignados en estado confirmado/en_curso.
  -- Garantiza que los EXCLUDE constraints (que usan tstzrange(fecha_inicio, fecha_fin, '[)'))
  -- siempre operen sobre rangos cerrados y nunca indexen un extremo abierto.
  IF (NEW.vehicle_id IS NOT NULL OR NEW.conductor_id IS NOT NULL) AND NEW.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un servicio con vehículo o conductor asignados';
  END IF;

  -- Validez del vehículo asignado
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.trade_vehicles
     WHERE id = NEW.vehicle_id AND org_id = NEW.org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización';
    END IF;
    IF NOT v_vehicle.activo THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)';
    END IF;
    IF v_vehicle.modalidad NOT IN ('viajeros','mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para viajeros (modalidad: %)', v_vehicle.modalidad;
    END IF;
    IF NEW.num_viajeros IS NOT NULL
       AND v_vehicle.capacidad_viajeros IS NOT NULL
       AND NEW.num_viajeros > v_vehicle.capacidad_viajeros THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: capacidad insuficiente — solicitados: %, capacidad vehículo: %',
        NEW.num_viajeros, v_vehicle.capacidad_viajeros;
    END IF;
  END IF;

  -- Validez del conductor asignado
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

REVOKE ALL ON FUNCTION public._validate_transport_service_operational() FROM PUBLIC;

CREATE TRIGGER trg_tts_validate_operational
  BEFORE INSERT OR UPDATE OF estado, vehicle_id, conductor_id, num_viajeros
  ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._validate_transport_service_operational();

-- ── RLS ───────────────────────────────────────────────────────────────

ALTER TABLE public.trade_transport_services ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la organización
CREATE POLICY "tts_select" ON public.trade_transport_services
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- INSERT: propietario o admin
CREATE POLICY "tts_insert" ON public.trade_transport_services
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin') AND activo = true
    )
  );

-- UPDATE: propietario o admin (la cancelación es un UPDATE de estado)
CREATE POLICY "tts_update" ON public.trade_transport_services
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

-- DELETE: sin política → denegado para todos los usuarios autenticados.
-- Cancelar = UPDATE estado a 'cancelado'.

-- ── RPC: confirmación con validaciones y backstop de exclusión ────────
-- Diseño en capas:
--   1. transport_enabled: la org debe tener el módulo activo.
--   2. Permisos: solo owner/admin pueden confirmar.
--   3. Validez del vehículo y conductor (activo, modalidad, capacidad, es_conductor).
--   4. Detección informativa de conflictos → devuelve {ok:false, conflictos:[...]} con detalle.
--   5. UPDATE confirmado con EXCEPTION exclusion_violation como backstop atómico.
--      Los EXCLUDE constraints tts_no_vehicle_overlap y tts_no_conductor_overlap impiden
--      la race condition de dos confirmaciones simultáneas y cualquier cambio post-confirmación
--      que introduzca un solapamiento.

CREATE OR REPLACE FUNCTION public.confirm_transport_service(
  p_service_id uuid,
  p_org_id     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_svc       public.trade_transport_services;
  v_vehicle   public.trade_vehicles;
  v_worker    public.trade_workers;
  v_conflicts jsonb;
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
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este servicio';
  END IF;

  -- 3. Cargar y bloquear fila del servicio
  SELECT * INTO v_svc
    FROM public.trade_transport_services
   WHERE id = p_service_id AND org_id = p_org_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: servicio no encontrado';
  END IF;
  IF v_svc.estado <> 'borrador' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se pueden confirmar servicios en borrador (estado actual: %)', v_svc.estado;
  END IF;

  -- 4a. Validez del vehículo
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle
      FROM public.trade_vehicles
     WHERE id = v_svc.vehicle_id AND org_id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no pertenece a esta organización';
    END IF;
    IF NOT v_vehicle.activo THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo asignado no está operativo (activo = false)';
    END IF;
    IF v_vehicle.modalidad NOT IN ('viajeros','mixto') THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: el vehículo no es apto para viajeros (modalidad: %)', v_vehicle.modalidad;
    END IF;
    IF v_svc.num_viajeros IS NOT NULL
       AND v_vehicle.capacidad_viajeros IS NOT NULL
       AND v_svc.num_viajeros > v_vehicle.capacidad_viajeros THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: capacidad insuficiente — solicitados: %, capacidad vehículo: %',
        v_svc.num_viajeros, v_vehicle.capacidad_viajeros;
    END IF;
  END IF;

  -- 4b. Validez del conductor
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT * INTO v_worker
      FROM public.trade_workers
     WHERE id = v_svc.conductor_id AND org_id = p_org_id;
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

  -- 4c. fecha_fin obligatoria cuando hay recursos asignados
  IF (v_svc.vehicle_id IS NOT NULL OR v_svc.conductor_id IS NOT NULL) AND v_svc.fecha_fin IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: se requiere fecha_fin para confirmar un servicio con vehículo o conductor asignados';
  END IF;

  -- 5. Detección informativa de conflictos de vehículo
  --    (el EXCLUDE constraint es el enforcement real; este bloque mejora el mensaje de error)
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'tipo',        'vehiculo',
      'id',          id,
      'titulo',      titulo,
      'fecha_inicio', fecha_inicio,
      'fecha_fin',   fecha_fin
    ))
    INTO v_conflicts
    FROM public.trade_transport_services
    WHERE vehicle_id   = v_svc.vehicle_id
      AND id          <> p_service_id
      AND estado      IN ('confirmado','en_curso')
      AND fecha_inicio < COALESCE(v_svc.fecha_fin, v_svc.fecha_inicio + interval '4 hours')
      AND COALESCE(fecha_fin, fecha_inicio + interval '4 hours') > v_svc.fecha_inicio;
    IF v_conflicts IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
    END IF;
  END IF;

  -- 6. Detección informativa de conflictos de conductor
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'tipo',        'conductor',
      'id',          id,
      'titulo',      titulo,
      'fecha_inicio', fecha_inicio,
      'fecha_fin',   fecha_fin
    ))
    INTO v_conflicts
    FROM public.trade_transport_services
    WHERE conductor_id = v_svc.conductor_id
      AND id          <> p_service_id
      AND estado      IN ('confirmado','en_curso')
      AND fecha_inicio < COALESCE(v_svc.fecha_fin, v_svc.fecha_inicio + interval '4 hours')
      AND COALESCE(fecha_fin, fecha_inicio + interval '4 hours') > v_svc.fecha_inicio;
    IF v_conflicts IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
    END IF;
  END IF;

  -- 7. Confirmar; EXCLUDE constraint es el backstop para confirmaciones concurrentes
  BEGIN
    UPDATE public.trade_transport_services
       SET estado = 'confirmado', updated_at = now()
     WHERE id = p_service_id AND org_id = p_org_id;
  EXCEPTION
    WHEN exclusion_violation THEN
      RETURN jsonb_build_object(
        'ok', false,
        'conflictos', jsonb_build_array(jsonb_build_object(
          'tipo',        'conflicto_concurrente',
          'id',          NULL,
          'titulo',      'Conflicto detectado: recurso confirmado simultáneamente por otra sesión',
          'fecha_inicio', v_svc.fecha_inicio,
          'fecha_fin',   v_svc.fecha_fin
        ))
      );
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_transport_service(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_transport_service(uuid, uuid) TO authenticated;
