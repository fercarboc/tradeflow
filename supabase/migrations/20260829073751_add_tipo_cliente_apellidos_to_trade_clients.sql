
ALTER TABLE public.trade_clients
  ADD COLUMN IF NOT EXISTS tipo_cliente TEXT DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS apellidos TEXT;
;
