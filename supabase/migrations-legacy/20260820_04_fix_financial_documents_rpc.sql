-- Corrige admin_get_financial_documents: parámetros correctos + columnas nuevas
-- La versión anterior (03) tenía p_admin_user_id/p_doc_type que rompían la llamada desde supabase.ts

DROP FUNCTION IF EXISTS public.admin_get_financial_documents(text,text,text,text,date,date,text,text,text,text,uuid);

CREATE OR REPLACE FUNCTION public.admin_get_financial_documents(
  p_revenue_type   text    DEFAULT NULL,
  p_payer_type     text    DEFAULT NULL,
  p_estado         text    DEFAULT NULL,
  p_payment_status text    DEFAULT NULL,
  p_date_from      date    DEFAULT NULL,
  p_date_to        date    DEFAULT NULL,
  p_search         text    DEFAULT NULL,
  p_plan           text    DEFAULT NULL,
  p_billing_cycle  text    DEFAULT NULL,
  p_slot_id        text    DEFAULT NULL,
  p_actor_id       uuid    DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  doc_number          text,
  doc_series          text,
  revenue_type        text,
  payer_type          text,
  document_type       text,
  estado              text,
  payment_status      text,
  org_id              uuid,
  actor_id            uuid,
  customer_name       text,
  customer_nif        text,
  customer_email      text,
  concept             text,
  period_start        date,
  period_end          date,
  rate_amount         numeric,
  discount_amount     numeric,
  promotion_amount    numeric,
  commercial_value    numeric,
  net_amount          numeric,
  tax_rate            numeric,
  tax_amount          numeric,
  total_amount        numeric,
  currency            text,
  paid_at             timestamptz,
  payment_method      text,
  stripe_invoice_id   text,
  invoice_url         text,
  invoice_pdf_url     text,
  issued_at           timestamptz,
  sent_at             timestamptz,
  sent_to             text,
  public_token        uuid,
  metadata            jsonb,
  created_at          timestamptz,
  org_nombre          text,
  actor_nombre        text,
  slot_nombre         text,
  actor_telefono      text,
  actor_tax_id        text
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
    d.doc_series,
    d.revenue_type,
    d.payer_type,
    d.document_type,
    d.estado,
    d.payment_status,
    d.org_id,
    d.actor_id,
    d.customer_name,
    d.customer_nif,
    d.customer_email,
    d.concept,
    d.period_start,
    d.period_end,
    d.rate_amount,
    d.discount_amount,
    d.promotion_amount,
    d.commercial_value,
    d.net_amount,
    d.tax_rate,
    d.tax_amount,
    d.total_amount,
    d.currency::text,
    d.paid_at,
    d.payment_method,
    d.stripe_invoice_id,
    d.invoice_url,
    d.invoice_pdf_url,
    d.issued_at,
    d.sent_at,
    d.sent_to,
    d.public_token,
    d.metadata,
    d.created_at,
    o.nombre                              AS org_nombre,
    a.nombre                              AS actor_nombre,
    s.nombre                              AS slot_nombre,
    a.telefono                            AS actor_telefono,
    COALESCE(a.tax_id, d.customer_nif)   AS actor_tax_id
  FROM public.trade_financial_documents d
  LEFT JOIN public.trade_organizations        o ON o.id = d.org_id
  LEFT JOIN public.trade_marketplace_actors   a ON a.id = d.actor_id
  LEFT JOIN public.trade_marketplace_ad_bookings b ON b.id = d.ad_booking_id
  LEFT JOIN public.trade_marketplace_ad_slots s ON s.id = b.slot_id
  WHERE
    (p_revenue_type   IS NULL OR d.revenue_type   = p_revenue_type)
    AND (p_payer_type IS NULL OR d.payer_type     = p_payer_type)
    AND (p_estado     IS NULL OR d.estado         = p_estado)
    AND (p_payment_status IS NULL OR d.payment_status = p_payment_status)
    AND (p_date_from  IS NULL OR COALESCE(d.period_start, d.created_at::date) >= p_date_from)
    AND (p_date_to    IS NULL OR COALESCE(d.period_end,   d.created_at::date) <= p_date_to)
    AND (p_search     IS NULL OR p_search = '' OR
         d.doc_number      ILIKE '%' || p_search || '%' OR
         d.customer_name   ILIKE '%' || p_search || '%' OR
         d.customer_email  ILIKE '%' || p_search || '%' OR
         d.customer_nif    ILIKE '%' || p_search || '%' OR
         d.stripe_invoice_id ILIKE '%' || p_search || '%' OR
         o.nombre          ILIKE '%' || p_search || '%' OR
         a.nombre          ILIKE '%' || p_search || '%')
    AND (p_plan         IS NULL OR d.metadata->>'plan'          = p_plan)
    AND (p_billing_cycle IS NULL OR d.metadata->>'billing_cycle' = p_billing_cycle)
    AND (p_slot_id      IS NULL OR b.slot_id::text               = p_slot_id)
    AND (p_actor_id     IS NULL OR d.actor_id                    = p_actor_id)
  ORDER BY d.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_financial_documents(text,text,text,text,date,date,text,text,text,text,uuid)
  TO authenticated;
