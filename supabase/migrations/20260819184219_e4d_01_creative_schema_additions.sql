-- ─── 1. Nuevas columnas de auditoría editorial
ALTER TABLE public.trade_marketplace_ad_creatives
  ADD COLUMN IF NOT EXISTS rechazo_motivo text,
  ADD COLUMN IF NOT EXISTS published_at   timestamptz,
  ADD COLUMN IF NOT EXISTS published_by   uuid;

-- ─── 2. Índice único: máximo 1 creatividad activa por campaña
CREATE UNIQUE INDEX IF NOT EXISTS uq_creative_activa_per_campaign
  ON public.trade_marketplace_ad_creatives (campaign_id)
  WHERE activa = true;

-- ─── 3. Grants de columna a authenticated
GRANT SELECT (rechazo_motivo, published_at)
  ON public.trade_marketplace_ad_creatives TO authenticated;

-- ─── 4. DROP + CREATE admin_get_ad_creatives con nuevos campos
DROP FUNCTION IF EXISTS public.admin_get_ad_creatives();

CREATE FUNCTION public.admin_get_ad_creatives()
RETURNS TABLE (
  id               uuid,
  campaign_id      uuid,
  image_url        text,
  mobile_image_url text,
  headline         text,
  body_text        text,
  cta_text         text,
  alt_text         text,
  generada_ia      boolean,
  activa           boolean,
  aprobada_at      timestamptz,
  aprobada_por     uuid,
  creative_mode    text,
  text_position    text,
  overlay_strength integer,
  price_display    numeric,
  old_price_display numeric,
  discount_label   text,
  theme_preset     text,
  estado           text,
  submitted_at     timestamptz,
  rechazo_motivo   text,
  published_at     timestamptz,
  published_by     uuid,
  created_at       timestamptz,
  updated_at       timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, campaign_id,
    image_url, mobile_image_url,
    headline, body_text, cta_text, alt_text,
    generada_ia, activa,
    aprobada_at, aprobada_por,
    creative_mode::text, text_position::text, overlay_strength,
    price_display, old_price_display, discount_label,
    theme_preset::text,
    estado::text, submitted_at,
    rechazo_motivo, published_at, published_by,
    created_at, updated_at
  FROM public.trade_marketplace_ad_creatives
  WHERE public._mkt_is_platform_admin()
  ORDER BY submitted_at DESC NULLS LAST, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ad_creatives() TO authenticated;;
