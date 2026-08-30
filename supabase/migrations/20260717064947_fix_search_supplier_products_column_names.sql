
-- Fix search_supplier_products: return column names matching CompareRow interface
-- Previous function returned _catalog_key, _desc, _venta, _coste, etc.
-- New function returns catalog_key, descripcion, precio_venta, precio_coste, etc.

CREATE OR REPLACE FUNCTION public.search_supplier_products(
  material_text text,
  p_org_id uuid DEFAULT NULL,
  limit_per_catalog integer DEFAULT 3
)
RETURNS TABLE(
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
  score          real,
  motivo         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tokens     text;
  v_word1      text;
  v_had_fts    boolean;
  cat          RECORD;
BEGIN
  SELECT string_agg(lexeme, ' | ')
  INTO v_tokens
  FROM unnest(to_tsvector('spanish', coalesce(material_text, 'a')));

  v_word1 := split_part(coalesce(material_text, ''), ' ', 1);

  FOR cat IN
    SELECT
      sc.id                                                           AS cat_id,
      sc.supplier_key                                                 AS skey,
      sc.supplier_name                                                AS sname,
      coalesce(os.margen_override, sc.margen_pct_default, 20)::numeric AS margen
    FROM public.trade_supplier_catalogs sc
    LEFT JOIN public.trade_org_suppliers os
      ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.is_active = true AND sc.org_id IS NULL
    ORDER BY sc.prioridad, sc.supplier_key
  LOOP
    v_had_fts := false;

    IF v_tokens IS NOT NULL THEN
      RETURN QUERY
      SELECT
        cat.skey::text,
        cat.sname::text,
        p.id::uuid,
        p.ref_proveedor::text,
        p.descripcion::text,
        p.marca::text,
        p.familia::text,
        p.precio_coste::numeric,
        cat.margen::numeric,
        (p.precio_coste * (1 + cat.margen / 100.0))::numeric,
        p.unidad::text,
        ts_rank_cd(p.search_vector, to_tsquery('spanish', v_tokens))::real,
        'fts'::text
      FROM public.trade_supplier_products p
      WHERE p.catalog_id = cat.cat_id
        AND p.activo = true
        AND p.search_vector @@ to_tsquery('spanish', v_tokens)
      ORDER BY ts_rank_cd(p.search_vector, to_tsquery('spanish', v_tokens)) DESC
      LIMIT limit_per_catalog;

      GET DIAGNOSTICS v_had_fts = ROW_COUNT;
    END IF;

    IF NOT v_had_fts OR v_tokens IS NULL THEN
      RETURN QUERY
      SELECT
        cat.skey::text,
        cat.sname::text,
        p.id::uuid,
        p.ref_proveedor::text,
        p.descripcion::text,
        p.marca::text,
        p.familia::text,
        p.precio_coste::numeric,
        cat.margen::numeric,
        (p.precio_coste * (1 + cat.margen / 100.0))::numeric,
        p.unidad::text,
        0.1::real,
        'ilike'::text
      FROM public.trade_supplier_products p
      WHERE p.catalog_id = cat.cat_id
        AND p.activo = true
        AND p.descripcion ILIKE '%' || v_word1 || '%'
      ORDER BY p.descripcion
      LIMIT limit_per_catalog;
    END IF;
  END LOOP;
END;
$$;

-- Ensure Saltoki is globally active
UPDATE public.trade_supplier_catalogs
SET is_active = true
WHERE supplier_key = 'saltoki' AND org_id IS NULL;

-- Enable Saltoki for all orgs that have Obramat enabled
WITH saltoki_id AS (
  SELECT id FROM public.trade_supplier_catalogs
  WHERE supplier_key = 'saltoki' AND org_id IS NULL LIMIT 1
),
obramat_enabled_orgs AS (
  SELECT DISTINCT os.org_id
  FROM public.trade_org_suppliers os
  JOIN public.trade_supplier_catalogs sc ON sc.id = os.catalog_id
  WHERE sc.supplier_key = 'obramat' AND sc.org_id IS NULL AND os.enabled = true
)
INSERT INTO public.trade_org_suppliers (org_id, catalog_id, enabled, margen_override)
SELECT o.org_id, s.id, true, NULL
FROM obramat_enabled_orgs o, saltoki_id s
ON CONFLICT (org_id, catalog_id) DO UPDATE SET enabled = true;
;
