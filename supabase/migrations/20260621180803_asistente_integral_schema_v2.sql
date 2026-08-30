
-- 1. Ampliar las categorías permitidas
ALTER TABLE trade_norm_documents
  DROP CONSTRAINT IF EXISTS trade_norm_documents_category_check;

ALTER TABLE trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_category_check
  CHECK (category IN (
    'REBT','RITE','CTE','GAS','ACS','IDAE','FABRICANTE','GUIAS','OFICIOS',
    'SOCIAL','AEAT','DGT','CONVENIOS','CIRCULARES'
  ));

-- 2. Nuevos campos de procedencia y vigencia en documentos
ALTER TABLE trade_norm_documents
  ADD COLUMN IF NOT EXISTS organismo_emisor     text NOT NULL DEFAULT 'BOE',
  ADD COLUMN IF NOT EXISTS fecha_publicacion    date,
  ADD COLUMN IF NOT EXISTS fecha_derogacion     date,
  ADD COLUMN IF NOT EXISTS ambito_territorial   text NOT NULL DEFAULT 'estatal'
    CHECK (ambito_territorial IN ('estatal','autonomico','provincial')),
  ADD COLUMN IF NOT EXISTS territorio           text,
  ADD COLUMN IF NOT EXISTS tipo_documento       text NOT NULL DEFAULT 'reglamento'
    CHECK (tipo_documento IN (
      'ley','reglamento','consulta_vinculante','convenio_colectivo',
      'circular','guia_tecnica','manual'
    )),
  ADD COLUMN IF NOT EXISTS numero_consulta      text;

-- 3. Naturaleza jurídica a nivel de chunk
ALTER TABLE trade_norm_chunks
  ADD COLUMN IF NOT EXISTS naturaleza text NOT NULL DEFAULT 'obligacion_legal'
    CHECK (naturaleza IN ('obligacion_legal','recomendacion_tecnica','interpretacion'));

-- 4. Tabla de conflictos normativos
CREATE TABLE IF NOT EXISTS trade_norm_conflicts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id_a     uuid NOT NULL REFERENCES trade_norm_chunks(id) ON DELETE CASCADE,
  chunk_id_b     uuid NOT NULL REFERENCES trade_norm_chunks(id) ON DELETE CASCADE,
  descripcion    text NOT NULL,
  resolucion     text,
  detectado_por  text NOT NULL DEFAULT 'admin',
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 5. Índice para filtrar rápidamente por vigencia
CREATE INDEX IF NOT EXISTS idx_norm_documents_vigente
  ON trade_norm_documents (category, fecha_derogacion)
  WHERE fecha_derogacion IS NULL;

-- 6. Índice adicional para búsquedas por organismo y tipo
CREATE INDEX IF NOT EXISTS idx_norm_documents_organismo
  ON trade_norm_documents (organismo_emisor, tipo_documento);
;
