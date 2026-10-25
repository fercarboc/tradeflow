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
  ADD COLUMN IF NOT EXISTS transport_modalidad text DEFAULT NULL
    CONSTRAINT transport_modalidad_check CHECK (transport_modalidad IN ('viajeros','mercancias','reparto','combinada')),
  ADD COLUMN IF NOT EXISTS transport_service_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS transport_license text DEFAULT 'none'
    CONSTRAINT transport_license_check CHECK (transport_license IN ('none','demo','pilot','production')),
  ADD COLUMN IF NOT EXISTS transport_rates jsonb DEFAULT '{}'::jsonb;

-- ── Protección de transport_license ─────────────────────────────────
-- Bloquea cambios a transport_license por usuarios autenticados o anon.
-- Solo service_role (Studio) o postgres (acceso directo) pueden modificarlo.
--
-- Razón: transport_license es el entitlement de nivel de acceso (demo/pilot/production).
-- Que un propietario se auto-asigne 'demo' o 'production' burlaría el control comercial.
-- La única forma autorizada de modificarlo es desde Supabase Studio o psql directo:
--   UPDATE public.trade_organizations
--   SET transport_license = 'demo'
--   WHERE id = '<org_id>';

CREATE OR REPLACE FUNCTION public._protect_transport_license()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transport_license IS DISTINCT FROM OLD.transport_license THEN
    IF auth.uid() IS NOT NULL OR current_user = 'anon' THEN
      RAISE EXCEPTION 'TRANSPORT_LICENSE_PROTECTED: solo el equipo de TrabFlow puede modificar el nivel de licencia de transporte';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._protect_transport_license() FROM anon, authenticated;

CREATE TRIGGER trg_protect_transport_license
  BEFORE UPDATE ON public.trade_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public._protect_transport_license();
