
ALTER TABLE public.trade_waitlist
  ADD COLUMN IF NOT EXISTS lead_type        text DEFAULT 'installer',
  ADD COLUMN IF NOT EXISTS company_name     text,
  ADD COLUMN IF NOT EXISTS company_type     text,
  ADD COLUMN IF NOT EXISTS website          text,
  ADD COLUMN IF NOT EXISTS province         text,
  ADD COLUMN IF NOT EXISTS geographic_coverage text,
  ADD COLUMN IF NOT EXISTS catalog_size     text,
  ADD COLUMN IF NOT EXISTS interests        text[],
  ADD COLUMN IF NOT EXISTS provider_interest          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advertising_interest       boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_provider_interest boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_provider          boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS advertising_discount_percent integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS campaign_type    text,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS desired_period   text,
  ADD COLUMN IF NOT EXISTS desired_ad_space text,
  ADD COLUMN IF NOT EXISTS estimated_budget text,
  ADD COLUMN IF NOT EXISTS next_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_org_id  uuid;

CREATE INDEX IF NOT EXISTS idx_trade_waitlist_lead_type ON public.trade_waitlist (lead_type);
;
