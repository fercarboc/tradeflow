
CREATE TABLE IF NOT EXISTS debacu_eval_welcome_emails (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID        NOT NULL,
  org_id          UUID        NOT NULL,
  recipient_email TEXT        NOT NULL,
  recipient_name  TEXT,
  plan_code       TEXT,
  queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  send_after      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
  sent_at         TIMESTAMPTZ,
  error_detail    TEXT,
  UNIQUE (customer_id)
);

COMMENT ON TABLE debacu_eval_welcome_emails IS
  'Cola de emails de bienvenida. Se inserta al detectar primer login (perfil nulo). El cron debacu_eval_welcome_email_dispatch los envía cuando send_after <= NOW().';

CREATE INDEX IF NOT EXISTS idx_welcome_emails_pending
  ON debacu_eval_welcome_emails (send_after)
  WHERE sent_at IS NULL;
;
