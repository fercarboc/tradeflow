-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSPORT-ROUTE-ADDRESS-1 — Direcciones completas, paradas ricas, contactos
-- ══════════════════════════════════════════════════════════════════════════════
-- Añade cuatro columnas JSONB/TEXT aditivas a trade_transport_services.
-- No modifica ni elimina ninguna columna existente.
-- Las columnas legacy origen/destino (text) se conservan intactas.
-- Los servicios existentes permanecen válidos: todas las columnas nuevas son NULL
-- por defecto y no están cubiertas por ninguna constraint existente.
--
-- Modelo JSONB:
--   origen_detalle / destino_detalle  → TransportLocation
--   contacto_principal                → TransportContact
--   instrucciones_conductor           → texto libre para el conductor
--
-- La columna "paradas" ya existe (JSONB); su esquema TypeScript se enriquece
-- con campos opcionales compatibles hacia atrás. El trigger _validate_transport_stops
-- solo verifica "nombre" y "hora" — los nuevos campos opcionales son ignorados.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_transport_services
  ADD COLUMN IF NOT EXISTS origen_detalle          jsonb,
  ADD COLUMN IF NOT EXISTS destino_detalle         jsonb,
  ADD COLUMN IF NOT EXISTS contacto_principal      jsonb,
  ADD COLUMN IF NOT EXISTS instrucciones_conductor text;
