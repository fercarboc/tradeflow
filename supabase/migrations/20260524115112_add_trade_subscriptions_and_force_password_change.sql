
-- Add force_password_change to trade_organizations
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN NOT NULL DEFAULT false;

-- Create trade_subscriptions table
CREATE TABLE IF NOT EXISTS trade_subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  plan                   TEXT NOT NULL CHECK (plan IN ('basico', 'pro', 'empresa')) DEFAULT 'pro',
  billing_cycle          TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')) DEFAULT 'monthly',
  status                 TEXT NOT NULL CHECK (status IN ('trial', 'active', 'cancelled', 'expired')) DEFAULT 'trial',
  trial_start            TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_end              TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '3 months'),
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancelled_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by org
CREATE INDEX IF NOT EXISTS trade_subscriptions_org_id_idx ON trade_subscriptions(org_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_trade_subscriptions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_trade_subscriptions_updated_at ON trade_subscriptions;
CREATE TRIGGER set_trade_subscriptions_updated_at
  BEFORE UPDATE ON trade_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_trade_subscriptions_updated_at();

-- RLS
ALTER TABLE trade_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner can read their own subscription
CREATE POLICY "owner_select_subscription" ON trade_subscriptions
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

-- Admin (fercarboc@gmail.com) can read all subscriptions
CREATE POLICY "admin_select_all_subscriptions" ON trade_subscriptions
  FOR SELECT TO authenticated
  USING (
    auth.email() = 'fercarboc@gmail.com'
  );

-- Owner can insert their own subscription
CREATE POLICY "owner_insert_subscription" ON trade_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

-- Owner can update their own subscription
CREATE POLICY "owner_update_subscription" ON trade_subscriptions
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

-- Admin can update all subscriptions
CREATE POLICY "admin_update_all_subscriptions" ON trade_subscriptions
  FOR UPDATE TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');

-- Admin can read ALL organizations
CREATE POLICY "admin_select_all_orgs" ON trade_organizations
  FOR SELECT TO authenticated
  USING (
    auth.email() = 'fercarboc@gmail.com'
    OR owner_id = auth.uid()
  );

-- Admin can update ALL organizations
CREATE POLICY "admin_update_all_orgs" ON trade_organizations
  FOR UPDATE TO authenticated
  USING (
    auth.email() = 'fercarboc@gmail.com'
    OR owner_id = auth.uid()
  );
;
