-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.2 — Finalize supplier creative security
-- ═══════════════════════════════════════════════════════════════════════════
-- Two debs from RC1-C.8.E audit:
--
-- 1. submit_ad_creative_for_review did not re-validate booking estado at
--    submit time.  If a booking was CANCELLED or EXPIRED after the campaign
--    was created, a supplier could still submit the DRAFT creative and it
--    would become PENDING_APPROVAL against a dead booking.
--    Fix: extend the join to include the booking and enforce
--         booking.estado IN ('RESERVED','CONFIRMED') before the UPDATE.
--
-- 2. authenticated had INSERT+UPDATE column grants on:
--       aprobada_por, aprobada_at  (approval audit trail — admin-only writes)
--       submitted_at               (only written by submit RPC, not by client)
--       ia_model, ia_prompt_ref    (AI system fields, not supplier-editable)
--    A supplier could craft a direct API call writing garbage to those fields.
--    Fix: REVOKE INSERT + UPDATE on those columns from authenticated.
--    Impact on admin: the admin creative form (AdCreativeForm) does NOT
--    include these fields in its payload, so no regression.
--    Future admin approval flow MUST use a SECURITY DEFINER RPC that runs
--    as the function owner (bypasses column-level revoke).
--
-- INVARIANTE: publicidad ≠ ranking. No toca pricing, ranking ni scores.
--
-- Rollback:
--   (restore submit function body from 20260818_03)
--   GRANT INSERT (aprobada_por, aprobada_at, submitted_at, ia_model, ia_prompt_ref)
--     ON public.trade_marketplace_ad_creatives TO authenticated;
--   GRANT UPDATE (aprobada_por, aprobada_at, submitted_at, ia_model, ia_prompt_ref)
--     ON public.trade_marketplace_ad_creatives TO authenticated;
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. submit_ad_creative_for_review — add booking state revalidation
--    Chain verified: creative → campaign → booking
--    Rejects: REQUESTED CONTACTING ACCEPTED REJECTED CANCELLED EXPIRED (all)
--    Accepts: RESERVED CONFIRMED
--    Also resets activa=false (from E4.C.3.1, preserved here)
-- ────────────────────────────────────────────────────────────────────────────

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
  -- Load creative + campaign + booking in one join
  SELECT c.actor_id, cr.estado::text, b.estado::text
  INTO   v_actor_id, v_creative_est, v_booking_est
  FROM   public.trade_marketplace_ad_creatives cr
  JOIN   public.trade_marketplace_ad_campaigns   c ON c.id  = cr.campaign_id
  LEFT JOIN public.trade_marketplace_ad_bookings b ON b.id  = c.booking_id
  WHERE  cr.id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id;
  END IF;

  -- Auth: user must be a member of the actor that owns the campaign
  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Creative must be in DRAFT state
  IF v_creative_est <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden enviar creatividades en estado DRAFT (estado actual: %)',
      v_creative_est;
  END IF;

  -- Booking must still be RESERVED or CONFIRMED at submit time.
  -- Prevents submission against cancelled, expired, or not-yet-reserved bookings.
  IF v_booking_est IS NULL OR v_booking_est NOT IN ('RESERVED', 'CONFIRMED') THEN
    RAISE EXCEPTION
      'La reserva asociada debe estar en estado RESERVED o CONFIRMED para enviar la creatividad (estado actual de la reserva: %)',
      COALESCE(v_booking_est, 'sin reserva vinculada');
  END IF;

  -- Transition: DRAFT → PENDING_APPROVAL
  -- activa=false: belt-and-suspenders (E4.C.3.1) — reset any supplier-pre-set activa=true
  UPDATE public.trade_marketplace_ad_creatives
  SET    estado       = 'PENDING_APPROVAL',
         activa       = false,
         submitted_at = now(),
         updated_at   = now()
  WHERE  id = p_creative_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_creative_for_review(uuid) TO authenticated;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. REVOKE INSERT + UPDATE on admin-only columns from authenticated
--    These columns must only be written by:
--    - SECURITY DEFINER RPCs (which run as function owner, not authenticated)
--    - Direct Supabase dashboard / service_role (bypasses column grants)
--
--    aprobada_por, aprobada_at:
--      Admin-only audit trail. Set when admin approves a creative.
--      No current admin UI sets these; future approval RPC will use DEFINER.
--
--    submitted_at:
--      Set only by submit_ad_creative_for_review (SECURITY DEFINER).
--      Client must never write this directly.
--      SELECT is kept — supplier and admin can read submission timestamp.
--
--    ia_model, ia_prompt_ref:
--      AI system metadata. Set only by AI generation pipeline.
--      No client should write these.
-- ────────────────────────────────────────────────────────────────────────────

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
  ON public.trade_marketplace_ad_creatives FROM authenticated;
