
-- 1. get_org_active_orders: excluir 'delivered' de activos
--    (instalador confirmó recepción → el pedido pasa al Historial)
CREATE OR REPLACE FUNCTION public.get_org_active_orders(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE(
  id               uuid,
  numero           text,
  estado           text,
  actor_id         uuid,
  actor_nombre     text,
  actor_verificado boolean,
  total            numeric,
  items_count      bigint,
  tracking_ref     text,
  tracking_url     text,
  notas_proveedor  text,
  source_ref       text,
  created_at       timestamptz,
  confirmed_at     timestamptz,
  preparing_at     timestamptz,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  total_count      bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    o.id, o.numero, o.estado, o.actor_id,
    a.nombre, a.verificado,
    o.total, COUNT(oi.id) AS items_count,
    o.tracking_ref, o.tracking_url, o.notas_proveedor,
    c.source_ref,
    o.created_at, o.confirmed_at, o.preparing_at,
    o.shipped_at, o.delivered_at, o.cancelled_at,
    COUNT(*) OVER () AS total_count
  FROM public.trade_marketplace_orders o
  JOIN  public.trade_marketplace_actors a ON a.id = o.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
  WHERE o.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND o.estado NOT IN ('completed','cancelled','delivered')
  GROUP BY o.id, a.nombre, a.verificado, c.source_ref
  ORDER BY
    CASE o.estado
      WHEN 'pending'    THEN 1
      WHEN 'confirmed'  THEN 2
      WHEN 'preparing'  THEN 3
      WHEN 'shipped'    THEN 4
      ELSE 5
    END,
    o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- 2. Borrar pedidos legacy de prueba (anteriores al piloto)
DELETE FROM public.trade_supplier_order_lines
WHERE order_id IN (
  '8908de9a-1e24-4a9d-9f09-6171c9f32dbd',
  '378db93e-fe96-4c2a-948a-010010c1b424',
  'bc0ac091-55f5-4b02-bad5-f5b65e127afb',
  'e164fe77-dc73-4d1d-b1b7-1dcc4b8bde3a',
  'dad36865-2140-4fcb-89d8-4898a850a590',
  'eb7e99a0-63bb-44c7-b60e-280e6941411f',
  'c76fabcf-bb14-4658-a025-5122f1403778',
  '2560dc67-bc69-4f90-a22b-0b50a34a1df9'
);

DELETE FROM public.trade_supplier_orders
WHERE id IN (
  '8908de9a-1e24-4a9d-9f09-6171c9f32dbd',
  '378db93e-fe96-4c2a-948a-010010c1b424',
  'bc0ac091-55f5-4b02-bad5-f5b65e127afb',
  'e164fe77-dc73-4d1d-b1b7-1dcc4b8bde3a',
  'dad36865-2140-4fcb-89d8-4898a850a590',
  'eb7e99a0-63bb-44c7-b60e-280e6941411f',
  'c76fabcf-bb14-4658-a025-5122f1403778',
  '2560dc67-bc69-4f90-a22b-0b50a34a1df9'
);
;
