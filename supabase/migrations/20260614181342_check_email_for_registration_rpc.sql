
CREATE OR REPLACE FUNCTION check_email_for_registration(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_own_org_nombre text;
  v_member_org_nombre text;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('exists', false);
  END IF;

  SELECT nombre INTO v_own_org_nombre
  FROM trade_organizations
  WHERE owner_id = v_user_id
  LIMIT 1;

  IF v_own_org_nombre IS NOT NULL THEN
    RETURN jsonb_build_object('exists', true, 'type', 'owner', 'org_nombre', v_own_org_nombre);
  END IF;

  SELECT o.nombre INTO v_member_org_nombre
  FROM trade_org_members m
  JOIN trade_organizations o ON o.id = m.org_id
  WHERE m.user_id = v_user_id
    AND m.activo = true
  LIMIT 1;

  IF v_member_org_nombre IS NOT NULL THEN
    RETURN jsonb_build_object('exists', true, 'type', 'tecnico', 'org_nombre', v_member_org_nombre);
  END IF;

  RETURN jsonb_build_object('exists', true, 'type', 'orphan');
END;
$$;

GRANT EXECUTE ON FUNCTION check_email_for_registration(text) TO anon, authenticated;
;
