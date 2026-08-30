
ALTER TABLE trade_subscriptions
  ADD COLUMN IF NOT EXISTS scheduled_plan text,
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE OR REPLACE FUNCTION apply_scheduled_plan_if_due(p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trade_subscriptions
  SET plan         = scheduled_plan,
      scheduled_plan = NULL,
      scheduled_at   = NULL,
      updated_at     = now()
  WHERE org_id        = p_org_id
    AND scheduled_plan IS NOT NULL
    AND scheduled_at   IS NOT NULL
    AND scheduled_at  <= now();
END;
$$;
;
