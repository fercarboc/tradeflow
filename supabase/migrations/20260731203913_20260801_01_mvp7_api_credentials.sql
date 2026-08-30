-- MVP-7.1/7.2: Integraciones — Credenciales API del proveedor

CREATE TABLE IF NOT EXISTS public.trade_supplier_api_credentials (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  nombre          text        NOT NULL,
  key_prefix      text        NOT NULL,
  key_hash        text        NOT NULL UNIQUE,
  scopes          text[]      NOT NULL,
  activa          boolean     NOT NULL DEFAULT true,
  expires_at      timestamptz NOT NULL,
  grace_until     timestamptz,
  last_used_at    timestamptz,
  last_ip         text,
  last_user_agent text,
  created_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at      timestamptz,
  revoked_by      uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_cred_scopes CHECK (
    scopes <@ ARRAY['catalog:read','catalog:write','stock:write','prices:write','imports:read']
  ),
  CONSTRAINT chk_cred_scopes_notempty CHECK (array_length(scopes, 1) >= 1),
  CONSTRAINT chk_cred_expires_future  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_api_cred_actor    ON public.trade_supplier_api_credentials(actor_id);
CREATE INDEX IF NOT EXISTS idx_api_cred_key_hash ON public.trade_supplier_api_credentials(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_cred_activa   ON public.trade_supplier_api_credentials(actor_id, activa, expires_at);

ALTER TABLE public.trade_supplier_api_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_cred_select_actor" ON public.trade_supplier_api_credentials;
CREATE POLICY "api_cred_select_actor"
  ON public.trade_supplier_api_credentials FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_actor_members m
      WHERE m.actor_id = trade_supplier_api_credentials.actor_id
        AND m.user_id  = auth.uid()
        AND m.activo   = true
    )
  );

DROP POLICY IF EXISTS "api_cred_no_insert" ON public.trade_supplier_api_credentials;
CREATE POLICY "api_cred_no_insert"
  ON public.trade_supplier_api_credentials FOR INSERT TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "api_cred_no_update" ON public.trade_supplier_api_credentials;
CREATE POLICY "api_cred_no_update"
  ON public.trade_supplier_api_credentials FOR UPDATE TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.trade_supplier_api_sync_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id   uuid        NOT NULL REFERENCES public.trade_supplier_api_credentials(id),
  actor_id        uuid        NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  endpoint        text        NOT NULL,
  idempotency_key text,
  source_system   text,
  ip              text,
  user_agent      text,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text        NOT NULL DEFAULT 'processing',
  rows_received   integer,
  rows_inserted   integer,
  rows_updated    integer,
  rows_rejected   integer,
  error_detail    text,
  CONSTRAINT chk_sync_status CHECK (status IN ('processing','completed','failed','duplicate'))
);

CREATE INDEX IF NOT EXISTS idx_api_sync_actor ON public.trade_supplier_api_sync_log(actor_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_sync_cred  ON public.trade_supplier_api_sync_log(credential_id, started_at DESC);

ALTER TABLE public.trade_supplier_api_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "api_sync_select_actor" ON public.trade_supplier_api_sync_log;
CREATE POLICY "api_sync_select_actor"
  ON public.trade_supplier_api_sync_log FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trade_marketplace_actor_members m
      WHERE m.actor_id = trade_supplier_api_sync_log.actor_id
        AND m.user_id  = auth.uid()
        AND m.activo   = true
    )
  );

DROP POLICY IF EXISTS "api_sync_no_insert" ON public.trade_supplier_api_sync_log;
CREATE POLICY "api_sync_no_insert"
  ON public.trade_supplier_api_sync_log FOR INSERT TO authenticated WITH CHECK (false);

CREATE TABLE IF NOT EXISTS public.trade_supplier_api_idempotency (
  idempotency_key  text        NOT NULL,
  actor_id         uuid        NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  endpoint         text        NOT NULL,
  request_hash     text        NOT NULL,
  response_status  integer     NOT NULL,
  response_body    jsonb       NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  PRIMARY KEY (idempotency_key, actor_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_api_idem_expires ON public.trade_supplier_api_idempotency(expires_at);
ALTER TABLE public.trade_supplier_api_idempotency ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_idem_deny_all" ON public.trade_supplier_api_idempotency;
CREATE POLICY "api_idem_deny_all" ON public.trade_supplier_api_idempotency FOR ALL TO authenticated USING (false);

CREATE TABLE IF NOT EXISTS public.trade_supplier_api_rate_limits (
  actor_id      uuid        NOT NULL REFERENCES public.trade_marketplace_actors(id) ON DELETE CASCADE,
  endpoint      text        NOT NULL,
  window_start  timestamptz NOT NULL,
  request_count integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_id, endpoint, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rl_window ON public.trade_supplier_api_rate_limits(window_start);
ALTER TABLE public.trade_supplier_api_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_rl_deny_all" ON public.trade_supplier_api_rate_limits;
CREATE POLICY "api_rl_deny_all" ON public.trade_supplier_api_rate_limits FOR ALL TO authenticated USING (false);

-- ── Funciones de gestión ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_api_credential(
  p_actor_id uuid, p_nombre text, p_scopes text[], p_expires_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_raw_hex text; v_raw_key text; v_key_prefix text; v_key_hash text; v_cred_id uuid;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN: Sin acceso a este actor.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF trim(p_nombre) = '' OR p_nombre IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT: nombre es obligatorio.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_expires_at IS NULL OR p_expires_at <= now() THEN
    RAISE EXCEPTION 'INVALID_INPUT: expires_at debe ser una fecha futura.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_scopes IS NULL OR array_length(p_scopes, 1) < 1 THEN
    RAISE EXCEPTION 'INVALID_INPUT: Se requiere al menos un scope.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT (p_scopes <@ ARRAY['catalog:read','catalog:write','stock:write','prices:write','imports:read']) THEN
    RAISE EXCEPTION 'INVALID_INPUT: Scope no válido. Permitidos: catalog:read, catalog:write, stock:write, prices:write, imports:read.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_raw_hex    := encode(gen_random_bytes(32), 'hex');
  v_raw_key    := 'tsf_v1_' || v_raw_hex;
  v_key_prefix := substring(v_raw_hex, 1, 8);
  v_key_hash   := encode(sha256(v_raw_key::bytea), 'hex');
  INSERT INTO public.trade_supplier_api_credentials (actor_id, nombre, key_prefix, key_hash, scopes, expires_at, created_by)
  VALUES (p_actor_id, trim(p_nombre), v_key_prefix, v_key_hash, p_scopes, p_expires_at, auth.uid())
  RETURNING id INTO v_cred_id;
  RETURN jsonb_build_object('credential_id', v_cred_id, 'raw_key', v_raw_key, 'key_prefix', v_key_prefix);
END; $$;

CREATE OR REPLACE FUNCTION public.revoke_api_credential(p_credential_id uuid, p_actor_id uuid)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT actor_id INTO v_owner FROM public.trade_supplier_api_credentials WHERE id = p_credential_id;
  IF NOT FOUND OR v_owner <> p_actor_id THEN
    RAISE EXCEPTION 'NOT_FOUND: Credencial no encontrada o sin acceso.' USING ERRCODE = 'no_data_found';
  END IF;
  UPDATE public.trade_supplier_api_credentials
  SET activa = false, revoked_at = now(), revoked_by = auth.uid(), grace_until = NULL
  WHERE id = p_credential_id;
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_api_credential(p_credential_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_old RECORD; v_raw_hex text; v_raw_key text; v_key_prefix text;
  v_key_hash text; v_new_id uuid; v_grace timestamptz;
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO v_old FROM public.trade_supplier_api_credentials
  WHERE id = p_credential_id AND actor_id = p_actor_id AND activa = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND: Credencial no encontrada, sin acceso o ya revocada.' USING ERRCODE = 'no_data_found';
  END IF;
  v_raw_hex    := encode(gen_random_bytes(32), 'hex');
  v_raw_key    := 'tsf_v1_' || v_raw_hex;
  v_key_prefix := substring(v_raw_hex, 1, 8);
  v_key_hash   := encode(sha256(v_raw_key::bytea), 'hex');
  v_grace      := now() + interval '24 hours';
  INSERT INTO public.trade_supplier_api_credentials (actor_id, nombre, key_prefix, key_hash, scopes, expires_at, created_by)
  VALUES (v_old.actor_id, v_old.nombre || ' (rotada ' || to_char(now(), 'DD/MM') || ')',
          v_key_prefix, v_key_hash, v_old.scopes,
          GREATEST(v_old.expires_at, now() + interval '1 year'), auth.uid())
  RETURNING id INTO v_new_id;
  UPDATE public.trade_supplier_api_credentials SET grace_until = v_grace WHERE id = p_credential_id;
  RETURN jsonb_build_object('credential_id', v_new_id, 'raw_key', v_raw_key, 'key_prefix', v_key_prefix,
    'old_credential_id', p_credential_id, 'grace_until', v_grace);
END; $$;

CREATE OR REPLACE FUNCTION public.get_api_credentials(p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'nombre', c.nombre, 'key_prefix', c.key_prefix, 'scopes', c.scopes,
        'activa', c.activa, 'expires_at', c.expires_at, 'grace_until', c.grace_until,
        'last_used_at', c.last_used_at, 'last_ip', c.last_ip,
        'revoked_at', c.revoked_at, 'created_at', c.created_at
      ) ORDER BY c.created_at DESC)
     FROM public.trade_supplier_api_credentials c WHERE c.actor_id = p_actor_id),
    '[]'::jsonb
  );
END; $$;

-- ── Funciones de infraestructura (service_role only) ──────────────────────────

CREATE OR REPLACE FUNCTION public.resolve_api_credential(p_key_hash text, p_ip text DEFAULT NULL, p_ua text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cred RECORD;
BEGIN
  SELECT c.id, c.actor_id, c.scopes, c.nombre, c.activa, c.expires_at, c.grace_until,
         a.estado AS actor_estado
  INTO v_cred
  FROM public.trade_supplier_api_credentials c
  JOIN public.trade_marketplace_actors a ON a.id = c.actor_id
  WHERE c.key_hash = p_key_hash;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF NOT v_cred.activa AND (v_cred.grace_until IS NULL OR v_cred.grace_until < now()) THEN RETURN NULL; END IF;
  IF v_cred.expires_at < now() THEN RETURN NULL; END IF;
  IF v_cred.actor_estado <> 'active' THEN RETURN NULL; END IF;
  UPDATE public.trade_supplier_api_credentials SET last_used_at = now(), last_ip = p_ip, last_user_agent = p_ua WHERE id = v_cred.id;
  RETURN jsonb_build_object('credential_id', v_cred.id, 'actor_id', v_cred.actor_id, 'scopes', v_cred.scopes, 'nombre', v_cred.nombre);
END; $$;

REVOKE EXECUTE ON FUNCTION public.resolve_api_credential(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resolve_api_credential(text, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_api_credential(text, text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(p_actor_id uuid, p_endpoint text, p_limit integer)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_window   timestamptz := date_trunc('minute', now());
  v_reset_at timestamptz := date_trunc('minute', now()) + interval '1 minute';
  v_count    integer;
BEGIN
  INSERT INTO public.trade_supplier_api_rate_limits (actor_id, endpoint, window_start, request_count)
  VALUES (p_actor_id, p_endpoint, v_window, 1)
  ON CONFLICT (actor_id, endpoint, window_start) DO UPDATE
  SET request_count = trade_supplier_api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;
  RETURN jsonb_build_object('allowed', v_count <= p_limit, 'count', v_count, 'limit', p_limit,
    'remaining', GREATEST(0, p_limit - v_count), 'reset_at', v_reset_at);
END; $$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, text, integer) FROM anon;

CREATE OR REPLACE FUNCTION public.get_idempotency_record(p_key text, p_actor_id uuid, p_endpoint text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rec RECORD;
BEGIN
  SELECT request_hash, response_status, response_body INTO v_rec
  FROM public.trade_supplier_api_idempotency
  WHERE idempotency_key = p_key AND actor_id = p_actor_id AND endpoint = p_endpoint AND expires_at > now();
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('request_hash', v_rec.request_hash, 'response_status', v_rec.response_status, 'response_body', v_rec.response_body);
END; $$;

REVOKE EXECUTE ON FUNCTION public.get_idempotency_record(text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_idempotency_record(text, uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_idempotency_record(text, uuid, text) FROM anon;

CREATE OR REPLACE FUNCTION public.set_idempotency_record(
  p_key text, p_actor_id uuid, p_endpoint text, p_request_hash text, p_response_status integer, p_response_body jsonb
)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.trade_supplier_api_idempotency (idempotency_key, actor_id, endpoint, request_hash, response_status, response_body)
  VALUES (p_key, p_actor_id, p_endpoint, p_request_hash, p_response_status, p_response_body)
  ON CONFLICT (idempotency_key, actor_id, endpoint) DO NOTHING;
END; $$;

REVOKE EXECUTE ON FUNCTION public.set_idempotency_record(text, uuid, text, text, integer, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_idempotency_record(text, uuid, text, text, integer, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_idempotency_record(text, uuid, text, text, integer, jsonb) FROM anon;

CREATE OR REPLACE FUNCTION public.log_api_sync_start(
  p_credential_id uuid, p_actor_id uuid, p_endpoint text,
  p_idempotency_key text DEFAULT NULL, p_source_system text DEFAULT NULL,
  p_ip text DEFAULT NULL, p_user_agent text DEFAULT NULL, p_rows_received integer DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.trade_supplier_api_sync_log
    (credential_id, actor_id, endpoint, idempotency_key, source_system, ip, user_agent, rows_received)
  VALUES (p_credential_id, p_actor_id, p_endpoint, p_idempotency_key, p_source_system, p_ip, p_user_agent, p_rows_received)
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_api_sync_start(uuid,uuid,text,text,text,text,text,integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_api_sync_start(uuid,uuid,text,text,text,text,text,integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_api_sync_start(uuid,uuid,text,text,text,text,text,integer) FROM anon;

CREATE OR REPLACE FUNCTION public.log_api_sync_end(
  p_sync_id uuid, p_status text,
  p_rows_inserted integer DEFAULT NULL, p_rows_updated integer DEFAULT NULL,
  p_rows_rejected integer DEFAULT NULL, p_error_detail text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.trade_supplier_api_sync_log SET
    status = p_status, finished_at = now(),
    rows_inserted = p_rows_inserted, rows_updated = p_rows_updated,
    rows_rejected = p_rows_rejected, error_detail = p_error_detail
  WHERE id = p_sync_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.log_api_sync_end(uuid,text,integer,integer,integer,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_api_sync_end(uuid,text,integer,integer,integer,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_api_sync_end(uuid,text,integer,integer,integer,text) FROM anon;

CREATE OR REPLACE FUNCTION public.get_supplier_api_sync_log(p_actor_id uuid, p_limit integer DEFAULT 50)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._mkt_supplier_member_check(p_actor_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(jsonb_build_object(
        'id', l.id, 'endpoint', l.endpoint, 'idempotency_key', l.idempotency_key,
        'source_system', l.source_system, 'ip', l.ip,
        'started_at', l.started_at, 'finished_at', l.finished_at, 'status', l.status,
        'rows_received', l.rows_received, 'rows_inserted', l.rows_inserted,
        'rows_updated', l.rows_updated, 'rows_rejected', l.rows_rejected,
        'error_detail', l.error_detail, 'credential_nombre', c.nombre, 'credential_prefix', c.key_prefix
      ) ORDER BY l.started_at DESC)
     FROM public.trade_supplier_api_sync_log l
     JOIN public.trade_supplier_api_credentials c ON c.id = l.credential_id
     WHERE l.actor_id = p_actor_id LIMIT p_limit),
    '[]'::jsonb
  );
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_api_expired_records()
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.trade_supplier_api_idempotency WHERE expires_at < now();
  DELETE FROM public.trade_supplier_api_rate_limits  WHERE window_start < now() - interval '2 hours';
  UPDATE public.trade_supplier_api_credentials SET activa = false, revoked_at = now()
  WHERE grace_until IS NOT NULL AND grace_until < now() AND activa = true;
END; $$;;
