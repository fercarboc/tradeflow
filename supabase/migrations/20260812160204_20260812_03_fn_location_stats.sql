CREATE OR REPLACE FUNCTION public.get_supplier_location_stats(
  p_actor_id  uuid,
  p_date_from timestamptz DEFAULT date_trunc('month', now()),
  p_date_to   timestamptz DEFAULT now()
)
RETURNS TABLE(
  location_id              uuid,
  location_nombre          text,
  location_tipo            text,
  location_localidad       text,
  num_pedidos              bigint,
  volumen_pedidos          numeric,
  ventas_completadas       numeric,
  ticket_medio             numeric,
  pedidos_pendientes       bigint,
  pedidos_completados      bigint,
  pedidos_cancelados       bigint,
  clientes_distintos       bigint,
  top_universal_product_id uuid,
  top_producto_nombre      text,
  top_producto_unidades    bigint,
  pedidos_recogida         bigint,
  pedidos_entrega          bigint,
  porcentaje_recogida      numeric,
  porcentaje_entrega       numeric,
  avg_confirm_h            numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'orders:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:read.';
  END IF;

  RETURN QUERY
  WITH loc_orders AS (
    SELECT
      sl.id                    AS loc_id,
      mo.id                    AS order_id,
      mo.total,
      mo.estado,
      mo.delivery_method,
      mo.org_id,
      mo.confirmed_at,
      mo.created_at
    FROM public.trade_marketplace_supplier_locations sl
    LEFT JOIN public.trade_marketplace_orders mo
      ON  mo.pickup_location_id = sl.id
      AND mo.actor_id           = p_actor_id
      AND mo.created_at        >= p_date_from
      AND mo.created_at         < p_date_to
    WHERE sl.actor_id = p_actor_id
      AND sl.activa   = true
  ),
  order_items_agg AS (
    SELECT
      lo.loc_id,
      COALESCE(oi.universal_product_id::text, oi.referencia, oi.descripcion) AS product_key,
      oi.universal_product_id,
      SUM(oi.cantidad)     AS total_uds,
      MAX(oi.descripcion)  AS descripcion_snapshot
    FROM loc_orders lo
    JOIN public.trade_marketplace_order_items oi ON oi.order_id = lo.order_id
    WHERE lo.order_id IS NOT NULL
      AND lo.estado != 'cancelled'
    GROUP BY
      lo.loc_id,
      COALESCE(oi.universal_product_id::text, oi.referencia, oi.descripcion),
      oi.universal_product_id
  ),
  top_per_location AS (
    SELECT DISTINCT ON (loc_id)
      oia.loc_id,
      oia.universal_product_id,
      oia.total_uds,
      COALESCE(up.nombre_canonico, oia.descripcion_snapshot) AS prod_nombre
    FROM order_items_agg oia
    LEFT JOIN public.trade_marketplace_universal_products up ON up.id = oia.universal_product_id
    ORDER BY loc_id, total_uds DESC
  ),
  stats AS (
    SELECT
      lo.loc_id,
      COUNT(lo.order_id)                                                                      AS num_pedidos,
      COALESCE(SUM(lo.total)  FILTER (WHERE lo.estado NOT IN ('cancelled')), 0)              AS volumen_pedidos,
      COALESCE(SUM(lo.total)  FILTER (WHERE lo.estado = 'delivered'), 0)                     AS ventas_completadas,
      COUNT(lo.order_id)      FILTER (WHERE lo.estado IN ('pending','confirmed','preparing','shipped')) AS pedidos_pendientes,
      COUNT(lo.order_id)      FILTER (WHERE lo.estado = 'delivered')                         AS pedidos_completados,
      COUNT(lo.order_id)      FILTER (WHERE lo.estado = 'cancelled')                         AS pedidos_cancelados,
      COUNT(DISTINCT lo.org_id)                                                               AS clientes_distintos,
      COUNT(lo.order_id)      FILTER (WHERE lo.delivery_method = 'recogida_proveedor')       AS pedidos_recogida,
      COUNT(lo.order_id)      FILTER (WHERE lo.delivery_method IN ('entrega_obra','entrega_almacen','por_coordinar')) AS pedidos_entrega,
      ROUND(
        AVG(
          EXTRACT(EPOCH FROM (lo.confirmed_at - lo.created_at)) / 3600.0
        ) FILTER (WHERE lo.confirmed_at IS NOT NULL AND lo.order_id IS NOT NULL),
        1
      )                                                                                        AS avg_confirm_h
    FROM loc_orders lo
    GROUP BY lo.loc_id
  )
  SELECT
    sl.id                                       AS location_id,
    sl.nombre                                   AS location_nombre,
    sl.tipo::text                               AS location_tipo,
    sl.localidad                                AS location_localidad,
    COALESCE(s.num_pedidos, 0)                  AS num_pedidos,
    COALESCE(s.volumen_pedidos, 0)              AS volumen_pedidos,
    COALESCE(s.ventas_completadas, 0)           AS ventas_completadas,
    CASE
      WHEN COALESCE(s.pedidos_completados, 0) > 0
      THEN ROUND(s.ventas_completadas / s.pedidos_completados::numeric, 2)
      ELSE NULL
    END                                         AS ticket_medio,
    COALESCE(s.pedidos_pendientes, 0)           AS pedidos_pendientes,
    COALESCE(s.pedidos_completados, 0)          AS pedidos_completados,
    COALESCE(s.pedidos_cancelados, 0)           AS pedidos_cancelados,
    COALESCE(s.clientes_distintos, 0)           AS clientes_distintos,
    tp.universal_product_id                     AS top_universal_product_id,
    tp.prod_nombre                              AS top_producto_nombre,
    tp.total_uds                                AS top_producto_unidades,
    COALESCE(s.pedidos_recogida, 0)             AS pedidos_recogida,
    COALESCE(s.pedidos_entrega, 0)              AS pedidos_entrega,
    CASE WHEN COALESCE(s.num_pedidos, 0) > 0
      THEN ROUND(100.0 * COALESCE(s.pedidos_recogida, 0) / s.num_pedidos, 1)
      ELSE 0::numeric
    END                                         AS porcentaje_recogida,
    CASE WHEN COALESCE(s.num_pedidos, 0) > 0
      THEN ROUND(100.0 * COALESCE(s.pedidos_entrega, 0) / s.num_pedidos, 1)
      ELSE 0::numeric
    END                                         AS porcentaje_entrega,
    s.avg_confirm_h
  FROM public.trade_marketplace_supplier_locations sl
  LEFT JOIN stats           s  ON s.loc_id  = sl.id
  LEFT JOIN top_per_location tp ON tp.loc_id = sl.id
  WHERE sl.actor_id = p_actor_id
    AND sl.activa   = true
  ORDER BY COALESCE(s.volumen_pedidos, 0) DESC, sl.orden ASC;
END;
$$;;
