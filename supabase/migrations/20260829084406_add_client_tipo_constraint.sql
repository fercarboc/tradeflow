
ALTER TABLE public.trade_clients
  ADD CONSTRAINT trade_clients_tipo_cliente_check
  CHECK (tipo_cliente IN ('particular', 'autonomo', 'empresa'));
;
