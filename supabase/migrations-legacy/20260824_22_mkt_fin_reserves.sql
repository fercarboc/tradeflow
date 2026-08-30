-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2E — Reserves + Holds
-- ═══════════════════════════════════════════════════════════════════════════
--
-- INVARIANTE FUNDAMENTAL:
--   Una reserva NO cambia la posición económica del proveedor.
--   Solo mueve fondos entre buckets:  available → reserved
--   Liberación:                        reserved → available
--
--   pending + available + reserved − negative = CONSTANTE
--
-- LEDGER ENTRIES (ya existentes en constraint):
--   RESERVE_HOLD    amount NEGATIVO  → reduce available, aumenta reserved
--   RESERVE_RELEASE amount POSITIVO  → aumenta available, reduce reserved
--
-- NUEVA ENTRY TYPE:
--   PENDING_TO_AVAILABLE  amount POSITIVO (simulation_only)
--   → reduce pending, aumenta available (sin cambio económico)
--   Representa la transición futura pending→available (BUSINESS_RULE_GATE)
--
-- FÓRMULA PHASE 2E:
--   v_p2a    = SUM(PENDING_TO_AVAILABLE)
--   v_rh     = SUM(RESERVE_HOLD)          ← negativo
--   v_rr     = SUM(RESERVE_RELEASE)       ← positivo
--
--   pending_net = base_sum − v_p2a
--   available   = v_p2a + v_rh + v_rr
--   reserved    = −(v_rh + v_rr)
--   TEB         = pending + available + reserved − negative
--               = base_sum (reserves no cambian posición económica)
--
-- simulation_only = true (STRIPE_GATE + LEGAL_GATE + BUSINESS_RULE_GATE)
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 1: Añadir PENDING_TO_AVAILABLE al CHECK constraint de ledger
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_ledger_entries
  DROP CONSTRAINT IF EXISTS trade_marketplace_ledger_entries_entry_type_check;

ALTER TABLE public.trade_marketplace_ledger_entries
  ADD CONSTRAINT trade_marketplace_ledger_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'BUYER_PAYMENT',
    'GOODS_ENTITLEMENT',
    'SHIPPING_ENTITLEMENT',
    'COMMISSION_ACCRUAL',
    'COMMISSION_TAX_ACCRUAL',
    'COMMISSION_SIM_ACCRUAL',
    'COMMISSION_SIM_TAX_ACCRUAL',
    'TRANSFER_INITIATED',
    'TRANSFER_COMPLETED',
    'TRANSFER_REVERSAL',
    'REFUND_TO_BUYER',
    'GOODS_REFUND_REVERSAL',
    'SHIPPING_REFUND_REVERSAL',
    'COMMISSION_REVERSAL',
    'COMMISSION_TAX_REVERSAL',
    'CHARGEBACK_DEBIT',
    'CHARGEBACK_FEE',
    'CHARGEBACK_CREDIT',
    'PSP_FEE_DEBIT',
    'RESERVE_HOLD',
    'RESERVE_RELEASE',
    'SETTLEMENT_ADJUSTMENT',
    'PROVIDER_ADJUSTMENT',
    'PLATFORM_ADJUSTMENT',
    'NEGATIVE_BALANCE_RECORD',
    'BALANCE_RECOVERY',
    'FUTURE_SETOFF',
    'PENDING_TO_AVAILABLE'
  ]::text[]));

-- ─────────────────────────────────────────────────────────────────────────
-- Part 2: Tabla trade_marketplace_reserves
-- ─────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_reserves (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  reserve_number       text          UNIQUE NOT NULL,
  provider_actor_id    uuid          NOT NULL
    REFERENCES public.trade_marketplace_actors(id),
  currency             char(3)       NOT NULL DEFAULT 'EUR',

  -- Asociaciones opcionales
  master_order_id      uuid          REFERENCES public.trade_marketplace_master_orders(id),
  supplier_order_id    uuid          REFERENCES public.trade_marketplace_orders(id),
  dispute_id           uuid          REFERENCES public.trade_marketplace_disputes(id),

  -- Motivo
  reason               text          NOT NULL,
  reason_code          text,
  reserve_type         text          NOT NULL
    CHECK (reserve_type IN (
      'risk', 'dispute', 'chargeback_exposure', 'new_provider',
      'delivery_window', 'manual_review', 'rolling', 'fixed', 'manual', 'other'
    )),

  -- Montos
  requested_amount     numeric(15,4) NOT NULL CHECK (requested_amount > 0),
  reserved_amount      numeric(15,4) NOT NULL DEFAULT 0
    CHECK (reserved_amount >= 0),
  released_amount      numeric(15,4) NOT NULL DEFAULT 0
    CHECK (released_amount >= 0),
  remaining_amount     numeric(15,4) NOT NULL
    GENERATED ALWAYS AS (reserved_amount - released_amount) STORED,

  -- Bucket de origen
  source_bucket        text          NOT NULL DEFAULT 'available'
    CHECK (source_bucket IN ('available', 'pending')),

  -- Estado
  status               text          NOT NULL DEFAULT 'active'
    CHECK (status IN (
      'active', 'partially_released', 'released', 'expired', 'cancelled'
    )),

  -- Timing
  starts_at            timestamptz   NOT NULL DEFAULT now(),
  release_at           timestamptz,
  expires_at           timestamptz,

  -- Simulación
  simulation_only      bool          NOT NULL DEFAULT true,

  -- Trazabilidad
  correlation_id       text,
  source_event_id      text          UNIQUE,
  idempotency_key      text          UNIQUE,
  created_by           uuid,

  -- Metadata
  notes                text,
  release_conditions   text[],
  metadata             jsonb,

  -- Timestamps
  created_at           timestamptz   NOT NULL DEFAULT now(),
  updated_at           timestamptz   NOT NULL DEFAULT now(),
  released_at          timestamptz,
  cancelled_at         timestamptz,
  expired_at           timestamptz,

  CONSTRAINT chk_reserve_released_le_reserved
    CHECK (released_amount <= reserved_amount),
  CONSTRAINT chk_reserve_simulation
    CHECK (simulation_only = true)
);

CREATE INDEX IF NOT EXISTS idx_mkt_reserves_actor_currency
  ON public.trade_marketplace_reserves (provider_actor_id, currency, status);
CREATE INDEX IF NOT EXISTS idx_mkt_reserves_status
  ON public.trade_marketplace_reserves (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_mkt_reserves_dispute
  ON public.trade_marketplace_reserves (dispute_id)
  WHERE dispute_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 3: RLS
-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_reserves ENABLE ROW LEVEL SECURITY;

CREATE POLICY reserves_provider_select ON public.trade_marketplace_reserves
  FOR SELECT TO authenticated
  USING (
    provider_actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

CREATE POLICY reserves_admin_all ON public.trade_marketplace_reserves
  FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- Part 4: mkt_fin_rebuild_provider_balance — Phase 2E
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(
  p_actor_id uuid,
  p_currency text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_base_sum             numeric(15,4) := 0;
  v_p2a_sum              numeric(15,4) := 0;
  v_rh_sum               numeric(15,4) := 0;
  v_rr_sum               numeric(15,4) := 0;
  v_pending_net          numeric(15,4) := 0;
  v_pending              numeric(15,4) := 0;
  v_available            numeric(15,4) := 0;
  v_reserved             numeric(15,4) := 0;
  v_negative             numeric(15,4) := 0;
  v_settled              numeric(15,4) := 0;
  v_teb                  numeric(15,4) := 0;
  v_last_entry_id        uuid;
  v_entry_count          int;
  v_prior_negative_since timestamptz;
  v_new_negative_since   timestamptz;
  v_has_active_recovery  bool := false;
  v_actor_exists         bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id)
    INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;

  SELECT
    -- Base: Phase 2D entry types (economic position)
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN (
      'GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT',
      'GOODS_REFUND_REVERSAL', 'SHIPPING_REFUND_REVERSAL',
      'CHARGEBACK_DEBIT', 'CHARGEBACK_CREDIT', 'CHARGEBACK_FEE',
      'BALANCE_RECOVERY', 'FUTURE_SETOFF'
    ) AND status != 'failed'), 0),
    -- P2A transfers (positive: reduces pending, increases available)
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type = 'PENDING_TO_AVAILABLE' AND status != 'failed'
    ), 0),
    -- Reserve holds (negative: reduces available, increases reserved)
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type = 'RESERVE_HOLD' AND status != 'failed'
    ), 0),
    -- Reserve releases (positive: increases available, reduces reserved)
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type = 'RESERVE_RELEASE' AND status != 'failed'
    ), 0),
    COUNT(*) FILTER (WHERE status != 'failed'),
    (SELECT l2.id FROM public.trade_marketplace_ledger_entries l2
      WHERE l2.actor_id = p_actor_id AND l2.currency::text = p_currency
        AND l2.status != 'failed'
      ORDER BY l2.occurred_at DESC, l2.created_at DESC LIMIT 1)
    INTO v_base_sum, v_p2a_sum, v_rh_sum, v_rr_sum, v_entry_count, v_last_entry_id
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id AND currency::text = p_currency;

  SELECT COALESCE(negative_since, NULL)
    INTO v_prior_negative_since
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  -- Compute buckets (Phase 2E)
  v_pending_net := v_base_sum - v_p2a_sum;
  v_available   := v_p2a_sum + v_rh_sum + v_rr_sum;
  v_reserved    := -(v_rh_sum + v_rr_sum);

  -- Clamp to avoid floating point noise (reserves validated at creation)
  v_available := GREATEST(v_available, 0);
  v_reserved  := GREATEST(v_reserved, 0);

  -- Pending/negative split (same as Phase 2D)
  IF v_pending_net >= 0 THEN
    v_pending          := v_pending_net;
    v_negative         := 0;
    v_new_negative_since := NULL;
  ELSE
    v_pending          := 0;
    v_negative         := ABS(v_pending_net);
    v_new_negative_since := COALESCE(v_prior_negative_since, now());
  END IF;

  v_teb := v_pending + v_available + v_reserved - v_negative;

  SELECT EXISTS(
    SELECT 1 FROM public.trade_marketplace_recoveries
     WHERE provider_actor_id = p_actor_id
       AND currency::text = p_currency
       AND status IN ('pending', 'partial')
  ) INTO v_has_active_recovery;

  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount, total_economic_balance,
    negative_since, recovery_in_progress,
    last_ledger_entry_id, last_recalculated_at, projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative, v_settled, v_teb,
    v_new_negative_since, v_has_active_recovery,
    v_last_entry_id, now(), 'ledger_rebuild'
  )
  ON CONFLICT (provider_actor_id, currency) DO UPDATE SET
    pending_amount          = EXCLUDED.pending_amount,
    available_amount        = EXCLUDED.available_amount,
    reserved_amount         = EXCLUDED.reserved_amount,
    negative_amount         = EXCLUDED.negative_amount,
    historical_settled_amount = EXCLUDED.historical_settled_amount,
    total_economic_balance  = EXCLUDED.total_economic_balance,
    negative_since          = CASE
      WHEN EXCLUDED.negative_amount > 0 THEN
        COALESCE(public.trade_marketplace_balances.negative_since, EXCLUDED.negative_since)
      ELSE NULL
    END,
    recovery_in_progress    = EXCLUDED.recovery_in_progress,
    last_ledger_entry_id    = EXCLUDED.last_ledger_entry_id,
    last_recalculated_at    = EXCLUDED.last_recalculated_at,
    projection_strategy     = EXCLUDED.projection_strategy,
    updated_at              = now();

  RETURN jsonb_build_object(
    'phase',             '2E',
    'provider_actor_id', p_actor_id,
    'currency',          p_currency,
    'pending_amount',    v_pending,
    'available_amount',  v_available,
    'reserved_amount',   v_reserved,
    'negative_amount',   v_negative,
    'total_economic_balance', v_teb,
    'negative_since',    v_new_negative_since,
    'recovery_in_progress', v_has_active_recovery,
    'ledger_entries',    v_entry_count,
    'rebuilt_at',        now()
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 5: mkt_fin_reconcile_provider_balance — Phase 2E
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_reconcile_provider_balance(
  p_actor_id uuid,
  p_currency text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_stored      record;
  v_base_sum    numeric(15,4);
  v_p2a_sum     numeric(15,4);
  v_rh_sum      numeric(15,4);
  v_rr_sum      numeric(15,4);
  v_exp_pending numeric(15,4);
  v_exp_avail   numeric(15,4);
  v_exp_reserv  numeric(15,4);
  v_exp_neg     numeric(15,4);
  v_exp_teb     numeric(15,4);
  v_diff_pend   numeric(15,4);
  v_diff_avail  numeric(15,4);
  v_diff_reserv numeric(15,4);
  v_diff_neg    numeric(15,4);
  v_diff_total  numeric(15,4);
  v_pnet        numeric(15,4);
BEGIN
  SELECT * INTO v_stored
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','NO_PROJECTION','provider_actor_id',p_actor_id);
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE entry_type IN (
      'GOODS_ENTITLEMENT','SHIPPING_ENTITLEMENT',
      'GOODS_REFUND_REVERSAL','SHIPPING_REFUND_REVERSAL',
      'CHARGEBACK_DEBIT','CHARGEBACK_CREDIT','CHARGEBACK_FEE',
      'BALANCE_RECOVERY','FUTURE_SETOFF'
    ) AND status != 'failed'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'PENDING_TO_AVAILABLE' AND status != 'failed'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'RESERVE_HOLD' AND status != 'failed'), 0),
    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'RESERVE_RELEASE' AND status != 'failed'), 0)
    INTO v_base_sum, v_p2a_sum, v_rh_sum, v_rr_sum
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id AND currency::text = p_currency;

  v_pnet       := v_base_sum - v_p2a_sum;
  v_exp_avail  := v_p2a_sum + v_rh_sum + v_rr_sum;
  v_exp_reserv := -(v_rh_sum + v_rr_sum);
  v_exp_avail  := GREATEST(v_exp_avail, 0);
  v_exp_reserv := GREATEST(v_exp_reserv, 0);

  IF v_pnet >= 0 THEN
    v_exp_pending := v_pnet; v_exp_neg := 0;
  ELSE
    v_exp_pending := 0; v_exp_neg := ABS(v_pnet);
  END IF;

  v_exp_teb    := v_exp_pending + v_exp_avail + v_exp_reserv - v_exp_neg;

  v_diff_pend  := v_stored.pending_amount   - v_exp_pending;
  v_diff_avail := v_stored.available_amount - v_exp_avail;
  v_diff_reserv:= v_stored.reserved_amount  - v_exp_reserv;
  v_diff_neg   := v_stored.negative_amount  - v_exp_neg;
  v_diff_total := v_stored.total_economic_balance - v_exp_teb;

  RETURN jsonb_build_object(
    'phase',              '2E',
    'status',             CASE WHEN v_diff_total = 0 AND v_diff_pend = 0
                               AND v_diff_avail = 0 AND v_diff_reserv = 0
                               AND v_diff_neg = 0 THEN 'MATCH' ELSE 'MISMATCH' END,
    'includes_recovery',  true,
    'includes_reserves',  true,
    'stored_pending',     v_stored.pending_amount,
    'expected_pending',   v_exp_pending,
    'diff_pending',       v_diff_pend,
    'stored_available',   v_stored.available_amount,
    'expected_available', v_exp_avail,
    'diff_available',     v_diff_avail,
    'stored_reserved',    v_stored.reserved_amount,
    'expected_reserved',  v_exp_reserv,
    'diff_reserved',      v_diff_reserv,
    'stored_negative',    v_stored.negative_amount,
    'expected_negative',  v_exp_neg,
    'diff_negative',      v_diff_neg,
    'stored_teb',         v_stored.total_economic_balance,
    'expected_teb',       v_exp_teb,
    'difference',         v_diff_total,
    'checked_at',         now()
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 6: mkt_fin_get_provider_balance — Phase 2E
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_balance(
  p_actor_id uuid,
  p_currency text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_b record; v_cnt int; BEGIN
  SELECT * INTO v_b
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'provider_actor_id',    p_actor_id,
      'currency',             p_currency,
      'pending_amount',       0,
      'available_amount',     0,
      'reserved_amount',      0,
      'negative_amount',      0,
      'total_economic_balance', 0,
      'negative_since',       NULL,
      'recovery_in_progress', false,
      'projection_exists',    false,
      'phase',                '2E'
    );
  END IF;

  SELECT COUNT(*) INTO v_cnt
    FROM public.trade_marketplace_reserves
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency
     AND status IN ('active','partially_released');

  RETURN jsonb_build_object(
    'provider_actor_id',    p_actor_id,
    'currency',             p_currency,
    'pending_amount',       v_b.pending_amount,
    'available_amount',     v_b.available_amount,
    'reserved_amount',      v_b.reserved_amount,
    'negative_amount',      v_b.negative_amount,
    'total_economic_balance', v_b.total_economic_balance,
    'negative_since',       v_b.negative_since,
    'recovery_in_progress', v_b.recovery_in_progress,
    'active_reserve_count', v_cnt,
    'projection_exists',    true,
    'last_recalculated_at', v_b.last_recalculated_at,
    'phase',                '2E'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 7: mkt_fin_sim_make_available — mueve pending→available (simulación)
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_sim_make_available(
  p_actor_id     uuid,
  p_currency     text DEFAULT 'EUR',
  p_amount       numeric(15,4) DEFAULT NULL,
  p_correlation  text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pending  numeric(15,4);
  v_amount   numeric(15,4);
  v_entry    public.trade_marketplace_ledger_entries;
  v_rebuild  jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  PERFORM public.mkt_fin_rebuild_provider_balance(p_actor_id, p_currency);

  SELECT pending_amount INTO v_pending
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  v_pending := COALESCE(v_pending, 0);
  v_amount  := COALESCE(p_amount, v_pending);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;
  IF v_amount > v_pending THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_PENDING: requested=% pending=%', v_amount, v_pending;
  END IF;

  v_entry := public.mkt_fin_ledger_append(
    'PENDING_TO_AVAILABLE', v_amount,
    NULL, NULL, p_actor_id,
    'Simulation pending→available',
    COALESCE(p_correlation, 'sim-p2a-' || gen_random_uuid()::text),
    NULL, NULL, 'simulation', NULL, NULL,
    p_currency, 'confirmed', now()
  );

  v_rebuild := public.mkt_fin_rebuild_provider_balance(p_actor_id, p_currency);

  RETURN jsonb_build_object(
    'status',         'done',
    'amount_moved',   v_amount,
    'ledger_entry_id', v_entry.id,
    'simulation_only', true,
    'new_pending',    v_rebuild->>'pending_amount',
    'new_available',  v_rebuild->>'available_amount'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 8: mkt_fin_preview_reserve — dry run sin persistencia
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_preview_reserve(
  p_actor_id    uuid,
  p_currency    text    DEFAULT 'EUR',
  p_amount      numeric(15,4) DEFAULT NULL,
  p_reserve_type text   DEFAULT 'manual',
  p_source_bucket text  DEFAULT 'available'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_b         record;
  v_source    numeric(15,4);
  v_amount    numeric(15,4);
  v_avail_aft numeric(15,4);
  v_pend_aft  numeric(15,4);
  v_reserv_aft numeric(15,4);
  v_teb_before numeric(15,4);
  v_teb_after  numeric(15,4);
BEGIN
  SELECT * INTO v_b
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    v_b.pending_amount   := 0;
    v_b.available_amount := 0;
    v_b.reserved_amount  := 0;
    v_b.negative_amount  := 0;
    v_b.total_economic_balance := 0;
  END IF;

  v_source := CASE p_source_bucket
    WHEN 'available' THEN v_b.available_amount
    WHEN 'pending'   THEN v_b.pending_amount
    ELSE v_b.available_amount
  END;

  v_amount := COALESCE(p_amount, v_source);
  v_teb_before := COALESCE(v_b.total_economic_balance, 0);

  IF p_source_bucket = 'available' THEN
    v_avail_aft  := v_b.available_amount - v_amount;
    v_pend_aft   := v_b.pending_amount;
  ELSE
    v_avail_aft  := v_b.available_amount;
    v_pend_aft   := v_b.pending_amount - v_amount;
  END IF;
  v_reserv_aft := v_b.reserved_amount + v_amount;
  v_teb_after  := v_teb_before;  -- reserves never change TEB

  RETURN jsonb_build_object(
    'provider_actor_id',      p_actor_id,
    'currency',               p_currency,
    'reserve_type',           p_reserve_type,
    'source_bucket',          p_source_bucket,
    'requested_amount',       v_amount,
    'can_reserve',            v_source >= v_amount AND v_amount > 0,
    'max_reservable',         v_source,
    'before_pending',         v_b.pending_amount,
    'before_available',       v_b.available_amount,
    'before_reserved',        v_b.reserved_amount,
    'before_teb',             v_teb_before,
    'after_pending',          v_pend_aft,
    'after_available',        v_avail_aft,
    'after_reserved',         v_reserv_aft,
    'after_teb',              v_teb_after,
    'teb_unchanged',          v_teb_before = v_teb_after,
    'simulation_only',        true,
    'preview_at',             now()
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 9: mkt_fin_create_simulation_reserve
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_create_simulation_reserve(
  p_actor_id       uuid,
  p_currency       text          DEFAULT 'EUR',
  p_amount         numeric(15,4) DEFAULT NULL,
  p_reserve_type   text          DEFAULT 'manual',
  p_reason         text          DEFAULT NULL,
  p_reason_code    text          DEFAULT NULL,
  p_source_bucket  text          DEFAULT 'available',
  p_master_order_id uuid         DEFAULT NULL,
  p_supplier_order_id uuid       DEFAULT NULL,
  p_dispute_id     uuid          DEFAULT NULL,
  p_expires_at     timestamptz   DEFAULT NULL,
  p_release_at     timestamptz   DEFAULT NULL,
  p_release_conditions text[]    DEFAULT NULL,
  p_idempotency_key text         DEFAULT NULL,
  p_source_event_id text         DEFAULT NULL,
  p_correlation_id text          DEFAULT NULL,
  p_notes          text          DEFAULT NULL,
  p_metadata       jsonb         DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_existing   record;
  v_b          record;
  v_source_amt numeric(15,4);
  v_amount     numeric(15,4);
  v_rsv_num    text;
  v_entry      public.trade_marketplace_ledger_entries;
  v_rsv_id     uuid;
  v_rebuild    jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  -- Idempotencia por idempotency_key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.trade_marketplace_reserves
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'status',          'replayed',
        'reserve_id',      v_existing.id,
        'reserve_number',  v_existing.reserve_number,
        'reserve_status',  v_existing.status,
        'reserved_amount', v_existing.reserved_amount,
        'simulation_only', true
      );
    END IF;
  END IF;

  -- Obtener balance actual
  PERFORM public.mkt_fin_rebuild_provider_balance(p_actor_id, p_currency);
  SELECT * INTO v_b FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_BALANCE: provider has no balance projection';
  END IF;

  v_source_amt := CASE p_source_bucket
    WHEN 'available' THEN v_b.available_amount
    WHEN 'pending'   THEN v_b.pending_amount
    ELSE v_b.available_amount
  END;

  v_amount := COALESCE(p_amount, v_source_amt);

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;
  IF v_source_amt <= 0 THEN
    RAISE EXCEPTION 'NO_FUNDS_IN_SOURCE_BUCKET: bucket=% amount=%', p_source_bucket, v_source_amt;
  END IF;
  IF v_amount > v_source_amt THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_SOURCE: requested=% available_in_bucket=%',
      v_amount, v_source_amt;
  END IF;

  v_rsv_num := public.next_financial_doc_number('RSV');

  -- Ledger entry: RESERVE_HOLD (negativo = reduce available)
  v_entry := public.mkt_fin_ledger_append(
    'RESERVE_HOLD', -v_amount,
    p_master_order_id, p_supplier_order_id, p_actor_id,
    'Reserve hold — ' || v_rsv_num,
    COALESCE(p_correlation_id, 'rsv-' || gen_random_uuid()::text),
    p_source_event_id, NULL, 'simulation', NULL, p_reserve_type,
    p_currency, 'confirmed', now()
  );

  INSERT INTO public.trade_marketplace_reserves (
    reserve_number, provider_actor_id, currency,
    master_order_id, supplier_order_id, dispute_id,
    reason, reason_code, reserve_type,
    requested_amount, reserved_amount, released_amount,
    source_bucket, status,
    starts_at, release_at, expires_at,
    simulation_only,
    correlation_id, source_event_id, idempotency_key,
    release_conditions, notes, metadata
  ) VALUES (
    v_rsv_num, p_actor_id, p_currency::char(3),
    p_master_order_id, p_supplier_order_id, p_dispute_id,
    COALESCE(p_reason, 'Simulation reserve'), p_reason_code, p_reserve_type,
    v_amount, v_amount, 0,
    p_source_bucket, 'active',
    now(), p_release_at, p_expires_at,
    true,
    p_correlation_id, p_source_event_id, p_idempotency_key,
    p_release_conditions, p_notes, p_metadata
  ) RETURNING id INTO v_rsv_id;

  v_rebuild := public.mkt_fin_rebuild_provider_balance(p_actor_id, p_currency);

  PERFORM public.mkt_fin_audit(
    'reserve_created', 'reserve', v_rsv_id, NULL,
    NULL,
    jsonb_build_object('reserve_number', v_rsv_num, 'amount', v_amount,
      'source_bucket', p_source_bucket, 'reserve_type', p_reserve_type),
    'Reserve created — ' || v_rsv_num,
    p_correlation_id, NULL
  );

  PERFORM public.mkt_fin_outbox_publish(
    'marketplace.reserve.created',
    jsonb_build_object(
      'reserve_id', v_rsv_id, 'reserve_number', v_rsv_num,
      'provider_actor_id', p_actor_id, 'amount', v_amount,
      'simulation_only', true
    ),
    p_actor_id, NULL
  );

  RETURN jsonb_build_object(
    'status',             'created',
    'reserve_id',         v_rsv_id,
    'reserve_number',     v_rsv_num,
    'provider_actor_id',  p_actor_id,
    'currency',           p_currency,
    'reserved_amount',    v_amount,
    'source_bucket',      p_source_bucket,
    'reserve_type',       p_reserve_type,
    'reserve_status',     'active',
    'simulation_only',    true,
    'ledger_entry_id',    v_entry.id,
    'new_available',      v_rebuild->>'available_amount',
    'new_reserved',       v_rebuild->>'reserved_amount',
    'new_teb',            v_rebuild->>'total_economic_balance'
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 10: mkt_fin_release_simulation_reserve — parcial o total
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_release_simulation_reserve(
  p_reserve_id     uuid,
  p_amount         numeric(15,4) DEFAULT NULL,
  p_source_event_id text         DEFAULT NULL,
  p_correlation_id text          DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rsv        record;
  v_amount     numeric(15,4);
  v_entry      public.trade_marketplace_ledger_entries;
  v_new_status text;
  v_rebuild    jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  -- Idempotencia por source_event_id
  IF p_source_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trade_marketplace_ledger_entries
       WHERE source_event_id = p_source_event_id
         AND entry_type = 'RESERVE_RELEASE'
         AND actor_id = (SELECT provider_actor_id FROM public.trade_marketplace_reserves WHERE id = p_reserve_id)
    ) THEN
      SELECT * INTO v_rsv FROM public.trade_marketplace_reserves WHERE id = p_reserve_id;
      RETURN jsonb_build_object('status','replayed','reserve_id',p_reserve_id,
        'reserve_status', v_rsv.status, 'reserve_number', v_rsv.reserve_number);
    END IF;
  END IF;

  SELECT * INTO v_rsv FROM public.trade_marketplace_reserves
   WHERE id = p_reserve_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVE_NOT_FOUND: %', p_reserve_id; END IF;

  IF v_rsv.status NOT IN ('active', 'partially_released') THEN
    RAISE EXCEPTION 'RESERVE_TERMINAL: status=% cannot release', v_rsv.status;
  END IF;

  v_amount := COALESCE(p_amount, v_rsv.remaining_amount);

  IF v_amount <= 0 THEN RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE'; END IF;
  IF v_amount > v_rsv.remaining_amount THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_REMAINING: requested=% remaining=%',
      v_amount, v_rsv.remaining_amount;
  END IF;

  -- Ledger: RESERVE_RELEASE (positivo = devuelve al bucket origen)
  v_entry := public.mkt_fin_ledger_append(
    'RESERVE_RELEASE', v_amount,
    NULL, NULL, v_rsv.provider_actor_id,
    'Reserve release — ' || v_rsv.reserve_number,
    COALESCE(p_correlation_id, 'rsv-rel-' || gen_random_uuid()::text),
    p_source_event_id, NULL, 'simulation', NULL, v_rsv.reserve_type,
    v_rsv.currency::text, 'confirmed', now()
  );

  v_new_status := CASE
    WHEN (v_rsv.released_amount + v_amount) >= v_rsv.reserved_amount THEN 'released'
    ELSE 'partially_released'
  END;

  UPDATE public.trade_marketplace_reserves SET
    released_amount = released_amount + v_amount,
    status          = v_new_status,
    released_at     = CASE WHEN v_new_status = 'released' THEN now() ELSE NULL END,
    updated_at      = now()
  WHERE id = p_reserve_id;

  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_rsv.provider_actor_id, v_rsv.currency::text);

  PERFORM public.mkt_fin_audit(
    CASE WHEN v_new_status = 'released'
         THEN 'reserve_released' ELSE 'reserve_partially_released' END,
    'reserve', p_reserve_id, NULL,
    jsonb_build_object('status', v_rsv.status),
    jsonb_build_object('status', v_new_status, 'amount_released', v_amount),
    'Reserve release — ' || v_rsv.reserve_number, p_correlation_id, NULL
  );

  RETURN jsonb_build_object(
    'status',            'done',
    'reserve_id',        p_reserve_id,
    'reserve_number',    v_rsv.reserve_number,
    'reserve_status',    v_new_status,
    'amount_released',   v_amount,
    'total_released',    v_rsv.released_amount + v_amount,
    'remaining_amount',  v_rsv.remaining_amount - v_amount,
    'ledger_entry_id',   v_entry.id,
    'new_available',     v_rebuild->>'available_amount',
    'new_reserved',      v_rebuild->>'reserved_amount',
    'new_teb',           v_rebuild->>'total_economic_balance',
    'simulation_only',   true
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 11: mkt_fin_cancel_simulation_reserve
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_cancel_simulation_reserve(
  p_reserve_id     uuid,
  p_reason         text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rsv    record;
  v_rebuild jsonb;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  SELECT * INTO v_rsv FROM public.trade_marketplace_reserves
   WHERE id = p_reserve_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVE_NOT_FOUND: %', p_reserve_id; END IF;

  IF v_rsv.status IN ('released','expired','cancelled') THEN
    RAISE EXCEPTION 'RESERVE_TERMINAL: status=% cannot cancel', v_rsv.status;
  END IF;

  -- Si tiene fondos retenidos, libéralos al bucket origen
  IF v_rsv.remaining_amount > 0 THEN
    PERFORM public.mkt_fin_ledger_append(
      'RESERVE_RELEASE', v_rsv.remaining_amount,
      NULL, NULL, v_rsv.provider_actor_id,
      'Reserve cancel — ' || v_rsv.reserve_number,
      COALESCE(p_correlation_id, 'rsv-cancel-' || gen_random_uuid()::text),
      NULL, NULL, 'simulation', NULL, v_rsv.reserve_type,
      v_rsv.currency::text, 'confirmed', now()
    );
  END IF;

  UPDATE public.trade_marketplace_reserves SET
    status        = 'cancelled',
    cancelled_at  = now(),
    notes         = COALESCE(notes || ' | CANCEL: ' || COALESCE(p_reason,''), 'CANCEL: ' || COALESCE(p_reason,'')),
    updated_at    = now()
  WHERE id = p_reserve_id;

  v_rebuild := public.mkt_fin_rebuild_provider_balance(v_rsv.provider_actor_id, v_rsv.currency::text);

  PERFORM public.mkt_fin_audit('reserve_cancelled','reserve',p_reserve_id,NULL,
    jsonb_build_object('status',v_rsv.status,'remaining',v_rsv.remaining_amount),
    jsonb_build_object('status','cancelled','reason',p_reason),
    'Reserve cancelled — '||v_rsv.reserve_number, p_correlation_id, NULL);

  RETURN jsonb_build_object(
    'status',            'cancelled',
    'reserve_id',        p_reserve_id,
    'reserve_number',    v_rsv.reserve_number,
    'released_on_cancel', v_rsv.remaining_amount,
    'new_available',     v_rebuild->>'available_amount',
    'new_reserved',      v_rebuild->>'reserved_amount',
    'simulation_only',   true,
    'cancelled_at',      now()
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 12: mkt_fin_process_expired_simulation_reserves
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_process_expired_simulation_reserves(
  p_currency text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_rsv     record;
  v_cnt     int := 0;
  v_ids     uuid[] := '{}';
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  FOR v_rsv IN
    SELECT * FROM public.trade_marketplace_reserves
     WHERE status IN ('active','partially_released')
       AND expires_at IS NOT NULL
       AND expires_at <= now()
       AND (p_currency IS NULL OR currency::text = p_currency)
     FOR UPDATE SKIP LOCKED
  LOOP
    IF v_rsv.remaining_amount > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'RESERVE_RELEASE', v_rsv.remaining_amount,
        NULL, NULL, v_rsv.provider_actor_id,
        'Reserve expired — ' || v_rsv.reserve_number,
        'rsv-expired-' || gen_random_uuid()::text,
        NULL, NULL, 'simulation', NULL, v_rsv.reserve_type,
        v_rsv.currency::text, 'confirmed', now()
      );
    END IF;

    UPDATE public.trade_marketplace_reserves SET
      status      = 'expired',
      expired_at  = now(),
      updated_at  = now()
    WHERE id = v_rsv.id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_rsv.provider_actor_id, v_rsv.currency::text);

    v_ids := array_append(v_ids, v_rsv.id);
    v_cnt := v_cnt + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'processed',      v_cnt,
    'reserve_ids',    to_jsonb(v_ids),
    'processed_at',   now()
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 13: mkt_fin_get_reserve
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_reserve(
  p_reserve_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rsv record; BEGIN
  SELECT * INTO v_rsv FROM public.trade_marketplace_reserves WHERE id = p_reserve_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'RESERVE_NOT_FOUND: %', p_reserve_id; END IF;

  IF NOT (v_rsv.provider_actor_id = ANY(public._mkt_actor_ids_for_user())
          OR public._mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  RETURN to_jsonb(v_rsv);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 14: mkt_fin_list_provider_reserves
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_list_provider_reserves(
  p_actor_id uuid,
  p_limit    int  DEFAULT 20,
  p_offset   int  DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_total int;
BEGIN
  IF NOT (p_actor_id = ANY(public._mkt_actor_ids_for_user()) OR public._mkt_is_platform_admin()) THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.trade_marketplace_reserves
   WHERE provider_actor_id = p_actor_id;

  SELECT jsonb_agg(r ORDER BY r.created_at DESC) INTO v_items
    FROM (
      SELECT id, reserve_number, currency, reserve_type, status,
             requested_amount, reserved_amount, released_amount, remaining_amount,
             source_bucket, reason, reason_code,
             starts_at, release_at, expires_at, released_at, cancelled_at, expired_at,
             simulation_only, created_at
        FROM public.trade_marketplace_reserves
       WHERE provider_actor_id = p_actor_id
       ORDER BY created_at DESC
       LIMIT p_limit OFFSET p_offset
    ) r;

  RETURN jsonb_build_object(
    'items',  COALESCE(v_items, '[]'::jsonb),
    'total',  v_total,
    'limit',  p_limit,
    'offset', p_offset
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 15: mkt_fin_list_admin_reserves
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_list_admin_reserves(
  p_status   text DEFAULT NULL,
  p_currency text DEFAULT NULL,
  p_limit    int  DEFAULT 50,
  p_offset   int  DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_items jsonb;
  v_total int;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.trade_marketplace_reserves
   WHERE (p_status   IS NULL OR status = p_status)
     AND (p_currency IS NULL OR currency::text = p_currency);

  SELECT jsonb_agg(r ORDER BY r.created_at DESC) INTO v_items
    FROM (
      SELECT id, reserve_number, provider_actor_id, currency, reserve_type, status,
             requested_amount, reserved_amount, released_amount, remaining_amount,
             source_bucket, reason, reason_code, dispute_id,
             starts_at, expires_at, released_at, cancelled_at,
             simulation_only, created_at
        FROM public.trade_marketplace_reserves
       WHERE (p_status   IS NULL OR status = p_status)
         AND (p_currency IS NULL OR currency::text = p_currency)
       ORDER BY created_at DESC
       LIMIT p_limit OFFSET p_offset
    ) r;

  RETURN jsonb_build_object(
    'items',   COALESCE(v_items, '[]'::jsonb),
    'total',   v_total,
    'limit',   p_limit,
    'offset',  p_offset,
    'filters', jsonb_build_object('status', p_status, 'currency', p_currency)
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 16: mkt_fin_get_reserve_aging_summary — por proveedor
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_reserve_aging_summary(
  p_actor_id uuid,
  p_currency text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'provider_actor_id',  p_actor_id,
    'currency',           p_currency,
    'active_count',       COUNT(*) FILTER (WHERE status IN ('active','partially_released')),
    'total_reserved',     COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released')), 0),
    'oldest_reserve_at',  MIN(starts_at) FILTER (WHERE status IN ('active','partially_released')),
    'by_aging', jsonb_build_object(
      '0_7',    jsonb_build_object(
        'count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND starts_at >= now()-INTERVAL '7 days'),
        'amount', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released') AND starts_at >= now()-INTERVAL '7 days'),0)
      ),
      '8_30',   jsonb_build_object(
        'count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '7 days' AND starts_at >= now()-INTERVAL '30 days'),
        'amount', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '7 days' AND starts_at >= now()-INTERVAL '30 days'),0)
      ),
      '31_60',  jsonb_build_object(
        'count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '30 days' AND starts_at >= now()-INTERVAL '60 days'),
        'amount', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '30 days' AND starts_at >= now()-INTERVAL '60 days'),0)
      ),
      '61_90',  jsonb_build_object(
        'count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '60 days' AND starts_at >= now()-INTERVAL '90 days'),
        'amount', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '60 days' AND starts_at >= now()-INTERVAL '90 days'),0)
      ),
      '90_plus',jsonb_build_object(
        'count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '90 days'),
        'amount', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released') AND starts_at < now()-INTERVAL '90 days'),0)
      )
    ),
    'near_expiry_count',  COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND expires_at IS NOT NULL AND expires_at <= now()+INTERVAL '7 days'),
    'calculated_at',      now()
  ) INTO v_result
  FROM public.trade_marketplace_reserves
  WHERE provider_actor_id = p_actor_id AND currency::text = p_currency;

  RETURN v_result;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Part 17: mkt_fin_admin_reserves_overview — KPIs globales
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_admin_reserves_overview() RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_r jsonb; BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'UNAUTHORIZED: platform_admin required';
  END IF;

  SELECT jsonb_build_object(
    'total_reserved',          COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released')), 0),
    'providers_with_reserves', COUNT(DISTINCT provider_actor_id) FILTER (WHERE status IN ('active','partially_released')),
    'active_reserves',         COUNT(*) FILTER (WHERE status = 'active'),
    'partially_released',      COUNT(*) FILTER (WHERE status = 'partially_released'),
    'expired_reserves',        COUNT(*) FILTER (WHERE status = 'expired'),
    'cancelled_reserves',      COUNT(*) FILTER (WHERE status = 'cancelled'),
    'released_reserves',       COUNT(*) FILTER (WHERE status = 'released'),
    'reserves_near_expiry',    COUNT(*) FILTER (WHERE status IN ('active','partially_released') AND expires_at IS NOT NULL AND expires_at <= now()+INTERVAL '7 days'),
    'total_ever_reserved',     COALESCE(SUM(reserved_amount), 0),
    'total_ever_released',     COALESCE(SUM(released_amount), 0),
    'by_currency', (
      SELECT jsonb_object_agg(currency::text, jsonb_build_object(
        'total_reserved', COALESCE(SUM(remaining_amount) FILTER (WHERE status IN ('active','partially_released')), 0),
        'active_count',   COUNT(*) FILTER (WHERE status IN ('active','partially_released'))
      ))
      FROM public.trade_marketplace_reserves
    ),
    'simulation_only',         true,
    'calculated_at',           now()
  ) INTO v_r FROM public.trade_marketplace_reserves;

  RETURN COALESCE(v_r, jsonb_build_object(
    'total_reserved', 0, 'providers_with_reserves', 0,
    'active_reserves', 0, 'simulation_only', true, 'calculated_at', now()
  ));
END;
$$;

COMMIT;
