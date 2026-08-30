-- trade_clients: add fiscal profile columns for tipo_cliente and apellidos
-- Supports: Particular, Autónomo, Empresa client types
-- Existing clients receive DEFAULT 'particular' — non-destructive

ALTER TABLE public.trade_clients
  ADD COLUMN IF NOT EXISTS tipo_cliente TEXT DEFAULT 'particular',
  ADD COLUMN IF NOT EXISTS apellidos TEXT;

-- Constraint on tipo_cliente values (idempotent: only add if not present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'trade_clients'
      AND constraint_name = 'trade_clients_tipo_cliente_check'
  ) THEN
    ALTER TABLE public.trade_clients
      ADD CONSTRAINT trade_clients_tipo_cliente_check
      CHECK (tipo_cliente IN ('particular', 'autonomo', 'empresa'));
  END IF;
END$$;
