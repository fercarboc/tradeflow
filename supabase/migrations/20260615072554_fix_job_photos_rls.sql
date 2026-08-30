
-- Eliminar políticas rotas (usaban trade_workers.id = auth.uid() que es incorrecto)
DROP POLICY IF EXISTS "org members insert job photos" ON trade_job_photos;
DROP POLICY IF EXISTS "org members view job photos" ON trade_job_photos;
DROP POLICY IF EXISTS "org members delete own photos" ON trade_job_photos;

-- SELECT: owner o miembro activo de la org
CREATE POLICY "photos_select"
ON trade_job_photos FOR SELECT TO authenticated
USING (
  org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
  OR
  org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true)
);

-- INSERT: owner o miembro activo de la org
CREATE POLICY "photos_insert"
ON trade_job_photos FOR INSERT TO authenticated
WITH CHECK (
  org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
  OR
  org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true)
);

-- DELETE: quien subió la foto (auth.uid) o el owner de la org
CREATE POLICY "photos_delete"
ON trade_job_photos FOR DELETE TO authenticated
USING (
  uploaded_by_worker_id = auth.uid()
  OR
  org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid())
);
;
