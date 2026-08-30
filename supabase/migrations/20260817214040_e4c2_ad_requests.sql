
-- E4.C.2: Solicitudes reales de espacios publicitarios
ALTER TABLE public.trade_marketplace_ad_bookings
  DROP CONSTRAINT IF EXISTS chk_booking_estado;

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD CONSTRAINT chk_booking_estado CHECK (
    estado = ANY (ARRAY[
      'REQUESTED'::text, 'CONTACTING'::text, 'ACCEPTED'::text, 'REJECTED'::text,
      'RESERVED'::text, 'CONFIRMED'::text, 'CANCELLED'::text, 'EXPIRED'::text
    ])
  );

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD COLUMN IF NOT EXISTS mensaje text;

CREATE POLICY ad_bookings_supplier_insert
  ON public.trade_marketplace_ad_bookings
  AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK (
    public._is_actor_member(actor_id)
    AND estado = 'REQUESTED'
    AND origen = 'portal_request'
  );

CREATE OR REPLACE FUNCTION public.request_ad_slot(
  p_actor_id uuid, p_slot_id text, p_inicio date, p_fin date, p_mensaje text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_request_id uuid;
BEGIN
  IF NOT public._is_actor_member(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_ad_slots WHERE id = p_slot_id AND activo AND comercializable) THEN
    RAISE EXCEPTION 'Slot % no existe o no está disponible', p_slot_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'Fecha fin debe ser igual o posterior a inicio' USING ERRCODE = 'check_violation';
  END IF;
  IF p_inicio < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de inicio no puede ser en el pasado' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.trade_marketplace_ad_bookings
    WHERE slot_id = p_slot_id AND actor_id = p_actor_id
      AND estado IN ('REQUESTED','CONTACTING','ACCEPTED')
      AND inicio <= p_fin AND fin >= p_inicio
  ) THEN
    RAISE EXCEPTION 'Ya existe una solicitud pendiente para este espacio en ese período' USING ERRCODE = 'unique_violation';
  END IF;
  INSERT INTO public.trade_marketplace_ad_bookings (slot_id, actor_id, estado, inicio, fin, origen, mensaje)
  VALUES (p_slot_id, p_actor_id, 'REQUESTED', p_inicio, p_fin, 'portal_request', p_mensaje)
  RETURNING id INTO v_request_id;
  RETURN jsonb_build_object('request_id', v_request_id, 'estado', 'REQUESTED');
END; $$;

CREATE OR REPLACE FUNCTION public.admin_update_ad_request_status(
  p_request_id uuid, p_status text, p_admin_notes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_current text;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_status NOT IN ('CONTACTING','ACCEPTED','REJECTED','CANCELLED') THEN
    RAISE EXCEPTION 'Estado inválido: %', p_status USING ERRCODE = 'check_violation';
  END IF;
  SELECT estado INTO v_current FROM public.trade_marketplace_ad_bookings WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_current NOT IN ('REQUESTED','CONTACTING','ACCEPTED') THEN
    RAISE EXCEPTION 'No se puede cambiar estado desde %', v_current USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.trade_marketplace_ad_bookings
  SET estado = p_status, notas = COALESCE(p_admin_notes, notas),
      aprobado_por = auth.uid(), aprobado_at = now(), updated_at = now()
  WHERE id = p_request_id;
  RETURN jsonb_build_object('request_id', p_request_id, 'estado', p_status);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_convert_request_to_booking(
  p_request_id uuid, p_inicio date DEFAULT NULL, p_fin date DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_req record; v_inicio date; v_fin date;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Solo administradores' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_req FROM public.trade_marketplace_ad_bookings WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitud no encontrada' USING ERRCODE = 'no_data_found'; END IF;
  IF v_req.estado != 'ACCEPTED' THEN
    RAISE EXCEPTION 'Solo se pueden convertir solicitudes ACCEPTED, actual: %', v_req.estado USING ERRCODE = 'check_violation';
  END IF;
  v_inicio := COALESCE(p_inicio, v_req.inicio);
  v_fin    := COALESCE(p_fin,    v_req.fin);
  IF v_fin < v_inicio THEN
    RAISE EXCEPTION 'Fecha fin debe ser igual o posterior a inicio' USING ERRCODE = 'check_violation';
  END IF;
  UPDATE public.trade_marketplace_ad_bookings
  SET estado = 'RESERVED', inicio = v_inicio, fin = v_fin,
      aprobado_por = auth.uid(), aprobado_at = now(), updated_at = now()
  WHERE id = p_request_id;
  RETURN jsonb_build_object('booking_id', p_request_id, 'estado', 'RESERVED', 'inicio', v_inicio, 'fin', v_fin);
END; $$;

CREATE OR REPLACE FUNCTION public.admin_get_ads_dashboard()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $function$
WITH
  slot_stats AS (
    SELECT count(*) AS total,
      count(*) FILTER (WHERE comercializable AND activo) AS comerciales,
      count(*) FILTER (WHERE fallback_campaign_id IS NULL AND activo) AS sin_fallback
    FROM public.trade_marketplace_ad_slots
  ),
  campaign_stats AS (
    SELECT
      count(*) FILTER (WHERE estado='ACTIVE' AND activa AND (start_at IS NULL OR start_at<=now()) AND (end_at IS NULL OR end_at>now())) AS activas,
      count(*) FILTER (WHERE estado='SCHEDULED') AS programadas,
      count(*) FILTER (WHERE estado IN ('DRAFT','PENDING_APPROVAL')) AS pendientes_aprobacion,
      count(*) FILTER (WHERE estado='ACTIVE' AND activa AND start_at IS NOT NULL AND start_at>now()) AS proximas_inicio,
      count(*) FILTER (WHERE estado='ACTIVE' AND activa AND end_at IS NOT NULL AND end_at>now() AND end_at<=now()+interval'7 days') AS terminan_pronto
    FROM public.trade_marketplace_ad_campaigns
  ),
  booking_stats AS (
    SELECT
      count(*) FILTER (WHERE estado='REQUESTED') AS reservas_pendientes,
      count(*) FILTER (WHERE estado='CONFIRMED' AND inicio<=current_date AND fin>=current_date) AS activas,
      count(*) FILTER (WHERE estado IN ('RESERVED','CONFIRMED') AND inicio>current_date) AS proximas,
      count(*) FILTER (WHERE estado='REQUESTED' AND origen='portal_request') AS solicitudes_portal_nuevas
    FROM public.trade_marketplace_ad_bookings
  ),
  slots_occupied AS (
    SELECT count(DISTINCT slot_id) AS ocupados
    FROM public.trade_marketplace_ad_bookings
    WHERE estado IN ('RESERVED','CONFIRMED') AND inicio<=current_date AND fin>=current_date
  )
SELECT jsonb_build_object(
  'slots_total', s.total, 'slots_comerciales', s.comerciales, 'slots_sin_fallback', s.sin_fallback,
  'slots_ocupados', o.ocupados, 'slots_libres', GREATEST(0, s.comerciales::int - o.ocupados::int),
  'campanas_activas', c.activas, 'campanas_programadas', c.programadas,
  'campanas_pendientes_aprobacion', c.pendientes_aprobacion,
  'campanas_proximas_inicio', c.proximas_inicio, 'campanas_terminan_pronto', c.terminan_pronto,
  'reservas_pendientes', b.reservas_pendientes, 'reservas_activas', b.activas, 'reservas_proximas', b.proximas,
  'solicitudes_portal_nuevas', b.solicitudes_portal_nuevas
)
FROM slot_stats s, campaign_stats c, booking_stats b, slots_occupied o
$function$;

DO $$
DECLARE v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt FROM pg_proc
  WHERE proname IN ('request_ad_slot','admin_update_ad_request_status','admin_convert_request_to_booking')
    AND pronamespace = 'public'::regnamespace;
  IF v_cnt < 3 THEN RAISE EXCEPTION 'E4C2: solo % de 3 RPCs creadas', v_cnt; END IF;
END $$;
;
