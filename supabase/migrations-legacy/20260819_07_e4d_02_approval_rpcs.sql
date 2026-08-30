-- ═══════════════════════════════════════════════════════════════════════════
-- E4.D — Migration 2: RPCs de aprobación, rechazo y publicación editorial
-- ═══════════════════════════════════════════════════════════════════════════
-- Tres RPCs SECURITY DEFINER solo para administradores:
--   · admin_approve_ad_creative  — PENDING_APPROVAL → APPROVED
--   · admin_reject_ad_creative   — PENDING_APPROVAL → REJECTED (con motivo)
--   · admin_publish_ad_creative  — APPROVED → activa=true (swap atómico)
--
-- Máquina de estados: DRAFT → PENDING_APPROVAL → APPROVED → activa=true
-- El proveedor NUNCA puede autopublicar.
-- INVARIANTE: publicidad ≠ ranking.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. admin_approve_ad_creative ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_approve_ad_creative(
  p_creative_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creative record;
  v_campaign record;
  v_booking  record;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_creative
  FROM public.trade_marketplace_ad_creatives
  WHERE id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_creative.estado <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Solo se pueden aprobar creatividades en PENDING_APPROVAL (estado actual: %)', v_creative.estado;
  END IF;

  SELECT * INTO v_campaign
  FROM public.trade_marketplace_ad_campaigns
  WHERE id = v_creative.campaign_id;

  -- Validar reserva activa para campañas de proveedor
  IF v_campaign.campaign_source = 'supplier' THEN
    SELECT * INTO v_booking
    FROM public.trade_marketplace_ad_bookings
    WHERE id = v_campaign.booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No hay reserva asociada a esta campaña de proveedor';
    END IF;

    IF v_booking.estado NOT IN ('RESERVED', 'CONFIRMED') THEN
      RAISE EXCEPTION 'La reserva debe estar RESERVED o CONFIRMED para aprobar (estado: %)', v_booking.estado;
    END IF;

    IF v_booking.fin < CURRENT_DATE THEN
      RAISE EXCEPTION 'La reserva ha caducado (fin: %)', v_booking.fin;
    END IF;
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET
    estado         = 'APPROVED',
    aprobada_por   = auth.uid(),
    aprobada_at    = now(),
    rechazo_motivo = NULL,
    updated_at     = now()
  WHERE id = p_creative_id;

  RETURN jsonb_build_object('ok', true, 'estado', 'APPROVED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_ad_creative(uuid) TO authenticated;

-- ─── 2. admin_reject_ad_creative ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_reject_ad_creative(
  p_creative_id uuid,
  p_motivo      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_motivo  text;
  v_creative record;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_motivo := trim(coalesce(p_motivo, ''));
  IF length(v_motivo) < 5 THEN
    RAISE EXCEPTION 'El motivo de rechazo debe tener al menos 5 caracteres';
  END IF;
  IF length(v_motivo) > 500 THEN
    RAISE EXCEPTION 'El motivo no puede superar los 500 caracteres';
  END IF;

  SELECT * INTO v_creative
  FROM public.trade_marketplace_ad_creatives
  WHERE id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_creative.estado <> 'PENDING_APPROVAL' THEN
    RAISE EXCEPTION 'Solo se pueden rechazar creatividades en PENDING_APPROVAL (estado actual: %)', v_creative.estado;
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET
    estado         = 'REJECTED',
    activa         = false,
    rechazo_motivo = v_motivo,
    updated_at     = now()
  WHERE id = p_creative_id;

  RETURN jsonb_build_object('ok', true, 'estado', 'REJECTED');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_ad_creative(uuid, text) TO authenticated;

-- ─── 3. admin_publish_ad_creative ────────────────────────────────────────────
-- Swap atómico: desactiva todas las otras creatividades de la campaña y
-- activa la objetivo. El índice uq_creative_activa_per_campaign garantiza
-- que no puedan quedar dos activas simultáneamente.
CREATE OR REPLACE FUNCTION public.admin_publish_ad_creative(
  p_creative_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creative record;
  v_campaign record;
  v_booking  record;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_creative
  FROM public.trade_marketplace_ad_creatives
  WHERE id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id USING ERRCODE = 'no_data_found';
  END IF;

  IF v_creative.estado <> 'APPROVED' THEN
    RAISE EXCEPTION 'Solo se pueden publicar creatividades APPROVED (estado actual: %)', v_creative.estado;
  END IF;

  SELECT * INTO v_campaign
  FROM public.trade_marketplace_ad_campaigns
  WHERE id = v_creative.campaign_id;

  -- Para campañas de proveedor: validar reserva activa y periodo en curso
  IF v_campaign.campaign_source = 'supplier' THEN
    SELECT * INTO v_booking
    FROM public.trade_marketplace_ad_bookings
    WHERE id = v_campaign.booking_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No hay reserva asociada a esta campaña de proveedor';
    END IF;

    IF v_booking.estado NOT IN ('RESERVED', 'CONFIRMED') THEN
      RAISE EXCEPTION 'La reserva debe estar RESERVED o CONFIRMED para publicar (estado: %)', v_booking.estado;
    END IF;

    IF v_booking.inicio > CURRENT_DATE THEN
      RAISE EXCEPTION 'El periodo de la reserva aún no ha comenzado (inicio: %)', v_booking.inicio;
    END IF;

    IF v_booking.fin < CURRENT_DATE THEN
      RAISE EXCEPTION 'La reserva ha caducado (fin: %)', v_booking.fin;
    END IF;
  END IF;

  -- Swap atómico: primero desactivar todas las demás
  UPDATE public.trade_marketplace_ad_creatives
  SET activa = false, updated_at = now()
  WHERE campaign_id = v_creative.campaign_id
    AND id          <> p_creative_id
    AND activa      = true;

  -- Luego activar la objetivo con auditoría
  UPDATE public.trade_marketplace_ad_creatives
  SET
    activa       = true,
    published_at = now(),
    published_by = auth.uid(),
    updated_at   = now()
  WHERE id = p_creative_id;

  RETURN jsonb_build_object('ok', true, 'activa', true, 'published_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_publish_ad_creative(uuid) TO authenticated;
