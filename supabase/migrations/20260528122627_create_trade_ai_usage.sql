
CREATE TABLE IF NOT EXISTS trade_ai_usage (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  feature    text NOT NULL CHECK (feature IN ('voice', 'photo')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_usage_org_feature_month
  ON trade_ai_usage (org_id, feature, created_at);

ALTER TABLE trade_ai_usage ENABLE ROW LEVEL SECURITY;

-- Solo service_role escribe (Edge Functions); usuarios solo ven su propia org
CREATE POLICY "ai_usage_select" ON trade_ai_usage
  FOR SELECT USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );
;
