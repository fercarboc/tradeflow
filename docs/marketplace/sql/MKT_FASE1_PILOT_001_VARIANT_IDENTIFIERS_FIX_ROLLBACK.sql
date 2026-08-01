-- =====================================================================
-- MKT-FASE1-PILOT-001 — VARIANT_IDENTIFIERS_FIX ROLLBACK
-- =====================================================================
-- Revierte MKT_FASE1_PILOT_001_VARIANT_IDENTIFIERS_FIX.sql:
-- restaura los constraints UNIQUE NULLS NOT DISTINCT originales.
--
-- ⚠️  ADVERTENCIA CRÍTICA DE APLICABILIDAD:
--   Este rollback SOLO puede ejecutarse si en la tabla existe como máximo
--   UNA fila con ean=NULL y como máximo UNA fila con gtin=NULL.
--   En cuanto se hayan cargado dos o más variantes sin EAN (o sin GTIN),
--   restaurar NULLS NOT DISTINCT produciría un error de duplicado.
--
--   Las pre-validaciones de este script comprueban esta condición y
--   abortarán si no se cumple. En ese caso el rollback ya NO es viable
--   y debe evaluarse si el cambio original debe mantenerse.
--
-- Qué revierte:
--   - Elimina uq_variant_ean_notnull (índice parcial EAN)
--   - Elimina uq_variant_gtin_notnull (índice parcial GTIN)
--   - Restaura uq_variant_ean  UNIQUE NULLS NOT DISTINCT (ean)
--   - Restaura uq_variant_gtin UNIQUE NULLS NOT DISTINCT (gtin)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PRE-VALIDACIONES (fuera de transacción — abortan antes de empezar)
-- ─────────────────────────────────────────────────────────────────────
DO $pre$
DECLARE
  v_null_ean  integer;
  v_null_gtin integer;
  v_count     integer;
BEGIN
  -- [R-1] Verificar que existe como máximo 1 fila con ean=NULL
  SELECT count(*) INTO v_null_ean
  FROM public.trade_marketplace_universal_product_variants
  WHERE ean IS NULL;
  IF v_null_ean > 1 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO [R-1]: % filas con ean=NULL. '
      'NULLS NOT DISTINCT requiere máximo 1. '
      'Este rollback ya no es aplicable.',
      v_null_ean;
  END IF;
  RAISE NOTICE 'PRE [R-1]: % fila(s) con ean=NULL. Dentro del límite.', v_null_ean;

  -- [R-2] Verificar que existe como máximo 1 fila con gtin=NULL
  SELECT count(*) INTO v_null_gtin
  FROM public.trade_marketplace_universal_product_variants
  WHERE gtin IS NULL;
  IF v_null_gtin > 1 THEN
    RAISE EXCEPTION
      'ROLLBACK ABORTADO [R-2]: % filas con gtin=NULL. '
      'NULLS NOT DISTINCT requiere máximo 1. '
      'Este rollback ya no es aplicable.',
      v_null_gtin;
  END IF;
  RAISE NOTICE 'PRE [R-2]: % fila(s) con gtin=NULL. Dentro del límite.', v_null_gtin;

  -- [R-3] Los índices parciales que se van a eliminar existen
  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE tablename = 'trade_marketplace_universal_product_variants'
    AND indexname IN ('uq_variant_ean_notnull','uq_variant_gtin_notnull');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO [R-3]: se esperaban 2 índices parciales, hay %. ¿Ya fue revertido?', v_count;
  END IF;
  RAISE NOTICE 'PRE [R-3]: índices parciales confirmados.';

  -- [R-4] Los constraints originales ya no existen (evitar conflicto al recrearlos)
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname IN ('uq_variant_ean','uq_variant_gtin');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK ABORTADO [R-4]: % constraint(s) originales ya existen. Revisar estado.', v_count;
  END IF;
  RAISE NOTICE 'PRE [R-4]: constraints originales ausentes. Se pueden recrear.';

  RAISE NOTICE 'PRE-VALIDACIONES (R-1 a R-4): todas superadas. Procediendo con rollback.';
END $pre$;

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar índices parciales
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.uq_variant_ean_notnull;
DROP INDEX IF EXISTS public.uq_variant_gtin_notnull;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Restaurar constraints NULLS NOT DISTINCT originales
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_universal_product_variants
  ADD CONSTRAINT uq_variant_ean UNIQUE NULLS NOT DISTINCT (ean);

ALTER TABLE public.trade_marketplace_universal_product_variants
  ADD CONSTRAINT uq_variant_gtin UNIQUE NULLS NOT DISTINCT (gtin);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK (fuera de transacción)
-- ─────────────────────────────────────────────────────────────────────
DO $verify$
DECLARE
  v_count integer;
  v_def   text;
BEGIN
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname IN ('uq_variant_ean','uq_variant_gtin')
    AND pg_get_constraintdef(oid) LIKE '%NULLS NOT DISTINCT%';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: solo % de 2 constraints NULLS NOT DISTINCT restaurados.', v_count;
  END IF;

  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE tablename = 'trade_marketplace_universal_product_variants'
    AND indexname IN ('uq_variant_ean_notnull','uq_variant_gtin_notnull');
  IF v_count > 0 THEN
    RAISE EXCEPTION 'ROLLBACK VERIFY: % índice(s) parciales aún existen. Rollback incompleto.', v_count;
  END IF;

  RAISE NOTICE 'ROLLBACK VERIFY: constraints NULLS NOT DISTINCT restaurados. Índices parciales eliminados. Estado original.';
END $verify$;
