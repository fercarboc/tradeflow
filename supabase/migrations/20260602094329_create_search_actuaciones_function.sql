
CREATE OR REPLACE FUNCTION search_actuaciones_scored(
  p_transcript text,
  p_limit int DEFAULT 5
)
RETURNS TABLE(
  actuacion_id text,
  oficio text,
  partidas_obligatorias text[],
  partidas_auxiliares text[],
  reglas_calculo text,
  unidad text,
  observaciones text,
  score bigint
)
LANGUAGE sql
SECURITY DEFINER
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
    COUNT(*) AS score
  FROM trade_actuaciones a
  JOIN transcript_words tw
    ON array_to_string(a.palabras_clave, ' ') ILIKE '%' || tw.word || '%'
  GROUP BY
    a.actuacion_id, a.oficio, a.partidas_obligatorias,
    a.partidas_auxiliares, a.reglas_calculo, a.unidad, a.observaciones
  ORDER BY score DESC
  LIMIT p_limit;
$$;
;
