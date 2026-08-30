
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS familia text;
;
