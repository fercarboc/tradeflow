
-- Extender trade_workers con campos del módulo de rutas
ALTER TABLE trade_workers
  ADD COLUMN IF NOT EXISTS especialidades        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS home_lat              NUMERIC,
  ADD COLUMN IF NOT EXISTS home_lng              NUMERIC,
  ADD COLUMN IF NOT EXISTS max_trabajos_dia      INTEGER DEFAULT 6,
  ADD COLUMN IF NOT EXISTS buffer_desplazamiento_min INTEGER DEFAULT 15,
  ADD COLUMN IF NOT EXISTS tiene_vehiculo        BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS zona_operacion        TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS avatar_url            TEXT,
  ADD COLUMN IF NOT EXISTS estado_actual         TEXT DEFAULT 'disponible',
  ADD COLUMN IF NOT EXISTS horario_inicio        TIME DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS horario_fin           TIME DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS notas                 TEXT;

-- Tabla de horarios semanales del trabajador
CREATE TABLE IF NOT EXISTS trade_worker_schedules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID NOT NULL REFERENCES trade_workers(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  dia_semana   INTEGER NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  activo       BOOLEAN DEFAULT true,
  hora_inicio  TIME DEFAULT '08:00',
  hora_fin     TIME DEFAULT '18:00',
  descanso_inicio TIME,
  descanso_fin    TIME,
  UNIQUE(worker_id, dia_semana)
);

-- Tabla de excepciones/vacaciones del trabajador
CREATE TABLE IF NOT EXISTS trade_worker_exceptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id    UUID NOT NULL REFERENCES trade_workers(id) ON DELETE CASCADE,
  org_id       UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  fecha_inicio DATE NOT NULL,
  fecha_fin    DATE NOT NULL,
  tipo         TEXT DEFAULT 'vacaciones',
  motivo       TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Tabla de rutas diarias
CREATE TABLE IF NOT EXISTS trade_routes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  worker_id            UUID NOT NULL REFERENCES trade_workers(id) ON DELETE CASCADE,
  fecha                DATE NOT NULL,
  estado               TEXT DEFAULT 'borrador',
  punto_inicio_lat     NUMERIC,
  punto_inicio_lng     NUMERIC,
  distancia_total_km   NUMERIC,
  duracion_total_min   INTEGER,
  hora_inicio_estimada TIME,
  hora_fin_estimada    TIME,
  optimization_score   NUMERIC,
  notas                TEXT,
  created_by           UUID,
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, fecha)
);

-- Tabla de paradas de ruta
CREATE TABLE IF NOT EXISTS trade_route_stops (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id                    UUID NOT NULL REFERENCES trade_routes(id) ON DELETE CASCADE,
  job_id                      UUID NOT NULL REFERENCES trade_jobs(id) ON DELETE CASCADE,
  orden                       INTEGER NOT NULL DEFAULT 0,
  hora_llegada_estimada       TIME,
  hora_salida_estimada        TIME,
  hora_llegada_real           TIMESTAMPTZ,
  hora_salida_real            TIMESTAMPTZ,
  tiempo_viaje_siguiente_min  INTEGER,
  distancia_siguiente_km      NUMERIC,
  estado                      TEXT DEFAULT 'pendiente',
  created_at                  TIMESTAMPTZ DEFAULT now()
);

-- Caché de distancias entre puntos
CREATE TABLE IF NOT EXISTS trade_distance_cache (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat   NUMERIC NOT NULL,
  origin_lng   NUMERIC NOT NULL,
  dest_lat     NUMERIC NOT NULL,
  dest_lng     NUMERIC NOT NULL,
  modo         TEXT DEFAULT 'driving',
  duration_min NUMERIC NOT NULL,
  distance_km  NUMERIC NOT NULL,
  cached_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distance_cache ON trade_distance_cache(origin_lat, origin_lng, dest_lat, dest_lng);
CREATE INDEX IF NOT EXISTS idx_routes_fecha ON trade_routes(fecha, org_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON trade_route_stops(route_id, orden);

-- Añadir campos de ventana horaria y duración a trade_jobs
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS ventana_inicio       TIME,
  ADD COLUMN IF NOT EXISTS ventana_fin          TIME,
  ADD COLUMN IF NOT EXISTS duracion_estimada_min INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS notas_trabajador     TEXT,
  ADD COLUMN IF NOT EXISTS started_at          TIMESTAMPTZ;

-- RLS básico para nuevas tablas
ALTER TABLE trade_worker_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_worker_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_route_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "worker_schedules_org" ON trade_worker_schedules;
CREATE POLICY "worker_schedules_org" ON trade_worker_schedules
  USING (org_id IN (
    SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    UNION SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "worker_exceptions_org" ON trade_worker_exceptions;
CREATE POLICY "worker_exceptions_org" ON trade_worker_exceptions
  USING (org_id IN (
    SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    UNION SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "routes_org" ON trade_routes;
CREATE POLICY "routes_org" ON trade_routes
  USING (org_id IN (
    SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
    UNION SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "route_stops_org" ON trade_route_stops;
CREATE POLICY "route_stops_org" ON trade_route_stops
  USING (route_id IN (
    SELECT id FROM trade_routes WHERE org_id IN (
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
      UNION SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  ));
;
