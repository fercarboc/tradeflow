-- Sprint Guest-1 · Migración 07
-- Objetivo: Perfil comercial del comprador invitado + tabla antifraude separada
-- C6: ip_hash y ua_hash NO en guest_customers (fingerprint no junto al perfil comercial)
--     Tabla antifraude separada con TTL de 90 días y HMAC con secreto de servidor
--     Finalidad exclusiva: detección de fraude en pedidos. Sin analítica comercial.

BEGIN;

-- ─── Perfil comercial del comprador invitado ────────────────────────────────────
-- Sin datos de fingerprinting: ip, user-agent, etc. van a tabla antifraude por separado.

CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_customers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text        NOT NULL,
  nombre          text,
  empresa         text,
  telefono        text,
  nif             text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  -- Vinculación voluntaria posterior (Sprint Guest-2: magic link)
  linked_org_id   uuid        REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  linked_at       timestamptz,
  -- C1: Claim de pedidos históricos tras registro (ver CHECK en orders)
  -- claimed_by_org_id: la org que ha reclamado los pedidos. La compra conserva origen='guest'.
  -- Implementación claim diferida a Sprint Guest-2. Columna creada aquí para coherencia.
  claimed_by_org_id uuid      REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  claimed_at      timestamptz,
  CONSTRAINT email_format CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT claim_requires_linked CHECK (
    claimed_by_org_id IS NULL OR linked_org_id IS NOT NULL
  )
);

-- No UNIQUE en email: un mismo email puede tener múltiples compras como invitado.
-- La deduplicación por ventana de tiempo (24h) se gestiona en la Edge Function checkout-guest.
CREATE INDEX IF NOT EXISTS idx_guest_customers_email
  ON public.trade_marketplace_guest_customers (email);

CREATE INDEX IF NOT EXISTS idx_guest_customers_linked
  ON public.trade_marketplace_guest_customers (linked_org_id)
  WHERE linked_org_id IS NOT NULL;

-- ─── Señales antifraude: tabla separada con TTL ─────────────────────────────────
-- C6: No se almacena el fingerprint junto al perfil comercial.
--     Finalidad: detección de fraude exclusivamente.
--     Retención máxima: 90 días (TTL). Limpieza automática vía cron (pendiente Sprint Guest-3).
--     signal_hash: HMAC-SHA256 con secreto de servidor (app.settings.antifraude_hmac_secret).
--       No es SHA-256 simple: el secreto evita que un atacante pueda precalcular hashes de IPs.
--     No se expone a ningún usuario autenticado ni anónimo (solo service_role).
--     No se usa para analítica comercial.

CREATE TABLE IF NOT EXISTS public.trade_marketplace_guest_antifraud_signals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_key  text        NOT NULL,   -- vincula con la operación de compra (no FK a evitar cascade)
  signal_type   text        NOT NULL    CHECK (signal_type IN ('ip', 'user_agent', 'device')),
  signal_hash   text        NOT NULL,   -- HMAC-SHA256(raw_value, antifraude_hmac_secret)
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '90 days')
  -- Sin FK a guest_customers: disociar fingerprinting del perfil comercial
);

CREATE INDEX IF NOT EXISTS idx_antifraude_checkout_key
  ON public.trade_marketplace_guest_antifraud_signals (checkout_key, signal_type);

CREATE INDEX IF NOT EXISTS idx_antifraude_expiry
  ON public.trade_marketplace_guest_antifraud_signals (expires_at)
  WHERE expires_at < now();  -- facilita la limpieza por cron

COMMENT ON TABLE public.trade_marketplace_guest_antifraud_signals
  IS 'Señales antifraude con TTL de 90 días. Finalidad exclusiva: detección de fraude en pedidos. Sin analítica comercial. signal_hash = HMAC-SHA256 con secreto de servidor, no SHA-256 simple.';
COMMENT ON COLUMN public.trade_marketplace_guest_antifraud_signals.signal_hash
  IS 'HMAC-SHA256(valor_raw, app.settings.antifraude_hmac_secret). El secreto de servidor evita precálculo de tablas rainbow.';
COMMENT ON COLUMN public.trade_marketplace_guest_antifraud_signals.expires_at
  IS 'Retención máxima 90 días. Limpiar con: DELETE FROM ... WHERE expires_at < now()';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- DROP TABLE IF EXISTS public.trade_marketplace_guest_antifraud_signals CASCADE;
-- DROP TABLE IF EXISTS public.trade_marketplace_guest_customers CASCADE;
-- COMMIT;
