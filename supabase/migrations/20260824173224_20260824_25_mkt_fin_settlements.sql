-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2F — Settlement Engine
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- PARTE 1: Añadir SETTLEMENT_PAID_SIMULATION al CHECK de ledger
ALTER TABLE public.trade_marketplace_ledger_entries
  DROP CONSTRAINT IF EXISTS trade_marketplace_ledger_entries_entry_type_check;

ALTER TABLE public.trade_marketplace_ledger_entries
  ADD CONSTRAINT trade_marketplace_ledger_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'BUYER_PAYMENT','GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT',
    'COMMISSION_ACCRUAL','COMMISSION_TAX_ACCRUAL',
    'COMMISSION_SIM_ACCRUAL','COMMISSION_SIM_TAX_ACCRUAL',
    'TRANSFER_INITIATED','TRANSFER_COMPLETED','TRANSFER_REVERSAL',
    'REFUND_TO_BUYER','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL',
    'COMMISSION_REVERSAL','COMMISSION_TAX_REVERSAL',
    'CHARGEBACK_DEBIT','CHARGEBACK_FEE','CHARGEBACK_CREDIT',
    'PSP_FEE_DEBIT','RESERVE_HOLD','RESERVE_RELEASE',
    'SETTLEMENT_ADJUSTMENT','PROVIDER_ADJUSTMENT','PLATFORM_ADJUSTMENT',
    'NEGATIVE_BALANCE_RECORD','BALANCE_RECOVERY','FUTURE_SETOFF',
    'PENDING_TO_AVAILABLE','SETTLEMENT_PAID_SIMULATION'
  ]::text[]));

-- PARTE 2: trade_marketplace_settlements
CREATE TABLE IF NOT EXISTS public.trade_marketplace_settlements (
  id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_number            text UNIQUE NOT NULL,
  provider_actor_id            uuid NOT NULL REFERENCES public.trade_marketplace_actors(id),
  currency                     char(3) NOT NULL DEFAULT 'EUR',
  period_start                 timestamptz NOT NULL,
  period_end                   timestamptz NOT NULL,
  status                       text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','calculated','approved','payable','simulated_paid','closed','adjusted','cancelled')),
  opening_pending              numeric(15,4) NOT NULL DEFAULT 0,
  opening_available            numeric(15,4) NOT NULL DEFAULT 0,
  opening_reserved             numeric(15,4) NOT NULL DEFAULT 0,
  opening_negative             numeric(15,4) NOT NULL DEFAULT 0,
  opening_historical_settled   numeric(15,4) NOT NULL DEFAULT 0,
  sales_amount                 numeric(15,4) NOT NULL DEFAULT 0,
  shipping_amount              numeric(15,4) NOT NULL DEFAULT 0,
  refund_amount                numeric(15,4) NOT NULL DEFAULT 0,
  chargeback_amount            numeric(15,4) NOT NULL DEFAULT 0,
  chargeback_reversal_amount   numeric(15,4) NOT NULL DEFAULT 0,
  recovery_amount              numeric(15,4) NOT NULL DEFAULT 0,
  reserve_amount               numeric(15,4) NOT NULL DEFAULT 0,
  reserve_release_amount       numeric(15,4) NOT NULL DEFAULT 0,
  commission_amount            numeric(15,4) NOT NULL DEFAULT 0,
  commission_tax_amount        numeric(15,4) NOT NULL DEFAULT 0,
  adjustment_amount            numeric(15,4) NOT NULL DEFAULT 0,
  gross_activity               numeric(15,4) NOT NULL DEFAULT 0,
  net_activity                 numeric(15,4) NOT NULL DEFAULT 0,
  available_amount_at_calc     numeric(15,4) NOT NULL DEFAULT 0,
  reserved_amount_at_calc      numeric(15,4) NOT NULL DEFAULT 0,
  negative_amount_at_calc      numeric(15,4) NOT NULL DEFAULT 0,
  max_payable                  numeric(15,4) NOT NULL DEFAULT 0,
  settlement_amount            numeric(15,4) NOT NULL DEFAULT 0,
  settlement_ledger_entry_id   uuid REFERENCES public.trade_marketplace_ledger_entries(id),
  simulation_only              bool NOT NULL DEFAULT true,
  created_by                   uuid,
  approved_by                  uuid,
  correlation_id               text,
  idempotency_key              text UNIQUE,
  external_provider            text NOT NULL DEFAULT 'simulation',
  external_id                  text,
  notes                        text,
  metadata                     jsonb,
  calculated_at                timestamptz,
  approved_at                  timestamptz,
  payable_at                   timestamptz,
  simulated_paid_at            timestamptz,
  closed_at                    timestamptz,
  cancelled_at                 timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_settlement_simulation  CHECK (simulation_only = true),
  CONSTRAINT chk_settlement_period      CHECK (period_end > period_start),
  CONSTRAINT chk_settlement_amount_nn   CHECK (settlement_amount >= 0),
  CONSTRAINT chk_max_payable_nn         CHECK (max_payable >= 0),
  CONSTRAINT chk_settlement_le_payable  CHECK (settlement_amount <= max_payable + 0.0001)
);

CREATE INDEX IF NOT EXISTS idx_mkt_settlements_actor_currency ON public.trade_marketplace_settlements (provider_actor_id, currency);
CREATE INDEX IF NOT EXISTS idx_mkt_settlements_status ON public.trade_marketplace_settlements (status);
CREATE INDEX IF NOT EXISTS idx_mkt_settlements_period ON public.trade_marketplace_settlements (period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_mkt_settlements_idempotency ON public.trade_marketplace_settlements (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_mkt_settlements_updated_at
  BEFORE UPDATE ON public.trade_marketplace_settlements
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- PARTE 3: trade_marketplace_settlement_lines
CREATE TABLE IF NOT EXISTS public.trade_marketplace_settlement_lines (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_id     uuid NOT NULL REFERENCES public.trade_marketplace_settlements(id) ON DELETE CASCADE,
  ledger_entry_id   uuid NOT NULL REFERENCES public.trade_marketplace_ledger_entries(id),
  supplier_order_id uuid REFERENCES public.trade_marketplace_orders(id),
  master_order_id   uuid REFERENCES public.trade_marketplace_master_orders(id),
  entry_type        text NOT NULL,
  gross_amount      numeric(15,4) NOT NULL,
  currency          char(3) NOT NULL DEFAULT 'EUR',
  included_amount   numeric(15,4) NOT NULL,
  line_status       text NOT NULL DEFAULT 'included' CHECK (line_status IN ('included','excluded','adjusted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  metadata          jsonb,
  CONSTRAINT uq_settlement_line_ledger_entry UNIQUE (ledger_entry_id)
);

CREATE INDEX IF NOT EXISTS idx_mkt_settlement_lines_settlement ON public.trade_marketplace_settlement_lines (settlement_id);
CREATE INDEX IF NOT EXISTS idx_mkt_settlement_lines_ledger ON public.trade_marketplace_settlement_lines (ledger_entry_id);
CREATE INDEX IF NOT EXISTS idx_mkt_settlement_lines_supplier ON public.trade_marketplace_settlement_lines (supplier_order_id) WHERE supplier_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mkt_settlement_lines_master ON public.trade_marketplace_settlement_lines (master_order_id) WHERE master_order_id IS NOT NULL;

-- PARTE 4: RLS
ALTER TABLE public.trade_marketplace_settlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlements_provider_select ON public.trade_marketplace_settlements;
CREATE POLICY settlements_provider_select ON public.trade_marketplace_settlements FOR SELECT TO authenticated
  USING (provider_actor_id = ANY(public._mkt_actor_ids_for_user()) OR public._mkt_is_platform_admin());
DROP POLICY IF EXISTS settlements_admin_all ON public.trade_marketplace_settlements;
CREATE POLICY settlements_admin_all ON public.trade_marketplace_settlements FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin()) WITH CHECK (public._mkt_is_platform_admin());

ALTER TABLE public.trade_marketplace_settlement_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS settlement_lines_provider_select ON public.trade_marketplace_settlement_lines;
CREATE POLICY settlement_lines_provider_select ON public.trade_marketplace_settlement_lines FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trade_marketplace_settlements s WHERE s.id = settlement_id AND (s.provider_actor_id = ANY(public._mkt_actor_ids_for_user()) OR public._mkt_is_platform_admin())));
DROP POLICY IF EXISTS settlement_lines_admin_all ON public.trade_marketplace_settlement_lines;
CREATE POLICY settlement_lines_admin_all ON public.trade_marketplace_settlement_lines FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin()) WITH CHECK (public._mkt_is_platform_admin());

GRANT SELECT ON public.trade_marketplace_settlements TO authenticated;
GRANT SELECT ON public.trade_marketplace_settlement_lines TO authenticated;

-- PARTE 5: mkt_fin_preview_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_preview_settlement(
  p_actor_id uuid, p_currency text DEFAULT 'EUR',
  p_period_start timestamptz DEFAULT '-infinity'::timestamptz,
  p_period_end timestamptz DEFAULT now(),
  p_amount numeric(15,4) DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_balance RECORD; v_avail numeric(15,4); v_reserv numeric(15,4); v_neg numeric(15,4); v_hist numeric(15,4);
  v_max_payable numeric(15,4); v_requested numeric(15,4);
  v_sales numeric(15,4):=0; v_shipping numeric(15,4):=0; v_refunds numeric(15,4):=0;
  v_chargebacks numeric(15,4):=0; v_cb_rev numeric(15,4):=0; v_recoveries numeric(15,4):=0;
  v_p2a numeric(15,4):=0; v_rr numeric(15,4):=0; v_adj numeric(15,4):=0; v_line_cnt int:=0;
  v_gross numeric(15,4); v_net numeric(15,4);
BEGIN
  IF NOT (public._mkt_is_platform_admin() OR p_actor_id = ANY(public._mkt_actor_ids_for_user())) THEN RAISE EXCEPTION 'ACCESS_DENIED: actor %', p_actor_id; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id) THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;
  SELECT * INTO v_balance FROM public.trade_marketplace_balances WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;
  v_avail := COALESCE(v_balance.available_amount,0); v_reserv := COALESCE(v_balance.reserved_amount,0);
  v_neg := COALESCE(v_balance.negative_amount,0); v_hist := COALESCE(v_balance.historical_settled_amount,0);
  v_max_payable := GREATEST(v_avail - v_neg, 0); v_requested := LEAST(COALESCE(p_amount, v_max_payable), v_max_payable);
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type='GOODS_ENTITLEMENT'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='SHIPPING_ENTITLEMENT'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL')),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('CHARGEBACK_DEBIT','CHARGEBACK_FEE')),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='CHARGEBACK_CREDIT'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('BALANCE_RECOVERY','FUTURE_SETOFF')),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='PENDING_TO_AVAILABLE'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_RELEASE'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='PROVIDER_ADJUSTMENT'),0),
    COUNT(*)
  INTO v_sales,v_shipping,v_refunds,v_chargebacks,v_cb_rev,v_recoveries,v_p2a,v_rr,v_adj,v_line_cnt
  FROM public.trade_marketplace_ledger_entries le
  WHERE le.actor_id=p_actor_id AND le.currency::text=p_currency AND le.status='confirmed'
    AND le.occurred_at>=p_period_start AND le.occurred_at<=p_period_end
    AND le.entry_type IN ('GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL','CHARGEBACK_DEBIT','CHARGEBACK_FEE','CHARGEBACK_CREDIT','BALANCE_RECOVERY','FUTURE_SETOFF','PENDING_TO_AVAILABLE','RESERVE_RELEASE','PROVIDER_ADJUSTMENT')
    AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_settlement_lines sl WHERE sl.ledger_entry_id=le.id);
  v_gross := v_sales+v_shipping; v_net := v_sales+v_shipping+v_refunds+v_chargebacks+v_cb_rev+v_recoveries+v_adj;
  RETURN jsonb_build_object('provider_actor_id',p_actor_id,'currency',p_currency,'period_start',p_period_start,'period_end',p_period_end,
    'eligible_entries_in_period',v_line_cnt,'period_sales',v_sales,'period_shipping',v_shipping,'period_refunds',v_refunds,
    'period_chargebacks',v_chargebacks,'period_chargeback_reversals',v_cb_rev,'period_recoveries',v_recoveries,
    'period_p2a_transitions',v_p2a,'period_reserve_releases',v_rr,'period_adjustments',v_adj,
    'gross_activity',v_gross,'net_activity',v_net,'current_available',v_avail,'current_reserved',v_reserv,
    'current_negative',v_neg,'current_historical_settled',v_hist,'max_payable',v_max_payable,
    'formula_max_payable','GREATEST(available - negative, 0)','requested_amount',v_requested,
    'commission_real',0,'commission_sim_rate','0.02','commission_note','analytic_only — no reduce payable (COMMISSION_GATE)',
    'payment_fees',0,'projected_available_after',GREATEST(v_avail-v_requested,0),'projected_reserved_after',v_reserv,
    'projected_negative_after',v_neg,'projected_historical_after',v_hist+v_requested,'simulation_only',true,'preview_at',now());
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_preview_settlement TO authenticated;

-- PARTE 6: _mkt_fin_calculate_settlement_lines
CREATE OR REPLACE FUNCTION public._mkt_fin_calculate_settlement_lines(
  p_settlement_id uuid, p_actor_id uuid, p_currency text,
  p_period_start timestamptz, p_period_end timestamptz
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sales numeric(15,4):=0; v_shipping numeric(15,4):=0; v_refunds numeric(15,4):=0;
  v_chargebacks numeric(15,4):=0; v_cb_rev numeric(15,4):=0; v_recoveries numeric(15,4):=0;
  v_p2a numeric(15,4):=0; v_rr numeric(15,4):=0; v_adj numeric(15,4):=0; v_line_cnt int:=0;
  v_gross numeric(15,4); v_net numeric(15,4);
  v_avail numeric(15,4); v_reserv numeric(15,4); v_neg numeric(15,4); v_hist numeric(15,4); v_pending numeric(15,4);
  v_max_payable numeric(15,4); v_settle_amt numeric(15,4);
BEGIN
  DELETE FROM public.trade_marketplace_settlement_lines WHERE settlement_id = p_settlement_id;
  INSERT INTO public.trade_marketplace_settlement_lines (settlement_id,ledger_entry_id,supplier_order_id,master_order_id,entry_type,gross_amount,currency,included_amount,line_status)
  SELECT p_settlement_id,le.id,le.supplier_order_id,le.master_order_id,le.entry_type,le.amount,le.currency::char(3),le.amount,'included'
  FROM public.trade_marketplace_ledger_entries le
  WHERE le.actor_id=p_actor_id AND le.currency::text=p_currency AND le.status='confirmed'
    AND le.occurred_at>=p_period_start AND le.occurred_at<=p_period_end
    AND le.entry_type IN ('GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL','CHARGEBACK_DEBIT','CHARGEBACK_FEE','CHARGEBACK_CREDIT','BALANCE_RECOVERY','FUTURE_SETOFF','PENDING_TO_AVAILABLE','RESERVE_RELEASE','PROVIDER_ADJUSTMENT')
    AND NOT EXISTS (SELECT 1 FROM public.trade_marketplace_settlement_lines sl WHERE sl.ledger_entry_id=le.id AND sl.settlement_id<>p_settlement_id)
  ON CONFLICT (ledger_entry_id) DO NOTHING;
  GET DIAGNOSTICS v_line_cnt = ROW_COUNT;
  SELECT
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='GOODS_ENTITLEMENT'),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='SHIPPING_ENTITLEMENT'),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type IN ('GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL')),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type IN ('CHARGEBACK_DEBIT','CHARGEBACK_FEE')),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='CHARGEBACK_CREDIT'),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type IN ('BALANCE_RECOVERY','FUTURE_SETOFF')),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='PENDING_TO_AVAILABLE'),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='RESERVE_RELEASE'),0),
    COALESCE(SUM(included_amount) FILTER (WHERE entry_type='PROVIDER_ADJUSTMENT'),0)
  INTO v_sales,v_shipping,v_refunds,v_chargebacks,v_cb_rev,v_recoveries,v_p2a,v_rr,v_adj
  FROM public.trade_marketplace_settlement_lines WHERE settlement_id=p_settlement_id AND line_status='included';
  v_gross:=v_sales+v_shipping; v_net:=v_sales+v_shipping+v_refunds+v_chargebacks+v_cb_rev+v_recoveries+v_adj;
  SELECT pending_amount,available_amount,reserved_amount,negative_amount,historical_settled_amount
    INTO v_pending,v_avail,v_reserv,v_neg,v_hist
    FROM public.trade_marketplace_balances WHERE provider_actor_id=p_actor_id AND currency::text=p_currency;
  v_avail:=COALESCE(v_avail,0); v_reserv:=COALESCE(v_reserv,0); v_neg:=COALESCE(v_neg,0);
  v_hist:=COALESCE(v_hist,0); v_pending:=COALESCE(v_pending,0);
  v_max_payable:=GREATEST(v_avail-v_neg,0);
  SELECT COALESCE(settlement_amount,v_max_payable) INTO v_settle_amt FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  v_settle_amt:=LEAST(v_settle_amt,v_max_payable);
  UPDATE public.trade_marketplace_settlements SET
    sales_amount=v_sales,shipping_amount=v_shipping,refund_amount=v_refunds,chargeback_amount=v_chargebacks,
    chargeback_reversal_amount=v_cb_rev,recovery_amount=v_recoveries,reserve_release_amount=v_rr,adjustment_amount=v_adj,
    gross_activity=v_gross,net_activity=v_net,opening_pending=v_pending,opening_available=v_avail,opening_reserved=v_reserv,
    opening_negative=v_neg,opening_historical_settled=v_hist,available_amount_at_calc=v_avail,
    reserved_amount_at_calc=v_reserv,negative_amount_at_calc=v_neg,max_payable=v_max_payable,
    settlement_amount=v_settle_amt,status='calculated',calculated_at=now(),updated_at=now()
  WHERE id=p_settlement_id;
  RETURN jsonb_build_object('lines_inserted',v_line_cnt,'sales',v_sales,'shipping',v_shipping,'refunds',v_refunds,
    'chargebacks',v_chargebacks,'cb_reversals',v_cb_rev,'recoveries',v_recoveries,'p2a',v_p2a,'rr',v_rr,
    'adjustments',v_adj,'gross_activity',v_gross,'net_activity',v_net,'available_snap',v_avail,
    'reserved_snap',v_reserv,'negative_snap',v_neg,'max_payable',v_max_payable,'settlement_amount',v_settle_amt);
END;$$;

-- PARTE 7: mkt_fin_create_simulation_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_create_simulation_settlement(
  p_actor_id uuid, p_currency text DEFAULT 'EUR',
  p_period_start timestamptz DEFAULT '-infinity'::timestamptz,
  p_period_end timestamptz DEFAULT now(),
  p_amount numeric(15,4) DEFAULT NULL, p_idempotency_key text DEFAULT NULL,
  p_notes text DEFAULT NULL, p_correlation_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL, p_auto_calculate bool DEFAULT true
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing RECORD; v_settlement RECORD; v_settle_num text; v_settle_id uuid;
  v_avail numeric(15,4); v_neg numeric(15,4); v_max_payable numeric(15,4); v_settle_amt numeric(15,4); v_calc_result jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trade_marketplace_actors WHERE id=p_actor_id) THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %',p_actor_id; END IF;
  IF p_period_end<=p_period_start THEN RAISE EXCEPTION 'INVALID_PERIOD: period_end must be after period_start'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.trade_marketplace_settlements WHERE idempotency_key=p_idempotency_key;
    IF FOUND THEN RETURN jsonb_build_object('status','replayed','settlement_id',v_existing.id,'settlement_number',v_existing.settlement_number,'settlement_status',v_existing.status,'provider_actor_id',v_existing.provider_actor_id,'currency',v_existing.currency,'max_payable',v_existing.max_payable,'settlement_amount',v_existing.settlement_amount,'simulation_only',true); END IF;
  END IF;
  SELECT available_amount,negative_amount INTO v_avail,v_neg FROM public.trade_marketplace_balances WHERE provider_actor_id=p_actor_id AND currency::text=p_currency;
  v_avail:=COALESCE(v_avail,0); v_neg:=COALESCE(v_neg,0);
  v_max_payable:=GREATEST(v_avail-v_neg,0); v_settle_amt:=LEAST(COALESCE(p_amount,v_max_payable),v_max_payable);
  IF v_settle_amt<0 THEN v_settle_amt:=0; END IF;
  v_settle_num:=public.next_financial_doc_number('SETL');
  INSERT INTO public.trade_marketplace_settlements (settlement_number,provider_actor_id,currency,period_start,period_end,status,max_payable,settlement_amount,simulation_only,idempotency_key,notes,correlation_id,metadata,created_by)
  VALUES (v_settle_num,p_actor_id,p_currency::char(3),p_period_start,p_period_end,'draft',v_max_payable,v_settle_amt,true,p_idempotency_key,p_notes,p_correlation_id,p_metadata,auth.uid())
  RETURNING * INTO v_settlement;
  v_settle_id:=v_settlement.id;
  IF p_auto_calculate THEN
    v_calc_result:=public._mkt_fin_calculate_settlement_lines(v_settle_id,p_actor_id,p_currency,p_period_start,p_period_end);
    SELECT * INTO v_settlement FROM public.trade_marketplace_settlements WHERE id=v_settle_id;
  END IF;
  PERFORM public.mkt_fin_audit('settlement_created','settlement',v_settle_id,NULL,NULL,jsonb_build_object('settlement_number',v_settlement.settlement_number,'provider_actor_id',p_actor_id,'currency',p_currency,'status',v_settlement.status,'max_payable',v_settlement.max_payable,'settlement_amount',v_settlement.settlement_amount),'Settlement creado',p_correlation_id,NULL);
  PERFORM public.mkt_fin_outbox_publish('marketplace.settlement.created',jsonb_build_object('settlement_id',v_settle_id,'settlement_number',v_settlement.settlement_number,'provider_actor_id',p_actor_id,'currency',p_currency,'status',v_settlement.status,'simulation_only',true),NULL,NULL);
  RETURN jsonb_build_object('status','created','settlement_id',v_settle_id,'settlement_number',v_settlement.settlement_number,'settlement_status',v_settlement.status,'provider_actor_id',p_actor_id,'currency',p_currency,'period_start',p_period_start,'period_end',p_period_end,'max_payable',v_settlement.max_payable,'settlement_amount',v_settlement.settlement_amount,'lines_count',CASE WHEN p_auto_calculate THEN (SELECT COUNT(*) FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_settle_id) ELSE 0 END,'auto_calculated',p_auto_calculate,'simulation_only',true);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_create_simulation_settlement TO authenticated;

-- PARTE 8: mkt_fin_recalculate_draft_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_recalculate_draft_settlement(p_settlement_id uuid, p_amount numeric(15,4) DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF v_s.status<>'draft' THEN RAISE EXCEPTION 'SETTLEMENT_NOT_DRAFT: status=% — recalculate solo en draft',v_s.status; END IF;
  IF p_amount IS NOT NULL THEN UPDATE public.trade_marketplace_settlements SET settlement_amount=p_amount,updated_at=now() WHERE id=p_settlement_id; END IF;
  UPDATE public.trade_marketplace_settlements SET status='draft',updated_at=now() WHERE id=p_settlement_id;
  PERFORM public._mkt_fin_calculate_settlement_lines(p_settlement_id,v_s.provider_actor_id,v_s.currency::text,v_s.period_start,v_s.period_end);
  UPDATE public.trade_marketplace_settlements SET status='draft',calculated_at=now(),updated_at=now() WHERE id=p_settlement_id;
  PERFORM public.mkt_fin_audit('settlement_recalculated','settlement',p_settlement_id,NULL,NULL,jsonb_build_object('settlement_number',v_s.settlement_number),'Recalculado por admin',NULL,NULL);
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  RETURN jsonb_build_object('status','recalculated','settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'settlement_status',v_s.status,'max_payable',v_s.max_payable,'settlement_amount',v_s.settlement_amount,'lines_count',(SELECT COUNT(*) FROM public.trade_marketplace_settlement_lines WHERE settlement_id=p_settlement_id));
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_recalculate_draft_settlement TO authenticated;

-- PARTE 9: mkt_fin_approve_simulation_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_approve_simulation_settlement(p_settlement_id uuid, p_notes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF v_s.status NOT IN ('draft','calculated') THEN RAISE EXCEPTION 'SETTLEMENT_INVALID_STATE: status=% — approve requiere draft/calculated',v_s.status; END IF;
  IF v_s.status='draft' THEN PERFORM public._mkt_fin_calculate_settlement_lines(p_settlement_id,v_s.provider_actor_id,v_s.currency::text,v_s.period_start,v_s.period_end); END IF;
  UPDATE public.trade_marketplace_settlements SET status='approved',approved_at=now(),approved_by=auth.uid(),notes=COALESCE(p_notes,notes),updated_at=now() WHERE id=p_settlement_id;
  PERFORM public.mkt_fin_audit('settlement_approved','settlement',p_settlement_id,NULL,NULL,jsonb_build_object('settlement_number',v_s.settlement_number,'notes',p_notes),'Aprobado por admin',v_s.correlation_id,NULL);
  PERFORM public.mkt_fin_outbox_publish('marketplace.settlement.approved',jsonb_build_object('settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'provider_actor_id',v_s.provider_actor_id,'currency',v_s.currency,'settlement_amount',v_s.settlement_amount,'simulation_only',true),NULL,NULL);
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  RETURN jsonb_build_object('status','approved','settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'settlement_status',v_s.status,'max_payable',v_s.max_payable,'settlement_amount',v_s.settlement_amount,'approved_at',v_s.approved_at);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_approve_simulation_settlement TO authenticated;

-- PARTE 10: mkt_fin_simulate_settlement_payment
CREATE OR REPLACE FUNCTION public.mkt_fin_simulate_settlement_payment(p_settlement_id uuid, p_correlation_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD; v_ledger_entry_id uuid; v_balance_after jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF v_s.status='simulated_paid' THEN RETURN jsonb_build_object('status','replayed','settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'settlement_status',v_s.status,'settlement_amount',v_s.settlement_amount,'simulation_only',true); END IF;
  IF v_s.status NOT IN ('approved','payable') THEN RAISE EXCEPTION 'SETTLEMENT_INVALID_STATE: status=% — simulate_payment requiere approved/payable',v_s.status; END IF;
  IF v_s.settlement_amount<=0 THEN RAISE EXCEPTION 'SETTLEMENT_ZERO_AMOUNT: no se puede pagar un settlement de 0'; END IF;
  INSERT INTO public.trade_marketplace_ledger_entries (entry_type,amount,currency,actor_id,settlement_id,description,correlation_id,source_event_id,external_provider,status,occurred_at)
  VALUES ('SETTLEMENT_PAID_SIMULATION',-v_s.settlement_amount,v_s.currency::char(3),v_s.provider_actor_id,p_settlement_id,'Pago simulado settlement '||v_s.settlement_number,COALESCE(p_correlation_id,v_s.correlation_id,'setl-'||p_settlement_id::text),'setl-pay-sim-'||p_settlement_id::text,'simulation','confirmed',now())
  RETURNING id INTO v_ledger_entry_id;
  UPDATE public.trade_marketplace_settlements SET status='simulated_paid',simulated_paid_at=now(),settlement_ledger_entry_id=v_ledger_entry_id,updated_at=now() WHERE id=p_settlement_id;
  v_balance_after:=public.mkt_fin_rebuild_provider_balance(v_s.provider_actor_id,v_s.currency::text);
  PERFORM public.mkt_fin_audit('settlement_simulated_paid','settlement',p_settlement_id,NULL,NULL,jsonb_build_object('settlement_number',v_s.settlement_number,'provider_actor_id',v_s.provider_actor_id,'currency',v_s.currency,'settlement_amount',v_s.settlement_amount,'ledger_entry_id',v_ledger_entry_id,'available_after',v_balance_after->>'available_amount','historical_settled',v_balance_after->>'historical_settled','stripe_gate','closed','no_real_transfer',true),'Settlement simulado como pagado — no hay pago real',COALESCE(p_correlation_id,v_s.correlation_id),NULL);
  PERFORM public.mkt_fin_outbox_publish('marketplace.settlement.simulated_paid',jsonb_build_object('settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'provider_actor_id',v_s.provider_actor_id,'currency',v_s.currency,'settlement_amount',v_s.settlement_amount,'ledger_entry_id',v_ledger_entry_id,'simulation_only',true,'stripe_gate','closed'),NULL,NULL);
  RETURN jsonb_build_object('status','done','settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'settlement_status','simulated_paid','settlement_amount',v_s.settlement_amount,'ledger_entry_id',v_ledger_entry_id,'new_available',(v_balance_after->>'available_amount')::numeric,'new_historical_settled',(v_balance_after->>'historical_settled')::numeric,'new_teb',(v_balance_after->>'total_economic_balance')::numeric,'simulation_only',true);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_simulate_settlement_payment TO authenticated;

-- PARTE 11: mkt_fin_cancel_draft_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_cancel_draft_settlement(p_settlement_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF v_s.status NOT IN ('draft','calculated') THEN RAISE EXCEPTION 'SETTLEMENT_CANNOT_CANCEL: status=% — solo draft/calculated cancelables',v_s.status; END IF;
  DELETE FROM public.trade_marketplace_settlement_lines WHERE settlement_id=p_settlement_id;
  UPDATE public.trade_marketplace_settlements SET status='cancelled',cancelled_at=now(),notes=COALESCE(p_reason,notes),updated_at=now() WHERE id=p_settlement_id;
  PERFORM public.mkt_fin_audit('settlement_cancelled','settlement',p_settlement_id,NULL,NULL,jsonb_build_object('settlement_number',v_s.settlement_number,'reason',p_reason),COALESCE(p_reason,'Cancelado por admin'),NULL,NULL);
  RETURN jsonb_build_object('status','cancelled','settlement_id',p_settlement_id,'settlement_number',v_s.settlement_number,'cancelled_at',now(),'ledger_entries_freed',true);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_cancel_draft_settlement TO authenticated;

-- PARTE 12: mkt_fin_get_settlement
CREATE OR REPLACE FUNCTION public.mkt_fin_get_settlement(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD;
BEGIN
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF NOT (public._mkt_is_platform_admin() OR v_s.provider_actor_id=ANY(public._mkt_actor_ids_for_user())) THEN RAISE EXCEPTION 'ACCESS_DENIED: settlement %',p_settlement_id; END IF;
  RETURN jsonb_build_object('id',v_s.id,'settlement_number',v_s.settlement_number,'provider_actor_id',v_s.provider_actor_id,'currency',v_s.currency,'period_start',v_s.period_start,'period_end',v_s.period_end,'status',v_s.status,'opening_pending',v_s.opening_pending,'opening_available',v_s.opening_available,'opening_reserved',v_s.opening_reserved,'opening_negative',v_s.opening_negative,'opening_historical_settled',v_s.opening_historical_settled,'sales_amount',v_s.sales_amount,'shipping_amount',v_s.shipping_amount,'refund_amount',v_s.refund_amount,'chargeback_amount',v_s.chargeback_amount,'chargeback_reversal_amount',v_s.chargeback_reversal_amount,'recovery_amount',v_s.recovery_amount,'reserve_release_amount',v_s.reserve_release_amount,'commission_amount',v_s.commission_amount,'adjustment_amount',v_s.adjustment_amount,'gross_activity',v_s.gross_activity,'net_activity',v_s.net_activity,'available_amount_at_calc',v_s.available_amount_at_calc,'reserved_amount_at_calc',v_s.reserved_amount_at_calc,'negative_amount_at_calc',v_s.negative_amount_at_calc,'max_payable',v_s.max_payable,'settlement_amount',v_s.settlement_amount,'settlement_ledger_entry_id',v_s.settlement_ledger_entry_id,'simulation_only',v_s.simulation_only,'lines_count',(SELECT COUNT(*) FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_s.id AND line_status='included'),'calculated_at',v_s.calculated_at,'approved_at',v_s.approved_at,'simulated_paid_at',v_s.simulated_paid_at,'closed_at',v_s.closed_at,'cancelled_at',v_s.cancelled_at,'created_at',v_s.created_at,'updated_at',v_s.updated_at);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_settlement TO authenticated;

-- PARTE 13: mkt_fin_list_provider_settlements
CREATE OR REPLACE FUNCTION public.mkt_fin_list_provider_settlements(p_actor_id uuid, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_total int;
BEGIN
  IF NOT (public._mkt_is_platform_admin() OR p_actor_id=ANY(public._mkt_actor_ids_for_user())) THEN RAISE EXCEPTION 'ACCESS_DENIED: actor %',p_actor_id; END IF;
  SELECT COUNT(*) INTO v_total FROM public.trade_marketplace_settlements WHERE provider_actor_id=p_actor_id;
  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC),'[]'::jsonb) INTO v_items FROM (SELECT id,settlement_number,currency,period_start,period_end,status,max_payable,settlement_amount,simulation_only,calculated_at,approved_at,simulated_paid_at,created_at FROM public.trade_marketplace_settlements WHERE provider_actor_id=p_actor_id ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset) r;
  RETURN jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset);
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_list_provider_settlements TO authenticated;

-- PARTE 14: mkt_fin_list_admin_settlements
CREATE OR REPLACE FUNCTION public.mkt_fin_list_admin_settlements(p_status text DEFAULT NULL, p_currency text DEFAULT NULL, p_actor_id uuid DEFAULT NULL, p_limit int DEFAULT 50, p_offset int DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_items jsonb; v_total int;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT COUNT(*) INTO v_total FROM public.trade_marketplace_settlements WHERE (p_status IS NULL OR status=p_status) AND (p_currency IS NULL OR currency::text=p_currency) AND (p_actor_id IS NULL OR provider_actor_id=p_actor_id);
  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC),'[]'::jsonb) INTO v_items FROM (SELECT id,settlement_number,provider_actor_id,currency,period_start,period_end,status,max_payable,settlement_amount,simulation_only,calculated_at,approved_at,simulated_paid_at,created_at FROM public.trade_marketplace_settlements WHERE (p_status IS NULL OR status=p_status) AND (p_currency IS NULL OR currency::text=p_currency) AND (p_actor_id IS NULL OR provider_actor_id=p_actor_id) ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset) r;
  RETURN jsonb_build_object('items',v_items,'total',v_total,'limit',p_limit,'offset',p_offset,'filters',jsonb_build_object('status',p_status,'currency',p_currency,'actor_id',p_actor_id));
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_list_admin_settlements TO authenticated;

-- PARTE 15: mkt_fin_get_settlement_statement_data
CREATE OR REPLACE FUNCTION public.mkt_fin_get_settlement_statement_data(p_settlement_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_s RECORD; v_lines jsonb; v_balance RECORD;
BEGIN
  SELECT * INTO v_s FROM public.trade_marketplace_settlements WHERE id=p_settlement_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'SETTLEMENT_NOT_FOUND: %',p_settlement_id; END IF;
  IF NOT (public._mkt_is_platform_admin() OR v_s.provider_actor_id=ANY(public._mkt_actor_ids_for_user())) THEN RAISE EXCEPTION 'ACCESS_DENIED: settlement %',p_settlement_id; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('line_id',sl.id,'ledger_entry_id',sl.ledger_entry_id,'supplier_order_id',sl.supplier_order_id,'master_order_id',sl.master_order_id,'entry_type',sl.entry_type,'amount',sl.included_amount,'currency',sl.currency,'line_status',sl.line_status) ORDER BY sl.created_at),'[]'::jsonb) INTO v_lines FROM public.trade_marketplace_settlement_lines sl WHERE sl.settlement_id=p_settlement_id AND sl.line_status='included';
  SELECT * INTO v_balance FROM public.trade_marketplace_balances WHERE provider_actor_id=v_s.provider_actor_id AND currency::text=v_s.currency::text;
  RETURN jsonb_build_object('settlement_id',v_s.id,'settlement_number',v_s.settlement_number,'provider_actor_id',v_s.provider_actor_id,'currency',v_s.currency,'period_start',v_s.period_start,'period_end',v_s.period_end,'status',v_s.status,'period_summary',jsonb_build_object('sales',v_s.sales_amount,'shipping',v_s.shipping_amount,'refunds',v_s.refund_amount,'chargebacks',v_s.chargeback_amount,'chargeback_reversals',v_s.chargeback_reversal_amount,'recoveries',v_s.recovery_amount,'reserve_releases',v_s.reserve_release_amount,'adjustments',v_s.adjustment_amount,'gross_activity',v_s.gross_activity,'net_activity',v_s.net_activity,'commission_real',0,'commission_note','COMMISSION_GATE closed — 0 in Phase 0','payment_fees',0,'fees_note','STRIPE_GATE closed — 0 in Phase 0'),'balance_at_calculation',jsonb_build_object('available',v_s.available_amount_at_calc,'reserved',v_s.reserved_amount_at_calc,'negative',v_s.negative_amount_at_calc,'max_payable',v_s.max_payable,'formula','GREATEST(available - negative, 0)'),'settlement_economics',jsonb_build_object('settlement_amount',v_s.settlement_amount,'max_payable',v_s.max_payable,'settlement_type','simulated','simulation_only',true),'closing_position',jsonb_build_object('opening_available',v_s.opening_available,'settlement_amount',v_s.settlement_amount,'projected_available_after',GREATEST(v_s.opening_available-v_s.settlement_amount,0),'projected_historical_after',v_s.opening_historical_settled+v_s.settlement_amount,'reserved_unchanged',v_s.opening_reserved,'negative_unchanged',v_s.opening_negative),'current_balance',CASE WHEN v_balance.provider_actor_id IS NOT NULL THEN jsonb_build_object('available',v_balance.available_amount,'reserved',v_balance.reserved_amount,'negative',v_balance.negative_amount,'historical_settled',v_balance.historical_settled_amount,'teb',v_balance.total_economic_balance) ELSE NULL END,'lines',v_lines,'lines_count',jsonb_array_length(v_lines),'ledger_entry_id',v_s.settlement_ledger_entry_id,'gates',jsonb_build_object('STRIPE_GATE','closed','LEGAL_GATE','closed','TAX_GATE','closed','note','Settlement ≠ Factura Fiscal. No se genera documento tributario.'),'generated_at',now());
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_settlement_statement_data TO authenticated;

-- PARTE 16: mkt_fin_get_admin_settlements_overview
CREATE OR REPLACE FUNCTION public.mkt_fin_get_admin_settlements_overview()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_by_currency jsonb; v_by_provider jsonb; v_r jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required'; END IF;
  SELECT jsonb_object_agg(currency_key,currency_data) INTO v_by_currency FROM (SELECT currency::text AS currency_key,jsonb_build_object('total_settled',COALESCE(SUM(settlement_amount) FILTER (WHERE status='simulated_paid'),0),'total_max_payable',COALESCE(SUM(max_payable),0),'settlements_count',COUNT(*),'simulated_paid_count',COUNT(*) FILTER (WHERE status='simulated_paid')) AS currency_data FROM public.trade_marketplace_settlements GROUP BY currency) sub;
  SELECT COALESCE(jsonb_agg(row_to_json(p.*) ORDER BY p.total_settled DESC),'[]'::jsonb) INTO v_by_provider FROM (SELECT provider_actor_id,COUNT(*) AS settlements_count,COALESCE(SUM(settlement_amount) FILTER (WHERE status='simulated_paid'),0) AS total_settled,COALESCE(SUM(max_payable),0) AS total_max_payable FROM public.trade_marketplace_settlements GROUP BY provider_actor_id ORDER BY total_settled DESC LIMIT 10) p;
  SELECT jsonb_build_object('total_settlements',COUNT(*),'settlements_draft',COUNT(*) FILTER (WHERE status='draft'),'settlements_calculated',COUNT(*) FILTER (WHERE status='calculated'),'settlements_approved',COUNT(*) FILTER (WHERE status='approved'),'settlements_payable',COUNT(*) FILTER (WHERE status='payable'),'settlements_simulated_paid',COUNT(*) FILTER (WHERE status='simulated_paid'),'settlements_closed',COUNT(*) FILTER (WHERE status='closed'),'settlements_cancelled',COUNT(*) FILTER (WHERE status='cancelled'),'total_max_payable',COALESCE(SUM(max_payable) FILTER (WHERE status IN ('draft','calculated','approved','payable')),0),'total_simulated_paid',COALESCE(SUM(settlement_amount) FILTER (WHERE status='simulated_paid'),0),'avg_settlement_amount',COALESCE(AVG(settlement_amount) FILTER (WHERE status='simulated_paid'),0),'providers_with_settlements',COUNT(DISTINCT provider_actor_id),'simulation_only',true,'by_currency',COALESCE(v_by_currency,'{}'::jsonb),'top_providers_by_settled',v_by_provider,'calculated_at',now()) INTO v_r FROM public.trade_marketplace_settlements;
  RETURN COALESCE(v_r,jsonb_build_object('total_settlements',0,'simulation_only',true,'calculated_at',now()));
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_admin_settlements_overview TO authenticated;

-- PARTE 17: mkt_fin_rebuild_provider_balance — Phase 2F
CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(p_actor_id uuid, p_currency text DEFAULT 'EUR')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base_sum numeric(15,4):=0; v_p2a_sum numeric(15,4):=0; v_rh_sum numeric(15,4):=0;
  v_rr_sum numeric(15,4):=0; v_sps_sum numeric(15,4):=0;
  v_pending_net numeric(15,4):=0; v_pending numeric(15,4):=0; v_available numeric(15,4):=0;
  v_reserved numeric(15,4):=0; v_negative numeric(15,4):=0; v_settled numeric(15,4):=0; v_teb numeric(15,4):=0;
  v_last_entry_id uuid; v_entry_count int;
  v_prior_negative_since timestamptz; v_new_negative_since timestamptz; v_has_active_recovery bool:=false; v_actor_exists bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id=p_actor_id) INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %',p_actor_id; END IF;
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL','CHARGEBACK_DEBIT','CHARGEBACK_CREDIT','CHARGEBACK_FEE','BALANCE_RECOVERY','FUTURE_SETOFF') AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='PENDING_TO_AVAILABLE' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_HOLD' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_RELEASE' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='SETTLEMENT_PAID_SIMULATION' AND status!='failed'),0),
    COUNT(*) FILTER (WHERE status!='failed'),
    (SELECT l2.id FROM public.trade_marketplace_ledger_entries l2 WHERE l2.actor_id=p_actor_id AND l2.currency::text=p_currency AND l2.status!='failed' ORDER BY l2.occurred_at DESC,l2.created_at DESC LIMIT 1)
  INTO v_base_sum,v_p2a_sum,v_rh_sum,v_rr_sum,v_sps_sum,v_entry_count,v_last_entry_id
  FROM public.trade_marketplace_ledger_entries WHERE actor_id=p_actor_id AND currency::text=p_currency;
  SELECT COALESCE(negative_since,NULL) INTO v_prior_negative_since FROM public.trade_marketplace_balances WHERE provider_actor_id=p_actor_id AND currency::text=p_currency;
  v_pending_net:=v_base_sum-v_p2a_sum;
  v_available:=GREATEST(v_p2a_sum+v_rh_sum+v_rr_sum+v_sps_sum,0);
  v_reserved:=GREATEST(-(v_rh_sum+v_rr_sum),0);
  v_settled:=GREATEST(-v_sps_sum,0);
  IF v_pending_net>=0 THEN v_pending:=v_pending_net; v_negative:=0; v_new_negative_since:=NULL;
  ELSE v_pending:=0; v_negative:=ABS(v_pending_net); v_new_negative_since:=COALESCE(v_prior_negative_since,now()); END IF;
  v_teb:=v_pending+v_available+v_reserved-v_negative;
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_recoveries WHERE provider_actor_id=p_actor_id AND currency::text=p_currency AND status IN ('pending','partial')) INTO v_has_active_recovery;
  INSERT INTO public.trade_marketplace_balances (provider_actor_id,currency,pending_amount,available_amount,reserved_amount,negative_amount,historical_settled_amount,negative_since,recovery_in_progress,last_ledger_entry_id,last_recalculated_at,projection_strategy)
  VALUES (p_actor_id,p_currency::char(3),v_pending,v_available,v_reserved,v_negative,v_settled,v_new_negative_since,v_has_active_recovery,v_last_entry_id,now(),'ledger_rebuild')
  ON CONFLICT (provider_actor_id,currency) DO UPDATE SET
    pending_amount=EXCLUDED.pending_amount,available_amount=EXCLUDED.available_amount,reserved_amount=EXCLUDED.reserved_amount,
    negative_amount=EXCLUDED.negative_amount,historical_settled_amount=EXCLUDED.historical_settled_amount,
    negative_since=CASE WHEN EXCLUDED.negative_amount>0 THEN COALESCE(public.trade_marketplace_balances.negative_since,EXCLUDED.negative_since) ELSE NULL END,
    recovery_in_progress=EXCLUDED.recovery_in_progress,last_ledger_entry_id=EXCLUDED.last_ledger_entry_id,
    last_recalculated_at=EXCLUDED.last_recalculated_at,projection_strategy=EXCLUDED.projection_strategy,updated_at=now();
  RETURN jsonb_build_object('phase','2F','provider_actor_id',p_actor_id,'currency',p_currency,'pending_amount',v_pending,'available_amount',v_available,'reserved_amount',v_reserved,'negative_amount',v_negative,'historical_settled',v_settled,'total_economic_balance',v_teb,'negative_since',v_new_negative_since,'recovery_in_progress',v_has_active_recovery,'ledger_entries',v_entry_count,'rebuilt_at',now());
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_rebuild_provider_balance TO authenticated;

-- PARTE 18: mkt_fin_reconcile_provider_balance — Phase 2F
CREATE OR REPLACE FUNCTION public.mkt_fin_reconcile_provider_balance(p_actor_id uuid, p_currency text DEFAULT 'EUR')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_stored RECORD; v_base_sum numeric(15,4); v_p2a_sum numeric(15,4); v_rh_sum numeric(15,4);
  v_rr_sum numeric(15,4); v_sps_sum numeric(15,4); v_pnet numeric(15,4);
  v_exp_pending numeric(15,4); v_exp_avail numeric(15,4); v_exp_reserv numeric(15,4);
  v_exp_neg numeric(15,4); v_exp_settled numeric(15,4); v_exp_teb numeric(15,4); v_ok bool;
BEGIN
  IF NOT (public._mkt_is_platform_admin() OR p_actor_id=ANY(public._mkt_actor_ids_for_user())) THEN RAISE EXCEPTION 'ACCESS_DENIED: actor %',p_actor_id; END IF;
  SELECT * INTO v_stored FROM public.trade_marketplace_balances WHERE provider_actor_id=p_actor_id AND currency::text=p_currency;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','NO_PROJECTION','provider_actor_id',p_actor_id); END IF;
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN ('GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL','CHARGEBACK_DEBIT','CHARGEBACK_CREDIT','CHARGEBACK_FEE','BALANCE_RECOVERY','FUTURE_SETOFF') AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='PENDING_TO_AVAILABLE' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_HOLD' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_RELEASE' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='SETTLEMENT_PAID_SIMULATION' AND status!='failed'),0)
  INTO v_base_sum,v_p2a_sum,v_rh_sum,v_rr_sum,v_sps_sum
  FROM public.trade_marketplace_ledger_entries WHERE actor_id=p_actor_id AND currency::text=p_currency;
  v_pnet:=v_base_sum-v_p2a_sum;
  v_exp_avail:=GREATEST(v_p2a_sum+v_rh_sum+v_rr_sum+v_sps_sum,0);
  v_exp_reserv:=GREATEST(-(v_rh_sum+v_rr_sum),0);
  v_exp_settled:=GREATEST(-v_sps_sum,0);
  IF v_pnet>=0 THEN v_exp_pending:=v_pnet; v_exp_neg:=0; ELSE v_exp_pending:=0; v_exp_neg:=ABS(v_pnet); END IF;
  v_exp_teb:=v_exp_pending+v_exp_avail+v_exp_reserv-v_exp_neg;
  v_ok:=ABS(v_stored.pending_amount-v_exp_pending)<0.0001 AND ABS(v_stored.available_amount-v_exp_avail)<0.0001 AND ABS(v_stored.reserved_amount-v_exp_reserv)<0.0001 AND ABS(v_stored.negative_amount-v_exp_neg)<0.0001 AND ABS(v_stored.historical_settled_amount-v_exp_settled)<0.0001 AND ABS(v_stored.total_economic_balance-v_exp_teb)<0.0001;
  RETURN jsonb_build_object('phase','2F','status',CASE WHEN v_ok THEN 'MATCH' ELSE 'MISMATCH' END,'stored_pending',v_stored.pending_amount,'expected_pending',v_exp_pending,'stored_available',v_stored.available_amount,'expected_available',v_exp_avail,'stored_reserved',v_stored.reserved_amount,'expected_reserved',v_exp_reserv,'stored_negative',v_stored.negative_amount,'expected_negative',v_exp_neg,'stored_historical_settled',v_stored.historical_settled_amount,'expected_historical_settled',v_exp_settled,'stored_teb',v_stored.total_economic_balance,'expected_teb',v_exp_teb,'checked_at',now());
END;$$;
GRANT EXECUTE ON FUNCTION public.mkt_fin_reconcile_provider_balance TO authenticated;

COMMIT;;
