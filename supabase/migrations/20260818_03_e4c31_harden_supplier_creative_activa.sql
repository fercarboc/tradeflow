-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.1 — Harden supplier creative submission: enforce activa=false
-- ═══════════════════════════════════════════════════════════════════════════
-- ISSUE FOUND IN AUDIT (RC1-C.8.E):
--
-- The supplier INSERT and UPDATE policies on trade_marketplace_ad_creatives
-- did not restrict the `activa` column.  A supplier could craft a direct
-- Supabase API call (bypassing the React UI which sends activa=false) and
-- insert or update a DRAFT creative with activa=true.
--
-- Although get_active_campaigns guards against exposure
--   (WHERE c.activa=true AND c.estado='ACTIVE'),
-- if an admin later activates the campaign without explicitly setting
-- activa=false on creatives, the pre-activated creative would auto-publish
-- without completing the intended approval flow.
--
-- Three-layer fix:
--   1. Harden INSERT WITH CHECK: enforce activa=false
--   2. Harden UPDATE WITH CHECK: enforce activa=false
--   3. submit_ad_creative_for_review: reset activa=false unconditionally
--      (belt-and-suspenders: even if layers 1-2 are bypassed, submit resets)
--
-- Scope: strictly E4.C.3 — no other tables, RPCs, or flows touched.
--
-- INVARIANTE: publicidad ≠ ranking. No toca pricing, ranking ni scores.
--
-- Rollback:
--   DROP POLICY IF EXISTS "ad_creatives_supplier_insert" ON public.trade_marketplace_ad_creatives;
--   DROP POLICY IF EXISTS "ad_creatives_supplier_update"  ON public.trade_marketplace_ad_creatives;
--   (then re-create without the activa=false clauses from migration 20260818_02)
--   (and re-create submit_ad_creative_for_review without the activa=false line)
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. Harden INSERT policy: supplier CANNOT insert with activa=true
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ad_creatives_supplier_insert" ON public.trade_marketplace_ad_creatives;

CREATE POLICY "ad_creatives_supplier_insert"
ON public.trade_marketplace_ad_creatives
FOR INSERT TO authenticated
WITH CHECK (
  estado     = 'DRAFT'
  AND activa = false
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
      AND  estado   = 'DRAFT'
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 2. Harden UPDATE policy: supplier CANNOT set activa=true on DRAFT creative
-- ────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "ad_creatives_supplier_update" ON public.trade_marketplace_ad_creatives;

CREATE POLICY "ad_creatives_supplier_update"
ON public.trade_marketplace_ad_creatives
FOR UPDATE TO authenticated
USING (
  estado     = 'DRAFT'
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
)
WITH CHECK (
  estado     = 'DRAFT'
  AND activa = false
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
);

-- ────────────────────────────────────────────────────────────────────────────
-- 3. submit_ad_creative_for_review: reset activa=false on submit
--    Belt-and-suspenders: even if DB policies are somehow bypassed,
--    the submit RPC always clears activa before transitioning to PENDING.
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
BEGIN
  SELECT c.actor_id, cr.estado::text
  INTO   v_actor_id, v_creative_est
  FROM   public.trade_marketplace_ad_creatives cr
  JOIN   public.trade_marketplace_ad_campaigns  c ON c.id = cr.campaign_id
  WHERE  cr.id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_creative_est <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden enviar creatividades en estado DRAFT (estado actual: %)', v_creative_est;
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET    estado       = 'PENDING_APPROVAL',
         activa       = false,          -- reset any supplier-set activa=true
         submitted_at = now(),
         updated_at   = now()
  WHERE  id = p_creative_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_creative_for_review(uuid) TO authenticated;
