
-- MKT-FASE1-PILOT-002 C-001: IDs estructurados en trade_quote_items
-- Añade global_catalog_id, universal_product_id, universal_variant_id
-- con FKs ON DELETE SET NULL e índices parciales

ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS global_catalog_id   uuid
    REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_product_id uuid
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_variant_id uuid
    REFERENCES public.trade_marketplace_universal_product_variants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_global_catalog_id
  ON public.trade_quote_items(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_universal_product_id
  ON public.trade_quote_items(universal_product_id)
  WHERE universal_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_universal_variant_id
  ON public.trade_quote_items(universal_variant_id)
  WHERE universal_variant_id IS NOT NULL;
;
