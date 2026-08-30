
-- ══════════════════════════════════════════════════════
-- Sistema Documental Corporativo TrabFlow
-- ══════════════════════════════════════════════════════

-- Documentos corporativos (pitch, financial model, contratos, etc.)
CREATE TABLE IF NOT EXISTS admin_corp_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria   TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  version     TEXT NOT NULL DEFAULT 'v1.0',
  file_url    TEXT,
  estado      TEXT NOT NULL DEFAULT 'vigente'
                CHECK (estado IN ('vigente', 'borrador', 'obsoleto')),
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corp_docs_categoria ON admin_corp_documents (categoria);
CREATE INDEX IF NOT EXISTS idx_corp_docs_estado    ON admin_corp_documents (estado);

-- Entidades CRM (inversores, partners, asociaciones, etc.)
CREATE TABLE IF NOT EXISTS admin_corp_entities (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  TEXT NOT NULL
                          CHECK (tipo IN ('inversor', 'financiador_publico', 'partner', 'asociacion', 'cliente_target', 'otro')),
  nombre                TEXT NOT NULL,
  estado                TEXT NOT NULL DEFAULT 'potencial'
                          CHECK (estado IN ('activo', 'potencial', 'negociacion', 'inactivo', 'descartado')),
  contacto_nombre       TEXT,
  contacto_email        TEXT,
  contacto_tel          TEXT,
  importe_potencial     NUMERIC(12,2),
  notas                 TEXT,
  proxima_accion        TEXT,
  proxima_accion_fecha  DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corp_entities_tipo   ON admin_corp_entities (tipo);
CREATE INDEX IF NOT EXISTS idx_corp_entities_estado ON admin_corp_entities (estado);

-- Pivot: documento ↔ entidad (M:N)
CREATE TABLE IF NOT EXISTS admin_corp_doc_entities (
  doc_id    UUID NOT NULL REFERENCES admin_corp_documents(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES admin_corp_entities(id) ON DELETE CASCADE,
  PRIMARY KEY (doc_id, entity_id)
);

-- RLS: solo admin (fercarboc@gmail.com)
ALTER TABLE admin_corp_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_corp_entities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_corp_doc_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_corp_documents" ON admin_corp_documents
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_all_corp_entities" ON admin_corp_entities
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_all_corp_doc_entities" ON admin_corp_doc_entities
  FOR ALL USING (auth.email() = 'fercarboc@gmail.com');

-- Trigger updated_at automático
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_corp_docs_updated_at
  BEFORE UPDATE ON admin_corp_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_corp_entities_updated_at
  BEFORE UPDATE ON admin_corp_entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
;
