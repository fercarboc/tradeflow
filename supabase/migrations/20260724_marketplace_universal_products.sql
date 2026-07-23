-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 0B — Producto Universal: Capa de Abstracción del Marketplace
-- Fecha: 2026-07-24
-- Reglas: NO destructivo · idempotente · SECURITY DEFINER SET search_path = public
-- Compatible con:
--   trade_global_catalog · trade_supplier_products · search_supplier_products
--   trade-voice-to-quote v59 (INTOCABLE — esta migración no lo toca)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. EXTENSIONES REQUERIDAS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- búsqueda fuzzy por ILIKE + índice GIN

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. MARCAS / FABRICANTES
--    Stub para Sprint 0B. Ampliado en Fase 2 (Portal Fabricante, brand_portal_id,
--    contacto, documentos de producto, etc.).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_brands (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  slug        text        NOT NULL,
  website     text,
  logo_url    text,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_brands_slug UNIQUE (slug)
);

COMMENT ON TABLE public.trade_marketplace_brands IS
  'Marcas y fabricantes del Marketplace. Stub Sprint 0B; se amplía en Fase 2 con Portal Fabricante.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. CATEGORÍAS JERÁRQUICAS
--    Árbol sin límite de profundidad vía parent_id.
--    La raíz tiene parent_id = NULL.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  slug        text        NOT NULL,
  parent_id   uuid        REFERENCES public.trade_marketplace_categories(id) ON DELETE SET NULL,
  oficio      text,         -- fontaneria | electricidad | albanileria | …
  icono       text,         -- emoji o nombre de icono (Lucide, etc.)
  posicion    integer     NOT NULL DEFAULT 0,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_categories_slug UNIQUE (slug)
);

COMMENT ON TABLE public.trade_marketplace_categories IS
  'Árbol de categorías del Marketplace. Cada nodo puede tener padre (jerarquía ilimitada).';

CREATE INDEX IF NOT EXISTS idx_mktcat_parent
  ON public.trade_marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_mktcat_oficio
  ON public.trade_marketplace_categories(oficio);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. PRODUCTO UNIVERSAL (UP) — entidad canónica, vendor-agnóstica
--    El Motor IA trabaja siempre sobre esta tabla. Nunca sobre SKUs de proveedor.
--    Separación concepto (qué es el producto) de oferta (cómo/dónde comprarlo).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_universal_products (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identidad canónica ────────────────────────────────────────────────────
  nombre_canonico       text        NOT NULL,
  descripcion           text,
  category_id           uuid        REFERENCES public.trade_marketplace_categories(id) ON DELETE SET NULL,
  oficio                text        NOT NULL,
  familia               text        NOT NULL,
  subfamilia            text,
  unidad                text        NOT NULL DEFAULT 'ud',

  -- ── Atributos de marca y fabricante (NULL → producto genérico) ────────────
  marca                 text,
  modelo                text,
  ean                   text,               -- EAN-13 (código de barras europeo estándar)
  gtin                  text,               -- GTIN superset: EAN-8, EAN-13, UPC-A, ITF-14
  mpn                   text,               -- Manufacturer Part Number
  manufacturer_ref      text,               -- alias semántico de mpn
  manufacturer_id       uuid        REFERENCES public.trade_marketplace_brands(id) ON DELETE SET NULL,

  -- ── Especificaciones técnicas (dimensiones, presión, potencia, color…) ────
  especificaciones      jsonb       NOT NULL DEFAULT '{}',

  -- ── Semántica: ¿es genérico o producto exacto de fabricante? ──────────────
  es_generico           boolean     NOT NULL DEFAULT false,

  -- ── Ciclo de vida ─────────────────────────────────────────────────────────
  validation_state      text        NOT NULL DEFAULT 'draft'
    CONSTRAINT chk_up_validation_state CHECK (
      validation_state IN ('draft','pending_review','validated','rejected','merged')
    ),
  -- Cuando validation_state = 'merged', apunta al UP canónico que lo absorbe
  merged_into_id        uuid        REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,

  -- ── Trazabilidad y normalización ──────────────────────────────────────────
  origen                text        NOT NULL DEFAULT 'admin_manual'
    CONSTRAINT chk_up_origen CHECK (
      origen IN ('global_catalog','supplier_import','admin_manual','brand_official','ai_suggested')
    ),
  normalization_version integer     NOT NULL DEFAULT 1,
  global_catalog_id     uuid        REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL,

  -- ── Full-text search (actualizado por trigger en INSERT/UPDATE) ───────────
  search_vector         tsvector,

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_up_ean          UNIQUE NULLS NOT DISTINCT (ean),
  CONSTRAINT uq_up_gtin         UNIQUE NULLS NOT DISTINCT (gtin),
  CONSTRAINT uq_up_global_cat   UNIQUE NULLS NOT DISTINCT (global_catalog_id)
);

COMMENT ON TABLE public.trade_marketplace_universal_products IS
  'Entidad canónica del Marketplace. Capa UP: el Motor IA trabaja aquí, nunca sobre SKUs de proveedor directo.';
COMMENT ON COLUMN public.trade_marketplace_universal_products.mpn IS
  'Manufacturer Part Number — ref del fabricante. manufacturer_ref es su alias semántico.';
COMMENT ON COLUMN public.trade_marketplace_universal_products.merged_into_id IS
  'Si validation_state=merged, apunta al UP canónico que absorbe este registro.';
COMMENT ON COLUMN public.trade_marketplace_universal_products.normalization_version IS
  'Versión del proceso de normalización aplicado. Permite re-procesar registros antiguos cuando cambia la lógica de normalización.';

CREATE INDEX IF NOT EXISTS idx_up_search_vector
  ON public.trade_marketplace_universal_products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_up_category
  ON public.trade_marketplace_universal_products(category_id);
CREATE INDEX IF NOT EXISTS idx_up_oficio_familia
  ON public.trade_marketplace_universal_products(oficio, familia);
CREATE INDEX IF NOT EXISTS idx_up_validation_state
  ON public.trade_marketplace_universal_products(validation_state);
CREATE INDEX IF NOT EXISTS idx_up_global_catalog_id
  ON public.trade_marketplace_universal_products(global_catalog_id);
CREATE INDEX IF NOT EXISTS idx_up_manufacturer_id
  ON public.trade_marketplace_universal_products(manufacturer_id);
-- GIN trigram para búsqueda ILIKE eficiente
CREATE INDEX IF NOT EXISTS idx_up_nombre_trgm
  ON public.trade_marketplace_universal_products USING GIN (nombre_canonico gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_up_ean_trgm
  ON public.trade_marketplace_universal_products USING GIN (ean gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VARIANTES COMPRABLES DEL UP
--    Cuando un UP tiene múltiples SKUs con EAN/ref propio (colores, tallas, etc.)
--    Cada variante es una unidad pedible independiente.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_universal_product_variants (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_product_id  uuid        NOT NULL
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE CASCADE,
  nombre                text        NOT NULL,    -- "Roca Debba BT 70x35 Blanco"
  ean                   text,
  gtin                  text,
  manufacturer_ref      text,                    -- ref del fabricante para esta variante
  atributos             jsonb       NOT NULL DEFAULT '{}',  -- { color, dimensiones, talla… }
  activa                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variant_ean  UNIQUE NULLS NOT DISTINCT (ean),
  CONSTRAINT uq_variant_gtin UNIQUE NULLS NOT DISTINCT (gtin)
);

COMMENT ON TABLE public.trade_marketplace_universal_product_variants IS
  'Variantes comprables de un UP cuando tienen EAN/ref propio (color, dimensión, etc.). Cada variante es pedible de forma independiente.';

CREATE INDEX IF NOT EXISTS idx_variant_up
  ON public.trade_marketplace_universal_product_variants(universal_product_id);
CREATE INDEX IF NOT EXISTS idx_variant_ean_trgm
  ON public.trade_marketplace_universal_product_variants USING GIN (ean gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. OFERTAS DE PROVEEDOR
--    Cómo cada proveedor ofrece un UP (o una variante del UP).
--    Separación total: concepto en UP, precio/stock/ref en esta tabla.
--    Estados de matching con auditoría completa.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_supplier_offerings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Vinculación al UP y variante ─────────────────────────────────────────
  -- universal_product_id puede ser NULL solo cuando match_state = 'unmatched'
  universal_product_id  uuid        REFERENCES public.trade_marketplace_universal_products(id) ON DELETE CASCADE,
  variant_id            uuid        REFERENCES public.trade_marketplace_universal_product_variants(id) ON DELETE CASCADE,

  -- ── Vinculación al proveedor ──────────────────────────────────────────────
  supplier_catalog_id   uuid        NOT NULL
    REFERENCES public.trade_supplier_catalogs(id) ON DELETE CASCADE,
  -- Traza hacia el producto en trade_supplier_products (puede ser NULL si la
  -- oferta es nativa del Marketplace, no importada de la tabla legacy)
  supplier_product_id   uuid        REFERENCES public.trade_supplier_products(id) ON DELETE SET NULL,

  -- ── Datos comerciales del proveedor ──────────────────────────────────────
  supplier_ref          text,                    -- referencia interna del proveedor
  descripcion_comercial text        NOT NULL,    -- nombre que usa el proveedor
  precio_coste          numeric(12,4),           -- precio neto para el instalador
  precio_venta          numeric(12,4),           -- PVP recomendado (con margen)
  unidad                text        NOT NULL DEFAULT 'ud',
  stock_disponible      boolean     NOT NULL DEFAULT true,
  stock_cantidad        integer,                 -- NULL = no se trackea
  plazo_entrega_dias    integer     NOT NULL DEFAULT 5,
  activa                boolean     NOT NULL DEFAULT true,

  -- ── Estado de matching con el UP ─────────────────────────────────────────
  match_state           text        NOT NULL DEFAULT 'pending_review'
    CONSTRAINT chk_offering_match_state CHECK (
      match_state IN ('matched','suggested','pending_review','unmatched','rejected')
    ),
  -- Método que originó el matching
  match_method          text
    CONSTRAINT chk_offering_match_method CHECK (
      match_method IS NULL OR
      match_method IN ('ean','mpn','semantic','admin','supplier','auto_seed')
    ),
  -- Confianza del algoritmo de matching (0.000–1.000)
  -- ≥ 0.90 puede auto-aceptarse; < 0.70 requiere revisión manual
  match_confidence      numeric(4,3)
    CONSTRAINT chk_offering_confidence CHECK (
      match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)
    ),
  matched_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_at            timestamptz,

  -- ── Metadata extensible ───────────────────────────────────────────────────
  metadata              jsonb       NOT NULL DEFAULT '{}',

  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  -- Un proveedor no puede tener la misma ref dos veces en su catálogo
  CONSTRAINT uq_offering_catalog_ref UNIQUE NULLS NOT DISTINCT (supplier_catalog_id, supplier_ref),
  -- Si hay variante asignada, debe existir el UP padre
  CONSTRAINT chk_offering_variant_requires_up CHECK (
    variant_id IS NULL OR universal_product_id IS NOT NULL
  ),
  -- Si está matched o suggested, debe tener UP asignado
  CONSTRAINT chk_offering_matched_has_up CHECK (
    match_state NOT IN ('matched','suggested') OR universal_product_id IS NOT NULL
  )
);

COMMENT ON TABLE public.trade_marketplace_supplier_offerings IS
  'Oferta de un proveedor para un UP. Separa concepto (UP) de oferta comercial (precio, stock, ref).';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.match_state IS
  'matched=confirmado · suggested=sugerido por IA · pending_review=revisión manual · unmatched=sin UP · rejected=descartado.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.match_confidence IS
  '0.0–1.0. Confianza del matching. ≥0.9 → auto-aceptar; <0.7 → revisión manual requerida.';
COMMENT ON COLUMN public.trade_marketplace_supplier_offerings.supplier_product_id IS
  'Trazabilidad hacia trade_supplier_products legacy. NULL para ofertas nativas del Marketplace.';

CREATE INDEX IF NOT EXISTS idx_offering_up
  ON public.trade_marketplace_supplier_offerings(universal_product_id);
CREATE INDEX IF NOT EXISTS idx_offering_catalog
  ON public.trade_marketplace_supplier_offerings(supplier_catalog_id);
CREATE INDEX IF NOT EXISTS idx_offering_supplier_product
  ON public.trade_marketplace_supplier_offerings(supplier_product_id)
  WHERE supplier_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offering_match_state
  ON public.trade_marketplace_supplier_offerings(match_state);
-- Índice parcial para la consulta más frecuente: ofertas activas y confirmadas por catálogo
CREATE INDEX IF NOT EXISTS idx_offering_active_matched
  ON public.trade_marketplace_supplier_offerings(supplier_catalog_id, universal_product_id)
  WHERE activa = true AND match_state = 'matched';
CREATE INDEX IF NOT EXISTS idx_offering_variant
  ON public.trade_marketplace_supplier_offerings(variant_id)
  WHERE variant_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. TRIGGER: updated_at automático (reutilizable)
--    Crea la función si no existe. Los triggers se crean con DO $$ para ser
--    idempotentes sin requerir CREATE OR REPLACE TRIGGER (no existe en PG).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  -- trade_marketplace_brands
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_marketplace_brands_updated_at'
      AND tgrelid = 'public.trade_marketplace_brands'::regclass
  ) THEN
    CREATE TRIGGER trg_marketplace_brands_updated_at
      BEFORE UPDATE ON public.trade_marketplace_brands
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;

  -- trade_marketplace_universal_products
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_up_updated_at'
      AND tgrelid = 'public.trade_marketplace_universal_products'::regclass
  ) THEN
    CREATE TRIGGER trg_up_updated_at
      BEFORE UPDATE ON public.trade_marketplace_universal_products
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;

  -- trade_marketplace_universal_product_variants
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_variant_updated_at'
      AND tgrelid = 'public.trade_marketplace_universal_product_variants'::regclass
  ) THEN
    CREATE TRIGGER trg_variant_updated_at
      BEFORE UPDATE ON public.trade_marketplace_universal_product_variants
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;

  -- trade_marketplace_supplier_offerings
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_offering_updated_at'
      AND tgrelid = 'public.trade_marketplace_supplier_offerings'::regclass
  ) THEN
    CREATE TRIGGER trg_offering_updated_at
      BEFORE UPDATE ON public.trade_marketplace_supplier_offerings
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. TRIGGER: search_vector del UP (actualización automática en INSERT/UPDATE)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_up_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    COALESCE(NEW.nombre_canonico,  '') || ' ' ||
    COALESCE(NEW.marca,            '') || ' ' ||
    COALESCE(NEW.modelo,           '') || ' ' ||
    COALESCE(NEW.familia,          '') || ' ' ||
    COALESCE(NEW.subfamilia,       '') || ' ' ||
    COALESCE(NEW.oficio,           '') || ' ' ||
    COALESCE(NEW.mpn,              '') || ' ' ||
    COALESCE(NEW.manufacturer_ref, '') || ' ' ||
    COALESCE(NEW.ean,              '') || ' ' ||
    COALESCE(NEW.descripcion,      '')
  );
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_up_search_vector'
      AND tgrelid = 'public.trade_marketplace_universal_products'::regclass
  ) THEN
    CREATE TRIGGER trg_up_search_vector
      BEFORE INSERT OR UPDATE ON public.trade_marketplace_universal_products
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_up_search_vector();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_brands                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_categories                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_universal_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_universal_product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_supplier_offerings             ENABLE ROW LEVEL SECURITY;

-- Marcas: lectura pública de las activas (sin autenticación para SEO/embed futuro)
DROP POLICY IF EXISTS "marketplace_brands_select" ON public.trade_marketplace_brands;
CREATE POLICY "marketplace_brands_select"
  ON public.trade_marketplace_brands FOR SELECT
  USING (activa = true);

-- Categorías: lectura pública de las activas
DROP POLICY IF EXISTS "marketplace_categories_select" ON public.trade_marketplace_categories;
CREATE POLICY "marketplace_categories_select"
  ON public.trade_marketplace_categories FOR SELECT
  USING (activa = true);

-- UPs: solo validated son visibles a usuarios autenticados
DROP POLICY IF EXISTS "up_select_validated" ON public.trade_marketplace_universal_products;
CREATE POLICY "up_select_validated"
  ON public.trade_marketplace_universal_products FOR SELECT
  TO authenticated
  USING (validation_state = 'validated');

-- Variantes: visibles si el UP padre está validated
DROP POLICY IF EXISTS "variant_select" ON public.trade_marketplace_universal_product_variants;
CREATE POLICY "variant_select"
  ON public.trade_marketplace_universal_product_variants FOR SELECT
  TO authenticated
  USING (
    activa = true
    AND EXISTS (
      SELECT 1 FROM public.trade_marketplace_universal_products up
      WHERE up.id               = universal_product_id
        AND up.validation_state = 'validated'
    )
  );

-- Offerings: un instalador solo ve las activas+matched de sus proveedores habilitados
-- El JOIN pasa por trade_org_members para verificar que el usuario pertenece a la org
DROP POLICY IF EXISTS "offering_select_org" ON public.trade_marketplace_supplier_offerings;
CREATE POLICY "offering_select_org"
  ON public.trade_marketplace_supplier_offerings FOR SELECT
  TO authenticated
  USING (
    activa      = true
    AND match_state = 'matched'
    AND EXISTS (
      SELECT 1
      FROM public.trade_org_suppliers   tos
      JOIN public.trade_org_members     tom ON tom.org_id = tos.org_id
      WHERE tos.catalog_id = supplier_catalog_id
        AND tos.enabled    = true
        AND tom.user_id    = auth.uid()
        AND tom.activo     = true
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. HELPER PRIVADO: _marketplace_org_catalog_ids(p_org_id)
--    Devuelve los catalog_ids activos de una org. Usada por search_marketplace_offerings.
--    No expuesta a anon.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._marketplace_org_catalog_ids(p_org_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT tos.catalog_id
  FROM   public.trade_org_suppliers tos
  JOIN   public.trade_supplier_catalogs sc ON sc.id = tos.catalog_id
  WHERE  tos.org_id   = p_org_id
    AND  tos.enabled  = true
    AND  sc.is_active = true;
$$;

REVOKE EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. SEED: seed_universal_products_from_global_catalog()
--     Convierte trade_global_catalog en UPs genéricos validated.
--     Idempotente: salta registros ya procesados (UNIQUE global_catalog_id).
--     NO modifica trade_global_catalog.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_universal_products_from_global_catalog()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.trade_marketplace_universal_products (
      nombre_canonico,
      descripcion,
      oficio,
      familia,
      unidad,
      marca,
      es_generico,
      validation_state,
      origen,
      normalization_version,
      global_catalog_id
    )
    SELECT
      gc.descripcion,                    -- nombre canónico = descripción del catálogo
      gc.descripcion,
      gc.oficio,
      gc.familia,
      gc.unidad,
      gc.marca_sugerida,                 -- NULL en productos genéricos
      (gc.marca_sugerida IS NULL),       -- es_generico = true si no hay marca
      'validated',
      'global_catalog',
      1,
      gc.id
    FROM public.trade_global_catalog gc
    WHERE gc.activo = true
      AND NOT EXISTS (
        SELECT 1 FROM public.trade_marketplace_universal_products up
        WHERE up.global_catalog_id = gc.id
      )
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() FROM public;
GRANT  EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. MIGRACIÓN: migrate_supplier_products_to_offerings()
--     Crea una oferta (pending_review) por cada registro en trade_supplier_products.
--     Idempotente: salta productos que ya tienen oferta vinculada.
--     NO elimina ni modifica trade_supplier_products (tabla legacy intacta).
--     Tras la migración, un admin puede iniciar el proceso de matching
--     EAN/MPN/semántico para vincularlas a UPs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.migrate_supplier_products_to_offerings()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.trade_marketplace_supplier_offerings (
      supplier_catalog_id,
      supplier_product_id,
      supplier_ref,
      descripcion_comercial,
      precio_coste,
      unidad,
      activa,
      match_state,
      match_method,
      match_confidence
    )
    SELECT
      sp.catalog_id,
      sp.id,
      sp.ref_proveedor,
      sp.descripcion,
      sp.precio_coste,
      sp.unidad,
      sp.activo,
      'pending_review',
      'auto_seed',
      0.000
    FROM public.trade_supplier_products sp
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_product_id = sp.id
    )
    ON CONFLICT DO NOTHING
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM ins;

  RETURN COALESCE(v_inserted, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() FROM public;
GRANT  EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. RPC PRINCIPAL: search_marketplace_offerings(...)
--     Búsqueda de UPs con su mejor oferta disponible para la org.
--     Motor IA INTOCABLE: esta función no toca search_supplier_products ni
--     ninguna función del pipeline trade-voice-to-quote v59.
--     Corre en paralelo e independiente a la búsqueda existente.
--
--     Lógica de ranking:
--       1. Score FTS (ts_rank sobre tsvector 'spanish')
--       2. Precio mínimo disponible ASC
--       3. Nombre canónico ASC (desempate estable)
--
--     Expansión futura (Sprint 1B/2A):
--       - Preferencia de proveedor (trade_supplier_choices)
--       - Valoraciones (trade_supplier_reviews)
--       - Cercanía logística (depot lat/lng)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_marketplace_offerings(
  p_query       text,
  p_org_id      uuid,
  p_category_id uuid    DEFAULT NULL,
  p_limit       integer DEFAULT 10,
  p_offset      integer DEFAULT 0
)
RETURNS TABLE (
  universal_product_id  uuid,
  nombre_canonico       text,
  oficio                text,
  familia               text,
  unidad                text,
  marca                 text,
  modelo                text,
  ean                   text,
  es_generico           boolean,
  ofertas_count         bigint,
  mejor_precio_coste    numeric,
  mejor_supplier_name   text,
  mejor_supplier_key    text,
  mejor_offering_id     uuid,
  score                 double precision
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ts tsquery;
BEGIN
  -- Construye tsquery solo si hay texto real para evitar errores con strings vacíos
  v_ts := CASE
    WHEN p_query IS NOT NULL AND length(trim(p_query)) > 0
    THEN plainto_tsquery('spanish', trim(p_query))
    ELSE NULL
  END;

  RETURN QUERY
  WITH org_catalogs AS (
    -- Catálogos activos que la org tiene habilitados
    SELECT
      tos.catalog_id,
      sc.supplier_name,
      sc.supplier_key
    FROM public.trade_org_suppliers   tos
    JOIN public.trade_supplier_catalogs sc ON sc.id = tos.catalog_id
    WHERE tos.org_id   = p_org_id
      AND tos.enabled  = true
      AND sc.is_active = true
  ),
  matched_offerings AS (
    -- Todas las ofertas confirmadas de los catálogos de la org
    SELECT
      o.universal_product_id,
      o.id            AS offering_id,
      o.precio_coste,
      oc.supplier_name,
      oc.supplier_key
    FROM public.trade_marketplace_supplier_offerings o
    JOIN org_catalogs oc ON oc.catalog_id = o.supplier_catalog_id
    WHERE o.match_state = 'matched'
      AND o.activa      = true
  ),
  aggregated AS (
    -- Agrega por UP: cuenta ofertas, obtiene mejor precio y proveedor
    SELECT
      up.id,
      up.nombre_canonico,
      up.oficio,
      up.familia,
      up.unidad,
      up.marca,
      up.modelo,
      up.ean,
      up.es_generico,
      up.search_vector,
      COUNT(mo.offering_id)                                                    AS ofertas_count,
      MIN(mo.precio_coste)                                                     AS mejor_precio_coste,
      -- El proveedor con el precio más bajo (primer elemento ordenado por precio ASC)
      (ARRAY_AGG(mo.supplier_name ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_name,
      (ARRAY_AGG(mo.supplier_key  ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_key,
      (ARRAY_AGG(mo.offering_id   ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_offering_id,
      -- Score FTS: 0.0 si no hay query (muestra todo)
      CASE
        WHEN v_ts IS NOT NULL THEN ts_rank(up.search_vector, v_ts)::double precision
        ELSE 0.0::double precision
      END AS score
    FROM public.trade_marketplace_universal_products up
    JOIN matched_offerings mo ON mo.universal_product_id = up.id
    WHERE
      up.validation_state = 'validated'
      AND (p_category_id IS NULL OR up.category_id = p_category_id)
      AND (
        -- Sin query → devuelve todo (útil para browse por categoría)
        v_ts IS NULL
        -- Con query → FTS o fallback ILIKE para términos cortos sin stemming
        OR up.search_vector @@ v_ts
        OR up.nombre_canonico ILIKE '%' || trim(p_query) || '%'
      )
    GROUP BY
      up.id, up.nombre_canonico, up.oficio, up.familia, up.unidad,
      up.marca, up.modelo, up.ean, up.es_generico, up.search_vector
    HAVING COUNT(mo.offering_id) > 0
  )
  SELECT
    a.id,
    a.nombre_canonico,
    a.oficio,
    a.familia,
    a.unidad,
    a.marca,
    a.modelo,
    a.ean,
    a.es_generico,
    a.ofertas_count,
    a.mejor_precio_coste,
    a.mejor_supplier_name,
    a.mejor_supplier_key,
    a.mejor_offering_id,
    a.score
  FROM aggregated a
  ORDER BY
    a.score              DESC,
    a.mejor_precio_coste ASC NULLS LAST,
    a.nombre_canonico    ASC
  LIMIT  p_limit
  OFFSET p_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) FROM public;
GRANT  EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. SEED INICIAL DE CATEGORÍAS BASE
--     Cubre los oficios habituales de TrabFlow. ON CONFLICT DO NOTHING = idempotente.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_categories (nombre, slug, oficio, icono, posicion)
VALUES
  ('Fontanería',          'fontaneria',   'fontaneria',   '🔧', 10),
  ('Electricidad',        'electricidad', 'electricidad', '⚡', 20),
  ('Albañilería',         'albanileria',  'albanileria',  '🧱', 30),
  ('Climatización',       'climatizacion','climatizacion','❄️', 40),
  ('Carpintería',         'carpinteria',  'carpinteria',  '🪵', 50),
  ('Pintura',             'pintura',      'pintura',      '🎨', 60),
  ('Soldadura',           'soldadura',    'soldadura',    '🔥', 70),
  ('Varios / General',    'varios',       null,           '📦', 99)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categorías de Fontanería
WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'fontaneria')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'fontaneria', v.pos
FROM parent,
  (VALUES
    ('Sanitarios',              'font-sanitarios',   10),
    ('Griferías',               'font-griferias',    20),
    ('Tuberías y Uniones',      'font-tuberias',     30),
    ('Calefacción',             'font-calefaccion',  40),
    ('Desagüe y Saneamiento',   'font-desague',      50),
    ('Herramientas Fontanería', 'font-herramientas', 60)
  ) AS v(nombre, slug, pos)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categorías de Electricidad
WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'electricidad')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'electricidad', v.pos
FROM parent,
  (VALUES
    ('Cables y Conductores',    'elec-cables',      10),
    ('Cuadros y Protecciones',  'elec-cuadros',     20),
    ('Mecanismos',              'elec-mecanismos',  30),
    ('Iluminación',             'elec-iluminacion', 40),
    ('Domótica',                'elec-domotica',    50),
    ('Herramientas Eléctricas', 'elec-herramientas',60)
  ) AS v(nombre, slug, pos)
ON CONFLICT (slug) DO NOTHING;

-- Sub-categorías de Albañilería
WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'albanileria')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'albanileria', v.pos
FROM parent,
  (VALUES
    ('Morteros y Cementos',     'alba-morteros',    10),
    ('Ladrillo y Bloques',      'alba-ladrillo',    20),
    ('Impermeabilización',      'alba-impermeab',   30),
    ('Enfoscados y Enlucidos',  'alba-enfoscados',  40),
    ('Herramientas Albañilería','alba-herramientas',50)
  ) AS v(nombre, slug, pos)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN — Sprint 0B
-- ─────────────────────────────────────────────────────────────────────────────
-- Para ejecutar el seed inicial (tras aplicar esta migración en prod):
--   SELECT seed_universal_products_from_global_catalog();
--   SELECT migrate_supplier_products_to_offerings();
-- ─────────────────────────────────────────────────────────────────────────────
