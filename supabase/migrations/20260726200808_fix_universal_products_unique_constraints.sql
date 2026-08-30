
-- Cambiar NULLS NOT DISTINCT → comportamiento estándar (NULLS DISTINCT)
-- para permitir múltiples productos sin EAN/GTIN/global_catalog_id

ALTER TABLE public.trade_marketplace_universal_products
  DROP CONSTRAINT IF EXISTS uq_up_ean,
  DROP CONSTRAINT IF EXISTS uq_up_global_cat,
  DROP CONSTRAINT IF EXISTS uq_up_gtin;

ALTER TABLE public.trade_marketplace_universal_products
  ADD CONSTRAINT uq_up_ean        UNIQUE (ean),
  ADD CONSTRAINT uq_up_global_cat UNIQUE (global_catalog_id),
  ADD CONSTRAINT uq_up_gtin       UNIQUE (gtin);
;
