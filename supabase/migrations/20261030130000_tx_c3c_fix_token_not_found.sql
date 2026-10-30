-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C3-TOKEN-FIX — Distinguir token inexistente de token ya procesado
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BUG:
--   accept_quote_public hacía:
--     WHERE token = v_token_uuid AND status = 'pending'
--   Si el token no existe → NOT FOUND → devuelve {ok:true, already_processed:true}
--   Si el token existe pero ya fue usado → NOT FOUND → mismo resultado
--   Ambos casos son semánticamente distintos y deben recibir respuestas distintas.
--
-- FIX:
--   · Paso 1: SELECT FOR UPDATE sin filtro de status → si NOT FOUND → {error:'invalid_token'}
--   · Paso 2: verificar status != 'pending' → {ok:true, already_processed:true}
--   · Paso 3: resto del flujo sin cambios
--
-- CONTRATO NUEVO:
--   token inexistente        → {ok:false, error:'invalid_token'}
--   token ya procesado       → {ok:true,  already_processed:true}
--   token pendiente válido   → flujo normal (sin cambios)
--   token con formato inválido → {ok:false, error:'invalid_token'} (paso 0, sin cambios)
--
-- PERMISOS:
--   Igual que antes: REVOKE ALL FROM PUBLIC, service_role tiene EXECUTE implícito.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_uuid uuid;
  v_token_row  record;
  v_quote_row  record;
  v_svc_result jsonb;
  v_service_id uuid;
BEGIN
  -- ── 0. Validar formato UUID del token ─────────────────────────────────────
  BEGIN
    v_token_uuid := p_token::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END;

  -- ── 1. Bloquear y leer el token (sin filtro de status) ───────────────────
  -- FOR UPDATE garantiza idempotencia bajo llamadas concurrentes.
  -- Primero comprobamos si el token EXISTE; luego su estado.
  SELECT * INTO v_token_row
  FROM   public.trade_quote_tokens
  WHERE  token = v_token_uuid
  FOR UPDATE;

  -- Token que nunca existió → error explícito (no "ya procesado")
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  -- Token que ya fue aceptado o rechazado → idempotente
  IF v_token_row.status != 'pending' THEN
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

  -- ── 6. Crear servicio de transporte ──────────────────────────────────────
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
      EXCEPTION WHEN OTHERS THEN NULL;
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

REVOKE ALL ON FUNCTION public.accept_quote_public(text) FROM PUBLIC;
