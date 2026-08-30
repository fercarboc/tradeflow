
-- Link facturas to maintenance contracts
ALTER TABLE trade_invoices
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES trade_contracts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS devuelta_at timestamptz,
  ADD COLUMN IF NOT EXISTS devuelta_motivo text;

-- Link maintenance contratos to trade_contracts (PDF contract)
ALTER TABLE trade_maintenance_contratos
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES trade_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trade_invoices_contract_id ON trade_invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_contratos_contract_id ON trade_maintenance_contratos(contract_id);
;
