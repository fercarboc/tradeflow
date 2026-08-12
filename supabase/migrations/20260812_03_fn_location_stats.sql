-- RC1-C.7.B — get_supplier_location_stats: métricas operativas por tienda
--
-- ══════════════════════════════════════════════════════════════════════════════
-- SEMÁNTICA EXACTA DE CADA KPI (documentada para trazabilidad)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- IDENTIDAD
--   location_id / location_nombre / location_tipo / location_localidad
--   → Datos vivos de trade_marketplace_supplier_locations (solo activas).
--
-- ACTIVIDAD
--   num_pedidos = COUNT(*) de todos los pedidos en la location en el periodo
--                 (pending+confirmed+preparing+shipped+delivered+cancelled).
--
-- IMPORTES
--   volumen_pedidos    = SUM(total) WHERE estado != 'cancelled'
--                        Importe total de pedidos recibidos y activos (incluye en curso).
--
--   ventas_completadas = SUM(total) WHERE estado = 'delivered'
--                        Importe de pedidos cuyo ciclo comercial está cerrado
--                        (instalador confirmó recepción). Único estado que representa
--                        venta efectiva en el flujo actual.
--
--   ticket_medio       = ventas_completadas / pedidos_completados
--                        Calculado SOBRE el subconjunto completado, no sobre todos.
--                        NULL si no hay pedidos completados.
--
-- ESTADOS
--   pedidos_pendientes  = COUNT WHERE estado IN ('pending','confirmed','preparing','shipped')
--   pedidos_completados = COUNT WHERE estado = 'delivered'
--   pedidos_cancelados  = COUNT WHERE estado = 'cancelled'
--
-- CLIENTES
--   clientes_distintos = COUNT(DISTINCT org_id)
--                        Identidad canónica de comprador; nunca nombres textuales.
--
-- TOP PRODUCTO — prioridad de agrupación (SUM de unidades, no COUNT de líneas):
--   1. universal_product_id (identidad canónica UP) → agrupa todos los ítems del mismo UP
--   2. referencia (texto de offering_ref como fallback de agrupación)
--   3. descripcion (último fallback de etiqueta)
--   Nombre mostrado: nombre_canonico del UP si existe, else descripcion snapshot.
--   Excluye pedidos cancelados del cómputo de unidades.
--
-- LOGÍSTICA
--   pedidos_recogida = COUNT WHERE delivery_method = 'recogida_proveedor'
--   pedidos_entrega  = COUNT WHERE delivery_method IN ('entrega_obra','entrega_almacen','por_coordinar')
--   NOTA: Solo se atribuyen pedidos con pickup_location_id canónico (entrega_local
--         sin pickup_location_id NO se atribuye — gap documentado, no se infiere).
--   En el flujo actual todos los pedidos con pickup_location_id son 'recogida_proveedor'.
--
-- OPERATIVO
--   avg_confirm_h = AVG(EXTRACT EPOCH FROM confirmed_at - created_at) / 3600
--                   Solo pedidos con confirmed_at != NULL.
--                   Semántica: tiempo de respuesta del proveedor tras recibir el pedido.
--                   avg_complete_h excluido: semántica ambigua con datos actuales
--                   (preparing_at no se registra todavía, ciclo entrega variable).
--
-- HISTÓRICO
--   Pedidos sin pickup_location_id (pre-RC1-C.6.3) no aparecen (gap documentado,
--   no se reconstruyen artificialmente).
--   Se devuelven TODAS las tiendas activas del actor (incluidas las sin pedidos
--   en el periodo → métricas a cero).
--
-- PERÍODO POR DEFECTO
--   p_date_from DEFAULT date_trunc('month', now())  → primer día del mes natural actual
--   p_date_to   DEFAULT now()
--   Frontend debe pasar el mes natural explícito para reproducibilidad.
--
-- RLS / SEGURIDAD
--   _mkt_has_permission(p_actor_id, 'orders:read') como primera verificación.
--   Todo JOIN anclado a actor_id = p_actor_id. Sin posibilidad de cross-actor scan.
--   SET search_path TO 'public' para seguridad SECURITY DEFINER.
-- ══════════════════════════════════════════════════════════════════════════════

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
    -- Todos los pedidos atribuibles a cada tienda via pickup_location_id canónico.
    -- LEFT JOIN desde supplier_locations garantiza que todas las tiendas activas
    -- aparecen aunque no tengan pedidos (order_id será NULL en ese caso).
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
    -- Suma de unidades por (location, producto canónico).
    -- Prioridad de agrupación: universal_product_id → referencia → descripcion.
    -- Excluye pedidos cancelados y filas NULL (locations sin pedidos).
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
    -- Un solo producto top por tienda (mayor SUM de unidades).
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
    -- Métricas agregadas por tienda.
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
$$;
