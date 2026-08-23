-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-2B · Tests de Refunds R-01..R-35
-- Sin pgTAP: usa tabla temporal _test_results con PASS/FAIL
-- ════════════════════════════════════════════════════════════════════════════
--
-- Datos reales:
--   de813d33 — Obras MKP-0004: goods=0.70, ship=8.50, total=9.20  → full_order
--   7afbb6e6 — Obras MKP-0003: goods=1.75, ship=8.50, total=10.25 → partial_qty+ship
--   15f6f9e6 — Suministros MKP-0003: goods=1.70, ship=0.00        → full_item
--   089b850a — TrabFlow MKP-0003: goods=3.36, ship=0.00           → mixed
--   b829eaf4 — Obras MKP-0002: goods=1.75, ship=8.50              → preview+error
--
-- Items:
--   28686cea: Ladrillo (7afbb6e6) 5u × 0.35 gross, unit_net=0.2893
--   ddb0dbf6: Caja mecanismo (15f6f9e6) 2u × 0.85 gross
--   e7bc1f80: Teja plana (089b850a) 3u × 1.12 gross
--
-- Platform admin: cf1000d3-80bc-4bdd-a9df-b8a0f0462c77
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

SET LOCAL role = 'authenticated';
SET LOCAL "request.jwt.claims" = '{"sub":"cf1000d3-80bc-4bdd-a9df-b8a0f0462c77","role":"authenticated"}';

-- Framework de tests
CREATE TEMP TABLE _test_results (
  test_id text PRIMARY KEY,
  description text,
  passed bool,
  detail text
);

-- Estado compartido entre tests
CREATE TEMP TABLE _r_state (k text PRIMARY KEY, v text);

-- ════════════════════════════════════════════════════════════════════════════
-- SCHEMA (R-01..R-05)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _test_results VALUES (
  'R-01', 'trade_marketplace_refunds table exists',
  EXISTS (SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='trade_marketplace_refunds'),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-02', 'trade_marketplace_refund_items table exists',
  EXISTS (SELECT 1 FROM information_schema.tables
           WHERE table_schema='public' AND table_name='trade_marketplace_refund_items'),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-03', 'refund_status column default = not_refunded on supplier orders',
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trade_marketplace_orders'
      AND column_name='refund_status') = '''not_refunded''::text',
  (SELECT column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='trade_marketplace_orders'
      AND column_name='refund_status')
);

INSERT INTO _test_results VALUES (
  'R-04', 'refund_aggregate_status column exists on master orders',
  EXISTS (SELECT 1 FROM information_schema.columns
           WHERE table_schema='public' AND table_name='trade_marketplace_master_orders'
             AND column_name='refund_aggregate_status'),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-05', 'chk_refund_simulation constraint exists (STRIPE_GATE)',
  EXISTS (SELECT 1 FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname='public' AND t.relname='trade_marketplace_refunds'
            AND c.conname='chk_refund_simulation' AND c.contype='c'),
  NULL
);

-- ════════════════════════════════════════════════════════════════════════════
-- GET_REFUNDABLE_SUMMARY (R-06..R-10)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _test_results VALUES (
  'R-06', 'get_refundable_summary original_goods_gross = 1.75 (b829eaf4)',
  (SELECT (public.mkt_fin_get_refundable_summary('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid)
    ->>'original_goods_gross')::numeric = 1.75),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-07', 'remaining_total_refundable = 10.25 (sin refunds previos)',
  (SELECT (public.mkt_fin_get_refundable_summary('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid)
    ->>'remaining_total_refundable')::numeric = 10.25),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-08', 'get_refundable_summary items array tiene elementos',
  (SELECT jsonb_array_length(public.mkt_fin_get_refundable_summary(
    'b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid)->'items') >= 1),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-09', 'original_shipping_gross = 8.50 (b829eaf4)',
  (SELECT (public.mkt_fin_get_refundable_summary('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid)
    ->>'original_shipping_gross')::numeric = 8.50),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-10', 'refund_status = not_refunded en pedido sin devoluciones',
  (SELECT public.mkt_fin_get_refundable_summary('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid)
    ->>'refund_status') = 'not_refunded',
  NULL
);

-- ════════════════════════════════════════════════════════════════════════════
-- PREVIEW_REFUND (R-11..R-13)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _test_results VALUES (
  'R-11', 'preview full_order total_refund_gross = 10.25',
  (SELECT (public.mkt_fin_preview_refund('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,'full_order')
    ->'preview'->>'total_refund_gross')::numeric = 10.25),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-12', 'preview shipping_only shipping_gross = 8.50',
  (SELECT (public.mkt_fin_preview_refund('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
    'shipping_only','[]',8.50,0)->'preview'->>'shipping_gross')::numeric = 8.50),
  NULL
);

INSERT INTO _test_results
SELECT 'R-13', 'preview partial_amount: gross = net + tax (consistencia fiscal)',
  ABS(
    (pr->'preview'->>'items_gross')::numeric -
    (pr->'preview'->>'items_net')::numeric -
    (pr->'preview'->>'items_tax')::numeric
  ) < 0.0001,
  NULL
FROM (SELECT public.mkt_fin_preview_refund('b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
  'partial_amount','[]',0,1.00)) x(pr);

-- ════════════════════════════════════════════════════════════════════════════
-- CREATE_REFUND — FULL_ORDER (R-14..R-22)
-- ════════════════════════════════════════════════════════════════════════════

-- Crear full_order en de813d33 (goods=0.70, ship=8.50, total=9.20)
INSERT INTO _r_state (k, v)
SELECT 'full_order', public.mkt_fin_create_refund(
  'de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid,
  'full_order', 'Test R-14..R-22 full_order',
  '[]', 0, 0, 'idem-R14-full-order', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-14', 'create_refund full_order returns status=created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='full_order') = 'created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='full_order')
);

INSERT INTO _test_results VALUES (
  'R-15', 'refund_number matches RF-YYYY-NNNN pattern',
  (SELECT (v::jsonb)->>'refund_number' FROM _r_state WHERE k='full_order')
    ~ '^RF-[0-9]{4}-[0-9]{4}$',
  (SELECT (v::jsonb)->>'refund_number' FROM _r_state WHERE k='full_order')
);

INSERT INTO _test_results VALUES (
  'R-16', 'full_order total_refund_gross = 9.20 (goods 0.70 + ship 8.50)',
  (SELECT ((v::jsonb)->>'total_refund_gross')::numeric FROM _r_state WHERE k='full_order') = 9.20,
  (SELECT (v::jsonb)->>'total_refund_gross' FROM _r_state WHERE k='full_order')
);

INSERT INTO _test_results VALUES (
  'R-17', 'refund entity persisted with status=processed simulation_only=true',
  EXISTS (SELECT 1 FROM public.trade_marketplace_refunds
           WHERE id = (SELECT ((v::jsonb)->>'refund_id')::uuid FROM _r_state WHERE k='full_order')
             AND status = 'processed' AND simulation_only = true),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-18', 'full_order refund_items count = 2 (1 goods + 1 shipping)',
  (SELECT COUNT(*) FROM public.trade_marketplace_refund_items
    WHERE refund_id = (SELECT ((v::jsonb)->>'refund_id')::uuid FROM _r_state WHERE k='full_order'))
  = 2,
  NULL
);

INSERT INTO _test_results VALUES (
  'R-19', 'GOODS_REFUND_REVERSAL ledger entry with negative amount',
  EXISTS (SELECT 1 FROM public.trade_marketplace_ledger_entries
           WHERE entry_type = 'GOODS_REFUND_REVERSAL'
             AND supplier_order_id = 'de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid
             AND amount < 0 AND status = 'confirmed'),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-20', 'SHIPPING_REFUND_REVERSAL ledger entry with negative amount',
  EXISTS (SELECT 1 FROM public.trade_marketplace_ledger_entries
           WHERE entry_type = 'SHIPPING_REFUND_REVERSAL'
             AND supplier_order_id = 'de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid
             AND amount < 0 AND status = 'confirmed'),
  NULL
);

INSERT INTO _test_results VALUES (
  'R-21', 'supplier order refund_status = fully_refunded (via summary — SECURITY DEFINER)',
  (public.mkt_fin_get_refundable_summary('de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid)
    ->>'refund_status') = 'fully_refunded',
  public.mkt_fin_get_refundable_summary('de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid)
    ->>'refund_status'
);

INSERT INTO _test_results VALUES (
  'R-22', 'remaining_total_refundable = 0 tras full_order (proxy master update)',
  (public.mkt_fin_get_refundable_summary('de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid)
    ->>'remaining_total_refundable')::numeric = 0,
  public.mkt_fin_get_refundable_summary('de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid)
    ->>'remaining_total_refundable'
);

-- ════════════════════════════════════════════════════════════════════════════
-- PARTIAL_QUANTITY (R-23..R-25)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _r_state (k, v)
SELECT 'partial_qty', public.mkt_fin_create_refund(
  '7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid,
  'partial_quantity', 'Test R-23..R-25 partial_qty 2/5',
  '[{"order_item_id":"28686cea-a196-46b4-b245-e514ea73506b","quantity_refunded":2}]'::jsonb,
  0, 0, 'idem-R23-partial', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-23', 'partial_quantity 2/5 ladrillo returns status=created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='partial_qty') = 'created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='partial_qty')
);

INSERT INTO _test_results VALUES (
  'R-24', 'partial_quantity items_gross = 0.7000 (2 × 0.35, proporcional — no es ultimo)',
  (SELECT ((v::jsonb)->>'items_gross')::numeric FROM _r_state WHERE k='partial_qty') = 0.7000,
  (SELECT (v::jsonb)->>'items_gross' FROM _r_state WHERE k='partial_qty')
);

INSERT INTO _test_results VALUES (
  'R-25', 'refund_status = partially_refunded tras devolver 2 de 5 unidades (via summary)',
  (public.mkt_fin_get_refundable_summary('7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid)
    ->>'refund_status') = 'partially_refunded',
  public.mkt_fin_get_refundable_summary('7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid)
    ->>'refund_status'
);

-- ════════════════════════════════════════════════════════════════════════════
-- SHIPPING_ONLY (R-26..R-27)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _r_state (k, v)
SELECT 'ship_only', public.mkt_fin_create_refund(
  '7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid,
  'shipping_only', 'Test R-26..R-27 shipping_only',
  '[]', 8.50, 0, 'idem-R26-ship', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-26', 'shipping_only shipping_gross = 8.50',
  (SELECT ((v::jsonb)->>'shipping_gross')::numeric FROM _r_state WHERE k='ship_only') = 8.50,
  (SELECT (v::jsonb)->>'shipping_gross' FROM _r_state WHERE k='ship_only')
);

INSERT INTO _test_results VALUES (
  'R-27', 'refund_status sigue partially_refunded (3 goods restantes, shipping ya devuelto)',
  (public.mkt_fin_get_refundable_summary('7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid)
    ->>'refund_status') = 'partially_refunded',
  public.mkt_fin_get_refundable_summary('7afbb6e6-c7af-408c-a503-f13b443729b7'::uuid)
    ->>'refund_status'
);

-- ════════════════════════════════════════════════════════════════════════════
-- FULL_ITEM (R-28..R-29)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _r_state (k, v)
SELECT 'full_item', public.mkt_fin_create_refund(
  '15f6f9e6-f658-431b-aa3f-f8002bdce8ac'::uuid,
  'full_item', 'Test R-28..R-29 full_item',
  '[{"order_item_id":"ddb0dbf6-07ba-4bcd-a697-eef3b36110f0"}]'::jsonb,
  0, 0, 'idem-R28-fullitem', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-28', 'full_item total_refund_gross = 1.70 (ultimo absorbe remanente exacto)',
  (SELECT ((v::jsonb)->>'total_refund_gross')::numeric FROM _r_state WHERE k='full_item') = 1.70,
  (SELECT (v::jsonb)->>'total_refund_gross' FROM _r_state WHERE k='full_item')
);

INSERT INTO _test_results VALUES (
  'R-29', 'refund_status = fully_refunded tras full_item (2/2 unidades, via summary)',
  (public.mkt_fin_get_refundable_summary('15f6f9e6-f658-431b-aa3f-f8002bdce8ac'::uuid)
    ->>'refund_status') = 'fully_refunded',
  public.mkt_fin_get_refundable_summary('15f6f9e6-f658-431b-aa3f-f8002bdce8ac'::uuid)
    ->>'refund_status'
);

-- ════════════════════════════════════════════════════════════════════════════
-- MIXED (R-30)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _r_state (k, v)
SELECT 'mixed', public.mkt_fin_create_refund(
  '089b850a-ec91-40e8-b0da-97e1d0219785'::uuid,
  'mixed', 'Test R-30 mixed (1 teja sin shipping)',
  '[{"order_item_id":"e7bc1f80-7576-40b0-9404-0edc36d2f6c5","quantity_refunded":1}]'::jsonb,
  0, 0, 'idem-R30-mixed', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-30', 'mixed (1 item, sin shipping ya que ship=0) returns status=created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='mixed') = 'created',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='mixed')
);

-- ════════════════════════════════════════════════════════════════════════════
-- VALIDACIONES Y ERRORES (R-31..R-33)
-- ════════════════════════════════════════════════════════════════════════════

-- R-31: EXCEEDS_REFUNDABLE
DO $$
DECLARE err text := 'NOT_RAISED';
BEGIN
  BEGIN
    PERFORM public.mkt_fin_create_refund(
      'b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
      'partial_amount', 'R31 excess', '[]', 0, 999.00, NULL, NULL
    );
  EXCEPTION WHEN OTHERS THEN err := SQLERRM;
  END;
  INSERT INTO _r_state VALUES ('r31_err', err) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END; $$;

INSERT INTO _test_results VALUES (
  'R-31', 'partial_amount 999 > remaining 1.75 raises EXCEEDS_REFUNDABLE',
  (SELECT v LIKE '%EXCEEDS_REFUNDABLE%' FROM _r_state WHERE k='r31_err'),
  (SELECT v FROM _r_state WHERE k='r31_err')
);

-- R-32: ZERO_REFUND en pedido fully_refunded
DO $$
DECLARE err text := 'NOT_RAISED';
BEGIN
  BEGIN
    PERFORM public.mkt_fin_create_refund(
      'de813d33-f1bd-4b09-b13f-9c2601cff3cc'::uuid,
      'full_order', 'R32 zero', '[]', 0, 0, NULL, NULL
    );
  EXCEPTION WHEN OTHERS THEN err := SQLERRM;
  END;
  INSERT INTO _r_state VALUES ('r32_err', err) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END; $$;

INSERT INTO _test_results VALUES (
  'R-32', 'full_order en pedido fully_refunded (remaining=0) raises ZERO_REFUND',
  (SELECT v LIKE '%ZERO_REFUND%' FROM _r_state WHERE k='r32_err'),
  (SELECT v FROM _r_state WHERE k='r32_err')
);

-- R-33: INVALID_REFUND_TYPE
DO $$
DECLARE err text := 'NOT_RAISED';
BEGIN
  BEGIN
    PERFORM public.mkt_fin_create_refund(
      'b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
      'unknown_type', 'R33 invalid', '[]', 0, 0, NULL, NULL
    );
  EXCEPTION WHEN OTHERS THEN err := SQLERRM;
  END;
  INSERT INTO _r_state VALUES ('r33_err', err) ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END; $$;

INSERT INTO _test_results VALUES (
  'R-33', 'tipo desconocido raises INVALID_REFUND_TYPE',
  (SELECT v LIKE '%INVALID_REFUND_TYPE%' FROM _r_state WHERE k='r33_err'),
  (SELECT v FROM _r_state WHERE k='r33_err')
);

-- ════════════════════════════════════════════════════════════════════════════
-- IDEMPOTENCIA (R-34)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _r_state (k, v)
SELECT 'idem_first', public.mkt_fin_create_refund(
  'b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
  'shipping_only', 'R34 idempotency first call',
  '[]', 5.00, 0, 'idem-R34-unique-key', NULL
)::text;

INSERT INTO _r_state (k, v)
SELECT 'idem_second', public.mkt_fin_create_refund(
  'b829eaf4-b469-4d6a-a39d-2e3225935e72'::uuid,
  'shipping_only', 'R34 idempotency second call (same key)',
  '[]', 5.00, 0, 'idem-R34-unique-key', NULL
)::text;

INSERT INTO _test_results VALUES (
  'R-34', 'segunda llamada con mismo idempotency_key retorna status=replayed',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='idem_second') = 'replayed',
  (SELECT (v::jsonb)->>'status' FROM _r_state WHERE k='idem_second')
);

-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN OVERVIEW (R-35)
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO _test_results VALUES (
  'R-35', 'admin_refunds_overview total_refunds >= 1',
  (SELECT (public.mkt_fin_admin_refunds_overview()->>'total_refunds')::int >= 1),
  (SELECT public.mkt_fin_admin_refunds_overview()->>'total_refunds')
);

-- ════════════════════════════════════════════════════════════════════════════
-- RESULTADOS
-- ════════════════════════════════════════════════════════════════════════════

SELECT
  test_id,
  CASE WHEN passed THEN 'PASS' ELSE 'FAIL' END AS status,
  description,
  CASE WHEN NOT passed THEN COALESCE(detail, 'no detail') ELSE NULL END AS failure_detail
FROM _test_results
ORDER BY test_id;

-- Resumen
SELECT
  COUNT(*) FILTER (WHERE passed) AS passed,
  COUNT(*) FILTER (WHERE NOT passed) AS failed,
  COUNT(*) AS total,
  CASE WHEN COUNT(*) FILTER (WHERE NOT passed) = 0 THEN 'ALL PASS' ELSE 'FAILURES DETECTED' END AS verdict
FROM _test_results;

ROLLBACK;
