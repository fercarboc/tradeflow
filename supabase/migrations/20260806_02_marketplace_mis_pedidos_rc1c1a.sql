-- ═══════════════════════════════════════════════════════════════════════════════
-- RC1-C.1.a — Mis Pedidos: cliente y obra en pedidos del marketplace
-- Fecha: 2026-08-06
-- Agrega cliente_nombre y obra_nombre a get_org_active_orders y get_org_order_history
-- Join path: cart.source_id (quote_id) → trade_quotes → trade_clients
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. get_org_active_orders — añade cliente_nombre y obra_nombre
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_active_orders(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id              uuid,
  numero          text,
  estado          text,
  actor_id        uuid,
  actor_nombre    text,
  actor_verificado boolean,
  total           numeric,
  items_count     bigint,
  tracking_ref    text,
  tracking_url    text,
  notas_proveedor text,
  source_ref      text,
  cliente_nombre  text,
  obra_nombre     text,
  created_at      timestamptz,
  confirmed_at    timestamptz,
  preparing_at    timestamptz,
  shipped_at      timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz,
  total_count     bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id, o.numero, o.estado,
    o.actor_id, a.nombre, a.verificado,
    o.total,
    COUNT(oi.id) AS items_count,
    o.tracking_ref, o.tracking_url, o.notas_proveedor,
    c.source_ref,
    cl.nombre   AS cliente_nombre,
    q.descripcion AS obra_nombre,
    o.created_at, o.confirmed_at, o.preparing_at,
    o.shipped_at, o.delivered_at, o.cancelled_at,
    COUNT(*) OVER () AS total_count
  FROM public.trade_marketplace_orders o
  JOIN public.trade_marketplace_actors a ON a.id = o.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
  LEFT JOIN public.trade_quotes q ON q.id = c.source_id AND c.source_type = 'quote'
  LEFT JOIN public.trade_clients cl ON cl.id = q.client_id
  WHERE o.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND o.estado NOT IN ('completed','cancelled')
  GROUP BY o.id, a.nombre, a.verificado, c.source_ref, cl.nombre, q.descripcion
  ORDER BY
    CASE o.estado
      WHEN 'pending'   THEN 1
      WHEN 'confirmed' THEN 2
      WHEN 'preparing' THEN 3
      WHEN 'shipped'   THEN 4
      WHEN 'delivered' THEN 5
      ELSE 6
    END,
    o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. get_org_order_history — añade cliente_nombre y obra_nombre
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_org_order_history(
  p_org_id  uuid,
  p_limit   integer DEFAULT 20,
  p_offset  integer DEFAULT 0
)
RETURNS TABLE (
  id             uuid,
  numero         text,
  estado         text,
  actor_nombre   text,
  total          numeric,
  items_count    bigint,
  source_ref     text,
  cliente_nombre text,
  obra_nombre    text,
  created_at     timestamptz,
  completed_at   timestamptz,
  total_count    bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    o.id, o.numero, o.estado, a.nombre,
    o.total, COUNT(oi.id),
    c.source_ref,
    cl.nombre    AS cliente_nombre,
    q.descripcion AS obra_nombre,
    o.created_at, o.completed_at,
    COUNT(*) OVER () AS total_count
  FROM public.trade_marketplace_orders o
  JOIN public.trade_marketplace_actors a ON a.id = o.actor_id
  LEFT JOIN public.trade_marketplace_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.trade_marketplace_carts c ON c.id = o.cart_id
  LEFT JOIN public.trade_quotes q ON q.id = c.source_id AND c.source_type = 'quote'
  LEFT JOIN public.trade_clients cl ON cl.id = q.client_id
  WHERE o.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.trade_org_members m
      WHERE m.org_id = p_org_id AND m.user_id = auth.uid()
    )
    AND o.estado IN ('completed','cancelled','delivered')
  GROUP BY o.id, a.nombre, c.source_ref, cl.nombre, q.descripcion
  ORDER BY o.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

-- Permisos (mismos que antes — sólo refrescamos por si acaso)
REVOKE EXECUTE ON FUNCTION public.get_org_active_orders(uuid,integer,integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_org_order_history(uuid,integer,integer) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_org_active_orders(uuid,integer,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_org_order_history(uuid,integer,integer) TO authenticated;
