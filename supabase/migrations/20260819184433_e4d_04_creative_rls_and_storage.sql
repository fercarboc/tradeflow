-- Fix RLS INSERT: permitir ACTIVE campaigns con reserva válida
DROP POLICY IF EXISTS ad_creatives_supplier_insert ON public.trade_marketplace_ad_creatives;

CREATE POLICY ad_creatives_supplier_insert
  ON public.trade_marketplace_ad_creatives
  FOR INSERT TO authenticated
  WITH CHECK (
    estado    = 'DRAFT'
    AND activa = false
    AND campaign_id IN (
      SELECT c.id
      FROM public.trade_marketplace_ad_campaigns c
      JOIN public.trade_marketplace_ad_bookings b ON b.id = c.booking_id
      WHERE c.actor_id = ANY(public._mkt_actor_ids_for_user())
        AND c.estado   IN ('DRAFT', 'ACTIVE')
        AND b.estado   IN ('RESERVED', 'CONFIRMED')
    )
  );

-- Helper: valida que la creatividad es DRAFT propia con campaña válida
CREATE OR REPLACE FUNCTION public._mkt_creative_is_own_draft(
  p_creative_id uuid,
  p_actor_id    uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_marketplace_ad_creatives cr
    JOIN public.trade_marketplace_ad_campaigns c ON c.id = cr.campaign_id
    WHERE cr.id      = p_creative_id
      AND cr.estado  = 'DRAFT'
      AND c.actor_id = p_actor_id
      AND c.estado   IN ('DRAFT', 'ACTIVE')
      AND (
        c.campaign_source <> 'supplier'
        OR EXISTS (
          SELECT 1
          FROM public.trade_marketplace_ad_bookings b
          WHERE b.id     = c.booking_id
            AND b.estado IN ('RESERVED', 'CONFIRMED')
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public._mkt_creative_is_own_draft(uuid, uuid) TO authenticated;

-- Storage: path de 4 niveles ads/{actor}/{campaign}/{creative}/{file}
DROP POLICY IF EXISTS mkt_off_ads_supplier_creative_insert ON storage.objects;

CREATE POLICY mkt_off_ads_supplier_creative_insert
  ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-offerings'
    AND name ~ '^ads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
    AND (split_part(name, '/', 2))::uuid = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_creative_is_own_draft(
          (split_part(name, '/', 4))::uuid,
          (split_part(name, '/', 2))::uuid
        )
  );;
