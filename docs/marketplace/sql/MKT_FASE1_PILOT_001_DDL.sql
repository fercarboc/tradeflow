-- =====================================================================
-- MKT-FASE1-PILOT-001 — DDL
-- =====================================================================
-- Prerrequisito obligatorio antes de ejecutar MKT_FASE1_PILOT_001_v3.sql
--
-- Cambio estructural:
--   ADD COLUMN global_catalog_id uuid → trade_marketplace_universal_product_variants
--   UNIQUE INDEX parcial (WHERE global_catalog_id IS NOT NULL)
--   INDEX de lectura para FK lookups
--
-- Efecto: permite vincular cada registro de trade_global_catalog con su
--   variante de marketplace exactamente una vez (1:1 garantizado por índice).
--   Las variantes sin gc_record mantienen global_catalog_id = NULL (sin conflicto).
--
-- Rollback: MKT_FASE1_PILOT_001_DDL_ROLLBACK.sql
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Añadir columna global_catalog_id
-- IF NOT EXISTS: idempotente si se ejecuta dos veces
-- ON DELETE SET NULL: si el gc_record se elimina, la variante queda sin vínculo
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_universal_product_variants
  ADD COLUMN IF NOT EXISTS global_catalog_id uuid
  REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Índice UNIQUE parcial
-- Garantiza: un gc_record → máximo una variante
-- Los NULL (variantes sin gc_record) quedan excluidos del índice
-- ─────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_variant_global_catalog_id
  ON public.trade_marketplace_universal_product_variants(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 3: Índice de lectura (FK lookups gc → variant)
-- Cubre queries del tipo: WHERE global_catalog_id = $1
-- ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_variant_global_catalog_id
  ON public.trade_marketplace_universal_product_variants(global_catalog_id)
  WHERE global_catalog_id IS NOT NULL;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-DDL (SELECT-only, ejecutar tras COMMIT)
-- ─────────────────────────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'trade_marketplace_universal_product_variants'
  AND column_name  = 'global_catalog_id';
-- Esperado: 1 fila — data_type = 'uuid', is_nullable = 'YES'

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'trade_marketplace_universal_product_variants'
  AND indexname IN ('uq_variant_global_catalog_id', 'idx_variant_global_catalog_id')
ORDER BY indexname;
-- Esperado: 2 filas
