-- RC1-C.1.c: Fix create_cart_from_quote para líneas con cantidad = 0
-- Causa raíz de "Error al preparar el carrito" en presupuestos con líneas qty=0.
-- La constraint CHECK (cantidad > 0) en cart_items rechazaba el INSERT.
-- Fix: filtrar qi.cantidad <= 0 en el bucle de importación y en el chequeo NO_MATERIALS.

CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote         RECORD;
  v_cart_id       uuid;
  v_item          RECORD;
  v_up_id         uuid;
  v_up_conf       numeric;
  v_up_method     text;
  v_alternatives  jsonb;
BEGIN
  -- Verificar que el presupuesto pertenece a la org del usuario
  SELECT q.id, q.org_id, q.numero, q.estado
  INTO v_quote
  FROM public.trade_quotes q
  JOIN public.trade_org_members m ON m.org_id = q.org_id
  WHERE q.id = p_quote_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_quote.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Presupuesto no encontrado o sin acceso.';
  END IF;

  -- Verificar que hay materiales sin pedir con cantidad válida
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_quote_items
    WHERE quote_id = p_quote_id
      AND tipo = 'material'
      AND NOT COALESCE(material_order_placed, false)
      AND COALESCE(cantidad, 0) > 0   -- ignorar líneas con cantidad nula o cero
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Sin materiales con cantidad válida pendientes de pedir.';
  END IF;

  -- Crear carrito
  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  -- Importar líneas de material con cantidad > 0
  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia, qi.supplier_ref,
           qi.catalog_variant_id, qi.precio_material
    FROM public.trade_quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.tipo = 'material'
      AND NOT COALESCE(qi.material_order_placed, false)
      AND COALESCE(qi.cantidad, 0) > 0   -- excluir qty nula o cero
    ORDER BY qi.posicion
  LOOP
    -- Intentar matching con UP
    v_up_id     := NULL;
    v_up_conf   := NULL;
    v_up_method := NULL;

    -- Buscar UP por catalog_variant_id si existe
    IF v_item.catalog_variant_id IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.id = v_item.catalog_variant_id AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- Si no, buscar por supplier_ref
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- Fallback: búsqueda semántica en nombre canonico del UP
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.6::numeric, 'semantic'::text
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

    -- Resolver alternativas de proveedor para el UP encontrado
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
      -- Pre-seleccionar el proveedor con mejor score si hay alternativas
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
$$;
