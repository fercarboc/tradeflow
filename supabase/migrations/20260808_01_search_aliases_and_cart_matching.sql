-- RC1-C.4A FASE A3
-- Añade search_aliases a UPs y mejora create_cart_from_quote:
--   - PATH 3 nuevo: alias match via search_aliases (confianza 0.75, min 8 chars)
--   - PATH 4: nombre prefix ILIKE conservado (confianza 0.55)
--   - Eliminado: fallback por familia (generaba falsos positivos)

ALTER TABLE public.trade_marketplace_universal_products
  ADD COLUMN IF NOT EXISTS search_aliases text[] DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote         RECORD;
  v_cart_id       uuid;
  v_item          RECORD;
  v_up_id         uuid;
  v_up_conf       numeric;
  v_up_method     text;
  v_alternatives  jsonb;
BEGIN
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
      AND COALESCE(cantidad, 0) > 0
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Sin materiales con cantidad válida pendientes de pedir.';
  END IF;

  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia, qi.supplier_ref,
           qi.catalog_variant_id, qi.precio_material, qi.universal_product_id
    FROM public.trade_quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.tipo = 'material'
      AND NOT COALESCE(qi.material_order_placed, false)
      AND COALESCE(qi.cantidad, 0) > 0
    ORDER BY qi.posicion
  LOOP
    v_up_id     := NULL;
    v_up_conf   := NULL;
    v_up_method := NULL;

    -- PATH 0: UP ya almacenado en el quote_item (preparado para fase futura)
    IF v_item.universal_product_id IS NOT NULL THEN
      v_up_id     := v_item.universal_product_id;
      v_up_conf   := 0.95;
      v_up_method := 'stored';
    END IF;

    -- PATH 1: catalog_variant_id → offering exacta
    IF v_up_id IS NULL AND v_item.catalog_variant_id IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.id = v_item.catalog_variant_id AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- PATH 2: supplier_ref → offering exacta
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- PATH 3: alias match via search_aliases (confianza 0.75, solo aliases >= 8 chars)
    IF v_up_id IS NULL THEN
      SELECT
        up.id,
        0.75::numeric,
        'alias'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'validated'
        AND array_length(up.search_aliases, 1) > 0
        AND EXISTS (
          SELECT 1 FROM unnest(up.search_aliases) AS alias_term
          WHERE length(alias_term) >= 8
            AND lower(v_item.descripcion) LIKE '%' || lower(alias_term) || '%'
        )
      ORDER BY (
        SELECT MAX(length(alias_term))
        FROM unnest(up.search_aliases) alias_term
        WHERE length(alias_term) >= 8
          AND lower(v_item.descripcion) LIKE '%' || lower(alias_term) || '%'
      ) DESC NULLS LAST
      LIMIT 1;
    END IF;

    -- PATH 4: nombre_canonico prefix ILIKE (confianza 0.55, fallback)
    -- Nota: eliminado fallback por familia para evitar falsos positivos
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.55::numeric, 'name_prefix'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'validated'
        AND up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 15) || '%'
      LIMIT 1;
    END IF;

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
      v_item.descripcion, v_item.cantidad, 'ud',
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
$function$;
