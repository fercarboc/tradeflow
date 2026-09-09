-- P1: Maintenance Contract Foundation
-- Adds the correct FK from trade_contracts to trade_maintenance_contratos,
-- adds metodo_pago to the operational contract, and grants necessary permissions.

-- 1. Correct back-reference: trade_contracts → trade_maintenance_contratos
--    The existing mantenimiento_id points to trade_maintenance_presupuestos (preserved for presupuesto pre-fill).
--    maintenance_contract_id is the authoritative link to the operational contract.
ALTER TABLE public.trade_contracts
  ADD COLUMN IF NOT EXISTS maintenance_contract_id uuid
    REFERENCES public.trade_maintenance_contratos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tc_maintenance_contract_id
  ON public.trade_contracts(maintenance_contract_id);

-- 2. Payment method on the operational contract
--    Previously only lived in trade_contracts.variables jsonb (forma_pago key).
--    This structured column allows the billing cron to propagate it to trade_invoices.metodo_pago.
ALTER TABLE public.trade_maintenance_contratos
  ADD COLUMN IF NOT EXISTS metodo_pago text;

-- 3. RLS grants (authenticated role already has base access via existing policies)
GRANT SELECT, UPDATE ON public.trade_contracts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.trade_maintenance_contratos TO authenticated;
