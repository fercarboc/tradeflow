-- ═══════════════════════════════════════════════════════════════════════════
-- 20260819_05 — admin_update_ad_booking SECURITY DEFINER
-- ═══════════════════════════════════════════════════════════════════════════
-- trade_marketplace_ad_bookings no tiene GRANT UPDATE para authenticated
-- (restringido en E4.C.2.2). Este RPC permite al admin actualizar estado
-- y notas sin reabrir permisos de tabla.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.admin_update_ad_booking(
  p_booking_id uuid,
  p_estado     text DEFAULT NULL,
  p_notas      text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_estado text;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT estado INTO v_current_estado
  FROM public.trade_marketplace_ad_bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada: %', p_booking_id;
  END IF;

  UPDATE public.trade_marketplace_ad_bookings
  SET
    estado = COALESCE(p_estado::text, estado),
    notas  = CASE WHEN p_notas IS NOT NULL THEN p_notas ELSE notas END
  WHERE id = p_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_ad_booking(uuid, text, text) TO authenticated;
