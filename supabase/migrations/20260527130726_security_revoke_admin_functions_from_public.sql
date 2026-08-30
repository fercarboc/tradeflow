-- ============================================================
-- MIGRACIÓN: Revocar EXECUTE de funciones admin_ a PUBLIC/anon
-- Rollback: GRANT EXECUTE ON FUNCTION <nombre> TO PUBLIC;
-- Impacto: Cero — AdminView.tsx usa sesión autenticada de admin
-- ============================================================

-- Funciones admin con SECURITY DEFINER — críticas
REVOKE EXECUTE ON FUNCTION public.admin_get_trade_users() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_waitlist_leads() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_platform_invoices() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_abuse_settings() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_global_risk_distribution(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_abuse_settings(uuid, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_abuse_settings(integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_rollback_abuse_settings(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_usage_alert(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_add_usage_alert_note(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_usage_alert_metrics(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_usage_alert_metrics_sla(timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_usage_alerts(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_usage_alert_actions(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_customers(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_events(text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_types(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_customers(text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_exports_v2(text, uuid, date, date, text, text, text, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_export_downloads(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_exports(text, text, date, date, text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_audit_export_download_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_whoami() FROM PUBLIC;

-- Revocar también de authenticated (estas son exclusivamente para el superadmin)
REVOKE EXECUTE ON FUNCTION public.admin_get_trade_users() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_waitlist_leads() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_platform_invoices() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_get_abuse_settings() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_rollback_abuse_settings(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_abuse_settings(uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_abuse_settings(integer, integer, integer, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_resolve_usage_alert(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_add_usage_alert_note(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_audit_exports_v2(text, uuid, date, date, text, text, text, text, integer, integer) FROM authenticated;

-- Volver a conceder SOLO a authenticated (el admin verifica su rol internamente con is_admin())
GRANT EXECUTE ON FUNCTION public.admin_get_trade_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_waitlist_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_abuse_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_global_risk_distribution(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_abuse_settings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_abuse_settings(integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_rollback_abuse_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_usage_alert(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ack_usage_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_add_usage_alert_note(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reopen_usage_alert(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_alert_metrics(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_usage_alert_metrics_sla(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_usage_alerts(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_usage_alert_actions(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_customers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_events(text, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_types(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_customers(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_exports_v2(text, uuid, date, date, text, text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_export_downloads(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_exports(text, text, date, date, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_audit_export_download_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_whoami() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_subscription_active(uuid, boolean) TO authenticated;;
