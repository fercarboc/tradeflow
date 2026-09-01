-- Migration: add mantenimiento_id to trade_invoices + UNIQUE partial index
-- for maintenance billing idempotency.
--
-- Context:
--   trade_invoices.mantenimiento_id → FK → trade_maintenance_contratos(id)
--   UNIQUE partial index: (org_id, mantenimiento_id, mes_facturacion)
--   WHERE mantenimiento_id IS NOT NULL AND tipo_factura = 'contrato_cuota'
--
-- Safety analysis (verified before applying):
--   - 0 rows with tipo_factura = 'contrato_cuota' in trade_invoices (clean slate).
--   - Column is nullable: no existing rows are affected.
--   - Partial index: only covers maintenance cuota invoices — no impact on other
--     invoice types regardless of mes_facturacion or mantenimiento_id nullability.
--
-- Deployment order:
--   1. Apply this migration.
--   2. Deploy trade-maintenance-billing Edge Function (uses mantenimiento_id).
--   3. Deploy frontend TS build.

-- 1. Add column
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS mantenimiento_id uuid
    REFERENCES public.trade_maintenance_contratos(id) ON DELETE SET NULL;

-- 2. Index for lookup performance
CREATE INDEX IF NOT EXISTS idx_invoices_mantenimiento_id
  ON public.trade_invoices (mantenimiento_id)
  WHERE mantenimiento_id IS NOT NULL;

-- 3. UNIQUE partial index — DB-level idempotency guard
--    Prevents two billing runs from creating duplicate invoices for the same
--    maintenance contract + period, even under concurrent execution.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invoices_mant_period
  ON public.trade_invoices (org_id, mantenimiento_id, mes_facturacion)
  WHERE mantenimiento_id IS NOT NULL
    AND tipo_factura = 'contrato_cuota';

COMMENT ON COLUMN public.trade_invoices.mantenimiento_id IS
  'FK to trade_maintenance_contratos. Set by the billing cron when creating '
  'periodic maintenance borradores. Together with mes_facturacion forms a '
  'unique key (enforced via uq_invoices_mant_period partial index).';
