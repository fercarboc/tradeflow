-- Step 1: Remove table-level INSERT, UPDATE, DELETE from authenticated
REVOKE INSERT, UPDATE, DELETE
  ON public.trade_marketplace_ad_creatives
  FROM authenticated;

-- Step 2: Re-grant INSERT on safe supplier-writable columns only
GRANT INSERT (
  campaign_id,
  creative_mode,
  image_url,
  mobile_image_url,
  headline,
  body_text,
  cta_text,
  alt_text,
  text_position,
  overlay_strength,
  price_display,
  old_price_display,
  discount_label,
  theme_preset,
  estado,
  activa,
  updated_at
) ON public.trade_marketplace_ad_creatives TO authenticated;

-- Step 3: Re-grant UPDATE on safe supplier-editable columns only
-- campaign_id excluded: immutable once the creative exists
GRANT UPDATE (
  creative_mode,
  image_url,
  mobile_image_url,
  headline,
  body_text,
  cta_text,
  alt_text,
  text_position,
  overlay_strength,
  price_display,
  old_price_display,
  discount_label,
  theme_preset,
  estado,
  activa,
  updated_at
) ON public.trade_marketplace_ad_creatives TO authenticated;;
