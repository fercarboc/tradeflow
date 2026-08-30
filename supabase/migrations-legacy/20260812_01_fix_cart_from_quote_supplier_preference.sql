-- RC1-C.6.6 FASE 5 — Fix create_cart_from_quote: supplier preference + alias coverage
--
-- Causa raíz:
--   1. SAL-FON-014 (mampara) y SON-LUM-102 (punto de luz) no existen en el catálogo.
--   2. El fallback alias/name_prefix ignora supplier_key → asigna actor incorrecto.
--   3. Aliases "mampara de ducha" y "punto de luz" no estaban en los UPs correspondientes.
--   4. Carrito 5be3c927 (PRE-2026-095) tiene resoluciones incorrectas (stale).
--
-- Fix:
--   A. Añadir aliases exactas a UPs para cubrir descripciones "Suministro X".
--   B. create_cart_from_quote: PATH PREFERRED — tras resolver alternativas via UP,
--      preferir la alternativa cuyo supplier_catalog.supplier_key coincida con
--      el supplier_key almacenado en el quote_item (IDs canónicos, no heurística por nombre).
--   C. PATH 4 mejorado: strip prefijo "Suministro " antes del match de nombre.
--   D. Cancelar carrito stale PRE-2026-095.

-- ── A. Search aliases ──────────────────────────────────────────────────────────

-- UP 0bb256f1 "Mampara de ducha": añadir alias que matchea "Suministro mampara de ducha"
UPDATE public.trade_marketplace_universal_products
SET search_aliases = array_append(search_aliases, 'mampara de ducha')
WHERE id = '0bb256f1-4bc0-47e4-b97d-ce22eecc70da'
  AND NOT ('mampara de ducha' = ANY(search_aliases));

-- UP 2b3abdfb "Downlight LED empotrar 9W": añadir alias que matchea "punto de luz"
UPDATE public.trade_marketplace_universal_products
SET search_aliases = array_append(search_aliases, 'punto de luz')
WHERE id = '2b3abdfb-de6e-4174-8b0b-075e0273c0ac'
  AND NOT ('punto de luz' = ANY(search_aliases));

-- ── D. Cancelar carrito stale PRE-2026-095 ────────────────────────────────────
-- Tiene items con resolución incorrecta (actor equivocado / unresolved).
-- La nueva lógica generará un carrito correcto en la próxima llamada a create_cart_from_quote.
UPDATE public.trade_marketplace_carts
SET estado = 'cancelled', updated_at = now()
WHERE id = '5be3c927-412c-46a8-8986-ebec51711bd0'
  AND estado = 'active';

-- ── B+C. create_cart_from_quote actualizada ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_cart_from_quote(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote               RECORD;
  v_cart_id             uuid;
  v_existing_cart_id    uuid;
  v_item                RECORD;
  v_up_id               uuid;
  v_up_conf             numeric;
  v_up_method           text;
  v_alternatives        jsonb;
  v_dir_offering_id     uuid;
  v_dir_actor_id        uuid;
  v_dir_actor_nombre    text;
  v_dir_actor_slug      text;
  v_dir_actor_verif     boolean;
  v_dir_precio          numeric;
  v_dir_stock           boolean;
  v_dir_plazo           int;
  v_pref_offering_id    uuid;   -- offering del proveedor preferido (supplier_key del quote_item)
  v_pref_actor_id       uuid;
  v_pref_precio         numeric;
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

  -- Reutilizar carrito activo existente (evita ghost carts)
  SELECT id INTO v_existing_cart_id
  FROM public.trade_marketplace_carts
  WHERE source_type = 'quote'
    AND source_id   = p_quote_id
    AND org_id      = v_quote.org_id
    AND estado IN ('active', 'reviewing')
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_cart_id IS NOT NULL THEN
    RETURN v_existing_cart_id;
  END IF;

  INSERT INTO public.trade_marketplace_carts
    (org_id, user_id, source_type, source_id, source_ref)
  VALUES
    (v_quote.org_id, auth.uid(), 'quote', p_quote_id, v_quote.numero)
  RETURNING id INTO v_cart_id;

  FOR v_item IN
    SELECT qi.id, qi.descripcion, qi.cantidad, qi.familia,
           qi.supplier_ref, qi.supplier_key,
           qi.catalog_variant_id, qi.precio_material, qi.universal_product_id
    FROM public.trade_quote_items qi
    WHERE qi.quote_id = p_quote_id
      AND qi.tipo = 'material'
      AND NOT COALESCE(qi.material_order_placed, false)
      AND COALESCE(qi.cantidad, 0) > 0
    ORDER BY qi.posicion
  LOOP
    v_up_id            := NULL;
    v_up_conf          := NULL;
    v_up_method        := NULL;
    v_dir_offering_id  := NULL;
    v_dir_actor_id     := NULL;
    v_dir_actor_nombre := NULL;
    v_dir_actor_slug   := NULL;
    v_dir_actor_verif  := false;
    v_dir_precio       := NULL;
    v_dir_stock        := true;
    v_dir_plazo        := 3;
    v_pref_offering_id := NULL;
    v_pref_actor_id    := NULL;
    v_pref_precio      := NULL;

    -- PATH 0: UP ya almacenado en el quote_item
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

    -- PATH 2: direct_ref exacto (supplier_ref + supplier_key → INSERT directo y CONTINUE)
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL AND v_item.supplier_key IS NOT NULL
       AND v_item.supplier_key NOT IN ('catalogo_base', 'propio', '')
    THEN
      SELECT
        o.id, a.id, a.nombre, a.slug, COALESCE(a.verificado, false),
        COALESCE(o.precio_coste, o.precio_profesional_neto, v_item.precio_material),
        COALESCE(o.stock_disponible, true), COALESCE(o.plazo_entrega_dias, 3)
      INTO
        v_dir_offering_id, v_dir_actor_id, v_dir_actor_nombre,
        v_dir_actor_slug, v_dir_actor_verif, v_dir_precio, v_dir_stock, v_dir_plazo
      FROM public.trade_marketplace_supplier_offerings o
      JOIN public.trade_supplier_catalogs sc ON sc.id = o.supplier_catalog_id
      JOIN public.trade_marketplace_actors a  ON a.supplier_catalog_id = sc.id
      WHERE o.supplier_ref = v_item.supplier_ref
        AND sc.supplier_key = v_item.supplier_key
        AND o.activa = true
        AND a.estado = 'active'
        AND a.actor_type = 'supplier'
      ORDER BY CASE o.match_state WHEN 'matched' THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    IF v_dir_offering_id IS NOT NULL THEN
      INSERT INTO public.trade_marketplace_cart_items (
        cart_id, source_item_type, source_item_id,
        descripcion_original, cantidad, unidad,
        universal_product_id, up_match_confidence, up_match_method,
        provider_alternatives,
        selected_offering_id, selected_actor_id, precio_unitario_final
      ) VALUES (
        v_cart_id, 'quote_item', v_item.id,
        v_item.descripcion, v_item.cantidad, 'ud',
        NULL, NULL, 'direct_ref',
        jsonb_build_array(jsonb_build_object(
          'offering_id',         v_dir_offering_id,
          'actor_id',            v_dir_actor_id,
          'actor_nombre',        v_dir_actor_nombre,
          'actor_slug',          COALESCE(v_dir_actor_slug, ''),
          'actor_verificado',    v_dir_actor_verif,
          'precio_coste',        COALESCE(v_dir_precio, 0),
          'precio_venta',        COALESCE(v_dir_precio, 0),
          'unidad',              'ud',
          'delivery_days',       v_dir_plazo,
          'stock_ok',            v_dir_stock,
          'stock_cantidad',      null,
          'permite_entrega',     true,
          'pedido_minimo',       null,
          'portes_gratis_desde', null,
          'score',               100
        )),
        v_dir_offering_id, v_dir_actor_id,
        COALESCE(v_dir_precio, v_item.precio_material)
      );
      CONTINUE;
    END IF;

    -- PATH 2.5: supplier_ref global (sin constraint de supplier_key)
    IF v_up_id IS NULL AND v_item.supplier_ref IS NOT NULL THEN
      SELECT o.universal_product_id, o.match_confidence, o.match_method
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_supplier_offerings o
      WHERE o.supplier_ref = v_item.supplier_ref AND o.match_state = 'matched'
      LIMIT 1;
    END IF;

    -- PATH 3: alias match (alias >= 8 chars, longest match wins)
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.75::numeric, 'alias'::text
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

    -- PATH 4: nombre_canonico prefix ILIKE
    -- Mejora: quitar prefijo "Suministro " antes del match para mayor precisión.
    -- "Suministro mampara de ducha" → "mampara de ducha" → ILIKE '%mampara de%' ✓
    IF v_up_id IS NULL THEN
      SELECT up.id, 0.55::numeric, 'name_prefix'::text
      INTO v_up_id, v_up_conf, v_up_method
      FROM public.trade_marketplace_universal_products up
      WHERE up.validation_state = 'validated'
        AND up.nombre_canonico ILIKE '%' ||
            LEFT(regexp_replace(v_item.descripcion, '(?i)^Suministro\s+', ''), 12) || '%'
      LIMIT 1;
    END IF;

    -- Resolver alternativas de proveedor para el UP encontrado
    IF v_up_id IS NOT NULL THEN
      v_alternatives := public._mkt_resolve_provider_alternatives(
        v_up_id, v_quote.org_id, COALESCE(v_item.cantidad, 1)
      );

      -- PATH PREFERRED: si el quote_item tiene supplier_key definido,
      -- seleccionar la alternativa de ese proveedor (por supplier_catalog.supplier_key canónico).
      -- Garantiza INV-PM1: presupuesto → carrito mantiene el proveedor seleccionado.
      IF v_item.supplier_key IS NOT NULL
         AND v_item.supplier_key NOT IN ('catalogo_base', 'propio', '')
         AND jsonb_array_length(v_alternatives) > 0 THEN
        SELECT
          (alt->>'offering_id')::uuid,
          (alt->>'actor_id')::uuid,
          (alt->>'precio_coste')::numeric
        INTO v_pref_offering_id, v_pref_actor_id, v_pref_precio
        FROM jsonb_array_elements(v_alternatives) alt
        JOIN public.trade_marketplace_supplier_offerings o  ON o.id = (alt->>'offering_id')::uuid
        JOIN public.trade_supplier_catalogs sc              ON sc.id = o.supplier_catalog_id
        WHERE sc.supplier_key = v_item.supplier_key
        LIMIT 1;
      END IF;
    ELSE
      v_alternatives := '[]'::jsonb;
    END IF;

    INSERT INTO public.trade_marketplace_cart_items (
      cart_id, source_item_type, source_item_id,
      descripcion_original, cantidad, unidad,
      universal_product_id, up_match_confidence, up_match_method,
      provider_alternatives,
      selected_offering_id, selected_actor_id, precio_unitario_final
    ) VALUES (
      v_cart_id, 'quote_item', v_item.id,
      v_item.descripcion, v_item.cantidad, 'ud',
      v_up_id, v_up_conf, v_up_method,
      v_alternatives,
      -- PATH PREFERRED tiene prioridad sobre el mejor score global
      CASE
        WHEN v_pref_offering_id IS NOT NULL THEN v_pref_offering_id
        WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'offering_id')::uuid
        ELSE NULL
      END,
      CASE
        WHEN v_pref_actor_id IS NOT NULL THEN v_pref_actor_id
        WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'actor_id')::uuid
        ELSE NULL
      END,
      CASE
        WHEN v_pref_precio IS NOT NULL THEN v_pref_precio
        WHEN jsonb_array_length(v_alternatives) > 0 THEN (v_alternatives->0->>'precio_coste')::numeric
        ELSE v_item.precio_material
      END
    );
  END LOOP;

  RETURN v_cart_id;
END;
$function$;
