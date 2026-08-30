-- ============================================================
-- MIGRACIÓN: Convertir catálogos de FOR ALL → solo SELECT público
--
-- apps, plans, sectors son catálogos de referencia de solo lectura.
-- FOR ALL USING(true) permite a cualquier anon INSERT/UPDATE/DELETE.
-- Solución: permitir solo SELECT a public, escritura solo a admin.
--
-- Rollback:
--   DROP POLICY "apps_public_read" ON public.apps; (etc.)
--   CREATE POLICY "Public Access Apps" ON public.apps FOR ALL TO public USING (true);
-- ============================================================

-- ── apps ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Apps" ON public.apps;

CREATE POLICY "apps_public_read"
  ON public.apps FOR SELECT
  TO public
  USING (true);

CREATE POLICY "apps_admin_write"
  ON public.apps FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── plans ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Plans" ON public.plans;

CREATE POLICY "plans_public_read"
  ON public.plans FOR SELECT
  TO public
  USING (true);

CREATE POLICY "plans_admin_write"
  ON public.plans FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── sectors ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Sectors" ON public.sectors;

CREATE POLICY "sectors_public_read"
  ON public.sectors FOR SELECT
  TO public
  USING (true);

CREATE POLICY "sectors_admin_write"
  ON public.sectors FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());;
