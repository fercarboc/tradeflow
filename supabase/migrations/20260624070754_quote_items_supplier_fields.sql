
ALTER TABLE trade_quote_items
  ADD COLUMN IF NOT EXISTS supplier_key text,
  ADD COLUMN IF NOT EXISTS supplier_name text,
  ADD COLUMN IF NOT EXISTS supplier_ref text,
  ADD COLUMN IF NOT EXISTS catalog_variant_id uuid,
  ADD COLUMN IF NOT EXISTS material_order_placed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quote_items_order_placed
  ON trade_quote_items(material_order_placed)
  WHERE tipo = 'material' AND material_order_placed = false;
;
