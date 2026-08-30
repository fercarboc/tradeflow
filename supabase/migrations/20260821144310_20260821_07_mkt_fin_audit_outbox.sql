
BEGIN;

CREATE OR REPLACE FUNCTION public.mkt_fin_audit(
  p_event_type      text,
  p_entity_type     text,
  p_entity_id       uuid,
  p_actor_id        uuid     DEFAULT NULL,
  p_before          jsonb    DEFAULT NULL,
  p_after           jsonb    DEFAULT NULL,
  p_reason          text     DEFAULT NULL,
  p_correlation_id  text     DEFAULT NULL,
  p_metadata        jsonb    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_marketplace_audit_log (
    actor_id, user_id, event_type, event_data
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

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_config_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    PERFORM public.mkt_fin_audit(
      'financial_config_changed', 'financial_config', NEW.id, NULL,
      jsonb_build_object('config_key', OLD.config_key, 'value', OLD.config_value),
      jsonb_build_object('config_key', NEW.config_key, 'value', NEW.config_value),
      'Config actualizada por admin', NULL,
      jsonb_build_object('updated_by', NEW.updated_by)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_config
  AFTER UPDATE ON public.trade_marketplace_financial_config
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_config_change();

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_commission_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.mkt_fin_audit(
      'commission_policy_changed', 'commission_policy', NEW.id,
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
      'Política de comisión modificada', NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_commission
  AFTER INSERT OR UPDATE ON public.trade_marketplace_commission_policies
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_commission_change();

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_master_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.mkt_fin_audit(
      'master_order_created', 'master_order', NEW.id, NULL, NULL,
      jsonb_build_object(
        'numero', NEW.numero,
        'checkout_key', NEW.checkout_key,
        'checkout_gross_total', NEW.goods_gross_total + NEW.shipping_gross_total,
        'currency', NEW.currency,
        'order_status', NEW.order_status,
        'payment_status', NEW.payment_status
      ),
      'Master order creado', NEW.checkout_key, NULL
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.order_status IS DISTINCT FROM NEW.order_status
    OR OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
      PERFORM public.mkt_fin_audit(
        'master_order_status_changed', 'master_order', NEW.id, NULL,
        jsonb_build_object('order_status', OLD.order_status, 'payment_status', OLD.payment_status),
        jsonb_build_object('order_status', NEW.order_status, 'payment_status', NEW.payment_status),
        NULL, NEW.checkout_key, NULL
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_master_order
  AFTER INSERT OR UPDATE ON public.trade_marketplace_master_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_master_order();

CREATE OR REPLACE FUNCTION public._mkt_fin_audit_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.financial_snapshot_at IS NULL AND NEW.financial_snapshot_at IS NOT NULL THEN
    PERFORM public.mkt_fin_audit(
      'financial_snapshot_created', 'supplier_order', NEW.id,
      NEW.actor_id, NULL,
      jsonb_build_object(
        'goods_gross_snapshot',    NEW.goods_gross_snapshot,
        'shipping_gross_snapshot', NEW.shipping_gross_snapshot,
        'commission_rate_snapshot',NEW.commission_rate_snapshot,
        'commission_net_snapshot', NEW.commission_net_snapshot,
        'provider_payable_snapshot',NEW.provider_payable_snapshot,
        'currency', NEW.currency
      ),
      'Snapshot financiero escrito al confirmar checkout', NULL, NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_audit_snapshot
  AFTER UPDATE ON public.trade_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_audit_snapshot();

CREATE OR REPLACE FUNCTION public.mkt_fin_outbox_publish(
  p_event_type  text,
  p_payload     jsonb,
  p_actor_id    uuid  DEFAULT NULL,
  p_org_id      uuid  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_marketplace_outbox (
    actor_id, org_id, event_type, payload
  ) VALUES (
    p_actor_id, p_org_id, p_event_type, p_payload
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mkt_fin_audit TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_outbox_publish TO authenticated;

COMMIT;
;
