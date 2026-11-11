-- ══════════════════════════════════════════════════════════════════════
-- TX-DOCS-2 — Documentos de control RECIBIDOS de terceros
--   DeCA que emite el cargador (mercancías) u hoja de ruta que entrega otra
--   empresa (viajeros, p. ej. colaboraciones). El conductor escanea el QR,
--   fotografía el papel y lo conserva para mostrarlo en un control.
--   Migración puramente aditiva.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.trade_transport_received_docs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  tipo             text        NOT NULL CHECK (tipo IN ('deca','hoja_ruta','otro')),

  -- Lo que trae el QR (normalmente la URL del documento electrónico)
  qr_text          text,
  qr_url           text        CHECK (qr_url IS NULL OR qr_url ~ '^https://'),

  -- Datos de consulta rápida (opcionales)
  emisor_nombre    text,
  numero_documento text,
  fecha_servicio   date,
  matricula        text,
  origen           text,
  destino          text,
  notas            text,

  -- Vínculos operativos opcionales
  trip_id          uuid,
  shipment_id      uuid,
  service_id       uuid,

  -- Copia del PDF descargada del enlace (el del emisor puede caducar)
  pdf_path         text,
  pdf_bytes        int,
  pdf_fetched_at   timestamptz,
  pdf_fetch_error  text,

  -- Fotos del papel: rutas en el bucket transport-received-docs ({org}/{id}/…)
  fotos            text[]      NOT NULL DEFAULT '{}',

  archivado        boolean     NOT NULL DEFAULT false,
  created_by       uuid,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT trd_algo_que_guardar CHECK (qr_text IS NOT NULL OR cardinality(fotos) > 0),
  CONSTRAINT trd_pdf_scoped CHECK (pdf_path IS NULL OR split_part(pdf_path, '/', 1) = org_id::text)
);

CREATE INDEX IF NOT EXISTS idx_trd_org_fecha ON public.trade_transport_received_docs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trd_shipment ON public.trade_transport_received_docs(shipment_id) WHERE shipment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_trd_trip ON public.trade_transport_received_docs(trip_id) WHERE trip_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_trd_updated BEFORE UPDATE ON public.trade_transport_received_docs
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- Fotos solo dentro de la carpeta de la propia org y del propio documento;
-- el PDF solo lo escribe el servidor; created_by automático.
CREATE OR REPLACE FUNCTION public._trd_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE f text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  FOREACH f IN ARRAY NEW.fotos LOOP
    IF split_part(f, '/', 1) <> NEW.org_id::text OR split_part(f, '/', 2) <> NEW.id::text THEN
      RAISE EXCEPTION 'TRD_FOTO_RUTA: ruta de foto no válida';
    END IF;
  END LOOP;
  -- Los campos del PDF solo los toca el servidor (service_role, sin auth.uid())
  IF auth.uid() IS NOT NULL THEN
    IF TG_OP = 'INSERT' THEN
      NEW.pdf_path := NULL; NEW.pdf_bytes := NULL; NEW.pdf_fetched_at := NULL; NEW.pdf_fetch_error := NULL;
    ELSE
      NEW.pdf_path := OLD.pdf_path; NEW.pdf_bytes := OLD.pdf_bytes;
      NEW.pdf_fetched_at := OLD.pdf_fetched_at; NEW.pdf_fetch_error := OLD.pdf_fetch_error;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_trd_before_write ON public.trade_transport_received_docs;
CREATE TRIGGER trg_trd_before_write BEFORE INSERT OR UPDATE ON public.trade_transport_received_docs
  FOR EACH ROW EXECUTE FUNCTION public._trd_before_write();

-- RLS: miembros activos de la org (el conductor los guarda y consulta)
ALTER TABLE public.trade_transport_received_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trd_select" ON public.trade_transport_received_docs;
CREATE POLICY "trd_select" ON public.trade_transport_received_docs FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()) OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "trd_insert" ON public.trade_transport_received_docs;
CREATE POLICY "trd_insert" ON public.trade_transport_received_docs FOR INSERT TO authenticated
  WITH CHECK (
    (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
     OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
    AND EXISTS (SELECT 1 FROM public.trade_organizations o WHERE o.id = org_id AND o.transport_enabled)
  );

DROP POLICY IF EXISTS "trd_update" ON public.trade_transport_received_docs;
CREATE POLICY "trd_update" ON public.trade_transport_received_docs FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
         OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
         OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

-- Borrado solo para corregir errores el mismo día y por quien lo creó;
-- después se archiva (conservación ≥ 1 año del transportista).
DROP POLICY IF EXISTS "trd_delete" ON public.trade_transport_received_docs;
CREATE POLICY "trd_delete" ON public.trade_transport_received_docs FOR DELETE TO authenticated
  USING (created_by = auth.uid() AND created_at > now() - interval '24 hours');

-- Bucket privado para fotos y copias PDF
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transport-received-docs', 'transport-received-docs', false, 10485760,
        ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "transport_received_docs_read" ON storage.objects;
CREATE POLICY "transport_received_docs_read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transport-received-docs'
  AND ((storage.foldername(name))[1] IN (SELECT unnest(public._user_org_ids())::text)
       OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()))
);

DROP POLICY IF EXISTS "transport_received_docs_insert" ON storage.objects;
CREATE POLICY "transport_received_docs_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'transport-received-docs'
  AND (storage.foldername(name))[3] IS NULL                     -- {org}/{doc}/{fichero}
  AND ((storage.foldername(name))[1] IN (SELECT org_id::text FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
       OR (storage.foldername(name))[1] IN (SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()))
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);
-- Sin UPDATE/DELETE en el bucket para usuarios: el PDF lo sube el servidor.
