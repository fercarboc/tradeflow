
-- Drop the owner-only policy and replace with one that includes active members
DROP POLICY IF EXISTS "Acceso a facturas propias" ON trade_invoices;

CREATE POLICY "invoices_org_access" ON trade_invoices
  FOR ALL USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );
;
