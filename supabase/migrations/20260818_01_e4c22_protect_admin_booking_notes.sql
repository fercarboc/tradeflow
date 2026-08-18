-- ================================================================
-- E4.C.2.2 — Protect internal admin notes from supplier access
-- ================================================================
-- Problem: authenticated has table-level AND column-level SELECT on
--          trade_marketplace_ad_bookings. A supplier can query any
--          column directly including internal admin notes (notas).
--
-- Solution:
--   A) REVOKE table-level SELECT from authenticated.
--      Note: this cascades and removes all derived column-level SELECT
--      grants too, leaving authenticated with no SELECT on any column.
--   B) GRANT column-level SELECT on supplier-safe columns only.
--      notas / aprobado_at / aprobado_por are excluded.
--   C) CREATE admin_get_ad_bookings() SECURITY DEFINER RPC so
--      admin UI can read full rows (including notas) without granting
--      notas SELECT to the authenticated role.
--
-- Supplier-visible columns after migration:
--   id, slot_id, actor_id, estado, inicio, fin,
--   origen, mensaje, created_at, updated_at
--
-- Admin-only columns (no SELECT grant for authenticated role):
--   notas, aprobado_at, aprobado_por
--
-- INSERT / UPDATE / DELETE grants are NOT touched.
--
-- To rollback:
--   DROP FUNCTION IF EXISTS public.admin_get_ad_bookings();
--   REVOKE SELECT (id, slot_id, actor_id, estado, inicio, fin, origen, mensaje, created_at, updated_at)
--     ON public.trade_marketplace_ad_bookings FROM authenticated;
--   GRANT SELECT ON public.trade_marketplace_ad_bookings TO authenticated;
-- ================================================================

-- A: Remove table-level SELECT (cascades to all column-level SELECT grants)
REVOKE SELECT ON public.trade_marketplace_ad_bookings FROM authenticated;

-- B: Grant SELECT only on supplier-safe columns
GRANT SELECT (id, slot_id, actor_id, estado, inicio, fin, origen, mensaje, created_at, updated_at)
ON public.trade_marketplace_ad_bookings TO authenticated;

-- C: Admin full-access RPC — SECURITY DEFINER bypasses column-level restrictions
CREATE OR REPLACE FUNCTION public.admin_get_ad_bookings()
RETURNS TABLE (
  id           uuid,
  slot_id      text,
  actor_id     uuid,
  estado       text,
  inicio       date,
  fin          date,
  origen       text,
  notas        text,
  mensaje      text,
  created_at   timestamptz,
  updated_at   timestamptz,
  aprobado_at  timestamptz,
  aprobado_por uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, slot_id, actor_id, estado::text, inicio, fin, origen::text,
    notas, mensaje, created_at, updated_at, aprobado_at, aprobado_por
  FROM public.trade_marketplace_ad_bookings
  WHERE public._mkt_is_platform_admin()
  ORDER BY inicio;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ad_bookings() TO authenticated;
