
DROP FUNCTION IF EXISTS public.search_actuaciones_scored(text, integer);

CREATE FUNCTION public.search_actuaciones_scored(
  p_transcript text,
  p_limit      integer DEFAULT 5
)
RETURNS TABLE(
  actuacion_id          text,
  oficio                text,
  partidas_obligatorias text[],
  partidas_auxiliares   text[],
  reglas_calculo        text,
  unidad                text,
  observaciones         text,
  precio_min            numeric,
  precio_max            numeric,
  score                 bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  WITH transcript_words AS (
    SELECT DISTINCT lower(word) AS word
    FROM regexp_split_to_table(p_transcript, '\s+') AS word
    WHERE length(word) >= 4
  )
  SELECT
    a.actuacion_id,
    a.oficio,
    a.partidas_obligatorias,
    a.partidas_auxiliares,
    a.reglas_calculo,
    a.unidad,
    a.observaciones,
    a.precio_min,
    a.precio_max,
    (COUNT(*) + (COALESCE(a.usage_count, 0) / 10))::bigint AS score
  FROM public.trade_actuaciones a
  JOIN transcript_words tw
    ON array_to_string(a.palabras_clave, ' ') ILIKE '%' || tw.word || '%'
  WHERE a.activo = true
  GROUP BY
    a.actuacion_id, a.oficio, a.partidas_obligatorias,
    a.partidas_auxiliares, a.reglas_calculo, a.unidad,
    a.observaciones, a.precio_min, a.precio_max, a.usage_count
  ORDER BY score DESC
  LIMIT p_limit;
$$;
;
