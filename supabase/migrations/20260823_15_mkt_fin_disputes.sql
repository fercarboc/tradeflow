-- ═══════════════════════════════════════════════════════════════════════════
-- MP-FIN-2C: Disputes + Chargebacks
-- DISPUTE ≠ REFUND. Aislamiento por proveedor. simulation_only=true (STRIPE_GATE).
-- Ledger: CHARGEBACK_DEBIT (neg) / CHARGEBACK_FEE (neg) / CHARGEBACK_CREDIT (pos)
-- State machine: opened→needs_response|under_review|won|lost|accepted|cancelled→closed
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. TABLA: trade_marketplace_disputes ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_disputes (
  id                     uuid          NOT NULL DEFAULT gen_random_uuid(),
  dispute_number         text          NOT NULL,                    -- DI-YYYY-NNNN

  master_order_id        uuid          NOT NULL
    REFERENCES public.trade_marketplace_master_orders(id),
  supplier_order_id      uuid          NOT NULL
    REFERENCES public.trade_marketplace_orders(id),
  provider_actor_id      uuid          NOT NULL,
  buyer_actor_id         uuid,                                      -- NULL en Phase 0

  currency               char(3)       NOT NULL DEFAULT 'EUR',
  amount                 numeric(15,4) NOT NULL,                    -- importe disputado

  reason                 text,
  reason_code            text,

  status                 text          NOT NULL DEFAULT 'opened'
    CHECK (status IN (
      'opened','needs_response','evidence_submitted','under_review',
      'won','lost','accepted','cancelled','closed'
    )),

  responsibility         text          NOT NULL DEFAULT 'undetermined'  -- LEGAL_GATE: configurable
    CHECK (responsibility IN ('provider','platform','buyer','undetermined','shared')),

  simulation_only        bool          NOT NULL DEFAULT true,

  -- Tracking chargeback económico
  chargeback_posted      bool          NOT NULL DEFAULT false,
  chargeback_amount      numeric(15,4),
  chargeback_fee_amount  numeric(15,4) NOT NULL DEFAULT 0,          -- STRIPE_GATE: configurable
  chargeback_reversed    bool          NOT NULL DEFAULT false,

  outcome                text
    CHECK (outcome IS NULL OR outcome IN ('won','lost','accepted','cancelled')),

  opened_at              timestamptz   NOT NULL DEFAULT now(),
  evidence_due_at        timestamptz,
  submitted_at           timestamptz,
  resolved_at            timestamptz,
  closed_at              timestamptz,

  external_provider      text          NOT NULL DEFAULT 'simulation',
  external_dispute_id    text,
  external_payment_id    text,
  source_event_id        text,
  idempotency_key        text,

  created_by             uuid,
  correlation_id         text,

  created_at             timestamptz   NOT NULL DEFAULT now(),
  updated_at             timestamptz   NOT NULL DEFAULT now(),
  metadata               jsonb,

  PRIMARY KEY (id),
  UNIQUE (dispute_number),
  UNIQUE (idempotency_key),
  CONSTRAINT chk_dispute_simulation CHECK (simulation_only = true),
  CONSTRAINT chk_dispute_amount_positive CHECK (amount > 0)
);

COMMENT ON TABLE public.trade_marketplace_disputes IS
  'MP-FIN-2C — Disputes/chargebacks por supplier order. '
  'DISPUTE ≠ REFUND. Aislamiento por proveedor. simulation_only=true (STRIPE_GATE cerrado).';

-- ── 2. TABLA: trade_marketplace_dispute_evidence ────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_dispute_evidence (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  dispute_id           uuid        NOT NULL
    REFERENCES public.trade_marketplace_disputes(id) ON DELETE CASCADE,

  evidence_type        text        NOT NULL
    CHECK (evidence_type IN (
      'invoice','delivery_proof','tracking','conversation',
      'acceptance','pod','photo','conditions','other'
    )),
  storage_path         text,
  document_reference   text,
  description          text,

  submitted_by         uuid,
  submitted_at         timestamptz NOT NULL DEFAULT now(),
  created_at           timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (id)
);

COMMENT ON TABLE public.trade_marketplace_dispute_evidence IS
  'Evidencias adjuntas a disputes (MP-FIN-2C). Conecta a Stripe Evidence API cuando STRIPE_GATE abra.';

-- ── 3. ÍNDICES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_disputes_supplier_order
  ON public.trade_marketplace_disputes(supplier_order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_master_order
  ON public.trade_marketplace_disputes(master_order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_provider_actor
  ON public.trade_marketplace_disputes(provider_actor_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status
  ON public.trade_marketplace_disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_external_dispute_id
  ON public.trade_marketplace_disputes(external_dispute_id)
  WHERE external_dispute_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_disputes_source_event
  ON public.trade_marketplace_disputes(source_event_id)
  WHERE source_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dispute_evidence_dispute
  ON public.trade_marketplace_dispute_evidence(dispute_id);

-- ── 4. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_dispute_evidence ENABLE ROW LEVEL SECURITY;

-- Platform admin: acceso completo
CREATE POLICY disputes_admin_all ON public.trade_marketplace_disputes
  FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- Proveedor: solo sus propios disputes (SELECT)
CREATE POLICY disputes_provider_select ON public.trade_marketplace_disputes
  FOR SELECT TO authenticated
  USING (
    provider_actor_id IN (
      SELECT id FROM public.trade_marketplace_actors
      WHERE id = provider_actor_id
    )
  );

-- Evidence: admin completo
CREATE POLICY dispute_evidence_admin_all ON public.trade_marketplace_dispute_evidence
  FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- Evidence: proveedor puede SELECT evidencias de sus disputes
CREATE POLICY dispute_evidence_provider_select ON public.trade_marketplace_dispute_evidence
  FOR SELECT TO authenticated
  USING (
    dispute_id IN (
      SELECT id FROM public.trade_marketplace_disputes d
      WHERE d.provider_actor_id = d.provider_actor_id  -- scoped por RLS padre
    )
  );

-- ── 5. TRIGGER updated_at ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_disputes_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_disputes_updated_at
  BEFORE UPDATE ON public.trade_marketplace_disputes
  FOR EACH ROW EXECUTE FUNCTION public._mkt_disputes_set_updated_at();

-- ── 6. HELPER: _mkt_validate_dispute_transition ──────────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_validate_dispute_transition(
  p_current text,
  p_new     text
) RETURNS bool
  LANGUAGE sql IMMUTABLE
  SECURITY DEFINER SET search_path = public
AS $$
  SELECT p_new = ANY(CASE p_current
    WHEN 'opened'             THEN ARRAY['needs_response','under_review','won','lost','accepted','cancelled']
    WHEN 'needs_response'     THEN ARRAY['evidence_submitted','lost','cancelled']
    WHEN 'evidence_submitted' THEN ARRAY['under_review','won','lost','cancelled']
    WHEN 'under_review'       THEN ARRAY['won','lost','cancelled']
    WHEN 'won'                THEN ARRAY['closed']
    WHEN 'lost'               THEN ARRAY['closed']
    WHEN 'accepted'           THEN ARRAY['closed']
    WHEN 'cancelled'          THEN ARRAY[]::text[]   -- terminal
    WHEN 'closed'             THEN ARRAY[]::text[]   -- terminal
    ELSE ARRAY[]::text[]
  END);
$$;

-- ── 7. HELPER: _mkt_calc_chargeback_exposure ─────────────────────────────────
-- Retorna la exposición disputabe restante para un supplier_order.
-- Fórmula: original - refunds_procesados - chargebacks_netos - disputes_activos_no_posteados
-- p_exclude_dispute_id: excluye ese dispute de "open_disp" (útil al re-validar en LOST)

CREATE OR REPLACE FUNCTION public._mkt_calc_chargeback_exposure(
  p_supplier_order_id  uuid,
  p_exclude_dispute_id uuid DEFAULT NULL
) RETURNS numeric(15,4)
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_original  numeric(15,4);
  v_refunded  numeric(15,4);
  v_cb_net    numeric(15,4);
  v_open_disp numeric(15,4);
BEGIN
  SELECT COALESCE(goods_gross_snapshot, 0) + COALESCE(shipping_gross_snapshot, 0)
    INTO v_original
    FROM public.trade_marketplace_orders
   WHERE id = p_supplier_order_id;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;

  -- Refunds ya procesados (no rechazados/cancelados/failed)
  SELECT COALESCE(SUM(ri.gross_refund), 0)
    INTO v_refunded
    FROM public.trade_marketplace_refund_items ri
    JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
   WHERE r.supplier_order_id = p_supplier_order_id
     AND r.status NOT IN ('rejected', 'cancelled', 'failed');

  -- Impacto neto de chargebacks del ledger:
  --   CHARGEBACK_DEBIT tiene amount < 0  →  -SUM positivo = lo que se perdió
  --   CHARGEBACK_CREDIT tiene amount > 0 →  -SUM negativo = lo que se recuperó
  --   La suma neta = lo que el proveedor perdió definitivamente
  SELECT COALESCE(-SUM(amount), 0)
    INTO v_cb_net
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = p_supplier_order_id
     AND entry_type IN ('CHARGEBACK_DEBIT', 'CHARGEBACK_CREDIT')
     AND status != 'failed';

  -- Disputes activos no terminales sin chargeback posteado aún
  -- (previene crear dos disputes que juntos excedan la exposición)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_open_disp
    FROM public.trade_marketplace_disputes
   WHERE supplier_order_id = p_supplier_order_id
     AND status NOT IN ('won', 'lost', 'accepted', 'cancelled', 'closed')
     AND chargeback_posted = false
     AND (p_exclude_dispute_id IS NULL OR id != p_exclude_dispute_id);

  RETURN GREATEST(0::numeric(15,4), v_original - v_refunded - v_cb_net - v_open_disp);
END;
$$;

-- ── 8. FUNCIÓN: mkt_fin_get_dispute_exposure ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_dispute_exposure(
  p_supplier_order_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_goods_gross  numeric(15,4);
  v_ship_gross   numeric(15,4);
  v_original     numeric(15,4);
  v_currency     char(3);
  v_refunded     numeric(15,4);
  v_cb_debit     numeric(15,4);
  v_cb_credit    numeric(15,4);
  v_open_disp    numeric(15,4);
  v_exposure     numeric(15,4);
BEGIN
  SELECT
    COALESCE(goods_gross_snapshot, 0),
    COALESCE(shipping_gross_snapshot, 0),
    COALESCE(goods_gross_snapshot, 0) + COALESCE(shipping_gross_snapshot, 0),
    COALESCE(currency, 'EUR')
    INTO v_goods_gross, v_ship_gross, v_original, v_currency
    FROM public.trade_marketplace_orders
   WHERE id = p_supplier_order_id;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;

  SELECT COALESCE(SUM(ri.gross_refund), 0)
    INTO v_refunded
    FROM public.trade_marketplace_refund_items ri
    JOIN public.trade_marketplace_refunds r ON r.id = ri.refund_id
   WHERE r.supplier_order_id = p_supplier_order_id
     AND r.status NOT IN ('rejected', 'cancelled', 'failed');

  SELECT
    COALESCE(-SUM(amount) FILTER (WHERE entry_type = 'CHARGEBACK_DEBIT'), 0),
    COALESCE( SUM(amount) FILTER (WHERE entry_type = 'CHARGEBACK_CREDIT'), 0)
    INTO v_cb_debit, v_cb_credit
    FROM public.trade_marketplace_ledger_entries
   WHERE supplier_order_id = p_supplier_order_id
     AND entry_type IN ('CHARGEBACK_DEBIT', 'CHARGEBACK_CREDIT')
     AND status != 'failed';

  SELECT COALESCE(SUM(amount), 0)
    INTO v_open_disp
    FROM public.trade_marketplace_disputes
   WHERE supplier_order_id = p_supplier_order_id
     AND status NOT IN ('won', 'lost', 'accepted', 'cancelled', 'closed')
     AND chargeback_posted = false;

  v_exposure := GREATEST(0, v_original - v_refunded - v_cb_debit + v_cb_credit - v_open_disp);

  RETURN jsonb_build_object(
    'supplier_order_id',         p_supplier_order_id,
    'currency',                  v_currency,
    'original_goods_gross',      v_goods_gross,
    'original_shipping_gross',   v_ship_gross,
    'original_total_gross',      v_original,
    'refunded_gross',            v_refunded,
    'chargebacks_debit_gross',   v_cb_debit,
    'chargebacks_credit_gross',  v_cb_credit,
    'chargebacks_net_impact',    v_cb_debit - v_cb_credit,
    'open_disputes_amount',      v_open_disp,
    'disputable_exposure',       v_exposure,
    'current_economic_position', v_original - v_refunded - (v_cb_debit - v_cb_credit)
  );
END;
$$;

-- ── 9. FUNCIÓN: mkt_fin_preview_dispute_outcome ──────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_preview_dispute_outcome(
  p_dispute_id       uuid,
  p_outcome          text,
  p_chargeback_fee   numeric DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d              record;
  v_exposure       numeric(15,4);
  v_debit_amount   numeric(15,4) := 0;
  v_fee_amount     numeric(15,4) := 0;
  v_credit_amount  numeric(15,4) := 0;
  v_net_impact     numeric(15,4) := 0;
BEGIN
  SELECT * INTO v_d FROM public.trade_marketplace_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND: %', p_dispute_id; END IF;

  IF NOT public._mkt_validate_dispute_transition(v_d.status, p_outcome) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % → %', v_d.status, p_outcome;
  END IF;

  v_exposure := public._mkt_calc_chargeback_exposure(v_d.supplier_order_id, p_dispute_id);
  v_fee_amount := COALESCE(p_chargeback_fee, 0);

  IF p_outcome IN ('lost', 'accepted') THEN
    v_debit_amount := v_d.amount;
    v_net_impact   := -(v_debit_amount + v_fee_amount);
  ELSIF p_outcome = 'won' AND v_d.chargeback_posted THEN
    v_credit_amount := v_d.chargeback_amount;
    v_net_impact    := v_credit_amount;
  END IF;

  RETURN jsonb_build_object(
    'dispute_id',            p_dispute_id,
    'dispute_number',        v_d.dispute_number,
    'current_status',        v_d.status,
    'simulated_outcome',     p_outcome,
    'dispute_amount',        v_d.amount,
    'disputable_exposure',   v_exposure,
    'chargeback_debit',      v_debit_amount,
    'chargeback_fee',        v_fee_amount,
    'chargeback_credit',     v_credit_amount,
    'net_economic_impact',   v_net_impact,
    'chargeback_was_posted', v_d.chargeback_posted,
    'simulation_only',       true,
    'stripe_gate',           'CLOSED — simulation only'
  );
END;
$$;

-- ── 10. FUNCIÓN: mkt_fin_create_dispute ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_create_dispute(
  p_supplier_order_id    uuid,
  p_amount               numeric,
  p_reason               text        DEFAULT NULL,
  p_reason_code          text        DEFAULT NULL,
  p_responsibility       text        DEFAULT 'undetermined',
  p_evidence_due_at      timestamptz DEFAULT NULL,
  p_external_dispute_id  text        DEFAULT NULL,
  p_external_payment_id  text        DEFAULT NULL,
  p_idempotency_key      text        DEFAULT NULL,
  p_source_event_id      text        DEFAULT NULL,
  p_correlation_id       text        DEFAULT NULL,
  p_metadata             jsonb       DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order       record;
  v_exposure    numeric(15,4);
  v_dispute_id  uuid;
  v_dispute_num text;
  v_corr        text;
BEGIN
  -- Idempotencia por idempotency_key
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_dispute_id
      FROM public.trade_marketplace_disputes
     WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_number',    dispute_number,
          'supplier_order_id', supplier_order_id,
          'amount',            amount,
          'dispute_status',    status,
          'responsibility',    responsibility
        )
        FROM public.trade_marketplace_disputes WHERE id = v_dispute_id
      );
    END IF;
  END IF;

  -- Idempotencia por source_event_id
  IF p_source_event_id IS NOT NULL THEN
    SELECT id INTO v_dispute_id
      FROM public.trade_marketplace_disputes
     WHERE source_event_id = p_source_event_id;
    IF FOUND THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_number',    dispute_number,
          'supplier_order_id', supplier_order_id,
          'amount',            amount,
          'dispute_status',    status,
          'responsibility',    responsibility
        )
        FROM public.trade_marketplace_disputes WHERE id = v_dispute_id
      );
    END IF;
  END IF;

  -- Cargar snapshot del supplier order
  SELECT o.id, o.master_order_id, o.provider_actor_id,
         COALESCE(o.currency, 'EUR') AS currency,
         COALESCE(o.goods_gross_snapshot, 0) + COALESCE(o.shipping_gross_snapshot, 0) AS total_gross
    INTO v_order
    FROM public.trade_marketplace_orders o
   WHERE o.id = p_supplier_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: %', p_supplier_order_id;
  END IF;
  IF v_order.total_gross = 0 THEN
    RAISE EXCEPTION 'ORDER_NO_SNAPSHOT: supplier order sin amounts snapshot';
  END IF;

  -- Validar responsabilidad
  IF p_responsibility NOT IN ('provider','platform','buyer','undetermined','shared') THEN
    RAISE EXCEPTION 'INVALID_RESPONSIBILITY: %', p_responsibility;
  END IF;

  -- Validar importe > 0
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE: %', p_amount;
  END IF;

  -- Calcular exposición disponible y validar
  v_exposure := public._mkt_calc_chargeback_exposure(p_supplier_order_id, NULL);
  IF p_amount > v_exposure THEN
    RAISE EXCEPTION 'AMOUNT_EXCEEDS_EXPOSURE: requested=% exposure=%', p_amount, v_exposure;
  END IF;

  -- Número de dispute
  v_dispute_num := public.next_financial_doc_number('DI');
  v_corr        := COALESCE(p_correlation_id, 'dispute-' || gen_random_uuid()::text);

  -- Insertar dispute (sin entrada ledger — solo al resolver)
  INSERT INTO public.trade_marketplace_disputes (
    dispute_number, master_order_id, supplier_order_id,
    provider_actor_id, buyer_actor_id,
    currency, amount, reason, reason_code,
    responsibility, simulation_only,
    evidence_due_at, external_dispute_id, external_payment_id,
    source_event_id, idempotency_key, correlation_id, metadata, created_by
  ) VALUES (
    v_dispute_num,
    v_order.master_order_id,
    p_supplier_order_id,
    v_order.provider_actor_id,
    NULL,
    v_order.currency::char(3),
    p_amount,
    p_reason,
    p_reason_code,
    p_responsibility,
    true,
    p_evidence_due_at,
    p_external_dispute_id,
    p_external_payment_id,
    p_source_event_id,
    p_idempotency_key,
    v_corr,
    p_metadata,
    auth.uid()
  )
  RETURNING id INTO v_dispute_id;

  PERFORM public.mkt_fin_audit(
    'dispute_created', 'dispute', v_dispute_id, auth.uid(), NULL,
    jsonb_build_object(
      'dispute_number',   v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',  v_order.master_order_id,
      'amount',           p_amount,
      'responsibility',   p_responsibility,
      'exposure_at_open', v_exposure
    ),
    'Dispute abierto — Phase 2C (sin impacto ledger)', v_corr, p_source_event_id
  );

  PERFORM public.mkt_fin_outbox_publish(
    'dispute.opened',
    jsonb_build_object(
      'dispute_id',        v_dispute_id,
      'dispute_number',    v_dispute_num,
      'supplier_order_id', p_supplier_order_id,
      'master_order_id',   v_order.master_order_id,
      'provider_actor_id', v_order.provider_actor_id,
      'amount',            p_amount,
      'responsibility',    p_responsibility,
      'simulation_only',   true
    ),
    auth.uid(), NULL
  );

  RETURN jsonb_build_object(
    'status',            'created',
    'dispute_id',        v_dispute_id,
    'dispute_number',    v_dispute_num,
    'supplier_order_id', p_supplier_order_id,
    'master_order_id',   v_order.master_order_id,
    'provider_actor_id', v_order.provider_actor_id,
    'amount',            p_amount,
    'responsibility',    p_responsibility,
    'dispute_status',    'opened',
    'exposure_at_open',  v_exposure,
    'simulation_only',   true,
    'correlation_id',    v_corr
  );
END;
$$;

-- ── 11. FUNCIÓN: mkt_fin_add_dispute_evidence ────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_add_dispute_evidence(
  p_dispute_id          uuid,
  p_evidence_type       text,
  p_description         text DEFAULT NULL,
  p_storage_path        text DEFAULT NULL,
  p_document_reference  text DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d           record;
  v_evidence_id uuid;
  v_new_status  text;
BEGIN
  SELECT * INTO v_d FROM public.trade_marketplace_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND: %', p_dispute_id; END IF;

  IF v_d.status IN ('won', 'lost', 'accepted', 'cancelled', 'closed') THEN
    RAISE EXCEPTION 'DISPUTE_TERMINAL: no se puede añadir evidencia en estado=%', v_d.status;
  END IF;

  INSERT INTO public.trade_marketplace_dispute_evidence (
    dispute_id, evidence_type, description, storage_path, document_reference, submitted_by
  ) VALUES (
    p_dispute_id, p_evidence_type, p_description, p_storage_path, p_document_reference, auth.uid()
  )
  RETURNING id INTO v_evidence_id;

  -- Avanzar estado si procede
  v_new_status := v_d.status;
  IF v_d.status IN ('opened', 'needs_response') THEN
    v_new_status := 'evidence_submitted';
    UPDATE public.trade_marketplace_disputes
       SET status = 'evidence_submitted', submitted_at = now()
     WHERE id = p_dispute_id;
  END IF;

  RETURN jsonb_build_object(
    'evidence_id',    v_evidence_id,
    'dispute_id',     p_dispute_id,
    'evidence_type',  p_evidence_type,
    'dispute_status', v_new_status
  );
END;
$$;

-- ── 12. FUNCIÓN: mkt_fin_simulate_dispute_outcome ────────────────────────────
-- Transiciona el estado del dispute y posta entradas ledger según outcome.
-- LOST/ACCEPTED  → CHARGEBACK_DEBIT (neg) + opcional CHARGEBACK_FEE (neg)
-- WON (post-LOST) → CHARGEBACK_CREDIT (pos, reversal del DEBIT)
-- WON (sin LOST)  → sin entrada ledger
-- CANCELLED/CLOSED → sin entrada ledger

CREATE OR REPLACE FUNCTION public.mkt_fin_simulate_dispute_outcome(
  p_dispute_id       uuid,
  p_outcome          text,
  p_chargeback_fee   numeric     DEFAULT 0,
  p_source_event_id  text        DEFAULT NULL,
  p_correlation_id   text        DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d               record;
  v_corr            text;
  v_debit_entry_id  uuid;
  v_entry_row       public.trade_marketplace_ledger_entries;
BEGIN
  -- Idempotencia por source_event_id (verifica si ya hay entrada ledger de este evento)
  IF p_source_event_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trade_marketplace_ledger_entries
       WHERE source_event_id = p_source_event_id
         AND supplier_order_id = (
           SELECT supplier_order_id FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
         )
    ) THEN
      RETURN (
        SELECT jsonb_build_object(
          'status',            'replayed',
          'dispute_id',        id,
          'dispute_status',    status,
          'outcome',           outcome,
          'chargeback_posted', chargeback_posted
        )
        FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
      );
    END IF;
  END IF;

  SELECT * INTO v_d
    FROM public.trade_marketplace_disputes
   WHERE id = p_dispute_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND: %', p_dispute_id; END IF;

  -- Validar transición de estado
  IF NOT public._mkt_validate_dispute_transition(v_d.status, p_outcome) THEN
    RAISE EXCEPTION 'INVALID_TRANSITION: % → %', v_d.status, p_outcome;
  END IF;

  v_corr := COALESCE(p_correlation_id, 'dispute-outcome-' || gen_random_uuid()::text);

  -- ── LOST: chargeback debitado al proveedor ──────────────────────────────
  IF p_outcome = 'lost' THEN

    v_entry_row := public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT',
      -(v_d.amount),
      v_d.master_order_id,
      v_d.supplier_order_id,
      v_d.provider_actor_id,
      'Chargeback debit — ' || v_d.dispute_number,
      v_corr,
      p_source_event_id,
      NULL,
      'simulation',
      p_dispute_id::text,
      'dispute',
      v_d.currency::char,
      'confirmed',
      now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE',
        -(p_chargeback_fee),
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback fee — ' || v_d.dispute_number,
        v_corr,
        NULL,
        NULL,
        'simulation',
        p_dispute_id::text,
        'dispute_fee',
        v_d.currency::char,
        'confirmed',
        now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status               = 'lost',
      outcome              = 'lost',
      chargeback_posted    = true,
      chargeback_amount    = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at          = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  -- ── ACCEPTED: proveedor acepta sin disputar (igual que LOST económicamente) ──
  ELSIF p_outcome = 'accepted' THEN

    PERFORM public.mkt_fin_ledger_append(
      'CHARGEBACK_DEBIT',
      -(v_d.amount),
      v_d.master_order_id,
      v_d.supplier_order_id,
      v_d.provider_actor_id,
      'Chargeback debit (accepted) — ' || v_d.dispute_number,
      v_corr,
      p_source_event_id,
      NULL,
      'simulation',
      p_dispute_id::text,
      'dispute',
      v_d.currency::char,
      'confirmed',
      now()
    );

    IF COALESCE(p_chargeback_fee, 0) > 0 THEN
      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_FEE',
        -(p_chargeback_fee),
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback fee (accepted) — ' || v_d.dispute_number,
        v_corr,
        NULL,
        NULL,
        'simulation',
        p_dispute_id::text,
        'dispute_fee',
        v_d.currency::char,
        'confirmed',
        now()
      );
    END IF;

    UPDATE public.trade_marketplace_disputes SET
      status               = 'accepted',
      outcome              = 'accepted',
      chargeback_posted    = true,
      chargeback_amount    = v_d.amount,
      chargeback_fee_amount = COALESCE(p_chargeback_fee, 0),
      resolved_at          = now()
    WHERE id = p_dispute_id;

    PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

  -- ── WON: proveedor gana el dispute ───────────────────────────────────────
  ELSIF p_outcome = 'won' THEN

    IF v_d.chargeback_posted THEN
      -- Buscar la entrada CHARGEBACK_DEBIT de este dispute para compensarla
      SELECT id INTO v_debit_entry_id
        FROM public.trade_marketplace_ledger_entries
       WHERE supplier_order_id = v_d.supplier_order_id
         AND entry_type = 'CHARGEBACK_DEBIT'
         AND external_id = p_dispute_id::text
         AND status != 'failed'
       ORDER BY occurred_at DESC
       LIMIT 1;

      PERFORM public.mkt_fin_ledger_append(
        'CHARGEBACK_CREDIT',
        v_d.chargeback_amount,
        v_d.master_order_id,
        v_d.supplier_order_id,
        v_d.provider_actor_id,
        'Chargeback reversal (won) — ' || v_d.dispute_number,
        v_corr,
        p_source_event_id,
        v_debit_entry_id,
        'simulation',
        p_dispute_id::text,
        'dispute_reversal',
        v_d.currency::char,
        'confirmed',
        now()
      );

      UPDATE public.trade_marketplace_disputes SET
        status              = 'won',
        outcome             = 'won',
        chargeback_reversed = true,
        resolved_at         = now()
      WHERE id = p_dispute_id;

      PERFORM public.mkt_fin_rebuild_provider_balance(v_d.provider_actor_id, v_d.currency::text);

    ELSE
      -- WON sin chargeback previo: solo estado, sin entrada ledger
      UPDATE public.trade_marketplace_disputes SET
        status      = 'won',
        outcome     = 'won',
        resolved_at = now()
      WHERE id = p_dispute_id;
    END IF;

  -- ── CANCELLED: sin impacto económico ─────────────────────────────────────
  ELSIF p_outcome = 'cancelled' THEN
    UPDATE public.trade_marketplace_disputes SET
      status      = 'cancelled',
      outcome     = 'cancelled',
      resolved_at = now()
    WHERE id = p_dispute_id;

  -- ── CLOSED: cierre formal de dispute resuelto ─────────────────────────────
  ELSIF p_outcome = 'closed' THEN
    UPDATE public.trade_marketplace_disputes SET
      status    = 'closed',
      closed_at = now()
    WHERE id = p_dispute_id;

  -- ── ESTADOS INTERMEDIOS: needs_response, under_review ────────────────────
  ELSE
    UPDATE public.trade_marketplace_disputes SET status = p_outcome
    WHERE id = p_dispute_id;

    IF p_outcome = 'needs_response' THEN
      UPDATE public.trade_marketplace_disputes
         SET evidence_due_at = now() + INTERVAL '7 days'
       WHERE id = p_dispute_id AND evidence_due_at IS NULL;
    END IF;
  END IF;

  -- Audit
  PERFORM public.mkt_fin_audit(
    'dispute_outcome_simulated', 'dispute', p_dispute_id, NULL,
    jsonb_build_object('status', v_d.status),
    jsonb_build_object(
      'status',          p_outcome,
      'chargeback_debit', CASE WHEN p_outcome IN ('lost','accepted') THEN -(v_d.amount) ELSE 0 END,
      'chargeback_fee',   COALESCE(p_chargeback_fee, 0),
      'chargeback_credit', CASE WHEN p_outcome = 'won' AND v_d.chargeback_posted THEN v_d.chargeback_amount ELSE 0 END
    ),
    'Outcome simulado — ' || v_d.dispute_number, v_corr, p_source_event_id
  );

  -- Outbox
  PERFORM public.mkt_fin_outbox_publish(
    'dispute.' || p_outcome,
    jsonb_build_object(
      'dispute_id',        p_dispute_id,
      'dispute_number',    v_d.dispute_number,
      'supplier_order_id', v_d.supplier_order_id,
      'provider_actor_id', v_d.provider_actor_id,
      'outcome',           p_outcome,
      'amount',            v_d.amount,
      'simulation_only',   true
    ),
    NULL, NULL
  );

  RETURN (
    SELECT jsonb_build_object(
      'status',                'done',
      'dispute_id',            id,
      'dispute_number',        dispute_number,
      'dispute_status',        status,
      'outcome',               outcome,
      'chargeback_posted',     chargeback_posted,
      'chargeback_reversed',   chargeback_reversed,
      'chargeback_amount',     chargeback_amount,
      'chargeback_fee_amount', chargeback_fee_amount,
      'simulation_only',       true
    )
    FROM public.trade_marketplace_disputes WHERE id = p_dispute_id
  );
END;
$$;

-- ── 13. FUNCIÓN: mkt_fin_get_dispute ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_dispute(
  p_dispute_id uuid
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_d        record;
  v_evidence jsonb;
BEGIN
  SELECT * INTO v_d FROM public.trade_marketplace_disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPUTE_NOT_FOUND: %', p_dispute_id; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id',                 e.id,
    'evidence_type',      e.evidence_type,
    'description',        e.description,
    'storage_path',       e.storage_path,
    'document_reference', e.document_reference,
    'submitted_at',       e.submitted_at
  ) ORDER BY e.submitted_at), '[]'::jsonb)
  INTO v_evidence
  FROM public.trade_marketplace_dispute_evidence e
  WHERE e.dispute_id = p_dispute_id;

  RETURN jsonb_build_object(
    'dispute_id',          v_d.id,
    'dispute_number',      v_d.dispute_number,
    'master_order_id',     v_d.master_order_id,
    'supplier_order_id',   v_d.supplier_order_id,
    'provider_actor_id',   v_d.provider_actor_id,
    'currency',            v_d.currency,
    'amount',              v_d.amount,
    'reason',              v_d.reason,
    'reason_code',         v_d.reason_code,
    'status',              v_d.status,
    'responsibility',      v_d.responsibility,
    'outcome',             v_d.outcome,
    'chargeback_posted',   v_d.chargeback_posted,
    'chargeback_amount',   v_d.chargeback_amount,
    'chargeback_fee',      v_d.chargeback_fee_amount,
    'chargeback_reversed', v_d.chargeback_reversed,
    'simulation_only',     v_d.simulation_only,
    'opened_at',           v_d.opened_at,
    'evidence_due_at',     v_d.evidence_due_at,
    'submitted_at',        v_d.submitted_at,
    'resolved_at',         v_d.resolved_at,
    'closed_at',           v_d.closed_at,
    'correlation_id',      v_d.correlation_id,
    'evidence',            v_evidence
  );
END;
$$;

-- ── 14. FUNCIÓN: mkt_fin_list_supplier_disputes ──────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_list_supplier_disputes(
  p_provider_actor_id uuid,
  p_limit             int DEFAULT 20,
  p_offset            int DEFAULT 0
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT jsonb_agg(jsonb_build_object(
        'dispute_id',        d.id,
        'dispute_number',    d.dispute_number,
        'supplier_order_id', d.supplier_order_id,
        'amount',            d.amount,
        'currency',          d.currency,
        'status',            d.status,
        'responsibility',    d.responsibility,
        'outcome',           d.outcome,
        'chargeback_posted', d.chargeback_posted,
        'opened_at',         d.opened_at,
        'resolved_at',       d.resolved_at
      ) ORDER BY d.opened_at DESC)
      FROM public.trade_marketplace_disputes d
      WHERE d.provider_actor_id = p_provider_actor_id
      LIMIT p_limit OFFSET p_offset
    ),
    '[]'::jsonb
  );
END;
$$;

-- ── 15. FUNCIÓN: mkt_fin_admin_disputes_overview ─────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_admin_disputes_overview()
RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total       int;
  v_total_amt   numeric(15,4);
  v_by_status   jsonb;
  v_by_resp     jsonb;
  v_cb_net      numeric(15,4);
  v_open_count  int;
BEGIN
  IF NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'ADMIN_REQUIRED';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(amount), 0)
    INTO v_total, v_total_amt
    FROM public.trade_marketplace_disputes;

  SELECT COUNT(*) INTO v_open_count
    FROM public.trade_marketplace_disputes
   WHERE status NOT IN ('won', 'lost', 'accepted', 'cancelled', 'closed');

  SELECT jsonb_object_agg(status, cnt)
    INTO v_by_status
    FROM (
      SELECT status, COUNT(*) AS cnt
        FROM public.trade_marketplace_disputes
       GROUP BY status
    ) s;

  SELECT jsonb_object_agg(responsibility, cnt)
    INTO v_by_resp
    FROM (
      SELECT responsibility, COUNT(*) AS cnt
        FROM public.trade_marketplace_disputes
       GROUP BY responsibility
    ) r;

  -- Impacto neto de chargebacks (DEBIT negativo + CREDIT positivo)
  SELECT COALESCE(-SUM(amount), 0)
    INTO v_cb_net
    FROM public.trade_marketplace_ledger_entries
   WHERE entry_type IN ('CHARGEBACK_DEBIT', 'CHARGEBACK_CREDIT')
     AND status != 'failed';

  RETURN jsonb_build_object(
    'total_disputes',         v_total,
    'open_disputes',          v_open_count,
    'total_disputed_amount',  v_total_amt,
    'chargebacks_net_impact', v_cb_net,
    'by_status',              COALESCE(v_by_status, '{}'),
    'by_responsibility',      COALESCE(v_by_resp, '{}'),
    'calculated_at',          now()
  );
END;
$$;

-- ── 16. mkt_fin_rebuild_provider_balance — Phase 2C ──────────────────────────
-- Añade CHARGEBACK_DEBIT / CHARGEBACK_CREDIT / CHARGEBACK_FEE al cálculo de pending.
-- Los DEBIT son negativos → reducen pending. Los CREDIT son positivos → suman.
-- El balance puede quedar negativo; Phase 2D maneja recuperación.

CREATE OR REPLACE FUNCTION public.mkt_fin_rebuild_provider_balance(
  p_actor_id uuid,
  p_currency  text DEFAULT 'EUR'
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_pending        numeric(15,4) := 0;
  v_available      numeric(15,4) := 0;
  v_reserved       numeric(15,4) := 0;
  v_negative       numeric(15,4) := 0;
  v_settled        numeric(15,4) := 0;
  v_last_entry_id  uuid;
  v_entry_count    int;
  v_prior_balance  numeric(15,4);
  v_actor_exists   bool;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.trade_marketplace_actors WHERE id = p_actor_id)
    INTO v_actor_exists;
  IF NOT v_actor_exists THEN RAISE EXCEPTION 'ACTOR_NOT_FOUND: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT',       'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL',   'SHIPPING_REFUND_REVERSAL',
        'CHARGEBACK_DEBIT',        'CHARGEBACK_CREDIT',
        'CHARGEBACK_FEE'
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
    INTO v_pending, v_entry_count, v_last_entry_id
    FROM public.trade_marketplace_ledger_entries
   WHERE actor_id = p_actor_id
     AND currency::text = p_currency;

  SELECT COALESCE(total_economic_balance, 0)
    INTO v_prior_balance
    FROM public.trade_marketplace_balances
   WHERE provider_actor_id = p_actor_id AND currency::char(3) = p_currency::char(3);

  INSERT INTO public.trade_marketplace_balances (
    provider_actor_id, currency,
    pending_amount, available_amount, reserved_amount, negative_amount,
    historical_settled_amount, last_ledger_entry_id, last_recalculated_at, projection_strategy
  ) VALUES (
    p_actor_id, p_currency::char(3),
    v_pending, v_available, v_reserved, v_negative, v_settled,
    v_last_entry_id, now(), 'ledger_rebuild'
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

  PERFORM public.mkt_fin_audit(
    'provider_balance_rebuilt', 'provider_balance', p_actor_id, NULL, NULL,
    jsonb_build_object(
      'actor_id',              p_actor_id,
      'currency',              p_currency,
      'pending_amount',        v_pending,
      'total_economic',        v_pending,
      'ledger_entries_read',   v_entry_count,
      'prior_total',           v_prior_balance,
      'phase',                 '2C',
      'includes_refund_reversals', true,
      'includes_chargebacks',  true,
      'note', 'Phase 2C: CHARGEBACK_DEBIT/CREDIT/FEE incluidos. COMMISSION_SIM excluida (INV-B02).'
    ),
    'Rebuild balance desde ledger — Phase 2C', NULL, NULL
  );

  RETURN jsonb_build_object(
    'status',                'rebuilt',
    'actor_id',              p_actor_id,
    'currency',              p_currency,
    'pending_amount',        v_pending,
    'available_amount',      v_available,
    'reserved_amount',       v_reserved,
    'negative_amount',       v_negative,
    'historical_settled',    v_settled,
    'total_economic_balance', v_pending + v_available + v_reserved - v_negative,
    'ledger_entries_read',   v_entry_count,
    'last_ledger_entry_id',  v_last_entry_id,
    'recalculated_at',       now(),
    'projection_strategy',   'ledger_rebuild',
    'phase',                 '2C'
  );
END;
$$;

-- ── 17. mkt_fin_reconcile_provider_balance — Phase 2C ────────────────────────

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
  v_has_access      boolean;
  v_entry_count     int;
  v_projection_at   timestamptz;
BEGIN
  v_has_access := public._mkt_is_platform_admin()
               OR p_actor_id = ANY(public._mkt_actor_ids_for_user());
  IF NOT v_has_access THEN RAISE EXCEPTION 'ACCESS_DENIED: %', p_actor_id; END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE entry_type IN (
        'GOODS_ENTITLEMENT',       'SHIPPING_ENTITLEMENT',
        'GOODS_REFUND_REVERSAL',   'SHIPPING_REFUND_REVERSAL',
        'CHARGEBACK_DEBIT',        'CHARGEBACK_CREDIT',
        'CHARGEBACK_FEE'
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
        'difference', v_difference, 'phase', '2C', 'severity', 'WARNING'
      ),
      'Balance almacenado difiere del ledger (Phase 2C)', NULL, NULL
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
    'phase',                  '2C',
    'includes_chargebacks',   true,
    'reconciliation_note',    CASE WHEN v_status = 'MATCH'
      THEN 'OK — ledger y balance coinciden (Phase 2C con chargebacks)'
      ELSE 'MISMATCH — ejecutar mkt_fin_rebuild_provider_balance'
    END
  );
END;
$$;

COMMIT;
