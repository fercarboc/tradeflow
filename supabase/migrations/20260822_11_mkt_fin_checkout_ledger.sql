-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1B.2 · Migración 11
-- Ledger inicial de simulación por checkout
-- ════════════════════════════════════════════════════════════════════════════
-- MODELO DE LEDGER ELEGIDO: B (Gross)
--
--   Por cada Supplier Order:
--     GOODS_ENTITLEMENT   = goods_gross_snapshot   (mercancía con IVA incluido)
--     SHIPPING_ENTITLEMENT = shipping_gross_snapshot (portes con IVA, sólo si > 0)
--
--   IVA NO es entrada separada en el ledger.
--   Se preserva en goods_tax_snapshot / shipping_tax_snapshot para reporting.
--   Evita duplicar el importe económico del pedido. [TAX_GATE]
--
-- RECONCILIACIÓN (fórmula):
--   INV-L01: GOODS_ENTITLEMENT(SO) + SHIPPING_ENTITLEMENT(SO) = provider_payable_snapshot(SO)
--            (Phase 0: commission_net_snapshot=0 → payable = goods_gross + shipping_gross)
--   INV-L02: SUM(economic_total(SO) for all SO) = master_order.checkout_gross_total
--   INV-L03: SUM(COMMISSION_ACCRUAL for master_order) = 0  (no written — INV-005)
--   INV-L04: TrabFlow real marketplace revenue = 0          (same, INV-001)
--
-- COMISIÓN SIMULADA: NO se escribe en el ledger.
--   Calculada via simulation_rate en reporting.
--   Objetivo: evitar ambigüedad entre comisión real (0) e hipótesis analítica.
--
-- IDEMPOTENCIA:
--   source_event_id = 'mkt-chk-{checkout_key}-{supplier_order_id}-{GOODS|SHIP}'
--   correlation_id  = 'mkt-chk-{checkout_key}'
--
-- STRIPE_GATE: real payments disabled → simulation mode obligatorio.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Función principal: post ledger inicial por checkout ────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_post_checkout_ledger(
  p_master_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master          RECORD;
  v_supplier        RECORD;
  v_correlation     text;
  v_entry_count     int := 0;
  v_suppliers_count int := 0;
  v_existing_count  int;
BEGIN
  -- ── 1. STRIPE_GATE: real payments must be disabled ─────────────────────────
  IF public.mkt_fin_config_bool('payment.real_payments_enabled', false) THEN
    RAISE EXCEPTION
      'LEDGER_SIM_BLOCKED: payment.real_payments_enabled=true. '
      'No se puede postear ledger simulado con pagos reales activos. (STRIPE_GATE)';
  END IF;

  -- ── 2. Cargar master order ─────────────────────────────────────────────────
  SELECT mo.*
    INTO v_master
    FROM public.trade_marketplace_master_orders mo
   WHERE mo.id = p_master_order_id;

  IF v_master.id IS NULL THEN
    RAISE EXCEPTION 'MASTER_ORDER_NOT_FOUND: %', p_master_order_id;
  END IF;

  -- ── 3. Auth check ──────────────────────────────────────────────────────────
  -- Cuando se llama desde checkout_cart_v2 (SECURITY DEFINER), auth.uid() es el comprador.
  -- Como standalone RPC, solo org member o platform_admin pueden llamarlo.
  IF auth.uid() IS NOT NULL AND NOT public._mkt_is_platform_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE user_id = auth.uid() AND org_id = v_master.org_id
    ) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: No es miembro de la organización del pedido';
    END IF;
  END IF;

  -- ── 4. Correlation ID ──────────────────────────────────────────────────────
  v_correlation := 'mkt-chk-' || v_master.checkout_key;

  -- ── 5. Idempotencia: ¿ya fue posteado? ────────────────────────────────────
  SELECT COUNT(*) INTO v_existing_count
    FROM public.trade_marketplace_ledger_entries
   WHERE correlation_id = v_correlation
     AND entry_type IN ('GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT');

  IF v_existing_count > 0 THEN
    PERFORM public.mkt_fin_audit(
      'checkout_ledger_replayed',
      'master_order',
      p_master_order_id,
      NULL, NULL,
      jsonb_build_object(
        'master_num',        v_master.numero,
        'correlation_id',    v_correlation,
        'existing_entries',  v_existing_count
      ),
      'Replay idempotente — ledger ya estaba posteado',
      v_correlation,
      NULL
    );
    RETURN jsonb_build_object(
      'status',              'replayed',
      'entry_count',         v_existing_count,
      'correlation_id',      v_correlation,
      'suppliers_processed', 0,
      'master_order_num',    v_master.numero,
      'model',               'B-gross'
    );
  END IF;

  -- ── 6. Audit: inicio del posting ───────────────────────────────────────────
  PERFORM public.mkt_fin_audit(
    'checkout_ledger_posting_started',
    'master_order',
    p_master_order_id,
    NULL, NULL,
    jsonb_build_object(
      'master_num',     v_master.numero,
      'correlation_id', v_correlation
    ),
    'Inicio posting ledger simulado',
    v_correlation,
    NULL
  );

  -- ── 7. Generar entradas por Supplier Order ─────────────────────────────────
  -- Modelo B (gross): IVA incluido en amount, NO como entrada separada.
  -- Solo supplier_orders con financial_snapshot_at IS NOT NULL (checkout completo).
  -- Commission=0 en Phase 0 → NO se escribe COMMISSION_ACCRUAL (INV-L03, INV-L04).
  FOR v_supplier IN
    SELECT so.id,
           so.actor_id,
           COALESCE(so.goods_gross_snapshot,    0) AS goods_gross,
           COALESCE(so.shipping_gross_snapshot,  0) AS shipping_gross,
           COALESCE(so.provider_payable_snapshot,0) AS provider_payable,
           COALESCE(so.currency, 'EUR')             AS currency
      FROM public.trade_marketplace_orders so
     WHERE so.master_order_id = p_master_order_id
       AND so.financial_snapshot_at IS NOT NULL
     ORDER BY so.created_at
  LOOP
    v_suppliers_count := v_suppliers_count + 1;

    -- 7a. GOODS_ENTITLEMENT: mercancía (GMV proveedor, IVA incluido) ──────────
    -- INV-001: este importe es GMV del proveedor, NO Revenue de TrabFlow.
    PERFORM public.mkt_fin_ledger_append(
      'GOODS_ENTITLEMENT',
      v_supplier.goods_gross,
      p_master_order_id,
      v_supplier.id,
      v_supplier.actor_id,
      'Mercancía checkout · gross = net+IVA [TAX_GATE] · GMV proveedor (INV-001)',
      v_correlation,
      'mkt-chk-' || v_master.checkout_key || '-' || v_supplier.id::text || '-GOODS',
      NULL,          -- compensates_entry_id
      'simulation',
      NULL,          -- external_id
      NULL,          -- external_type
      v_supplier.currency,
      'confirmed',
      v_master.created_at   -- occurred_at fijado al momento del checkout
    );
    v_entry_count := v_entry_count + 1;

    -- 7b. SHIPPING_ENTITLEMENT: portes (solo si > 0) ───────────────────────────
    -- INV-001: este importe es GMV portes del proveedor, NO Revenue de TrabFlow.
    IF v_supplier.shipping_gross > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'SHIPPING_ENTITLEMENT',
        v_supplier.shipping_gross,
        p_master_order_id,
        v_supplier.id,
        v_supplier.actor_id,
        'Portes checkout · gross = net+IVA [TAX_GATE] · GMV portes (INV-001)',
        v_correlation,
        'mkt-chk-' || v_master.checkout_key || '-' || v_supplier.id::text || '-SHIP',
        NULL,
        'simulation',
        NULL, NULL,
        v_supplier.currency,
        'confirmed',
        v_master.created_at
      );
      v_entry_count := v_entry_count + 1;
    END IF;

    -- 7c. COMMISSION: NO se escribe (commission_net_snapshot=0 en Phase 0)
    -- INV-L03: TrabFlow real commission = 0
    -- INV-L04: TrabFlow real marketplace revenue = 0
    -- Comisión simulada 2% → calculada via simulation_rate en reporting, NO en ledger.

  END LOOP;

  -- ── 8. Validar que hubo al menos un supplier procesado ────────────────────
  IF v_suppliers_count = 0 THEN
    RAISE EXCEPTION
      'NO_SNAPSHOTTED_ORDERS: El master order % no tiene supplier_orders con '
      'financial_snapshot_at. Verificar que checkout_cart_v2 completó correctamente.',
      p_master_order_id;
  END IF;

  -- ── 9. Outbox: evento neutro de simulación (no payment event) ─────────────
  PERFORM public.mkt_fin_outbox_publish(
    'marketplace.simulation.checkout_posted',
    jsonb_build_object(
      'master_order_id',     p_master_order_id,
      'master_order_num',    v_master.numero,
      'checkout_key',        v_master.checkout_key,
      'correlation_id',      v_correlation,
      'suppliers_processed', v_suppliers_count,
      'entry_count',         v_entry_count,
      'simulation_only',     true,
      'real_commission',     0,
      'real_revenue',        0,
      'ledger_model',        'B-gross',
      'note',                'Ledger simulado inicial. Pagos reales: desactivados (STRIPE_GATE).'
    ),
    NULL,
    v_master.org_id
  );

  -- ── 10. Audit: posting completado ─────────────────────────────────────────
  PERFORM public.mkt_fin_audit(
    'checkout_ledger_posted',
    'master_order',
    p_master_order_id,
    NULL, NULL,
    jsonb_build_object(
      'master_num',          v_master.numero,
      'correlation_id',      v_correlation,
      'entry_count',         v_entry_count,
      'suppliers_processed', v_suppliers_count,
      'ledger_model',        'B-gross',
      'inv_l03_ok',          true,
      'inv_l04_ok',          true
    ),
    'Ledger simulado inicial posteado correctamente',
    v_correlation,
    NULL
  );

  RETURN jsonb_build_object(
    'status',              'posted',
    'entry_count',         v_entry_count,
    'correlation_id',      v_correlation,
    'suppliers_processed', v_suppliers_count,
    'master_order_num',    v_master.numero,
    'model',               'B-gross'
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_post_checkout_ledger IS
  'Genera las entradas iniciales del ledger de simulación para un checkout completo. '
  'Modelo B (gross): GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT por supplier_order. '
  'IVA incluido en amount, no como entrada separada [TAX_GATE]. '
  'INV-L01: economic_total = provider_payable_snapshot. '
  'INV-L02: SUM(supplier totals) = checkout_gross_total. '
  'INV-L03/L04: COMMISSION_ACCRUAL no se escribe (commission=0 Phase 0). '
  'Idempotente: reintentar es seguro. STRIPE_GATE: solo funciona con real_payments=false.';

-- ── 2. Grants ─────────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.mkt_fin_post_checkout_ledger TO authenticated;

-- ── 3. Update checkout_cart_v2: añadir Step 7 — post ledger ──────────────────
-- El ledger se postea DENTRO de la transacción del checkout.
-- Si falla, se loguea pero NO bloquea el checkout (PL/pgSQL exception block).
-- Esta es la forma más robusta: ledger siempre se intenta escribir en el mismo
-- instante que completa el pedido, sin depender de llamadas externas.

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
  v_checkout_key := COALESCE(NULLIF(p_checkout_key, ''), gen_random_uuid()::text);

  -- ── STEP 1: Idempotencia ───────────────────────────────────────────────────
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

  UPDATE public.trade_marketplace_carts
     SET estado = 'checkout', updated_at = now()
   WHERE id = p_cart_id;

  -- ── STEP 3: Loop por proveedor ────────────────────────────────────────────
  FOR v_actor IN
    SELECT DISTINCT ci.selected_actor_id AS actor_id
      FROM public.trade_marketplace_cart_items ci
     WHERE ci.cart_id = p_cart_id AND ci.activo = true AND ci.selected_actor_id IS NOT NULL
  LOOP

    SELECT COALESCE(SUM(ci.total_linea), 0)
      INTO v_grand_total
      FROM public.trade_marketplace_cart_items ci
     WHERE ci.cart_id = p_cart_id
       AND ci.activo = true
       AND ci.selected_actor_id = v_actor.actor_id;

    v_portes := 0;
    SELECT cfg.coste_portes, cfg.portes_gratis_desde
      INTO v_cfg
      FROM public.trade_marketplace_supplier_config cfg
     WHERE cfg.actor_id = v_actor.actor_id;
    IF v_cfg.portes_gratis_desde IS NULL OR v_grand_total < v_cfg.portes_gratis_desde THEN
      v_portes := COALESCE(v_cfg.coste_portes, 0);
    END IF;

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

    INSERT INTO public.trade_marketplace_order_items (
      order_id, offering_id, universal_product_id,
      referencia, descripcion, unidad, cantidad,
      precio_unitario,
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
      COALESCE(o.precio_venta, ci.precio_unitario_final),
      CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.precio_unitario_final, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 4)
        ELSE COALESCE(ci.precio_unitario_final, 0)
      END,
      NULL,
      0,
      COALESCE(o.tax_rate, 21),
      CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.total_linea, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 2)
        ELSE COALESCE(ci.total_linea, 0)
      END,
      COALESCE(ci.total_linea, 0) - CASE
        WHEN COALESCE(o.tax_rate, 21) > 0
        THEN ROUND(COALESCE(ci.total_linea, 0) / (1.0 + COALESCE(o.tax_rate, 21) / 100.0), 2)
        ELSE COALESCE(ci.total_linea, 0)
      END,
      COALESCE(ci.total_linea, 0),
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

    SELECT
      COALESCE(SUM(oi.item_net_snapshot),  0),
      COALESCE(SUM(oi.item_tax_snapshot),  0),
      COALESCE(SUM(oi.item_gross_snapshot), 0)
    INTO v_order_goods_net, v_order_goods_tax, v_order_goods_gross
    FROM public.trade_marketplace_order_items oi
    WHERE oi.order_id = v_order_id;

    v_order_ship_net := ROUND(v_portes / 1.21, 2);
    v_order_ship_tax := v_portes - v_order_ship_net;

    PERFORM public.mkt_fin_write_order_financial_snapshot(
      v_order_id,
      v_order_goods_net,  v_order_goods_tax,  v_order_goods_gross,
      v_order_ship_net,   v_order_ship_tax,   v_portes,
      21.00,
      NULL,
      NULL
    );

    v_agg_goods_gross := v_agg_goods_gross + v_order_goods_gross;
    v_agg_goods_net   := v_agg_goods_net   + v_order_goods_net;
    v_agg_goods_tax   := v_agg_goods_tax   + v_order_goods_tax;
    v_agg_ship_gross  := v_agg_ship_gross  + v_portes;

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

  -- ── STEP 4: Crear Master Order ─────────────────────────────────────────────
  v_agg_ship_net := ROUND(v_agg_ship_gross / 1.21, 2);
  v_agg_ship_tax := v_agg_ship_gross - v_agg_ship_net;

  v_master_order := public.mkt_fin_create_master_order(
    v_checkout_key,
    v_cart.org_id,
    NULL,
    p_cart_id,
    p_buyer_snapshot,
    v_agg_goods_net,  v_agg_goods_tax,  v_agg_goods_gross,
    v_agg_ship_net,   v_agg_ship_tax,   v_agg_ship_gross,
    'EUR',
    NULL
  );

  -- ── STEP 5: Vincular supplier_orders al master_order ─────────────────────
  UPDATE public.trade_marketplace_orders
     SET master_order_id = v_master_order.id
   WHERE id = ANY(v_order_ids);

  INSERT INTO public.trade_marketplace_outbox (actor_id, org_id, event_type, payload)
  VALUES (
    NULL, v_cart.org_id, 'marketplace.master_order.created',
    jsonb_build_object(
      'master_order_id',    v_master_order.id,
      'master_order_num',   v_master_order.numero,
      'checkout_key',       v_checkout_key,
      'supplier_count',     array_length(v_order_ids, 1),
      'supplier_order_ids', v_order_ids,
      'goods_gross',        v_agg_goods_gross,
      'shipping_gross',     v_agg_ship_gross,
      'checkout_gross',     v_agg_goods_gross + v_agg_ship_gross,
      'currency',           'EUR',
      'payment_mode',       'simulation'
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

  -- ── STEP 7: Post simulation ledger (MP-FIN-1B.2) ─────────────────────────
  -- No-blocking: si falla el ledger, el checkout ya está confirmado.
  -- El ledger puede re-intentarse llamando mkt_fin_post_checkout_ledger directamente.
  BEGIN
    PERFORM public.mkt_fin_post_checkout_ledger(v_master_order.id);
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.mkt_fin_audit(
      'checkout_ledger_failed',
      'master_order',
      v_master_order.id,
      NULL, NULL,
      jsonb_build_object(
        'error',           SQLERRM,
        'sqlstate',        SQLSTATE,
        'master_num',      v_master_order.numero,
        'correlation_id',  'mkt-chk-' || v_checkout_key
      ),
      'Ledger posting falló tras checkout exitoso — reintentable',
      'mkt-chk-' || v_checkout_key,
      NULL
    );
  END;

  RETURN v_order_ids;
END;
$$;

COMMENT ON FUNCTION public.checkout_cart_v2 IS
  'Checkout atómico: crea supplier_orders, snapshots financieros, master_order '
  'y ledger simulado inicial (MP-FIN-1B.2). '
  'STEP 0-6: idéntico a MP-FIN-1B.1. '
  'STEP 7 (nuevo): mkt_fin_post_checkout_ledger — no-blocking. '
  'Backward compatible: pedidos legacy (sin master_order_id) intactos.';

COMMIT;
