
-- Dirección normalizada devuelta por el geocoder
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS direccion_normalizada text;

COMMENT ON COLUMN trade_jobs.direccion_normalizada IS
  'Dirección formateada devuelta por el geocoder (Nominatim/Google). Se actualiza automáticamente al guardar.';

-- Coordenadas de la base/oficina de la organización
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS base_latitud  double precision,
  ADD COLUMN IF NOT EXISTS base_longitud double precision;

COMMENT ON COLUMN trade_organizations.base_latitud  IS 'Latitud de la dirección base de la empresa (geocodificada).';
COMMENT ON COLUMN trade_organizations.base_longitud IS 'Longitud de la dirección base de la empresa (geocodificada).';
;
