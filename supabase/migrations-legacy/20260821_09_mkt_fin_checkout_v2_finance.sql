-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1B.1 · Migración 09
-- Integración financiera en checkout_cart_v2
-- ════════════════════════════════════════════════════════════════════════════
-- OBJETIVO: dentro de una única transacción SQL:
--   1. Garantizar checkout_key (DT-1A-2)
--   2. Insertar order_items CON snapshots financieros por ítem
--   3. Escribir snapshot financiero por supplier_order (INV-007)
--   4. Crear master_order tras el loop (INV-017 por checkout_key)
--   5. Vincular supplier_orders a master_order_id
-- BACKWARD COMPATIBLE:
--   - Misma firma de función, mismo tipo de retorno (uuid[])
--   - Pedidos legacy con master_order_id IS NULL continúan funcionando
--   - Medios de pago offline no se alteran
-- NO incluye: ledger, payment simulation, balances, settlements (→ MP-FIN-1B.2)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.checkout_cart_v2(
  p_cart_id        uuid,
  p_delivery_data  jsonb DEFAULT '{}',
  p_buyer_snapshot jsonb DEFAULT '{}',
  p_checkout_key   text  DEFAULT NULL
)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ── Core ───────────────────────────────────────────────────────────────────
  v_cart                  RECORD;
  v_actor                 RECORD;
  v_order_id              uuid;
  v_order_ids             uuid[]  := '{}';
  v_existing_ids          uuid[];
  v_checkout_key          text;
  v_source_quote_id       uuid;

  -- ── Por actor: logística ───────────────────────────────────────────────────
  v_grand_total           numeric;
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

  -- ── Por actor: financiero (MP-FIN-1B.1) ───────────────────────────────────
  v_order_goods_net       numeric(12,2);
  v_order_goods_tax       numeric(12,2);
  v_order_goods_gross     numeric(12,2);
  v_order_ship_net        numeric(12,2);
  v_order_ship_tax        numeric(12,2);

  -- ── Agregados para master_order ────────────────────────────────────────────
  v_agg_goods_net         numeric(12,2) := 0;
  v_agg_goods_tax         numeric(12,2) := 0;
  v_agg_goods_gross       numeric(12,2) := 0;
  v_agg_ship_gross        numeric(12,2) := 0;
  v_agg_ship_net          numeric(12,2);
  v_agg_ship_tax          numeric(12,2);

  -- ── Master Order ───────────────────────────────────────────────────────────
  v_master_order          public.trade_marketplace_master_orders;
BEGIN

  -- ── STEP 0: Garantizar checkout_key (DT-1A-2) ─────────────────────────────
  -- NULLIF convierte '' en NULL para que el COALESCE genere una clave nueva.
  -- Así checkout_key nunca es NULL ni vacío.
  v_checkout_key := COALESCE(NULLIF(p_checkout_key, ''), gen_random_uuid()::text);

  -- ── STEP 1: Idempotencia ───────────────────────────────────────────────────
  -- Primero: master_order existe → devolver supplier order IDs vinculados
  SELECT array_agg(so.id) INTO v_existing_ids
    FROM public.trade_marketplace_master_orders mo
    JOIN public.trade_marketplace_orders so ON so.master_order_id = mo.id
   WHERE mo.checkout_key = v_checkout_key
     AND mo.org_id IN (
       SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
     );
  IF array_length(v_existing_ids, 1) > 0 THEN
    RETURN v_existing_ids;
  END IF;

  -- Segundo: supplier orders legacy con checkout_key (sin master_order)
  SELECT array_agg(so.id) INTO v_existing_ids
    FROM public.trade_marketplace_orders so
   WHERE so.checkout_key = v_checkout_key
     AND so.org_id IN (
       SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
     );
  IF array_length(v_existing_ids, 1) > 0 THEN
    RETURN v_existing_ids;
  END IF;

  -- ── STEP 2: Validaciones de carrito ───────────────────────────────────────
  SELECT c.* INTO v_cart
    FROM public.trade_marketplace_carts c
    JOIN public.trade_org_members m ON m.org_id = c.org_id
   WHERE c.id = p_cart_id AND m.user_id = auth.uid()
   LIMIT 1;

  IF v_cart.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Carrito no encontrado.';
  END IF;

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

  -- Marcar carrito en proceso de checkout
  UPDATE public.trade_marketplace_carts
     SET estado = 'checkout', updated_at = now()
   WHERE id = p_cart_id;

  -- ── STEP 3: Loop por proveedor ────────────────────────────────────────────
  FOR v_actor IN
    SELECT DISTINCT ci.selected_actor_id AS actor_id
      FROM public.trade_marketplace_cart_items ci
     WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  LOOP

    -- 3.1: Subtotal del actor (gross = total_linea existente)
    SELECT COALESCE(SUM(ci.total_linea), 0)
      INTO v_grand_total
      FROM public.trade_marketplace_cart_items ci
     WHERE ci.cart_id = p_cart_id
       AND ci.activo = true
       AND ci.selected_actor_id = v_actor.actor_id;

    -- 3.2: Portes
    v_portes := 0;
    SELECT cfg.coste_portes, cfg.portes_gratis_desde
      INTO v_cfg
      FROM public.trade_marketplace_supplier_config cfg
     WHERE cfg.actor_id = v_actor.actor_id;
    IF v_cfg.portes_gratis_desde IS NULL OR v_grand_total < v_cfg.portes_gratis_desde THEN
      v_portes := COALESCE(v_cfg.coste_portes, 0);
    END IF;

    -- 3.3: Datos de entrega
    v_actor_delivery      := COALESCE(p_delivery_data->>(v_actor.actor_id::text), '{}');
    v_delivery_method     := v_actor_delivery->>'delivery_method';
    v_delivery_addr       := CASE
      WHEN v_actor_delivery ? 'delivery_address' THEN v_actor_delivery->'delivery_address'
      ELSE NULL END;
    v_pickup_point_id     := NULL;
    v_pickup_location_id  := CASE
      WHEN v_actor_delivery->>'pickup_location_id' IS NOT NULL
       AND v_actor_delivery->>'pickup_location_id' <> ''
      THEN (v_actor_delivery->>'pickup_location_id')::uuid
      ELSE NULL END;
    v_pickup_location_snap := CASE
      WHEN v_actor_delivery ? 'pickup_location_snapshot'
      THEN v_actor_delivery->'pickup_location_snapshot'
      ELSE NULL END;
    v_payment_method      := v_actor_delivery->>'payment_method';
    v_delivery_notas      := v_actor_delivery->>'notas';

    -- 3.4: Crear supplier order
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
      p_buyer_snapshot, v_payment_method, v_delivery_notas, v_checkout_key
    ) RETURNING id INTO v_order_id;

    -- 3.5: Insertar order items CON snapshots financieros (MP-FIN-1B.1)
    -- precio_unitario_final es el precio GROSS (con IVA) que paga el instalador.
    -- Fuente: resolución de precio efectivo al añadir el ítem al carrito.
    -- TAX_GATE: tax_rate se lee del offering (no hardcodeado).
    -- El net se deriva: gross / (1 + tax_rate/100).
    INSERT INTO public.trade_marketplace_order_items (
      order_id, offering_id, universal_product_id,
      referencia, descripcion, unidad, cantidad,
      precio_unitario,
      -- Snapshots financieros (INV-007: inmutables tras inserción)
      precio_unitario_lista_snapshot,
      precio_unitario_neto_snapshot,
      descuento_tipo_snapshot,
      descuento_importe_snapshot,
      tax_rate_snapshot,
      item_net_snapshot,
      item_tax_snapshot,
      item_gross_snapshot,
      commissionable_unit_price_net_snapshot,
      currency
    )
    SELECT
      v_order_id,
      ci.selected_offering_id,
      ci.universal_product_id,
      o.supplier_ref,
      COALESCE(ci.descripcion_compra, ci.descripcion_original),
      ci.unidad,
      ci.cantidad,
      COALESCE(ci.precio_unitario_final, 0),
      -- precio_unitario_lista_snapshot: precio de catálogo del proveedor (gross)
      COALESCE(o.precio_venta, ci.precio_unitario_final),
      -- precio_unitario_neto_snapshot: precio unitario neto del instalador
      CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.precio_unitario_final, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 4)
        ELSE COALESCE(ci.precio_unitario_final, 0)
      END,
      NULL,   -- descuento_tipo_snapshot: sin descuento formal en esta fase
      0,      -- descuento_importe_snapshot
      COALESCE(o.tax_rate, 21),
      -- item_net_snapshot: importe neto de la línea
      CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.total_linea, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 2)
        ELSE COALESCE(ci.total_linea, 0)
      END,
      -- item_tax_snapshot: IVA de la línea
      COALESCE(ci.total_linea, 0) - CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.total_linea, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 2)
        ELSE COALESCE(ci.total_linea, 0)
      END,
      -- item_gross_snapshot: total de la línea (gross, fuente canónica)
      COALESCE(ci.total_linea, 0),
      -- commissionable_unit_price_net_snapshot: precio neto unitario (base comisionable, INV-006)
      CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.precio_unitario_final, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 4)
        ELSE COALESCE(ci.precio_unitario_final, 0)
      END,
      'EUR'
    FROM public.trade_marketplace_cart_items ci
    LEFT JOIN public.trade_marketplace_supplier_offerings o ON o.id = ci.selected_offering_id
    WHERE ci.cart_id = p_cart_id
      AND ci.activo = true
      AND ci.selected_actor_id = v_actor.actor_id;

    -- 3.6: Calcular totales del supplier order desde items insertados (INV-003)
    SELECT
      COALESCE(SUM(oi.item_net_snapshot),   0),
      COALESCE(SUM(oi.item_tax_snapshot),   0),
      COALESCE(SUM(oi.item_gross_snapshot),  0)
    INTO v_order_goods_net, v_order_goods_tax, v_order_goods_gross
    FROM public.trade_marketplace_order_items oi
    WHERE oi.order_id = v_order_id;

    -- 3.7: Shipping net/tax del supplier order
    -- [TAX_GATE]: tipo de IVA para portes pendiente de dictamen fiscal.
    -- Se usa el tipo_rate del pedido (21%) como hipótesis hasta TAX_GATE.
    -- Si v_portes=0, net=tax=0.
    v_order_ship_net := ROUND(v_portes / 1.21, 2);
    v_order_ship_tax := v_portes - v_order_ship_net;

    -- 3.8: Escribir snapshot financiero del supplier order (INV-007)
    -- commission_rate=0 real, sim_commission calculada separadamente (INV-005).
    -- master_order_id=NULL se completa después de crear el master_order.
    PERFORM public.mkt_fin_write_order_financial_snapshot(
      v_order_id,
      v_order_goods_net,  v_order_goods_tax,  v_order_goods_gross,
      v_order_ship_net,   v_order_ship_tax,   v_portes,
      21.00,  -- [TAX_GATE] tax_rate de pedido (hipótesis)
      NULL,   -- master_order_id: se vincula en STEP 5 con UPDATE
      NULL    -- commission_policy_id: usa política activa automáticamente
    );

    -- 3.9: Acumular totales para master_order
    v_agg_goods_gross := v_agg_goods_gross + v_order_goods_gross;
    v_agg_goods_net   := v_agg_goods_net   + v_order_goods_net;
    v_agg_goods_tax   := v_agg_goods_tax   + v_order_goods_tax;
    v_agg_ship_gross  := v_agg_ship_gross  + v_portes;

    -- 3.10: Notificación, eventos, outbox (sin cambios)
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
        'checkout_key',    v_checkout_key,
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

  -- ── STEP 4: Crear Master Order (idempotente por checkout_key) ─────────────
  -- Shipping agregado: net/tax derivado de gross total
  -- [TAX_GATE]: tipo de IVA para portes pendiente de dictamen.
  v_agg_ship_net := ROUND(v_agg_ship_gross / 1.21, 2);
  v_agg_ship_tax := v_agg_ship_gross - v_agg_ship_net;

  v_master_order := public.mkt_fin_create_master_order(
    v_checkout_key,
    v_cart.org_id,
    NULL,         -- guest_customer_id (compra autenticada)
    p_cart_id,
    p_buyer_snapshot,
    v_agg_goods_net,  v_agg_goods_tax,  v_agg_goods_gross,
    v_agg_ship_net,   v_agg_ship_tax,   v_agg_ship_gross,
    'EUR',
    NULL          -- delivery_address global (cada supplier_order tiene la suya)
  );

  -- ── STEP 5: Vincular supplier_orders al master_order ─────────────────────
  -- El trigger trg_mkt_fin_protect_snapshots solo bloquea cambios en campos
  -- _snapshot. Actualizar master_order_id está permitido (INV-007 preservado).
  UPDATE public.trade_marketplace_orders
     SET master_order_id = v_master_order.id
   WHERE id = ANY(v_order_ids);

  -- Publicar evento descriptivo del master_order (sin pago real — INV-005)
  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (
    NULL, v_cart.org_id, 'marketplace.master_order.created',
    jsonb_build_object(
      'master_order_id',  v_master_order.id,
      'master_order_num', v_master_order.numero,
      'checkout_key',     v_checkout_key,
      'supplier_count',   array_length(v_order_ids, 1),
      'supplier_order_ids', v_order_ids,
      'goods_gross',      v_agg_goods_gross,
      'shipping_gross',   v_agg_ship_gross,
      'checkout_gross',   v_agg_goods_gross + v_agg_ship_gross,
      'currency',         'EUR',
      'payment_mode',     'simulation'
    )
  );

  -- ── STEP 6: Actualizaciones post-checkout ─────────────────────────────────
  IF v_source_quote_id IS NOT NULL THEN
    UPDATE public.trade_quote_items
       SET material_order_placed = true
     WHERE quote_id = v_source_quote_id
       AND id IN (
         SELECT ci.source_item_id
           FROM public.trade_marketplace_cart_items ci
          WHERE ci.cart_id = p_cart_id
            AND ci.source_item_type = 'quote_item'
            AND ci.activo = true
            AND ci.source_item_id IS NOT NULL
       );
  END IF;

  UPDATE public.trade_marketplace_carts
     SET estado = 'ordered', ordered_at = now(), updated_at = now()
   WHERE id = p_cart_id;

  RETURN v_order_ids;
END;
$$;

COMMENT ON FUNCTION public.checkout_cart_v2 IS
  'Checkout multiproveedor. MP-FIN-1B.1: crea master_order + snapshots financieros.
   Atomicidad: toda la operación en una transacción. Rollback si falla cualquier paso.
   Idempotencia: mismo checkout_key devuelve los mismos order_ids sin duplicar.
   DT-1A-2 resuelto: COALESCE(NULLIF(p_checkout_key,''), gen_random_uuid()) garantiza key.
   INV-005: comisión real=0. INV-007: snapshots inmutables. INV-017: idempotencia.
   Medios de pago offline (cuenta_proveedor, transferencia) sin cambios.
   NO ledger, NO pago simulado (→ MP-FIN-1B.2).';

COMMIT;
