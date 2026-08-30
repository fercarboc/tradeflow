
-- Vinculación directa a presupuesto (sin pasar por job)
ALTER TABLE trade_subcontratas
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES trade_quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero TEXT, -- SUB-YYYY-NNN generado al crear
  ADD COLUMN IF NOT EXISTS importe_factura_recibida NUMERIC(10,2), -- lo que nos cobra la subcontrata
  ADD COLUMN IF NOT EXISTS fecha_factura_recibida DATE,
  ADD COLUMN IF NOT EXISTS referencia_factura_subcontrata TEXT,
  ADD COLUMN IF NOT EXISTS pagado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagado BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para buscar por presupuesto
CREATE INDEX IF NOT EXISTS idx_trade_subcontratas_quote_id ON trade_subcontratas(quote_id);

-- Función para generar número de subcontrata al insertar
CREATE OR REPLACE FUNCTION generate_subcontrata_numero()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_year TEXT := to_char(now(), 'YYYY');
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM trade_subcontratas
  WHERE org_id = NEW.org_id
    AND to_char(created_at, 'YYYY') = v_year;
  NEW.numero := 'SUB-' || v_year || '-' || LPAD((v_count + 1)::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subcontrata_numero ON trade_subcontratas;
CREATE TRIGGER trg_subcontrata_numero
  BEFORE INSERT ON trade_subcontratas
  FOR EACH ROW
  WHEN (NEW.numero IS NULL)
  EXECUTE FUNCTION generate_subcontrata_numero();
;
