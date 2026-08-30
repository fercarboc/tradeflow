-- ─────────────────────────────────────────────────────────────────────────────
-- 1. submit_ad_creative_for_review — add booking state revalidation
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.submit_ad_creative_for_review(
  p_creative_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid;
  v_creative_est text;
  v_booking_est  text;
BEGIN
  SELECT c.actor_id, cr.estado::text, b.estado::text
  INTO   v_actor_id, v_creative_est, v_booking_est
  FROM   public.trade_marketplace_ad_creatives cr
  JOIN   public.trade_marketplace_ad_campaigns   c ON c.id  = cr.campaign_id
  LEFT JOIN public.trade_marketplace_ad_bookings b ON b.id  = c.booking_id
  WHERE  cr.id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_creative_est <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden enviar creatividades en estado DRAFT (estado actual: %)',
      v_creative_est;
  END IF;

  IF v_booking_est IS NULL OR v_booking_est NOT IN ('RESERVED', 'CONFIRMED') THEN
    RAISE EXCEPTION
      'La reserva asociada debe estar en estado RESERVED o CONFIRMED para enviar la creatividad (estado actual de la reserva: %)',
      COALESCE(v_booking_est, 'sin reserva vinculada');
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET    estado       = 'PENDING_APPROVAL',
         activa       = false,
         submitted_at = now(),
         updated_at   = now()
  WHERE  id = p_creative_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_creative_for_review(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REVOKE INSERT + UPDATE on admin-only columns from authenticated
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE INSERT (aprobada_por, aprobada_at)
  ON public.trade_marketplace_ad_creatives FROM authenticated;

REVOKE UPDATE (aprobada_por, aprobada_at)
  ON public.trade_marketplace_ad_creatives FROM authenticated;

REVOKE INSERT (submitted_at)
  ON public.trade_marketplace_ad_creatives FROM authenticated;

REVOKE UPDATE (submitted_at)
  ON public.trade_marketplace_ad_creatives FROM authenticated;

REVOKE INSERT (ia_model, ia_prompt_ref)
  ON public.trade_marketplace_ad_creatives FROM authenticated;

REVOKE UPDATE (ia_model, ia_prompt_ref)
  ON public.trade_marketplace_ad_creatives FROM authenticated;;
