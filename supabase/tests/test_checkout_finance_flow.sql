-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1B.1 · Test Suite: Checkout Finance Flow (C-01 a C-18)
-- Proyecto: dqqjaujnulutinskmqsu (eu-central-1)
-- ════════════════════════════════════════════════════════════════════════════
-- Datos cloud:
--   user    46c40317-227d-4f98-96d9-b2ea55667cd8 (miembro org, rol comercial)
--   org     1047165e-f6ce-4b5a-9141-0d76be0a4a5a
--   actor1  85e73234-c74e-44e7-865a-1aca8312f9a5  Obras y Materiales (portes=8.50, gratis≥250)
--   actor2  aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9  Suministros Técnicos Norte (sin config)
--   actor3  283d106e-30e3-4e1d-8e3d-069e4a6e4f61  TrabFlow (sin config)
--   off1    289d5dc1-b1f6-42fd-a624-1d574054b267  Ladrillo  0.35 EUR 21%
--   off2    33ce3b45-1c85-488a-8eaa-48beb37181b6  Mecanismo 0.85 EUR 21%
--   off3    001d3f24-9406-4b37-b5fb-51d375ee28a4  Teja      1.12 EUR 21%
-- NOTA: total_linea es columna GENERADA (cantidad * precio_unitario_final)
-- ════════════════════════════════════════════════════════════════════════════

SELECT set_config('request.jwt.claims',
  '{"sub": "46c40317-227d-4f98-96d9-b2ea55667cd8", "role": "authenticated"}',
  false);

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE A: Setup + C-15 (legacy orders preservados)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_legacy_count bigint;
BEGIN
  RAISE NOTICE '════════ MP-FIN-1B.1 Test Suite (C-01 a C-18) ════════';

  ASSERT (SELECT COUNT(*) FROM public.trade_marketplace_actors WHERE id = ANY(ARRAY[
    '85e73234-c74e-44e7-865a-1aca8312f9a5'::uuid,
    'aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9'::uuid,
    '283d106e-30e3-4e1d-8e3d-069e4a6e4f61'::uuid
  ])) = 3, 'SETUP FAILED: actores de test no existen';

  ASSERT (SELECT COUNT(*) FROM public.trade_marketplace_supplier_offerings
    WHERE id = ANY(ARRAY[
      '289d5dc1-b1f6-42fd-a624-1d574054b267'::uuid,
      '33ce3b45-1c85-488a-8eaa-48beb37181b6'::uuid,
      '001d3f24-9406-4b37-b5fb-51d375ee28a4'::uuid
    ]) AND activa = true) = 3, 'SETUP FAILED: offerings de test no existen/inactivas';

  ASSERT (SELECT COUNT(*) FROM public.trade_org_members
    WHERE user_id = '46c40317-227d-4f98-96d9-b2ea55667cd8'
      AND org_id  = '1047165e-f6ce-4b5a-9141-0d76be0a4a5a') > 0,
    'SETUP FAILED: usuario no es miembro de la org';

  SELECT COUNT(*) INTO v_legacy_count FROM public.trade_marketplace_orders WHERE master_order_id IS NULL;
  ASSERT v_legacy_count > 0, 'C-15 FAILED: No existen pedidos legacy';
  RAISE NOTICE '[C-15] PASSED: % pedidos legacy (master_order_id IS NULL) preservados', v_legacy_count;
  RAISE NOTICE '[SETUP] OK';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE B: C-01, C-03, C-04, C-07, C-09, C-10, C-11, C-14
-- 1 proveedor + idempotencia
-- Esperado: goods=1.75, portes=8.50, checkout_gross=10.25
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_checkout_key text;
  v_cart_id      uuid;
  v_order_ids    uuid[];
  v_order_ids_2  uuid[];
  v_order_id     uuid;
  v_master       public.trade_marketplace_master_orders;
  v_cart_estado  text;
  v_snap_at      timestamptz;
  v_comm_net     numeric;
  v_master_count bigint;
BEGIN
  v_checkout_key := 'fin1b1-c01-' || gen_random_uuid()::text;

  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  -- off1 qty=5 → total_linea=1.75 (generado) — actor1 portes=8.50
  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Ladrillo perforado 25x12x7cm', 5, 'ud',
    '289d5dc1-b1f6-42fd-a624-1d574054b267',
    '85e73234-c74e-44e7-865a-1aca8312f9a5',
    0.35, true
  );

  -- C-01: Checkout 1 proveedor
  v_order_ids := public.checkout_cart_v2(v_cart_id, '{}',
    '{"_test":"C-01","_suite":"FIN_1B1"}'::jsonb, v_checkout_key);
  ASSERT array_length(v_order_ids, 1) = 1,
    'C-01 FAILED: Debe crear 1 supplier order, got: ' || array_length(v_order_ids, 1)::text;
  v_order_id := v_order_ids[1];
  RAISE NOTICE '[C-01] PASSED: order_id=%', v_order_id;

  -- C-07: financial_snapshot_at IS NOT NULL
  SELECT financial_snapshot_at INTO v_snap_at FROM public.trade_marketplace_orders WHERE id = v_order_id;
  ASSERT v_snap_at IS NOT NULL, 'C-07 FAILED: financial_snapshot_at debe ser NOT NULL';
  RAISE NOTICE '[C-07] PASSED: financial_snapshot_at = %', v_snap_at;

  -- C-09: commission_net_snapshot = 0 (INV-005)
  SELECT commission_net_snapshot INTO v_comm_net FROM public.trade_marketplace_orders WHERE id = v_order_id;
  ASSERT v_comm_net = 0, 'C-09 FAILED: commission_net_snapshot debe ser 0, got: ' || v_comm_net::text;
  RAISE NOTICE '[C-09] PASSED: commission_net_snapshot = 0 (INV-005)';

  -- C-14: cart.estado = ordered
  SELECT estado INTO v_cart_estado FROM public.trade_marketplace_carts WHERE id = v_cart_id;
  ASSERT v_cart_estado = 'ordered', 'C-14 FAILED: cart.estado=' || v_cart_estado;
  RAISE NOTICE '[C-14] PASSED: cart.estado = ordered';

  -- C-10: master_order recuperable por checkout_key
  SELECT * INTO v_master FROM public.trade_marketplace_master_orders WHERE checkout_key = v_checkout_key;
  ASSERT v_master.id IS NOT NULL, 'C-10 FAILED: master_order no encontrada';
  RAISE NOTICE '[C-10] PASSED: master_order.id=%, checkout_gross=%', v_master.id, v_master.checkout_gross_total;

  -- C-11: supplier_order vinculado al master_order
  ASSERT (SELECT master_order_id = v_master.id FROM public.trade_marketplace_orders WHERE id = v_order_id),
    'C-11 FAILED: supplier_order no vinculado';
  RAISE NOTICE '[C-11] PASSED: master_order_id vinculado correctamente';

  -- C-03/C-04: Idempotencia — segunda llamada misma checkout_key
  v_order_ids_2 := public.checkout_cart_v2(v_cart_id, '{}', '{}'::jsonb, v_checkout_key);
  ASSERT array_length(v_order_ids_2, 1) = 1, 'C-03 FAILED: Segunda llamada debe devolver 1 id';
  ASSERT v_order_ids_2[1] = v_order_id,
    'C-04 FAILED: Segunda llamada devolvió distinto order_id: ' || v_order_ids_2[1]::text;
  SELECT COUNT(*) INTO v_master_count FROM public.trade_marketplace_master_orders WHERE checkout_key = v_checkout_key;
  ASSERT v_master_count = 1, 'C-03 FAILED: master_order duplicada. Count=' || v_master_count::text;
  RAISE NOTICE '[C-03] PASSED: Sin master_order duplicado';
  RAISE NOTICE '[C-04] PASSED: Mismo order_id en segunda llamada';
  RAISE NOTICE 'BLOQUE B OK';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE C: C-02, C-05 + C-11 (3 proveedores)
-- actor1: goods=1.75 ship=8.50 | actor2: goods=1.70 ship=0 | actor3: goods=3.36 ship=0
-- master.checkout_gross_total esperado ≈ 15.31
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_checkout_key       text;
  v_cart_id            uuid;
  v_order_ids          uuid[];
  v_master             public.trade_marketplace_master_orders;
  v_sum_supplier_gross numeric;
  v_linked_count       bigint;
BEGIN
  v_checkout_key := 'fin1b1-c02-' || gen_random_uuid()::text;

  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  -- actor1: off1 qty=5 = 1.75 gross (portes=8.50 porque < 250)
  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Ladrillo perforado', 5, 'ud',
    '289d5dc1-b1f6-42fd-a624-1d574054b267',
    '85e73234-c74e-44e7-865a-1aca8312f9a5', 0.35, true
  );

  -- actor2: off2 qty=2 = 1.70 gross (sin config → portes=0)
  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Caja mecanismo empotrar', 2, 'ud',
    '33ce3b45-1c85-488a-8eaa-48beb37181b6',
    'aeca7bac-f559-4e01-8ba4-7fd1b7aae9b9', 0.85, true
  );

  -- actor3: off3 qty=3 = 3.36 gross (sin config → portes=0)
  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Teja plana cerámica', 3, 'ud',
    '001d3f24-9406-4b37-b5fb-51d375ee28a4',
    '283d106e-30e3-4e1d-8e3d-069e4a6e4f61', 1.12, true
  );

  -- C-02: Checkout 3 proveedores
  v_order_ids := public.checkout_cart_v2(v_cart_id, '{}',
    '{"_test":"C-02","_suite":"FIN_1B1"}'::jsonb, v_checkout_key);
  ASSERT array_length(v_order_ids, 1) = 3,
    'C-02 FAILED: Debe crear 3 supplier orders, got: ' || array_length(v_order_ids, 1)::text;
  RAISE NOTICE '[C-02] PASSED: 3 supplier orders creados';

  -- C-05: master.checkout_gross_total = SUM(supplier.goods_gross + supplier.shipping_gross)
  SELECT * INTO v_master FROM public.trade_marketplace_master_orders WHERE checkout_key = v_checkout_key;
  SELECT COALESCE(SUM(goods_gross_snapshot + shipping_gross_snapshot), 0)
    INTO v_sum_supplier_gross
    FROM public.trade_marketplace_orders
   WHERE master_order_id = v_master.id;
  ASSERT ABS(v_master.checkout_gross_total - v_sum_supplier_gross) < 0.01,
    'C-05 FAILED: master.checkout_gross_total (' || v_master.checkout_gross_total::text
    || ') != SUM supplier gross (' || v_sum_supplier_gross::text || ')';
  RAISE NOTICE '[C-05] PASSED: master.checkout_gross_total=% = SUM supplier(goods+ship)=%',
    v_master.checkout_gross_total, v_sum_supplier_gross;

  -- C-11 (3-supplier): todos los supplier_orders vinculados
  SELECT COUNT(*) INTO v_linked_count
    FROM public.trade_marketplace_orders
   WHERE id = ANY(v_order_ids) AND master_order_id = v_master.id;
  ASSERT v_linked_count = 3, 'C-11 FAILED: Solo ' || v_linked_count::text || '/3 vinculados';
  RAISE NOTICE '[C-11] PASSED: 3/3 supplier_orders vinculados a master_order';
  RAISE NOTICE 'BLOQUE C OK';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE D: C-06 — item_net + item_tax = item_gross (INV-003 por ítem)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_bad_items  bigint;
  v_total_snap bigint;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE ABS((item_net_snapshot + item_tax_snapshot) - item_gross_snapshot) > 0.01),
    COUNT(*) FILTER (WHERE item_gross_snapshot IS NOT NULL)
  INTO v_bad_items, v_total_snap
  FROM public.trade_marketplace_order_items;

  ASSERT v_total_snap > 0, 'C-06 precondición: No hay order_items con snapshot';
  ASSERT v_bad_items = 0,
    'C-06 FAILED: ' || v_bad_items::text || ' items con net+tax != gross (tol 0.01 EUR)';
  RAISE NOTICE '[C-06] PASSED: item_net+item_tax=item_gross para % items', v_total_snap;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE E: C-08 — INV-007 snapshot inmutable
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_order_id         uuid;
  v_exception_raised boolean := false;
BEGIN
  SELECT id INTO v_order_id
    FROM public.trade_marketplace_orders
   WHERE financial_snapshot_at IS NOT NULL LIMIT 1;

  IF v_order_id IS NULL THEN
    RAISE NOTICE '[C-08] SKIPPED: No hay pedidos con snapshot';
    RETURN;
  END IF;

  BEGIN
    UPDATE public.trade_marketplace_orders
       SET goods_gross_snapshot = 999999.00
     WHERE id = v_order_id;
    ASSERT FALSE, 'C-08 FAILED: Debería haber lanzado INV-007';
  EXCEPTION WHEN OTHERS THEN
    v_exception_raised := true;
    ASSERT SQLERRM LIKE '%INV-007%',
      'C-08 FAILED: Excepción incorrecta. Esperada INV-007, got: ' || SQLERRM;
  END;

  ASSERT v_exception_raised, 'C-08 FAILED: INV-007 no se lanzó';
  RAISE NOTICE '[C-08] PASSED: INV-007 snapshot inmutable verificada. order_id=%', v_order_id;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE F: C-12 — Carrito vacío lanza NO_ITEMS
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_cart_id          uuid;
  v_exception_raised boolean := false;
  v_sqlerrm          text;
BEGIN
  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  BEGIN
    PERFORM public.checkout_cart_v2(v_cart_id, '{}', '{}'::jsonb, gen_random_uuid()::text);
    ASSERT FALSE, 'C-12 FAILED: Debería lanzar NO_ITEMS';
  EXCEPTION WHEN OTHERS THEN
    v_sqlerrm := SQLERRM;
    v_exception_raised := true;
    ASSERT v_sqlerrm LIKE '%NO_ITEMS%',
      'C-12 FAILED: Esperada NO_ITEMS, got: ' || v_sqlerrm;
  END;

  DELETE FROM public.trade_marketplace_carts WHERE id = v_cart_id;
  ASSERT v_exception_raised, 'C-12 FAILED: NO_ITEMS no fue lanzada';
  RAISE NOTICE '[C-12] PASSED: Carrito vacío lanza NO_ITEMS';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE G: C-13 — Actor inactivo lanza ACTOR_INACTIVE
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_test_actor_id    uuid;
  v_cart_id          uuid;
  v_exception_raised boolean := false;
  v_sqlerrm          text;
BEGIN
  INSERT INTO public.trade_marketplace_actors
    (actor_type, nombre, slug, country, estado, verificado)
  VALUES (
    'supplier', 'TEST Actor Inactivo FIN1B1',
    'test-inactivo-' || REPLACE(gen_random_uuid()::text, '-', ''),
    'ES', 'suspended', false
  ) RETURNING id INTO v_test_actor_id;

  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  -- Item SIN offering (selected_offering_id=NULL) para evitar constraint de offering
  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Item test actor inactivo', 1, 'ud',
    v_test_actor_id, 10.00, true
  );

  BEGIN
    PERFORM public.checkout_cart_v2(v_cart_id, '{}', '{}'::jsonb, gen_random_uuid()::text);
    ASSERT FALSE, 'C-13 FAILED: Debería lanzar ACTOR_INACTIVE';
  EXCEPTION WHEN OTHERS THEN
    v_sqlerrm := SQLERRM;
    v_exception_raised := true;
    ASSERT v_sqlerrm LIKE '%ACTOR_INACTIVE%',
      'C-13 FAILED: Esperada ACTOR_INACTIVE, got: ' || v_sqlerrm;
  END;

  DELETE FROM public.trade_marketplace_cart_items WHERE cart_id = v_cart_id;
  DELETE FROM public.trade_marketplace_carts WHERE id = v_cart_id;
  DELETE FROM public.trade_marketplace_actors WHERE id = v_test_actor_id;
  ASSERT v_exception_raised, 'C-13 FAILED: ACTOR_INACTIVE no fue lanzada';
  RAISE NOTICE '[C-13] PASSED: Actor suspendido lanza ACTOR_INACTIVE';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE H: C-16 — checkout_key='' genera UUID (DT-1A-2)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_cart_id   uuid;
  v_order_ids uuid[];
  v_master    public.trade_marketplace_master_orders;
BEGIN
  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Ladrillo test C-16', 1, 'ud',
    '289d5dc1-b1f6-42fd-a624-1d574054b267',
    '85e73234-c74e-44e7-865a-1aca8312f9a5', 0.35, true
  );

  v_order_ids := public.checkout_cart_v2(v_cart_id, '{}',
    '{"_test":"C-16"}'::jsonb, '');

  ASSERT array_length(v_order_ids, 1) = 1, 'C-16 FAILED: Debe crear 1 order con key=''''';

  SELECT mo.* INTO v_master
    FROM public.trade_marketplace_master_orders mo
    JOIN public.trade_marketplace_orders so ON so.master_order_id = mo.id
   WHERE so.id = v_order_ids[1];

  ASSERT v_master.id IS NOT NULL, 'C-16 FAILED: master_order no encontrada';
  ASSERT v_master.checkout_key IS NOT NULL AND v_master.checkout_key != '',
    'C-16 FAILED: checkout_key vacío en master_order, got: ' || COALESCE(v_master.checkout_key, 'NULL');
  ASSERT length(v_master.checkout_key) >= 32,
    'C-16 FAILED: checkout_key no parece UUID: ' || v_master.checkout_key;

  RAISE NOTICE '[C-16] PASSED: checkout_key='''' → UUID generado: %', v_master.checkout_key;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE H2: C-17 — checkout_key=NULL genera UUID (DT-1A-2)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_cart_id   uuid;
  v_order_ids uuid[];
  v_master    public.trade_marketplace_master_orders;
BEGIN
  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Ladrillo test C-17', 1, 'ud',
    '289d5dc1-b1f6-42fd-a624-1d574054b267',
    '85e73234-c74e-44e7-865a-1aca8312f9a5', 0.35, true
  );

  v_order_ids := public.checkout_cart_v2(v_cart_id, '{}',
    '{"_test":"C-17"}'::jsonb, NULL);

  ASSERT array_length(v_order_ids, 1) = 1, 'C-17 FAILED: Debe crear 1 order con key=NULL';

  SELECT mo.* INTO v_master
    FROM public.trade_marketplace_master_orders mo
    JOIN public.trade_marketplace_orders so ON so.master_order_id = mo.id
   WHERE so.id = v_order_ids[1];

  ASSERT v_master.id IS NOT NULL, 'C-17 FAILED: master_order no encontrada';
  ASSERT v_master.checkout_key IS NOT NULL AND v_master.checkout_key != '',
    'C-17 FAILED: checkout_key vacío, got: ' || COALESCE(v_master.checkout_key, 'NULL');

  RAISE NOTICE '[C-17] PASSED: checkout_key=NULL → UUID generado: %', v_master.checkout_key;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- BLOQUE I: C-18 — Pago offline (cuenta_proveedor) continúa operativo
-- ════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_checkout_key text;
  v_cart_id      uuid;
  v_order_ids    uuid[];
  v_order_id     uuid;
  v_pay_method   text;
  v_snap_at      timestamptz;
BEGIN
  v_checkout_key := 'fin1b1-c18-' || gen_random_uuid()::text;

  INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type, estado)
  VALUES ('1047165e-f6ce-4b5a-9141-0d76be0a4a5a',
          '46c40317-227d-4f98-96d9-b2ea55667cd8', 'manual', 'active')
  RETURNING id INTO v_cart_id;

  INSERT INTO public.trade_marketplace_cart_items (
    cart_id, descripcion_original, cantidad, unidad,
    selected_offering_id, selected_actor_id, precio_unitario_final, activo
  ) VALUES (
    v_cart_id, 'Ladrillo test C-18', 2, 'ud',
    '289d5dc1-b1f6-42fd-a624-1d574054b267',
    '85e73234-c74e-44e7-865a-1aca8312f9a5', 0.35, true
  );

  v_order_ids := public.checkout_cart_v2(
    v_cart_id,
    jsonb_build_object(
      '85e73234-c74e-44e7-865a-1aca8312f9a5',
      jsonb_build_object('delivery_method', 'entrega_obra', 'payment_method', 'cuenta_proveedor')
    ),
    '{"_test":"C-18","_suite":"FIN_1B1"}'::jsonb,
    v_checkout_key
  );

  ASSERT array_length(v_order_ids, 1) = 1, 'C-18 FAILED: Debe crear 1 order';
  v_order_id := v_order_ids[1];

  SELECT payment_method, financial_snapshot_at
    INTO v_pay_method, v_snap_at
    FROM public.trade_marketplace_orders WHERE id = v_order_id;

  ASSERT v_pay_method = 'cuenta_proveedor',
    'C-18 FAILED: payment_method debe ser cuenta_proveedor, got: ' || COALESCE(v_pay_method, 'NULL');
  ASSERT v_snap_at IS NOT NULL,
    'C-18 FAILED: financial_snapshot_at debe ser NOT NULL en pago offline';

  RAISE NOTICE '[C-18] PASSED: Checkout offline (cuenta_proveedor) operativo. Snapshot OK.';
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════
-- RESUMEN
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE 'MP-FIN-1B.1 — Test Suite COMPLETADA SIN ERRORES';
  RAISE NOTICE 'C-01 C-02 C-03 C-04 C-05 C-06 C-07 C-08 C-09';
  RAISE NOTICE 'C-10 C-11 C-12 C-13 C-14 C-15 C-16 C-17 C-18';
  RAISE NOTICE '════════════════════════════════════════════════════════';
END;
$$;
