
CREATE TABLE trade_actuaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio text NOT NULL,
  actuacion_id text NOT NULL UNIQUE,
  palabras_clave text[] NOT NULL DEFAULT '{}',
  partidas_obligatorias text[] NOT NULL DEFAULT '{}',
  partidas_auxiliares text[] NOT NULL DEFAULT '{}',
  reglas_calculo text NOT NULL DEFAULT '',
  unidad text NOT NULL DEFAULT '',
  observaciones text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_trade_actuaciones_oficio ON trade_actuaciones(oficio);
CREATE INDEX idx_trade_actuaciones_palabras_clave ON trade_actuaciones USING GIN(palabras_clave);

ALTER TABLE trade_actuaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_all" ON trade_actuaciones
  FOR ALL TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com')
  WITH CHECK (auth.email() = 'fercarboc@gmail.com');
;
