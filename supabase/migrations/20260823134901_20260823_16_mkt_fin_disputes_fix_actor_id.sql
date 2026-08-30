-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C FIX: actor_id column + audit jsonb param
-- trade_marketplace_orders usa actor_id (no provider_actor_id).
-- mkt_fin_audit param 9 es jsonb; se pasaba text → fix a NULL.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── FIX 1: mkt_fin_create_dispute ───────────────────────────────────────────
-- 4 ocurrencias: o.provider_actor_id→o.actor_id (×3 v_order.actor_id) + audit NULL

CREATE OR REPLACE FUNCTION public.mkt_fin_create_dispute(
  p_supplier_order_id    uuid,
  p_amount               numeric,
  p_reason               text        DEFAULT NULL,
  p_reason_code          text        DEFAULT NULL,
  p_responsibility       text        DEFAULT 'undetermined',
  p_evidence_due_at      timestamptz DEFAULT NULL,
  p_external_dispute_id  text        DEFAULT NULL,
  p_external_payment_id  text        DEFAULT NULL,
  p_idempotency_key      text        DEFAULT NULL,
  p_source_event_id      text        DEFAULT NULL,
  p_correlation_id       text        DEFAULT NULL,
  p_metadata             jsonb       DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order       record;
  v_exposure    numeric(15,4);
  v_dispute_id  uuid;
  v_dispute_num text;
  v_corr        text;
BEGIN
  -- Idempotencia por idempotency_key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_dispute_id
      FROM public.trade_marketplace_disputes
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_number',    dispute_number,
          'supplier_order_id', supplier_order_id,
          'amount',            amount,
          'dispute_status',    status,
          'responsibility',    responsibility
        )
        FROM public.trade_marketplace_disputes WHERE id = v_dispute_id
      );
    END IF;
  END IF;

  -- Idempotencia por source_event_id
  IF p_source_event_id IS NOT NULL THEN
    SELECT id INTO v_dispute_id
      FROM public.trade_marketplace_disputes
     WHERE source_event_id = p_source_event_id;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_number',    dispute_number,
          'supplier_order_id', supplier_order_id,
          'amount',            amount,
          'dispute_status',    status,
          'responsibility',    responsibility
        )
        FROM public.trade_marketplace_disputes WHERE id = v_dispute_id
      );
    END IF;
  END IF;

  -- Cargar snapshot del supplier order (FIX: actor_id, no provider_actor_id)
  SELECT o.id, o.master_order_id, o.actor_id,
         COALESCE(o.currency, 'EUR') AS currency,
         COALESCE(o.goods_gross_snapshot, 0) + COALESCE(o.shipping_gross_snapshot, 0) AS total_gross
    INTO v_order
    FROM public.trade_marketplace_orders o
   WHERE o.id = p_supplier_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;
  IF v_order.total_gross = 0 THEN
    RAISE EXCEPTION 'ORDER_NO_SNAPSHOT: supplier order sin amounts snapshot';
  END IF;

  -- Validar responsabilidad
  IF p_responsibility NOT IN ('provider','platform','buyer','undetermined','shared') THEN
    RAISE EXCEPTION 'INVALID_RESPONSIBILITY: %', p_responsibility;
  END IF;

  -- Validar importe > 0
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE: %', p_amount;
  END IF;

  -- Calcular exposición disponible y validar
  v_exposure := public._mkt_calc_chargeback_exposure(p_supplier_order_id, NULL);
  IF p_amount > v_exposure THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_EXPOSURE: requested=% exposure=%', p_amount, v_exposure;
  END IF;

  -- Número de dispute
  v_dispute_num := public.next_financial_doc_number('DI');
  v_corr        := COALESCE(p_correlation_id, 'dispute-' || gen_random_uuid()::text);

  -- Insertar dispute (sin entrada ledger — solo al resolver)
  INSERT INTO public.trade_marketplace_disputes (
    dispute_number, master_order_id, supplier_order_id,
    provider_actor_id, buyer_actor_id,
    currency, amount, reason, reason_code,
    responsibility, simulation_only,
    evidence_due_at, external_dispute_id, external_payment_id,
    source_event_id, idempotency_key, correlation_id, metadata, created_by
  ) VALUES (
    v_dispute_num,
    v_order.master_order_id,
    p_supplier_order_id,
    v_order.actor_id,       -- FIX: era v_order.provider_actor_id
    NULL,
    v_order.currency::char(3),
    p_amount,
    p_reason,
    p_reason_code,
    p_responsibility,
    true,
    p_evidence_due_at,
    p_external_dispute_id,
    p_external_payment_id,
    p_source_event_id,
    p_idempotency_key,
    v_corr,
    p_metadata,
    auth.uid()
  )
  RETURNING id INTO v_dispute_id;

  PERFORM public.mkt_fin_audit(
    'dispute_created', 'dispute', v_dispute_id, auth.uid(), NULL,
    jsonb_build_object(
      'dispute_number',    v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',   v_order.master_order_id,
      'amount',            p_amount,
      'responsibility',    p_responsibility,
      'exposure_at_open',  v_exposure
    ),
    'Dispute abierto — Phase 2C (sin impacto ledger)', v_corr, NULL  -- FIX: NULL en vez de p_source_event_id (text≠jsonb)
  );

  PERFORM public.mkt_fin_outbox_publish(
    'dispute.opened',
    jsonb_build_object(
      'dispute_id',        v_dispute_id,
      'dispute_number',    v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',   v_order.master_order_id,
      'provider_actor_id', v_order.actor_id,       -- FIX: era v_order.provider_actor_id
      'amount',            p_amount,
      'responsibility',    p_responsibility,
      'simulation_only',   true
    ),
    auth.uid(), NULL
  );

  RETURN jsonb_build_object(
    'status',            'created',
    'dispute_id',        v_dispute_id,
    'dispute_number',    v_dispute_num,
    'supplier_order_id', p_supplier_order_id,
    'master_order_id',   v_order.master_order_id,
    'provider_actor_id', v_order.actor_id,         -- FIX: era v_order.provider_actor_id
    'amount',            p_amount,
    'responsibility',    p_responsibility,
    'dispute_status',    'opened',
    'exposure_at_open',  v_exposure,
    'simulation_only',   true,
    'correlation_id',    v_corr
  );
END;
$$;

-- ── FIX 2: mkt_fin_simulate_dispute_outcome — audit jsonb param ──────────────

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

  -- Validar transición de estado
  IF NOT public._mkt_validate_dispute_transition(v_d.status, p_outcome) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % → %', v_d.status, p_outcome;
  END IF;

  v_corr := COALESCE(p_correlation_id, 'dispute-outcome-' || gen_random_uuid()::text);

  -- ── LOST: chargeback debitado al proveedor ─────────────────────────────
  IF p_outcome = 'lost' THEN

    v_entry_row := public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT',
      -(v_d.amount),
      v_d.master_order_id,
      v_d.supplier_order_id,
      v_d.provider_actor_id,
      'Chargeback debit — ' || v_d.dispute_number,
      v_corr,
      p_source_event_id,
      NULL,
      'simulation',
      p_dispute_id::text,
      'dispute',
      v_d.currency::char,
      'confirmed',
      now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE',
        -(p_chargeback_fee),
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback fee — ' || v_d.dispute_number,
        v_corr,
        NULL,
        NULL,
        'simulation',
        p_dispute_id::text,
        'dispute_fee',
        v_d.currency::char,
        'confirmed',
        now()
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

  -- ── ACCEPTED: proveedor acepta sin disputar ────────────────────────────
  ELSIF p_outcome = 'accepted' THEN

    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT',
      -(v_d.amount),
      v_d.master_order_id,
      v_d.supplier_order_id,
      v_d.provider_actor_id,
      'Chargeback debit (accepted) — ' || v_d.dispute_number,
      v_corr,
      p_source_event_id,
      NULL,
      'simulation',
      p_dispute_id::text,
      'dispute',
      v_d.currency::char,
      'confirmed',
      now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE',
        -(p_chargeback_fee),
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback fee (accepted) — ' || v_d.dispute_number,
        v_corr,
        NULL,
        NULL,
        'simulation',
        p_dispute_id::text,
        'dispute_fee',
        v_d.currency::char,
        'confirmed',
        now()
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

  -- ── WON: proveedor gana el dispute ────────────────────────────────────
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

      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_CREDIT',
        v_d.chargeback_amount,
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback reversal (won) — ' || v_d.dispute_number,
        v_corr,
        p_source_event_id,
        v_debit_entry_id,
        'simulation',
        p_dispute_id::text,
        'dispute_reversal',
        v_d.currency::char,
        'confirmed',
        now()
      );

      UPDATE public.trade_marketplace_disputes SET
        status              = 'won',
        outcome             = 'won',
        chargeback_reversed = true,
        resolved_at         = now()
      WHERE id = p_dispute_id;

      PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

    ELSE
      -- WON sin chargeback previo: solo estado, sin entrada ledger
      UPDATE public.trade_marketplace_disputes SET
        status      = 'won',
        outcome     = 'won',
        resolved_at = now()
      WHERE id = p_dispute_id;
    END IF;

  -- ── CANCELLED ─────────────────────────────────────────────────────────
  ELSIF p_outcome = 'cancelled' THEN
    UPDATE public.trade_marketplace_disputes SET
      status      = 'cancelled',
      outcome     = 'cancelled',
      resolved_at = now()
    WHERE id = p_dispute_id;

  -- ── CLOSED ────────────────────────────────────────────────────────────
  ELSIF p_outcome = 'closed' THEN
    UPDATE public.trade_marketplace_disputes SET
      status    = 'closed',
      closed_at = now()
    WHERE id = p_dispute_id;

  -- ── ESTADOS INTERMEDIOS ───────────────────────────────────────────────
  ELSE
    UPDATE public.trade_marketplace_disputes SET status = p_outcome
    WHERE id = p_dispute_id;

    IF p_outcome = 'needs_response' THEN
      UPDATE public.trade_marketplace_disputes
         SET evidence_due_at = now() + INTERVAL '7 days'
       WHERE id = p_dispute_id AND evidence_due_at IS NULL;
    END IF;
  END IF;

  -- Audit (FIX: último param NULL en vez de p_source_event_id — text≠jsonb)
  PERFORM public.mkt_fin_audit(
    'dispute_outcome_simulated', 'dispute', p_dispute_id, NULL,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object(
      'status',            p_outcome,
      'chargeback_debit',  CASE WHEN p_outcome IN ('lost','accepted') THEN -(v_d.amount) ELSE 0 END,
      'chargeback_fee',    COALESCE(p_chargeback_fee, 0),
      'chargeback_credit', CASE WHEN p_outcome = 'won' AND v_d.chargeback_posted THEN v_d.chargeback_amount ELSE 0 END
    ),
    'Outcome simulado — ' || v_d.dispute_number, v_corr, NULL  -- FIX: NULL en vez de p_source_event_id
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
    NULL, NULL
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
