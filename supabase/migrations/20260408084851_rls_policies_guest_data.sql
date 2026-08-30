
-- ================================================
-- PASO 2A: POLÍTICAS — TABLAS DE HUÉSPEDES / IDENTIDADES
-- Estas tablas NO tienen org_id directo, son globales
-- Solo accesibles desde service_role (Edge Functions)
-- ================================================

-- debacu_eval_guest_index: tabla global (identity_key, risk_band...)
-- No tiene org_id → solo service_role puede leer/escribir
-- Los usuarios acceden SIEMPRE a través de Edge Functions
-- No creamos policy SELECT → acceso denegado para anon/authenticated via PostgREST

-- debacu_eval_guest_index_bak_20260314: backup, solo admin
CREATE POLICY "admin_only_select_guest_index_bak"
  ON public.debacu_eval_guest_index_bak_20260314
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_identity_links: tabla global (identity_key_a, identity_key_b)
-- No tiene org_id → solo service_role
-- No creamos policy SELECT → bloqueado para clientes

-- debacu_eval_identity_risk_state: tabla global (identity_key)
-- No tiene org_id → solo service_role
-- No creamos policy SELECT → bloqueado para clientes

-- spain_hotels_master: catálogo público de referencia → lectura libre
CREATE POLICY "public_read_spain_hotels_master"
  ON public.spain_hotels_master
  FOR SELECT
  USING (true);

-- public_contact_requests: INSERT público (formulario web), solo admin puede leer
CREATE POLICY "public_insert_contact_requests"
  ON public.public_contact_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "admin_select_contact_requests"
  ON public.public_contact_requests
  FOR SELECT
  USING (public.is_debacu_admin());
;
