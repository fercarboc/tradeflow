-- TX-MC-1 PREDEPLOY — Dirección B cross-table + concurrencia + campos inmutables
--
-- CONTEXTO:
--   confirm_transport_trip (Mercancías→Viajeros) ya verifica trade_transport_services ✅
--   confirm_transport_service (Viajeros→Mercancías) NO verificaba trade_transport_trips ✗
--
--   En orgs combinadas (modalidad 'combinada') con vehículos/conductores 'mixto',
--   era posible confirmar un servicio de viajeros mientras un viaje de mercancías
--   ya tenía el mismo recurso confirmado en el mismo rango horario.
--
-- CAMBIO:
--   CREATE OR REPLACE FUNCTION confirm_transport_service para añadir verificación
--   cross-table contra trade_transport_trips en los pasos 5 y 6.
--
-- SOLUCIÓN CONCURRENCIA (SELECT FOR UPDATE):
--   confirm_transport_service adquiere SELECT FOR UPDATE sobre las filas de
--   trade_vehicles y trade_workers ANTES de comprobar disponibilidad.
--   confirm_transport_trip hace lo mismo (migration 20261102100000).
--   ORDEN ESTABLE: siempre vehicle → conductor en ambas RPCs → sin deadlocks.
--   Los checks de disponibilidad (within-table + cross-table) se realizan
--   DESPUÉS de adquirir los locks.
--
-- TAMBIÉN INCLUYE:
--   _protect_confirmed_service_fields: trigger que impide cambios directos de
--   vehicle_id, conductor_id, fecha_inicio y fecha_fin en servicios confirmados/en_curso.
--   Simétrico al trigger en trade_transport_trips (migration 20261102100000).
--
-- INVARIANTE: No modifica la migración histórica reconciliada
--   20261023150000_create_trade_transport_services.sql.
--   Solo reemplaza funciones con CREATE OR REPLACE FUNCTION y añade trigger.

CREATE OR REPLACE FUNCTION public.confirm_transport_service(
  p_service_id uuid,
  p_org_id     uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_svc           public.trade_transport_services%ROWTYPE;
  v_vehicle       public.trade_vehicles;
  v_worker        public.trade_workers;
  v_conflicts     jsonb;
  v_trip_conflict record;
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
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para confirmar este servicio';
  END IF;

  -- 3. Cargar y bloquear fila
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

  -- 3b. Bloqueo transaccional de recursos — SELECT FOR UPDATE (orden estable: vehicle → conductor).
  --
  -- PROPÓSITO: eliminar la race condition cross-table con confirm_transport_trip.
  -- confirm_transport_trip (migration 20261102100000) aplica el MISMO ORDEN.
  -- Si dos confirms simultáneos comparten un recurso mixto, el segundo se serializa
  -- aquí y detecta el conflicto una vez el primero commitea.
  --
  -- GARANTÍA DE AUSENCIA DE DEADLOCK: el orden vehicle→conductor es idéntico
  -- en ambas RPCs. No hay adquisición circular posible.
  IF v_svc.vehicle_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_vehicles WHERE id = v_svc.vehicle_id FOR UPDATE;
  END IF;
  IF v_svc.conductor_id IS NOT NULL THEN
    PERFORM 1 FROM public.trade_workers WHERE id = v_svc.conductor_id FOR UPDATE;
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
      RAISE EXCEPTION 'TRANSPORT_INVALID: número de viajeros (%) supera la capacidad del vehículo (%)',
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

  -- Rango del servicio (para cross-table queries)
  IF v_svc.fecha_fin IS NOT NULL THEN
    v_range := tstzrange(v_svc.fecha_inicio, v_svc.fecha_fin, '[)');
  END IF;

  -- 5. Conflictos vehículo within-table (trade_transport_services)
  IF v_svc.vehicle_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'tipo',        'vehiculo',
      'id',          id,
      'titulo',      titulo,
      'fecha_inicio', fecha_inicio,
      'fecha_fin',   fecha_fin,
      'tabla',       'servicios'
    ))
    INTO v_conflicts
    FROM public.trade_transport_services
    WHERE vehicle_id   = v_svc.vehicle_id
      AND id          <> p_service_id
      AND estado      IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL
      AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range;
    IF v_conflicts IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
    END IF;
  END IF;

  -- 5b. Conflictos vehículo cross-table (trade_transport_trips) — DIRECCIÓN B
  IF v_svc.vehicle_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin
      FROM public.trade_transport_trips
      WHERE org_id     = p_org_id
        AND vehicle_id = v_svc.vehicle_id
        AND estado     IN ('confirmado', 'en_curso')
        AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'tipo',         'vehiculo',
        'id',           v_trip_conflict.id,
        'titulo',       v_trip_conflict.titulo,
        'fecha_inicio', v_trip_conflict.fecha_inicio,
        'fecha_fin',    v_trip_conflict.fecha_fin,
        'tabla',        'viajes'
      );
    END LOOP;
    IF jsonb_array_length(v_conflicts) > 0 THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
    END IF;
  END IF;

  -- 6. Conflictos conductor within-table (trade_transport_services)
  IF v_svc.conductor_id IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object(
      'tipo',        'conductor',
      'id',          id,
      'titulo',      titulo,
      'fecha_inicio', fecha_inicio,
      'fecha_fin',   fecha_fin,
      'tabla',       'servicios'
    ))
    INTO v_conflicts
    FROM public.trade_transport_services
    WHERE conductor_id = v_svc.conductor_id
      AND id          <> p_service_id
      AND estado      IN ('confirmado','en_curso')
      AND fecha_fin IS NOT NULL
      AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range;
    IF v_conflicts IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'conflictos', v_conflicts);
    END IF;
  END IF;

  -- 6b. Conflictos conductor cross-table (trade_transport_trips) — DIRECCIÓN B
  IF v_svc.conductor_id IS NOT NULL AND v_svc.fecha_fin IS NOT NULL THEN
    v_conflicts := '[]'::jsonb;
    FOR v_trip_conflict IN
      SELECT id, titulo, fecha_inicio, fecha_fin
      FROM public.trade_transport_trips
      WHERE org_id      = p_org_id
        AND conductor_id = v_svc.conductor_id
        AND estado      IN ('confirmado', 'en_curso')
        AND fecha_fin IS NOT NULL
        AND tstzrange(fecha_inicio, fecha_fin, '[)') && v_range
    LOOP
      v_conflicts := v_conflicts || jsonb_build_object(
        'tipo',         'conductor',
        'id',           v_trip_conflict.id,
        'titulo',       v_trip_conflict.titulo,
        'fecha_inicio', v_trip_conflict.fecha_inicio,
        'fecha_fin',    v_trip_conflict.fecha_fin,
        'tabla',        'viajes'
      );
    END LOOP;
    IF jsonb_array_length(v_conflicts) > 0 THEN
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
          'fecha_fin',   v_svc.fecha_fin,
          'tabla',       'servicios'
        ))
      );
  END;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_transport_service(uuid, uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.confirm_transport_service(uuid, uuid) TO authenticated;

-- ── Trigger: campos clave inmutables en confirmado/en_curso (trade_transport_services) ──
-- Simétrico al trigger en trade_transport_trips (migration 20261102100000).
-- Bloquea cambios directos de vehicle_id, conductor_id, fecha_inicio y fecha_fin
-- una vez el servicio está confirmado o en_curso, evitando eludir los locks del RPC.

CREATE OR REPLACE FUNCTION public._protect_confirmed_service_fields()
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
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: vehicle_id no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.conductor_id IS DISTINCT FROM OLD.conductor_id THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: conductor_id no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_inicio no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado;
  END IF;
  IF NEW.fecha_fin IS DISTINCT FROM OLD.fecha_fin THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: fecha_fin no puede modificarse en estado %. Cancela el servicio y crea uno nuevo.', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._protect_confirmed_service_fields() FROM PUBLIC;

CREATE TRIGGER trg_tts_protect_confirmed_fields
  BEFORE UPDATE OF vehicle_id, conductor_id, fecha_inicio, fecha_fin
  ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._protect_confirmed_service_fields();
