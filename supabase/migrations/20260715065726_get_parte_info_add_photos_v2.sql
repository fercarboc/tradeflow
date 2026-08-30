
DROP FUNCTION IF EXISTS public.get_parte_info(text);

CREATE FUNCTION public.get_parte_info(p_token text)
RETURNS TABLE(
  job_titulo text, job_notas text, job_fecha text, job_hora_fin text,
  cliente_nombre text, org_nombre text, org_logo_url text, firma_url text,
  fotos json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    j.firma_cliente_url::TEXT                    AS firma_url,
    COALESCE(
      (SELECT json_agg(
         json_build_object('photo_url', p.photo_url, 'caption', p.caption)
         ORDER BY p.created_at
       )
       FROM public.trade_job_photos p WHERE p.job_id = j.id),
      '[]'::json
    )                                            AS fotos
  FROM public.trade_jobs j
  LEFT JOIN public.trade_clients c ON c.id = j.client_id
  JOIN  public.trade_organizations o ON o.id = j.org_id
  WHERE j.parte_token = p_token;
END;
$$;
;
