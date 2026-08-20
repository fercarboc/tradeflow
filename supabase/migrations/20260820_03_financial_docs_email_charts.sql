-- ============================================================
-- E4.F Gestión documental publicidad: public_token + email + gráficos
-- ============================================================

-- 1. Añadir public_token a trade_financial_documents
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS public_token uuid DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS trade_financial_documents_public_token_idx
  ON public.trade_financial_documents(public_token);

-- 2. Añadir sent_at y sent_to para tracking de envíos
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS sent_to  text;

-- 3. Actualizar admin_get_financial_documents para incluir nuevos campos
-- Hay que DROP + CREATE porque cambia la firma RETURNS TABLE
DROP FUNCTION IF EXISTS public.admin_get_financial_documents(text,text,text,text,date,date,text,text,text,text,uuid);

CREATE OR REPLACE FUNCTION public.admin_get_financial_documents(
  p_admin_user_id text      DEFAULT NULL,
  p_doc_type      text      DEFAULT NULL,
  p_estado        text      DEFAULT NULL,
  p_payment_status text     DEFAULT NULL,
  p_date_from     date      DEFAULT NULL,
  p_date_to       date      DEFAULT NULL,
  p_actor_type    text      DEFAULT NULL,
  p_period_start  text      DEFAULT NULL,
  p_period_end    text      DEFAULT NULL,
  p_search        text      DEFAULT NULL,
  p_actor_id      uuid      DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  doc_number          text,
  doc_type            text,
  reference_id        uuid,
  reference_type      text,
  actor_id            uuid,
  actor_type          text,
  actor_name          text,
  customer_email      text,
  customer_nif        text,
  period_start        date,
  period_end          date,
  estado              text,
  payment_status      text,
  pricing_mode        text,
  rate_amount         numeric,
  promotion_amount    numeric,
  commercial_value    numeric,
  total_amount        numeric,
  paid_amount         numeric,
  waived_amount       numeric,
  payment_date        date,
  due_date            date,
  notes               text,
  metadata            jsonb,
  created_at          timestamptz,
  updated_at          timestamptz,
  sent_at             timestamptz,
  sent_to             text,
  public_token        uuid,
  actor_telefono      text,
  actor_tax_id        text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verificar que el usuario es admin
  IF NOT EXISTS (SELECT 1 FROM public.trade_admin_users WHERE user_id = p_admin_user_id::uuid) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.doc_number,
    d.doc_type,
    d.reference_id,
    d.reference_type,
    d.actor_id,
    d.actor_type,
    d.actor_name,
    d.customer_email,
    d.customer_nif,
    d.period_start,
    d.period_end,
    d.estado,
    d.payment_status,
    d.pricing_mode,
    d.rate_amount,
    d.promotion_amount,
    d.commercial_value,
    d.total_amount,
    d.paid_amount,
    d.waived_amount,
    d.payment_date,
    d.due_date,
    d.notes,
    d.metadata,
    d.created_at,
    d.updated_at,
    d.sent_at,
    d.sent_to,
    d.public_token,
    a.telefono               AS actor_telefono,
    COALESCE(a.tax_id, d.customer_nif) AS actor_tax_id
  FROM public.trade_financial_documents d
  LEFT JOIN public.trade_marketplace_actors a ON a.id = d.actor_id
  WHERE
    (p_doc_type       IS NULL OR d.doc_type       = p_doc_type)
    AND (p_estado     IS NULL OR d.estado         = p_estado)
    AND (p_payment_status IS NULL OR d.payment_status = p_payment_status)
    AND (p_date_from  IS NULL OR d.created_at::date >= p_date_from)
    AND (p_date_to    IS NULL OR d.created_at::date <= p_date_to)
    AND (p_actor_type IS NULL OR d.actor_type     = p_actor_type)
    AND (p_actor_id   IS NULL OR d.actor_id       = p_actor_id)
    AND (p_period_start IS NULL OR d.period_start >= p_period_start::date)
    AND (p_period_end   IS NULL OR d.period_end   <= p_period_end::date)
    AND (
      p_search IS NULL
      OR d.doc_number    ILIKE '%' || p_search || '%'
      OR d.actor_name    ILIKE '%' || p_search || '%'
      OR d.customer_email ILIKE '%' || p_search || '%'
      OR d.customer_nif  ILIKE '%' || p_search || '%'
    )
  ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_financial_documents(text,text,text,text,date,date,text,text,text,text,uuid)
  TO authenticated;

-- 4. Función pública para ver documento por token (sin auth)
CREATE OR REPLACE FUNCTION public.get_financial_document_public(
  p_token uuid
)
RETURNS TABLE (
  id                uuid,
  doc_number        text,
  doc_type          text,
  actor_name        text,
  customer_email    text,
  customer_nif      text,
  period_start      date,
  period_end        date,
  estado            text,
  payment_status    text,
  pricing_mode      text,
  rate_amount       numeric,
  promotion_amount  numeric,
  commercial_value  numeric,
  total_amount      numeric,
  waived_amount     numeric,
  notes             text,
  metadata          jsonb,
  created_at        timestamptz,
  actor_telefono    text,
  actor_tax_id      text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.doc_number,
    d.doc_type,
    d.actor_name,
    d.customer_email,
    d.customer_nif,
    d.period_start,
    d.period_end,
    d.estado,
    d.payment_status,
    d.pricing_mode,
    d.rate_amount,
    d.promotion_amount,
    d.commercial_value,
    d.total_amount,
    d.waived_amount,
    d.notes,
    d.metadata,
    d.created_at,
    a.telefono AS actor_telefono,
    COALESCE(a.tax_id, d.customer_nif) AS actor_tax_id
  FROM public.trade_financial_documents d
  LEFT JOIN public.trade_marketplace_actors a ON a.id = d.actor_id
  WHERE d.public_token = p_token
    AND d.estado = 'emitido';
END;
$$;

-- Accesible sin autenticación (anon + authenticated)
GRANT EXECUTE ON FUNCTION public.get_financial_document_public(uuid)
  TO anon, authenticated;

-- 5. Función para marcar documento como enviado (solo admin)
CREATE OR REPLACE FUNCTION public.admin_mark_financial_doc_sent(
  p_doc_id  uuid,
  p_sent_to text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.trade_admin_users WHERE user_id = v_admin_id) THEN
    RAISE EXCEPTION 'Acceso denegado';
  END IF;

  UPDATE public.trade_financial_documents
  SET sent_at = now(), sent_to = p_sent_to
  WHERE id = p_doc_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_mark_financial_doc_sent(uuid, text)
  TO authenticated;
