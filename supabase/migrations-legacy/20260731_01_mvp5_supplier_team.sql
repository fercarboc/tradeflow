-- MVP-5: Gestión de equipo del proveedor
-- 9 funciones nuevas para gestión completa de miembros, invitaciones, roles y auditoría.
-- Todas SECURITY DEFINER SET search_path = public.

-- ── 1. get_supplier_team ──────────────────────────────────────────────────────
-- Lista paginada de miembros con email y nombre desde auth.users.
-- Devuelve {items: [...], total_count: N}
CREATE OR REPLACE FUNCTION public.get_supplier_team(
  p_actor_id uuid,
  p_search   text    DEFAULT NULL,
  p_activo   boolean DEFAULT NULL,
  p_limit    integer DEFAULT 25,
  p_offset   integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  WITH filtered AS (
    SELECT
      m.id,
      m.actor_id,
      m.user_id,
      au.email,
      COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
      ) AS nombre,
      m.role_id,
      r.nombre      AS role_nombre,
      r.priority    AS role_priority,
      m.activo,
      m.accepted_at,
      m.last_accessed_at,
      m.created_at
    FROM public.trade_marketplace_actor_members m
    JOIN auth.users au ON au.id = m.user_id
    JOIN public.trade_marketplace_roles r ON r.id = m.role_id
    WHERE m.actor_id = p_actor_id
      AND (p_activo IS NULL OR m.activo = p_activo)
      AND (
        p_search IS NULL OR p_search = '' OR
        au.email ILIKE '%' || p_search || '%' OR
        COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '') ILIKE '%' || p_search || '%'
      )
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY activo DESC, role_priority DESC, created_at
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',               p.id,
        'actor_id',         p.actor_id,
        'user_id',          p.user_id,
        'email',            p.email,
        'nombre',           p.nombre,
        'role_id',          p.role_id,
        'role_nombre',      p.role_nombre,
        'role_priority',    p.role_priority,
        'activo',           p.activo,
        'accepted_at',      p.accepted_at,
        'last_accessed_at', p.last_accessed_at,
        'created_at',       p.created_at
      )
    ), '[]'::jsonb),
    'total_count', (SELECT cnt FROM total)::integer
  )
  INTO v_result
  FROM paged p;

  RETURN COALESCE(v_result, jsonb_build_object('items', '[]'::jsonb, 'total_count', 0));
END;
$$;


-- ── 2. get_supplier_invitations ───────────────────────────────────────────────
-- Devuelve todas las invitaciones del actor con nombre del rol e email del invitante.
CREATE OR REPLACE FUNCTION public.get_supplier_invitations(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',               inv.id,
      'actor_id',         inv.actor_id,
      'role_id',          inv.role_id,
      'role_nombre',      r.nombre,
      'role_priority',    r.priority,
      'email',            inv.email,
      'estado',           inv.estado,
      'expires_at',       inv.expires_at,
      'invited_by',       inv.invited_by,
      'invited_by_email', inviter.email,
      'created_at',       inv.created_at
    ) ORDER BY inv.created_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.trade_marketplace_invitations inv
  JOIN public.trade_marketplace_roles r ON r.id = inv.role_id
  LEFT JOIN auth.users inviter ON inviter.id = inv.invited_by
  WHERE inv.actor_id = p_actor_id;

  RETURN v_result;
END;
$$;


-- ── 3. revoke_supplier_invitation ─────────────────────────────────────────────
-- Revoca (cancela) una invitación pendiente. Requiere members:invite.
CREATE OR REPLACE FUNCTION public.revoke_supplier_invitation(
  p_actor_id      uuid,
  p_invitation_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:invite') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para gestionar invitaciones.';
  END IF;

  UPDATE public.trade_marketplace_invitations
  SET estado = 'cancelled'
  WHERE id       = p_invitation_id
    AND actor_id = p_actor_id
    AND estado   = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Invitación no encontrada o no cancelable.';
  END IF;
END;
$$;


-- ── 4. resend_supplier_invitation ─────────────────────────────────────────────
-- Genera un nuevo token y extiende la invitación 7 días. Requiere members:invite.
-- Devuelve el token bruto (mostrar una sola vez al invitante).
CREATE OR REPLACE FUNCTION public.resend_supplier_invitation(
  p_actor_id      uuid,
  p_invitation_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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
    WHERE id = p_invitation_id
      AND actor_id = p_actor_id
      AND estado IN ('pending', 'expired')
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND_OR_INVALID_STATE: Invitación no encontrada o no reenvíable.';
  END IF;

  v_raw_token  := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(sha256(v_raw_token::bytea), 'hex');

  UPDATE public.trade_marketplace_invitations
  SET token_hash = v_token_hash,
      expires_at = now() + interval '7 days',
      estado     = 'pending',
      created_at = now()
  WHERE id = p_invitation_id;

  RETURN v_raw_token;
END;
$$;


-- ── 5. deactivate_team_member ─────────────────────────────────────────────────
-- Desactiva un miembro. Requiere members:manage y prioridad mayor al miembro.
-- El trigger trg_fn_mkt_member_last_owner impide desactivar al último owner.
CREATE OR REPLACE FUNCTION public.deactivate_team_member(
  p_actor_id  uuid,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_priority  integer;
  v_member_priority  integer;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:manage') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para gestionar miembros.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE id = p_member_id AND actor_id = p_actor_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Miembro no encontrado o ya inactivo.';
  END IF;

  v_caller_priority := public._mkt_caller_role_priority(p_actor_id);

  SELECT r.priority INTO v_member_priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.id = p_member_id;

  IF v_caller_priority <= v_member_priority THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin privilegio suficiente para desactivar a este miembro.';
  END IF;

  UPDATE public.trade_marketplace_actor_members
  SET activo = false
  WHERE id = p_member_id;
END;
$$;


-- ── 6. reactivate_team_member ─────────────────────────────────────────────────
-- Reactiva un miembro previamente desactivado. Requiere members:manage.
CREATE OR REPLACE FUNCTION public.reactivate_team_member(
  p_actor_id  uuid,
  p_member_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_priority integer;
  v_member_priority integer;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:manage') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para gestionar miembros.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE id = p_member_id AND actor_id = p_actor_id AND activo = false
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Miembro no encontrado o ya activo.';
  END IF;

  v_caller_priority := public._mkt_caller_role_priority(p_actor_id);

  SELECT r.priority INTO v_member_priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.id = p_member_id;

  IF v_caller_priority <= v_member_priority THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin privilegio suficiente para reactivar a este miembro.';
  END IF;

  UPDATE public.trade_marketplace_actor_members
  SET activo = true
  WHERE id = p_member_id;
END;
$$;


-- ── 7. update_team_member_role ────────────────────────────────────────────────
-- Cambia el rol de un miembro. El trigger trg_fn_mkt_member_privilege_check
-- impide escalada de privilegios y trg_fn_mkt_member_last_owner protege al owner.
CREATE OR REPLACE FUNCTION public.update_team_member_role(
  p_actor_id  uuid,
  p_member_id uuid,
  p_role_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_priority   integer;
  v_member_priority   integer;
  v_new_role_priority integer;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:manage') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para gestionar miembros.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE id = p_member_id AND actor_id = p_actor_id
  ) THEN
    RAISE EXCEPTION 'NOT_FOUND: Miembro no encontrado.';
  END IF;

  v_caller_priority := public._mkt_caller_role_priority(p_actor_id);

  SELECT r.priority INTO v_member_priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.id = p_member_id;

  SELECT priority INTO v_new_role_priority
  FROM public.trade_marketplace_roles
  WHERE id = p_role_id;

  IF v_new_role_priority IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Rol no encontrado.';
  END IF;

  IF v_caller_priority <= v_member_priority OR v_caller_priority <= v_new_role_priority THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin privilegio suficiente para asignar este rol.';
  END IF;

  UPDATE public.trade_marketplace_actor_members
  SET role_id = p_role_id
  WHERE id = p_member_id;
END;
$$;


-- ── 8. get_supplier_audit_log ─────────────────────────────────────────────────
-- Log de auditoría paginado con email del usuario. Requiere members:manage.
-- Devuelve {items: [...], total_count: N}
CREATE OR REPLACE FUNCTION public.get_supplier_audit_log(
  p_actor_id uuid,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._mkt_has_permission(p_actor_id, 'members:manage') THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin permiso para ver el log de auditoría.';
  END IF;

  WITH filtered AS (
    SELECT
      al.id,
      al.user_id,
      au.email AS user_email,
      COALESCE(
        au.raw_user_meta_data->>'full_name',
        au.raw_user_meta_data->>'name',
        au.email,
        'Sistema'
      ) AS user_nombre,
      al.event_type,
      al.event_data,
      al.created_at
    FROM public.trade_marketplace_audit_log al
    LEFT JOIN auth.users au ON au.id = al.user_id
    WHERE al.actor_id = p_actor_id
  ),
  paged AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    LIMIT p_limit OFFSET p_offset
  ),
  total AS (SELECT COUNT(*) AS cnt FROM filtered)
  SELECT jsonb_build_object(
    'items', COALESCE(jsonb_agg(
      jsonb_build_object(
        'id',          p.id,
        'user_id',     p.user_id,
        'user_email',  p.user_email,
        'user_nombre', p.user_nombre,
        'event_type',  p.event_type,
        'event_data',  p.event_data,
        'created_at',  p.created_at
      )
    ), '[]'::jsonb),
    'total_count', (SELECT cnt FROM total)::integer
  )
  INTO v_result
  FROM paged p;

  RETURN COALESCE(v_result, jsonb_build_object('items', '[]'::jsonb, 'total_count', 0));
END;
$$;


-- ── 9. get_supplier_roles ─────────────────────────────────────────────────────
-- Devuelve los roles de sistema disponibles para proveedores, ordenados por prioridad.
CREATE OR REPLACE FUNCTION public.get_supplier_roles(
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id',          r.id,
      'nombre',      r.nombre,
      'descripcion', r.descripcion,
      'permissions', r.permissions,
      'priority',    r.priority
    ) ORDER BY r.priority ASC
  ), '[]'::jsonb)
  INTO v_result
  FROM public.trade_marketplace_roles r
  WHERE r.actor_type = 'supplier'
    AND r.is_system  = true
    AND r.actor_id   IS NULL;

  RETURN v_result;
END;
$$;
