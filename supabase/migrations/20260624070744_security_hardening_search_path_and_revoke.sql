
-- ── 1. Fix search_path mutable en todas las funciones afectadas ───
ALTER FUNCTION public._user_admin_org_ids() SET search_path = '';
ALTER FUNCTION public._user_org_ids() SET search_path = '';
ALTER FUNCTION public.apply_referral_code(text) SET search_path = '';
ALTER FUNCTION public.apply_scheduled_plan_if_due(uuid) SET search_path = '';
ALTER FUNCTION public.auto_update_churn_risk() SET search_path = '';
ALTER FUNCTION public.check_email_for_registration(text) SET search_path = '';
ALTER FUNCTION public.cron_invoice_overdue_check() SET search_path = '';
ALTER FUNCTION public.generate_referral_code() SET search_path = '';
ALTER FUNCTION public.generate_subcontrata_numero() SET search_path = '';
ALTER FUNCTION public.hybrid_search_norm_chunks(vector, text, integer, text[], text) SET search_path = '';
ALTER FUNCTION public.import_from_global_catalog(uuid, text[], text[]) SET search_path = '';
ALTER FUNCTION public.increment_actuacion_usage(text[]) SET search_path = '';
ALTER FUNCTION public.increment_rag_rate_limit(uuid, date) SET search_path = '';
ALTER FUNCTION public.insert_actuacion_learned(text, text, text[], text[], text) SET search_path = '';
ALTER FUNCTION public.search_actuaciones_scored(text, integer) SET search_path = '';
ALTER FUNCTION public.search_supplier_products(text, uuid, integer) SET search_path = '';
ALTER FUNCTION public.trg_fn_assign_referral_code() SET search_path = '';
ALTER FUNCTION public.update_actuacion_learned(text, text[], text[]) SET search_path = '';
ALTER FUNCTION public.update_supplier_search_vector() SET search_path = '';
ALTER FUNCTION public.debacu_doc_key(text) SET search_path = '';

-- ── 2. REVOKE anon EXECUTE en funciones que no necesitan acceso sin sesión ──
REVOKE EXECUTE ON FUNCTION public._user_admin_org_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public._user_org_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_scheduled_plan_if_due(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_update_churn_risk() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cron_invoice_overdue_check() FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_from_global_catalog(uuid, text[], text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_actuacion_learned(text, text[], text[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_actuacion_learned(text, text, text[], text[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_referral_code(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.debacu_doc_key(text) FROM anon;

-- check_email_for_registration se MANTIENE con acceso anon (necesario para el formulario de registro)

-- ── 3. trade_norm_conflicts — activar RLS ────────────────────────
ALTER TABLE public.trade_norm_conflicts ENABLE ROW LEVEL SECURITY;
;
