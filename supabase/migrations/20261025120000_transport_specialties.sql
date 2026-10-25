-- TX-1C FASE 1: structured transport columns (supersedes draft transport_specialties)
-- transport_specialties was never deployed remotely; these columns replace it.
--
-- COLUMN PURPOSES:
--   transport_modalidad     — Primary activity type. Set by the org during onboarding.
--                             Values: viajeros | mercancias | reparto | combinada
--                             NOT a license gate; use transport_enabled for that.
--   transport_service_types — Offered service types within the modality.
--                             Set by the org during onboarding. Informational.
--   transport_license       — Explicit entitlement level. Set ONLY by admin.
--                             Values: none | demo | pilot | production
--                             UI must rely on this for "Transporte Demo" badge, not Stripe inference.
--   transport_rates         — Per-org commercial rate configuration (€/km, €/h, etc.).
--                             DB-persisted for device-independent access.
--                             Keys: precio_km | precio_hora | precio_jornada | precio_trayecto
--
-- INVARIANTS:
--   * transport_enabled (existing) is the authoritative module access gate (server trigger protects it).
--   * transport_license does NOT grant module access; it only affects UI tier display.
--   * Limits derived from these columns are informative only until server-side enforcement is added.

ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS transport_modalidad text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS transport_service_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_license text DEFAULT 'none'
    CONSTRAINT transport_license_check CHECK (transport_license IN ('none','demo','pilot','production')),
  ADD COLUMN IF NOT EXISTS transport_rates jsonb DEFAULT '{}'::jsonb;
