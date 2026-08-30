-- MVP-6: Reporting operativo del proveedor
-- Función principal para KPIs de visión general con comparación de período.

-- ── get_supplier_reporting_kpis ───────────────────────────────────────────────
-- KPIs del período actual + período anterior equivalente (misma duración).
-- Fuentes: trade_marketplace_orders (marketplace) + trade_supplier_orders (legacy).
-- Las métricas basadas en items u order_events son solo marketplace por diseño de esquema.
-- Cada KPI devuelve {valor, prev, fuente} donde:
--   fuente = 'marketplace+legacy' | 'solo_marketplace'
--   prev   = NULL si no aplica comparación (métricas de tiempo)
CREATE OR REPLACE FUNCTION public.get_supplier_reporting_kpis(
  p_actor_id  uuid,
  p_date_from timestamptz,
  p_date_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id      uuid;
  v_interval        interval;
  v_prev_from       timestamptz;
  v_prev_to         timestamptz;
  -- Período actual
  v_ventas          numeric   := 0;
  v_num_pedidos     integer   := 0;
  v_ticket_medio    numeric;
  v_prod_vendidos   integer   := 0;
  v_unidades        numeric   := 0;
  v_cancelados      integer   := 0;
  v_incidencias     integer   := 0;
  v_avg_confirm_h   numeric;
  v_avg_ship_h      numeric;
  -- Período anterior
  v_prev_ventas         numeric  := 0;
  v_prev_num_pedidos    integer  := 0;
  v_prev_ticket_medio   numeric;
  v_prev_prod_vendidos  integer  := 0;
  v_prev_unidades       numeric  := 0;
  v_prev_cancelados     integer  := 0;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id;

  v_interval  := p_date_to - p_date_from;
  v_prev_from := p_date_from - v_interval;
  v_prev_to   := p_date_from;

  -- ── Ventas + pedidos + ticket (período actual) ────────────────────────────
  -- Marketplace: excluye pending (no confirmado) y cancelled
  -- Legacy: excluye borrador y cancelado
  SELECT
    COALESCE(SUM(t.total), 0),
    COUNT(t.total)::integer,
    ROUND(AVG(t.total)::numeric, 2)
  INTO v_ventas, v_num_pedidos, v_ticket_medio
  FROM (
    SELECT total FROM public.trade_marketplace_orders
    WHERE actor_id = p_actor_id
      AND estado NOT IN ('cancelled', 'pending')
      AND created_at >= p_date_from AND created_at < p_date_to
    UNION ALL
    SELECT total FROM public.trade_supplier_orders
    WHERE catalog_id = v_catalog_id
      AND estado NOT IN ('cancelado', 'borrador')
      AND created_at >= p_date_from AND created_at < p_date_to
  ) t;

  -- ── Productos y unidades (solo marketplace, período actual) ───────────────
  SELECT
    COUNT(DISTINCT oi.offering_id)::integer,
    COALESCE(SUM(oi.cantidad)::numeric, 0)
  INTO v_prod_vendidos, v_unidades
  FROM public.trade_marketplace_order_items oi
  JOIN public.trade_marketplace_orders o ON o.id = oi.order_id
  WHERE o.actor_id = p_actor_id
    AND o.estado NOT IN ('cancelled')
    AND o.created_at >= p_date_from AND o.created_at < p_date_to;

  -- ── Cancelados (período actual) ───────────────────────────────────────────
  SELECT
    (
      (SELECT COUNT(*) FROM public.trade_marketplace_orders
       WHERE actor_id = p_actor_id AND estado = 'cancelled'
         AND created_at >= p_date_from AND created_at < p_date_to)
      +
      COALESCE((SELECT COUNT(*) FROM public.trade_supplier_orders
       WHERE catalog_id = v_catalog_id AND estado = 'cancelado'
         AND created_at >= p_date_from AND created_at < p_date_to), 0)
    )::integer
  INTO v_cancelados;

  -- ── Incidencias (solo marketplace, período actual) ────────────────────────
  SELECT COUNT(DISTINCT oe.order_id)::integer
  INTO v_incidencias
  FROM public.trade_marketplace_order_events oe
  JOIN public.trade_marketplace_orders o ON o.id = oe.order_id
  WHERE o.actor_id = p_actor_id
    AND oe.tipo = 'incident_reported'
    AND o.created_at >= p_date_from AND o.created_at < p_date_to;

  -- ── Tiempo medio confirmación (solo marketplace, período actual) ──────────
  -- Definición: horas entre created_at y confirmed_at (primer estado confirmado)
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 3600.0)::numeric, 1)
  INTO v_avg_confirm_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id
    AND confirmed_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  -- ── Tiempo medio hasta envío (solo marketplace, período actual) ───────────
  -- Definición: horas entre confirmed_at y shipped_at
  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (shipped_at - confirmed_at)) / 3600.0)::numeric, 1)
  INTO v_avg_ship_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id
    AND shipped_at IS NOT NULL AND confirmed_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  -- ── KPIs período anterior ─────────────────────────────────────────────────
  SELECT
    COALESCE(SUM(t.total), 0),
    COUNT(t.total)::integer,
    ROUND(AVG(t.total)::numeric, 2)
  INTO v_prev_ventas, v_prev_num_pedidos, v_prev_ticket_medio
  FROM (
    SELECT total FROM public.trade_marketplace_orders
    WHERE actor_id = p_actor_id
      AND estado NOT IN ('cancelled', 'pending')
      AND created_at >= v_prev_from AND created_at < v_prev_to
    UNION ALL
    SELECT total FROM public.trade_supplier_orders
    WHERE catalog_id = v_catalog_id
      AND estado NOT IN ('cancelado', 'borrador')
      AND created_at >= v_prev_from AND created_at < v_prev_to
  ) t;

  SELECT
    COUNT(DISTINCT oi.offering_id)::integer,
    COALESCE(SUM(oi.cantidad)::numeric, 0)
  INTO v_prev_prod_vendidos, v_prev_unidades
  FROM public.trade_marketplace_order_items oi
  JOIN public.trade_marketplace_orders o ON o.id = oi.order_id
  WHERE o.actor_id = p_actor_id
    AND o.estado NOT IN ('cancelled')
    AND o.created_at >= v_prev_from AND o.created_at < v_prev_to;

  SELECT
    (
      (SELECT COUNT(*) FROM public.trade_marketplace_orders
       WHERE actor_id = p_actor_id AND estado = 'cancelled'
         AND created_at >= v_prev_from AND created_at < v_prev_to)
      +
      COALESCE((SELECT COUNT(*) FROM public.trade_supplier_orders
       WHERE catalog_id = v_catalog_id AND estado = 'cancelado'
         AND created_at >= v_prev_from AND created_at < v_prev_to), 0)
    )::integer
  INTO v_prev_cancelados;

  RETURN jsonb_build_object(
    'periodo', jsonb_build_object(
      'desde',      p_date_from,
      'hasta',      p_date_to,
      'prev_desde', v_prev_from,
      'prev_hasta', v_prev_to
    ),
    'kpis', jsonb_build_object(
      'ventas',            jsonb_build_object('valor', v_ventas,        'prev', v_prev_ventas,       'fuente', 'marketplace+legacy'),
      'num_pedidos',       jsonb_build_object('valor', v_num_pedidos,   'prev', v_prev_num_pedidos,  'fuente', 'marketplace+legacy'),
      'ticket_medio',      jsonb_build_object('valor', v_ticket_medio,  'prev', v_prev_ticket_medio, 'fuente', 'marketplace+legacy'),
      'prod_vendidos',     jsonb_build_object('valor', v_prod_vendidos, 'prev', v_prev_prod_vendidos,'fuente', 'solo_marketplace'),
      'unidades_vendidas', jsonb_build_object('valor', v_unidades,      'prev', v_prev_unidades,     'fuente', 'solo_marketplace'),
      'cancelados',        jsonb_build_object('valor', v_cancelados,    'prev', v_prev_cancelados,   'fuente', 'marketplace+legacy'),
      'incidencias',       jsonb_build_object('valor', v_incidencias,   'prev', NULL::numeric,       'fuente', 'solo_marketplace'),
      'avg_confirm_h',     jsonb_build_object('valor', v_avg_confirm_h, 'prev', NULL::numeric,       'fuente', 'solo_marketplace'),
      'avg_ship_h',        jsonb_build_object('valor', v_avg_ship_h,    'prev', NULL::numeric,       'fuente', 'solo_marketplace')
    )
  );
END;
$$;
