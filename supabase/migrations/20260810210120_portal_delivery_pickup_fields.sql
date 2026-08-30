
-- 1. Añadir columnas de pickup_location a trade_marketplace_orders
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS pickup_location_id       uuid REFERENCES public.trade_marketplace_supplier_locations(id),
  ADD COLUMN IF NOT EXISTS pickup_location_snapshot jsonb;

-- 2. Actualizar checkout_cart_v2 para guardar pickup_location
CREATE OR REPLACE FUNCTION public.checkout_cart_v2(
  p_cart_id        uuid,
  p_delivery_data  jsonb  DEFAULT '{}'::jsonb,
  p_buyer_snapshot jsonb  DEFAULT '{}'::jsonb,
  p_checkout_key   text   DEFAULT NULL::text
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart                  RECORD;
  v_actor                 RECORD;
  v_order_id              uuid;
  v_order_ids             uuid[] := '{}';
  v_existing_ids          uuid[];
  v_grand_total           numeric;
  v_source_quote_id       uuid;
  v_actor_delivery        jsonb;
  v_delivery_method       text;
  v_delivery_addr         jsonb;
  v_pickup_point_id       uuid;
  v_pickup_location_id    uuid;
  v_pickup_location_snap  jsonb;
  v_payment_method        text;
  v_delivery_notas        text;
  v_portes                numeric;
  v_cfg                   RECORD;
BEGIN
  -- Idempotencia: si ya existe un pedido con este checkout_key, devolver sus IDs
  IF p_checkout_key IS NOT NULL THEN
    SELECT array_agg(mo.id) INTO v_existing_ids
    FROM public.trade_marketplace_orders mo
    WHERE mo.checkout_key = p_checkout_key
      AND mo.org_id IN (
        SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
      );
    IF array_length(v_existing_ids, 1) > 0 THEN
      RETURN v_existing_ids;
    END IF;
  END IF;

  -- Verificar acceso y que el carrito esté activo
  SELECT c.* INTO v_cart
  FROM public.trade_marketplace_carts c
  JOIN public.trade_org_members m ON m.org_id = c.org_id
  WHERE c.id = p_cart_id AND m.user_id = auth.uid()
  LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado.';
  END IF;

  -- Carrito ya procesado → devolver los pedidos existentes de este carrito
  IF v_cart.estado = 'ordered' THEN
    SELECT array_agg(mo.id) INTO v_existing_ids
    FROM public.trade_marketplace_orders mo
    WHERE (mo.cart_id = p_cart_id OR mo.cart_id_v2 = p_cart_id);
    IF array_length(v_existing_ids, 1) > 0 THEN
      RETURN v_existing_ids;
    END IF;
  END IF;

  IF v_cart.estado NOT IN ('active', 'reviewing') THEN
    RAISE EXCEPTION 'CART_NOT_READY: El carrito no está en estado activo (estado: %)', v_cart.estado;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_cart_items
    WHERE cart_id = p_cart_id AND activo = true AND selected_actor_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'NO_ITEMS: No hay ítems con proveedor seleccionado.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trade_marketplace_cart_items ci
    JOIN public.trade_marketplace_actors a ON a.id = ci.selected_actor_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
      AND a.estado != 'active'
  ) THEN
    RAISE EXCEPTION 'ACTOR_INACTIVE: Uno o más proveedores seleccionados ya no están activos.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trade_marketplace_cart_items ci
    JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_offering_id IS NOT NULL
      AND o.activa = false
  ) THEN
    RAISE EXCEPTION 'OFFERING_INACTIVE: Una o más offerings seleccionadas ya no están disponibles.';
  END IF;

  IF v_cart.source_type = 'quote' THEN
    v_source_quote_id := v_cart.source_id;
  END IF;

  UPDATE public.trade_marketplace_carts SET estado = 'checkout', updated_at = now()
  WHERE id = p_cart_id;

  FOR v_actor IN
    SELECT DISTINCT ci.selected_actor_id AS actor_id
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  LOOP
    SELECT COALESCE(SUM(ci.total_linea), 0) INTO v_grand_total
    FROM public.trade_marketplace_cart_items ci
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    v_portes := 0;
    SELECT cfg.coste_portes, cfg.portes_gratis_desde INTO v_cfg
    FROM public.trade_marketplace_supplier_config cfg WHERE cfg.actor_id = v_actor.actor_id;
    IF v_cfg.portes_gratis_desde IS NULL OR v_grand_total < v_cfg.portes_gratis_desde THEN
      v_portes := COALESCE(v_cfg.coste_portes, 0);
    END IF;

    v_actor_delivery       := COALESCE(p_delivery_data->>(v_actor.actor_id::text), '{}');
    v_delivery_method      := v_actor_delivery->>'delivery_method';
    v_delivery_addr        := CASE
      WHEN v_actor_delivery ? 'delivery_address' THEN v_actor_delivery->'delivery_address'
      ELSE NULL
    END;
    -- pickup_point_id: FK a tabla vacía — siempre null
    v_pickup_point_id      := NULL;
    -- pickup_location_id: FK a trade_marketplace_supplier_locations (RC1-C.5A)
    v_pickup_location_id   := CASE
      WHEN v_actor_delivery->>'pickup_location_id' IS NOT NULL AND v_actor_delivery->>'pickup_location_id' <> ''
      THEN (v_actor_delivery->>'pickup_location_id')::uuid
      ELSE NULL
    END;
    -- pickup_location_snapshot: snapshot en el momento del pedido
    v_pickup_location_snap := CASE
      WHEN v_actor_delivery ? 'pickup_location_snapshot' THEN v_actor_delivery->'pickup_location_snapshot'
      ELSE NULL
    END;
    v_payment_method       := v_actor_delivery->>'payment_method';
    v_delivery_notas       := v_actor_delivery->>'notas';

    INSERT INTO public.trade_marketplace_orders (
      actor_id, org_id, estado, subtotal, coste_envio, total,
      quote_id, cart_id, cart_id_v2,
      delivery_method, direccion_entrega, pickup_point_id,
      pickup_location_id, pickup_location_snapshot,
      buyer_snapshot, payment_method, delivery_notas, checkout_key
    ) VALUES (
      v_actor.actor_id, v_cart.org_id,
      'pending',
      v_grand_total, v_portes, v_grand_total + v_portes,
      v_source_quote_id, p_cart_id, p_cart_id,
      v_delivery_method, v_delivery_addr, v_pickup_point_id,
      v_pickup_location_id, v_pickup_location_snap,
      p_buyer_snapshot, v_payment_method, v_delivery_notas, p_checkout_key
    ) RETURNING id INTO v_order_id;

    INSERT INTO public.trade_marketplace_order_items (
      order_id, offering_id, universal_product_id,
      referencia, descripcion, unidad, cantidad, precio_unitario
    )
    SELECT
      v_order_id,
      ci.selected_offering_id,
      ci.universal_product_id,
      o.supplier_ref,
      COALESCE(ci.descripcion_compra, ci.descripcion_original),
      ci.unidad,
      ci.cantidad,
      COALESCE(ci.precio_unitario_final, 0)
    FROM public.trade_marketplace_cart_items ci
    LEFT JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id = v_actor.actor_id;

    INSERT INTO public.trade_marketplace_notifications (actor_id, tipo, titulo, cuerpo, ref_id, ref_tipo)
    VALUES (
      v_actor.actor_id, 'order_received',
      'Nuevo pedido recibido',
      'Has recibido un nuevo pedido desde el Marketplace de TrabFlow.',
      v_order_id, 'marketplace_order'
    );

    INSERT INTO public.trade_marketplace_order_events (
      order_id, tipo, from_estado, to_estado, actor_type, payload
    ) VALUES (
      v_order_id, 'order_created', NULL, 'pending', 'system',
      jsonb_build_object(
        'cart_id',         p_cart_id,
        'checkout_key',    p_checkout_key,
        'delivery_method', v_delivery_method,
        'payment_method',  v_payment_method,
        'source_type',     v_cart.source_type,
        'source_ref',      v_cart.source_ref
      )
    );

    INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
    VALUES (
      v_actor.actor_id, v_cart.org_id, 'order.created',
      jsonb_build_object(
        'order_id',        v_order_id,
        'cart_id',         p_cart_id,
        'org_id',          v_cart.org_id,
        'delivery_method', v_delivery_method,
        'payment_method',  v_payment_method
      )
    );

    v_order_ids := array_append(v_order_ids, v_order_id);
  END LOOP;

  IF v_source_quote_id IS NOT NULL THEN
    UPDATE public.trade_quote_items SET material_order_placed = true
    WHERE quote_id = v_source_quote_id
      AND id IN (
        SELECT ci.source_item_id FROM public.trade_marketplace_cart_items ci
        WHERE ci.cart_id = p_cart_id AND ci.source_item_type = 'quote_item'
          AND ci.activo = true AND ci.source_item_id IS NOT NULL
      );
  END IF;

  UPDATE public.trade_marketplace_carts
  SET estado = 'ordered', ordered_at = now(), updated_at = now()
  WHERE id = p_cart_id;

  RETURN v_order_ids;
END;
$$;

-- 3. Actualizar get_order_full_detail para incluir todos los campos de entrega
CREATE OR REPLACE FUNCTION public.get_order_full_detail(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order  RECORD;
  v_result jsonb;
BEGIN
  SELECT o.* INTO v_order
  FROM public.trade_marketplace_orders o
  WHERE o.id = p_order_id
    AND (
      EXISTS (SELECT 1 FROM public.trade_org_members m WHERE m.org_id = o.org_id AND m.user_id = auth.uid())
      OR public._mkt_supplier_member_check(o.actor_id)
    )
  LIMIT 1;

  IF v_order.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Pedido no encontrado o sin acceso.';
  END IF;

  SELECT jsonb_build_object(
    'order', jsonb_build_object(
      'id',                       v_order.id,
      'numero',                   v_order.numero,
      'estado',                   v_order.estado,
      'actor_id',                 v_order.actor_id,
      'actor_nombre',             a.nombre,
      'actor_verificado',         a.verificado,
      'org_id',                   v_order.org_id,
      'subtotal',                 v_order.subtotal,
      'coste_envio',              v_order.coste_envio,
      'total',                    v_order.total,
      'notas',                    v_order.notas,
      'notas_proveedor',          v_order.notas_proveedor,
      'tracking_ref',             v_order.tracking_ref,
      'tracking_url',             v_order.tracking_url,
      'delivery_address',         v_order.delivery_address,
      'delivery_method',          v_order.delivery_method,
      'payment_method',           v_order.payment_method,
      'delivery_notas',           v_order.delivery_notas,
      'direccion_entrega',        v_order.direccion_entrega,
      'pickup_location_id',       v_order.pickup_location_id,
      'pickup_location_snapshot', v_order.pickup_location_snapshot,
      'cancel_reason',            v_order.cancel_reason,
      'created_at',               v_order.created_at,
      'confirmed_at',             v_order.confirmed_at,
      'preparing_at',             v_order.preparing_at,
      'shipped_at',               v_order.shipped_at,
      'delivered_at',             v_order.delivered_at,
      'cancelled_at',             v_order.cancelled_at,
      'completed_at',             v_order.completed_at
    ),
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',             oi.id,
        'referencia',     oi.referencia,
        'descripcion',    oi.descripcion,
        'unidad',         oi.unidad,
        'cantidad',       oi.cantidad,
        'precio_unitario',oi.precio_unitario,
        'precio_total',   oi.precio_total
      ) ORDER BY oi.created_at)
      FROM public.trade_marketplace_order_items oi
      WHERE oi.order_id = p_order_id
    ), '[]'),
    'events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id',          ev.id,
        'tipo',        ev.tipo,
        'from_estado', ev.from_estado,
        'to_estado',   ev.to_estado,
        'actor_type',  ev.actor_type,
        'notas',       ev.notas,
        'created_at',  ev.created_at
      ) ORDER BY ev.created_at DESC)
      FROM public.trade_marketplace_order_events ev
      WHERE ev.order_id = p_order_id
    ), '[]'),
    'supplier_config', (
      SELECT jsonb_build_object(
        'horario_entrega',      cfg.horario_entrega,
        'mensaje_instaladores', cfg.mensaje_instaladores,
        'permite_recogida',     cfg.permite_recogida
      )
      FROM public.trade_marketplace_supplier_config cfg
      WHERE cfg.actor_id = v_order.actor_id
    )
  ) INTO v_result
  FROM public.trade_marketplace_actors a
  WHERE a.id = v_order.actor_id;

  RETURN v_result;
END;
$$;
;
