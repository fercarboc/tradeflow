
CREATE TABLE IF NOT EXISTS trade_push_subscriptions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id  uuid NOT NULL REFERENCES trade_workers(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL,
  endpoint   text NOT NULL,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (worker_id, endpoint)
);

ALTER TABLE trade_push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "worker manage own subscriptions"
  ON trade_push_subscriptions
  FOR ALL
  USING (worker_id = (SELECT id FROM trade_workers WHERE id = auth.uid()))
  WITH CHECK (worker_id = (SELECT id FROM trade_workers WHERE id = auth.uid()));

CREATE POLICY "service role full access"
  ON trade_push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
;
