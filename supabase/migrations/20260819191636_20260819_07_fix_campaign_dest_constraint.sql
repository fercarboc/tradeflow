-- ═══════════════════════════════════════════════════════════════════════════
-- 20260819_07 — Fix chk_campaign_dest + ensure_campaign_for_booking mapping
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_marketplace_ad_campaigns
  DROP CONSTRAINT IF EXISTS chk_campaign_dest;

ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD CONSTRAINT chk_campaign_dest
  CHECK (destination_type = ANY(ARRAY[
    'catalog'::text,
    'category'::text,
    'supplier'::text,
    'search'::text,
    'product'::text,
    'offer'::text,
    'trade'::text,
    'brand'::text,
    'offering'::text
  ]));

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
    v_dest_type := CASE v_target_type
      WHEN 'CATEGORY' THEN 'category'
      WHEN 'TRADE'    THEN 'trade'
      WHEN 'BRAND'    THEN 'brand'
      WHEN 'SUPPLIER' THEN 'supplier'
      WHEN 'PRODUCT'  THEN 'product'
      WHEN 'OFFERING' THEN 'offer'
      ELSE lower(v_target_type)
    END;
    v_dest_value := COALESCE(v_target_label, v_target_id::text);
  ELSE
    v_dest_type  := 'supplier';
    v_dest_value := v_actor_name;
  END IF;

  INSERT INTO public.trade_marketplace_ad_campaigns (
    slot_id, actor_id, booking_id, campaign_source,
    nombre, advertiser_name, title, cta_label, estado, activa,
    destination_type, destination_value,
    target_type, target_id, target_label
  ) VALUES (
    v_slot_id, v_actor_id, p_booking_id, 'supplier',
    v_actor_name || ' — ' || COALESCE(v_target_label, 'Campaña publicitaria'),
    v_actor_name,
    COALESCE(v_target_label, v_actor_name),
    'Ver más',
    'DRAFT', false,
    v_dest_type, v_dest_value,
    v_target_type, v_target_id, v_target_label
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_campaign_for_booking(uuid) TO authenticated;;
