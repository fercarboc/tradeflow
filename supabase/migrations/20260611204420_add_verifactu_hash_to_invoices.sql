
-- Añade columna verifactu_hash a trade_invoices
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS verifactu_hash TEXT;
ALTER TABLE trade_invoices ADD COLUMN IF NOT EXISTS verifactu_hash_anterior TEXT;

-- Índice para buscar la huella del encadenamiento
CREATE INDEX IF NOT EXISTS idx_trade_invoices_verifactu ON trade_invoices(org_id, fecha_emision, verifactu_hash) WHERE verifactu_hash IS NOT NULL;

COMMENT ON COLUMN trade_invoices.verifactu_hash IS 'SHA-256 hex del registro de facturación verificable (RD 1007/2023). Input: CIF;numero;fecha;TipoF;cuota_iva;total;hash_anterior';
COMMENT ON COLUMN trade_invoices.verifactu_hash_anterior IS 'Hash de la factura anterior en la cadena de encadenamiento VeriFactu';
;
