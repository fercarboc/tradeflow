
-- ================================================
-- FIX search_path MUTABLE — BATCH 2
-- Funciones de lógica de negocio
-- ================================================

-- Guest index
ALTER FUNCTION public.debacu_eval_guest_index_upsert(text, text, text, text, date, date, integer, numeric, integer) SET search_path = public;
ALTER FUNCTION public.debacu_eval_upsert_guest_index_from_incident(text, date, numeric, numeric, numeric) SET search_path = public;
ALTER FUNCTION public.debacu_eval_upsert_guest_index_from_stay(text, date) SET search_path = public;
ALTER FUNCTION public.debacu_eval_upsert_guest_index_from_stay(text, date, boolean) SET search_path = public;
ALTER FUNCTION public.debacu_eval_upsert_guest_index_from_visit(text, date) SET search_path = public;
ALTER FUNCTION public.debacu_eval_recompute_risk_bands() SET search_path = public;
ALTER FUNCTION public.debacu_eval_after_insert_incident() SET search_path = public;
ALTER FUNCTION public.debacu_eval_after_upsert_incident() SET search_path = public;
ALTER FUNCTION public.debacu_sync_guest_index_from_eval() SET search_path = public;

-- Identity links
ALTER FUNCTION public.debacu_build_identity_links(text) SET search_path = public;
ALTER FUNCTION public.trg_build_identity_links() SET search_path = public;
ALTER FUNCTION public.debacu_backfill_identity_links_doc(integer) SET search_path = public;
ALTER FUNCTION public.debacu_backfill_links_doc(integer) SET search_path = public;
ALTER FUNCTION public.debacu_backfill_links_email(integer) SET search_path = public;
ALTER FUNCTION public.debacu_backfill_links_phone(integer) SET search_path = public;

-- Subscriptions
ALTER FUNCTION public.activate_pending_subscription(uuid, text, text, text, timestamptz, timestamptz) SET search_path = public;

-- Invoices
ALTER FUNCTION public.list_debacu_eval_invoices(text, text, integer, integer) SET search_path = public;

-- Usage alerts — admin (dos versiones de ack y reopen)
ALTER FUNCTION public.admin_ack_usage_alert(uuid, text) SET search_path = public;
ALTER FUNCTION public.admin_ack_usage_alert(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.admin_reopen_usage_alert(uuid, text) SET search_path = public;
ALTER FUNCTION public.admin_reopen_usage_alert(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.admin_resolve_usage_alert(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.admin_get_usage_alert(uuid) SET search_path = public;
ALTER FUNCTION public.admin_list_usage_alerts(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.admin_list_usage_alert_actions(uuid, integer, integer) SET search_path = public;
ALTER FUNCTION public.admin_usage_alert_metrics_sla(timestamptz, timestamptz) SET search_path = public;

-- Abuse settings
ALTER FUNCTION public.admin_get_abuse_settings() SET search_path = public;
ALTER FUNCTION public.admin_update_abuse_settings(integer, integer, integer, integer) SET search_path = public;
ALTER FUNCTION public.admin_update_abuse_settings(uuid, jsonb) SET search_path = public;
ALTER FUNCTION public.admin_rollback_abuse_settings(uuid) SET search_path = public;

-- Audit
ALTER FUNCTION public.admin_list_audit_events(text, text, text, timestamptz, timestamptz, integer, integer) SET search_path = public;
ALTER FUNCTION public.admin_list_audit_types(text) SET search_path = public;
ALTER FUNCTION public.admin_list_audit_customers(text, integer) SET search_path = public;
ALTER FUNCTION public.admin_list_audit_exports(text, text, date, date, text, integer, integer) SET search_path = public;

-- Customers
ALTER FUNCTION public.admin_list_customers(text, integer) SET search_path = public;
;
