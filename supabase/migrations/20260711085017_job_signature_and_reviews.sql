
-- Firma del cliente en el parte de trabajo
ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS firma_cliente_url TEXT;

-- Tabla de valoraciones post-trabajo
CREATE TABLE IF NOT EXISTS trade_job_reviews (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES trade_jobs(id) ON DELETE CASCADE,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  job_titulo    TEXT,
  cliente_nombre TEXT,
  rating        INT CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
  comentario    TEXT,
  respondido_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_job_reviews_job   ON trade_job_reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_job_reviews_token ON trade_job_reviews(token);
CREATE INDEX IF NOT EXISTS idx_job_reviews_org   ON trade_job_reviews(org_id, created_at DESC);

ALTER TABLE trade_job_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_job_reviews" ON trade_job_reviews
  FOR ALL USING (
    org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  );

-- RPC pública: obtener info del trabajo por token (sin autenticación)
CREATE OR REPLACE FUNCTION get_job_review_info(p_token TEXT)
RETURNS TABLE(
  job_titulo      TEXT,
  org_nombre      TEXT,
  org_logo_url    TEXT,
  cliente_nombre  TEXT,
  respondido      BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.job_titulo::TEXT,
    o.nombre::TEXT,
    o.logo_url::TEXT,
    r.cliente_nombre::TEXT,
    (r.respondido_at IS NOT NULL) AS respondido
  FROM trade_job_reviews r
  JOIN public.trade_organizations o ON o.id = r.org_id
  WHERE r.token = p_token;
END;
$$;

-- RPC pública: enviar valoración (sin autenticación, validada por token único)
CREATE OR REPLACE FUNCTION submit_job_review(
  p_token      TEXT,
  p_rating     INT,
  p_comentario TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  UPDATE public.trade_job_reviews
  SET
    rating        = p_rating,
    comentario    = p_comentario,
    respondido_at = NOW()
  WHERE token = p_token
    AND respondido_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token no encontrado o ya utilizado';
  END IF;
END;
$$;
;
