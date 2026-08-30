-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3 — Supplier Campaign & Creative Submission Model
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_marketplace_ad_creatives
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT chk_creative_estado
      CHECK (estado IN ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED')),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

CREATE OR REPLACE FUNCTION public.ensure_campaign_for_booking(
  p_booking_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_slot_id     text;
  v_booking_est text;
  v_actor_name  text;
  v_campaign_id uuid;
BEGIN
  SELECT actor_id, slot_id, estado::text
  INTO   v_actor_id, v_slot_id, v_booking_est
  FROM   public.trade_marketplace_ad_bookings
  WHERE  id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found: %', p_booking_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_booking_est NOT IN ('RESERVED', 'CONFIRMED') THEN
    RAISE EXCEPTION 'La reserva debe estar en estado RESERVED o CONFIRMED para preparar una creatividad (estado actual: %)', v_booking_est;
  END IF;

  SELECT id INTO v_campaign_id
  FROM   public.trade_marketplace_ad_campaigns
  WHERE  booking_id = p_booking_id
  LIMIT  1;

  IF FOUND THEN
    RETURN v_campaign_id;
  END IF;

  SELECT COALESCE(nombre, 'Anunciante')
  INTO   v_actor_name
  FROM   public.trade_marketplace_actors
  WHERE  id = v_actor_id;

  INSERT INTO public.trade_marketplace_ad_campaigns (
    slot_id, actor_id, booking_id, campaign_source, estado,
    nombre, advertiser_name, title, cta_label, destination_type
  )
  VALUES (
    v_slot_id,
    v_actor_id,
    p_booking_id,
    'supplier',
    'DRAFT',
    'Mi campaña publicitaria',
    v_actor_name,
    'Conoce nuestra oferta',
    'Ver más',
    'supplier'
  )
  RETURNING id INTO v_campaign_id;

  RETURN v_campaign_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_campaign_for_booking(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_ad_creative_for_review(
  p_creative_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id    uuid;
  v_creative_est text;
BEGIN
  SELECT c.actor_id, cr.estado::text
  INTO   v_actor_id, v_creative_est
  FROM   public.trade_marketplace_ad_creatives cr
  JOIN   public.trade_marketplace_ad_campaigns  c ON c.id = cr.campaign_id
  WHERE  cr.id = p_creative_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Creatividad no encontrada: %', p_creative_id;
  END IF;

  IF NOT public._is_actor_member(v_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF v_creative_est <> 'DRAFT' THEN
    RAISE EXCEPTION 'Solo se pueden enviar creatividades en estado DRAFT (estado actual: %)', v_creative_est;
  END IF;

  UPDATE public.trade_marketplace_ad_creatives
  SET    estado       = 'PENDING_APPROVAL',
         submitted_at = now(),
         updated_at   = now()
  WHERE  id = p_creative_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_ad_creative_for_review(uuid) TO authenticated;

CREATE POLICY "ad_creatives_supplier_insert"
ON public.trade_marketplace_ad_creatives
FOR INSERT TO authenticated
WITH CHECK (
  estado = 'DRAFT'
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
      AND  estado   = 'DRAFT'
  )
);

CREATE POLICY "ad_creatives_supplier_update"
ON public.trade_marketplace_ad_creatives
FOR UPDATE TO authenticated
USING (
  estado     = 'DRAFT'
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
)
WITH CHECK (
  estado     = 'DRAFT'
  AND campaign_id IN (
    SELECT id
    FROM   public.trade_marketplace_ad_campaigns
    WHERE  actor_id = ANY(public._mkt_actor_ids_for_user())
  )
);

CREATE POLICY "mkt_off_ads_supplier_creative_insert"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'marketplace-offerings'
  AND name ~ '^ads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/]+$'
  AND (split_part(name, '/', 2))::uuid = ANY(public._mkt_actor_ids_for_user())
  AND (split_part(name, '/', 3))::uuid IN (
    SELECT c.id
    FROM   public.trade_marketplace_ad_campaigns c
    JOIN   public.trade_marketplace_ad_bookings  b ON b.id = c.booking_id
    WHERE  c.actor_id   = (split_part(name, '/', 2))::uuid
      AND  c.estado     = 'DRAFT'
      AND  b.estado     IN ('RESERVED', 'CONFIRMED')
  )
);

REVOKE SELECT ON public.trade_marketplace_ad_campaigns FROM authenticated;

GRANT SELECT (
  id, slot_id, actor_id, booking_id, campaign_source, estado,
  nombre, advertiser_name, eyebrow, title, subtitle, cta_label,
  destination_type, destination_value, oficio, priority, activa,
  start_at, end_at, accent, bg, text_color, metadata,
  image_url, mobile_image_url, created_at, updated_at
) ON public.trade_marketplace_ad_campaigns TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_ad_campaigns()
RETURNS TABLE (
  id               uuid,
  slot_id          text,
  actor_id         uuid,
  booking_id       uuid,
  campaign_source  text,
  estado           text,
  nombre           text,
  advertiser_name  text,
  eyebrow          text,
  title            text,
  subtitle         text,
  cta_label        text,
  destination_type text,
  destination_value text,
  oficio           text,
  priority         int,
  activa           boolean,
  start_at         timestamptz,
  end_at           timestamptz,
  accent           text,
  bg               text,
  text_color       text,
  aprobada_por     uuid,
  aprobada_at      timestamptz,
  rechazo_motivo   text,
  metadata         jsonb,
  image_url        text,
  mobile_image_url text,
  created_at       timestamptz,
  updated_at       timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, slot_id, actor_id, booking_id,
    campaign_source::text, estado::text,
    nombre, advertiser_name, eyebrow, title, subtitle, cta_label,
    destination_type::text, destination_value, oficio,
    priority, activa, start_at, end_at,
    accent, bg, text_color,
    aprobada_por, aprobada_at, rechazo_motivo,
    metadata, image_url, mobile_image_url,
    created_at, updated_at
  FROM public.trade_marketplace_ad_campaigns
  WHERE public._mkt_is_platform_admin()
  ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ad_campaigns() TO authenticated;

REVOKE SELECT ON public.trade_marketplace_ad_creatives FROM authenticated;

GRANT SELECT (
  id, campaign_id,
  image_url, mobile_image_url,
  headline, body_text, cta_text, alt_text,
  generada_ia, activa,
  creative_mode, text_position, overlay_strength,
  price_display, old_price_display, discount_label,
  theme_preset,
  estado, submitted_at,
  created_at, updated_at
) ON public.trade_marketplace_ad_creatives TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_ad_creatives()
RETURNS TABLE (
  id               uuid,
  campaign_id      uuid,
  image_url        text,
  mobile_image_url text,
  headline         text,
  body_text        text,
  cta_text         text,
  alt_text         text,
  generada_ia      boolean,
  activa           boolean,
  aprobada_at      timestamptz,
  aprobada_por     uuid,
  creative_mode    text,
  text_position    text,
  overlay_strength int,
  price_display    numeric,
  old_price_display numeric,
  discount_label   text,
  theme_preset     text,
  estado           text,
  submitted_at     timestamptz,
  created_at       timestamptz,
  updated_at       timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id, campaign_id,
    image_url, mobile_image_url,
    headline, body_text, cta_text, alt_text,
    generada_ia, activa,
    aprobada_at, aprobada_por,
    creative_mode::text, text_position::text, overlay_strength,
    price_display, old_price_display, discount_label,
    theme_preset::text,
    estado::text, submitted_at,
    created_at, updated_at
  FROM public.trade_marketplace_ad_creatives
  WHERE public._mkt_is_platform_admin()
  ORDER BY submitted_at DESC NULLS LAST, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_ad_creatives() TO authenticated;
;
