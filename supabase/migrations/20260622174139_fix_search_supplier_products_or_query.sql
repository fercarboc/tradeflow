
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
DECLARE
  or_query tsquery;
BEGIN
  -- Construir query OR desde los lexemas del texto de entrada
  -- Permite coincidencia parcial (cualquier término relevante)
  SELECT to_tsquery('spanish',
    string_agg(lexeme, ' | ')
  )
  INTO or_query
  FROM unnest(to_tsvector('spanish', material_text));

  IF or_query IS NULL THEN
    RETURN;
  END IF;

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
      ts_rank_cd(sp.search_vector, or_query) AS _score,
      ac.prio           AS _prio,
      ROW_NUMBER() OVER (
        PARTITION BY ac.catalog_id
        ORDER BY ts_rank_cd(sp.search_vector, or_query) DESC
      ) AS rn
    FROM active_catalogs ac
    JOIN trade_supplier_products sp ON sp.catalog_id = ac.catalog_id
    WHERE sp.activo = true
      AND sp.search_vector @@ or_query
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
