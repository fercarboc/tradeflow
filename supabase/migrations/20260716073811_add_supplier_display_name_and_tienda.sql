
ALTER TABLE public.trade_org_suppliers
  ADD COLUMN IF NOT EXISTS display_name    TEXT,
  ADD COLUMN IF NOT EXISTS tienda_nombre   TEXT,
  ADD COLUMN IF NOT EXISTS tienda_telefono TEXT,
  ADD COLUMN IF NOT EXISTS tienda_contacto TEXT,
  ADD COLUMN IF NOT EXISTS tienda_web      TEXT,
  ADD COLUMN IF NOT EXISTS tienda_direccion TEXT;

-- Actualizar search_supplier_products para usar display_name si existe
CREATE OR REPLACE FUNCTION public.search_supplier_products(
  material_text text,
  p_org_id uuid,
  limit_per_catalog integer DEFAULT 3
)
RETURNS TABLE(
  _catalog_key text, _supplier_name text, _product_id uuid,
  _ref text, _desc text, _marca text, _familia text,
  _coste numeric, _margen numeric, _venta numeric, _unidad text, _score real
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
    SELECT sc.id AS catalog_id,
           sc.supplier_key,
           COALESCE(os.display_name, sc.supplier_name) AS supplier_name,
           COALESCE(os.margen_override, sc.margen_pct_default) AS margen,
           COALESCE(os.prioridad, sc.prioridad) AS prio
    FROM public.trade_supplier_catalogs sc
    LEFT JOIN public.trade_org_suppliers os ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id IS NULL AND sc.is_active = true AND (os.id IS NULL OR os.enabled = true)
    UNION ALL
    SELECT sc.id, sc.supplier_key,
           COALESCE(os.display_name, sc.supplier_name),
           COALESCE(os.margen_override, sc.margen_pct_default), 1
    FROM public.trade_supplier_catalogs sc
    JOIN public.trade_org_suppliers os ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.org_id = p_org_id AND sc.is_custom = true AND os.enabled = true
  ),
  ranked AS (
    SELECT ac.supplier_key AS rk_catalog_key, ac.supplier_name AS rk_supplier_name,
           sp.id AS rk_product_id, sp.ref_proveedor AS rk_ref, sp.descripcion AS rk_desc,
           sp.marca AS rk_marca, sp.familia AS rk_familia, sp.precio_coste AS rk_coste,
           ac.margen AS rk_margen, ROUND(sp.precio_coste * (1 + ac.margen / 100), 2) AS rk_venta,
           sp.unidad AS rk_unidad, ts_rank_cd(sp.search_vector, or_query) AS rk_score,
           ac.prio AS rk_prio,
           ROW_NUMBER() OVER (PARTITION BY ac.catalog_id ORDER BY ts_rank_cd(sp.search_vector, or_query) DESC) AS rn
    FROM active_catalogs ac
    JOIN public.trade_supplier_products sp ON sp.catalog_id = ac.catalog_id
    WHERE sp.activo = true AND sp.search_vector @@ or_query
  )
  SELECT rk_catalog_key, rk_supplier_name, rk_product_id, rk_ref, rk_desc, rk_marca, rk_familia,
         rk_coste, rk_margen, rk_venta, rk_unidad, rk_score
  FROM ranked
  WHERE rn <= limit_per_catalog AND rk_score > 0
  ORDER BY rk_prio ASC, rk_score DESC;
END;
$function$;
;
