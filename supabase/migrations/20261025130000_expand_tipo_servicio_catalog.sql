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

-- Buscar y eliminar el CHECK constraint existente de tipo_servicio.
-- Usa pg_constraint + pg_get_constraintdef (catálogo de sistema) en lugar de
-- information_schema para evitar falsos positivos y detectar ambigüedad.
-- Falla explícitamente si hay >1 candidato; verifica que la constraint original
-- contenga los valores conocidos antes de eliminarla.
DO $$
DECLARE
  v_constraint_name text;
  v_check_def       text;
  v_count           int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM pg_constraint c
    JOIN pg_class      r ON r.oid = c.conrelid
    JOIN pg_namespace  n ON n.oid = r.relnamespace
   WHERE n.nspname = 'public'
     AND r.relname = 'trade_transport_services'
     AND c.contype = 'c'
     AND pg_get_constraintdef(c.oid) LIKE '%tipo_servicio%';

  IF v_count > 1 THEN
    RAISE EXCEPTION
      'CATALOG_MIGRATION_AMBIGUOUS: % constraints CHECK contienen tipo_servicio en trade_transport_services. Revisar manualmente.',
      v_count;
  END IF;

  IF v_count = 1 THEN
    SELECT c.conname, pg_get_constraintdef(c.oid)
      INTO v_constraint_name, v_check_def
      FROM pg_constraint c
      JOIN pg_class      r ON r.oid = c.conrelid
      JOIN pg_namespace  n ON n.oid = r.relnamespace
     WHERE n.nspname = 'public'
       AND r.relname = 'trade_transport_services'
       AND c.contype = 'c'
       AND pg_get_constraintdef(c.oid) LIKE '%tipo_servicio%';

    IF v_check_def NOT LIKE '%ruta_escolar%' OR v_check_def NOT LIKE '%excursion%' THEN
      RAISE EXCEPTION
        'CATALOG_MIGRATION_UNEXPECTED: constraint (%) no contiene los valores originales esperados. Verificar manualmente.',
        v_constraint_name;
    END IF;

    EXECUTE 'ALTER TABLE public.trade_transport_services DROP CONSTRAINT '
            || quote_ident(v_constraint_name);
  END IF;
  -- v_count = 0: constraint no existe o ya fue eliminada; se continúa sin error.
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
