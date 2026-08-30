
-- Técnicos pueden leer los clientes de la org a la que pertenecen
CREATE POLICY "workers_can_read_org_clients"
ON trade_clients FOR SELECT TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM trade_org_members
    WHERE user_id = auth.uid() AND activo = true
  )
);
;
