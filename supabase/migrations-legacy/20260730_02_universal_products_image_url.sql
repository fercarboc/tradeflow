-- MVP-2.x: Añade image_url a productos universales + bucket marketplace-universal

ALTER TABLE public.trade_marketplace_universal_products
  ADD COLUMN IF NOT EXISTS image_url text;

-- Bucket público para imágenes de productos universales (solo lectura anon, escritura service)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-universal',
  'marketplace-universal',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública
CREATE POLICY IF NOT EXISTS "marketplace_universal_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketplace-universal');

-- Escritura solo service role (INSERT/UPDATE/DELETE)
CREATE POLICY IF NOT EXISTS "marketplace_universal_service_write"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'marketplace-universal' AND auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "marketplace_universal_service_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'marketplace-universal' AND auth.role() = 'service_role');

CREATE POLICY IF NOT EXISTS "marketplace_universal_service_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'marketplace-universal' AND auth.role() = 'service_role');
