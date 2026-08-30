
-- Añadir search_vector al catálogo global si no existe
ALTER TABLE public.trade_global_catalog
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Poblar search_vector para todos los artículos existentes
UPDATE public.trade_global_catalog
SET search_vector = to_tsvector('spanish',
  coalesce(descripcion,'') || ' ' || coalesce(familia,'') || ' ' || coalesce(oficio,'') || ' ' || coalesce(marca_sugerida,''))
WHERE search_vector IS NULL AND activo = true;

-- Trigger para mantener search_vector actualizado
CREATE OR REPLACE FUNCTION public.tgf_global_catalog_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.descripcion,'') || ' ' || coalesce(NEW.familia,'') || ' ' || coalesce(NEW.oficio,'') || ' ' || coalesce(NEW.marca_sugerida,''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_global_catalog_search_vector ON public.trade_global_catalog;
CREATE TRIGGER trg_global_catalog_search_vector
BEFORE INSERT OR UPDATE ON public.trade_global_catalog
FOR EACH ROW EXECUTE FUNCTION public.tgf_global_catalog_search_vector();

-- Actualizar search_supplier_products para incluir trade_global_catalog
CREATE OR REPLACE FUNCTION public.search_supplier_products(
  material_text text,
  p_org_id uuid DEFAULT NULL::uuid,
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
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tokens    text;
  v_word1     text;
  v_row_count bigint;
  v_had_fts   boolean;
  cat         RECORD;
BEGIN
  SELECT string_agg(lexeme, ' | ')
  INTO v_tokens
  FROM unnest(to_tsvector('spanish', coalesce(material_text, 'a')));

  v_word1 := split_part(coalesce(material_text, ''), ' ', 1);

  -- ── 1. Proveedores en trade_supplier_products ──────────────────────────────
  FOR cat IN
    SELECT
      sc.id                                                            AS cat_id,
      sc.supplier_key                                                  AS skey,
      sc.supplier_name                                                 AS sname,
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

      GET DIAGNOSTICS v_row_count = ROW_COUNT;
      v_had_fts := v_row_count > 0;
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

  -- ── 2. Catálogo Global Base ────────────────────────────────────────────────
  v_had_fts := false;

  IF v_tokens IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'catalogo_base'::text,
      'Catálogo Base'::text,
      g.id::uuid,
      coalesce(g.codigo, g.id::text)::text,
      g.descripcion::text,
      coalesce(g.marca_sugerida, '')::text,
      coalesce(g.familia, g.oficio, '')::text,
      coalesce(g.precio_referencia, 0)::numeric,
      0::numeric,
      coalesce(g.precio_referencia, 0)::numeric,
      coalesce(g.unidad, 'ud')::text,
      ts_rank_cd(g.search_vector, to_tsquery('spanish', v_tokens))::real,
      'fts'::text
    FROM public.trade_global_catalog g
    WHERE g.activo = true
      AND g.search_vector IS NOT NULL
      AND g.search_vector @@ to_tsquery('spanish', v_tokens)
    ORDER BY ts_rank_cd(g.search_vector, to_tsquery('spanish', v_tokens)) DESC
    LIMIT limit_per_catalog;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    v_had_fts := v_row_count > 0;
  END IF;

  IF NOT v_had_fts OR v_tokens IS NULL THEN
    RETURN QUERY
    SELECT
      'catalogo_base'::text,
      'Catálogo Base'::text,
      g.id::uuid,
      coalesce(g.codigo, g.id::text)::text,
      g.descripcion::text,
      coalesce(g.marca_sugerida, '')::text,
      coalesce(g.familia, g.oficio, '')::text,
      coalesce(g.precio_referencia, 0)::numeric,
      0::numeric,
      coalesce(g.precio_referencia, 0)::numeric,
      coalesce(g.unidad, 'ud')::text,
      0.1::real,
      'ilike'::text
    FROM public.trade_global_catalog g
    WHERE g.activo = true
      AND g.descripcion ILIKE '%' || v_word1 || '%'
    ORDER BY g.descripcion
    LIMIT limit_per_catalog;
  END IF;

END;
$function$;
;
