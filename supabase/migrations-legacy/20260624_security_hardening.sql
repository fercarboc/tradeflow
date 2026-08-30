-- ═══════════════════════════════════════════════════════════════════
-- SECURITY HARDENING — basado en Supabase Security Advisor warnings
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. REVOKE anon EXECUTE en funciones SECURITY DEFINER que no
--       deben ser llamadas sin sesión activa ────────────────────────

-- Funciones de datos internos/admin
REVOKE EXECUTE ON FUNCTION public._user_admin_org_ids() FROM anon;
REVOKE EXECUTE ON FUNCTION public._user_org_ids() FROM anon;

-- Funciones de cron/scheduler (solo deben ejecutarse desde el backend)
REVOKE EXECUTE ON FUNCTION public.apply_scheduled_plan_if_due(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_update_churn_risk() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cron_invoice_overdue_check() FROM anon;

-- Funciones internas de aprendizaje IA (no necesitan anon)
REVOKE EXECUTE ON FUNCTION public.update_actuacion_learned(text, text, text, text, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.insert_actuacion_learned(text, text, text, text, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.import_from_global_catalog(uuid) FROM anon;

-- NOTA: Se MANTIENE execute para anon en:
--   check_email_for_registration(p_email text)  → necesario para el formulario de registro
--   apply_referral_code(p_code text)            → se llama tras signUp exitoso (sesión activa ya)

-- ── 2. FIX search_path mutable — ejecuta esta query para obtener
--       los ALTER exactos con las firmas correctas de cada función:
-- ─────────────────────────────────────────────────────────────────
-- PASO A: Copia y ejecuta el SELECT de abajo en el SQL editor.
-- PASO B: Copia el resultado y ejecútalo como un segundo script.

SELECT
  'ALTER FUNCTION public.' || proname || '(' ||
  pg_get_function_arguments(oid) || ') SET search_path = '''';' AS fix_sql
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN (
    'increment_rag_rate_limit',
    'update_supplier_search_vector',
    'cron_invoice_overdue_check',
    'generate_subcontrata_numero',
    'increment_actuacion_usage',
    'generate_referral_code',
    'trg_fn_assign_referral_code',
    'import_from_global_catalog',
    'search_actuaciones_scored',
    'update_actuacion_learned',
    'insert_actuacion_learned',
    'hybrid_search_norm_chunks',
    'search_supplier_products'
  )
ORDER BY proname;

-- ── 3. trade_norm_conflicts — activar RLS (tabla interna sin uso en UI)
ALTER TABLE public.trade_norm_conflicts ENABLE ROW LEVEL SECURITY;

-- ── 4. trade-job-photos — restringir listado (fotos privadas de obras)
--       Eliminar política SELECT permisiva y sustituir por autenticados solo.
--       Comenta este bloque si prefieres mantener acceso público a las fotos.
DROP POLICY IF EXISTS "job photos read" ON storage.objects;
DROP POLICY IF EXISTS "trade_job_photos_authenticated_list" ON storage.objects;

CREATE POLICY "trade_job_photos_auth_only"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'trade-job-photos'
    AND auth.role() = 'authenticated'
  );

-- ── IGNORAR intencionalmente (warning válido pero comportamiento esperado):
--   • rls_policy_always_true en debacu_eval_access_requests,
--     public_contact_requests, trade_waitlist
--     → Son formularios públicos de contacto/waitlist. El INSERT sin restricción
--       es correcto; no hay datos sensibles que proteger en la escritura.
--   • extension_in_public (vector, pg_trgm, pg_net)
--     → Estándar de Supabase. Mover a otro schema requiere recrear todo el schema
--       vectorial; el riesgo real es mínimo.
--   • public_bucket_allows_listing (org-logos, trade-logos)
--     → Son logos públicos de organizaciones. El listado no expone datos privados.
