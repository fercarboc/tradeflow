-- ══════════════════════════════════════════════════════════════════════════════
-- TX-MC-GEO-1 — Columnas de geolocalización para viajes de mercancías
-- ══════════════════════════════════════════════════════════════════════════════
-- Añade origen_detalle y destino_detalle a trade_transport_trips.
-- Mismo contrato JSONB que en trade_transport_services (TransportLocation).
-- Campos opcionales: viajes históricos no tienen coordenadas.
-- Las coordenadas se escriben SOLO mediante RPC update_transport_trip_location
-- (ver migración 20261103110000): acceso directo a la columna está bloqueado
-- por RLS (rol authenticated no tiene UPDATE sobre estas columnas directamente).
--
-- SECUENCIA DE DESPLIEGUE OBLIGATORIA:
--   1. Esta migración (ADD COLUMN)
--   2. Migración 20261103110000 (RPC + permisos)
--   3. Deploy Edge Function route con parámetro profile (ya preparado localmente)
--   4. Frontend — sin cambios: ya maneja columnas null antes de migración
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_trips
  ADD COLUMN IF NOT EXISTS origen_detalle  jsonb,
  ADD COLUMN IF NOT EXISTS destino_detalle jsonb;

-- Índices GIN para consultas futuras sobre campos JSONB (geo_source, lat, lng)
CREATE INDEX IF NOT EXISTS idx_trips_origen_detalle
  ON public.trade_transport_trips USING gin (origen_detalle)
  WHERE origen_detalle IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trips_destino_detalle
  ON public.trade_transport_trips USING gin (destino_detalle)
  WHERE destino_detalle IS NOT NULL;

-- Restricción CHECK: si hay coordenadas deben ser válidas (no se fuerza su presencia)
ALTER TABLE public.trade_transport_trips
  ADD CONSTRAINT chk_trips_origen_lat_range CHECK (
    (origen_detalle ->> 'lat') IS NULL
    OR ((origen_detalle ->> 'lat')::float8 BETWEEN -90 AND 90)
  ),
  ADD CONSTRAINT chk_trips_origen_lng_range CHECK (
    (origen_detalle ->> 'lng') IS NULL
    OR ((origen_detalle ->> 'lng')::float8 BETWEEN -180 AND 180)
  ),
  ADD CONSTRAINT chk_trips_destino_lat_range CHECK (
    (destino_detalle ->> 'lat') IS NULL
    OR ((destino_detalle ->> 'lat')::float8 BETWEEN -90 AND 90)
  ),
  ADD CONSTRAINT chk_trips_destino_lng_range CHECK (
    (destino_detalle ->> 'lng') IS NULL
    OR ((destino_detalle ->> 'lng')::float8 BETWEEN -180 AND 180)
  );

-- ── Trigger de consistencia dirección/coordenadas ──────────────────────────────
-- Garantía DB-level: si el texto de origen/destino cambia, las coordenadas
-- almacenadas quedan invalidadas automáticamente, independientemente del cliente.
-- Protege contra:
--   · PostgREST PATCH que cambia origen/destino sin nullificar origen_detalle
--   · Escrituras desde clientes que no implementan la invalidación React
-- Preserva campos textuales del JSONB (nombre_lugar, calle, cp, etc.) porque son
-- útiles para display; solo elimina lat, lng y geo_source.
-- Elección: BEFORE UPDATE trigger — única capa que puede modificar el dato antes
-- de persistirse, sin coste extra en reads ni complejidad en el RPC.
--
-- Riesgo residual documentado: una llamada RPC de geocodificación en vuelo que
-- llegue DESPUÉS del cambio de texto puede restaurar coordenadas obsoletas.
-- Ventana típica: < 2 s (RTT de red). Mitigado por el flujo React que cancela
-- RPCs pendientes al detectar cambio de texto (setOrigenDetalle nullify inmediato).
CREATE OR REPLACE FUNCTION public._reset_trip_geo_on_text_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Si origen cambió: eliminar lat/lng/geo_source del JSONB preservando campos textuales
  IF NEW.origen IS DISTINCT FROM OLD.origen THEN
    NEW.origen_detalle := NEW.origen_detalle - 'lat' - 'lng' - 'geo_source';
    IF NEW.origen_detalle = '{}'::jsonb THEN
      NEW.origen_detalle := NULL;
    END IF;
  END IF;

  -- Si destino cambió: igual
  IF NEW.destino IS DISTINCT FROM OLD.destino THEN
    NEW.destino_detalle := NEW.destino_detalle - 'lat' - 'lng' - 'geo_source';
    IF NEW.destino_detalle = '{}'::jsonb THEN
      NEW.destino_detalle := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- WHEN clause: solo se dispara cuando origen o destino realmente cambian (optimización)
CREATE TRIGGER trg_ttt_geo_consistency
  BEFORE UPDATE ON public.trade_transport_trips
  FOR EACH ROW
  WHEN (OLD.origen IS DISTINCT FROM NEW.origen OR OLD.destino IS DISTINCT FROM NEW.destino)
  EXECUTE FUNCTION public._reset_trip_geo_on_text_change();
