-- Habilitar RLS y políticas para trade_supplier_orders
ALTER TABLE trade_supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_orders_select" ON trade_supplier_orders
  FOR SELECT USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "supplier_orders_insert" ON trade_supplier_orders
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "supplier_orders_update" ON trade_supplier_orders
  FOR UPDATE USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "supplier_orders_delete" ON trade_supplier_orders
  FOR DELETE USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

-- Habilitar RLS y políticas para trade_supplier_order_lines
ALTER TABLE trade_supplier_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "supplier_order_lines_select" ON trade_supplier_order_lines
  FOR SELECT USING (
    order_id IN (
      SELECT id FROM trade_supplier_orders WHERE org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
        UNION
        SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
      )
    )
  );

CREATE POLICY "supplier_order_lines_insert" ON trade_supplier_order_lines
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT id FROM trade_supplier_orders WHERE org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
        UNION
        SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
      )
    )
  );

CREATE POLICY "supplier_order_lines_update" ON trade_supplier_order_lines
  FOR UPDATE USING (
    order_id IN (
      SELECT id FROM trade_supplier_orders WHERE org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "supplier_order_lines_delete" ON trade_supplier_order_lines
  FOR DELETE USING (
    order_id IN (
      SELECT id FROM trade_supplier_orders WHERE org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      )
    )
  );
