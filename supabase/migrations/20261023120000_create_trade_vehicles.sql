
-- ══════════════════════════════════════════════════════════════════════
-- TRANSPORT-CORE-1A/1B — Flota de vehículos + seguridad
-- ══════════════════════════════════════════════════════════════════════

-- ── Tabla de vehículos ────────────────────────────────────────────────
-- Soporta flota multimodal: viajeros, mercancías, reparto y uso mixto.
-- Un vehículo con plazas no implica autorización para transporte de viajeros:
-- la modalidad se declara explícitamente.

CREATE TABLE public.trade_vehicles (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  nombre             text        NOT NULL,
  matricula          text        NOT NULL,
  tipo               text        NOT NULL DEFAULT 'furgoneta'
                                 CHECK (tipo IN ('furgoneta','microbus','autocar','sedan','minivan',
                                                  'camion_rigido','cabeza_tractora','otro')),
  modalidad          text        NOT NULL DEFAULT 'viajeros'
                                 CHECK (modalidad IN ('viajeros','mercancias','reparto','mixto')),
  -- Nullable: solo obligatorio cuando modalidad = 'viajeros' | 'mixto'
  capacidad_viajeros int         CHECK (capacidad_viajeros IS NULL OR
                                        (capacidad_viajeros > 0 AND capacidad_viajeros <= 90)),
  -- Opcional: relevante para mercancías, reparto y mixto
  capacidad_carga_kg int         CHECK (capacidad_carga_kg IS NULL OR
                                        (capacidad_carga_kg > 0 AND capacidad_carga_kg <= 50000)),
  estado             text        NOT NULL DEFAULT 'disponible'
                                 CHECK (estado IN ('disponible','en_servicio','en_mantenimiento','baja')),
  marca              text,
  modelo_vehiculo    text,
  anno               int         CHECK (anno IS NULL OR (anno >= 1950 AND anno <= 2100)),
  color              text,
  notas              text,
  activo             boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, matricula)
);

CREATE INDEX idx_trade_vehicles_org      ON public.trade_vehicles(org_id, activo);
CREATE INDEX idx_trade_vehicles_estado   ON public.trade_vehicles(org_id, estado)   WHERE activo = true;
CREATE INDEX idx_trade_vehicles_modalidad ON public.trade_vehicles(org_id, modalidad) WHERE activo = true;

-- ── Extensión de trade_workers: identificar conductores ──────────────
-- Solo marca que un trabajador puede actuar como conductor.
-- TrabFlow no certifica habilitaciones; es solo informativo en MVP-T1.

ALTER TABLE public.trade_workers
  ADD COLUMN IF NOT EXISTS es_conductor boolean NOT NULL DEFAULT false;

-- ── Habilitación del módulo de transporte por organización ────────────
-- DEFAULT false: ninguna org lo ve hasta habilitación explícita por TrabFlow.

ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS transport_enabled boolean NOT NULL DEFAULT false;

-- ── Protección de transport_enabled ──────────────────────────────────
-- Bloquea cualquier cambio a transport_enabled por usuarios autenticados
-- o por el rol anon. Solo service_role (Studio) o postgres (acceso directo)
-- pueden modificarlo.
--
-- Por qué doble condición:
--   - auth.uid() IS NOT NULL → usuario autenticado (JWT presente).
--     Funciona TAMBIÉN dentro de funciones SECURITY DEFINER llamadas por
--     usuarios autenticados: los JWT claims son settings de sesión y siguen
--     accesibles desde cualquier contexto de ejecución.
--   - current_user = 'anon' → petición sin autenticar. auth.uid() IS NULL
--     igual que service_role, así que distinguir por rol es necesario.
--
-- Procedimiento autorizado para habilitar transporte en una org:
--   UPDATE public.trade_organizations
--   SET transport_enabled = true
--   WHERE id = '<org_id>';
-- Ejecutar desde Supabase Studio (service_role) o psql directo (postgres).

CREATE OR REPLACE FUNCTION public._protect_transport_enabled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.transport_enabled IS DISTINCT FROM OLD.transport_enabled THEN
    -- (a) JWT presente → usuario autenticado; (b) rol anon → sin autenticar
    IF auth.uid() IS NOT NULL OR current_user = 'anon' THEN
      RAISE EXCEPTION 'TRANSPORT_ENABLED_PROTECTED: solo el equipo de TrabFlow puede habilitar o deshabilitar el módulo de transporte';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._protect_transport_enabled() FROM anon, authenticated;

CREATE TRIGGER trg_protect_transport_enabled
  BEFORE UPDATE ON public.trade_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public._protect_transport_enabled();

-- ── RLS de vehículos ──────────────────────────────────────────────────

ALTER TABLE public.trade_vehicles ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la org (propietario + miembros invitados activos)
CREATE POLICY "vehicles_select" ON public.trade_vehicles
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- INSERT: propietario o miembro con rol admin
-- WITH CHECK previene insertar en una org donde el usuario no es owner/admin
CREATE POLICY "vehicles_insert" ON public.trade_vehicles
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

-- UPDATE: propietario o admin, solo sobre sus propios vehículos
-- USING: filtra qué filas puede tocar el usuario
-- WITH CHECK: la fila resultante también debe pertenecer a una org autorizada
--   → impide cambiar org_id a otra org (combinado con el trigger abajo)
CREATE POLICY "vehicles_update" ON public.trade_vehicles
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid()
          AND rol IN ('owner', 'admin')
          AND activo = true
    )
  )
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

-- DELETE: sin política → denegado para todos los usuarios autenticados.
-- La baja lógica se realiza mediante UPDATE activo=false.
-- El service_role puede eliminar si es necesario (mantenimiento BD).

-- ── Inmutabilidad de org_id en vehículos ─────────────────────────────
-- Impide mover un vehículo a otra organización cambiando org_id.
-- La política UPDATE ya lo dificulta, pero este trigger lo bloquea
-- de forma incondicional (incluido service_role si fuera necesario).

CREATE OR REPLACE FUNCTION public._prevent_vehicle_org_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.org_id IS DISTINCT FROM OLD.org_id THEN
    RAISE EXCEPTION 'VEHICLE_ORG_IMMUTABLE: no se puede cambiar la organización de un vehículo';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._prevent_vehicle_org_change() FROM anon, authenticated;

CREATE TRIGGER trg_vehicle_org_immutable
  BEFORE UPDATE ON public.trade_vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public._prevent_vehicle_org_change();
