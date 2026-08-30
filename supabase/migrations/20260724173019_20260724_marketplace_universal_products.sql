-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 0B — Producto Universal: Capa de Abstracción del Marketplace
-- Fecha: 2026-07-24
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_trgm;

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

CREATE TABLE IF NOT EXISTS public.trade_marketplace_categories (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL,
  slug        text        NOT NULL,
  parent_id   uuid        REFERENCES public.trade_marketplace_categories(id) ON DELETE SET NULL,
  oficio      text,
  icono       text,
  posicion    integer     NOT NULL DEFAULT 0,
  activa      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_marketplace_categories_slug UNIQUE (slug)
);

COMMENT ON TABLE public.trade_marketplace_categories IS
  'Árbol de categorías del Marketplace. Cada nodo puede tener padre (jerarquía ilimitada).';

CREATE INDEX IF NOT EXISTS idx_mktcat_parent ON public.trade_marketplace_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_mktcat_oficio ON public.trade_marketplace_categories(oficio);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_universal_products (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_canonico       text        NOT NULL,
  descripcion           text,
  category_id           uuid        REFERENCES public.trade_marketplace_categories(id) ON DELETE SET NULL,
  oficio                text        NOT NULL,
  familia               text        NOT NULL,
  subfamilia            text,
  unidad                text        NOT NULL DEFAULT 'ud',
  marca                 text,
  modelo                text,
  ean                   text,
  gtin                  text,
  mpn                   text,
  manufacturer_ref      text,
  manufacturer_id       uuid        REFERENCES public.trade_marketplace_brands(id) ON DELETE SET NULL,
  especificaciones      jsonb       NOT NULL DEFAULT '{}',
  es_generico           boolean     NOT NULL DEFAULT false,
  validation_state      text        NOT NULL DEFAULT 'draft'
    CONSTRAINT chk_up_validation_state CHECK (
      validation_state IN ('draft','pending_review','validated','rejected','merged')
    ),
  merged_into_id        uuid        REFERENCES public.trade_marketplace_universal_products(id) ON DELETE SET NULL,
  origen                text        NOT NULL DEFAULT 'admin_manual'
    CONSTRAINT chk_up_origen CHECK (
      origen IN ('global_catalog','supplier_import','admin_manual','brand_official','ai_suggested')
    ),
  normalization_version integer     NOT NULL DEFAULT 1,
  global_catalog_id     uuid        REFERENCES public.trade_global_catalog(id) ON DELETE SET NULL,
  search_vector         tsvector,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_up_ean          UNIQUE NULLS NOT DISTINCT (ean),
  CONSTRAINT uq_up_gtin         UNIQUE NULLS NOT DISTINCT (gtin),
  CONSTRAINT uq_up_global_cat   UNIQUE NULLS NOT DISTINCT (global_catalog_id)
);

COMMENT ON TABLE public.trade_marketplace_universal_products IS
  'Entidad canónica del Marketplace. Capa UP: el Motor IA trabaja aquí, nunca sobre SKUs de proveedor directo.';

CREATE INDEX IF NOT EXISTS idx_up_search_vector    ON public.trade_marketplace_universal_products USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_up_category         ON public.trade_marketplace_universal_products(category_id);
CREATE INDEX IF NOT EXISTS idx_up_oficio_familia   ON public.trade_marketplace_universal_products(oficio, familia);
CREATE INDEX IF NOT EXISTS idx_up_validation_state ON public.trade_marketplace_universal_products(validation_state);
CREATE INDEX IF NOT EXISTS idx_up_global_catalog_id ON public.trade_marketplace_universal_products(global_catalog_id);
CREATE INDEX IF NOT EXISTS idx_up_manufacturer_id  ON public.trade_marketplace_universal_products(manufacturer_id);
CREATE INDEX IF NOT EXISTS idx_up_nombre_trgm      ON public.trade_marketplace_universal_products USING GIN (nombre_canonico gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_up_ean_trgm         ON public.trade_marketplace_universal_products USING GIN (ean gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_universal_product_variants (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_product_id  uuid        NOT NULL
    REFERENCES public.trade_marketplace_universal_products(id) ON DELETE CASCADE,
  nombre                text        NOT NULL,
  ean                   text,
  gtin                  text,
  manufacturer_ref      text,
  atributos             jsonb       NOT NULL DEFAULT '{}',
  activa                boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_variant_ean  UNIQUE NULLS NOT DISTINCT (ean),
  CONSTRAINT uq_variant_gtin UNIQUE NULLS NOT DISTINCT (gtin)
);

CREATE INDEX IF NOT EXISTS idx_variant_up       ON public.trade_marketplace_universal_product_variants(universal_product_id);
CREATE INDEX IF NOT EXISTS idx_variant_ean_trgm ON public.trade_marketplace_universal_product_variants USING GIN (ean gin_trgm_ops);

CREATE TABLE IF NOT EXISTS public.trade_marketplace_supplier_offerings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  universal_product_id  uuid        REFERENCES public.trade_marketplace_universal_products(id) ON DELETE CASCADE,
  variant_id            uuid        REFERENCES public.trade_marketplace_universal_product_variants(id) ON DELETE CASCADE,
  supplier_catalog_id   uuid        NOT NULL REFERENCES public.trade_supplier_catalogs(id) ON DELETE CASCADE,
  supplier_product_id   uuid        REFERENCES public.trade_supplier_products(id) ON DELETE SET NULL,
  supplier_ref          text,
  descripcion_comercial text        NOT NULL,
  precio_coste          numeric(12,4),
  precio_venta          numeric(12,4),
  unidad                text        NOT NULL DEFAULT 'ud',
  stock_disponible      boolean     NOT NULL DEFAULT true,
  stock_cantidad        integer,
  plazo_entrega_dias    integer     NOT NULL DEFAULT 5,
  activa                boolean     NOT NULL DEFAULT true,
  match_state           text        NOT NULL DEFAULT 'pending_review'
    CONSTRAINT chk_offering_match_state CHECK (
      match_state IN ('matched','suggested','pending_review','unmatched','rejected')
    ),
  match_method          text
    CONSTRAINT chk_offering_match_method CHECK (
      match_method IS NULL OR
      match_method IN ('ean','mpn','semantic','admin','supplier','auto_seed')
    ),
  match_confidence      numeric(4,3)
    CONSTRAINT chk_offering_confidence CHECK (
      match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)
    ),
  matched_by            uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  matched_at            timestamptz,
  metadata              jsonb       NOT NULL DEFAULT '{}',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_offering_catalog_ref UNIQUE NULLS NOT DISTINCT (supplier_catalog_id, supplier_ref),
  CONSTRAINT chk_offering_variant_requires_up CHECK (
    variant_id IS NULL OR universal_product_id IS NOT NULL
  ),
  CONSTRAINT chk_offering_matched_has_up CHECK (
    match_state NOT IN ('matched','suggested') OR universal_product_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_offering_up           ON public.trade_marketplace_supplier_offerings(universal_product_id);
CREATE INDEX IF NOT EXISTS idx_offering_catalog      ON public.trade_marketplace_supplier_offerings(supplier_catalog_id);
CREATE INDEX IF NOT EXISTS idx_offering_supplier_product ON public.trade_marketplace_supplier_offerings(supplier_product_id) WHERE supplier_product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_offering_match_state  ON public.trade_marketplace_supplier_offerings(match_state);
CREATE INDEX IF NOT EXISTS idx_offering_active_matched ON public.trade_marketplace_supplier_offerings(supplier_catalog_id, universal_product_id) WHERE activa = true AND match_state = 'matched';
CREATE INDEX IF NOT EXISTS idx_offering_variant      ON public.trade_marketplace_supplier_offerings(variant_id) WHERE variant_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_marketplace_brands_updated_at' AND tgrelid = 'public.trade_marketplace_brands'::regclass) THEN
    CREATE TRIGGER trg_marketplace_brands_updated_at BEFORE UPDATE ON public.trade_marketplace_brands FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_up_updated_at' AND tgrelid = 'public.trade_marketplace_universal_products'::regclass) THEN
    CREATE TRIGGER trg_up_updated_at BEFORE UPDATE ON public.trade_marketplace_universal_products FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_variant_updated_at' AND tgrelid = 'public.trade_marketplace_universal_product_variants'::regclass) THEN
    CREATE TRIGGER trg_variant_updated_at BEFORE UPDATE ON public.trade_marketplace_universal_product_variants FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_offering_updated_at' AND tgrelid = 'public.trade_marketplace_supplier_offerings'::regclass) THEN
    CREATE TRIGGER trg_offering_updated_at BEFORE UPDATE ON public.trade_marketplace_supplier_offerings FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.trg_fn_up_search_vector()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    COALESCE(NEW.nombre_canonico,'') || ' ' || COALESCE(NEW.marca,'') || ' ' || COALESCE(NEW.modelo,'') || ' ' ||
    COALESCE(NEW.familia,'') || ' ' || COALESCE(NEW.subfamilia,'') || ' ' || COALESCE(NEW.oficio,'') || ' ' ||
    COALESCE(NEW.mpn,'') || ' ' || COALESCE(NEW.manufacturer_ref,'') || ' ' || COALESCE(NEW.ean,'') || ' ' || COALESCE(NEW.descripcion,'')
  );
  RETURN NEW;
END; $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_up_search_vector' AND tgrelid = 'public.trade_marketplace_universal_products'::regclass) THEN
    CREATE TRIGGER trg_up_search_vector BEFORE INSERT OR UPDATE ON public.trade_marketplace_universal_products FOR EACH ROW EXECUTE FUNCTION public.trg_fn_up_search_vector();
  END IF;
END; $$;

ALTER TABLE public.trade_marketplace_brands                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_categories                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_universal_products             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_universal_product_variants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_supplier_offerings             ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_brands_select" ON public.trade_marketplace_brands;
CREATE POLICY "marketplace_brands_select" ON public.trade_marketplace_brands FOR SELECT USING (activa = true);

DROP POLICY IF EXISTS "marketplace_categories_select" ON public.trade_marketplace_categories;
CREATE POLICY "marketplace_categories_select" ON public.trade_marketplace_categories FOR SELECT USING (activa = true);

DROP POLICY IF EXISTS "up_select_validated" ON public.trade_marketplace_universal_products;
CREATE POLICY "up_select_validated" ON public.trade_marketplace_universal_products FOR SELECT TO authenticated USING (validation_state = 'validated');

DROP POLICY IF EXISTS "variant_select" ON public.trade_marketplace_universal_product_variants;
CREATE POLICY "variant_select" ON public.trade_marketplace_universal_product_variants FOR SELECT TO authenticated
  USING (activa = true AND EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products up WHERE up.id = universal_product_id AND up.validation_state = 'validated'));

DROP POLICY IF EXISTS "offering_select_org" ON public.trade_marketplace_supplier_offerings;
CREATE POLICY "offering_select_org" ON public.trade_marketplace_supplier_offerings FOR SELECT TO authenticated
  USING (activa = true AND match_state = 'matched' AND EXISTS (
    SELECT 1 FROM public.trade_org_suppliers tos JOIN public.trade_org_members tom ON tom.org_id = tos.org_id
    WHERE tos.catalog_id = supplier_catalog_id AND tos.enabled = true AND tom.user_id = auth.uid() AND tom.activo = true
  ));

CREATE OR REPLACE FUNCTION public._marketplace_org_catalog_ids(p_org_id uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tos.catalog_id FROM public.trade_org_suppliers tos JOIN public.trade_supplier_catalogs sc ON sc.id = tos.catalog_id
  WHERE tos.org_id = p_org_id AND tos.enabled = true AND sc.is_active = true;
$$;
REVOKE EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public._marketplace_org_catalog_ids(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.seed_universal_products_from_global_catalog()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.trade_marketplace_universal_products (nombre_canonico, descripcion, oficio, familia, unidad, marca, es_generico, validation_state, origen, normalization_version, global_catalog_id)
    SELECT gc.descripcion, gc.descripcion, gc.oficio, gc.familia, gc.unidad, gc.marca_sugerida, (gc.marca_sugerida IS NULL), 'validated', 'global_catalog', 1, gc.id
    FROM public.trade_global_catalog gc WHERE gc.activo = true AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_universal_products up WHERE up.global_catalog_id = gc.id)
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN COALESCE(v_inserted, 0);
END; $$;
REVOKE EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() FROM anon;
REVOKE EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() FROM public;
GRANT  EXECUTE ON FUNCTION public.seed_universal_products_from_global_catalog() TO authenticated;

CREATE OR REPLACE FUNCTION public.migrate_supplier_products_to_offerings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted integer;
BEGIN
  WITH ins AS (
    INSERT INTO public.trade_marketplace_supplier_offerings (supplier_catalog_id, supplier_product_id, supplier_ref, descripcion_comercial, precio_coste, unidad, activa, match_state, match_method, match_confidence)
    SELECT sp.catalog_id, sp.id, sp.ref_proveedor, sp.descripcion, sp.precio_coste, sp.unidad, sp.activo, 'pending_review', 'auto_seed', 0.000
    FROM public.trade_supplier_products sp WHERE NOT EXISTS (SELECT 1 FROM public.trade_marketplace_supplier_offerings o WHERE o.supplier_product_id = sp.id)
    ON CONFLICT DO NOTHING RETURNING id
  ) SELECT COUNT(*) INTO v_inserted FROM ins;
  RETURN COALESCE(v_inserted, 0);
END; $$;
REVOKE EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() FROM anon;
REVOKE EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() FROM public;
GRANT  EXECUTE ON FUNCTION public.migrate_supplier_products_to_offerings() TO authenticated;

CREATE OR REPLACE FUNCTION public.search_marketplace_offerings(p_query text, p_org_id uuid, p_category_id uuid DEFAULT NULL, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0)
RETURNS TABLE (universal_product_id uuid, nombre_canonico text, oficio text, familia text, unidad text, marca text, modelo text, ean text, es_generico boolean, ofertas_count bigint, mejor_precio_coste numeric, mejor_supplier_name text, mejor_supplier_key text, mejor_offering_id uuid, score double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ts tsquery;
BEGIN
  v_ts := CASE WHEN p_query IS NOT NULL AND length(trim(p_query)) > 0 THEN plainto_tsquery('spanish', trim(p_query)) ELSE NULL END;
  RETURN QUERY
  WITH org_catalogs AS (
    SELECT tos.catalog_id, sc.supplier_name, sc.supplier_key FROM public.trade_org_suppliers tos JOIN public.trade_supplier_catalogs sc ON sc.id = tos.catalog_id
    WHERE tos.org_id = p_org_id AND tos.enabled = true AND sc.is_active = true
  ), matched_offerings AS (
    SELECT o.universal_product_id, o.id AS offering_id, o.precio_coste, oc.supplier_name, oc.supplier_key
    FROM public.trade_marketplace_supplier_offerings o JOIN org_catalogs oc ON oc.catalog_id = o.supplier_catalog_id
    WHERE o.match_state = 'matched' AND o.activa = true
  ), aggregated AS (
    SELECT up.id, up.nombre_canonico, up.oficio, up.familia, up.unidad, up.marca, up.modelo, up.ean, up.es_generico, up.search_vector,
      COUNT(mo.offering_id) AS ofertas_count, MIN(mo.precio_coste) AS mejor_precio_coste,
      (ARRAY_AGG(mo.supplier_name ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_name,
      (ARRAY_AGG(mo.supplier_key  ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_supplier_key,
      (ARRAY_AGG(mo.offering_id   ORDER BY mo.precio_coste ASC NULLS LAST))[1] AS mejor_offering_id,
      CASE WHEN v_ts IS NOT NULL THEN ts_rank(up.search_vector, v_ts)::double precision ELSE 0.0::double precision END AS score
    FROM public.trade_marketplace_universal_products up JOIN matched_offerings mo ON mo.universal_product_id = up.id
    WHERE up.validation_state = 'validated' AND (p_category_id IS NULL OR up.category_id = p_category_id)
      AND (v_ts IS NULL OR up.search_vector @@ v_ts OR up.nombre_canonico ILIKE '%' || trim(p_query) || '%')
    GROUP BY up.id, up.nombre_canonico, up.oficio, up.familia, up.unidad, up.marca, up.modelo, up.ean, up.es_generico, up.search_vector
    HAVING COUNT(mo.offering_id) > 0
  )
  SELECT a.id, a.nombre_canonico, a.oficio, a.familia, a.unidad, a.marca, a.modelo, a.ean, a.es_generico,
    a.ofertas_count, a.mejor_precio_coste, a.mejor_supplier_name, a.mejor_supplier_key, a.mejor_offering_id, a.score
  FROM aggregated a ORDER BY a.score DESC, a.mejor_precio_coste ASC NULLS LAST, a.nombre_canonico ASC
  LIMIT p_limit OFFSET p_offset;
END; $$;
REVOKE EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) FROM public;
GRANT  EXECUTE ON FUNCTION public.search_marketplace_offerings(text, uuid, uuid, integer, integer) TO authenticated;

INSERT INTO public.trade_marketplace_categories (nombre, slug, oficio, icono, posicion) VALUES
  ('Fontanería','fontaneria','fontaneria','🔧',10),('Electricidad','electricidad','electricidad','⚡',20),
  ('Albañilería','albanileria','albanileria','🧱',30),('Climatización','climatizacion','climatizacion','❄️',40),
  ('Carpintería','carpinteria','carpinteria','🪵',50),('Pintura','pintura','pintura','🎨',60),
  ('Soldadura','soldadura','soldadura','🔥',70),('Varios / General','varios',null,'📦',99)
ON CONFLICT (slug) DO NOTHING;

WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'fontaneria')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'fontaneria', v.pos FROM parent,
  (VALUES ('Sanitarios','font-sanitarios',10),('Griferías','font-griferias',20),('Tuberías y Uniones','font-tuberias',30),
          ('Calefacción','font-calefaccion',40),('Desagüe y Saneamiento','font-desague',50),('Herramientas Fontanería','font-herramientas',60)) AS v(nombre,slug,pos)
ON CONFLICT (slug) DO NOTHING;

WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'electricidad')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'electricidad', v.pos FROM parent,
  (VALUES ('Cables y Conductores','elec-cables',10),('Cuadros y Protecciones','elec-cuadros',20),
          ('Mecanismos','elec-mecanismos',30),('Iluminación','elec-iluminacion',40),('Domótica','elec-domotica',50),('Herramientas Eléctricas','elec-herramientas',60)) AS v(nombre,slug,pos)
ON CONFLICT (slug) DO NOTHING;

WITH parent AS (SELECT id FROM public.trade_marketplace_categories WHERE slug = 'albanileria')
INSERT INTO public.trade_marketplace_categories (nombre, slug, parent_id, oficio, posicion)
SELECT v.nombre, v.slug, parent.id, 'albanileria', v.pos FROM parent,
  (VALUES ('Morteros y Cementos','alba-morteros',10),('Ladrillo y Bloques','alba-ladrillo',20),
          ('Impermeabilización','alba-impermeab',30),('Enfoscados y Enlucidos','alba-enfoscados',40),('Herramientas Albañilería','alba-herramientas',50)) AS v(nombre,slug,pos)
ON CONFLICT (slug) DO NOTHING;;
