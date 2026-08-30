-- MVP-6.3: Reporting de rendimiento del catálogo
-- Top productos, productos sin ventas, calidad del catálogo, cobertura IA.

CREATE OR REPLACE FUNCTION public.get_supplier_reporting_catalog(
  p_actor_id  uuid,
  p_date_from timestamptz,
  p_date_to   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id           uuid;
  v_top_ventas           jsonb;
  v_top_unidades         jsonb;
  v_sin_ventas_count     integer;
  v_total_activas        integer;
  v_sin_stock_count      integer;
  v_sin_imagen_count     integer;
  v_inactivos_count      integer;
  v_match_distribution   jsonb;
  v_avg_confidence       numeric;
  v_pending_review_count integer;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id;

  -- ── Top 10 productos por ventas en período ─────────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'offering_id',  offering_id,
      'descripcion',  descripcion,
      'ref',          ref,
      'total_ventas', ROUND(total_ventas, 2),
      'num_pedidos',  num_pedidos,
      'unidades',     unidades
    )
    ORDER BY total_ventas DESC
  ), '[]'::jsonb)
  INTO v_top_ventas
  FROM (
    SELECT
      o.id                                 AS offering_id,
      o.descripcion_comercial              AS descripcion,
      o.supplier_ref                       AS ref,
      COALESCE(SUM(oi.precio_total), 0)    AS total_ventas,
      COUNT(DISTINCT ord.id)::integer      AS num_pedidos,
      COALESCE(SUM(oi.cantidad), 0)::integer AS unidades
    FROM public.trade_marketplace_supplier_offerings o
    JOIN public.trade_marketplace_order_items oi ON oi.offering_id = o.id
    JOIN public.trade_marketplace_orders ord ON ord.id = oi.order_id
    WHERE ord.actor_id = p_actor_id
      AND ord.estado NOT IN ('cancelled')
      AND ord.created_at >= p_date_from AND ord.created_at < p_date_to
    GROUP BY o.id, o.descripcion_comercial, o.supplier_ref
    ORDER BY total_ventas DESC
    LIMIT 10
  ) t;

  -- ── Top 10 productos por unidades en período ───────────────────────────────
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'offering_id', offering_id,
      'descripcion', descripcion,
      'ref',         ref,
      'unidades',    unidades,
      'total_ventas', ROUND(total_ventas, 2)
    )
    ORDER BY unidades DESC
  ), '[]'::jsonb)
  INTO v_top_unidades
  FROM (
    SELECT
      o.id                                   AS offering_id,
      o.descripcion_comercial                AS descripcion,
      o.supplier_ref                         AS ref,
      COALESCE(SUM(oi.cantidad), 0)::integer AS unidades,
      COALESCE(SUM(oi.precio_total), 0)      AS total_ventas
    FROM public.trade_marketplace_supplier_offerings o
    JOIN public.trade_marketplace_order_items oi ON oi.offering_id = o.id
    JOIN public.trade_marketplace_orders ord ON ord.id = oi.order_id
    WHERE ord.actor_id = p_actor_id
      AND ord.estado NOT IN ('cancelled')
      AND ord.created_at >= p_date_from AND ord.created_at < p_date_to
    GROUP BY o.id, o.descripcion_comercial, o.supplier_ref
    ORDER BY unidades DESC
    LIMIT 10
  ) t;

  -- ── Indicadores de calidad del catálogo (snapshot actual) ─────────────────
  -- Se toma snapshot del estado actual (no filtrado por período).

  SELECT COUNT(*)::integer
  INTO v_total_activas
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id AND activa = true;

  -- Productos activos sin ventas en el período seleccionado
  SELECT COUNT(*)::integer
  INTO v_sin_ventas_count
  FROM public.trade_marketplace_supplier_offerings o
  WHERE o.supplier_catalog_id = v_catalog_id
    AND o.activa = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.trade_marketplace_order_items oi
      JOIN public.trade_marketplace_orders ord ON ord.id = oi.order_id
      WHERE oi.offering_id = o.id
        AND ord.actor_id   = p_actor_id
        AND ord.estado NOT IN ('cancelled')
        AND ord.created_at >= p_date_from AND ord.created_at < p_date_to
    );

  SELECT COUNT(*)::integer
  INTO v_sin_stock_count
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id
    AND activa = true AND stock_disponible = false;

  SELECT COUNT(*)::integer
  INTO v_sin_imagen_count
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id
    AND activa = true AND image_url IS NULL;

  SELECT COUNT(*)::integer
  INTO v_inactivos_count
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id AND activa = false;

  -- ── Distribución de match_state ───────────────────────────────────────────
  SELECT COALESCE(jsonb_object_agg(match_state, cnt), '{}'::jsonb)
  INTO v_match_distribution
  FROM (
    SELECT match_state, COUNT(*)::integer AS cnt
    FROM public.trade_marketplace_supplier_offerings
    WHERE supplier_catalog_id = v_catalog_id
    GROUP BY match_state
  ) m;

  SELECT ROUND(AVG(match_confidence)::numeric, 3)
  INTO v_avg_confidence
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id
    AND match_confidence IS NOT NULL;

  SELECT COUNT(*)::integer
  INTO v_pending_review_count
  FROM public.trade_marketplace_supplier_offerings
  WHERE supplier_catalog_id = v_catalog_id
    AND match_state = 'pending_review';

  RETURN jsonb_build_object(
    'top_por_ventas',  v_top_ventas,
    'top_por_unidades', v_top_unidades,
    'calidad', jsonb_build_object(
      'total_activas',    v_total_activas,
      'sin_ventas',       v_sin_ventas_count,
      'sin_stock',        v_sin_stock_count,
      'sin_imagen',       v_sin_imagen_count,
      'inactivos',        v_inactivos_count
    ),
    'ia', jsonb_build_object(
      'distribucion',      v_match_distribution,
      'avg_confidence',    v_avg_confidence,
      'pending_review',    v_pending_review_count
    )
  );
END;
$$;
