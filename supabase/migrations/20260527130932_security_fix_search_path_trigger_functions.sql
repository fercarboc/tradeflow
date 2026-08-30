-- ============================================================
-- MIGRACIÓN: Añadir SET search_path a funciones con search_path mutable
-- Previene ataques de search_path injection (Supabase warning: function_search_path_mutable)
--
-- Rollback: ALTER FUNCTION ... RESET search_path;
-- Impacto: Ninguno — solo fija el search_path que ya usaban implícitamente
-- ============================================================

-- trade_set_updated_at
CREATE OR REPLACE FUNCTION public.trade_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_trade_subscriptions_updated_at
CREATE OR REPLACE FUNCTION public.update_trade_subscriptions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- update_updated_at_column (función genérica de updated_at)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;;
