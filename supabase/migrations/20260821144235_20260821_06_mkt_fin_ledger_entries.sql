
BEGIN;

CREATE TABLE IF NOT EXISTS public.trade_marketplace_ledger_entries (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  master_order_id       uuid        REFERENCES public.trade_marketplace_master_orders(id) ON DELETE RESTRICT,
  supplier_order_id     uuid        REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT,
  actor_id              uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,
  settlement_id         uuid,
  refund_id             uuid,
  dispute_id            uuid,
  entry_type            text        NOT NULL CHECK (entry_type IN (
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
    'FUTURE_SETOFF'
  )),
  amount                numeric(12,2) NOT NULL,
  currency              char(3)       NOT NULL DEFAULT 'EUR',
  status                text          NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'reversed', 'failed')),
  description           text,
  correlation_id        text,
  source_event_id       text,
  compensates_entry_id  uuid    REFERENCES public.trade_marketplace_ledger_entries(id) ON DELETE RESTRICT,
  external_provider     text    NOT NULL DEFAULT 'simulation',
  external_id           text,
  external_type         text,
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_ledger_entries IS
  'Ledger económico inmutable del Marketplace. '
  'INV-009: NUNCA UPDATE ni DELETE. Las correcciones son nuevas entradas compensatorias. '
  'INV-001: GOODS_ENTITLEMENT y SHIPPING_ENTITLEMENT son GMV del proveedor, NO Revenue TrabFlow. '
  'Perspectiva: positivo = TrabFlow recibe/retiene; negativo = TrabFlow paga/debe.';

CREATE INDEX IF NOT EXISTS idx_ledger_master_order
  ON public.trade_marketplace_ledger_entries(master_order_id)
  WHERE master_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_supplier_order
  ON public.trade_marketplace_ledger_entries(supplier_order_id)
  WHERE supplier_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_actor
  ON public.trade_marketplace_ledger_entries(actor_id)
  WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_entry_type
  ON public.trade_marketplace_ledger_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_ledger_correlation
  ON public.trade_marketplace_ledger_entries(correlation_id)
  WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_source_event
  ON public.trade_marketplace_ledger_entries(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_created
  ON public.trade_marketplace_ledger_entries(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_status
  ON public.trade_marketplace_ledger_entries(status);

CREATE OR REPLACE FUNCTION public._mkt_fin_ledger_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'El ledger es inmutable (INV-009). '
      'No se pueden modificar entradas existentes. '
      'Cree un movimiento compensatorio en su lugar. '
      'Entry ID: %', OLD.id;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'El ledger es inmutable (INV-009). '
      'No se pueden eliminar entradas del ledger. '
      'Entry ID: %', OLD.id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_ledger_immutable_update
  BEFORE UPDATE ON public.trade_marketplace_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_ledger_immutable();

CREATE TRIGGER trg_ledger_immutable_delete
  BEFORE DELETE ON public.trade_marketplace_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_ledger_immutable();

CREATE OR REPLACE FUNCTION public.mkt_fin_ledger_append(
  p_entry_type          text,
  p_amount              numeric(12,2),
  p_master_order_id     uuid        DEFAULT NULL,
  p_supplier_order_id   uuid        DEFAULT NULL,
  p_actor_id            uuid        DEFAULT NULL,
  p_description         text        DEFAULT NULL,
  p_correlation_id      text        DEFAULT NULL,
  p_source_event_id     text        DEFAULT NULL,
  p_compensates_id      uuid        DEFAULT NULL,
  p_external_provider   text        DEFAULT 'simulation',
  p_external_id         text        DEFAULT NULL,
  p_external_type       text        DEFAULT NULL,
  p_currency            char(3)     DEFAULT 'EUR',
  p_status              text        DEFAULT 'confirmed',
  p_occurred_at         timestamptz DEFAULT NULL
)
RETURNS public.trade_marketplace_ledger_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry public.trade_marketplace_ledger_entries;
BEGIN
  IF p_source_event_id IS NOT NULL THEN
    SELECT * INTO v_entry
      FROM public.trade_marketplace_ledger_entries
     WHERE source_event_id = p_source_event_id
       AND entry_type = p_entry_type
       AND COALESCE(supplier_order_id::text, '') = COALESCE(p_supplier_order_id::text, '');
    IF FOUND THEN RETURN v_entry; END IF;
  END IF;

  INSERT INTO public.trade_marketplace_ledger_entries (
    entry_type, amount, currency, status,
    master_order_id, supplier_order_id, actor_id,
    description, correlation_id, source_event_id,
    compensates_entry_id,
    external_provider, external_id, external_type,
    occurred_at
  ) VALUES (
    p_entry_type, p_amount, p_currency, p_status,
    p_master_order_id, p_supplier_order_id, p_actor_id,
    p_description, p_correlation_id, p_source_event_id,
    p_compensates_id,
    p_external_provider, p_external_id, p_external_type,
    COALESCE(p_occurred_at, now())
  )
  RETURNING * INTO v_entry;

  RETURN v_entry;
END;
$$;

CREATE OR REPLACE FUNCTION public.mkt_fin_ledger_balance(
  p_master_order_id uuid DEFAULT NULL,
  p_actor_id        uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_amount',             COALESCE(SUM(amount), 0),
    'by_type',                  jsonb_object_agg(entry_type, type_sum) FILTER (WHERE entry_type IS NOT NULL),
    'entries_count',            COUNT(*),
    'confirmed_amount',         COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0),
    'pending_amount',           COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
    'gmv_goods_entitlement',    COALESCE(SUM(amount) FILTER (WHERE entry_type = 'GOODS_ENTITLEMENT'), 0),
    'gmv_shipping_entitlement', COALESCE(SUM(amount) FILTER (WHERE entry_type = 'SHIPPING_ENTITLEMENT'), 0),
    'commission_accrued',       COALESCE(SUM(amount) FILTER (WHERE entry_type = 'COMMISSION_ACCRUAL'), 0),
    'sim_commission',           COALESCE(SUM(amount) FILTER (WHERE entry_type = 'COMMISSION_SIM_ACCRUAL'), 0)
  )
  INTO v_result
  FROM (
    SELECT
      entry_type, amount, status,
      SUM(amount) OVER (PARTITION BY entry_type) AS type_sum
    FROM public.trade_marketplace_ledger_entries
    WHERE
      (p_master_order_id IS NULL OR master_order_id = p_master_order_id)
      AND (p_actor_id IS NULL OR actor_id = p_actor_id)
      AND status != 'failed'
  ) t;

  RETURN v_result;
END;
$$;

ALTER TABLE public.trade_marketplace_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ledger_select_own_actor"
  ON public.trade_marketplace_ledger_entries
  FOR SELECT
  TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    OR public._mkt_is_platform_admin()
  );

GRANT SELECT ON public.trade_marketplace_ledger_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_ledger_append TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_ledger_balance TO authenticated;

COMMIT;
;
