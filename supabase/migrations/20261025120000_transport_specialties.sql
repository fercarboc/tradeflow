-- TX-1C FASE 1: transport_specialties column
-- Adds explicit specialty tags to transport orgs.
-- Fallback: getOrgCapabilities() uses oficio keyword matching when this is empty.
ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS transport_specialties text[] DEFAULT '{}';
