
BEGIN;

CREATE INDEX IF NOT EXISTS idx_supplier_order_payment_status
  ON public.trade_marketplace_orders(payment_status);

CREATE INDEX IF NOT EXISTS idx_supplier_order_master_id
  ON public.trade_marketplace_orders(master_order_id)
  WHERE master_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_order_snapshot_at
  ON public.trade_marketplace_orders(financial_snapshot_at)
  WHERE financial_snapshot_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_log_financial_events
  ON public.trade_marketplace_audit_log(event_type)
  WHERE event_type LIKE 'financial_%'
     OR event_type LIKE 'commission_%'
     OR event_type LIKE 'master_order_%'
     OR event_type LIKE 'ledger_%';

CREATE OR REPLACE FUNCTION public.mkt_fin_check_gmv_revenue_separation(
  p_master_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'gmv_goods_net',                COALESCE(SUM(mo.goods_net_total), 0),
    'gmv_goods_gross',              COALESCE(SUM(mo.goods_gross_total), 0),
    'gmv_shipping_net',             COALESCE(SUM(mo.shipping_net_total), 0),
    'trabflow_revenue_real',        COALESCE(SUM(so.commission_net_snapshot), 0),
    'trabflow_revenue_simulated',   COALESCE(SUM(so.sim_commission_net), 0),
    'inv_001_ok', (
      COALESCE(SUM(mo.goods_gross_total), 0)
      != COALESCE(SUM(so.commission_net_snapshot), 0)
      OR COALESCE(SUM(so.commission_net_snapshot), 0) = 0
    ),
    'checkout_gross_total',         COALESCE(SUM(mo.checkout_gross_total), 0),
    'note', 'gmv_* = volumen mercancía proveedores. trabflow_revenue_* = comisión plataforma. NUNCA iguales (INV-001).'
  )
  INTO v_result
  FROM public.trade_marketplace_master_orders mo
  LEFT JOIN public.trade_marketplace_orders so ON so.master_order_id = mo.id
  WHERE p_master_order_id IS NULL OR mo.id = p_master_order_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_financial_summary(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result     jsonb;
  v_has_access boolean;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acceso denegado al resumen financiero del proveedor %', p_actor_id;
  END IF;

  SELECT jsonb_build_object(
    'actor_id',                  p_actor_id,
    'gmv_goods_gross',           COALESCE(SUM(so.goods_gross_snapshot), 0),
    'gmv_goods_net',             COALESCE(SUM(so.goods_net_snapshot), 0),
    'gmv_shipping_gross',        COALESCE(SUM(so.shipping_gross_snapshot), 0),
    'total_supplier_orders',     COUNT(so.id),
    'orders_with_snapshot',      COUNT(so.id) FILTER (WHERE so.financial_snapshot_at IS NOT NULL),
    'orders_pending_payment',    COUNT(so.id) FILTER (WHERE so.payment_status = 'unpaid'),
    'orders_paid',               COUNT(so.id) FILTER (WHERE so.payment_status = 'paid'),
    'commission_real_accrued',   COALESCE(SUM(so.commission_gross_snapshot), 0),
    'commission_sim_accrued',    COALESCE(SUM(so.sim_commission_gross), 0),
    'provider_payable_total',    COALESCE(SUM(so.provider_payable_snapshot), 0),
    'refunded_total',            COALESCE(SUM(so.refunded_amount), 0),
    'ledger_entries_count', (
      SELECT COUNT(*) FROM public.trade_marketplace_ledger_entries
       WHERE actor_id = p_actor_id AND status != 'failed'
    ),
    'currency', 'EUR',
    'calculated_at', now(),
    'note', 'En Fase 0: commission_real_accrued=0 (INV-005). commission_sim_accrued es potencial hipotético.'
  )
  INTO v_result
  FROM public.trade_marketplace_orders so
  WHERE so.actor_id = p_actor_id
    AND so.estado != 'cancelled';

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso solo para platform_admin';
  END IF;

  RETURN jsonb_build_object(
    'gmv_total_goods_net', (
      SELECT COALESCE(SUM(goods_net_total), 0)
        FROM public.trade_marketplace_master_orders
       WHERE order_status NOT IN ('cancelled')
    ),
    'gmv_total_goods_gross', (
      SELECT COALESCE(SUM(goods_gross_total), 0)
        FROM public.trade_marketplace_master_orders
       WHERE order_status NOT IN ('cancelled')
    ),
    'trabflow_revenue_marketplace_real', (
      SELECT COALESCE(SUM(commission_net_snapshot), 0)
        FROM public.trade_marketplace_orders
       WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL
    ),
    'trabflow_revenue_marketplace_simulated', (
      SELECT COALESCE(SUM(sim_commission_net), 0)
        FROM public.trade_marketplace_orders
       WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL
    ),
    'master_orders_total',    (SELECT COUNT(*) FROM public.trade_marketplace_master_orders),
    'supplier_orders_total',  (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NOT NULL),
    'supplier_orders_legacy', (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NULL),
    'active_providers', (
      SELECT COUNT(DISTINCT actor_id)
        FROM public.trade_marketplace_orders
       WHERE created_at > now() - interval '30 days'
    ),
    'ledger_entries_total', (SELECT COUNT(*) FROM public.trade_marketplace_ledger_entries),
    'payment_mode',           public.mkt_fin_get_config('payment.mode'),
    'real_payments_enabled',  public.mkt_fin_get_config('payment.real_payments_enabled'),
    'commission_enabled',     public.mkt_fin_get_config('commission.enabled'),
    'calculated_at', now(),
    'warning', 'gmv_total_goods_* NO es ingreso de TrabFlow (INV-001). trabflow_revenue_* es comisión de plataforma. En Fase 0 ambas =0.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_check_gmv_revenue_separation TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_provider_financial_summary TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_admin_overview TO authenticated;

COMMIT;
;
