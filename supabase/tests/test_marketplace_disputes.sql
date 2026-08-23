-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C: Test suite Disputes + Chargebacks — D-01..D-40
-- Non-pgTAP: _test_results temp table + BEGIN/ROLLBACK
-- Invariante: DISPUTE ≠ REFUND; aislamiento por proveedor
--
-- Datos de test (MKP-0003 = bd7a6bbb, multiproveedor):
--   SO_A (Obras)      7afbb6e6-c7af-408c-a503-f13b443729b7  goods=1.75 ship=8.50 = 10.25
--   SO_B (Suminstr.)  15f6f9e6-f658-431b-aa3f-f8002bdce8ac  goods=1.70 ship=0.00 =  1.70
--   SO_C (TrabFlow)   089b850a-ec91-40e8-b0da-97e1d0219785  goods=3.36 ship=0.00 =  3.36
--   SO_D (Obras MK2)  b829eaf4-b469-4d6a-a39d-2e3225935e72  goods=1.75 ship=8.50 = 10.25
--   SO_E (Obras MK4)  de813d33-f1bd-4b09-b13f-9c2601cff3cc  goods=0.70 ship=8.50 =  9.20
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL "request.jwt.claims" = '{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}';

CREATE TEMP TABLE IF NOT EXISTS _test_results (
  test_id     text      NOT NULL,
  description text      NOT NULL,
  passed      bool,
  detail      text
);

DO $$
DECLARE
  -- ── Supplier orders ───────────────────────────────────────────────────────
  SO_A  CONSTANT uuid := '7afbb6e6-c7af-408c-a503-f13b443729b7';  -- Obras  MKP-0003 10.25
  SO_B  CONSTANT uuid := '15f6f9e6-f658-431b-aa3f-f8002bdce8ac';  -- Sumin. MKP-0003  1.70
  SO_C  CONSTANT uuid := '089b850a-ec91-40e8-b0da-97e1d0219785';  -- TrabFl MKP-0003  3.36
  SO_D  CONSTANT uuid := 'b829eaf4-b469-4d6a-a39d-2e3225935e72';  -- Obras  MKP-0002 10.25
  SO_E  CONSTANT uuid := 'de813d33-f1bd-4b09-b13f-9c2601cff3cc';  -- Obras  MKP-0004  9.20

  -- ── Actors ───────────────────────────────────────────────────────────────
  ACTOR_A  CONSTANT uuid := '85e73234-c74e-44e7-865a-1aca8312f9a5';  -- Obras
  ACTOR_B  CONSTANT uuid := 'aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9';  -- Suministros
  ACTOR_C  CONSTANT uuid := '283d106e-30e3-4e1d-8e3d-069e4a6e4f61';  -- TrabFlow

  -- ── Dispute handles ──────────────────────────────────────────────────────
  v_dispute_A    uuid;   -- D-01: SO_A 5.00, will be LOST
  v_dispute_B1   uuid;   -- D-15: SO_B 1.70 full exposure
  v_dispute_C1   uuid;   -- D-17: SO_C 2.00, WON direct (no chargeback)
  v_dispute_C2   uuid;   -- D-22: SO_C 0.50, idempotency test
  v_dispute_D    uuid;   -- D-18: SO_D 3.00, LOST then WON (reversal)
  v_dispute_E    uuid;   -- D-21: SO_E 4.00, ACCEPTED
  v_dispute_D29  uuid;   -- D-29: SO_D 2.00, preview tests
  v_dispute_D31  uuid;   -- D-31: SO_D 1.50, LOST for preview WON
  v_dispute_tmp  uuid;

  -- ── Working vars ─────────────────────────────────────────────────────────
  v_res    jsonb;
  v_ok     bool;
  v_err    text;
  v_count  int;
  v_val    numeric;
  v_num    text;
  v_bal_before numeric;
  v_bal_after  numeric;
BEGIN

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 1: Apertura, aislamiento multiproveedor, estado inicial (D-01..D-12)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-01: Crear dispute SO_A amount=5.00 ─────────────────────────────────
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_A,
    p_amount            := 5.00,
    p_reason            := 'D-01 multiproveedor test',
    p_responsibility    := 'undetermined'
  );
  v_dispute_A := (v_res->>'dispute_id')::uuid;
  INSERT INTO _test_results VALUES (
    'D-01', 'Create dispute SO_A amount=5.00 → status=created, dispute_status=opened',
    (v_res->>'status') = 'created' AND (v_res->>'dispute_status') = 'opened'
      AND v_dispute_A IS NOT NULL,
    v_res::text
  );

  -- ── D-02: Dispute abierto — sin entrada ledger, chargeback_posted=false ──
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_A AND entry_type IN ('CHARGEBACK_DEBIT','CHARGEBACK_CREDIT')
     AND external_id = v_dispute_A::text;
  INSERT INTO _test_results VALUES (
    'D-02', 'Dispute opened → sin CHARGEBACK_DEBIT/CREDIT en ledger, chargeback_posted=false',
    v_count = 0 AND (
      SELECT NOT chargeback_posted FROM public.trade_marketplace_disputes WHERE id = v_dispute_A
    ),
    'ledger_cb_entries=' || v_count
  );

  -- ── D-03: Exposure SO_A = 10.25 - 5.00 (open dispute) = 5.25 ────────────
  v_res := public.mkt_fin_get_dispute_exposure(SO_A);
  INSERT INTO _test_results VALUES (
    'D-03', 'Exposure SO_A = 5.25 (original 10.25 − open dispute 5.00)',
    (v_res->>'disputable_exposure')::numeric = 5.25
      AND (v_res->>'open_disputes_amount')::numeric = 5.00,
    'exposure=' || (v_res->>'disputable_exposure') || ' open=' || (v_res->>'open_disputes_amount')
  );

  -- ── D-04: AISLAMIENTO — Exposure SO_B = 1.70, no afectada por dispute A ──
  v_res := public.mkt_fin_get_dispute_exposure(SO_B);
  INSERT INTO _test_results VALUES (
    'D-04', 'AISLAMIENTO B: Exposure SO_B = 1.70, no afectada por dispute SO_A',
    (v_res->>'disputable_exposure')::numeric = 1.70,
    'exposure_B=' || (v_res->>'disputable_exposure')
  );

  -- ── D-05: AISLAMIENTO — Exposure SO_C = 3.36, no afectada por dispute A ──
  v_res := public.mkt_fin_get_dispute_exposure(SO_C);
  INSERT INTO _test_results VALUES (
    'D-05', 'AISLAMIENTO C: Exposure SO_C = 3.36, no afectada por dispute SO_A',
    (v_res->>'disputable_exposure')::numeric = 3.36,
    'exposure_C=' || (v_res->>'disputable_exposure')
  );

  -- ── D-06: Transición opened → needs_response (máquina de estados) ────────
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_A, 'needs_response');
  INSERT INTO _test_results VALUES (
    'D-06', 'Transición opened→needs_response OK, evidence_due_at set',
    (v_res->>'dispute_status') = 'needs_response' AND (
      SELECT evidence_due_at IS NOT NULL FROM public.trade_marketplace_disputes WHERE id = v_dispute_A
    ),
    'status=' || (v_res->>'dispute_status')
  );

  -- ── D-07: Add evidence → auto-avanza a evidence_submitted ────────────────
  v_res := public.mkt_fin_add_dispute_evidence(
    p_dispute_id         := v_dispute_A,
    p_evidence_type      := 'invoice',
    p_description        := 'Factura original D-07',
    p_document_reference := 'REF-D07'
  );
  INSERT INTO _test_results VALUES (
    'D-07', 'Add evidence en needs_response → auto-avanza a evidence_submitted',
    (v_res->>'dispute_status') = 'evidence_submitted',
    v_res::text
  );

  -- ── D-08: LOST → CHARGEBACK_DEBIT -5.00 en ledger SO_A ──────────────────
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_A, 'lost');
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_A AND entry_type = 'CHARGEBACK_DEBIT'
     AND amount = -5.0000 AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-08', 'LOST → CHARGEBACK_DEBIT amount=-5.00 en ledger SO_A',
    v_count >= 1 AND (v_res->>'outcome') = 'lost',
    'debit_count=' || v_count || ' outcome=' || COALESCE(v_res->>'outcome','NULL')
  );

  -- ── D-09: chargeback_posted=true, outcome='lost', chargeback_amount=5.00 ─
  INSERT INTO _test_results VALUES (
    'D-09', 'chargeback_posted=true, outcome=lost, chargeback_amount=5.00 tras LOST',
    (SELECT chargeback_posted AND outcome = 'lost' AND chargeback_amount = 5.00
       FROM public.trade_marketplace_disputes WHERE id = v_dispute_A),
    (v_res->>'chargeback_posted') || '/' || (v_res->>'outcome') || '/' || (v_res->>'chargeback_amount')
  );

  -- ── D-10: AISLAMIENTO LEDGER — ACTOR_B sin CHARGEBACK_DEBIT ──────────────
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = ACTOR_B AND entry_type = 'CHARGEBACK_DEBIT' AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-10', 'AISLAMIENTO LEDGER: ACTOR_B (Suministros) sin CHARGEBACK_DEBIT',
    v_count = 0,
    'debit_B=' || v_count
  );

  -- ── D-11: AISLAMIENTO LEDGER — ACTOR_C sin CHARGEBACK_DEBIT ──────────────
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = ACTOR_C AND entry_type = 'CHARGEBACK_DEBIT' AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-11', 'AISLAMIENTO LEDGER: ACTOR_C (TrabFlow) sin CHARGEBACK_DEBIT',
    v_count = 0,
    'debit_C=' || v_count
  );

  -- ── D-12: Balance ACTOR_A refleja CHARGEBACK_DEBIT -5.00 ─────────────────
  SELECT COALESCE(-SUM(amount), 0) INTO v_val
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = ACTOR_A AND entry_type = 'CHARGEBACK_DEBIT' AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-12', 'Ledger ACTOR_A contiene CHARGEBACK_DEBIT neto = 5.00',
    v_val = 5.00,
    'cb_debit_net=' || v_val
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 2: Validaciones de importe y exposición (D-13..D-16)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-13: Amount > exposure → AMOUNT_EXCEEDS_EXPOSURE ────────────────────
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_create_dispute(SO_B, 100.00);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%AMOUNT_EXCEEDS_EXPOSURE%';
  END;
  INSERT INTO _test_results VALUES (
    'D-13', 'Amount 100.00 > exposure 1.70 → error AMOUNT_EXCEEDS_EXPOSURE',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ── D-14: Amount = 0 → AMOUNT_MUST_BE_POSITIVE ───────────────────────────
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_create_dispute(SO_B, 0);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%AMOUNT_MUST_BE_POSITIVE%';
  END;
  INSERT INTO _test_results VALUES (
    'D-14', 'Amount=0 → error AMOUNT_MUST_BE_POSITIVE',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ── D-15: Dispute importe exacto = exposición SO_B (1.70) ────────────────
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_B,
    p_amount            := 1.70,
    p_reason            := 'D-15 full exposure SO_B'
  );
  v_dispute_B1 := (v_res->>'dispute_id')::uuid;
  INSERT INTO _test_results VALUES (
    'D-15', 'Create dispute SO_B amount=1.70 (exposición completa) → created',
    (v_res->>'status') = 'created' AND (v_res->>'exposure_at_open')::numeric = 1.70,
    'exposure_at_open=' || (v_res->>'exposure_at_open')
  );

  -- ── D-16: Segundo dispute SO_B falla (exposición=0 por D-15 abierto) ─────
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_create_dispute(SO_B, 0.01);
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%AMOUNT_EXCEEDS_EXPOSURE%';
  END;
  INSERT INTO _test_results VALUES (
    'D-16', 'Segundo dispute SO_B 0.01 falla: exposición=0.00 con D-15 abierto',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 3: WON — con y sin chargeback previo (D-17..D-21)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-17: WON sin chargeback previo — sin CHARGEBACK_CREDIT en ledger ─────
  v_res := public.mkt_fin_create_dispute(SO_C, 2.00, 'D-17 WON directo');
  v_dispute_C1 := (v_res->>'dispute_id')::uuid;
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_C1, 'won');
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_C AND entry_type = 'CHARGEBACK_CREDIT'
     AND external_id = v_dispute_C1::text;
  INSERT INTO _test_results VALUES (
    'D-17', 'WON sin prior chargeback → sin CHARGEBACK_CREDIT en ledger, chargeback_reversed=false',
    v_count = 0
      AND (v_res->>'dispute_status') = 'won'
      AND NOT (v_res->>'chargeback_reversed')::bool,
    'credit_count=' || v_count || ' status=' || (v_res->>'dispute_status')
  );

  -- ── D-18: WON post-LOST → CHARGEBACK_CREDIT +3.00 en ledger SO_D ─────────
  v_res := public.mkt_fin_create_dispute(SO_D, 3.00, 'D-18 LOST then WON');
  v_dispute_D := (v_res->>'dispute_id')::uuid;
  PERFORM public.mkt_fin_simulate_dispute_outcome(v_dispute_D, 'lost');
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_D, 'won');
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_D AND entry_type = 'CHARGEBACK_CREDIT'
     AND amount = 3.0000 AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-18', 'WON post-LOST → CHARGEBACK_CREDIT +3.00 en ledger SO_D',
    v_count >= 1 AND (v_res->>'outcome') = 'won',
    'credit_count=' || v_count || ' outcome=' || COALESCE(v_res->>'outcome','NULL')
  );

  -- ── D-19: chargeback_reversed=true, outcome=won tras WON post-LOST ────────
  INSERT INTO _test_results VALUES (
    'D-19', 'chargeback_reversed=true, outcome=won tras WON post-LOST',
    (SELECT chargeback_reversed AND outcome = 'won'
       FROM public.trade_marketplace_disputes WHERE id = v_dispute_D),
    COALESCE((v_res->>'chargeback_reversed'), 'NULL') || '/' || COALESCE((v_res->>'outcome'), 'NULL')
  );

  -- ── D-20: Net chargeback SO_D = 0 tras LOST+WON (DEBIT-3 + CREDIT+3) ─────
  SELECT COALESCE(-SUM(amount), 0) INTO v_val
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_D
     AND entry_type IN ('CHARGEBACK_DEBIT', 'CHARGEBACK_CREDIT')
     AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-20', 'Net chargeback SO_D = 0.00 tras LOST+WON (DEBIT -3 + CREDIT +3)',
    v_val = 0.00,
    'cb_net_SO_D=' || v_val
  );

  -- ── D-21: ACCEPTED = CHARGEBACK_DEBIT económicamente ─────────────────────
  v_res := public.mkt_fin_create_dispute(SO_E, 4.00, 'D-21 accepted test');
  v_dispute_E := (v_res->>'dispute_id')::uuid;
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_E, 'accepted');
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = SO_E AND entry_type = 'CHARGEBACK_DEBIT'
     AND amount = -4.0000 AND status != 'failed';
  INSERT INTO _test_results VALUES (
    'D-21', 'ACCEPTED → CHARGEBACK_DEBIT -4.00 en ledger SO_E (igual que LOST)',
    v_count >= 1 AND (v_res->>'outcome') = 'accepted',
    'debit_count=' || v_count || ' outcome=' || COALESCE(v_res->>'outcome','NULL')
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 4: Idempotencia (D-22..D-24)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-22: Idempotencia por idempotency_key en create ─────────────────────
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_C,
    p_amount            := 0.50,
    p_reason            := 'D-22 idem primera llamada',
    p_idempotency_key   := 'idem-D22-dispute'
  );
  v_dispute_C2 := (v_res->>'dispute_id')::uuid;
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_C,
    p_amount            := 0.50,
    p_reason            := 'D-22 idem replay',
    p_idempotency_key   := 'idem-D22-dispute'
  );
  INSERT INTO _test_results VALUES (
    'D-22', 'Idempotencia create por idempotency_key → status=replayed, mismo dispute_id',
    (v_res->>'status') = 'replayed' AND (v_res->>'dispute_id')::uuid = v_dispute_C2,
    'status=' || (v_res->>'status') || ' same_id=' || ((v_res->>'dispute_id')::uuid = v_dispute_C2)::text
  );

  -- ── D-23: Idempotencia por source_event_id en create ─────────────────────
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_C,
    p_amount            := 0.20,
    p_reason            := 'D-23 src evt primera',
    p_source_event_id   := 'evt-D23-open'
  );
  v_dispute_tmp := (v_res->>'dispute_id')::uuid;
  v_res := public.mkt_fin_create_dispute(
    p_supplier_order_id := SO_C,
    p_amount            := 0.20,
    p_reason            := 'D-23 src evt replay',
    p_source_event_id   := 'evt-D23-open'
  );
  INSERT INTO _test_results VALUES (
    'D-23', 'Idempotencia create por source_event_id → status=replayed, mismo dispute_id',
    (v_res->>'status') = 'replayed' AND (v_res->>'dispute_id')::uuid = v_dispute_tmp,
    'status=' || (v_res->>'status')
  );

  -- ── D-24: Idempotencia simulate_outcome por source_event_id ──────────────
  v_res := public.mkt_fin_create_dispute(SO_C, 0.10, 'D-24 outcome idem');
  v_dispute_tmp := (v_res->>'dispute_id')::uuid;
  -- Primera llamada (LOST)
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_tmp, 'lost', 0, 'evt-D24-lost');
  -- Segunda llamada con mismo source_event_id → debe ser replayed
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_tmp, 'lost', 0, 'evt-D24-lost');
  INSERT INTO _test_results VALUES (
    'D-24', 'Idempotencia simulate_outcome por source_event_id → status=replayed',
    (v_res->>'status') = 'replayed',
    'status=' || COALESCE(v_res->>'status', 'NULL')
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 5: No regresión de estado (D-25..D-27)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-25: CANCELLED → won bloqueado (estado terminal) ────────────────────
  -- SO_D exposición: 10.25 - net_cb(0) - open(0) = 10.25 tras LOST+WON en D-18
  v_res := public.mkt_fin_create_dispute(SO_D, 1.00, 'D-25 cancel block');
  v_dispute_tmp := (v_res->>'dispute_id')::uuid;
  PERFORM public.mkt_fin_simulate_dispute_outcome(v_dispute_tmp, 'cancelled');
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_tmp, 'won');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%INVALID_TRANSITION%';
  END;
  INSERT INTO _test_results VALUES (
    'D-25', 'CANCELLED→won bloqueado: no regresión desde estado terminal',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ── D-26: LOST → under_review bloqueado ──────────────────────────────────
  -- dispute_A está en 'lost' (terminal)
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_A, 'under_review');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%INVALID_TRANSITION%';
  END;
  INSERT INTO _test_results VALUES (
    'D-26', 'LOST→under_review bloqueado: no regresión desde estado terminal',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ── D-27: Add evidence en estado terminal falla ───────────────────────────
  -- dispute_A está en 'lost'
  v_ok := false; v_err := '';
  BEGIN
    v_res := public.mkt_fin_add_dispute_evidence(v_dispute_A, 'invoice', 'evidencia tardía');
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
    v_ok  := v_err LIKE '%DISPUTE_TERMINAL%';
  END;
  INSERT INTO _test_results VALUES (
    'D-27', 'Add evidence en dispute LOST → error DISPUTE_TERMINAL',
    v_ok, 'err=' || LEFT(v_err, 80)
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 6: RLS y políticas (D-28)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-28: RLS policy disputes_admin_all existe ────────────────────────────
  SELECT COUNT(*) INTO v_count
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'trade_marketplace_disputes'
     AND policyname = 'disputes_admin_all';
  INSERT INTO _test_results VALUES (
    'D-28', 'RLS policy disputes_admin_all existe en trade_marketplace_disputes',
    v_count = 1,
    'policy_count=' || v_count
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 7: Preview de outcomes (D-29..D-31)
  -- ════════════════════════════════════════════════════════════════════════

  -- Crear dispute para preview tests (SO_D, exposure libre tras D-18+D-25)
  -- SO_D estado: DEBIT -3 + CREDIT +3 = net 0; D-25 dispute cancelado → exposure = 10.25
  v_res := public.mkt_fin_create_dispute(SO_D, 2.00, 'D-29/D-30 preview test');
  v_dispute_D29 := (v_res->>'dispute_id')::uuid;

  -- ── D-29: Preview LOST sin fee → net_economic_impact = -2.00 ─────────────
  v_res := public.mkt_fin_preview_dispute_outcome(v_dispute_D29, 'lost', 0);
  INSERT INTO _test_results VALUES (
    'D-29', 'Preview LOST sin fee → net_economic_impact = -2.00',
    (v_res->>'net_economic_impact')::numeric = -2.00
      AND (v_res->>'chargeback_debit')::numeric = 2.00,
    'net=' || (v_res->>'net_economic_impact') || ' debit=' || (v_res->>'chargeback_debit')
  );

  -- ── D-30: Preview LOST con fee=0.50 → net = -(2.00 + 0.50) = -2.50 ──────
  v_res := public.mkt_fin_preview_dispute_outcome(v_dispute_D29, 'lost', 0.50);
  INSERT INTO _test_results VALUES (
    'D-30', 'Preview LOST con fee=0.50 → net_economic_impact = -2.50',
    (v_res->>'net_economic_impact')::numeric = -2.50
      AND (v_res->>'chargeback_fee')::numeric = 0.50,
    'net=' || (v_res->>'net_economic_impact') || ' fee=' || (v_res->>'chargeback_fee')
  );

  -- ── D-31: Preview WON post-chargeback → net = +chargeback_amount ─────────
  -- Crear un dispute en SO_D, LOST, luego preview WON (sin ejecutarlo)
  v_res := public.mkt_fin_create_dispute(SO_D, 1.50, 'D-31 preview WON test');
  v_dispute_D31 := (v_res->>'dispute_id')::uuid;
  PERFORM public.mkt_fin_simulate_dispute_outcome(v_dispute_D31, 'lost');
  v_res := public.mkt_fin_preview_dispute_outcome(v_dispute_D31, 'won', 0);
  INSERT INTO _test_results VALUES (
    'D-31', 'Preview WON post-chargeback → net_economic_impact = +1.50 (reversal)',
    (v_res->>'net_economic_impact')::numeric = 1.50
      AND (v_res->>'chargeback_credit')::numeric = 1.50
      AND (v_res->>'chargeback_was_posted')::bool = true,
    'net=' || (v_res->>'net_economic_impact') || ' credit=' || (v_res->>'chargeback_credit')
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 8: CLOSED, get_dispute, list (D-32..D-35)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-32: CLOSED después de WON — closed_at set ──────────────────────────
  -- dispute_C1 está en 'won', puede avanzar a 'closed'
  v_res := public.mkt_fin_simulate_dispute_outcome(v_dispute_C1, 'closed');
  INSERT INTO _test_results VALUES (
    'D-32', 'Transición won→closed → status=closed, closed_at IS NOT NULL',
    (v_res->>'dispute_status') = 'closed' AND (
      SELECT closed_at IS NOT NULL FROM public.trade_marketplace_disputes WHERE id = v_dispute_C1
    ),
    'status=' || (v_res->>'dispute_status')
  );

  -- ── D-33: mkt_fin_get_dispute retorna campos correctos ────────────────────
  v_res := public.mkt_fin_get_dispute(v_dispute_A);
  INSERT INTO _test_results VALUES (
    'D-33', 'mkt_fin_get_dispute → dispute_id, dispute_number, status=lost, evidence array',
    (v_res->>'dispute_id')::uuid = v_dispute_A
      AND v_res ? 'dispute_number'
      AND (v_res->>'status') = 'lost'
      AND v_res ? 'evidence',
    'status=' || (v_res->>'status') || ' has_evidence=' || (v_res ? 'evidence')::text
  );

  -- ── D-34: mkt_fin_list_supplier_disputes retorna lista no vacía ───────────
  v_res := public.mkt_fin_list_supplier_disputes(ACTOR_A);
  INSERT INTO _test_results VALUES (
    'D-34', 'mkt_fin_list_supplier_disputes(ACTOR_A) → array con al menos 1 dispute',
    jsonb_array_length(COALESCE(v_res, '[]'::jsonb)) >= 1,
    'count=' || jsonb_array_length(COALESCE(v_res, '[]'::jsonb))
  );

  -- ── D-35: mkt_fin_admin_disputes_overview retorna KPIs ────────────────────
  v_res := public.mkt_fin_admin_disputes_overview();
  INSERT INTO _test_results VALUES (
    'D-35', 'mkt_fin_admin_disputes_overview → total_disputes >= 1, by_status present',
    (v_res->>'total_disputes')::int >= 1
      AND v_res ? 'by_status'
      AND v_res ? 'chargebacks_net_impact',
    'total=' || (v_res->>'total_disputes') || ' open=' || (v_res->>'open_disputes')
  );

  -- ════════════════════════════════════════════════════════════════════════
  -- BLOQUE 9: Formato, audit, outbox, invariantes (D-36..D-40)
  -- ════════════════════════════════════════════════════════════════════════

  -- ── D-36: dispute_number formato DI-YYYY-NNNN ────────────────────────────
  SELECT dispute_number INTO v_num
    FROM public.trade_marketplace_disputes WHERE id = v_dispute_A;
  INSERT INTO _test_results VALUES (
    'D-36', 'dispute_number formato DI-YYYY-NNNN (starts DI-2026-)',
    v_num LIKE 'DI-2026-%' AND length(v_num) >= 10,
    'dispute_number=' || COALESCE(v_num, 'NULL')
  );

  -- ── D-37: Audit log creado al abrir dispute ───────────────────────────────
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_audit_log
   WHERE event_type = 'dispute_created'
     AND (event_data->>'entity_id')::uuid = v_dispute_A;
  INSERT INTO _test_results VALUES (
    'D-37', 'Audit log contiene entry dispute_created para dispute_A',
    v_count >= 1,
    'audit_entries=' || v_count
  );

  -- ── D-38: Outbox published con event dispute.opened ───────────────────────
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_outbox
   WHERE event_type = 'dispute.opened';
  INSERT INTO _test_results VALUES (
    'D-38', 'Outbox contiene al menos 1 entry event_type=dispute.opened',
    v_count >= 1,
    'outbox_open_events=' || v_count
  );

  -- ── D-39: simulation_only=true en todos los disputes (STRIPE_GATE) ────────
  SELECT COUNT(*) INTO v_count
    FROM public.trade_marketplace_disputes
   WHERE simulation_only = false;
  INSERT INTO _test_results VALUES (
    'D-39', 'simulation_only=true en todos los disputes (STRIPE_GATE cerrado)',
    v_count = 0,
    'disputes_not_simonly=' || v_count
  );

  -- ── D-40: COMMISSION_SIM_ACCRUAL excluida del balance (INV-B02) ───────────
  -- Verificar que el balance reconstruido = suma de entry_types incluidos
  -- (no incluye COMMISSION_SIM_ACCRUAL)
  DECLARE
    v_included  numeric;
    v_all_types numeric;
  BEGIN
    SELECT COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL',
        'CHARGEBACK_DEBIT','CHARGEBACK_CREDIT','CHARGEBACK_FEE'
      ) AND status != 'failed'
    ), 0)
    INTO v_included
    FROM public.trade_marketplace_ledger_entries WHERE actor_id = ACTOR_A;

    v_res := public.mkt_fin_rebuild_provider_balance(ACTOR_A);
    v_val := (v_res->>'pending_amount')::numeric;

    INSERT INTO _test_results VALUES (
      'D-40', 'Balance ACTOR_A = suma entry_types incluidos (COMMISSION_SIM excluida, INV-B02)',
      ABS(v_val - v_included) < 0.0001,
      'balance=' || v_val || ' expected=' || v_included || ' diff=' || ABS(v_val - v_included)
    );
  END;

END;
$$;

-- ── Resultados finales ────────────────────────────────────────────────────────

SELECT
  test_id,
  description,
  CASE WHEN passed THEN 'PASS' WHEN passed IS NULL THEN 'NULL' ELSE 'FAIL' END AS result,
  CASE WHEN NOT COALESCE(passed, false) THEN detail ELSE NULL END AS failure_detail
FROM _test_results
ORDER BY test_id;

SELECT
  COUNT(*) FILTER (WHERE passed = true)                        AS passed,
  COUNT(*) FILTER (WHERE passed = false OR passed IS NULL)     AS failed,
  COUNT(*)                                                     AS total,
  CASE WHEN COUNT(*) FILTER (WHERE NOT COALESCE(passed,false)) = 0
       THEN '✓ ALL PASS' ELSE '✗ FAILURES DETECTED' END       AS summary
FROM _test_results;

ROLLBACK;
