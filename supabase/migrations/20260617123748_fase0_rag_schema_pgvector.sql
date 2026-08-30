
-- FASE 0: Cimientos RAG — Asistente Técnico del Instalador
-- Habilitar extensiones de vector y trigrama

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- TABLA: trade_norm_documents
-- Registro maestro de documentos normativos indexados
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_norm_documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category          text NOT NULL,         -- REBT / RITE / CTE / GAS / ACS / GUIAS / OFICIOS
  title             text NOT NULL,
  subtitle          text,
  boe_ref           text,                  -- Referencia BOE (BOE-A-2007-15820)
  source_url        text,
  version           text,                  -- '2002-09-18'
  valid_from        date,
  valid_until       date,                  -- NULL = versión activa
  status            text NOT NULL DEFAULT 'pending',  -- pending/processing/indexed/error
  chunk_count       int NOT NULL DEFAULT 0,
  oficio_tags       text[],                -- Oficios a los que aplica
  plan_required     text NOT NULL DEFAULT 'basico',   -- basico/empresa/empresa_plus
  last_verified_at  date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_norm_documents_status_check
    CHECK (status IN ('pending','processing','indexed','error')),
  CONSTRAINT trade_norm_documents_plan_check
    CHECK (plan_required IN ('basico','empresa','empresa_plus'))
);

-- ============================================================
-- TABLA: trade_norm_chunks
-- Fragmentos vectorizados de normativa con embeddings
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_norm_chunks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid NOT NULL REFERENCES trade_norm_documents(id) ON DELETE CASCADE,
  chunk_index    int NOT NULL,
  chunk_id       text NOT NULL,            -- 'REBT-ITC-BT-19-2.2.3' (legible)
  article_id     text,                     -- 'ITC-BT-19'
  article_title  text,
  section        text,                     -- '2.2.3'
  section_title  text,
  chunk_text     text NOT NULL,
  embedding      vector(1024),             -- Voyage AI voyage-3-lite
  token_count    int,
  page_range     text,
  keywords       text[],
  category       text NOT NULL,            -- denormalizado para filtrar sin JOIN
  oficio         text,                     -- solo para chunks de OFICIOS
  activo         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_norm_chunks_document_chunk_unique UNIQUE (document_id, chunk_index)
);

-- Índice HNSW para búsqueda ANN por coseno (rápido, sin preprocesamiento)
CREATE INDEX IF NOT EXISTS idx_norm_chunks_embedding
  ON trade_norm_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Índice trigrama para búsqueda léxica BM25 (hybrid search)
CREATE INDEX IF NOT EXISTS idx_norm_chunks_text_trgm
  ON trade_norm_chunks USING gin (chunk_text gin_trgm_ops);

-- Índice para filtrar por categoría y activo
CREATE INDEX IF NOT EXISTS idx_norm_chunks_category
  ON trade_norm_chunks (category, activo);

-- Índice para filtrar por oficio
CREATE INDEX IF NOT EXISTS idx_norm_chunks_oficio
  ON trade_norm_chunks (oficio) WHERE oficio IS NOT NULL;

-- ============================================================
-- TABLA: trade_rag_logs
-- Log de todas las consultas RAG (analytics + feedback)
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_rag_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid REFERENCES trade_organizations(id) ON DELETE SET NULL,
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  query_text       text NOT NULL,
  chunks_retrieved uuid[],                 -- IDs de chunks usados en la respuesta
  answer_text      text,
  sources_json     jsonb,                  -- [{document, article, excerpt, boe_ref}]
  confidence       text DEFAULT 'medium',  -- high/medium/low/none
  model_used       text DEFAULT 'claude-sonnet-4-6',
  tokens_input     int,
  tokens_output    int,
  latency_ms       int,
  user_rating      smallint,              -- NULL / 1 (útil) / -1 (no útil)
  user_feedback    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_rag_logs_confidence_check
    CHECK (confidence IN ('high','medium','low','none')),
  CONSTRAINT trade_rag_logs_rating_check
    CHECK (user_rating IN (-1, 1) OR user_rating IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_rag_logs_org_id
  ON trade_rag_logs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rag_logs_user_id
  ON trade_rag_logs (user_id, created_at DESC);

-- ============================================================
-- TABLA: trade_rag_rate_limits
-- Control de uso diario por organización
-- ============================================================
CREATE TABLE IF NOT EXISTS trade_rag_rate_limits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  query_count  int NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_rag_rate_limits_org_date_unique UNIQUE (org_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rag_rate_limits_org_date
  ON trade_rag_rate_limits (org_id, date);

-- ============================================================
-- FUNCIÓN: hybrid_search_norm_chunks
-- Búsqueda híbrida: coseno (70%) + trigrama léxico (30%)
-- ============================================================
CREATE OR REPLACE FUNCTION hybrid_search_norm_chunks(
  query_embedding    vector(1024),
  query_text         text,
  match_count        int DEFAULT 8,
  category_filter    text[] DEFAULT NULL,
  oficio_filter      text DEFAULT NULL
)
RETURNS TABLE (
  id             uuid,
  document_id    uuid,
  chunk_id       text,
  article_id     text,
  article_title  text,
  section        text,
  section_title  text,
  chunk_text     text,
  category       text,
  oficio         text,
  hybrid_score   float
)
LANGUAGE SQL STABLE AS $$
  SELECT
    c.id,
    c.document_id,
    c.chunk_id,
    c.article_id,
    c.article_title,
    c.section,
    c.section_title,
    c.chunk_text,
    c.category,
    c.oficio,
    (1 - (c.embedding <=> query_embedding)) * 0.7
      + similarity(c.chunk_text, query_text) * 0.3 AS hybrid_score
  FROM trade_norm_chunks c
  WHERE c.activo = true
    AND c.embedding IS NOT NULL
    AND (category_filter IS NULL OR c.category = ANY(category_filter))
    AND (oficio_filter IS NULL OR c.oficio = oficio_filter)
  ORDER BY hybrid_score DESC
  LIMIT match_count;
$$;

-- ============================================================
-- RLS: Políticas de seguridad
-- ============================================================
ALTER TABLE trade_norm_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_norm_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_rag_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_rag_rate_limits ENABLE ROW LEVEL SECURITY;

-- Documentos: lectura pública (normativa es pública)
CREATE POLICY "norm_documents_public_read" ON trade_norm_documents
  FOR SELECT USING (true);

-- Chunks: lectura pública (el acceso por plan se controla en la edge function)
CREATE POLICY "norm_chunks_public_read" ON trade_norm_chunks
  FOR SELECT USING (true);

-- Logs: cada org ve solo los suyos
CREATE POLICY "rag_logs_org_isolation" ON trade_rag_logs
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM trade_org_members
      WHERE user_id = auth.uid() AND activo = true
      UNION
      SELECT id FROM trade_organizations
      WHERE owner_id = auth.uid()
    )
  );

-- Rate limits: cada org gestiona los suyos
CREATE POLICY "rag_rate_limits_org_isolation" ON trade_rag_rate_limits
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM trade_org_members
      WHERE user_id = auth.uid() AND activo = true
      UNION
      SELECT id FROM trade_organizations
      WHERE owner_id = auth.uid()
    )
  );

-- INSERT/UPDATE en trade_norm_documents y chunks: solo desde service_role (edge functions admin)
-- (No hay política de INSERT para roles anónimos/autenticados — solo service_role puede ingestar)
;
