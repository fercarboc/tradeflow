
-- voyage-3-lite produce 512 dimensiones (no 1024)
-- Cambiar columna embedding a vector(512) y reconstruir índice y función

DROP INDEX IF EXISTS idx_norm_chunks_embedding;

ALTER TABLE trade_norm_chunks
  ALTER COLUMN embedding TYPE vector(512);

CREATE INDEX idx_norm_chunks_embedding
  ON trade_norm_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Actualizar función hybrid_search_norm_chunks con la dimensión correcta
CREATE OR REPLACE FUNCTION hybrid_search_norm_chunks(
  query_embedding    vector(512),
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
    c.id, c.document_id, c.chunk_id, c.article_id, c.article_title,
    c.section, c.section_title, c.chunk_text, c.category, c.oficio,
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
;
