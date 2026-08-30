
-- Ampliar category_check para añadir VE y FV
ALTER TABLE public.trade_norm_documents
  DROP CONSTRAINT trade_norm_documents_category_check;

ALTER TABLE public.trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_category_check
  CHECK (category = ANY (ARRAY[
    'REBT','RITE','CTE','GAS','ACS','IDAE','FABRICANTE','GUIAS','OFICIOS',
    'VE','FV',
    'AEAT','AEAT_IVA','AEAT_RENTA','AEAT_RENTA_CCAA','AEAT_PATRIMONIO',
    'AEAT_FACTURACION','AEAT_VERIFACTU','AEAT_SOCIEDADES',
    'DGT','CONVENIOS','CIRCULARES','SOCIAL',
    'SS_LGSS','SS_AFILIACION','SS_COTIZACION','SS_RETA','SS_SISTEMA_RED',
    'SS_BONIFICACIONES','SS_AUTONOMO_COLABORADOR','SS_BOLETINES_RED'
  ]));

-- Ampliar tipo_documento_check para añadir norma_tecnica
ALTER TABLE public.trade_norm_documents
  DROP CONSTRAINT trade_norm_documents_tipo_documento_check;

ALTER TABLE public.trade_norm_documents
  ADD CONSTRAINT trade_norm_documents_tipo_documento_check
  CHECK (tipo_documento = ANY (ARRAY[
    'ley','reglamento','consulta_vinculante','convenio_colectivo',
    'circular','guia_tecnica','guia','manual','boletin','norma_tecnica'
  ]));

-- Lo mismo para trade_norm_chunks si tiene oficio check en category
-- (no lo tiene, así que no es necesario)
;
