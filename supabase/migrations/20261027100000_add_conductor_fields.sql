-- TX-COND-1A: Campos profesionales de conductor en trade_workers
-- Compatible con trabajadores existentes (todas las columnas nullable).
-- No se almacenan DNI ni fecha de nacimiento — no son necesarios
-- para la gestión operativa de habilitaciones.

ALTER TABLE public.trade_workers
  ADD COLUMN IF NOT EXISTS identificador_interno        text,
  ADD COLUMN IF NOT EXISTS categorias_permiso           text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permiso_caducidad            date,
  ADD COLUMN IF NOT EXISTS cap_caducidad                date,
  ADD COLUMN IF NOT EXISTS fecha_incorporacion          date,
  ADD COLUMN IF NOT EXISTS observaciones_profesionales  text;

COMMENT ON COLUMN public.trade_workers.identificador_interno       IS 'Número de empleado u otro identificador interno opcional';
COMMENT ON COLUMN public.trade_workers.categorias_permiso          IS 'Categorías de permiso de conducción: D, D1, D+E, C, C+E, B, etc.';
COMMENT ON COLUMN public.trade_workers.permiso_caducidad           IS 'Fecha de caducidad del permiso de conducción';
COMMENT ON COLUMN public.trade_workers.cap_caducidad               IS 'Fecha de caducidad del CAP (cuando corresponda)';
COMMENT ON COLUMN public.trade_workers.fecha_incorporacion         IS 'Fecha de incorporación a la organización';
COMMENT ON COLUMN public.trade_workers.observaciones_profesionales IS 'Observaciones internas sobre el conductor';
