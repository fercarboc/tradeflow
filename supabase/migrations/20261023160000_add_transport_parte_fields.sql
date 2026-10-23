-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSPORT-T1-C: Parte de servicio y cierre transaccional
-- ══════════════════════════════════════════════════════════════════════════════
-- Añade campos de datos reales (parte), trigger de protección de completados
-- y RPC atómica de cierre. Sin firma en este MVP (bucket privado preparado).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Campos del parte de servicio ──────────────────────────────────────────

ALTER TABLE public.trade_transport_services
  ADD COLUMN hora_real_salida     timestamptz,
  ADD COLUMN hora_real_llegada    timestamptz,
  ADD COLUMN km_reales            numeric(8,2),
  ADD COLUMN incidencias          text,
  ADD COLUMN observaciones_cierre text,
  ADD COLUMN cerrado_at           timestamptz,
  ADD COLUMN cerrado_por          uuid;           -- auth.uid() al momento del cierre; sin FK a auth.users (tabla interna)

-- Restricciones de integridad del parte
ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_km_no_negativo
    CHECK (km_reales IS NULL OR km_reales >= 0),
  ADD CONSTRAINT tts_parte_horas_coherentes
    CHECK (hora_real_llegada IS NULL OR hora_real_salida IS NULL OR
           hora_real_llegada > hora_real_salida);

-- ── 2. Protección de servicios completados ────────────────────────────────────
--
-- Un servicio completado no debe modificarse directamente.
-- Cualquier corrección futura deberá realizarse mediante una RPC autorizada.
-- Esta función se ejecuta ANTES de cualquier UPDATE; si OLD.estado = 'completado'
-- bloquea la operación independientemente de qué columnas se intenten cambiar.

CREATE OR REPLACE FUNCTION public._protect_completed_transport_service()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.estado = 'completado' THEN
    RAISE EXCEPTION 'TRANSPORT_IMMUTABLE: un servicio completado no puede modificarse directamente';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._protect_completed_transport_service() FROM PUBLIC;

-- Nombre alfabéticamente anterior a trg_tts_state_machine → dispara primero
CREATE TRIGGER trg_tts_protect_completed
  BEFORE UPDATE ON public.trade_transport_services
  FOR EACH ROW EXECUTE FUNCTION public._protect_completed_transport_service();

-- ── 3. RPC: complete_transport_service ────────────────────────────────────────
--
-- Cierra atómicamente un servicio en_curso. Registra los datos reales del parte.
-- Controles:
--   a) transport_enabled para la org
--   b) Permisos owner/admin
--   c) El servicio existe y pertenece a la org (FOR UPDATE)
--   d) Solo acepta servicios en estado 'en_curso'
--   e) Validación km >= 0
--   f) Validación coherencia horarios reales
-- El trigger _protect_completed_transport_service NO interfiere porque
-- OLD.estado = 'en_curso' (no 'completado') cuando esta RPC se ejecuta.

CREATE OR REPLACE FUNCTION public.complete_transport_service(
  p_service_id          uuid,
  p_org_id              uuid,
  p_hora_real_salida    timestamptz DEFAULT NULL,
  p_hora_real_llegada   timestamptz DEFAULT NULL,
  p_km_reales           numeric     DEFAULT NULL,
  p_incidencias         text        DEFAULT NULL,
  p_observaciones_cierre text       DEFAULT NULL
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
       AND rol IN ('owner','admin')
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

  -- g. Cierre atómico
  UPDATE public.trade_transport_services
     SET estado               = 'completado',
         hora_real_salida     = COALESCE(p_hora_real_salida,     hora_real_salida),
         hora_real_llegada    = COALESCE(p_hora_real_llegada,    hora_real_llegada),
         km_reales            = COALESCE(p_km_reales,            km_reales),
         incidencias          = COALESCE(p_incidencias,          incidencias),
         observaciones_cierre = COALESCE(p_observaciones_cierre, observaciones_cierre),
         cerrado_at           = now(),
         cerrado_por          = auth.uid(),
         updated_at           = now()
   WHERE id = p_service_id AND org_id = p_org_id;

  RETURN jsonb_build_object('ok', true, 'cerrado_at', now());
END;
$$;
REVOKE ALL ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_transport_service(uuid, uuid, timestamptz, timestamptz, numeric, text, text) TO authenticated;

-- ── 4. Notas de diseño: firma diferida ───────────────────────────────────────
--
-- El campo firma_url NO se añade en este MVP. El bucket trade-job-photos es
-- público y no puede usarse para firmas privadas. Se requiere un bucket
-- privado (e.g. trade-transport-signatures) con RLS basada en org_id.
-- Cuando se implemente la firma:
--   ADD COLUMN firma_url text  (apuntará a path en bucket privado)
-- La columna cerrado_por (auth.uid) ya provee trazabilidad del firmante.
