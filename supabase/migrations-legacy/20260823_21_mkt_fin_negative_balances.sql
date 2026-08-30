-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2D — Negative Balances + Recovery Infrastructure
--
-- LEDGER = SOURCE OF TRUTH. trade_marketplace_balances es proyección.
-- NEGATIVE ≠ REFUND ≠ DISPUTE. Entidad propia con ciclo de vida propio.
-- Aislamiento: A negativo ≠ afecta B. EUR negativo ≠ USD negativo.
-- LEGAL_GATE + STRIPE_GATE: simulation_only = true en todo.
-- FUTURE_SETOFF (positivo): amortiza déficit anticipando cobro futuro.
-- BALANCE_RECOVERY (positivo): pago manual proveedor → TrabFlow.
-- Venta futura SIEMPRE queda como GOODS_ENTITLEMENT original intacto.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 1 — Extensión de trade_marketplace_balances
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_marketplace_balances
  ADD COLUMN IF NOT EXISTS negative_since       timestamptz,
  ADD COLUMN IF NOT EXISTS recovery_in_progress bool NOT NULL DEFAULT false;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 2 — Tabla trade_marketplace_recoveries
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_marketplace_recoveries (
  id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_number          text         UNIQUE NOT NULL,
  provider_actor_id        uuid         NOT NULL
    REFERENCES public.trade_marketplace_actors(id),
  currency                 char(3)      NOT NULL DEFAULT 'EUR',
  deficit_amount           numeric(15,4) NOT NULL CHECK (deficit_amount > 0),
  recovered_amount         numeric(15,4) NOT NULL DEFAULT 0
    CHECK (recovered_amount >= 0 AND recovered_amount <= deficit_amount),
  recovery_type            text         NOT NULL
    CHECK (recovery_type IN ('future_sales_offset', 'manual_simulation')),
  status                   text         NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  simulation_only          bool         NOT NULL DEFAULT true,
  negative_since           timestamptz,
  negative_origin_entry_id uuid
    REFERENCES public.trade_marketplace_ledger_entries(id),
  initiated_at             timestamptz  NOT NULL DEFAULT now(),
  completed_at             timestamptz,
  cancelled_at             timestamptz,
  notes                    text,
  correlation_id           text,
  idempotency_key          text         UNIQUE,
  metadata                 jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recoveries_provider_currency
  ON public.trade_marketplace_recoveries(provider_actor_id, currency);
CREATE INDEX IF NOT EXISTS idx_recoveries_status
  ON public.trade_marketplace_recoveries(status)
  WHERE status IN ('pending', 'partial');
CREATE INDEX IF NOT EXISTS idx_recoveries_idempotency
  ON public.trade_marketplace_recoveries(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_recoveries_updated_at
  BEFORE UPDATE ON public.trade_marketplace_recoveries
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 3 — RLS para trade_marketplace_recoveries
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_marketplace_recoveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recoveries_provider_select ON public.trade_marketplace_recoveries;
CREATE POLICY recoveries_provider_select
  ON public.trade_marketplace_recoveries FOR SELECT
  USING (
    public._mkt_is_platform_admin()
    OR provider_actor_id = ANY(public._mkt_actor_ids_for_user())
  );

DROP POLICY IF EXISTS recoveries_admin_all ON public.trade_marketplace_recoveries;
CREATE POLICY recoveries_admin_all
  ON public.trade_marketplace_recoveries FOR ALL
  USING (public._mkt_is_platform_admin());

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 4 — mkt_fin_rebuild_provider_balance Phase 2D
--
-- Fórmula Phase 2D:
--   ledger_sum = SUM de entries activas (GOODS_ENTITLEMENT, SHIPPING_ENTITLEMENT,
--     GOODS_REFUND_REVERSAL, SHIPPING_REFUND_REVERSAL,
--     CHARGEBACK_DEBIT, CHARGEBACK_CREDIT, CHARGEBACK_FEE,
--     BALANCE_RECOVERY, FUTURE_SETOFF)
--   EXCLUYE: NEGATIVE_BALANCE_RECORD (informacional, no movimiento)
--   Si sum >= 0: pending = sum, negative = 0, limpiar negative_since
--   Si sum < 0:  pending = 0, negative = abs(sum), mantener/iniciar negative_since
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(
  p_actor_id uuid,
  p_currency  text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ledger_sum         numeric(15,4) := 0;
  v_pending            numeric(15,4) := 0;
  v_available          numeric(15,4) := 0;
  v_reserved           numeric(15,4) := 0;
  v_negative           numeric(15,4) := 0;
  v_settled            numeric(15,4) := 0;
  v_last_entry_id      uuid;
  v_entry_count        int;
  v_prior_balance      numeric(15,4);
  v_prior_negative_since timestamptz;
  v_new_negative_since   timestamptz;
  v_has_active_recovery  bool := false;
  v_actor_exists         bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id)
    INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;

  -- Suma del ledger (Phase 2D: incluye BALANCE_RECOVERY + FUTURE_SETOFF)
  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT',     'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL', 'SHIPPING_REFUND_REVERSAL',
        'CHARGEBACK_DEBIT',      'CHARGEBACK_CREDIT',     'CHARGEBACK_FEE',
        'BALANCE_RECOVERY',      'FUTURE_SETOFF'
        -- NEGATIVE_BALANCE_RECORD excluido: informacional, no movimiento
      ) AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed'),
    (SELECT l2.id
       FROM public.trade_marketplace_ledger_entries l2
      WHERE l2.actor_id = p_actor_id
        AND l2.currency::text = p_currency
        AND l2.status != 'failed'
      ORDER BY l2.occurred_at DESC, l2.created_at DESC
      LIMIT 1)
    INTO v_ledger_sum, v_entry_count, v_last_entry_id
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id
     AND currency::text = p_currency;

  -- Preservar negative_since y balance previo para audit
  SELECT COALESCE(total_economic_balance, 0), negative_since
    INTO v_prior_balance, v_prior_negative_since
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  -- Split ledger_sum en pending vs negative (invariante Phase 2D)
  IF v_ledger_sum >= 0 THEN
    v_pending             := v_ledger_sum;
    v_negative            := 0;
    v_new_negative_since  := NULL;  -- balance recuperado, limpiar aging
  ELSE
    v_pending             := 0;
    v_negative            := ABS(v_ledger_sum);
    -- Preservar negative_since original para aging correcto
    v_new_negative_since  := COALESCE(v_prior_negative_since, now());
  END IF;

  -- recovery_in_progress = hay recuperaciones activas para este actor/moneda
  SELECT EXISTS(
    SELECT 1 FROM public.trade_marketplace_recoveries
     WHERE provider_actor_id = p_actor_id
       AND currency::text = p_currency
       AND status IN ('pending', 'partial')
  ) INTO v_has_active_recovery;

  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount,
    negative_since, recovery_in_progress,
    last_ledger_entry_id, last_recalculated_at, projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative, v_settled,
    v_new_negative_since, v_has_active_recovery,
    v_last_entry_id, now(), 'ledger_rebuild'
  )
  ON CONFLICT (provider_actor_id, currency) DO UPDATE SET
    pending_amount            = EXCLUDED.pending_amount,
    available_amount          = EXCLUDED.available_amount,
    reserved_amount           = EXCLUDED.reserved_amount,
    negative_amount           = EXCLUDED.negative_amount,
    historical_settled_amount = EXCLUDED.historical_settled_amount,
    negative_since            = EXCLUDED.negative_since,
    recovery_in_progress      = EXCLUDED.recovery_in_progress,
    last_ledger_entry_id      = EXCLUDED.last_ledger_entry_id,
    last_recalculated_at      = EXCLUDED.last_recalculated_at,
    projection_strategy       = EXCLUDED.projection_strategy;

  PERFORM public.mkt_fin_audit(
    'provider_balance_rebuilt', 'provider_balance', p_actor_id, NULL, NULL,
    jsonb_build_object(
      'actor_id',             p_actor_id,
      'currency',             p_currency,
      'ledger_sum',           v_ledger_sum,
      'pending_amount',       v_pending,
      'negative_amount',      v_negative,
      'negative_since',       v_new_negative_since,
      'recovery_in_progress', v_has_active_recovery,
      'ledger_entries_read',  v_entry_count,
      'prior_total',          v_prior_balance,
      'phase',                '2D',
      'includes_recovery',    true,
      'note', 'Phase 2D: BALANCE_RECOVERY + FUTURE_SETOFF incluidos. NEGATIVE_BALANCE_RECORD excluido.'
    ),
    'Rebuild balance desde ledger - Phase 2D', NULL, NULL
  );

  RETURN jsonb_build_object(
    'status',                'rebuilt',
    'actor_id',              p_actor_id,
    'currency',              p_currency,
    'ledger_sum',            v_ledger_sum,
    'pending_amount',        v_pending,
    'available_amount',      v_available,
    'reserved_amount',       v_reserved,
    'negative_amount',       v_negative,
    'historical_settled',    v_settled,
    'total_economic_balance', v_pending + v_available + v_reserved - v_negative,
    'negative_since',        v_new_negative_since,
    'recovery_in_progress',  v_has_active_recovery,
    'ledger_entries_read',   v_entry_count,
    'last_ledger_entry_id',  v_last_entry_id,
    'recalculated_at',       now(),
    'projection_strategy',   'ledger_rebuild',
    'phase',                 '2D'
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 5 — mkt_fin_reconcile_provider_balance Phase 2D
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_reconcile_provider_balance(
  p_actor_id uuid,
  p_currency  text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_ledger_derived  numeric(15,4) := 0;
  v_stored_total    numeric(15,4) := 0;
  v_difference      numeric(15,4);
  v_status          text;
  v_has_access      bool;
  v_entry_count     int;
  v_projection_at   timestamptz;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
               OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT',     'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL', 'SHIPPING_REFUND_REVERSAL',
        'CHARGEBACK_DEBIT',      'CHARGEBACK_CREDIT',     'CHARGEBACK_FEE',
        'BALANCE_RECOVERY',      'FUTURE_SETOFF'
      ) AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed')
    INTO v_ledger_derived, v_entry_count
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id AND currency::text = p_currency;

  SELECT COALESCE(total_economic_balance, 0), last_recalculated_at
    INTO v_stored_total, v_projection_at
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  v_difference := v_ledger_derived - v_stored_total;
  v_status     := CASE WHEN ABS(v_difference) < 0.0001 THEN 'MATCH' ELSE 'MISMATCH' END;

  IF v_status = 'MISMATCH' THEN
    PERFORM public.mkt_fin_audit(
      'provider_balance_reconciliation_mismatch', 'provider_balance', p_actor_id, NULL, NULL,
      jsonb_build_object(
        'ledger_derived', v_ledger_derived, 'stored_total', v_stored_total,
        'difference', v_difference, 'phase', '2D', 'severity', 'WARNING'
      ),
      'Balance almacenado difiere del ledger (Phase 2D)', NULL, NULL
    );
  END IF;

  RETURN jsonb_build_object(
    'actor_id',               p_actor_id,
    'currency',               p_currency,
    'status',                 v_status,
    'expected_total',         v_ledger_derived,
    'stored_total',           v_stored_total,
    'difference',             v_difference,
    'ledger_entries_used',    v_entry_count,
    'projection_at',          v_projection_at,
    'checked_at',             now(),
    'phase',                  '2D',
    'includes_recovery',      true,
    'reconciliation_note',    CASE WHEN v_status = 'MATCH'
      THEN 'OK — ledger y balance coinciden (Phase 2D con recovery)'
      ELSE 'MISMATCH — ejecutar mkt_fin_rebuild_provider_balance'
    END
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 6 — mkt_fin_get_provider_balance Phase 2D (añade negative_since + recovery_in_progress)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_balance(
  p_actor_id uuid,
  p_currency  text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_balance  RECORD;
  v_has_access bool;
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
    RETURN jsonb_build_object(
      'actor_id',              p_actor_id,
      'currency',              p_currency,
      'pending_amount',        0,
      'available_amount',      0,
      'reserved_amount',       0,
      'negative_amount',       0,
      'historical_settled',    0,
      'total_economic_balance', 0,
      'negative_since',        null,
      'recovery_in_progress',  false,
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
    'negative_since',        v_balance.negative_since,
    'recovery_in_progress',  v_balance.recovery_in_progress,
    'last_ledger_entry_id',  v_balance.last_ledger_entry_id,
    'last_recalculated_at',  v_balance.last_recalculated_at,
    'projection_strategy',   v_balance.projection_strategy,
    'projection_exists',     true
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 7 — mkt_fin_get_negative_balance_breakdown
--
-- Devuelve desglose completo del déficit: aging, origen, recuperaciones activas.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_get_negative_balance_breakdown(
  p_actor_id uuid,
  p_currency  text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bal        RECORD;
  v_aging_days int;
  v_aging_bucket text;
  v_recoveries jsonb;
  v_risk_flags jsonb;
  v_has_access bool;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN
    RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id;
  END IF;

  SELECT * INTO v_bal
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND OR v_bal.negative_amount = 0 THEN
    RETURN jsonb_build_object(
      'actor_id',          p_actor_id,
      'currency',          p_currency,
      'in_deficit',        false,
      'deficit_amount',    0,
      'negative_since',    null,
      'aging_days',        null,
      'aging_bucket',      null,
      'recovery_in_progress', false,
      'active_recoveries', '[]'::jsonb,
      'risk_flags',        '[]'::jsonb,
      'calculated_at',     now()
    );
  END IF;

  v_aging_days := EXTRACT(DAY FROM now() - v_bal.negative_since)::int;
  v_aging_bucket := CASE
    WHEN v_aging_days <= 7  THEN '0_7'
    WHEN v_aging_days <= 30 THEN '8_30'
    WHEN v_aging_days <= 60 THEN '31_60'
    WHEN v_aging_days <= 90 THEN '61_90'
    ELSE '90_plus'
  END;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'recovery_id',     id,
    'recovery_number', recovery_number,
    'recovery_type',   recovery_type,
    'status',          status,
    'deficit_amount',  deficit_amount,
    'recovered_amount', recovered_amount,
    'remaining_amount', deficit_amount - recovered_amount,
    'initiated_at',    initiated_at
  ) ORDER BY initiated_at DESC), '[]'::jsonb)
    INTO v_recoveries
    FROM public.trade_marketplace_recoveries
   WHERE provider_actor_id = p_actor_id
     AND currency::text = p_currency
     AND status IN ('pending', 'partial');

  v_risk_flags := jsonb_build_array(
    CASE WHEN v_aging_days > 90
      THEN jsonb_build_object('flag', 'AGING_CRITICAL', 'days', v_aging_days)
      ELSE NULL
    END,
    CASE WHEN v_aging_days > 30 AND NOT v_bal.recovery_in_progress
      THEN jsonb_build_object('flag', 'NO_RECOVERY_PLAN', 'days', v_aging_days)
      ELSE NULL
    END,
    CASE WHEN v_bal.negative_amount > 1000
      THEN jsonb_build_object('flag', 'HIGH_DEFICIT', 'amount', v_bal.negative_amount)
      ELSE NULL
    END
  ) - 'null'::jsonb;  -- filtra nulls del array

  RETURN jsonb_build_object(
    'actor_id',             p_actor_id,
    'currency',             p_currency,
    'in_deficit',           true,
    'deficit_amount',       v_bal.negative_amount,
    'negative_since',       v_bal.negative_since,
    'aging_days',           v_aging_days,
    'aging_bucket',         v_aging_bucket,
    'recovery_in_progress', v_bal.recovery_in_progress,
    'active_recoveries',    v_recoveries,
    'risk_flags',           v_risk_flags,
    'total_economic_balance', v_bal.total_economic_balance,
    'calculated_at',        now()
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 8 — mkt_fin_preview_recovery (dry-run, sin persistir)
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_preview_recovery(
  p_actor_id      uuid,
  p_currency      text    DEFAULT 'EUR',
  p_amount        numeric DEFAULT NULL,
  p_recovery_type text    DEFAULT 'manual_simulation'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bal         RECORD;
  v_has_access  bool;
  v_amount      numeric(15,4);
  v_effective   numeric(15,4);
  v_remaining   numeric(15,4);
  v_new_balance numeric(15,4);
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id; END IF;

  IF p_recovery_type NOT IN ('future_sales_offset', 'manual_simulation') THEN
    RAISE EXCEPTION 'INVALID_RECOVERY_TYPE: %', p_recovery_type;
  END IF;

  SELECT * INTO v_bal
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'actor_id', p_actor_id, 'currency', p_currency,
      'current_deficit', 0, 'error', 'NO_BALANCE_PROJECTION'
    );
  END IF;

  -- Si no se especifica monto, se asume recuperación total del déficit
  v_amount := COALESCE(p_amount, v_bal.negative_amount);

  -- No puede recuperar más del déficit actual
  v_effective   := LEAST(v_amount, v_bal.negative_amount);
  v_remaining   := v_bal.negative_amount - v_effective;
  v_new_balance := v_bal.total_economic_balance + v_effective;

  RETURN jsonb_build_object(
    'actor_id',             p_actor_id,
    'currency',             p_currency,
    'current_deficit',      v_bal.negative_amount,
    'proposed_amount',      v_amount,
    'effective_recovery',   v_effective,
    'remaining_after',      v_remaining,
    'new_balance_estimate', v_new_balance,
    'impact_pct',           CASE WHEN v_bal.negative_amount > 0
      THEN ROUND((v_effective / v_bal.negative_amount) * 100, 2)
      ELSE 0
    END,
    'recovery_type',        p_recovery_type,
    'ledger_entry_type',    CASE p_recovery_type
      WHEN 'manual_simulation'  THEN 'BALANCE_RECOVERY'
      WHEN 'future_sales_offset' THEN 'FUTURE_SETOFF'
    END,
    'full_recovery',        (v_remaining = 0),
    'simulation_only',      true,
    'preview_only',         true
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 9 — mkt_fin_create_recovery
--
-- Crea el registro de recuperación. Sin entrada ledger aún (ocurre en process).
-- Marca recovery_in_progress = true en el balance.
-- Idempotente por idempotency_key.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_create_recovery(
  p_actor_id        uuid,
  p_currency        text        DEFAULT 'EUR',
  p_amount          numeric     DEFAULT NULL,
  p_recovery_type   text        DEFAULT 'manual_simulation',
  p_notes           text        DEFAULT NULL,
  p_idempotency_key text        DEFAULT NULL,
  p_correlation_id  text        DEFAULT NULL,
  p_metadata        jsonb       DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_bal              RECORD;
  v_recovery_id      uuid;
  v_recovery_number  text;
  v_deficit          numeric(15,4);
  v_origin_entry_id  uuid;
  v_corr             text;
BEGIN
  -- Solo platform_admin puede crear recuperaciones
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin puede crear recuperaciones';
  END IF;

  IF p_recovery_type NOT IN ('future_sales_offset', 'manual_simulation') THEN
    RAISE EXCEPTION 'INVALID_RECOVERY_TYPE: %', p_recovery_type;
  END IF;

  -- Idempotencia
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_recovery_id
      FROM public.trade_marketplace_recoveries
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',           'replayed',
          'recovery_id',      id,
          'recovery_number',  recovery_number,
          'recovery_type',    recovery_type,
          'deficit_amount',   deficit_amount,
          'recovery_status',  status
        )
        FROM public.trade_marketplace_recoveries WHERE id = v_recovery_id
      );
    END IF;
  END IF;

  -- Verificar balance actual
  SELECT * INTO v_bal
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BALANCE_NOT_FOUND: actor=% currency=%', p_actor_id, p_currency;
  END IF;

  IF v_bal.negative_amount = 0 THEN
    RAISE EXCEPTION 'NO_DEFICIT: actor=% currency=% tiene balance no negativo', p_actor_id, p_currency;
  END IF;

  -- Monto a recuperar: por defecto el déficit completo
  v_deficit := COALESCE(p_amount, v_bal.negative_amount);
  IF v_deficit <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE: %', v_deficit;
  END IF;
  IF v_deficit > v_bal.negative_amount THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_DEFICIT: requested=% deficit=%', v_deficit, v_bal.negative_amount;
  END IF;

  -- Origen: entrada que generó el estado negativo (la más reciente negativa)
  SELECT id INTO v_origin_entry_id
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id
     AND currency::text = p_currency
     AND amount < 0
     AND status != 'failed'
   ORDER BY occurred_at DESC, created_at DESC
   LIMIT 1;

  v_recovery_number := public.next_financial_doc_number('RC');
  v_corr            := COALESCE(p_correlation_id, 'recovery-' || gen_random_uuid()::text);

  INSERT INTO public.trade_marketplace_recoveries (
    recovery_number, provider_actor_id, currency,
    deficit_amount, recovered_amount, recovery_type,
    status, simulation_only, negative_since,
    negative_origin_entry_id, notes, correlation_id,
    idempotency_key, metadata
  ) VALUES (
    v_recovery_number, p_actor_id, p_currency::char(3),
    v_deficit, 0, p_recovery_type,
    'pending', true, v_bal.negative_since,
    v_origin_entry_id, p_notes, v_corr,
    p_idempotency_key, p_metadata
  )
  RETURNING id INTO v_recovery_id;

  -- Marcar recovery_in_progress en balance
  UPDATE public.trade_marketplace_balances
     SET recovery_in_progress = true,
         updated_at            = now()
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  PERFORM public.mkt_fin_audit(
    'recovery_created', 'recovery', v_recovery_id, NULL, NULL,
    jsonb_build_object(
      'recovery_number',  v_recovery_number,
      'recovery_type',    p_recovery_type,
      'actor_id',         p_actor_id,
      'currency',         p_currency,
      'deficit_amount',   v_deficit,
      'negative_since',   v_bal.negative_since,
      'simulation_only',  true
    ),
    'Recuperación creada — ' || v_recovery_number, v_corr, NULL
  );

  RETURN jsonb_build_object(
    'status',           'created',
    'recovery_id',      v_recovery_id,
    'recovery_number',  v_recovery_number,
    'recovery_type',    p_recovery_type,
    'actor_id',         p_actor_id,
    'currency',         p_currency,
    'deficit_amount',   v_deficit,
    'recovered_amount', 0,
    'recovery_status',  'pending',
    'simulation_only',  true,
    'correlation_id',   v_corr
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 10 — mkt_fin_process_recovery
--
-- Aplica un tramo de recuperación (parcial o total).
-- Crea entrada ledger: BALANCE_RECOVERY (manual) o FUTURE_SETOFF (offset futuro).
-- Ambos son POSITIVOS: reducen el déficit en el ledger.
-- INVARIANTE: GOODS_ENTITLEMENT de ventas históricas nunca se modifica.
-- Idempotente por source_event_id.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_process_recovery(
  p_recovery_id     uuid,
  p_amount          numeric,
  p_source_event_id text        DEFAULT NULL,
  p_correlation_id  text        DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec             RECORD;
  v_entry_type      text;
  v_entry_row       public.trade_marketplace_ledger_entries;
  v_new_recovered   numeric(15,4);
  v_remaining       numeric(15,4);
  v_new_status      text;
  v_corr            text;
  v_rebuild_result  jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin puede procesar recuperaciones';
  END IF;

  -- Idempotencia
  IF p_source_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trade_marketplace_ledger_entries
       WHERE source_event_id = p_source_event_id
         AND entry_type IN ('BALANCE_RECOVERY', 'FUTURE_SETOFF')
    ) THEN
      SELECT jsonb_build_object(
        'status',          'replayed',
        'recovery_id',     p_recovery_id,
        'source_event_id', p_source_event_id
      ) INTO v_rebuild_result;
      RETURN v_rebuild_result;
    END IF;
  END IF;

  SELECT * INTO v_rec
    FROM public.trade_marketplace_recoveries
   WHERE id = p_recovery_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'RECOVERY_NOT_FOUND: %', p_recovery_id; END IF;

  IF v_rec.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'RECOVERY_TERMINAL: id=% status=%', p_recovery_id, v_rec.status;
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE: %', p_amount;
  END IF;

  -- No puede superar el monto pendiente de recuperar
  v_remaining := v_rec.deficit_amount - v_rec.recovered_amount;
  IF p_amount > v_remaining THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_REMAINING: requested=% remaining=%', p_amount, v_remaining;
  END IF;

  v_entry_type := CASE v_rec.recovery_type
    WHEN 'manual_simulation'   THEN 'BALANCE_RECOVERY'
    WHEN 'future_sales_offset' THEN 'FUTURE_SETOFF'
  END;

  v_corr := COALESCE(p_correlation_id, 'recovery-process-' || gen_random_uuid()::text);

  -- Entrada ledger POSITIVA (reduce déficit)
  -- actor_id = provider_actor_id (receptor de la recuperación en el ledger)
  -- master_order_id + supplier_order_id = NULL (recuperación no vinculada a orden concreta)
  v_entry_row := public.mkt_fin_ledger_append(
    v_entry_type, p_amount,
    NULL, NULL, v_rec.provider_actor_id,
    CASE v_entry_type
      WHEN 'BALANCE_RECOVERY' THEN 'Pago manual recovery — ' || v_rec.recovery_number
      WHEN 'FUTURE_SETOFF'    THEN 'Offset venta futura — ' || v_rec.recovery_number
    END,
    v_corr, p_source_event_id, NULL,
    'simulation', p_recovery_id::text, 'recovery',
    v_rec.currency, 'confirmed', now()
  );

  -- Actualizar recovery
  v_new_recovered := v_rec.recovered_amount + p_amount;
  v_remaining     := v_rec.deficit_amount - v_new_recovered;
  v_new_status    := CASE WHEN v_remaining <= 0.0001 THEN 'completed' ELSE 'partial' END;

  UPDATE public.trade_marketplace_recoveries SET
    recovered_amount = v_new_recovered,
    status           = v_new_status,
    completed_at     = CASE WHEN v_new_status = 'completed' THEN now() ELSE NULL END,
    updated_at       = now()
  WHERE id = p_recovery_id;

  -- Rebuild balance (actualiza negative_amount, negative_since, recovery_in_progress)
  v_rebuild_result := public.mkt_fin_rebuild_provider_balance(
    v_rec.provider_actor_id, v_rec.currency::text
  );

  PERFORM public.mkt_fin_audit(
    'recovery_processed', 'recovery', p_recovery_id, NULL, NULL,
    jsonb_build_object(
      'recovery_number',   v_rec.recovery_number,
      'entry_type',        v_entry_type,
      'amount',            p_amount,
      'new_recovered',     v_new_recovered,
      'remaining',         v_remaining,
      'new_status',        v_new_status,
      'ledger_entry_id',   v_entry_row.id,
      'simulation_only',   true
    ),
    'Recovery procesada — ' || v_rec.recovery_number, v_corr, NULL
  );

  RETURN jsonb_build_object(
    'status',            'processed',
    'recovery_id',       p_recovery_id,
    'recovery_number',   v_rec.recovery_number,
    'entry_type',        v_entry_type,
    'ledger_entry_id',   v_entry_row.id,
    'amount_applied',    p_amount,
    'recovered_amount',  v_new_recovered,
    'remaining_amount',  v_remaining,
    'recovery_status',   v_new_status,
    'new_negative_amount', (v_rebuild_result->>'negative_amount')::numeric,
    'new_total_economic',  (v_rebuild_result->>'total_economic_balance')::numeric,
    'simulation_only',   true,
    'correlation_id',    v_corr
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 11 — mkt_fin_cancel_recovery
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_cancel_recovery(
  p_recovery_id    uuid,
  p_reason         text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rec   RECORD;
  v_corr  text;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin puede cancelar recuperaciones';
  END IF;

  SELECT * INTO v_rec
    FROM public.trade_marketplace_recoveries
   WHERE id = p_recovery_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'RECOVERY_NOT_FOUND: %', p_recovery_id; END IF;

  IF v_rec.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'RECOVERY_TERMINAL: id=% status=%', p_recovery_id, v_rec.status;
  END IF;

  v_corr := COALESCE(p_correlation_id, 'recovery-cancel-' || gen_random_uuid()::text);

  UPDATE public.trade_marketplace_recoveries SET
    status       = 'cancelled',
    cancelled_at = now(),
    notes        = COALESCE(p_reason, notes),
    updated_at   = now()
  WHERE id = p_recovery_id;

  -- Recalcular recovery_in_progress en balance
  PERFORM public.mkt_fin_rebuild_provider_balance(
    v_rec.provider_actor_id, v_rec.currency::text
  );

  PERFORM public.mkt_fin_audit(
    'recovery_cancelled', 'recovery', p_recovery_id, NULL, NULL,
    jsonb_build_object(
      'recovery_number', v_rec.recovery_number,
      'reason',          p_reason,
      'prior_status',    v_rec.status
    ),
    'Recovery cancelada — ' || v_rec.recovery_number, v_corr, NULL
  );

  RETURN jsonb_build_object(
    'status',          'cancelled',
    'recovery_id',     p_recovery_id,
    'recovery_number', v_rec.recovery_number,
    'prior_status',    v_rec.status,
    'cancelled_at',    now()
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 12 — mkt_fin_list_provider_recoveries
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_list_provider_recoveries(
  p_actor_id uuid,
  p_limit    int  DEFAULT 20,
  p_offset   int  DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rows     jsonb;
  v_has_access bool;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id; END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.initiated_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'recovery_id',      id,
        'recovery_number',  recovery_number,
        'currency',         currency,
        'recovery_type',    recovery_type,
        'status',           status,
        'deficit_amount',   deficit_amount,
        'recovered_amount', recovered_amount,
        'remaining_amount', deficit_amount - recovered_amount,
        'simulation_only',  simulation_only,
        'negative_since',   negative_since,
        'initiated_at',     initiated_at,
        'completed_at',     completed_at,
        'cancelled_at',     cancelled_at,
        'notes',            notes
      ) AS r
      FROM public.trade_marketplace_recoveries
     WHERE provider_actor_id = p_actor_id
     ORDER BY initiated_at DESC
     LIMIT p_limit OFFSET p_offset
    ) sub;

  RETURN jsonb_build_object(
    'actor_id', p_actor_id,
    'items',    v_rows,
    'limit',    p_limit,
    'offset',   p_offset
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 13 — mkt_fin_list_admin_recoveries
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_list_admin_recoveries(
  p_status   text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_limit    int  DEFAULT 50,
  p_offset   int  DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin';
  END IF;

  SELECT COALESCE(jsonb_agg(r ORDER BY r.initiated_at DESC), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT jsonb_build_object(
        'recovery_id',       id,
        'recovery_number',   recovery_number,
        'provider_actor_id', provider_actor_id,
        'currency',          currency,
        'recovery_type',     recovery_type,
        'status',            status,
        'deficit_amount',    deficit_amount,
        'recovered_amount',  recovered_amount,
        'remaining_amount',  deficit_amount - recovered_amount,
        'simulation_only',   simulation_only,
        'negative_since',    negative_since,
        'initiated_at',      initiated_at,
        'completed_at',      completed_at,
        'cancelled_at',      cancelled_at,
        'notes',             notes
      ) AS r
      FROM public.trade_marketplace_recoveries
     WHERE (p_status   IS NULL OR status       = p_status)
       AND (p_currency IS NULL OR currency::text = p_currency)
     ORDER BY initiated_at DESC
     LIMIT p_limit OFFSET p_offset
    ) sub;

  RETURN jsonb_build_object(
    'items',    v_rows,
    'filters',  jsonb_build_object('status', p_status, 'currency', p_currency),
    'limit',    p_limit,
    'offset',   p_offset
  );
END;
$$;

-- ══════════════════════════════════════════════════════════════════════════
-- PARTE 14 — mkt_fin_admin_negative_overview
--
-- KPIs globales: proveedores en déficit, aging, recuperaciones activas.
-- ══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_negative_overview()
RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ACCESS_DENIED: solo platform_admin';
  END IF;

  SELECT jsonb_build_object(
    'providers_in_deficit',   COUNT(*) FILTER (WHERE b.negative_amount > 0),
    'total_deficit_amount',   COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0), 0),
    'currencies_in_deficit',  (
      SELECT COALESCE(jsonb_agg(DISTINCT b2.currency::text), '[]'::jsonb)
        FROM public.trade_marketplace_balances b2 WHERE b2.negative_amount > 0
    ),
    'by_aging', jsonb_build_object(
      '0_7',    jsonb_build_object(
        'count', COUNT(*) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) <= 7),
        'total', COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) <= 7), 0)
      ),
      '8_30',   jsonb_build_object(
        'count', COUNT(*) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 8 AND 30),
        'total', COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 8 AND 30), 0)
      ),
      '31_60',  jsonb_build_object(
        'count', COUNT(*) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 31 AND 60),
        'total', COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 31 AND 60), 0)
      ),
      '61_90',  jsonb_build_object(
        'count', COUNT(*) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 61 AND 90),
        'total', COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) BETWEEN 61 AND 90), 0)
      ),
      '90_plus', jsonb_build_object(
        'count', COUNT(*) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) > 90),
        'total', COALESCE(SUM(b.negative_amount) FILTER (WHERE b.negative_amount > 0 AND EXTRACT(DAY FROM now() - b.negative_since) > 90), 0)
      )
    ),
    'active_recoveries',      (
      SELECT COUNT(*) FROM public.trade_marketplace_recoveries WHERE status IN ('pending', 'partial')
    ),
    'recoveries_in_progress', (
      SELECT COUNT(*) FROM public.trade_marketplace_balances WHERE recovery_in_progress = true
    ),
    'calculated_at',          now()
  )
    INTO v_result
    FROM public.trade_marketplace_balances b;

  RETURN v_result;
END;
$$;

COMMIT;
