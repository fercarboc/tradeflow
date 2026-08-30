
-- Enum de estado de onboarding
DO $$ BEGIN
  CREATE TYPE onboarding_status_enum AS ENUM ('CONFIGURED', 'PENDING_PMS', 'CSV_MODE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- customers: onboarding_status + pms_type_selected
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS onboarding_status onboarding_status_enum NOT NULL DEFAULT 'CONFIGURED',
  ADD COLUMN IF NOT EXISTS pms_type_selected TEXT DEFAULT NULL;

COMMENT ON COLUMN public.customers.onboarding_status IS 'Estado de configuración del cliente. CONFIGURED = ya operativo. PENDING_PMS = pendiente de conectar PMS vía API. CSV_MODE = rellena perfil manual.';
COMMENT ON COLUMN public.customers.pms_type_selected IS 'PMS seleccionado en el onboarding (APALEO, TESIPRO, MEWS, etc.)';
;
