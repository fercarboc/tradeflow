
-- Notas internas sobre organizaciones
CREATE TABLE IF NOT EXISTS admin_support_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  admin_email TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_notes_org ON admin_support_notes (org_id, created_at DESC);

-- RLS: solo admin puede leer/escribir notas
ALTER TABLE admin_support_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_notes" ON admin_support_notes
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');

-- Log de acciones administrativas
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email   TEXT NOT NULL,
  action        TEXT NOT NULL,
  target_org_id UUID REFERENCES trade_organizations(id) ON DELETE SET NULL,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_log_org  ON admin_activity_log (target_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_log_date ON admin_activity_log (created_at DESC);

ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_all_log" ON admin_activity_log
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');

-- Flags internos en organizations
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS churn_risk     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vip            BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tags           TEXT[]  NOT NULL DEFAULT '{}';

-- Campos adicionales en platform_invoices
ALTER TABLE trade_platform_invoices
  ADD COLUMN IF NOT EXISTS notes   TEXT,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
;
