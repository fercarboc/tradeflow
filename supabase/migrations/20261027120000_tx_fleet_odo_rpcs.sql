-- ══════════════════════════════════════════════════════════════════════════════
-- TX-FLEET-ODO-1 FASE D+E+F: RPCs de odómetro y corrección de lecturas
-- ══════════════════════════════════════════════════════════════════════════════
-- start_transport_service     — inicia servicio capturando odómetro y hora real
-- complete_transport_service  — extensión: añade p_odometro_final
-- correct_vehicle_km_reading  — corrección INSERT-only de una lectura errónea
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. start_transport_service ────────────────────────────────────────────────
--
-- Reemplaza el UPDATE directo de estado → 'en_curso'. Además captura:
--   - odometro_inicio (opcional): lectura del cuadro de mandos al salir
--   - hora_inicio_real (opcional): hora real de salida (puede diferir de fecha_inicio)
--   - obs_inicio (opcional): observaciones al inicio del servicio
-- Si el vehículo tiene vehicle_id y se provee odometro_inicio, inserta una
-- lectura en trade_vehicle_km_readings que actualiza km_actual automáticamente.
--
-- Transición de estado: confirmado → en_curso
-- Control de concurrencia: SELECT ... FOR UPDATE previene inicios simultáneos.

CREATE OR REPLACE FUNCTION public.start_transport_service(
  p_service_id      uuid,
  p_org_id          uuid,
  p_odometro_inicio integer     DEFAULT NULL,
  p_hora_inicio_real timestamptz DEFAULT NULL,
  p_obs_inicio      text        DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_svc public.trade_transport_services;
BEGIN
  -- a. Módulo habilitado
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- b. Permisos: owner o admin activo
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id
       AND user_id = auth.uid()
       AND rol IN ('owner', 'admin')
       AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para iniciar este servicio';
  END IF;

  -- c. Cargar y bloquear el servicio para prevenir inicios concurrentes
  SELECT * INTO v_svc
    FROM public.trade_transport_services
   WHERE id = p_service_id AND org_id = p_org_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: servicio no encontrado o no pertenece a esta organización';
  END IF;

  -- d. Solo confirmado puede iniciarse (la máquina de estados garantiza la secuencia)
  IF v_svc.estado <> 'confirmado' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se puede iniciar un servicio confirmado (estado actual: %)',
      v_svc.estado;
  END IF;

  -- e. Odómetro no negativo
  IF p_odometro_inicio IS NOT NULL AND p_odometro_inicio < 0 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_inicio no puede ser negativo (recibido: %)', p_odometro_inicio;
  END IF;

  -- f. Transición de estado y captura de datos de inicio
  UPDATE public.trade_transport_services
     SET estado            = 'en_curso',
         odometro_inicio   = COALESCE(p_odometro_inicio,   odometro_inicio),
         hora_inicio_real  = COALESCE(p_hora_inicio_real,  hora_inicio_real),
         obs_inicio        = COALESCE(p_obs_inicio,        obs_inicio),
         iniciado_por      = auth.uid(),
         updated_at        = now()
   WHERE id = p_service_id AND org_id = p_org_id;

  -- g. Registrar lectura de odómetro si se proporcionó y hay vehículo asignado
  --    ON CONFLICT DO NOTHING garantiza idempotencia en reintentos
  IF p_odometro_inicio IS NOT NULL AND v_svc.vehicle_id IS NOT NULL THEN
    INSERT INTO public.trade_vehicle_km_readings
      (org_id, vehicle_id, tipo, km, leido_en, servicio_id, fuente, created_by)
    VALUES
      (p_org_id, v_svc.vehicle_id, 'inicio_servicio', p_odometro_inicio,
       COALESCE(p_hora_inicio_real, now()), p_service_id, 'rpc', auth.uid())
    ON CONFLICT ON CONSTRAINT uq_vkr_svc_inicio DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'iniciado_at', now(),
    'odometro_inicio', p_odometro_inicio
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_transport_service(uuid, uuid, integer, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_transport_service(uuid, uuid, integer, timestamptz, text) TO authenticated;

-- ── 2. complete_transport_service — extensión con odómetro final ──────────────
--
-- Extiende la firma existente añadiendo p_odometro_final y p_force_odometro.
-- Todos los parámetros nuevos tienen DEFAULT NULL para garantizar compatibilidad
-- con los llamadores existentes que no pasan odómetro.
-- Si se proporciona odómetro final y hay vehículo, inserta lectura en km_readings.

CREATE OR REPLACE FUNCTION public.complete_transport_service(
  p_service_id           uuid,
  p_org_id               uuid,
  p_hora_real_salida     timestamptz DEFAULT NULL,
  p_hora_real_llegada    timestamptz DEFAULT NULL,
  p_km_reales            numeric     DEFAULT NULL,
  p_incidencias          text        DEFAULT NULL,
  p_observaciones_cierre text        DEFAULT NULL,
  p_odometro_final       integer     DEFAULT NULL,
  p_force_odometro       boolean     DEFAULT FALSE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_svc public.trade_transport_services;
BEGIN
  -- a. Módulo habilitado
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND transport_enabled = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: módulo de transporte no activado para esta organización';
  END IF;

  -- b. Permisos: owner o admin activo
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id
       AND user_id = auth.uid()
       AND rol IN ('owner', 'admin')
       AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para cerrar este servicio';
  END IF;

  -- c. Cargar y bloquear el servicio
  SELECT * INTO v_svc
    FROM public.trade_transport_services
   WHERE id = p_service_id AND org_id = p_org_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: servicio no encontrado o no pertenece a esta organización';
  END IF;

  -- d. Solo en_curso puede cerrarse
  IF v_svc.estado <> 'en_curso' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se puede cerrar un servicio en_curso (estado actual: %)',
      v_svc.estado;
  END IF;

  -- e. Kilómetros no negativos
  IF p_km_reales IS NOT NULL AND p_km_reales < 0 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: km_reales no puede ser negativo (recibido: %)', p_km_reales;
  END IF;

  -- f. Coherencia de horarios reales
  IF p_hora_real_salida IS NOT NULL
     AND p_hora_real_llegada IS NOT NULL
     AND p_hora_real_llegada <= p_hora_real_salida
  THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: hora_real_llegada debe ser posterior a hora_real_salida';
  END IF;

  -- g. Validación del odómetro final
  IF p_odometro_final IS NOT NULL THEN
    IF p_odometro_final < 0 THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_final no puede ser negativo (recibido: %)', p_odometro_final;
    END IF;
    -- El odómetro final debe ser >= odómetro inicio (si existe y no es sustitución forzada)
    IF NOT p_force_odometro
       AND v_svc.odometro_inicio IS NOT NULL
       AND p_odometro_final < v_svc.odometro_inicio
    THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_final (%) es menor que odometro_inicio (%); usa p_force_odometro=true si hubo sustitución',
        p_odometro_final, v_svc.odometro_inicio;
    END IF;
  END IF;

  -- h. Cierre atómico
  UPDATE public.trade_transport_services
     SET estado               = 'completado',
         hora_real_salida     = COALESCE(p_hora_real_salida,     hora_real_salida),
         hora_real_llegada    = COALESCE(p_hora_real_llegada,    hora_real_llegada),
         km_reales            = COALESCE(p_km_reales,            km_reales),
         incidencias          = COALESCE(p_incidencias,          incidencias),
         observaciones_cierre = COALESCE(p_observaciones_cierre, observaciones_cierre),
         odometro_final       = COALESCE(p_odometro_final,       odometro_final),
         cerrado_at           = now(),
         cerrado_por          = auth.uid(),
         updated_at           = now()
   WHERE id = p_service_id AND org_id = p_org_id;

  -- i. Registrar lectura de odómetro final si se proporcionó y hay vehículo
  IF p_odometro_final IS NOT NULL AND v_svc.vehicle_id IS NOT NULL THEN
    INSERT INTO public.trade_vehicle_km_readings
      (org_id, vehicle_id, tipo, km, leido_en, servicio_id, fuente, created_by)
    VALUES
      (p_org_id, v_svc.vehicle_id, 'final_servicio', p_odometro_final,
       COALESCE(p_hora_real_llegada, now()), p_service_id, 'rpc', auth.uid())
    ON CONFLICT ON CONSTRAINT uq_vkr_svc_final DO NOTHING;
  END IF;

  RETURN jsonb_build_object('ok', true, 'cerrado_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text, integer, boolean) TO authenticated;

-- Revocar la firma anterior (7 params) para evitar ambigüedad en PostgREST
REVOKE ALL ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text);

-- ── 3. correct_vehicle_km_reading ──────────────────────────────────────────────
--
-- Crea una nueva lectura que rectifica una errónea, sin modificar la original.
-- La original permanece como evidencia histórica (compliance).
-- El trigger _sync_vehicle_km_actual recalcula km_actual automáticamente.
-- Una lectura solo puede ser corregida una vez (UNIQUE INDEX uq_vkr_correccion).

CREATE OR REPLACE FUNCTION public.correct_vehicle_km_reading(
  p_org_id      uuid,
  p_vehicle_id  uuid,
  p_corrige_id  uuid,        -- ID de la lectura errónea a corregir
  p_km_correcto integer,     -- el valor correcto
  p_leido_en    timestamptz DEFAULT NULL,  -- cuándo se tomó la lectura correcta
  p_notas       text        DEFAULT NULL   -- motivo de la corrección
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reading public.trade_vehicle_km_readings;
  v_new_id  uuid;
BEGIN
  -- a. Permisos: owner o admin activo
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_organizations
     WHERE id = p_org_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.trade_org_members
     WHERE org_id = p_org_id
       AND user_id = auth.uid()
       AND rol IN ('owner', 'admin')
       AND activo = true
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_FORBIDDEN: sin permisos para corregir lecturas de kilómetros';
  END IF;

  -- b. Valor correcto no negativo
  IF p_km_correcto < 0 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: km_correcto no puede ser negativo (recibido: %)', p_km_correcto;
  END IF;

  -- c. La lectura a corregir existe y pertenece a este org/vehículo
  SELECT * INTO v_reading
    FROM public.trade_vehicle_km_readings
   WHERE id = p_corrige_id
     AND org_id = p_org_id
     AND vehicle_id = p_vehicle_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: lectura de kilómetros no encontrada (id: %)', p_corrige_id;
  END IF;

  -- d. La lectura no puede ser ya una corrección (no se corrigen correcciones)
  IF v_reading.tipo = 'correccion' THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: no se puede corregir una lectura que ya es una corrección';
  END IF;

  -- e. Verificar que no haya sido ya corregida (UNIQUE uq_vkr_correccion lo garantiza,
  --    pero el mensaje de error explícito es más claro)
  IF EXISTS (
    SELECT 1 FROM public.trade_vehicle_km_readings
     WHERE corrige_id = p_corrige_id
  ) THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: esta lectura ya ha sido corregida; no se puede corregir dos veces';
  END IF;

  -- f. Insertar la corrección (INSERT-only; la original permanece intacta)
  INSERT INTO public.trade_vehicle_km_readings
    (org_id, vehicle_id, tipo, km, leido_en, servicio_id, fuente, notas, corrige_id, created_by)
  VALUES
    (p_org_id, p_vehicle_id, 'correccion', p_km_correcto,
     COALESCE(p_leido_en, v_reading.leido_en),
     v_reading.servicio_id, 'manual',
     COALESCE(p_notas, 'Corrección de lectura ' || p_corrige_id::text),
     p_corrige_id, auth.uid())
  RETURNING id INTO v_new_id;

  -- El trigger trg_vkr_sync_km_actual se ejecuta automáticamente tras este INSERT

  RETURN jsonb_build_object(
    'ok', true,
    'correccion_id', v_new_id,
    'km_correcto', p_km_correcto
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_vehicle_km_reading(uuid, uuid, uuid, integer, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.correct_vehicle_km_reading(uuid, uuid, uuid, integer, timestamptz, text) TO authenticated;

-- ── 4. NOTIFY pgrst: recargar schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
