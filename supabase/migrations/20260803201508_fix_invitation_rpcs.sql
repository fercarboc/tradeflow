-- ============================================================
-- PRE-RC1 O-Bug + O-3a: Fix RPCs de invitación de marketplace
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_marketplace_invitation(
  p_actor_id uuid,
  p_role_id  uuid,
  p_email    text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw_token   text := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash  text := encode(sha256(v_raw_token::bytea), 'hex');
  v_email_clean text := lower(trim(p_email));
  v_actor_type  text;
  v_role_type   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Autenticación requerida.';
  END IF;
  IF NOT public._mkt_has_permission(p_actor_id, 'members:invite')
     AND NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere permiso members:invite para este actor.';
  END IF;
  SELECT a.actor_type INTO v_actor_type FROM public.trade_marketplace_actors a WHERE a.id = p_actor_id;
  SELECT r.actor_type INTO v_role_type  FROM public.trade_marketplace_roles  r WHERE r.id = p_role_id;
  IF v_role_type IS DISTINCT FROM 'any' AND v_role_type IS DISTINCT FROM v_actor_type THEN
    RAISE EXCEPTION 'ROLE_TYPE_MISMATCH: El rol no es compatible con este actor.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.trade_marketplace_roles WHERE id = p_role_id AND nombre = 'platform_super_admin') THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No puedes invitar con rol platform_super_admin.';
  END IF;
  INSERT INTO public.trade_marketplace_invitations (actor_id, role_id, email, token_hash, invited_by)
  VALUES (p_actor_id, p_role_id, v_email_clean, v_token_hash, auth.uid());
  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (p_actor_id, auth.uid(), 'invitation_created',
    jsonb_build_object('role_id', p_role_id, 'email', v_email_clean, 'token_hash_prefix', left(v_token_hash, 8)));
  RETURN v_raw_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.resend_supplier_invitation(
  p_actor_id      uuid,
  p_invitation_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_raw_token  text;
  v_token_hash text;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:invite') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para gestionar invitaciones.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_invitations
    WHERE id = p_invitation_id AND actor_id = p_actor_id AND estado IN ('pending', 'expired')
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Invitación no encontrada o no reenvíable.';
  END IF;
  v_raw_token  := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');
  UPDATE public.trade_marketplace_invitations
  SET token_hash = v_token_hash, expires_at = now() + interval '7 days',
      estado = 'pending', created_at = now()
  WHERE id = p_invitation_id;
  RETURN v_raw_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_marketplace_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_hash text := encode(sha256(p_token::bytea), 'hex');
  v_inv        RECORD;
BEGIN
  SELECT i.*, a.nombre AS actor_nombre, r.nombre AS role_nombre
  INTO v_inv
  FROM public.trade_marketplace_invitations i
  JOIN public.trade_marketplace_actors a ON a.id = i.actor_id
  JOIN public.trade_marketplace_roles  r ON r.id = i.role_id
  WHERE i.token_hash = v_token_hash;

  IF NOT FOUND THEN RETURN jsonb_build_object('estado', 'invalid_token'); END IF;

  IF v_inv.estado = 'accepted' THEN RETURN jsonb_build_object('estado', 'already_accepted', 'email', v_inv.email); END IF;
  IF v_inv.estado = 'revoked'  THEN RETURN jsonb_build_object('estado', 'revoked',           'email', v_inv.email); END IF;
  IF v_inv.estado != 'pending' THEN RETURN jsonb_build_object('estado', v_inv.estado,         'email', v_inv.email); END IF;
  IF v_inv.expires_at < now()  THEN RETURN jsonb_build_object('estado', 'expired',            'email', v_inv.email, 'expires_at', v_inv.expires_at); END IF;

  RETURN jsonb_build_object(
    'estado', 'valid', 'actor_id', v_inv.actor_id, 'actor_nombre', v_inv.actor_nombre,
    'role_nombre', v_inv.role_nombre, 'email', v_inv.email, 'expires_at', v_inv.expires_at
  );
END;
$$;

COMMENT ON FUNCTION public.preview_marketplace_invitation(text) IS
'Info pública de invitación por token raw. Sin auth. Solo datos seguros.';
;
