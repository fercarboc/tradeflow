
-- Token público para ver el parte firmado
ALTER TABLE trade_jobs ADD COLUMN IF NOT EXISTS parte_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

-- Backfill jobs existentes sin token
UPDATE trade_jobs SET parte_token = encode(gen_random_bytes(16), 'hex') WHERE parte_token IS NULL;

-- RPC pública: obtener info del parte por token (sin autenticación)
CREATE OR REPLACE FUNCTION get_parte_info(p_token TEXT)
RETURNS TABLE(
  job_titulo     TEXT,
  job_notas      TEXT,
  job_fecha      TEXT,
  job_hora_fin   TEXT,
  cliente_nombre TEXT,
  org_nombre     TEXT,
  org_logo_url   TEXT,
  firma_url      TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.titulo::TEXT                               AS job_titulo,
    j.notas_cierre::TEXT                         AS job_notas,
    to_char(j.completado_at, 'DD/MM/YYYY')::TEXT AS job_fecha,
    j.hora_fin::TEXT                             AS job_hora_fin,
    c.nombre::TEXT                               AS cliente_nombre,
    o.nombre::TEXT                               AS org_nombre,
    o.logo_url::TEXT                             AS org_logo_url,
    j.firma_cliente_url::TEXT                    AS firma_url
  FROM public.trade_jobs j
  LEFT JOIN public.trade_clients c ON c.id = j.client_id
  JOIN  public.trade_organizations o ON o.id = j.org_id
  WHERE j.parte_token = p_token
    AND j.estado = 'completado';
END;
$$;
;
