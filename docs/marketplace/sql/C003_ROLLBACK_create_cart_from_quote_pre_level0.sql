-- ═══════════════════════════════════════════════════════════════════════════════
-- C-003 ROLLBACK — Versión anterior de create_cart_from_quote (pre-Level 0)
-- Guardar ANTES de aplicar 20260801_03_marketplace_structured_cart.sql
-- Restaura la función al estado de commit d445651 (post-ETAPA-2, pre-ETAPA-3)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_quote RECORD;
  v_cart_id uuid;
  v_item RECORD;
  v_up_id uuid;
  v_up_conf numeric;
  v_up_method text;
  v_alternatives jsonb;
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
  ) THEN
    RAISE EXCEPTION 'NO_MATERIALS: Todos los materiales ya fueron pedidos.';
  END IF;

  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, source_id, source_ref)
  VALUES (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia,
           qi.supplier_ref, qi.catalog_variant_id, qi.precio_material
      FROM public.trade_quote_items qi
     WHERE qi.quote_id = p_quote_id
       AND qi.tipo = 'material'
       AND NOT COALESCE(qi.material_order_placed, false)
     ORDER BY qi.posicion
  LOOP
    v_up_id := NULL; v_up_conf := NULL; v_up_method := NULL;

    IF v_item.catalog_variant_id IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
        INTO v_up_id, v_up_conf, v_up_method
        FROM public.trade_marketplace_supplier_offerings o
       WHERE o.id = v_item.catalog_variant_id AND o.match_state = 'matched'
       LIMIT 1;
    END IF;

    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
        INTO v_up_id, v_up_conf, v_up_method
        FROM public.trade_marketplace_supplier_offerings o
       WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
       LIMIT 1;
    END IF;

    IF v_up_id IS NULL THEN
      SELECT up.id, 0.6::numeric, 'semantic'::text
        INTO v_up_id, v_up_conf, v_up_method
        FROM public.trade_marketplace_universal_products up
       WHERE up.validation_state = 'validated'
         AND (
           v_item.descripcion ILIKE '%' || up.nombre_canonico || '%'
           OR up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%'
           OR (v_item.familia IS NOT NULL AND up.familia ILIKE '%' || v_item.familia || '%')
         )
       ORDER BY
         CASE
           WHEN v_item.descripcion ILIKE '%' || up.nombre_canonico || '%' THEN 0
           WHEN up.nombre_canonico ILIKE '%' || LEFT(v_item.descripcion, 20) || '%' THEN 1
           ELSE 2
         END
       LIMIT 1;
    END IF;

    IF v_up_id IS NOT NULL THEN
      v_alternatives := public._mkt_resolve_provider_alternatives(v_up_id, v_quote.org_id, COALESCE(v_item.cantidad, 1));
    ELSE
      v_alternatives := '[]'::jsonb;
    END IF;

    INSERT INTO public.trade_marketplace_cart_items (
      cart_id, source_item_type, source_item_id,
      descripcion_original, cantidad, unidad,
      universal_product_id, up_match_confidence, up_match_method,
      provider_alternatives, selected_offering_id, selected_actor_id, precio_unitario_final
    ) VALUES (
      v_cart_id, 'quote_item', v_item.id,
      v_item.descripcion, COALESCE(v_item.cantidad, 1), 'ud',
      v_up_id, v_up_conf, v_up_method,
      v_alternatives,
      CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid ELSE NULL END,
      CASE WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'precio_coste')::numeric ELSE v_item.precio_material END
    );
  END LOOP;

  RETURN v_cart_id;
END;
$function$;
