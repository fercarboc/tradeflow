
-- ── 1. Empresas subcontratadas ─────────────────────────────────────────────
CREATE TABLE trade_subcontractors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  nif          TEXT,
  email        TEXT,
  telefono     TEXT,
  especialidad TEXT,
  notas        TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_subcontractors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontractors_owner_all"
ON trade_subcontractors FOR ALL TO authenticated
USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

CREATE POLICY "subcontractors_member_select"
ON trade_subcontractors FOR SELECT TO authenticated
USING (org_id IN (SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = true));

CREATE POLICY "subcontractors_admin_select"
ON trade_subcontractors FOR SELECT TO authenticated
USING (auth.email() = 'fercarboc@gmail.com');

-- ── 2. Asignaciones de subcontrata ─────────────────────────────────────────
CREATE TABLE trade_subcontratas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  subcontractor_id   UUID NOT NULL REFERENCES trade_subcontractors(id) ON DELETE RESTRICT,
  job_id             UUID REFERENCES trade_jobs(id) ON DELETE SET NULL,
  contract_id        UUID REFERENCES trade_contracts(id) ON DELETE SET NULL,
  descripcion        TEXT NOT NULL DEFAULT '',
  coste              NUMERIC(10,2) NOT NULL DEFAULT 0,   -- lo que te cobra el subcontratista
  precio_cliente     NUMERIC(10,2) NOT NULL DEFAULT 0,   -- lo que tú cobras al cliente
  estado             TEXT NOT NULL DEFAULT 'pendiente'
                       CHECK (estado IN ('pendiente','en_curso','completado','cancelado')),
  fecha_inicio       DATE,
  fecha_fin_prevista DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_subcontratas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontratas_owner_all"
ON trade_subcontratas FOR ALL TO authenticated
USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

CREATE POLICY "subcontratas_admin_select"
ON trade_subcontratas FOR SELECT TO authenticated
USING (auth.email() = 'fercarboc@gmail.com');

-- ── 3. Notas / historial ───────────────────────────────────────────────────
CREATE TABLE trade_subcontrata_notas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontrata_id   UUID NOT NULL REFERENCES trade_subcontratas(id) ON DELETE CASCADE,
  org_id           UUID NOT NULL,
  texto            TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE trade_subcontrata_notas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontrata_notas_owner_all"
ON trade_subcontrata_notas FOR ALL TO authenticated
USING (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()))
WITH CHECK (org_id IN (SELECT id FROM trade_organizations WHERE owner_id = auth.uid()));

-- Índices
CREATE INDEX ON trade_subcontratas(org_id);
CREATE INDEX ON trade_subcontratas(job_id);
CREATE INDEX ON trade_subcontratas(contract_id);
CREATE INDEX ON trade_subcontrata_notas(subcontrata_id);
;
