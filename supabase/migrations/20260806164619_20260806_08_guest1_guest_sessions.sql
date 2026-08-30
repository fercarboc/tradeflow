-- Sprint Guest-1 · Migración 08 — Tokens de seguimiento para invitados (C7)
-- checkout_key vincula el token a la operación concreta, no a todo el historial del guest

CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id         uuid        NOT NULL
                               REFERENCES public.trade_marketplace_guest_customers(id)
                               ON DELETE CASCADE,
  checkout_key     text        NOT NULL,
  token_hash       text        NOT NULL UNIQUE,
  token_prefix     text        NOT NULL,
  scope            text        NOT NULL DEFAULT 'order_tracking'
                               CHECK (scope IN ('order_tracking', 'magic_link')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  last_accessed_at timestamptz,
  revoked_at       timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT token_hash_length   CHECK (char_length(token_hash) = 64),
  CONSTRAINT token_prefix_length CHECK (char_length(token_prefix) >= 6)
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_token_hash
  ON public.trade_marketplace_guest_sessions (token_hash);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expiry
  ON public.trade_marketplace_guest_sessions (expires_at, revoked_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_guest_sessions_guest_checkout
  ON public.trade_marketplace_guest_sessions (guest_id, checkout_key);

COMMENT ON COLUMN public.trade_marketplace_guest_sessions.checkout_key
  IS 'Vincula el token a la operación concreta. Pedidos accesibles: WHERE orders.checkout_key = session.checkout_key AND guest_customer_id = session.guest_id.';;
