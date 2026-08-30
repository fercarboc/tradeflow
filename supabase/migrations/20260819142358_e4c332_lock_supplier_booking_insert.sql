CREATE OR REPLACE FUNCTION public.admin_create_ad_booking(
  p_slot_id   text,
  p_actor_id  uuid,
  p_inicio    date,
  p_fin       date,
  p_estado    text DEFAULT 'RESERVED',
  p_notas     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_inicio IS NULL OR p_fin IS NULL OR p_slot_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION 'slot_id, actor_id, inicio y fin son obligatorios';
  END IF;
  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser igual o posterior al inicio';
  END IF;
  IF p_estado NOT IN ('REQUESTED','CONTACTING','ACCEPTED','RESERVED','CONFIRMED','CANCELLED','EXPIRED') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;
  INSERT INTO public.trade_marketplace_ad_bookings
    (slot_id, actor_id, inicio, fin, estado, notas, origen)
  VALUES
    (p_slot_id, p_actor_id, p_inicio, p_fin, p_estado, p_notas, 'admin')
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('booking_id', v_id, 'estado', p_estado);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_ad_booking(text, uuid, date, date, text, text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_ad_booking(
  p_id        uuid,
  p_slot_id   text,
  p_actor_id  uuid,
  p_inicio    date,
  p_fin       date,
  p_estado    text,
  p_notas     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser igual o posterior al inicio';
  END IF;
  IF p_estado NOT IN ('REQUESTED','CONTACTING','ACCEPTED','RESERVED','CONFIRMED','CANCELLED','EXPIRED') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_estado;
  END IF;
  UPDATE public.trade_marketplace_ad_bookings
  SET slot_id    = p_slot_id,
      actor_id   = p_actor_id,
      inicio     = p_inicio,
      fin        = p_fin,
      estado     = p_estado,
      notas      = p_notas,
      updated_at = now()
  WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking no encontrado: %', p_id USING ERRCODE = 'no_data_found';
  END IF;
  RETURN jsonb_build_object('booking_id', p_id, 'estado', p_estado);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_ad_booking(uuid, text, uuid, date, date, text, text)
  TO authenticated;

REVOKE INSERT ON public.trade_marketplace_ad_bookings FROM authenticated;
REVOKE UPDATE ON public.trade_marketplace_ad_bookings FROM authenticated;
REVOKE DELETE ON public.trade_marketplace_ad_bookings FROM authenticated;

DROP POLICY IF EXISTS ad_bookings_supplier_insert ON public.trade_marketplace_ad_bookings;;
