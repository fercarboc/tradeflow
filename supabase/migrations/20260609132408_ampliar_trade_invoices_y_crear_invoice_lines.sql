
-- Ampliar trade_invoices con campos de la nueva máquina de estados de facturación
ALTER TABLE trade_invoices
  ADD COLUMN IF NOT EXISTS tipo_factura      TEXT DEFAULT 'trabajo_puntual',
  ADD COLUMN IF NOT EXISTS serie             TEXT,
  ADD COLUMN IF NOT EXISTS mes_facturacion   DATE,
  ADD COLUMN IF NOT EXISTS metodo_pago       TEXT,
  ADD COLUMN IF NOT EXISTS fecha_emision     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS razon_social_cliente TEXT,
  ADD COLUMN IF NOT EXISTS nif_cliente       TEXT,
  ADD COLUMN IF NOT EXISTS direccion_cliente TEXT,
  ADD COLUMN IF NOT EXISTS notas_internas    TEXT,
  ADD COLUMN IF NOT EXISTS rectifica_factura_id UUID REFERENCES trade_invoices(id),
  ADD COLUMN IF NOT EXISTS motivo_rectificacion TEXT;

CREATE INDEX IF NOT EXISTS idx_trade_invoices_serie ON trade_invoices(serie, org_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_mes ON trade_invoices(mes_facturacion, org_id);
CREATE INDEX IF NOT EXISTS idx_trade_invoices_estado ON trade_invoices(estado, org_id);

UPDATE trade_invoices SET serie = 'F' WHERE serie IS NULL AND (contract_id IS NULL OR contract_id::text = '');
UPDATE trade_invoices SET serie = 'M' WHERE serie IS NULL AND contract_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS trade_invoice_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id      UUID NOT NULL REFERENCES trade_invoices(id) ON DELETE CASCADE,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(10,3) DEFAULT 1,
  precio_unitario NUMERIC(10,2) NOT NULL,
  descuento_pct   NUMERIC(5,2) DEFAULT 0,
  subtotal        NUMERIC(10,2) NOT NULL,
  orden           INTEGER DEFAULT 0,
  tipo            TEXT DEFAULT 'material',
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_factura ON trade_invoice_lines(factura_id);

ALTER TABLE trade_invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_lines_org_access" ON trade_invoice_lines;
CREATE POLICY "invoice_lines_org_access"
ON trade_invoice_lines
USING (
  factura_id IN (
    SELECT id FROM trade_invoices WHERE org_id IN (
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true
      UNION
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  )
);
;
