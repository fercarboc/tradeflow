-- ============================================================
-- MIGRACIÓN: Proteger users y company_banks
--
-- users: tabla con id TEXT + pin TEXT — usuarios de app de hotel
--   can_access_app() usa SECURITY DEFINER → sigue funcionando con RLS bloqueado
--   No hay motivo para que clientes accedan directamente a esta tabla
--
-- company_banks: datos bancarios — solo admin
--
-- Rollback:
--   DROP POLICY "users_service_role_only" ON public.users;
--   CREATE POLICY "Public Access Users" ON public.users FOR ALL TO public USING (true);
--   DROP POLICY "company_banks_admin_only" ON public.company_banks;
--   CREATE POLICY "Allow all on company_banks" ON public.company_banks FOR ALL TO public USING (true) WITH CHECK (true);
-- ============================================================

-- ── users ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public Access Users" ON public.users;

-- Solo service_role accede directamente (para can_access_app SECURITY DEFINER y edge functions)
-- El rol authenticated puede necesitar SELECT para el panel admin — se añade vía is_admin()
CREATE POLICY "users_read_admin"
  ON public.users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "users_write_admin"
  ON public.users FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── company_banks ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all on company_banks" ON public.company_banks;

CREATE POLICY "company_banks_admin_only"
  ON public.company_banks FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());;
