
ALTER TABLE trade_platform_invoices
  ADD COLUMN IF NOT EXISTS invoice_url     text,
  ADD COLUMN IF NOT EXISTS invoice_pdf_url text,
  ADD COLUMN IF NOT EXISTS plan            text;
;
