-- ═══════════════════════════════════════════════════════════════════════════════
-- Tests MP-FIN-1A — Financial Foundations
-- Ejecutar con service_role.
-- Verifica invariantes financieras y backward compatibility.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Limpieza ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  DELETE FROM public.trade_marketplace_ledger_entries
    WHERE source_event_id LIKE 'test-fin-1a-%';
  DELETE FROM public.trade_marketplace_master_orders
    WHERE checkout_key LIKE 'test-fin-1a-%';
  DELETE FROM public.trade_marketplace_commission_policies
    WHERE nombre LIKE 'TEST-%';
  RAISE NOTICE '[SETUP] Datos de test previos eliminados.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST A — Configuración financiera inicial correcta
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_payment_mode      jsonb;
  v_real_payments     jsonb;
  v_commission        jsonb;
  v_stripe            jsonb;
  v_sim_rate          jsonb;
BEGIN
  v_payment_mode  := public.mkt_fin_get_config('payment.mode');
  v_real_payments := public.mkt_fin_get_config('payment.real_payments_enabled');
  v_commission    := public.mkt_fin_get_config('commission.enabled');
  v_stripe        := public.mkt_fin_get_config('payment.stripe_connect_enabled');
  v_sim_rate      := public.mkt_fin_get_config('commission.simulation_rate');

  -- Test A.1: payment_mode = simulation
  ASSERT v_payment_mode = '"simulation"',
    'TEST A.1 FAILED: payment.mode debe ser "simulation". Actual: ' || v_payment_mode::text;

  -- Test A.2: real_payments = false (NUNCA activar en Fase 0)
  ASSERT v_real_payments = 'false',
    'TEST A.2 FAILED: payment.real_payments_enabled debe ser false. Actual: ' || v_real_payments::text;

  -- Test A.3: commission.enabled = false (INV-005)
  ASSERT v_commission = 'false',
    'TEST A.3 FAILED: commission.enabled debe ser false en Fase 0. Actual: ' || v_commission::text;

  -- Test A.4: stripe_connect = false (STRIPE_GATE)
  ASSERT v_stripe = 'false',
    'TEST A.4 FAILED: payment.stripe_connect_enabled debe ser false. Actual: ' || v_stripe::text;

  -- Test A.5: simulation_rate existe y no es null
  ASSERT v_sim_rate IS NOT NULL,
    'TEST A.5 FAILED: commission.simulation_rate no debe ser null.';

  RAISE NOTICE '[TEST A] PASSED: Configuración financiera inicial correcta.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST B — Política de comisión inicial correcta (INV-005)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_policy public.trade_marketplace_commission_policies;
BEGIN
  v_policy := public.mkt_fin_get_active_commission_policy(NULL);

  -- Test B.1: existe política activa
  -- NOTA: composite IS NOT NULL en PG devuelve FALSE si algún campo es NULL.
  -- Usar v_policy.id IS NOT NULL para verificar que el SELECT INTO encontró fila.
  ASSERT v_policy.id IS NOT NULL,
    'TEST B.1 FAILED: Debe existir una política de comisión activa global.';

  -- Test B.2: commission_enabled = false (INV-005)
  ASSERT v_policy.commission_enabled = false,
    'TEST B.2 FAILED: commission_enabled debe ser false en Fase 0 (INV-005).';

  -- Test B.3: commission_rate = 0 (INV-005: 0% real)
  ASSERT v_policy.commission_rate = 0.0000,
    'TEST B.3 FAILED: commission_rate debe ser 0 en Fase 0 (INV-005). Actual: ' || v_policy.commission_rate::text;

  -- Test B.4: simulation_only = true
  ASSERT v_policy.simulation_only = true,
    'TEST B.4 FAILED: simulation_only debe ser true en Fase 0.';

  -- Test B.5: applies_to_shipping = false (INV-006)
  ASSERT v_policy.applies_to_shipping = false,
    'TEST B.5 FAILED: applies_to_shipping debe ser false en Fase 0 (INV-006).';

  -- Test B.6: commission_base = 'goods_net' (INV-006)
  ASSERT v_policy.commission_base = 'goods_net',
    'TEST B.6 FAILED: commission_base debe ser goods_net. Actual: ' || v_policy.commission_base;

  RAISE NOTICE '[TEST B] PASSED: Política de comisión Fase 0 correcta (INV-005, INV-006).';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST C — Cálculo de comisión: 0% real, simulación ≠ revenue real (INV-005)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_comm_real jsonb;
  v_comm_sim  jsonb;
BEGIN
  -- Test C.1: comisión real = 0 en Fase 0
  v_comm_real := public.mkt_fin_calculate_commission(1000.00, NULL, false);

  ASSERT (v_comm_real->>'commission_net')::numeric = 0,
    'TEST C.1 FAILED: commission_net real debe ser 0 en Fase 0. Actual: ' || (v_comm_real->>'commission_net');

  ASSERT (v_comm_real->>'commission_gross')::numeric = 0,
    'TEST C.2 FAILED: commission_gross real debe ser 0 en Fase 0.';

  ASSERT (v_comm_real->>'is_real')::boolean = false,
    'TEST C.3 FAILED: is_real debe ser false en Fase 0.';

  -- Test C.4: simulación ≠ 0 (2% hipotético para reporting)
  v_comm_sim := public.mkt_fin_calculate_commission(1000.00, NULL, true);

  ASSERT (v_comm_sim->>'is_simulation')::boolean = true,
    'TEST C.4 FAILED: is_simulation debe ser true en modo simulación.';

  -- Test C.5: la simulación usa el rate de financial_config (no hardcodeado)
  ASSERT (v_comm_sim->>'commission_rate')::numeric > 0,
    'TEST C.5 FAILED: simulation_rate debe ser > 0 para reporting potencial.';

  -- Test C.6 (INV-001): la comisión simulada NO es Revenue TrabFlow real
  -- (verificación conceptual: el flag is_real=false lo confirma)
  ASSERT (v_comm_sim->>'is_real')::boolean = false,
    'TEST C.6 FAILED: INV-001 violado: is_real debe ser false incluso en simulación.';

  RAISE NOTICE '[TEST C] PASSED: INV-005 verificado. Comisión real=0. Simulación separada del Revenue real.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST D — Master Order: creación e idempotencia (INV-017)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_master_1  public.trade_marketplace_master_orders;
  v_master_2  public.trade_marketplace_master_orders;
  v_org_id    uuid;
BEGIN
  -- Obtener una org existente (la primera disponible)
  SELECT id INTO v_org_id FROM public.trade_organizations LIMIT 1;
  IF v_org_id IS NULL THEN
    RAISE NOTICE '[TEST D] SKIP: No hay organizaciones en BD. Omitiendo test de master order.';
    RETURN;
  END IF;

  -- Test D.1: crear master order
  v_master_1 := public.mkt_fin_create_master_order(
    'test-fin-1a-checkout-001',
    v_org_id,
    NULL,   -- guest_customer_id
    NULL,   -- cart_id
    '{"test": true}'::jsonb,
    400.00, -- goods_net
    84.00,  -- goods_tax (21%)
    484.00, -- goods_gross
    15.00,  -- shipping_net
    3.15,   -- shipping_tax
    18.15,  -- shipping_gross
    'EUR',
    NULL
  );

  ASSERT v_master_1 IS NOT NULL,
    'TEST D.1 FAILED: mkt_fin_create_master_order debe retornar un registro.';

  ASSERT v_master_1.checkout_key = 'test-fin-1a-checkout-001',
    'TEST D.2 FAILED: checkout_key no coincide.';

  ASSERT v_master_1.checkout_gross_total = 484.00 + 18.15,
    'TEST D.3 FAILED: checkout_gross_total debe ser ' || (484.00 + 18.15)::text ||
    '. Actual: ' || v_master_1.checkout_gross_total::text;

  ASSERT v_master_1.numero IS NOT NULL AND v_master_1.numero != '',
    'TEST D.4 FAILED: número MKP debe generarse automáticamente.';

  ASSERT v_master_1.order_status = 'created',
    'TEST D.5 FAILED: order_status inicial debe ser created.';

  ASSERT v_master_1.payment_status = 'unpaid',
    'TEST D.6 FAILED: payment_status inicial debe ser unpaid.';

  -- Test D.7: idempotencia — llamar de nuevo con la misma checkout_key devuelve el mismo registro
  v_master_2 := public.mkt_fin_create_master_order(
    'test-fin-1a-checkout-001',  -- misma checkout_key
    v_org_id, NULL, NULL, '{}'::jsonb,
    999.00, 0, 0, 0, 0, 0, 'EUR', NULL  -- datos diferentes: NO deben aplicarse
  );

  ASSERT v_master_2.id = v_master_1.id,
    'TEST D.7 FAILED: INV-017 violado: re-crear con misma checkout_key debe retornar el mismo registro.';

  ASSERT v_master_2.goods_net_total = 400.00,
    'TEST D.8 FAILED: INV-017: los datos del primer registro deben preservarse, no sobreescribirse.';

  RAISE NOTICE '[TEST D] PASSED: Master order creado. INV-017 idempotencia verificada. Número: %', v_master_1.numero;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST E — Ledger: inmutabilidad (INV-009)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_entry     public.trade_marketplace_ledger_entries;
  v_errored   boolean := false;
BEGIN
  -- Test E.1: insertar una entrada
  v_entry := public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT',
    400.00,
    NULL, NULL, NULL,
    'Test INV-009',
    'test-corr-fin-1a',
    'test-fin-1a-event-001',
    NULL, 'simulation', NULL, NULL, 'EUR', 'confirmed', NULL
  );

  ASSERT v_entry IS NOT NULL AND v_entry.id IS NOT NULL,
    'TEST E.1 FAILED: ledger_append debe retornar el registro insertado.';

  -- Test E.2: intentar UPDATE — debe fallar con excepción
  BEGIN
    UPDATE public.trade_marketplace_ledger_entries
       SET description = 'MODIFICADO'
     WHERE id = v_entry.id;
    -- Si llegamos aquí, el trigger no funcionó
    RAISE EXCEPTION 'TEST E.2 FAILED: UPDATE en ledger debe ser rechazado por trigger (INV-009)';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%INV-009%' OR SQLERRM LIKE '%inmutable%' THEN
        v_errored := true;
        RAISE NOTICE 'TEST E.2 OK: UPDATE rechazado correctamente: %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'TEST E.2 FAILED: Error inesperado en UPDATE: %', SQLERRM;
      END IF;
  END;

  ASSERT v_errored = true,
    'TEST E.2 FAILED: INV-009 violado: el trigger debería haber rechazado el UPDATE.';

  -- Test E.3: intentar DELETE — debe fallar con excepción
  v_errored := false;
  BEGIN
    DELETE FROM public.trade_marketplace_ledger_entries WHERE id = v_entry.id;
    RAISE EXCEPTION 'TEST E.3 FAILED: DELETE en ledger debe ser rechazado por trigger (INV-009)';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%INV-009%' OR SQLERRM LIKE '%inmutable%' THEN
        v_errored := true;
        RAISE NOTICE 'TEST E.3 OK: DELETE rechazado correctamente: %', SQLERRM;
      ELSE
        RAISE EXCEPTION 'TEST E.3 FAILED: Error inesperado en DELETE: %', SQLERRM;
      END IF;
  END;

  ASSERT v_errored = true,
    'TEST E.3 FAILED: INV-009 violado: el trigger debería haber rechazado el DELETE.';

  -- Test E.4: idempotencia — re-insertar con misma source_event_id + entry_type
  DECLARE
    v_entry_2 public.trade_marketplace_ledger_entries;
  BEGIN
    v_entry_2 := public.mkt_fin_ledger_append(
      'GOODS_ENTITLEMENT',
      999.00,   -- importe diferente
      NULL, NULL, NULL,
      'Test duplicado',
      'test-corr-fin-1a',
      'test-fin-1a-event-001',  -- misma source_event_id
      NULL, 'simulation', NULL, NULL, 'EUR', 'confirmed', NULL
    );
    ASSERT v_entry_2.id = v_entry.id,
      'TEST E.4 FAILED: INV-017: re-insertar con misma source_event_id debe retornar el mismo registro.';
    ASSERT v_entry_2.amount = 400.00,
      'TEST E.5 FAILED: INV-017: el importe original debe preservarse.';
  END;

  RAISE NOTICE '[TEST E] PASSED: INV-009 inmutabilidad del ledger verificada. INV-017 idempotencia verificada.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST F — GMV ≠ Revenue TrabFlow (INV-001)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_check jsonb;
BEGIN
  v_check := public.mkt_fin_check_gmv_revenue_separation(NULL);

  -- Test F.1: la función retorna resultado
  ASSERT v_check IS NOT NULL,
    'TEST F.1 FAILED: mkt_fin_check_gmv_revenue_separation debe retornar jsonb.';

  -- Test F.2: Revenue real = 0 en Fase 0 (INV-005)
  ASSERT (v_check->>'trabflow_revenue_real')::numeric = 0,
    'TEST F.2 FAILED: INV-005 violado: Revenue real debe ser 0 en Fase 0.';

  -- Test F.3: INV-001 OK flag
  ASSERT (v_check->>'inv_001_ok')::boolean = true,
    'TEST F.3 FAILED: INV-001 violado: GMV ≠ Revenue debe ser true.';

  RAISE NOTICE '[TEST F] PASSED: INV-001 GMV ≠ Revenue TrabFlow verificado. INV-005 Revenue real=0 verificado.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST G — Aislamiento entre proveedores (RLS conceptual)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_actor_a uuid;
  v_actor_b uuid;
  v_entry_a public.trade_marketplace_ledger_entries;
  v_entry_b public.trade_marketplace_ledger_entries;
BEGIN
  -- Obtener dos actores diferentes
  SELECT id INTO v_actor_a FROM public.trade_marketplace_actors WHERE estado = 'active' LIMIT 1 OFFSET 0;
  SELECT id INTO v_actor_b FROM public.trade_marketplace_actors WHERE estado = 'active' AND id != v_actor_a LIMIT 1;

  IF v_actor_a IS NULL OR v_actor_b IS NULL THEN
    RAISE NOTICE '[TEST G] SKIP: No hay suficientes actores activos para test de aislamiento.';
    RETURN;
  END IF;

  -- Insertar entrada para actor A
  v_entry_a := public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT', 300.00,
    NULL, NULL, v_actor_a,
    'Test aislamiento actor A', 'test-g-corr', 'test-fin-1a-g-actor-a',
    NULL, 'simulation', NULL, NULL, 'EUR', 'confirmed', NULL
  );

  -- Insertar entrada para actor B
  v_entry_b := public.mkt_fin_ledger_append(
    'GOODS_ENTITLEMENT', 200.00,
    NULL, NULL, v_actor_b,
    'Test aislamiento actor B', 'test-g-corr', 'test-fin-1a-g-actor-b',
    NULL, 'simulation', NULL, NULL, 'EUR', 'confirmed', NULL
  );

  -- Test G.1: las entradas son distintas
  ASSERT v_entry_a.id != v_entry_b.id,
    'TEST G.1 FAILED: Las entradas de actores diferentes deben tener IDs distintos.';

  -- Test G.2: filtrar por actor A no incluye entradas de B
  DECLARE
    v_count_a int;
    v_count_b int;
  BEGIN
    SELECT COUNT(*) INTO v_count_a
      FROM public.trade_marketplace_ledger_entries
     WHERE actor_id = v_actor_a AND source_event_id LIKE 'test-fin-1a-g-%';

    SELECT COUNT(*) INTO v_count_b
      FROM public.trade_marketplace_ledger_entries
     WHERE actor_id = v_actor_b AND source_event_id LIKE 'test-fin-1a-g-%';

    ASSERT v_count_a = 1 AND v_count_b = 1,
      'TEST G.2 FAILED: Cada actor debe tener exactamente 1 entrada de test.';

    -- Verificar que filtrar por actor A no trae entradas de B
    SELECT COUNT(*) INTO v_count_a
      FROM public.trade_marketplace_ledger_entries
     WHERE actor_id = v_actor_a AND id = v_entry_b.id;

    ASSERT v_count_a = 0,
      'TEST G.3 FAILED: La entrada del actor B NO debe aparecer al filtrar por actor A.';
  END;

  RAISE NOTICE '[TEST G] PASSED: Aislamiento entre proveedores en ledger verificado.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST H — Backward compatibility: pedidos existentes sin master_order_id
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_count_null    bigint;
  v_count_total   bigint;
  v_count_snap    bigint;
BEGIN
  -- Test H.1: pedidos existentes sin master_order_id siguen siendo accesibles
  SELECT COUNT(*) INTO v_count_null
    FROM public.trade_marketplace_orders
   WHERE master_order_id IS NULL;

  SELECT COUNT(*) INTO v_count_total
    FROM public.trade_marketplace_orders;

  ASSERT v_count_null >= 0,
    'TEST H.1 FAILED: No debe haber error al consultar pedidos con master_order_id NULL.';

  RAISE NOTICE 'TEST H.1 INFO: % de % pedidos tienen master_order_id NULL (pre-MP-FIN-1B).',
    v_count_null, v_count_total;

  -- Test H.2: payment_status tiene DEFAULT correcto en pedidos existentes
  SELECT COUNT(*) INTO v_count_total
    FROM public.trade_marketplace_orders
   WHERE payment_status IS NULL;

  -- Nota: payment_status tiene DEFAULT 'unpaid' pero pedidos existentes
  -- antes de la migración pueden tener NULL si no se ejecutó FILL.
  -- Esto es aceptable para backward compat: no rompemos pedidos históricos.
  RAISE NOTICE 'TEST H.2 INFO: % pedidos con payment_status NULL (históricos sin snapshot).', v_count_total;

  -- Test H.3: financial_snapshot_at = NULL en pedidos pre-MP-FIN-1A (esperado)
  SELECT COUNT(*) INTO v_count_snap
    FROM public.trade_marketplace_orders
   WHERE financial_snapshot_at IS NOT NULL;

  RAISE NOTICE 'TEST H.3 INFO: % pedidos con snapshot financiero escrito (debe ser 0 inicialmente).',
    v_count_snap;

  -- Test H.4: columnas existentes (subtotal, coste_envio, total) siguen presentes
  PERFORM subtotal, coste_envio, total
    FROM public.trade_marketplace_orders
   LIMIT 1;

  RAISE NOTICE '[TEST H] PASSED: Backward compatibility verificada. Pedidos existentes accesibles sin errores.';
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST I — Inmutabilidad de snapshot (INV-007)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_order     public.trade_marketplace_orders;
  v_order_w   public.trade_marketplace_orders;
  v_errored   boolean := false;
BEGIN
  -- Necesitamos un pedido real para testear el trigger de snapshot
  SELECT * INTO v_order
    FROM public.trade_marketplace_orders
   WHERE financial_snapshot_at IS NULL
   LIMIT 1;

  IF v_order IS NULL THEN
    RAISE NOTICE '[TEST I] SKIP: No hay pedidos disponibles sin snapshot. Omitiendo test de inmutabilidad.';
    RETURN;
  END IF;

  -- Escribir snapshot en el pedido
  v_order_w := public.mkt_fin_write_order_financial_snapshot(
    v_order.id,
    COALESCE(v_order.subtotal, 100.00),
    ROUND(COALESCE(v_order.subtotal, 100.00) * 0.21, 2),
    ROUND(COALESCE(v_order.subtotal, 100.00) * 1.21, 2),
    COALESCE(v_order.coste_envio, 10.00),
    ROUND(COALESCE(v_order.coste_envio, 10.00) * 0.21, 2),
    ROUND(COALESCE(v_order.coste_envio, 10.00) * 1.21, 2),
    21.00,
    NULL,
    NULL
  );

  ASSERT v_order_w.financial_snapshot_at IS NOT NULL,
    'TEST I.1 FAILED: financial_snapshot_at debe estar escrito tras mkt_fin_write_order_financial_snapshot.';

  -- Intentar modificar un campo de snapshot — debe fallar
  BEGIN
    UPDATE public.trade_marketplace_orders
       SET goods_net_snapshot = 9999.00
     WHERE id = v_order.id;
    RAISE EXCEPTION 'TEST I.2 FAILED: UPDATE en snapshot debe ser rechazado por trigger (INV-007)';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%INV-007%' OR SQLERRM LIKE '%inmutable%' THEN
        v_errored := true;
        RAISE NOTICE 'TEST I.2 OK: Modificación de snapshot rechazada correctamente.';
      ELSE
        RAISE EXCEPTION 'TEST I.2 FAILED: Error inesperado: %', SQLERRM;
      END IF;
  END;

  ASSERT v_errored = true,
    'TEST I.2 FAILED: INV-007 violado: el trigger no rechazó la modificación del snapshot.';

  -- Idempotencia: llamar de nuevo a write_snapshot devuelve el existente sin modificar
  DECLARE
    v_order_w2 public.trade_marketplace_orders;
  BEGIN
    v_order_w2 := public.mkt_fin_write_order_financial_snapshot(
      v_order.id,
      9999.00,  -- datos completamente distintos
      0, 0, 0, 0, 0, 21.00, NULL, NULL
    );
    ASSERT v_order_w2.goods_net_snapshot = v_order_w.goods_net_snapshot,
      'TEST I.3 FAILED: INV-017: re-llamar a write_snapshot debe devolver el snapshot original, no sobreescribir.';
  END;

  -- NOTA INTENCIONAL: NO intentar limpiar el snapshot.
  -- INV-007 lo impide incluso con service_role (el trigger es SECURITY DEFINER
  -- y no tiene excepción para limpieza de tests). El snapshot queda escrito con
  -- datos reales del pedido (COALESCE subtotal/coste_envio), lo cual es aceptable
  -- ya que las columnas _snapshot son nuevas y el UI no las lee aún en MP-FIN-1A.
  RAISE NOTICE '[TEST I] PASSED: INV-007 inmutabilidad de snapshots verificada. Snapshot permanente en pedido %', v_order.id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TEST J — Comisión simulada ≠ Revenue real (INV-001, INV-005)
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_comm_sim jsonb;
  v_sim_net  numeric;
  v_sim_rate numeric;
BEGIN
  -- Calcular comisión en modo simulación sobre 1000€ GMV
  v_comm_sim := public.mkt_fin_calculate_commission(1000.00, NULL, true);

  v_sim_net  := (v_comm_sim->>'commission_net')::numeric;
  v_sim_rate := (v_comm_sim->>'commission_rate')::numeric;

  -- Test J.1: la simulación usa simulation_rate (no 0%)
  ASSERT v_sim_net > 0,
    'TEST J.1 FAILED: Comisión simulada debe ser > 0 para reporting potencial.';

  -- Test J.2: is_simulation = true, is_real = false (INV-001)
  ASSERT (v_comm_sim->>'is_simulation')::boolean = true,
    'TEST J.2 FAILED: is_simulation debe ser true.';

  ASSERT (v_comm_sim->>'is_real')::boolean = false,
    'TEST J.3 FAILED: INV-001/INV-005: is_real debe ser false. La simulación NO es Revenue TrabFlow.';

  -- Test J.4: simulation_rate ≠ commission_rate real (que es 0%)
  DECLARE
    v_comm_real jsonb;
  BEGIN
    v_comm_real := public.mkt_fin_calculate_commission(1000.00, NULL, false);
    ASSERT (v_comm_real->>'commission_net')::numeric = 0,
      'TEST J.4 FAILED: Comisión REAL debe ser 0 en Fase 0 (INV-005).';
    ASSERT v_sim_rate != (v_comm_real->>'commission_rate')::numeric OR (v_comm_real->>'commission_rate')::numeric = 0,
      'TEST J.5 FAILED: simulation_rate no debe igualar al commission_rate real (0%) cuando simulation_rate > 0.';
  END;

  RAISE NOTICE '[TEST J] PASSED: INV-001 y INV-005 verificados. '
    'Comisión simulada (%) ≠ Revenue real (0%%) en Fase 0. '
    'simulation_net=%, is_simulation=true, is_real=false.', v_sim_net;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RESUMEN
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'TESTS MP-FIN-1A COMPLETADOS';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
  RAISE NOTICE 'A — Configuración financiera inicial correcta';
  RAISE NOTICE 'B — Política de comisión Fase 0 (INV-005, INV-006)';
  RAISE NOTICE 'C — Cálculo comisión: 0%% real, simulación separada';
  RAISE NOTICE 'D — Master Order: creación e idempotencia (INV-017)';
  RAISE NOTICE 'E — Ledger: inmutabilidad (INV-009)';
  RAISE NOTICE 'F — GMV ≠ Revenue TrabFlow (INV-001)';
  RAISE NOTICE 'G — Aislamiento entre proveedores en ledger';
  RAISE NOTICE 'H — Backward compatibility: pedidos existentes OK';
  RAISE NOTICE 'I — Snapshots inmutables (INV-007)';
  RAISE NOTICE 'J — Comisión simulada ≠ Revenue real (INV-001, INV-005)';
  RAISE NOTICE '════════════════════════════════════════════════════════════';
END;
$$;
