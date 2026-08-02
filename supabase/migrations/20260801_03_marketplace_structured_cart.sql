-- ═══════════════════════════════════════════════════════════════════════════════
-- MKT-FASE1-PILOT-002 — C-003: Level 0 determinista en create_cart_from_quote
-- Fecha: 2026-08-01  Proyecto: dqqjaujnulutinskmqsu (eu-central-1)
-- Requiere: C-001 aplicado (columnas gc/up/variant en trade_quote_items)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- PRERREQUISITO: C-001 debe estar aplicado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'trade_quote_items'
      AND column_name  = 'global_catalog_id'
  ) THEN
    RAISE EXCEPTION 'C-001 no aplicado — columna global_catalog_id ausente en trade_quote_items';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'trade_quote_items'
      AND column_name  = 'universal_product_id'
  ) THEN
    RAISE EXCEPTION 'C-001 no aplicado — columna universal_product_id ausente en trade_quote_items';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'trade_quote_items'
      AND column_name  = 'universal_variant_id'
  ) THEN
    RAISE EXCEPTION 'C-001 no aplicado — columna universal_variant_id ausente en trade_quote_items';
  END IF;
  RAISE NOTICE 'Prerrequisito OK — C-001 aplicado';
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- create_cart_from_quote — con Level 0 determinista
-- ─────────────────────────────────────────────────────────────────────────────
-- Niveles de matching (orden de prioridad):
--   Level 0-A  structured_variant          — universal_variant_id → variante activa + UP validated
--   Level 0-B  structured_product          — universal_product_id → UP validated
--   Level 0-C  structured_global_catalog   — global_catalog_id → UP validated (directo o via variante)
--   Level 1    (legacy)                    — catalog_variant_id → offering matched
--   Level 2    (legacy)                    — supplier_ref → offering matched
--   Level 3    fuzzy_fallback              — ILIKE sobre UP validated
--
-- Métodos especiales (v_up_id = NULL en estos casos):
--   product_not_validated  — ID estructurado válido pero UP en draft
--   structured_id_invalid  — universal_variant_id y universal_product_id incoherentes
--   no_match               — ningún nivel resolvió
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote           RECORD;
  v_cart_id         uuid;
  v_item            RECORD;
  v_up_id           uuid;
  v_up_conf         numeric;
  v_up_method       text;
  v_alternatives    jsonb;
  v_variant_up_id   uuid;   -- UP padre real de la variante (para verificación de coherencia)
BEGIN
  -- Verificar que el presupuesto pertenece a la org del usuario autenticado
  SELECT q.id, q.org_id, q.numero, q.estado
  INTO v_quote
  FROM public.trade_quotes q
  JOIN public.trade_org_members m ON m.org_id = q.org_id
  WHERE q.id = p_quote_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Presupuesto no encontrado o sin acceso.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_quote_items
    WHERE quote_id = p_quote_id
      AND tipo = 'material'
      AND NOT COALESCE(material_order_placed, false)
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Todos los materiales ya fueron pedidos.';
  END IF;

  -- Crear carrito
  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  -- Procesar líneas de material
  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia,
           qi.supplier_ref, qi.catalog_variant_id, qi.precio_material,
           qi.global_catalog_id, qi.universal_product_id, qi.universal_variant_id
    FROM public.trade_quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.tipo = 'material'
      AND NOT COALESCE(qi.material_order_placed, false)
    ORDER BY qi.posicion
  LOOP
    v_up_id         := NULL;
    v_up_conf       := NULL;
    v_up_method     := NULL;
    v_variant_up_id := NULL;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 0-A: por universal_variant_id
    -- Requiere variante activa + UP padre validated
    -- Verifica coherencia con universal_product_id si ambos están informados
    -- ───────────────────────────────────────────────────────────────────────
    IF v_item.universal_variant_id IS NOT NULL THEN

      -- Verificación de coherencia: el UP padre de la variante debe coincidir
      IF v_item.universal_product_id IS NOT NULL THEN
        SELECT up.id
        INTO v_variant_up_id
        FROM public.trade_marketplace_universal_product_variants var
        JOIN public.trade_marketplace_universal_products up ON up.id = var.universal_product_id
        WHERE var.id = v_item.universal_variant_id
        LIMIT 1;

        IF v_variant_up_id IS NOT NULL AND v_variant_up_id <> v_item.universal_product_id THEN
          v_up_method := 'structured_id_invalid';
        END IF;
      END IF;

      -- Solo proceder si no hay incoherencia de IDs
      IF v_up_method IS DISTINCT FROM 'structured_id_invalid' THEN
        SELECT up.id, 1.0::numeric, 'structured_variant'::text
        INTO v_up_id, v_up_conf, v_up_method
        FROM public.trade_marketplace_universal_product_variants var
        JOIN public.trade_marketplace_universal_products up ON up.id = var.universal_product_id
        WHERE var.id = v_item.universal_variant_id
          AND var.activa = true
          AND up.validation_state = 'validated'
        LIMIT 1;

        IF v_up_id IS NULL THEN
          v_up_method := 'product_not_validated';
        END IF;
      END IF;
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 0-B: por universal_product_id
    -- Solo si Level 0-A no resolvió y no hubo incoherencia de IDs
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NULL
       AND v_up_method IS DISTINCT FROM 'structured_id_invalid'
       AND v_item.universal_product_id IS NOT NULL
    THEN
      SELECT up.id, 1.0::numeric, 'structured_product'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.id = v_item.universal_product_id
        AND up.validation_state = 'validated'
      LIMIT 1;

      IF v_up_id IS NULL THEN
        v_up_method := 'product_not_validated';
      END IF;
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 0-C: por global_catalog_id
    -- Solo si 0-A y 0-B no resolvieron y no hubo incoherencia
    -- Intenta primero UP directo, luego via variante
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NULL
       AND v_up_method IS DISTINCT FROM 'structured_id_invalid'
       AND v_item.global_catalog_id IS NOT NULL
    THEN
      -- 0-C-1: UP directo validated con global_catalog_id
      SELECT up.id, 1.0::numeric, 'structured_global_catalog'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.global_catalog_id = v_item.global_catalog_id
        AND up.validation_state = 'validated'
      LIMIT 1;

      -- 0-C-2: via variante activa cuyo UP padre esté validated
      IF v_up_id IS NULL THEN
        SELECT up.id, 1.0::numeric, 'structured_global_catalog_variant'::text
        INTO v_up_id, v_up_conf, v_up_method
        FROM public.trade_marketplace_universal_product_variants var
        JOIN public.trade_marketplace_universal_products up ON up.id = var.universal_product_id
        WHERE var.global_catalog_id = v_item.global_catalog_id
          AND var.activa = true
          AND up.validation_state = 'validated'
        LIMIT 1;
      END IF;

      IF v_up_id IS NULL THEN
        v_up_method := 'product_not_validated';
      END IF;
    END IF;

    -- Limpieza: garantizar que v_up_id = NULL en métodos de error
    -- (los niveles 1-3 podrán intentar resolución fuzzy independientemente)
    IF v_up_method IN ('structured_id_invalid', 'product_not_validated') THEN
      v_up_id   := NULL;
      v_up_conf := NULL;
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 1 (legacy): catalog_variant_id → offering con match_state='matched'
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NULL AND v_item.catalog_variant_id IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.id = v_item.catalog_variant_id AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 2 (legacy): supplier_ref → offering con match_state='matched'
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- LEVEL 3: ILIKE fuzzy sobre nombre_canonico / familia de UPs validated
    -- Solo para líneas sin IDs estructurados válidos
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.6::numeric, 'fuzzy_fallback'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'validated'
        AND (
          up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%'
          OR (v_item.familia IS NOT NULL AND up.familia ILIKE '%' || v_item.familia || '%')
        )
      ORDER BY
        CASE WHEN up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%' THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    -- Registrar no_match si ningún nivel resolvió y no hay método especial
    IF v_up_id IS NULL AND v_up_method IS NULL THEN
      v_up_method := 'no_match';
    END IF;

    -- ───────────────────────────────────────────────────────────────────────
    -- Resolver alternativas de proveedor para el UP encontrado
    -- ───────────────────────────────────────────────────────────────────────
    IF v_up_id IS NOT NULL THEN
      v_alternatives := public._mkt_resolve_provider_alternatives(
        v_up_id, v_quote.org_id, COALESCE(v_item.cantidad, 1)
      );
    ELSE
      v_alternatives := '[]'::jsonb;
    END IF;

    INSERT INTO public.trade_marketplace_cart_items (
      cart_id, source_item_type, source_item_id,
      descripcion_original, cantidad, unidad,
      universal_product_id, up_match_confidence, up_match_method,
      provider_alternatives,
      selected_offering_id, selected_actor_id,
      precio_unitario_final
    ) VALUES (
      v_cart_id, 'quote_item', v_item.id,
      v_item.descripcion, COALESCE(v_item.cantidad, 1), 'ud',
      v_up_id, v_up_conf, v_up_method,
      v_alternatives,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'offering_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'actor_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0
        THEN (v_alternatives->0->>'precio_coste')::numeric ELSE v_item.precio_material END
    );
  END LOOP;

  RETURN v_cart_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN POST-DESPLIEGUE
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_arg_count integer;
BEGIN
  -- Verificar que la función existe con la firma correcta
  SELECT count(*)
  INTO v_arg_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'create_cart_from_quote'
    AND array_length(p.proargtypes, 1) = 1;

  IF v_arg_count = 0 THEN
    RAISE EXCEPTION 'V-1 FAIL — create_cart_from_quote no encontrada tras CREATE OR REPLACE';
  END IF;
  RAISE NOTICE 'V-1 OK — create_cart_from_quote existe';

  -- Verificar que el body incluye la palabra clave del Level 0
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'create_cart_from_quote'
      AND pg_get_functiondef(p.oid) LIKE '%structured_variant%'
  ) THEN
    RAISE EXCEPTION 'V-2 FAIL — función no contiene Level 0 (structured_variant no encontrado)';
  END IF;
  RAISE NOTICE 'V-2 OK — Level 0 presente en create_cart_from_quote';

  RAISE NOTICE '=== C-003 desplegado correctamente ===';
END $$;
