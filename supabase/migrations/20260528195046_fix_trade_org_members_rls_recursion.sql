
-- Helper functions con SECURITY DEFINER para romper la recursión RLS
CREATE OR REPLACE FUNCTION _user_org_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(org_id), '{}')
  FROM trade_org_members
  WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION _user_admin_org_ids()
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(org_id), '{}')
  FROM trade_org_members
  WHERE user_id = auth.uid() AND rol = ANY(ARRAY['owner', 'admin'])
$$;

-- Reemplazar políticas recursivas con versiones que usan las funciones helper
DROP POLICY IF EXISTS members_select ON trade_org_members;
CREATE POLICY members_select ON trade_org_members
  FOR SELECT USING (org_id = ANY(_user_org_ids()));

DROP POLICY IF EXISTS members_manage ON trade_org_members;
CREATE POLICY members_manage ON trade_org_members
  FOR ALL USING (org_id = ANY(_user_admin_org_ids()));
;
