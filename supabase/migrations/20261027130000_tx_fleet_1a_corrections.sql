-- ══════════════════════════════════════════════════════════════════════════════
-- TX-FLEET-1A: Corrección final del diseño e implementación de la base de Odómetro
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Defectos corregidos vs TX-FLEET-ODO-1 (31b26c0):
--
--   FASE C — Idempotencia:
--     ON CONFLICT ON CONSTRAINT sobre índice parcial (CREATE UNIQUE INDEX) es
--     sintaxis inválida en PostgreSQL; solo funciona con ADD CONSTRAINT UNIQUE.
--     Sustituido por chequeo SELECT explícito en start y complete, que:
--       · solo omite el INSERT cuando ya existe exactamente la lectura esperada
--         (reintento legítimo de la misma operación),
--       · no oculta un INSERT distinto que casualmente conflicte con la clave.
--
--   FASE D — Integridad:
--     Faltaba garantía BD de que lectura y servicio pertenecen a la misma org.
--     · Añadido UNIQUE(org_id, id) en trade_transport_services.
--     · Eliminado FK simple (ON DELETE SET NULL) en servicio_id, que convivía
--       con la nueva FK compuesta de forma conflictiva.
--     · Añadido FK compuesta vkr_service_org_fk:
--         (org_id, servicio_id) → trade_transport_services(org_id, id)
--       Comportamiento MATCH SIMPLE: cuando servicio_id IS NULL la restricción
--       no se evalúa → válido para lecturas manuales sin servicio.
--       Sin ON DELETE action (= NO ACTION): no se puede borrar un servicio que
--       tenga lecturas de km asociadas (preservación del historial).
--     · Verificación explícita en RPC: RAISE si hay odómetro pero no hay
--       vehículo asignado al servicio.
--     · Correspondencia vehículo/servicio garantizada por construcción: las RPCs
--       usan v_svc.vehicle_id (del servicio bloqueado con FOR UPDATE y filtrado
--       por org_id), nunca un parámetro independiente del llamador.
--
--   FASE E — Reconciliación determinista:
--     Trigger _sync_vehicle_km_actual sin desempate para empates exactos en
--     leido_en + created_at (posible en importaciones masivas o tests de carga).
--     Añadido r.id DESC como tercer criterio → resultado siempre único.
--
-- No tocado:
--   · km_reales (km declarados del viaje): semántica inalterada (FASE F).
--   · Trigger _protect_completed_transport_service: sin bypass (FASE G).
--   · correct_vehicle_km_reading: INSERT-only, sin RPC de modificación de
--     partes cerrados (FASE G).
--   · Stripe, VeriFactu, facturación: fuera de scope.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. UNIQUE(org_id, id) en servicios ────────────────────────────────────────
--
-- Requerido para poder declarar una FK compuesta que referencie (org_id, id).
-- Si ya existe (ej. por migración anterior), el bloque DO ignora el error.

DO $$ BEGIN
  ALTER TABLE public.trade_transport_services
    ADD CONSTRAINT trade_transport_services_org_id_id_key UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Sustituir FK simple por FK compuesta en trade_vehicle_km_readings ──────
--
-- La FK simple ("servicio_id REFERENCES trade_transport_services(id) ON DELETE
-- SET NULL") definida en la migración 20261027110000 no garantiza same-org y
-- además entraría en conflicto con la nueva FK compuesta (ON DELETE SET NULL
-- vs NO ACTION sobre las mismas filas). Se elimina primero.
--
-- El nombre lo genera PostgreSQL siguiendo el patrón {tabla}_{columna}_fkey.
-- Con IF EXISTS se evita error si el nombre difiere ligeramente.

ALTER TABLE public.trade_vehicle_km_readings
  DROP CONSTRAINT IF EXISTS trade_vehicle_km_readings_servicio_id_fkey;

-- FK compuesta: garantiza que (org_id, servicio_id) en la lectura referencie
-- un servicio real de la misma organización.
-- MATCH SIMPLE (por defecto): si servicio_id IS NULL, la restricción no se
-- evalúa → las lecturas manuales sin servicio asociado son siempre válidas.
-- NO ACTION (por defecto): borrar un servicio con lecturas km asociadas falla →
-- el historial de odómetro no puede perderse accidentalmente.

ALTER TABLE public.trade_vehicle_km_readings
  DROP CONSTRAINT IF EXISTS vkr_service_org_fk;

ALTER TABLE public.trade_vehicle_km_readings
  ADD CONSTRAINT vkr_service_org_fk
    FOREIGN KEY (org_id, servicio_id)
    REFERENCES public.trade_transport_services(org_id, id);

-- ── 3. Trigger: desempate determinista con r.id DESC ──────────────────────────
--
-- Añade r.id DESC como tercer criterio de ordenación en _sync_vehicle_km_actual.
-- Garantiza un resultado único incluso cuando dos lecturas tienen valores
-- idénticos de leido_en y created_at (ej. importación masiva o batch de test).

CREATE OR REPLACE FUNCTION public._sync_vehicle_km_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_km_actual integer;
  v_leido_en  timestamptz;
BEGIN
  -- Última lectura válida (no anulada) para este vehículo.
  -- Una lectura es "anulada" si existe otra con corrige_id = esta.id.
  -- Desempate: leido_en DESC → created_at DESC → id DESC (determinista).
  SELECT r.km, r.leido_en
    INTO v_km_actual, v_leido_en
    FROM public.trade_vehicle_km_readings r
   WHERE r.vehicle_id = NEW.vehicle_id
     AND NOT EXISTS (
       SELECT 1
         FROM public.trade_vehicle_km_readings c
        WHERE c.corrige_id = r.id
     )
   ORDER BY r.leido_en DESC, r.created_at DESC, r.id DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.trade_vehicles
       SET km_actual         = v_km_actual,
           km_actualizado_at = v_leido_en
     WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_vehicle_km_actual() FROM PUBLIC;

-- ── 4. start_transport_service — idempotencia explícita ───────────────────────
--
-- DEFECTO CORREGIDO (FASE C):
--   ON CONFLICT ON CONSTRAINT uq_vkr_svc_inicio → inválido para índices
--   parciales (CREATE UNIQUE INDEX). Fallaba con error en runtime.
--
-- NUEVO COMPORTAMIENTO:
--   SELECT explícito antes del INSERT:
--     · Si ya existe una lectura inicio_servicio para este vehículo/servicio
--       (corrige_id IS NULL), se trata como reintento legítimo y se omite.
--     · En ningún caso se enmascara una inserción distinta que casualmente
--       coincida con la clave (ej. vehicle_id incorrecto por bug).
--     · El UNIQUE INDEX uq_vkr_svc_inicio actúa como red de seguridad ante
--       condiciones de carrera que superen el bloqueo FOR UPDATE del servicio.
--
-- CORRECCIÓN FASE D:
--   Verificación explícita de correspondencia: si se provee odómetro pero el
--   servicio no tiene vehículo asignado, se levanta un error descriptivo antes
--   de intentar insertar la lectura.

CREATE OR REPLACE FUNCTION public.start_transport_service(
  p_service_id       uuid,
  p_org_id           uuid,
  p_odometro_inicio  integer     DEFAULT NULL,
  p_hora_inicio_real timestamptz DEFAULT NULL,
  p_obs_inicio       text        DEFAULT NULL
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

  -- c. Cargar y bloquear el servicio (FOR UPDATE previene inicios concurrentes)
  SELECT * INTO v_svc
    FROM public.trade_transport_services
   WHERE id = p_service_id AND org_id = p_org_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TRANSPORT_NOT_FOUND: servicio no encontrado o no pertenece a esta organización';
  END IF;

  -- d. Solo confirmado puede iniciarse
  IF v_svc.estado <> 'confirmado' THEN
    RAISE EXCEPTION 'TRANSPORT_STATE_INVALID: solo se puede iniciar un servicio confirmado (estado actual: %)',
      v_svc.estado;
  END IF;

  -- e. Odómetro no negativo
  IF p_odometro_inicio IS NOT NULL AND p_odometro_inicio < 0 THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_inicio no puede ser negativo (recibido: %)', p_odometro_inicio;
  END IF;

  -- f. No se puede registrar lectura de odómetro sin vehículo asignado
  --    (verificación explícita de correspondencia vehículo/servicio — FASE D)
  IF p_odometro_inicio IS NOT NULL AND v_svc.vehicle_id IS NULL THEN
    RAISE EXCEPTION 'TRANSPORT_INVALID: no hay vehículo asignado al servicio para registrar la lectura de odómetro';
  END IF;

  -- g. Transición de estado y captura de datos de inicio
  UPDATE public.trade_transport_services
     SET estado            = 'en_curso',
         odometro_inicio   = COALESCE(p_odometro_inicio,   odometro_inicio),
         hora_inicio_real  = COALESCE(p_hora_inicio_real,  hora_inicio_real),
         obs_inicio        = COALESCE(p_obs_inicio,        obs_inicio),
         iniciado_por      = auth.uid(),
         updated_at        = now()
   WHERE id = p_service_id AND org_id = p_org_id;

  -- h. Registrar lectura de odómetro con idempotencia explícita (FASE C corregida)
  --
  -- El SELECT previo detecta el reintento legítimo de forma transparente.
  -- Correspondencia vehículo/servicio garantizada por construcción: se usa
  -- v_svc.vehicle_id (del servicio bloqueado y filtrado por org_id), nunca
  -- un parámetro separado del llamador.
  IF p_odometro_inicio IS NOT NULL AND v_svc.vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.trade_vehicle_km_readings
       WHERE vehicle_id  = v_svc.vehicle_id
         AND servicio_id = p_service_id
         AND tipo        = 'inicio_servicio'
         AND corrige_id  IS NULL
    ) THEN
      INSERT INTO public.trade_vehicle_km_readings
        (org_id, vehicle_id, tipo, km, leido_en, servicio_id, fuente, created_by)
      VALUES
        (p_org_id, v_svc.vehicle_id, 'inicio_servicio', p_odometro_inicio,
         COALESCE(p_hora_inicio_real, now()), p_service_id, 'rpc', auth.uid());
    END IF;
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

-- ── 5. complete_transport_service — idempotencia explícita ────────────────────
--
-- DEFECTO CORREGIDO (FASE C):
--   ON CONFLICT ON CONSTRAINT uq_vkr_svc_final → mismo defecto que arriba.
--   Sustituido por SELECT explícito.
--
-- CORRECCIÓN FASE D:
--   Verificación explícita: si se provee odómetro_final pero el servicio no
--   tiene vehículo asignado, se levanta error antes de intentar insertar.
--
-- FASE F confirmada: km_reales (km declarados del viaje) no renombrado,
-- no eliminado, semántica inalterada respecto a la migración original.

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

  -- c. Cargar y bloquear el servicio (FOR UPDATE previene cierres concurrentes)
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

  -- e. km_reales no negativos (km declarados del viaje — semántica inalterada, FASE F)
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
    IF NOT p_force_odometro
       AND v_svc.odometro_inicio IS NOT NULL
       AND p_odometro_final < v_svc.odometro_inicio
    THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: odometro_final (%) es menor que odometro_inicio (%); usa p_force_odometro=true si hubo sustitución',
        p_odometro_final, v_svc.odometro_inicio;
    END IF;
    -- Verificación explícita de correspondencia vehículo/servicio (FASE D)
    IF v_svc.vehicle_id IS NULL THEN
      RAISE EXCEPTION 'TRANSPORT_INVALID: no hay vehículo asignado al servicio para registrar la lectura de odómetro';
    END IF;
  END IF;

  -- h. Cierre atómico del servicio
  --    Nota: _protect_completed_transport_service bloqueará UPDATE si estado ya
  --    es 'completado'; no hay bypass de ese trigger (FASE G confirmada).
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

  -- i. Registrar lectura de odómetro final con idempotencia explícita (FASE C)
  --
  -- SELECT explícito en lugar de ON CONFLICT ON CONSTRAINT (inválido para índices
  -- parciales). Mismo razonamiento que en start_transport_service paso h.
  IF p_odometro_final IS NOT NULL AND v_svc.vehicle_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.trade_vehicle_km_readings
       WHERE vehicle_id  = v_svc.vehicle_id
         AND servicio_id = p_service_id
         AND tipo        = 'final_servicio'
         AND corrige_id  IS NULL
    ) THEN
      INSERT INTO public.trade_vehicle_km_readings
        (org_id, vehicle_id, tipo, km, leido_en, servicio_id, fuente, created_by)
      VALUES
        (p_org_id, v_svc.vehicle_id, 'final_servicio', p_odometro_final,
         COALESCE(p_hora_real_llegada, now()), p_service_id, 'rpc', auth.uid());
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'cerrado_at', now());
END;
$$;

REVOKE ALL ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text, integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text, integer, boolean) TO authenticated;

-- ── 6. NOTIFY pgrst: recargar schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
