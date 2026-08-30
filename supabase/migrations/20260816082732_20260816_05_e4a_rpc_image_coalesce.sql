
-- E4.A.1: get_active_campaigns — COALESCE(creative.image_url, campaign.image_url)
-- Permite subir imagen directamente en formulario Admin sin necesidad de crear Creative separada.
-- Si existe Creative activa → Creative tiene prioridad.
-- Si no existe Creative → usa campaign.image_url / mobile_image_url.
-- La selección de campaña (tier 1-4) NO se altera.

CREATE OR REPLACE FUNCTION public.get_active_campaigns(p_slot_ids text[])
RETURNS TABLE (
  slot_id           text,
  campaign_id       uuid,
  campaign_source   text,
  resolution_level  integer,
  advertiser_name   text,
  eyebrow           text,
  title             text,
  subtitle          text,
  cta_label         text,
  destination_type  text,
  destination_value text,
  priority          integer,
  accent            text,
  bg                text,
  text_color        text,
  image_url         text,
  mobile_image_url  text
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
    -- Creative activa tiene prioridad; campaign.image_url como fallback
    COALESCE(cr.image_url, c.image_url)                                             AS image_url,
    COALESCE(cr.mobile_image_url, c.mobile_image_url, cr.image_url, c.image_url)   AS mobile_image_url,
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
)
SELECT DISTINCT ON (slot_id)
  slot_id,
  id              AS campaign_id,
  campaign_source,
  tier            AS resolution_level,
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

-- Post-verificación: RPC sigue devolviendo 16/16 para todos los slots
DO $$
DECLARE v_rows int;
BEGIN
  SELECT count(*) INTO v_rows
  FROM public.get_active_campaigns(ARRAY[
    'MARKET_HOME_HERO_1','MARKET_HOME_HERO_2','MARKET_HOME_HERO_3',
    'MARKET_HOME_LEFT_TOP','MARKET_HOME_LEFT_MID','MARKET_HOME_LEFT_BOTTOM',
    'MARKET_HOME_RIGHT_TOP','MARKET_HOME_RIGHT_MID','MARKET_HOME_RIGHT_BOTTOM',
    'MARKET_HOME_MOBILE_PROMO_1','MARKET_HOME_MOBILE_PROMO_2',
    'MARKET_HOME_PROMO_CARD_1','MARKET_HOME_PROMO_CARD_2',
    'MARKET_HOME_PROMO_CARD_3','MARKET_HOME_PROMO_CARD_4',
    'MARKET_CATALOG_HERO'
  ]);
  IF v_rows <> 16 THEN
    RAISE EXCEPTION 'E4A-M5: get_active_campaigns devuelve % filas en lugar de 16', v_rows;
  END IF;
END $$;
;
