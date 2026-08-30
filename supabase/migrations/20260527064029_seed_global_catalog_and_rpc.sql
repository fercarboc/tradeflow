
-- ── 1. Seed global catalog template (org_id = NULL) from existing org ─────────
DO $$
DECLARE
  src_product RECORD;
  new_product_id uuid;
  source_org_id uuid;
BEGIN
  IF (SELECT COUNT(*) FROM trade_catalog_products WHERE org_id IS NULL) > 0 THEN
    RETURN;
  END IF;

  SELECT DISTINCT org_id INTO source_org_id
  FROM trade_catalog_products
  WHERE org_id IS NOT NULL
  LIMIT 1;

  IF source_org_id IS NULL THEN
    RETURN;
  END IF;

  FOR src_product IN
    SELECT * FROM trade_catalog_products WHERE org_id = source_org_id
  LOOP
    new_product_id := gen_random_uuid();

    INSERT INTO trade_catalog_products
      (id, org_id, oficio, familia, subfamilia, nombre_generico, descripcion, unidad, activo)
    VALUES
      (new_product_id, NULL, src_product.oficio, src_product.familia, src_product.subfamilia,
       src_product.nombre_generico, src_product.descripcion, src_product.unidad, src_product.activo);

    INSERT INTO trade_catalog_variants
      (id, product_id, org_id, marca, modelo, medidas, proveedor,
       precio_material, precio_mano_obra, margen_pct,
       calidad, is_preferred, activo)
    SELECT
      gen_random_uuid(), new_product_id, NULL,
      marca, modelo, medidas, proveedor,
      precio_material, precio_mano_obra, margen_pct,
      calidad, is_preferred, activo
    FROM trade_catalog_variants
    WHERE product_id = src_product.id;
  END LOOP;
END;
$$;

-- ── 2. RPC: seed_org_catalog(new_org_id) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.seed_org_catalog(new_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src_product RECORD;
  new_product_id uuid;
BEGIN
  IF (SELECT COUNT(*) FROM trade_catalog_products WHERE org_id = new_org_id) > 0 THEN
    RETURN;
  END IF;

  FOR src_product IN
    SELECT * FROM trade_catalog_products WHERE org_id IS NULL AND activo = true
  LOOP
    new_product_id := gen_random_uuid();

    INSERT INTO trade_catalog_products
      (id, org_id, oficio, familia, subfamilia, nombre_generico, descripcion, unidad, activo)
    VALUES
      (new_product_id, new_org_id, src_product.oficio, src_product.familia, src_product.subfamilia,
       src_product.nombre_generico, src_product.descripcion, src_product.unidad, src_product.activo);

    INSERT INTO trade_catalog_variants
      (id, product_id, org_id, marca, modelo, medidas, proveedor,
       precio_material, precio_mano_obra, margen_pct,
       calidad, is_preferred, activo)
    SELECT
      gen_random_uuid(), new_product_id, new_org_id,
      marca, modelo, medidas, proveedor,
      precio_material, precio_mano_obra, margen_pct,
      calidad, is_preferred, activo
    FROM trade_catalog_variants
    WHERE product_id = src_product.id AND org_id IS NULL AND activo = true;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_org_catalog(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_org_catalog(uuid) TO service_role;
;
