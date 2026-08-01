-- =====================================================================
-- MKT-FASE1-PILOT-001 v3  —  ROLLBACK DML
-- =====================================================================
-- Usar ÚNICAMENTE si MKT_FASE1_PILOT_001_v3.sql fue ejecutado y se
-- necesita revertir el DML. El DDL (columna global_catalog_id) permanece
-- intacto tras este rollback; para revertirlo también ejecutar
-- MKT_FASE1_PILOT_001_DDL_ROLLBACK.sql DESPUÉS de este script.
--
-- Transacción única: BEGIN … COMMIT
-- Verificación post-rollback: bloque independiente tras COMMIT
--
-- IDENTIFICA los registros del lote por:
--   UPs nuevos    : origen = 'pilot_fontaneria_2026_08_01'
--   Variantes     : universal_product_id → UP con ese origen
--   Categoría     : slug = 'font-acs' + 4 guardas de seguridad
--   PZ-FON-001    : restaura a valores verificados antes de la migración
--                   guarda doble: sólo aplica si contiene los valores que pusimos
--
-- SNAPSHOT PREVIA VERIFICADO (no asume — restaura valores documentados):
--   PZ-FON-001 category_id       ANTES: NULL
--   PZ-FON-001 global_catalog_id ANTES: NULL
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- PRE-CHECK: confirmar que la migración fue aplicada antes de revertir
-- ─────────────────────────────────────────────────────────────────────
DO $check$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE origen = 'pilot_fontaneria_2026_08_01';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: no se encontraron registros con '
      'origen=pilot_fontaneria_2026_08_01. La migración no parece haber sido aplicada.';
  END IF;

  RAISE NOTICE 'ROLLBACK: % UPs del lote encontrados. Procediendo a revertir.', v_count;
END $check$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar variantes vinculadas a UPs del lote
-- Identificación: universal_product_id → UPs con origen del lote
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.trade_marketplace_universal_product_variants
WHERE universal_product_id IN (
  SELECT id FROM public.trade_marketplace_universal_products
  WHERE origen = 'pilot_fontaneria_2026_08_01'
);

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Eliminar UPs del lote
-- Los 6 UPs preexistentes (PZ-FON-xxx) NO tienen ese origen → no afectados
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.trade_marketplace_universal_products
WHERE origen = 'pilot_fontaneria_2026_08_01';

-- ─────────────────────────────────────────────────────────────────────
-- PASO 3: Revertir UPDATE de PZ-FON-001
-- Guarda doble:
--   AND ean = 'PZ-FON-001'                        → solo ese registro
--   AND category_id = '9ea5bf24-...'              → solo si contiene lo que pusimos
--   AND global_catalog_id = (gc FON-GRF-LAV)      → solo si contiene lo que pusimos
-- Si la guarda no se cumple, el UPDATE afecta 0 filas (seguro).
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.trade_marketplace_universal_products
SET
  category_id       = NULL,
  global_catalog_id = NULL,
  updated_at        = now()
WHERE ean = 'PZ-FON-001'
  AND category_id     = '9ea5bf24-67f7-4e8e-91ba-10ed279f3999'
  AND global_catalog_id = (
    SELECT id FROM public.trade_global_catalog WHERE codigo = 'FON-GRF-LAV' LIMIT 1
  );

-- ─────────────────────────────────────────────────────────────────────
-- PASO 4: Eliminar categoría font-acs
-- Solo si se cumplen TODAS las condiciones:
--   1. Existe con slug = 'font-acs'  (fue creada por este lote)
--   2. No tiene UPs vinculados
--   3. No tiene categorías hijas
-- Si alguna condición falla → EXCEPTION, toda la transacción aborta
-- ─────────────────────────────────────────────────────────────────────
DO $cat_check$
DECLARE
  v_cat_id  uuid;
  v_count   integer;
BEGIN
  SELECT id INTO v_cat_id
  FROM public.trade_marketplace_categories
  WHERE slug = 'font-acs';

  IF v_cat_id IS NULL THEN
    RAISE NOTICE 'ROLLBACK PASO 4: font-acs no existe, nada que eliminar.';
    RETURN;
  END IF;

  -- Guarda: sin UPs vinculados
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE category_id = v_cat_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % UPs tienen category_id = font-acs. '
      'Desvincular antes de eliminar la categoría.', v_count;
  END IF;

  -- Guarda: sin categorías hijas
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_categories
  WHERE parent_id = v_cat_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % categorías hijas dependen de font-acs.', v_count;
  END IF;

  DELETE FROM public.trade_marketplace_categories WHERE id = v_cat_id;
  RAISE NOTICE 'ROLLBACK PASO 4: categoría font-acs eliminada (id: %).', v_cat_id;
END $cat_check$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK (fuera de transacción)
-- RAISE EXCEPTION: fallo hard que exige revisión manual del operador.
-- El COMMIT ya ocurrió; una excepción aquí solo emite el error.
-- ─────────────────────────────────────────────────────────────────────
DO $verify$
DECLARE
  v_ups       integer;
  v_variants  integer;
  v_cats      integer;
  v_pz001_cat uuid;
  v_pz001_gc  uuid;
BEGIN
  SELECT count(*) INTO v_ups FROM public.trade_marketplace_universal_products;
  SELECT count(*) INTO v_variants FROM public.trade_marketplace_universal_product_variants;
  SELECT count(*) INTO v_cats FROM public.trade_marketplace_categories;
  SELECT category_id, global_catalog_id INTO v_pz001_cat, v_pz001_gc
  FROM public.trade_marketplace_universal_products WHERE ean = 'PZ-FON-001';

  RAISE NOTICE 'ROLLBACK RESULT — UPs:% (esperado:6) | variantes:% (esperado:0) | categorías:% (esperado:25) | PZ-FON-001 category_id:% (esperado:NULL) | PZ-FON-001 gc_id:% (esperado:NULL)',
    v_ups, v_variants, v_cats, v_pz001_cat, v_pz001_gc;

  IF v_ups <> 6 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: UPs es %, se esperaban 6. Revisar manualmente.', v_ups;
  END IF;
  IF v_variants <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: variantes es %, se esperaban 0. Revisar manualmente.', v_variants;
  END IF;
  IF v_cats NOT IN (24, 25) THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: categorías es %, fuera de rango esperado (24-25). Revisar manualmente.', v_cats;
  END IF;
  IF v_pz001_cat IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: PZ-FON-001 category_id es % (esperado NULL). Revisar manualmente.', v_pz001_cat;
  END IF;
  IF v_pz001_gc IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: PZ-FON-001 global_catalog_id es % (esperado NULL). Revisar manualmente.', v_pz001_gc;
  END IF;

  RAISE NOTICE 'ROLLBACK VERIFY: todas las aserciones superadas. Estado restaurado correctamente.';
END $verify$;
