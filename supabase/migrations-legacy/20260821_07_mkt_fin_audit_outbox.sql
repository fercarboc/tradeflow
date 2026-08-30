-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 07
-- Extensión del audit log y outbox para eventos financieros
-- ════════════════════════════════════════════════════════════════════════════
-- Reutiliza trade_marketplace_audit_log (sin crear tabla nueva).
-- Reutiliza trade_marketplace_outbox (sin crear cola nueva).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Función de auditoría financiera (reutiliza audit_log existente) ────

CREATE OR REPLACE FUNCTION public.mkt_fin_audit(
  p_event_type          text,
  p_entity_type         text,
  p_entity_id           uuid,
  p_actor_id            uuid     DEFAULT NULL,
  p_before              jsonb    DEFAULT NULL,
  p_after               jsonb    DEFAULT NULL,
  p_reason              text     DEFAULT NULL,
  p_correlation_id      text     DEFAULT NULL,
  p_metadata            jsonb    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_marketplace_audit_log (
    actor_id,
    user_id,
    event_type,
    event_data
  ) VALUES (
    p_actor_id,
    auth.uid(),
    p_event_type,
    jsonb_build_object(
      'entity_type',    p_entity_type,
      'entity_id',      p_entity_id,
      'before',         p_before,
      'after',          p_after,
      'reason',         p_reason,
      'correlation_id', p_correlation_id,
      'source',         'mkt_fin',
      'metadata',       p_metadata,
      'timestamp',      now()
    )
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_audit IS
  'Registra un evento financiero en trade_marketplace_audit_log. '
  'Reutiliza la tabla de auditoría existente para no crear un subsistema paralelo. '
  'event_type: financial_config_changed | commission_policy_changed | '
  'master_order_created | ledger_entry_created | financial_snapshot_created | '
  'settlement_changed | refund_initiated | dispute_opened | reserve_created.';

-- ── 2. Tipos de evento financiero documentados (comentario referencia) ────
-- No se crea enum para no romper migraciones futuras que añadan tipos.
-- Los event_type financieros son:
--
-- financial_config_changed      — cambio en trade_marketplace_financial_config
-- commission_policy_changed     — cambio en commission_policies (rate, enabled, etc.)
-- master_order_created          — creación de master order
-- master_order_status_changed   — cambio de order_status o payment_status
-- financial_snapshot_created    — snapshot financiero escrito en supplier_order
-- ledger_entry_created          — nueva entrada en el ledger
-- settlement_changed            — cambio en un settlement (futuro MP-FIN-2)
-- refund_initiated              — inicio de devolución (futuro MP-FIN-2)
-- dispute_opened                — apertura de disputa (futuro MP-FIN-2)
-- reserve_created               — creación de reserva (futuro MP-FIN-2)
-- reserve_released              — liberación de reserva (futuro MP-FIN-2)
-- commission_simulation_run     — ejecución de simulación de comisión

-- ── 3. Trigger: auditar cambios en financial_config ───────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.mkt_fin_audit(
      'financial_config_changed',
      'financial_config',
      NEW.id,
      NULL,
      jsonb_build_object('config_key', OLD.config_key, 'value', OLD.config_value),
      jsonb_build_object('config_key', NEW.config_key, 'value', NEW.config_value),
      'Config actualizada por admin',
      NULL,
      jsonb_build_object('updated_by', NEW.updated_by)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_config
  AFTER UPDATE ON public.trade_marketplace_financial_config
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_config_change();

-- ── 4. Trigger: auditar cambios en commission_policies ────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_commission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.mkt_fin_audit(
      'commission_policy_changed',
      'commission_policy',
      NEW.id,
      NEW.provider_actor_id,
      CASE WHEN TG_OP = 'UPDATE' THEN
        jsonb_build_object(
          'commission_enabled', OLD.commission_enabled,
          'commission_rate', OLD.commission_rate,
          'simulation_only', OLD.simulation_only
        )
      ELSE NULL END,
      jsonb_build_object(
        'commission_enabled', NEW.commission_enabled,
        'commission_rate', NEW.commission_rate,
        'simulation_only', NEW.simulation_only,
        'nombre', NEW.nombre
      ),
      'Política de comisión modificada',
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_commission
  AFTER INSERT OR UPDATE ON public.trade_marketplace_commission_policies
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_commission_change();

-- ── 5. Trigger: auditar creación de master_order ──────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_master_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_fin_audit(
      'master_order_created',
      'master_order',
      NEW.id,
      NULL,
      NULL,
      jsonb_build_object(
        'numero', NEW.numero,
        'checkout_key', NEW.checkout_key,
        'checkout_gross_total', NEW.goods_gross_total + NEW.shipping_gross_total,
        'currency', NEW.currency,
        'order_status', NEW.order_status,
        'payment_status', NEW.payment_status
      ),
      'Master order creado',
      NEW.checkout_key,
      NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.order_status IS DISTINCT FROM NEW.order_status
    OR OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      PERFORM public.mkt_fin_audit(
        'master_order_status_changed',
        'master_order',
        NEW.id,
        NULL,
        jsonb_build_object(
          'order_status', OLD.order_status,
          'payment_status', OLD.payment_status
        ),
        jsonb_build_object(
          'order_status', NEW.order_status,
          'payment_status', NEW.payment_status
        ),
        NULL,
        NEW.checkout_key,
        NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_master_order
  AFTER INSERT OR UPDATE ON public.trade_marketplace_master_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_master_order();

-- ── 6. Trigger: auditar escritura de snapshot en supplier_order ───────────

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Solo auditar cuando se escribe el snapshot por primera vez
  IF OLD.financial_snapshot_at IS NULL AND NEW.financial_snapshot_at IS NOT NULL THEN
    PERFORM public.mkt_fin_audit(
      'financial_snapshot_created',
      'supplier_order',
      NEW.id,
      NEW.actor_id,
      NULL,
      jsonb_build_object(
        'goods_gross_snapshot', NEW.goods_gross_snapshot,
        'shipping_gross_snapshot', NEW.shipping_gross_snapshot,
        'commission_rate_snapshot', NEW.commission_rate_snapshot,
        'commission_net_snapshot', NEW.commission_net_snapshot,
        'provider_payable_snapshot', NEW.provider_payable_snapshot,
        'currency', NEW.currency
      ),
      'Snapshot financiero escrito al confirmar checkout',
      NULL,
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_snapshot
  AFTER UPDATE ON public.trade_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_snapshot();

-- ── 7. Extensión del outbox para eventos financieros ──────────────────────

-- Reutiliza trade_marketplace_outbox existente.
-- Los event_type financieros que se añaden al catálogo son:
--
--   marketplace.master_order.created
--   marketplace.supplier_order.snapshot_written
--   marketplace.ledger.entry_created
--   marketplace.financial_config.changed
--
-- El consumer (Edge Function marketplace-outbox-consumer) deberá ampliarse
-- en MP-FIN-2 para procesar estos tipos.

CREATE OR REPLACE FUNCTION public.mkt_fin_outbox_publish(
  p_event_type    text,
  p_payload       jsonb,
  p_actor_id      uuid     DEFAULT NULL,
  p_org_id        uuid     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_marketplace_outbox (
    actor_id,
    org_id,
    event_type,
    payload
  ) VALUES (
    p_actor_id,
    p_org_id,
    p_event_type,
    p_payload
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_outbox_publish IS
  'Publica un evento financiero en el outbox. '
  'Reutiliza trade_marketplace_outbox sin crear una cola paralela. '
  'El consumer (MP-FIN-2) procesará los event_type financieros.';

-- ── 8. Grants ─────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.mkt_fin_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_outbox_publish TO authenticated;

COMMIT;
