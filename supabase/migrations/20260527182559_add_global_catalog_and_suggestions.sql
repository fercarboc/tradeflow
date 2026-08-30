
-- ── trade_global_catalog ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_global_catalog (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oficio           TEXT NOT NULL,
  familia          TEXT NOT NULL,
  codigo           TEXT NOT NULL,
  descripcion      TEXT NOT NULL,
  unidad           TEXT NOT NULL DEFAULT 'ud',
  precio_referencia NUMERIC(10,2) NOT NULL DEFAULT 0,
  marca_sugerida   TEXT,
  activo           BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (oficio, codigo)
);

CREATE INDEX IF NOT EXISTS idx_tgc_oficio   ON trade_global_catalog(oficio);
CREATE INDEX IF NOT EXISTS idx_tgc_familia  ON trade_global_catalog(familia);
CREATE INDEX IF NOT EXISTS idx_tgc_activo   ON trade_global_catalog(activo);

-- Lectura pública (anon puede listar el catálogo global para importar desde el panel)
ALTER TABLE trade_global_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read_global_catalog"
  ON trade_global_catalog FOR SELECT
  USING (activo = true);

-- ── Columna global_catalog_id en trade_tarifas ─────────────────────────────
ALTER TABLE trade_tarifas
  ADD COLUMN IF NOT EXISTS global_catalog_id UUID REFERENCES trade_global_catalog(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tarifas_global_catalog_id
  ON trade_tarifas(global_catalog_id);

-- ── trade_catalog_suggestions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trade_catalog_suggestions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES trade_organizations(id) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  oficio           TEXT,
  familia          TEXT,
  unidad           TEXT NOT NULL DEFAULT 'ud',
  precio_indicado  NUMERIC(10,2),
  origen           TEXT NOT NULL DEFAULT 'manual'
                   CHECK (origen IN ('voz', 'foto', 'manual')),
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'fusionado')),
  notas_admin      TEXT,
  global_catalog_id UUID REFERENCES trade_global_catalog(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tcs_org_id  ON trade_catalog_suggestions(org_id);
CREATE INDEX IF NOT EXISTS idx_tcs_estado  ON trade_catalog_suggestions(estado);

ALTER TABLE trade_catalog_suggestions ENABLE ROW LEVEL SECURITY;

-- Instalador ve/crea solo sus sugerencias
CREATE POLICY "org_manage_suggestions"
  ON trade_catalog_suggestions
  USING (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_workers WHERE email = auth.email() AND activo = true
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM trade_workers WHERE email = auth.email() AND activo = true
    )
  );

-- ── RPC: importar desde catálogo global a trade_tarifas de la org ─────────────
CREATE OR REPLACE FUNCTION import_from_global_catalog(
  p_org_id   UUID,
  p_oficios  TEXT[]  DEFAULT NULL,
  p_familias TEXT[]  DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO trade_tarifas (org_id, codigo, familia, descripcion, precio_base, unidad, activo, global_catalog_id)
  SELECT
    p_org_id,
    gc.codigo,
    gc.familia,
    gc.descripcion,
    gc.precio_referencia,
    gc.unidad,
    true,
    gc.id
  FROM trade_global_catalog gc
  WHERE gc.activo = true
    AND (p_oficios  IS NULL OR gc.oficio  = ANY(p_oficios))
    AND (p_familias IS NULL OR gc.familia = ANY(p_familias))
    AND NOT EXISTS (
      SELECT 1 FROM trade_tarifas t
      WHERE t.org_id = p_org_id AND t.global_catalog_id = gc.id
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
;
