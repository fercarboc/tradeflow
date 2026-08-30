-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.3 — Migration 3: Booking column SELECT grants + admin_get_ad_bookings
-- ═══════════════════════════════════════════════════════════════════════════
-- The booking table has column-level SELECT grants (set in E4.C.2.2).
-- New columns added in migration 1 are NOT auto-granted — must be explicit.
--
-- Supplier-visible new columns:
--   target_type, target_id, target_label     — targeting info the supplier set
--   rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot — tarifa
--   estimated_days_snapshot, estimated_total_snapshot — estimate for supplier
--   commercial_terms_snapshot — full jsonb snapshot (public, no secrets)
--
-- Also update admin_get_ad_bookings() to return new fields.
--
-- INVARIANTE: publicidad ≠ ranking. Sin pricing dinámico ni subastas.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Grant SELECT on new booking columns to authenticated
GRANT SELECT (
  target_type, target_id, target_label,
  rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot,
  estimated_days_snapshot, estimated_total_snapshot,
  commercial_terms_snapshot
) ON public.trade_marketplace_ad_bookings TO authenticated;

-- 2. Update admin_get_ad_bookings() to include new targeting + snapshot fields
--    Must DROP first — cannot use CREATE OR REPLACE when RETURNS TABLE changes.
DROP FUNCTION IF EXISTS public.admin_get_ad_bookings();

CREATE FUNCTION public.admin_get_ad_bookings()
RETURNS TABLE (
  id                        uuid,
  slot_id                   text,
  actor_id                  uuid,
  estado                    text,
  inicio                    date,
  fin                       date,
  origen                    text,
  notas                     text,
  mensaje                   text,
  created_at                timestamptz,
  updated_at                timestamptz,
  aprobado_at               timestamptz,
  aprobado_por              uuid,
  target_type               text,
  target_id                 uuid,
  target_label              text,
  rate_amount_snapshot      numeric,
  rate_currency_snapshot    char(3),
  rate_unit_snapshot        text,
  estimated_days_snapshot   integer,
  estimated_total_snapshot  numeric,
  commercial_terms_snapshot jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, slot_id, actor_id, estado::text, inicio, fin, origen::text,
    notas, mensaje, created_at, updated_at, aprobado_at, aprobado_por,
    target_type, target_id, target_label,
    rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot,
    estimated_days_snapshot, estimated_total_snapshot,
    commercial_terms_snapshot
  FROM public.trade_marketplace_ad_bookings
  WHERE public._mkt_is_platform_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ad_bookings() TO authenticated;
