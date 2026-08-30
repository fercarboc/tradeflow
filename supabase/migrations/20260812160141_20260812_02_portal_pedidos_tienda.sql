-- Drop firma antigua (4 IN params)
DROP FUNCTION IF EXISTS public.get_supplier_orders_unified(uuid, text, integer, integer);

CREATE FUNCTION public.get_supplier_orders_unified(
  p_actor_id    uuid,
  p_estado      text    DEFAULT NULL,
  p_limit       integer DEFAULT 20,
  p_offset      integer DEFAULT 0,
  p_location_id uuid    DEFAULT NULL
)
RETURNS TABLE(
  id                 uuid,
  source             text,
  numero             text,
  org_nombre         text,
  org_id             uuid,
  estado             text,
  original_estado    text,
  total              numeric,
  items_count        bigint,
  notas              text,
  created_at         timestamptz,
  confirmed_at       timestamptz,
  shipped_at         timestamptz,
  completed_at       timestamptz,
  total_count        bigint,
  delivery_method    text,
  pickup_location_id uuid,
  tienda_nombre      text
)
LANGUAGE plpgsql
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
  WHERE id = p_actor_id;

  RETURN QUERY
  WITH all_orders AS (

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
      (SELECT COUNT(*) FROM public.trade_supplier_order_lines WHERE order_id = so.id) AS r_items_count,
      so.notas               AS r_notas,
      so.created_at          AS r_created_at,
      CASE WHEN so.estado IN ('confirmado','recibido') THEN so.updated_at ELSE NULL END AS r_confirmed_at,
      NULL::timestamptz      AS r_shipped_at,
      CASE WHEN so.estado = 'recibido' THEN so.updated_at ELSE NULL END AS r_completed_at,
      NULL::text             AS r_delivery_method,
      NULL::uuid             AS r_pickup_location_id,
      NULL::text             AS r_tienda_nombre
    FROM public.trade_supplier_orders so
    LEFT JOIN public.trade_organizations o ON o.id = so.org_id
    WHERE so.catalog_id = v_catalog_id
      AND so.estado != 'borrador'
      AND p_location_id IS NULL

    UNION ALL

    SELECT
      mo.id                  AS r_id,
      'marketplace'::text    AS r_source,
      mo.numero              AS r_numero,
      COALESCE(o.nombre, 'Organización') AS r_org_nombre,
      mo.org_id              AS r_org_id,
      CASE mo.estado
        WHEN 'delivered' THEN 'completed'
        ELSE mo.estado
      END                    AS r_estado,
      mo.estado              AS r_original_estado,
      COALESCE(mo.total, 0)  AS r_total,
      (SELECT COUNT(*) FROM public.trade_marketplace_order_items WHERE order_id = mo.id) AS r_items_count,
      mo.notas               AS r_notas,
      mo.created_at          AS r_created_at,
      mo.confirmed_at        AS r_confirmed_at,
      mo.shipped_at          AS r_shipped_at,
      COALESCE(mo.completed_at, mo.shipped_at) AS r_completed_at,
      mo.delivery_method     AS r_delivery_method,
      mo.pickup_location_id  AS r_pickup_location_id,
      COALESCE(
        mo.pickup_location_snapshot->>'nombre',
        sl.nombre
      )                      AS r_tienda_nombre
    FROM public.trade_marketplace_orders mo
    LEFT JOIN public.trade_organizations o ON o.id = mo.org_id
    LEFT JOIN public.trade_marketplace_supplier_locations sl ON sl.id = mo.pickup_location_id
    WHERE mo.actor_id = p_actor_id
      AND (p_location_id IS NULL OR mo.pickup_location_id = p_location_id)

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
    COUNT(*) OVER ()::bigint AS r_total_count,
    ao.r_delivery_method,
    ao.r_pickup_location_id,
    ao.r_tienda_nombre
  FROM all_orders ao
  WHERE (p_estado IS NULL OR ao.r_estado = p_estado)
  ORDER BY ao.r_created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;;
