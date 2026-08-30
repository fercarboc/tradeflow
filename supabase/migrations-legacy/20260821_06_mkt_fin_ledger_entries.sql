-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 06
-- trade_marketplace_ledger_entries — Ledger inmutable append-only
-- ════════════════════════════════════════════════════════════════════════════
-- INV-009: NUNCA UPDATE ni DELETE. Las correcciones son movimientos compensatorios.
-- INV-015: currency siempre explícita.
-- INV-016: importe siempre acompañado de currency.
-- INV-017: idempotencia por source_event_id + entry_type.
-- En MP-FIN-1A: solo se crea la infraestructura. Los movimientos de simulación
--   se implementan en MP-FIN-2. Aquí solo insertamos tipos básicos para testing.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tabla del ledger ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_ledger_entries (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Trazabilidad (INV-009)
  master_order_id       uuid        REFERENCES public.trade_marketplace_master_orders(id) ON DELETE RESTRICT,
  supplier_order_id     uuid        REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT,
  actor_id              uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,
  -- FKs futuras (tablas creadas en MP-FIN-2 — NULL en MP-FIN-1A)
  settlement_id         uuid,   -- FK → trade_marketplace_settlements (MP-FIN-2)
  refund_id             uuid,   -- FK → trade_marketplace_refunds (MP-FIN-2)
  dispute_id            uuid,   -- FK → trade_marketplace_disputes (MP-FIN-2)

  -- Tipo de movimiento (catálogo extensible — INV-009)
  entry_type            text        NOT NULL CHECK (entry_type IN (
    -- Pago del comprador
    'BUYER_PAYMENT',
    -- Derechos de mercancía y portes (por supplier_order)
    'GOODS_ENTITLEMENT',
    'SHIPPING_ENTITLEMENT',
    -- Comisión (accrual en el momento del pedido)
    'COMMISSION_ACCRUAL',
    'COMMISSION_TAX_ACCRUAL',
    -- Simulación de comisión (INV-005: no es Revenue real)
    'COMMISSION_SIM_ACCRUAL',
    'COMMISSION_SIM_TAX_ACCRUAL',
    -- Transfers a proveedor
    'TRANSFER_INITIATED',
    'TRANSFER_COMPLETED',
    'TRANSFER_REVERSAL',
    -- Refunds
    'REFUND_TO_BUYER',
    'GOODS_REFUND_REVERSAL',
    'SHIPPING_REFUND_REVERSAL',
    'COMMISSION_REVERSAL',
    'COMMISSION_TAX_REVERSAL',
    -- Chargebacks / disputes
    'CHARGEBACK_DEBIT',
    'CHARGEBACK_FEE',
    'CHARGEBACK_CREDIT',
    -- PSP fees
    'PSP_FEE_DEBIT',
    -- Reservas / holds
    'RESERVE_HOLD',
    'RESERVE_RELEASE',
    -- Settlements y ajustes
    'SETTLEMENT_ADJUSTMENT',
    'PROVIDER_ADJUSTMENT',
    'PLATFORM_ADJUSTMENT',
    -- Saldos negativos y recuperación
    'NEGATIVE_BALANCE_RECORD',
    'BALANCE_RECOVERY',
    'FUTURE_SETOFF'
  )),

  -- Importe y dirección
  -- Perspectiva TrabFlow: (+) = TrabFlow recibe/retiene, (−) = TrabFlow paga/debe
  -- Perspectiva proveedor: se infiere según entry_type
  amount                numeric(12,2) NOT NULL,
  currency              char(3)       NOT NULL DEFAULT 'EUR', -- INV-015

  -- Estado del movimiento
  status                text          NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'reversed', 'failed')),

  -- Descripción y trazabilidad
  description           text,
  correlation_id        text,   -- agrupa movimientos relacionados del mismo evento

  -- Idempotencia (INV-017): (source_event_id, entry_type) debe ser UNIQUE
  -- para eventos que no deben duplicarse
  source_event_id       text,   -- ID del evento que originó este movimiento

  -- Referencia al movimiento que este compensa (INV-009)
  compensates_entry_id  uuid    REFERENCES public.trade_marketplace_ledger_entries(id) ON DELETE RESTRICT,

  -- PSP / Reconciliación futura (STRIPE_GATE — null hasta integración)
  external_provider     text    NOT NULL DEFAULT 'simulation',
  external_id           text,   -- Stripe charge/transfer/refund ID futuro
  external_type         text,   -- 'payment_intent' | 'transfer' | 'refund' | 'dispute'

  -- Timestamp (INV-009: sin updated_at — inmutable)
  occurred_at           timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()

  -- SIN updated_at: este registro es inmutable
);

COMMENT ON TABLE public.trade_marketplace_ledger_entries IS
  'Ledger económico inmutable del Marketplace. '
  'INV-009: NUNCA UPDATE ni DELETE. Las correcciones son nuevas entradas compensatorias. '
  'INV-001: los tipos GOODS_ENTITLEMENT y SHIPPING_ENTITLEMENT representan GMV del proveedor, '
  'NO Revenue de TrabFlow. '
  'Perspectiva de importe: positivo = TrabFlow recibe/retiene; negativo = TrabFlow paga/debe.';

COMMENT ON COLUMN public.trade_marketplace_ledger_entries.correlation_id IS
  'Agrupa entradas del mismo evento económico. '
  'Por ejemplo, un checkout genera: BUYER_PAYMENT + N×GOODS_ENTITLEMENT + N×SHIPPING_ENTITLEMENT '
  'todas con el mismo correlation_id.';

COMMENT ON COLUMN public.trade_marketplace_ledger_entries.source_event_id IS
  'ID del evento externo que originó esta entrada. '
  'Para webhooks Stripe (STRIPE_GATE): stripe_event_id. '
  'Para simulaciones: sim_event_id generado. '
  'Usado para idempotencia junto con entry_type.';

-- ── 2. Índices ─────────────────────────────────────────────────────────────

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

-- ── 3. Inmutabilidad forzada por RLS + trigger ────────────────────────────

-- Trigger que impide UPDATE y DELETE
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

-- ── 4. Función: insertar entrada en ledger (append-only) ─────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_ledger_append(
  p_entry_type          text,
  p_amount              numeric(12,2),
  p_master_order_id     uuid     DEFAULT NULL,
  p_supplier_order_id   uuid     DEFAULT NULL,
  p_actor_id            uuid     DEFAULT NULL,
  p_description         text     DEFAULT NULL,
  p_correlation_id      text     DEFAULT NULL,
  p_source_event_id     text     DEFAULT NULL,
  p_compensates_id      uuid     DEFAULT NULL,
  p_external_provider   text     DEFAULT 'simulation',
  p_external_id         text     DEFAULT NULL,
  p_external_type       text     DEFAULT NULL,
  p_currency            char(3)  DEFAULT 'EUR',
  p_status              text     DEFAULT 'confirmed',
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
  -- Idempotencia: si ya existe (source_event_id, entry_type), devolver el existente
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

COMMENT ON FUNCTION public.mkt_fin_ledger_append IS
  'Inserta una entrada en el ledger. Idempotente por (source_event_id, entry_type, supplier_order_id). '
  'INV-009: esta es la ÚNICA forma de escribir en el ledger. '
  'Las correcciones se hacen llamando de nuevo con el entry_type compensatorio '
  'y p_compensates_id apuntando a la entrada original.';

-- ── 5. Función: verificar balance del ledger (para tests de invariantes) ───

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
    'total_amount',           COALESCE(SUM(amount), 0),
    'by_type',                jsonb_object_agg(entry_type, type_sum) FILTER (WHERE entry_type IS NOT NULL),
    'entries_count',          COUNT(*),
    'confirmed_amount',       COALESCE(SUM(amount) FILTER (WHERE status = 'confirmed'), 0),
    'pending_amount',         COALESCE(SUM(amount) FILTER (WHERE status = 'pending'), 0),
    'gmv_goods_entitlement',  COALESCE(SUM(amount) FILTER (WHERE entry_type = 'GOODS_ENTITLEMENT'), 0),
    'gmv_shipping_entitlement', COALESCE(SUM(amount) FILTER (WHERE entry_type = 'SHIPPING_ENTITLEMENT'), 0),
    'commission_accrued',     COALESCE(SUM(amount) FILTER (WHERE entry_type = 'COMMISSION_ACCRUAL'), 0),
    'sim_commission',         COALESCE(SUM(amount) FILTER (WHERE entry_type = 'COMMISSION_SIM_ACCRUAL'), 0)
  )
  INTO v_result
  FROM (
    SELECT
      entry_type,
      amount,
      status,
      SUM(amount) OVER (PARTITION BY entry_type) AS type_sum
    FROM public.trade_marketplace_ledger_entries
    WHERE
      (p_master_order_id IS NULL OR master_order_id = p_master_order_id)
      AND
      (p_actor_id IS NULL OR actor_id = p_actor_id)
      AND status != 'failed'
  ) t;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_ledger_balance IS
  'Calcula el balance del ledger para un master_order o actor. '
  'Útil para tests de invariantes financieras. '
  'INV-001: gmv_goods_entitlement NO es Revenue TrabFlow.';

-- ── 6. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_ledger_entries ENABLE ROW LEVEL SECURITY;

-- Proveedor: solo puede ver entradas relacionadas con sus propios supplier_orders
-- Aislamiento por proveedor (INV: "No contaminación entre proveedores")
CREATE POLICY "ledger_select_own_actor"
  ON public.trade_marketplace_ledger_entries
  FOR SELECT
  TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    OR
    public._mkt_is_platform_admin()
  );

-- Inserción: solo SECURITY DEFINER functions (mkt_fin_ledger_append)
-- No se define política INSERT para roles normales — la función SECURITY DEFINER
-- puede insertar directamente. Los usuarios autenticados no pueden INSERT directamente.

-- UPDATE y DELETE: bloqueados por triggers (además de RLS)
-- No se definen políticas UPDATE/DELETE — el trigger las rechazará antes.

-- Platform admin: acceso total ya cubierto en la política SELECT anterior.

-- ── 7. Grants ─────────────────────────────────────────────────────────────

GRANT SELECT ON public.trade_marketplace_ledger_entries TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_ledger_append TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_ledger_balance TO authenticated;

COMMIT;
