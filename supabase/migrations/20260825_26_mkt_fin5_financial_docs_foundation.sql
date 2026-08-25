-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-5A.1 — Financial Documents Foundation
--
-- SCOPE: Schema extension only.
--   No generation RPCs (MP-FIN-5A.2).
--   No query RPCs (MP-FIN-5A.3).
--   No frontend. No PDF. No Commission Invoice generator.
--
-- ─── GATES (todos OPEN) ─────────────────────────────────────────────────
--   LEGAL_GATE  = OPEN
--     Todos los documentos son informativos/operativos. NO son facturas
--     fiscales. Incluir disclaimer en cualquier renderización futura.
--
--   TAX_GATE    = OPEN
--     Sin tratamiento real de IVA. Sin emisión de Commission Invoice.
--     document_subtype = 'commission_invoice' existe como capacidad
--     estructural futura; no hay generador ni numeración fiscal activa.
--     La serie COM no es numeración fiscal aprobada.
--
--   STRIPE_GATE = OPEN
--     Sin movimiento real de dinero. Sin payouts. Sin transfers.
--
-- ─── COMMISSION ─────────────────────────────────────────────────────────
--   Comisión real = 0% (COMMISSION_GATE cerrado).
--   2% = hipótesis de simulación interna. No obligación contractual.
--
-- ─── SOURCE OF TRUTH ────────────────────────────────────────────────────
--   Financial Documents consumen resultados del Settlement Engine (MP-FIN-2F).
--   No crean una segunda lógica financiera.
--   Settlement Statement lee directamente trade_marketplace_settlements.
--   No recalcula ventas, portes, devoluciones, chargebacks, retenciones,
--   saldos negativos, recuperaciones ni settlement_amount.
--
-- ─── NOMENCLATURA DOCUMENTAL ────────────────────────────────────────────
--   MKP, SUP, LIQ = referencias documentales internas/operativas de TrabFlow.
--   NO implican numeración fiscal. NO son facturas legales.
--   COM = capacidad estructural futura (TAX_GATE bloquea su emisión).
--   La numeración fiscal definitiva de comisiones se decidirá post-TAX_GATE.
--
-- ─── PROVIDER DOC REFS ──────────────────────────────────────────────────
--   trade_marketplace_provider_doc_refs registra documentos emitidos
--   por el proveedor (desde sus sistemas externos) al comprador.
--   TrabFlow NO emite ni valida estos documentos.
--   Son referencias informativas de trazabilidad operativa.
--   Registro OPCIONAL en Fase 0 — no bloquea ningún flujo financiero.
--   Permite múltiples refs por pedido: factura + rectificativa + abono.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 1: Extensión de trade_financial_documents
--
-- Columnas nullable para compatibilidad hacia atrás.
-- Los documentos TF (suscripciones) y ADV (publicidad) tienen estas
-- nuevas columnas a NULL; los documentos existentes no se modifican.
-- ─────────────────────────────────────────────────────────────────────────

-- 1A. FK al master order (Purchase Summary — comprador)
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS master_order_id uuid
    REFERENCES public.trade_marketplace_master_orders(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.master_order_id IS
  'FK al master_order cubierto por este Purchase Summary (serie MKP). '
  'NULL para documentos TF/ADV no relacionados con una compra marketplace. '
  'LEGAL_GATE: documento resultante no es factura fiscal. '
  'INMUTABLE tras immutable_at — determina el origen del documento.';

-- 1B. FK al supplier order (Supplier Statement — proveedor)
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS supplier_order_id uuid
    REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.supplier_order_id IS
  'FK al supplier order cubierto por este Supplier Statement (serie SUP). '
  'NULL para documentos no relacionados con un pedido de proveedor. '
  'LEGAL_GATE: documento resultante no es factura fiscal. '
  'INMUTABLE tras immutable_at — determina el origen del documento.';

-- 1C. FK al settlement (Settlement Statement — proveedor)
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS settlement_id uuid
    REFERENCES public.trade_marketplace_settlements(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.trade_financial_documents.settlement_id IS
  'FK a la liquidación cubierta por este Settlement Statement (serie LIQ). '
  'NULL para documentos no relacionados con una liquidación. '
  'SIMULATION ONLY: settlement siempre tiene simulation_only = true. '
  'LEGAL_GATE: documento resultante no es factura fiscal ni transferencia real. '
  'INMUTABLE tras immutable_at — determina el origen del documento.';

-- 1D. Subtipo de documento
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS document_subtype text
    CHECK (document_subtype IS NULL OR document_subtype IN (
      'purchase_summary',
      'supplier_statement',
      'settlement_statement',
      'commission_invoice'
    ));

COMMENT ON COLUMN public.trade_financial_documents.document_subtype IS
  'Subtipo dentro de document_type. Discrimina el propósito dentro del tipo. '
  '''purchase_summary''    — MKP: resumen de compra para el comprador. '
  '''supplier_statement''  — SUP: extracto de pedido para el proveedor. '
  '''settlement_statement''— LIQ: liquidación simulada (SIMULATION ONLY). '
  '''commission_invoice''  — COM: [TAX_GATE OPEN] capacidad futura; sin generador. '
  'INMUTABLE tras immutable_at — define la clase del documento.';

-- 1E. Sello de congelación del snapshot documental
ALTER TABLE public.trade_financial_documents
  ADD COLUMN IF NOT EXISTS immutable_at timestamptz;

COMMENT ON COLUMN public.trade_financial_documents.immutable_at IS
  'Timestamp en que el snapshot histórico del documento quedó congelado. '
  'Una vez seteado, los campos de identidad, propietario, destinatario, '
  'naturaleza histórica y snapshot económico NO pueden modificarse. '
  'Ver trigger trg_guard_fin_doc_immutability para la lista completa. '
  'MUTABLES tras immutable_at (campos operativos): estado, payment_status, '
  'paid_at, sent_at, sent_to, invoice_url, invoice_pdf_url, '
  'payment_method, stripe_payment_id, stripe_invoice_id, stripe_customer_id, '
  'updated_at. '
  'issued_at: protegido por regla propia (one-way door, independiente de immutable_at). '
  'NULL = documento en borrador, aún no emitido ni congelado.';

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 2: Índices de navegación en columnas nuevas
-- ─────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 3: Garantías DB de idempotencia (partial UNIQUE indexes)
--
-- Un documento canónico por entidad origen. Evita race conditions.
-- La lógica de RPCs (5A.2) también será idempotente, pero la DB
-- es la garantía final.
-- ─────────────────────────────────────────────────────────────────────────

-- Máximo 1 purchase_summary por master_order
CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_purchase_summary_per_master
  ON public.trade_financial_documents (master_order_id)
  WHERE document_subtype = 'purchase_summary'
    AND master_order_id IS NOT NULL;

-- Máximo 1 supplier_statement por supplier_order
CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_supplier_statement_per_order
  ON public.trade_financial_documents (supplier_order_id)
  WHERE document_subtype = 'supplier_statement'
    AND supplier_order_id IS NOT NULL;

-- Máximo 1 settlement_statement por settlement
CREATE UNIQUE INDEX IF NOT EXISTS uq_tfd_settlement_statement_per_settlement
  ON public.trade_financial_documents (settlement_id)
  WHERE document_subtype = 'settlement_statement'
    AND settlement_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 4: Inmutabilidad reforzada del snapshot documental
--
-- REGLA GENERAL:
--   Cuando immutable_at IS NOT NULL, no debe ser posible transformar
--   históricamente un documento en otro documento diferente mediante UPDATE.
--
-- CAMPOS PROTEGIDOS (no mutables tras immutable_at):
--
--   Snapshot económico:
--     subtotal, rate_amount, discount_amount, promotion_amount,
--     commercial_value, net_amount, tax_rate, tax_amount, total_amount,
--     currency, concept, period_start, period_end, quantity
--
--   Identidad del documento:
--     doc_number (el documento ES su número — no se puede renumerar)
--
--   Clase del documento:
--     document_type, document_subtype, doc_series, revenue_type, payer_type
--
--   Propietario / destinatario:
--     org_id, actor_id,
--     customer_name, customer_nif, customer_email, customer_address
--
--   FK de origen (determinan qué entidad financiera origina el documento):
--     master_order_id, supplier_order_id, settlement_id,
--     platform_invoice_id, ad_booking_id, subscription_id
--
--   Snapshot completo (para reconstrucción determinista):
--     metadata
--
--   Sello de congelación (no puede retroceder):
--     immutable_at → NULL
--
-- CAMPOS MUTABLES (campos operativos — no forman parte del snapshot histórico):
--   estado           — ciclo de vida del documento
--   payment_status   — estado de cobro
--   paid_at          — cuándo se cobró
--   sent_at          — cuándo se envió al destinatario
--   sent_to          — a quién se envió
--   invoice_url      — URL del documento (puede generarse después)
--   invoice_pdf_url  — URL PDF (puede generarse después)
--   payment_method, stripe_payment_id, stripe_invoice_id, stripe_customer_id
--   updated_at       — tracking operativo de la fila
--
-- issued_at: CAMPO ESPECIAL (one-way door)
--   Puede pasar de NULL → timestamp una sola vez.
--   Una vez fijado, no puede cambiar ni retroceder a NULL.
--   Esta regla aplica INDEPENDIENTEMENTE de immutable_at.
--   Emisión ≠ Envío: issued_at ≠ sent_at.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_financial_document_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 0: issued_at — one-way door (independiente de immutable_at)
  --
  -- La emisión es un evento histórico único.
  -- NULL → timestamp: PERMITIDO (primera emisión).
  -- timestamp → cualquier_cambio: BLOQUEADO (el hecho histórico no cambia).
  -- ══════════════════════════════════════════════════════════════════
  IF OLD.issued_at IS NOT NULL
     AND NEW.issued_at IS DISTINCT FROM OLD.issued_at
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [issued_at]: '
      'issued_at no puede cambiar una vez fijado. '
      'La fecha de emisión es un hecho histórico. '
      'doc_number: %. issued_at: %.',
      OLD.doc_number, OLD.issued_at;
  END IF;

  -- A partir de aquí solo actúa si el documento ya está congelado
  IF OLD.immutable_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 1: Snapshot económico
  --
  -- Los campos numéricos del snapshot no pueden modificarse.
  -- Cambiarlos convertiría el documento en uno diferente con
  -- importes distintos a los de la transacción original.
  -- ══════════════════════════════════════════════════════════════════
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
      'IMMUTABLE_DOCUMENT [snapshot_economico]: '
      'Los campos del snapshot económico no pueden modificarse '
      'tras la congelación (immutable_at: %). '
      'doc_number: %. '
      'El documento debe ser reconstruible de forma determinista.',
      OLD.immutable_at, OLD.doc_number;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 2: Identidad del documento
  --
  -- doc_number es la identidad del documento.
  -- Renumerarlo cambiaría "qué documento es este".
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.doc_number IS DISTINCT FROM OLD.doc_number THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [doc_number]: '
      'El número de documento no puede cambiarse tras la congelación. '
      'doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 3: Clase del documento
  --
  -- document_type, document_subtype, doc_series, revenue_type, payer_type
  -- definen qué clase de documento es.
  -- Cambiarlos transformaría el documento en uno de diferente naturaleza.
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.document_type    IS DISTINCT FROM OLD.document_type     OR
     NEW.document_subtype IS DISTINCT FROM OLD.document_subtype  OR
     NEW.doc_series       IS DISTINCT FROM OLD.doc_series        OR
     NEW.revenue_type     IS DISTINCT FROM OLD.revenue_type      OR
     NEW.payer_type       IS DISTINCT FROM OLD.payer_type
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [clase_documento]: '
      'No se puede cambiar la clase del documento tras la congelación. '
      '(document_type, document_subtype, doc_series, revenue_type, payer_type) '
      'doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 4: Propietario y destinatario
  --
  -- org_id y actor_id identifican a quién pertenece el documento.
  -- customer_* captura la identidad del destinatario en el momento de emisión.
  -- Cambiarlos reasignaría el documento a otra entidad.
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.org_id           IS DISTINCT FROM OLD.org_id            OR
     NEW.actor_id         IS DISTINCT FROM OLD.actor_id          OR
     NEW.customer_name    IS DISTINCT FROM OLD.customer_name     OR
     NEW.customer_nif     IS DISTINCT FROM OLD.customer_nif      OR
     NEW.customer_email   IS DISTINCT FROM OLD.customer_email    OR
     NEW.customer_address IS DISTINCT FROM OLD.customer_address
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [propietario_destinatario]: '
      'No se puede cambiar el propietario ni el destinatario '
      'de un documento congelado. '
      '(org_id, actor_id, customer_*) '
      'doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 5: FK de origen
  --
  -- master_order_id, supplier_order_id, settlement_id, platform_invoice_id,
  -- ad_booking_id, subscription_id determinan qué operación financiera
  -- origina el documento. Cambiarlos reapuntaría el documento a otra
  -- transacción diferente.
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.master_order_id     IS DISTINCT FROM OLD.master_order_id     OR
     NEW.supplier_order_id   IS DISTINCT FROM OLD.supplier_order_id   OR
     NEW.settlement_id       IS DISTINCT FROM OLD.settlement_id       OR
     NEW.platform_invoice_id IS DISTINCT FROM OLD.platform_invoice_id OR
     NEW.ad_booking_id       IS DISTINCT FROM OLD.ad_booking_id       OR
     NEW.subscription_id     IS DISTINCT FROM OLD.subscription_id
  THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [fk_origen]: '
      'Las referencias de origen del documento no pueden cambiarse '
      'tras la congelación. '
      'doc_number: %. immutable_at: %.',
      OLD.doc_number, OLD.immutable_at;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 6: Metadata / snapshot completo
  --
  -- metadata almacena el snapshot completo del documento en el momento
  -- de generación. Es necesario para la reconstrucción determinista
  -- aunque no exista PDF.
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.metadata IS DISTINCT FROM OLD.metadata THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [metadata]: '
      'El snapshot documental en metadata no puede modificarse tras '
      'la congelación (%). '
      'doc_number: %. '
      'Para información operativa post-emisión use sent_at, sent_to, '
      'invoice_url o tablas de auditoría externas.',
      OLD.immutable_at, OLD.doc_number;
  END IF;

  -- ══════════════════════════════════════════════════════════════════
  -- REGLA 7: immutable_at no puede retroceder
  --
  -- Una vez congelado, el sello no puede eliminarse.
  -- ══════════════════════════════════════════════════════════════════
  IF NEW.immutable_at IS NULL THEN
    RAISE EXCEPTION
      'IMMUTABLE_DOCUMENT [immutable_at]: '
      'immutable_at no puede eliminarse una vez fijado. '
      'doc_number: %.',
      OLD.doc_number;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.guard_financial_document_immutability IS
  'Trigger BEFORE UPDATE en trade_financial_documents. '
  'REGLA 0 (siempre activa): issued_at es one-way door — '
  '  NULL → timestamp permitido; cualquier cambio posterior bloqueado. '
  'REGLAS 1-7 (activas cuando immutable_at IS NOT NULL): '
  '  Protegen snapshot económico, identidad, clase, propietario/destinatario, '
  '  FK de origen, metadata e immutable_at mismo. '
  'MUTABLES: estado, payment_status, paid_at, sent_at, sent_to, '
  '  invoice_url, invoice_pdf_url, payment_method, stripe_*, updated_at. '
  'LEGAL_GATE: el contenido histórico debe ser reconstruible de forma '
  '  determinista desde su snapshot. '
  'TAX_GATE: aplica igualmente si commission_invoice llega a existir.';

-- Crear el trigger (reemplaza versión anterior si existe)
DROP TRIGGER IF EXISTS trg_guard_fin_doc_immutability
  ON public.trade_financial_documents;

CREATE TRIGGER trg_guard_fin_doc_immutability
  BEFORE UPDATE ON public.trade_financial_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_financial_document_immutability();

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 5: trade_marketplace_provider_doc_refs
--
-- Registro de documentos emitidos por el proveedor al comprador.
--
-- TrabFlow NO emite estos documentos.
-- TrabFlow NO valida su corrección fiscal (TAX_GATE OPEN).
-- Son referencias informativas de trazabilidad operativa.
--
-- DISEÑO NEUTRAL:
--   Sin UNIQUE(supplier_order_id, actor_id).
--   Un pedido puede tener: factura + factura rectificativa + abono.
--   La cardinalidad y fiscalidad definitivas se decidirán post-LEGAL_GATE.
--
-- GUEST CHECKOUT (buyer_org_id = NULL):
--   La columna buyer_org_id es nullable para soportar compras sin login.
--   Cuando es NULL, ninguna policy de comprador otorga acceso a la ref.
--   El acceso de compradores guest queda fuera de MP-FIN-5A.1;
--   se requiere una identidad guest segura antes de implementarlo.
--
-- REGISTRO OPCIONAL Fase 0:
--   No bloquea settlements ni supplier orders.
--   No condiciona ningún flujo financiero.
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trade_marketplace_provider_doc_refs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo con el pedido del proveedor
  -- ON DELETE RESTRICT: no se puede eliminar un pedido con refs registradas
  supplier_order_id   uuid        NOT NULL
    REFERENCES public.trade_marketplace_orders(id) ON DELETE RESTRICT,

  -- Actor proveedor emisor
  -- ON DELETE RESTRICT: no se puede eliminar un actor con refs registradas
  actor_id            uuid        NOT NULL
    REFERENCES public.trade_marketplace_actors(id) ON DELETE RESTRICT,

  -- Org compradora — NULL cuando el comprador es guest (sin login)
  -- Cuando es NULL, la policy buyer_select no concede acceso
  buyer_org_id        uuid
    REFERENCES public.trade_organizations(id) ON DELETE SET NULL,

  -- Tipo de documento (clasificación neutra — sin implicación fiscal)
  -- LEGAL_GATE OPEN: TrabFlow no valida corrección legal ni fiscal
  doc_type            text        NOT NULL DEFAULT 'invoice'
    CHECK (doc_type IN (
      'invoice',        -- factura ordinaria
      'credit_note',    -- factura rectificativa / abono
      'delivery_note',  -- albarán de entrega
      'other'           -- otros documentos operativos
    )),

  -- Datos tal como los informa el proveedor
  -- TAX_GATE OPEN: TrabFlow no valida corrección ni completitud
  doc_number_provider text        NOT NULL,
  doc_date_provider   date        NOT NULL,
  doc_amount          numeric(10,2),           -- nullable: proveedor puede omitirlo
  doc_currency        char(3)     NOT NULL DEFAULT 'EUR',

  -- Notas operativas libres
  notes               text,

  -- Trazabilidad
  registered_at       timestamptz NOT NULL DEFAULT now(),
  registered_by       uuid
    REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.trade_marketplace_provider_doc_refs IS
  'Registro de documentos emitidos por el proveedor al comprador. '
  'TrabFlow NO emite ni valida estos documentos. Son referencias informativas. '
  'LEGAL_GATE = OPEN: sin validación fiscal de TrabFlow. '
  'TAX_GATE   = OPEN: sin tratamiento de IVA por parte de TrabFlow. '
  'STRIPE_GATE= OPEN: sin movimiento de dinero real. '
  'Fase 0: registro OPCIONAL — no bloquea ningún flujo financiero. '
  'Múltiples refs por supplier_order permitidas (factura + rectificativa + abono). '
  'buyer_org_id = NULL cuando el comprador es guest: '
  '  ninguna policy de comprador concede acceso en ese caso. '
  '  El acceso guest queda fuera de MP-FIN-5A.1.';

-- Índices de consulta
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

-- updated_at automático (reutiliza trg_set_updated_at de Sprint 0B)
CREATE OR REPLACE TRIGGER trg_provider_doc_refs_updated_at
  BEFORE UPDATE ON public.trade_marketplace_provider_doc_refs
  FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 6: RLS en trade_marketplace_provider_doc_refs
--
-- PROVIDER (provider_doc_refs_provider_all):
--   FOR ALL (SELECT/INSERT/UPDATE).
--   USING + WITH CHECK: actor_id = ANY(_mkt_actor_ids_for_user()).
--   _mkt_actor_ids_for_user() es SECURITY DEFINER — no puede falsificarse
--   desde el cliente; se calcula en el servidor desde auth.uid().
--   El proveedor solo actúa sobre refs donde actor_id pertenece a sus
--   actores reales en trade_marketplace_actor_members.
--
-- BUYER (provider_doc_refs_buyer_select):
--   FOR SELECT únicamente.
--   USING: buyer_org_id IS NOT NULL
--           AND buyer_org_id IN (
--             SELECT org_id FROM trade_org_members WHERE user_id = auth.uid()
--           ).
--   Un comprador solo ve refs cuyo buyer_org_id coincide con una org
--   a la que pertenece según trade_org_members.
--   buyer_org_id = NULL → condición IS NOT NULL falla → no hay acceso público.
--   Sin WITH CHECK (solo SELECT — el comprador no crea ni modifica).
--
-- ADMIN (provider_doc_refs_admin_all):
--   FOR ALL.
--   USING + WITH CHECK: _mkt_is_platform_admin().
--   Usa el mismo mecanismo de autorización admin ya consolidado
--   en Marketplace Finance. No introduce una nueva forma de detectar admins.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_marketplace_provider_doc_refs
  ENABLE ROW LEVEL SECURITY;

-- PROVEEDOR: acceso completo a sus propias refs (server-side actor check)
DROP POLICY IF EXISTS provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs
  FOR ALL TO authenticated
  USING  (actor_id = ANY(public._mkt_actor_ids_for_user()))
  WITH CHECK (actor_id = ANY(public._mkt_actor_ids_for_user()));

-- COMPRADOR: solo SELECT de refs de sus pedidos (org_id verificado en server)
-- NULL buyer_org_id → IS NOT NULL falla → sin acceso (no public exposure)
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

-- ADMIN: acceso completo usando mecanismo admin consolidado de Marketplace Finance
DROP POLICY IF EXISTS provider_doc_refs_admin_all
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_admin_all
  ON public.trade_marketplace_provider_doc_refs
  FOR ALL TO authenticated
  USING  (public._mkt_is_platform_admin())
  WITH CHECK (public._mkt_is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 7: Grants
-- ─────────────────────────────────────────────────────────────────────────

-- Acceso a trade_marketplace_provider_doc_refs: authenticated via RLS
-- DELETE no concedido — las refs son registros históricos
GRANT SELECT, INSERT, UPDATE
  ON public.trade_marketplace_provider_doc_refs TO authenticated;

COMMIT;
