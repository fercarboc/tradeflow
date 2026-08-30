
-- ── Mayoristas / Distribuidores de material ──────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_mayoristas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  razon_social     TEXT,
  nif              TEXT,
  direccion_fiscal TEXT,
  cp               TEXT,
  ciudad           TEXT,
  provincia        TEXT,
  telefono         TEXT,
  email            TEXT,
  persona_contacto TEXT,
  web              TEXT,
  notas            TEXT,
  activo           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_mayoristas_org ON trade_mayoristas(org_id);

ALTER TABLE trade_mayoristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mayoristas_owner_all" ON trade_mayoristas FOR ALL
  USING  (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

CREATE POLICY "mayoristas_member_all" ON trade_mayoristas FOR ALL
  USING  (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true))
  WITH CHECK (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true));


-- ── Facturas de compra de material ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS trade_compras (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  mayorista_id        UUID REFERENCES trade_mayoristas(id) ON DELETE SET NULL,
  referencia_factura  TEXT,
  concepto            TEXT NOT NULL,
  importe             NUMERIC(10,2) NOT NULL DEFAULT 0,
  iva_pct             NUMERIC(5,2) NOT NULL DEFAULT 21,
  fecha               DATE,
  fecha_vencimiento   DATE,
  pagado              BOOLEAN NOT NULL DEFAULT FALSE,
  pagado_at           TIMESTAMPTZ,
  job_id              UUID REFERENCES trade_jobs(id) ON DELETE SET NULL,
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trade_compras_org ON trade_compras(org_id);
CREATE INDEX IF NOT EXISTS idx_trade_compras_mayorista ON trade_compras(mayorista_id);
CREATE INDEX IF NOT EXISTS idx_trade_compras_fecha ON trade_compras(fecha);

ALTER TABLE trade_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_owner_all" ON trade_compras FOR ALL
  USING  (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

CREATE POLICY "compras_member_all" ON trade_compras FOR ALL
  USING  (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true))
  WITH CHECK (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true));
;
