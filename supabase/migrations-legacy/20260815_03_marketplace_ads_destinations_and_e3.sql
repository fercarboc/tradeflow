-- ============================================================
-- RC1-C.8.E — E3: Fix D1 + destination types product/offer
-- ============================================================
-- D1: el CHECK constraint chk_campaign_dest de E1 solo aceptaba
-- catalog/category/supplier/search. El modelo aprobado incluye
-- también product y offer (Centro de Ofertas, futuro).
--
-- FIX: ampliar el CHECK para incluir exactamente:
--   catalog, category, supplier, search, product, offer
--
-- NO se añade 'external' ni otros tipos no contemplados.
-- NO se crean tablas nuevas.
-- trade_marketplace_ad_creatives NO tiene campo destination_type
-- (hereda el destino de su campaña) → no requiere cambios.
-- ============================================================

-- Paso 1: eliminar constraint actual
ALTER TABLE public.trade_marketplace_ad_campaigns
  DROP CONSTRAINT IF EXISTS chk_campaign_dest;

-- Paso 2: añadir constraint ampliado
ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD CONSTRAINT chk_campaign_dest
  CHECK (destination_type = ANY(ARRAY[
    'catalog'::text,
    'category'::text,
    'supplier'::text,
    'search'::text,
    'product'::text,
    'offer'::text
  ]));

-- Verificación: confirmar que el constraint fue creado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.trade_marketplace_ad_campaigns'::regclass
      AND conname   = 'chk_campaign_dest'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAILED: chk_campaign_dest constraint not found after migration';
  END IF;
END $$;
