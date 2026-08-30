-- ============================================================
-- MIGRACIÓN: Revocar funciones peligrosas no-admin de PUBLIC
-- ============================================================

-- can_access_app — función de autenticación invocable por anon (brute force)
REVOKE EXECUTE ON FUNCTION public.can_access_app(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_app(text, text, text) TO authenticated;

-- seed_org_catalog — SECURITY DEFINER, cualquier anon podría sembrar catálogo
REVOKE EXECUTE ON FUNCTION public.seed_org_catalog(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_org_catalog(uuid) TO authenticated;

-- debug_audit_exports_count_system — función debug en producción, SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.debug_audit_exports_count_system() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debug_audit_exports_count_system() FROM authenticated;
-- No se re-concede: es función de debug, no debe estar disponible en producción

-- get_debacu_pepper — devuelve clave HMAC a usuarios autenticados (riesgo alto)
-- Se mantiene para authenticated ya que puede ser necesaria internamente
-- pero se revoca de PUBLIC (anon)
-- (ya tenía solo authenticated, no hay PUBLIC para esta, verificado)

-- debacu_sync_guest_index_from_eval — SECURITY DEFINER, manipulación masiva de datos
REVOKE EXECUTE ON FUNCTION public.debacu_sync_guest_index_from_eval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debacu_sync_guest_index_from_eval() TO authenticated;

-- debacu_eval_guest_index_upsert — SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.debacu_eval_guest_index_upsert(text, text, text, text, date, date, integer, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debacu_eval_guest_index_upsert(text, text, text, text, date, date, integer, numeric, integer) TO authenticated;

-- debacu_eval_check_signals — SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.debacu_eval_check_signals(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debacu_eval_check_signals(text, integer, integer) TO authenticated;

-- Funciones de backfill — operaciones de datos masivas, no deben ser públicas
REVOKE EXECUTE ON FUNCTION public.debacu_backfill_identity_links_doc(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_backfill_links_doc(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_backfill_links_email(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_backfill_links_phone(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.debacu_build_identity_links(text) FROM PUBLIC;

-- debacu_get_pepper — expone la función de lectura de pepper (aunque no SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.debacu_get_pepper() FROM PUBLIC;

-- global_risk_snapshot — datos agregados de riesgo, no debe ser público
REVOKE EXECUTE ON FUNCTION public.global_risk_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.global_risk_snapshot() TO authenticated;

-- admin_get_usage_alert — no tiene SECURITY DEFINER pero devuelve datos internos
REVOKE EXECUTE ON FUNCTION public.admin_get_usage_alert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_usage_alert(uuid) TO authenticated;;
