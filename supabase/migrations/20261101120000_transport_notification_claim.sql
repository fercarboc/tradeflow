-- Idempotencia con FSM de estados para notificaciones de registro de transporte.
--
-- PROBLEMA resuelto: check→send→claim no garantiza envío único.
-- Dos requests concurrentes pasan el check, ambos envían, ambos intentan claim.
-- Con UNIQUE INDEX + ON CONFLICT DO NOTHING solo uno registra — el otro queda sin traza.
--
-- SOLUCIÓN: FSM atómico en BD con estados pending | sent | failed.
--   1. claim_transport_notification  → INSERT (new_claim) | UPDATE desde failed (retry_claim)
--                                     | in_progress (pending reciente) | already_sent
--   2. EF envía email con Resend.
--   3. mark_transport_notification   → actualiza a sent (éxito) o failed (reintento permitido).
--
-- TIMEOUT: si 'pending' lleva más de 5 minutos (crash del emisor), se permite reintento.
-- El UPDATE de estado es atómico a nivel de fila: dos requests concurrentes en status='failed'
-- solo uno obtiene FOUND=true.

-- Índice parcial único: una sola fila 'transport_notify_sent' por org.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transport_notify_per_org
  ON public.admin_activity_log (action, target_org_id)
  WHERE action = 'transport_notify_sent' AND target_org_id IS NOT NULL;


-- ── claim_transport_notification ────────────────────────────────────────────
-- Obtiene el claim de envío de notificación o informa del estado actual.
-- Devuelve: 'new_claim' | 'retry_claim' | 'in_progress' | 'already_sent'

CREATE OR REPLACE FUNCTION public.claim_transport_notification(p_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_status text;
BEGIN
  -- Primer intento: INSERT si nunca se ha notificado esta org.
  INSERT INTO public.admin_activity_log (admin_email, action, target_org_id, metadata)
  VALUES (
    'system',
    'transport_notify_sent',
    p_org_id,
    '{"status":"pending","source":"edge_fn_transport_notify"}'::jsonb
  )
  ON CONFLICT (action, target_org_id)
  WHERE (action = 'transport_notify_sent' AND target_org_id IS NOT NULL)
  DO NOTHING;

  IF FOUND THEN
    RETURN 'new_claim';
  END IF;

  -- Ya existe: recuperar claim si status='failed' O si 'pending' expiró (>5 min, posible crash emisor).
  -- UPDATE es atómico a nivel de fila: si dos requests compiten en 'failed',
  -- solo uno obtiene FOUND=true; el otro espera y ve 'pending' (no expirado) → in_progress.
  UPDATE public.admin_activity_log
  SET    metadata = jsonb_set(metadata, '{status}', '"pending"')
  WHERE  action        = 'transport_notify_sent'
    AND  target_org_id = p_org_id
    AND  (
           metadata->>'status' = 'failed'
           OR (
             metadata->>'status' = 'pending'
             AND created_at < now() - INTERVAL '5 minutes'
           )
         );

  IF FOUND THEN
    RETURN 'retry_claim';
  END IF;

  -- Estado actual para respuesta.
  SELECT metadata->>'status' INTO v_current_status
  FROM   public.admin_activity_log
  WHERE  action = 'transport_notify_sent' AND target_org_id = p_org_id;

  RETURN CASE v_current_status
    WHEN 'sent'    THEN 'already_sent'
    WHEN 'pending' THEN 'in_progress'
    ELSE                'already_sent'   -- estado desconocido: tratar conservadoramente
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_transport_notification(uuid) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.claim_transport_notification(uuid) TO service_role;


-- ── mark_transport_notification ─────────────────────────────────────────────
-- Transiciona el estado de la notificación de 'pending' a 'sent' o 'failed'.
-- Solo transiciona desde 'pending' para evitar sobrescribir un estado final.

CREATE OR REPLACE FUNCTION public.mark_transport_notification(p_org_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_status NOT IN ('sent', 'failed') THEN
    RAISE EXCEPTION 'Estado inválido para notificación de transporte: %. Permitidos: sent, failed', p_status;
  END IF;

  UPDATE public.admin_activity_log
  SET    metadata = jsonb_set(metadata, '{status}', to_jsonb(p_status))
  WHERE  action        = 'transport_notify_sent'
    AND  target_org_id = p_org_id
    AND  metadata->>'status' = 'pending';  -- solo transicionar desde 'pending'
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_transport_notification(uuid, text) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.mark_transport_notification(uuid, text) TO service_role;
