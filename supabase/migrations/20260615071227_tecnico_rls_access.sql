
-- 1. trade_workers: técnicos pueden leer su propio registro (necesario para routeSession en App.tsx)
CREATE POLICY "workers_self_select"
ON trade_workers FOR SELECT TO authenticated
USING (lower(email) = lower(auth.email()));

-- 2. trade_organizations: miembros activos pueden leer la org a la que pertenecen
--    (necesario para loadOrgById en SessionContext)
CREATE POLICY "members_can_read_org"
ON trade_organizations FOR SELECT TO authenticated
USING (
  id IN (
    SELECT org_id FROM trade_org_members
    WHERE user_id = auth.uid() AND activo = true
  )
);

-- 3. trade_jobs: técnicos pueden leer trabajos de la org a la que pertenecen
CREATE POLICY "workers_can_read_org_jobs"
ON trade_jobs FOR SELECT TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM trade_org_members
    WHERE user_id = auth.uid() AND activo = true
  )
);

-- 4. trade_job_workers: técnicos pueden leer las asignaciones de su org
CREATE POLICY "workers_can_read_job_assignments"
ON trade_job_workers FOR SELECT TO authenticated
USING (
  job_id IN (
    SELECT id FROM trade_jobs
    WHERE org_id IN (
      SELECT org_id FROM trade_org_members
      WHERE user_id = auth.uid() AND activo = true
    )
  )
);
;
