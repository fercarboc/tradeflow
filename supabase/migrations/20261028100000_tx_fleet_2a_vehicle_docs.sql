
-- ============================================================
-- TX-FLEET-2A — Ficha documental de vehículos
-- Adds ITV/seguro fields to trade_vehicles, creates
-- trade_vehicle_docs table, and vehicle-docs private bucket.
-- NON-DESTRUCTIVE: all new columns are nullable.
-- ============================================================

-- ── Campos de ITV y seguro en trade_vehicles ─────────────────────────────────

ALTER TABLE public.trade_vehicles
  ADD COLUMN IF NOT EXISTS itv_fecha_ultima      date,
  ADD COLUMN IF NOT EXISTS itv_fecha_vencimiento date,
  ADD COLUMN IF NOT EXISTS seguro_compania       text,
  ADD COLUMN IF NOT EXISTS seguro_referencia     text,
  ADD COLUMN IF NOT EXISTS seguro_vencimiento    date;

-- ── Tabla trade_vehicle_docs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_vehicle_docs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid        NOT NULL,
  vehicle_id       uuid        NOT NULL,
  tipo             text        NOT NULL CHECK (tipo IN (
    'itv',
    'seguro',
    'permiso_circulacion',
    'autorizacion_vvc',
    'autorizacion_mdp',
    'autorizacion_vde',
    'autorizacion_tpc',
    'certificado_tacografo',
    'otro'
  )),
  titulo           text        NOT NULL CHECK (char_length(titulo) BETWEEN 1 AND 120),
  descripcion      text,
  fecha_doc        date,
  fecha_vencimiento date,
  storage_path     text,
  created_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tvd_vehicle_fk FOREIGN KEY (org_id, vehicle_id)
    REFERENCES public.trade_vehicles(org_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tvd_vehicle
  ON public.trade_vehicle_docs (org_id, vehicle_id);

CREATE INDEX IF NOT EXISTS idx_tvd_vencimiento
  ON public.trade_vehicle_docs (org_id, fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;

ALTER TABLE public.trade_vehicle_docs ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los miembros de la org
CREATE POLICY "tvd_select" ON public.trade_vehicle_docs
  FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()));

-- INSERT: solo owner/admin
CREATE POLICY "tvd_insert" ON public.trade_vehicle_docs
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id IN (
      SELECT id    FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  );

-- UPDATE: solo owner/admin
CREATE POLICY "tvd_update" ON public.trade_vehicle_docs
  FOR UPDATE TO authenticated
  USING (
    org_id IN (
      SELECT id    FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id    FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  );

-- DELETE: solo owner/admin
CREATE POLICY "tvd_delete" ON public.trade_vehicle_docs
  FOR DELETE TO authenticated
  USING (
    org_id IN (
      SELECT id    FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  );

-- ── Bucket privado vehicle-docs ───────────────────────────────────────────────
-- Path: {org_id}/{vehicle_id}/{filename}
-- Private: URLs sólo vía signed URL — sin acceso CDN público.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vehicle-docs',
  'vehicle-docs',
  false,
  20971520,  -- 20 MB por objeto
  ARRAY[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- SELECT: todos los miembros de la org (para descargar / ver documentos)
CREATE POLICY "vehicle_docs_storage_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'vehicle-docs'
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

-- INSERT: solo owner/admin (para subir documentos)
CREATE POLICY "vehicle_docs_storage_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'vehicle-docs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
);

-- UPDATE: solo owner/admin
CREATE POLICY "vehicle_docs_storage_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'vehicle-docs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
);

-- DELETE: solo owner/admin
CREATE POLICY "vehicle_docs_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'vehicle-docs'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
    OR (storage.foldername(name))[1] IN (
      SELECT org_id::text FROM public.trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner', 'admin') AND activo = true
    )
  )
);
