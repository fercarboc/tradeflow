ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'trabajo' CHECK (tipo IN ('trabajo', 'visita'));;
