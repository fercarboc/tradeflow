-- ════════════════════════════════════════════════════════════════════════════
-- TRABFLOW-V2-MARKETPLACE-PREVIEW-1-FIX1
-- Acceso preview V2 Marketplace exclusivo para usuario autorizado
-- ════════════════════════════════════════════════════════════════════════════
--
-- PROPÓSITO:
--   Extender trg_marketplace_phase_gate() para que, cuando
--   marketplace_phase_enabled = 'false', el usuario con UUID autorizado
--   pueda ejecutar operaciones reales de Marketplace (carrito, pedido)
--   sin activar el marketplace globalmente.
--
-- IDENTIDAD AUTORITATIVA:
--   auth.uid() — UUID del JWT emitido y firmado por Supabase Auth.
--   No es manipulable por el cliente sin la JWT secret del proyecto.
--   Se almacena en admin_automation_config['marketplace_v2_preview_uid'].
--   Solo puede modificarse con email fercarboc@gmail.com (RLS de la tabla).
--
-- SEGURIDAD:
--   auth.uid() IS NULL → service_role / conexión directa → NO obtiene preview.
--   El cliente NO puede pasar el UUID como parámetro; auth.uid() lo extrae
--   el servidor de los claims JWT de la sesión activa.
--
-- COBERTURA:
--   Las mismas 4 tablas que el gate original:
--     trade_marketplace_carts
--     trade_marketplace_orders
--     trade_marketplace_master_orders
--     trade_supplier_orders
--   Los triggers (trg_marketplace_phase_gate_*) NO se tocan; siguen llamando
--   a trg_marketplace_phase_gate() que ahora incorpora la excepción preview.
--
-- REVERSIÓN:
--   Para revocar el preview:
--     UPDATE public.admin_automation_config SET value = ''
--     WHERE key = 'marketplace_v2_preview_uid';
--   Para activar el marketplace globalmente (elimina necesidad de preview):
--     UPDATE public.admin_automation_config SET value = 'true'
--     WHERE key = 'marketplace_phase_enabled';
--
-- NO AFECTA:
--   Stripe, PaymentIntent, VeriFactu, facturas reales.
--   El checkout utiliza modo 'simulation' (mkt_fin_financial_config).
--   trade_fiscal_records no se toca.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Registrar UUID del usuario preview V2 ─────────────────────────────────
-- UUID de legal@inmostay.com (obtenido server-side de auth.users).
-- ON CONFLICT DO NOTHING: idempotente; si ya existe, no sobreescribe.
INSERT INTO public.admin_automation_config (key, value)
VALUES ('marketplace_v2_preview_uid', 'd2b5622c-87e5-4097-a7d2-c04fb5c7644b')
ON CONFLICT (key) DO NOTHING;

-- ── 2. Función: ¿el usuario actual tiene acceso preview V2? ──────────────────
-- Identidad via auth.uid() (JWT-signed, servidor).
-- auth.uid() IS NULL = service_role / sin JWT → siempre FALSE.
-- La función es SECURITY DEFINER para poder leer admin_automation_config
-- sin depender del RLS de esa tabla.
CREATE OR REPLACE FUNCTION public._marketplace_preview_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND auth.uid()::text = (
      SELECT value
      FROM public.admin_automation_config
      WHERE key = 'marketplace_v2_preview_uid'
        AND value <> ''
    );
$$;

COMMENT ON FUNCTION public._marketplace_preview_allowed() IS
  'TEMPORAL — Preview V2 Marketplace. '
  'Devuelve TRUE si auth.uid() del JWT coincide con marketplace_v2_preview_uid '
  'en admin_automation_config. '
  'auth.uid() IS NULL (service_role / sin JWT) → siempre FALSE. '
  'Para revocar: UPDATE admin_automation_config SET value='''' WHERE key=''marketplace_v2_preview_uid''. '
  'Eliminar cuando marketplace_phase_enabled=''true'' sea permanente.';

-- ── 3. Extender trg_marketplace_phase_gate con excepción preview ─────────────
-- _marketplace_is_active() preservada e intacta.
-- La condición es: (global activo) OR (usuario preview autorizado).
-- Si auth.uid() IS NULL, _marketplace_preview_allowed() = FALSE → sigue bloqueado.
CREATE OR REPLACE FUNCTION public.trg_marketplace_phase_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public._marketplace_is_active() OR public._marketplace_preview_allowed()) THEN
    RAISE EXCEPTION 'MARKETPLACE_DISABLED'
      USING HINT    = 'El marketplace no está disponible en esta fase. Contacta con el administrador.',
            ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_marketplace_phase_gate() IS
  'Trigger BEFORE INSERT que bloquea operaciones de marketplace cuando el flag está desactivado. '
  'Permite paso si: marketplace global activo (_marketplace_is_active()) '
  'O usuario actual en allowlist preview V2 (_marketplace_preview_allowed()). '
  'Se instala en trade_marketplace_carts, trade_marketplace_orders, '
  'trade_marketplace_master_orders y trade_supplier_orders. '
  'Los triggers concretos (trg_marketplace_phase_gate_*) NO se modifican.';

-- ── Nota sobre auth.uid() en contexto SECURITY DEFINER ───────────────────────
-- auth.uid() lee current_setting(''request.jwt.claims'', true) establecido
-- por PostgREST para cada request autenticado. Este valor se propaga a través
-- de llamadas SECURITY DEFINER (incluyendo create_cart_from_quote y checkout_cart_v2).
-- En conexiones directas (service_role sin headers JWT) el setting no se establece
-- y auth.uid() devuelve NULL → _marketplace_preview_allowed() = FALSE → bloqueado.
-- ─────────────────────────────────────────────────────────────────────────────

-- ════════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN ESPERADA (SQL manual, ejecutar en Supabase SQL Editor):
--
-- GATE-1: usuario normal + global=false → BLOQUEADO
--   SET LOCAL request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';
--   INSERT INTO public.trade_marketplace_carts (org_id, user_id, source_type)
--   VALUES ('...', '00000000-0000-0000-0000-000000000001', 'manual');
--   → ERROR: MARKETPLACE_DISABLED
--
-- GATE-2: legal@inmostay.com + global=false → PERMITIDO por preview
--   SET LOCAL request.jwt.claims = '{"sub":"d2b5622c-87e5-4097-a7d2-c04fb5c7644b","role":"authenticated"}';
--   → INSERT no lanza MARKETPLACE_DISABLED (puede fallar por RLS/FK, no por gate)
--
-- GATE-3: global=true + cualquier usuario → PERMITIDO
--   UPDATE admin_automation_config SET value='true' WHERE key='marketplace_phase_enabled';
--   → INSERT no lanza MARKETPLACE_DISABLED
--   UPDATE admin_automation_config SET value='false' WHERE key='marketplace_phase_enabled';
--
-- GATE-4: auth.uid() NULL (service_role) → BLOQUEADO
--   -- Usar conexión service_role sin establecer request.jwt.claims
--   INSERT INTO public.trade_marketplace_carts (...) VALUES (...);
--   → ERROR: MARKETPLACE_DISABLED  (preview no concedido porque auth.uid() IS NULL)
--
-- GATE-5: usuario preview de otra org → no modifica datos ajenos (RLS)
--   → INSERT con org_id de otra org falla con RLS violation, no con MARKETPLACE_DISABLED
-- ════════════════════════════════════════════════════════════════════════════
