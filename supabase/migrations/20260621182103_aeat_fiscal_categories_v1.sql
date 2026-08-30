
-- 1. Ampliar categorías con sub-categorías AEAT fiscales
ALTER TABLE trade_norm_documents
  DROP CONSTRAINT IF EXISTS trade_norm_documents_category_check;

ALTER TABLE trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_category_check
  CHECK (category IN (
    'REBT','RITE','CTE','GAS','ACS','IDAE','FABRICANTE','GUIAS','OFICIOS',
    'SOCIAL','AEAT','DGT','CONVENIOS','CIRCULARES',
    'AEAT_IVA','AEAT_RENTA','AEAT_RENTA_CCAA',
    'AEAT_PATRIMONIO','AEAT_FACTURACION','AEAT_VERIFACTU','AEAT_SOCIEDADES'
  ));

-- 2. Campo comunidad_autonoma en chunks (para filtrado territorial autonómico)
ALTER TABLE trade_norm_chunks
  ADD COLUMN IF NOT EXISTS comunidad_autonoma text;

-- 3. Índice para filtrar por comunidad autónoma en deducciones
CREATE INDEX IF NOT EXISTS idx_chunks_ccaa
  ON trade_norm_chunks (category, comunidad_autonoma)
  WHERE comunidad_autonoma IS NOT NULL;

-- 4. Campo subcategoria en documentos (para agrupación en UI)
ALTER TABLE trade_norm_documents
  ADD COLUMN IF NOT EXISTS subcategoria text;

-- 5. Índice compuesto categoría + vigencia para el filtro hot-path
CREATE INDEX IF NOT EXISTS idx_norm_docs_cat_vigente
  ON trade_norm_documents (category)
  WHERE fecha_derogacion IS NULL;
;
