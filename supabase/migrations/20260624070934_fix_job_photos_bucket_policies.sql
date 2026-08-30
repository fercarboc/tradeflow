
-- Eliminar políticas demasiado permisivas del bucket trade-job-photos
DROP POLICY IF EXISTS "job photos read" ON storage.objects;
DROP POLICY IF EXISTS "trade_job_photos_authenticated_list" ON storage.objects;
DROP POLICY IF EXISTS "trade_job_photos_block_anon_list" ON storage.objects;
DROP POLICY IF EXISTS "job photos upload" ON storage.objects;

-- Solo usuarios autenticados pueden leer y subir fotos de obras
CREATE POLICY "trade_job_photos_read_auth"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trade-job-photos' AND auth.role() = 'authenticated');

CREATE POLICY "trade_job_photos_insert_auth"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'trade-job-photos' AND auth.role() = 'authenticated');
;
