
ALTER TABLE debacu_eval_risk_alerts
ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN debacu_eval_risk_alerts.is_read IS
  'TRUE cuando el equipo del hotel ha visto la alerta en el panel de Alarmas.';

CREATE INDEX IF NOT EXISTS idx_risk_alerts_unread
  ON debacu_eval_risk_alerts (org_id, checkin_date)
  WHERE is_read = FALSE AND is_resolved = FALSE;
;
