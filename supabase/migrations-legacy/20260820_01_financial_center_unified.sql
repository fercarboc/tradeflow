-- ════════════════════════════════════════════════════════════════════════════
-- Centro Económico Unificado de TrabFlow — trade_financial_documents
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. Secuencia de numeración por serie/año ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_doc_number_seq (
  serie     text    NOT NULL,
  year_val  integer NOT NULL,
  last_num  integer NOT NULL DEFAULT 0,
  PRIMARY KEY (serie, year_val)
);

CREATE OR REPLACE FUNCTION public.next_financial_doc_number(p_serie text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year integer := EXTRACT(YEAR FROM now())::integer;
  v_num  integer;
BEGIN
  INSERT INTO public.trade_doc_number_seq (serie, year_val, last_num)
  VALUES (p_serie, v_year, 1)
  ON CONFLICT (serie, year_val) DO UPDATE
    SET last_num = public.trade_doc_number_seq.last_num + 1
  RETURNING last_num INTO v_num;
  RETURN p_serie || '-' || v_year || '-' || LPAD(v_num::text, 4, '0');
END;
$$;

-- ── 2. Tabla principal de documentos financieros ─────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_financial_documents (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_number          text        UNIQUE NOT NULL,
  doc_series          text        NOT NULL DEFAULT 'TF',

  -- Clasificación
  revenue_type        text        NOT NULL
    CHECK (revenue_type IN ('subscription','advertising','marketplace','provider_service','other')),
  payer_type          text        NOT NULL
    CHECK (payer_type IN ('installer','installer_company','provider','other')),
  document_type       text        NOT NULL DEFAULT 'invoice'
    CHECK (document_type IN ('invoice','commercial_summary','proforma','credit_note')),
  estado              text        NOT NULL DEFAULT 'draft'
    CHECK (estado IN ('draft','issued','pending','paid','waived','cancelled','refunded')),
  payment_status      text        NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('paid','unpaid','waived','refunded')),

  -- Pagador
  org_id              uuid        REFERENCES public.trade_organizations(id),
  actor_id            uuid        REFERENCES public.trade_marketplace_actors(id),
  customer_name       text        NOT NULL DEFAULT '',
  customer_nif        text,
  customer_email      text,
  customer_address    text,

  -- Referencias al origen del ingreso
  platform_invoice_id uuid        REFERENCES public.trade_platform_invoices(id),
  ad_booking_id       uuid        REFERENCES public.trade_marketplace_ad_bookings(id),
  ad_campaign_id      uuid        REFERENCES public.trade_marketplace_ad_campaigns(id),
  subscription_id     uuid        REFERENCES public.trade_subscriptions(id),

  -- Snapshot económico (inmutable una vez emitido)
  concept             text        NOT NULL DEFAULT '',
  period_start        date,
  period_end          date,
  rate_amount         numeric(10,2) NOT NULL DEFAULT 0,
  quantity            numeric(10,4) NOT NULL DEFAULT 1,
  subtotal            numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount     numeric(10,2) NOT NULL DEFAULT 0,
  promotion_amount    numeric(10,2) NOT NULL DEFAULT 0,
  commercial_value    numeric(10,2) NOT NULL DEFAULT 0,
  net_amount          numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate            numeric(5,2)  NOT NULL DEFAULT 0,
  tax_amount          numeric(10,2) NOT NULL DEFAULT 0,
  total_amount        numeric(10,2) NOT NULL DEFAULT 0,
  currency            char(3)       NOT NULL DEFAULT 'EUR',

  -- Pago
  paid_at             timestamptz,
  payment_method      text,
  stripe_payment_id   text,
  stripe_invoice_id   text,
  stripe_customer_id  text,
  invoice_url         text,
  invoice_pdf_url     text,

  -- Ciclo de vida
  issued_at           timestamptz,
  sent_at             timestamptz,
  sent_to             text,

  -- Metadatos (plan, billing_cycle, slot_id, etc.)
  metadata            jsonb       NOT NULL DEFAULT '{}',

  created_by          uuid        REFERENCES auth.users(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tfd_revenue_type        ON public.trade_financial_documents(revenue_type);
CREATE INDEX IF NOT EXISTS idx_tfd_payer_type          ON public.trade_financial_documents(payer_type);
CREATE INDEX IF NOT EXISTS idx_tfd_estado              ON public.trade_financial_documents(estado);
CREATE INDEX IF NOT EXISTS idx_tfd_payment_status      ON public.trade_financial_documents(payment_status);
CREATE INDEX IF NOT EXISTS idx_tfd_org_id              ON public.trade_financial_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_tfd_actor_id            ON public.trade_financial_documents(actor_id);
CREATE INDEX IF NOT EXISTS idx_tfd_period_start        ON public.trade_financial_documents(period_start);
CREATE INDEX IF NOT EXISTS idx_tfd_platform_invoice_id ON public.trade_financial_documents(platform_invoice_id);
CREATE INDEX IF NOT EXISTS idx_tfd_ad_booking_id       ON public.trade_financial_documents(ad_booking_id);

ALTER TABLE public.trade_financial_documents ENABLE ROW LEVEL SECURITY;
-- Solo accesible via RPCs SECURITY DEFINER (sin política pública)

-- ── 3. Campos adicionales en bookings ────────────────────────────────────
ALTER TABLE public.trade_marketplace_ad_bookings
  ADD COLUMN IF NOT EXISTS pricing_mode text DEFAULT 'validation_free'
    CHECK (pricing_mode IN ('validation_free','standard','discounted','custom')),
  ADD COLUMN IF NOT EXISTS booking_commercial_value numeric(10,2);

UPDATE public.trade_marketplace_ad_bookings
SET
  pricing_mode = 'validation_free',
  booking_commercial_value = estimated_total_snapshot
WHERE pricing_mode IS NULL
  AND estado IN ('CONFIRMED','RESERVED','ACCEPTED');

-- ── 4. Trigger: sincronizar trade_platform_invoices → financial_documents ─
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
BEGIN
  SELECT nombre, email, nif, direccion
  INTO v_org_name, v_org_email, v_org_nif, v_org_dir
  FROM public.trade_organizations
  WHERE id = NEW.org_id;

  SELECT plan, billing_cycle
  INTO v_sub_plan, v_sub_cycle
  FROM public.trade_subscriptions
  WHERE org_id = NEW.org_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_doc_id
  FROM public.trade_financial_documents
  WHERE platform_invoice_id = NEW.id;

  IF v_doc_id IS NULL THEN
    v_doc_number := public.next_financial_doc_number('TF');
    INSERT INTO public.trade_financial_documents (
      doc_number, doc_series, revenue_type, payer_type, document_type,
      estado, payment_status,
      org_id, customer_name, customer_nif, customer_email, customer_address,
      concept, period_start, period_end,
      rate_amount, subtotal, net_amount, total_amount, currency,
      paid_at, stripe_invoice_id, invoice_url, invoice_pdf_url,
      platform_invoice_id, subscription_id,
      metadata, created_at
    )
    SELECT
      v_doc_number, 'TF', 'subscription', 'installer', 'invoice',
      CASE NEW.status WHEN 'paid' THEN 'paid' WHEN 'pending' THEN 'pending' ELSE 'issued' END,
      CASE NEW.status WHEN 'paid' THEN 'paid' ELSE 'unpaid' END,
      NEW.org_id,
      COALESCE(v_org_name, NEW.org_id::text), v_org_nif, v_org_email, v_org_dir,
      COALESCE('Plan ' || INITCAP(COALESCE(NEW.plan, v_sub_plan, 'TrabFlow')), 'Suscripción TrabFlow'),
      NEW.period_start, NEW.period_end,
      (NEW.amount_cents / 100.0)::numeric(10,2),
      (NEW.amount_cents / 100.0)::numeric(10,2),
      (NEW.amount_cents / 100.0)::numeric(10,2),
      (NEW.amount_cents / 100.0)::numeric(10,2),
      'EUR',
      NEW.paid_at, NEW.stripe_invoice_id, NEW.invoice_url, NEW.invoice_pdf_url,
      NEW.id,
      (SELECT id FROM public.trade_subscriptions WHERE org_id = NEW.org_id ORDER BY created_at DESC LIMIT 1),
      jsonb_build_object(
        'plan',             COALESCE(NEW.plan, v_sub_plan),
        'billing_cycle',    v_sub_cycle,
        'stripe_invoice_id',NEW.stripe_invoice_id,
        'amount_cents',     NEW.amount_cents
      ),
      NEW.created_at;
  ELSE
    UPDATE public.trade_financial_documents SET
      estado         = CASE NEW.status WHEN 'paid' THEN 'paid' WHEN 'pending' THEN 'pending' ELSE 'issued' END,
      payment_status = CASE NEW.status WHEN 'paid' THEN 'paid' ELSE 'unpaid' END,
      paid_at        = NEW.paid_at,
      invoice_url    = COALESCE(NEW.invoice_url, invoice_url),
      invoice_pdf_url= COALESCE(NEW.invoice_pdf_url, invoice_pdf_url),
      total_amount   = (NEW.amount_cents / 100.0)::numeric(10,2),
      net_amount     = (NEW.amount_cents / 100.0)::numeric(10,2),
      updated_at     = now()
    WHERE id = v_doc_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_platform_invoice ON public.trade_platform_invoices;
CREATE TRIGGER trg_sync_platform_invoice
AFTER INSERT OR UPDATE ON public.trade_platform_invoices
FOR EACH ROW EXECUTE FUNCTION public.sync_platform_invoice_to_financial();

-- ── 5. Helper manual para backfill (sin trigger) ─────────────────────────
CREATE OR REPLACE FUNCTION public.sync_platform_invoice_to_financial_manual(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   record;
  v_doc_id      uuid;
  v_doc_number  text;
  v_org_name    text;
  v_org_email   text;
  v_org_nif     text;
  v_org_dir     text;
  v_sub_plan    text;
  v_sub_cycle   text;
  v_sub_id      uuid;
BEGIN
  SELECT * INTO v_inv FROM public.trade_platform_invoices WHERE id = p_invoice_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT nombre, email, nif, direccion
  INTO v_org_name, v_org_email, v_org_nif, v_org_dir
  FROM public.trade_organizations WHERE id = v_inv.org_id;

  SELECT id, plan, billing_cycle
  INTO v_sub_id, v_sub_plan, v_sub_cycle
  FROM public.trade_subscriptions WHERE org_id = v_inv.org_id
  ORDER BY created_at DESC LIMIT 1;

  SELECT id INTO v_doc_id
  FROM public.trade_financial_documents WHERE platform_invoice_id = p_invoice_id;

  IF v_doc_id IS NULL THEN
    v_doc_number := public.next_financial_doc_number('TF');
    INSERT INTO public.trade_financial_documents (
      doc_number, doc_series, revenue_type, payer_type, document_type,
      estado, payment_status,
      org_id, customer_name, customer_nif, customer_email, customer_address,
      concept, period_start, period_end,
      rate_amount, subtotal, net_amount, total_amount, currency,
      paid_at, stripe_invoice_id, invoice_url, invoice_pdf_url,
      platform_invoice_id, subscription_id, metadata, created_at
    ) VALUES (
      v_doc_number, 'TF', 'subscription', 'installer', 'invoice',
      CASE v_inv.status WHEN 'paid' THEN 'paid' WHEN 'pending' THEN 'pending' ELSE 'issued' END,
      CASE v_inv.status WHEN 'paid' THEN 'paid' ELSE 'unpaid' END,
      v_inv.org_id,
      COALESCE(v_org_name, v_inv.org_id::text), v_org_nif, v_org_email, v_org_dir,
      COALESCE('Plan ' || INITCAP(COALESCE(v_inv.plan, v_sub_plan, 'TrabFlow')), 'Suscripción TrabFlow'),
      v_inv.period_start, v_inv.period_end,
      (v_inv.amount_cents / 100.0)::numeric(10,2),
      (v_inv.amount_cents / 100.0)::numeric(10,2),
      (v_inv.amount_cents / 100.0)::numeric(10,2),
      (v_inv.amount_cents / 100.0)::numeric(10,2),
      'EUR',
      v_inv.paid_at, v_inv.stripe_invoice_id, v_inv.invoice_url, v_inv.invoice_pdf_url,
      p_invoice_id, v_sub_id,
      jsonb_build_object(
        'plan',              COALESCE(v_inv.plan, v_sub_plan),
        'billing_cycle',     v_sub_cycle,
        'stripe_invoice_id', v_inv.stripe_invoice_id,
        'amount_cents',      v_inv.amount_cents
      ),
      v_inv.created_at
    );
  END IF;
END;
$$;

-- Re-ejecutar backfill ahora que la función existe
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.trade_platform_invoices LOOP
    PERFORM public.sync_platform_invoice_to_financial_manual(r.id);
  END LOOP;
END;
$$;

-- ── 6. Backfill: reservas publicitarias confirmadas ──────────────────────
INSERT INTO public.trade_financial_documents (
  doc_number, doc_series, revenue_type, payer_type, document_type,
  estado, payment_status,
  actor_id, customer_name,
  concept, period_start, period_end,
  rate_amount, subtotal,
  discount_amount, promotion_amount, commercial_value,
  net_amount, total_amount, currency,
  ad_booking_id, metadata, created_at
)
SELECT
  public.next_financial_doc_number('ADV'),
  'ADV', 'advertising', 'provider', 'commercial_summary',
  'waived', 'waived',
  b.actor_id,
  COALESCE(a.nombre, 'Proveedor'),
  COALESCE(s.nombre, 'Publicidad Marketplace')
    || ' — ' || to_char(b.inicio, 'DD/MM/YYYY')
    || ' al ' || to_char(b.fin, 'DD/MM/YYYY'),
  b.inicio, b.fin,
  COALESCE(b.estimated_total_snapshot, 0)::numeric(10,2),
  COALESCE(b.estimated_total_snapshot, 0)::numeric(10,2),
  0, -- discount_amount
  COALESCE(b.estimated_total_snapshot, 0)::numeric(10,2), -- promotion_amount (Fase 0)
  COALESCE(b.estimated_total_snapshot, 0)::numeric(10,2), -- commercial_value
  0, 0, -- net_amount, total_amount
  'EUR',
  b.id,
  jsonb_build_object(
    'slot_id',        b.slot_id,
    'slot_nombre',    s.nombre,
    'pricing_mode',   'validation_free',
    'estimated_total',b.estimated_total_snapshot,
    'rate_unit',      b.rate_unit_snapshot,
    'estimated_days', b.estimated_days_snapshot
  ),
  b.created_at
FROM public.trade_marketplace_ad_bookings b
LEFT JOIN public.trade_marketplace_actors   a ON a.id = b.actor_id
LEFT JOIN public.trade_marketplace_ad_slots s ON s.id = b.slot_id
WHERE b.estado IN ('CONFIRMED','RESERVED')
  AND NOT EXISTS (
    SELECT 1 FROM public.trade_financial_documents d WHERE d.ad_booking_id = b.id
  );

-- ── 7. RPC: admin_get_financial_documents ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_financial_documents(
  p_revenue_type    text    DEFAULT NULL,
  p_payer_type      text    DEFAULT NULL,
  p_estado          text    DEFAULT NULL,
  p_payment_status  text    DEFAULT NULL,
  p_date_from       date    DEFAULT NULL,
  p_date_to         date    DEFAULT NULL,
  p_search          text    DEFAULT NULL,
  p_plan            text    DEFAULT NULL,
  p_billing_cycle   text    DEFAULT NULL,
  p_slot_id         text    DEFAULT NULL,
  p_actor_id        uuid    DEFAULT NULL
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
  metadata            jsonb,
  created_at          timestamptz,
  org_nombre          text,
  actor_nombre        text,
  slot_nombre         text
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
    d.metadata,
    d.created_at,
    o.nombre                        AS org_nombre,
    a.nombre                        AS actor_nombre,
    s.nombre                        AS slot_nombre
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
    AND (p_slot_id      IS NULL OR b.slot_id = p_slot_id)
    AND (p_actor_id     IS NULL OR d.actor_id = p_actor_id)
  ORDER BY d.created_at DESC;
END;
$$;

-- ── 8. RPC: admin_get_financial_summary ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_financial_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := to_char(now(), 'YYYY-MM');
  v_year  text := to_char(now(), 'YYYY');
BEGIN
  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'facturado_mes',
        COALESCE((
          SELECT SUM(commercial_value)
          FROM public.trade_financial_documents
          WHERE to_char(COALESCE(period_start, created_at::date), 'YYYY-MM') = v_month
        ), 0),
      'cobrado_mes',
        COALESCE((
          SELECT SUM(total_amount)
          FROM public.trade_financial_documents
          WHERE payment_status = 'paid'
            AND to_char(paid_at, 'YYYY-MM') = v_month
        ), 0),
      'pendiente',
        COALESCE((
          SELECT SUM(total_amount)
          FROM public.trade_financial_documents
          WHERE payment_status = 'unpaid'
            AND estado NOT IN ('draft','cancelled')
        ), 0),
      'ytd_cobrado',
        COALESCE((
          SELECT SUM(total_amount)
          FROM public.trade_financial_documents
          WHERE payment_status = 'paid'
            AND to_char(COALESCE(paid_at, created_at), 'YYYY') = v_year
        ), 0),
      'valor_comercial_bonificado',
        COALESCE((
          SELECT SUM(commercial_value)
          FROM public.trade_financial_documents
          WHERE payment_status = 'waived'
        ), 0),
      'total_docs',
        (SELECT COUNT(*) FROM public.trade_financial_documents),
      'ticket_medio',
        COALESCE((
          SELECT AVG(total_amount)
          FROM public.trade_financial_documents
          WHERE total_amount > 0 AND payment_status = 'paid'
        ), 0)
    ),
    'por_tipo', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT
          revenue_type,
          COUNT(*)                                              AS docs,
          SUM(commercial_value)                                 AS valor_comercial,
          SUM(CASE WHEN payment_status = 'paid'  THEN total_amount    ELSE 0 END) AS cobrado,
          SUM(CASE WHEN payment_status = 'unpaid' THEN total_amount   ELSE 0 END) AS pendiente,
          SUM(CASE WHEN payment_status = 'waived' THEN commercial_value ELSE 0 END) AS bonificado
        FROM public.trade_financial_documents
        GROUP BY revenue_type
        ORDER BY valor_comercial DESC
      ) r
    ),
    'ad_espacios', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT
          s.id                                                       AS slot_id,
          s.nombre                                                   AS slot_nombre,
          s.formato,
          COALESCE(s.rate_amount, 0)                                 AS tarifa_base,
          COUNT(b.id) FILTER (WHERE b.estado IN ('CONFIRMED','RESERVED')) AS reservas_activas,
          COUNT(b.id)                                                AS total_reservas,
          COALESCE(SUM(b.estimated_days_snapshot)   FILTER (WHERE b.estado IN ('CONFIRMED','RESERVED')), 0) AS dias_reservados,
          COALESCE(SUM(b.estimated_total_snapshot)  FILTER (WHERE b.estado IN ('CONFIRMED','RESERVED')), 0) AS valor_tarifa,
          COUNT(DISTINCT b.actor_id) FILTER (WHERE b.estado IN ('CONFIRMED','RESERVED')) AS proveedores_activos,
          COALESCE(SUM(d.commercial_value), 0)                      AS valor_comercial_total
        FROM public.trade_marketplace_ad_slots s
        LEFT JOIN public.trade_marketplace_ad_bookings b ON b.slot_id = s.id
        LEFT JOIN public.trade_financial_documents d ON d.ad_booking_id = b.id
        WHERE s.comercializable = true
        GROUP BY s.id, s.nombre, s.formato, s.rate_amount
        ORDER BY valor_comercial_total DESC NULLS LAST
      ) r
    ),
    'saas_planes', (
      SELECT jsonb_agg(row_to_json(r))
      FROM (
        SELECT
          ts.plan,
          ts.billing_cycle,
          COUNT(*) FILTER (WHERE ts.status = 'active') AS activos,
          COUNT(*) FILTER (WHERE ts.status = 'trial')  AS en_prueba,
          COUNT(*) FILTER (WHERE ts.status = 'cancelled') AS cancelados
        FROM public.trade_subscriptions ts
        GROUP BY ts.plan, ts.billing_cycle
        ORDER BY ts.plan, ts.billing_cycle
      ) r
    )
  );
END;
$$;

-- ── 9. RPC: admin_create_ad_financial_document ───────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_ad_financial_document(
  p_booking_id      uuid,
  p_pricing_mode    text    DEFAULT 'validation_free',
  p_discount_rate   numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking   record;
  v_slot      record;
  v_actor     record;
  v_doc_id    uuid;
  v_doc_num   text;
  v_rate      numeric;
  v_disc      numeric;
  v_promo     numeric;
  v_net       numeric;
BEGIN
  SELECT * INTO v_booking FROM public.trade_marketplace_ad_bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking no encontrado: %', p_booking_id; END IF;

  SELECT * INTO v_slot  FROM public.trade_marketplace_ad_slots      WHERE id = v_booking.slot_id;
  SELECT * INTO v_actor FROM public.trade_marketplace_actors         WHERE id = v_booking.actor_id;

  v_rate := COALESCE(v_booking.estimated_total_snapshot, 0);
  v_disc := ROUND(v_rate * (p_discount_rate / 100.0), 2);

  IF p_pricing_mode = 'validation_free' THEN
    v_promo := v_rate - v_disc;
    v_net   := 0;
  ELSE
    v_promo := 0;
    v_net   := v_rate - v_disc;
  END IF;

  SELECT id INTO v_doc_id FROM public.trade_financial_documents WHERE ad_booking_id = p_booking_id;

  IF v_doc_id IS NOT NULL THEN
    UPDATE public.trade_financial_documents SET
      rate_amount      = v_rate,
      discount_amount  = v_disc,
      promotion_amount = v_promo,
      commercial_value = v_rate,
      net_amount       = v_net,
      total_amount     = v_net,
      estado           = CASE WHEN p_pricing_mode = 'validation_free' THEN 'waived' ELSE 'issued' END,
      payment_status   = CASE WHEN p_pricing_mode = 'validation_free' THEN 'waived' ELSE 'unpaid' END,
      document_type    = CASE WHEN p_pricing_mode = 'validation_free' THEN 'commercial_summary' ELSE 'invoice' END,
      metadata         = metadata || jsonb_build_object('pricing_mode', p_pricing_mode, 'discount_rate', p_discount_rate),
      updated_at       = now()
    WHERE id = v_doc_id;
    RETURN v_doc_id;
  END IF;

  v_doc_num := public.next_financial_doc_number('ADV');

  INSERT INTO public.trade_financial_documents (
    doc_number, doc_series, revenue_type, payer_type, document_type,
    estado, payment_status,
    actor_id, customer_name,
    concept, period_start, period_end,
    rate_amount, discount_amount, promotion_amount, commercial_value,
    net_amount, total_amount, currency,
    ad_booking_id, metadata
  ) VALUES (
    v_doc_num, 'ADV', 'advertising', 'provider',
    CASE WHEN p_pricing_mode = 'validation_free' THEN 'commercial_summary' ELSE 'invoice' END,
    CASE WHEN p_pricing_mode = 'validation_free' THEN 'waived' ELSE 'issued' END,
    CASE WHEN p_pricing_mode = 'validation_free' THEN 'waived' ELSE 'unpaid' END,
    v_booking.actor_id,
    COALESCE(v_actor.nombre, 'Proveedor'),
    COALESCE(v_slot.nombre, 'Publicidad Marketplace')
      || ' — ' || to_char(v_booking.inicio, 'DD/MM/YYYY')
      || ' al '  || to_char(v_booking.fin,   'DD/MM/YYYY'),
    v_booking.inicio, v_booking.fin,
    v_rate, v_disc, v_promo, v_rate,
    v_net, v_net, 'EUR',
    p_booking_id,
    jsonb_build_object(
      'slot_id',        v_booking.slot_id,
      'slot_nombre',    v_slot.nombre,
      'pricing_mode',   p_pricing_mode,
      'discount_rate',  p_discount_rate,
      'estimated_total',v_booking.estimated_total_snapshot,
      'rate_unit',      v_booking.rate_unit_snapshot,
      'estimated_days', v_booking.estimated_days_snapshot
    )
  ) RETURNING id INTO v_doc_id;

  RETURN v_doc_id;
END;
$$;

-- ── 10. Grants ────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.admin_get_financial_documents(text,text,text,text,date,date,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_financial_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_ad_financial_document(uuid,text,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_financial_doc_number(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_platform_invoice_to_financial_manual(uuid) TO service_role;
