
DROP FUNCTION IF EXISTS public.search_supplier_products(text, uuid, integer);

CREATE FUNCTION public.search_supplier_products(
  material_text text,
  p_org_id      uuid,
  limit_per_catalog integer DEFAULT 3
)
RETURNS TABLE(
  catalog_key   text,
  supplier_name text,
  product_id    uuid,
  ref_proveedor text,
  descripcion   text,
  marca         text,
  familia       text,
  precio_coste  numeric,
  margen_pct    numeric,
  precio_venta  numeric,
  unidad        text,
  score         real,
  motivo        text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE or_query tsquery;
BEGIN
  SELECT to_tsquery('spanish', string_agg(lexeme, ' | '))
  INTO or_query
  FROM unnest(to_tsvector('spanish', material_text));

  IF or_query IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH active_catalogs AS (
    -- Catálogos globales activos para esta org
    SELECT
      sc.id                                              AS cat_id,
      sc.supplier_key                                    AS cat_key,
      COALESCE(os.display_name, sc.supplier_name)       AS cat_name,
      COALESCE(os.margen_override, sc.margen_pct_default) AS cat_margen,
      COALESCE(os.prioridad, sc.prioridad, 99)          AS cat_prio,
      COALESCE(os.preferido_categorias, ARRAY[]::text[]) AS cat_pref_cats
    FROM public.trade_supplier_catalogs sc
    LEFT JOIN public.trade_org_suppliers os
           ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id IS NULL
      AND sc.is_active = true
      AND (os.id IS NULL OR os.enabled = true)

    UNION ALL

    -- Catálogo propio de la org
    SELECT
      sc.id,
      sc.supplier_key,
      COALESCE(os.display_name, sc.supplier_name),
      COALESCE(os.margen_override, sc.margen_pct_default),
      1,
      COALESCE(os.preferido_categorias, ARRAY[]::text[])
    FROM public.trade_supplier_catalogs sc
    JOIN public.trade_org_suppliers os
      ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id = p_org_id
      AND sc.is_custom = true
      AND os.enabled = true
  ),
  ranked AS (
    SELECT
      ac.cat_key                                         AS rk_catalog_key,
      ac.cat_name                                        AS rk_supplier_name,
      sp.id                                              AS rk_product_id,
      sp.ref_proveedor                                   AS rk_ref,
      sp.descripcion                                     AS rk_desc,
      sp.marca                                           AS rk_marca,
      sp.familia                                         AS rk_familia,
      sp.precio_coste                                    AS rk_coste,
      ac.cat_margen                                      AS rk_margen,
      ROUND(sp.precio_coste * (1 + ac.cat_margen / 100), 2) AS rk_venta,
      sp.unidad                                          AS rk_unidad,
      ts_rank_cd(sp.search_vector, or_query)             AS rk_score,
      -- Prioridad efectiva: categoría preferida > prioridad general
      CASE
        WHEN sp.familia = ANY(ac.cat_pref_cats) THEN 0
        ELSE ac.cat_prio
      END                                                AS rk_prio,
      -- Motivo legible para mostrar al instalador
      CASE
        WHEN sp.familia = ANY(ac.cat_pref_cats)
          THEN 'Tu proveedor preferido para ' || sp.familia
        WHEN ac.cat_prio = 1
          THEN 'Tu proveedor preferido general'
        ELSE 'Proveedor alternativo disponible'
      END                                                AS rk_motivo,
      ROW_NUMBER() OVER (
        PARTITION BY ac.cat_id
        ORDER BY ts_rank_cd(sp.search_vector, or_query) DESC
      )                                                  AS rn
    FROM active_catalogs ac
    JOIN public.trade_supplier_products sp ON sp.catalog_id = ac.cat_id
    WHERE sp.activo = true
      AND sp.search_vector @@ or_query
  )
  SELECT
    rk_catalog_key, rk_supplier_name, rk_product_id,
    rk_ref, rk_desc, rk_marca, rk_familia,
    rk_coste, rk_margen, rk_venta, rk_unidad, rk_score, rk_motivo
  FROM ranked
  WHERE rn <= limit_per_catalog AND rk_score > 0
  ORDER BY rk_prio ASC, rk_score DESC;
END;
$function$;
;
