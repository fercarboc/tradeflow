-- ═══════════════════════════════════════════════════════════════════════════════
-- MKT-FASE1-PILOT-002 — C-001: Columnas de IDs estructurados en trade_quote_items
-- Fecha de diseño: 2026-08-01
-- Proyecto Supabase: dqqjaujnulutinskmqsu (eu-central-1)
-- Tipo: DDL — NO EJECUTAR sin revisión previa del DRY RUN completo
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- PROPÓSITO
-- Añadir tres columnas nullable a trade_quote_items para persistir los IDs
-- estructurados que el Motor IA resuelve al enriquecer partidas con el gc.
-- Sin estas columnas, create_cart_from_quote no puede usar Level 0 (determinista).
--
-- DEPENDENCIAS
-- Tablas que deben existir:
--   trade_global_catalog                                       (siempre presente)
--   trade_marketplace_universal_products                       (Sprint 1A+)
--   trade_marketplace_universal_product_variants               (Sprint 1A+)
--
-- REVERSIBILIDAD
-- Rollback: DROP COLUMN IF EXISTS. Sin datos perdidos (columnas nuevas, nullables).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PRE-VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count integer;
BEGIN
  -- P-1: trade_quote_items existe
  SELECT count(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'trade_quote_items';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'P-1 FAIL — trade_quote_items no existe';
  END IF;
  RAISE NOTICE 'P-1 OK — trade_quote_items existe';

  -- P-2: columna global_catalog_id aún NO existe (idempotencia check)
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_quote_items'
    AND column_name = 'global_catalog_id';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'P-2 FAIL — global_catalog_id ya existe (ya aplicado)';
  END IF;
  RAISE NOTICE 'P-2 OK — global_catalog_id no existe aún';

  -- P-3: columna universal_product_id aún NO existe
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_quote_items'
    AND column_name = 'universal_product_id';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'P-3 FAIL — universal_product_id ya existe (ya aplicado)';
  END IF;
  RAISE NOTICE 'P-3 OK — universal_product_id no existe aún';

  -- P-4: columna universal_variant_id aún NO existe
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_quote_items'
    AND column_name = 'universal_variant_id';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'P-4 FAIL — universal_variant_id ya existe (ya aplicado)';
  END IF;
  RAISE NOTICE 'P-4 OK — universal_variant_id no existe aún';

  -- P-5: tablas referenciadas existen
  SELECT count(*) INTO v_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'trade_global_catalog',
      'trade_marketplace_universal_products',
      'trade_marketplace_universal_product_variants'
    );
  IF v_count < 3 THEN
    RAISE EXCEPTION 'P-5 FAIL — faltan tablas referenciadas (encontradas: %)', v_count;
  END IF;
  RAISE NOTICE 'P-5 OK — las 3 tablas referenciadas existen';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: AÑADIR COLUMNAS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS global_catalog_id   uuid
    REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_product_id uuid
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS universal_variant_id uuid
    REFERENCES public.trade_marketplace_universal_product_variants(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────

-- Búsqueda de items por gc (útil para analytics y auditoría)
CREATE INDEX IF NOT EXISTS idx_quote_items_global_catalog_id
  ON public.trade_quote_items(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;

-- Búsqueda de items por UP (útil para create_cart_from_quote y reporting)
CREATE INDEX IF NOT EXISTS idx_quote_items_universal_product_id
  ON public.trade_quote_items(universal_product_id)
  WHERE universal_product_id IS NOT NULL;

-- Búsqueda de items por variante
CREATE INDEX IF NOT EXISTS idx_quote_items_universal_variant_id
  ON public.trade_quote_items(universal_variant_id)
  WHERE universal_variant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_count integer;
BEGIN
  -- V-1: las 3 columnas existen y son nullable
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'trade_quote_items'
    AND column_name IN ('global_catalog_id', 'universal_product_id', 'universal_variant_id')
    AND is_nullable = 'YES';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'V-1 FAIL — esperadas 3 columnas nullable, encontradas: %', v_count;
  END IF;
  RAISE NOTICE 'V-1 OK — las 3 columnas existen y son nullable';

  -- V-2: FK hacia trade_global_catalog existe
  SELECT count(*) INTO v_count
  FROM information_schema.referential_constraints rc
  JOIN information_schema.key_column_usage kcu
    ON kcu.constraint_name = rc.constraint_name
  WHERE rc.constraint_schema = 'public'
    AND kcu.table_name = 'trade_quote_items'
    AND kcu.column_name = 'global_catalog_id';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'V-2 FAIL — FK global_catalog_id no existe';
  END IF;
  RAISE NOTICE 'V-2 OK — FK global_catalog_id confirmada';

  -- V-3: los 3 índices parciales existen
  SELECT count(*) INTO v_count
  FROM pg_indexes
  WHERE tablename = 'trade_quote_items'
    AND indexname IN (
      'idx_quote_items_global_catalog_id',
      'idx_quote_items_universal_product_id',
      'idx_quote_items_universal_variant_id'
    );
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'V-3 FAIL — esperados 3 índices, encontrados: %', v_count;
  END IF;
  RAISE NOTICE 'V-3 OK — los 3 índices parciales existen';

  -- V-4: los registros existentes tienen NULL en las nuevas columnas (sin side effects)
  SELECT count(*) INTO v_count
  FROM public.trade_quote_items
  WHERE global_catalog_id IS NOT NULL
     OR universal_product_id IS NOT NULL
     OR universal_variant_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'V-4 FAIL — existen % registros con valores en columnas nuevas (inesperado)', v_count;
  END IF;
  RAISE NOTICE 'V-4 OK — todos los registros existentes tienen NULL en columnas nuevas';

  RAISE NOTICE '=== C-001 DDL COMPLETO — COMMIT AUTORIZADO ===';
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK (ejecutar FUERA de transacción si se decide revertir)
-- ─────────────────────────────────────────────────────────────────────────────
-- ADVERTENCIA: solo es seguro si ningún registro tiene valores en las columnas.
-- Verificar antes: SELECT count(*) FROM trade_quote_items
--   WHERE global_catalog_id IS NOT NULL
--      OR universal_product_id IS NOT NULL
--      OR universal_variant_id IS NOT NULL;
--
-- DROP INDEX IF EXISTS public.idx_quote_items_global_catalog_id;
-- DROP INDEX IF EXISTS public.idx_quote_items_universal_product_id;
-- DROP INDEX IF EXISTS public.idx_quote_items_universal_variant_id;
-- ALTER TABLE public.trade_quote_items
--   DROP COLUMN IF EXISTS global_catalog_id,
--   DROP COLUMN IF EXISTS universal_product_id,
--   DROP COLUMN IF EXISTS universal_variant_id;
