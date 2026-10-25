-- ══════════════════════════════════════════════════════════════════════════════
-- TRANSPORT-SERVICE-CATALOG-1 — Ampliación catálogo tipo_servicio
-- ══════════════════════════════════════════════════════════════════════════════
-- Extiende el CHECK constraint de tipo_servicio de 6 valores a 12 valores
-- comerciales + 1 valor heredado (traslado_empresa) para compatibilidad con
-- registros existentes.
--
-- INVARIANTES:
--   · No se modifica ningún servicio existente (sin UPDATE, sin DELETE).
--   · traslado_empresa se mantiene como valor válido en DB aunque no aparezca
--     en el selector de UI. Los registros históricos siguen siendo coherentes.
--   · Los nuevos valores son estables, sin tildes ni caracteres especiales.
--   · internacional queda como atributo futuro del recorrido, no tipo comercial.
-- ══════════════════════════════════════════════════════════════════════════════

-- La constraint original fue definida inline (sin nombre explícito).
-- PostgreSQL la nombra automáticamente: {tabla}_{columna}_check.
ALTER TABLE public.trade_transport_services
  DROP CONSTRAINT IF EXISTS trade_transport_services_tipo_servicio_check;

ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT trade_transport_services_tipo_servicio_check
    CHECK (tipo_servicio IN (
      -- Valores originales (6)
      'ruta_escolar',
      'excursion',
      'traslado_empresa',       -- heredado; válido en DB, oculto en selector UI
      'traslado_privado',
      'aeropuerto',
      'otro',
      -- Valores nuevos (6)
      'circuito',               -- Circuito turístico
      'viaje_multidia',         -- Viaje de varios días
      'transporte_trabajadores',-- Transporte de trabajadores
      'lanzadera',              -- Lanzadera / Shuttle
      'congreso_evento',        -- Congresos y eventos
      'servicio_deportivo',     -- Servicio deportivo
      'asociacion_grupo'        -- Asociaciones y grupos
    ));
