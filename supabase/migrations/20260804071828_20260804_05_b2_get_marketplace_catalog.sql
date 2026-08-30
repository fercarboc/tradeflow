
-- RC1-B: RPC paginada para el catálogo navegable del Marketplace instalador.

CREATE OR REPLACE FUNCTION public.get_marketplace_catalog_paged(
  p_query      TEXT    DEFAULT NULL,
  p_familia    TEXT    DEFAULT NULL,
  p_oficio     TEXT    DEFAULT NULL,
  p_only_stock BOOLEAN DEFAULT FALSE,
  p_sort_by    TEXT    DEFAULT 'nombre',
  p_limit      INT     DEFAULT 24,
  p_offset     INT     DEFAULT 0
)
RETURNS TABLE (
  up_id             UUID,
  nombre_canonico   TEXT,
  descripcion       TEXT,
  familia           TEXT,
  subfamilia        TEXT,
  oficio            TEXT,
  unidad            TEXT,
  image_url         TEXT,
  offering_count    BIGINT,
  precio_min        NUMERIC,
  precio_max        NUMERIC,
  stock_ok          BOOLEAN,
  plazo_min         INT,
  actor_ids         TEXT[],
  actor_nombres     TEXT[],
  best_offering_id  UUID,
  best_actor_id     UUID,
  best_actor_nombre TEXT,
  best_precio       NUMERIC,
  best_stock        BOOLEAN,
  best_plazo        INT,
  best_supplier_ref TEXT,
  best_unidad       TEXT,
  total_count       BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_query_u TEXT;
BEGIN
  v_query_u := lower(extensions.unaccent(coalesce(p_query, '')));

  RETURN QUERY
  WITH active_offerings AS (
    SELECT
      o.id,
      o.universal_product_id,
      o.supplier_ref,
      o.precio_coste,
      o.stock_disponible,
      o.stock_cantidad,
      o.plazo_entrega_dias,
      o.unidad,
      a.id     AS actor_id,
      a.nombre AS actor_nombre
    FROM public.trade_marketplace_supplier_offerings o
    JOIN public.trade_supplier_catalogs cat
      ON cat.id = o.supplier_catalog_id
    JOIN public.trade_marketplace_actors a
      ON a.supplier_catalog_id = cat.id
    WHERE o.match_state = 'matched'
      AND o.activa      = TRUE
      AND cat.is_active = TRUE
      AND a.estado      = 'active'
  ),
  ups_agg AS (
    SELECT
      oa.universal_product_id,
      COUNT(*)::BIGINT                      AS c_count,
      MIN(oa.precio_coste)                  AS c_precio_min,
      MAX(oa.precio_coste)                  AS c_precio_max,
      BOOL_OR(oa.stock_disponible)          AS c_stock_ok,
      MIN(oa.plazo_entrega_dias)            AS c_plazo_min,
      array_agg(DISTINCT oa.actor_id::TEXT) AS c_actor_ids,
      array_agg(DISTINCT oa.actor_nombre)   AS c_actor_nombres
    FROM active_offerings oa
    GROUP BY oa.universal_product_id
  ),
  ups_filtered AS (
    SELECT
      up.id,
      up.nombre_canonico,
      up.descripcion,
      up.familia,
      up.subfamilia,
      up.oficio,
      up.unidad,
      up.image_url,
      ua.c_count,
      ua.c_precio_min,
      ua.c_precio_max,
      ua.c_stock_ok,
      ua.c_plazo_min,
      ua.c_actor_ids,
      ua.c_actor_nombres,
      COUNT(*) OVER() AS total_count
    FROM public.trade_marketplace_universal_products up
    JOIN ups_agg ua ON ua.universal_product_id = up.id
    WHERE up.validation_state = 'validated'
      AND (p_familia    IS NULL OR up.familia ILIKE '%' || p_familia || '%')
      AND (p_oficio     IS NULL OR up.oficio  = p_oficio)
      AND (p_only_stock = FALSE  OR ua.c_stock_ok = TRUE)
      AND (
        v_query_u = '' OR
        lower(extensions.unaccent(up.nombre_canonico))           ILIKE '%' || v_query_u || '%' OR
        lower(extensions.unaccent(up.familia))                   ILIKE '%' || v_query_u || '%' OR
        lower(extensions.unaccent(coalesce(up.subfamilia, '')))  ILIKE '%' || v_query_u || '%'
      )
  ),
  best_per_up AS (
    SELECT DISTINCT ON (oa.universal_product_id)
      oa.universal_product_id,
      oa.id             AS best_id,
      oa.actor_id       AS best_actor_id,
      oa.actor_nombre   AS best_actor_nombre,
      oa.precio_coste   AS best_precio,
      oa.stock_disponible AS best_stock,
      oa.plazo_entrega_dias AS best_plazo,
      oa.supplier_ref   AS best_ref,
      oa.unidad         AS best_unidad
    FROM active_offerings oa
    WHERE oa.universal_product_id IN (SELECT id FROM ups_filtered)
    ORDER BY
      oa.universal_product_id,
      oa.stock_disponible DESC,
      oa.precio_coste ASC NULLS LAST,
      oa.plazo_entrega_dias ASC
  )
  SELECT
    uf.id,
    uf.nombre_canonico,
    uf.descripcion,
    uf.familia,
    uf.subfamilia,
    uf.oficio,
    uf.unidad,
    uf.image_url,
    uf.c_count,
    uf.c_precio_min,
    uf.c_precio_max,
    uf.c_stock_ok,
    uf.c_plazo_min::INT,
    uf.c_actor_ids,
    uf.c_actor_nombres,
    bp.best_id,
    bp.best_actor_id,
    bp.best_actor_nombre,
    bp.best_precio,
    bp.best_stock,
    bp.best_plazo::INT,
    bp.best_ref,
    bp.best_unidad,
    uf.total_count
  FROM ups_filtered uf
  LEFT JOIN best_per_up bp ON bp.universal_product_id = uf.id
  ORDER BY
    CASE WHEN p_sort_by = 'precio_asc' THEN uf.c_precio_min::FLOAT END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'plazo_asc'  THEN uf.c_plazo_min       END ASC NULLS LAST,
    uf.nombre_canonico ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_offerings_for_up(
  p_up_id UUID
)
RETURNS TABLE (
  offering_id      UUID,
  supplier_ref     TEXT,
  descripcion      TEXT,
  actor_id         UUID,
  actor_nombre     TEXT,
  actor_verificado BOOLEAN,
  precio_coste     NUMERIC,
  unidad           TEXT,
  stock_disponible BOOLEAN,
  stock_cantidad   INT,
  plazo_dias       INT,
  image_url        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    o.id,
    o.supplier_ref,
    o.descripcion_comercial,
    a.id,
    a.nombre,
    a.verificado,
    o.precio_coste,
    o.unidad,
    o.stock_disponible,
    o.stock_cantidad,
    o.plazo_entrega_dias,
    COALESCE(o.image_url, up.image_url)
  FROM public.trade_marketplace_supplier_offerings o
  JOIN public.trade_supplier_catalogs cat
    ON cat.id = o.supplier_catalog_id
  JOIN public.trade_marketplace_actors a
    ON a.supplier_catalog_id = cat.id
  JOIN public.trade_marketplace_universal_products up
    ON up.id = o.universal_product_id
  WHERE o.universal_product_id = p_up_id
    AND o.match_state = 'matched'
    AND o.activa      = TRUE
    AND cat.is_active = TRUE
    AND a.estado      = 'active'
  ORDER BY
    o.stock_disponible DESC,
    o.precio_coste     ASC NULLS LAST,
    o.plazo_entrega_dias ASC,
    a.nombre           ASC;
END;
$$;
;
