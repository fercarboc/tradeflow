
CREATE OR REPLACE FUNCTION public.admin_get_trade_users()
RETURNS TABLE (
  org_id          uuid,
  owner_id        uuid,
  auth_email      text,
  email_confirmed boolean,
  last_sign_in    timestamptz,
  user_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.email() != 'fercarboc@gmail.com' THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.owner_id,
    u.email::text,
    (u.email_confirmed_at IS NOT NULL),
    u.last_sign_in_at,
    u.created_at
  FROM auth.users u
  JOIN public.trade_organizations o ON o.owner_id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
;
