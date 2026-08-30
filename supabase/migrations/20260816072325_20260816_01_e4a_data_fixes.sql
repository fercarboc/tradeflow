
-- E4.A: Corrección campaign_source en 2 campañas fallback TrabFlow
-- Pre-condiciones verificadas 2026-08-16:
--   TW-FB-LT  (MARKET_HOME_LEFT_TOP)   : existe, es fallback, actor_id=NULL, sin booking
--   TW-FB-PC1 (MARKET_HOME_PROMO_CARD_1): existe, es fallback, actor_id=NULL, sin booking

DO $verify$
DECLARE
  tw_fb_lt_id  uuid;
  tw_fb_pc1_id uuid;
  lt_is_fallback  boolean;
  pc1_is_fallback boolean;
BEGIN
  SELECT id INTO tw_fb_lt_id
  FROM public.trade_marketplace_ad_campaigns
  WHERE nombre = 'TW-FB-LT' AND campaign_source = 'supplier';

  SELECT id INTO tw_fb_pc1_id
  FROM public.trade_marketplace_ad_campaigns
  WHERE nombre = 'TW-FB-PC1' AND campaign_source = 'supplier';

  IF tw_fb_lt_id IS NULL THEN
    RAISE EXCEPTION 'TW-FB-LT not found or already corrected — check before re-running';
  END IF;
  IF tw_fb_pc1_id IS NULL THEN
    RAISE EXCEPTION 'TW-FB-PC1 not found or already corrected — check before re-running';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.trade_marketplace_ad_slots
    WHERE fallback_campaign_id = tw_fb_lt_id
  ) INTO lt_is_fallback;

  SELECT EXISTS(
    SELECT 1 FROM public.trade_marketplace_ad_slots
    WHERE fallback_campaign_id = tw_fb_pc1_id
  ) INTO pc1_is_fallback;

  IF NOT lt_is_fallback THEN
    RAISE EXCEPTION 'TW-FB-LT is not referenced as fallback_campaign_id — aborting';
  END IF;
  IF NOT pc1_is_fallback THEN
    RAISE EXCEPTION 'TW-FB-PC1 is not referenced as fallback_campaign_id — aborting';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.trade_marketplace_ad_bookings
    WHERE slot_id = 'MARKET_HOME_LEFT_TOP' AND estado IN ('RESERVED','CONFIRMED')
  ) THEN
    RAISE EXCEPTION 'MARKET_HOME_LEFT_TOP has active booking — aborting';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.trade_marketplace_ad_bookings
    WHERE slot_id = 'MARKET_HOME_PROMO_CARD_1' AND estado IN ('RESERVED','CONFIRMED')
  ) THEN
    RAISE EXCEPTION 'MARKET_HOME_PROMO_CARD_1 has active booking — aborting';
  END IF;
END $verify$;

UPDATE public.trade_marketplace_ad_campaigns
SET    campaign_source = 'trabflow',
       updated_at      = now()
WHERE  nombre IN ('TW-FB-LT', 'TW-FB-PC1')
  AND  campaign_source = 'supplier';

DO $post_verify$
DECLARE
  fallback_count   integer;
  non_trabflow_fbs integer;
BEGIN
  SELECT count(*) INTO fallback_count
  FROM public.trade_marketplace_ad_slots
  WHERE fallback_campaign_id IS NOT NULL;

  IF fallback_count <> 16 THEN
    RAISE EXCEPTION 'Post-verify FAIL: expected 16 slots with fallback, got %', fallback_count;
  END IF;

  SELECT count(*) INTO non_trabflow_fbs
  FROM public.trade_marketplace_ad_slots  s
  JOIN public.trade_marketplace_ad_campaigns c ON c.id = s.fallback_campaign_id
  WHERE c.campaign_source <> 'trabflow';

  IF non_trabflow_fbs <> 0 THEN
    RAISE EXCEPTION 'Post-verify FAIL: % fallback campaign(s) still have non-trabflow source', non_trabflow_fbs;
  END IF;

  RAISE NOTICE 'E4.A data fix OK: 16/16 fallbacks present, all campaign_source=trabflow';
END $post_verify$;
;
