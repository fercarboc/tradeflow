
-- ── Crear bucket corporate-documents ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('corporate-documents', 'corporate-documents', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies (DROP first para idempotencia)
DO $$ BEGIN
  DROP POLICY IF EXISTS "admin_select_corporate_docs" ON storage.objects;
  DROP POLICY IF EXISTS "admin_insert_corporate_docs" ON storage.objects;
  DROP POLICY IF EXISTS "admin_update_corporate_docs" ON storage.objects;
  DROP POLICY IF EXISTS "admin_delete_corporate_docs" ON storage.objects;
END $$;

CREATE POLICY "admin_select_corporate_docs"
ON storage.objects FOR SELECT
USING (bucket_id = 'corporate-documents' AND auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_insert_corporate_docs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'corporate-documents' AND auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_update_corporate_docs"
ON storage.objects FOR UPDATE
USING (bucket_id = 'corporate-documents' AND auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_delete_corporate_docs"
ON storage.objects FOR DELETE
USING (bucket_id = 'corporate-documents' AND auth.email() = 'fercarboc@gmail.com');

-- ── Tabla trade_documents ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_documents (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT        NOT NULL,
  descripcion  TEXT,
  categoria    TEXT        NOT NULL,
  version      TEXT        NOT NULL DEFAULT 'v1.0',
  estado       TEXT        NOT NULL DEFAULT 'vigente'
                             CHECK (estado IN ('vigente', 'borrador', 'obsoleto')),
  storage_path TEXT,
  bucket       TEXT        DEFAULT 'corporate-documents',
  mime_type    TEXT,
  size         BIGINT,
  file_hash    TEXT,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  origen_path  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_docs_categoria ON trade_documents (categoria);
CREATE INDEX IF NOT EXISTS idx_trade_docs_estado    ON trade_documents (estado);
CREATE INDEX IF NOT EXISTS idx_trade_docs_hash      ON trade_documents (file_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trade_docs_origen ON trade_documents (origen_path)
  WHERE origen_path IS NOT NULL;

-- ── Pivot: document ↔ entity ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_document_entities (
  document_id UUID NOT NULL REFERENCES trade_documents(id) ON DELETE CASCADE,
  entity_id   UUID NOT NULL REFERENCES admin_corp_entities(id) ON DELETE CASCADE,
  PRIMARY KEY (document_id, entity_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE trade_documents         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_document_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all_trade_documents"
  ON trade_documents FOR ALL
  USING (auth.email() = 'fercarboc@gmail.com');

CREATE POLICY "admin_all_trade_document_entities"
  ON trade_document_entities FOR ALL
  USING (auth.email() = 'fercarboc@gmail.com');

-- Reusar trigger updated_at ya existente
CREATE TRIGGER trg_trade_docs_updated_at
  BEFORE UPDATE ON trade_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
;
