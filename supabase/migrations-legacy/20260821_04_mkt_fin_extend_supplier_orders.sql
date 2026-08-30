-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 04
-- Extensión de trade_marketplace_orders (supplier orders) con campos financieros
-- ════════════════════════════════════════════════════════════════════════════
-- BACKWARD COMPATIBLE: todas las columnas nuevas son NULL o tienen DEFAULT.
-- Las columnas existentes (subtotal, coste_envio, total) NO se modifican.
-- INV-007: los campos _snapshot son inmutables tras ser escritos.
-- INV-012: payment_status separado del estado logístico existente (estado).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Vínculo con Master Order ──────────────────────────────────────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS master_order_id uuid
    REFERENCES public.trade_marketplace_master_orders(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.trade_marketplace_orders.master_order_id IS
  'FK al master order que agrupa este supplier order. '
  'NULL para pedidos pre-MP-FIN-1B (sin migración retroactiva). '
  'Se usará checkout_key para identificar el grupo en ese caso.';

CREATE INDEX IF NOT EXISTS idx_supplier_order_master
  ON public.trade_marketplace_orders(master_order_id)
  WHERE master_order_id IS NOT NULL;

-- ── 2. Estado financiero (INV-012: separado del estado logístico) ─────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS payment_status text
    DEFAULT 'unpaid'
    CHECK (payment_status IN (
      'unpaid',
      'pending',
      'failed',
      'paid',
      'partially_refunded',
      'refunded',
      'disputed',
      'chargeback_platform_won',
      'chargeback_platform_lost'
    ));

COMMENT ON COLUMN public.trade_marketplace_orders.payment_status IS
  'Estado del ciclo financiero, independiente del estado logístico (INV-012). '
  'El campo estado existente gestiona el ciclo logístico (pending→delivered→completed).';

-- ── 3. Moneda (INV-015) ───────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS currency char(3) DEFAULT 'EUR';

-- ── 4. Snapshots económicos inmutables (INV-007, INV-016) ────────────────
-- Escrito al completar el checkout. NUNCA modificar tras ser rellenado.
-- Las columnas existentes (subtotal, coste_envio, total) permanecen intactas
-- y se siguen usando para la lógica existente. Los nuevos _snapshot son
-- el registro canónico net/tax/gross.

-- Mercancía (net/tax/gross)
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS goods_net_snapshot       numeric(12,2),
  ADD COLUMN IF NOT EXISTS goods_tax_snapshot       numeric(12,2),
  ADD COLUMN IF NOT EXISTS goods_gross_snapshot     numeric(12,2);

-- Portes (net/tax/gross)
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS shipping_net_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_tax_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS shipping_gross_snapshot  numeric(12,2);

-- IVA asumido para simulación ([TAX_GATE] tipo real pendiente de dictamen)
ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS tax_rate_snapshot        numeric(5,2);

COMMENT ON COLUMN public.trade_marketplace_orders.goods_gross_snapshot IS
  'Equivale semánticamente a subtotal existente. '
  'Nombre canónico para la arquitectura financiera nueva. '
  'INV-007: inmutable tras checkout.';

COMMENT ON COLUMN public.trade_marketplace_orders.shipping_gross_snapshot IS
  'Equivale semánticamente a coste_envio existente. '
  'INV-007: inmutable tras checkout.';

COMMENT ON COLUMN public.trade_marketplace_orders.tax_rate_snapshot IS
  '[TAX_GATE] Tipo de IVA aplicado. 21% por defecto en simulación. '
  'El tipo definitivo por categoría de producto requiere dictamen fiscal.';

-- ── 5. Commission snapshot (INV-007) ─────────────────────────────────────
-- Escrito al completar el checkout. Refleja la política activa en ese momento.
-- commission_net_snapshot = 0 durante Fase 0 (INV-005).

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS commission_policy_id_snapshot    uuid
    REFERENCES public.trade_marketplace_commission_policies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_rate_snapshot         numeric(6,4) DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS commission_type_snapshot         text         DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS commission_base_snapshot         text         DEFAULT 'goods_net',
  ADD COLUMN IF NOT EXISTS commissionable_base_net_snapshot numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_net_snapshot          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_tax_snapshot          numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_gross_snapshot        numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commissionable_shipping_snapshot boolean       DEFAULT false,
  -- Comisión de simulación (INV-005: diferente de la real)
  ADD COLUMN IF NOT EXISTS sim_commission_net               numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_tax               numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_gross             numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sim_commission_rate              numeric(6,4)  DEFAULT 0.0000;

COMMENT ON COLUMN public.trade_marketplace_orders.commission_net_snapshot IS
  'Comisión real calculada. 0 en Fase 0 (INV-005). '
  'INV-007: inmutable tras checkout.';

COMMENT ON COLUMN public.trade_marketplace_orders.sim_commission_net IS
  'Comisión SIMULADA (no es Revenue TrabFlow — INV-001). '
  'Solo para reporting de potencial. No genera obligación económica real.';

-- ── 6. Payable del proveedor snapshot ─────────────────────────────────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS provider_payable_snapshot    numeric(12,2),
  ADD COLUMN IF NOT EXISTS financial_snapshot_at        timestamptz;

COMMENT ON COLUMN public.trade_marketplace_orders.provider_payable_snapshot IS
  'Importe a transferir al proveedor calculado en el momento del checkout. '
  'INV-007: inmutable. Las correcciones posteriores usan el ledger.';

COMMENT ON COLUMN public.trade_marketplace_orders.financial_snapshot_at IS
  'Timestamp en que se completó el snapshot financiero. '
  'NULL = pedido pre-MP-FIN-1A (sin snapshot).';

-- ── 7. Refunds acumulados ─────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS refunded_amount numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS return_amount   numeric(12,2) DEFAULT 0;

-- ── 8. PSP (STRIPE_GATE) ──────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_orders
  ADD COLUMN IF NOT EXISTS external_provider    text DEFAULT 'simulation',
  ADD COLUMN IF NOT EXISTS external_payment_id  text,
  ADD COLUMN IF NOT EXISTS external_transfer_id text;

COMMENT ON COLUMN public.trade_marketplace_orders.external_payment_id IS
  '[STRIPE_GATE] Stripe PaymentIntent ID del master_order. NULL hasta integración.';

COMMENT ON COLUMN public.trade_marketplace_orders.external_transfer_id IS
  '[STRIPE_GATE] Stripe Transfer ID para este supplier order. NULL hasta integración.';

-- ── 9. Protección inmutabilidad snapshot (INV-007) ────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_protect_order_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo bloquear si el snapshot ya fue escrito (financial_snapshot_at IS NOT NULL)
  IF OLD.financial_snapshot_at IS NOT NULL THEN
    -- Campos de mercancía
    IF NEW.goods_net_snapshot IS DISTINCT FROM OLD.goods_net_snapshot
    OR NEW.goods_tax_snapshot IS DISTINCT FROM OLD.goods_tax_snapshot
    OR NEW.goods_gross_snapshot IS DISTINCT FROM OLD.goods_gross_snapshot
    OR NEW.shipping_net_snapshot IS DISTINCT FROM OLD.shipping_net_snapshot
    OR NEW.shipping_gross_snapshot IS DISTINCT FROM OLD.shipping_gross_snapshot
    -- Campos de comisión
    OR NEW.commission_rate_snapshot IS DISTINCT FROM OLD.commission_rate_snapshot
    OR NEW.commissionable_base_net_snapshot IS DISTINCT FROM OLD.commissionable_base_net_snapshot
    OR NEW.commission_net_snapshot IS DISTINCT FROM OLD.commission_net_snapshot
    OR NEW.commission_tax_snapshot IS DISTINCT FROM OLD.commission_tax_snapshot
    OR NEW.provider_payable_snapshot IS DISTINCT FROM OLD.provider_payable_snapshot
    THEN
      RAISE EXCEPTION
        'Los snapshots financieros son inmutables (INV-007). '
        'Use movimientos compensatorios en el ledger. '
        'Supplier Order ID: %', OLD.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_protect_snapshots
  BEFORE UPDATE ON public.trade_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_protect_order_snapshots();

-- ── 10. Función: escribir snapshot financiero al confirmar checkout ────────

CREATE OR REPLACE FUNCTION public.mkt_fin_write_order_financial_snapshot(
  p_order_id            uuid,
  p_goods_net           numeric(12,2),
  p_goods_tax           numeric(12,2),
  p_goods_gross         numeric(12,2),
  p_shipping_net        numeric(12,2),
  p_shipping_tax        numeric(12,2),
  p_shipping_gross      numeric(12,2),
  p_tax_rate            numeric(5,2)  DEFAULT 21.00,
  p_master_order_id     uuid          DEFAULT NULL,
  p_commission_policy_id uuid         DEFAULT NULL
)
RETURNS public.trade_marketplace_orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order     public.trade_marketplace_orders;
  v_comm      jsonb;
  v_payable   numeric(12,2);
  v_sim_rate  numeric(6,4);
  v_sim_net   numeric(12,2);
  v_sim_tax   numeric(12,2);
  v_sim_gross numeric(12,2);
BEGIN
  -- Verificar que el pedido existe y aún no tiene snapshot
  SELECT * INTO v_order
    FROM public.trade_marketplace_orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier order % no encontrado', p_order_id;
  END IF;

  IF v_order.financial_snapshot_at IS NOT NULL THEN
    -- Ya tiene snapshot: devolver sin modificar (idempotente)
    RETURN v_order;
  END IF;

  -- Calcular comisión real y simulada (INV-005)
  v_comm := public.mkt_fin_calculate_commission(p_goods_net, v_order.actor_id, false);
  -- Payable = gross_entitlement - commission_gross (Opción A: [TAX_GATE])
  -- En Fase 0: commission_gross = 0, payable = goods_gross + shipping_gross
  v_payable := p_goods_gross + p_shipping_gross
               - (v_comm->>'commission_gross')::numeric;

  -- Leer simulation_rate una sola vez (INV-005: separado de la comisión real)
  SELECT (config_value)::numeric INTO v_sim_rate
    FROM public.trade_marketplace_financial_config
   WHERE config_key = 'commission.simulation_rate';
  v_sim_rate  := COALESCE(v_sim_rate, 0.0000);
  v_sim_net   := ROUND(p_goods_net * v_sim_rate, 2);
  -- [TAX_GATE] IVA comisión simulada: 21% hipótesis. No es Revenue real.
  v_sim_tax   := ROUND(v_sim_net * 0.21, 2);
  v_sim_gross := v_sim_net + v_sim_tax;

  UPDATE public.trade_marketplace_orders SET
    master_order_id = COALESCE(p_master_order_id, master_order_id),
    -- Snapshots de mercancía y portes
    goods_net_snapshot      = p_goods_net,
    goods_tax_snapshot      = p_goods_tax,
    goods_gross_snapshot    = p_goods_gross,
    shipping_net_snapshot   = p_shipping_net,
    shipping_tax_snapshot   = p_shipping_tax,
    shipping_gross_snapshot = p_shipping_gross,
    tax_rate_snapshot       = p_tax_rate,
    -- Commission real (0 en Fase 0)
    commission_policy_id_snapshot    = COALESCE(p_commission_policy_id, (v_comm->>'policy_id')::uuid),
    commission_rate_snapshot         = (v_comm->>'commission_rate')::numeric,
    commission_type_snapshot         = 'percentage',
    commission_base_snapshot         = (v_comm->>'commission_base'),
    commissionable_base_net_snapshot = p_goods_net,
    commission_net_snapshot          = (v_comm->>'commission_net')::numeric,
    commission_tax_snapshot          = (v_comm->>'commission_tax')::numeric,
    commission_gross_snapshot        = (v_comm->>'commission_gross')::numeric,
    commissionable_shipping_snapshot = false,
    provider_payable_snapshot        = v_payable,
    -- Commission simulada (INV-005: no genera Revenue real)
    sim_commission_rate  = v_sim_rate,
    sim_commission_net   = v_sim_net,
    sim_commission_tax   = v_sim_tax,
    sim_commission_gross = v_sim_gross,
    financial_snapshot_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  RETURN v_order;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_write_order_financial_snapshot IS
  'Escribe el snapshot financiero inmutable en un supplier order al confirmar checkout. '
  'Idempotente: si ya existe snapshot, devuelve sin modificar. '
  'INV-007: tras esta llamada, los campos _snapshot quedan protegidos. '
  'INV-005: comisión real=0 en Fase 0; sim_commission calculada para reporting.';

-- ── 11. Grants ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.mkt_fin_write_order_financial_snapshot TO authenticated;

COMMIT;
