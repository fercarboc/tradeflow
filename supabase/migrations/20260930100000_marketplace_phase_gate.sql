-- Bloque 1: Control de activación del marketplace por fase
-- Propósito: Desactivar todas las operaciones de escritura del marketplace durante
--            el período de piloto y Fase 1 de producción.
--
-- Control: admin_automation_config.marketplace_phase_enabled = 'true' | 'false'
-- Solo puede modificarlo fercarboc@gmail.com (RLS existente en la tabla).
--
-- Activación:  UPDATE admin_automation_config SET value='true'  WHERE key='marketplace_phase_enabled';
-- Desactivación: UPDATE admin_automation_config SET value='false' WHERE key='marketplace_phase_enabled';
--
-- Mecanismo: BEFORE INSERT triggers en las 4 tablas de escritura del marketplace.
-- Los triggers se ejecutan ANTES de las comprobaciones RLS y en cualquier contexto
-- incluidas funciones SECURITY DEFINER, por lo que ninguna nueva inserción los evita.
--
-- Cobertura: bloquea INSERCIONES nuevas (no UPDATE ni DELETE sobre registros existentes).
-- UPDATE sobre pedidos existentes (p.ej. estados del portal proveedor) no queda bloqueado;
-- esto es intencional: durante el piloto no hay pedidos reales, y al activar el marketplace
-- los proveedores deben poder actualizar el estado de sus pedidos.
-- La cadena de compra completa requiere INSERT en trade_marketplace_carts Y en
-- trade_marketplace_orders; ambas están protegidas, por lo que ninguna compra puede completarse.

-- 1. Insertar el flag desactivado (no sobreescribir si ya existe)
INSERT INTO public.admin_automation_config (key, value)
VALUES ('marketplace_phase_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

-- 2. Función auxiliar que lee el flag (SECURITY DEFINER para bypassar RLS en admin_automation_config)
CREATE OR REPLACE FUNCTION public._marketplace_is_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value = 'true' FROM public.admin_automation_config WHERE key = 'marketplace_phase_enabled'),
    false
  );
$$;

COMMENT ON FUNCTION public._marketplace_is_active() IS
  'Lee admin_automation_config.marketplace_phase_enabled. '
  'true = marketplace activo. false = marketplace bloqueado. '
  'Activar: UPDATE admin_automation_config SET value=''true'' WHERE key=''marketplace_phase_enabled''; '
  'Desactivar: UPDATE admin_automation_config SET value=''false'' WHERE key=''marketplace_phase_enabled'';';

-- 3. Función trigger que bloquea el INSERT cuando el marketplace está desactivado
CREATE OR REPLACE FUNCTION public.trg_marketplace_phase_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._marketplace_is_active() THEN
    RAISE EXCEPTION 'MARKETPLACE_DISABLED'
      USING HINT    = 'El marketplace no está disponible en esta fase. Contacta con el administrador.',
            ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trg_marketplace_phase_gate() IS
  'Trigger BEFORE INSERT que bloquea operaciones de marketplace cuando el flag está desactivado. '
  'Se instala en trade_marketplace_carts, trade_marketplace_orders, '
  'trade_marketplace_master_orders y trade_supplier_orders.';

-- 4. Instalar el trigger en las 4 tablas de escritura del marketplace

-- 4a. Carritos — primera operación de cualquier flujo de compra
CREATE OR REPLACE TRIGGER trg_marketplace_phase_gate_carts
  BEFORE INSERT ON public.trade_marketplace_carts
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_phase_gate();

-- 4b. Pedidos marketplace — creados por checkout_cart_v2 (SECURITY DEFINER)
CREATE OR REPLACE TRIGGER trg_marketplace_phase_gate_orders
  BEFORE INSERT ON public.trade_marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_phase_gate();

-- 4c. Pedidos maestros — creados por mkt_fin_create_master_order (SECURITY DEFINER)
CREATE OR REPLACE TRIGGER trg_marketplace_phase_gate_master_orders
  BEFORE INSERT ON public.trade_marketplace_master_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_phase_gate();

-- 4d. Pedidos a proveedor (legacy) — escrituras directas del cliente via supabase.from()
CREATE OR REPLACE TRIGGER trg_marketplace_phase_gate_supplier_orders
  BEFORE INSERT ON public.trade_supplier_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_marketplace_phase_gate();
