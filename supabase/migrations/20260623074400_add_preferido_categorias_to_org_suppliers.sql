ALTER TABLE trade_org_suppliers
  ADD COLUMN IF NOT EXISTS preferido_categorias text[] DEFAULT '{}'::text[];

COMMENT ON COLUMN trade_org_suppliers.preferido_categorias
  IS 'Categorías de oficio para las que este proveedor es el preferido de la org';
;
