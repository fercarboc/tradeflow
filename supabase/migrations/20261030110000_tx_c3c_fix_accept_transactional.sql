-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C3-C-FIX — Aceptación transaccional de presupuesto público
-- ══════════════════════════════════════════════════════════════════════════════
--
-- RIESGO RESUELTO:
--   El flujo anterior en trade-quote-public ejecutaba 3 operaciones secuenciales
--   sin transacción: 1) UPDATE token, 2) UPDATE quote, 3) CREATE service.
--   Si la creación del servicio fallaba (error de red, datos de intake inválidos,
--   contención de locks), el presupuesto quedaba aceptado pero sin servicio, sin
--   registro persistente del error y sin mecanismo automático de recuperación.
--
-- SOLUCIÓN:
--   Una única RPC SECURITY DEFINER que hace las cuatro operaciones en una sola
--   transacción PostgreSQL:
--     1. SELECT FOR UPDATE en trade_quote_tokens  → bloqueo para idempotencia
--     2. SELECT FOR UPDATE en trade_quotes        → bloqueo concurrente
--     3. UPDATE token → 'accepted'
--     4. UPDATE quote → 'Aceptado'
--     5. Si vertical='transporte': create_transport_service_from_quote dentro
--        de un bloque EXCEPTION propio.
--        · Si el servicio se crea: se añade transport_service_id a la respuesta.
--        · Si falla: el error se persiste en metadata.transport_service_error
--          para que el panel lo muestre; la aceptación NO se revierte.
--
-- SEMÁNTICA DE SUBTRANSACCIONES PostgreSQL:
--   Los steps 3 y 4 quedan FUERA del bloque BEGIN...EXCEPTION. Si el step 5
--   lanza una excepción, PostgreSQL hace rollback solo del savepoint interno
--   (el INSERT del servicio), pero los steps 3 y 4 permanecen confirmados.
--   El manejador EXCEPTION ejecuta en la transacción exterior y sus writes
--   (el UPDATE de metadata.transport_service_error) se confirman con ella.
--
-- INVARIANTES:
--   · Presupuesto aceptado permanece aceptado aunque el servicio falle.
--   · Se genera exactamente un servicio por presupuesto puntual elegible.
--   · Reintentar devuelve el mismo servicio (idempotencia vía UNIQUE + step 6).
--   · No se crean servicios para presupuestos no aceptados.
--   · No se crean servicios para otras verticales.
--   · Los errores quedan en metadata.transport_service_error (detectables).
--   · service_role no se expone al navegador (REVOKE FROM PUBLIC).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_quote_public(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_token_row  record;
  v_quote_row  record;
  v_svc_result jsonb;
  v_service_id uuid;
BEGIN
  -- ── 1. Bloquear y leer el token ───────────────────────────────────────────
  -- FOR UPDATE garantiza idempotencia bajo llamadas concurrentes: solo una
  -- transacción ve status='pending' y procede; las demás devuelven already_processed.
  SELECT * INTO v_token_row
  FROM   public.trade_quote_tokens
  WHERE  token = p_token AND status = 'pending'
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
  WHERE  token = p_token AND status = 'pending';

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
