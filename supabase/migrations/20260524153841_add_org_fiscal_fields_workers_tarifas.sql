
-- Expand trade_organizations with fiscal/contact fields
ALTER TABLE trade_organizations
  ADD COLUMN IF NOT EXISTS telefono_fijo TEXT,
  ADD COLUMN IF NOT EXISTS telefono_movil TEXT,
  ADD COLUMN IF NOT EXISTS localidad TEXT,
  ADD COLUMN IF NOT EXISTS cp TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT DEFAULT 'España';

-- Workers / Técnicos table
CREATE TABLE IF NOT EXISTS trade_workers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  nombre     TEXT NOT NULL,
  telefono   TEXT,
  email      TEXT,
  rol        TEXT NOT NULL DEFAULT 'tecnico' CHECK (rol IN ('tecnico', 'admin', 'comercial')),
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trade_workers_org_idx ON trade_workers(org_id);

-- Tarifas / Catálogo de precios table
CREATE TABLE IF NOT EXISTS trade_tarifas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  codigo      TEXT,
  familia     TEXT NOT NULL DEFAULT 'General',
  descripcion TEXT NOT NULL,
  precio_base NUMERIC(10,2) NOT NULL DEFAULT 0,
  unidad      TEXT NOT NULL DEFAULT 'ud',
  activo      BOOLEAN NOT NULL DEFAULT true,
  posicion    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trade_tarifas_org_idx ON trade_tarifas(org_id);
CREATE INDEX IF NOT EXISTS trade_tarifas_familia_idx ON trade_tarifas(org_id, familia);

-- updated_at triggers (reuse existing function if present)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS set_trade_workers_updated_at ON trade_workers;
CREATE TRIGGER set_trade_workers_updated_at
  BEFORE UPDATE ON trade_workers FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_trade_tarifas_updated_at ON trade_tarifas;
CREATE TRIGGER set_trade_tarifas_updated_at
  BEFORE UPDATE ON trade_tarifas FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS trade_workers
ALTER TABLE trade_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workers_owner_all" ON trade_workers FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));
CREATE POLICY "workers_admin_select" ON trade_workers FOR SELECT TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');

-- RLS trade_tarifas
ALTER TABLE trade_tarifas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tarifas_owner_all" ON trade_tarifas FOR ALL TO authenticated
  USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));
CREATE POLICY "tarifas_admin_select" ON trade_tarifas FOR SELECT TO authenticated
  USING (auth.email() = 'fercarboc@gmail.com');
;
