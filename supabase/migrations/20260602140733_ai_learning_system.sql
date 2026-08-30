
-- Añadir updated_at a trade_actuaciones si no existe
ALTER TABLE trade_actuaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Tabla de feedback de IA: registra qué propuso la IA vs qué guardó el instalador
CREATE TABLE IF NOT EXISTS trade_ai_feedback (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id        UUID REFERENCES trade_organizations(id) ON DELETE CASCADE,
  transcript    TEXT NOT NULL,
  actuacion_ids TEXT[] DEFAULT '{}',
  ai_partidas   JSONB DEFAULT '[]',
  final_partidas JSONB DEFAULT '[]',
  nuevas_partidas JSONB DEFAULT '[]',
  kb_score      NUMERIC(4,3) DEFAULT 0,
  applied       BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE trade_ai_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_feedback" ON trade_ai_feedback
  FOR ALL
  USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = TRUE
    )
  );

-- Índice para consultas de admin
CREATE INDEX IF NOT EXISTS idx_ai_feedback_org ON trade_ai_feedback(org_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_applied ON trade_ai_feedback(applied) WHERE applied = FALSE;

-- Función de aprendizaje: añade partidas y palabras clave a una actuación existente
-- Sin eliminar datos existentes, solo extiende el array (DISTINCT)
CREATE OR REPLACE FUNCTION update_actuacion_learned(
  p_actuacion_id   TEXT,
  p_new_partidas   TEXT[],
  p_new_keywords   TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_before_count INT;
  v_after_count  INT;
  v_added        INT;
BEGIN
  -- Contar partidas antes
  SELECT array_length(partidas_obligatorias, 1)
  INTO v_before_count
  FROM trade_actuaciones
  WHERE actuacion_id = p_actuacion_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'actuacion_not_found', 'actuacion_id', p_actuacion_id);
  END IF;

  -- Actualizar: añadir solo los valores que no existían ya (DISTINCT)
  UPDATE trade_actuaciones
  SET
    partidas_obligatorias = ARRAY(
      SELECT DISTINCT unnest(partidas_obligatorias || COALESCE(p_new_partidas, '{}'))
    ),
    palabras_clave = ARRAY(
      SELECT DISTINCT unnest(palabras_clave || COALESCE(p_new_keywords, '{}'))
    ),
    updated_at = NOW()
  WHERE actuacion_id = p_actuacion_id;

  -- Contar partidas después
  SELECT array_length(partidas_obligatorias, 1)
  INTO v_after_count
  FROM trade_actuaciones
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

-- Función para crear nueva actuación aprendida desde cero
CREATE OR REPLACE FUNCTION insert_actuacion_learned(
  p_oficio       TEXT,
  p_actuacion_id TEXT,
  p_keywords     TEXT[],
  p_partidas     TEXT[],
  p_transcript   TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO trade_actuaciones (
    oficio, actuacion_id, palabras_clave,
    partidas_obligatorias, partidas_auxiliares,
    reglas_calculo, unidad, observaciones,
    created_at, updated_at
  ) VALUES (
    p_oficio,
    p_actuacion_id,
    p_keywords,
    p_partidas,
    '{}',
    'aprendido_automaticamente',
    'unidad',
    'Creado automáticamente desde transcript: ' || left(p_transcript, 200),
    NOW(),
    NOW()
  )
  ON CONFLICT (actuacion_id) DO UPDATE
    SET
      partidas_obligatorias = ARRAY(
        SELECT DISTINCT unnest(trade_actuaciones.partidas_obligatorias || p_partidas)
      ),
      palabras_clave = ARRAY(
        SELECT DISTINCT unnest(trade_actuaciones.palabras_clave || p_keywords)
      ),
      updated_at = NOW();

  RETURN jsonb_build_object('ok', true, 'actuacion_id', p_actuacion_id);
END;
$$;
;
