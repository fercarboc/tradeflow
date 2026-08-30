
-- Fix 1: Eliminar versión obsoleta de confirm_supplier_order (2 params)
-- que solapa con la versión de 3 params causando ambigüedad
DROP FUNCTION IF EXISTS public.confirm_supplier_order(uuid, text);

-- Fix 2: Reescribir get_supplier_offerings_paged con columnas explícitas
-- para evitar "column reference id is ambiguous" (mismo patrón que BUG-007)
CREATE OR REPLACE FUNCTION public.get_supplier_offerings_paged(
  p_actor_id   uuid,
  p_search     text    DEFAULT NULL,
  p_match_state text   DEFAULT NULL,
  p_limit      integer DEFAULT 20,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE(
  id                    uuid,
  supplier_ref          text,
  descripcion_comercial text,
  precio_coste          numeric,
  precio_venta          numeric,
  unidad                text,
  stock_disponible      boolean,
  stock_cantidad        integer,
  plazo_entrega_dias    integer,
  match_state           text,
  match_method          text,
  match_confidence      numeric,
  universal_product_id  uuid,
  up_nombre_canonico    text,
  up_familia            text,
  ia_estado             text,
  ia_explicacion        text,
  activa                boolean,
  created_at            timestamptz,
  total_count           bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'offerings:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere offerings:read.';
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE public.trade_marketplace_actors.id = p_actor_id;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      o.id                        AS f_id,
      o.supplier_ref              AS f_supplier_ref,
      o.descripcion_comercial     AS f_descripcion_comercial,
      o.precio_coste              AS f_precio_coste,
      o.precio_venta              AS f_precio_venta,
      o.unidad                    AS f_unidad,
      o.stock_disponible          AS f_stock_disponible,
      o.stock_cantidad            AS f_stock_cantidad,
      o.plazo_entrega_dias        AS f_plazo_entrega_dias,
      o.match_state               AS f_match_state,
      o.match_method              AS f_match_method,
      o.match_confidence          AS f_match_confidence,
      o.universal_product_id      AS f_universal_product_id,
      up.nombre_canonico          AS f_up_nombre_canonico,
      up.familia                  AS f_up_familia,
      CASE
        WHEN o.match_state = 'matched' AND o.activa AND o.stock_disponible
             AND COALESCE(o.match_confidence, 1) >= 0.85 THEN 'compatible'
        WHEN o.match_state = 'matched' AND o.activa AND NOT o.stock_disponible THEN 'sin_stock'
        WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) < 0.85 THEN 'revisar'
        WHEN o.match_state = 'suggested'                                           THEN 'mejor_coincidencia'
        WHEN o.match_state IN ('pending_review', 'unmatched')                      THEN 'sin_up'
        ELSE 'revisar'
      END                         AS f_ia_estado,
      CASE
        WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) >= 0.85
          THEN 'Vinculado con alta confianza.'
        WHEN o.match_state = 'matched' AND COALESCE(o.match_confidence, 1) < 0.85
          THEN 'Vinculado con confianza media. Revisa la coincidencia.'
        WHEN o.match_state = 'suggested'
          THEN 'El sistema ha encontrado una posible coincidencia. Confirma manualmente.'
        WHEN o.match_state = 'pending_review'
          THEN 'Importado recientemente. Pendiente de vincular a un Producto Universal.'
        WHEN o.match_state = 'unmatched'
          THEN 'Sin Producto Universal. No aparece en búsquedas del Motor IA.'
        ELSE 'Revisar estado.'
      END                         AS f_ia_explicacion,
      o.activa                    AS f_activa,
      o.created_at                AS f_created_at
    FROM public.trade_marketplace_supplier_offerings o
    LEFT JOIN public.trade_marketplace_universal_products up ON up.id = o.universal_product_id
    WHERE o.supplier_catalog_id = v_catalog_id
      AND (p_match_state IS NULL OR o.match_state = p_match_state)
      AND (
        p_search IS NULL
        OR o.supplier_ref          ILIKE '%' || p_search || '%'
        OR o.descripcion_comercial ILIKE '%' || p_search || '%'
        OR up.nombre_canonico      ILIKE '%' || p_search || '%'
      )
    ORDER BY
      CASE o.match_state
        WHEN 'pending_review' THEN 1
        WHEN 'unmatched'      THEN 2
        WHEN 'suggested'      THEN 3
        WHEN 'matched'        THEN 4
        ELSE 5
      END,
      o.created_at DESC
  )
  SELECT
    f.f_id,
    f.f_supplier_ref,
    f.f_descripcion_comercial,
    f.f_precio_coste,
    f.f_precio_venta,
    f.f_unidad,
    f.f_stock_disponible,
    f.f_stock_cantidad,
    f.f_plazo_entrega_dias,
    f.f_match_state,
    f.f_match_method,
    f.f_match_confidence,
    f.f_universal_product_id,
    f.f_up_nombre_canonico,
    f.f_up_familia,
    f.f_ia_estado,
    f.f_ia_explicacion,
    f.f_activa,
    f.f_created_at,
    COUNT(*) OVER ()::bigint AS f_total_count
  FROM filtered f
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
;
