
-- ============================================================
-- PH0-QUOTE-PHOTOS-1A PATCH — fix RLS quote↔org invariant
--
-- BUG ENCONTRADO en verificación post-deploy:
--   En las políticas quote_photos_insert y quote_photos_update, la cláusula EXISTS
--   usaba `org_id` sin cualificar dentro de la subquery sobre trade_quotes.
--   PostgreSQL resolvió `org_id` al alias de la subquery (q.org_id) en lugar de
--   al contexto externo (trade_quote_photos.org_id), produciendo:
--     q.org_id = q.org_id  ← siempre verdadero
--   En lugar de:
--     q.org_id = trade_quote_photos.org_id  ← la verificación correcta
--
--   Consecuencia: un usuario con acceso a dos orgs podría insertar una foto
--   con quote_id de org A y org_id de org B (invariante quote↔org roto).
--   El helper de upload ejecuta rollback si el INSERT DB falla, pero la RLS
--   corrupta NO fallaba, por lo que el rollback no se activaba.
--
-- FIX: calificar explícitamente las columnas externas en la subquery EXISTS.
-- ============================================================

-- INSERT policy
DROP POLICY IF EXISTS "quote_photos_insert" ON public.trade_quote_photos;

CREATE POLICY "quote_photos_insert"
ON public.trade_quote_photos FOR INSERT TO authenticated
WITH CHECK (
  (
    org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
    OR org_id IN (
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  )
  AND EXISTS (
    SELECT 1 FROM public.trade_quotes q
    WHERE q.id = trade_quote_photos.quote_id
      AND q.org_id = trade_quote_photos.org_id
  )
  AND created_by = auth.uid()
);

-- UPDATE policy
DROP POLICY IF EXISTS "quote_photos_update" ON public.trade_quote_photos;

CREATE POLICY "quote_photos_update"
ON public.trade_quote_photos FOR UPDATE TO authenticated
USING (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.trade_quotes q
    WHERE q.id = trade_quote_photos.quote_id
      AND q.org_id = trade_quote_photos.org_id
  )
);
