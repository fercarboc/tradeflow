
ALTER TABLE public.debacu_eval_properties
  ADD COLUMN IF NOT EXISTS pms_source TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pms_synced_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pms_external_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.debacu_eval_properties.pms_source IS 'PMS de origen si la propiedad fue creada por sync (APALEO, TESIPRO, etc.). NULL = creada manualmente.';
COMMENT ON COLUMN public.debacu_eval_properties.pms_synced_at IS 'Última vez que los datos de esta propiedad fueron sincronizados desde el PMS.';
COMMENT ON COLUMN public.debacu_eval_properties.pms_external_id IS 'ID de la propiedad en el PMS de origen (ej: BER, LON en Apaleo).';
;
