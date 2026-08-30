-- Phase 0 / Pilot / Founding Installer columns for trade_organizations
-- These are internal admin-only metadata fields.
-- They do NOT grant any additional privileges. RLS is unaffected.
-- All existing rows receive DEFAULT values: phase=NULL, pilot=false,
-- founding_installer=false, founding_installer_number=NULL.

ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS phase                   text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pilot                   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_installer      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS founding_installer_number integer DEFAULT NULL;

ALTER TABLE public.trade_organizations
  ADD CONSTRAINT chk_founding_installer_number
  CHECK (
    founding_installer_number IS NULL
    OR (founding_installer_number >= 1 AND founding_installer_number <= 10)
  );

COMMENT ON COLUMN public.trade_organizations.phase IS
  'Internal admin-only. Lifecycle phase: phase0, phase1, etc. NULL = standard commercial account. Does NOT grant privileges.';
COMMENT ON COLUMN public.trade_organizations.pilot IS
  'Internal admin-only. TRUE = participant in a TrabFlow pilot program. Does NOT grant privileges.';
COMMENT ON COLUMN public.trade_organizations.founding_installer IS
  'Internal admin-only. TRUE = member of Founding Installer program (max 10 companies total). Does NOT grant privileges.';
COMMENT ON COLUMN public.trade_organizations.founding_installer_number IS
  'Internal admin-only. Sequential number 1-10 within Founding Installer program. Future right to permanent free access to base plan (subject to commercial definition).';
