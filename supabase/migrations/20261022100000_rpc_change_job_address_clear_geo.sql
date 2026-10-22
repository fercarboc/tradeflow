-- RPC: change_job_address_clear_geo
--
-- Atomically updates the address fields of a trade_jobs row and clears all
-- geo coordinates and metadata in a single PostgreSQL transaction.
--
-- Snapshot WHERE guard: the UPDATE is applied only when the current DB address
-- matches the old-snapshot values supplied by the caller (the address at modal-open
-- time). If another session has already changed the address (e.g. a concurrent
-- manual confirmation for the new address), the WHERE condition fails, the row is
-- not modified, and applied=false is returned — the caller must surface an error.
--
-- This satisfies two invariants simultaneously:
--   1. ALL geo (including manual) is invalidated when the address changes.
--   2. A concurrent operation that already set the new address is never overwritten.
--
-- Parameters:
--   p_job_id        — target job
--   p_old_direccion / p_old_localidad / p_old_cp  — snapshot at modal-open time
--   p_new_direccion / p_new_localidad / p_new_cp  — new address values
--
-- Returns: json { "applied": bool }
--
-- Security: SECURITY INVOKER — the function runs as the caller (authenticated role).
-- RLS policy "Acceso a trabajos propios" on trade_jobs (FOR ALL, owner_id = auth.uid())
-- enforces org isolation automatically, matching the access level of direct PostgREST
-- updates. No manual auth check needed; no privilege escalation.
-- SET search_path = public prevents schema-injection even under INVOKER semantics.

CREATE OR REPLACE FUNCTION public.change_job_address_clear_geo(
  p_job_id        uuid,
  p_old_direccion text,
  p_old_localidad text,
  p_old_cp        text,
  p_new_direccion text,
  p_new_localidad text,
  p_new_cp        text
) RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_rows int;
BEGIN
  -- RLS enforces org ownership. An unauthorized caller simply matches 0 rows → applied=false.
  -- Single atomic UPDATE: new address + geo clear, conditioned on old snapshot.
  UPDATE public.trade_jobs
  SET
    direccion             = p_new_direccion,
    localidad             = p_new_localidad,
    cp                    = p_new_cp,
    latitud               = NULL,
    longitud              = NULL,
    direccion_normalizada = NULL,
    geo_source            = NULL,
    geo_confirmed_at      = NULL
  WHERE id = p_job_id
    AND (direccion  IS NOT DISTINCT FROM p_old_direccion)
    AND (localidad  IS NOT DISTINCT FROM p_old_localidad)
    AND (cp         IS NOT DISTINCT FROM p_old_cp);

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN json_build_object('applied', v_rows > 0);
END;
$$;

-- Restrict execution: remove PUBLIC default, deny anon, allow authenticated only.
-- Pattern matches 20260527130753_security_revoke_dangerous_functions_from_public.sql.
REVOKE EXECUTE ON FUNCTION public.change_job_address_clear_geo(uuid, text, text, text, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.change_job_address_clear_geo(uuid, text, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.change_job_address_clear_geo(uuid, text, text, text, text, text, text) TO authenticated;
