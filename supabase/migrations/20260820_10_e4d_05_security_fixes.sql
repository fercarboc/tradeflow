-- ═══════════════════════════════════════════════════════════════════════════
-- E4.D — Migration 5: Security fixes D29 + D30
-- ═══════════════════════════════════════════════════════════════════════════
-- D29 FIX: ad_creatives_select exponía TODAS las creatividades de campañas
-- ACTIVE (incluidas DRAFT/PENDING) a cualquier usuario autenticado.
-- La primera condición solo checkea si la CAMPAÑA es activa — no el estado
-- de la CREATIVIDAD. En Case 9, Supplier A tiene campaña ACTIVE con
-- creatividad PENDING_APPROVAL: Supplier B podía ver el contenido de esa
-- creatividad (headline, image_url, body_text) via SELECT directo.
--
-- FIX: añadir `activa = true` a la condición pública para que solo la
-- creatividad PUBLICADA sea visible a no-propietarios.
--
-- D30 FIX: admin RPCs tenían EXECUTE grant a PUBLIC (comportamiento por
-- defecto de PostgreSQL CREATE FUNCTION). Los RPCs rechazaban llamadas
-- de anon via _mkt_is_platform_admin(), pero violaba el principio de
-- mínimo privilegio. Fix: REVOKE FROM PUBLIC + GRANT TO authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── D29: Fix RLS SELECT ad_creatives ────────────────────────────────────────
DROP POLICY IF EXISTS ad_creatives_select ON public.trade_marketplace_ad_creatives;

CREATE POLICY ad_creatives_select
  ON public.trade_marketplace_ad_creatives
  FOR SELECT TO authenticated
  USING (
    -- Solo la creatividad PUBLICADA (activa=true) es visible para no-propietarios
    (
      activa = true
      AND campaign_id IN (
        SELECT c.id
        FROM public.trade_marketplace_ad_campaigns c
        WHERE c.activa = true AND c.estado = 'ACTIVE'
      )
    )
    -- El proveedor ve TODAS sus propias creatividades (DRAFT, PENDING, APPROVED, REJECTED)
    OR campaign_id IN (
      SELECT c.id
      FROM public.trade_marketplace_ad_campaigns c
      WHERE c.actor_id = ANY(public._mkt_actor_ids_for_user())
    )
    -- Admin ve todo
    OR public._mkt_is_platform_admin()
  );

-- ─── D30: REVOKE PUBLIC de admin RPCs ────────────────────────────────────────
-- PostgreSQL por defecto da EXECUTE a PUBLIC en CREATE FUNCTION.
-- Esto permite que anon llame a los RPCs (recibiría error de admin-only,
-- pero viola mínimo privilegio). REVOKE + re-GRANT solo a authenticated.

REVOKE ALL ON FUNCTION public.admin_approve_ad_creative(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_reject_ad_creative(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_publish_ad_creative(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_ad_creatives() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_approve_ad_creative(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_ad_creative(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_publish_ad_creative(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_ad_creatives() TO authenticated;
