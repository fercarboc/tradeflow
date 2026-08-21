-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 01
-- trade_marketplace_financial_config — Feature flags y configuración financiera
-- ════════════════════════════════════════════════════════════════════════════
-- INVARIANTES: commission_enabled=false, real_payments_enabled=false
-- LEGAL_GATE / TAX_GATE / STRIPE_GATE: no activar sin dictamen externo
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tabla de configuración financiera ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_financial_config (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key   text        NOT NULL UNIQUE,
  config_value jsonb       NOT NULL DEFAULT 'null',
  description  text,
  category     text        NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'payment', 'commission', 'settlement', 'payout',
      'reserve', 'refund', 'dispute', 'feature_flag', 'reporting', 'general'
    )),
  -- Solo platform_admin puede escribir; los cambios se auditan.
  updated_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_financial_config IS
  'Configuración financiera y feature flags del Marketplace. '
  'Todos los cambios deben auditarse. '
  'real_payments_enabled y stripe_connect_enabled solo pueden activarse '
  'tras resolver LEGAL_GATE + TAX_GATE + STRIPE_GATE.';

-- ── 2. Trigger updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mkt_fin_config_updated_at
  BEFORE UPDATE ON public.trade_marketplace_financial_config
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_config_updated_at();

-- ── 3. Valores iniciales ──────────────────────────────────────────────────

INSERT INTO public.trade_marketplace_financial_config
  (config_key, config_value, description, category)
VALUES
  -- Modo de pago
  ('payment.mode',
   '"simulation"',
   'Modo operativo: simulation | stripe_sandbox | stripe_live. NO cambiar a stripe_* sin STRIPE_GATE.',
   'payment'),

  ('payment.simulation_enabled',
   'true',
   'Simulación financiera activa. Permite generar movimientos de prueba sin dinero real.',
   'payment'),

  ('payment.real_payments_enabled',
   'false',
   '[STRIPE_GATE + LEGAL_GATE] Pagos reales activos. NO activar sin dictamen jurídico/fiscal y autorización explícita.',
   'payment'),

  ('payment.stripe_connect_enabled',
   'false',
   '[STRIPE_GATE + LEGAL_GATE] Stripe Connect activo. NO activar sin dictamen y autorización explícita.',
   'payment'),

  -- Comisiones
  ('commission.enabled',
   'false',
   '[TAX_GATE] Comisión real activa. En Fase 0 siempre false. Solo simulation_rate en uso.',
   'commission'),

  ('commission.simulation_rate',
   '0.02',
   'Tasa de simulación (2%). NO es tarifa comercial. Solo para reporting de potencial. NO hardcodear este valor en código.',
   'commission'),

  ('commission.real_rate',
   '0.00',
   'Tasa real aplicada. 0% en Fase 0. Solo se incrementa tras M8 con autorización.',
   'commission'),

  -- Settlements
  ('settlement.enabled',
   'false',
   'Liquidaciones activas. Requiere MP-FIN-2 completado.',
   'settlement'),

  ('settlement.frequency',
   '"monthly"',
   'Frecuencia de liquidación: monthly | biweekly | weekly. Pendiente de TAX_GATE.',
   'settlement'),

  ('settlement.hold_days',
   '7',
   'Días de retención tras entrega antes de liberar transfer. [LEGAL_GATE]',
   'settlement'),

  -- Payouts
  ('payout.real_payouts_enabled',
   'false',
   '[STRIPE_GATE] Pagos reales a proveedores activos. NO activar sin STRIPE_GATE.',
   'payout'),

  -- Reservas
  ('reserve.enabled',
   'false',
   'Reservas/holds activos. Preparado pero no ejecutable en Fase 0.',
   'reserve'),

  -- Refunds
  ('refund.enabled',
   'true',
   'Refunds habilitados (en modo simulación). Los refunds reales requieren payment.real_payments_enabled.',
   'refund'),

  -- Disputas
  ('dispute.enabled',
   'true',
   'Registro de disputas habilitado (modo simulación).',
   'dispute')

ON CONFLICT (config_key) DO NOTHING;

-- ── 4. Función de lectura de config (SECURITY DEFINER) ─────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_config(p_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT config_value INTO v_value
    FROM public.trade_marketplace_financial_config
   WHERE config_key = p_key;
  RETURN v_value;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_get_config IS
  'Lee un valor de configuración financiera. Disponible para authenticated.';

-- Función de lectura boolean (helper)
CREATE OR REPLACE FUNCTION public.mkt_fin_config_bool(p_key text, p_default boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_value jsonb;
BEGIN
  SELECT config_value INTO v_value
    FROM public.trade_marketplace_financial_config
   WHERE config_key = p_key;
  IF v_value IS NULL THEN RETURN p_default; END IF;
  RETURN (v_value)::boolean;
EXCEPTION
  WHEN OTHERS THEN RETURN p_default;
END;
$$;

-- ── 5. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_financial_config ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado puede leer la config
CREATE POLICY "fin_config_select_authenticated"
  ON public.trade_marketplace_financial_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Escritura: solo platform_admin
CREATE POLICY "fin_config_write_platform_admin"
  ON public.trade_marketplace_financial_config
  FOR ALL
  TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ── 6. Grants ─────────────────────────────────────────────────────────────

GRANT SELECT ON public.trade_marketplace_financial_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_config_bool TO authenticated;

COMMIT;
