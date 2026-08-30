
CREATE OR REPLACE FUNCTION public.get_supplier_orders_unified(
  p_actor_id uuid,
  p_estado   text    DEFAULT NULL,
  p_limit    integer DEFAULT 20,
  p_offset   integer DEFAULT 0
)
RETURNS TABLE(
  id             uuid,
  source         text,
  numero         text,
  org_nombre     text,
  org_id         uuid,
  estado         text,
  original_estado text,
  total          numeric,
  items_count    bigint,
  notas          text,
  created_at     timestamptz,
  confirmed_at   timestamptz,
  shipped_at     timestamptz,
  completed_at   timestamptz,
  total_count    bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_catalog_id uuid;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'orders:read') THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere orders:read.';
  END IF;

  SELECT supplier_catalog_id INTO v_catalog_id
  FROM public.trade_marketplace_actors
  WHERE public.trade_marketplace_actors.id = p_actor_id;

  RETURN QUERY
  WITH all_orders AS (
    -- Pedidos legacy
    SELECT
      so.id                  AS r_id,
      'legacy'::text         AS r_source,
      'PED-' || LEFT(so.id::text, 8) AS r_numero,
      COALESCE(o.nombre, 'Organización') AS r_org_nombre,
      so.org_id              AS r_org_id,
      CASE so.estado
        WHEN 'enviado'    THEN 'pending'
        WHEN 'confirmado' THEN 'confirmed'
        WHEN 'recibido'   THEN 'completed'
        WHEN 'cancelado'  THEN 'cancelled'
        ELSE so.estado
      END                    AS r_estado,
      so.estado              AS r_original_estado,
      COALESCE(so.total, 0)  AS r_total,
      COUNT(sol.id)          AS r_items_count,
      so.notas               AS r_notas,
      so.created_at          AS r_created_at,
      CASE WHEN so.estado IN ('confirmado','recibido') THEN so.updated_at ELSE NULL END AS r_confirmed_at,
      NULL::timestamptz      AS r_shipped_at,
      CASE WHEN so.estado = 'recibido' THEN so.updated_at ELSE NULL END AS r_completed_at
    FROM public.trade_supplier_orders so
    LEFT JOIN public.trade_organizations o ON o.id = so.org_id
    LEFT JOIN public.trade_supplier_order_lines sol ON sol.order_id = so.id
    WHERE so.catalog_id = v_catalog_id
      AND so.estado != 'borrador'
    GROUP BY so.id, o.nombre

    UNION ALL

    -- Pedidos marketplace
    SELECT
      mo.id                  AS r_id,
      'marketplace'::text    AS r_source,
      mo.numero              AS r_numero,
      COALESCE(o.nombre, 'Organización') AS r_org_nombre,
      mo.org_id              AS r_org_id,
      mo.estado              AS r_estado,
      mo.estado              AS r_original_estado,
      COALESCE(mo.total, 0)  AS r_total,
      COUNT(oi.id)           AS r_items_count,
      mo.notas               AS r_notas,
      mo.created_at          AS r_created_at,
      mo.confirmed_at        AS r_confirmed_at,
      mo.shipped_at          AS r_shipped_at,
      mo.completed_at        AS r_completed_at
    FROM public.trade_marketplace_orders mo
    LEFT JOIN public.trade_organizations o ON o.id = mo.org_id
    LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = mo.id
    WHERE mo.actor_id = p_actor_id
    GROUP BY mo.id, o.nombre
  )
  SELECT
    ao.r_id,
    ao.r_source,
    ao.r_numero,
    ao.r_org_nombre,
    ao.r_org_id,
    ao.r_estado,
    ao.r_original_estado,
    ao.r_total,
    ao.r_items_count,
    ao.r_notas,
    ao.r_created_at,
    ao.r_confirmed_at,
    ao.r_shipped_at,
    ao.r_completed_at,
    COUNT(*) OVER ()::bigint AS r_total_count
  FROM all_orders ao
  WHERE (p_estado IS NULL OR ao.r_estado = p_estado)
  ORDER BY ao.r_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
;
