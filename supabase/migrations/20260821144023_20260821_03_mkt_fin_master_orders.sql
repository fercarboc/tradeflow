
BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_marketplace_master_orders (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero                  text        NOT NULL UNIQUE,
  org_id                  uuid        REFERENCES public.trade_organizations(id) ON DELETE RESTRICT,
  guest_customer_id       uuid        REFERENCES public.trade_marketplace_guest_customers(id) ON DELETE SET NULL,
  buyer_snapshot          jsonb       NOT NULL DEFAULT '{}',
  CONSTRAINT chk_master_buyer CHECK (
    (org_id IS NOT NULL AND guest_customer_id IS NULL)
    OR
    (org_id IS NULL AND guest_customer_id IS NOT NULL)
  ),
  cart_id                 uuid        REFERENCES public.trade_marketplace_carts(id) ON DELETE SET NULL,
  checkout_key            text        NOT NULL UNIQUE,
  order_status            text        NOT NULL DEFAULT 'created'
    CHECK (order_status IN (
      'created','payment_pending','paid','partially_fulfilled',
      'fulfilled','partially_cancelled','cancelled'
    )),
  payment_status          text        NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN (
      'unpaid','pending','failed','paid','partially_refunded',
      'refunded','disputed','chargeback_platform_won','chargeback_platform_lost'
    )),
  goods_net_total         numeric(12,2) NOT NULL DEFAULT 0 CHECK (goods_net_total >= 0),
  goods_tax_total         numeric(12,2) NOT NULL DEFAULT 0 CHECK (goods_tax_total >= 0),
  goods_gross_total       numeric(12,2) NOT NULL DEFAULT 0 CHECK (goods_gross_total >= 0),
  shipping_net_total      numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_net_total >= 0),
  shipping_tax_total      numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_tax_total >= 0),
  shipping_gross_total    numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_gross_total >= 0),
  checkout_gross_total    numeric(12,2) NOT NULL DEFAULT 0 CHECK (checkout_gross_total >= 0),
  refund_gross_total      numeric(12,2) NOT NULL DEFAULT 0 CHECK (refund_gross_total >= 0),
  currency                char(3)       NOT NULL DEFAULT 'EUR',
  gmv_goods_net           numeric(12,2),
  gmv_goods_gross         numeric(12,2),
  gmv_shipping_net        numeric(12,2),
  external_provider       text          NOT NULL DEFAULT 'simulation',
  external_payment_intent_id text,
  psp_fee_estimated       numeric(12,2),
  delivery_address_snapshot jsonb,
  confirmed_at            timestamptz,
  paid_at                 timestamptz,
  fulfilled_at            timestamptz,
  cancelled_at            timestamptz,
  cancel_reason           text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_master_orders IS
  'Pedido maestro que agrupa N supplier orders de un mismo checkout. '
  'No es una factura fiscal. No implica que TrabFlow sea vendedor/MoR (LEGAL_GATE). '
  'INV-003: checkout_gross_total = goods_gross_total + shipping_gross_total. '
  'INV-012: order_status y payment_status son ciclos independientes.';

CREATE OR REPLACE FUNCTION public._mkt_fin_master_order_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = '' THEN
    NEW.numero := public.next_financial_doc_number('MKP');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_master_order_numero
  BEFORE INSERT ON public.trade_marketplace_master_orders
  FOR EACH ROW
  WHEN (NEW.numero IS NULL OR NEW.numero = '')
  EXECUTE FUNCTION public._mkt_fin_master_order_numero();

CREATE OR REPLACE FUNCTION public._mkt_fin_master_order_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_master_order_updated_at
  BEFORE UPDATE ON public.trade_marketplace_master_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_master_order_updated_at();

CREATE INDEX IF NOT EXISTS idx_master_order_org
  ON public.trade_marketplace_master_orders(org_id)
  WHERE org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_order_guest
  ON public.trade_marketplace_master_orders(guest_customer_id)
  WHERE guest_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_master_order_checkout_key
  ON public.trade_marketplace_master_orders(checkout_key);

CREATE INDEX IF NOT EXISTS idx_master_order_status
  ON public.trade_marketplace_master_orders(order_status, payment_status);

CREATE INDEX IF NOT EXISTS idx_master_order_created
  ON public.trade_marketplace_master_orders(created_at DESC);

CREATE OR REPLACE FUNCTION public.mkt_fin_create_master_order(
  p_checkout_key        text,
  p_org_id              uuid      DEFAULT NULL,
  p_guest_customer_id   uuid      DEFAULT NULL,
  p_cart_id             uuid      DEFAULT NULL,
  p_buyer_snapshot      jsonb     DEFAULT '{}',
  p_goods_net_total     numeric   DEFAULT 0,
  p_goods_tax_total     numeric   DEFAULT 0,
  p_goods_gross_total   numeric   DEFAULT 0,
  p_shipping_net_total  numeric   DEFAULT 0,
  p_shipping_tax_total  numeric   DEFAULT 0,
  p_shipping_gross_total numeric  DEFAULT 0,
  p_currency            char(3)   DEFAULT 'EUR',
  p_delivery_address    jsonb     DEFAULT NULL
)
RETURNS public.trade_marketplace_master_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master public.trade_marketplace_master_orders;
  v_gmv    numeric(12,2);
BEGIN
  SELECT * INTO v_master
    FROM public.trade_marketplace_master_orders
   WHERE checkout_key = p_checkout_key;

  IF FOUND THEN
    RETURN v_master;
  END IF;

  IF p_org_id IS NULL AND p_guest_customer_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere org_id o guest_customer_id';
  END IF;
  IF p_org_id IS NOT NULL AND p_guest_customer_id IS NOT NULL THEN
    RAISE EXCEPTION 'org_id y guest_customer_id son mutuamente excluyentes';
  END IF;

  v_gmv := COALESCE(p_goods_net_total, 0);

  INSERT INTO public.trade_marketplace_master_orders (
    checkout_key, org_id, guest_customer_id, cart_id, buyer_snapshot,
    goods_net_total, goods_tax_total, goods_gross_total,
    shipping_net_total, shipping_tax_total, shipping_gross_total,
    checkout_gross_total,
    gmv_goods_net, gmv_goods_gross, gmv_shipping_net,
    currency, delivery_address_snapshot,
    numero
  ) VALUES (
    p_checkout_key, p_org_id, p_guest_customer_id, p_cart_id, p_buyer_snapshot,
    p_goods_net_total, p_goods_tax_total, p_goods_gross_total,
    p_shipping_net_total, p_shipping_tax_total, p_shipping_gross_total,
    p_goods_gross_total + p_shipping_gross_total,
    v_gmv, p_goods_gross_total, p_shipping_net_total,
    p_currency, p_delivery_address,
    ''
  )
  RETURNING * INTO v_master;

  RETURN v_master;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_fin_get_master_order(
  p_master_order_id uuid DEFAULT NULL,
  p_checkout_key    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_master public.trade_marketplace_master_orders;
  v_supplier_orders jsonb;
BEGIN
  IF p_master_order_id IS NOT NULL THEN
    SELECT * INTO v_master
      FROM public.trade_marketplace_master_orders
     WHERE id = p_master_order_id;
  ELSIF p_checkout_key IS NOT NULL THEN
    SELECT * INTO v_master
      FROM public.trade_marketplace_master_orders
     WHERE checkout_key = p_checkout_key;
  ELSE
    RAISE EXCEPTION 'Se requiere master_order_id o checkout_key';
  END IF;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'actor_id', o.actor_id,
      'numero', o.numero,
      'estado', o.estado,
      'payment_status', o.payment_status,
      'subtotal', o.subtotal,
      'coste_envio', o.coste_envio,
      'total', o.total,
      'goods_gross_snapshot', o.goods_gross_snapshot,
      'shipping_gross_snapshot', o.shipping_gross_snapshot,
      'currency', o.currency,
      'created_at', o.created_at
    )
  ) INTO v_supplier_orders
  FROM public.trade_marketplace_orders o
  WHERE o.master_order_id = v_master.id
     OR (o.master_order_id IS NULL AND o.checkout_key = v_master.checkout_key);

  RETURN jsonb_build_object(
    'master_order', to_jsonb(v_master),
    'supplier_orders', COALESCE(v_supplier_orders, '[]'::jsonb),
    'supplier_orders_count', (
      SELECT COUNT(*) FROM public.trade_marketplace_orders o
      WHERE o.master_order_id = v_master.id
         OR (o.master_order_id IS NULL AND o.checkout_key = v_master.checkout_key)
    )
  );
END;
$$;

ALTER TABLE public.trade_marketplace_master_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_orders_select_buyer_org"
  ON public.trade_marketplace_master_orders
  FOR SELECT
  TO authenticated
  USING (
    org_id IS NOT NULL AND
    org_id IN (
      SELECT org_id FROM public.trade_org_members
       WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "master_orders_select_platform_admin"
  ON public.trade_marketplace_master_orders
  FOR SELECT
  TO authenticated
  USING (public._mkt_is_platform_admin());

GRANT SELECT ON public.trade_marketplace_master_orders TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_create_master_order TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_master_order TO authenticated;

COMMIT;
;
