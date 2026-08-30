
-- Añadir email e invited_at a trade_org_members
ALTER TABLE trade_org_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE trade_org_members ADD COLUMN IF NOT EXISTS invited_at timestamptz;

-- Política: un usuario puede activar su propia invitación pendiente
CREATE POLICY "members_self_activate" ON trade_org_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
;
