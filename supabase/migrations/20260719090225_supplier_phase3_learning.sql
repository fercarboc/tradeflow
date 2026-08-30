
-- Tabla para registrar elecciones implícitas de proveedor
CREATE TABLE IF NOT EXISTS public.trade_supplier_choices (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid NOT NULL,
  catalog_id uuid NOT NULL REFERENCES public.trade_supplier_catalogs(id) ON DELETE CASCADE,
  familia    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trade_supplier_choices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_own_choices" ON public.trade_supplier_choices
  FOR ALL USING (
    org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_supplier_choices_org_cat_familia
  ON public.trade_supplier_choices (org_id, catalog_id, familia, created_at DESC);

-- RPC: registra una elección y auto-promueve a preferido tras 3 elecciones
CREATE OR REPLACE FUNCTION public.record_supplier_choice(
  p_org_id    uuid,
  p_catalog_id uuid,
  p_familia   text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count bigint;
BEGIN
  INSERT INTO public.trade_supplier_choices (org_id, catalog_id, familia)
  VALUES (p_org_id, p_catalog_id, p_familia);

  SELECT COUNT(*) INTO v_count
  FROM public.trade_supplier_choices
  WHERE org_id    = p_org_id
    AND catalog_id = p_catalog_id
    AND familia   = p_familia
    AND created_at > now() - interval '90 days';

  IF v_count >= 3 AND p_familia IS NOT NULL THEN
    INSERT INTO public.trade_org_suppliers (org_id, catalog_id, enabled, preferido_categorias)
    VALUES (p_org_id, p_catalog_id, true, ARRAY[p_familia])
    ON CONFLICT (org_id, catalog_id) DO UPDATE
      SET preferido_categorias = (
        SELECT array_agg(DISTINCT cat ORDER BY cat)
        FROM unnest(
          coalesce(trade_org_suppliers.preferido_categorias, ARRAY[]::text[]) || ARRAY[p_familia]
        ) AS cat
      );

    -- Una familia = un preferido: quitar de otros proveedores
    UPDATE public.trade_org_suppliers
    SET preferido_categorias = array_remove(preferido_categorias, p_familia)
    WHERE org_id     = p_org_id
      AND catalog_id != p_catalog_id
      AND preferido_categorias @> ARRAY[p_familia];
  END IF;
END;
$$;

-- Nueva versión de search_supplier_products con es_preferido + catalog_id
CREATE OR REPLACE FUNCTION public.search_supplier_products(
  material_text    text,
  p_org_id         uuid DEFAULT NULL::uuid,
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
  motivo        text,
  es_preferido  boolean,
  catalog_id    uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tokens       text;
  v_word1        text;
  v_row_count    bigint;
  v_had_fts      boolean;
  cat            RECORD;
BEGIN
  SELECT string_agg(lexeme, ' | ')
  INTO v_tokens
  FROM unnest(to_tsvector('spanish', coalesce(material_text, 'a')));

  v_word1 := split_part(coalesce(material_text, ''), ' ', 1);

  FOR cat IN
    SELECT
      sc.id                                                              AS cat_id,
      sc.supplier_key                                                    AS skey,
      sc.supplier_name                                                   AS sname,
      coalesce(os.margen_override, sc.margen_pct_default, 20)::numeric  AS margen,
      coalesce(os.preferido_categorias, ARRAY[]::text[])                AS preferido_cats
    FROM public.trade_supplier_catalogs sc
    LEFT JOIN public.trade_org_suppliers os
      ON os.catalog_id = sc.id AND os.org_id = p_org_id
    WHERE sc.is_active = true AND sc.org_id IS NULL
    ORDER BY
      CASE WHEN os.preferido_categorias IS NOT NULL
                AND array_length(os.preferido_categorias, 1) > 0
           THEN 0 ELSE 1 END,
      sc.prioridad, sc.supplier_key
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
        CASE WHEN p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia]
          THEN (ts_rank_cd(p.search_vector, to_tsquery('spanish', v_tokens)) * 2.0)::real
          ELSE ts_rank_cd(p.search_vector, to_tsquery('spanish', v_tokens))::real
        END,
        'fts'::text,
        (p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia])::boolean,
        cat.cat_id::uuid
      FROM public.trade_supplier_products p
      WHERE p.catalog_id = cat.cat_id
        AND p.activo = true
        AND p.search_vector @@ to_tsquery('spanish', v_tokens)
      ORDER BY
        (p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia]) DESC,
        ts_rank_cd(p.search_vector, to_tsquery('spanish', v_tokens)) DESC
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
        CASE WHEN p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia]
          THEN 0.2::real ELSE 0.1::real
        END,
        'ilike'::text,
        (p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia])::boolean,
        cat.cat_id::uuid
      FROM public.trade_supplier_products p
      WHERE p.catalog_id = cat.cat_id
        AND p.activo = true
        AND p.descripcion ILIKE '%' || v_word1 || '%'
      ORDER BY
        (p.familia IS NOT NULL AND cat.preferido_cats @> ARRAY[p.familia]) DESC,
        p.descripcion
      LIMIT limit_per_catalog;
    END IF;
  END LOOP;

  -- Catálogo Global Base
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
      'fts'::text,
      false::boolean,
      NULL::uuid
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
      'ilike'::text,
      false::boolean,
      NULL::uuid
    FROM public.trade_global_catalog g
    WHERE g.activo = true
      AND g.descripcion ILIKE '%' || v_word1 || '%'
    ORDER BY g.descripcion
    LIMIT limit_per_catalog;
  END IF;

END;
$function$;
;
