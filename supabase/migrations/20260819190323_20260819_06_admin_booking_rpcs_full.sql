-- admin_update_ad_booking: firma completa — edición total de reserva por admin
CREATE OR REPLACE FUNCTION public.admin_update_ad_booking(
  p_booking_id uuid,
  p_estado     text DEFAULT NULL,
  p_notas      text DEFAULT NULL,
  p_slot_id    text DEFAULT NULL,
  p_actor_id   uuid DEFAULT NULL,
  p_inicio     date DEFAULT NULL,
  p_fin        date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_ad_bookings WHERE id = p_booking_id) THEN
    RAISE EXCEPTION 'Reserva no encontrada: %', p_booking_id;
  END IF;

  UPDATE public.trade_marketplace_ad_bookings
  SET
    estado   = COALESCE(p_estado,   estado),
    notas    = CASE WHEN p_notas    IS NOT NULL THEN p_notas    ELSE notas    END,
    slot_id  = COALESCE(p_slot_id,  slot_id),
    actor_id = COALESCE(p_actor_id, actor_id),
    inicio   = COALESCE(p_inicio,   inicio),
    fin      = COALESCE(p_fin,      fin)
  WHERE id = p_booking_id;
END;
$$;

DROP FUNCTION IF EXISTS public.admin_update_ad_booking(uuid, text, text);

GRANT EXECUTE ON FUNCTION public.admin_update_ad_booking(uuid, text, text, text, uuid, date, date) TO authenticated;

-- admin_create_ad_booking: nueva reserva por admin (drop primero por tipo de retorno)
DROP FUNCTION IF EXISTS public.admin_create_ad_booking(text, uuid, date, date, text, text);

CREATE FUNCTION public.admin_create_ad_booking(
  p_slot_id    text,
  p_actor_id   uuid,
  p_inicio     date,
  p_fin        date,
  p_estado     text DEFAULT 'RESERVED',
  p_notas      text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking_id uuid;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_ad_slots WHERE id = p_slot_id AND activo = true) THEN
    RAISE EXCEPTION 'Slot no encontrado o inactivo: %', p_slot_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id) THEN
    RAISE EXCEPTION 'Actor no encontrado: %', p_actor_id;
  END IF;

  INSERT INTO public.trade_marketplace_ad_bookings (
    slot_id, actor_id, estado, inicio, fin, origen, notas
  ) VALUES (
    p_slot_id, p_actor_id, p_estado, p_inicio, p_fin, 'admin_panel', p_notas
  ) RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_ad_booking(text, uuid, date, date, text, text) TO authenticated;;
