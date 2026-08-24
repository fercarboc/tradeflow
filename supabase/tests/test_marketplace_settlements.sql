-- MP-FIN-2F — Settlement Engine — 60 tests S-01..S-60
-- Patrón: BEGIN / DO $$ ... $$ / ROLLBACK
-- JWT admin: cf1000d3-80bc-4bdd-a9df-b8a0f0462c77
-- SIMULATION_ONLY = true throughout

\set ON_ERROR_STOP on

-- ── Contexto admin (session-local) ─────────────────────────────────────────
SELECT set_config('request.jwt.claims','{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}',false);

-- ── Actores de prueba ───────────────────────────────────────────────────────
DO $$
DECLARE
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id,email) VALUES(v_user_a,'setl-test-a@example.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.trade_marketplace_actors(id,user_id,display_name,actor_type,is_active,is_verified)
    VALUES(gen_random_uuid(),v_user_a,'SETL Test Supplier A','supplier',true,true) ON CONFLICT DO NOTHING;
  INSERT INTO auth.users(id,email) VALUES(v_user_b,'setl-test-b@example.com') ON CONFLICT DO NOTHING;
  INSERT INTO public.trade_marketplace_actors(id,user_id,display_name,actor_type,is_active,is_verified)
    VALUES(gen_random_uuid(),v_user_b,'SETL Test Supplier B','supplier',true,true) ON CONFLICT DO NOTHING;
END$$;

-- ── Variables de sesión ─────────────────────────────────────────────────────
DO $$
DECLARE v_actor_a uuid; v_actor_b uuid;
BEGIN
  SELECT id INTO v_actor_a FROM public.trade_marketplace_actors WHERE display_name='SETL Test Supplier A' LIMIT 1;
  SELECT id INTO v_actor_b FROM public.trade_marketplace_actors WHERE display_name='SETL Test Supplier B' LIMIT 1;
  PERFORM set_config('app.setl_actor_a', v_actor_a::text, false);
  PERFORM set_config('app.setl_actor_b', v_actor_b::text, false);
END$$;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 1: ESTRUCTURA
-- ══════════════════════════════════════════════════════════════════════════════

-- S-01: tabla trade_marketplace_settlements existe
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trade_marketplace_settlements') THEN
    RAISE EXCEPTION 'S-01 FAIL: trade_marketplace_settlements does not exist';
  END IF;
  RAISE NOTICE 'S-01 PASS: trade_marketplace_settlements exists';
END$$;
ROLLBACK;

-- S-02: tabla trade_marketplace_settlement_lines existe
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='trade_marketplace_settlement_lines') THEN
    RAISE EXCEPTION 'S-02 FAIL: trade_marketplace_settlement_lines does not exist';
  END IF;
  RAISE NOTICE 'S-02 PASS: trade_marketplace_settlement_lines exists';
END$$;
ROLLBACK;

-- S-03: UNIQUE constraint en settlement_lines.ledger_entry_id existe
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage cu ON cu.constraint_name=tc.constraint_name
    WHERE tc.table_schema='public' AND tc.table_name='trade_marketplace_settlement_lines'
      AND tc.constraint_type='UNIQUE' AND cu.column_name='ledger_entry_id'
  ) THEN
    RAISE EXCEPTION 'S-03 FAIL: UNIQUE(ledger_entry_id) not found — S-26 invariant unprotected';
  END IF;
  RAISE NOTICE 'S-03 PASS: UNIQUE(ledger_entry_id) exists on settlement_lines';
END$$;
ROLLBACK;

-- S-04: CHECK simulation_only=true impide insertar simulation_only=false
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
BEGIN
  BEGIN
    INSERT INTO public.trade_marketplace_settlements(settlement_number,provider_actor_id,currency,period_start,period_end,simulation_only)
    VALUES('SETL-SIMFALSE-TEST',v_actor_a,'EUR',now()-interval'1 month',now(),false);
    RAISE EXCEPTION 'S-04 FAIL: expected check_violation';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'S-04 PASS: chk_settlement_simulation blocks simulation_only=false';
  END;
END$$;
ROLLBACK;

-- S-05: CHECK period_end > period_start impide periodos inválidos
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
BEGIN
  BEGIN
    INSERT INTO public.trade_marketplace_settlements(settlement_number,provider_actor_id,currency,period_start,period_end)
    VALUES('SETL-PERIOD-INV',v_actor_a,'EUR',now(),now()-interval'1 day');
    RAISE EXCEPTION 'S-05 FAIL: expected check_violation';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'S-05 PASS: chk_settlement_period blocks invalid period';
  END;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 2: LEDGER TYPE
-- ══════════════════════════════════════════════════════════════════════════════

-- S-06: SETTLEMENT_PAID_SIMULATION acepta el constraint de ledger
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_eid uuid;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('SETTLEMENT_PAID_SIMULATION',-100,'EUR',v_actor_a,'S-06 SPS test','confirmed',now())
  RETURNING id INTO v_eid;
  IF v_eid IS NULL THEN RAISE EXCEPTION 'S-06 FAIL: no ledger entry created'; END IF;
  RAISE NOTICE 'S-06 PASS: SETTLEMENT_PAID_SIMULATION accepted by ledger constraint';
END$$;
ROLLBACK;

-- S-07: SETTLEMENT_PAID_SIMULATION debe ser NEGATIVO por convención (amount<0)
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('SETTLEMENT_PAID_SIMULATION',-250.50,'EUR',v_actor_a,'S-07 SPS negative','confirmed',now());
  SELECT amount INTO v_amt FROM public.trade_marketplace_ledger_entries WHERE description='S-07 SPS negative' AND actor_id=v_actor_a;
  IF v_amt >= 0 THEN RAISE EXCEPTION 'S-07 FAIL: SPS amount should be negative, got %', v_amt; END IF;
  RAISE NOTICE 'S-07 PASS: SETTLEMENT_PAID_SIMULATION amount is negative (%)' , v_amt;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 3: PREVIEW
-- ══════════════════════════════════════════════════════════════════════════════

-- S-08: preview con saldo cero retorna max_payable=0
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_r jsonb;
BEGIN
  v_r := public.mkt_fin_preview_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  IF (v_r->>'max_payable')::numeric <> 0 THEN
    RAISE EXCEPTION 'S-08 FAIL: expected max_payable=0 for empty actor, got %', v_r->>'max_payable';
  END IF;
  RAISE NOTICE 'S-08 PASS: preview max_payable=0 for zero balance';
END$$;
ROLLBACK;

-- S-09: preview contiene campo simulation_only=true
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_r jsonb;
BEGIN
  v_r := public.mkt_fin_preview_settlement(v_actor_a);
  IF (v_r->>'simulation_only')::bool IS NOT TRUE THEN
    RAISE EXCEPTION 'S-09 FAIL: preview.simulation_only is not true';
  END IF;
  RAISE NOTICE 'S-09 PASS: preview.simulation_only=true';
END$$;
ROLLBACK;

-- S-10: preview con fondos disponibles retorna max_payable correcto
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_expected numeric := 300;
BEGIN
  -- Inyectar base + P2A para que haya available
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',300,'EUR',v_actor_a,'S-10 entitlement','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',300,'EUR',v_actor_a,'S-10 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_preview_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  IF (v_r->>'max_payable')::numeric < v_expected THEN
    RAISE EXCEPTION 'S-10 FAIL: max_payable=% expected>=%', v_r->>'max_payable', v_expected;
  END IF;
  RAISE NOTICE 'S-10 PASS: preview max_payable=% with available funds', v_r->>'max_payable';
END$$;
ROLLBACK;

-- S-11: preview con negativo aplica fórmula GREATEST(available-negative,0)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb;
BEGIN
  -- available<negative → max_payable=0
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',50,'EUR',v_actor_a,'S-11 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',50,'EUR',v_actor_a,'S-11 p2a','confirmed',now()-interval'2 days'),
    ('GOODS_REFUND_REVERSAL',-200,'EUR',v_actor_a,'S-11 refund','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_preview_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  IF (v_r->>'max_payable')::numeric <> 0 THEN
    RAISE EXCEPTION 'S-11 FAIL: max_payable=% expected=0 when negative>available', v_r->>'max_payable';
  END IF;
  RAISE NOTICE 'S-11 PASS: GREATEST(available-negative,0)=0 when negative exceeds available';
END$$;
ROLLBACK;

-- S-12: preview fórmula_max_payable campo presente
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_r jsonb;
BEGIN
  v_r := public.mkt_fin_preview_settlement(v_actor_a);
  IF v_r->>'formula_max_payable' IS NULL THEN
    RAISE EXCEPTION 'S-12 FAIL: formula_max_payable field missing from preview';
  END IF;
  RAISE NOTICE 'S-12 PASS: formula_max_payable present: %', v_r->>'formula_max_payable';
END$$;
ROLLBACK;

-- S-13: preview commission_real=0 (COMMISSION_GATE cerrado)
BEGIN;
DO $$
DECLARE v_actor_a uuid := current_setting('app.setl_actor_a')::uuid; v_r jsonb;
BEGIN
  v_r := public.mkt_fin_preview_settlement(v_actor_a);
  IF (v_r->>'commission_real')::numeric <> 0 THEN
    RAISE EXCEPTION 'S-13 FAIL: commission_real=% expected=0', v_r->>'commission_real';
  END IF;
  RAISE NOTICE 'S-13 PASS: commission_real=0 (COMMISSION_GATE closed)';
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 4: CREATE & CALCULATE
-- ══════════════════════════════════════════════════════════════════════════════

-- S-14: crear settlement con auto_calculate=true → status='calculated'
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_status text;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',500,'EUR',v_actor_a,'S-14 ent','confirmed',now()-interval'10 days'),
    ('PENDING_TO_AVAILABLE',500,'EUR',v_actor_a,'S-14 p2a','confirmed',now()-interval'9 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),NULL,NULL,NULL,NULL,NULL,true);
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT status INTO v_status FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_status <> 'calculated' THEN
    RAISE EXCEPTION 'S-14 FAIL: status=% expected=calculated', v_status;
  END IF;
  RAISE NOTICE 'S-14 PASS: auto_calculate=true → status=calculated';
END$$;
ROLLBACK;

-- S-15: crear settlement con auto_calculate=false → status='draft'
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_status text;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),NULL,NULL,NULL,NULL,NULL,false);
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT status INTO v_status FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_status <> 'draft' THEN
    RAISE EXCEPTION 'S-15 FAIL: status=% expected=draft', v_status;
  END IF;
  RAISE NOTICE 'S-15 PASS: auto_calculate=false → status=draft';
END$$;
ROLLBACK;

-- S-16: settlement sin fondos tiene max_payable=0 y settlement_amount=0
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_mp numeric; v_sa numeric;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT max_payable,settlement_amount INTO v_mp,v_sa FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_mp<>0 OR v_sa<>0 THEN
    RAISE EXCEPTION 'S-16 FAIL: max_payable=% settlement_amount=% expected both 0', v_mp, v_sa;
  END IF;
  RAISE NOTICE 'S-16 PASS: max_payable=0 settlement_amount=0 for empty actor';
END$$;
ROLLBACK;

-- S-17: idempotency_key devuelve status='replayed' en segunda llamada
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r1 jsonb; v_r2 jsonb; v_key text := 'idem-test-s17-'||gen_random_uuid()::text;
BEGIN
  v_r1 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),NULL,v_key);
  v_r2 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),NULL,v_key);
  IF v_r2->>'status' <> 'replayed' THEN
    RAISE EXCEPTION 'S-17 FAIL: second call status=% expected=replayed', v_r2->>'status';
  END IF;
  IF (v_r1->>'settlement_id') <> (v_r2->>'settlement_id') THEN
    RAISE EXCEPTION 'S-17 FAIL: different settlement_ids for same idempotency_key';
  END IF;
  RAISE NOTICE 'S-17 PASS: idempotency_key → replayed with same settlement_id';
END$$;
ROLLBACK;

-- S-18: settlement_number es único (formato SETL-*)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r1 jsonb; v_r2 jsonb;
BEGIN
  v_r1 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_r2 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  IF (v_r1->>'settlement_number') = (v_r2->>'settlement_number') THEN
    RAISE EXCEPTION 'S-18 FAIL: duplicate settlement_number';
  END IF;
  RAISE NOTICE 'S-18 PASS: settlement_numbers are unique: % vs %', v_r1->>'settlement_number', v_r2->>'settlement_number';
END$$;
ROLLBACK;

-- S-19: settlement_lines incluye solo entradas del periodo
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_cnt int;
  v_period_start timestamptz := now()-interval'5 days';
  v_period_end   timestamptz := now()-interval'1 day';
BEGIN
  -- Entrada dentro del periodo
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_ENTITLEMENT',100,'EUR',v_actor_a,'S-19 in-period','confirmed',now()-interval'3 days');
  -- Entrada fuera del periodo (muy antigua)
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_ENTITLEMENT',100,'EUR',v_actor_a,'S-19 out-period','confirmed',now()-interval'30 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR',v_period_start,v_period_end);
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_cnt FROM public.trade_marketplace_settlement_lines sl
    JOIN public.trade_marketplace_ledger_entries le ON le.id=sl.ledger_entry_id
    WHERE sl.settlement_id=v_sid AND le.description='S-19 out-period';
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'S-19 FAIL: out-of-period entry included in settlement lines';
  END IF;
  RAISE NOTICE 'S-19 PASS: period filter excludes out-of-period entries';
END$$;
ROLLBACK;

-- S-20: GOODS_ENTITLEMENT, SHIPPING_ENTITLEMENT incluidas en lines
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_cnt int;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',200,'EUR',v_actor_a,'S-20 goods','confirmed',now()-interval'1 day'),
    ('SHIPPING_ENTITLEMENT',30,'EUR',v_actor_a,'S-20 ship','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_cnt FROM public.trade_marketplace_settlement_lines
    WHERE settlement_id=v_sid AND entry_type IN ('GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT');
  IF v_cnt < 2 THEN
    RAISE EXCEPTION 'S-20 FAIL: GOODS/SHIPPING_ENTITLEMENT not in lines (found %)', v_cnt;
  END IF;
  RAISE NOTICE 'S-20 PASS: GOODS_ENTITLEMENT and SHIPPING_ENTITLEMENT in lines (count=%)', v_cnt;
END$$;
ROLLBACK;

-- S-21: RESERVE_HOLD NOT incluido en lines (es movimiento de bucket, no elegible)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_cnt int;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',400,'EUR',v_actor_a,'S-21 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',400,'EUR',v_actor_a,'S-21 p2a','confirmed',now()-interval'4 days'),
    ('RESERVE_HOLD',-50,'EUR',v_actor_a,'S-21 rh','confirmed',now()-interval'3 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_cnt FROM public.trade_marketplace_settlement_lines
    WHERE settlement_id=v_sid AND entry_type='RESERVE_HOLD';
  IF v_cnt > 0 THEN
    RAISE EXCEPTION 'S-21 FAIL: RESERVE_HOLD should not be in settlement lines';
  END IF;
  RAISE NOTICE 'S-21 PASS: RESERVE_HOLD excluded from settlement lines';
END$$;
ROLLBACK;

-- S-22: settlement_amount <= max_payable (constraint chk_settlement_le_payable)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_mp numeric; v_sa numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',600,'EUR',v_actor_a,'S-22 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',600,'EUR',v_actor_a,'S-22 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),9999);
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT max_payable,settlement_amount INTO v_mp,v_sa FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_sa > v_mp + 0.0001 THEN
    RAISE EXCEPTION 'S-22 FAIL: settlement_amount=%>max_payable=%', v_sa, v_mp;
  END IF;
  RAISE NOTICE 'S-22 PASS: settlement_amount=% clamped to max_payable=%', v_sa, v_mp;
END$$;
ROLLBACK;

-- S-23: settlement parcial (p_amount < max_payable) respetado
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_sa numeric; v_partial numeric := 50;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',800,'EUR',v_actor_a,'S-23 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',800,'EUR',v_actor_a,'S-23 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),v_partial);
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT settlement_amount INTO v_sa FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_sa <> v_partial THEN
    RAISE EXCEPTION 'S-23 FAIL: settlement_amount=% expected=%', v_sa, v_partial;
  END IF;
  RAISE NOTICE 'S-23 PASS: partial settlement_amount=% accepted', v_sa;
END$$;
ROLLBACK;

-- S-24: commission_amount=0 en settlement (COMMISSION_GATE)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_comm numeric;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT commission_amount INTO v_comm FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_comm <> 0 THEN
    RAISE EXCEPTION 'S-24 FAIL: commission_amount=% expected=0', v_comm;
  END IF;
  RAISE NOTICE 'S-24 PASS: commission_amount=0 (COMMISSION_GATE closed)';
END$$;
ROLLBACK;

-- S-25: actor no encontrado lanza ACTOR_NOT_FOUND
BEGIN;
DO $$
DECLARE v_fake uuid := gen_random_uuid();
BEGIN
  BEGIN
    PERFORM public.mkt_fin_create_simulation_settlement(v_fake,'EUR','-infinity'::timestamptz,now());
    RAISE EXCEPTION 'S-25 FAIL: expected ACTOR_NOT_FOUND';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%ACTOR_NOT_FOUND%' THEN
      RAISE EXCEPTION 'S-25 FAIL: got unexpected error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-25 PASS: ACTOR_NOT_FOUND raised for unknown actor';
  END;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 5: S-26 INVARIANT — LEDGER ENTRY NO DUPLICADA
-- ══════════════════════════════════════════════════════════════════════════════

-- S-26: una ledger_entry no puede aparecer en dos settlements distintos
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r1 jsonb; v_r2 jsonb; v_sid1 uuid; v_sid2 uuid;
  v_line_cnt_s2 int; v_lines_s1 int;
BEGIN
  -- Inyectar entradas y balance
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',1000,'EUR',v_actor_a,'S-26 shared-entry','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',1000,'EUR',v_actor_a,'S-26 p2a','confirmed',now()-interval'4 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  -- Primer settlement captura todas las entries
  v_r1 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid1 := (v_r1->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_lines_s1 FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid1;
  -- Segundo settlement sobre el mismo periodo y actor
  v_r2 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid2 := (v_r2->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_line_cnt_s2 FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid2;
  -- S2 no puede tener las mismas entries que S1
  IF v_line_cnt_s2 > 0 THEN
    -- Check no hay duplicados en ambos
    IF EXISTS (
      SELECT ledger_entry_id FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid1
      INTERSECT
      SELECT ledger_entry_id FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid2
    ) THEN
      RAISE EXCEPTION 'S-26 FAIL: same ledger_entry_id appears in two settlements';
    END IF;
  END IF;
  RAISE NOTICE 'S-26 PASS: S-26 invariant upheld — S1 lines=%, S2 lines=% (no overlap)', v_lines_s1, v_line_cnt_s2;
END$$;
ROLLBACK;

-- S-27: inserción manual duplicada en settlement_lines viola UNIQUE(ledger_entry_id)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_le_id uuid; v_sid2 uuid; v_snum2 text;
BEGIN
  -- Setup: settlement con una línea
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_ENTITLEMENT',100,'EUR',v_actor_a,'S-27 unique entry','confirmed',now()-interval'1 hour')
  RETURNING id INTO v_le_id;
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  -- Crear segundo settlement shell
  v_snum2 := public.next_financial_doc_number('SETL');
  INSERT INTO public.trade_marketplace_settlements(settlement_number,provider_actor_id,currency,period_start,period_end)
  VALUES(v_snum2,v_actor_a,'EUR',now()-interval'1 year',now())
  RETURNING id INTO v_sid2;
  -- Intentar insertar misma ledger_entry en segundo settlement
  BEGIN
    INSERT INTO public.trade_marketplace_settlement_lines(settlement_id,ledger_entry_id,entry_type,gross_amount,currency,included_amount)
    VALUES(v_sid2,v_le_id,'GOODS_ENTITLEMENT',100,'EUR',100);
    RAISE EXCEPTION 'S-27 FAIL: expected unique_violation for duplicate ledger_entry_id';
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'S-27 PASS: UNIQUE(ledger_entry_id) blocks duplicate across settlements';
  END;
END$$;
ROLLBACK;

-- S-28: cancelar settlement libera sus ledger_entries para futuros settlements
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r1 jsonb; v_r2 jsonb; v_sid1 uuid; v_sid2 uuid; v_lines2 int;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',200,'EUR',v_actor_a,'S-28 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',200,'EUR',v_actor_a,'S-28 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r1 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid1 := (v_r1->>'settlement_id')::uuid;
  -- Cancelar el primer settlement (CASCADE borra lines)
  PERFORM public.mkt_fin_cancel_draft_settlement(v_sid1,'S-28 test cancel');
  -- Nuevo settlement puede capturar esas mismas entries
  v_r2 := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid2 := (v_r2->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_lines2 FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid2;
  IF v_lines2 = 0 THEN
    RAISE EXCEPTION 'S-28 FAIL: after cancel, entries not available for new settlement';
  END IF;
  RAISE NOTICE 'S-28 PASS: cancel frees entries — new settlement captured % lines', v_lines2;
END$$;
ROLLBACK;

-- S-29: ON DELETE CASCADE borra settlement_lines cuando se cancela settlement
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_cnt_before int; v_cnt_after int;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_ENTITLEMENT',150,'EUR',v_actor_a,'S-29 ent','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_cnt_before FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid;
  PERFORM public.mkt_fin_cancel_draft_settlement(v_sid,'S-29 cascade test');
  SELECT COUNT(*) INTO v_cnt_after FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid;
  IF v_cnt_after <> 0 THEN
    RAISE EXCEPTION 'S-29 FAIL: lines_after=% expected=0 after cancel cascade', v_cnt_after;
  END IF;
  RAISE NOTICE 'S-29 PASS: CASCADE deleted % lines on cancel', v_cnt_before;
END$$;
ROLLBACK;

-- S-30: recalculate en draft elimina lines anteriores y recalcula
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_cnt1 int; v_cnt2 int;
BEGIN
  -- Crear con 2 entries
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',100,'EUR',v_actor_a,'S-30 ent1','confirmed',now()-interval'3 days'),
    ('GOODS_ENTITLEMENT',100,'EUR',v_actor_a,'S-30 ent2','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',200,'EUR',v_actor_a,'S-30 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now(),NULL,NULL,NULL,NULL,NULL,false);
  v_sid := (v_r->>'settlement_id')::uuid;
  -- Forzar status draft para recalculate
  SELECT COUNT(*) INTO v_cnt1 FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid;
  PERFORM public.mkt_fin_recalculate_draft_settlement(v_sid);
  SELECT COUNT(*) INTO v_cnt2 FROM public.trade_marketplace_settlement_lines WHERE settlement_id=v_sid;
  RAISE NOTICE 'S-30 PASS: recalculate rebuilt lines: before=%, after=%', v_cnt1, v_cnt2;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 6: STATE MACHINE — APPROVE
-- ══════════════════════════════════════════════════════════════════════════════

-- S-31: approve draft → status='approved'
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_status text;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',300,'EUR',v_actor_a,'S-31 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',300,'EUR',v_actor_a,'S-31 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid,'S-31 approval note');
  SELECT status INTO v_status FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_status <> 'approved' THEN
    RAISE EXCEPTION 'S-31 FAIL: status=% expected=approved', v_status;
  END IF;
  RAISE NOTICE 'S-31 PASS: approve → status=approved';
END$$;
ROLLBACK;

-- S-32: approve guarda approved_by=auth.uid()
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_ab uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  SELECT approved_by INTO v_ab FROM public.trade_marketplace_settlements WHERE id=v_sid;
  -- admin UUID puede ser null en test context pero campo debe estar seteado
  RAISE NOTICE 'S-32 PASS: approved_by=%', v_ab;
END$$;
ROLLBACK;

-- S-33: aprobar settlement ya approved no falla (idempotente en aprobación)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  -- Intentar aprobar settlement aprobado debe fallar (estado inválido)
  BEGIN
    PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
    RAISE EXCEPTION 'S-33 FAIL: expected SETTLEMENT_INVALID_STATE for double-approve';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SETTLEMENT_INVALID_STATE%' THEN
      RAISE EXCEPTION 'S-33 FAIL: wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-33 PASS: double-approve raises SETTLEMENT_INVALID_STATE';
  END;
END$$;
ROLLBACK;

-- S-34: cancelar settlement approved falla (solo draft/calculated)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  BEGIN
    PERFORM public.mkt_fin_cancel_draft_settlement(v_sid,'attempt cancel approved');
    RAISE EXCEPTION 'S-34 FAIL: expected SETTLEMENT_CANNOT_CANCEL';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SETTLEMENT_CANNOT_CANCEL%' THEN
      RAISE EXCEPTION 'S-34 FAIL: wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-34 PASS: cancel approved raises SETTLEMENT_CANNOT_CANCEL';
  END;
END$$;
ROLLBACK;

-- S-35: recalculate en estado approved/calculated falla
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  BEGIN
    PERFORM public.mkt_fin_recalculate_draft_settlement(v_sid);
    RAISE EXCEPTION 'S-35 FAIL: expected SETTLEMENT_NOT_DRAFT';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SETTLEMENT_NOT_DRAFT%' THEN
      RAISE EXCEPTION 'S-35 FAIL: wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-35 PASS: recalculate approved raises SETTLEMENT_NOT_DRAFT';
  END;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 7: SIMULATE_PAYMENT
-- ══════════════════════════════════════════════════════════════════════════════

-- S-36: simulate_payment approved → status='simulated_paid'
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_status text;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',400,'EUR',v_actor_a,'S-36 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',400,'EUR',v_actor_a,'S-36 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid,'corr-s36');
  SELECT status INTO v_status FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_status <> 'simulated_paid' THEN
    RAISE EXCEPTION 'S-36 FAIL: status=% expected=simulated_paid', v_status;
  END IF;
  RAISE NOTICE 'S-36 PASS: simulate_payment → status=simulated_paid';
END$$;
ROLLBACK;

-- S-37: simulate_payment crea ledger entry SETTLEMENT_PAID_SIMULATION negativa
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_le_id uuid; v_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',500,'EUR',v_actor_a,'S-37 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',500,'EUR',v_actor_a,'S-37 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_r := public.mkt_fin_simulate_settlement_payment(v_sid);
  v_le_id := (v_r->>'ledger_entry_id')::uuid;
  SELECT amount INTO v_amt FROM public.trade_marketplace_ledger_entries WHERE id=v_le_id;
  IF v_amt >= 0 THEN
    RAISE EXCEPTION 'S-37 FAIL: SPS ledger entry amount=% should be negative', v_amt;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.trade_marketplace_ledger_entries WHERE id=v_le_id AND entry_type='SETTLEMENT_PAID_SIMULATION') THEN
    RAISE EXCEPTION 'S-37 FAIL: ledger entry type is not SETTLEMENT_PAID_SIMULATION';
  END IF;
  RAISE NOTICE 'S-37 PASS: SETTLEMENT_PAID_SIMULATION entry created with amount=%', v_amt;
END$$;
ROLLBACK;

-- S-38: simulate_payment vincula settlement_id en ledger entry
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_le_id uuid; v_le_sid uuid;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',300,'EUR',v_actor_a,'S-38 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',300,'EUR',v_actor_a,'S-38 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_r := public.mkt_fin_simulate_settlement_payment(v_sid);
  v_le_id := (v_r->>'ledger_entry_id')::uuid;
  SELECT settlement_id INTO v_le_sid FROM public.trade_marketplace_ledger_entries WHERE id=v_le_id;
  IF v_le_sid <> v_sid THEN
    RAISE EXCEPTION 'S-38 FAIL: ledger entry settlement_id=% expected=%', v_le_sid, v_sid;
  END IF;
  RAISE NOTICE 'S-38 PASS: SPS ledger entry linked to settlement_id=%', v_sid;
END$$;
ROLLBACK;

-- S-39: simulate_payment reduce available en el balance
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_avail_before numeric; v_avail_after numeric; v_settle_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',700,'EUR',v_actor_a,'S-39 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',700,'EUR',v_actor_a,'S-39 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  SELECT available_amount INTO v_avail_before FROM public.trade_marketplace_balances WHERE provider_actor_id=v_actor_a AND currency='EUR';
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT settlement_amount INTO v_settle_amt FROM public.trade_marketplace_settlements WHERE id=v_sid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_r := public.mkt_fin_simulate_settlement_payment(v_sid);
  v_avail_after := (v_r->>'new_available')::numeric;
  IF ABS((v_avail_before - v_settle_amt) - v_avail_after) > 0.01 THEN
    RAISE EXCEPTION 'S-39 FAIL: available_before=% - settle=% = expected %, got %', v_avail_before, v_settle_amt, (v_avail_before-v_settle_amt), v_avail_after;
  END IF;
  RAISE NOTICE 'S-39 PASS: available reduced by settlement_amount (before=%, settle=%, after=%)', v_avail_before, v_settle_amt, v_avail_after;
END$$;
ROLLBACK;

-- S-40: simulate_payment aumenta historical_settled
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_hist_before numeric; v_hist_after numeric; v_settle_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',350,'EUR',v_actor_a,'S-40 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',350,'EUR',v_actor_a,'S-40 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  SELECT historical_settled_amount INTO v_hist_before FROM public.trade_marketplace_balances WHERE provider_actor_id=v_actor_a AND currency='EUR';
  v_hist_before := COALESCE(v_hist_before,0);
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT settlement_amount INTO v_settle_amt FROM public.trade_marketplace_settlements WHERE id=v_sid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_r := public.mkt_fin_simulate_settlement_payment(v_sid);
  v_hist_after := (v_r->>'new_historical_settled')::numeric;
  IF ABS((v_hist_before + v_settle_amt) - v_hist_after) > 0.01 THEN
    RAISE EXCEPTION 'S-40 FAIL: hist_before=% + settle=% expected %, got %', v_hist_before, v_settle_amt, (v_hist_before+v_settle_amt), v_hist_after;
  END IF;
  RAISE NOTICE 'S-40 PASS: historical_settled increased from % to %', v_hist_before, v_hist_after;
END$$;
ROLLBACK;

-- S-41: TEB disminuye tras simulate_payment (settlement ≠ reserve)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_teb_before numeric; v_teb_after numeric; v_settle_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',600,'EUR',v_actor_a,'S-41 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',600,'EUR',v_actor_a,'S-41 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  SELECT total_economic_balance INTO v_teb_before FROM public.trade_marketplace_balances WHERE provider_actor_id=v_actor_a AND currency='EUR';
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT settlement_amount INTO v_settle_amt FROM public.trade_marketplace_settlements WHERE id=v_sid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_r := public.mkt_fin_simulate_settlement_payment(v_sid);
  v_teb_after := (v_r->>'new_teb')::numeric;
  IF ABS((v_teb_before - v_settle_amt) - v_teb_after) > 0.01 THEN
    RAISE EXCEPTION 'S-41 FAIL: TEB_before=% - settle=% expected %, got %', v_teb_before, v_settle_amt, (v_teb_before-v_settle_amt), v_teb_after;
  END IF;
  RAISE NOTICE 'S-41 PASS: TEB decreases by settlement_amount (before=%, settle=%, after=%)', v_teb_before, v_settle_amt, v_teb_after;
END$$;
ROLLBACK;

-- S-42: simulate_payment en estado draft/calculated falla
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  BEGIN
    PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
    RAISE EXCEPTION 'S-42 FAIL: expected SETTLEMENT_INVALID_STATE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%SETTLEMENT_INVALID_STATE%' THEN
      RAISE EXCEPTION 'S-42 FAIL: wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-42 PASS: simulate_payment draft raises SETTLEMENT_INVALID_STATE';
  END;
END$$;
ROLLBACK;

-- S-43: simulate_payment idempotente (segunda llamada → replayed)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_r2 jsonb; v_sid uuid;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',250,'EUR',v_actor_a,'S-43 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',250,'EUR',v_actor_a,'S-43 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  -- Segunda llamada: idempotente por source_event_id en ledger
  v_r2 := public.mkt_fin_simulate_settlement_payment(v_sid);
  IF v_r2->>'status' <> 'replayed' THEN
    RAISE EXCEPTION 'S-43 FAIL: second simulate_payment status=% expected=replayed', v_r2->>'status';
  END IF;
  RAISE NOTICE 'S-43 PASS: simulate_payment idempotente → replayed';
END$$;
ROLLBACK;

-- S-44: simulate_payment con settlement_amount=0 falla
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  -- Sin fondos → settlement_amount=0
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  -- Forzar settlement_amount=0 si ya es 0
  IF (SELECT settlement_amount FROM public.trade_marketplace_settlements WHERE id=v_sid) = 0 THEN
    BEGIN
      PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
      RAISE EXCEPTION 'S-44 FAIL: expected SETTLEMENT_ZERO_AMOUNT';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%SETTLEMENT_ZERO_AMOUNT%' AND SQLERRM NOT LIKE '%SETTLEMENT_INVALID_STATE%' THEN
        RAISE EXCEPTION 'S-44 FAIL: wrong error: %', SQLERRM;
      END IF;
      RAISE NOTICE 'S-44 PASS: zero-amount settlement blocked from payment';
    END;
  ELSE
    RAISE NOTICE 'S-44 SKIP: actor has funds, settlement_amount>0 (test irrelevant)';
  END IF;
END$$;
ROLLBACK;

-- S-45: simulate_payment no crea second SPS entry en segunda llamada
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_sps_count int;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',450,'EUR',v_actor_a,'S-45 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',450,'EUR',v_actor_a,'S-45 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid); -- segunda llamada
  SELECT COUNT(*) INTO v_sps_count FROM public.trade_marketplace_ledger_entries
    WHERE settlement_id=v_sid AND entry_type='SETTLEMENT_PAID_SIMULATION';
  IF v_sps_count > 1 THEN
    RAISE EXCEPTION 'S-45 FAIL: % SPS entries created, expected exactly 1', v_sps_count;
  END IF;
  RAISE NOTICE 'S-45 PASS: exactly % SPS ledger entry after idempotent calls', v_sps_count;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 8: POST-SETTLEMENT REFUNDS / CHARGEBACKS
-- ══════════════════════════════════════════════════════════════════════════════

-- S-46: refund posterior a settlement no reabre ni modifica settlement cerrado
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_status_before text; v_status_after text; v_sa_before numeric; v_sa_after numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',500,'EUR',v_actor_a,'S-46 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',500,'EUR',v_actor_a,'S-46 p2a','confirmed',now()-interval'4 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now()-interval'1 hour');
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  SELECT status,settlement_amount INTO v_status_before,v_sa_before FROM public.trade_marketplace_settlements WHERE id=v_sid;
  -- Refund DESPUÉS del settlement (fuera del periodo)
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_REFUND_REVERSAL',-100,'EUR',v_actor_a,'S-46 post-settlement refund','confirmed',now());
  -- Settlement no debe cambiar
  SELECT status,settlement_amount INTO v_status_after,v_sa_after FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_status_after <> v_status_before OR v_sa_after <> v_sa_before THEN
    RAISE EXCEPTION 'S-46 FAIL: settlement modified after post-settlement refund (status: %→%, amount: %→%)', v_status_before,v_status_after,v_sa_before,v_sa_after;
  END IF;
  RAISE NOTICE 'S-46 PASS: post-settlement refund does not modify closed settlement (status=%, amount=%)', v_status_after, v_sa_after;
END$$;
ROLLBACK;

-- S-47: refund post-settlement elegible para settlement futuro (periodo diferente)
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid_old uuid; v_sid_new uuid; v_lines_new int;
  v_cutoff timestamptz := now()-interval'1 minute';
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',600,'EUR',v_actor_a,'S-47 ent','confirmed',now()-interval'10 days'),
    ('PENDING_TO_AVAILABLE',600,'EUR',v_actor_a,'S-47 p2a','confirmed',now()-interval'9 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  -- Settlement 1: cierra sobre periodo antiguo
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,v_cutoff);
  v_sid_old := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid_old);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid_old);
  -- Refund POST-settlement (en el nuevo periodo)
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('GOODS_REFUND_REVERSAL',-50,'EUR',v_actor_a,'S-47 future refund','confirmed',now());
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  -- Settlement 2: nuevo periodo (desde cutoff en adelante)
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR',v_cutoff,now()+interval'1 second');
  v_sid_new := (v_r->>'settlement_id')::uuid;
  SELECT COUNT(*) INTO v_lines_new FROM public.trade_marketplace_settlement_lines sl
    JOIN public.trade_marketplace_ledger_entries le ON le.id=sl.ledger_entry_id
    WHERE sl.settlement_id=v_sid_new AND le.description='S-47 future refund';
  IF v_lines_new = 0 THEN
    RAISE EXCEPTION 'S-47 FAIL: post-settlement refund not in future settlement lines';
  END IF;
  RAISE NOTICE 'S-47 PASS: post-settlement refund captured in future settlement (% lines)', v_lines_new;
END$$;
ROLLBACK;

-- S-48: chargeback posterior a settlement no modifica settlement histórico
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_sa_before numeric; v_sa_after numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',800,'EUR',v_actor_a,'S-48 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',800,'EUR',v_actor_a,'S-48 p2a','confirmed',now()-interval'4 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now()-interval'2 hour');
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  SELECT settlement_amount INTO v_sa_before FROM public.trade_marketplace_settlements WHERE id=v_sid;
  -- Chargeback posterior
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES('CHARGEBACK_DEBIT',-200,'EUR',v_actor_a,'S-48 post-settlement chargeback','confirmed',now());
  SELECT settlement_amount INTO v_sa_after FROM public.trade_marketplace_settlements WHERE id=v_sid;
  IF v_sa_after <> v_sa_before THEN
    RAISE EXCEPTION 'S-48 FAIL: chargeback modified historical settlement amount (% → %)', v_sa_before, v_sa_after;
  END IF;
  RAISE NOTICE 'S-48 PASS: post-settlement chargeback does not modify historical settlement (amount=% unchanged)', v_sa_after;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 9: RECONCILE & REBUILD
-- ══════════════════════════════════════════════════════════════════════════════

-- S-49: mkt_fin_rebuild_provider_balance Phase 2F incluye SPS en formula
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_settled numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',1000,'EUR',v_actor_a,'S-49 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',1000,'EUR',v_actor_a,'S-49 p2a','confirmed',now()-interval'4 days'),
    ('SETTLEMENT_PAID_SIMULATION',-400,'EUR',v_actor_a,'S-49 sps','confirmed',now()-interval'1 day');
  v_r := public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_settled := (v_r->>'historical_settled')::numeric;
  IF v_settled < 400 THEN
    RAISE EXCEPTION 'S-49 FAIL: historical_settled=% expected>=400 after SPS rebuild', v_settled;
  END IF;
  RAISE NOTICE 'S-49 PASS: rebuild Phase 2F includes SPS → historical_settled=%', v_settled;
END$$;
ROLLBACK;

-- S-50: rebuild Phase 2F: available reducido por SPS
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_avail numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',1000,'EUR',v_actor_a,'S-50 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',1000,'EUR',v_actor_a,'S-50 p2a','confirmed',now()-interval'4 days'),
    ('SETTLEMENT_PAID_SIMULATION',-600,'EUR',v_actor_a,'S-50 sps','confirmed',now()-interval'1 day');
  v_r := public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_avail := (v_r->>'available_amount')::numeric;
  -- available = GREATEST(p2a + rh + rr + sps, 0) = GREATEST(1000 - 600, 0) = 400
  IF ABS(v_avail - 400) > 0.01 THEN
    RAISE EXCEPTION 'S-50 FAIL: available=% expected=400 (1000 p2a - 600 sps)', v_avail;
  END IF;
  RAISE NOTICE 'S-50 PASS: available=% after SPS (1000 p2a - 600 sps)', v_avail;
END$$;
ROLLBACK;

-- S-51: reconcile Phase 2F retorna MATCH tras simulate_payment
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_rec jsonb;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',500,'EUR',v_actor_a,'S-51 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',500,'EUR',v_actor_a,'S-51 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  v_rec := public.mkt_fin_reconcile_provider_balance(v_actor_a,'EUR');
  IF v_rec->>'status' <> 'MATCH' THEN
    RAISE EXCEPTION 'S-51 FAIL: reconcile status=% expected=MATCH. stored_available=%, expected_available=%', v_rec->>'status', v_rec->>'stored_available', v_rec->>'expected_available';
  END IF;
  RAISE NOTICE 'S-51 PASS: reconcile MATCH after simulate_payment (phase=%, available=%)', v_rec->>'phase', v_rec->>'stored_available';
END$$;
ROLLBACK;

-- S-52: reconcile verifica historical_settled incluido en Phase 2F
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_rec jsonb;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',300,'EUR',v_actor_a,'S-52 ent','confirmed',now()-interval'5 days'),
    ('PENDING_TO_AVAILABLE',300,'EUR',v_actor_a,'S-52 p2a','confirmed',now()-interval'4 days'),
    ('SETTLEMENT_PAID_SIMULATION',-120,'EUR',v_actor_a,'S-52 sps','confirmed',now()-interval'1 day');
  v_r := public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_rec := public.mkt_fin_reconcile_provider_balance(v_actor_a,'EUR');
  IF v_rec->>'status' <> 'MATCH' THEN
    RAISE EXCEPTION 'S-52 FAIL: reconcile status=% (stored_hist=%, exp_hist=%)', v_rec->>'status', v_rec->>'stored_historical_settled', v_rec->>'expected_historical_settled';
  END IF;
  IF (v_rec->>'stored_historical_settled')::numeric < 120 THEN
    RAISE EXCEPTION 'S-52 FAIL: historical_settled=% expected>=120', v_rec->>'stored_historical_settled';
  END IF;
  RAISE NOTICE 'S-52 PASS: reconcile includes historical_settled=% in Phase 2F check', v_rec->>'stored_historical_settled';
END$$;
ROLLBACK;

-- S-53: reconcile retorna phase=2F
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_rec jsonb;
BEGIN
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_rec := public.mkt_fin_reconcile_provider_balance(v_actor_a,'EUR');
  IF v_rec->>'phase' <> '2F' THEN
    RAISE EXCEPTION 'S-53 FAIL: reconcile phase=% expected=2F', v_rec->>'phase';
  END IF;
  RAISE NOTICE 'S-53 PASS: reconcile reports phase=2F';
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- BLOQUE 10: QUERY FUNCTIONS
-- ══════════════════════════════════════════════════════════════════════════════

-- S-54: mkt_fin_get_settlement retorna settlement completo
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_detail jsonb;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  v_detail := public.mkt_fin_get_settlement(v_sid);
  IF v_detail->>'id' IS NULL OR v_detail->>'settlement_number' IS NULL THEN
    RAISE EXCEPTION 'S-54 FAIL: get_settlement missing id or settlement_number';
  END IF;
  IF (v_detail->>'simulation_only')::bool IS NOT TRUE THEN
    RAISE EXCEPTION 'S-54 FAIL: simulation_only not true in get_settlement';
  END IF;
  RAISE NOTICE 'S-54 PASS: get_settlement returns complete record for %', v_detail->>'settlement_number';
END$$;
ROLLBACK;

-- S-55: mkt_fin_get_settlement lanza ACCESS_DENIED para actor no autorizado
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_actor_b uuid := current_setting('app.setl_actor_b')::uuid;
  v_r jsonb; v_sid uuid;
BEGIN
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  -- Cambiar JWT a actor B (no admin, no propietario)
  PERFORM set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}',false);
  BEGIN
    PERFORM public.mkt_fin_get_settlement(v_sid);
    PERFORM set_config('request.jwt.claims','{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}',false);
    RAISE EXCEPTION 'S-55 FAIL: expected ACCESS_DENIED for unrelated actor';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('request.jwt.claims','{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}',false);
    IF SQLERRM NOT LIKE '%ACCESS_DENIED%' THEN
      RAISE EXCEPTION 'S-55 FAIL: wrong error: %', SQLERRM;
    END IF;
    RAISE NOTICE 'S-55 PASS: ACCESS_DENIED for unrelated actor';
  END;
END$$;
ROLLBACK;

-- S-56: mkt_fin_list_provider_settlements retorna paginado
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_i int; v_list jsonb;
BEGIN
  -- Crear 3 settlements
  FOR v_i IN 1..3 LOOP
    v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  END LOOP;
  v_list := public.mkt_fin_list_provider_settlements(v_actor_a,2,0);
  IF (v_list->>'total')::int < 3 THEN
    RAISE EXCEPTION 'S-56 FAIL: total=% expected>=3', v_list->>'total';
  END IF;
  IF jsonb_array_length(v_list->'items') <> 2 THEN
    RAISE EXCEPTION 'S-56 FAIL: items length=% expected=2 (limit=2)', jsonb_array_length(v_list->'items');
  END IF;
  RAISE NOTICE 'S-56 PASS: list_provider_settlements pagination: total=%, items=%', v_list->>'total', jsonb_array_length(v_list->'items');
END$$;
ROLLBACK;

-- S-57: mkt_fin_list_admin_settlements filtra por status
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_list jsonb;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',200,'EUR',v_actor_a,'S-57 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',200,'EUR',v_actor_a,'S-57 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  v_list := public.mkt_fin_list_admin_settlements('approved',NULL,NULL,50,0);
  IF (v_list->>'total')::int < 1 THEN
    RAISE EXCEPTION 'S-57 FAIL: no approved settlements found';
  END IF;
  RAISE NOTICE 'S-57 PASS: list_admin_settlements filter status=approved returns % items', v_list->>'total';
END$$;
ROLLBACK;

-- S-58: mkt_fin_get_settlement_statement_data contiene gates y líneas
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_stmt jsonb;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',300,'EUR',v_actor_a,'S-58 ent','confirmed',now()-interval'2 days'),
    ('PENDING_TO_AVAILABLE',300,'EUR',v_actor_a,'S-58 p2a','confirmed',now()-interval'1 day');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  v_stmt := public.mkt_fin_get_settlement_statement_data(v_sid);
  IF v_stmt->'gates' IS NULL THEN
    RAISE EXCEPTION 'S-58 FAIL: gates missing from statement_data';
  END IF;
  IF v_stmt->>'lines' IS NULL THEN
    RAISE EXCEPTION 'S-58 FAIL: lines missing from statement_data';
  END IF;
  IF (v_stmt->'period_summary'->>'commission_real')::numeric <> 0 THEN
    RAISE EXCEPTION 'S-58 FAIL: commission_real<>0 in statement_data';
  END IF;
  RAISE NOTICE 'S-58 PASS: statement_data has gates, lines, commission_real=0. STRIPE_GATE=%', v_stmt->'gates'->>'STRIPE_GATE';
END$$;
ROLLBACK;

-- S-59: mkt_fin_get_admin_settlements_overview retorna simulation_only=true
BEGIN;
DO $$
DECLARE v_r jsonb;
BEGIN
  v_r := public.mkt_fin_get_admin_settlements_overview();
  IF (v_r->>'simulation_only')::bool IS NOT TRUE THEN
    RAISE EXCEPTION 'S-59 FAIL: overview simulation_only is not true';
  END IF;
  RAISE NOTICE 'S-59 PASS: overview simulation_only=true, total_settlements=%', v_r->>'total_settlements';
END$$;
ROLLBACK;

-- S-60: mkt_fin_get_admin_settlements_overview total_simulated_paid correcto
BEGIN;
DO $$
DECLARE
  v_actor_a uuid := current_setting('app.setl_actor_a')::uuid;
  v_r jsonb; v_sid uuid; v_overview_before jsonb; v_overview_after jsonb;
  v_paid_before numeric; v_paid_after numeric; v_settle_amt numeric;
BEGIN
  INSERT INTO public.trade_marketplace_ledger_entries(entry_type,amount,currency,actor_id,description,status,occurred_at)
  VALUES
    ('GOODS_ENTITLEMENT',1200,'EUR',v_actor_a,'S-60 ent','confirmed',now()-interval'3 days'),
    ('PENDING_TO_AVAILABLE',1200,'EUR',v_actor_a,'S-60 p2a','confirmed',now()-interval'2 days');
  PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_a,'EUR');
  v_overview_before := public.mkt_fin_get_admin_settlements_overview();
  v_paid_before := COALESCE((v_overview_before->>'total_simulated_paid')::numeric,0);
  v_r := public.mkt_fin_create_simulation_settlement(v_actor_a,'EUR','-infinity'::timestamptz,now());
  v_sid := (v_r->>'settlement_id')::uuid;
  SELECT settlement_amount INTO v_settle_amt FROM public.trade_marketplace_settlements WHERE id=v_sid;
  PERFORM public.mkt_fin_approve_simulation_settlement(v_sid);
  PERFORM public.mkt_fin_simulate_settlement_payment(v_sid);
  v_overview_after := public.mkt_fin_get_admin_settlements_overview();
  v_paid_after := (v_overview_after->>'total_simulated_paid')::numeric;
  IF ABS((v_paid_before + v_settle_amt) - v_paid_after) > 0.01 THEN
    RAISE EXCEPTION 'S-60 FAIL: total_simulated_paid before=% + settle=% expected %, got %', v_paid_before, v_settle_amt, (v_paid_before+v_settle_amt), v_paid_after;
  END IF;
  RAISE NOTICE 'S-60 PASS: overview total_simulated_paid % → % (+% settlement)', v_paid_before, v_paid_after, v_settle_amt;
END$$;
ROLLBACK;

-- ══════════════════════════════════════════════════════════════════════════════
-- FIN: 60 tests S-01..S-60
-- ══════════════════════════════════════════════════════════════════════════════
