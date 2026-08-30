-- MVP-6.2: Reporting de ventas y pedidos del proveedor
-- Evolución temporal, distribución por estado, ranking de compradores, pedidos atrasados.

CREATE OR REPLACE FUNCTION public.get_supplier_reporting_sales(
  p_actor_id  uuid,
  p_date_from timestamptz,
  p_date_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_by_day     jsonb;
  v_by_estado  jsonb;
  v_by_org     jsonb;
  v_atrasados  jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id;

  -- ── Evolución diaria (marketplace + legacy) ────────────────────────────────
  -- Excluye pending/borrador y cancelled/cancelado. Agrupa por día UTC.
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('fecha', fecha, 'ventas', ventas, 'num_pedidos', num_pedidos)
    ORDER BY fecha
  ), '[]'::jsonb)
  INTO v_by_day
  FROM (
    SELECT
      (DATE(created_at AT TIME ZONE 'UTC'))::text AS fecha,
      ROUND(SUM(total)::numeric, 2)               AS ventas,
      COUNT(*)::integer                           AS num_pedidos
    FROM (
      SELECT total, created_at FROM public.trade_marketplace_orders
      WHERE actor_id = p_actor_id
        AND estado NOT IN ('cancelled', 'pending')
        AND created_at >= p_date_from AND created_at < p_date_to
      UNION ALL
      SELECT total, created_at FROM public.trade_supplier_orders
      WHERE catalog_id = v_catalog_id
        AND estado NOT IN ('cancelado', 'borrador')
        AND created_at >= p_date_from AND created_at < p_date_to
    ) t
    GROUP BY DATE(created_at AT TIME ZONE 'UTC')
  ) d;

  -- ── Distribución por estado (solo marketplace) ─────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('estado', estado, 'count', cnt, 'total', ROUND(tot, 2))
    ORDER BY cnt DESC
  ), '[]'::jsonb)
  INTO v_by_estado
  FROM (
    SELECT estado, COUNT(*)::integer AS cnt, COALESCE(SUM(total), 0) AS tot
    FROM public.trade_marketplace_orders
    WHERE actor_id = p_actor_id
      AND created_at >= p_date_from AND created_at < p_date_to
    GROUP BY estado
  ) s;

  -- ── Top 10 compradores por volumen (marketplace, excluye cancelados) ────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object('org_nombre', org_nombre, 'count', cnt, 'total', ROUND(tot, 2))
    ORDER BY tot DESC
  ), '[]'::jsonb)
  INTO v_by_org
  FROM (
    SELECT
      COALESCE(org.nombre, 'Organización') AS org_nombre,
      COUNT(*)::integer                    AS cnt,
      COALESCE(SUM(mo.total), 0)           AS tot
    FROM public.trade_marketplace_orders mo
    LEFT JOIN public.trade_organizations org ON org.id = mo.org_id
    WHERE mo.actor_id = p_actor_id
      AND mo.estado NOT IN ('cancelled', 'pending')
      AND mo.created_at >= p_date_from AND mo.created_at < p_date_to
    GROUP BY org.id, org.nombre
    ORDER BY tot DESC
    LIMIT 10
  ) o;

  -- ── Pedidos atrasados (activos más de 72h sin avanzar) ────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'order_id',    id,
      'numero',      COALESCE(numero, 'MKT-' || LEFT(id::text, 8)),
      'estado',      estado,
      'total',       total,
      'created_at',  created_at,
      'horas_espera', ROUND(EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0)::integer
    )
    ORDER BY created_at ASC
  ), '[]'::jsonb)
  INTO v_atrasados
  FROM public.trade_marketplace_orders
  WHERE actor_id = p_actor_id
    AND estado IN ('confirmed', 'preparing', 'pending')
    AND created_at < now() - INTERVAL '72 hours'
  LIMIT 20;

  RETURN jsonb_build_object(
    'by_day',    v_by_day,
    'by_estado', v_by_estado,
    'by_org',    v_by_org,
    'atrasados', v_atrasados
  );
END;
$$;
