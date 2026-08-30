-- FIX: v_d.currency::char trunca 'EUR' a 'E' en ledger_append.
-- 5 ocurrencias en mkt_fin_simulate_dispute_outcome (LOST×2, ACCEPTED×2, WON×1).
-- Fix: pasar v_d.currency directamente (char(3) → bpchar sin truncar).

BEGIN;

CREATE OR REPLACE FUNCTION public.mkt_fin_simulate_dispute_outcome(
  p_dispute_id       uuid,
  p_outcome          text,
  p_chargeback_fee   numeric     DEFAULT 0,
  p_source_event_id  text        DEFAULT NULL,
  p_correlation_id   text        DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d               record;
  v_corr            text;
  v_debit_entry_id  uuid;
  v_entry_row       public.trade_marketplace_ledger_entries;
BEGIN
  -- Idempotencia por source_event_id
  IF p_source_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trade_marketplace_ledger_entries
       WHERE source_event_id = p_source_event_id
         AND supplier_order_id = (
           SELECT supplier_order_id FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
         )
    ) THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_status',    status,
          'outcome',           outcome,
          'chargeback_posted', chargeback_posted
        )
        FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
      );
    END IF;
  END IF;

  SELECT * INTO v_d
    FROM public.trade_marketplace_disputes
   WHERE id = p_dispute_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND: %', p_dispute_id; END IF;

  IF NOT public._mkt_validate_dispute_transition(v_d.status, p_outcome) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % → %', v_d.status, p_outcome;
  END IF;

  v_corr := COALESCE(p_correlation_id, 'dispute-outcome-' || gen_random_uuid()::text);

  -- ── LOST ───────────────────────────────────────────────────────────────
  IF p_outcome = 'lost' THEN

    v_entry_row := public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -(v_d.amount),
      v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
      'Chargeback debit — ' || v_d.dispute_number,
      v_corr, p_source_event_id, NULL, 'simulation', p_dispute_id::text, 'dispute',
      v_d.currency,   -- FIX: sin ::char (char(3) → 'EUR', no truncar a 'E')
      'confirmed', now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE', -(p_chargeback_fee),
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback fee — ' || v_d.dispute_number,
        v_corr, NULL, NULL, 'simulation', p_dispute_id::text, 'dispute_fee',
        v_d.currency,   -- FIX
        'confirmed', now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status                = 'lost',
      outcome               = 'lost',
      chargeback_posted     = true,
      chargeback_amount     = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at           = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  -- ── ACCEPTED ───────────────────────────────────────────────────────────
  ELSIF p_outcome = 'accepted' THEN

    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -(v_d.amount),
      v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
      'Chargeback debit (accepted) — ' || v_d.dispute_number,
      v_corr, p_source_event_id, NULL, 'simulation', p_dispute_id::text, 'dispute',
      v_d.currency,   -- FIX
      'confirmed', now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE', -(p_chargeback_fee),
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback fee (accepted) — ' || v_d.dispute_number,
        v_corr, NULL, NULL, 'simulation', p_dispute_id::text, 'dispute_fee',
        v_d.currency,   -- FIX
        'confirmed', now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status                = 'accepted',
      outcome               = 'accepted',
      chargeback_posted     = true,
      chargeback_amount     = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at           = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  -- ── WON ────────────────────────────────────────────────────────────────
  ELSIF p_outcome = 'won' THEN

    IF v_d.chargeback_posted THEN
      SELECT id INTO v_debit_entry_id
        FROM public.trade_marketplace_ledger_entries
       WHERE supplier_order_id = v_d.supplier_order_id
         AND entry_type = 'CHARGEBACK_DEBIT'
         AND external_id = p_dispute_id::text
         AND status != 'failed'
       ORDER BY occurred_at DESC LIMIT 1;

      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_CREDIT', v_d.chargeback_amount,
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback reversal (won) — ' || v_d.dispute_number,
        v_corr, p_source_event_id, v_debit_entry_id, 'simulation',
        p_dispute_id::text, 'dispute_reversal',
        v_d.currency,   -- FIX
        'confirmed', now()
      );

      UPDATE public.trade_marketplace_disputes SET
        status              = 'won',
        outcome             = 'won',
        chargeback_reversed = true,
        resolved_at         = now()
      WHERE id = p_dispute_id;

      PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

    ELSE
      UPDATE public.trade_marketplace_disputes SET
        status      = 'won',
        outcome     = 'won',
        resolved_at = now()
      WHERE id = p_dispute_id;
    END IF;

  -- ── CANCELLED ──────────────────────────────────────────────────────────
  ELSIF p_outcome = 'cancelled' THEN
    UPDATE public.trade_marketplace_disputes SET status='cancelled', outcome='cancelled', resolved_at=now() WHERE id=p_dispute_id;

  -- ── CLOSED ─────────────────────────────────────────────────────────────
  ELSIF p_outcome = 'closed' THEN
    UPDATE public.trade_marketplace_disputes SET status='closed', closed_at=now() WHERE id=p_dispute_id;

  -- ── ESTADOS INTERMEDIOS ────────────────────────────────────────────────
  ELSE
    UPDATE public.trade_marketplace_disputes SET status=p_outcome WHERE id=p_dispute_id;
    IF p_outcome = 'needs_response' THEN
      UPDATE public.trade_marketplace_disputes SET evidence_due_at=now()+INTERVAL '7 days' WHERE id=p_dispute_id AND evidence_due_at IS NULL;
    END IF;
  END IF;

  -- Audit (NULL como p_actor_id y p_metadata — FK y type constraints)
  PERFORM public.mkt_fin_audit(
    'dispute_outcome_simulated', 'dispute', p_dispute_id, NULL,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object(
      'status',            p_outcome,
      'chargeback_debit',  CASE WHEN p_outcome IN ('lost','accepted') THEN -(v_d.amount) ELSE 0 END,
      'chargeback_fee',    COALESCE(p_chargeback_fee, 0),
      'chargeback_credit', CASE WHEN p_outcome='won' AND v_d.chargeback_posted THEN v_d.chargeback_amount ELSE 0 END
    ),
    'Outcome simulado — ' || v_d.dispute_number, v_corr, NULL
  );

  -- Outbox
  PERFORM public.mkt_fin_outbox_publish(
    'dispute.' || p_outcome,
    jsonb_build_object(
      'dispute_id',        p_dispute_id,
      'dispute_number',    v_d.dispute_number,
      'supplier_order_id', v_d.supplier_order_id,
      'provider_actor_id', v_d.provider_actor_id,
      'outcome',           p_outcome,
      'amount',            v_d.amount,
      'simulation_only',   true
    ),
    v_d.provider_actor_id, NULL  -- provider actor (no auth.uid() que no es marketplace actor)
  );

  RETURN (
    SELECT jsonb_build_object(
      'status',                'done',
      'dispute_id',            id,
      'dispute_number',        dispute_number,
      'dispute_status',        status,
      'outcome',               outcome,
      'chargeback_posted',     chargeback_posted,
      'chargeback_reversed',   chargeback_reversed,
      'chargeback_amount',     chargeback_amount,
      'chargeback_fee_amount', chargeback_fee_amount,
      'simulation_only',       true
    )
    FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
  );
END;
$$;

COMMIT;
;
