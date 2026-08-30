
-- ================================================
-- PASO 3: TABLAS ADICIONALES SIN RLS
-- Detectadas en verificación post-migración
-- ================================================

-- Activar RLS
ALTER TABLE public.debacu_adr_reference_by_category     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_admins                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_hotel_profile            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_eval_import_guest_index_bak   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_evaluations_backup_20260207   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_evaluations_backup_20260209   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_hotel_incident_custom         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_hotel_incident_pricing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_hotel_profile                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debacu_platform_map                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist_reservations               ENABLE ROW LEVEL SECURITY;

-- Políticas

-- debacu_adr_reference_by_category: tabla de referencia global, lectura para autenticados
CREATE POLICY "auth_read_adr_reference"
  ON public.debacu_adr_reference_by_category
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- debacu_eval_admins: solo admins pueden verse a sí mismos
CREATE POLICY "admin_read_self"
  ON public.debacu_eval_admins
  FOR SELECT
  USING (user_id = auth.uid());

-- debacu_eval_hotel_profile: por org_id
CREATE POLICY "org_select_hotel_profile"
  ON public.debacu_eval_hotel_profile
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));

CREATE POLICY "org_update_hotel_profile"
  ON public.debacu_eval_hotel_profile
  FOR UPDATE
  USING (public.debacu_eval_is_org_member(org_id))
  WITH CHECK (public.debacu_eval_is_org_member(org_id));

-- debacu_eval_import_guest_index_bak: backup, solo admin
CREATE POLICY "admin_select_import_guest_index_bak"
  ON public.debacu_eval_import_guest_index_bak
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_evaluations_backup_20260207: backup histórico, solo admin
CREATE POLICY "admin_select_evaluations_bak_0207"
  ON public.debacu_evaluations_backup_20260207
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_evaluations_backup_20260209: backup histórico, solo admin
CREATE POLICY "admin_select_evaluations_bak_0209"
  ON public.debacu_evaluations_backup_20260209
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_hotel_incident_custom: por customer_id (sistema legacy)
-- Solo admin hasta migrar a nuevo sistema
CREATE POLICY "admin_select_hotel_incident_custom"
  ON public.debacu_hotel_incident_custom
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_hotel_incident_pricing: por customer_id (sistema legacy)
CREATE POLICY "admin_select_hotel_incident_pricing"
  ON public.debacu_hotel_incident_pricing
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_hotel_profile: tabla legacy sin org_id → solo admin
CREATE POLICY "admin_select_hotel_profile_legacy"
  ON public.debacu_hotel_profile
  FOR SELECT
  USING (public.is_debacu_admin());

-- debacu_platform_map: catálogo interno, lectura para autenticados
CREATE POLICY "auth_read_platform_map"
  ON public.debacu_platform_map
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- watchlist_reservations: por org_id
CREATE POLICY "org_select_watchlist_reservations"
  ON public.watchlist_reservations
  FOR SELECT
  USING (public.debacu_eval_is_org_member(org_id));
;
