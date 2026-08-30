
ALTER TABLE trade_maintenance_incidencias
  ADD COLUMN IF NOT EXISTS tecnico_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tecnico_email text;
;
