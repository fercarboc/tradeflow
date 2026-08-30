
-- Subcontratas: políticas para miembros org
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_subcontratas' AND policyname='subcontratas_member_select') THEN
    CREATE POLICY "subcontratas_member_select" ON trade_subcontratas FOR SELECT
      USING (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_subcontratas' AND policyname='subcontratas_member_insert') THEN
    CREATE POLICY "subcontratas_member_insert" ON trade_subcontratas FOR INSERT
      WITH CHECK (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_subcontratas' AND policyname='subcontratas_member_update') THEN
    CREATE POLICY "subcontratas_member_update" ON trade_subcontratas FOR UPDATE
      USING (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true))
      WITH CHECK (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_subcontratas' AND policyname='subcontratas_member_delete') THEN
    CREATE POLICY "subcontratas_member_delete" ON trade_subcontratas FOR DELETE
      USING (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true));
  END IF;
END $$;

-- Notas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_subcontrata_notas' AND policyname='subcontrata_notas_member_all') THEN
    CREATE POLICY "subcontrata_notas_member_all" ON trade_subcontrata_notas FOR ALL
      USING (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true))
      WITH CHECK (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id=auth.uid() AND activo=true));
  END IF;
END $$;
;
