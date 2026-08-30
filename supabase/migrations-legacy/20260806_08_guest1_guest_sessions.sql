-- Sprint Guest-1 · Migración 08
-- Objetivo: Tokens de seguimiento para pedidos de invitados
-- C7: Sesión vinculada a checkout_key (no solo a guest_id)
--     Un token recupera SOLO los pedidos de esa operación de compra concreta

BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         uuid        NOT NULL
                               REFERENCES public.trade_marketplace_guest_customers(id)
                               ON DELETE CASCADE,
  -- C7: checkout_key vincula el token a la operación concreta.
  -- Lookup de pedidos: WHERE orders.checkout_key = session.checkout_key
  --                    AND orders.guest_customer_id = session.guest_id
  -- El token NO da acceso a pedidos históricos de otras operaciones del mismo email.
  checkout_key     text        NOT NULL,
  token_hash       text        NOT NULL UNIQUE,  -- SHA-256(raw_token_32bytes_hex)
  token_prefix     text        NOT NULL,          -- primeros 8 chars del token raw (para display)
  scope            text        NOT NULL DEFAULT 'order_tracking'
                               CHECK (scope IN ('order_tracking', 'magic_link')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  last_accessed_at timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- El token raw (32 bytes hex) se genera en la Edge Function y NUNCA se almacena aquí.
  -- Se envía una sola vez por email al comprador.
  CONSTRAINT token_hash_length CHECK (char_length(token_hash) = 64),   -- SHA-256 = 64 hex chars
  CONSTRAINT token_prefix_length CHECK (char_length(token_prefix) >= 6)
);

-- Lookup principal: validar token al acceder al tracking
CREATE INDEX IF NOT EXISTS idx_guest_sessions_token_hash
  ON public.trade_marketplace_guest_sessions (token_hash);

-- Limpieza de tokens expirados / revocados
CREATE INDEX IF NOT EXISTS idx_guest_sessions_expiry
  ON public.trade_marketplace_guest_sessions (expires_at, revoked_at)
  WHERE revoked_at IS NULL;

-- Lookup por guest + checkout_key
CREATE INDEX IF NOT EXISTS idx_guest_sessions_guest_checkout
  ON public.trade_marketplace_guest_sessions (guest_id, checkout_key);

COMMENT ON TABLE public.trade_marketplace_guest_sessions
  IS 'Tokens de seguimiento para pedidos de invitados. Alcance por operación (checkout_key), no por guest histórico.';
COMMENT ON COLUMN public.trade_marketplace_guest_sessions.token_hash
  IS 'SHA-256 del token raw de 32 bytes. El token raw se genera en Edge Function y se envía solo por email.';
COMMENT ON COLUMN public.trade_marketplace_guest_sessions.checkout_key
  IS 'La operación de compra concreta. Los pedidos accesibles = orders WHERE checkout_key = session.checkout_key AND guest_customer_id = session.guest_id.';
COMMENT ON COLUMN public.trade_marketplace_guest_sessions.revoked_at
  IS 'Al revocar, el token queda inválido inmediatamente sin necesidad de borrar la fila.';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS public.trade_marketplace_guest_sessions CASCADE;
-- COMMIT;
