
-- ================================================
-- FIX search_path MUTABLE — BATCH 1
-- ALTER FUNCTION ... SET search_path = public
-- No cambia lógica ni firmas, solo añade el config
-- ================================================

-- Triggers de updated_at (simples)
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.trigger_set_updated_at() SET search_path = public;
ALTER FUNCTION public.debacu_set_updated_at() SET search_path = public;
ALTER FUNCTION public.debacu_eval_set_updated_at() SET search_path = public;
ALTER FUNCTION public.debacu_eval_touch_updated_at() SET search_path = public;
ALTER FUNCTION public.set_company_profile_updated_at() SET search_path = public;
ALTER FUNCTION public.set_debacu_eval_room_prices_updated_at() SET search_path = public;
ALTER FUNCTION public.update_spain_hotels_updated_at() SET search_path = public;
ALTER FUNCTION public.update_risk_alerts_updated_at() SET search_path = public;
ALTER FUNCTION public.update_property_profile_updated_at() SET search_path = public;
ALTER FUNCTION public.update_property_item_catalog_updated_at() SET search_path = public;

-- Triggers de validación
ALTER FUNCTION public.debacu_check_property_org_match() SET search_path = public;
ALTER FUNCTION public.debacu_eval_org_member_profiles_enforce_org() SET search_path = public;
ALTER FUNCTION public.debacu_eval_room_prices_validate_room_type_property() SET search_path = public;
ALTER FUNCTION public.debacu_eval_room_prices_validate_refs() SET search_path = public;
ALTER FUNCTION public.tg_abuse_settings_updated() SET search_path = public;
ALTER FUNCTION public.tg_audit_abuse_settings() SET search_path = public;

-- Funciones de identidad / hashing (SECURITY DEFINER)
ALTER FUNCTION public.debacu_hmac_hex(text) SET search_path = public;
ALTER FUNCTION public.debacu_doc_key(text) SET search_path = public;
ALTER FUNCTION public.debacu_email_key(text) SET search_path = public;
ALTER FUNCTION public.debacu_phone_key(text) SET search_path = public;
ALTER FUNCTION public.debacu_get_pepper() SET search_path = public;
ALTER FUNCTION public.get_debacu_pepper() SET search_path = public;

-- Funciones de compute/identity key (dos versiones)
ALTER FUNCTION public.debacu_eval_compute_identity_key(text) SET search_path = public;
ALTER FUNCTION public.debacu_eval_compute_identity_key(text, text) SET search_path = public;

-- Funciones de miembros/admin
ALTER FUNCTION public.is_debacu_admin() SET search_path = public;
ALTER FUNCTION public.debacu_is_org_member(uuid) SET search_path = public;
ALTER FUNCTION public.debacu_eval_is_org_member(uuid) SET search_path = public;

-- Funciones inmutables/utilitarias
ALTER FUNCTION public.debacu_eval_match_strength(text) SET search_path = public;
ALTER FUNCTION public.debacu_eval_count_bucket(integer) SET search_path = public;
ALTER FUNCTION public.global_risk_snapshot() SET search_path = public;
ALTER FUNCTION public.increment_evaluation_count() SET search_path = public;
ALTER FUNCTION public.debug_audit_exports_count_system() SET search_path = public;
;
