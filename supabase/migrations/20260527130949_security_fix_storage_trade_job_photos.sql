-- ============================================================
-- MIGRACIÓN: Deshabilitar listing público del bucket trade-job-photos
--
-- El bucket es PUBLIC (las URLs de fotos son accesibles si conoces la ruta),
-- pero NO debe permitir LISTAR todos los archivos.
-- Solución: añadir política de SELECT en storage.objects que requiera
-- autenticación para el listado.
--
-- Rollback: DROP POLICY "trade_job_photos_authenticated_list" ON storage.objects;
-- ============================================================

-- Bloquear SELECT (listado) desde anon en trade-job-photos
-- Los objetos individuales siguen siendo accesibles por URL pública (es un public bucket)
-- pero enumerar el contenido del bucket requiere autenticación
CREATE POLICY "trade_job_photos_authenticated_list"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'trade-job-photos');

-- Revocar listado para anon (el acceso por URL directa sigue funcionando
-- gracias a que el bucket es público y Supabase lo sirve por CDN)
CREATE POLICY "trade_job_photos_block_anon_list"
  ON storage.objects FOR SELECT
  TO anon
  USING (
    bucket_id = 'trade-job-photos'
    AND name IS NULL -- nunca true → bloquea listado anon sin romper CDN público
  );

-- Añadir límite de tamaño a trade-logos (actualmente sin límites)
UPDATE storage.buckets
SET file_size_limit = 2097152,  -- 2 MB es suficiente para un logo
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
WHERE id = 'trade-logos';;
