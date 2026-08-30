
-- ── Base Maestra IA v2 ─────────────────────────────────────────────────────────

-- 1. Nuevas columnas en trade_actuaciones
ALTER TABLE public.trade_actuaciones
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precio_min numeric(10,2),
  ADD COLUMN IF NOT EXISTS precio_max numeric(10,2);

-- 2. Índices de rendimiento
CREATE INDEX IF NOT EXISTS idx_trade_actuaciones_activo
  ON public.trade_actuaciones (activo);

CREATE INDEX IF NOT EXISTS idx_trade_actuaciones_oficio
  ON public.trade_actuaciones (oficio);

-- GIN sobre el array directamente (para operaciones && y @>)
CREATE INDEX IF NOT EXISTS idx_trade_actuaciones_palabras_gin
  ON public.trade_actuaciones USING gin(palabras_clave);

-- 3. search_actuaciones_scored mejorado:
--    - filtra activo=true
--    - pondera por usage_count
CREATE OR REPLACE FUNCTION public.search_actuaciones_scored(
  p_transcript text,
  p_limit integer DEFAULT 5
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
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO ''
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
    (COUNT(*) + (COALESCE(a.usage_count, 0) / 10))::bigint AS score
  FROM public.trade_actuaciones a
  JOIN transcript_words tw
    ON array_to_string(a.palabras_clave, ' ') ILIKE '%' || tw.word || '%'
  WHERE a.activo = true
  GROUP BY
    a.actuacion_id, a.oficio, a.partidas_obligatorias,
    a.partidas_auxiliares, a.reglas_calculo, a.unidad,
    a.observaciones, a.usage_count
  ORDER BY score DESC
  LIMIT p_limit;
$$;

-- 4. update_actuacion_learned (overload simple): actualiza usage_count y last_used_at
CREATE OR REPLACE FUNCTION public.update_actuacion_learned(
  p_actuacion_id text,
  p_new_partidas text[],
  p_new_keywords text[]
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_before_count INT;
  v_after_count  INT;
  v_added        INT;
BEGIN
  SELECT array_length(partidas_obligatorias, 1)
  INTO v_before_count
  FROM public.trade_actuaciones
  WHERE actuacion_id = p_actuacion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actuacion_not_found', 'actuacion_id', p_actuacion_id);
  END IF;

  UPDATE public.trade_actuaciones
  SET
    partidas_obligatorias = ARRAY(
      SELECT DISTINCT unnest(partidas_obligatorias || COALESCE(p_new_partidas, '{}'))
    ),
    palabras_clave = ARRAY(
      SELECT DISTINCT unnest(palabras_clave || COALESCE(p_new_keywords, '{}'))
    ),
    usage_count  = COALESCE(usage_count, 0) + 1,
    last_used_at = NOW(),
    updated_at   = NOW()
  WHERE actuacion_id = p_actuacion_id;

  SELECT array_length(partidas_obligatorias, 1)
  INTO v_after_count
  FROM public.trade_actuaciones
  WHERE actuacion_id = p_actuacion_id;

  v_added := COALESCE(v_after_count, 0) - COALESCE(v_before_count, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'actuacion_id', p_actuacion_id,
    'partidas_antes', v_before_count,
    'partidas_despues', v_after_count,
    'partidas_añadidas', v_added
  );
END;
$$;

-- 5. update_actuacion_learned (overload extendido)
CREATE OR REPLACE FUNCTION public.update_actuacion_learned(
  p_actuacion_id text,
  p_new_partidas text[],
  p_new_keywords text[],
  p_transcript text,
  p_score numeric,
  p_oficio text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_before_count INT;
  v_after_count  INT;
  v_added        INT;
BEGIN
  SELECT array_length(partidas_obligatorias, 1)
  INTO v_before_count
  FROM public.trade_actuaciones
  WHERE actuacion_id = p_actuacion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actuacion_not_found', 'actuacion_id', p_actuacion_id);
  END IF;

  UPDATE public.trade_actuaciones
  SET
    partidas_obligatorias = ARRAY(
      SELECT DISTINCT unnest(partidas_obligatorias || COALESCE(p_new_partidas, '{}'))
    ),
    palabras_clave = ARRAY(
      SELECT DISTINCT unnest(palabras_clave || COALESCE(p_new_keywords, '{}'))
    ),
    usage_count  = COALESCE(usage_count, 0) + 1,
    last_used_at = NOW(),
    updated_at   = NOW()
  WHERE actuacion_id = p_actuacion_id;

  SELECT array_length(partidas_obligatorias, 1)
  INTO v_after_count
  FROM public.trade_actuaciones
  WHERE actuacion_id = p_actuacion_id;

  v_added := COALESCE(v_after_count, 0) - COALESCE(v_before_count, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'actuacion_id', p_actuacion_id,
    'partidas_antes', v_before_count,
    'partidas_despues', v_after_count,
    'partidas_añadidas', v_added
  );
END;
$$;
;
