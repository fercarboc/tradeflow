
-- ============================================================
-- MIGRACIÓN: Correcciones detectadas en tests manuales (FASE 5)
-- ============================================================

-- 1. RESTAURAR GRANT SELECT sobre catálogos públicos (apps, plans, sectors)
--    La migración anterior eliminó los grants por defecto de Supabase.
--    Estas tablas son de solo lectura para el público (registro, pricing page).
GRANT SELECT ON public.apps    TO anon, authenticated;
GRANT SELECT ON public.plans   TO anon, authenticated;
GRANT SELECT ON public.sectors TO anon, authenticated;

-- 2. REVOCAR seed_org_catalog de authenticated
--    La función no tiene check de is_admin() — cualquier usuario autenticado
--    podría copiar el catálogo base a cualquier org_id arbitrario.
REVOKE EXECUTE ON FUNCTION public.seed_org_catalog(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_org_catalog(uuid) FROM PUBLIC;

-- 3. REVOCAR get_debacu_pepper de authenticated
--    Devuelve la clave HMAC de pepper. Solo debe usarla el servidor interno.
REVOKE EXECUTE ON FUNCTION public.get_debacu_pepper() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_debacu_pepper() FROM PUBLIC;

-- 4. REVOCAR debacu_eval_is_admin y debacu_eval_is_org_admin de PUBLIC
--    No hay razón para que usuarios anon puedan llamarlas.
REVOKE EXECUTE ON FUNCTION public.debacu_eval_is_admin() FROM PUBLIC;

-- debacu_eval_is_org_admin puede tener variantes de firma; revocar ambas si existen
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
      AND proname = 'debacu_eval_is_org_admin'
  ) THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.debacu_eval_is_org_admin FROM PUBLIC';
  END IF;
END;
$$;

-- 5. LIMPIAR filas de test insertadas en trade_waitlist
DELETE FROM public.trade_waitlist
WHERE email IN ('test-anon-delete@test.com', 'test-anon-delete2@test.com');
;
