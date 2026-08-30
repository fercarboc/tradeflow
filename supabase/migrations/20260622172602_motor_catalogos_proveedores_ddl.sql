
-- ═══════════════════════════════════════════════════════════════
-- Motor de Catálogos de Proveedores — TrabFlow v1.0
-- ═══════════════════════════════════════════════════════════════

-- 1. trade_supplier_catalogs
CREATE TABLE IF NOT EXISTS trade_supplier_catalogs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid REFERENCES trade_organizations(id) ON DELETE CASCADE,
  supplier_key        text NOT NULL,
  supplier_name       text NOT NULL,
  logo_url            text,
  is_active           boolean NOT NULL DEFAULT false,
  margen_pct_default  numeric(5,2) NOT NULL DEFAULT 25,
  prioridad           int NOT NULL DEFAULT 99,
  is_custom           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- 2. trade_supplier_products
CREATE TABLE IF NOT EXISTS trade_supplier_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_id      uuid NOT NULL REFERENCES trade_supplier_catalogs(id) ON DELETE CASCADE,
  ref_proveedor   text,
  descripcion     text NOT NULL,
  marca           text,
  familia         text,
  precio_coste    numeric(10,2) NOT NULL DEFAULT 0,
  unidad          text NOT NULL DEFAULT 'ud',
  search_vector   tsvector,
  activo          boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_products_search
  ON trade_supplier_products USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_supplier_products_catalog
  ON trade_supplier_products(catalog_id);

-- Trigger: auto-genera search_vector en español
CREATE OR REPLACE FUNCTION update_supplier_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    COALESCE(NEW.descripcion, '') || ' ' ||
    COALESCE(NEW.marca,       '') || ' ' ||
    COALESCE(NEW.familia,     '') || ' ' ||
    COALESCE(NEW.ref_proveedor, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supplier_search_vector ON trade_supplier_products;
CREATE TRIGGER trg_supplier_search_vector
  BEFORE INSERT OR UPDATE ON trade_supplier_products
  FOR EACH ROW EXECUTE FUNCTION update_supplier_search_vector();

-- 3. trade_org_suppliers (configuración por empresa)
CREATE TABLE IF NOT EXISTS trade_org_suppliers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  catalog_id      uuid NOT NULL REFERENCES trade_supplier_catalogs(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT false,
  margen_override numeric(5,2),
  prioridad       int NOT NULL DEFAULT 99,
  UNIQUE(org_id, catalog_id)
);

-- 4. trade_budget_catalog_lines (productos seleccionados por presupuesto)
CREATE TABLE IF NOT EXISTS trade_budget_catalog_lines (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id        uuid NOT NULL REFERENCES trade_quotes(id) ON DELETE CASCADE,
  product_id       uuid REFERENCES trade_supplier_products(id),
  catalog_id       uuid REFERENCES trade_supplier_catalogs(id),
  descripcion_ia   text,
  cantidad         numeric(10,3),
  precio_coste     numeric(10,2),
  margen_pct       numeric(5,2),
  precio_venta     numeric(10,2) GENERATED ALWAYS AS
    (ROUND(precio_coste * (1 + margen_pct / 100), 2)) STORED,
  selected_by_user boolean NOT NULL DEFAULT false,
  partida_index    int,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE trade_supplier_catalogs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_supplier_products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_org_suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_budget_catalog_lines ENABLE ROW LEVEL SECURITY;

-- Catálogos globales (org_id IS NULL) visibles a todos los autenticados
-- Catálogos propios (org_id no nulo) solo al propietario
CREATE POLICY "supplier_catalogs_select" ON trade_supplier_catalogs FOR SELECT
  USING (
    org_id IS NULL
    OR org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
  );

-- Productos: legibles si el catálogo es global o propio del usuario
CREATE POLICY "supplier_products_select" ON trade_supplier_products FOR SELECT
  USING (
    catalog_id IN (
      SELECT id FROM trade_supplier_catalogs
      WHERE org_id IS NULL
         OR org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
    )
  );

-- Configuración de proveedor por org: solo la propia org
CREATE POLICY "org_suppliers_all" ON trade_org_suppliers FOR ALL
  USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

-- Líneas de catálogo en presupuesto: solo presupuestos de la propia org
CREATE POLICY "budget_catalog_lines_all" ON trade_budget_catalog_lines FOR ALL
  USING (
    budget_id IN (
      SELECT id FROM trade_quotes
      WHERE org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
    )
  );

-- ═══════════════════════════════════════════════════════════════
-- RPC: search_supplier_products
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION search_supplier_products(
  material_text      TEXT,
  p_org_id           UUID,
  limit_per_catalog  INT DEFAULT 3
)
RETURNS TABLE (
  catalog_key    text,
  supplier_name  text,
  product_id     uuid,
  ref_proveedor  text,
  descripcion    text,
  marca          text,
  familia        text,
  precio_coste   numeric,
  margen_pct     numeric,
  precio_venta   numeric,
  unidad         text,
  score          real
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH active_catalogs AS (
    SELECT
      sc.id                                                          AS catalog_id,
      sc.supplier_key,
      sc.supplier_name,
      COALESCE(os.margen_override, sc.margen_pct_default)           AS margen,
      COALESCE(os.prioridad, sc.prioridad)                          AS prio
    FROM trade_supplier_catalogs sc
    LEFT JOIN trade_org_suppliers os
      ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id IS NULL
      AND sc.is_active = true
      AND (os.id IS NULL OR os.enabled = true)

    UNION ALL

    SELECT
      sc.id,
      sc.supplier_key,
      sc.supplier_name,
      COALESCE(os.margen_override, sc.margen_pct_default),
      1
    FROM trade_supplier_catalogs sc
    JOIN trade_org_suppliers os ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id = p_org_id
      AND sc.is_custom = true
      AND os.enabled = true
  ),
  ranked AS (
    SELECT
      ac.supplier_key   AS _catalog_key,
      ac.supplier_name  AS _supplier_name,
      sp.id             AS _product_id,
      sp.ref_proveedor  AS _ref,
      sp.descripcion    AS _desc,
      sp.marca          AS _marca,
      sp.familia        AS _familia,
      sp.precio_coste   AS _coste,
      ac.margen         AS _margen,
      ROUND(sp.precio_coste * (1 + ac.margen / 100), 2) AS _venta,
      sp.unidad         AS _unidad,
      ts_rank(sp.search_vector, plainto_tsquery('spanish', material_text)) AS _score,
      ac.prio           AS _prio,
      ROW_NUMBER() OVER (
        PARTITION BY ac.catalog_id
        ORDER BY ts_rank(sp.search_vector, plainto_tsquery('spanish', material_text)) DESC
      ) AS rn
    FROM active_catalogs ac
    JOIN trade_supplier_products sp ON sp.catalog_id = ac.catalog_id
    WHERE sp.activo = true
      AND sp.search_vector @@ plainto_tsquery('spanish', material_text)
  )
  SELECT
    _catalog_key, _supplier_name, _product_id, _ref,
    _desc, _marca, _familia, _coste, _margen, _venta, _unidad, _score
  FROM ranked
  WHERE rn <= limit_per_catalog
    AND _score > 0
  ORDER BY _prio ASC, _score DESC;
END;
$$;
;
