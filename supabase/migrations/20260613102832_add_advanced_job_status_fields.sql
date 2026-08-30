
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS pause_reason        text,
  ADD COLUMN IF NOT EXISTS material_pendiente  text,
  ADD COLUMN IF NOT EXISTS fecha_estimada_material date,
  ADD COLUMN IF NOT EXISTS rescheduled_from    uuid REFERENCES trade_jobs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS priority_insert     boolean DEFAULT false;

COMMENT ON COLUMN trade_jobs.pause_reason               IS 'falta_tiempo | falta_material';
COMMENT ON COLUMN trade_jobs.material_pendiente         IS 'Descripción libre del material que falta';
COMMENT ON COLUMN trade_jobs.fecha_estimada_material    IS 'Fecha estimada de llegada del material (NULL = desconocida)';
COMMENT ON COLUMN trade_jobs.rescheduled_from           IS 'ID del job original si fue reprogramado desde otro';
COMMENT ON COLUMN trade_jobs.priority_insert            IS 'true = debe aparecer como primera tarea del día al reprogramar';
;
