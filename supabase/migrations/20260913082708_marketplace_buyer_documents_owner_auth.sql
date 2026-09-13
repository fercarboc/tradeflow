-- ════════════════════════════════════════════════════════════════════════════
-- MARKETPLACE-DOCUMENTS-AUTH-AND-LIGHT-UI — Auth fix (owner path)
--
-- PROBLEMA: mkt_fin_get_buyer_documents y mkt_fin_list_buyer_doc_refs
--   autorizaban únicamente via trade_org_members.activo=true.
--   Los owners de org identificados por trade_organizations.owner_id
--   (sin fila trade_org_members) recibían RAISE EXCEPTION P0001.
--
-- CAMBIO: añadir OR EXISTS (trade_organizations WHERE owner_id = auth.uid())
--   como vía de autorización adicional en ambas funciones.
--
-- NO MODIFICA: firma, return type, parámetros, lógica de datos,
--   search_path, SECURITY DEFINER, ORDER BY, paginación, JOINs,
--   filtro p_org_id (aislamiento tenant), otras RPCs.
--
-- NO TOCA: RLS, tablas, facturas, fiscal, VeriFactu, settlements.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. mkt_fin_get_buyer_documents — añadir owner como vía de autorización
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_get_buyer_documents(
  p_org_id  uuid,
  p_limit   integer DEFAULT 50,
  p_offset  integer DEFAULT 0,
  p_search  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items   jsonb;
  v_total   integer;
  v_lim     integer;
  v_off     integer;
  v_search  text;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = p_org_id
         AND user_id = auth.uid()
         AND activo  = true
    )
    OR EXISTS (
      SELECT 1 FROM public.trade_organizations
       WHERE id       = p_org_id
         AND owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'GET_BUYER_DOCS: no autorizado para org %.', p_org_id
      USING ERRCODE = 'P0001';
  END IF;

  v_lim    := LEAST(GREATEST(p_limit, 1), 100);
  v_off    := GREATEST(p_offset, 0);
  v_search := CASE WHEN p_search IS NOT NULL AND TRIM(p_search) <> ''
                   THEN TRIM(p_search) ELSE NULL END;

  SELECT COUNT(*) INTO v_total
    FROM public.trade_financial_documents
   WHERE org_id = p_org_id
     AND document_subtype = 'purchase_summary'
     AND (
       v_search IS NULL
       OR doc_number ILIKE '%' || v_search || '%'
     );

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
         AND (
           v_search IS NULL
           OR doc_number ILIKE '%' || v_search || '%'
         )
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
-- 2. mkt_fin_list_buyer_doc_refs — añadir owner como vía de autorización
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mkt_fin_list_buyer_doc_refs(
  p_org_id    uuid,
  p_limit     integer DEFAULT 50,
  p_offset    integer DEFAULT 0,
  p_search    text    DEFAULT NULL,
  p_doc_type  text    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_items     jsonb;
  v_total     integer;
  v_lim       integer;
  v_off       integer;
  v_search    text;
  v_doc_type  text;
BEGIN
  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = p_org_id
         AND user_id = auth.uid()
         AND activo  = true
    )
    OR EXISTS (
      SELECT 1 FROM public.trade_organizations
       WHERE id       = p_org_id
         AND owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'LIST_BUYER_REFS: no autorizado para org %.', p_org_id
      USING ERRCODE = 'P0001';
  END IF;

  IF p_doc_type IS NOT NULL
     AND p_doc_type NOT IN ('invoice', 'credit_note', 'delivery_note', 'other') THEN
    RAISE EXCEPTION 'LIST_BUYER_REFS: doc_type % no válido. '
      'Valores aceptados: invoice, credit_note, delivery_note, other.', p_doc_type
      USING ERRCODE = 'P0005';
  END IF;

  v_lim      := LEAST(GREATEST(p_limit, 1), 100);
  v_off      := GREATEST(p_offset, 0);
  v_search   := CASE WHEN p_search IS NOT NULL AND TRIM(p_search) <> ''
                     THEN TRIM(p_search) ELSE NULL END;
  v_doc_type := p_doc_type;

  SELECT COUNT(*) INTO v_total
    FROM public.trade_marketplace_provider_doc_refs r
    JOIN public.trade_marketplace_orders            o ON o.id  = r.supplier_order_id
    JOIN public.trade_marketplace_actors            a ON a.id  = r.actor_id
   WHERE r.buyer_org_id = p_org_id
     AND r.buyer_org_id IS NOT NULL
     AND (v_doc_type IS NULL OR r.doc_type = v_doc_type)
     AND (
       v_search IS NULL
       OR r.doc_number_provider ILIKE '%' || v_search || '%'
       OR o.numero              ILIKE '%' || v_search || '%'
       OR a.nombre              ILIKE '%' || v_search || '%'
     );

  SELECT COALESCE(jsonb_agg(row_to_json(q.*) ORDER BY q.registered_at DESC), '[]'::jsonb)
    INTO v_items
    FROM (
      SELECT r.id,
             r.supplier_order_id,
             r.actor_id,
             r.buyer_org_id,
             r.doc_type,
             r.doc_number_provider,
             r.doc_date_provider,
             r.doc_amount,
             TRIM(r.doc_currency)::text  AS doc_currency,
             r.notes,
             r.registered_at,
             r.created_at,
             a.nombre                    AS actor_nombre,
             o.numero                    AS supplier_order_numero
        FROM public.trade_marketplace_provider_doc_refs r
        JOIN public.trade_marketplace_orders            o ON o.id  = r.supplier_order_id
        JOIN public.trade_marketplace_actors            a ON a.id  = r.actor_id
       WHERE r.buyer_org_id = p_org_id
         AND r.buyer_org_id IS NOT NULL
         AND (v_doc_type IS NULL OR r.doc_type = v_doc_type)
         AND (
           v_search IS NULL
           OR r.doc_number_provider ILIKE '%' || v_search || '%'
           OR o.numero              ILIKE '%' || v_search || '%'
           OR a.nombre              ILIKE '%' || v_search || '%'
         )
       ORDER BY r.registered_at DESC
       LIMIT v_lim OFFSET v_off
    ) q;

  RETURN jsonb_build_object(
    'items',  v_items,
    'total',  v_total,
    'limit',  v_lim,
    'offset', v_off
  );
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- ACLs — idénticos a migration anterior; reestablecidos explícitamente
-- ─────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.mkt_fin_get_buyer_documents(uuid, integer, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_fin_get_buyer_documents(uuid, integer, integer, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_get_buyer_documents(uuid, integer, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_list_buyer_doc_refs(uuid, integer, integer, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mkt_fin_list_buyer_doc_refs(uuid, integer, integer, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_list_buyer_doc_refs(uuid, integer, integer, text, text) TO authenticated;

COMMENT ON FUNCTION public.mkt_fin_get_buyer_documents IS
  'MP-FIN-5C — Lista purchase_summary de la org compradora con búsqueda opcional. '
  'Autorización: trade_org_members.activo=true, trade_organizations.owner_id, o admin. '
  'Aislamiento tenant: org_id siempre aplicado. Solo purchase_summary.';

COMMENT ON FUNCTION public.mkt_fin_list_buyer_doc_refs IS
  'MP-FIN-5C — Lista refs documentales del comprador (actor_nombre, supplier_order_numero). '
  'Autorización: trade_org_members.activo=true, trade_organizations.owner_id, o admin. '
  'Aislamiento tenant: buyer_org_id siempre aplicado. Solo lectura.';

COMMIT;
