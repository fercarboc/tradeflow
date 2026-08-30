
-- Añade orden_ruta a trade_jobs para la optimización de rutas diarias.
-- NULL = sin orden asignado; valor numérico = posición en la ruta del día.
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS orden_ruta integer DEFAULT NULL;

COMMENT ON COLUMN trade_jobs.orden_ruta IS
  'Posición del trabajo en la ruta optimizada del día (1 = primero). NULL si no se ha calculado ruta.';
;
