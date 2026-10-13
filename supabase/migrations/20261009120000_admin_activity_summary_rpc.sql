-- ADMIN ACTIVITY SUMMARY RPC
-- Devuelve quotes_count, last_quote_at y clients_count por org para el
-- panel de administración. Usa SECURITY DEFINER para evitar que RLS de
-- trade_quotes/trade_clients bloquee las lecturas del admin.
--
-- Mecanismo de autorización: auth.email() firmado en el JWT de Supabase,
-- equivalente en seguridad a auth.uid(). Comprobación ejecutada DENTRO de
-- la BD, nunca en el frontend. Reutiliza el mismo patrón que
-- admin_get_trade_users (20260525093516).
--
-- Permisos: REVOKE a PUBLIC y anon; GRANT solo a authenticated.
-- La comprobación interna deniega el acceso a cualquier usuario autenticado
-- que no sea el admin, por lo que el GRANT a authenticated es seguro.

CREATE OR REPLACE FUNCTION public.admin_get_activity_summary()
RETURNS TABLE (
  org_id        uuid,
  quotes_count  bigint,
  last_quote_at timestamptz,
  clients_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Misma comprobación que admin_get_trade_users:
  -- auth.email() viene del JWT firmado por Supabase — no editable por el usuario.
  IF auth.email() IS DISTINCT FROM 'fercarboc@gmail.com' THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  WITH q_agg AS (
    SELECT q.org_id,
           COUNT(*)::bigint   AS quotes_count,
           MAX(q.created_at)  AS last_quote_at
    FROM public.trade_quotes q
    GROUP BY q.org_id
  ),
  c_agg AS (
    SELECT c.org_id,
           COUNT(*)::bigint AS clients_count
    FROM public.trade_clients c
    GROUP BY c.org_id
  ),
  merged AS (
    SELECT
      COALESCE(q.org_id, c.org_id)   AS org_id,
      COALESCE(q.quotes_count,  0)   AS quotes_count,
      q.last_quote_at,
      COALESCE(c.clients_count, 0)   AS clients_count
    FROM q_agg q
    FULL OUTER JOIN c_agg c ON c.org_id = q.org_id
  )
  SELECT org_id, quotes_count, last_quote_at, clients_count
  FROM merged
  WHERE org_id IS NOT NULL;
END;
$$;

-- Permisos explícitos
REVOKE EXECUTE ON FUNCTION public.admin_get_activity_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_activity_summary() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_activity_summary() TO authenticated;
