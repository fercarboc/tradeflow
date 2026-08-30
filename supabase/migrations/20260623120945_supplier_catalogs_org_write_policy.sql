
-- Allow org owners to insert their own catalog rows (propio catalog)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_supplier_catalogs'
    AND policyname = 'trade_supplier_catalogs_org_insert'
  ) THEN
    CREATE POLICY "trade_supplier_catalogs_org_insert"
    ON trade_supplier_catalogs
    FOR INSERT
    TO authenticated
    WITH CHECK (
      org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_supplier_catalogs'
    AND policyname = 'trade_supplier_catalogs_org_update'
  ) THEN
    CREATE POLICY "trade_supplier_catalogs_org_update"
    ON trade_supplier_catalogs
    FOR UPDATE
    TO authenticated
    USING (
      org_id IN (
        SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Allow org owners to write products when the catalog belongs to their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_supplier_products'
    AND policyname = 'trade_supplier_products_org_write'
  ) THEN
    CREATE POLICY "trade_supplier_products_org_write"
    ON trade_supplier_products
    FOR INSERT
    TO authenticated
    WITH CHECK (
      catalog_id IN (
        SELECT tsc.id FROM trade_supplier_catalogs tsc
        JOIN trade_organizations o ON o.id = tsc.org_id
        WHERE o.owner_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'trade_supplier_products'
    AND policyname = 'trade_supplier_products_org_delete'
  ) THEN
    CREATE POLICY "trade_supplier_products_org_delete"
    ON trade_supplier_products
    FOR DELETE
    TO authenticated
    USING (
      catalog_id IN (
        SELECT tsc.id FROM trade_supplier_catalogs tsc
        JOIN trade_organizations o ON o.id = tsc.org_id
        WHERE o.owner_id = auth.uid()
      )
    );
  END IF;
END $$;
;
