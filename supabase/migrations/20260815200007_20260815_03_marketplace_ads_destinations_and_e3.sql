
ALTER TABLE public.trade_marketplace_ad_campaigns
  DROP CONSTRAINT IF EXISTS chk_campaign_dest;

ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD CONSTRAINT chk_campaign_dest
  CHECK (destination_type = ANY(ARRAY[
    'catalog'::text,
    'category'::text,
    'supplier'::text,
    'search'::text,
    'product'::text,
    'offer'::text
  ]));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trade_marketplace_ad_campaigns'::regclass
      AND conname   = 'chk_campaign_dest'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAILED: chk_campaign_dest constraint not found after migration';
  END IF;
END $$;
;
