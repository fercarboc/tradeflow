CREATE OR REPLACE FUNCTION public.get_ad_targeting_options(
  p_actor_id    uuid,
  p_target_type text
)
RETURNS TABLE(id text, label text, extra text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._is_actor_member(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_target_type = 'CATEGORY' THEN
    RETURN QUERY
      SELECT c.id::text, c.nombre, COALESCE(c.oficio,'')
      FROM public.trade_marketplace_categories c
      WHERE c.activa = true
      ORDER BY c.posicion, c.nombre;

  ELSIF p_target_type = 'TRADE' THEN
    RETURN QUERY
      SELECT o.id::text, o.nombre, COALESCE(o.codigo,'')
      FROM public.trade_maintenance_oficios o
      WHERE o.activo = true
      ORDER BY o.nombre;

  ELSIF p_target_type = 'BRAND' THEN
    RETURN QUERY
      SELECT b.id::text, b.nombre, COALESCE(b.slug,'')
      FROM public.trade_marketplace_brands b
      WHERE b.activa = true
      ORDER BY b.nombre;

  ELSIF p_target_type = 'SUPPLIER' THEN
    RETURN QUERY
      SELECT a.id::text, a.nombre, COALESCE(a.slug,'')
      FROM public.trade_marketplace_actors a
      WHERE a.id = p_actor_id
        AND a.estado = 'ACTIVE';

  ELSIF p_target_type = 'PRODUCT' THEN
    RETURN QUERY
      SELECT up.id::text, up.nombre_canonico, COALESCE(up.oficio,'')
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'VALIDATED'
      ORDER BY up.nombre_canonico
      LIMIT 200;

  ELSIF p_target_type = 'OFFERING' THEN
    RETURN QUERY
      SELECT o.id::text, o.descripcion_comercial, o.supplier_catalog_id::text
      FROM public.trade_marketplace_supplier_offerings o
      JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
      WHERE a.id = p_actor_id
        AND o.activa = true
      ORDER BY o.descripcion_comercial
      LIMIT 200;

  ELSE
    RAISE EXCEPTION 'Tipo de objetivo no reconocido: %', p_target_type;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ad_targeting_options(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_ad_slot_v2(
  p_actor_id    uuid,
  p_slot_id     text,
  p_inicio      date,
  p_fin         date,
  p_mensaje     text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_label        text;
  v_rate_amount         numeric(10,2);
  v_rate_currency       char(3);
  v_rate_unit           text;
  v_min_days            integer;
  v_max_days            integer;
  v_days                integer;
  v_estimated_total     numeric(10,2);
  v_booking_id          uuid;
  v_existing_count      integer;
BEGIN
  IF NOT public._is_actor_member(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_inicio < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de inicio no puede ser en el pasado';
  END IF;
  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.trade_marketplace_ad_bookings
  WHERE actor_id = p_actor_id
    AND slot_id  = p_slot_id
    AND estado NOT IN ('REJECTED','CANCELLED','EXPIRED')
    AND inicio   <= p_fin
    AND fin      >= p_inicio;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe una solicitud activa para este espacio en esas fechas';
  END IF;

  SELECT rate_amount, rate_currency, rate_unit, min_duration_days, max_duration_days
  INTO   v_rate_amount, v_rate_currency, v_rate_unit, v_min_days, v_max_days
  FROM   public.trade_marketplace_ad_slots
  WHERE  id = p_slot_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Espacio no encontrado o no disponible: %', p_slot_id;
  END IF;

  v_days := (p_fin - p_inicio) + 1;

  IF v_min_days IS NOT NULL AND v_days < v_min_days THEN
    RAISE EXCEPTION 'La duración mínima para este espacio es % días (seleccionaste %)',
      v_min_days, v_days;
  END IF;
  IF v_max_days IS NOT NULL AND v_days > v_max_days THEN
    RAISE EXCEPTION 'La duración máxima para este espacio es % días (seleccionaste %)',
      v_max_days, v_days;
  END IF;

  IF v_rate_amount IS NOT NULL AND v_rate_unit IS NOT NULL THEN
    v_estimated_total := CASE v_rate_unit
      WHEN 'day'   THEN v_rate_amount * v_days
      WHEN 'week'  THEN v_rate_amount * CEIL(v_days::numeric / 7)
      WHEN 'month' THEN v_rate_amount * CEIL(v_days::numeric / 30)
      ELSE NULL
    END;
  END IF;

  IF p_target_type IS NOT NULL AND p_target_id IS NOT NULL THEN
    IF p_target_type = 'CATEGORY' THEN
      SELECT nombre INTO v_target_label
      FROM public.trade_marketplace_categories
      WHERE id = p_target_id AND activa = true;

    ELSIF p_target_type = 'TRADE' THEN
      SELECT nombre INTO v_target_label
      FROM public.trade_maintenance_oficios
      WHERE id = p_target_id AND activo = true;

    ELSIF p_target_type = 'BRAND' THEN
      SELECT nombre INTO v_target_label
      FROM public.trade_marketplace_brands
      WHERE id = p_target_id AND activa = true;

    ELSIF p_target_type = 'SUPPLIER' THEN
      IF p_target_id <> p_actor_id THEN
        RAISE EXCEPTION 'Un proveedor solo puede promocionarse a sí mismo como SUPPLIER';
      END IF;
      SELECT nombre INTO v_target_label
      FROM public.trade_marketplace_actors WHERE id = p_target_id;

    ELSIF p_target_type = 'PRODUCT' THEN
      SELECT nombre_canonico INTO v_target_label
      FROM public.trade_marketplace_universal_products
      WHERE id = p_target_id AND validation_state = 'VALIDATED';

    ELSIF p_target_type = 'OFFERING' THEN
      SELECT o.descripcion_comercial INTO v_target_label
      FROM public.trade_marketplace_supplier_offerings o
      JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
      WHERE o.id = p_target_id AND a.id = p_actor_id AND o.activa = true;

    ELSE
      RAISE EXCEPTION 'Tipo de objetivo no reconocido: %', p_target_type;
    END IF;

    IF v_target_label IS NULL THEN
      RAISE EXCEPTION 'Objetivo no encontrado o no disponible (tipo: %, id: %)',
        p_target_type, p_target_id;
    END IF;
  END IF;

  INSERT INTO public.trade_marketplace_ad_bookings (
    slot_id, actor_id, estado, inicio, fin, origen, notas,
    target_type, target_id, target_label,
    rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot,
    estimated_days_snapshot, estimated_total_snapshot,
    commercial_terms_snapshot
  ) VALUES (
    p_slot_id, p_actor_id, 'REQUESTED', p_inicio, p_fin, 'portal_supplier',
    p_mensaje,
    p_target_type, p_target_id, v_target_label,
    v_rate_amount, COALESCE(v_rate_currency, 'EUR'), v_rate_unit,
    v_days, v_estimated_total,
    jsonb_build_object(
      'rate_amount',      v_rate_amount,
      'rate_currency',    COALESCE(v_rate_currency, 'EUR'),
      'rate_unit',        v_rate_unit,
      'days',             v_days,
      'estimated_total',  v_estimated_total,
      'target_type',      p_target_type,
      'target_label',     v_target_label,
      'snapshot_at',      now()::text
    )
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('request_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_ad_slot_v2(uuid, text, date, date, text, text, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_campaign_for_booking(
  p_booking_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot_id      text;
  v_actor_id     uuid;
  v_booking_est  text;
  v_target_type  text;
  v_target_id    uuid;
  v_target_label text;
  v_campaign_id  uuid;
  v_actor_name   text;
  v_dest_type    text;
  v_dest_value   text;
BEGIN
  SELECT b.slot_id, b.actor_id, b.estado::text,
         b.target_type, b.target_id, b.target_label,
         a.nombre
  INTO   v_slot_id, v_actor_id, v_booking_est,
         v_target_type, v_target_id, v_target_label,
         v_actor_name
  FROM   public.trade_marketplace_ad_bookings b
  JOIN   public.trade_marketplace_actors a ON a.id = b.actor_id
  WHERE  b.id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva no encontrada: %', p_booking_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_booking_est NOT IN ('RESERVED','CONFIRMED') THEN
    RAISE EXCEPTION
      'La reserva debe estar en estado RESERVED o CONFIRMED (estado actual: %)',
      v_booking_est;
  END IF;

  SELECT id INTO v_campaign_id
  FROM public.trade_marketplace_ad_campaigns
  WHERE booking_id = p_booking_id
  LIMIT 1;

  IF v_campaign_id IS NOT NULL THEN
    RETURN v_campaign_id;
  END IF;

  IF v_target_type IS NOT NULL THEN
    v_dest_type  := lower(v_target_type);
    v_dest_value := COALESCE(v_target_label, v_target_id::text);
  ELSE
    v_dest_type  := 'supplier';
    v_dest_value := v_actor_name;
  END IF;

  INSERT INTO public.trade_marketplace_ad_campaigns (
    slot_id, actor_id, booking_id, campaign_source,
    nombre, advertiser_name, estado, activa,
    destination_type, destination_value,
    target_type, target_id, target_label
  ) VALUES (
    v_slot_id, v_actor_id, p_booking_id, 'supplier',
    v_actor_name || ' — ' || COALESCE(v_target_label, 'Campaña publicitaria'),
    v_actor_name,
    'DRAFT', false,
    v_dest_type, v_dest_value,
    v_target_type, v_target_id, v_target_label
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_campaign_for_booking(uuid) TO authenticated;
;
