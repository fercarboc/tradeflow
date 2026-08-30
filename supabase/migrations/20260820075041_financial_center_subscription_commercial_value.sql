-- Fix: para subscriptions commercial_value = total_amount (ingreso real)
-- Actualizar trigger para nuevas facturas Stripe

CREATE OR REPLACE FUNCTION public.sync_platform_invoice_to_financial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc_id      uuid;
  v_doc_number  text;
  v_org_name    text;
  v_org_email   text;
  v_org_nif     text;
  v_org_dir     text;
  v_sub_plan    text;
  v_sub_cycle   text;
  v_amount      numeric(10,2);
BEGIN
  SELECT nombre, email, nif, direccion
  INTO v_org_name, v_org_email, v_org_nif, v_org_dir
  FROM public.trade_organizations WHERE id = NEW.org_id;

  SELECT plan, billing_cycle
  INTO v_sub_plan, v_sub_cycle
  FROM public.trade_subscriptions WHERE org_id = NEW.org_id
  ORDER BY created_at DESC LIMIT 1;

  v_amount := (NEW.amount_cents / 100.0)::numeric(10,2);

  SELECT id INTO v_doc_id
  FROM public.trade_financial_documents WHERE platform_invoice_id = NEW.id;

  IF v_doc_id IS NULL THEN
    v_doc_number := public.next_financial_doc_number('TF');
    INSERT INTO public.trade_financial_documents (
      doc_number, doc_series, revenue_type, payer_type, document_type,
      estado, payment_status,
      org_id, customer_name, customer_nif, customer_email, customer_address,
      concept, period_start, period_end,
      rate_amount, subtotal, commercial_value, net_amount, total_amount, currency,
      paid_at, stripe_invoice_id, invoice_url, invoice_pdf_url,
      platform_invoice_id, subscription_id, metadata, created_at
    ) SELECT
      v_doc_number, 'TF', 'subscription', 'installer', 'invoice',
      CASE NEW.status WHEN 'paid' THEN 'paid' WHEN 'pending' THEN 'pending' ELSE 'issued' END,
      CASE NEW.status WHEN 'paid' THEN 'paid' ELSE 'unpaid' END,
      NEW.org_id,
      COALESCE(v_org_name, NEW.org_id::text), v_org_nif, v_org_email, v_org_dir,
      COALESCE('Plan ' || INITCAP(COALESCE(NEW.plan, v_sub_plan, 'TrabFlow')), 'Suscripción TrabFlow'),
      NEW.period_start, NEW.period_end,
      v_amount, v_amount, v_amount, v_amount, v_amount,
      'EUR',
      NEW.paid_at, NEW.stripe_invoice_id, NEW.invoice_url, NEW.invoice_pdf_url,
      NEW.id,
      (SELECT id FROM public.trade_subscriptions WHERE org_id = NEW.org_id ORDER BY created_at DESC LIMIT 1),
      jsonb_build_object(
        'plan', COALESCE(NEW.plan, v_sub_plan),
        'billing_cycle', v_sub_cycle,
        'stripe_invoice_id', NEW.stripe_invoice_id,
        'amount_cents', NEW.amount_cents
      ),
      NEW.created_at;
  ELSE
    UPDATE public.trade_financial_documents SET
      estado          = CASE NEW.status WHEN 'paid' THEN 'paid' WHEN 'pending' THEN 'pending' ELSE 'issued' END,
      payment_status  = CASE NEW.status WHEN 'paid' THEN 'paid' ELSE 'unpaid' END,
      paid_at         = NEW.paid_at,
      invoice_url     = COALESCE(NEW.invoice_url, invoice_url),
      invoice_pdf_url = COALESCE(NEW.invoice_pdf_url, invoice_pdf_url),
      total_amount    = v_amount,
      commercial_value= v_amount,
      net_amount      = v_amount,
      updated_at      = now()
    WHERE id = v_doc_id;
  END IF;
  RETURN NEW;
END;
$$;;
