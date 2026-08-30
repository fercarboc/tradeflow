
-- ── Tabla de configuración de automatizaciones ─────────────────────────────
CREATE TABLE IF NOT EXISTS admin_automation_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_automation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_auto_config" ON admin_automation_config
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com');

INSERT INTO admin_automation_config (key, value) VALUES
  ('ntfy_topic',            ''),
  ('churn_auto_enabled',    'true'),
  ('trial_reminder_days',   '3'),
  ('last_churn_run',        ''),
  ('last_trial_check',      '')
ON CONFLICT (key) DO NOTHING;

-- ── 6.3: Función auto-churn_risk (SECURITY DEFINER, accede a auth.users) ──
CREATE OR REPLACE FUNCTION auto_update_churn_risk()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE trade_organizations o
  SET churn_risk = true
  FROM auth.users u
  WHERE o.owner_id = u.id
    AND o.churn_risk = false
    AND (
      u.last_sign_in_at < NOW() - INTERVAL '21 days'
      OR (u.last_sign_in_at IS NULL AND o.created_at < NOW() - INTERVAL '7 days')
    )
    AND EXISTS (
      SELECT 1 FROM trade_subscriptions s
      WHERE s.org_id = o.id AND s.status IN ('trial', 'active')
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  UPDATE admin_automation_config
  SET value = NOW()::text, updated_at = NOW()
  WHERE key = 'last_churn_run';

  IF updated_count > 0 THEN
    INSERT INTO admin_activity_log (admin_email, action, target_org_id, metadata)
    VALUES (
      'system@tradeflow.auto',
      'auto_churn_risk_batch',
      NULL,
      jsonb_build_object('orgs_marked', updated_count, 'ran_at', NOW())
    );
  END IF;
END;
$$;

-- Programar ejecución diaria a las 3:00 UTC
SELECT cron.schedule('auto-churn-risk', '0 3 * * *', 'SELECT auto_update_churn_risk()');

-- ── 6.1: Función para obtener trials próximos a vencer ─────────────────────
CREATE OR REPLACE FUNCTION get_trials_expiring_soon(days_ahead int DEFAULT 3)
RETURNS TABLE(org_id uuid, org_nombre text, owner_email text, days_left int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.nombre,
    u.email::text,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.trial_end - NOW())) / 86400))::int
  FROM trade_organizations o
  JOIN trade_subscriptions s ON s.org_id = o.id
  JOIN auth.users u ON o.owner_id = u.id
  WHERE s.status = 'trial'
    AND s.trial_end BETWEEN NOW() AND NOW() + (days_ahead || ' days')::interval
  ORDER BY s.trial_end ASC;
END;
$$;

-- ── 6.2: Trigger — notificar nuevo cliente de pago vía ntfy ────────────────
CREATE OR REPLACE FUNCTION notify_new_paying_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ntfy_topic text;
  org_name   text;
  msg        text;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    SELECT value INTO ntfy_topic FROM admin_automation_config WHERE key = 'ntfy_topic';
    SELECT nombre INTO org_name FROM trade_organizations WHERE id = NEW.org_id;

    INSERT INTO admin_activity_log (admin_email, action, target_org_id, metadata)
    VALUES (
      'system@tradeflow.auto',
      'subscription_activated',
      NEW.org_id,
      jsonb_build_object('plan', NEW.plan, 'billing_cycle', NEW.billing_cycle)
    );

    IF ntfy_topic IS NOT NULL AND ntfy_topic != '' THEN
      msg := 'Nuevo cliente activo: ' || COALESCE(org_name, 'Desconocido') || ' · Plan ' || NEW.plan;
      PERFORM net.http_post(
        url     := 'https://ntfy.sh',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
          'topic',    ntfy_topic,
          'title',    'Nuevo pago — TradeFlow',
          'message',  msg,
          'priority', 4,
          'tags',     '["moneybag"]'::jsonb
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_paying ON trade_subscriptions;
CREATE TRIGGER trigger_notify_new_paying
  AFTER UPDATE ON trade_subscriptions
  FOR EACH ROW EXECUTE FUNCTION notify_new_paying_customer();
;
