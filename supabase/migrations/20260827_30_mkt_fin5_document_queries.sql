-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-5A.3 — Document Query & Provider Doc References
--
-- Data/access layer de documentos financieros de marketplace.
-- NO frontend · NO PDF · NO Stripe · NO triggers automáticos
--
-- NUEVAS RPCs:
--   mkt_fin_get_provider_documents   — listado SS/LIQ por actor
--   mkt_fin_get_buyer_documents      — listado PS por org compradora
--   mkt_fin_get_document_detail      — detalle con autorización por subtype
--   mkt_fin_list_provider_doc_refs   — refs emitidas por proveedor
--   mkt_fin_list_buyer_doc_refs      — refs visibles al comprador
--
-- ACTUALIZADA:
--   mkt_fin_register_provider_doc_ref — añade validación doc_number vacío + notes len
--
-- SEGURIDAD:
--   - SECURITY DEFINER + SET search_path = public en todas
--   - REVOKE EXECUTE FROM PUBLIC; GRANT solo a authenticated
--   - trade_financial_documents tiene RLS habilitado sin policies → deny-all directo
--   - Acceso únicamente vía estas RPCs (owner=postgres, bypass RLS)
--   - No SELECT * — allowlists explícitas en listados y detail
--   - actor_id / org_id / document_id verificados server-side
--
-- GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. mkt_fin_get_provider_documents
--
-- Lista documentos financieros del proveedor (supplier_statement y
-- settlement_statement). No devuelve purchase_summary ni documentos TF/ADV.
--
-- Autorización: admin O actor_id pertenece a _mkt_actor_ids_for_user().
-- Paginación: LEAST(GREATEST(limit,1),100); offset>=0; orden created_at DESC.
-- Retorno: {items, total, limit, offset}
-- Allowlist list item: sin metadata (puede ser grande), sin stripe, sin internal.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_provider_documents(
  p_actor_id uuid,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items  jsonb;
  v_total  integer;
  v_lim    integer;
  v_off    integer;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user())
  ) THEN
    RAISE EXCEPTION 'GET_PROVIDER_DOCS: no autorizado para actor %.', p_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  v_lim := LEAST(GREATEST(p_limit, 1), 100);
  v_off := GREATEST(p_offset, 0);

  SELECT COUNT(*) INTO v_total
    FROM public.trade_financial_documents
   WHERE actor_id = p_actor_id
     AND document_subtype IN ('supplier_statement', 'settlement_statement');

  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT id,
             doc_number,
             doc_series,
             document_subtype,
             estado,
             total_amount,
             currency,
             concept,
             issued_at,
             created_at,
             immutable_at,
             supplier_order_id,
             settlement_id
        FROM public.trade_financial_documents
       WHERE actor_id = p_actor_id
         AND document_subtype IN ('supplier_statement', 'settlement_statement')
       ORDER BY created_at DESC
       LIMIT v_lim OFFSET v_off
    ) r;

  RETURN jsonb_build_object(
    'items',  v_items,
    'total',  v_total,
    'limit',  v_lim,
    'offset', v_off
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. mkt_fin_get_buyer_documents
--
-- Lista purchase_summary de la org compradora. Solo ve purchase_summary.
-- No ve supplier_statement, settlement_statement, TF, ADV.
--
-- Autorización: admin O auth.uid() es miembro activo de p_org_id.
-- Guest checkout (org_id=NULL) fuera de scope — org_id NULL no da acceso público.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_buyer_documents(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items  jsonb;
  v_total  integer;
  v_lim    integer;
  v_off    integer;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = p_org_id
         AND user_id = auth.uid()
         AND activo  = true
    )
  ) THEN
    RAISE EXCEPTION 'GET_BUYER_DOCS: no autorizado para org %.', p_org_id
      USING ERRCODE = 'P0001';
  END IF;

  v_lim := LEAST(GREATEST(p_limit, 1), 100);
  v_off := GREATEST(p_offset, 0);

  SELECT COUNT(*) INTO v_total
    FROM public.trade_financial_documents
   WHERE org_id = p_org_id
     AND document_subtype = 'purchase_summary';

  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT id,
             doc_number,
             doc_series,
             document_subtype,
             estado,
             total_amount,
             currency,
             concept,
             issued_at,
             created_at,
             immutable_at,
             master_order_id
        FROM public.trade_financial_documents
       WHERE org_id = p_org_id
         AND document_subtype = 'purchase_summary'
       ORDER BY created_at DESC
       LIMIT v_lim OFFSET v_off
    ) r;

  RETURN jsonb_build_object(
    'items',  v_items,
    'total',  v_total,
    'limit',  v_lim,
    'offset', v_off
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. mkt_fin_get_document_detail
--
-- Detalle completo de un Financial Document con autorización por subtype:
--   purchase_summary    → buyer (org_id in user's orgs)
--   supplier_statement  → provider (actor_id in user's actors)
--   settlement_statement → provider (actor_id in user's actors)
--   otro subtype / NULL → denegado (TF/ADV/COM no accesibles aquí)
--
-- Allowlist de cabecera explícita. metadata ya fue allowlisted en generación.
-- Excluidos: stripe_*, invoice_url, invoice_pdf_url, sent_at, sent_to,
--            public_token, ad_booking_id, ad_campaign_id, subscription_id,
--            platform_invoice_id, revenue_type, payer_type, paid_at,
--            payment_method, updated_at, created_by,
--            rate_amount, quantity, subtotal, discount_amount,
--            promotion_amount, commercial_value.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_get_document_detail(
  p_document_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id               uuid;
  v_doc_number       text;
  v_doc_series       text;
  v_subtype          text;
  v_doc_type         text;
  v_estado           text;
  v_payment_status   text;
  v_org_id           uuid;
  v_actor_id         uuid;
  v_concept          text;
  v_period_start     date;
  v_period_end       date;
  v_net_amount       numeric;
  v_tax_rate         numeric;
  v_tax_amount       numeric;
  v_total_amount     numeric;
  v_currency         character(3);
  v_customer_name    text;
  v_customer_nif     text;
  v_customer_email   text;
  v_customer_address text;
  v_issued_at        timestamptz;
  v_created_at       timestamptz;
  v_immutable_at     timestamptz;
  v_master_order_id  uuid;
  v_supplier_order_id uuid;
  v_settlement_id    uuid;
  v_metadata         jsonb;
  v_authorized       boolean := false;
BEGIN
  -- 1. Cargar cabecera con allowlist explícita
  SELECT
    id, doc_number, doc_series, document_subtype, document_type,
    estado, payment_status, org_id, actor_id, concept,
    period_start, period_end,
    net_amount, tax_rate, tax_amount, total_amount, currency,
    customer_name, customer_nif, customer_email, customer_address,
    issued_at, created_at, immutable_at,
    master_order_id, supplier_order_id, settlement_id,
    metadata
  INTO
    v_id, v_doc_number, v_doc_series, v_subtype, v_doc_type,
    v_estado, v_payment_status, v_org_id, v_actor_id, v_concept,
    v_period_start, v_period_end,
    v_net_amount, v_tax_rate, v_tax_amount, v_total_amount, v_currency,
    v_customer_name, v_customer_nif, v_customer_email, v_customer_address,
    v_issued_at, v_created_at, v_immutable_at,
    v_master_order_id, v_supplier_order_id, v_settlement_id,
    v_metadata
  FROM public.trade_financial_documents
  WHERE id = p_document_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GET_DOC_DETAIL: documento % no encontrado.', p_document_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 2. Autorización por subtype
  IF public._mkt_is_platform_admin() THEN
    v_authorized := true;

  ELSIF v_subtype = 'purchase_summary' THEN
    IF v_org_id IS NULL THEN
      v_authorized := false;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.trade_org_members
         WHERE org_id  = v_org_id
           AND user_id = auth.uid()
           AND activo  = true
      ) INTO v_authorized;
    END IF;

  ELSIF v_subtype IN ('supplier_statement', 'settlement_statement') THEN
    IF v_actor_id IS NULL THEN
      v_authorized := false;
    ELSE
      SELECT v_actor_id = ANY(public._mkt_actor_ids_for_user())
        INTO v_authorized;
      -- ANY sobre array vacío devuelve false; NULL actor_id cubierto arriba
      IF v_authorized IS NULL THEN v_authorized := false; END IF;
    END IF;

  ELSE
    -- subtype NULL / TF / ADV / COM — no accesible vía esta RPC
    v_authorized := false;
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION
      'GET_DOC_DETAIL: no autorizado para documento % (subtype: %).',
      p_document_id, v_subtype
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Retornar allowlist explícita
  RETURN jsonb_build_object(
    'id',                v_id,
    'doc_number',        v_doc_number,
    'doc_series',        v_doc_series,
    'document_subtype',  v_subtype,
    'document_type',     v_doc_type,
    'estado',            v_estado,
    'payment_status',    v_payment_status,
    'org_id',            v_org_id,
    'actor_id',          v_actor_id,
    'concept',           v_concept,
    'period_start',      v_period_start,
    'period_end',        v_period_end,
    'net_amount',        v_net_amount,
    'tax_rate',          v_tax_rate,
    'tax_amount',        v_tax_amount,
    'total_amount',      v_total_amount,
    'currency',          v_currency,
    'customer_name',     v_customer_name,
    'customer_nif',      v_customer_nif,
    'customer_email',    v_customer_email,
    'customer_address',  v_customer_address,
    'issued_at',         v_issued_at,
    'created_at',        v_created_at,
    'immutable_at',      v_immutable_at,
    'master_order_id',   v_master_order_id,
    'supplier_order_id', v_supplier_order_id,
    'settlement_id',     v_settlement_id,
    'metadata',          v_metadata
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. mkt_fin_list_provider_doc_refs
--
-- Lista referencias documentales emitidas por el proveedor (facturas,
-- albaranes, notas de abono que el proveedor emitió al comprador).
-- Lectura paginada, solo del actor autorizado.
-- Excluido: registered_by (operacional interno).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_list_provider_doc_refs(
  p_actor_id uuid,
  p_limit    integer DEFAULT 50,
  p_offset   integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items  jsonb;
  v_total  integer;
  v_lim    integer;
  v_off    integer;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR p_actor_id = ANY(public._mkt_actor_ids_for_user())
  ) THEN
    RAISE EXCEPTION 'LIST_PROV_REFS: no autorizado para actor %.', p_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  v_lim := LEAST(GREATEST(p_limit, 1), 100);
  v_off := GREATEST(p_offset, 0);

  SELECT COUNT(*) INTO v_total
    FROM public.trade_marketplace_provider_doc_refs
   WHERE actor_id = p_actor_id;

  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.registered_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT id,
             supplier_order_id,
             actor_id,
             buyer_org_id,
             doc_type,
             doc_number_provider,
             doc_date_provider,
             doc_amount,
             TRIM(doc_currency)::text AS doc_currency,
             notes,
             registered_at,
             created_at
        FROM public.trade_marketplace_provider_doc_refs
       WHERE actor_id = p_actor_id
       ORDER BY registered_at DESC
       LIMIT v_lim OFFSET v_off
    ) r;

  RETURN jsonb_build_object(
    'items',  v_items,
    'total',  v_total,
    'limit',  v_lim,
    'offset', v_off
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. mkt_fin_list_buyer_doc_refs
--
-- Lista referencias documentales visibles al comprador de una org.
-- Solo ve refs donde buyer_org_id = p_org_id (IS NOT NULL garantizado).
-- No puede ver refs de otras orgs ni registrar nuevas.
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_list_buyer_doc_refs(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items  jsonb;
  v_total  integer;
  v_lim    integer;
  v_off    integer;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = p_org_id
         AND user_id = auth.uid()
         AND activo  = true
    )
  ) THEN
    RAISE EXCEPTION 'LIST_BUYER_REFS: no autorizado para org %.', p_org_id
      USING ERRCODE = 'P0001';
  END IF;

  v_lim := LEAST(GREATEST(p_limit, 1), 100);
  v_off := GREATEST(p_offset, 0);

  SELECT COUNT(*) INTO v_total
    FROM public.trade_marketplace_provider_doc_refs
   WHERE buyer_org_id = p_org_id
     AND buyer_org_id IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.registered_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT id,
             supplier_order_id,
             actor_id,
             buyer_org_id,
             doc_type,
             doc_number_provider,
             doc_date_provider,
             doc_amount,
             TRIM(doc_currency)::text AS doc_currency,
             notes,
             registered_at,
             created_at
        FROM public.trade_marketplace_provider_doc_refs
       WHERE buyer_org_id = p_org_id
         AND buyer_org_id IS NOT NULL
       ORDER BY registered_at DESC
       LIMIT v_lim OFFSET v_off
    ) r;

  RETURN jsonb_build_object(
    'items',  v_items,
    'total',  v_total,
    'limit',  v_lim,
    'offset', v_off
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. mkt_fin_register_provider_doc_ref — actualización mínima
--
-- Añade validaciones faltantes detectadas en 5A.3:
--   - TRIM(doc_number_provider) = '' → error explícito
--   - notes > 500 chars → error explícito
--
-- El resto de la función permanece igual (server-side derivation actor_id
-- y buyer_org_id, validación doc_type, idempotencia no aplicada por diseño).
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mkt_fin_register_provider_doc_ref(
  p_supplier_order_id  uuid,
  p_doc_type           text,
  p_doc_number_provider text,
  p_doc_date_provider  date,
  p_doc_amount         numeric DEFAULT NULL,
  p_doc_currency       character DEFAULT 'EUR',
  p_notes              text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid;
  v_buyer_org_id uuid;
  v_new_id       uuid;
BEGIN
  -- 1. Derivar actor_id y buyer_org_id desde el supplier order (fuente de autoridad)
  SELECT actor_id, org_id
    INTO v_actor_id, v_buyer_org_id
    FROM public.trade_marketplace_orders
   WHERE id = p_supplier_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: supplier_order_id % no encontrado.',
      p_supplier_order_id;
  END IF;

  -- 2. Verificar pertenencia al actor del pedido
  IF NOT (v_actor_id = ANY(public._mkt_actor_ids_for_user())) THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: no autorizado. '
      'El pedido % pertenece al actor %, '
      'que no es accesible para el usuario actual.',
      p_supplier_order_id, v_actor_id;
  END IF;

  -- 3. Validaciones de contenido (añadidas en 5A.3)
  IF TRIM(p_doc_number_provider) = '' THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: doc_number_provider no puede estar vacío.';
  END IF;

  IF p_notes IS NOT NULL AND LENGTH(p_notes) > 500 THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: notes excede el límite de 500 caracteres (actual: %).',
      LENGTH(p_notes);
  END IF;

  -- 4. Validar doc_type (redundante con CHECK, pero mensajes claros)
  IF p_doc_type NOT IN ('invoice', 'credit_note', 'delivery_note', 'other') THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: doc_type % no válido. '
      'Valores aceptados: invoice, credit_note, delivery_note, other.',
      p_doc_type;
  END IF;

  -- 5. Insertar con actor_id y buyer_org_id derivados del servidor
  INSERT INTO public.trade_marketplace_provider_doc_refs (
    supplier_order_id,
    actor_id,
    buyer_org_id,
    doc_type,
    doc_number_provider,
    doc_date_provider,
    doc_amount,
    doc_currency,
    notes,
    registered_by
  ) VALUES (
    p_supplier_order_id,
    v_actor_id,
    v_buyer_org_id,
    p_doc_type,
    p_doc_number_provider,
    p_doc_date_provider,
    p_doc_amount,
    COALESCE(p_doc_currency, 'EUR'),
    p_notes,
    auth.uid()
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- GRANTs — nuevas RPCs (5A.3)
-- mkt_fin_register_provider_doc_ref ya tenía GRANT authenticated — preservado.
-- CREATE OR REPLACE no altera ACLs existentes en PostgreSQL.
-- ─────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.mkt_fin_get_provider_documents(uuid, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_get_provider_documents(uuid, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_get_buyer_documents(uuid, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_get_buyer_documents(uuid, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_get_document_detail(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_get_document_detail(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_list_provider_doc_refs(uuid, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_list_provider_doc_refs(uuid, integer, integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_list_buyer_doc_refs(uuid, integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_list_buyer_doc_refs(uuid, integer, integer) TO authenticated;

-- mkt_fin_register_provider_doc_ref: ACL explícita (sin dependencia del estado previo).
-- Firma exacta verificada vía pg_get_function_identity_arguments.
REVOKE EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref(uuid, text, text, date, numeric, character, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref(uuid, text, text, date, numeric, character, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref(uuid, text, text, date, numeric, character, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- COMMENTs
-- ─────────────────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.mkt_fin_get_provider_documents IS
  'MP-FIN-5A.3 — Lista supplier_statement y settlement_statement del actor. '
  'Autorización: actor en _mkt_actor_ids_for_user() o admin. '
  'Paginado, limit máx 100, orden created_at DESC. No metadata en listado.';

COMMENT ON FUNCTION public.mkt_fin_get_buyer_documents IS
  'MP-FIN-5A.3 — Lista purchase_summary de la org compradora. '
  'Autorización: trade_org_members.activo=true o admin. '
  'Solo purchase_summary — no supplier/settlement/TF/ADV.';

COMMENT ON FUNCTION public.mkt_fin_get_document_detail IS
  'MP-FIN-5A.3 — Detalle completo de Financial Document con allowlist explícita. '
  'Auth por subtype: purchase_summary→buyer org, supplier/settlement→actor proveedor. '
  'Subtype NULL/TF/ADV/COM: denegado. Metadata incluida (ya allowlisted en generación).';

COMMENT ON FUNCTION public.mkt_fin_list_provider_doc_refs IS
  'MP-FIN-5A.3 — Lista refs documentales emitidas por el proveedor. '
  'Solo actor autorizado. Paginado, limit máx 100. No UPDATE/DELETE.';

COMMENT ON FUNCTION public.mkt_fin_list_buyer_doc_refs IS
  'MP-FIN-5A.3 — Lista refs documentales visibles al comprador (buyer_org_id). '
  'buyer_org_id IS NOT NULL — NULL org nunca da acceso público.';

COMMENT ON FUNCTION public.mkt_fin_register_provider_doc_ref IS
  'MP-FIN-5A.2/5A.3 — Registra referencia documental del proveedor. '
  'actor_id y buyer_org_id derivados server-side desde supplier_order. '
  '5A.3: añade validación doc_number_provider no vacío + notes ≤ 500 chars.';

COMMIT;
