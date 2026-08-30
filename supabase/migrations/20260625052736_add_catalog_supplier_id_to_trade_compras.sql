ALTER TABLE public.trade_compras ADD COLUMN IF NOT EXISTS catalog_supplier_id uuid REFERENCES public.trade_supplier_catalogs(id) ON DELETE SET NULL;;
