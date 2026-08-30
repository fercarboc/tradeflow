
-- 1. Vincular miembro del equipo con perfil de trabajador de campo
ALTER TABLE trade_org_members
  ADD COLUMN IF NOT EXISTS worker_profile_id UUID REFERENCES trade_workers(id) ON DELETE SET NULL;

-- 2. Notas de campo del trabajador en cada trabajo
ALTER TABLE trade_jobs
  ADD COLUMN IF NOT EXISTS notas_trabajador TEXT,
  ADD COLUMN IF NOT EXISTS notas_trabajador_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notas_trabajador_leida BOOLEAN DEFAULT FALSE;

-- 3. Tabla de acciones pendientes generadas por trabajadores en campo
CREATE TABLE IF NOT EXISTS trade_field_actions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES trade_organizations(id) ON DELETE CASCADE,
  job_id        UUID REFERENCES trade_jobs(id) ON DELETE SET NULL,
  worker_id     UUID REFERENCES trade_workers(id) ON DELETE SET NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('presupuesto_requerido','material_necesario','incidencia','consulta','otro')),
  descripcion   TEXT NOT NULL,
  estado        TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','en_proceso','resuelto','descartado')),
  resuelto_por  UUID REFERENCES trade_org_members(id) ON DELETE SET NULL,
  resuelto_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS trade_field_actions
ALTER TABLE trade_field_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org members can manage field actions" ON trade_field_actions;
CREATE POLICY "org members can manage field actions" ON trade_field_actions
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid() AND activo = TRUE
      UNION
      SELECT id FROM trade_organizations WHERE owner_id = auth.uid()
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_field_actions_org ON trade_field_actions(org_id);
CREATE INDEX IF NOT EXISTS idx_field_actions_job ON trade_field_actions(job_id);
CREATE INDEX IF NOT EXISTS idx_field_actions_estado ON trade_field_actions(estado);
CREATE INDEX IF NOT EXISTS idx_org_members_worker_profile ON trade_org_members(worker_profile_id);
;
