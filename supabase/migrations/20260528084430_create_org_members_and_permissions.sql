
-- trade_org_members: vincula usuarios a organizaciones con un rol
CREATE TABLE IF NOT EXISTS trade_org_members (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      uuid REFERENCES trade_organizations(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rol         text NOT NULL DEFAULT 'tecnico'
                CHECK (rol IN ('owner','admin','comercial','tecnico','visualizador')),
  activo      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- trade_org_permissions: overrides granulares sobre el rol base
CREATE TABLE IF NOT EXISTS trade_org_permissions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id   uuid REFERENCES trade_org_members(id) ON DELETE CASCADE NOT NULL,
  permiso     text NOT NULL,
  granted     boolean DEFAULT true,
  UNIQUE (member_id, permiso)
);

-- Activar RLS
ALTER TABLE trade_org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_org_permissions ENABLE ROW LEVEL SECURITY;

-- Política: cualquier miembro de la org puede ver los demás miembros
CREATE POLICY "members_select" ON trade_org_members
  FOR SELECT USING (
    org_id IN (
      SELECT org_id FROM trade_org_members WHERE user_id = auth.uid()
    )
  );

-- Política: solo owner/admin pueden insertar, actualizar o eliminar miembros
CREATE POLICY "members_manage" ON trade_org_members
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM trade_org_members
      WHERE user_id = auth.uid() AND rol IN ('owner','admin')
    )
  );

-- Política: los permisos los ve cualquier miembro de la org
CREATE POLICY "permissions_select" ON trade_org_permissions
  FOR SELECT USING (
    member_id IN (
      SELECT m.id FROM trade_org_members m
      WHERE m.org_id IN (
        SELECT org_id FROM trade_org_members WHERE user_id = auth.uid()
      )
    )
  );

-- Política: solo owner/admin gestionan permisos
CREATE POLICY "permissions_manage" ON trade_org_permissions
  FOR ALL USING (
    member_id IN (
      SELECT m.id FROM trade_org_members m
      WHERE m.org_id IN (
        SELECT org_id FROM trade_org_members
        WHERE user_id = auth.uid() AND rol IN ('owner','admin')
      )
    )
  );
;
