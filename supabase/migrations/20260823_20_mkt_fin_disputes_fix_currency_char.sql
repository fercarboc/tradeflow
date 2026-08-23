-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C FIX 5/5: currency::char trunca 'EUR' → 'E' en mkt_fin_ledger_append
-- PostgreSQL: ::char = ::character(1) en contexto SQL → trunca a 1 carácter.
-- mkt_fin_rebuild_provider_balance filtra WHERE currency::text = 'EUR' → entradas
-- con currency='E' son invisibles → balance incorrecto (test D-40).
-- Versión FINAL de mkt_fin_simulate_dispute_outcome (todos los fixes aplicados).
-- ═══════════════════════════════════════════════════════════════════════════

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

  IF p_outcome = 'lost' THEN

    -- FIX: v_d.currency (was v_d.currency::char → truncaba 'EUR' a 'E')
    v_entry_row := public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -(v_d.amount),
      v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
      'Chargeback debit — ' || v_d.dispute_number,
      v_corr, p_source_event_id, NULL, 'simulation', p_dispute_id::text, 'dispute',
      v_d.currency, 'confirmed', now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      -- FIX: v_d.currency (was v_d.currency::char)
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE', -(p_chargeback_fee),
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback fee — ' || v_d.dispute_number,
        v_corr, NULL, NULL, 'simulation', p_dispute_id::text, 'dispute_fee',
        v_d.currency, 'confirmed', now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status               = 'lost',
      outcome              = 'lost',
      chargeback_posted    = true,
      chargeback_amount    = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at          = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  ELSIF p_outcome = 'accepted' THEN

    -- FIX: v_d.currency (was v_d.currency::char)
    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -(v_d.amount),
      v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
      'Chargeback debit (accepted) — ' || v_d.dispute_number,
      v_corr, p_source_event_id, NULL, 'simulation', p_dispute_id::text, 'dispute',
      v_d.currency, 'confirmed', now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      -- FIX: v_d.currency (was v_d.currency::char)
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE', -(p_chargeback_fee),
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback fee (accepted) — ' || v_d.dispute_number,
        v_corr, NULL, NULL, 'simulation', p_dispute_id::text, 'dispute_fee',
        v_d.currency, 'confirmed', now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status               = 'accepted',
      outcome              = 'accepted',
      chargeback_posted    = true,
      chargeback_amount    = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at          = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  ELSIF p_outcome = 'won' THEN

    IF v_d.chargeback_posted THEN
      SELECT id INTO v_debit_entry_id
        FROM public.trade_marketplace_ledger_entries
       WHERE supplier_order_id = v_d.supplier_order_id
         AND entry_type = 'CHARGEBACK_DEBIT'
         AND external_id = p_dispute_id::text
         AND status != 'failed'
       ORDER BY occurred_at DESC
       LIMIT 1;

      -- FIX: v_d.currency (was v_d.currency::char)
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_CREDIT', v_d.chargeback_amount,
        v_d.master_order_id, v_d.supplier_order_id, v_d.provider_actor_id,
        'Chargeback reversal (won) — ' || v_d.dispute_number,
        v_corr, p_source_event_id, v_debit_entry_id, 'simulation',
        p_dispute_id::text, 'dispute_reversal',
        v_d.currency, 'confirmed', now()
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

  ELSIF p_outcome = 'cancelled' THEN
    UPDATE public.trade_marketplace_disputes SET
      status      = 'cancelled',
      outcome     = 'cancelled',
      resolved_at = now()
    WHERE id = p_dispute_id;

  ELSIF p_outcome = 'closed' THEN
    UPDATE public.trade_marketplace_disputes SET
      status    = 'closed',
      closed_at = now()
    WHERE id = p_dispute_id;

  ELSE
    UPDATE public.trade_marketplace_disputes SET status = p_outcome
    WHERE id = p_dispute_id;

    IF p_outcome = 'needs_response' THEN
      UPDATE public.trade_marketplace_disputes
         SET evidence_due_at = now() + INTERVAL '7 days'
       WHERE id = p_dispute_id AND evidence_due_at IS NULL;
    END IF;
  END IF;

  PERFORM public.mkt_fin_audit(
    'dispute_outcome_simulated', 'dispute', p_dispute_id, NULL,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object(
      'status',            p_outcome,
      'chargeback_debit',  CASE WHEN p_outcome IN ('lost','accepted') THEN -(v_d.amount) ELSE 0 END,
      'chargeback_fee',    COALESCE(p_chargeback_fee, 0),
      'chargeback_credit', CASE WHEN p_outcome = 'won' AND v_d.chargeback_posted THEN v_d.chargeback_amount ELSE 0 END
    ),
    'Outcome simulado — ' || v_d.dispute_number, v_corr, NULL
  );

  -- FIX: v_d.provider_actor_id (was NULL — pasar actor marketplace válido)
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
    v_d.provider_actor_id, NULL
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
