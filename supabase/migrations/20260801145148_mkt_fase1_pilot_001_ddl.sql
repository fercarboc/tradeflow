
ALTER TABLE public.trade_marketplace_universal_product_variants
  ADD COLUMN IF NOT EXISTS global_catalog_id uuid
  REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_global_catalog_id
  ON public.trade_marketplace_universal_product_variants(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_variant_global_catalog_id
  ON public.trade_marketplace_universal_product_variants(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;
;
