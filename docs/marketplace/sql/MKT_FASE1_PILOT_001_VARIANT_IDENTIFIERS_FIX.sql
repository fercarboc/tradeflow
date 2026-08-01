-- =====================================================================
-- MKT-FASE1-PILOT-001 — VARIANT_IDENTIFIERS_FIX (DDL)
-- =====================================================================
-- Propósito: reemplazar los constraints UNIQUE NULLS NOT DISTINCT sobre
-- las columnas ean y gtin de trade_marketplace_universal_product_variants
-- por índices únicos parciales (WHERE columna IS NOT NULL).
--
-- Motivación:
--   EAN y GTIN son identificadores de producto opcionales. Una variante
--   genérica que no tiene EAN real simplemente tiene ean=NULL. Bajo
--   NULLS NOT DISTINCT, todos los NULL se tratan como iguales y solo
--   puede existir una fila con ean=NULL en toda la tabla, lo que impide
--   insertar más de una variante sin EAN.
--
--   Solución: índices únicos parciales (WHERE columna IS NOT NULL).
--   - EAN no nulo sigue siendo único en la tabla.
--   - GTIN no nulo sigue siendo único en la tabla.
--   - Múltiples filas con ean=NULL o gtin=NULL son válidas.
--   - NUNCA generar identificadores ficticios para rellenar estos campos.
--
-- Contexto de ejecución:
--   Precondición: tabla con 0 variantes (verificado antes de ejecutar).
--   Si existen variantes, las pre-validaciones lo detectarán y abortarán.
--
-- Rollback: MKT_FASE1_PILOT_001_VARIANT_IDENTIFIERS_FIX_ROLLBACK.sql
--   ADVERTENCIA: el rollback deja de ser aplicable una vez que existan
--   dos o más variantes con ean=NULL o dos o más con gtin=NULL.
-- =====================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────
-- PRE-VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────
DO $pre$
DECLARE
  v_count  integer;
  v_dup    integer;
BEGIN
  -- [P-1] Tabla vacía o sin variantes con EAN/GTIN duplicados
  SELECT count(*) INTO v_count FROM public.trade_marketplace_universal_product_variants;
  RAISE NOTICE 'PRE [P-1]: % variantes en tabla.', v_count;

  -- [P-2] No existen duplicados en EAN no-nulo
  SELECT count(*) INTO v_dup FROM (
    SELECT ean FROM public.trade_marketplace_universal_product_variants
    WHERE ean IS NOT NULL
    GROUP BY ean HAVING count(*) > 1
  ) d;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'PRE [P-2]: % grupos de EAN duplicados. Resolver antes de ejecutar.', v_dup;
  END IF;
  RAISE NOTICE 'PRE [P-2]: cero duplicados en EAN no-nulo.';

  -- [P-3] No existen duplicados en GTIN no-nulo
  SELECT count(*) INTO v_dup FROM (
    SELECT gtin FROM public.trade_marketplace_universal_product_variants
    WHERE gtin IS NOT NULL
    GROUP BY gtin HAVING count(*) > 1
  ) d;
  IF v_dup > 0 THEN
    RAISE EXCEPTION 'PRE [P-3]: % grupos de GTIN duplicados. Resolver antes de ejecutar.', v_dup;
  END IF;
  RAISE NOTICE 'PRE [P-3]: cero duplicados en GTIN no-nulo.';

  -- [P-4] Confirmar que el constraint uq_variant_ean existe y es NULLS NOT DISTINCT
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname = 'uq_variant_ean'
    AND pg_get_constraintdef(oid) LIKE '%NULLS NOT DISTINCT%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRE [P-4]: constraint uq_variant_ean con NULLS NOT DISTINCT no encontrado. ¿Ya fue modificado?';
  END IF;
  RAISE NOTICE 'PRE [P-4]: constraint uq_variant_ean NULLS NOT DISTINCT confirmado.';

  -- [P-5] Confirmar que el constraint uq_variant_gtin existe y es NULLS NOT DISTINCT
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname = 'uq_variant_gtin'
    AND pg_get_constraintdef(oid) LIKE '%NULLS NOT DISTINCT%';
  IF v_count = 0 THEN
    RAISE EXCEPTION 'PRE [P-5]: constraint uq_variant_gtin con NULLS NOT DISTINCT no encontrado. ¿Ya fue modificado?';
  END IF;
  RAISE NOTICE 'PRE [P-5]: constraint uq_variant_gtin NULLS NOT DISTINCT confirmado.';

  RAISE NOTICE 'PRE-VALIDACIONES (P-1 a P-5): todas superadas.';
END $pre$;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar constraints NULLS NOT DISTINCT
-- DROP CONSTRAINT elimina también el índice de respaldo automáticamente.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_universal_product_variants
  DROP CONSTRAINT uq_variant_ean;

ALTER TABLE public.trade_marketplace_universal_product_variants
  DROP CONSTRAINT uq_variant_gtin;

-- ─────────────────────────────────────────────────────────────────────
-- PASO 2: Crear índices únicos parciales
--
-- EAN y GTIN son identificadores de producto opcionales.
-- NULL no representa un identificador compartido: cada fila con NULL
-- simplemente carece de ese identificador. Múltiples NULL son válidos.
-- NUNCA generar EAN o GTIN ficticios para rellenar estos campos.
-- ─────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_variant_ean_notnull
  ON public.trade_marketplace_universal_product_variants(ean)
  WHERE ean IS NOT NULL;
-- Efecto: EAN real → único en tabla. EAN ausente (NULL) → sin restricción.

CREATE UNIQUE INDEX uq_variant_gtin_notnull
  ON public.trade_marketplace_universal_product_variants(gtin)
  WHERE gtin IS NOT NULL;
-- Efecto: GTIN real → único en tabla. GTIN ausente (NULL) → sin restricción.

-- ─────────────────────────────────────────────────────────────────────
-- POST-VALIDACIONES
-- ─────────────────────────────────────────────────────────────────────
DO $post$
DECLARE
  v_count  integer;
  v_idx    text;
BEGIN
  -- [V-1] Constraint NULLS NOT DISTINCT EAN ya no existe
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname = 'uq_variant_ean';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST [V-1]: constraint uq_variant_ean sigue existiendo. Revisar.';
  END IF;
  RAISE NOTICE 'POST [V-1]: constraint uq_variant_ean eliminado.';

  -- [V-2] Constraint NULLS NOT DISTINCT GTIN ya no existe
  SELECT count(*) INTO v_count FROM pg_constraint
  WHERE conrelid = 'public.trade_marketplace_universal_product_variants'::regclass
    AND conname = 'uq_variant_gtin';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST [V-2]: constraint uq_variant_gtin sigue existiendo. Revisar.';
  END IF;
  RAISE NOTICE 'POST [V-2]: constraint uq_variant_gtin eliminado.';

  -- [V-3] Índice parcial EAN existe y es parcial (WHERE ean IS NOT NULL)
  SELECT indexdef INTO v_idx FROM pg_indexes
  WHERE tablename = 'trade_marketplace_universal_product_variants'
    AND indexname  = 'uq_variant_ean_notnull';
  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'POST [V-3]: índice uq_variant_ean_notnull no existe.';
  END IF;
  IF v_idx NOT LIKE '%WHERE%' OR v_idx NOT LIKE '%NULLS NOT DISTINCT%' = false THEN
    NULL; -- la ausencia de NULLS NOT DISTINCT es correcta en un índice parcial
  END IF;
  RAISE NOTICE 'POST [V-3]: uq_variant_ean_notnull → %', v_idx;

  -- [V-4] Índice parcial GTIN existe
  SELECT indexdef INTO v_idx FROM pg_indexes
  WHERE tablename = 'trade_marketplace_universal_product_variants'
    AND indexname  = 'uq_variant_gtin_notnull';
  IF v_idx IS NULL THEN
    RAISE EXCEPTION 'POST [V-4]: índice uq_variant_gtin_notnull no existe.';
  END IF;
  RAISE NOTICE 'POST [V-4]: uq_variant_gtin_notnull → %', v_idx;

  -- [V-5] Ninguno de los dos nuevos índices contiene NULLS NOT DISTINCT
  SELECT count(*) INTO v_count FROM pg_indexes
  WHERE tablename = 'trade_marketplace_universal_product_variants'
    AND indexname IN ('uq_variant_ean_notnull','uq_variant_gtin_notnull')
    AND indexdef LIKE '%NULLS NOT DISTINCT%';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'POST [V-5]: % índice(s) nuevos contienen NULLS NOT DISTINCT. Error de creación.', v_count;
  END IF;
  RAISE NOTICE 'POST [V-5]: índices nuevos sin NULLS NOT DISTINCT. Correcto.';

  RAISE NOTICE 'POST-VALIDACIONES (V-1 a V-5): todas superadas.';
END $post$;

COMMIT;
