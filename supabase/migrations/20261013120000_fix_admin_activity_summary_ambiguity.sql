-- FIX: admin_get_activity_summary — resolución de ambigüedad 42702
--
-- El SELECT final de la función usaba columnas sin cualificar (org_id,
-- quotes_count, last_quote_at, clients_count), que PL/pgSQL interpreta
-- como referencias ambiguas entre las variables de salida de RETURNS TABLE
-- y las columnas del CTE «merged».
--
-- Corrección: todas las referencias del SELECT final y del WHERE se
-- cualifican explícitamente con el alias «merged».
--
-- Firma, semántica, SECURITY DEFINER y permisos permanecen invariantes.

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
  SELECT merged.org_id,
         merged.quotes_count,
         merged.last_quote_at,
         merged.clients_count
  FROM merged
  WHERE merged.org_id IS NOT NULL;
END;
$$;

-- Permisos: mismos que la migración original (20261009120000).
-- CREATE OR REPLACE puede heredar grants existentes, pero se declaran
-- explícitamente para garantizar el estado correcto.
REVOKE EXECUTE ON FUNCTION public.admin_get_activity_summary() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_activity_summary() FROM anon;
GRANT  EXECUTE ON FUNCTION public.admin_get_activity_summary() TO authenticated;
