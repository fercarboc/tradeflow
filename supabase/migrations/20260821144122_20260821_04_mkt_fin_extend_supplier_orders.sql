
BEGIN;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS master_order_id uuid
    REFERENCES public.trade_marketplace_master_orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_order_master
  ON public.trade_marketplace_orders(master_order_id)
  WHERE master_order_id IS NOT NULL;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS payment_status text
    DEFAULT 'unpaid'
    CHECK (payment_status IN (
      'unpaid','pending','failed','paid','partially_refunded',
      'refunded','disputed','chargeback_platform_won','chargeback_platform_lost'
    ));

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'EUR';

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS goods_net_snapshot       numeric(12,2),
  ADD COLUMN IF NOT EXISTS goods_tax_snapshot       numeric(12,2),
  ADD COLUMN IF NOT EXISTS goods_gross_snapshot     numeric(12,2);

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS shipping_net_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_tax_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_gross_snapshot  numeric(12,2);

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS tax_rate_snapshot        numeric(5,2);

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS commission_policy_id_snapshot    uuid
    REFERENCES public.trade_marketplace_commission_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot         numeric(6,4) DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS commission_type_snapshot         text         DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_base_snapshot         text         DEFAULT 'goods_net',
  ADD COLUMN IF NOT EXISTS commissionable_base_net_snapshot numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_net_snapshot          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_tax_snapshot          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_gross_snapshot        numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commissionable_shipping_snapshot boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS sim_commission_net               numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_tax               numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_gross             numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_rate              numeric(6,4)  DEFAULT 0.0000;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS provider_payable_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS financial_snapshot_at        timestamptz;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_amount   numeric(12,2) DEFAULT 0;

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS external_provider    text DEFAULT 'simulation',
  ADD COLUMN IF NOT EXISTS external_payment_id  text,
  ADD COLUMN IF NOT EXISTS external_transfer_id text;

CREATE OR REPLACE FUNCTION public._mkt_fin_protect_order_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.financial_snapshot_at IS NOT NULL THEN
    IF NEW.goods_net_snapshot IS DISTINCT FROM OLD.goods_net_snapshot
    OR NEW.goods_tax_snapshot IS DISTINCT FROM OLD.goods_tax_snapshot
    OR NEW.goods_gross_snapshot IS DISTINCT FROM OLD.goods_gross_snapshot
    OR NEW.shipping_net_snapshot IS DISTINCT FROM OLD.shipping_net_snapshot
    OR NEW.shipping_gross_snapshot IS DISTINCT FROM OLD.shipping_gross_snapshot
    OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot
    OR NEW.commissionable_base_net_snapshot IS DISTINCT FROM OLD.commissionable_base_net_snapshot
    OR NEW.commission_net_snapshot IS DISTINCT FROM OLD.commission_net_snapshot
    OR NEW.commission_tax_snapshot IS DISTINCT FROM OLD.commission_tax_snapshot
    OR NEW.provider_payable_snapshot IS DISTINCT FROM OLD.provider_payable_snapshot
    THEN
      RAISE EXCEPTION
        'Los snapshots financieros son inmutables (INV-007). '
        'Use movimientos compensatorios en el ledger. '
        'Supplier Order ID: %', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_protect_snapshots
  BEFORE UPDATE ON public.trade_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_protect_order_snapshots();

CREATE OR REPLACE FUNCTION public.mkt_fin_write_order_financial_snapshot(
  p_order_id             uuid,
  p_goods_net            numeric(12,2),
  p_goods_tax            numeric(12,2),
  p_goods_gross          numeric(12,2),
  p_shipping_net         numeric(12,2),
  p_shipping_tax         numeric(12,2),
  p_shipping_gross       numeric(12,2),
  p_tax_rate             numeric(5,2)  DEFAULT 21.00,
  p_master_order_id      uuid          DEFAULT NULL,
  p_commission_policy_id uuid          DEFAULT NULL
)
RETURNS public.trade_marketplace_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order     public.trade_marketplace_orders;
  v_comm      jsonb;
  v_payable   numeric(12,2);
  v_sim_rate  numeric(6,4);
  v_sim_net   numeric(12,2);
  v_sim_tax   numeric(12,2);
  v_sim_gross numeric(12,2);
BEGIN
  SELECT * INTO v_order
    FROM public.trade_marketplace_orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier order % no encontrado', p_order_id;
  END IF;

  IF v_order.financial_snapshot_at IS NOT NULL THEN
    RETURN v_order;
  END IF;

  v_comm    := public.mkt_fin_calculate_commission(p_goods_net, v_order.actor_id, false);
  v_payable := p_goods_gross + p_shipping_gross - (v_comm->>'commission_gross')::numeric;

  SELECT (config_value)::numeric INTO v_sim_rate
    FROM public.trade_marketplace_financial_config
   WHERE config_key = 'commission.simulation_rate';
  v_sim_rate  := COALESCE(v_sim_rate, 0.0000);
  v_sim_net   := ROUND(p_goods_net * v_sim_rate, 2);
  v_sim_tax   := ROUND(v_sim_net * 0.21, 2);
  v_sim_gross := v_sim_net + v_sim_tax;

  UPDATE public.trade_marketplace_orders SET
    master_order_id                  = COALESCE(p_master_order_id, master_order_id),
    goods_net_snapshot               = p_goods_net,
    goods_tax_snapshot               = p_goods_tax,
    goods_gross_snapshot             = p_goods_gross,
    shipping_net_snapshot            = p_shipping_net,
    shipping_tax_snapshot            = p_shipping_tax,
    shipping_gross_snapshot          = p_shipping_gross,
    tax_rate_snapshot                = p_tax_rate,
    commission_policy_id_snapshot    = COALESCE(p_commission_policy_id, (v_comm->>'policy_id')::uuid),
    commission_rate_snapshot         = (v_comm->>'commission_rate')::numeric,
    commission_type_snapshot         = 'percentage',
    commission_base_snapshot         = (v_comm->>'commission_base'),
    commissionable_base_net_snapshot = p_goods_net,
    commission_net_snapshot          = (v_comm->>'commission_net')::numeric,
    commission_tax_snapshot          = (v_comm->>'commission_tax')::numeric,
    commission_gross_snapshot        = (v_comm->>'commission_gross')::numeric,
    commissionable_shipping_snapshot = false,
    provider_payable_snapshot        = v_payable,
    sim_commission_rate              = v_sim_rate,
    sim_commission_net               = v_sim_net,
    sim_commission_tax               = v_sim_tax,
    sim_commission_gross             = v_sim_gross,
    financial_snapshot_at            = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_write_order_financial_snapshot TO authenticated;

COMMIT;
;
