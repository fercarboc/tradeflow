
BEGIN;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'not_refunded'
    CHECK (refund_status IN ('not_refunded','partially_refunded','fully_refunded')),
  ADD COLUMN IF NOT EXISTS total_refunded_amount numeric(15,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.trade_marketplace_orders.refund_status IS
  'Estado financiero de devoluciones: not_refunded | partially_refunded | fully_refunded';
COMMENT ON COLUMN public.trade_marketplace_orders.total_refunded_amount IS
  'Suma acumulada de refunds procesados (gross). Desnormalización para consultas rápidas.';

ALTER TABLE public.trade_marketplace_master_orders
  ADD COLUMN IF NOT EXISTS refund_aggregate_status text NOT NULL DEFAULT 'not_refunded'
    CHECK (refund_aggregate_status IN ('not_refunded','partially_refunded','fully_refunded'));

COMMENT ON COLUMN public.trade_marketplace_master_orders.refund_aggregate_status IS
  'Estado agregado de devoluciones de todos los supplier orders del master.';

CREATE TABLE IF NOT EXISTS public.trade_marketplace_refunds (
  id                   uuid          NOT NULL DEFAULT gen_random_uuid(),
  refund_number        text          NOT NULL,
  master_order_id      uuid          NOT NULL,
  supplier_order_id    uuid          NOT NULL,
  provider_actor_id    uuid          NOT NULL,
  buyer_actor_id       uuid,
  currency             char(3)       NOT NULL DEFAULT 'EUR',
  refund_type          text          NOT NULL,
  reason               text,
  status               text          NOT NULL DEFAULT 'processed',
  items_gross_amount   numeric(15,4) NOT NULL DEFAULT 0,
  items_net_amount     numeric(15,4) NOT NULL DEFAULT 0,
  items_tax_amount     numeric(15,4) NOT NULL DEFAULT 0,
  shipping_gross_amount numeric(15,4) NOT NULL DEFAULT 0,
  shipping_net_amount   numeric(15,4) NOT NULL DEFAULT 0,
  shipping_tax_amount   numeric(15,4) NOT NULL DEFAULT 0,
  total_refund_amount  numeric(15,4)
    GENERATED ALWAYS AS (items_gross_amount + shipping_gross_amount) STORED,
  simulation_only      bool          NOT NULL DEFAULT true,
  idempotency_key      text,
  correlation_id       text,
  requested_at         timestamptz   NOT NULL DEFAULT now(),
  approved_at          timestamptz,
  processed_at         timestamptz,
  cancelled_at         timestamptz,
  created_by           uuid,
  external_provider    text          NOT NULL DEFAULT 'simulation',
  external_id          text,
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  metadata             jsonb,
  PRIMARY KEY (id),
  UNIQUE (refund_number),
  UNIQUE (idempotency_key),
  CONSTRAINT fk_refund_master   FOREIGN KEY (master_order_id)   REFERENCES public.trade_marketplace_master_orders(id),
  CONSTRAINT fk_refund_supplier FOREIGN KEY (supplier_order_id) REFERENCES public.trade_marketplace_orders(id),
  CONSTRAINT fk_refund_provider FOREIGN KEY (provider_actor_id) REFERENCES public.trade_marketplace_actors(id),
  CONSTRAINT chk_refund_type CHECK (refund_type IN (
    'full_order','partial_amount','full_item','partial_quantity','shipping_only','mixed'
  )),
  CONSTRAINT chk_refund_status CHECK (status IN (
    'requested','approved','processing','processed','rejected','cancelled','failed'
  )),
  CONSTRAINT chk_refund_items_nn    CHECK (items_gross_amount >= 0),
  CONSTRAINT chk_refund_ship_nn     CHECK (shipping_gross_amount >= 0),
  CONSTRAINT chk_refund_items_nn2   CHECK (items_net_amount >= 0),
  CONSTRAINT chk_refund_ship_nn2    CHECK (shipping_net_amount >= 0),
  CONSTRAINT chk_refund_positive    CHECK (items_gross_amount + shipping_gross_amount > 0),
  CONSTRAINT chk_refund_simulation  CHECK (simulation_only = true)
);

COMMENT ON TABLE public.trade_marketplace_refunds IS
  'Entidad de negocio de devoluciones económicas. '
  'La venta original NUNCA se modifica (REFUND = movimiento compensatorio). '
  'Pertenece siempre a un supplier_order. simulation_only=true (STRIPE_GATE). '
  'Phase 2B: Commission real=0 -> commission_reversal=0 (Phase 0).';

CREATE TABLE IF NOT EXISTS public.trade_marketplace_refund_items (
  id                        uuid          NOT NULL DEFAULT gen_random_uuid(),
  refund_id                 uuid          NOT NULL,
  order_item_id             uuid,
  quantity_original         numeric(15,4),
  quantity_refunded         numeric(15,4),
  unit_price_gross_snapshot numeric(15,4),
  unit_price_net_snapshot   numeric(15,4),
  tax_rate_snapshot         numeric(7,4),
  net_refund                numeric(15,4)  NOT NULL DEFAULT 0,
  tax_refund                numeric(15,4)  NOT NULL DEFAULT 0,
  gross_refund              numeric(15,4)  NOT NULL DEFAULT 0,
  is_shipping               bool          NOT NULL DEFAULT false,
  reason                    text,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  CONSTRAINT fk_ri_refund    FOREIGN KEY (refund_id)     REFERENCES public.trade_marketplace_refunds(id),
  CONSTRAINT fk_ri_order_item FOREIGN KEY (order_item_id) REFERENCES public.trade_marketplace_order_items(id) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT chk_ri_gross_nn CHECK (gross_refund >= 0),
  CONSTRAINT chk_ri_net_nn   CHECK (net_refund >= 0),
  CONSTRAINT chk_ri_tax_nn   CHECK (tax_refund >= 0)
);

COMMENT ON TABLE public.trade_marketplace_refund_items IS
  'Lineas de devolucion vinculadas a trade_marketplace_order_items. '
  'Los importes se calculan siempre desde snapshots, NUNCA desde catalogo actual. '
  'order_item_id=NULL para shipping-only o partial_amount sin linea especifica.';

CREATE INDEX IF NOT EXISTS idx_refunds_supplier_order ON public.trade_marketplace_refunds (supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_master_order   ON public.trade_marketplace_refunds (master_order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_provider       ON public.trade_marketplace_refunds (provider_actor_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status         ON public.trade_marketplace_refunds (status);
CREATE INDEX IF NOT EXISTS idx_refunds_idempotency    ON public.trade_marketplace_refunds (idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_refund_items_refund    ON public.trade_marketplace_refund_items (refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_items_order     ON public.trade_marketplace_refund_items (order_item_id) WHERE order_item_id IS NOT NULL;

ALTER TABLE public.trade_marketplace_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_refund_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refund_select_provider"
  ON public.trade_marketplace_refunds FOR SELECT TO authenticated
  USING (
    provider_actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

CREATE POLICY "refund_admin_all"
  ON public.trade_marketplace_refunds FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

CREATE POLICY "refund_items_select"
  ON public.trade_marketplace_refund_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_marketplace_refunds r
     WHERE r.id = refund_id
       AND (r.provider_actor_id = ANY(public._mkt_actor_ids_for_user())
            OR public._mkt_is_platform_admin())
  ));

CREATE POLICY "refund_items_admin"
  ON public.trade_marketplace_refund_items FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

CREATE OR REPLACE FUNCTION public._trg_set_refund_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_refund_updated_at
  BEFORE UPDATE ON public.trade_marketplace_refunds
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_refund_updated_at();

CREATE OR REPLACE FUNCTION public._mkt_update_so_refund_status(p_supplier_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_refunded   numeric(15,4);
  v_original_payable numeric(15,4);
  v_new_status       text;
BEGIN
  SELECT COALESCE(SUM(r.total_refund_amount), 0) INTO v_total_refunded
    FROM public.trade_marketplace_refunds r
   WHERE r.supplier_order_id = p_supplier_order_id
     AND r.status NOT IN ('rejected','cancelled','failed');

  SELECT COALESCE(provider_payable_snapshot, 0) INTO v_original_payable
    FROM public.trade_marketplace_orders WHERE id = p_supplier_order_id;

  IF v_original_payable > 0 AND (v_original_payable - v_total_refunded) < 0.005 THEN
    v_new_status := 'fully_refunded';
  ELSIF v_total_refunded > 0 THEN
    v_new_status := 'partially_refunded';
  ELSE
    v_new_status := 'not_refunded';
  END IF;

  UPDATE public.trade_marketplace_orders
     SET refund_status = v_new_status, total_refunded_amount = v_total_refunded
   WHERE id = p_supplier_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public._mkt_update_master_refund_status(p_master_order_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total_so    int;
  v_full_cnt    int;
  v_partial_cnt int;
  v_new_status  text;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE refund_status = 'fully_refunded'),
         COUNT(*) FILTER (WHERE refund_status IN ('partially_refunded','fully_refunded'))
    INTO v_total_so, v_full_cnt, v_partial_cnt
    FROM public.trade_marketplace_orders
   WHERE master_order_id = p_master_order_id AND financial_snapshot_at IS NOT NULL;

  IF v_total_so > 0 AND v_full_cnt = v_total_so THEN
    v_new_status := 'fully_refunded';
  ELSIF v_partial_cnt > 0 THEN
    v_new_status := 'partially_refunded';
  ELSE
    v_new_status := 'not_refunded';
  END IF;

  UPDATE public.trade_marketplace_master_orders
     SET refund_aggregate_status = v_new_status
   WHERE id = p_master_order_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_fin_get_refundable_summary(
  p_supplier_order_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_so            RECORD;
  v_items         jsonb;
  v_refunded_goods  numeric(15,4) := 0;
  v_refunded_ship   numeric(15,4) := 0;
  v_has_access    boolean;
BEGIN
  SELECT so.*, mo.numero AS master_numero
    INTO v_so
    FROM public.trade_marketplace_orders so
    JOIN public.trade_marketplace_master_orders mo ON mo.id = so.master_order_id
   WHERE so.id = p_supplier_order_id;

  IF v_so.id IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;

  v_has_access := public._mkt_is_platform_admin()
    OR v_so.actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'ACCESS_DENIED: sin acceso al supplier order %', p_supplier_order_id;
  END IF;

  IF v_so.financial_snapshot_at IS NULL THEN
    RAISE EXCEPTION 'NO_SNAPSHOT: supplier order sin snapshot financiero, no refundable';
  END IF;

  SELECT
    COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = false), 0),
    COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = true), 0)
  INTO v_refunded_goods, v_refunded_ship
  FROM public.trade_marketplace_refund_items ri
  JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
  WHERE r.supplier_order_id = p_supplier_order_id
    AND r.status NOT IN ('rejected','cancelled','failed');

  SELECT jsonb_agg(jsonb_build_object(
    'order_item_id',       oi.id,
    'descripcion',         oi.descripcion,
    'quantity_original',   oi.cantidad,
    'quantity_refunded',   COALESCE(ri_agg.qty_refunded, 0),
    'quantity_remaining',  oi.cantidad - COALESCE(ri_agg.qty_refunded, 0),
    'unit_price_gross',    oi.precio_unitario,
    'unit_price_net',      oi.precio_unitario_neto_snapshot,
    'tax_rate',            oi.tax_rate_snapshot,
    'gross_original',      oi.item_gross_snapshot,
    'net_original',        oi.item_net_snapshot,
    'gross_refunded',      COALESCE(ri_agg.gross_refunded, 0),
    'net_refunded',        COALESCE(ri_agg.net_refunded, 0),
    'gross_remaining',     oi.item_gross_snapshot - COALESCE(ri_agg.gross_refunded, 0),
    'net_remaining',       oi.item_net_snapshot - COALESCE(ri_agg.net_refunded, 0),
    'fully_refunded',      (oi.cantidad - COALESCE(ri_agg.qty_refunded, 0)) <= 0
  ) ORDER BY oi.created_at)
  INTO v_items
  FROM public.trade_marketplace_order_items oi
  LEFT JOIN (
    SELECT ri.order_item_id,
      COALESCE(SUM(ri.quantity_refunded), 0)  AS qty_refunded,
      COALESCE(SUM(ri.gross_refund), 0)        AS gross_refunded,
      COALESCE(SUM(ri.net_refund), 0)          AS net_refunded
    FROM public.trade_marketplace_refund_items ri
    JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
    WHERE r.supplier_order_id = p_supplier_order_id
      AND r.status NOT IN ('rejected','cancelled','failed')
      AND ri.is_shipping = false AND ri.order_item_id IS NOT NULL
    GROUP BY ri.order_item_id
  ) ri_agg ON ri_agg.order_item_id = oi.id
  WHERE oi.order_id = p_supplier_order_id;

  RETURN jsonb_build_object(
    'supplier_order_id',          p_supplier_order_id,
    'master_order_numero',        v_so.master_numero,
    'provider_actor_id',          v_so.actor_id,
    'currency',                   v_so.currency,
    'original_goods_gross',       COALESCE(v_so.goods_gross_snapshot, 0),
    'original_goods_net',         COALESCE(v_so.goods_net_snapshot, 0),
    'original_shipping_gross',    COALESCE(v_so.shipping_gross_snapshot, 0),
    'original_shipping_net',      COALESCE(v_so.shipping_net_snapshot, 0),
    'original_total_gross',       COALESCE(v_so.provider_payable_snapshot, 0),
    'refunded_goods_gross',       v_refunded_goods,
    'refunded_shipping_gross',    v_refunded_ship,
    'total_refunded_gross',       v_refunded_goods + v_refunded_ship,
    'remaining_goods_refundable', GREATEST(0, COALESCE(v_so.goods_gross_snapshot, 0) - v_refunded_goods),
    'remaining_ship_refundable',  GREATEST(0, COALESCE(v_so.shipping_gross_snapshot, 0) - v_refunded_ship),
    'remaining_total_refundable', GREATEST(0, COALESCE(v_so.provider_payable_snapshot, 0) - v_refunded_goods - v_refunded_ship),
    'refund_status',              v_so.refund_status,
    'items',                      COALESCE(v_items, '[]'::jsonb)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_get_refundable_summary TO authenticated;

CREATE OR REPLACE FUNCTION public._mkt_calc_item_refund_amounts(
  p_supplier_order_id uuid,
  p_items             jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item          jsonb;
  v_oi            RECORD;
  v_already_refunded_qty    numeric(15,4);
  v_already_refunded_gross  numeric(15,4);
  v_already_refunded_net    numeric(15,4);
  v_qty_refunded  numeric(15,4);
  v_remaining_qty numeric(15,4);
  v_gross         numeric(15,4);
  v_net           numeric(15,4);
  v_tax           numeric(15,4);
  v_total_gross   numeric(15,4) := 0;
  v_total_net     numeric(15,4) := 0;
  v_total_tax     numeric(15,4) := 0;
  v_details       jsonb         := '[]'::jsonb;
  v_is_last       bool;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT oi.*, oi.item_gross_snapshot AS line_gross, oi.item_net_snapshot AS line_net
      INTO v_oi
      FROM public.trade_marketplace_order_items oi
     WHERE oi.id = (v_item->>'order_item_id')::uuid
       AND oi.order_id = p_supplier_order_id;

    IF v_oi.id IS NULL THEN
      RAISE EXCEPTION 'ORDER_ITEM_NOT_FOUND: % no pertenece al supplier_order %',
        v_item->>'order_item_id', p_supplier_order_id;
    END IF;

    SELECT COALESCE(SUM(ri.quantity_refunded), 0),
           COALESCE(SUM(ri.gross_refund), 0),
           COALESCE(SUM(ri.net_refund), 0)
      INTO v_already_refunded_qty, v_already_refunded_gross, v_already_refunded_net
      FROM public.trade_marketplace_refund_items ri
      JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
     WHERE ri.order_item_id = v_oi.id
       AND r.status NOT IN ('rejected','cancelled','failed')
       AND ri.is_shipping = false;

    v_remaining_qty := v_oi.cantidad - v_already_refunded_qty;

    IF v_item->>'quantity_refunded' IS NULL THEN
      v_qty_refunded := v_remaining_qty;
    ELSE
      v_qty_refunded := (v_item->>'quantity_refunded')::numeric;
    END IF;

    IF v_qty_refunded <= 0 THEN
      RAISE EXCEPTION 'INVALID_QUANTITY: quantity_refunded debe ser > 0 para item %', v_oi.id;
    END IF;
    IF v_qty_refunded > v_remaining_qty THEN
      RAISE EXCEPTION 'EXCEEDS_REFUNDABLE_QTY: item % qty_refunded=% > remaining=%',
        v_oi.id, v_qty_refunded, v_remaining_qty;
    END IF;

    v_is_last := (v_qty_refunded >= v_remaining_qty);

    IF v_is_last THEN
      v_gross := v_oi.line_gross - v_already_refunded_gross;
      v_net   := v_oi.line_net  - v_already_refunded_net;
    ELSE
      v_gross := ROUND(v_oi.precio_unitario * v_qty_refunded, 4);
      v_net   := ROUND(v_oi.precio_unitario_neto_snapshot * v_qty_refunded, 4);
    END IF;
    v_tax := v_gross - v_net;

    v_total_gross := v_total_gross + v_gross;
    v_total_net   := v_total_net   + v_net;
    v_total_tax   := v_total_tax   + v_tax;

    v_details := v_details || jsonb_build_array(jsonb_build_object(
      'order_item_id',         v_oi.id,
      'quantity_original',     v_oi.cantidad,
      'quantity_refunded',     v_qty_refunded,
      'quantity_remaining_after', v_remaining_qty - v_qty_refunded,
      'unit_price_gross',      v_oi.precio_unitario,
      'unit_price_net',        v_oi.precio_unitario_neto_snapshot,
      'tax_rate',              v_oi.tax_rate_snapshot,
      'gross_refund',          v_gross,
      'net_refund',            v_net,
      'tax_refund',            v_tax,
      'is_last_refund_for_item', v_is_last
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'items_gross', v_total_gross,
    'items_net',   v_total_net,
    'items_tax',   v_total_tax,
    'line_details', v_details
  );
END; $$;

CREATE OR REPLACE FUNCTION public.mkt_fin_preview_refund(
  p_supplier_order_id     uuid,
  p_refund_type           text,
  p_items                 jsonb   DEFAULT '[]'::jsonb,
  p_shipping_refund_gross numeric DEFAULT 0,
  p_partial_amount_gross  numeric DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_summary       jsonb;
  v_items_calc    jsonb;
  v_items_gross   numeric(15,4) := 0;
  v_items_net     numeric(15,4) := 0;
  v_items_tax     numeric(15,4) := 0;
  v_ship_gross    numeric(15,4) := 0;
  v_ship_net      numeric(15,4) := 0;
  v_ship_tax      numeric(15,4) := 0;
  v_so            RECORD;
  v_balance_before numeric(15,4);
  v_balance_after  numeric(15,4);
BEGIN
  v_summary := public.mkt_fin_get_refundable_summary(p_supplier_order_id);

  SELECT so.* INTO v_so FROM public.trade_marketplace_orders so WHERE id = p_supplier_order_id;

  IF p_refund_type = 'full_order' THEN
    v_items_gross := (v_summary->>'remaining_goods_refundable')::numeric;
    v_items_net   := COALESCE(v_so.goods_net_snapshot, 0) -
      COALESCE((SELECT SUM(ri.net_refund) FROM public.trade_marketplace_refund_items ri
        JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
        WHERE r.supplier_order_id = p_supplier_order_id
          AND r.status NOT IN ('rejected','cancelled','failed') AND ri.is_shipping = false), 0);
    v_items_tax   := v_items_gross - v_items_net;
    v_ship_gross  := (v_summary->>'remaining_ship_refundable')::numeric;
    v_ship_net    := COALESCE(v_so.shipping_net_snapshot, 0) -
      COALESCE((SELECT SUM(ri.net_refund) FROM public.trade_marketplace_refund_items ri
        JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
        WHERE r.supplier_order_id = p_supplier_order_id
          AND r.status NOT IN ('rejected','cancelled','failed') AND ri.is_shipping = true), 0);
    v_ship_tax    := v_ship_gross - v_ship_net;

  ELSIF p_refund_type IN ('full_item','partial_quantity') THEN
    v_items_calc  := public._mkt_calc_item_refund_amounts(p_supplier_order_id, p_items);
    v_items_gross := (v_items_calc->>'items_gross')::numeric;
    v_items_net   := (v_items_calc->>'items_net')::numeric;
    v_items_tax   := (v_items_calc->>'items_tax')::numeric;
    IF p_shipping_refund_gross > 0 THEN
      v_ship_gross := p_shipping_refund_gross;
      v_ship_net   := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
        THEN ROUND(p_shipping_refund_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
        ELSE 0 END;
      v_ship_tax   := v_ship_gross - v_ship_net;
    END IF;

  ELSIF p_refund_type = 'shipping_only' THEN
    v_ship_gross := LEAST(p_shipping_refund_gross, (v_summary->>'remaining_ship_refundable')::numeric);
    v_ship_net   := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
      THEN ROUND(v_ship_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
      ELSE 0 END;
    v_ship_tax   := v_ship_gross - v_ship_net;

  ELSIF p_refund_type = 'partial_amount' THEN
    v_items_gross := LEAST(p_partial_amount_gross, (v_summary->>'remaining_goods_refundable')::numeric);
    v_items_net   := CASE WHEN COALESCE(v_so.goods_gross_snapshot, 0) > 0
      THEN ROUND(v_items_gross * COALESCE(v_so.goods_net_snapshot, 0) / v_so.goods_gross_snapshot, 4)
      ELSE 0 END;
    v_items_tax   := v_items_gross - v_items_net;

  ELSIF p_refund_type = 'mixed' THEN
    v_items_calc  := public._mkt_calc_item_refund_amounts(p_supplier_order_id, p_items);
    v_items_gross := (v_items_calc->>'items_gross')::numeric;
    v_items_net   := (v_items_calc->>'items_net')::numeric;
    v_items_tax   := (v_items_calc->>'items_tax')::numeric;
    v_ship_gross  := LEAST(p_shipping_refund_gross, (v_summary->>'remaining_ship_refundable')::numeric);
    v_ship_net    := CASE WHEN COALESCE(v_so.shipping_gross_snapshot, 0) > 0
      THEN ROUND(v_ship_gross * COALESCE(v_so.shipping_net_snapshot, 0) / v_so.shipping_gross_snapshot, 4)
      ELSE 0 END;
    v_ship_tax    := v_ship_gross - v_ship_net;
  END IF;

  SELECT COALESCE(pending_amount, 0) INTO v_balance_before
    FROM public.trade_marketplace_balances WHERE provider_actor_id = v_so.actor_id AND currency = 'EUR';

  v_balance_after := v_balance_before - v_items_gross - v_ship_gross;

  RETURN jsonb_build_object(
    'supplier_order_id',      p_supplier_order_id,
    'refund_type',            p_refund_type,
    'simulation_only',        true,
    'refundable_summary',     v_summary,
    'preview', jsonb_build_object(
      'items_gross',          v_items_gross,
      'items_net',            v_items_net,
      'items_tax',            v_items_tax,
      'shipping_gross',       v_ship_gross,
      'shipping_net',         v_ship_net,
      'shipping_tax',         v_ship_tax,
      'total_refund_gross',   v_items_gross + v_ship_gross,
      'line_details',         CASE WHEN v_items_calc IS NOT NULL THEN v_items_calc->'line_details' ELSE '[]'::jsonb END
    ),
    'balance_impact', jsonb_build_object(
      'provider_actor_id',    v_so.actor_id,
      'balance_before',       v_balance_before,
      'balance_after',        v_balance_after,
      'balance_change',       -(v_items_gross + v_ship_gross),
      'would_go_negative',    v_balance_after < 0
    ),
    'commission_note',        'commission_reversal=0 (commission_real=0, Phase 0)',
    'stripe_gate',            'CLOSED -- simulation only'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_preview_refund TO authenticated;

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
  IF public.mkt_fin_config_bool('payment.real_payments_enabled', false) THEN
    RAISE EXCEPTION 'REFUND_SIM_BLOCKED: real_payments_enabled=true. Solo simulacion (STRIPE_GATE).';
  END IF;

  IF p_refund_type NOT IN ('full_order','partial_amount','full_item','partial_quantity','shipping_only','mixed') THEN
    RAISE EXCEPTION 'INVALID_REFUND_TYPE: %', p_refund_type;
  END IF;

  SELECT so.*, mo.org_id AS buyer_org_id,
    (SELECT ba.id FROM public.trade_marketplace_actors ba WHERE ba.org_id = mo.org_id AND ba.actor_type = 'buyer' LIMIT 1) AS buyer_actor_id
    INTO v_so
    FROM public.trade_marketplace_orders so
    JOIN public.trade_marketplace_master_orders mo ON mo.id = so.master_order_id
   WHERE so.id = p_supplier_order_id;

  IF v_so.id IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;
  IF v_so.financial_snapshot_at IS NULL THEN
    RAISE EXCEPTION 'NO_SNAPSHOT: supplier order % sin snapshot financiero -- no refundable', p_supplier_order_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin puede crear refunds en simulation mode';
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT jsonb_build_object('status', 'replayed', 'refund_id', r.id, 'refund_number', r.refund_number,
        'total_refund_amount', r.total_refund_amount)
      INTO v_existing_refund
      FROM public.trade_marketplace_refunds r
     WHERE r.idempotency_key = p_idempotency_key;

    IF v_existing_refund IS NOT NULL THEN
      PERFORM public.mkt_fin_audit('refund_idempotent_replay', 'refund', (v_existing_refund->>'refund_id')::uuid,
        NULL, NULL, jsonb_build_object('idempotency_key', p_idempotency_key),
        'Replay idempotente -- refund ya procesado', p_correlation_id, NULL);
      RETURN v_existing_refund;
    END IF;
  END IF;

  SELECT COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = false), 0),
         COALESCE(SUM(ri.gross_refund) FILTER (WHERE ri.is_shipping = true), 0)
    INTO v_refunded_goods, v_refunded_ship
    FROM public.trade_marketplace_refund_items ri
    JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
   WHERE r.supplier_order_id = p_supplier_order_id
     AND r.status NOT IN ('rejected','cancelled','failed');

  v_remaining_goods := GREATEST(0, COALESCE(v_so.goods_gross_snapshot, 0) - v_refunded_goods);
  v_remaining_ship  := GREATEST(0, COALESCE(v_so.shipping_gross_snapshot, 0) - v_refunded_ship);

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
      RAISE EXCEPTION 'NO_ITEMS: p_items vacio para refund_type=%', p_refund_type;
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

  IF v_items_gross + v_ship_gross <= 0 THEN
    RAISE EXCEPTION 'ZERO_REFUND: el importe total del refund es 0';
  END IF;
  IF v_items_gross > v_remaining_goods + 0.005 THEN
    RAISE EXCEPTION 'EXCEEDS_GOODS_REFUNDABLE: goods_refund=% > remaining=%', v_items_gross, v_remaining_goods;
  END IF;
  IF v_ship_gross > v_remaining_ship + 0.005 THEN
    RAISE EXCEPTION 'EXCEEDS_SHIP_REFUNDABLE: ship_refund=% > remaining=%', v_ship_gross, v_remaining_ship;
  END IF;

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
    v_so.master_order_id, p_supplier_order_id, v_so.actor_id, v_so.buyer_actor_id,
    COALESCE(v_so.currency, 'EUR'), p_refund_type, p_reason, 'processed',
    v_items_gross, v_items_net, v_items_tax,
    v_ship_gross, v_ship_net, v_ship_tax,
    true, p_idempotency_key, v_corr,
    now(), now(), now(),
    auth.uid(), 'simulation'
  );

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

  IF v_ship_gross > 0 THEN
    INSERT INTO public.trade_marketplace_refund_items (
      refund_id, order_item_id, quantity_refunded,
      net_refund, tax_refund, gross_refund, is_shipping, reason
    ) VALUES (
      v_refund_id, NULL, NULL,
      v_ship_net, v_ship_tax, v_ship_gross, true, p_reason
    );
  END IF;

  v_source_goods := 'ref-' || v_refund_number || '-' || p_supplier_order_id::text || '-GOODS';
  v_source_ship  := 'ref-' || v_refund_number || '-' || p_supplier_order_id::text || '-SHIP';

  IF v_items_gross > 0 THEN
    PERFORM public.mkt_fin_ledger_append(
      'GOODS_REFUND_REVERSAL', -v_items_gross, v_so.master_order_id,
      p_supplier_order_id, v_so.actor_id,
      'Devolucion mercancias: gross negativo compensatorio, venta original intacta',
      v_corr, v_source_goods,
      NULL, 'simulation', v_refund_id::text, NULL,
      COALESCE(v_so.currency, 'EUR'), 'confirmed', now()
    );
  END IF;

  IF v_ship_gross > 0 THEN
    PERFORM public.mkt_fin_ledger_append(
      'SHIPPING_REFUND_REVERSAL', -v_ship_gross, v_so.master_order_id,
      p_supplier_order_id, v_so.actor_id,
      'Devolucion portes: gross negativo compensatorio, original intacto',
      v_corr, v_source_ship,
      NULL, 'simulation', v_refund_id::text, NULL,
      COALESCE(v_so.currency, 'EUR'), 'confirmed', now()
    );
  END IF;

  PERFORM public._mkt_update_so_refund_status(p_supplier_order_id);
  PERFORM public._mkt_update_master_refund_status(v_so.master_order_id);

  PERFORM public.mkt_fin_audit(
    'refund_created', 'refund', v_refund_id, NULL, NULL,
    jsonb_build_object(
      'refund_number', v_refund_number, 'refund_type', p_refund_type,
      'supplier_order_id', p_supplier_order_id,
      'items_gross', v_items_gross, 'shipping_gross', v_ship_gross,
      'total_gross', v_items_gross + v_ship_gross,
      'commission_reversal', 0, 'simulation_only', true,
      'note', 'Real commission=0 -> commission_reversal=0 (Phase 0)'
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

  BEGIN
    PERFORM public.mkt_fin_rebuild_provider_balance(v_so.actor_id, COALESCE(v_so.currency, 'EUR'));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.mkt_fin_audit('refund_balance_refresh_failed', 'refund', v_refund_id,
      NULL, NULL, jsonb_build_object('error', SQLERRM),
      'Balance refresh fallido tras refund -- rebuild manual posible', v_corr, NULL);
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
  'Crea un refund economico simulado (MP-FIN-2B). Atomico: entidad + lineas + ledger + balance. '
  'REFUND = movimiento compensatorio: la venta original NUNCA se modifica. '
  'Ledger entries tienen amount NEGATIVO (GOODS_REFUND_REVERSAL / SHIPPING_REFUND_REVERSAL). '
  'commission_reversal=0 (commission_real=0, Phase 0). STRIPE_GATE cerrado.';

GRANT EXECUTE ON FUNCTION public.mkt_fin_create_refund TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_get_refund(p_refund_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_refund RECORD;
  v_items  jsonb;
  v_has_access boolean;
BEGIN
  SELECT r.* INTO v_refund FROM public.trade_marketplace_refunds r WHERE r.id = p_refund_id;
  IF v_refund.id IS NULL THEN RAISE EXCEPTION 'REFUND_NOT_FOUND: %', p_refund_id; END IF;

  v_has_access := public._mkt_is_platform_admin()
    OR v_refund.provider_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_refund_id; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', ri.id, 'order_item_id', ri.order_item_id,
    'quantity_refunded', ri.quantity_refunded, 'gross_refund', ri.gross_refund,
    'net_refund', ri.net_refund, 'tax_refund', ri.tax_refund, 'is_shipping', ri.is_shipping
  )) INTO v_items FROM public.trade_marketplace_refund_items ri WHERE ri.refund_id = p_refund_id;

  RETURN jsonb_build_object(
    'refund_id',           v_refund.id,
    'refund_number',       v_refund.refund_number,
    'supplier_order_id',   v_refund.supplier_order_id,
    'master_order_id',     v_refund.master_order_id,
    'provider_actor_id',   v_refund.provider_actor_id,
    'refund_type',         v_refund.refund_type,
    'status',              v_refund.status,
    'total_refund_amount', v_refund.total_refund_amount,
    'items_gross',         v_refund.items_gross_amount,
    'shipping_gross',      v_refund.shipping_gross_amount,
    'commission_reversal', 0,
    'simulation_only',     v_refund.simulation_only,
    'processed_at',        v_refund.processed_at,
    'correlation_id',      v_refund.correlation_id,
    'items',               COALESCE(v_items, '[]'::jsonb)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_get_refund TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_list_supplier_refunds(p_supplier_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_so        RECORD;
  v_refunds   jsonb;
  v_has_access boolean;
BEGIN
  SELECT actor_id INTO v_so FROM public.trade_marketplace_orders WHERE id = p_supplier_order_id;
  IF v_so.actor_id IS NULL THEN RAISE EXCEPTION 'SUPPLIER_ORDER_NOT_FOUND: %', p_supplier_order_id; END IF;

  v_has_access := public._mkt_is_platform_admin()
    OR v_so.actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'refund_id',           r.id,
    'refund_number',       r.refund_number,
    'refund_type',         r.refund_type,
    'status',              r.status,
    'total_refund_amount', r.total_refund_amount,
    'items_gross',         r.items_gross_amount,
    'shipping_gross',      r.shipping_gross_amount,
    'processed_at',        r.processed_at
  ) ORDER BY r.processed_at DESC) INTO v_refunds
  FROM public.trade_marketplace_refunds r WHERE r.supplier_order_id = p_supplier_order_id;

  RETURN jsonb_build_object(
    'supplier_order_id', p_supplier_order_id,
    'refund_count',      (SELECT COUNT(*) FROM public.trade_marketplace_refunds WHERE supplier_order_id = p_supplier_order_id),
    'total_refunded',    (SELECT COALESCE(SUM(total_refund_amount),0) FROM public.trade_marketplace_refunds
                          WHERE supplier_order_id = p_supplier_order_id AND status NOT IN ('rejected','cancelled','failed')),
    'refunds',           COALESCE(v_refunds, '[]'::jsonb)
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_list_supplier_refunds TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_refunds_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso solo para platform_admin';
  END IF;

  RETURN jsonb_build_object(
    'total_refunds',           (SELECT COUNT(*) FROM public.trade_marketplace_refunds WHERE status = 'processed'),
    'total_refunded_gross',    (SELECT COALESCE(SUM(total_refund_amount),0) FROM public.trade_marketplace_refunds WHERE status='processed'),
    'total_refunded_goods',    (SELECT COALESCE(SUM(items_gross_amount),0) FROM public.trade_marketplace_refunds WHERE status='processed'),
    'total_refunded_shipping', (SELECT COALESCE(SUM(shipping_gross_amount),0) FROM public.trade_marketplace_refunds WHERE status='processed'),
    'refunds_by_type',         (SELECT jsonb_object_agg(refund_type, cnt) FROM (
                                  SELECT refund_type, COUNT(*) AS cnt FROM public.trade_marketplace_refunds
                                  WHERE status='processed' GROUP BY refund_type) x),
    'supplier_orders_partially_refunded', (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE refund_status='partially_refunded'),
    'supplier_orders_fully_refunded',     (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE refund_status='fully_refunded'),
    'commission_reversal_total', 0,
    'simulation_only',           true,
    'phase_note',                'Phase 2B: sim mode, real_commission=0, commission_reversal=0',
    'calculated_at',             now()
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_admin_refunds_overview TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(
  p_actor_id  uuid,
  p_currency  text DEFAULT 'EUR'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pending         numeric(15,4) := 0;
  v_available       numeric(15,4) := 0;
  v_reserved        numeric(15,4) := 0;
  v_negative        numeric(15,4) := 0;
  v_settled         numeric(15,4) := 0;
  v_last_entry_id   uuid;
  v_entry_count     int;
  v_prior_balance   numeric(15,4);
  v_actor_exists    bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id)
    INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL', 'SHIPPING_REFUND_REVERSAL'
      ) AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed'),
    (SELECT l2.id FROM public.trade_marketplace_ledger_entries l2
      WHERE l2.actor_id = p_actor_id AND l2.currency::text = p_currency AND l2.status != 'failed'
      ORDER BY l2.occurred_at DESC, l2.created_at DESC LIMIT 1)
  INTO v_pending, v_entry_count, v_last_entry_id
  FROM public.trade_marketplace_ledger_entries
  WHERE actor_id = p_actor_id AND currency::text = p_currency;

  SELECT COALESCE(total_economic_balance, 0) INTO v_prior_balance
    FROM public.trade_marketplace_balances WHERE provider_actor_id = p_actor_id AND currency::char(3) = p_currency::char(3);

  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount, last_ledger_entry_id, last_recalculated_at, projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative, v_settled,
    v_last_entry_id, now(), 'ledger_rebuild'
  )
  ON CONFLICT (provider_actor_id, currency) DO UPDATE SET
    pending_amount            = EXCLUDED.pending_amount,
    available_amount          = EXCLUDED.available_amount,
    reserved_amount           = EXCLUDED.reserved_amount,
    negative_amount           = EXCLUDED.negative_amount,
    historical_settled_amount = EXCLUDED.historical_settled_amount,
    last_ledger_entry_id      = EXCLUDED.last_ledger_entry_id,
    last_recalculated_at      = EXCLUDED.last_recalculated_at,
    projection_strategy       = EXCLUDED.projection_strategy;

  PERFORM public.mkt_fin_audit(
    'provider_balance_rebuilt', 'provider_balance', p_actor_id, NULL, NULL,
    jsonb_build_object(
      'actor_id', p_actor_id, 'currency', p_currency,
      'pending_amount', v_pending, 'total_economic', v_pending,
      'ledger_entries_read', v_entry_count, 'prior_total', v_prior_balance,
      'phase', '2B', 'includes_refund_reversals', true,
      'note', 'Rebuild incluye GOODS/SHIPPING_REFUND_REVERSAL (negativos). COMMISSION_SIM excluida (INV-B02).'
    ),
    'Rebuild balance desde ledger -- Phase 2B (incluye reversals)', NULL, NULL
  );

  RETURN jsonb_build_object(
    'status', 'rebuilt', 'actor_id', p_actor_id, 'currency', p_currency,
    'pending_amount', v_pending, 'available_amount', v_available,
    'reserved_amount', v_reserved, 'negative_amount', v_negative,
    'historical_settled', v_settled,
    'total_economic_balance', v_pending + v_available + v_reserved - v_negative,
    'ledger_entries_read', v_entry_count,
    'last_ledger_entry_id', v_last_entry_id,
    'recalculated_at', now(), 'projection_strategy', 'ledger_rebuild',
    'phase', '2B'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_rebuild_provider_balance TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_reconcile_provider_balance(
  p_actor_id  uuid,
  p_currency  text DEFAULT 'EUR'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ledger_derived  numeric(15,4) := 0;
  v_stored_total    numeric(15,4) := 0;
  v_difference      numeric(15,4);
  v_status          text;
  v_has_access      boolean;
  v_entry_count     int;
  v_projection_at   timestamptz;
BEGIN
  v_has_access := public._mkt_is_platform_admin() OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL', 'SHIPPING_REFUND_REVERSAL'
      ) AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed')
  INTO v_ledger_derived, v_entry_count
  FROM public.trade_marketplace_ledger_entries
  WHERE actor_id = p_actor_id AND currency::text = p_currency;

  SELECT COALESCE(total_economic_balance, 0), last_recalculated_at
    INTO v_stored_total, v_projection_at
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  v_difference := v_ledger_derived - v_stored_total;
  v_status := CASE WHEN ABS(v_difference) < 0.0001 THEN 'MATCH' ELSE 'MISMATCH' END;

  IF v_status = 'MISMATCH' THEN
    PERFORM public.mkt_fin_audit(
      'provider_balance_reconciliation_mismatch', 'provider_balance', p_actor_id, NULL, NULL,
      jsonb_build_object('ledger_derived', v_ledger_derived, 'stored_total', v_stored_total,
        'difference', v_difference, 'phase', '2B', 'severity', 'WARNING'),
      'Balance almacenado difiere del ledger (Phase 2B)', NULL, NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'actor_id', p_actor_id, 'currency', p_currency, 'status', v_status,
    'expected_total', v_ledger_derived, 'stored_total', v_stored_total,
    'difference', v_difference, 'ledger_entries_used', v_entry_count,
    'projection_at', v_projection_at, 'checked_at', now(),
    'phase', '2B', 'includes_refund_reversals', true,
    'reconciliation_note', CASE WHEN v_status = 'MATCH'
      THEN 'OK -- ledger y balance coinciden (Phase 2B con refund reversals)'
      ELSE 'MISMATCH -- ejecutar mkt_fin_rebuild_provider_balance'
    END
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_reconcile_provider_balance TO authenticated;

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'Acceso solo para platform_admin'; END IF;

  RETURN jsonb_build_object(
    'gmv_total_goods_net', (SELECT COALESCE(SUM(goods_net_total), 0) FROM public.trade_marketplace_master_orders WHERE order_status NOT IN ('cancelled')),
    'gmv_total_goods_gross', (SELECT COALESCE(SUM(goods_gross_total), 0) FROM public.trade_marketplace_master_orders WHERE order_status NOT IN ('cancelled')),
    'trabflow_revenue_marketplace_real', (SELECT COALESCE(SUM(commission_net_snapshot), 0) FROM public.trade_marketplace_orders WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL),
    'trabflow_revenue_marketplace_simulated', (SELECT COALESCE(SUM(sim_commission_net), 0) FROM public.trade_marketplace_orders WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL),
    'master_orders_total',    (SELECT COUNT(*) FROM public.trade_marketplace_master_orders),
    'supplier_orders_total',  (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NOT NULL),
    'supplier_orders_legacy', (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NULL),
    'active_providers',       (SELECT COUNT(DISTINCT actor_id) FROM public.trade_marketplace_orders WHERE created_at > now() - interval '30 days'),
    'ledger_entries_total',   (SELECT COUNT(*) FROM public.trade_marketplace_ledger_entries),
    'provider_balances', (SELECT jsonb_build_object(
      'total_pending',   COALESCE(SUM(pending_amount), 0),
      'total_available', COALESCE(SUM(available_amount), 0),
      'total_reserved',  COALESCE(SUM(reserved_amount), 0),
      'total_negative',  COALESCE(SUM(negative_amount), 0),
      'total_economic',  COALESCE(SUM(total_economic_balance), 0),
      'providers_count', COUNT(*),
      'note', 'total incluye refund_reversals negativos (Phase 2B)'
    ) FROM public.trade_marketplace_balances),
    'refunds', (SELECT jsonb_build_object(
      'total_refunds',           COUNT(*) FILTER (WHERE status = 'processed'),
      'total_refunded_gross',    COALESCE(SUM(total_refund_amount) FILTER (WHERE status = 'processed'), 0),
      'total_refunded_goods',    COALESCE(SUM(items_gross_amount) FILTER (WHERE status = 'processed'), 0),
      'total_refunded_shipping', COALESCE(SUM(shipping_gross_amount) FILTER (WHERE status = 'processed'), 0),
      'commission_reversal',     0,
      'note', 'simulation_only=true. commission_reversal=0 (real_commission=0, Phase 0)'
    ) FROM public.trade_marketplace_refunds),
    'payment_mode',          public.mkt_fin_get_config('payment.mode'),
    'real_payments_enabled', public.mkt_fin_get_config('payment.real_payments_enabled'),
    'commission_enabled',    public.mkt_fin_get_config('commission.enabled'),
    'calculated_at', now(),
    'warning', 'gmv_total_goods_* NO es ingreso de TrabFlow (INV-001). En Fase 0 revenue=0. Refunds: simulation only (STRIPE_GATE).'
  );
END; $$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_admin_overview TO authenticated;

COMMIT;
;
