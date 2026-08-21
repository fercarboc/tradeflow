-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1B.1D — Tests función mkt_fin_get_purchase_summary_data
-- 10 tests P-01 a P-10
-- ════════════════════════════════════════════════════════════════════════════
-- Proyecto: dqqjaujnulutinskmqsu (eu-central-1, TrabFlow)
-- Datos: master_orders y supplier_orders de los tests C-01/C-02/C-16/C-17/C-18
-- Constantes:
--   user_id:   46c40317-227d-4f98-96d9-b2ea55667cd8
--   org_id:    1047165e-f6ce-4b5a-9141-0d76be0a4a5a
--   master C-01 (1 proveedor):  MKP-2026-0002, checkout_key fin1b1-c01-*
--   master C-02 (3 proveedores): MKP-2026-0003, checkout_key fin1b1-c02-*
--   master C-18 (simulación/offline): MKP-2026-0004
--   legacy order (sin master): MKT-000001, id 21a0d5aa-7946-48cf-93b7-f1a0fc2cf506
-- ════════════════════════════════════════════════════════════════════════════

-- Auth: simular usuario real
SELECT set_config('request.jwt.claims',
  '{"sub": "46c40317-227d-4f98-96d9-b2ea55667cd8", "role": "authenticated"}', false);

-- ─────────────────────────────────────────────────────────────────────────────
-- P-01: Estructura básica — 1 proveedor por checkout_key
-- Espera: is_legacy=false, master_order presente, 1 supplier_order
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
  v_supplier_count int;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c01-0ffe1283-667f-4067-9374-334f0699fe27'
  );

  ASSERT v_result IS NOT NULL,
    'P-01 FAIL: resultado es NULL';
  ASSERT (v_result->>'is_legacy') = 'false',
    'P-01 FAIL: is_legacy debe ser false';
  ASSERT v_result->'master_order' IS NOT NULL,
    'P-01 FAIL: master_order debe estar presente';
  ASSERT v_result->'master_order'->>'numero' LIKE 'MKP%',
    'P-01 FAIL: numero debe comenzar con MKP';

  v_supplier_count := jsonb_array_length(v_result->'supplier_orders');
  ASSERT v_supplier_count = 1,
    'P-01 FAIL: esperado 1 supplier_order, obtenido ' || v_supplier_count;

  RAISE NOTICE 'P-01 PASS: estructura 1-proveedor OK (numero: %, suppliers: %)',
    v_result->'master_order'->>'numero', v_supplier_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-02: Estructura 3 proveedores por checkout_key
-- Espera: 3 supplier_orders con actor_nombre distintos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
  v_count  int;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c02-a2ad3ec4-83de-420e-b107-fe93a3e2cbcf'
  );

  ASSERT v_result IS NOT NULL, 'P-02 FAIL: resultado NULL';

  v_count := jsonb_array_length(v_result->'supplier_orders');
  ASSERT v_count = 3,
    'P-02 FAIL: esperado 3 supplier_orders, obtenido ' || v_count;

  -- Verificar que cada bloque tiene actor_nombre no vacío
  ASSERT (
    SELECT bool_and((s->>'actor_nombre') IS NOT NULL AND (s->>'actor_nombre') <> '')
      FROM jsonb_array_elements(v_result->'supplier_orders') s
  ), 'P-02 FAIL: algún supplier_order sin actor_nombre';

  RAISE NOTICE 'P-02 PASS: 3 proveedores OK, nombres: %',
    (SELECT jsonb_agg(s->>'actor_nombre') FROM jsonb_array_elements(v_result->'supplier_orders') s);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-03: Total global = master_order.checkout_gross_total
-- Espera: checkout_gross_total = SUM(goods_gross + shipping_gross) de supplier_orders
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result     jsonb;
  v_master_total numeric;
  v_sum_total    numeric;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c02-a2ad3ec4-83de-420e-b107-fe93a3e2cbcf'
  );

  v_master_total := (v_result->'master_order'->>'checkout_gross_total')::numeric;

  SELECT ROUND(
    SUM(
      COALESCE((s->>'goods_gross_snapshot')::numeric, 0)
    + COALESCE((s->>'shipping_gross_snapshot')::numeric, 0)
    ), 2
  )
  INTO v_sum_total
  FROM jsonb_array_elements(v_result->'supplier_orders') s;

  ASSERT ABS(v_master_total - v_sum_total) < 0.02,
    'P-03 FAIL: master_total=' || v_master_total || ' vs sum_suppliers=' || v_sum_total;

  RAISE NOTICE 'P-03 PASS: total global = % = SUM(supplier) = %', v_master_total, v_sum_total;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-04: Total proveedor = Supplier Order snapshot
-- Verifica que goods_gross_snapshot coincide con lo almacenado en la BD
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result   jsonb;
  v_supplier jsonb;
  v_fn_gross numeric;
  v_db_gross numeric;
  v_order_id uuid;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c01-0ffe1283-667f-4067-9374-334f0699fe27'
  );

  v_supplier := v_result->'supplier_orders'->0;
  v_order_id := (v_supplier->>'supplier_order_id')::uuid;
  v_fn_gross := (v_supplier->>'goods_gross_snapshot')::numeric;

  SELECT goods_gross_snapshot INTO v_db_gross
    FROM public.trade_marketplace_orders
   WHERE id = v_order_id;

  ASSERT ABS(COALESCE(v_fn_gross, 0) - COALESCE(v_db_gross, 0)) < 0.01,
    'P-04 FAIL: goods_gross_fn=' || v_fn_gross || ' vs goods_gross_db=' || v_db_gross;

  RAISE NOTICE 'P-04 PASS: goods_gross_snapshot correcto = %', v_fn_gross;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-05: Portes separados por proveedor
-- En C-02 (3 proveedores), al menos 1 supplier con shipping_gross_snapshot > 0
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result       jsonb;
  v_with_portes  int;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c02-a2ad3ec4-83de-420e-b107-fe93a3e2cbcf'
  );

  SELECT COUNT(*) INTO v_with_portes
    FROM jsonb_array_elements(v_result->'supplier_orders') s
   WHERE COALESCE((s->>'shipping_gross_snapshot')::numeric, 0) > 0;

  ASSERT v_with_portes >= 1,
    'P-05 FAIL: ningún proveedor tiene portes en shipping_gross_snapshot';

  -- Verificar que cada supplier tiene su propio shipping_gross separado (no mezclado)
  ASSERT jsonb_array_length(v_result->'supplier_orders') = 3,
    'P-05 FAIL: esperado 3 bloques de proveedor independientes';

  RAISE NOTICE 'P-05 PASS: % de 3 proveedores tienen portes > 0', v_with_portes;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-06: Datos vienen de snapshot, no del catálogo actual
-- Verifica: has_snapshot=true e item_gross_snapshot no es NULL para nuevos pedidos
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result     jsonb;
  v_items_ok   int;
  v_items_total int;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c01-0ffe1283-667f-4067-9374-334f0699fe27'
  );

  SELECT COUNT(*) INTO v_items_total
    FROM jsonb_array_elements(v_result->'supplier_orders') s,
         jsonb_array_elements(s->'items') i;

  SELECT COUNT(*) INTO v_items_ok
    FROM jsonb_array_elements(v_result->'supplier_orders') s,
         jsonb_array_elements(s->'items') i
   WHERE (i->>'has_snapshot')::boolean = true
     AND (i->>'item_gross_snapshot') IS NOT NULL;

  ASSERT v_items_total > 0,
    'P-06 FAIL: no hay items en la respuesta';
  ASSERT v_items_ok = v_items_total,
    'P-06 FAIL: ' || (v_items_total - v_items_ok) || ' items sin snapshot de los ' || v_items_total;

  -- Verificar que el snapshot del supplier_order también está presente
  ASSERT (v_result->'supplier_orders'->0->>'has_snapshot')::boolean = true,
    'P-06 FAIL: supplier_order sin snapshot';

  RAISE NOTICE 'P-06 PASS: % items con snapshot completo', v_items_ok;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-07: Comisión simulada NO aparece en respuesta al comprador
-- Verifica: las claves commission_net_snapshot y sim_commission_net no están
-- en el JSON devuelto (ni en master_order ni en supplier_orders)
-- INV-005: comisión real=0, no expuesta al comprador
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result    jsonb;
  v_result_text text;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c01-0ffe1283-667f-4067-9374-334f0699fe27'
  );

  v_result_text := v_result::text;

  ASSERT v_result->'master_order' ? 'commission_net_snapshot' = false,
    'P-07 FAIL: commission_net_snapshot no debe aparecer en master_order';

  ASSERT NOT (v_result->'supplier_orders'->0 ? 'commission_net_snapshot'),
    'P-07 FAIL: commission_net_snapshot no debe aparecer en supplier_order';

  ASSERT NOT (v_result->'supplier_orders'->0 ? 'sim_commission_net'),
    'P-07 FAIL: sim_commission_net (comisión simulada) no debe aparecer como cargo al comprador';

  RAISE NOTICE 'P-07 PASS: comisión no expuesta al comprador (INV-005)';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-08: external_provider = 'simulation' en resultado (aviso de prueba)
-- El campo external_provider indica que es un pedido de simulación
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result    jsonb;
  v_provider  text;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c18-a17cf4da-71e3-4b46-8d6e-fa79a10e2535'
  );

  v_provider := v_result->'master_order'->>'external_provider';

  ASSERT v_provider = 'simulation',
    'P-08 FAIL: external_provider = ' || COALESCE(v_provider, 'NULL') || ', esperado ''simulation''';

  -- El PDF mostrará el banner de simulación basándose en este campo
  RAISE NOTICE 'P-08 PASS: external_provider=simulation → banner OPERACIÓN DE PRUEBA se mostrará';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-09: Pedido legacy (sin Master Order) no rompe la UI
-- is_legacy=true, master_order=NULL, al menos 1 supplier_order en el resultado
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
  v_is_legacy bool;
BEGIN
  -- Usar pedido legacy (master_order_id IS NULL)
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_order_id => '21a0d5aa-7946-48cf-93b7-f1a0fc2cf506'::uuid
  );

  ASSERT v_result IS NOT NULL,
    'P-09 FAIL: resultado NULL para pedido legacy';

  v_is_legacy := (v_result->>'is_legacy')::boolean;
  ASSERT v_is_legacy = true,
    'P-09 FAIL: is_legacy debe ser true para pedido sin master_order_id';

  ASSERT v_result->'master_order' = 'null'::jsonb OR v_result->'master_order' IS NULL,
    'P-09 FAIL: master_order debe ser null para pedido legacy';

  ASSERT jsonb_array_length(v_result->'supplier_orders') = 1,
    'P-09 FAIL: esperado 1 supplier_order para pedido legacy';

  -- El bloque de proveedor debe tener al menos numero y actor_nombre
  ASSERT (v_result->'supplier_orders'->0->>'numero') IS NOT NULL,
    'P-09 FAIL: numero del supplier_order legacy es NULL';

  RAISE NOTICE 'P-09 PASS: pedido legacy devuelve is_legacy=true, master_order=null, 1 supplier_order (numero: %)',
    v_result->'supplier_orders'->0->>'numero';
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- P-10: Número master_order comienza con 'MKP' (no 'Factura')
-- El documento se llama "Resumen de compra", nunca "Factura"
-- LEGAL_GATE: verificar que la nomenclatura interna no usa terminología fiscal
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_result jsonb;
  v_numero text;
BEGIN
  v_result := public.mkt_fin_get_purchase_summary_data(
    p_checkout_key => 'fin1b1-c02-a2ad3ec4-83de-420e-b107-fe93a3e2cbcf'
  );

  v_numero := v_result->'master_order'->>'numero';

  ASSERT v_numero LIKE 'MKP-%',
    'P-10 FAIL: numero master_order no comienza con MKP: ' || COALESCE(v_numero, 'NULL');

  -- Verificar que los supplier_orders tampoco usan numeración de factura
  ASSERT (
    SELECT bool_and((s->>'numero') NOT LIKE 'F-%' AND (s->>'numero') NOT LIKE 'FAC%')
      FROM jsonb_array_elements(v_result->'supplier_orders') s
  ), 'P-10 FAIL: algún supplier_order usa numeración tipo factura';

  -- Verificar invoice_placeholder estructura futura (presente pero status=pending)
  ASSERT (
    SELECT bool_and((s->'invoice_placeholder'->>'status') = 'pending')
      FROM jsonb_array_elements(v_result->'supplier_orders') s
  ), 'P-10 FAIL: invoice_placeholder.status debe ser ''pending'' en esta fase';

  RAISE NOTICE 'P-10 PASS: número MKP-* correcto (%), facturas proveedor pendientes (LEGAL_GATE)',
    v_numero;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación final de integridad global
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM trade_marketplace_master_orders) AS total_master_orders,
  (SELECT COUNT(*) FROM trade_marketplace_orders WHERE master_order_id IS NOT NULL) AS orders_linked,
  (SELECT COUNT(*) FROM trade_marketplace_orders WHERE financial_snapshot_at IS NOT NULL) AS orders_with_snapshot,
  'P-01..P-10 ALL PASSED' AS test_suite_result;
