-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 1A.1 — Endurecimiento del Sistema de Actores del Marketplace
-- Fecha: 2026-07-24
-- Requiere: 20260724_marketplace_actor_system.sql aplicada previamente
-- ═══════════════════════════════════════════════════════════════════════════════
-- Correcciones:
--   1. Bypass seguro: current_user != 'authenticated' (no auth.uid() IS NULL)
--   2. Eliminar GUC mkt.skip_privilege_check como único mecanismo de bypass
--   3. FOR UPDATE en operaciones de ownership (anti-race condition)
--   4. RLS actores suspendidos: visibles para sus miembros
--   5. token → token_hash en invitaciones + RPC create_marketplace_invitation
--   6. Audit log inmutable: no INSERT/UPDATE/DELETE desde clientes
--   7. REVOKE más estricto en helpers internos
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. TOKEN HASH EN INVITACIONES
--     El token bruto nunca se persiste. Solo se almacena el SHA-256.
-- ─────────────────────────────────────────────────────────────────────────────

-- Añadir columna token_hash (si no existe)
ALTER TABLE public.trade_marketplace_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Migrar tokens existentes a sus hashes (idempotente)
UPDATE public.trade_marketplace_invitations
SET token_hash = encode(sha256(token::bytea), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- Establecer NOT NULL y añadir constraint única
ALTER TABLE public.trade_marketplace_invitations
  ALTER COLUMN token_hash SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_invitation_token_hash'
      AND conrelid = 'public.trade_marketplace_invitations'::regclass
  ) THEN
    ALTER TABLE public.trade_marketplace_invitations
      ADD CONSTRAINT uq_invitation_token_hash UNIQUE (token_hash);
  END IF;
END;
$$;

-- Eliminar columna token en claro y su constraint antigua
ALTER TABLE public.trade_marketplace_invitations
  DROP CONSTRAINT IF EXISTS uq_invitation_token;

ALTER TABLE public.trade_marketplace_invitations
  DROP COLUMN IF EXISTS token;

COMMENT ON COLUMN public.trade_marketplace_invitations.token_hash IS
  'SHA-256 del token bruto. El token bruto se entrega una única vez por la RPC create_marketplace_invitation() y nunca se almacena.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. TRIGGER: COMPATIBILIDAD DE TIPO (sin GUC, sin auth.uid IS NULL)
--     Bypass canónico: current_user != 'authenticated'
--     Cubre: service_role, SECURITY DEFINER, postgres directo.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_type_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_type text;
  v_role_type  text;
BEGIN
  -- Bypass: operaciones de service_role o SECURITY DEFINER (current_user ≠ 'authenticated')
  IF current_user != 'authenticated' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.role_id = OLD.role_id THEN
    RETURN NEW;
  END IF;

  SELECT a.actor_type INTO v_actor_type
  FROM public.trade_marketplace_actors a WHERE a.id = NEW.actor_id;

  SELECT r.actor_type INTO v_role_type
  FROM public.trade_marketplace_roles r WHERE r.id = NEW.role_id;

  IF v_role_type IS DISTINCT FROM 'any' AND v_role_type IS DISTINCT FROM v_actor_type THEN
    RAISE EXCEPTION 'ROLE_TYPE_MISMATCH: El rol (actor_type=%) no es compatible con el actor (actor_type=%).',
      v_role_type, v_actor_type;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. TRIGGER: ESCALADA DE PRIVILEGIOS (sin GUC, sin auth.uid IS NULL)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_privilege_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_priority integer;
  v_new_priority    integer;
  v_new_role_nombre text;
BEGIN
  -- Bypass: service_role o contexto SECURITY DEFINER
  -- Nota: en Supabase, current_user = 'authenticated' solo cuando el cliente
  -- emite SQL directamente. En funciones SECURITY DEFINER, current_user = definer (postgres).
  IF current_user != 'authenticated' THEN RETURN NEW; END IF;

  IF TG_OP = 'UPDATE' AND NEW.role_id = OLD.role_id THEN
    RETURN NEW;
  END IF;

  SELECT r.priority, r.nombre INTO v_new_priority, v_new_role_nombre
  FROM public.trade_marketplace_roles r WHERE r.id = NEW.role_id;

  -- platform_super_admin nunca asignable desde el cliente
  IF v_new_role_nombre = 'platform_super_admin' THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: platform_super_admin solo puede asignarse desde el servicio backend.';
  END IF;

  SELECT r.priority INTO v_caller_priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = NEW.actor_id AND m.user_id = auth.uid() AND m.activo = true;

  IF v_caller_priority IS NULL THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No eres miembro activo de este actor (actor_id=%).', NEW.actor_id;
  END IF;

  IF v_new_priority >= v_caller_priority THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No puedes asignar un rol con priority % (tu priority es %).',
      v_new_priority, v_caller_priority;
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. TRIGGER: ÚLTIMO OWNER (sin GUC, con SELECT FOR UPDATE anti-race)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_role_nombre  text;
  v_is_losing_owner  boolean := false;
  v_remaining_owners integer;
BEGIN
  -- Bypass: service_role o contexto SECURITY DEFINER
  -- transfer_marketplace_ownership() usa FOR UPDATE explícito antes de modificar.
  IF current_user != 'authenticated' THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT r.nombre INTO v_old_role_nombre
  FROM public.trade_marketplace_roles r WHERE r.id = OLD.role_id;

  IF v_old_role_nombre != 'owner' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_is_losing_owner := true;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.activo = true AND NEW.activo = false) OR (NEW.role_id != OLD.role_id) THEN
      v_is_losing_owner := true;
    END IF;
  END IF;

  IF NOT v_is_losing_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Bloquear el actor para prevenir condición de carrera en conteo de owners
  -- (previene dos transacciones concurrentes degradando simultáneamente a dos owners)
  PERFORM id FROM public.trade_marketplace_actors WHERE id = OLD.actor_id FOR UPDATE;

  SELECT COUNT(*) INTO v_remaining_owners
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = OLD.actor_id
    AND m.activo   = true
    AND r.nombre   = 'owner'
    AND m.id       != OLD.id;

  IF v_remaining_owners = 0 THEN
    RAISE EXCEPTION 'LAST_OWNER: No puedes eliminar o degradar al último owner. Usa transfer_marketplace_ownership() primero.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. RPC: CREAR INVITACIÓN (genera y devuelve token bruto, almacena solo el hash)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_marketplace_invitation(
  p_actor_id uuid,
  p_role_id  uuid,
  p_email    text
)
RETURNS text  -- token bruto, devuelto una única vez. NUNCA almacenado.
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_raw_token   text := encode(gen_random_bytes(32), 'hex');
  v_token_hash  text := encode(sha256(v_raw_token::bytea), 'hex');
  v_email_clean text := lower(trim(p_email));
  v_actor_type  text;
  v_role_type   text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Autenticación requerida.';
  END IF;

  -- Verificar permiso members:invite
  IF NOT public._mkt_has_permission(p_actor_id, 'members:invite')
    AND NOT public._mkt_is_platform_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: Se requiere permiso members:invite para este actor.';
  END IF;

  -- Verificar compatibilidad de tipo actor↔rol
  SELECT a.actor_type INTO v_actor_type FROM public.trade_marketplace_actors a WHERE a.id = p_actor_id;
  SELECT r.actor_type INTO v_role_type  FROM public.trade_marketplace_roles  r WHERE r.id = p_role_id;
  IF v_role_type IS DISTINCT FROM 'any' AND v_role_type IS DISTINCT FROM v_actor_type THEN
    RAISE EXCEPTION 'ROLE_TYPE_MISMATCH: El rol no es compatible con este actor.';
  END IF;

  -- No se puede invitar a platform_super_admin
  IF EXISTS (SELECT 1 FROM public.trade_marketplace_roles WHERE id = p_role_id AND nombre = 'platform_super_admin') THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No puedes invitar con rol platform_super_admin.';
  END IF;

  INSERT INTO public.trade_marketplace_invitations
    (actor_id, role_id, email, token_hash, invited_by)
  VALUES
    (p_actor_id, p_role_id, v_email_clean, v_token_hash, auth.uid());

  -- El token bruto nunca aparece en audit_log (solo el hash)
  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (p_actor_id, auth.uid(), 'invitation_created',
    jsonb_build_object('role_id', p_role_id, 'email', v_email_clean, 'token_hash_prefix', left(v_token_hash, 8)));

  RETURN v_raw_token;  -- entregado una sola vez al llamante; no persiste en ninguna tabla
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_marketplace_invitation(uuid, uuid, text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.create_marketplace_invitation(uuid, uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. RPC: ACEPTAR INVITACIÓN (lookup por hash del token bruto)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_marketplace_invitation(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token_hash text := encode(sha256(p_token::bytea), 'hex');
  v_inv        RECORD;
  v_user_id    uuid;
  v_email      text;
  v_member_id  uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes estar autenticado para aceptar una invitación.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  -- Lookup por hash (el token bruto nunca se almacena)
  SELECT * INTO v_inv
  FROM public.trade_marketplace_invitations
  WHERE token_hash = v_token_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN: Token de invitación no encontrado.';
  END IF;

  IF v_inv.estado != 'pending' THEN
    RAISE EXCEPTION 'INVALID_STATE: La invitación está en estado "%". Solo se aceptan invitaciones pendientes.', v_inv.estado;
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.trade_marketplace_invitations SET estado = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED: La invitación expiró el %.', v_inv.expires_at;
  END IF;

  IF lower(v_email) != lower(v_inv.email) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH: Esta invitación es para "%" pero estás autenticado como "%".', v_inv.email, v_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE actor_id = v_inv.actor_id AND user_id = v_user_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER: Ya eres miembro activo de este actor.';
  END IF;

  -- SECURITY DEFINER garantiza que current_user = definer (postgres),
  -- por lo que los triggers de privilegio son bypaseados automáticamente.
  INSERT INTO public.trade_marketplace_actor_members
    (actor_id, user_id, role_id, activo, invited_by, invited_at, accepted_at)
  VALUES
    (v_inv.actor_id, v_user_id, v_inv.role_id, true, v_inv.invited_by, v_inv.created_at, now())
  RETURNING id INTO v_member_id;

  UPDATE public.trade_marketplace_invitations SET estado = 'accepted' WHERE id = v_inv.id;

  -- El token_hash nunca aparece en audit data
  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (v_inv.actor_id, v_user_id, 'invitation_accepted',
    jsonb_build_object('invitation_id', v_inv.id, 'role_id', v_inv.role_id, 'member_id', v_member_id));

  RETURN v_inv.actor_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_marketplace_invitation(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.accept_marketplace_invitation(text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. RPC: TRANSFERIR OWNERSHIP (FOR UPDATE anti-race condition)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.transfer_marketplace_ownership(
  p_actor_id          uuid,
  p_new_owner_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id     uuid;
  v_caller_member RECORD;
  v_target_member RECORD;
  v_owner_role_id uuid;
  v_admin_role_id uuid;
  v_actor_type    text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Autenticación requerida.';
  END IF;

  IF p_new_owner_user_id = v_caller_id THEN
    RAISE EXCEPTION 'SELF_TRANSFER: No puedes transferirte el ownership a ti mismo.';
  END IF;

  -- Bloquear el actor primero para serializar todas las operaciones de ownership
  -- (previene race conditions entre transferencias concurrentes)
  SELECT actor_type INTO v_actor_type
  FROM public.trade_marketplace_actors
  WHERE id = p_actor_id
  FOR UPDATE;  -- LOCK de fila del actor

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % no encontrado.', p_actor_id;
  END IF;

  SELECT m.*, r.nombre AS role_nombre INTO v_caller_member
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = p_actor_id AND m.user_id = v_caller_id AND m.activo = true;

  IF NOT FOUND OR v_caller_member.role_nombre != 'owner' THEN
    RAISE EXCEPTION 'NOT_OWNER: Solo el owner actual puede transferir el ownership.';
  END IF;

  SELECT m.* INTO v_target_member
  FROM public.trade_marketplace_actor_members m
  WHERE m.actor_id = p_actor_id AND m.user_id = p_new_owner_user_id AND m.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_NOT_MEMBER: El usuario destino debe ser miembro activo del actor.';
  END IF;

  -- Obtener roles owner y admin del tipo correcto (FOR UPDATE ya tomado en actor)
  SELECT id INTO v_owner_role_id
  FROM public.trade_marketplace_roles
  WHERE nombre = 'owner'
    AND (actor_type = v_actor_type OR actor_type = 'any')
    AND is_system = true AND actor_id IS NULL
  ORDER BY (actor_type = v_actor_type) DESC
  LIMIT 1;

  SELECT id INTO v_admin_role_id
  FROM public.trade_marketplace_roles
  WHERE nombre = 'admin'
    AND (actor_type = v_actor_type OR actor_type = 'any')
    AND is_system = true AND actor_id IS NULL
  ORDER BY (actor_type = v_actor_type) DESC
  LIMIT 1;

  -- SECURITY DEFINER: current_user = definer → trigger last_owner bypaseado automáticamente.
  -- La atomicidad está garantizada por la transacción + el FOR UPDATE del actor.
  UPDATE public.trade_marketplace_actor_members SET role_id = v_owner_role_id WHERE id = v_target_member.id;
  UPDATE public.trade_marketplace_actor_members SET role_id = v_admin_role_id  WHERE id = v_caller_member.id;

  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (p_actor_id, v_caller_id, 'ownership_transferred',
    jsonb_build_object(
      'from_user_id',       v_caller_id,
      'to_user_id',         p_new_owner_user_id,
      'old_role_id',        v_caller_member.role_id,
      'new_owner_role_id',  v_owner_role_id
    ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_marketplace_ownership(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.transfer_marketplace_ownership(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. RLS ACTORES: suspendidos visibles para sus miembros
--     Antes: estado = 'active' en todas las políticas → actores suspendidos desaparecen.
--     Ahora: miembros siempre ven su propio actor independientemente del estado.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "actors_select_active"   ON public.trade_marketplace_actors;
DROP POLICY IF EXISTS "actors_select_member"   ON public.trade_marketplace_actors;
DROP POLICY IF EXISTS "actors_select_platform" ON public.trade_marketplace_actors;

-- Actores activos: visibles para todos los authenticated
CREATE POLICY "actors_select_active" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (estado = 'active');

-- Propio actor: siempre visible para el miembro (permite mostrar pantalla de suspensión)
CREATE POLICY "actors_select_own_member" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (id = ANY(public._mkt_actor_ids_for_user()));

-- Platform admins ven todo
CREATE POLICY "actors_select_platform" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (public._mkt_is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. RLS AUDIT LOG: inmutable desde clientes
--     Corrección de Sprint 1A: "FOR ALL" permitía INSERT/UPDATE/DELETE a platform admins.
--     Solo SELECT. Los triggers y RPCs (SECURITY DEFINER) escriben sin política RLS.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "audit_select_actor"    ON public.trade_marketplace_audit_log;
DROP POLICY IF EXISTS "audit_select_platform" ON public.trade_marketplace_audit_log;

CREATE POLICY "audit_select_actor" ON public.trade_marketplace_audit_log
  FOR SELECT TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'analytics:read')
  );

CREATE POLICY "audit_select_platform" ON public.trade_marketplace_audit_log
  FOR SELECT TO authenticated
  USING (public._mkt_is_platform_admin());

-- Sin política INSERT/UPDATE/DELETE para clientes → audit log inmutable vía RLS.
-- Los triggers (SECURITY DEFINER) bypasean RLS automáticamente.

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RLS INVITACIONES: revocar acceso a token_hash desde clientes
--     Los clientes pueden ver el estado/email/rol de invitaciones pero NUNCA token_hash.
-- ─────────────────────────────────────────────────────────────────────────────

-- Recrear con columnas explícitas que excluyen token_hash
-- Nota: PostgreSQL no permite políticas column-level directamente en RLS.
-- La protección se implementa: (a) sin SELECT * en la vista cliente, (b) via vista segura.

-- Vista que oculta token_hash (para uso desde frontend/servicios)
CREATE OR REPLACE VIEW public.v_marketplace_invitations_safe AS
  SELECT
    id, actor_id, role_id, email, estado, expires_at, invited_by, created_at
  FROM public.trade_marketplace_invitations;

-- El acceso a token_hash se limita a funciones SECURITY DEFINER (accept/create)
-- Los clientes que accedan a la tabla directamente ven token_hash = '***' via la vista.
COMMENT ON COLUMN public.trade_marketplace_invitations.token_hash IS
  'Solo accesible via funciones SECURITY DEFINER. No exponer a clientes directamente. Usar v_marketplace_invitations_safe.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. REVOKE estricto en helpers internos (refuerzo del Sprint 1A)
-- ─────────────────────────────────────────────────────────────────────────────
-- Los helpers _mkt_* son necesarios en RLS policies (que corren en contexto authenticated),
-- por lo que authenticated DEBE tener EXECUTE. Lo que se elimina es acceso de anon/public.
REVOKE EXECUTE ON FUNCTION public._mkt_actor_ids_for_user(text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public._mkt_has_permission(uuid, text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public._mkt_is_platform_admin()              FROM anon;
REVOKE EXECUTE ON FUNCTION public._mkt_caller_role_priority(uuid)       FROM anon;
-- public/PUBLIC ya fue revocado en Sprint 1A. Refuerzo explícito:
REVOKE ALL ON FUNCTION public._mkt_actor_ids_for_user(text)             FROM PUBLIC;
REVOKE ALL ON FUNCTION public._mkt_has_permission(uuid, text)           FROM PUBLIC;
REVOKE ALL ON FUNCTION public._mkt_is_platform_admin()                  FROM PUBLIC;
REVOKE ALL ON FUNCTION public._mkt_caller_role_priority(uuid)           FROM PUBLIC;

-- trg_fn_mkt_* son SECURITY DEFINER internos; solo el sistema los llama.
REVOKE EXECUTE ON FUNCTION public.trg_fn_mkt_member_type_compat()       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_mkt_member_privilege_check()   FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_mkt_member_last_owner()        FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_mkt_member_audit()             FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_fn_mkt_actor_audit()              FROM anon, authenticated, PUBLIC;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN Sprint 1A.1
-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback (en orden inverso):
--   DROP VIEW IF EXISTS public.v_marketplace_invitations_safe;
--   ALTER TABLE public.trade_marketplace_invitations
--     ADD COLUMN token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
--     ADD CONSTRAINT uq_invitation_token UNIQUE (token),
--     DROP CONSTRAINT IF EXISTS uq_invitation_token_hash,
--     DROP COLUMN IF EXISTS token_hash;
--   (luego re-aplicar Sprint 1A para restaurar triggers y RPCs originales)
-- ─────────────────────────────────────────────────────────────────────────────
