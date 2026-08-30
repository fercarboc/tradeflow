-- ═══════════════════════════════════════════════════════════════════════════
-- E4.D — Migration 5: Security fixes D29 + D30
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── D29: Fix RLS SELECT ad_creatives ────────────────────────────────────────
DROP POLICY IF EXISTS ad_creatives_select ON public.trade_marketplace_ad_creatives;

CREATE POLICY ad_creatives_select
  ON public.trade_marketplace_ad_creatives
  FOR SELECT TO authenticated
  USING (
    (
      activa = true
      AND campaign_id IN (
        SELECT c.id
        FROM public.trade_marketplace_ad_campaigns c
        WHERE c.activa = true AND c.estado = 'ACTIVE'
      )
    )
    OR campaign_id IN (
      SELECT c.id
      FROM public.trade_marketplace_ad_campaigns c
      WHERE c.actor_id = ANY(public._mkt_actor_ids_for_user())
    )
    OR public._mkt_is_platform_admin()
  );

-- ─── D30: REVOKE PUBLIC de admin RPCs ────────────────────────────────────────
REVOKE ALL ON FUNCTION public.admin_approve_ad_creative(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reject_ad_creative(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_ad_creative(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_ad_creatives() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_approve_ad_creative(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_ad_creative(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_ad_creative(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ad_creatives() TO authenticated;;
