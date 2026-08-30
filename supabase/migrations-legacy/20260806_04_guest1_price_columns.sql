-- Sprint Guest-1 · Migración 04
-- Objetivo: Añadir columnas de precio multi-tier a supplier_offerings (additive, no renombra)
-- C8: checks, defaults documentados, venta_publica siempre false tras migración
-- Rollback: ver sección al final
--
-- Auditoría IVA (2026-08-06):
--   Todas las familias del catálogo son materiales de construcción (fontanería, electricidad,
--   albañilería, pintura, carpintería). En España, los materiales de construcción tributan
--   al tipo general del 21 % (Ley 37/1992 IVA, art. 91).
--   El tipo reducido 10 % aplica a obras de rehabilitación (servicio), no a materiales.
--   El 4 % aplica a alimentos, libros y medicamentos — fuera del scope de este catálogo.
--   DECISIÓN DOCUMENTADA: DEFAULT tax_rate = 21. Si en el futuro se incorporan productos
--   con tipo diferente, se actualizará por offering individual desde el panel de proveedor.

BEGIN;

-- ─── Columnas de precio multi-tier ────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD COLUMN IF NOT EXISTS precio_profesional_neto      numeric(12,4),
  ADD COLUMN IF NOT EXISTS precio_publico_neto           numeric(12,4),
  ADD COLUMN IF NOT EXISTS tax_rate                      numeric(5,2)  NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS currency                      char(3)       NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS venta_publica_habilitada      boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venta_profesional_habilitada  boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_profesional_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS precio_publico_updated_at     timestamptz;

-- ─── Migración de datos ────────────────────────────────────────────────────────
-- precio_coste → precio_profesional_neto
-- precio_venta → precio_publico_neto (donde existe)
-- venta_publica_habilitada permanece false: el proveedor activa explícitamente

UPDATE public.trade_marketplace_supplier_offerings
SET
  precio_profesional_neto      = precio_coste,
  precio_publico_neto          = precio_venta,
  precio_profesional_updated_at = CASE WHEN precio_coste IS NOT NULL THEN now() END,
  precio_publico_updated_at     = CASE WHEN precio_venta IS NOT NULL THEN now() END
WHERE precio_profesional_neto IS NULL;  -- idempotente

-- ─── CHECK constraints de integridad ──────────────────────────────────────────

-- IVA entre 0 y 100
ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_tax_rate_range;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_tax_rate_range
    CHECK (tax_rate >= 0 AND tax_rate <= 100);

-- Currency ISO 4217 — solo EUR por ahora; ampliar lista al añadir más mercados
ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_currency_supported;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_currency_supported
    CHECK (currency IN ('EUR', 'USD', 'GBP'));

-- precio_profesional_neto > 0 cuando venta profesional habilitada
ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_precio_profesional_si_habilitado;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_precio_profesional_si_habilitado
    CHECK (
      NOT venta_profesional_habilitada
      OR (precio_profesional_neto IS NOT NULL AND precio_profesional_neto > 0)
    );

-- precio_publico_neto > 0 cuando venta pública habilitada
ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_precio_publico_si_habilitado;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_precio_publico_si_habilitado
    CHECK (
      NOT venta_publica_habilitada
      OR (precio_publico_neto IS NOT NULL AND precio_publico_neto > 0)
    );

-- ─── Índice para catálogo público ──────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_offerings_venta_publica
  ON public.trade_marketplace_supplier_offerings (activa, venta_publica_habilitada)
  WHERE activa = true AND venta_publica_habilitada = true;

-- ─── Comentarios ────────────────────────────────────────────────────────────────

COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.precio_profesional_neto
  IS 'PVD: precio B2B neto (sin IVA) que paga el instalador al proveedor. Migrado desde precio_coste.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.precio_publico_neto
  IS 'PVP: precio público neto (sin IVA). NULL = no disponible para el público. Migrado desde precio_venta.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.tax_rate
  IS 'IVA aplicable en %. Default 21 (tipo general España materiales construcción). Configurable por offering.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.currency
  IS 'ISO 4217. Solo EUR en MVP.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.venta_publica_habilitada
  IS 'El proveedor ha activado explícitamente la venta de esta offering al público. FALSE tras migración.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.venta_profesional_habilitada
  IS 'Venta B2B habilitada. TRUE por defecto. El proveedor puede retirar una offering de la venta profesional.';

COMMIT;

-- ─── ROLLBACK ─────────────────────────────────────────────────────────────────
-- BEGIN;
-- ALTER TABLE public.trade_marketplace_supplier_offerings
--   DROP CONSTRAINT IF EXISTS chk_tax_rate_range,
--   DROP CONSTRAINT IF EXISTS chk_currency_supported,
--   DROP CONSTRAINT IF EXISTS chk_precio_profesional_si_habilitado,
--   DROP CONSTRAINT IF EXISTS chk_precio_publico_si_habilitado,
--   DROP COLUMN IF EXISTS precio_profesional_neto,
--   DROP COLUMN IF EXISTS precio_publico_neto,
--   DROP COLUMN IF EXISTS tax_rate,
--   DROP COLUMN IF EXISTS currency,
--   DROP COLUMN IF EXISTS venta_publica_habilitada,
--   DROP COLUMN IF EXISTS venta_profesional_habilitada,
--   DROP COLUMN IF EXISTS precio_profesional_updated_at,
--   DROP COLUMN IF EXISTS precio_publico_updated_at;
-- DROP INDEX IF EXISTS idx_offerings_venta_publica;
-- COMMIT;
