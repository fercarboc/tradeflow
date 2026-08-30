
-- ============================================================
-- RC1-C.8.E / E1 — Marketplace Advertising System
-- Spec: v3.1.1 aprobada 2026-08-15
-- ============================================================
-- INVARIANTE: publicidad NUNCA modifica ranking, precios, score,
-- comparador, ni recomendaciones del motor IA.
-- NO tocar: trade_marketplace_promotions, trade_marketplace_offering_promos
-- ============================================================
-- Schema audit 2026-08-15:
--   trade_marketplace_actor_members: actor_id uuid, user_id uuid, activo bool ✓
--   _mkt_actor_ids_for_user(p_type text DEFAULT NULL) → uuid[] SECURITY DEFINER ✓
--   _mkt_is_platform_admin() → boolean SECURITY DEFINER ✓
-- Discrepancia vs spec: _mkt_actor_ids_for_user tiene parámetro opcional p_type.
--   Impacto: ninguno. Se llama sin argumento (devuelve todos los actor_ids).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. TABLA: trade_marketplace_ad_slots
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_ad_slots (
  id                   text        PRIMARY KEY,
  nombre               text        NOT NULL,
  descripcion          text,
  pagina               text        NOT NULL
    CONSTRAINT chk_ad_slot_pagina
      CHECK (pagina IN ('home', 'catalog')),
  dispositivo          text        NOT NULL
    CONSTRAINT chk_ad_slot_dispositivo
      CHECK (dispositivo IN ('desktop', 'mobile', 'both')),
  formato              text        NOT NULL
    CONSTRAINT chk_ad_slot_formato
      CHECK (formato IN (
        'banner_vertical', 'carousel_slide',
        'mobile_promo', 'catalog_banner', 'promo_card'
      )),
  ancho_px             integer,
  alto_min_px          integer,
  aspect_ratio         text,
  activo               boolean     NOT NULL DEFAULT true,
  comercializable      boolean     NOT NULL DEFAULT true,
  posicion             integer     NOT NULL DEFAULT 0,
  metadata             jsonb       NOT NULL DEFAULT '{}',
  created_at           timestamptz NOT NULL DEFAULT now()
  -- fallback_campaign_id se añade tras crear ad_campaigns (circular FK)
);

-- ─────────────────────────────────────────────────────────────
-- 2. TABLA: trade_marketplace_ad_campaigns
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_ad_campaigns (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id          text        NOT NULL
    REFERENCES public.trade_marketplace_ad_slots(id) ON DELETE RESTRICT,
  actor_id         uuid
    REFERENCES public.trade_marketplace_actors(id) ON DELETE SET NULL,
  booking_id       uuid,       -- FK añadida tras crear ad_bookings
  campaign_source  text        NOT NULL DEFAULT 'demo'
    CONSTRAINT chk_campaign_source
      CHECK (campaign_source IN ('demo', 'trabflow', 'supplier')),
  estado           text        NOT NULL DEFAULT 'DRAFT'
    CONSTRAINT chk_campaign_estado
      CHECK (estado IN (
        'DRAFT','PENDING_APPROVAL','SCHEDULED',
        'ACTIVE','PAUSED','FINISHED','REJECTED'
      )),
  nombre           text        NOT NULL,
  advertiser_name  text        NOT NULL,
  eyebrow          text,
  title            text        NOT NULL,
  subtitle         text,
  cta_label        text        NOT NULL,
  destination_type text        NOT NULL
    CONSTRAINT chk_campaign_dest
      CHECK (destination_type IN ('catalog','category','supplier','search')),
  destination_value text,
  oficio           text,
  priority         integer     NOT NULL DEFAULT 10,
  activa           boolean     NOT NULL DEFAULT false,
  start_at         timestamptz,
  end_at           timestamptz,
  accent           text,
  bg               text,
  text_color       text,
  aprobada_por     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobada_at      timestamptz,
  rechazo_motivo   text,
  metadata         jsonb       NOT NULL DEFAULT '{}',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_campaign_dates
    CHECK (end_at IS NULL OR end_at > start_at)
);

CREATE INDEX idx_ad_campaigns_slot_active
  ON public.trade_marketplace_ad_campaigns(slot_id, activa, estado, start_at, end_at);

CREATE INDEX idx_ad_campaigns_actor
  ON public.trade_marketplace_ad_campaigns(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX idx_ad_campaigns_source_oficio
  ON public.trade_marketplace_ad_campaigns(campaign_source, oficio)
  WHERE activa = true AND estado = 'ACTIVE';

-- ─────────────────────────────────────────────────────────────
-- 3. TABLA: trade_marketplace_ad_bookings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_ad_bookings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      text        NOT NULL
    REFERENCES public.trade_marketplace_ad_slots(id) ON DELETE RESTRICT,
  actor_id     uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,
  estado       text        NOT NULL DEFAULT 'REQUESTED'
    CONSTRAINT chk_booking_estado
      CHECK (estado IN (
        'REQUESTED','RESERVED','CONFIRMED',
        'CANCELLED','EXPIRED'
      )),
  inicio       date        NOT NULL,
  fin          date        NOT NULL,
  origen       text        NOT NULL DEFAULT 'admin'
    CONSTRAINT chk_booking_origen
      CHECK (origen IN ('admin', 'portal_request')),
  notas        text,
  aprobado_por uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  aprobado_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_booking_dates CHECK (fin >= inicio)
);

CREATE INDEX idx_ad_bookings_slot_estado
  ON public.trade_marketplace_ad_bookings(slot_id, estado, inicio, fin);

-- FK circular: campaigns.booking_id → bookings
ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD CONSTRAINT fk_campaign_booking
    FOREIGN KEY (booking_id)
    REFERENCES public.trade_marketplace_ad_bookings(id)
    ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. TRIGGER: anti-solapamiento con advisory lock
--    pg_advisory_xact_lock serializa CONFIRMED/RESERVED del mismo slot.
--    Elimina race condition TOCTOU. Sin extensiones adicionales.
--    Lock se libera automáticamente al commit/rollback.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._check_booking_no_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado IN ('CONFIRMED', 'RESERVED') THEN
    -- Advisory lock por slot. Namespace 1000001 evita colisión con otros locks.
    PERFORM pg_advisory_xact_lock(1000001, hashtext(NEW.slot_id));

    IF EXISTS (
      SELECT 1 FROM public.trade_marketplace_ad_bookings b
      WHERE b.slot_id = NEW.slot_id
        AND b.id    != NEW.id
        AND b.estado IN ('CONFIRMED', 'RESERVED')
        AND b.inicio <= NEW.fin
        AND b.fin    >= NEW.inicio
    ) THEN
      RAISE EXCEPTION
        'Booking solapado: slot % ya tiene una reserva CONFIRMED/RESERVED en el período %–%',
        NEW.slot_id, NEW.inicio, NEW.fin
        USING ERRCODE = 'exclusion_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_booking_no_overlap
  BEFORE INSERT OR UPDATE ON public.trade_marketplace_ad_bookings
  FOR EACH ROW EXECUTE FUNCTION public._check_booking_no_overlap();

-- ─────────────────────────────────────────────────────────────
-- 5. TABLA: trade_marketplace_ad_creatives
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_ad_creatives (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid        NOT NULL
    REFERENCES public.trade_marketplace_ad_campaigns(id) ON DELETE CASCADE,
  image_url        text,
  mobile_image_url text,
  headline         text,
  body_text        text,
  cta_text         text,
  alt_text         text,
  generada_ia      boolean     NOT NULL DEFAULT false,
  ia_model         text,
  ia_prompt_ref    text,
  activa           boolean     NOT NULL DEFAULT false,
  aprobada_at      timestamptz,
  aprobada_por     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- FK circular: slots.fallback_campaign_id → campaigns
ALTER TABLE public.trade_marketplace_ad_slots
  ADD COLUMN IF NOT EXISTS
    fallback_campaign_id uuid
      REFERENCES public.trade_marketplace_ad_campaigns(id)
      ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- 6. RLS
--    Validado contra schema real:
--    _mkt_actor_ids_for_user() → uuid[] (llamada sin arg = todos los tipos)
--    _mkt_is_platform_admin()  → boolean
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_ad_slots      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_ad_campaigns  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_ad_bookings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_ad_creatives  ENABLE ROW LEVEL SECURITY;

-- Slots: lectura pública (catálogo de espacios). Escritura solo via RPC.
CREATE POLICY ad_slots_select_public
  ON public.trade_marketplace_ad_slots
  FOR SELECT USING (true);

-- Campaigns: activas públicas | proveedor ve las suyas | admin todo
CREATE POLICY ad_campaigns_select
  ON public.trade_marketplace_ad_campaigns
  FOR SELECT USING (
    (activa = true AND estado = 'ACTIVE')
    OR actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

-- Bookings: proveedor ve los suyos | admin todo
CREATE POLICY ad_bookings_select
  ON public.trade_marketplace_ad_bookings
  FOR SELECT USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

-- Creatives: visibles si la campaña es pública, propia o admin
CREATE POLICY ad_creatives_select
  ON public.trade_marketplace_ad_creatives
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM public.trade_marketplace_ad_campaigns
      WHERE activa = true AND estado = 'ACTIVE'
    )
    OR campaign_id IN (
      SELECT id FROM public.trade_marketplace_ad_campaigns
      WHERE actor_id = ANY(public._mkt_actor_ids_for_user())
    )
    OR public._mkt_is_platform_admin()
  );

-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_active_campaigns — v3.1.1 (4 tiers explícitos)
--    Tier 1 commercial siempre gana a trabflow, sin importar priority.
--    priority solo desempata DENTRO del mismo tier.
--    resolution_level incluido en respuesta (útil para analytics/debug).
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_campaigns(p_slot_ids text[])
RETURNS TABLE (
  slot_id           text,
  campaign_id       uuid,
  campaign_source   text,
  resolution_level  int,
  advertiser_name   text,
  eyebrow           text,
  title             text,
  subtitle          text,
  cta_label         text,
  destination_type  text,
  destination_value text,
  priority          integer,
  accent            text,
  bg                text,
  text_color        text,
  image_url         text,
  mobile_image_url  text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH ranked AS (
  SELECT
    c.slot_id,
    c.id,
    c.campaign_source,
    c.advertiser_name,
    c.eyebrow,
    c.title,
    c.subtitle,
    c.cta_label,
    c.destination_type,
    c.destination_value,
    c.priority,
    c.accent,
    c.bg,
    c.text_color,
    cr.image_url,
    cr.mobile_image_url,
    CASE
      WHEN c.campaign_source IN ('supplier', 'demo')               THEN 1
      WHEN s.fallback_campaign_id = c.id                           THEN 2
      WHEN c.campaign_source = 'trabflow' AND c.oficio IS NOT NULL THEN 3
      WHEN c.campaign_source = 'trabflow' AND c.oficio IS NULL     THEN 4
      ELSE 5
    END AS tier
  FROM public.trade_marketplace_ad_campaigns c
  JOIN public.trade_marketplace_ad_slots s ON s.id = c.slot_id
  LEFT JOIN public.trade_marketplace_ad_creatives cr
    ON cr.campaign_id = c.id AND cr.activa = true
  WHERE c.slot_id = ANY(p_slot_ids)
    AND c.activa  = true
    AND c.estado  = 'ACTIVE'
    AND (c.start_at IS NULL OR c.start_at <= now())
    AND (c.end_at   IS NULL OR c.end_at   >  now())
)
SELECT DISTINCT ON (slot_id)
  slot_id,
  id              AS campaign_id,
  campaign_source,
  tier            AS resolution_level,
  advertiser_name,
  eyebrow,
  title,
  subtitle,
  cta_label,
  destination_type,
  destination_value,
  priority,
  accent,
  bg,
  text_color,
  image_url,
  mobile_image_url
FROM ranked
ORDER BY slot_id, tier ASC, priority DESC, id
$$;

-- ─────────────────────────────────────────────────────────────
-- 8. SEEDS: 16 slots comerciales aprobados
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_ad_slots
  (id, nombre, pagina, dispositivo, formato, ancho_px, alto_min_px, comercializable, posicion)
VALUES
  ('MARKET_HOME_LEFT_TOP',      'Home lateral izq. superior',  'home',    'desktop', 'banner_vertical',  192, 220, true,  10),
  ('MARKET_HOME_LEFT_MID',      'Home lateral izq. medio',     'home',    'desktop', 'banner_vertical',  192, 220, true,  20),
  ('MARKET_HOME_LEFT_BOTTOM',   'Home lateral izq. inferior',  'home',    'desktop', 'banner_vertical',  192, 220, true,  30),
  ('MARKET_HOME_RIGHT_TOP',     'Home lateral der. superior',  'home',    'desktop', 'banner_vertical',  192, 220, true,  40),
  ('MARKET_HOME_RIGHT_MID',     'Home lateral der. medio',     'home',    'desktop', 'banner_vertical',  192, 220, true,  50),
  ('MARKET_HOME_RIGHT_BOTTOM',  'Home lateral der. inferior',  'home',    'desktop', 'banner_vertical',  192, 220, true,  60),
  ('MARKET_HOME_HERO_1',        'Hero slide comercial 1',      'home',    'both',    'carousel_slide',   null, 280, true,   1),
  ('MARKET_HOME_HERO_2',        'Hero slide comercial 2',      'home',    'both',    'carousel_slide',   null, 280, true,   2),
  ('MARKET_HOME_HERO_3',        'Hero slide comercial 3',      'home',    'both',    'carousel_slide',   null, 280, true,   3),
  ('MARKET_HOME_MOBILE_PROMO_1','Home promo mobile 1',         'home',    'mobile',  'mobile_promo',     null, null, true, 70),
  ('MARKET_HOME_MOBILE_PROMO_2','Home promo mobile 2',         'home',    'mobile',  'mobile_promo',     null, null, true, 80),
  ('MARKET_HOME_PROMO_CARD_1',  'Producto promocionado 1',     'home',    'both',    'promo_card',       null, null, true, 90),
  ('MARKET_HOME_PROMO_CARD_2',  'Producto promocionado 2',     'home',    'both',    'promo_card',       null, null, true, 91),
  ('MARKET_HOME_PROMO_CARD_3',  'Producto promocionado 3',     'home',    'both',    'promo_card',       null, null, true, 92),
  ('MARKET_HOME_PROMO_CARD_4',  'Producto promocionado 4',     'home',    'both',    'promo_card',       null, null, true, 93),
  ('MARKET_CATALOG_HERO',       'Banner catálogo',             'catalog', 'both',    'catalog_banner',   null, null, true, 100)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 9. SEEDS: 16 campañas fallback TrabFlow
--    campaign_source='trabflow', activa=true, estado='ACTIVE',
--    sin start_at/end_at (siempre activas). priority=0.
--    Sin marcas comerciales reales — contenido editorial TrabFlow.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_ad_campaigns
  (slot_id, campaign_source, estado, nombre, advertiser_name,
   title, subtitle, cta_label, destination_type, destination_value,
   oficio, priority, activa, accent, bg, text_color)
VALUES
  ('MARKET_HOME_LEFT_TOP',      'trabflow','ACTIVE','TW-FB-LT','TrabFlow',
   'Electricidad profesional','Cuadros, cable y automatismos','Ver electricidad',
   'category','electricidad','electricidad',0,true,
   '#F59E0B','linear-gradient(160deg,#1c1917 0%,#292524 80%,#1c1917 100%)','#ffffff'),

  ('MARKET_HOME_LEFT_MID',      'trabflow','ACTIVE','TW-FB-LM','TrabFlow',
   'Fontanería y saneamiento','Cobre, multicapa, PVC y valvulería','Ver fontanería',
   'category','fontaneria','fontaneria',0,true,
   '#22d3ee','linear-gradient(160deg,#082f49 0%,#0c4a6e 80%,#082f49 100%)','#ffffff'),

  ('MARKET_HOME_LEFT_BOTTOM',   'trabflow','ACTIVE','TW-FB-LB','TrabFlow',
   'Climatización y HVAC','Equipos, bombas de calor y accesorios','Ver climatización',
   'category','climatizacion','climatizacion',0,true,
   '#14b8a6','linear-gradient(160deg,#0f3430 0%,#134e4a 80%,#0f3430 100%)','#ffffff'),

  ('MARKET_HOME_RIGHT_TOP',     'trabflow','ACTIVE','TW-FB-RT','TrabFlow',
   'Materiales de fontanería','Tubería, accesorios y herramientas','Ver fontanería',
   'category','fontaneria','fontaneria',0,true,
   '#60a5fa','linear-gradient(160deg,#0f2044 0%,#1e3a5f 80%,#0f2044 100%)','#ffffff'),

  ('MARKET_HOME_RIGHT_MID',     'trabflow','ACTIVE','TW-FB-RM','TrabFlow',
   'Carpintería y madera','Tableros, molduras y tarima flotante','Ver materiales',
   'category','carpinteria','carpinteria',0,true,
   '#f59e0b','linear-gradient(160deg,#2a1a00 0%,#451a03 80%,#2a1a00 100%)','#ffffff'),

  ('MARKET_HOME_RIGHT_BOTTOM',  'trabflow','ACTIVE','TW-FB-RB','TrabFlow',
   'Pinturas profesionales','Imprimaciones, esmaltes y lacas técnicas','Ver pintura',
   'category','pintura','pintura',0,true,
   '#c084fc','linear-gradient(160deg,#2e1065 0%,#4c1d95 80%,#2e1065 100%)','#ffffff'),

  ('MARKET_HOME_HERO_1',        'trabflow','ACTIVE','TW-FB-H1','TrabFlow',
   'Instalación eléctrica de calidad','Cuadros y cable para profesionales','Explorar electricidad',
   'category','electricidad','electricidad',0,true,
   null,'linear-gradient(135deg,#78350f 0%,#d97706 100%)','#ffffff'),

  ('MARKET_HOME_HERO_2',        'trabflow','ACTIVE','TW-FB-H2','TrabFlow',
   'Fontanería desde catálogo','Compara precios entre distribuidores','Ver fontanería',
   'category','fontaneria','fontaneria',0,true,
   null,'linear-gradient(135deg,#1e40af 0%,#3b82f6 100%)','#ffffff'),

  ('MARKET_HOME_HERO_3',        'trabflow','ACTIVE','TW-FB-H3','TrabFlow',
   'Todo tu material en un lugar','Compara, pide y recibe sin salir de TrabFlow','Explorar catálogo',
   'catalog',null,null,0,true,
   null,'linear-gradient(135deg,#134e4a 0%,#14b8a6 100%)','#ffffff'),

  ('MARKET_HOME_MOBILE_PROMO_1','trabflow','ACTIVE','TW-FB-MP1','TrabFlow',
   'Material eléctrico disponible','Cuadros, cable y automatismos en stock','Ver electricidad',
   'category','electricidad','electricidad',0,true,
   '#F59E0B','linear-gradient(120deg,#1c1917 0%,#292524 100%)','#ffffff'),

  ('MARKET_HOME_MOBILE_PROMO_2','trabflow','ACTIVE','TW-FB-MP2','TrabFlow',
   'Fontanería en catálogo','Tubería y accesorios para instaladores','Ver fontanería',
   'category','fontaneria','fontaneria',0,true,
   '#60a5fa','linear-gradient(120deg,#0f2044 0%,#1e3a5f 100%)','#ffffff'),

  ('MARKET_HOME_PROMO_CARD_1',  'trabflow','ACTIVE','TW-FB-PC1','TrabFlow',
   'Electricidad profesional','Material de instalación en catálogo','Ver electricidad',
   'category','electricidad','electricidad',0,true,
   null,null,null),

  ('MARKET_HOME_PROMO_CARD_2',  'trabflow','ACTIVE','TW-FB-PC2','TrabFlow',
   'Fontanería y saneamiento','Distribuidores especializados','Ver fontanería',
   'category','fontaneria','fontaneria',0,true,
   null,null,null),

  ('MARKET_HOME_PROMO_CARD_3',  'trabflow','ACTIVE','TW-FB-PC3','TrabFlow',
   'Climatización HVAC','Equipos de climatización en catálogo','Ver climatización',
   'category','climatizacion','climatizacion',0,true,
   null,null,null),

  ('MARKET_HOME_PROMO_CARD_4',  'trabflow','ACTIVE','TW-FB-PC4','TrabFlow',
   'Más materiales','Carpintería, pintura y acabados','Explorar catálogo',
   'catalog',null,null,0,true,
   null,null,null),

  ('MARKET_CATALOG_HERO',       'trabflow','ACTIVE','TW-FB-CH','TrabFlow',
   'Compara precios entre distribuidores','Pedido directo desde TrabFlow sin llamadas','Explorar catálogo',
   'catalog',null,null,0,true,
   '#60a5fa','linear-gradient(90deg,#0f2044 0%,#1e3a5f 100%)','#ffffff')

ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 10. WIRING: conectar fallback_campaign_id en cada slot
--     Necesario para que la RPC detecte tier=2 via JOIN.
-- ─────────────────────────────────────────────────────────────
UPDATE public.trade_marketplace_ad_slots s
SET fallback_campaign_id = (
  SELECT c.id
  FROM public.trade_marketplace_ad_campaigns c
  WHERE c.slot_id = s.id
    AND c.campaign_source = 'trabflow'
  ORDER BY c.created_at
  LIMIT 1
)
WHERE s.fallback_campaign_id IS NULL;
;
