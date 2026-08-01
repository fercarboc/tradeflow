-- =====================================================================
-- MKT-FASE1-PILOT-001 v4  —  ROLLBACK DML
-- =====================================================================
-- Usar ÚNICAMENTE si MKT_FASE1_PILOT_001_v4.sql fue ejecutado y se
-- necesita revertir el DML. El DDL (columna global_catalog_id) permanece
-- intacto tras este rollback.
--
-- Transacción única: BEGIN … COMMIT
-- Verificación post-rollback: bloque independiente tras COMMIT
--
-- IDENTIFICACIÓN DEL LOTE (doble condición obligatoria):
--   origen = 'global_catalog'
--   AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
--
-- NUNCA usar solo origen='global_catalog' para borrar o contar el lote.
-- Esa condición afectaría a todos los UPs de procedencia global_catalog.
--
-- SNAPSHOT PZ-FON-001 VERIFICADO:
--   category_id       ANTES: NULL
--   global_catalog_id ANTES: NULL
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- PRE-CHECK: confirmar que el lote existe antes de revertir
-- ─────────────────────────────────────────────────────────────────────
DO $check$
DECLARE v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_products
  WHERE origen = 'global_catalog'
    AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO: no se encontraron UPs con '
      'origen=global_catalog y _batch=MKT_FASE1_PILOT_001. '
      'La migración v4 no parece haber sido aplicada.';
  END IF;

  RAISE NOTICE 'ROLLBACK: % UPs del lote MKT_FASE1_PILOT_001 encontrados. Procediendo.', v_count;
END $check$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar variantes vinculadas a UPs del lote
-- Identificación: universal_product_id → UP con doble condición de lote
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.trade_marketplace_universal_product_variants
WHERE universal_product_id IN (
  SELECT id FROM public.trade_marketplace_universal_products
  WHERE origen = 'global_catalog'
    AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001'
);

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Eliminar UPs del lote
-- Doble condición: origen + _batch — NUNCA solo origen='global_catalog'
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.trade_marketplace_universal_products
WHERE origen = 'global_catalog'
  AND especificaciones->>'_batch' = 'MKT_FASE1_PILOT_001';

-- ─────────────────────────────────────────────────────────────────────
-- PASO 3: Revertir UPDATE de PZ-FON-001
-- Guarda doble:
--   AND ean = 'PZ-FON-001'                     → solo ese registro
--   AND category_id = '9ea5bf24-...'           → solo si contiene lo que pusimos
--   AND global_catalog_id = (gc FON-GRF-LAV)   → solo si contiene lo que pusimos
-- ─────────────────────────────────────────────────────────────────────
UPDATE public.trade_marketplace_universal_products
SET
  category_id       = NULL,
  global_catalog_id = NULL,
  updated_at        = now()
WHERE ean = 'PZ-FON-001'
  AND category_id     = '9ea5bf24-67f7-4e8e-91ba-10ed279f3999'
  AND global_catalog_id = (
    SELECT id FROM public.trade_global_catalog WHERE codigo='FON-GRF-LAV' LIMIT 1
  );

-- ─────────────────────────────────────────────────────────────────────
-- PASO 4: Eliminar categoría font-acs
-- Guardas: sin UPs vinculados, sin categorías hijas
-- ─────────────────────────────────────────────────────────────────────
DO $cat_check$
DECLARE
  v_cat_id uuid;
  v_count  integer;
BEGIN
  SELECT id INTO v_cat_id FROM public.trade_marketplace_categories WHERE slug = 'font-acs';

  IF v_cat_id IS NULL THEN
    RAISE NOTICE 'ROLLBACK PASO 4: font-acs no existe, nada que eliminar.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_products WHERE category_id = v_cat_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % UPs tienen category_id=font-acs. Desvincular antes.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM public.trade_marketplace_categories WHERE parent_id = v_cat_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % categorías hijas dependen de font-acs.', v_count;
  END IF;

  DELETE FROM public.trade_marketplace_categories WHERE id = v_cat_id;
  RAISE NOTICE 'ROLLBACK PASO 4: categoría font-acs eliminada (id: %).', v_cat_id;
END $cat_check$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK (fuera de transacción)
-- RAISE EXCEPTION: error hard que exige revisión manual.
-- El COMMIT ya ocurrió — la excepción no revierte los cambios.
-- ─────────────────────────────────────────────────────────────────────
DO $verify$
DECLARE
  v_ups      integer;
  v_variants integer;
  v_cats     integer;
  v_pz001_cat uuid;
  v_pz001_gc  uuid;
  v_lote     integer;
BEGIN
  SELECT count(*) INTO v_ups FROM public.trade_marketplace_universal_products;
  SELECT count(*) INTO v_variants FROM public.trade_marketplace_universal_product_variants;
  SELECT count(*) INTO v_cats FROM public.trade_marketplace_categories;
  SELECT count(*) INTO v_lote FROM public.trade_marketplace_universal_products
  WHERE origen='global_catalog' AND especificaciones->>'_batch'='MKT_FASE1_PILOT_001';
  SELECT category_id, global_catalog_id INTO v_pz001_cat, v_pz001_gc
  FROM public.trade_marketplace_universal_products WHERE ean='PZ-FON-001';

  RAISE NOTICE 'ROLLBACK RESULT — UPs:% (esp:6) | lote_remanente:% (esp:0) | variantes:% (esp:0) | cats:% (esp:25) | PZ-FON-001 cat:% (esp:NULL) | PZ-FON-001 gc:% (esp:NULL)',
    v_ups, v_lote, v_variants, v_cats, v_pz001_cat, v_pz001_gc;

  IF v_ups <> 6 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: UPs es %, se esperaban 6. Revisar manualmente.', v_ups;
  END IF;
  IF v_lote <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: % UPs del lote aún existen. Revisar manualmente.', v_lote;
  END IF;
  IF v_variants <> 0 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: variantes es %, se esperaban 0. Revisar manualmente.', v_variants;
  END IF;
  IF v_cats NOT IN (24, 25) THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: categorías es %, fuera de rango (24-25). Revisar manualmente.', v_cats;
  END IF;
  IF v_pz001_cat IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: PZ-FON-001 category_id es % (esperado NULL).', v_pz001_cat;
  END IF;
  IF v_pz001_gc IS NOT NULL THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: PZ-FON-001 global_catalog_id es % (esperado NULL).', v_pz001_gc;
  END IF;

  RAISE NOTICE 'ROLLBACK VERIFY: todas las aserciones superadas. Estado restaurado correctamente.';
END $verify$;
