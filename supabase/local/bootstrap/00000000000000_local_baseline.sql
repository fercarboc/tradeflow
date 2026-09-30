-- ============================================================
-- LOCAL BASELINE — stubs para entorno de desarrollo local
-- ============================================================
-- Las 15 migraciones legacy (20260321–20260425) referencian tablas y
-- funciones del schema Debacu que no se reconstruyen localmente.
-- Este archivo crea SOLO lo que las migraciones TrabFlow (≥20260524)
-- necesitan directamente.
--
-- Patrón seguro en producción:
--   * CREATE TABLE IF NOT EXISTS → no-op si ya existe
--   * DO $$ IF NOT EXISTS pg_proc → CREATE FUNCTION → END $$ → no sobreescribe
--
-- ──────────────────────────────────────────────────────────
-- SECCIÓN 0: Extensiones necesarias en local
-- pg_cron: el stack Docker local no lo activa por defecto.
-- En producción Supabase Cloud viene activado de fábrica.
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ──────────────────────────────────────────────────────────
-- SECCIÓN 1: Tablas que existen en producción pero NO tienen
-- migración en el repositorio. Se crean aquí para que las
-- migraciones que las referencian puedan aplicarse.
--
-- IMPORTANTE: La equivalencia con producción es PARCIAL.
-- Ver scripts/local_rebuild.md para la lista de gaps conocidos.
-- ──────────────────────────────────────────────────────────

-- trade_installer_needs
-- Creada manualmente en producción; referenciada en 20260601124749.
-- Columnas inferidas del chatbot edge function (index.ts:340) y de la
-- migración de RLS (20260601124749). FK a orgs y users desactivadas
-- (son registros de log del chatbot, no registros relacionales).
-- Gap conocido: sin FK constraints, sin índice en org_id/created_at.
CREATE TABLE IF NOT EXISTS public.trade_installer_needs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  user_id    uuid,
  mensaje    text,
  oficio     text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.trade_installer_needs ENABLE ROW LEVEL SECURITY;
-- Policy temporal que la migración 20260601124749 reemplazará:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'trade_installer_needs' AND policyname = 'service_all'
  ) THEN
    EXECUTE 'CREATE POLICY "service_all" ON public.trade_installer_needs FOR ALL USING (true)';
  END IF;
END $$;

-- trade_marketplace_supplier_locations
-- Creada manualmente en producción; primera referencia en 20260809075740.
-- Columnas inferidas de las funciones get_supplier_checkout_config (20260809075740)
-- y get_supplier_location_stats (20260812160204), y del componente PortalTiendas.tsx.
-- Gap conocido: sin políticas RLS (ninguna migración las define; producción igual).
-- El acceso directo desde PortalTiendas usa authenticated pero sin policy = bloqueado.
-- Las funciones SECURITY DEFINER (checkout_config, location_stats) sí funcionan.
-- Pendiente de producción: añadir políticas RLS para _is_actor_member(actor_id).
CREATE TABLE IF NOT EXISTS public.trade_marketplace_supplier_locations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id              uuid        REFERENCES public.trade_marketplace_actors(id),
  codigo_interno        text,
  nombre                text        NOT NULL,
  tipo                  text        DEFAULT 'almacen',
  direccion_linea1      text,
  localidad             text,
  provincia             text,
  codigo_postal         text,
  telefono              text,
  horario               text,
  permite_recogida      boolean     DEFAULT false,
  permite_entrega_local boolean     DEFAULT false,
  radio_servicio_km     numeric,
  orden                 integer     DEFAULT 0,
  activa                boolean     DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
ALTER TABLE public.trade_marketplace_supplier_locations ENABLE ROW LEVEL SECURITY;

-- trade_marketplace_promotions
-- Creada manualmente en producción; primera referencia en 20260816151723.
-- Columnas inferidas del componente PortalMarketing.tsx (comentario en línea 5-13)
-- y de las policies de 20260816151723.
-- Las policies tmp_ son reemplazadas por 20260816151723 con membership check.
-- Gap conocido: columnas tipo/scope deberían ser enums o con CHECK constraints;
-- en producción probablemente tampoco tienen constraints (no hay migración que los añada).
CREATE TABLE IF NOT EXISTS public.trade_marketplace_promotions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id             uuid        REFERENCES public.trade_marketplace_actors(id),
  tipo                 text,
  scope                text,
  location_id          uuid,
  comunidad_autonoma   text,
  titulo               text,
  descripcion          text,
  cta_label            text,
  fecha_inicio         timestamptz,
  fecha_fin            timestamptz,
  activa               boolean     DEFAULT true,
  mostrar_en_home      boolean     DEFAULT false,
  mostrar_en_perfil    boolean     DEFAULT false,
  offering_ids_target  uuid[],
  familia_ids_target   text[],
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);
ALTER TABLE public.trade_marketplace_promotions ENABLE ROW LEVEL SECURITY;
-- Policies tmp_ que 20260816151723 reemplazará:
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_policies WHERE tablename = 'trade_marketplace_promotions' AND policyname = 'tmp_select_active'
  ) THEN
    EXECUTE 'CREATE POLICY "tmp_select_active" ON public.trade_marketplace_promotions FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "tmp_write_service" ON public.trade_marketplace_promotions FOR ALL USING (true)';
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────
-- SECCIÓN 2: Corrección de funciones con search_path vacío
-- que llaman a otras funciones sin prefijo public.
-- Estas correcciones son NECESARIAS en local (la seguridad
-- hardening 20260624 dejó search_path='' pero los cuerpos
-- no se actualizaron completamente).
-- En producción las funciones se ejecutan en contexto de
-- pg_search_path implícito y no fallan — es un latent bug
-- que solo se manifiesta en reconstrucción limpia.
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_referral_code()
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.trade_organizations WHERE referral_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_fn_assign_referral_code()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $function$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$function$;

-- ──────────────────────────────────────────────────────────
-- SECCIÓN 3: Tablas Debacu legacy referenciadas en migraciones TrabFlow
-- ──────────────────────────────────────────────────────────

-- debacu_eval_welcome_emails (20260527064441)
CREATE TABLE IF NOT EXISTS public.debacu_eval_welcome_emails (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid,
  email      text,
  status     text        DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tablas Debacu hotel (20260527130900, 20260527130916, 20260527135539)
CREATE TABLE IF NOT EXISTS public.users (
  id  text PRIMARY KEY,
  pin text
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.company_banks (
  id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  name text
);
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.apps (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);
ALTER TABLE public.apps ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.plans (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.sectors (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text
);
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

-- 2. Funciones stub (solo se crean si NO existen ya)
--    Referenciadas en migraciones de seguridad TrabFlow (REVOKE/GRANT/ALTER FUNCTION):
--      20260527130726, 20260527130753, 20260527135539, 20260624070744
DO $baseline$
DECLARE fn_exists boolean;
BEGIN

  -- is_admin: función Debacu de autorización (usada en RLS policies)
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'is_admin'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.is_admin()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $b$ SELECT auth.email() = 'fercarboc@gmail.com' $b$ $f$;
  END IF;

  -- ── Debacu: funciones de datos / análisis ─────────────────────────

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debug_audit_exports_count_system'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debug_audit_exports_count_system()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_sync_guest_index_from_eval'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_sync_guest_index_from_eval()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_eval_guest_index_upsert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 9) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_eval_guest_index_upsert(
      p1 text, p2 text, p3 text, p4 text, p5 date, p6 date,
      p7 integer, p8 numeric, p9 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_eval_check_signals'
    AND pronamespace = 'public'::regnamespace AND pronargs = 3) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_eval_check_signals(p1 text, p2 integer, p3 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_backfill_identity_links_doc'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_backfill_identity_links_doc(p1 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_backfill_links_doc'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_backfill_links_doc(p1 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_backfill_links_email'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_backfill_links_email(p1 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_backfill_links_phone'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_backfill_links_phone(p1 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_build_identity_links'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_build_identity_links(p1 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_get_pepper'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_get_pepper()
      RETURNS text LANGUAGE sql AS $b$ SELECT ''::text $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'global_risk_snapshot'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.global_risk_snapshot()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_get_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_get_usage_alert(p1 uuid)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'get_debacu_pepper'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.get_debacu_pepper()
      RETURNS text LANGUAGE sql AS $b$ SELECT ''::text $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_eval_is_admin'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_eval_is_admin()
      RETURNS boolean LANGUAGE sql AS $b$ SELECT false $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'debacu_doc_key'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.debacu_doc_key(p1 text)
      RETURNS text LANGUAGE sql AS $b$ SELECT ''::text $b$ $f$;
  END IF;

  -- ── Debacu: funciones admin ───────────────────────────────────────

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_get_abuse_settings'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_get_abuse_settings()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_get_global_risk_distribution'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_get_global_risk_distribution(p1 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_update_abuse_settings'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_update_abuse_settings(p1 uuid, p2 jsonb)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_update_abuse_settings'
    AND pronamespace = 'public'::regnamespace AND pronargs = 4) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_update_abuse_settings(p1 integer, p2 integer, p3 integer, p4 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_rollback_abuse_settings'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_rollback_abuse_settings(p1 uuid)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_resolve_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 4) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_resolve_usage_alert(p1 uuid, p2 text, p3 text, p4 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_ack_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 4) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_ack_usage_alert(p1 uuid, p2 text, p3 text, p4 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_ack_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_ack_usage_alert(p1 uuid, p2 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_add_usage_alert_note'
    AND pronamespace = 'public'::regnamespace AND pronargs = 4) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_add_usage_alert_note(p1 uuid, p2 text, p3 text, p4 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_reopen_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_reopen_usage_alert(p1 uuid, p2 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_reopen_usage_alert'
    AND pronamespace = 'public'::regnamespace AND pronargs = 4) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_reopen_usage_alert(p1 uuid, p2 text, p3 text, p4 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_usage_alert_metrics'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_usage_alert_metrics(p1 timestamptz, p2 timestamptz)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_usage_alert_metrics_sla'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_usage_alert_metrics_sla(p1 timestamptz, p2 timestamptz)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_usage_alerts'
    AND pronamespace = 'public'::regnamespace AND pronargs = 3) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_usage_alerts(p1 text, p2 integer, p3 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_usage_alert_actions'
    AND pronamespace = 'public'::regnamespace AND pronargs = 3) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_usage_alert_actions(p1 uuid, p2 integer, p3 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_customers'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_customers(p1 text, p2 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_events'
    AND pronamespace = 'public'::regnamespace AND pronargs = 7) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_events(
      p1 text, p2 text, p3 text, p4 timestamptz, p5 timestamptz, p6 integer, p7 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_types'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_types(p1 text)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_customers'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_customers(p1 text, p2 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_exports_v2'
    AND pronamespace = 'public'::regnamespace AND pronargs = 10) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_exports_v2(
      p1 text, p2 uuid, p3 date, p4 date, p5 text, p6 text, p7 text, p8 text, p9 integer, p10 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_export_downloads'
    AND pronamespace = 'public'::regnamespace AND pronargs = 3) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_export_downloads(p1 uuid, p2 integer, p3 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_list_audit_exports'
    AND pronamespace = 'public'::regnamespace AND pronargs = 7) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_list_audit_exports(
      p1 text, p2 text, p3 date, p4 date, p5 text, p6 integer, p7 integer)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_audit_export_download_stats'
    AND pronamespace = 'public'::regnamespace AND pronargs = 1) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_audit_export_download_stats(p1 uuid)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  -- admin_whoami: puede ser TrabFlow o Debacu; stub solo si no existe
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_whoami'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_whoami()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  -- admin_get_waitlist_leads: puede ser TrabFlow; stub solo si no existe
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_get_waitlist_leads'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_get_waitlist_leads()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  -- admin_get_platform_invoices: puede ser TrabFlow; stub solo si no existe
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_get_platform_invoices'
    AND pronamespace = 'public'::regnamespace AND pronargs = 0) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_get_platform_invoices()
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  -- admin_set_subscription_active: puede ser TrabFlow; stub solo si no existe
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'admin_set_subscription_active'
    AND pronamespace = 'public'::regnamespace AND pronargs = 2) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.admin_set_subscription_active(p1 uuid, p2 boolean)
      RETURNS void LANGUAGE sql AS $b$ SELECT NULL $b$ $f$;
  END IF;

  -- ── Debacu/TrabFlow: funciones referenciadas en REVOKE/GRANT/ALTER ──
  -- can_access_app: función Debacu de autenticación
  SELECT EXISTS (SELECT FROM pg_proc WHERE proname = 'can_access_app'
    AND pronamespace = 'public'::regnamespace AND pronargs = 3) INTO fn_exists;
  IF NOT fn_exists THEN
    EXECUTE $f$ CREATE FUNCTION public.can_access_app(p1 text, p2 text, p3 text)
      RETURNS boolean LANGUAGE sql AS $b$ SELECT false $b$ $f$;
  END IF;

  -- Nota: funciones TrabFlow como import_from_global_catalog, apply_referral_code,
  -- _user_org_ids, etc. NO se stubbean aquí — las crean sus propias migraciones
  -- antes de que las migraciones de seguridad (20260624) las referencien.

END $baseline$;
