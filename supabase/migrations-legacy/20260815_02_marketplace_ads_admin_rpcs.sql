-- ============================================================
-- RC1-C.8.E — E2: Políticas admin + RPCs para gestión publicidad
-- ============================================================
-- Añade políticas FOR ALL para plataforma admin en las 4 tablas
-- de publicidad. Las políticas SELECT de E1 siguen activas para
-- usuarios no-admin (anon / instaladores / proveedores).
--
-- El trigger anti-solapamiento _check_booking_no_overlap() sigue
-- ejecutándose incluso para admin INSERT/UPDATE — la protección
-- de concurrencia es invariante.
-- ============================================================

-- ── Políticas admin ALL (INSERT + UPDATE + DELETE + SELECT) ──
-- Las políticas SELECT existentes de E1 siguen para usuarios normales.
-- Estas añaden escritura para plataforma admin.

CREATE POLICY ad_slots_admin
  ON public.trade_marketplace_ad_slots
  FOR ALL
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

CREATE POLICY ad_campaigns_admin
  ON public.trade_marketplace_ad_campaigns
  FOR ALL
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

CREATE POLICY ad_bookings_admin
  ON public.trade_marketplace_ad_bookings
  FOR ALL
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

CREATE POLICY ad_creatives_admin
  ON public.trade_marketplace_ad_creatives
  FOR ALL
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ── KPI Dashboard ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_ads_dashboard()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH
  slot_stats AS (
    SELECT
      count(*)                                                         AS total,
      count(*) FILTER (WHERE comercializable AND activo)              AS comerciales,
      count(*) FILTER (WHERE fallback_campaign_id IS NULL AND activo) AS sin_fallback
    FROM public.trade_marketplace_ad_slots
  ),
  campaign_stats AS (
    SELECT
      count(*) FILTER (
        WHERE estado = 'ACTIVE' AND activa
          AND (start_at IS NULL OR start_at <= now())
          AND (end_at   IS NULL OR end_at   >  now())
      ) AS activas,
      count(*) FILTER (WHERE estado = 'SCHEDULED')                    AS programadas,
      count(*) FILTER (WHERE estado IN ('DRAFT','PENDING_APPROVAL'))  AS pendientes_aprobacion,
      count(*) FILTER (
        WHERE estado = 'ACTIVE' AND activa
          AND start_at IS NOT NULL AND start_at > now()
      ) AS proximas_inicio,
      count(*) FILTER (
        WHERE estado = 'ACTIVE' AND activa
          AND end_at IS NOT NULL AND end_at > now()
          AND end_at <= now() + interval '7 days'
      ) AS terminan_pronto
    FROM public.trade_marketplace_ad_campaigns
  ),
  booking_stats AS (
    SELECT
      count(*) FILTER (WHERE estado = 'REQUESTED')                                         AS pendientes,
      count(*) FILTER (WHERE estado = 'CONFIRMED' AND inicio <= current_date AND fin >= current_date) AS activas,
      count(*) FILTER (WHERE estado IN ('RESERVED','CONFIRMED') AND inicio > current_date) AS proximas
    FROM public.trade_marketplace_ad_bookings
  ),
  slots_occupied AS (
    SELECT count(DISTINCT slot_id) AS ocupados
    FROM public.trade_marketplace_ad_bookings
    WHERE estado IN ('RESERVED','CONFIRMED')
      AND inicio <= current_date AND fin >= current_date
  )
SELECT jsonb_build_object(
  'slots_total',                   s.total,
  'slots_comerciales',             s.comerciales,
  'slots_sin_fallback',            s.sin_fallback,
  'slots_ocupados',                o.ocupados,
  'slots_libres',                  GREATEST(0, s.comerciales::int - o.ocupados::int),
  'campanas_activas',              c.activas,
  'campanas_programadas',          c.programadas,
  'campanas_pendientes_aprobacion',c.pendientes_aprobacion,
  'campanas_proximas_inicio',      c.proximas_inicio,
  'campanas_terminan_pronto',      c.terminan_pronto,
  'reservas_pendientes',           b.pendientes,
  'reservas_activas',              b.activas,
  'reservas_proximas',             b.proximas
)
FROM slot_stats s, campaign_stats c, booking_stats b, slots_occupied o
$$;

-- ── Disponibilidad de slot para rango de fechas ────────────────
-- Devuelve true si el slot está disponible para el período.
-- Excluye la propia reserva (para edición).
CREATE OR REPLACE FUNCTION public.admin_check_slot_availability(
  p_slot_id            text,
  p_inicio             date,
  p_fin                date,
  p_exclude_booking_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
SELECT NOT EXISTS (
  SELECT 1
  FROM public.trade_marketplace_ad_bookings b
  WHERE b.slot_id = p_slot_id
    AND b.estado IN ('RESERVED', 'CONFIRMED')
    AND b.inicio <= p_fin
    AND b.fin   >= p_inicio
    AND (p_exclude_booking_id IS NULL OR b.id != p_exclude_booking_id)
)
$$;
