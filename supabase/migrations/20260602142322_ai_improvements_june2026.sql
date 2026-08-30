
-- Añadir metadata a trade_ai_usage para trazabilidad de contratos
ALTER TABLE trade_ai_usage ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Añadir usage_count a trade_actuaciones para saber qué plantillas se usan más
ALTER TABLE trade_actuaciones ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE trade_actuaciones ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Índice para ordenar por más usadas
CREATE INDEX IF NOT EXISTS idx_actuaciones_usage ON trade_actuaciones(usage_count DESC);

-- Función para incrementar usage_count cuando se usa una actuación
CREATE OR REPLACE FUNCTION increment_actuacion_usage(p_actuacion_ids TEXT[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE trade_actuaciones
  SET
    usage_count = COALESCE(usage_count, 0) + 1,
    last_used_at = NOW()
  WHERE actuacion_id = ANY(p_actuacion_ids);
END;
$$;
;
