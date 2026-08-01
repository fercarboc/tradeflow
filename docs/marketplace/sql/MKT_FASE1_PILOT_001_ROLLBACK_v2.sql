-- =====================================================================
-- MKT-FASE1-PILOT-001 v2  —  ROLLBACK
-- =====================================================================
-- Usar ÚNICAMENTE si MKT_FASE1_PILOT_001_v2.sql fue ejecutado y se
-- necesita revertir.  NO ejecutar si la migración no se aplicó.
-- Transacción única: BEGIN … COMMIT
--
-- IDENTIFICA los registros del lote por:
--   UPs nuevos       : origen = 'pilot_fontaneria_2026_08_01'
--   Variantes        : universal_product_id → UP con ese origen
--   Categoría        : slug = 'font-acs' + 4 guardas de seguridad
--   PZ-FON-001       : restaura a valores verificados antes de la migración
--                      (category_id = NULL, global_catalog_id = NULL)
--                      guarda: sólo aplica si contiene los valores que pusimos
--
-- SNAPSHOT PREVIA VERIFICADO (no asume — restaura valores documentados):
--   PZ-FON-001 category_id     ANTES: NULL
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
    RAISE EXCEPTION 'ROLLBACK ABORTADO: no se encontraron registros con origen=pilot_fontaneria_2026_08_01. La migración no parece haber sido aplicada.';
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
-- Identificación: origen = 'pilot_fontaneria_2026_08_01'
-- Los 6 UPs preexistentes (PZ-FON-xxx) NO tienen ese origen → no afectados
-- ─────────────────────────────────────────────────────────────────────
DELETE FROM public.trade_marketplace_universal_products
WHERE origen = 'pilot_fontaneria_2026_08_01';

-- ─────────────────────────────────────────────────────────────────────
-- PASO 3: Revertir UPDATE de PZ-FON-001
-- Restaura exactamente los valores verificados antes de la migración.
-- Guarda doble:
--   AND ean = 'PZ-FON-001'                   → solo ese registro
--   AND category_id = '9ea5bf24-...'         → solo si contiene lo que pusimos
--   AND global_catalog_id = 'd1f03189-...'   → solo si contiene lo que pusimos
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
--   1. Existe y tiene slug = 'font-acs'  (fue creada por este lote)
--   2. No tiene UPs vinculados           (category_id de ningún UP apunta a ella)
--   3. No tiene categorías hijas         (parent_id de ninguna otra cat apunta a ella)
--   4. No hay otras referencias          (ningún UP tiene category_id = su id)
-- Si alguna condición falla → EXCEPTION, rollback aborta
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
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % UPs tienen category_id = font-acs. Desvincular antes de eliminar la categoría.', v_count;
  END IF;

  -- Guarda: sin hijos
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_categories
  WHERE parent_id = v_cat_id;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK PASO 4 ABORTADO: % categorías hijas dependen de font-acs.', v_count;
  END IF;

  -- Seguro: eliminar
  DELETE FROM public.trade_marketplace_categories WHERE id = v_cat_id;
  RAISE NOTICE 'ROLLBACK PASO 4: categoría font-acs eliminada (id: %).', v_cat_id;
END $cat_check$;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK
-- ─────────────────────────────────────────────────────────────────────
DO $verify$
DECLARE
  v_ups       integer;
  v_variants  integer;
  v_cats      integer;
  v_pz001_cat uuid;
BEGIN
  SELECT count(*) INTO v_ups FROM public.trade_marketplace_universal_products;
  SELECT count(*) INTO v_variants FROM public.trade_marketplace_universal_product_variants;
  SELECT count(*) INTO v_cats FROM public.trade_marketplace_categories;
  SELECT category_id INTO v_pz001_cat
  FROM public.trade_marketplace_universal_products WHERE ean = 'PZ-FON-001';

  RAISE NOTICE 'ROLLBACK RESULT — UPs:% (esperado:6), variantes:% (esperado:0), categorías:% (esperado:25), PZ-FON-001 category_id:% (esperado:NULL)',
    v_ups, v_variants, v_cats, v_pz001_cat;

  IF v_ups <> 6 THEN
    RAISE WARNING 'ROLLBACK: UPs es %, se esperaban 6. Revisar manualmente.', v_ups;
  END IF;
  IF v_variants <> 0 THEN
    RAISE WARNING 'ROLLBACK: variantes es %, se esperaban 0. Revisar manualmente.', v_variants;
  END IF;
  IF v_cats NOT IN (24, 25) THEN
    RAISE WARNING 'ROLLBACK: categorías es %, fuera de rango esperado (24-25).', v_cats;
  END IF;
END $verify$;

COMMIT;
