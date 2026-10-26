-- ══════════════════════════════════════════════════════════════════════════════
-- GEO-DB-1 — Tablas de caché y cuotas para geocodificación y routing
-- ══════════════════════════════════════════════════════════════════════════════
-- Diseño:
--   trade_geo_rate    — rate limit global entre instancias Edge Function (1 fila/proveedor)
--   trade_geo_usage   — cuota diaria por organización
--   trade_geo_cache   — caché de resultados de geocodificación (TTL 180 días)
--   trade_route_cache — caché de geometrías de routing (TTL 30 días)
--
-- Ninguna tabla expone datos de ubicación de otras organizaciones.
-- El proveedor actual es Geoapify; las tablas son agnósticas de proveedor.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── trade_geo_rate ────────────────────────────────────────────────────────────
-- Una fila por proveedor. Las Edge Functions actualizan la fila atómicamente
-- mediante UPDATE con condición — sin transacción abierta durante llamadas HTTP.
-- Garantiza límite global a pesar de la naturaleza multi-instancia de las EF.

CREATE TABLE IF NOT EXISTS public.trade_geo_rate (
  provider           text     PRIMARY KEY,
  req_at             timestamptz,
  req_count          int      NOT NULL DEFAULT 0,
  -- Presupuesto diario global compartido por todas las organizaciones
  daily_global_limit int      NOT NULL DEFAULT 2000,   -- techo < 3 000 free tier Geoapify
  global_used_date   date,
  global_used_today  int      NOT NULL DEFAULT 0,
  -- Kill switch: desactiva geocodificación/routing sin borrar datos
  is_disabled        boolean  NOT NULL DEFAULT false,
  CHECK (req_count          >= 0),
  CHECK (daily_global_limit >= 1),
  CHECK (global_used_today  >= 0)
);

INSERT INTO public.trade_geo_rate (provider, req_at)
  VALUES ('geoapify', NULL)
  ON CONFLICT (provider) DO NOTHING;

-- ── trade_geo_usage ───────────────────────────────────────────────────────────
-- Cuota diaria por organización. Límite por defecto: 100 peticiones/día.
-- Configurable por admin (daily_limit).

CREATE TABLE IF NOT EXISTS public.trade_geo_usage (
  org_id      uuid  NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  date        date  NOT NULL DEFAULT CURRENT_DATE,
  req_count   int   NOT NULL DEFAULT 0,
  daily_limit int   NOT NULL DEFAULT 100,
  PRIMARY KEY (org_id, date),
  CHECK (req_count   >= 0),
  CHECK (daily_limit >= 1)
);

CREATE INDEX IF NOT EXISTS idx_geo_usage_date ON public.trade_geo_usage(date);

-- ── trade_geo_cache ───────────────────────────────────────────────────────────
-- Caché de resultados de geocodificación por organización.
-- address_hash = hash de la dirección normalizada (calculado en la EF).
-- TTL de 180 días: compatible con las condiciones actuales de Geoapify.
-- Aislamiento multitenant: la clave incluye org_id.

CREATE TABLE IF NOT EXISTS public.trade_geo_cache (
  org_id           uuid  NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  address_hash     text  NOT NULL,
  normalized_text  text  NOT NULL,
  candidates       jsonb NOT NULL,  -- [{lat, lng, display_name, confidence?}]
  provider         text  NOT NULL,
  cached_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, address_hash)
);

CREATE INDEX IF NOT EXISTS idx_geo_cache_cached_at ON public.trade_geo_cache(cached_at);

-- Limpieza automática de entradas caducadas (>180 días)
-- (ejecutar via pg_cron o mantenimiento manual)

-- ── trade_route_cache ─────────────────────────────────────────────────────────
-- Caché de geometrías de routing por hash de waypoints.
-- waypoint_hash = JSON stringificado de [[lat, lng], ...] en el orden exacto del recorrido.
-- Sin org_id: las geometrías de ruta no son datos privados de la organización.
-- TTL de 30 días: la infraestructura vial cambia lentamente.

CREATE TABLE IF NOT EXISTS public.trade_route_cache (
  waypoint_hash  text PRIMARY KEY,
  geometry       jsonb,           -- GeoJSON LineString; NULL mientras la petición está pendiente
  distance_m     int,
  duration_s     int,
  provider       text,
  cached_at      timestamptz NOT NULL DEFAULT now(),
  pending_at     timestamptz      -- TTL de dedup: NULL cuando hay resultado; se limpia al guardar
);

CREATE INDEX IF NOT EXISTS idx_route_cache_cached_at ON public.trade_route_cache(cached_at);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- trade_geo_rate y trade_route_cache: no accesibles directamente desde frontend
-- (solo las Edge Functions SECURITY DEFINER las leen/escriben).
ALTER TABLE public.trade_geo_rate    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_route_cache ENABLE ROW LEVEL SECURITY;
-- Sin políticas = denegado para todos los usuarios autenticados.

-- trade_geo_usage: solo los miembros pueden ver su propia cuota.
ALTER TABLE public.trade_geo_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_usage_select_own" ON public.trade_geo_usage
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- trade_geo_cache: los miembros pueden leer su caché (útil para diagnóstico futuro).
-- La escritura es solo a través de las Edge Functions SECURITY DEFINER.
ALTER TABLE public.trade_geo_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_cache_select_own" ON public.trade_geo_cache
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- ── trade_geo_reservations ────────────────────────────────────────────────────
-- Registro de cada reserva de créditos Geoapify (una por llamada al proveedor).
-- Garantiza idempotencia de geo_reconcile: la marca 'reconciled' impide un
-- segundo descuento del mismo crédito.  expires_at = 2 h; los créditos de
-- reservas caducadas no se liberan automáticamente — se absorben en el rollover
-- diario (comportamiento conservador documentado).

CREATE TABLE IF NOT EXISTS public.trade_geo_reservations (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  estimated      int         NOT NULL CHECK (estimated > 0),
  actual         int,
  status         text        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'reconciled', 'expired')),
  reserved_at    timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  reconciled_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_geo_reservations_status
  ON public.trade_geo_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_geo_reservations_org
  ON public.trade_geo_reservations(org_id, reserved_at DESC);

-- Solo accesible vía service role (Edge Functions)
ALTER TABLE public.trade_geo_reservations ENABLE ROW LEVEL SECURITY;

-- ── REVOKE acceso directo desde anon/authenticated ───────────────────────────
REVOKE ALL ON TABLE public.trade_geo_rate         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trade_route_cache      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.trade_geo_reservations FROM PUBLIC, anon, authenticated;
