
-- Columna image_url en productos universales
ALTER TABLE public.trade_marketplace_universal_products
  ADD COLUMN IF NOT EXISTS image_url text;

-- Bucket público para imágenes de productos universales
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'marketplace-universal',
  'marketplace-universal',
  true,
  5242880,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Política: lectura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'marketplace-universal-public-read'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "marketplace-universal-public-read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'marketplace-universal');
    $pol$;
  END IF;
END;
$$;

-- Política: escritura solo con service_role (scripts locales)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'marketplace-universal-service-write'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "marketplace-universal-service-write"
      ON storage.objects FOR ALL
      USING (bucket_id = 'marketplace-universal')
      WITH CHECK (bucket_id = 'marketplace-universal');
    $pol$;
  END IF;
END;
$$;
;
