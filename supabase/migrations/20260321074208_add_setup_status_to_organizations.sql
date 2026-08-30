
ALTER TABLE public.debacu_eval_organizations
  ADD COLUMN IF NOT EXISTS setup_status onboarding_status_enum NOT NULL DEFAULT 'CONFIGURED',
  ADD COLUMN IF NOT EXISTS pms_provider TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pms_connection_type TEXT DEFAULT NULL
    CHECK (pms_connection_type IS NULL OR pms_connection_type IN ('API', 'CSV'));

COMMENT ON COLUMN public.debacu_eval_organizations.setup_status IS 'Estado de configuración de la organización. Controla si el usuario ve el wizard o el dashboard.';
COMMENT ON COLUMN public.debacu_eval_organizations.pms_provider IS 'Proveedor PMS seleccionado en el onboarding.';
COMMENT ON COLUMN public.debacu_eval_organizations.pms_connection_type IS 'Tipo de conexión elegida: API (wizard automático) o CSV (manual).';
;
