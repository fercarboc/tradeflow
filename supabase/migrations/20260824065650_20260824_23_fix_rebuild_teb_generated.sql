
-- Fix: total_economic_balance is GENERATED ALWAYS — must not appear in INSERT/UPDATE SET

CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(p_actor_id uuid, p_currency text DEFAULT 'EUR')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base_sum   numeric(15,4):=0; v_p2a_sum  numeric(15,4):=0;
  v_rh_sum     numeric(15,4):=0; v_rr_sum   numeric(15,4):=0;
  v_pending_net numeric(15,4):=0; v_pending  numeric(15,4):=0;
  v_available  numeric(15,4):=0; v_reserved numeric(15,4):=0;
  v_negative   numeric(15,4):=0; v_settled  numeric(15,4):=0;
  v_teb        numeric(15,4):=0;
  v_last_entry_id uuid; v_entry_count int;
  v_prior_negative_since timestamptz; v_new_negative_since timestamptz;
  v_has_active_recovery bool:=false; v_actor_exists bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id=p_actor_id) INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN (
      'GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT','GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL',
      'CHARGEBACK_DEBIT','CHARGEBACK_CREDIT','CHARGEBACK_FEE',
      'BALANCE_RECOVERY','FUTURE_SETOFF'
    ) AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='PENDING_TO_AVAILABLE' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_HOLD' AND status!='failed'),0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type='RESERVE_RELEASE' AND status!='failed'),0),
    COUNT(*) FILTER (WHERE status!='failed'),
    (SELECT l2.id FROM public.trade_marketplace_ledger_entries l2
     WHERE l2.actor_id=p_actor_id AND l2.currency::text=p_currency AND l2.status!='failed'
     ORDER BY l2.occurred_at DESC, l2.created_at DESC LIMIT 1)
  INTO v_base_sum, v_p2a_sum, v_rh_sum, v_rr_sum, v_entry_count, v_last_entry_id
  FROM public.trade_marketplace_ledger_entries
  WHERE actor_id=p_actor_id AND currency::text=p_currency;

  SELECT COALESCE(negative_since, NULL) INTO v_prior_negative_since
  FROM public.trade_marketplace_balances
  WHERE provider_actor_id=p_actor_id AND currency::text=p_currency;

  v_pending_net := v_base_sum - v_p2a_sum;
  v_available   := GREATEST(v_p2a_sum + v_rh_sum + v_rr_sum, 0);
  v_reserved    := GREATEST(-(v_rh_sum + v_rr_sum), 0);

  IF v_pending_net >= 0 THEN
    v_pending:=v_pending_net; v_negative:=0; v_new_negative_since:=NULL;
  ELSE
    v_pending:=0; v_negative:=ABS(v_pending_net);
    v_new_negative_since:=COALESCE(v_prior_negative_since, now());
  END IF;

  v_teb := v_pending + v_available + v_reserved - v_negative;

  SELECT EXISTS(
    SELECT 1 FROM public.trade_marketplace_recoveries
    WHERE provider_actor_id=p_actor_id AND currency::text=p_currency AND status IN('pending','partial')
  ) INTO v_has_active_recovery;

  -- total_economic_balance is GENERATED ALWAYS — excluded from INSERT and UPDATE SET
  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount, negative_since, recovery_in_progress,
    last_ledger_entry_id, last_recalculated_at, projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative,
    v_settled, v_new_negative_since, v_has_active_recovery,
    v_last_entry_id, now(), 'ledger_rebuild'
  )
  ON CONFLICT (provider_actor_id, currency) DO UPDATE SET
    pending_amount          = EXCLUDED.pending_amount,
    available_amount        = EXCLUDED.available_amount,
    reserved_amount         = EXCLUDED.reserved_amount,
    negative_amount         = EXCLUDED.negative_amount,
    historical_settled_amount = EXCLUDED.historical_settled_amount,
    negative_since          = CASE
      WHEN EXCLUDED.negative_amount > 0
      THEN COALESCE(public.trade_marketplace_balances.negative_since, EXCLUDED.negative_since)
      ELSE NULL END,
    recovery_in_progress    = EXCLUDED.recovery_in_progress,
    last_ledger_entry_id    = EXCLUDED.last_ledger_entry_id,
    last_recalculated_at    = EXCLUDED.last_recalculated_at,
    projection_strategy     = EXCLUDED.projection_strategy,
    updated_at              = now();

  RETURN jsonb_build_object(
    'phase','2E',
    'provider_actor_id', p_actor_id,
    'currency',          p_currency,
    'pending_amount',    v_pending,
    'available_amount',  v_available,
    'reserved_amount',   v_reserved,
    'negative_amount',   v_negative,
    'total_economic_balance', v_teb,
    'negative_since',    v_new_negative_since,
    'recovery_in_progress', v_has_active_recovery,
    'ledger_entries',    v_entry_count,
    'rebuilt_at',        now()
  );
END;$$;
;
