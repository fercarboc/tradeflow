
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS banco text,
  ADD COLUMN IF NOT EXISTS titular_cuenta text;
;
