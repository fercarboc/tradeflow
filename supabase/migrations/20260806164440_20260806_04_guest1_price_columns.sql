-- Sprint Guest-1 · Migración 04 (versión corregida)
-- C8: Auditoría IVA → DEFAULT 21 justificado; constraints DESPUÉS de fix de datos

-- ── Columnas nuevas ──────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD COLUMN IF NOT EXISTS precio_profesional_neto      numeric(12,4),
  ADD COLUMN IF NOT EXISTS precio_publico_neto           numeric(12,4),
  ADD COLUMN IF NOT EXISTS tax_rate                      numeric(5,2)  NOT NULL DEFAULT 21,
  ADD COLUMN IF NOT EXISTS currency                      char(3)       NOT NULL DEFAULT 'EUR',
  ADD COLUMN IF NOT EXISTS venta_publica_habilitada      boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venta_profesional_habilitada  boolean       NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_profesional_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS precio_publico_updated_at     timestamptz;

-- ── Migración de datos ───────────────────────────────────────────────────────
UPDATE public.trade_marketplace_supplier_offerings
SET
  precio_profesional_neto      = precio_coste,
  precio_publico_neto          = precio_venta,
  precio_profesional_updated_at = CASE WHEN precio_coste IS NOT NULL THEN now() END,
  precio_publico_updated_at     = CASE WHEN precio_venta IS NOT NULL THEN now() END
WHERE precio_profesional_neto IS NULL;

-- Offerings sin precio_coste → no pueden venderse profesionalmente hasta que el proveedor lo configure
UPDATE public.trade_marketplace_supplier_offerings
SET venta_profesional_habilitada = false
WHERE precio_profesional_neto IS NULL;

-- ── Constraints de integridad (tras fix de datos) ────────────────────────────
ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_tax_rate_range;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_tax_rate_range
    CHECK (tax_rate >= 0 AND tax_rate <= 100);

ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_currency_supported;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_currency_supported
    CHECK (currency IN ('EUR', 'USD', 'GBP'));

ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_precio_profesional_si_habilitado;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_precio_profesional_si_habilitado
    CHECK (
      NOT venta_profesional_habilitada
      OR (precio_profesional_neto IS NOT NULL AND precio_profesional_neto > 0)
    );

ALTER TABLE public.trade_marketplace_supplier_offerings
  DROP CONSTRAINT IF EXISTS chk_precio_publico_si_habilitado;
ALTER TABLE public.trade_marketplace_supplier_offerings
  ADD CONSTRAINT chk_precio_publico_si_habilitado
    CHECK (
      NOT venta_publica_habilitada
      OR (precio_publico_neto IS NOT NULL AND precio_publico_neto > 0)
    );

CREATE INDEX IF NOT EXISTS idx_offerings_venta_publica
  ON public.trade_marketplace_supplier_offerings (activa, venta_publica_habilitada)
  WHERE activa = true AND venta_publica_habilitada = true;

COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.precio_profesional_neto
  IS 'PVD: precio B2B neto (sin IVA) que paga el instalador al proveedor. Migrado desde precio_coste.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.precio_publico_neto
  IS 'PVP: precio público neto (sin IVA). NULL = no disponible. Migrado desde precio_venta.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.tax_rate
  IS 'IVA aplicable en %. Default 21 (tipo general España, materiales construcción, Ley 37/1992 art.91).';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.venta_publica_habilitada
  IS 'El proveedor activa explícitamente la venta pública. FALSE para todos tras migración.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.venta_profesional_habilitada
  IS 'Venta B2B habilitada. FALSE si precio_profesional_neto IS NULL (3 offerings sin precio_coste).';;
