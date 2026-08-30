
-- Fix: propaga image_url al flujo comprador

-- ── 1. get_cart_detail: añade up.image_url en items jsonb ─────────────────────
CREATE OR REPLACE FUNCTION public.get_cart_detail(p_cart_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cart RECORD; v_result jsonb;
BEGIN
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado o sin acceso.';
  END IF;

  SELECT jsonb_build_object(
    'cart', jsonb_build_object(
      'id', v_cart.id, 'org_id', v_cart.org_id,
      'source_type', v_cart.source_type, 'source_id', v_cart.source_id,
      'source_ref', v_cart.source_ref, 'estado', v_cart.estado,
      'notas', v_cart.notas, 'created_at', v_cart.created_at
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',                   ci.id,
        'source_item_type',     ci.source_item_type,
        'source_item_id',       ci.source_item_id,
        'descripcion_original', ci.descripcion_original,
        'descripcion_compra',   ci.descripcion_compra,
        'cantidad',             ci.cantidad,
        'unidad',               ci.unidad,
        'universal_product_id', ci.universal_product_id,
        'up_nombre_canonico',   up.nombre_canonico,
        'up_familia',           up.familia,
        'up_match_confidence',  ci.up_match_confidence,
        'up_match_method',      ci.up_match_method,
        'image_url',            up.image_url,
        'selected_offering_id', ci.selected_offering_id,
        'selected_actor_id',    ci.selected_actor_id,
        'selected_actor_nombre',sa.nombre,
        'provider_alternatives',ci.provider_alternatives,
        'ia_tipo',              ci.ia_tipo,
        'ia_sugerencia',        ci.ia_sugerencia,
        'ia_añadido',           ci.ia_añadido,
        'precio_unitario_final',ci.precio_unitario_final,
        'total_linea',          ci.total_linea,
        'activo',               ci.activo
      ) ORDER BY ci.ia_añadido ASC, ci.created_at ASC)
      FROM public.trade_marketplace_cart_items ci
      LEFT JOIN public.trade_marketplace_universal_products up ON up.id = ci.universal_product_id
      LEFT JOIN public.trade_marketplace_actors sa ON sa.id = ci.selected_actor_id
      WHERE ci.cart_id = p_cart_id
    ), '[]'),
    'summary', (
      SELECT jsonb_build_object(
        'total_items',         COUNT(*) FILTER (WHERE activo),
        'items_con_up',        COUNT(*) FILTER (WHERE activo AND universal_product_id IS NOT NULL),
        'items_con_proveedor', COUNT(*) FILTER (WHERE activo AND selected_offering_id IS NOT NULL),
        'total_estimado',      COALESCE(SUM(total_linea) FILTER (WHERE activo), 0),
        'providers_count',     COUNT(DISTINCT selected_actor_id) FILTER (WHERE activo AND selected_actor_id IS NOT NULL)
      )
      FROM public.trade_marketplace_cart_items
      WHERE cart_id = p_cart_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;


-- ── 2. search_marketplace_offerings: DROP + CREATE con image_url ───────────────
DROP FUNCTION IF EXISTS public.search_marketplace_offerings(text, uuid, uuid, integer, integer);

CREATE FUNCTION public.search_marketplace_offerings(
  p_query       text,
  p_org_id      uuid,
  p_category_id uuid    DEFAULT NULL,
  p_limit       integer DEFAULT 10,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE(
  universal_product_id uuid,
  nombre_canonico      text,
  oficio               text,
  familia              text,
  unidad               text,
  marca                text,
  modelo               text,
  ean                  text,
  es_generico          boolean,
  ofertas_count        bigint,
  mejor_precio_coste   numeric,
  mejor_supplier_name  text,
  mejor_supplier_key   text,
  mejor_offering_id    uuid,
  score                double precision,
  image_url            text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_ts tsquery;
BEGIN
  v_ts := CASE
    WHEN p_query IS NOT NULL AND length(trim(p_query)) > 0
    THEN plainto_tsquery('spanish', trim(p_query))
    ELSE NULL
  END;

  RETURN QUERY
  WITH org_catalogs AS (
    SELECT tos.catalog_id, sc.supplier_name, sc.supplier_key
    FROM public.trade_org_suppliers tos
    JOIN public.trade_supplier_catalogs sc ON sc.id = tos.catalog_id
    WHERE tos.org_id = p_org_id AND tos.enabled = true AND sc.is_active = true
  ),
  matched_offerings AS (
    SELECT o.universal_product_id, o.id AS offering_id, o.precio_coste, oc.supplier_name, oc.supplier_key
    FROM public.trade_marketplace_supplier_offerings o
    JOIN org_catalogs oc ON oc.catalog_id = o.supplier_catalog_id
    WHERE o.match_state = 'matched' AND o.activa = true
  ),
  aggregated AS (
    SELECT
      up.id, up.nombre_canonico, up.oficio, up.familia, up.unidad,
      up.marca, up.modelo, up.ean, up.es_generico, up.search_vector,
      up.image_url,
      COUNT(mo.offering_id)                                                    AS ofertas_count,
      MIN(mo.precio_coste)                                                     AS mejor_precio_coste,
      (ARRAY_AGG(mo.supplier_name ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_name,
      (ARRAY_AGG(mo.supplier_key  ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_key,
      (ARRAY_AGG(mo.offering_id   ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_offering_id,
      CASE WHEN v_ts IS NOT NULL
           THEN ts_rank(up.search_vector, v_ts)::double precision
           ELSE 0.0::double precision
      END AS score
    FROM public.trade_marketplace_universal_products up
    JOIN matched_offerings mo ON mo.universal_product_id = up.id
    WHERE up.validation_state = 'validated'
      AND (p_category_id IS NULL OR up.category_id = p_category_id)
      AND (v_ts IS NULL OR up.search_vector @@ v_ts
           OR up.nombre_canonico ILIKE '%' || trim(p_query) || '%')
    GROUP BY
      up.id, up.nombre_canonico, up.oficio, up.familia, up.unidad,
      up.marca, up.modelo, up.ean, up.es_generico, up.search_vector,
      up.image_url
    HAVING COUNT(mo.offering_id) > 0
  )
  SELECT
    a.id, a.nombre_canonico, a.oficio, a.familia, a.unidad,
    a.marca, a.modelo, a.ean, a.es_generico,
    a.ofertas_count, a.mejor_precio_coste,
    a.mejor_supplier_name, a.mejor_supplier_key, a.mejor_offering_id,
    a.score,
    a.image_url
  FROM aggregated a
  ORDER BY a.score DESC, a.mejor_precio_coste ASC NULLS LAST, a.nombre_canonico ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;
;
