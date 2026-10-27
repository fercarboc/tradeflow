-- ══════════════════════════════════════════════════════════════════════════════
-- TX-FLEET-ODO-1 FASE B+C: Infraestructura unificada de kilometraje
-- ══════════════════════════════════════════════════════════════════════════════
-- Implementa:
--   1. Campos de odómetro en trade_transport_services
--   2. Tabla trade_vehicle_km_readings con reglas de validez
--   3. km_actual en trade_vehicles + trigger de sincronización
--   4. Restricciones de integridad, índices e idempotencia
--   5. RLS mínima
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Campos de odómetro e inicio real en servicios ──────────────────────────

ALTER TABLE public.trade_transport_services
  ADD COLUMN IF NOT EXISTS odometro_inicio     integer,
  ADD COLUMN IF NOT EXISTS odometro_final      integer,
  ADD COLUMN IF NOT EXISTS hora_inicio_real    timestamptz,
  ADD COLUMN IF NOT EXISTS iniciado_por        uuid,
  ADD COLUMN IF NOT EXISTS obs_inicio          text;

-- Columna generada: diferencia de odómetro (kms de carretera del viaje)
ALTER TABLE public.trade_transport_services
  ADD COLUMN IF NOT EXISTS odometro_recorridos integer
    GENERATED ALWAYS AS (
      CASE
        WHEN odometro_inicio IS NOT NULL AND odometro_final IS NOT NULL
             AND odometro_final >= odometro_inicio
        THEN odometro_final - odometro_inicio
        ELSE NULL
      END
    ) STORED;

-- Restricciones de integridad de odómetro
ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT tts_odo_inicio_no_negativo
    CHECK (odometro_inicio IS NULL OR odometro_inicio >= 0),
  ADD CONSTRAINT tts_odo_final_no_negativo
    CHECK (odometro_final IS NULL OR odometro_final >= 0);

-- ── 2. Tabla de lecturas de kilómetros ─────────────────────────────────────────
--
-- Cada fila representa una lectura del cuadro de mandos del vehículo.
-- Las filas son INMUTABLES: las correcciones son nuevas filas con corrige_id.
-- Una lectura es "válida" si ninguna otra lectura tiene corrige_id = este.id.
-- km_actual del vehículo = última lectura válida ordenada por leido_en DESC.

CREATE TABLE public.trade_vehicle_km_readings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid        NOT NULL,
  vehicle_id   uuid        NOT NULL,

  -- Tipo de lectura
  tipo         text        NOT NULL
               CHECK (tipo IN (
                 'inicio_servicio',  -- odómetro al inicio de un servicio
                 'final_servicio',   -- odómetro al final de un servicio
                 'manual',           -- entrada manual por admin/técnico
                 'sustitucion',      -- cambio físico del cuentakilómetros
                 'correccion'        -- rectificación de una lectura errónea
               )),

  -- Lectura del odómetro en km (entero; 0 permitido para vehículos nuevos)
  km           integer     NOT NULL CHECK (km >= 0),

  -- Cuándo se tomó la lectura (puede ser retroactivo); difiere de created_at
  leido_en     timestamptz NOT NULL DEFAULT now(),

  -- Vínculo opcional al servicio que generó esta lectura
  servicio_id  uuid        REFERENCES public.trade_transport_services(id) ON DELETE SET NULL,

  -- Fuente de la lectura
  fuente       text        NOT NULL DEFAULT 'rpc'
               CHECK (fuente IN ('rpc', 'manual', 'importacion')),

  notas        text,

  -- Puntero a la lectura que ésta corrige (INSERT-only corrections)
  corrige_id   uuid        REFERENCES public.trade_vehicle_km_readings(id),

  -- Auditoría
  created_by   uuid,       -- auth.uid() al momento de la inserción
  created_at   timestamptz NOT NULL DEFAULT now(),

  -- FK compuesta garantiza que vehicle_id pertenece a org_id (same-org)
  CONSTRAINT vkr_vehicle_org_fk
    FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id)
);

-- ── 3. Restricciones de idempotencia ──────────────────────────────────────────
--
-- Garantizan que los reintentos de start/complete no dupliquen lecturas.
-- Solo aplica a lecturas originales (corrige_id IS NULL).

CREATE UNIQUE INDEX uq_vkr_svc_inicio
  ON public.trade_vehicle_km_readings (vehicle_id, servicio_id)
  WHERE tipo = 'inicio_servicio' AND corrige_id IS NULL AND servicio_id IS NOT NULL;

CREATE UNIQUE INDEX uq_vkr_svc_final
  ON public.trade_vehicle_km_readings (vehicle_id, servicio_id)
  WHERE tipo = 'final_servicio' AND corrige_id IS NULL AND servicio_id IS NOT NULL;

-- Una lectura solo puede ser corregida una vez
CREATE UNIQUE INDEX uq_vkr_correccion
  ON public.trade_vehicle_km_readings (corrige_id)
  WHERE corrige_id IS NOT NULL;

-- ── 4. Índices de consulta ─────────────────────────────────────────────────────

-- Historial por vehículo, ordenado por lectura más reciente primero
CREATE INDEX idx_vkr_vehicle_leido
  ON public.trade_vehicle_km_readings (vehicle_id, leido_en DESC);

-- Lecturas vinculadas a un servicio
CREATE INDEX idx_vkr_servicio
  ON public.trade_vehicle_km_readings (servicio_id)
  WHERE servicio_id IS NOT NULL;

-- Acceso rápido a lecturas que corrigen a otra
CREATE INDEX idx_vkr_corrige
  ON public.trade_vehicle_km_readings (corrige_id)
  WHERE corrige_id IS NOT NULL;

-- ── 5. RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_vehicle_km_readings ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los miembros activos de la org
CREATE POLICY "vkr_select_org_members"
  ON public.trade_vehicle_km_readings
  FOR SELECT TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.trade_org_members
       WHERE user_id = auth.uid() AND activo = true
      UNION
      SELECT id FROM public.trade_organizations
       WHERE owner_id = auth.uid()
    )
  );

-- INSERT: solo owner/admin (las RPC usan SECURITY DEFINER; acceso directo restringido)
CREATE POLICY "vkr_insert_owner_admin"
  ON public.trade_vehicle_km_readings
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
       WHERE user_id = auth.uid()
         AND rol IN ('owner', 'admin')
         AND activo = true
    )
  );

-- ── 6. km_actual en vehículos ──────────────────────────────────────────────────

ALTER TABLE public.trade_vehicles
  ADD COLUMN IF NOT EXISTS km_actual          integer,
  ADD COLUMN IF NOT EXISTS km_actualizado_at  timestamptz;

-- ── 7. Trigger: sincronizar km_actual tras cada inserción ──────────────────────
--
-- Calcula el km_actual como la ÚLTIMA LECTURA VÁLIDA ordenada por leido_en DESC.
-- Una lectura es "anulada" si existe otra con corrige_id = esta.id.
-- Esto es correcto incluso con lecturas desordenadas (retroactivas) o sustituciones.

CREATE OR REPLACE FUNCTION public._sync_vehicle_km_actual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_km_actual integer;
  v_leido_en  timestamptz;
BEGIN
  -- Última lectura válida (no anulada) para este vehículo
  SELECT r.km, r.leido_en
    INTO v_km_actual, v_leido_en
    FROM public.trade_vehicle_km_readings r
   WHERE r.vehicle_id = NEW.vehicle_id
     -- Excluir lecturas anuladas (otra lectura las corrige)
     AND NOT EXISTS (
       SELECT 1
         FROM public.trade_vehicle_km_readings c
        WHERE c.corrige_id = r.id
     )
   ORDER BY r.leido_en DESC, r.created_at DESC
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.trade_vehicles
       SET km_actual         = v_km_actual,
           km_actualizado_at = v_leido_en
     WHERE id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._sync_vehicle_km_actual() FROM PUBLIC;

CREATE TRIGGER trg_vkr_sync_km_actual
  AFTER INSERT ON public.trade_vehicle_km_readings
  FOR EACH ROW EXECUTE FUNCTION public._sync_vehicle_km_actual();

-- ── 8. NOTIFY pgrst: recargar schema cache ────────────────────────────────────
NOTIFY pgrst, 'reload schema';
