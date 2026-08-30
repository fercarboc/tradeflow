GRANT SELECT (
  target_type, target_id, target_label,
  rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot,
  estimated_days_snapshot, estimated_total_snapshot,
  commercial_terms_snapshot
) ON public.trade_marketplace_ad_bookings TO authenticated;

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
;
