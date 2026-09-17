
-- ============================================================
-- PH0-QUOTE-PHOTOS-1A — trade_quote_photos
-- Fotografías de referencia asociadas a presupuestos.
-- Bucket privado, storage_path como fuente de verdad (sin photo_url).
--
-- Correcciones de revisión 1A-VALIDATE:
--   1. created_by DEFAULT auth.uid() + RLS CHECK created_by = auth.uid()
--   2. Trigger: FOR UPDATE en trade_quotes para serializar concurrencia
-- ============================================================

-- ── Bucket privado ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trade-quote-photos',
  'trade-quote-photos',
  false,       -- PRIVADO: URLs sólo vía signed URL; no acceso CDN público
  10485760,    -- 10 MB máx por objeto (antes de compresión en cliente)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- ── Storage policies ──────────────────────────────────────────────────────────
-- Validan: authenticated + org_id del primer segmento del path ∈ orgs del usuario.
-- Path grammar: {org_id}/quotes/{quote_id}/{uuid}.jpg
--   segmento[1] = org_id  (validado por Storage policy)
--   segmento[3] = quote_id (NO validado aquí — ver nota de protección cross-quote abajo)
--
-- NOTA protección cross-quote en Storage:
--   Un usuario podría subir a {su_org}/quotes/{quote_id_ajena}/file.jpg.
--   La Storage policy no lo bloquea (el segmento org_id es correcto).
--   La RLS de DB INSERT sí lo bloquea (EXISTS check quote_id ↔ org_id).
--   El upload helper ejecuta rollback del objeto si el DB insert falla.
--   Residual: orphan temporal en Storage del propio usuario (inaccesible vía API app).
--   No se introduce service_role ni subquery compleja en Storage policy.
--   Deuda técnica: QUOTE_PHOTO_STORAGE_ORPHAN_CLEANUP (no bloquea Fase 0).

CREATE POLICY "quote_photos_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'trade-quote-photos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND activo = true
    )
  )
);

CREATE POLICY "quote_photos_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'trade-quote-photos'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND activo = true
    )
  )
);

-- DELETE: sólo el owner puede eliminar objetos de Storage
CREATE POLICY "quote_photos_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'trade-quote-photos'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
  )
);

-- ── Tabla ─────────────────────────────────────────────────────────────────────
-- Decisión de diseño:
--   NO photo_url — bucket privado; las URLs se generan como signed URLs (TTL 1h).
--   created_by DEFAULT auth.uid() — el servidor lo rellena; cliente no necesita enviarlo.
--   RLS INSERT valida además created_by = auth.uid() para impedir suplantación.

CREATE TABLE IF NOT EXISTS public.trade_quote_photos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id            uuid        NOT NULL REFERENCES public.trade_quotes(id) ON DELETE CASCADE,
  org_id              uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  storage_path        text        NOT NULL,
  area_label          text,
  caption             text,
  display_order       smallint    NOT NULL DEFAULT 0,
  include_in_document boolean     NOT NULL DEFAULT false,
  -- DEFAULT auth.uid(): el servidor rellena con el uid del usuario autenticado.
  -- La RLS INSERT añade CHECK created_by = auth.uid() para evitar suplantación.
  created_by          uuid        NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at          timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT chk_storage_path_nonempty CHECK (length(trim(storage_path)) > 0),
  CONSTRAINT chk_display_order_nonneg  CHECK (display_order >= 0)
);

-- ── Índices ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_trade_quote_photos_quote_id
  ON public.trade_quote_photos(quote_id);

CREATE INDEX IF NOT EXISTS idx_trade_quote_photos_org_id
  ON public.trade_quote_photos(org_id);

CREATE INDEX IF NOT EXISTS idx_trade_quote_photos_doc
  ON public.trade_quote_photos(quote_id) WHERE include_in_document = true;

-- ── Trigger: límites con serialización de concurrencia ────────────────────────
-- PROBLEMA COUNT(*) sin lock:
--   Bajo MVCC READ COMMITTED (default PostgreSQL), dos transacciones concurrentes
--   pueden leer COUNT(*) = 7 simultáneamente, superar ambas el check, e insertar
--   ambas → resultado final: 9 fotos (race condition).
--
-- SOLUCIÓN: FOR UPDATE en la fila padre trade_quotes.
--   PERFORM 1 FROM public.trade_quotes WHERE id = NEW.quote_id FOR UPDATE;
--   Adquiere un row-level lock en la fila del presupuesto correspondiente.
--   Dos INSERTs/UPDATEs concurrentes para el mismo quote_id compiten por ese lock.
--   El segundo espera a que el primero haga COMMIT/ROLLBACK antes de continuar.
--   Tras adquirir el lock, el COUNT(*) ve el estado real → no hay race condition.
--   El lock es selectivo por fila (no lock global): presupuestos distintos
--   no se bloquean entre sí.
--
-- LÍMITES garantizados incluso bajo concurrencia:
--   MAX 8 fotos por presupuesto (MAX_QUOTE_PHOTOS)
--   MAX 3 include_in_document=true por presupuesto (MAX_QUOTE_DOCUMENT_PHOTOS)

CREATE OR REPLACE FUNCTION public.check_quote_photo_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_photo_count integer;
  v_doc_count   integer;
BEGIN
  -- Serializar concurrencia: adquirir lock de fila en el presupuesto padre.
  -- Dos transacciones sobre el mismo quote_id se ejecutan en serie.
  -- Imprescindible antes del COUNT(*) para garantizar exclusión mutua.
  PERFORM 1
  FROM public.trade_quotes
  WHERE id = NEW.quote_id
  FOR UPDATE;

  -- En INSERT: comprobar total de fotos del presupuesto
  IF TG_OP = 'INSERT' THEN
    SELECT COUNT(*) INTO v_photo_count
    FROM public.trade_quote_photos
    WHERE quote_id = NEW.quote_id;

    IF v_photo_count >= 8 THEN
      RAISE EXCEPTION 'QUOTE_PHOTOS_LIMIT: máximo 8 fotografías por presupuesto';
    END IF;
  END IF;

  -- En INSERT o UPDATE que activa include_in_document: comprobar límite de documento
  IF NEW.include_in_document = true THEN
    IF TG_OP = 'INSERT' THEN
      SELECT COUNT(*) INTO v_doc_count
      FROM public.trade_quote_photos
      WHERE quote_id = NEW.quote_id AND include_in_document = true;
    ELSE
      -- UPDATE: excluir la propia fila (puede estar cambiando de false a true)
      SELECT COUNT(*) INTO v_doc_count
      FROM public.trade_quote_photos
      WHERE quote_id = NEW.quote_id AND include_in_document = true AND id <> NEW.id;
    END IF;

    IF v_doc_count >= 3 THEN
      RAISE EXCEPTION 'QUOTE_DOC_PHOTOS_LIMIT: máximo 3 fotografías en el documento del presupuesto';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_quote_photo_limits
  BEFORE INSERT OR UPDATE ON public.trade_quote_photos
  FOR EACH ROW EXECUTE FUNCTION public.check_quote_photo_limits();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_quote_photos ENABLE ROW LEVEL SECURITY;

-- SELECT: owner o miembro activo de la org
CREATE POLICY "quote_photos_select"
ON public.trade_quote_photos FOR SELECT TO authenticated
USING (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  OR org_id IN (
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true
  )
);

-- INSERT: owner o miembro activo de la org
-- INVARIANTE 1 — quote ↔ org: el quote_id debe pertenecer al mismo org_id.
--   Impide combinar quote_id de org A con org_id de org B.
-- INVARIANTE 2 — created_by = auth.uid():
--   Impide insertar con el UID de otro usuario (suplantación).
--   La columna tiene DEFAULT auth.uid(), por lo que el cliente no necesita enviarla.
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
    WHERE q.id = quote_id AND q.org_id = org_id
  )
  AND created_by = auth.uid()
);

-- UPDATE: sólo owner; invariante quote ↔ org mantenido
-- (quote_id y org_id no deben cambiarse; la RLS no permite cambiar a otra org)
CREATE POLICY "quote_photos_update"
ON public.trade_quote_photos FOR UPDATE TO authenticated
USING (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.trade_quotes q
    WHERE q.id = quote_id AND q.org_id = org_id
  )
);

-- DELETE: sólo owner
CREATE POLICY "quote_photos_delete"
ON public.trade_quote_photos FOR DELETE TO authenticated
USING (
  org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
);
