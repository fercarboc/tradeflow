ALTER TABLE public.trade_invoices ADD COLUMN IF NOT EXISTS view_token uuid DEFAULT gen_random_uuid();
UPDATE public.trade_invoices SET view_token = gen_random_uuid() WHERE view_token IS NULL;;
