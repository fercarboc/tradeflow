-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C3-SQL-FIX — Corregir cast UUID en accept_quote_public
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BUG:
--   trade_quote_tokens.token es de tipo uuid, pero la función declaraba
--   p_token text y hacía WHERE token = p_token sin conversión explícita.
--   PostgreSQL no tiene operador uuid = text → error 42883 en toda llamada.
--
-- FIX:
--   · Declarar v_token_uuid uuid y validar el cast al inicio de la función.
--   · Tokens con formato inválido (no UUID) devuelven {error:'invalid_token'}
--     de forma controlada, sin exponer información interna ni lanzar SQL.
--   · Usar v_token_uuid en los dos WHERE que tocan trade_quote_tokens.
--   · Todo lo demás se conserva íntegramente: SECURITY DEFINER, search_path,
--     bloqueos FOR UPDATE, semántica de subtransacciones, permisos EXECUTE.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_uuid uuid;       -- FIX: variable con tipo correcto para la comparación
  v_token_row  record;
  v_quote_row  record;
  v_svc_result jsonb;
  v_service_id uuid;
BEGIN
  -- ── 0. Validar formato UUID del token ─────────────────────────────────────
  -- Tokens malformados (no son UUID válidos) se rechazan aquí con un error
  -- funcional seguro, antes de intentar cualquier acceso a la base de datos.
  BEGIN
    v_token_uuid := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END;

  -- ── 1. Bloquear y leer el token ───────────────────────────────────────────
  -- FOR UPDATE garantiza idempotencia bajo llamadas concurrentes: solo una
  -- transacción ve status='pending' y procede; las demás devuelven already_processed.
  SELECT * INTO v_token_row
  FROM   public.trade_quote_tokens
  WHERE  token = v_token_uuid AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- ── 2. Bloquear y leer el presupuesto ────────────────────────────────────
  SELECT * INTO v_quote_row
  FROM   public.trade_quotes
  WHERE  org_id = v_token_row.org_id AND numero = v_token_row.quote_numero
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'quote_not_found');
  END IF;

  -- ── 3. Validar estado compatible con aceptación ───────────────────────────
  IF v_quote_row.estado NOT IN ('Borrador', 'Enviado', 'Aceptado') THEN
    RETURN jsonb_build_object(
      'error',        'quote_state_incompatible',
      'quote_estado', v_quote_row.estado
    );
  END IF;

  -- ── 4. Marcar token como aceptado ─────────────────────────────────────────
  UPDATE public.trade_quote_tokens
  SET    status = 'accepted', accepted_at = now()
  WHERE  token = v_token_uuid AND status = 'pending';

  -- ── 5. Actualizar estado del presupuesto ──────────────────────────────────
  UPDATE public.trade_quotes
  SET    estado = 'Aceptado'
  WHERE  id = v_quote_row.id AND org_id = v_token_row.org_id
  AND    estado IN ('Borrador', 'Enviado', 'Aceptado');

  -- ── 6. Crear servicio de transporte en la misma transacción ──────────────
  -- Los steps 4 y 5 están FUERA del bloque EXCEPTION: si el servicio falla,
  -- solo se hace rollback del savepoint interno (step 6), no de la aceptación.
  IF COALESCE(v_quote_row.metadata->>'vertical', '') = 'transporte' THEN
    BEGIN
      v_svc_result := public.create_transport_service_from_quote(
        v_token_row.org_id,
        v_quote_row.id
      );
      IF v_svc_result IS NOT NULL
         AND (v_svc_result->>'ok')::boolean IS TRUE
         AND (v_svc_result->>'service_id') IS NOT NULL
      THEN
        v_service_id := (v_svc_result->>'service_id')::uuid;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      -- La aceptación ya está comprometida. Registrar el error en metadata
      -- para que el panel lo detecte y el gestor pueda crear el servicio
      -- manualmente desde el badge "Crear servicio de transporte".
      v_svc_result := jsonb_build_object(
        'ok',      false,
        'code',    'SERVICE_CREATION_ERROR',
        'message', SQLERRM
      );
      BEGIN
        UPDATE public.trade_quotes
        SET    metadata = jsonb_set(
                 COALESCE(metadata, '{}'::jsonb),
                 '{transport_service_error}',
                 jsonb_build_object(
                   'code',    'SERVICE_CREATION_ERROR',
                   'message', SQLERRM,
                   'ts',      to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                 )
               )
        WHERE  id = v_quote_row.id AND org_id = v_token_row.org_id;
      EXCEPTION WHEN OTHERS THEN NULL; -- best effort
      END;
    END;
  END IF;

  -- ── 7. Devolver resultado ─────────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                   true,
    'org_id',               v_token_row.org_id,
    'quote_numero',         v_token_row.quote_numero,
    'client_name',          v_token_row.client_name,
    'transport_service_id', v_service_id,
    'service_result',       v_svc_result
  );
END;
$$;

-- Esta función solo la llama service_role (Edge Functions). No exponer a navegadores.
REVOKE ALL ON FUNCTION public.accept_quote_public(text) FROM PUBLIC;
-- service_role tiene EXECUTE implícito como superusuario en Supabase
