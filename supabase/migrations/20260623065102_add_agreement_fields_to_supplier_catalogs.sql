
ALTER TABLE trade_supplier_catalogs
  ADD COLUMN IF NOT EXISTS acuerdo_estado text DEFAULT 'sin_acuerdo',
  ADD COLUMN IF NOT EXISTS admin_notes     text,
  ADD COLUMN IF NOT EXISTS contact_name   text,
  ADD COLUMN IF NOT EXISTS contact_email  text;
;
