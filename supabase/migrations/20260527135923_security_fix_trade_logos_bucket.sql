
-- ============================================================
-- MIGRACIÓN: Políticas RLS para bucket trade-logos
-- ============================================================
-- El bucket es público para lectura (CDN directo), pero los uploads
-- deben requerir autenticación y estar limitados a la carpeta del usuario.

-- SELECT: cualquiera puede leer (bucket público, URLs directas de CDN)
CREATE POLICY "trade_logos_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'trade-logos');

-- INSERT: solo authenticated, solo en su propia carpeta ({uid}/*)
CREATE POLICY "trade_logos_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'trade-logos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- UPDATE: solo authenticated, solo su carpeta
CREATE POLICY "trade_logos_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'trade-logos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'trade-logos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- DELETE: solo authenticated, solo su carpeta
CREATE POLICY "trade_logos_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'trade-logos'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
;
