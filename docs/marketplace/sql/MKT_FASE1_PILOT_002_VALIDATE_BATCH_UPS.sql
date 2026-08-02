-- ═══════════════════════════════════════════════════════════════════════════════
-- MKT-FASE1-PILOT-002 — C-004: Promoción draft → validated para los 16 UPs del lote
-- Fecha de diseño: 2026-08-01  v2 (aprobación con correcciones 2026-08-01)
-- Proyecto Supabase: dqqjaujnulutinskmqsu (eu-central-1)
-- Tipo: DML — NO EJECUTAR sin ejecutar y revisar el DRY RUN completo
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROPÓSITO
-- Cambiar validation_state = 'draft' → 'validated' exclusivamente para los 16 UPs
-- creados en MKT-FASE1-PILOT-001. Solo después de este paso son visibles en el
-- Marketplace y accesibles desde el Level 0 de create_cart_from_quote.
--
-- CONDICIONES MÚLTIPLES (todas obligatorias para cada UP):
--   especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
--   validation_state = 'draft'
--   category_id IS NOT NULL
--   origen = 'global_catalog'
--
-- REGISTROS ESPERADOS: exactamente 16 UPs
-- UPs preexistentes (PZ-FON-001 a PZ-FON-006): NO deben ser afectados
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- DRY RUN — Ejecutar primero, verificar TODOS los §DR con resultado esperado
-- Solo iniciar el bloque real si todos pasan
-- ─────────────────────────────────────────────────────────────────────────────

-- §DR-1: exactamente 16 UPs candidatos con todas las condiciones de seguridad
SELECT
  '§DR-1 candidatos' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 16
    THEN 'OK — 16 UPs candidatos confirmados'
    ELSE 'ERROR — se esperan 16, se encuentran ' || count(*) END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND validation_state = 'draft'
  AND category_id IS NOT NULL
  AND origen = 'global_catalog';

-- §DR-2: lista completa de candidatos con verificaciones individuales
SELECT
  up.id,
  up.nombre_canonico,
  up.validation_state,
  up.category_id,
  up.origen,
  c.nombre AS categoria_nombre,
  CASE WHEN c.id IS NULL THEN 'ERROR — categoría no encontrada' ELSE 'OK' END AS check_categoria
FROM public.trade_marketplace_universal_products up
LEFT JOIN public.trade_marketplace_categories c ON c.id = up.category_id
WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND up.validation_state = 'draft'
ORDER BY up.nombre_canonico;

-- §DR-3: 0 UPs del lote ya están validated (sin ejecuciones previas)
SELECT
  '§DR-3 validated_del_lote' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — ninguno validated aún'
    ELSE 'ERROR — ya hay ' || count(*) || ' UPs del lote en validated' END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND validation_state = 'validated';

-- §DR-4: los 6 UPs preexistentes validated no serán afectados
SELECT
  '§DR-4 preexistentes_validated' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 6
    THEN 'OK — 6 UPs preexistentes validated intactos'
    ELSE 'REVISAR — conteo inesperado: ' || count(*) END AS estado
FROM public.trade_marketplace_universal_products
WHERE validation_state = 'validated'
  AND (especificaciones->>'_batch' IS NULL
       OR especificaciones->>'_batch' <> 'MKT_FASE1_PILOT_001');

-- §DR-5: 0 UPs candidatos sin category_id
SELECT
  '§DR-5 sin_categoria' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — todos los candidatos tienen category_id'
    ELSE 'ERROR — ' || count(*) || ' UPs sin category_id' END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND validation_state = 'draft'
  AND category_id IS NULL;

-- §DR-6: variantes de los UPs candidatos con global_catalog_id (integridad gc)
SELECT
  '§DR-6 variantes_sin_gc_id' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — todas las variantes tienen global_catalog_id'
    ELSE 'ADVERTENCIA — ' || count(*) || ' variantes sin global_catalog_id' END AS estado
FROM public.trade_marketplace_universal_product_variants v
JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND v.global_catalog_id IS NULL;

-- §DR-7: exactamente 15 variantes activas en los UPs candidatos
SELECT
  '§DR-7 variantes_activas' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 15
    THEN 'OK — 15 variantes activas'
    ELSE 'REVISAR — se esperan 15, se encuentran ' || count(*) END AS estado
FROM public.trade_marketplace_universal_product_variants v
JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND v.activa = true;

-- §DR-8: 0 variantes huérfanas (sin UP padre en la tabla)
SELECT
  '§DR-8 variantes_huerfanas' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — cero variantes huérfanas'
    ELSE 'ERROR — ' || count(*) || ' variantes huérfanas detectadas' END AS estado
FROM public.trade_marketplace_universal_product_variants v
WHERE v.universal_product_id NOT IN (
  SELECT id FROM public.trade_marketplace_universal_products
);

-- §DR-9: 0 global_catalog_id duplicados entre variantes del lote
-- Un gc no puede estar linkeado a dos variantes distintas del mismo lote
SELECT
  '§DR-9 gc_duplicados_en_variantes' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — cero gc_id duplicados en variantes del lote'
    ELSE 'ERROR — ' || count(*) || ' global_catalog_id aparecen en múltiples variantes' END AS estado
FROM (
  SELECT v.global_catalog_id
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND v.global_catalog_id IS NOT NULL
  GROUP BY v.global_catalog_id
  HAVING count(*) > 1
) dup;

-- §DR-10: 0 UPs duplicados (nombre_canonico) dentro del lote
SELECT
  '§DR-10 up_duplicados_en_lote' AS seccion,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — cero nombres canónicos duplicados en el lote'
    ELSE 'ERROR — ' || count(*) || ' nombres duplicados detectados' END AS estado
FROM (
  SELECT nombre_canonico
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND validation_state = 'draft'
  GROUP BY nombre_canonico
  HAVING count(*) > 1
) dup;

-- §DR-11: integridad del lote — las 7 comprobaciones del post-COMMIT de PILOT-001
SELECT '§DR-11a sin_gc_duplicados' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ERROR' END AS estado
FROM (
  SELECT global_catalog_id FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND global_catalog_id IS NOT NULL
  UNION ALL
  SELECT v.global_catalog_id FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND v.global_catalog_id IS NOT NULL
) all_gc
WHERE global_catalog_id IN (
  SELECT global_catalog_id FROM (
    SELECT global_catalog_id FROM public.trade_marketplace_universal_products
    WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND global_catalog_id IS NOT NULL
    UNION ALL
    SELECT v.global_catalog_id FROM public.trade_marketplace_universal_product_variants v
    JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
    WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND v.global_catalog_id IS NOT NULL
  ) sub GROUP BY global_catalog_id HAVING count(*) > 1
);

SELECT '§DR-11b sin_category_nula' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ERROR' END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND category_id IS NULL;

SELECT '§DR-11c sin_variantes_huerfanas' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ERROR' END AS estado
FROM public.trade_marketplace_universal_product_variants v
JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND v.global_catalog_id NOT IN (SELECT id FROM public.trade_global_catalog);

SELECT '§DR-11d sin_nombre_duplicados' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ERROR' END AS estado
FROM (
  SELECT nombre_canonico, category_id
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  GROUP BY nombre_canonico, category_id
  HAVING count(*) > 1
) dup;

SELECT '§DR-11e origen_correcto' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'ERROR' END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND origen <> 'global_catalog';

SELECT '§DR-11f sin_ajenos_modificados' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0 THEN 'OK' ELSE 'REVISAR' END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' IS DISTINCT FROM 'MKT_FASE1_PILOT_001'
  AND updated_at > now() - interval '1 hour';  -- ajustar ventana según cuándo se ejecute

-- §DR-11g-1: gc directos del lote nuevo = exactamente 5
SELECT '§DR-11g-1 gc_directos_lote' AS check_name,
  count(DISTINCT global_catalog_id) AS n,
  CASE WHEN count(DISTINCT global_catalog_id) = 5
    THEN 'OK — 5 gc vinculados directamente a UPs del lote'
    ELSE 'ERROR — se esperan 5, encontrados ' || count(DISTINCT global_catalog_id) END AS estado
FROM public.trade_marketplace_universal_products
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND global_catalog_id IS NOT NULL;

-- §DR-11g-2: gc via variantes del lote nuevo = exactamente 15
SELECT '§DR-11g-2 gc_variantes_lote' AS check_name,
  count(DISTINCT v.global_catalog_id) AS n,
  CASE WHEN count(DISTINCT v.global_catalog_id) = 15
    THEN 'OK — 15 gc únicos vinculados mediante variantes del lote'
    ELSE 'ERROR — se esperan 15, encontrados ' || count(DISTINCT v.global_catalog_id) END AS estado
FROM public.trade_marketplace_universal_product_variants v
JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND v.global_catalog_id IS NOT NULL;

-- §DR-11g-3: gc únicos totales del lote nuevo = exactamente 20
SELECT '§DR-11g-3 gc_unicos_lote' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 20
    THEN 'OK — 20 gc únicos en el lote (5 directos + 15 variantes, sin solapamientos)'
    ELSE 'ERROR — se esperan 20, encontrados ' || count(*) END AS estado
FROM (
  SELECT global_catalog_id AS gc_id
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND global_catalog_id IS NOT NULL
  UNION
  SELECT v.global_catalog_id
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND v.global_catalog_id IS NOT NULL
) t;

-- §DR-11g-4: PZ-FON-001 (FON-GRF-LAV) cubierto = exactamente 1
SELECT '§DR-11g-4 pz_fon_001_cubierto' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 1
    THEN 'OK — PZ-FON-001 (FON-GRF-LAV) validated con gc_id correcto'
    ELSE 'ERROR — PZ-FON-001 no encontrado o duplicado: ' || count(*) END AS estado
FROM public.trade_marketplace_universal_products up
JOIN public.trade_global_catalog gc ON gc.id = up.global_catalog_id
WHERE gc.codigo = 'FON-GRF-LAV'
  AND up.validation_state = 'validated'
  AND (up.especificaciones->>'_batch' IS NULL
       OR up.especificaciones->>'_batch' <> 'MKT_FASE1_PILOT_001');

-- §DR-11g-5: gc únicos del piloto completo = exactamente 21 (20 lote + 1 PZ-FON-001)
SELECT '§DR-11g-5 gc_unicos_piloto_completo' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 21
    THEN 'OK — 21 gc únicos del piloto completo (20 lote nuevo + 1 PZ-FON-001)'
    ELSE 'ERROR — se esperan 21, encontrados ' || count(*) END AS estado
FROM (
  SELECT global_catalog_id AS gc_id
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND global_catalog_id IS NOT NULL
  UNION
  SELECT v.global_catalog_id
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND v.global_catalog_id IS NOT NULL
  UNION
  SELECT up.global_catalog_id
  FROM public.trade_marketplace_universal_products up
  JOIN public.trade_global_catalog gc ON gc.id = up.global_catalog_id
  WHERE gc.codigo = 'FON-GRF-LAV'
    AND up.validation_state = 'validated'
    AND (up.especificaciones->>'_batch' IS NULL
         OR up.especificaciones->>'_batch' <> 'MKT_FASE1_PILOT_001')
) t;

-- §DR-11g-6: intersección entre gc directos de UPs y gc de variantes del lote = 0
SELECT '§DR-11g-6 interseccion_up_var' AS check_name,
  count(*) AS n,
  CASE WHEN count(*) = 0
    THEN 'OK — 0 solapamientos entre gc directos de UPs y gc de variantes en el lote'
    ELSE 'ERROR — ' || count(*) || ' gc aparecen en ambos ámbitos' END AS estado
FROM (
  SELECT global_catalog_id
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND global_catalog_id IS NOT NULL
  INTERSECT
  SELECT v.global_catalog_id
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001' AND v.global_catalog_id IS NOT NULL
) overlap;

-- ─────────────────────────────────────────────────────────────────────────────
-- BLOQUE REAL
-- Solo ejecutar si TODOS los §DR pasan:
--   §DR-1: n=16
--   §DR-3: n=0
--   §DR-4: n=6
--   §DR-5: n=0
--   §DR-7: n=15
--   §DR-8: n=0
--   §DR-9: n=0
--   §DR-10: n=0
--   §DR-11a a §DR-11g: estado=OK en todos
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DO $$
DECLARE
  v_candidatos integer;
BEGIN
  SELECT count(*) INTO v_candidatos
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND validation_state = 'draft'
    AND category_id IS NOT NULL
    AND origen = 'global_catalog';

  IF v_candidatos <> 16 THEN
    RAISE EXCEPTION 'ABORT — se esperan 16 candidatos, encontrados: %. No se procede.', v_candidatos;
  END IF;

  RAISE NOTICE 'Pre-check OK — % UPs candidatos confirmados', v_candidatos;
END $$;

UPDATE public.trade_marketplace_universal_products
SET
  validation_state = 'validated',
  updated_at       = now()
WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
  AND validation_state = 'draft'
  AND category_id IS NOT NULL
  AND origen = 'global_catalog';

-- Post-validaciones
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND validation_state = 'validated';
  IF v_count <> 16 THEN
    RAISE EXCEPTION 'V-1 FAIL — esperados 16 validated, resultado: %', v_count;
  END IF;
  RAISE NOTICE 'V-1 OK — 16 UPs validated';

  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND validation_state = 'draft';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'V-2 FAIL — quedan % UPs del lote en draft', v_count;
  END IF;
  RAISE NOTICE 'V-2 OK — 0 UPs del lote en draft';

  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE validation_state = 'validated'
    AND (especificaciones->>'_batch' IS NULL
         OR especificaciones->>'_batch' <> 'MKT_FASE1_PILOT_001');
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'V-3 FAIL — UPs preexistentes validated: % (esperados: 6)', v_count;
  END IF;
  RAISE NOTICE 'V-3 OK — 6 UPs preexistentes validated intactos';

  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_product_variants v
  JOIN public.trade_marketplace_universal_products up ON up.id = v.universal_product_id
  WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
    AND v.activa = true;
  IF v_count <> 15 THEN
    RAISE EXCEPTION 'V-4 FAIL — variantes activas en el lote: % (esperadas: 15)', v_count;
  END IF;
  RAISE NOTICE 'V-4 OK — 15 variantes activas intactas';

  RAISE NOTICE '=== C-004 COMPLETADO — COMMIT AUTORIZADO ===';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK
-- Solo aplicable si ninguna offering ha sido linked operativamente a estos UPs
-- (match_state='matched'). Verificar antes de ejecutar.
-- ─────────────────────────────────────────────────────────────────────────────
--
-- -- Verificar ausencia de offerings linked:
-- SELECT count(*) FROM public.trade_marketplace_supplier_offerings o
-- JOIN public.trade_marketplace_universal_products up ON up.id = o.universal_product_id
-- WHERE up.especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
--   AND o.match_state = 'matched';
-- -- Resultado debe ser 0 para que el rollback sea seguro.
--
-- UPDATE public.trade_marketplace_universal_products
-- SET validation_state = 'draft', updated_at = now()
-- WHERE especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
--   AND validation_state = 'validated'
--   AND NOT EXISTS (
--     SELECT 1 FROM public.trade_marketplace_supplier_offerings o
--     WHERE o.universal_product_id = trade_marketplace_universal_products.id
--       AND o.match_state = 'matched'
--   );
