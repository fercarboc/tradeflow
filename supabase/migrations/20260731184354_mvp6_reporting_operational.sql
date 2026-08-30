-- MVP-6.4: Reporting operativo del proveedor

CREATE OR REPLACE FUNCTION public.get_supplier_reporting_operational(
  p_actor_id  uuid,
  p_date_from timestamptz,
  p_date_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_avg_confirm_h        numeric;
  v_avg_preparing_h      numeric;
  v_avg_ship_from_conf_h numeric;
  v_avg_total_cycle_h    numeric;
  v_pct_confirmed_24h    numeric;
  v_pct_shipped_48h      numeric;
  v_total_orders         integer;
  v_confirmed_orders     integer;
  v_shipped_orders       integer;
  v_atrasados_count      integer;
  v_incidencias_total    integer;
  v_incidents_by_day     jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 3600.0)::numeric, 1)
  INTO v_avg_confirm_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND confirmed_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (preparing_at - confirmed_at)) / 3600.0)::numeric, 1)
  INTO v_avg_preparing_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND preparing_at IS NOT NULL AND confirmed_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (shipped_at - confirmed_at)) / 3600.0)::numeric, 1)
  INTO v_avg_ship_from_conf_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND shipped_at IS NOT NULL AND confirmed_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT ROUND(AVG(EXTRACT(EPOCH FROM (delivered_at - created_at)) / 3600.0)::numeric, 1)
  INTO v_avg_total_cycle_h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND delivered_at IS NOT NULL
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL)::integer INTO v_confirmed_orders
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND estado NOT IN ('cancelled')
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT COUNT(*) FILTER (WHERE shipped_at IS NOT NULL)::integer INTO v_shipped_orders
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND estado NOT IN ('cancelled')
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT COUNT(*)::integer INTO v_total_orders
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND estado NOT IN ('cancelled', 'pending')
    AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT ROUND(
    COUNT(*) FILTER (
      WHERE confirmed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (confirmed_at - created_at)) / 3600.0 <= 24
    ) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE confirmed_at IS NOT NULL), 0)
  , 1)
  INTO v_pct_confirmed_24h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT ROUND(
    COUNT(*) FILTER (
      WHERE shipped_at IS NOT NULL AND confirmed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (shipped_at - confirmed_at)) / 3600.0 <= 48
    ) * 100.0 / NULLIF(COUNT(*) FILTER (WHERE shipped_at IS NOT NULL AND confirmed_at IS NOT NULL), 0)
  , 1)
  INTO v_pct_shipped_48h
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id AND created_at >= p_date_from AND created_at < p_date_to;

  SELECT COUNT(*)::integer INTO v_atrasados_count
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id
    AND estado IN ('confirmed', 'preparing', 'pending')
    AND created_at < now() - INTERVAL '72 hours';

  SELECT COUNT(DISTINCT oe.order_id)::integer INTO v_incidencias_total
  FROM public.trade_marketplace_order_events oe
  JOIN public.trade_marketplace_orders o ON o.id = oe.order_id
  WHERE o.actor_id = p_actor_id AND oe.tipo = 'incident_reported'
    AND o.created_at >= p_date_from AND o.created_at < p_date_to;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('fecha', fecha, 'count', cnt)
    ORDER BY fecha
  ), '[]'::jsonb)
  INTO v_incidents_by_day
  FROM (
    SELECT
      (DATE(oe.created_at AT TIME ZONE 'UTC'))::text AS fecha,
      COUNT(DISTINCT oe.order_id)::integer AS cnt
    FROM public.trade_marketplace_order_events oe
    JOIN public.trade_marketplace_orders o ON o.id = oe.order_id
    WHERE o.actor_id = p_actor_id AND oe.tipo = 'incident_reported'
      AND o.created_at >= p_date_from AND o.created_at < p_date_to
    GROUP BY DATE(oe.created_at AT TIME ZONE 'UTC')
  ) d;

  RETURN jsonb_build_object(
    'tiempos', jsonb_build_object(
      'avg_confirm_h',     v_avg_confirm_h,
      'avg_preparing_h',   v_avg_preparing_h,
      'avg_ship_h',        v_avg_ship_from_conf_h,
      'avg_total_cycle_h', v_avg_total_cycle_h
    ),
    'sla', jsonb_build_object(
      'total_orders',      v_total_orders,
      'confirmed_orders',  v_confirmed_orders,
      'shipped_orders',    v_shipped_orders,
      'pct_confirmed_24h', v_pct_confirmed_24h,
      'pct_shipped_48h',   v_pct_shipped_48h
    ),
    'atrasados_count', v_atrasados_count,
    'incidencias', jsonb_build_object(
      'total',  v_incidencias_total,
      'by_day', v_incidents_by_day
    )
  );
END;
$$;;
