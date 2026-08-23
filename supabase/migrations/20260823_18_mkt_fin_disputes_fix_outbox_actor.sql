-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C FIX 3/5: mkt_fin_outbox_publish 3rd param auth.uid() → v_order.actor_id
-- trade_marketplace_outbox.actor_id FK → trade_marketplace_actors → violación
-- Versión FINAL de mkt_fin_create_dispute (todos los fixes aplicados).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

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

  IF p_responsibility NOT IN ('provider','platform','buyer','undetermined','shared') THEN
    RAISE EXCEPTION 'INVALID_RESPONSIBILITY: %', p_responsibility;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE: %', p_amount;
  END IF;

  v_exposure := public._mkt_calc_chargeback_exposure(p_supplier_order_id, NULL);
  IF p_amount > v_exposure THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_EXPOSURE: requested=% exposure=%', p_amount, v_exposure;
  END IF;

  v_dispute_num := public.next_financial_doc_number('DI');
  v_corr        := COALESCE(p_correlation_id, 'dispute-' || gen_random_uuid()::text);

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
    v_order.actor_id,
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
    'dispute_created', 'dispute', v_dispute_id, NULL, NULL,
    jsonb_build_object(
      'dispute_number',    v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',   v_order.master_order_id,
      'amount',            p_amount,
      'responsibility',    p_responsibility,
      'exposure_at_open',  v_exposure
    ),
    'Dispute abierto — Phase 2C (sin impacto ledger)', v_corr, NULL
  );

  -- FIX: 3rd param v_order.actor_id (was auth.uid() → FK violation)
  PERFORM public.mkt_fin_outbox_publish(
    'dispute.opened',
    jsonb_build_object(
      'dispute_id',        v_dispute_id,
      'dispute_number',    v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',   v_order.master_order_id,
      'provider_actor_id', v_order.actor_id,
      'amount',            p_amount,
      'responsibility',    p_responsibility,
      'simulation_only',   true
    ),
    v_order.actor_id, NULL
  );

  RETURN jsonb_build_object(
    'status',            'created',
    'dispute_id',        v_dispute_id,
    'dispute_number',    v_dispute_num,
    'supplier_order_id', p_supplier_order_id,
    'master_order_id',   v_order.master_order_id,
    'provider_actor_id', v_order.actor_id,
    'amount',            p_amount,
    'responsibility',    p_responsibility,
    'dispute_status',    'opened',
    'exposure_at_open',  v_exposure,
    'simulation_only',   true,
    'correlation_id',    v_corr
  );
END;
$$;

COMMIT;
