-- Fix: nombre de tabla incorrecto en get_supplier_offerings_paged
-- trade_universal_products → trade_marketplace_universal_products

CREATE OR REPLACE FUNCTION public.get_supplier_offerings_paged(
  p_actor_id    uuid,
  p_search      text    DEFAULT NULL,
  p_match_state text    DEFAULT NULL,
  p_activa      boolean DEFAULT NULL,
  p_stock       boolean DEFAULT NULL,
  p_sort_by     text    DEFAULT 'updated_at',
  p_sort_dir    text    DEFAULT 'desc',
  p_limit       integer DEFAULT 20,
  p_offset      integer DEFAULT 0
)
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_sort_col   text;
  v_sort_order text;
BEGIN
  v_sort_col := CASE p_sort_by
    WHEN 'supplier_ref'          THEN 'o.supplier_ref'
    WHEN 'descripcion_comercial' THEN 'o.descripcion_comercial'
    WHEN 'precio_venta'          THEN 'o.precio_venta'
    WHEN 'precio_coste'          THEN 'o.precio_coste'
    WHEN 'created_at'            THEN 'o.created_at'
    ELSE                              'o.updated_at'
  END;
  v_sort_order := CASE WHEN lower(p_sort_dir) = 'asc'
    THEN 'ASC NULLS LAST'
    ELSE 'DESC NULLS LAST'
  END;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id AND estado = 'active';

  IF v_catalog_id IS NULL THEN RETURN; END IF;

  RETURN QUERY EXECUTE format(
    $q$
    SELECT to_jsonb(r) FROM (
      SELECT
        o.id,
        o.supplier_ref,
        o.descripcion_comercial,
        o.precio_coste,
        o.precio_venta,
        o.unidad,
        o.stock_disponible,
        o.stock_cantidad,
        o.plazo_entrega_dias,
        o.match_state,
        o.match_method,
        o.match_confidence,
        o.universal_product_id,
        o.activa,
        o.image_url,
        o.created_at,
        o.updated_at,
        up.nombre_canonico AS up_nombre_canonico,
        up.familia         AS up_familia,
        CASE
          WHEN o.match_state = 'matched'        THEN 'compatible'
          WHEN o.match_state = 'suggested'      THEN 'mejor_coincidencia'
          WHEN o.match_state = 'pending_review' THEN 'revisar'
          WHEN NOT o.stock_disponible           THEN 'sin_stock'
          ELSE                                       'sin_up'
        END AS ia_estado,
        CASE
          WHEN o.match_state = 'matched'        THEN 'Vinculado al catálogo TrabFlow'
          WHEN o.match_state = 'suggested'      THEN 'Sugerencia pendiente de confirmación'
          WHEN o.match_state = 'pending_review' THEN 'Pendiente de revisión'
          WHEN NOT o.stock_disponible           THEN 'Sin stock disponible'
          ELSE                                       'Sin vincular al catálogo TrabFlow'
        END AS ia_explicacion,
        COUNT(*) OVER() AS total_count
      FROM public.trade_marketplace_supplier_offerings o
      LEFT JOIN public.trade_marketplace_universal_products up ON up.id = o.universal_product_id
      WHERE o.supplier_catalog_id = $1
        AND ($2 IS NULL
             OR o.supplier_ref          ILIKE '%%' || $2 || '%%'
             OR o.descripcion_comercial ILIKE '%%' || $2 || '%%')
        AND ($3 IS NULL OR o.match_state      = $3)
        AND ($4 IS NULL OR o.activa           = $4)
        AND ($5 IS NULL OR o.stock_disponible = $5)
      ORDER BY %s %s
      LIMIT $6 OFFSET $7
    ) r
    $q$,
    v_sort_col, v_sort_order
  ) USING v_catalog_id, p_search, p_match_state, p_activa, p_stock, p_limit, p_offset;
END;
$$;
