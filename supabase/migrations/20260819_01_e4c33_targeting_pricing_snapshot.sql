-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.3 — Migration 1: Targeting estructurado + modelo comercial
-- ═══════════════════════════════════════════════════════════════════════════
-- Adds pricing fields to slots, structured targeting + economic snapshot to
-- bookings, and structured targeting mirror to campaigns.
--
-- All new columns are NULLABLE — backward compatible with existing fallback
-- campaigns that use free-text destination_type/destination_value.
--
-- INVARIANTE: publicidad ≠ ranking. Sin pricing dinámico ni subastas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────────────
-- 1. trade_marketplace_ad_slots — tarifa configurable por espacio
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_ad_slots
  ADD COLUMN IF NOT EXISTS rate_amount       numeric(10,2),
  ADD COLUMN IF NOT EXISTS rate_currency     char(3) NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS rate_unit         text,
  ADD COLUMN IF NOT EXISTS min_duration_days integer,
  ADD COLUMN IF NOT EXISTS max_duration_days integer;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_slots_rate_unit_ck'
  ) THEN
    ALTER TABLE public.trade_marketplace_ad_slots
      ADD CONSTRAINT ad_slots_rate_unit_ck
        CHECK (rate_unit IS NULL OR rate_unit IN ('day','week','month'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 2. trade_marketplace_ad_bookings — targeting estructurado + snapshot económico
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD COLUMN IF NOT EXISTS target_type               text,
  ADD COLUMN IF NOT EXISTS target_id                 uuid,
  ADD COLUMN IF NOT EXISTS target_label              text,
  ADD COLUMN IF NOT EXISTS rate_amount_snapshot      numeric(10,2),
  ADD COLUMN IF NOT EXISTS rate_currency_snapshot    char(3),
  ADD COLUMN IF NOT EXISTS rate_unit_snapshot        text,
  ADD COLUMN IF NOT EXISTS estimated_days_snapshot   integer,
  ADD COLUMN IF NOT EXISTS estimated_total_snapshot  numeric(10,2),
  ADD COLUMN IF NOT EXISTS commercial_terms_snapshot jsonb;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_bookings_target_type_ck'
  ) THEN
    ALTER TABLE public.trade_marketplace_ad_bookings
      ADD CONSTRAINT ad_bookings_target_type_ck
        CHECK (target_type IS NULL OR target_type IN
               ('CATEGORY','TRADE','PRODUCT','BRAND','SUPPLIER','OFFERING'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 3. trade_marketplace_ad_campaigns — targeting estructurado (espejo del booking)
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD COLUMN IF NOT EXISTS target_type  text,
  ADD COLUMN IF NOT EXISTS target_id    uuid,
  ADD COLUMN IF NOT EXISTS target_label text;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ad_campaigns_target_type_ck'
  ) THEN
    ALTER TABLE public.trade_marketplace_ad_campaigns
      ADD CONSTRAINT ad_campaigns_target_type_ck
        CHECK (target_type IS NULL OR target_type IN
               ('CATEGORY','TRADE','PRODUCT','BRAND','SUPPLIER','OFFERING'));
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────────
-- 4. Tarifas orientativas en los 16 slots existentes
--    El admin puede ajustarlas desde la UI. Son referencia, no precio final.
-- ────────────────────────────────────────────────────────────────────────────

UPDATE public.trade_marketplace_ad_slots
SET rate_amount = 299, rate_unit = 'week',
    min_duration_days = 7, max_duration_days = 90
WHERE formato = 'carousel_slide' AND rate_amount IS NULL;

UPDATE public.trade_marketplace_ad_slots
SET rate_amount = 149, rate_unit = 'month',
    min_duration_days = 30, max_duration_days = 180
WHERE formato = 'banner_vertical' AND rate_amount IS NULL;

UPDATE public.trade_marketplace_ad_slots
SET rate_amount = 99, rate_unit = 'week',
    min_duration_days = 7, max_duration_days = 90
WHERE formato = 'mobile_promo' AND rate_amount IS NULL;

UPDATE public.trade_marketplace_ad_slots
SET rate_amount = 199, rate_unit = 'month',
    min_duration_days = 30, max_duration_days = 180
WHERE formato = 'promo_card' AND rate_amount IS NULL;

UPDATE public.trade_marketplace_ad_slots
SET rate_amount = 349, rate_unit = 'month',
    min_duration_days = 30, max_duration_days = 180
WHERE formato = 'catalog_banner' AND rate_amount IS NULL;
