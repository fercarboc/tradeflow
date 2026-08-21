-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-1A · Migración 02
-- trade_marketplace_commission_policies — Política de comisión configurable
-- ════════════════════════════════════════════════════════════════════════════
-- INV-005: 2% es solo simulación. commission_enabled=false en Fase 0.
-- INV-006: shipping no commissionable en Fase 0.
-- TAX_GATE: base imponible y tipo IVA comisión pendientes de dictamen fiscal.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. Tabla ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_commission_policies (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre               text        NOT NULL,

  -- Activación
  commission_enabled   boolean     NOT NULL DEFAULT false,
  simulation_only      boolean     NOT NULL DEFAULT true,

  -- Tasa y tipo
  commission_rate      numeric(6,4) NOT NULL DEFAULT 0.0000
    CHECK (commission_rate >= 0 AND commission_rate <= 1),
  commission_type      text        NOT NULL DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed_per_order', 'fixed_per_item')),

  -- Base de cálculo
  commission_base      text        NOT NULL DEFAULT 'goods_net'
    CHECK (commission_base IN ('goods_net', 'goods_gross', 'goods_net_plus_shipping')),

  -- [TAX_GATE] IVA de la comisión: pendiente de dictamen.
  -- Almacenamos el tipo asumido para simulación (21%). El real puede diferir.
  commission_tax_rate  numeric(5,2) NOT NULL DEFAULT 21.00,

  -- Política de portes: false en Fase 0 (INV-006)
  applies_to_shipping  boolean     NOT NULL DEFAULT false,

  -- Vigencia
  effective_from       date,
  effective_to         date,

  -- Override por proveedor (NULL = política global)
  provider_actor_id    uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,

  -- Metadatos
  notas                text,
  is_active            boolean     NOT NULL DEFAULT true,
  created_by           uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  -- Solo puede haber una política global activa en un momento dado
  CONSTRAINT chk_commission_rate_type CHECK (
    commission_type != 'percentage' OR (commission_rate >= 0 AND commission_rate < 1)
  )
);

COMMENT ON TABLE public.trade_marketplace_commission_policies IS
  'Políticas de comisión del Marketplace. '
  'commission_enabled=false en Fase 0. '
  '2% es únicamente simulation_rate (INV-005). '
  'La base imponible definitiva y el IVA de comisión requieren TAX_GATE.';

COMMENT ON COLUMN public.trade_marketplace_commission_policies.commission_rate IS
  'Tasa de comisión. 0.0000 en Fase 0. El 2% (0.0200) es solo hipótesis de simulación.';

COMMENT ON COLUMN public.trade_marketplace_commission_policies.commission_tax_rate IS
  '[TAX_GATE] Tipo de IVA asumido para la comisión (21% por defecto para simulación). '
  'El tipo real y si aplica exención requieren dictamen fiscal.';

-- ── 2. Trigger updated_at ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_fin_commission_updated_at()
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

CREATE TRIGGER trg_mkt_fin_commission_updated_at
  BEFORE UPDATE ON public.trade_marketplace_commission_policies
  FOR EACH ROW EXECUTE FUNCTION public._mkt_fin_commission_updated_at();

-- ── 3. Política inicial: Fase 0 ───────────────────────────────────────────

INSERT INTO public.trade_marketplace_commission_policies
  (nombre, commission_enabled, simulation_only, commission_rate, commission_base,
   commission_tax_rate, applies_to_shipping, notas)
VALUES
  ('Fase 0 — Sin comisión real',
   false,           -- commission_enabled: false (INV-005)
   true,            -- simulation_only: true
   0.0000,          -- rate real: 0% en Fase 0
   'goods_net',     -- base: goods_net (INV-006 shipping excluded)
   21.00,           -- tax_rate: 21% asumido para simulación (TAX_GATE)
   false,           -- applies_to_shipping: false (INV-006)
   'Política activa en Fase 0. '
   'commission_rate=0 real. simulation_only=true. '
   'Para simulaciones usar 2% vía financial_config.commission.simulation_rate. '
   'NO hardcodear 2% en código. '
   'Modificar solo tras LEGAL_GATE + TAX_GATE + aprobación explícita.')
ON CONFLICT DO NOTHING;

-- ── 4. Función: obtener política activa ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_active_commission_policy(
  p_actor_id uuid DEFAULT NULL
)
RETURNS public.trade_marketplace_commission_policies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_policy public.trade_marketplace_commission_policies;
BEGIN
  -- 1. Intentar override del proveedor si se proporciona actor_id
  IF p_actor_id IS NOT NULL THEN
    SELECT * INTO v_policy
      FROM public.trade_marketplace_commission_policies
     WHERE provider_actor_id = p_actor_id
       AND is_active = true
       AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY created_at DESC
     LIMIT 1;
    IF FOUND THEN RETURN v_policy; END IF;
  END IF;

  -- 2. Política global (sin override de proveedor)
  SELECT * INTO v_policy
    FROM public.trade_marketplace_commission_policies
   WHERE provider_actor_id IS NULL
     AND is_active = true
     AND (effective_from IS NULL OR effective_from <= CURRENT_DATE)
     AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
   ORDER BY created_at DESC
   LIMIT 1;

  RETURN v_policy;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_get_active_commission_policy IS
  'Retorna la política de comisión activa. '
  'Prioridad: override de proveedor > política global.';

-- ── 5. Función: calcular comisión para un importe ─────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_calculate_commission(
  p_goods_net       numeric(12,2),
  p_actor_id        uuid DEFAULT NULL,
  p_simulation_mode boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_policy        public.trade_marketplace_commission_policies;
  v_rate          numeric(6,4);
  v_net           numeric(12,2);
  v_tax           numeric(12,2);
  v_gross         numeric(12,2);
  v_is_sim        boolean;
BEGIN
  v_policy := public.mkt_fin_get_active_commission_policy(p_actor_id);

  IF v_policy IS NULL THEN
    -- Sin política activa: comisión 0
    RETURN jsonb_build_object(
      'commission_net', 0,
      'commission_tax', 0,
      'commission_gross', 0,
      'commission_rate', 0,
      'is_simulation', true,
      'policy_id', NULL
    );
  END IF;

  -- En Fase 0: comisión real = 0 siempre
  -- En simulación: usar simulation_rate de financial_config si commission_enabled=false
  v_is_sim := v_policy.simulation_only OR NOT v_policy.commission_enabled;

  IF v_is_sim AND p_simulation_mode THEN
    -- Tasa de simulación desde financial_config
    v_rate := (public.mkt_fin_get_config('commission.simulation_rate'))::numeric;
    IF v_rate IS NULL THEN v_rate := 0.0000; END IF;
  ELSIF v_policy.commission_enabled AND NOT v_policy.simulation_only THEN
    v_rate := v_policy.commission_rate;
  ELSE
    v_rate := 0.0000;
  END IF;

  -- Cálculo (INV-018: rounding a nivel supplier_order, no por ítem)
  v_net   := ROUND(p_goods_net * v_rate, 2);
  -- [TAX_GATE] IVA comisión: asumimos 21% para simulación
  v_tax   := ROUND(v_net * (v_policy.commission_tax_rate / 100), 2);
  v_gross := v_net + v_tax;

  RETURN jsonb_build_object(
    'commission_net',   v_net,
    'commission_tax',   v_tax,
    'commission_gross', v_gross,
    'commission_rate',  v_rate,
    'commission_base',  v_policy.commission_base,
    'tax_rate',         v_policy.commission_tax_rate,
    'is_simulation',    v_is_sim,
    'is_real',          (v_policy.commission_enabled AND NOT v_policy.simulation_only),
    'policy_id',        v_policy.id
  );
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_calculate_commission IS
  'Calcula comisión sobre goods_net. '
  'En Fase 0 la comisión real es 0. '
  'p_simulation_mode=true usa simulation_rate de financial_config para reporting potencial. '
  'INV-005: 2% es solo simulación. INV-018: rounding a nivel supplier_order.';

-- ── 6. RLS ────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_commission_policies ENABLE ROW LEVEL SECURITY;

-- Lectura: proveedores y admins
CREATE POLICY "commission_policies_select_authenticated"
  ON public.trade_marketplace_commission_policies
  FOR SELECT
  TO authenticated
  USING (
    -- Política global: visible para todos
    provider_actor_id IS NULL
    OR
    -- Override propio: visible para miembros del actor
    provider_actor_id = ANY(public._mkt_actor_ids_for_user())
    OR
    -- Platform admin: ve todo
    public._mkt_is_platform_admin()
  );

-- Escritura: solo platform_admin
CREATE POLICY "commission_policies_write_platform_admin"
  ON public.trade_marketplace_commission_policies
  FOR ALL
  TO authenticated
  USING (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ── 7. Grants ─────────────────────────────────────────────────────────────

GRANT SELECT ON public.trade_marketplace_commission_policies TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_get_active_commission_policy TO authenticated;
GRANT EXECUTE ON FUNCTION public.mkt_fin_calculate_commission TO authenticated;

COMMIT;
