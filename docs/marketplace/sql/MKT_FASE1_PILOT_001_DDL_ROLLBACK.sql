-- =====================================================================
-- MKT-FASE1-PILOT-001 — DDL ROLLBACK
-- =====================================================================
-- Usar ÚNICAMENTE si:
--   1. El DDL (MKT_FASE1_PILOT_001_DDL.sql) fue aplicado
--   2. El DML v3 NO fue aplicado aún (o ya se revirtió con el DML ROLLBACK)
--
-- IMPORTANTE: ejecutar DML ROLLBACK v3 antes de este script si el DML v3
--   ya fue aplicado. Este rollback fallará si alguna variante tiene
--   global_catalog_id no nulo.
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- PRE-CHECK: abortar si hay datos en la columna
-- Evita eliminar columna con datos vinculados
-- ─────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_count  integer;
  v_col    integer;
BEGIN
  -- Verificar que la columna existe antes de intentar leer datos
  SELECT count(*) INTO v_col
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'trade_marketplace_universal_product_variants'
    AND column_name  = 'global_catalog_id';

  IF v_col = 0 THEN
    RAISE NOTICE 'DDL ROLLBACK: columna global_catalog_id ya no existe. Nada que revertir.';
    RETURN;
  END IF;

  -- Verificar que no hay datos
  SELECT count(*) INTO v_count
  FROM public.trade_marketplace_universal_product_variants
  WHERE global_catalog_id IS NOT NULL;

  IF v_count > 0 THEN
    RAISE EXCEPTION 'DDL ROLLBACK ABORTADO: % variantes tienen global_catalog_id no nulo. '
      'Ejecutar DML ROLLBACK v3 antes de revertir el DDL.', v_count;
  END IF;

  RAISE NOTICE 'DDL ROLLBACK PRE-CHECK: columna existe y está vacía. Procediendo.';
END $$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar índices (deben eliminarse antes que la columna)
-- ─────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS public.uq_variant_global_catalog_id;
DROP INDEX IF EXISTS public.idx_variant_global_catalog_id;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Eliminar columna y su FK implícita
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_universal_product_variants
  DROP COLUMN IF EXISTS global_catalog_id;

-- ─────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-ROLLBACK DDL
-- ─────────────────────────────────────────────────────────────────────
SELECT count(*) AS columna_existe
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'trade_marketplace_universal_product_variants'
  AND column_name  = 'global_catalog_id';
-- Esperado: 0
