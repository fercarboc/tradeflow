-- geo_source + geo_confirmed_at para trade_organizations y trade_jobs
--
-- geo_source semántica:
--   NULL     = legacy o no geocodificado aún; la geocodificación automática puede escribir.
--   'auto'   = coordenadas obtenidas por geocodificación automática.
--   'manual' = coordenadas confirmadas explícitamente por el usuario con LocationPicker.
--
-- Invariante: una fila con geo_source = 'manual' NO puede ser sobreescrita por una
-- geocodificación automática mientras la dirección no cambie.
-- La condición PostgREST equivalente es:
--   (geo_source IS NULL OR geo_source != 'manual')
-- que representa «IS DISTINCT FROM 'manual'».
--
-- NO se realiza backfill de filas existentes.
-- Las filas con geo_source = NULL conservan las coordenadas que tenían y pueden ser
-- sobreescritas por la geocodificación automática (comportamiento legacy sin cambio).

ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS geo_source       text
    CONSTRAINT chk_org_geo_source CHECK (geo_source IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS geo_confirmed_at timestamptz;

ALTER TABLE public.trade_jobs
  ADD COLUMN IF NOT EXISTS geo_source       text
    CONSTRAINT chk_job_geo_source CHECK (geo_source IN ('auto', 'manual')),
  ADD COLUMN IF NOT EXISTS geo_confirmed_at timestamptz;

COMMENT ON COLUMN public.trade_organizations.geo_source IS
  'NULL=legacy/pendiente, auto=geocodificado automáticamente, manual=confirmado con LocationPicker.';
COMMENT ON COLUMN public.trade_organizations.geo_confirmed_at IS
  'Timestamp de la última confirmación manual de coordenadas de la organización.';

COMMENT ON COLUMN public.trade_jobs.geo_source IS
  'NULL=legacy/pendiente, auto=geocodificado automáticamente, manual=confirmado con LocationPicker.';
COMMENT ON COLUMN public.trade_jobs.geo_confirmed_at IS
  'Timestamp de la última confirmación manual de coordenadas del trabajo.';
