-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-2B · Fix migración 14
-- Bug: ba.org_id no existe en trade_marketplace_actors.
-- Fix: buyer_actor_id = NULL (campo nullable, no usado en Phase 0).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.mkt_fin_create_refund(
  p_supplier_order_id     uuid,
  p_refund_type           text,
  p_reason                text    DEFAULT NULL,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_shipping_refund_gross numeric DEFAULT 0,
  p_partial_amount_gross  numeric DEFAULT 0,
  p_idempotency_key       text    DEFAULT NULL,
  p_correlation_id        text    DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_so              RECORD;
  v_refund_id       uuid;
  v_refund_number   text;
  v_items_calc      jsonb;
  v_items_gross     numeric(15,4) := 0;
  v_items_net       numeric(15,4) := 0;
  v_items_tax       numeric(15,4) := 0;
  v_ship_gross      numeric(15,4) := 0;
  v_ship_net        numeric(15,4) := 0;
  v_ship_tax        numeric(15,4) := 0;
  v_line            jsonb;
  v_existing_refund jsonb;
  v_remaining_goods numeric(15,4);
  v_remaining_ship  numeric(15,4);
  v_refunded_goods  numeric(15,4);
  v_refunded_ship   numeric(15,4);
  v_source_goods    text;
  v_source_ship     text;
  v_corr            text;
BEGIN
  -- STRIPE_GATE
  IF public.mkt_fin_config_bool('payment.real_payments_enabled', false) THEN
    RAISE EXCEPTION 'REFUND_SIM_BLOCKED: real_payments_enabled=true. Solo simulación (STRIPE_GATE).';
  END IF;

  -- Validar refund_type
  IF p_refund_type NOT IN ('full_order','partial_amount','full_item','partial_quantity','shipping_only','mixed') THEN
    RAISE EXCEPTION 'INVALID_REFUND_TYPE: %', p_refund_type;
  END IF;

  -- Cargar supplier order
  -- FIX: buyer_actor_id = NULL (trade_marketplace_actors no tiene org_id; campo nullable en Phase 0)
  SELECT so.*, mo.org_id AS buyer_org_id, NULL::uuid AS buyer_actor_id
    INTO v_so
    FROM public.trade_marketplace_orders so
    JOIN public.trade_marketplace_master_orders mo ON mo.id = so.master_order_id
   WHERE so.id = p_supplier_order_id;

  IF v_so.id IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;
  IF v_so.financial_snapshot_at IS NULL THEN
    RAISE EXCEPTION 'NO_SNAPSHOT: supplier order % sin snapshot financiero — no refundable', p_supplier_order_id;
  END IF;

  -- Auth
  IF auth.uid() IS NOT NULL AND NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin puede crear refunds en simulation mode';
  END IF;

  -- Idempotencia: si ya existe este idempotency_key → replay
  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object('status', 'replayed', 'refund_id', r.id, 'refund_number', r.refund_number,
        'total_refund_amount', r.total_refund_amount)
      INTO v_existing_refund
      FROM public.trade_marketplace_refunds r
     WHERE r.idempotency_key = p_idempotency_key;

    IF v_existing_refund IS NOT NULL THEN
      PERFORM public.mkt_fin_audit('refund_idempotent_replay', 'refund', (v_existing_refund->>'refund_id')::uuid,
        NULL, NULL, jsonb_build_object('idempotency_key', p_idempotency_key),
        'Replay idempotente — refund ya procesado', p_correlation_id, NULL);
      RETURN v_existing_refund;
    END IF;
  END IF;

  -- Calcular totales ya devueltos
  SELECT COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = false), 0),
         COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = true), 0)
    INTO v_refunded_goods, v_refunded_ship
    FROM public.trade_marketplace_refund_items ri
    JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
   WHERE r.supplier_order_id = p_supplier_order_id
     AND r.status NOT IN ('rejected','cancelled','failed');

  v_remaining_goods := GREATEST(0, COALESCE(v_so.goods_gross_snapshot, 0) - v_refunded_goods);
  v_remaining_ship  := GREATEST(0, COALESCE(v_so.shipping_gross_snapshot, 0) - v_refunded_ship);

  -- ── Calcular importes según tipo ──────────────────────────────────────────

  IF p_refund_type = 'full_order' THEN
    v_items_gross := v_remaining_goods;
    v_items_net   := COALESCE(v_so.goods_net_snapshot, 0) -
      COALESCE((SELECT SUM(ri.net_refund) FROM public.trade_marketplace_refund_items ri
        JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
        WHERE r.supplier_order_id = p_supplier_order_id
          AND r.status NOT IN ('rejected','cancelled','failed') AND ri.is_shipping = false), 0);
    v_items_tax   := v_items_gross - v_items_net;
    v_ship_gross  := v_remaining_ship;
    v_ship_net    := COALESCE(v_so.shipping_net_snapshot, 0) -
      COALESCE((SELECT SUM(ri.net_refund) FROM public.trade_marketplace_refund_items ri
        JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
        WHERE r.supplier_order_id = p_supplier_order_id
          AND r.status NOT IN ('rejected','cancelled','failed') AND ri.is_shipping = true), 0);
    v_ship_tax    := v_ship_gross - v_ship_net;

  ELSIF p_refund_type = 'partial_amount' THEN
    IF p_partial_amount_gross <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: partial_amount_gross debe ser > 0';
    END IF;
    IF p_partial_amount_gross > v_remaining_goods + 0.005 THEN
      RAISE EXCEPTION 'EXCEEDS_REFUNDABLE: partial_amount=% > remaining_goods=%',
        p_partial_amount_gross, v_remaining_goods;
    END IF;
    v_items_gross := LEAST(p_partial_amount_gross, v_remaining_goods);
    v_items_net   := CASE WHEN COALESCE(v_so.goods_gross_snapshot, 0) > 0
      THEN ROUND(v_items_gross * COALESCE(v_so.goods_net_snapshot, 0) / v_so.goods_gross_snapshot, 4)
      ELSE 0 END;
    v_items_tax   := v_items_gross - v_items_net;

  ELSIF p_refund_type IN ('full_item','partial_quantity') THEN
    IF jsonb_array_length(p_items) = 0 THEN
      RAISE EXCEPTION 'NO_ITEMS: p_items vacío para refund_type=%', p_refund_type;
    END IF;
    v_items_calc  := public._mkt_calc_item_refund_amounts(p_supplier_order_id, p_items);
    v_items_gross := (v_items_calc->>'items_gross')::numeric;
    v_items_net   := (v_items_calc->>'items_net')::numeric;
    v_items_tax   := (v_items_calc->>'items_tax')::numeric;
    IF p_shipping_refund_gross > 0 THEN
      IF p_shipping_refund_gross > v_remaining_ship + 0.005 THEN
        RAISE EXCEPTION 'EXCEEDS_SHIP_REFUNDABLE: ship_refund=% > remaining=%',
          p_shipping_refund_gross, v_remaining_ship;
      END IF;
      v_ship_gross := LEAST(p_shipping_refund_gross, v_remaining_ship);
      v_ship_net   := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
        THEN ROUND(v_ship_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
        ELSE 0 END;
      v_ship_tax   := v_ship_gross - v_ship_net;
    END IF;

  ELSIF p_refund_type = 'shipping_only' THEN
    IF p_shipping_refund_gross <= 0 THEN
      RAISE EXCEPTION 'INVALID_AMOUNT: shipping_refund_gross debe ser > 0 para shipping_only';
    END IF;
    IF p_shipping_refund_gross > v_remaining_ship + 0.005 THEN
      RAISE EXCEPTION 'EXCEEDS_SHIP_REFUNDABLE: ship_refund=% > remaining=%',
        p_shipping_refund_gross, v_remaining_ship;
    END IF;
    v_ship_gross := LEAST(p_shipping_refund_gross, v_remaining_ship);
    v_ship_net   := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
      THEN ROUND(v_ship_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
      ELSE 0 END;
    v_ship_tax   := v_ship_gross - v_ship_net;

  ELSIF p_refund_type = 'mixed' THEN
    IF jsonb_array_length(p_items) = 0 AND p_shipping_refund_gross <= 0 THEN
      RAISE EXCEPTION 'NO_CONTENT: mixed requiere items y/o shipping_refund_gross';
    END IF;
    IF jsonb_array_length(p_items) > 0 THEN
      v_items_calc  := public._mkt_calc_item_refund_amounts(p_supplier_order_id, p_items);
      v_items_gross := (v_items_calc->>'items_gross')::numeric;
      v_items_net   := (v_items_calc->>'items_net')::numeric;
      v_items_tax   := (v_items_calc->>'items_tax')::numeric;
    END IF;
    IF p_shipping_refund_gross > 0 THEN
      IF p_shipping_refund_gross > v_remaining_ship + 0.005 THEN
        RAISE EXCEPTION 'EXCEEDS_SHIP_REFUNDABLE: ship_refund=% > remaining=%',
          p_shipping_refund_gross, v_remaining_ship;
      END IF;
      v_ship_gross := LEAST(p_shipping_refund_gross, v_remaining_ship);
      v_ship_net   := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
        THEN ROUND(v_ship_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
        ELSE 0 END;
      v_ship_tax   := v_ship_gross - v_ship_net;
    END IF;
  END IF;

  -- Validación final de importes
  IF v_items_gross + v_ship_gross <= 0 THEN
    RAISE EXCEPTION 'ZERO_REFUND: el importe total del refund es 0';
  END IF;
  IF v_items_gross > v_remaining_goods + 0.005 THEN
    RAISE EXCEPTION 'EXCEEDS_GOODS_REFUNDABLE: goods_refund=% > remaining=%', v_items_gross, v_remaining_goods;
  END IF;
  IF v_ship_gross > v_remaining_ship + 0.005 THEN
    RAISE EXCEPTION 'EXCEEDS_SHIP_REFUNDABLE: ship_refund=% > remaining=%', v_ship_gross, v_remaining_ship;
  END IF;

  -- ── Crear entidad refund ──────────────────────────────────────────────────

  v_refund_number := public.next_financial_doc_number('RF');
  v_corr := COALESCE(p_correlation_id, 'ref-' || v_refund_number);
  v_refund_id := gen_random_uuid();

  INSERT INTO public.trade_marketplace_refunds (
    id, refund_number,
    master_order_id, supplier_order_id, provider_actor_id, buyer_actor_id,
    currency, refund_type, reason, status,
    items_gross_amount, items_net_amount, items_tax_amount,
    shipping_gross_amount, shipping_net_amount, shipping_tax_amount,
    simulation_only, idempotency_key, correlation_id,
    requested_at, approved_at, processed_at,
    created_by, external_provider
  ) VALUES (
    v_refund_id, v_refund_number,
    v_so.master_order_id, p_supplier_order_id, v_so.actor_id, NULL,
    COALESCE(v_so.currency, 'EUR'), p_refund_type, p_reason, 'processed',
    v_items_gross, v_items_net, v_items_tax,
    v_ship_gross, v_ship_net, v_ship_tax,
    true, p_idempotency_key, v_corr,
    now(), now(), now(),
    auth.uid(), 'simulation'
  );

  -- ── Crear líneas de refund ────────────────────────────────────────────────

  IF p_refund_type IN ('full_item','partial_quantity') OR
     (p_refund_type = 'mixed' AND jsonb_array_length(p_items) > 0) THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_items_calc->'line_details') LOOP
      INSERT INTO public.trade_marketplace_refund_items (
        refund_id, order_item_id,
        quantity_original, quantity_refunded,
        unit_price_gross_snapshot, unit_price_net_snapshot, tax_rate_snapshot,
        net_refund, tax_refund, gross_refund, is_shipping, reason
      ) VALUES (
        v_refund_id, (v_line->>'order_item_id')::uuid,
        (v_line->>'quantity_original')::numeric, (v_line->>'quantity_refunded')::numeric,
        (v_line->>'unit_price_gross')::numeric, (v_line->>'unit_price_net')::numeric,
        NULL,
        (v_line->>'net_refund')::numeric, (v_line->>'tax_refund')::numeric,
        (v_line->>'gross_refund')::numeric, false, p_reason
      );
    END LOOP;

  ELSIF p_refund_type = 'full_order' THEN
    INSERT INTO public.trade_marketplace_refund_items (
      refund_id, order_item_id,
      quantity_original, quantity_refunded,
      unit_price_gross_snapshot, unit_price_net_snapshot,
      net_refund, tax_refund, gross_refund, is_shipping, reason
    )
    SELECT v_refund_id, oi.id,
      oi.cantidad,
      oi.cantidad - COALESCE(ri_agg.qty_refunded, 0),
      oi.precio_unitario, oi.precio_unitario_neto_snapshot,
      oi.item_net_snapshot - COALESCE(ri_agg.net_refunded, 0),
      (oi.item_gross_snapshot - COALESCE(ri_agg.gross_refunded, 0)) -
        (oi.item_net_snapshot - COALESCE(ri_agg.net_refunded, 0)),
      oi.item_gross_snapshot - COALESCE(ri_agg.gross_refunded, 0),
      false, p_reason
    FROM public.trade_marketplace_order_items oi
    LEFT JOIN (
      SELECT ri.order_item_id,
        COALESCE(SUM(ri.quantity_refunded), 0) AS qty_refunded,
        COALESCE(SUM(ri.gross_refund), 0)       AS gross_refunded,
        COALESCE(SUM(ri.net_refund), 0)         AS net_refunded
      FROM public.trade_marketplace_refund_items ri
      JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
      WHERE r.supplier_order_id = p_supplier_order_id
        AND r.status NOT IN ('rejected','cancelled','failed') AND ri.is_shipping = false
      GROUP BY ri.order_item_id
    ) ri_agg ON ri_agg.order_item_id = oi.id
    WHERE oi.order_id = p_supplier_order_id
      AND oi.cantidad - COALESCE(ri_agg.qty_refunded, 0) > 0;

  ELSIF p_refund_type = 'partial_amount' THEN
    INSERT INTO public.trade_marketplace_refund_items (
      refund_id, order_item_id, quantity_refunded,
      net_refund, tax_refund, gross_refund, is_shipping, reason
    ) VALUES (
      v_refund_id, NULL, NULL,
      v_items_net, v_items_tax, v_items_gross, false, p_reason
    );
  END IF;

  -- Fila de shipping si corresponde
  IF v_ship_gross > 0 THEN
    INSERT INTO public.trade_marketplace_refund_items (
      refund_id, order_item_id, quantity_refunded,
      net_refund, tax_refund, gross_refund, is_shipping, reason
    ) VALUES (
      v_refund_id, NULL, NULL,
      v_ship_net, v_ship_tax, v_ship_gross, true, p_reason
    );
  END IF;

  -- ── Ledger: entradas compensatorias (amounts NEGATIVOS) ───────────────────

  v_source_goods := 'ref-' || v_refund_number || '-' || p_supplier_order_id::text || '-GOODS';
  v_source_ship  := 'ref-' || v_refund_number || '-' || p_supplier_order_id::text || '-SHIP';

  IF v_items_gross > 0 THEN
    PERFORM public.mkt_fin_ledger_append(
      'GOODS_REFUND_REVERSAL', -v_items_gross, v_so.master_order_id,
      p_supplier_order_id, v_so.actor_id,
      'Devolución mercancía · gross negativo compensatorio · venta original intacta',
      v_corr, v_source_goods,
      NULL, 'simulation', v_refund_id::text, NULL,
      COALESCE(v_so.currency, 'EUR'), 'confirmed', now()
    );
  END IF;

  IF v_ship_gross > 0 THEN
    PERFORM public.mkt_fin_ledger_append(
      'SHIPPING_REFUND_REVERSAL', -v_ship_gross, v_so.master_order_id,
      p_supplier_order_id, v_so.actor_id,
      'Devolución portes · gross negativo compensatorio · original intacto',
      v_corr, v_source_ship,
      NULL, 'simulation', v_refund_id::text, NULL,
      COALESCE(v_so.currency, 'EUR'), 'confirmed', now()
    );
  END IF;

  -- ── Actualizar estados ────────────────────────────────────────────────────

  PERFORM public._mkt_update_so_refund_status(p_supplier_order_id);
  PERFORM public._mkt_update_master_refund_status(v_so.master_order_id);

  -- ── Audit y Outbox ────────────────────────────────────────────────────────

  PERFORM public.mkt_fin_audit(
    'refund_created', 'refund', v_refund_id, NULL, NULL,
    jsonb_build_object(
      'refund_number', v_refund_number, 'refund_type', p_refund_type,
      'supplier_order_id', p_supplier_order_id,
      'items_gross', v_items_gross, 'shipping_gross', v_ship_gross,
      'total_gross', v_items_gross + v_ship_gross,
      'commission_reversal', 0, 'simulation_only', true,
      'note', 'Real commission=0 → commission_reversal=0 (Phase 0)'
    ),
    'Refund simulado creado', v_corr, NULL
  );

  PERFORM public.mkt_fin_audit(
    'refund_processed', 'refund', v_refund_id, NULL, NULL,
    jsonb_build_object('refund_number', v_refund_number, 'ledger_goods_entry', v_source_goods,
      'ledger_ship_entry', v_source_ship),
    'Refund procesado: ledger compensatorio escrito', v_corr, NULL
  );

  PERFORM public.mkt_fin_outbox_publish('marketplace.refund.created',
    jsonb_build_object('refund_id', v_refund_id, 'refund_number', v_refund_number,
      'supplier_order_id', p_supplier_order_id, 'refund_type', p_refund_type,
      'total_gross', v_items_gross + v_ship_gross, 'simulation_only', true,
      'commission_reversal', 0),
    v_so.actor_id, v_so.buyer_org_id);

  PERFORM public.mkt_fin_outbox_publish('marketplace.refund.processed',
    jsonb_build_object('refund_id', v_refund_id, 'refund_number', v_refund_number,
      'provider_actor_id', v_so.actor_id,
      'total_gross', v_items_gross + v_ship_gross, 'simulation_only', true),
    v_so.actor_id, v_so.buyer_org_id);

  -- ── Balance rebuild (non-blocking) ────────────────────────────────────────

  BEGIN
    PERFORM public.mkt_fin_rebuild_provider_balance(v_so.actor_id, COALESCE(v_so.currency, 'EUR'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.mkt_fin_audit('refund_balance_refresh_failed', 'refund', v_refund_id,
      NULL, NULL, jsonb_build_object('error', SQLERRM),
      'Balance refresh fallido tras refund — rebuild manual posible', v_corr, NULL);
  END;

  RETURN jsonb_build_object(
    'status',             'created',
    'refund_id',          v_refund_id,
    'refund_number',      v_refund_number,
    'supplier_order_id',  p_supplier_order_id,
    'refund_type',        p_refund_type,
    'items_gross',        v_items_gross,
    'items_net',          v_items_net,
    'items_tax',          v_items_tax,
    'shipping_gross',     v_ship_gross,
    'shipping_net',       v_ship_net,
    'shipping_tax',       v_ship_tax,
    'total_refund_gross', v_items_gross + v_ship_gross,
    'commission_reversal', 0,
    'simulation_only',    true,
    'correlation_id',     v_corr
  );
END; $$;

COMMENT ON FUNCTION public.mkt_fin_create_refund IS
  'Crea un refund económico simulado (MP-FIN-2B). Atómico: entidad + líneas + ledger + balance. '
  'REFUND = movimiento compensatorio: la venta original NUNCA se modifica. '
  'Ledger entries tienen amount NEGATIVO (GOODS_REFUND_REVERSAL / SHIPPING_REFUND_REVERSAL). '
  'commission_reversal=0 (commission_real=0, Phase 0). STRIPE_GATE cerrado. '
  'Fix mig-14: buyer_actor_id=NULL (actors sin org_id en Phase 0).';

GRANT EXECUTE ON FUNCTION public.mkt_fin_create_refund TO authenticated;

COMMIT;
