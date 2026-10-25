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
--
-- SEGURIDAD DE NOMBRE:
--   El DROP usa un bloque DO que busca dinámicamente el nombre real de la
--   constraint por tabla + tipo CHECK + columna implicada. Esto protege contra
--   discrepancias de nombre entre entornos (dev, staging, prod).
-- ══════════════════════════════════════════════════════════════════════════════

-- Buscar y eliminar el CHECK constraint existente de tipo_servicio
-- (PostgreSQL lo autogenera como trade_transport_services_tipo_servicio_check,
-- pero el DO garantiza que funcione aunque el nombre difiera).
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.check_constraints cc
      ON tc.constraint_name = cc.constraint_name
   WHERE tc.table_schema    = 'public'
     AND tc.table_name      = 'trade_transport_services'
     AND tc.constraint_type = 'CHECK'
     AND cc.check_clause    ILIKE '%tipo_servicio%'
   LIMIT 1;

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.trade_transport_services DROP CONSTRAINT '
            || quote_ident(v_constraint_name);
  END IF;
END;
$$;

-- Añadir nueva constraint con los 13 valores (12 activos + 1 heredado)
ALTER TABLE public.trade_transport_services
  ADD CONSTRAINT trade_transport_services_tipo_servicio_check
    CHECK (tipo_servicio IN (
      -- Valores originales (5 activos conservados)
      'ruta_escolar',
      'excursion',
      'traslado_privado',
      'aeropuerto',
      'otro',
      -- Valor heredado: válido en DB, no visible en selector UI
      'traslado_empresa',
      -- Valores nuevos (7)
      'circuito',               -- Circuito turístico
      'viaje_multidia',         -- Viaje de varios días
      'transporte_trabajadores',-- Transporte de trabajadores
      'lanzadera',              -- Lanzadera / Shuttle
      'congreso_evento',        -- Congresos y eventos
      'servicio_deportivo',     -- Servicio deportivo
      'asociacion_grupo'        -- Asociaciones y grupos
    ));
