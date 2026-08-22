-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-2A · Migración 12
-- Provider Balance Projections — capa de saldos por proveedor
-- ════════════════════════════════════════════════════════════════════════════
--
-- PRINCIPIO FUNDAMENTAL: LEDGER = SOURCE OF TRUTH
--   trade_marketplace_balances es una PROYECCIÓN derivada del ledger.
--   NO es una segunda contabilidad independiente.
--   INV-B04: si balance != ledger, prevalece el ledger.
--   Existe siempre un rebuild_from_ledger que produce el mismo resultado.
--
-- SEMÁNTICA DE BUCKETS (Phase 2A):
--   pending_amount:           ventas atribuidas, no disponibles aún
--   available_amount:         podría liquidarse (Phase 2A = 0, BUSINESS_RULE_GATE)
--   reserved_amount:          retenido conceptualmente (Phase 2A = 0, MP-FIN-2E)
--   negative_amount:          valor absoluto de déficit (Phase 2A = 0 normal)
--   historical_settled_amount: FLUJO HISTÓRICO acumulado ya pagado (Phase 2A = 0, MP-FIN-2F)
--                              NO forma parte de total_economic_balance (ya salió)
--
-- FÓRMULA:
--   total_economic_balance = pending + available + reserved - negative
--   (historical_settled excluido: doble contabilización prohibida, INV-B03)
--
--   Phase 2A:
--   pending = SUM(GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT)
--             WHERE actor_id=X AND status!='failed' AND currency=Y
--   INV-B01: total_economic_balance = ledger_economic_total
--   INV-B02: COMMISSION_ACCRUAL ni SIM_ACCRUAL afectan ningún bucket
--
-- COMISIÓN SIMULADA:
--   simulation_rate=0.02 es exclusivamente analítica.
--   NO reduce pending, available, reserved, negative ni provider_payable.
--   STRIPE_GATE / COMMISSION_GATE cerrados.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tabla de proyección de balances por proveedor ──────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_balances (
  id                        uuid         NOT NULL DEFAULT gen_random_uuid(),
  provider_actor_id         uuid         NOT NULL,
  currency                  char(3)      NOT NULL DEFAULT 'EUR',

  -- STOCK: posición actual (saldo vivo)
  pending_amount            numeric(15,4) NOT NULL DEFAULT 0,   -- ventas atribuidas, pendientes de disponibilidad
  available_amount          numeric(15,4) NOT NULL DEFAULT 0,   -- disponible para liquidar (BUSINESS_RULE_GATE Phase 2A=0)
  reserved_amount           numeric(15,4) NOT NULL DEFAULT 0,   -- retenido (MP-FIN-2E Phase 2A=0)
  negative_amount           numeric(15,4) NOT NULL DEFAULT 0,   -- déficit absoluto (MP-FIN-2D Phase 2A=0)

  -- FLUJO HISTÓRICO: acumulado de pagos ya realizados
  -- NO forma parte de total_economic_balance (ya salió del saldo)
  -- INV-B03: prohibida su suma a stock buckets
  historical_settled_amount numeric(15,4) NOT NULL DEFAULT 0,   -- MP-FIN-2F Phase 2A=0

  -- COMPUTED: posición económica actual neta
  -- total_economic_balance = pending + available + reserved - negative
  total_economic_balance    numeric(15,4)
    GENERATED ALWAYS AS (pending_amount + available_amount + reserved_amount - negative_amount)
    STORED,

  -- Metadatos de la proyección
  last_ledger_entry_id      uuid,         -- entrada más reciente del ledger incluida
  last_recalculated_at      timestamptz,  -- cuándo se recalculó por última vez
  projection_strategy       text         NOT NULL DEFAULT 'ledger_rebuild',  -- cómo se construyó

  created_at                timestamptz  NOT NULL DEFAULT now(),
  updated_at                timestamptz  NOT NULL DEFAULT now(),

  PRIMARY KEY (id),
  UNIQUE (provider_actor_id, currency),   -- INV: 1 fila por (proveedor, moneda)

  CONSTRAINT fk_balance_actor
    FOREIGN KEY (provider_actor_id) REFERENCES public.trade_marketplace_actors(id),
  CONSTRAINT fk_balance_last_entry
    FOREIGN KEY (last_ledger_entry_id)
      REFERENCES public.trade_marketplace_ledger_entries(id) DEFERRABLE INITIALLY DEFERRED,

  -- INVARIANTES: todos los buckets son no negativos (negative_amount es valor absoluto)
  CONSTRAINT chk_pending_nn    CHECK (pending_amount >= 0),
  CONSTRAINT chk_available_nn  CHECK (available_amount >= 0),
  CONSTRAINT chk_reserved_nn   CHECK (reserved_amount >= 0),
  CONSTRAINT chk_negative_nn   CHECK (negative_amount >= 0),
  CONSTRAINT chk_settled_nn    CHECK (historical_settled_amount >= 0)
);

COMMENT ON TABLE public.trade_marketplace_balances IS
  'Proyección de balances por proveedor. LEDGER=SOURCE OF TRUTH. '
  'Esta tabla es cache reconstruible: rebuild_from_ledger produce el mismo resultado. '
  'Phase 2A: pending=SUM(GOODS+SHIP entitlements), available=reserved=settled=negative=0. '
  'INV-B01: total_economic_balance=ledger_economic_total. '
  'INV-B03: historical_settled es flujo histórico, NO stock actual.';

COMMENT ON COLUMN public.trade_marketplace_balances.total_economic_balance IS
  'COMPUTED: pending+available+reserved-negative. '
  'historical_settled excluido intencionalmente (INV-B03).';
COMMENT ON COLUMN public.trade_marketplace_balances.historical_settled_amount IS
  'FLUJO HISTÓRICO — dinero ya pagado al proveedor. '
  'NO sumar a pending/available/reserved. Doble contabilización prohibida (INV-B03). '
  'Phase 2A=0. Settlement Engine: MP-FIN-2F.';

-- ── 2. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_balances_actor_currency
  ON public.trade_marketplace_balances (provider_actor_id, currency);

CREATE INDEX IF NOT EXISTS idx_balances_last_recalculated
  ON public.trade_marketplace_balances (last_recalculated_at);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_balances ENABLE ROW LEVEL SECURITY;

-- Proveedor solo ve sus propios balances
CREATE POLICY "balance_select_own_actor"
  ON public.trade_marketplace_balances
  FOR SELECT
  TO authenticated
  USING (
    provider_actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

-- Solo platform_admin puede hacer UPDATE (proyección se actualiza por funciones SECURITY DEFINER)
CREATE POLICY "balance_admin_all"
  ON public.trade_marketplace_balances
  FOR ALL
  TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ── 4. Trigger updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._trg_set_balance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_balance_updated_at
  BEFORE UPDATE ON public.trade_marketplace_balances
  FOR EACH ROW EXECUTE FUNCTION public._trg_set_balance_updated_at();

-- ── 5. mkt_fin_rebuild_provider_balance ──────────────────────────────────────
-- Reconstruye la proyección completa desde el ledger. Idempotente.
-- Cualquier llamada repetida produce el mismo resultado (INV-B04).
-- Phase 2A: pending = SUM(GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT) WHERE status!='failed'
-- La comisión simulada (COMMISSION_SIM_ACCRUAL) se ignora — nunca afecta saldos.
-- La comisión real (COMMISSION_ACCRUAL) es 0 en Phase 0 → no resta.

CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(
  p_actor_id  uuid,
  p_currency  text DEFAULT 'EUR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending           numeric(15,4) := 0;
  v_available         numeric(15,4) := 0;   -- BUSINESS_RULE_GATE Phase 2A=0
  v_reserved          numeric(15,4) := 0;   -- MP-FIN-2E Phase 2A=0
  v_negative          numeric(15,4) := 0;   -- MP-FIN-2D Phase 2A=0
  v_settled           numeric(15,4) := 0;   -- MP-FIN-2F Phase 2A=0
  v_last_entry_id     uuid;
  v_entry_count       int;
  v_prior_balance     numeric(15,4);
  v_actor_exists      bool;
BEGIN
  -- Verificar que el actor existe
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id)
    INTO v_actor_exists;
  IF NOT v_actor_exists THEN
    RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id;
  END IF;

  -- ── PHASE 2A: PENDING = SUM(GOODS_ENTITLEMENT + SHIPPING_ENTITLEMENT) ──────
  -- Future phases añadirán aquí:
  --   - GOODS_REFUND_REVERSAL / SHIPPING_REFUND_REVERSAL     → restan de pending  (MP-FIN-2B)
  --   - RESERVE_HOLD (net de RESERVE_RELEASE)                → mueven de available a reserved (MP-FIN-2E)
  --   - SETTLEMENT_DEBIT                                     → reducen available, incrementan settled (MP-FIN-2F)
  --   - CHARGEBACK_DEBIT                                     → reducen pending/available, incrementan negative (MP-FIN-2C)
  --   - NEGATIVE_BALANCE_RECORD / BALANCE_RECOVERY           → ajustan negative (MP-FIN-2D)
  --
  -- NO incluir:
  --   COMMISSION_ACCRUAL         (0 en Phase 0, no afecta provider balance)
  --   COMMISSION_SIM_ACCRUAL     (analítico exclusivamente, jamás toca saldos)
  --   BUYER_PAYMENT              (perspectiva plataforma, no proveedor)
  --   COMMISSION_TAX_*           (pendiente TAX_GATE)
  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN ('GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT')
        AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed'),
    (SELECT l2.id FROM public.trade_marketplace_ledger_entries l2
      WHERE l2.actor_id = p_actor_id
        AND l2.currency::text = p_currency
        AND l2.status != 'failed'
      ORDER BY l2.occurred_at DESC, l2.created_at DESC
      LIMIT 1)
  INTO v_pending, v_entry_count, v_last_entry_id
  FROM public.trade_marketplace_ledger_entries
  WHERE actor_id = p_actor_id
    AND currency::text = p_currency;

  -- Guardar balance previo para audit diff
  SELECT COALESCE(total_economic_balance, 0) INTO v_prior_balance
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::char(3) = p_currency::char(3);

  -- UPSERT de la proyección
  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount,
    last_ledger_entry_id, last_recalculated_at,
    projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative,
    v_settled,
    v_last_entry_id, now(),
    'ledger_rebuild'
  )
  ON CONFLICT (provider_actor_id, currency) DO UPDATE SET
    pending_amount            = EXCLUDED.pending_amount,
    available_amount          = EXCLUDED.available_amount,
    reserved_amount           = EXCLUDED.reserved_amount,
    negative_amount           = EXCLUDED.negative_amount,
    historical_settled_amount = EXCLUDED.historical_settled_amount,
    last_ledger_entry_id      = EXCLUDED.last_ledger_entry_id,
    last_recalculated_at      = EXCLUDED.last_recalculated_at,
    projection_strategy       = EXCLUDED.projection_strategy;

  -- Audit
  PERFORM public.mkt_fin_audit(
    'provider_balance_rebuilt',
    'provider_balance',
    p_actor_id,
    NULL, NULL,
    jsonb_build_object(
      'actor_id',              p_actor_id,
      'currency',              p_currency,
      'pending_amount',        v_pending,
      'available_amount',      v_available,
      'reserved_amount',       v_reserved,
      'negative_amount',       v_negative,
      'historical_settled',    v_settled,
      'total_economic',        v_pending + v_available + v_reserved - v_negative,
      'ledger_entries_read',   v_entry_count,
      'last_ledger_entry_id',  v_last_entry_id,
      'prior_total',           v_prior_balance,
      'phase',                 '2A',
      'note',                  'Rebuild desde ledger. commission_sim excluido (INV-B02).'
    ),
    'Rebuild balance desde ledger — idempotente',
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'status',               'rebuilt',
    'actor_id',             p_actor_id,
    'currency',             p_currency,
    'pending_amount',       v_pending,
    'available_amount',     v_available,
    'reserved_amount',      v_reserved,
    'negative_amount',      v_negative,
    'historical_settled',   v_settled,
    'total_economic_balance', v_pending + v_available + v_reserved - v_negative,
    'ledger_entries_read',  v_entry_count,
    'last_ledger_entry_id', v_last_entry_id,
    'recalculated_at',      now(),
    'projection_strategy',  'ledger_rebuild'
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_rebuild_provider_balance IS
  'Reconstruye la proyección de saldo de un proveedor leyendo el ledger completo. '
  'Idempotente: llamadas repetidas producen el mismo resultado (INV-B04). '
  'Phase 2A: pending=SUM(GOODS+SHIP), available=reserved=negative=settled=0. '
  'COMMISSION_SIM_ACCRUAL excluida de todos los buckets (INV-B02). '
  'El resultado se almacena en trade_marketplace_balances.';

GRANT EXECUTE ON FUNCTION public.mkt_fin_rebuild_provider_balance TO authenticated;

-- ── 6. mkt_fin_get_provider_balance ──────────────────────────────────────────
-- Devuelve el saldo almacenado (proyección). No reconstruye.
-- Si no existe, devuelve balance 0 sin crear registro.

CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_balance(
  p_actor_id  uuid,
  p_currency  text DEFAULT 'EUR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance  RECORD;
  v_has_access boolean;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'ACCESS_DENIED: sin acceso al balance del actor %', p_actor_id;
  END IF;

  SELECT * INTO v_balance
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id
     AND currency::text = p_currency;

  IF NOT FOUND THEN
    -- Sin registro: balance cero estructural (proveedor sin operaciones)
    RETURN jsonb_build_object(
      'actor_id',              p_actor_id,
      'currency',              p_currency,
      'pending_amount',        0,
      'available_amount',      0,
      'reserved_amount',       0,
      'negative_amount',       0,
      'historical_settled',    0,
      'total_economic_balance', 0,
      'last_recalculated_at',  null,
      'projection_exists',     false,
      'note',                  'Sin proyección almacenada. Llamar mkt_fin_rebuild_provider_balance.'
    );
  END IF;

  RETURN jsonb_build_object(
    'actor_id',              p_actor_id,
    'currency',              p_currency,
    'pending_amount',        v_balance.pending_amount,
    'available_amount',      v_balance.available_amount,
    'reserved_amount',       v_balance.reserved_amount,
    'negative_amount',       v_balance.negative_amount,
    'historical_settled',    v_balance.historical_settled_amount,
    'total_economic_balance', v_balance.total_economic_balance,
    'last_ledger_entry_id',  v_balance.last_ledger_entry_id,
    'last_recalculated_at',  v_balance.last_recalculated_at,
    'projection_strategy',   v_balance.projection_strategy,
    'projection_exists',     true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_get_provider_balance TO authenticated;

-- ── 7. mkt_fin_reconcile_provider_balance ────────────────────────────────────
-- Compara la proyección almacenada vs el valor derivado del ledger.
-- NO modifica la tabla. Solo diagnóstico.
-- Resultado: {status:'MATCH'|'MISMATCH', expected_total, stored_total, difference, ...}

CREATE OR REPLACE FUNCTION public.mkt_fin_reconcile_provider_balance(
  p_actor_id  uuid,
  p_currency  text DEFAULT 'EUR'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ledger_derived  numeric(15,4) := 0;
  v_stored_total    numeric(15,4) := 0;
  v_difference      numeric(15,4);
  v_status          text;
  v_has_access      boolean;
  v_entry_count     int;
  v_projection_at   timestamptz;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'ACCESS_DENIED: sin acceso al balance del actor %', p_actor_id;
  END IF;

  -- Derivar desde ledger (misma lógica que rebuild — debe coincidir exactamente)
  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN ('GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT')
        AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed')
  INTO v_ledger_derived, v_entry_count
  FROM public.trade_marketplace_ledger_entries
  WHERE actor_id = p_actor_id
    AND currency::text = p_currency;

  -- Leer proyección almacenada
  SELECT COALESCE(total_economic_balance, 0), last_recalculated_at
    INTO v_stored_total, v_projection_at
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  v_difference := v_ledger_derived - v_stored_total;
  v_status := CASE WHEN ABS(v_difference) < 0.0001 THEN 'MATCH' ELSE 'MISMATCH' END;

  IF v_status = 'MISMATCH' THEN
    PERFORM public.mkt_fin_audit(
      'provider_balance_reconciliation_mismatch',
      'provider_balance',
      p_actor_id,
      NULL, NULL,
      jsonb_build_object(
        'actor_id',         p_actor_id,
        'currency',         p_currency,
        'ledger_derived',   v_ledger_derived,
        'stored_total',     v_stored_total,
        'difference',       v_difference,
        'severity',         'WARNING'
      ),
      'Balance almacenado difiere del ledger — reconstruir con mkt_fin_rebuild_provider_balance',
      NULL,
      NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'actor_id',            p_actor_id,
    'currency',            p_currency,
    'status',              v_status,
    'expected_total',      v_ledger_derived,
    'stored_total',        v_stored_total,
    'difference',          v_difference,
    'ledger_entries_used', v_entry_count,
    'projection_at',       v_projection_at,
    'checked_at',          now(),
    'reconciliation_note', CASE WHEN v_status = 'MATCH'
      THEN 'Proyección correcta — ledger y balance coinciden'
      ELSE 'MISMATCH detectado. Ejecutar mkt_fin_rebuild_provider_balance para corregir.'
    END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_reconcile_provider_balance TO authenticated;

-- ── 8. mkt_fin_admin_balances_overview ───────────────────────────────────────
-- KPIs de balances para admin. Solo platform_admin.

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_balances_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso solo para platform_admin';
  END IF;

  RETURN jsonb_build_object(
    'total_provider_pending',     (SELECT COALESCE(SUM(pending_amount), 0) FROM public.trade_marketplace_balances),
    'total_provider_available',   (SELECT COALESCE(SUM(available_amount), 0) FROM public.trade_marketplace_balances),
    'total_provider_reserved',    (SELECT COALESCE(SUM(reserved_amount), 0) FROM public.trade_marketplace_balances),
    'total_provider_negative',    (SELECT COALESCE(SUM(negative_amount), 0) FROM public.trade_marketplace_balances),
    'total_historical_settled',   (SELECT COALESCE(SUM(historical_settled_amount), 0) FROM public.trade_marketplace_balances),
    'total_economic_balance',     (SELECT COALESCE(SUM(total_economic_balance), 0) FROM public.trade_marketplace_balances),
    'providers_with_balance',     (SELECT COUNT(*) FROM public.trade_marketplace_balances),
    'providers_with_pending',     (SELECT COUNT(*) FROM public.trade_marketplace_balances WHERE pending_amount > 0),
    'providers_with_available',   (SELECT COUNT(*) FROM public.trade_marketplace_balances WHERE available_amount > 0),
    'providers_with_negative',    (SELECT COUNT(*) FROM public.trade_marketplace_balances WHERE negative_amount > 0),
    'phase',                      '2A',
    'invariant_note',             'total_historical_settled es flujo histórico, NO incluido en total_economic_balance (INV-B03)',
    'commission_note',            'simulation_rate=2% analítica. NO reduce ningún bucket (INV-B02).',
    'calculated_at',              now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_admin_balances_overview TO authenticated;

-- ── 9. Extender mkt_fin_get_provider_financial_summary con balances ───────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_financial_summary(
  p_actor_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result     jsonb;
  v_balance    jsonb;
  v_has_access boolean;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Acceso denegado al resumen financiero del proveedor %', p_actor_id;
  END IF;

  -- Financial summary desde snapshots
  SELECT jsonb_build_object(
    'actor_id',                  p_actor_id,
    'gmv_goods_gross',           COALESCE(SUM(so.goods_gross_snapshot), 0),
    'gmv_goods_net',             COALESCE(SUM(so.goods_net_snapshot), 0),
    'gmv_shipping_gross',        COALESCE(SUM(so.shipping_gross_snapshot), 0),
    'total_supplier_orders',     COUNT(so.id),
    'orders_with_snapshot',      COUNT(so.id) FILTER (WHERE so.financial_snapshot_at IS NOT NULL),
    'orders_pending_payment',    COUNT(so.id) FILTER (WHERE so.payment_status = 'unpaid'),
    'orders_paid',               COUNT(so.id) FILTER (WHERE so.payment_status = 'paid'),
    'commission_real_accrued',   COALESCE(SUM(so.commission_gross_snapshot), 0),
    'commission_sim_accrued',    COALESCE(SUM(so.sim_commission_gross), 0),
    'provider_payable_total',    COALESCE(SUM(so.provider_payable_snapshot), 0),
    'refunded_total',            COALESCE(SUM(so.refunded_amount), 0),
    'ledger_entries_count', (
      SELECT COUNT(*) FROM public.trade_marketplace_ledger_entries
       WHERE actor_id = p_actor_id AND status != 'failed'
    ),
    'currency', 'EUR'
  )
  INTO v_result
  FROM public.trade_marketplace_orders so
  WHERE so.actor_id = p_actor_id
    AND so.estado != 'cancelled';

  -- Balance projection (si existe)
  v_balance := public.mkt_fin_get_provider_balance(p_actor_id, 'EUR');

  -- Combinar
  v_result := v_result || jsonb_build_object(
    'balance', v_balance,
    'calculated_at', now(),
    'note', jsonb_build_object(
      'real_commission', 'En Fase 0: commission_real_accrued=0 (INV-005).',
      'sim_commission',  'commission_sim_accrued es potencial hipotetico (INV-B02: no reduce balance).',
      'balance_phase',   'Phase 2A: pending=payable, available=reserved=settled=0 (BUSINESS_RULE_GATE).'
    )
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_get_provider_financial_summary TO authenticated;

-- ── 10. Extender mkt_fin_admin_overview con totales de balance ────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'Acceso solo para platform_admin';
  END IF;

  RETURN jsonb_build_object(
    'gmv_total_goods_net', (
      SELECT COALESCE(SUM(goods_net_total), 0)
        FROM public.trade_marketplace_master_orders
       WHERE order_status NOT IN ('cancelled')
    ),
    'gmv_total_goods_gross', (
      SELECT COALESCE(SUM(goods_gross_total), 0)
        FROM public.trade_marketplace_master_orders
       WHERE order_status NOT IN ('cancelled')
    ),
    'trabflow_revenue_marketplace_real', (
      SELECT COALESCE(SUM(commission_net_snapshot), 0)
        FROM public.trade_marketplace_orders
       WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL
    ),
    'trabflow_revenue_marketplace_simulated', (
      SELECT COALESCE(SUM(sim_commission_net), 0)
        FROM public.trade_marketplace_orders
       WHERE estado != 'cancelled' AND financial_snapshot_at IS NOT NULL
    ),
    'master_orders_total',    (SELECT COUNT(*) FROM public.trade_marketplace_master_orders),
    'supplier_orders_total',  (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NOT NULL),
    'supplier_orders_legacy', (SELECT COUNT(*) FROM public.trade_marketplace_orders WHERE master_order_id IS NULL),
    'active_providers', (
      SELECT COUNT(DISTINCT actor_id)
        FROM public.trade_marketplace_orders
       WHERE created_at > now() - interval '30 days'
    ),
    'ledger_entries_total', (SELECT COUNT(*) FROM public.trade_marketplace_ledger_entries),
    -- Balances agregados (MP-FIN-2A)
    'provider_balances', (
      SELECT jsonb_build_object(
        'total_pending',   COALESCE(SUM(pending_amount), 0),
        'total_available', COALESCE(SUM(available_amount), 0),
        'total_reserved',  COALESCE(SUM(reserved_amount), 0),
        'total_negative',  COALESCE(SUM(negative_amount), 0),
        'total_economic',  COALESCE(SUM(total_economic_balance), 0),
        'providers_count', COUNT(*),
        'note',            'total_historical_settled excluido: ya saliO del saldo (INV-B03)'
      ) FROM public.trade_marketplace_balances
    ),
    'payment_mode',           public.mkt_fin_get_config('payment.mode'),
    'real_payments_enabled',  public.mkt_fin_get_config('payment.real_payments_enabled'),
    'commission_enabled',     public.mkt_fin_get_config('commission.enabled'),
    'calculated_at', now(),
    'warning', 'gmv_total_goods_* NO es ingreso de TrabFlow (INV-001). trabflow_revenue_* es comision de plataforma. En Fase 0 ambas =0.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_admin_overview TO authenticated;

-- ── 11. Actualizar mkt_fin_post_checkout_ledger con refresh de balances ───────
-- Después de postear el ledger, reconstruir balances de los proveedores afectados.
-- No-blocking: fallo de balance NO bloquea el ledger ni el checkout.

CREATE OR REPLACE FUNCTION public.mkt_fin_post_checkout_ledger(
  p_master_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_master          RECORD;
  v_supplier        RECORD;
  v_correlation     text;
  v_entry_count     int := 0;
  v_suppliers_count int := 0;
  v_existing_count  int;
  v_actor_row       RECORD;
BEGIN
  IF public.mkt_fin_config_bool('payment.real_payments_enabled', false) THEN
    RAISE EXCEPTION
      'LEDGER_SIM_BLOCKED: payment.real_payments_enabled=true. '
      'No se puede postear ledger simulado con pagos reales activos. (STRIPE_GATE)';
  END IF;

  SELECT mo.* INTO v_master
    FROM public.trade_marketplace_master_orders mo
   WHERE mo.id = p_master_order_id;

  IF v_master.id IS NULL THEN
    RAISE EXCEPTION 'MASTER_ORDER_NOT_FOUND: %', p_master_order_id;
  END IF;

  IF auth.uid() IS NOT NULL AND NOT public._mkt_is_platform_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE user_id = auth.uid() AND org_id = v_master.org_id
    ) THEN
      RAISE EXCEPTION 'ACCESS_DENIED: No es miembro de la organizacion del pedido';
    END IF;
  END IF;

  v_correlation := 'mkt-chk-' || v_master.checkout_key;

  SELECT COUNT(*) INTO v_existing_count
    FROM public.trade_marketplace_ledger_entries
   WHERE correlation_id = v_correlation
     AND entry_type IN ('GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT');

  IF v_existing_count > 0 THEN
    PERFORM public.mkt_fin_audit(
      'checkout_ledger_replayed', 'master_order', p_master_order_id,
      NULL, NULL,
      jsonb_build_object('master_num', v_master.numero, 'correlation_id', v_correlation,
        'existing_entries', v_existing_count),
      'Replay idempotente — ledger ya estaba posteado', v_correlation, NULL
    );
    RETURN jsonb_build_object(
      'status', 'replayed', 'entry_count', v_existing_count,
      'correlation_id', v_correlation, 'suppliers_processed', 0,
      'master_order_num', v_master.numero, 'model', 'B-gross'
    );
  END IF;

  PERFORM public.mkt_fin_audit(
    'checkout_ledger_posting_started', 'master_order', p_master_order_id,
    NULL, NULL,
    jsonb_build_object('master_num', v_master.numero, 'correlation_id', v_correlation),
    'Inicio posting ledger simulado', v_correlation, NULL
  );

  FOR v_supplier IN
    SELECT so.id,
           so.actor_id,
           COALESCE(so.goods_gross_snapshot,    0) AS goods_gross,
           COALESCE(so.shipping_gross_snapshot,  0) AS shipping_gross,
           COALESCE(so.provider_payable_snapshot,0) AS provider_payable,
           COALESCE(so.currency, 'EUR')             AS currency
      FROM public.trade_marketplace_orders so
     WHERE so.master_order_id = p_master_order_id
       AND so.financial_snapshot_at IS NOT NULL
     ORDER BY so.created_at
  LOOP
    v_suppliers_count := v_suppliers_count + 1;

    PERFORM public.mkt_fin_ledger_append(
      'GOODS_ENTITLEMENT', v_supplier.goods_gross, p_master_order_id,
      v_supplier.id, v_supplier.actor_id,
      'Mercancia checkout · gross = net+IVA [TAX_GATE] · GMV proveedor (INV-001)',
      v_correlation,
      'mkt-chk-' || v_master.checkout_key || '-' || v_supplier.id::text || '-GOODS',
      NULL, 'simulation', NULL, NULL, v_supplier.currency, 'confirmed', v_master.created_at
    );
    v_entry_count := v_entry_count + 1;

    IF v_supplier.shipping_gross > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'SHIPPING_ENTITLEMENT', v_supplier.shipping_gross, p_master_order_id,
        v_supplier.id, v_supplier.actor_id,
        'Portes checkout · gross = net+IVA [TAX_GATE] · GMV portes (INV-001)',
        v_correlation,
        'mkt-chk-' || v_master.checkout_key || '-' || v_supplier.id::text || '-SHIP',
        NULL, 'simulation', NULL, NULL, v_supplier.currency, 'confirmed', v_master.created_at
      );
      v_entry_count := v_entry_count + 1;
    END IF;
    -- COMMISSION: NO se escribe (commission=0 Phase 0, INV-L03/L04)
  END LOOP;

  IF v_suppliers_count = 0 THEN
    RAISE EXCEPTION
      'NO_SNAPSHOTTED_ORDERS: El master order % no tiene supplier_orders con '
      'financial_snapshot_at.', p_master_order_id;
  END IF;

  PERFORM public.mkt_fin_outbox_publish(
    'marketplace.simulation.checkout_posted',
    jsonb_build_object(
      'master_order_id', p_master_order_id, 'master_order_num', v_master.numero,
      'checkout_key', v_master.checkout_key, 'correlation_id', v_correlation,
      'suppliers_processed', v_suppliers_count, 'entry_count', v_entry_count,
      'simulation_only', true, 'real_commission', 0, 'real_revenue', 0,
      'ledger_model', 'B-gross',
      'note', 'Ledger simulado inicial. Pagos reales: desactivados (STRIPE_GATE).'
    ),
    NULL, v_master.org_id
  );

  PERFORM public.mkt_fin_audit(
    'checkout_ledger_posted', 'master_order', p_master_order_id,
    NULL, NULL,
    jsonb_build_object(
      'master_num', v_master.numero, 'correlation_id', v_correlation,
      'entry_count', v_entry_count, 'suppliers_processed', v_suppliers_count,
      'ledger_model', 'B-gross', 'inv_l03_ok', true, 'inv_l04_ok', true
    ),
    'Ledger simulado inicial posteado correctamente', v_correlation, NULL
  );

  -- ── STEP +1: Rebuild balance projection per provider (non-blocking) ─────────
  -- Un fallo aqui NO invalida el ledger ni el checkout.
  -- El rebuild puede re-ejecutarse manualmente llamando mkt_fin_rebuild_provider_balance.
  FOR v_actor_row IN
    SELECT DISTINCT so.actor_id, COALESCE(so.currency, 'EUR') AS currency
      FROM public.trade_marketplace_orders so
     WHERE so.master_order_id = p_master_order_id
       AND so.financial_snapshot_at IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.mkt_fin_rebuild_provider_balance(v_actor_row.actor_id, v_actor_row.currency);
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.mkt_fin_audit(
        'provider_balance_refresh_failed', 'provider_balance', v_actor_row.actor_id,
        NULL, NULL,
        jsonb_build_object('error', SQLERRM, 'actor_id', v_actor_row.actor_id,
          'currency', v_actor_row.currency, 'master_order_id', p_master_order_id),
        'Balance refresh falló — ledger intacto, rebuild manual posible',
        v_correlation, NULL
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'status', 'posted', 'entry_count', v_entry_count, 'correlation_id', v_correlation,
    'suppliers_processed', v_suppliers_count, 'master_order_num', v_master.numero,
    'model', 'B-gross'
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_post_checkout_ledger IS
  'Genera las entradas iniciales del ledger de simulacion (MP-FIN-1B.2) y '
  'reconstruye balances por proveedor (MP-FIN-2A) en bloque no-bloqueante. '
  'LEDGER=SOURCE OF TRUTH. Balance rebuild es idempotente.';

GRANT EXECUTE ON FUNCTION public.mkt_fin_post_checkout_ledger TO authenticated;

COMMIT;
