-- ═══════════════════════════════════════════════════════════════════════════════
-- SPRINT 1A — Sistema de Actores del Marketplace
-- Fecha: 2026-07-24
-- Reglas: NO destructivo · idempotente · SECURITY DEFINER SET search_path = public
-- Compatible con: trade_organizations · trade_org_members · trade_org_permissions
--                 trade-voice-to-quote v59 (INTOCABLE)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- 01. TIPOS DE ACTOR (extensibles via datos, sin CHECK constraint)
--     Añadir un nuevo tipo = INSERT, no migración.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_actor_types (
  id          text        PRIMARY KEY,          -- 'supplier' | 'brand' | 'logistics' | …
  label       text        NOT NULL,             -- "Proveedor" (i18n futuro)
  descripcion text,
  icono       text,
  activo      boolean     NOT NULL DEFAULT true,
  posicion    integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_actor_types IS
  'Catálogo de tipos de actor del Marketplace. Extensible via INSERT — no requiere migración de esquema.';
COMMENT ON COLUMN public.trade_marketplace_actor_types.id IS
  '"any" es un tipo especial reservado para roles compatibles con todos los tipos de actor.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 02. ACTORES DEL MARKETPLACE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_actors (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type          text        NOT NULL
    REFERENCES public.trade_marketplace_actor_types(id) ON UPDATE CASCADE,
  nombre              text        NOT NULL,
  slug                text        NOT NULL,
  legal_name          text,
  tax_id              text,
  country             char(2)     NOT NULL DEFAULT 'ES',
  logo_url            text,
  website             text,
  email_contacto      text,
  telefono            text,
  estado              text        NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_actor_estado CHECK (estado IN ('pending','active','suspended','banned')),
  verificado          boolean     NOT NULL DEFAULT false,
  verificado_at       timestamptz,
  verificado_by       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Puentes de compatibilidad con el Core (nullable — no todos los actores vienen del sistema legado)
  supplier_catalog_id uuid        REFERENCES public.trade_supplier_catalogs(id) ON DELETE SET NULL,
  brand_id            uuid        REFERENCES public.trade_marketplace_brands(id) ON DELETE SET NULL,
  -- Atributos tipo-específicos hasta que cada tipo tenga tabla de extensión propia (Fase 2)
  metadata            jsonb       NOT NULL DEFAULT '{}',
  settings            jsonb       NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_actor_slug UNIQUE (slug)
);

COMMENT ON TABLE public.trade_marketplace_actors IS
  'Entidad base de todo actor del Marketplace: proveedor, fabricante, logística, asociación, plataforma, partner.';
COMMENT ON COLUMN public.trade_marketplace_actors.slug IS
  'Inmutable una vez creado. Identifica el actor en URLs (/proveedor/{slug}/...).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 03. ROLES (filas, no enums; extensibles sin despliegue)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_roles (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type   text        NOT NULL
    REFERENCES public.trade_marketplace_actor_types(id) ON UPDATE CASCADE,
  nombre       text        NOT NULL,
  descripcion  text,
  -- Array de strings: ["offerings:read","orders:manage",…]
  -- Toda evaluación pasa por _mkt_has_permission(). Nunca leer JSONB directamente.
  permissions  jsonb       NOT NULL DEFAULT '[]',
  is_system    boolean     NOT NULL DEFAULT true,
  -- Jerarquía: owner=100, admin=80, …, viewer=10. platform_super_admin=999 (nunca asignable desde cliente).
  priority     integer     NOT NULL DEFAULT 0,
  -- NULL = rol de sistema global. NOT NULL = rol custom del actor específico.
  actor_id     uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_role_type_nombre_actor UNIQUE NULLS NOT DISTINCT (actor_type, nombre, actor_id)
);

COMMENT ON TABLE public.trade_marketplace_roles IS
  'Roles del Marketplace. is_system=true son gestionados por TrabFlow. is_system=false son roles custom del actor.';
COMMENT ON COLUMN public.trade_marketplace_roles.permissions IS
  'Evaluar SIEMPRE via _mkt_has_permission(). Nunca leer este JSONB directamente desde RLS ni servicios.';
COMMENT ON COLUMN public.trade_marketplace_roles.priority IS
  'Jerarquía de roles. Un miembro no puede asignar roles con priority >= la suya. platform_super_admin=999.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 04. MEMBRESÍAS — N:M usuario ↔ actor (un user puede pertenecer a N actores)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_actor_members (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id          uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  user_id           uuid        NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id           uuid        NOT NULL
    REFERENCES public.trade_marketplace_roles(id) ON DELETE RESTRICT,
  activo            boolean     NOT NULL DEFAULT true,
  invited_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at        timestamptz,
  accepted_at       timestamptz,
  last_accessed_at  timestamptz,
  notas             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  -- Un usuario tiene una única membresía por actor (el rol puede cambiar)
  CONSTRAINT uq_member_actor_user UNIQUE (actor_id, user_id)
);

COMMENT ON TABLE public.trade_marketplace_actor_members IS
  'Membresía N:M entre auth.users y trade_marketplace_actors. Un user puede tener roles distintos en actores distintos.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 05. INVITACIONES PENDIENTES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_invitations (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  role_id     uuid        NOT NULL
    REFERENCES public.trade_marketplace_roles(id) ON DELETE RESTRICT,
  email       text        NOT NULL,
  -- Token de aceptación: hex de 32 bytes aleatorios
  token       text        NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  estado      text        NOT NULL DEFAULT 'pending'
    CONSTRAINT chk_inv_estado CHECK (estado IN ('pending','accepted','expired','revoked')),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '7 days',
  invited_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_invitation_token UNIQUE (token)
);

COMMENT ON TABLE public.trade_marketplace_invitations IS
  'Invitaciones pendientes de aceptación. accept_marketplace_invitation() valida token, email y expiración.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 06. OVERRIDES DE PERMISOS GRANULARES (INACTIVO — hook para Fase 2)
--     Tabla creada ahora. La función _mkt_has_permission() la ignora hasta Fase 2.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_member_permission_overrides (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid        NOT NULL
    REFERENCES public.trade_marketplace_actor_members(id) ON DELETE CASCADE,
  permission  text        NOT NULL,
  granted     boolean     NOT NULL,        -- true=conceder, false=revocar
  reason      text,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_override_member_perm UNIQUE (member_id, permission)
);

COMMENT ON TABLE public.trade_marketplace_member_permission_overrides IS
  'INACTIVO en Sprint 1A. La función _mkt_has_permission() evaluará estos overrides en Fase 2. No eliminar esta tabla.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 07. LOG DE AUDITORÍA
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_marketplace_audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid        REFERENCES public.trade_marketplace_actors(id) ON DELETE SET NULL,
  user_id     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- actor_created | actor_estado_changed | actor_verified |
  -- member_invited | invitation_accepted | invitation_revoked |
  -- member_role_changed | member_activated | member_deactivated |
  -- ownership_transferred | member_removed
  event_type  text        NOT NULL,
  event_data  jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_audit_log IS
  'Auditoría inmutable de eventos del sistema de actores. Solo escribe via triggers y funciones SECURITY DEFINER.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 08. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_actor_type      ON public.trade_marketplace_actors(actor_type);
CREATE INDEX IF NOT EXISTS idx_actor_estado    ON public.trade_marketplace_actors(estado);
CREATE INDEX IF NOT EXISTS idx_actor_country   ON public.trade_marketplace_actors(country);
CREATE INDEX IF NOT EXISTS idx_actor_sup_cat   ON public.trade_marketplace_actors(supplier_catalog_id)
  WHERE supplier_catalog_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_role_type       ON public.trade_marketplace_roles(actor_type);
CREATE INDEX IF NOT EXISTS idx_role_actor      ON public.trade_marketplace_roles(actor_id)
  WHERE actor_id IS NOT NULL;

-- Índice compuesto crítico para _mkt_actor_ids_for_user() (el más llamado del sistema)
CREATE INDEX IF NOT EXISTS idx_member_user_activo
  ON public.trade_marketplace_actor_members(user_id, activo)
  WHERE activo = true;
CREATE INDEX IF NOT EXISTS idx_member_actor    ON public.trade_marketplace_actor_members(actor_id);

CREATE INDEX IF NOT EXISTS idx_inv_token       ON public.trade_marketplace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_inv_email       ON public.trade_marketplace_invitations(lower(email));
CREATE INDEX IF NOT EXISTS idx_inv_actor       ON public.trade_marketplace_invitations(actor_id);

CREATE INDEX IF NOT EXISTS idx_override_member ON public.trade_marketplace_member_permission_overrides(member_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor     ON public.trade_marketplace_audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON public.trade_marketplace_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_event     ON public.trade_marketplace_audit_log(event_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 09. FUNCIONES DE TRIGGER
-- ─────────────────────────────────────────────────────────────────────────────

-- 9.1  Compatibilidad de tipo actor ↔ tipo de rol
--      BEFORE INSERT OR UPDATE ON actor_members
--      Garantiza que el rol asignado sea del mismo actor_type o 'any'.
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_type_compat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor_type text;
  v_role_type  text;
BEGIN
  -- Solo interesa cuando cambia el role_id
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

-- 9.2  Protección contra escalada de privilegios
--      BEFORE INSERT OR UPDATE ON actor_members (orden: corre DESPUÉS de 9.1)
--      - Omitido para service_role (auth.uid() IS NULL)
--      - Omitido cuando mkt.skip_privilege_check = '1' (RPCs internas seguras)
--      - El rol 'platform_super_admin' nunca es asignable desde el cliente
--      - Un miembro no puede asignar/cambiarse a un rol con priority >= la suya
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_privilege_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id       uuid;
  v_caller_priority integer;
  v_new_priority    integer;
  v_new_role_nombre text;
BEGIN
  -- Solo interesa cuando cambia el role_id (o es INSERT)
  IF TG_OP = 'UPDATE' AND NEW.role_id = OLD.role_id THEN
    RETURN NEW;
  END IF;

  -- Omitir para operaciones de service_role (migraciones, Edge Functions con service key)
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN RETURN NEW; END IF;

  -- Omitir cuando una función segura ha activado el bypass explícito
  IF current_setting('mkt.skip_privilege_check', true) = '1' THEN RETURN NEW; END IF;

  -- Obtener datos del rol que se va a asignar
  SELECT r.priority, r.nombre INTO v_new_priority, v_new_role_nombre
  FROM public.trade_marketplace_roles r WHERE r.id = NEW.role_id;

  -- platform_super_admin nunca asignable desde el cliente (ni por otro super_admin)
  IF v_new_role_nombre = 'platform_super_admin' THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: platform_super_admin solo puede asignarse desde el servicio backend.';
  END IF;

  -- Obtener la prioridad del caller en este actor
  SELECT r.priority INTO v_caller_priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = NEW.actor_id AND m.user_id = v_caller_id AND m.activo = true;

  IF v_caller_priority IS NULL THEN
    -- Caller no es miembro: debe ser platform_admin (verificado en RLS, no aquí) o rechazado
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No eres miembro de este actor (actor_id=%).', NEW.actor_id;
  END IF;

  -- No puede asignar un rol con priority >= la suya
  IF v_new_priority >= v_caller_priority THEN
    RAISE EXCEPTION 'PRIVILEGE_ESCALATION: No puedes asignar un rol con priority % (tu priority es %).',
      v_new_priority, v_caller_priority;
  END IF;

  RETURN NEW;
END;
$$;

-- 9.3  Protección del último owner
--      BEFORE UPDATE OR DELETE ON actor_members
--      Impide eliminar o degradar al último owner activo de un actor.
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_last_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_old_role_nombre text;
  v_is_losing_owner boolean := false;
  v_remaining_owners integer;
BEGIN
  SELECT r.nombre INTO v_old_role_nombre
  FROM public.trade_marketplace_roles r WHERE r.id = OLD.role_id;

  IF v_old_role_nombre != 'owner' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_is_losing_owner := true;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Pierde owner si: se desactiva O se le cambia el rol
    IF (OLD.activo = true AND NEW.activo = false) OR (NEW.role_id != OLD.role_id) THEN
      v_is_losing_owner := true;
    END IF;
  END IF;

  IF NOT v_is_losing_owner THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Contar otros owners activos que quedarían
  SELECT COUNT(*) INTO v_remaining_owners
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = OLD.actor_id
    AND m.activo   = true
    AND r.nombre   = 'owner'
    AND m.id       != OLD.id;

  IF v_remaining_owners = 0 THEN
    RAISE EXCEPTION 'LAST_OWNER: No puedes eliminar o degradar al último owner del actor. Usa transfer_marketplace_ownership() primero.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 9.4  Auditoría de cambios en membresías
--      AFTER INSERT OR UPDATE OR DELETE ON actor_members
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_member_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event   text;
  v_data    jsonb;
  v_uid     uuid;
  v_aid     uuid;
BEGIN
  v_uid := auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_aid   := NEW.actor_id;
    v_event := CASE WHEN NEW.accepted_at IS NULL THEN 'member_invited' ELSE 'member_joined' END;
    v_data  := jsonb_build_object('member_id', NEW.id, 'user_id', NEW.user_id, 'role_id', NEW.role_id);

  ELSIF TG_OP = 'UPDATE' THEN
    v_aid := NEW.actor_id;

    IF OLD.role_id IS DISTINCT FROM NEW.role_id THEN
      v_event := 'member_role_changed';
      v_data  := jsonb_build_object(
        'member_id', NEW.id, 'user_id', NEW.user_id,
        'old_role_id', OLD.role_id, 'new_role_id', NEW.role_id
      );
    ELSIF OLD.activo IS DISTINCT FROM NEW.activo THEN
      v_event := CASE WHEN NEW.activo THEN 'member_activated' ELSE 'member_deactivated' END;
      v_data  := jsonb_build_object('member_id', NEW.id, 'user_id', NEW.user_id);
    ELSE
      RETURN NEW; -- Cambio no auditado (last_accessed_at, notas, etc.)
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_aid   := OLD.actor_id;
    v_event := 'member_removed';
    v_data  := jsonb_build_object('member_id', OLD.id, 'user_id', OLD.user_id, 'role_id', OLD.role_id);
  END IF;

  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (v_aid, COALESCE(v_uid, COALESCE(NEW.user_id, OLD.user_id)), v_event, v_data);

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 9.5  Auditoría de cambios en el actor (estado, verificación)
--      AFTER UPDATE ON actors
CREATE OR REPLACE FUNCTION public.trg_fn_mkt_actor_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_event text;
  v_data  jsonb := '{}';
BEGIN
  IF OLD.estado IS DISTINCT FROM NEW.estado THEN
    v_event := 'actor_estado_changed';
    v_data  := jsonb_build_object('old_estado', OLD.estado, 'new_estado', NEW.estado);
    INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
    VALUES (NEW.id, auth.uid(), v_event, v_data);
  END IF;

  IF OLD.verificado IS DISTINCT FROM NEW.verificado AND NEW.verificado = true THEN
    INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
    VALUES (NEW.id, auth.uid(), 'actor_verified',
      jsonb_build_object('verificado_by', NEW.verificado_by));
  END IF;

  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. INSTALACIÓN DE TRIGGERS (idempotente via DO)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- updated_at en actors (reutiliza trg_set_updated_at de Sprint 0B)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_actor_updated_at'
    AND tgrelid = 'public.trade_marketplace_actors'::regclass) THEN
    CREATE TRIGGER trg_actor_updated_at
      BEFORE UPDATE ON public.trade_marketplace_actors
      FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();
  END IF;

  -- Compatibilidad tipo actor ↔ tipo rol (BEFORE, primera en orden alfa)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_a_member_type_compat'
    AND tgrelid = 'public.trade_marketplace_actor_members'::regclass) THEN
    CREATE TRIGGER trg_a_member_type_compat
      BEFORE INSERT OR UPDATE ON public.trade_marketplace_actor_members
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_mkt_member_type_compat();
  END IF;

  -- Escalada de privilegios (BEFORE, segunda en orden alfa)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_b_member_privilege'
    AND tgrelid = 'public.trade_marketplace_actor_members'::regclass) THEN
    CREATE TRIGGER trg_b_member_privilege
      BEFORE INSERT OR UPDATE ON public.trade_marketplace_actor_members
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_mkt_member_privilege_check();
  END IF;

  -- Último owner (BEFORE, tercera en orden alfa)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_c_member_last_owner'
    AND tgrelid = 'public.trade_marketplace_actor_members'::regclass) THEN
    CREATE TRIGGER trg_c_member_last_owner
      BEFORE UPDATE OR DELETE ON public.trade_marketplace_actor_members
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_mkt_member_last_owner();
  END IF;

  -- Auditoría de membresías (AFTER)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_member_audit'
    AND tgrelid = 'public.trade_marketplace_actor_members'::regclass) THEN
    CREATE TRIGGER trg_member_audit
      AFTER INSERT OR UPDATE OR DELETE ON public.trade_marketplace_actor_members
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_mkt_member_audit();
  END IF;

  -- Auditoría del actor (AFTER)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_actor_audit'
    AND tgrelid = 'public.trade_marketplace_actors'::regclass) THEN
    CREATE TRIGGER trg_actor_audit
      AFTER UPDATE ON public.trade_marketplace_actors
      FOR EACH ROW EXECUTE FUNCTION public.trg_fn_mkt_actor_audit();
  END IF;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10b. HELPER FUNCTIONS (adelantadas — las políticas RLS las necesitan)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._mkt_actor_ids_for_user(p_type text DEFAULT NULL)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT m.actor_id
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_actors a ON a.id = m.actor_id
    WHERE m.user_id = auth.uid()
      AND m.activo  = true
      AND (p_type IS NULL OR a.actor_type = p_type)
  );
$$;

CREATE OR REPLACE FUNCTION public._mkt_has_permission(p_actor_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_roles r ON r.id = m.role_id
    WHERE m.actor_id = p_actor_id
      AND m.user_id  = auth.uid()
      AND m.activo   = true
      AND r.permissions @> jsonb_build_array(p_permission)
  );
$$;

CREATE OR REPLACE FUNCTION public._mkt_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_actors a ON a.id = m.actor_id
    JOIN public.trade_marketplace_roles r ON r.id = m.role_id
    WHERE m.user_id    = auth.uid()
      AND m.activo     = true
      AND a.actor_type = 'platform'
      AND a.estado     = 'active'
      AND r.nombre     IN ('platform_super_admin', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public._mkt_caller_role_priority(p_actor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = p_actor_id
    AND m.user_id  = auth.uid()
    AND m.activo   = true
  LIMIT 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_marketplace_actor_types                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_actors                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_roles                         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_actor_members                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_invitations                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_member_permission_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_marketplace_audit_log                     ENABLE ROW LEVEL SECURITY;

-- Actor types: solo lectura pública (catálogo de tipos)
DROP POLICY IF EXISTS "actor_types_select" ON public.trade_marketplace_actor_types;
CREATE POLICY "actor_types_select" ON public.trade_marketplace_actor_types
  FOR SELECT USING (activo = true);

-- Actors: activos visibles a authenticated; propios siempre visibles; admins de plataforma ven todos
DROP POLICY IF EXISTS "actors_select_active"   ON public.trade_marketplace_actors;
DROP POLICY IF EXISTS "actors_select_member"   ON public.trade_marketplace_actors;
DROP POLICY IF EXISTS "actors_select_platform" ON public.trade_marketplace_actors;
DROP POLICY IF EXISTS "actors_update"          ON public.trade_marketplace_actors;

CREATE POLICY "actors_select_active" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (estado = 'active');

CREATE POLICY "actors_select_member" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (id = ANY(public._mkt_actor_ids_for_user()));

CREATE POLICY "actors_select_platform" ON public.trade_marketplace_actors
  FOR SELECT TO authenticated
  USING (public._mkt_is_platform_admin());

CREATE POLICY "actors_update" ON public.trade_marketplace_actors
  FOR UPDATE TO authenticated
  USING (
    public._mkt_has_permission(id, 'actor:settings')
    OR public._mkt_is_platform_admin()
  );

-- Roles: todos los autenticados ven roles de sistema; miembros ven roles custom de su actor
DROP POLICY IF EXISTS "roles_select_system" ON public.trade_marketplace_roles;
DROP POLICY IF EXISTS "roles_select_actor"  ON public.trade_marketplace_roles;

CREATE POLICY "roles_select_system" ON public.trade_marketplace_roles
  FOR SELECT TO authenticated
  USING (is_system = true AND actor_id IS NULL);

CREATE POLICY "roles_select_actor" ON public.trade_marketplace_roles
  FOR SELECT TO authenticated
  USING (actor_id = ANY(public._mkt_actor_ids_for_user()));

-- Members: ver requiere members:read en el actor; INSERT via accept_invitation (SECURITY DEFINER)
DROP POLICY IF EXISTS "members_select" ON public.trade_marketplace_actor_members;
DROP POLICY IF EXISTS "members_select_own" ON public.trade_marketplace_actor_members;
DROP POLICY IF EXISTS "members_update" ON public.trade_marketplace_actor_members;
DROP POLICY IF EXISTS "members_insert_platform" ON public.trade_marketplace_actor_members;

CREATE POLICY "members_select_own" ON public.trade_marketplace_actor_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "members_select" ON public.trade_marketplace_actor_members
  FOR SELECT TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'members:read')
  );

CREATE POLICY "members_update" ON public.trade_marketplace_actor_members
  FOR UPDATE TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'members:manage')
  );

-- Invitaciones: miembros con members:read pueden ver las de su actor
DROP POLICY IF EXISTS "invitations_select" ON public.trade_marketplace_invitations;
DROP POLICY IF EXISTS "invitations_insert" ON public.trade_marketplace_invitations;
DROP POLICY IF EXISTS "invitations_update" ON public.trade_marketplace_invitations;

CREATE POLICY "invitations_select" ON public.trade_marketplace_invitations
  FOR SELECT TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'members:read')
  );

CREATE POLICY "invitations_insert" ON public.trade_marketplace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'members:invite')
  );

CREATE POLICY "invitations_update" ON public.trade_marketplace_invitations
  FOR UPDATE TO authenticated
  USING (
    actor_id = ANY(public._mkt_actor_ids_for_user())
    AND public._mkt_has_permission(actor_id, 'members:invite')
  );

-- Overrides: solo platform admin (inactivo en evaluación, pero gestionado por admins)
DROP POLICY IF EXISTS "overrides_platform" ON public.trade_marketplace_member_permission_overrides;
CREATE POLICY "overrides_platform" ON public.trade_marketplace_member_permission_overrides
  FOR ALL TO authenticated
  USING (public._mkt_is_platform_admin());

-- Audit log: miembros con analytics:read ven logs de su actor; plataforma ve todo
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. HELPER FUNCTIONS
--     Toda evaluación de permisos pasa por estas funciones.
--     Ninguna RLS ni servicio lee directamente el JSONB de permissions.
-- ─────────────────────────────────────────────────────────────────────────────

-- 12.1 IDs de actores donde el usuario actual es miembro activo
CREATE OR REPLACE FUNCTION public._mkt_actor_ids_for_user(p_type text DEFAULT NULL)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT m.actor_id
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_actors a ON a.id = m.actor_id
    WHERE m.user_id = auth.uid()
      AND m.activo  = true
      AND (p_type IS NULL OR a.actor_type = p_type)
  );
$$;

-- 12.2 Verificación de permiso para actor concreto
--      Sprint 1A: evalúa solo permissions del rol (member_permission_overrides inactivo).
--      Fase 2: añadir evaluación de overrides aquí, sin cambiar ninguna RLS ni servicio.
CREATE OR REPLACE FUNCTION public._mkt_has_permission(p_actor_id uuid, p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_roles r ON r.id = m.role_id
    WHERE m.actor_id = p_actor_id
      AND m.user_id  = auth.uid()
      AND m.activo   = true
      AND r.permissions @> jsonb_build_array(p_permission)
    -- Sprint 1A: member_permission_overrides ignorado aquí.
    -- Fase 2: evaluar overrides antes de devolver resultado del rol base.
  );
$$;

-- 12.3 ¿Es el usuario actual admin de la plataforma TrabFlow?
CREATE OR REPLACE FUNCTION public._mkt_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.trade_marketplace_actor_members m
    JOIN public.trade_marketplace_actors a ON a.id = m.actor_id
    JOIN public.trade_marketplace_roles r ON r.id = m.role_id
    WHERE m.user_id    = auth.uid()
      AND m.activo     = true
      AND a.actor_type = 'platform'
      AND a.estado     = 'active'
      AND r.nombre     IN ('platform_super_admin', 'admin')
  );
$$;

-- 12.4 Prioridad del caller en un actor concreto (usado en triggers y RPCs)
CREATE OR REPLACE FUNCTION public._mkt_caller_role_priority(p_actor_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT r.priority
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = p_actor_id
    AND m.user_id  = auth.uid()
    AND m.activo   = true
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public._mkt_actor_ids_for_user(text)          FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_has_permission(uuid, text)         FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_is_platform_admin()                FROM anon, public;
REVOKE EXECUTE ON FUNCTION public._mkt_caller_role_priority(uuid)         FROM anon, public;
GRANT  EXECUTE ON FUNCTION public._mkt_actor_ids_for_user(text)           TO authenticated;
GRANT  EXECUTE ON FUNCTION public._mkt_has_permission(uuid, text)         TO authenticated;
GRANT  EXECUTE ON FUNCTION public._mkt_is_platform_admin()                TO authenticated;
GRANT  EXECUTE ON FUNCTION public._mkt_caller_role_priority(uuid)         TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. RPC FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────

-- 13.1 Membresías del usuario actual (para inicializar el portal en el frontend)
CREATE OR REPLACE FUNCTION public.get_my_marketplace_memberships()
RETURNS TABLE (
  actor_id         uuid,
  actor_type       text,
  actor_nombre     text,
  actor_slug       text,
  actor_estado     text,
  actor_logo_url   text,
  actor_verificado boolean,
  member_id        uuid,
  role_id          uuid,
  role_nombre      text,
  role_priority    integer,
  permissions      jsonb,
  activo           boolean,
  accepted_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    a.id,
    a.actor_type,
    a.nombre,
    a.slug,
    a.estado,
    a.logo_url,
    a.verificado,
    m.id,
    m.role_id,
    r.nombre,
    r.priority,
    r.permissions,
    m.activo,
    m.accepted_at
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_actors       a ON a.id = m.actor_id
  JOIN public.trade_marketplace_roles        r ON r.id = m.role_id
  WHERE m.user_id = auth.uid()
    AND m.activo  = true;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_marketplace_memberships() FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.get_my_marketplace_memberships() TO authenticated;

-- 13.2 Aceptar invitación por token
CREATE OR REPLACE FUNCTION public.accept_marketplace_invitation(p_token text)
RETURNS uuid  -- actor_id del actor al que se acaba de unir
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inv       RECORD;
  v_user_id   uuid;
  v_email     text;
  v_member_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Debes estar autenticado para aceptar una invitación.';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_inv
  FROM public.trade_marketplace_invitations
  WHERE token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_TOKEN: Token de invitación no encontrado.';
  END IF;

  IF v_inv.estado != 'pending' THEN
    RAISE EXCEPTION 'INVALID_STATE: La invitación está en estado "%". Solo se pueden aceptar invitaciones pendientes.', v_inv.estado;
  END IF;

  IF v_inv.expires_at < now() THEN
    UPDATE public.trade_marketplace_invitations SET estado = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED: La invitación expiró el %.', v_inv.expires_at;
  END IF;

  IF lower(v_email) != lower(v_inv.email) THEN
    RAISE EXCEPTION 'EMAIL_MISMATCH: Esta invitación es para el email "%" pero estás autenticado como "%.', v_inv.email, v_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trade_marketplace_actor_members
    WHERE actor_id = v_inv.actor_id AND user_id = v_user_id AND activo = true
  ) THEN
    RAISE EXCEPTION 'ALREADY_MEMBER: Ya eres miembro activo de este actor.';
  END IF;

  -- Bypass del trigger de escalada: accept_invitation es una operación legítima y segura
  PERFORM set_config('mkt.skip_privilege_check', '1', true);

  INSERT INTO public.trade_marketplace_actor_members
    (actor_id, user_id, role_id, activo, invited_by, invited_at, accepted_at)
  VALUES
    (v_inv.actor_id, v_user_id, v_inv.role_id, true, v_inv.invited_by, v_inv.created_at, now())
  RETURNING id INTO v_member_id;

  UPDATE public.trade_marketplace_invitations SET estado = 'accepted' WHERE id = v_inv.id;

  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (v_inv.actor_id, v_user_id, 'invitation_accepted',
    jsonb_build_object('invitation_id', v_inv.id, 'role_id', v_inv.role_id, 'member_id', v_member_id));

  RETURN v_inv.actor_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_marketplace_invitation(text) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.accept_marketplace_invitation(text) TO authenticated;

-- 13.3 Transferencia segura de ownership
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

  SELECT actor_type INTO v_actor_type
  FROM public.trade_marketplace_actors WHERE id = p_actor_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACTOR_NOT_FOUND: Actor % no encontrado.', p_actor_id;
  END IF;

  -- Verificar que el caller es owner
  SELECT m.*, r.nombre AS role_nombre INTO v_caller_member
  FROM public.trade_marketplace_actor_members m
  JOIN public.trade_marketplace_roles r ON r.id = m.role_id
  WHERE m.actor_id = p_actor_id AND m.user_id = v_caller_id AND m.activo = true;

  IF NOT FOUND OR v_caller_member.role_nombre != 'owner' THEN
    RAISE EXCEPTION 'NOT_OWNER: Solo el owner actual puede transferir el ownership.';
  END IF;

  -- Verificar que el destino es miembro activo
  SELECT m.* INTO v_target_member
  FROM public.trade_marketplace_actor_members m
  WHERE m.actor_id = p_actor_id AND m.user_id = p_new_owner_user_id AND m.activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TARGET_NOT_MEMBER: El usuario destino debe ser miembro activo del actor.';
  END IF;

  -- Obtener rol owner y admin para este tipo de actor
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

  -- Bypass de triggers para operación de transferencia (ya validada arriba)
  PERFORM set_config('mkt.skip_privilege_check', '1', true);

  -- Asignar nuevo owner y degradar al anterior
  UPDATE public.trade_marketplace_actor_members SET role_id = v_owner_role_id WHERE id = v_target_member.id;
  UPDATE public.trade_marketplace_actor_members SET role_id = v_admin_role_id  WHERE id = v_caller_member.id;

  INSERT INTO public.trade_marketplace_audit_log (actor_id, user_id, event_type, event_data)
  VALUES (p_actor_id, v_caller_id, 'ownership_transferred',
    jsonb_build_object(
      'from_user_id', v_caller_id,
      'to_user_id',   p_new_owner_user_id,
      'old_role_id',  v_caller_member.role_id,
      'new_owner_role_id', v_owner_role_id
    ));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.transfer_marketplace_ownership(uuid, uuid) FROM anon, public;
GRANT  EXECUTE ON FUNCTION public.transfer_marketplace_ownership(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. SEED — TIPOS DE ACTOR (idempotente)
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_actor_types (id, label, descripcion, icono, posicion) VALUES
  ('supplier',    'Proveedor',           'Mayorista o distribuidor de material',      '🏭', 10),
  ('brand',       'Fabricante',          'Marca y fabricante de productos',           '⚙️', 20),
  ('logistics',   'Operador Logístico',  'Gestión de transporte y última milla',      '🚚', 30),
  ('association', 'Asociación',          'Asociación o colegio gremial',             '🤝', 40),
  ('platform',    'Plataforma',          'TrabFlow — administrador de la plataforma', '🛡️', 50),
  ('partner',     'Partner API',         'Integrador externo con acceso API',         '🔌', 60),
  ('any',         'Cualquier tipo',      'Tipo especial: rol compatible con todos',   '*',  99)
ON CONFLICT (id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. SEED — ROLES DE SISTEMA
--     Idempotente: ON CONFLICT (actor_type, nombre, actor_id) NULLS NOT DISTINCT DO NOTHING
-- ─────────────────────────────────────────────────────────────────────────────

-- Permisos comunes reutilizados en los VALUES
-- owner-supplier
INSERT INTO public.trade_marketplace_roles (actor_type, nombre, descripcion, permissions, is_system, priority) VALUES

-- ── Supplier ──────────────────────────────────────────────────────────────
('supplier', 'owner', 'Control total del proveedor',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","orders:read","orders:manage","orders:fulfillment","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","billing:manage","promotions:write","actor:settings","actor:delete"]',
  true, 100),

('supplier', 'admin', 'Gestión completa excepto billing:manage y actor:delete',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","orders:read","orders:manage","orders:fulfillment","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","promotions:write","actor:settings"]',
  true, 80),

('supplier', 'catalog_manager', 'Gestión de catálogo y matching de productos',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","analytics:read"]',
  true, 60),

('supplier', 'orders_manager', 'Gestión y confirmación de pedidos recibidos',
  '["orders:read","orders:manage","orders:fulfillment","analytics:read"]',
  true, 60),

('supplier', 'finance', 'Acceso a facturación y métricas financieras',
  '["billing:read","billing:manage","analytics:read","analytics:export","orders:read"]',
  true, 50),

('supplier', 'member_manager', 'Gestión del equipo del proveedor',
  '["members:read","members:invite","members:manage","analytics:read"]',
  true, 50),

('supplier', 'analyst', 'Solo lectura de analytics y catálogo',
  '["analytics:read","analytics:export","offerings:read","orders:read"]',
  true, 30),

('supplier', 'viewer', 'Lectura mínima sin capacidad de escritura',
  '["offerings:read","orders:read","analytics:read"]',
  true, 10),

-- ── Brand ─────────────────────────────────────────────────────────────────
('brand', 'owner', 'Control total del fabricante',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","billing:manage","promotions:write","actor:settings","actor:delete"]',
  true, 100),

('brand', 'admin', 'Gestión completa excepto actor:delete',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","promotions:write","actor:settings"]',
  true, 80),

('brand', 'catalog_manager', 'Gestión del catálogo oficial y matching a UPs',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","analytics:read"]',
  true, 60),

('brand', 'marketing', 'Gestión de promociones y visibilidad de marca',
  '["promotions:write","analytics:read","analytics:export","offerings:read"]',
  true, 40),

('brand', 'analyst', 'Métricas y rendimiento de catálogo',
  '["analytics:read","analytics:export","offerings:read"]',
  true, 30),

('brand', 'viewer', 'Solo lectura de catálogo y analytics',
  '["offerings:read","analytics:read"]',
  true, 10),

-- ── Logistics ─────────────────────────────────────────────────────────────
('logistics', 'owner', 'Control total del operador logístico',
  '["orders:read","orders:manage","orders:fulfillment","logistics:manage","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","billing:manage","actor:settings","actor:delete"]',
  true, 100),

('logistics', 'admin', 'Gestión completa excepto actor:delete',
  '["orders:read","orders:manage","orders:fulfillment","logistics:manage","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","actor:settings"]',
  true, 80),

('logistics', 'dispatcher', 'Asignación de rutas y gestión de entregas',
  '["orders:read","orders:manage","orders:fulfillment","logistics:manage","analytics:read"]',
  true, 60),

('logistics', 'analyst', 'Métricas logísticas solo lectura',
  '["analytics:read","analytics:export","orders:read"]',
  true, 30),

('logistics', 'viewer', 'Lectura mínima de pedidos',
  '["orders:read","analytics:read"]',
  true, 10),

-- ── Association ───────────────────────────────────────────────────────────
('association', 'owner', 'Control total de la asociación',
  '["members:read","members:invite","members:manage","analytics:read","analytics:export","billing:read","billing:manage","actor:settings","actor:delete"]',
  true, 100),

('association', 'admin', 'Gestión completa excepto actor:delete',
  '["members:read","members:invite","members:manage","analytics:read","analytics:export","billing:read","actor:settings"]',
  true, 80),

('association', 'member_manager', 'Gestión del directorio de miembros',
  '["members:read","members:invite","members:manage","analytics:read"]',
  true, 50),

('association', 'analyst', 'Métricas de la asociación solo lectura',
  '["analytics:read","analytics:export"]',
  true, 30),

('association', 'viewer', 'Solo lectura',
  '["analytics:read"]',
  true, 10),

-- ── Platform ──────────────────────────────────────────────────────────────
-- platform_super_admin: priority=999, NUNCA asignable desde cliente (trigger lo bloquea)
('platform', 'platform_super_admin', 'Super administrador de TrabFlow — solo via servicio backend',
  '["offerings:read","offerings:write","offerings:delete","offerings:match","catalog:import","catalog:export","orders:read","orders:manage","analytics:read","analytics:export","members:read","members:invite","members:manage","billing:read","billing:manage","promotions:write","logistics:manage","actor:settings","actor:delete","platform:actors","platform:verify","api:access"]',
  true, 999),

('platform', 'admin', 'Administrador de TrabFlow',
  '["platform:actors","platform:verify","analytics:read","analytics:export","members:read","orders:read","offerings:read","billing:read"]',
  true, 80),

('platform', 'support', 'Soporte técnico y atención al cliente',
  '["orders:read","members:read","offerings:read","analytics:read"]',
  true, 40),

('platform', 'analyst', 'Analista de datos de la plataforma',
  '["analytics:read","analytics:export"]',
  true, 30),

-- ── Any (roles universales mínimos) ───────────────────────────────────────
('any', 'viewer', 'Lectura mínima universal (todos los tipos de actor)',
  '["offerings:read","analytics:read"]',
  true, 10)

ON CONFLICT ON CONSTRAINT uq_role_type_nombre_actor DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. SEED — ACTOR DE PLATAFORMA TRABFLOW
--     Crea el actor base 'platform' necesario para asignar admins de TrabFlow.
--     Los super admins se asignan vía servicio backend tras la migración.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.trade_marketplace_actors
  (actor_type, nombre, slug, estado, verificado)
VALUES
  ('platform', 'TrabFlow', 'trabflow-platform', 'active', true)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIN DE MIGRACIÓN — Sprint 1A
-- ─────────────────────────────────────────────────────────────────────────────
-- Para asignar el primer super_admin (vía servicio backend con service_role):
--
--   INSERT INTO trade_marketplace_actor_members (actor_id, user_id, role_id, activo, accepted_at)
--   SELECT a.id, '<auth.users.id>', r.id, true, now()
--   FROM trade_marketplace_actors a, trade_marketplace_roles r
--   WHERE a.slug = 'trabflow-platform'
--     AND r.nombre = 'platform_super_admin' AND r.actor_type = 'platform';
-- ─────────────────────────────────────────────────────────────────────────────
