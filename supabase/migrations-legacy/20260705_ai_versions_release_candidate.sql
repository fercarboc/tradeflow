-- Sprint 4: añadir columna es_release_candidate a trade_ai_versions
ALTER TABLE public.trade_ai_versions
  ADD COLUMN IF NOT EXISTS es_release_candidate boolean NOT NULL DEFAULT false;

-- Marcar v58b_full como RC
UPDATE public.trade_ai_versions
SET es_release_candidate = true
WHERE version_tag = 'v58b_full';

COMMENT ON COLUMN public.trade_ai_versions.es_release_candidate IS
  'Candidato a producción validado. Requiere benchmark 400 + Regression Diff + Smoke Test E2E para promoverse.';
