-- 1. Permitir plan 'profesional' en documentos
ALTER TABLE trade_norm_documents
  DROP CONSTRAINT trade_norm_documents_plan_check;
ALTER TABLE trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_plan_check
  CHECK (plan_required = ANY (ARRAY[
    'basico','profesional','empresa','empresa_plus'
  ]));

-- 2. Añadir categorías SS a documentos
ALTER TABLE trade_norm_documents
  DROP CONSTRAINT trade_norm_documents_category_check;
ALTER TABLE trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_category_check
  CHECK (category = ANY (ARRAY[
    -- Técnicas
    'REBT','RITE','CTE','GAS','ACS','IDAE','FABRICANTE','GUIAS','OFICIOS',
    -- AEAT fiscal
    'AEAT','AEAT_IVA','AEAT_RENTA','AEAT_RENTA_CCAA','AEAT_PATRIMONIO',
    'AEAT_FACTURACION','AEAT_VERIFACTU','AEAT_SOCIEDADES',
    -- Otros fiscales
    'DGT','CONVENIOS','CIRCULARES',
    -- Seguridad Social
    'SOCIAL','SS_LGSS','SS_AFILIACION','SS_COTIZACION','SS_RETA',
    'SS_SISTEMA_RED','SS_BONIFICACIONES','SS_AUTONOMO_COLABORADOR','SS_BOLETINES_RED'
  ]));

-- 3. Añadir tipos de documento 'guia' y 'boletin'
ALTER TABLE trade_norm_documents
  DROP CONSTRAINT trade_norm_documents_tipo_documento_check;
ALTER TABLE trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_tipo_documento_check
  CHECK (tipo_documento = ANY (ARRAY[
    'ley','reglamento','consulta_vinculante','convenio_colectivo',
    'circular','guia_tecnica','guia','manual','boletin'
  ]));

-- 4. Añadir categorías SS a chunks (si tiene restricción)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'trade_norm_chunks_category_check'
      AND conrelid = 'trade_norm_chunks'::regclass
  ) THEN
    ALTER TABLE trade_norm_chunks DROP CONSTRAINT trade_norm_chunks_category_check;
  END IF;
END $$;;
