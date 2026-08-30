-- E4.A.1 Storage: restringir ads/ a admin únicamente.
-- El bucket marketplace-offerings está vacío → seguro redefinir sin romper uploads existentes.
-- SELECT permanece público para delivery de imágenes publicadas.

-- 1. Eliminar políticas write demasiado amplias
DROP POLICY IF EXISTS mkt_off_img_insert ON storage.objects;
DROP POLICY IF EXISTS mkt_off_img_update ON storage.objects;
DROP POLICY IF EXISTS mkt_off_img_delete ON storage.objects;

-- 2. INSERT ads/ → solo platform admin
CREATE POLICY mkt_off_ads_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'marketplace-offerings'
    AND name LIKE 'ads/%'
    AND public._mkt_is_platform_admin()
  );

-- 3. UPDATE ads/ → solo platform admin
CREATE POLICY mkt_off_ads_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'marketplace-offerings'
    AND name LIKE 'ads/%'
    AND public._mkt_is_platform_admin()
  )
  WITH CHECK (
    bucket_id = 'marketplace-offerings'
    AND name LIKE 'ads/%'
    AND public._mkt_is_platform_admin()
  );

-- 4. DELETE ads/ → solo platform admin
CREATE POLICY mkt_off_ads_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'marketplace-offerings'
    AND name LIKE 'ads/%'
    AND public._mkt_is_platform_admin()
  );

-- 5. Post-verificación: las 4 políticas esperadas están presentes
DO $$
DECLARE v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname IN (
      'mkt_off_img_select',
      'mkt_off_ads_insert',
      'mkt_off_ads_update',
      'mkt_off_ads_delete'
    );
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'E4A-M4: solo % de 4 políticas marketplace-offerings presentes', v_count;
  END IF;
END $$;
