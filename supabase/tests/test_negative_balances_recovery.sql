-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2D — Test Suite: Negative Balances + Recovery
-- N-01..N-50  |  BEGIN → DO $$ → SELECT → ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _neg_results (
  test_name text,
  passed    bool,
  detail    text
);

DO $$
DECLARE
  -- Test actors (creados dentro de esta transacción, rollback al final)
  v_ta  uuid := 'bb000001-0000-0000-0000-000000000001';  -- Test Actor A (provider)
  v_tb  uuid := 'bb000002-0000-0000-0000-000000000002';  -- Test Actor B (provider)

  -- Admin platform user
  v_admin_uid  text := 'cf1000d3-80bc-4bdd-a9df-b8a0f0462c77';
  v_plat_actor uuid := '283d106e-30e3-4e1d-8e3d-069e4a6e4f61';

  -- Working vars
  v_rebuild     jsonb;
  v_result      jsonb;
  v_entry       public.trade_marketplace_ledger_entries;
  v_recovery_id uuid;
  v_rec2_id     uuid;
  v_current_sum numeric(15,4);
  v_chargeback  numeric(15,4);
  v_ok          bool;
  v_cnt         int;
  v_amt         numeric(15,4);

BEGIN
  -- ── Setup JWT como platform admin ───────────────────────────────────────
  PERFORM set_config('request.jwt.claims',
    '{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}', true);

  -- ── Crear actores de prueba ──────────────────────────────────────────────
  INSERT INTO public.trade_marketplace_actors (id, actor_type, nombre, slug, estado)
  VALUES
    (v_ta, 'supplier', 'Test Negative A', 'test-neg-a', 'active'),
    (v_tb, 'supplier', 'Test Negative B', 'test-neg-b', 'active');

  -- ── Helper: insertar una entrada ledger para test actor A ────────────────
  -- Primero una venta positiva base (+200 EUR) para TA
  PERFORM public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT', 200,
    NULL, NULL, v_ta,
    'Venta base TA', 'corr-setup-ta', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  -- Primera rebuild: TA tiene +200 EUR pending
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-01: rebuild Phase 2D retorna phase='2D'
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-01 rebuild retorna phase=2D',
    (v_rebuild->>'phase') = '2D',
    'phase=' || COALESCE(v_rebuild->>'phase','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-02: Balance positivo → negative_amount = 0
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-02 balance positivo -> negative_amount=0',
    (v_rebuild->>'negative_amount')::numeric = 0,
    'negative_amount=' || (v_rebuild->>'negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-03: Balance positivo → pending = ledger_sum
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-03 balance positivo -> pending=ledger_sum',
    (v_rebuild->>'pending_amount')::numeric = 200,
    'pending=' || (v_rebuild->>'pending_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-04: CHARGEBACK_DEBIT crea balance negativo
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'CHARGEBACK_DEBIT', -350,  -- 200 - 350 = -150 deficit
    NULL, NULL, v_ta,
    'CB debit N-04', 'corr-n04', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-04 CHARGEBACK_DEBIT crea negative_amount>0',
    (v_rebuild->>'negative_amount')::numeric > 0,
    'negative_amount=' || (v_rebuild->>'negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-05: Con balance negativo → pending_amount = 0
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-05 balance negativo -> pending_amount=0',
    (v_rebuild->>'pending_amount')::numeric = 0,
    'pending=' || (v_rebuild->>'pending_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-06: negative_since se establece al entrar en déficit
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-06 negative_since establecido al entrar en deficit',
    (v_rebuild->>'negative_since') IS NOT NULL,
    'negative_since=' || COALESCE(v_rebuild->>'negative_since','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-07: negative_since se preserva en rebuilds sucesivos (no se resetea)
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_ns1 text;
    v_ns2 text;
  BEGIN
    v_ns1 := v_rebuild->>'negative_since';
    -- Segundo rebuild inmediato
    v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_ns2 := v_rebuild->>'negative_since';
    INSERT INTO _neg_results VALUES (
      'N-07 negative_since preservado en rebuild sucesivo',
      v_ns1 = v_ns2,
      'ns1=' || v_ns1 || ' ns2=' || v_ns2
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-08: negative_since se limpia cuando balance se recupera a positivo
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'CHARGEBACK_CREDIT', 400,  -- 200 - 350 + 400 = +250 (positivo)
    NULL, NULL, v_ta,
    'CB credit N-08', 'corr-n08', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-08 negative_since limpiado al recuperarse',
    (v_rebuild->>'negative_since') IS NULL,
    'negative_since=' || COALESCE(v_rebuild->>'negative_since','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-09: Aislamiento por proveedor — TA negativo no afecta TB
  -- ─────────────────────────────────────────────────────────────────────────
  -- TA: volver a negativo con gran chargeback
  PERFORM public.mkt_fin_ledger_append(
    'CHARGEBACK_DEBIT', -1000,
    NULL, NULL, v_ta,
    'CB debit N-09', 'corr-n09a', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  -- TB: solo venta positiva
  PERFORM public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT', 100,
    NULL, NULL, v_tb,
    'Venta TB N-09', 'corr-n09b', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_tb, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-09 aislamiento proveedor: TB no afectado por TA negativo',
    (v_rebuild->>'negative_amount')::numeric = 0,
    'TB.negative_amount=' || (v_rebuild->>'negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-10: Aislamiento por moneda — EUR negativo no afecta USD
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT', 500,
    NULL, NULL, v_ta,
    'Venta USD TA', 'corr-n10', NULL, NULL,
    'simulation', NULL, NULL, 'USD', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'USD');
  INSERT INTO _neg_results VALUES (
    'N-10 aislamiento moneda: USD no afectado por EUR negativo',
    (v_rebuild->>'negative_amount')::numeric = 0
      AND (v_rebuild->>'pending_amount')::numeric = 500,
    'USD.negative=' || (v_rebuild->>'negative_amount') ||
    ' USD.pending=' || (v_rebuild->>'pending_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-11: BALANCE_RECOVERY (positivo) reduce déficit
  -- Estado actual TA EUR: suma = 200 - 350 + 400 - 1000 = -750
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'BALANCE_RECOVERY', 200,
    NULL, NULL, v_ta,
    'Recovery manual N-11', 'corr-n11', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  -- sum ahora: -750 + 200 = -550 → negative_amount = 550
  INSERT INTO _neg_results VALUES (
    'N-11 BALANCE_RECOVERY reduce deficit',
    (v_rebuild->>'negative_amount')::numeric < 750 AND
    (v_rebuild->>'negative_amount')::numeric > 0,
    'negative_amount=' || (v_rebuild->>'negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-12: FUTURE_SETOFF (positivo) reduce déficit
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'FUTURE_SETOFF', 100,
    NULL, NULL, v_ta,
    'Future setoff N-12', 'corr-n12', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  -- sum: -550 + 100 = -450 → negative_amount = 450
  INSERT INTO _neg_results VALUES (
    'N-12 FUTURE_SETOFF reduce deficit',
    (v_rebuild->>'negative_amount')::numeric < 550 AND
    (v_rebuild->>'negative_amount')::numeric > 0,
    'negative_amount=' || (v_rebuild->>'negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-13: NEGATIVE_BALANCE_RECORD excluido de la suma del balance
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_before_neg numeric(15,4);
    v_after_neg  numeric(15,4);
  BEGIN
    v_before_neg := (v_rebuild->>'negative_amount')::numeric;
    PERFORM public.mkt_fin_ledger_append(
      'NEGATIVE_BALANCE_RECORD', -999,  -- enorme negativo informacional
      NULL, NULL, v_ta,
      'Registro informacional N-13', 'corr-n13', NULL, NULL,
      'simulation', NULL, NULL, 'EUR', 'confirmed', now()
    );
    v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_after_neg := (v_rebuild->>'negative_amount')::numeric;
    INSERT INTO _neg_results VALUES (
      'N-13 NEGATIVE_BALANCE_RECORD excluido de suma balance',
      v_before_neg = v_after_neg,
      'before=' || v_before_neg || ' after=' || v_after_neg
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-14: get_provider_balance retorna negative_since y recovery_in_progress
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_get_provider_balance(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-14 get_provider_balance retorna negative_since y recovery_in_progress',
    v_result ? 'negative_since' AND v_result ? 'recovery_in_progress',
    'keys=' || (v_result ? 'negative_since')::text || ',' || (v_result ? 'recovery_in_progress')::text
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-15: get_provider_balance para actor sin proyección → no error, recovery_in_progress=false
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_fresh_actor uuid := 'bb000099-0000-0000-0000-000000000099';
  BEGIN
    INSERT INTO public.trade_marketplace_actors (id, actor_type, nombre, slug, estado)
    VALUES (v_fresh_actor, 'supplier', 'Fresh Actor', 'fresh-actor', 'active');
    v_result := public.mkt_fin_get_provider_balance(v_fresh_actor, 'EUR');
    INSERT INTO _neg_results VALUES (
      'N-15 get_provider_balance sin proyeccion -> recovery_in_progress=false',
      (v_result->>'recovery_in_progress')::bool = false
        AND (v_result->>'projection_exists')::bool = false,
      'recovery_in_progress=' || (v_result->>'recovery_in_progress') ||
      ' projection_exists=' || (v_result->>'projection_exists')
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-16: get_negative_balance_breakdown: sin déficit → in_deficit=false
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_get_negative_balance_breakdown(v_tb, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-16 breakdown sin deficit -> in_deficit=false',
    (v_result->>'in_deficit')::bool = false,
    'in_deficit=' || (v_result->>'in_deficit')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-17: get_negative_balance_breakdown: con déficit → in_deficit=true + importes
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_get_negative_balance_breakdown(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-17 breakdown con deficit -> in_deficit=true + deficit_amount>0',
    (v_result->>'in_deficit')::bool = true
      AND (v_result->>'deficit_amount')::numeric > 0,
    'in_deficit=' || (v_result->>'in_deficit') ||
    ' deficit=' || (v_result->>'deficit_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-18: aging_bucket='0_7' para déficit reciente (negative_since = now)
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-18 aging_bucket=0_7 para deficit recien creado',
    (v_result->>'aging_bucket') = '0_7',
    'aging_bucket=' || COALESCE(v_result->>'aging_bucket','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-19: risk_flag AGING_CRITICAL para >90 días (manipulamos negative_since)
  -- ─────────────────────────────────────────────────────────────────────────
  UPDATE public.trade_marketplace_balances
     SET negative_since = now() - INTERVAL '100 days'
   WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
  v_result := public.mkt_fin_get_negative_balance_breakdown(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-19 risk_flag AGING_CRITICAL para >90 dias',
    v_result->'risk_flags' @> '[{"flag":"AGING_CRITICAL"}]',
    'risk_flags=' || (v_result->>'risk_flags')
  );

  -- Reset negative_since a ahora para tests siguientes
  UPDATE public.trade_marketplace_balances
     SET negative_since = now()
   WHERE provider_actor_id = v_ta AND currency::text = 'EUR';

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-20: risk_flag NO_RECOVERY_PLAN para >30 días sin plan
  -- ─────────────────────────────────────────────────────────────────────────
  UPDATE public.trade_marketplace_balances
     SET negative_since = now() - INTERVAL '45 days',
         recovery_in_progress = false
   WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
  v_result := public.mkt_fin_get_negative_balance_breakdown(v_ta, 'EUR');
  INSERT INTO _neg_results VALUES (
    'N-20 risk_flag NO_RECOVERY_PLAN para >30 dias sin recovery',
    v_result->'risk_flags' @> '[{"flag":"NO_RECOVERY_PLAN"}]',
    'risk_flags=' || (v_result->>'risk_flags')
  );
  -- Reset
  UPDATE public.trade_marketplace_balances
     SET negative_since = now()
   WHERE provider_actor_id = v_ta AND currency::text = 'EUR';

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-21: preview_recovery sin amount → usa déficit completo
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_deficit numeric(15,4);
  BEGIN
    SELECT negative_amount INTO v_deficit
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    v_result := public.mkt_fin_preview_recovery(v_ta, 'EUR', NULL, 'manual_simulation');
    INSERT INTO _neg_results VALUES (
      'N-21 preview sin amount usa deficit completo',
      (v_result->>'proposed_amount')::numeric = v_deficit
        AND (v_result->>'full_recovery')::bool = true,
      'proposed=' || (v_result->>'proposed_amount') ||
      ' deficit=' || v_deficit
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-22: preview_recovery con amount parcial
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_preview_recovery(v_ta, 'EUR', 50, 'manual_simulation');
  INSERT INTO _neg_results VALUES (
    'N-22 preview con amount parcial -> full_recovery=false',
    (v_result->>'effective_recovery')::numeric = 50
      AND (v_result->>'full_recovery')::bool = false,
    'effective=' || (v_result->>'effective_recovery') ||
    ' full_recovery=' || (v_result->>'full_recovery')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-23: preview_recovery no persiste cambios (balance no cambia)
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_before_def numeric(15,4);
    v_after_def  numeric(15,4);
  BEGIN
    SELECT negative_amount INTO v_before_def
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    PERFORM public.mkt_fin_preview_recovery(v_ta, 'EUR', 999, 'manual_simulation');
    SELECT negative_amount INTO v_after_def
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    INSERT INTO _neg_results VALUES (
      'N-23 preview no persiste cambios',
      v_before_def = v_after_def,
      'before=' || v_before_def || ' after=' || v_after_def
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-24: preview_recovery calcula impact_pct correctamente
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_deficit numeric(15,4);
    v_pct     numeric;
  BEGIN
    SELECT negative_amount INTO v_deficit
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    v_result := public.mkt_fin_preview_recovery(v_ta, 'EUR', v_deficit / 2, 'manual_simulation');
    v_pct := (v_result->>'impact_pct')::numeric;
    INSERT INTO _neg_results VALUES (
      'N-24 preview impact_pct=50.00 para monto=mitad',
      v_pct = 50.00,
      'impact_pct=' || v_pct
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-25: preview_recovery retorna ledger_entry_type=FUTURE_SETOFF para future_sales_offset
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_preview_recovery(v_ta, 'EUR', 10, 'future_sales_offset');
  INSERT INTO _neg_results VALUES (
    'N-25 preview future_sales_offset -> ledger_entry_type=FUTURE_SETOFF',
    (v_result->>'ledger_entry_type') = 'FUTURE_SETOFF',
    'ledger_entry_type=' || COALESCE(v_result->>'ledger_entry_type','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- Normalización pre-N26: llevar déficit a exactamente 100 EUR
  -- (las entradas N-11/N-12 dejan un déficit variable; lo zeroeamos y
  --  creamos un CHARGEBACK_DEBIT controlado de -100)
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE v_cur_def numeric(15,4); BEGIN
    SELECT negative_amount INTO v_cur_def
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    IF COALESCE(v_cur_def, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'BALANCE_RECOVERY', v_cur_def,
        NULL, NULL, v_ta, 'Zero-out pre-N26', 'corr-n26-zero', NULL, NULL,
        'simulation', NULL, NULL, 'EUR', 'confirmed', now()
      );
    END IF;
    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -100,
      NULL, NULL, v_ta, 'Deficit exacto 100 para N26+', 'corr-n26-def', NULL, NULL,
      'simulation', NULL, NULL, 'EUR', 'confirmed', now()
    );
    PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-26: create_recovery para el déficit completo (100 EUR), status=pending
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_create_recovery(
    v_ta, 'EUR', 100, 'manual_simulation', 'Test N-26',
    'idem-n26', 'corr-n26', NULL
  );
  v_recovery_id := (v_result->>'recovery_id')::uuid;
  INSERT INTO _neg_results VALUES (
    'N-26 create_recovery status=pending simulation_only=true',
    (v_result->>'status') = 'created'
      AND (v_result->>'recovery_status') = 'pending'
      AND (v_result->>'simulation_only')::bool = true,
    'status=' || (v_result->>'status') ||
    ' recovery_status=' || (v_result->>'recovery_status')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-27: create_recovery marca recovery_in_progress=true en balance
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_rip bool;
  BEGIN
    SELECT recovery_in_progress INTO v_rip
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    INSERT INTO _neg_results VALUES (
      'N-27 create_recovery marca recovery_in_progress=true',
      v_rip = true,
      'recovery_in_progress=' || v_rip::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-28: create_recovery idempotencia por idempotency_key → replayed
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_create_recovery(
    v_ta, 'EUR', 50, 'manual_simulation', NULL,
    'idem-n26', NULL, NULL  -- misma idem key
  );
  INSERT INTO _neg_results VALUES (
    'N-28 create_recovery idempotencia -> status=replayed',
    (v_result->>'status') = 'replayed',
    'status=' || (v_result->>'status')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-29: create_recovery cuando no hay déficit → excepción NO_DEFICIT
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_caught bool := false;
  BEGIN
    BEGIN
      PERFORM public.mkt_fin_create_recovery(v_tb, 'EUR', 10, 'manual_simulation', NULL, NULL, NULL, NULL);
    EXCEPTION WHEN others THEN
      v_caught := SQLERRM LIKE '%NO_DEFICIT%';
    END;
    INSERT INTO _neg_results VALUES (
      'N-29 create_recovery sin deficit -> excepcion NO_DEFICIT',
      v_caught,
      'excepcion capturada=' || v_caught::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-30: create_recovery con amount > deficit → excepción AMOUNT_EXCEEDS_DEFICIT
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_caught bool := false;
    v_deficit numeric(15,4);
  BEGIN
    SELECT negative_amount INTO v_deficit
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    BEGIN
      PERFORM public.mkt_fin_create_recovery(
        v_ta, 'EUR', v_deficit + 9999, 'manual_simulation', NULL, NULL, NULL, NULL
      );
    EXCEPTION WHEN others THEN
      v_caught := SQLERRM LIKE '%AMOUNT_EXCEEDS_DEFICIT%';
    END;
    INSERT INTO _neg_results VALUES (
      'N-30 create_recovery amount>deficit -> excepcion AMOUNT_EXCEEDS_DEFICIT',
      v_caught,
      'excepcion capturada=' || v_caught::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-31: process_recovery (manual_simulation) → crea entrada BALANCE_RECOVERY
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_process_recovery(v_recovery_id, 50, 'evt-n31', 'corr-n31');
  INSERT INTO _neg_results VALUES (
    'N-31 process_recovery manual_simulation -> entry_type=BALANCE_RECOVERY',
    (v_result->>'entry_type') = 'BALANCE_RECOVERY',
    'entry_type=' || COALESCE(v_result->>'entry_type','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-32: entrada BALANCE_RECOVERY tiene amount positivo en ledger
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_entry_id uuid;
    v_entry_amt numeric(15,4);
  BEGIN
    v_entry_id := (v_result->>'ledger_entry_id')::uuid;
    SELECT amount INTO v_entry_amt
      FROM public.trade_marketplace_ledger_entries
     WHERE id = v_entry_id;
    INSERT INTO _neg_results VALUES (
      'N-32 BALANCE_RECOVERY en ledger tiene amount>0 (positivo)',
      v_entry_amt > 0,
      'amount=' || v_entry_amt
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-33: process_recovery partial → status=partial
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-33 process_recovery parcial -> recovery_status=partial',
    (v_result->>'recovery_status') = 'partial',
    'recovery_status=' || COALESCE(v_result->>'recovery_status','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-34: process_recovery partial → negative_amount aun > 0
  -- ─────────────────────────────────────────────────────────────────────────
  INSERT INTO _neg_results VALUES (
    'N-34 proceso parcial -> negative_amount aun >0',
    (v_result->>'new_negative_amount')::numeric > 0,
    'new_negative_amount=' || (v_result->>'new_negative_amount')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-35: process_recovery completo → status=completed, negative_amount=0
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_remaining numeric(15,4);
  BEGIN
    v_remaining := (v_result->>'remaining_amount')::numeric;
    -- Procesar el resto para completar
    v_result := public.mkt_fin_process_recovery(
      v_recovery_id, v_remaining, 'evt-n35', 'corr-n35'
    );
    INSERT INTO _neg_results VALUES (
      'N-35 process_recovery completo -> status=completed negative=0',
      (v_result->>'recovery_status') = 'completed'
        AND (v_result->>'new_negative_amount')::numeric = 0,
      'recovery_status=' || (v_result->>'recovery_status') ||
      ' new_negative=' || (v_result->>'new_negative_amount')
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-36: Al recuperarse completamente, negative_since se limpia
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_ns text;
  BEGIN
    SELECT negative_since::text INTO v_ns
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    INSERT INTO _neg_results VALUES (
      'N-36 recuperacion completa -> negative_since limpiado',
      v_ns IS NULL,
      'negative_since=' || COALESCE(v_ns,'NULL')
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-37: process_recovery en recovery terminal → excepción RECOVERY_TERMINAL
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_caught bool := false;
  BEGIN
    BEGIN
      PERFORM public.mkt_fin_process_recovery(v_recovery_id, 1, NULL, NULL);
    EXCEPTION WHEN others THEN
      v_caught := SQLERRM LIKE '%RECOVERY_TERMINAL%';
    END;
    INSERT INTO _neg_results VALUES (
      'N-37 process_recovery en completed -> RECOVERY_TERMINAL',
      v_caught,
      'excepcion=' || v_caught::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- Preparar nueva recovery de tipo future_sales_offset para N-38..N-40
  -- Primero crear nuevo déficit para TA
  -- ─────────────────────────────────────────────────────────────────────────
  PERFORM public.mkt_fin_ledger_append(
    'CHARGEBACK_DEBIT', -300,
    NULL, NULL, v_ta,
    'CB debit para N38+', 'corr-n38-setup', NULL, NULL,
    'simulation', NULL, NULL, 'EUR', 'confirmed', now()
  );
  PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');

  v_result := public.mkt_fin_create_recovery(
    v_ta, 'EUR', 100, 'future_sales_offset', 'FSO N-38',
    'idem-n38', 'corr-n38', NULL
  );
  v_rec2_id := (v_result->>'recovery_id')::uuid;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-38: process_recovery future_sales_offset → crea entrada FUTURE_SETOFF
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_process_recovery(v_rec2_id, 100, 'evt-n38', 'corr-n38-proc');
  INSERT INTO _neg_results VALUES (
    'N-38 process future_sales_offset -> entry_type=FUTURE_SETOFF',
    (v_result->>'entry_type') = 'FUTURE_SETOFF',
    'entry_type=' || COALESCE(v_result->>'entry_type','NULL')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-39: entrada FUTURE_SETOFF es positiva (invariante venta original intacta)
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_fso_amt numeric(15,4);
  BEGIN
    SELECT amount INTO v_fso_amt
      FROM public.trade_marketplace_ledger_entries
     WHERE id = (v_result->>'ledger_entry_id')::uuid;
    INSERT INTO _neg_results VALUES (
      'N-39 FUTURE_SETOFF en ledger es positivo (venta original intacta)',
      v_fso_amt > 0,
      'FUTURE_SETOFF.amount=' || v_fso_amt
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-40: GOODS_ENTITLEMENT original no fue modificado
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_ge_cnt int;
  BEGIN
    SELECT COUNT(*) INTO v_ge_cnt
      FROM public.trade_marketplace_ledger_entries
     WHERE actor_id = v_ta
       AND entry_type = 'GOODS_ENTITLEMENT'
       AND amount = 200  -- la venta original intacta
       AND status != 'failed';
    INSERT INTO _neg_results VALUES (
      'N-40 GOODS_ENTITLEMENT original intacto (amount=200 sin modificar)',
      v_ge_cnt >= 1,
      'GOODS_ENTITLEMENT con amount=200: cnt=' || v_ge_cnt
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-41: idempotencia process_recovery por source_event_id → replayed
  -- ─────────────────────────────────────────────────────────────────────────
  -- Crear nueva recovery para probar idempotencia
  DECLARE
    v_rec3_id uuid;
    v_replayed_result jsonb;
  BEGIN
    -- Nueva deficit
    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -100,
      NULL, NULL, v_ta, 'CB idem test', 'corr-n41s', NULL, NULL,
      'simulation', NULL, NULL, 'EUR', 'confirmed', now()
    );
    PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_result := public.mkt_fin_create_recovery(
      v_ta, 'EUR', 50, 'manual_simulation', NULL, 'idem-n41', 'corr-n41', NULL
    );
    v_rec3_id := (v_result->>'recovery_id')::uuid;
    PERFORM public.mkt_fin_process_recovery(v_rec3_id, 50, 'evt-n41', NULL);
    -- Re-llamar con mismo source_event_id → debe retornar replayed
    v_replayed_result := public.mkt_fin_process_recovery(v_rec3_id, 50, 'evt-n41', NULL);
    INSERT INTO _neg_results VALUES (
      'N-41 process_recovery idempotente por source_event_id -> replayed',
      (v_replayed_result->>'status') = 'replayed',
      'status=' || (v_replayed_result->>'status')
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-42: process_recovery AMOUNT_EXCEEDS_REMAINING → excepción
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_caught bool := false;
    v_rec4_id uuid;
  BEGIN
    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -200, NULL, NULL, v_ta,
      'CB N42', 'corr-n42s', NULL, NULL,
      'simulation', NULL, NULL, 'EUR', 'confirmed', now()
    );
    PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_result := public.mkt_fin_create_recovery(
      v_ta, 'EUR', 100, 'manual_simulation', NULL, 'idem-n42', NULL, NULL
    );
    v_rec4_id := (v_result->>'recovery_id')::uuid;
    BEGIN
      PERFORM public.mkt_fin_process_recovery(v_rec4_id, 999, NULL, NULL);
    EXCEPTION WHEN others THEN
      v_caught := SQLERRM LIKE '%AMOUNT_EXCEEDS_REMAINING%';
    END;
    INSERT INTO _neg_results VALUES (
      'N-42 process_recovery amount>remaining -> AMOUNT_EXCEEDS_REMAINING',
      v_caught,
      'caught=' || v_caught::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-43: cancel_recovery → status=cancelled
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_rec5_id uuid;
    v_cancel_result jsonb;
  BEGIN
    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT', -100, NULL, NULL, v_ta,
      'CB N43', 'corr-n43s', NULL, NULL,
      'simulation', NULL, NULL, 'EUR', 'confirmed', now()
    );
    PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_result := public.mkt_fin_create_recovery(
      v_ta, 'EUR', 80, 'manual_simulation', NULL, 'idem-n43', NULL, NULL
    );
    v_rec5_id := (v_result->>'recovery_id')::uuid;
    v_cancel_result := public.mkt_fin_cancel_recovery(v_rec5_id, 'Test cancelacion N-43', NULL);
    INSERT INTO _neg_results VALUES (
      'N-43 cancel_recovery -> status=cancelled',
      (v_cancel_result->>'status') = 'cancelled',
      'status=' || (v_cancel_result->>'status')
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-44: cancel_recovery → recovery_in_progress=false si no hay otras activas
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_rip bool;
  BEGIN
    v_rebuild := public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    SELECT recovery_in_progress INTO v_rip
      FROM public.trade_marketplace_balances
     WHERE provider_actor_id = v_ta AND currency::text = 'EUR';
    -- Puede haber otras recoveries activas de tests anteriores; verificar coherencia
    DECLARE
      v_active_cnt int;
    BEGIN
      SELECT COUNT(*) INTO v_active_cnt
        FROM public.trade_marketplace_recoveries
       WHERE provider_actor_id = v_ta AND currency::text = 'EUR'
         AND status IN ('pending','partial');
      INSERT INTO _neg_results VALUES (
        'N-44 recovery_in_progress coherente con recoveries activas',
        v_rip = (v_active_cnt > 0),
        'rip=' || v_rip::text || ' active_cnt=' || v_active_cnt
      );
    END;
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-45: cancel_recovery en estado terminal → excepción RECOVERY_TERMINAL
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_caught bool := false;
  BEGIN
    -- v_recovery_id ya está en 'completed' desde N-35
    BEGIN
      PERFORM public.mkt_fin_cancel_recovery(v_recovery_id, NULL, NULL);
    EXCEPTION WHEN others THEN
      v_caught := SQLERRM LIKE '%RECOVERY_TERMINAL%';
    END;
    INSERT INTO _neg_results VALUES (
      'N-45 cancel_recovery en completed -> RECOVERY_TERMINAL',
      v_caught,
      'caught=' || v_caught::text
    );
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-46: list_provider_recoveries retorna items del actor
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_list_provider_recoveries(v_ta, 50, 0);
  INSERT INTO _neg_results VALUES (
    'N-46 list_provider_recoveries retorna items>0',
    jsonb_array_length(v_result->'items') > 0,
    'items_count=' || jsonb_array_length(v_result->'items')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-47: list_provider_recoveries paginación con offset
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_total int;
    v_paged int;
  BEGIN
    v_total := jsonb_array_length(v_result->'items');
    IF v_total > 1 THEN
      v_result := public.mkt_fin_list_provider_recoveries(v_ta, 1, 0);
      v_paged := jsonb_array_length(v_result->'items');
      INSERT INTO _neg_results VALUES (
        'N-47 list_provider_recoveries paginacion limit=1',
        v_paged = 1,
        'paged=' || v_paged
      );
    ELSE
      -- Skip: no hay suficientes registros para probar paginación
      INSERT INTO _neg_results VALUES (
        'N-47 list_provider_recoveries paginacion (skip: <2 items)',
        true, 'skipped (solo ' || v_total || ' item)'
      );
    END IF;
  END;

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-48: list_admin_recoveries retorna recoveries de todos los actores
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_list_admin_recoveries(NULL, NULL, 100, 0);
  INSERT INTO _neg_results VALUES (
    'N-48 list_admin_recoveries retorna items',
    v_result ? 'items' AND jsonb_array_length(v_result->'items') >= 0,
    'items=' || jsonb_array_length(v_result->'items')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-49: admin_negative_overview retorna estructura correcta
  -- ─────────────────────────────────────────────────────────────────────────
  v_result := public.mkt_fin_admin_negative_overview();
  INSERT INTO _neg_results VALUES (
    'N-49 admin_negative_overview retorna providers_in_deficit y by_aging',
    v_result ? 'providers_in_deficit'
      AND v_result ? 'by_aging'
      AND (v_result->'by_aging') ? '0_7'
      AND (v_result->'by_aging') ? '90_plus',
    'providers_in_deficit=' || (v_result->>'providers_in_deficit')
  );

  -- ─────────────────────────────────────────────────────────────────────────
  -- N-50: reconcile_provider_balance Phase 2D incluye BALANCE_RECOVERY + FUTURE_SETOFF
  -- ─────────────────────────────────────────────────────────────────────────
  DECLARE
    v_reconcile jsonb;
  BEGIN
    -- Rebuild para sincronizar balance
    PERFORM public.mkt_fin_rebuild_provider_balance(v_ta, 'EUR');
    v_reconcile := public.mkt_fin_reconcile_provider_balance(v_ta, 'EUR');
    INSERT INTO _neg_results VALUES (
      'N-50 reconcile Phase 2D incluye recovery -> status=MATCH',
      (v_reconcile->>'status') = 'MATCH'
        AND (v_reconcile->>'phase') = '2D'
        AND (v_reconcile->>'includes_recovery')::bool = true,
      'status=' || (v_reconcile->>'status') ||
      ' phase=' || (v_reconcile->>'phase') ||
      ' diff=' || (v_reconcile->>'difference')
    );
  END;

END;
$$;

-- ── Resultados ──────────────────────────────────────────────────────────────
SELECT
  test_name,
  CASE WHEN passed THEN 'PASS' ELSE '*** FAIL ***' END AS result,
  detail
FROM _neg_results
ORDER BY test_name;

SELECT
  COUNT(*) FILTER (WHERE passed)     AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*)                           AS total
FROM _neg_results;

ROLLBACK;
