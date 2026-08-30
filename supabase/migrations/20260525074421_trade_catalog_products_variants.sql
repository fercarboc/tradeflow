
-- ── Catálogo de productos genéricos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_catalog_products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  oficio          text NOT NULL DEFAULT 'Fontanería',
  familia         text NOT NULL,
  subfamilia      text,
  nombre_generico text NOT NULL,
  descripcion     text,
  unidad          text NOT NULL DEFAULT 'ud',
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_catalog_products_org
  ON public.trade_catalog_products (org_id);

CREATE INDEX IF NOT EXISTS idx_trade_catalog_products_family
  ON public.trade_catalog_products (org_id, oficio, familia);

CREATE INDEX IF NOT EXISTS idx_trade_catalog_products_search
  ON public.trade_catalog_products
  USING GIN (to_tsvector('spanish', nombre_generico || ' ' || COALESCE(descripcion, '')));

ALTER TABLE public.trade_catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage catalog products"
  ON public.trade_catalog_products
  FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

CREATE TRIGGER set_updated_at_catalog_products
  BEFORE UPDATE ON public.trade_catalog_products
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- ── Variantes por marca/modelo ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_catalog_variants (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        uuid NOT NULL REFERENCES public.trade_catalog_products(id) ON DELETE CASCADE,
  org_id            uuid REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  marca             text NOT NULL,
  modelo            text,
  medidas           text,
  proveedor         text,
  precio_material   numeric(10,2) NOT NULL DEFAULT 0,
  precio_mano_obra  numeric(10,2) NOT NULL DEFAULT 0,
  margen_pct        numeric(5,2) NOT NULL DEFAULT 0,
  precio_venta      numeric(10,2) GENERATED ALWAYS AS (
                      ROUND((precio_material + precio_mano_obra) * (1 + COALESCE(margen_pct, 0) / 100.0), 2)
                    ) STORED,
  calidad           text NOT NULL DEFAULT 'medio'
                      CHECK (calidad IN ('economico','medio','premium')),
  is_preferred      boolean NOT NULL DEFAULT false,
  activo            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_catalog_variants_product
  ON public.trade_catalog_variants (product_id);

CREATE INDEX IF NOT EXISTS idx_trade_catalog_variants_org
  ON public.trade_catalog_variants (org_id);

-- Solo una variante preferida por producto y org
CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_catalog_variants_preferred
  ON public.trade_catalog_variants (product_id, org_id)
  WHERE is_preferred = true;

ALTER TABLE public.trade_catalog_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can manage catalog variants"
  ON public.trade_catalog_variants
  FOR ALL
  USING (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

CREATE TRIGGER set_updated_at_catalog_variants
  BEFORE UPDATE ON public.trade_catalog_variants
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- ── Ampliar trade_quote_items ─────────────────────────────────────────────────
ALTER TABLE public.trade_quote_items
  ADD COLUMN IF NOT EXISTS catalog_product_id  uuid REFERENCES public.trade_catalog_products(id),
  ADD COLUMN IF NOT EXISTS catalog_variant_id  uuid REFERENCES public.trade_catalog_variants(id),
  ADD COLUMN IF NOT EXISTS marca               text,
  ADD COLUMN IF NOT EXISTS modelo              text,
  ADD COLUMN IF NOT EXISTS medidas             text,
  ADD COLUMN IF NOT EXISTS precio_material     numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_mano_obra    numeric(10,2),
  ADD COLUMN IF NOT EXISTS editable            boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requiere_revision   boolean NOT NULL DEFAULT false;
;
