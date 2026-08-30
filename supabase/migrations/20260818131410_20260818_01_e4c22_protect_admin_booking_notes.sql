-- ================================================================
-- E4.C.2.2 — Protect internal admin notes from supplier access
-- ================================================================
REVOKE SELECT ON public.trade_marketplace_ad_bookings FROM authenticated;

REVOKE SELECT (notas, aprobado_at, aprobado_por)
ON public.trade_marketplace_ad_bookings FROM authenticated;

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
;
