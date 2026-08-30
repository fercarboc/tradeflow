
BEGIN;

ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS master_order_id uuid
    REFERENCES public.trade_marketplace_master_orders(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.master_order_id IS
  'FK al master_order cubierto por este Purchase Summary (serie MKP). NULL para documentos TF/ADV no relacionados con una compra marketplace. LEGAL_GATE: documento resultante no es factura fiscal. INMUTABLE tras immutable_at.';

ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS supplier_order_id uuid
    REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.supplier_order_id IS
  'FK al supplier order cubierto por este Supplier Statement (serie SUP). NULL para documentos no relacionados con un pedido de proveedor. LEGAL_GATE: documento resultante no es factura fiscal. INMUTABLE tras immutable_at.';

ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS settlement_id uuid
    REFERENCES public.trade_marketplace_settlements(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.settlement_id IS
  'FK a la liquidacion cubierta por este Settlement Statement (serie LIQ). NULL para documentos no relacionados con una liquidacion. SIMULATION ONLY. LEGAL_GATE: documento resultante no es factura fiscal. INMUTABLE tras immutable_at.';

ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS document_subtype text
    CHECK (document_subtype IS NULL OR document_subtype IN (
      'purchase_summary',
      'supplier_statement',
      'settlement_statement',
      'commission_invoice'
    ));

COMMENT ON COLUMN public.trade_financial_documents.document_subtype IS
  'Subtipo dentro de document_type. purchase_summary=MKP, supplier_statement=SUP, settlement_statement=LIQ, commission_invoice=COM (TAX_GATE OPEN). INMUTABLE tras immutable_at.';

ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS immutable_at timestamptz;

COMMENT ON COLUMN public.trade_financial_documents.immutable_at IS
  'Timestamp de congelacion del snapshot historico. Una vez seteado, campos de identidad, propietario, destinatario y snapshot economico NO pueden modificarse. issued_at protegido por regla propia (one-way door). NULL = borrador.';

CREATE INDEX IF NOT EXISTS idx_tfd_master_order_id
  ON public.trade_financial_documents (master_order_id)
  WHERE master_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tfd_supplier_order_id
  ON public.trade_financial_documents (supplier_order_id)
  WHERE supplier_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tfd_settlement_id
  ON public.trade_financial_documents (settlement_id)
  WHERE settlement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tfd_document_subtype
  ON public.trade_financial_documents (document_subtype)
  WHERE document_subtype IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tfd_immutable_at
  ON public.trade_financial_documents (immutable_at)
  WHERE immutable_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_purchase_summary_per_master
  ON public.trade_financial_documents (master_order_id)
  WHERE document_subtype = 'purchase_summary'
    AND master_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_supplier_statement_per_order
  ON public.trade_financial_documents (supplier_order_id)
  WHERE document_subtype = 'supplier_statement'
    AND supplier_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_settlement_statement_per_settlement
  ON public.trade_financial_documents (settlement_id)
  WHERE document_subtype = 'settlement_statement'
    AND settlement_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_financial_document_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF OLD.issued_at IS NOT NULL
     AND NEW.issued_at IS DISTINCT FROM OLD.issued_at
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [issued_at]: issued_at no puede cambiar una vez fijado. La fecha de emision es un hecho historico. doc_number: %. issued_at: %.',
      OLD.doc_number, OLD.issued_at;
  END IF;

  IF OLD.immutable_at IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.subtotal         IS DISTINCT FROM OLD.subtotal          OR
     NEW.rate_amount      IS DISTINCT FROM OLD.rate_amount       OR
     NEW.discount_amount  IS DISTINCT FROM OLD.discount_amount   OR
     NEW.promotion_amount IS DISTINCT FROM OLD.promotion_amount  OR
     NEW.commercial_value IS DISTINCT FROM OLD.commercial_value  OR
     NEW.net_amount       IS DISTINCT FROM OLD.net_amount        OR
     NEW.tax_rate         IS DISTINCT FROM OLD.tax_rate          OR
     NEW.tax_amount       IS DISTINCT FROM OLD.tax_amount        OR
     NEW.total_amount     IS DISTINCT FROM OLD.total_amount      OR
     NEW.currency         IS DISTINCT FROM OLD.currency          OR
     NEW.concept          IS DISTINCT FROM OLD.concept           OR
     NEW.period_start     IS DISTINCT FROM OLD.period_start      OR
     NEW.period_end       IS DISTINCT FROM OLD.period_end        OR
     NEW.quantity         IS DISTINCT FROM OLD.quantity
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [snapshot_economico]: Los campos del snapshot economico no pueden modificarse tras la congelacion (immutable_at: %). doc_number: %.',
      OLD.immutable_at, OLD.doc_number;
  END IF;

  IF NEW.doc_number IS DISTINCT FROM OLD.doc_number THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [doc_number]: El numero de documento no puede cambiarse tras la congelacion. doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  IF NEW.document_type    IS DISTINCT FROM OLD.document_type     OR
     NEW.document_subtype IS DISTINCT FROM OLD.document_subtype  OR
     NEW.doc_series       IS DISTINCT FROM OLD.doc_series        OR
     NEW.revenue_type     IS DISTINCT FROM OLD.revenue_type      OR
     NEW.payer_type       IS DISTINCT FROM OLD.payer_type
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [clase_documento]: No se puede cambiar la clase del documento tras la congelacion. doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  IF NEW.org_id           IS DISTINCT FROM OLD.org_id            OR
     NEW.actor_id         IS DISTINCT FROM OLD.actor_id          OR
     NEW.customer_name    IS DISTINCT FROM OLD.customer_name     OR
     NEW.customer_nif     IS DISTINCT FROM OLD.customer_nif      OR
     NEW.customer_email   IS DISTINCT FROM OLD.customer_email    OR
     NEW.customer_address IS DISTINCT FROM OLD.customer_address
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [propietario_destinatario]: No se puede cambiar el propietario ni el destinatario de un documento congelado. doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  IF NEW.master_order_id     IS DISTINCT FROM OLD.master_order_id     OR
     NEW.supplier_order_id   IS DISTINCT FROM OLD.supplier_order_id   OR
     NEW.settlement_id       IS DISTINCT FROM OLD.settlement_id       OR
     NEW.platform_invoice_id IS DISTINCT FROM OLD.platform_invoice_id OR
     NEW.ad_booking_id       IS DISTINCT FROM OLD.ad_booking_id       OR
     NEW.subscription_id     IS DISTINCT FROM OLD.subscription_id
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [fk_origen]: Las referencias de origen del documento no pueden cambiarse tras la congelacion. doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [metadata]: El snapshot documental en metadata no puede modificarse tras la congelacion (%). doc_number: %.',
      OLD.immutable_at, OLD.doc_number;
  END IF;

  IF NEW.immutable_at IS NULL THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [immutable_at]: immutable_at no puede eliminarse una vez fijado. doc_number: %.',
      OLD.doc_number;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_financial_document_immutability IS
  'Trigger BEFORE UPDATE en trade_financial_documents. REGLA 0: issued_at one-way door. REGLAS 1-7 (cuando immutable_at IS NOT NULL): snapshot economico, doc_number, clase, propietario/destinatario, FK origen, metadata, immutable_at. MUTABLES: estado, payment_status, paid_at, sent_at, sent_to, invoice_url, invoice_pdf_url, payment_method, stripe_*, updated_at.';

DROP TRIGGER IF EXISTS trg_guard_fin_doc_immutability
  ON public.trade_financial_documents;

CREATE TRIGGER trg_guard_fin_doc_immutability
  BEFORE UPDATE ON public.trade_financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_financial_document_immutability();

CREATE TABLE IF NOT EXISTS public.trade_marketplace_provider_doc_refs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_order_id   uuid        NOT NULL
    REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT,
  actor_id            uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,
  buyer_org_id        uuid
    REFERENCES public.trade_organizations(id) ON DELETE SET NULL,
  doc_type            text        NOT NULL DEFAULT 'invoice'
    CHECK (doc_type IN ('invoice','credit_note','delivery_note','other')),
  doc_number_provider text        NOT NULL,
  doc_date_provider   date        NOT NULL,
  doc_amount          numeric(10,2),
  doc_currency        char(3)     NOT NULL DEFAULT 'EUR',
  notes               text,
  registered_at       timestamptz NOT NULL DEFAULT now(),
  registered_by       uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_provider_doc_refs IS
  'Registro de documentos emitidos por el proveedor al comprador. TrabFlow NO emite ni valida estos documentos. LEGAL_GATE=OPEN. TAX_GATE=OPEN. STRIPE_GATE=OPEN. Registro OPCIONAL Fase 0. Multiples refs por supplier_order permitidas. buyer_org_id=NULL para guest checkout: ninguna policy de comprador concede acceso.';

CREATE INDEX IF NOT EXISTS idx_provider_doc_refs_order
  ON public.trade_marketplace_provider_doc_refs (supplier_order_id);

CREATE INDEX IF NOT EXISTS idx_provider_doc_refs_actor
  ON public.trade_marketplace_provider_doc_refs (actor_id);

CREATE INDEX IF NOT EXISTS idx_provider_doc_refs_buyer_org
  ON public.trade_marketplace_provider_doc_refs (buyer_org_id)
  WHERE buyer_org_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_doc_refs_doc_type
  ON public.trade_marketplace_provider_doc_refs (doc_type);

CREATE INDEX IF NOT EXISTS idx_provider_doc_refs_registered_at
  ON public.trade_marketplace_provider_doc_refs (registered_at DESC);

CREATE OR REPLACE TRIGGER trg_provider_doc_refs_updated_at
  BEFORE UPDATE ON public.trade_marketplace_provider_doc_refs
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

ALTER TABLE public.trade_marketplace_provider_doc_refs
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs
  FOR ALL TO authenticated
  USING  (actor_id = ANY(public._mkt_actor_ids_for_user()))
  WITH CHECK (actor_id = ANY(public._mkt_actor_ids_for_user()));

DROP POLICY IF EXISTS provider_doc_refs_buyer_select
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_buyer_select
  ON public.trade_marketplace_provider_doc_refs
  FOR SELECT TO authenticated
  USING (
    buyer_org_id IS NOT NULL
    AND buyer_org_id IN (
      SELECT org_id
        FROM public.trade_org_members
       WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS provider_doc_refs_admin_all
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_admin_all
  ON public.trade_marketplace_provider_doc_refs
  FOR ALL TO authenticated
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

GRANT SELECT, INSERT, UPDATE
  ON public.trade_marketplace_provider_doc_refs TO authenticated;

COMMIT;
;
