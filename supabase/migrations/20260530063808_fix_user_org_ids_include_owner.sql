
-- _user_org_ids() solo buscaba en trade_org_members (miembros invitados).
-- El propietario de la org solo existe en trade_organizations.owner_id,
-- por eso los inserts en tablas de mantenimiento daban 403 para el owner.
CREATE OR REPLACE FUNCTION public._user_org_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(ARRAY_AGG(DISTINCT id_org), '{}')
  FROM (
    -- Orgs donde el usuario es miembro invitado
    SELECT org_id AS id_org
    FROM trade_org_members
    WHERE user_id = auth.uid()
    UNION ALL
    -- Orgs donde el usuario es el propietario
    SELECT id AS id_org
    FROM trade_organizations
    WHERE owner_id = auth.uid()
  ) sub
$function$;
;
