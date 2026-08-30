DROP FUNCTION IF EXISTS public.get_active_campaigns(text[]);

CREATE FUNCTION public.get_active_campaigns(p_slot_ids text[])
RETURNS TABLE(
  slot_id          text,
  campaign_id      uuid,
  campaign_source  text,
  resolution_level integer,
  advertiser_name  text,
  eyebrow          text,
  title            text,
  subtitle         text,
  cta_label        text,
  destination_type text,
  destination_value text,
  priority         integer,
  accent           text,
  bg               text,
  text_color       text,
  image_url        text,
  mobile_image_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH ranked AS (
  SELECT
    c.slot_id,
    c.id,
    c.campaign_source,
    c.advertiser_name,
    c.eyebrow,
    c.title,
    c.subtitle,
    c.cta_label,
    c.destination_type,
    c.destination_value,
    c.priority,
    c.accent,
    c.bg,
    c.text_color,
    COALESCE(cr.image_url, c.image_url)                                           AS image_url,
    COALESCE(cr.mobile_image_url, c.mobile_image_url, cr.image_url, c.image_url) AS mobile_image_url,
    CASE
      WHEN c.campaign_source IN ('supplier', 'demo')               THEN 1
      WHEN s.fallback_campaign_id = c.id                           THEN 2
      WHEN c.campaign_source = 'trabflow' AND c.oficio IS NOT NULL THEN 3
      WHEN c.campaign_source = 'trabflow' AND c.oficio IS NULL     THEN 4
      ELSE 5
    END AS tier
  FROM public.trade_marketplace_ad_campaigns c
  JOIN public.trade_marketplace_ad_slots s ON s.id = c.slot_id
  LEFT JOIN public.trade_marketplace_ad_creatives cr
    ON cr.campaign_id = c.id AND cr.activa = true
  WHERE c.slot_id = ANY(p_slot_ids)
    AND c.activa  = true
    AND c.estado  = 'ACTIVE'
    AND (c.start_at IS NULL OR c.start_at <= now())
    AND (c.end_at   IS NULL OR c.end_at   >  now())
    AND (
      c.campaign_source <> 'supplier'
      OR EXISTS (
        SELECT 1
        FROM public.trade_marketplace_ad_bookings b
        WHERE b.id     = c.booking_id
          AND b.estado IN ('RESERVED', 'CONFIRMED')
          AND b.inicio <= CURRENT_DATE
          AND b.fin    >= CURRENT_DATE
      )
    )
)
SELECT DISTINCT ON (slot_id)
  slot_id,
  id               AS campaign_id,
  campaign_source,
  tier             AS resolution_level,
  advertiser_name,
  eyebrow,
  title,
  subtitle,
  cta_label,
  destination_type,
  destination_value,
  priority,
  accent,
  bg,
  text_color,
  image_url,
  mobile_image_url
FROM ranked
ORDER BY slot_id, tier ASC, priority DESC, id;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_campaigns(text[]) TO anon, authenticated;;
