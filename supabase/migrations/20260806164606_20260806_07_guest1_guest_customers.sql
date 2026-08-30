-- Sprint Guest-1 · Migración 07 — Perfil comercial invitado + tabla antifraude separada (C6)

CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_customers (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text        NOT NULL,
  nombre            text,
  empresa           text,
  telefono          text,
  nif               text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  linked_org_id     uuid        REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  linked_at         timestamptz,
  claimed_by_org_id uuid        REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  claimed_at        timestamptz,
  CONSTRAINT email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT claim_requires_linked CHECK (
    claimed_by_org_id IS NULL OR linked_org_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_guest_customers_email
  ON public.trade_marketplace_guest_customers (email);

CREATE INDEX IF NOT EXISTS idx_guest_customers_linked
  ON public.trade_marketplace_guest_customers (linked_org_id)
  WHERE linked_org_id IS NOT NULL;

-- Tabla antifraude separada: sin FK a guest_customers (C6)
-- signal_hash = HMAC-SHA256(valor_raw, antifraude_hmac_secret) — secreto de servidor
-- Retención máxima 90 días. Finalidad exclusiva: detección de fraude.
CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_antifraud_signals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_key  text        NOT NULL,
  signal_type   text        NOT NULL CHECK (signal_type IN ('ip', 'user_agent', 'device')),
  signal_hash   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);

CREATE INDEX IF NOT EXISTS idx_antifraude_checkout_key
  ON public.trade_marketplace_guest_antifraud_signals (checkout_key, signal_type);

CREATE INDEX IF NOT EXISTS idx_antifraude_expiry
  ON public.trade_marketplace_guest_antifraud_signals (expires_at);

COMMENT ON TABLE public.trade_marketplace_guest_antifraud_signals
  IS 'Señales antifraude TTL 90 días. signal_hash = HMAC-SHA256 con secreto de servidor. Sin link a perfil comercial (C6).';;
