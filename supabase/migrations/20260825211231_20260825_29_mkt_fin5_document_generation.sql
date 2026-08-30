-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-5A.2 — Document Generation RPCs
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE OR REPLACE FUNCTION public.mkt_fin_generate_purchase_summary(
  p_master_order_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     uuid;
  v_numero     text;
  v_total      numeric;
  v_net        numeric;
  v_tax        numeric;
  v_currency   text;
  v_buyer_snap jsonb;
  v_metadata   jsonb;
  v_doc_id     uuid;
BEGIN
  SELECT org_id, numero, checkout_gross_total,
         COALESCE(goods_net_total, 0) + COALESCE(shipping_net_total, 0),
         COALESCE(goods_tax_total, 0) + COALESCE(shipping_tax_total, 0),
         COALESCE(currency, 'EUR'),
         COALESCE(buyer_snapshot, '{}')
    INTO v_org_id, v_numero, v_total, v_net, v_tax, v_currency, v_buyer_snap
    FROM public.trade_marketplace_master_orders
   WHERE id = p_master_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GEN_PS: master_order % no encontrado.', p_master_order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = v_org_id
         AND user_id = auth.uid()
         AND active  = true
    )
  ) THEN
    RAISE EXCEPTION 'GEN_PS: no autorizado para master_order %.', p_master_order_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE master_order_id = p_master_order_id
     AND document_subtype = 'purchase_summary';

  IF FOUND THEN RETURN v_doc_id; END IF;

  SELECT jsonb_build_object(
    'master_order', to_jsonb(mo.*),
    'supplier_orders', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'order', to_jsonb(so.*),
          'items', (
            SELECT jsonb_agg(to_jsonb(oi.*))
            FROM public.trade_marketplace_order_items oi
            WHERE oi.order_id = so.id
          )
        )
      )
      FROM public.trade_marketplace_orders so
      WHERE so.master_order_id = p_master_order_id
    ),
    'generated_at', now()
  ) INTO v_metadata
  FROM public.trade_marketplace_master_orders mo
  WHERE mo.id = p_master_order_id;

  BEGIN
    INSERT INTO public.trade_financial_documents (
      doc_number,         doc_series,         document_type,
      document_subtype,   revenue_type,       payer_type,
      org_id,             actor_id,           master_order_id,
      concept,            customer_name,      customer_nif,
      customer_email,     customer_address,   subtotal,
      net_amount,         tax_rate,           tax_amount,
      total_amount,       currency,           issued_at,
      immutable_at,       metadata
    ) VALUES (
      v_numero,
      'MKP',
      'commercial_summary',
      'purchase_summary',
      'marketplace',
      'installer_company',
      v_org_id,
      NULL,
      p_master_order_id,
      'Resumen de compra marketplace',
      COALESCE(
        NULLIF(v_buyer_snap->>'nombre', ''),
        NULLIF(v_buyer_snap->>'name',   ''),
        'Comprador'
      ),
      NULLIF(v_buyer_snap->>'nif',      ''),
      NULLIF(v_buyer_snap->>'email',    ''),
      COALESCE(
        NULLIF(v_buyer_snap->>'direccion', ''),
        NULLIF(v_buyer_snap->>'address',   '')
      ),
      v_net,
      v_net,
      0::numeric,
      v_tax,
      COALESCE(v_total, v_net + v_tax),
      v_currency,
      now(),
      now(),
      v_metadata
    )
    RETURNING id INTO v_doc_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_doc_id
      FROM public.trade_financial_documents
     WHERE master_order_id = p_master_order_id
       AND document_subtype = 'purchase_summary';

    IF v_doc_id IS NULL THEN
      RAISE EXCEPTION
        'GEN_PS: colisión de doc_number % para master_order %. El número ya existe en otro tipo de documento.',
        v_numero, p_master_order_id
        USING ERRCODE = 'P0004';
    END IF;
  END;

  RETURN v_doc_id;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_generate_purchase_summary IS
  'MP-FIN-5A.2 — Genera purchase_summary para un master_order. '
  'SECURITY DEFINER (owner=postgres). Idempotente vía partial UNIQUE index uq_tfd_purchase_summary_per_master. '
  'doc_number = master_order.numero (MKP-YYYY-NNNN, sin consumir nueva secuencia MKP). '
  'Autorización: miembro de la org compradora (trade_org_members.active) o admin. '
  'immutable_at fijado en creación — snapshot congelado. '
  'LEGAL_GATE OPEN. TAX_GATE OPEN. STRIPE_GATE OPEN. '
  'Compatible con c0a875f: next_financial_doc_number no se invoca para MKP.';


CREATE OR REPLACE FUNCTION public.mkt_fin_generate_supplier_statement(
  p_supplier_order_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id     uuid;
  v_buyer_org_id uuid;
  v_numero       text;
  v_gross        numeric;
  v_tax_rate     numeric;
  v_net          numeric;
  v_tax          numeric;
  v_currency     text;
  v_snap_at      timestamptz;
  v_actor_nombre text;
  v_metadata     jsonb;
  v_doc_number   text;
  v_doc_id       uuid;
BEGIN
  SELECT actor_id, org_id, numero,
         COALESCE(goods_gross_snapshot, 0) + COALESCE(shipping_gross_snapshot, 0),
         COALESCE(tax_rate_snapshot, 0),
         COALESCE(currency, 'EUR'),
         financial_snapshot_at
    INTO v_actor_id, v_buyer_org_id, v_numero,
         v_gross, v_tax_rate, v_currency, v_snap_at
    FROM public.trade_marketplace_orders
   WHERE id = p_supplier_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GEN_SS: supplier_order % no encontrado.', p_supplier_order_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_snap_at IS NULL THEN
    RAISE EXCEPTION
      'GEN_SS: supplier_order % sin snapshot financiero (financial_snapshot_at IS NULL). El pedido debe ser procesado antes de generar el extracto.',
      p_supplier_order_id
      USING ERRCODE = 'P0003';
  END IF;

  IF NOT (
    public._mkt_is_platform_admin()
    OR public._mkt_supplier_member_check(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'GEN_SS: no autorizado para supplier_order % (actor %).',
      p_supplier_order_id, v_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE supplier_order_id = p_supplier_order_id
     AND document_subtype  = 'supplier_statement';

  IF FOUND THEN RETURN v_doc_id; END IF;

  IF v_tax_rate > 0 THEN
    v_net := ROUND(v_gross / (1 + v_tax_rate / 100), 2);
  ELSE
    v_net := v_gross;
  END IF;
  v_tax := ROUND(v_gross - v_net, 2);

  SELECT COALESCE(NULLIF(a.nombre, ''), 'Proveedor')
    INTO v_actor_nombre
    FROM public.trade_marketplace_actors a
   WHERE a.id = v_actor_id;

  v_actor_nombre := COALESCE(v_actor_nombre, 'Proveedor');

  SELECT jsonb_build_object(
    'supplier_order', to_jsonb(so.*),
    'items', (
      SELECT jsonb_agg(to_jsonb(oi.*))
      FROM public.trade_marketplace_order_items oi
      WHERE oi.order_id = p_supplier_order_id
    ),
    'generated_at', now()
  ) INTO v_metadata
  FROM public.trade_marketplace_orders so
  WHERE so.id = p_supplier_order_id;

  v_doc_number := public.next_financial_doc_number('SUP');

  BEGIN
    INSERT INTO public.trade_financial_documents (
      doc_number,         doc_series,         document_type,
      document_subtype,   revenue_type,       payer_type,
      org_id,             actor_id,           supplier_order_id,
      concept,            customer_name,      subtotal,
      net_amount,         tax_rate,           tax_amount,
      total_amount,       currency,           issued_at,
      immutable_at,       metadata
    ) VALUES (
      v_doc_number,
      'SUP',
      'commercial_summary',
      'supplier_statement',
      'marketplace',
      'provider',
      v_buyer_org_id,
      v_actor_id,
      p_supplier_order_id,
      'Extracto de pedido proveedor - ' || v_numero,
      v_actor_nombre,
      v_net,
      v_net,
      v_tax_rate,
      v_tax,
      v_gross,
      v_currency,
      now(),
      now(),
      v_metadata
    )
    RETURNING id INTO v_doc_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_doc_id
      FROM public.trade_financial_documents
     WHERE supplier_order_id = p_supplier_order_id
       AND document_subtype  = 'supplier_statement';
  END;

  RETURN v_doc_id;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_generate_supplier_statement IS
  'MP-FIN-5A.2 — Genera supplier_statement para un supplier_order. '
  'SECURITY DEFINER (owner=postgres). Requiere financial_snapshot_at IS NOT NULL. '
  'Idempotente vía partial UNIQUE index uq_tfd_supplier_statement_per_order. '
  'doc_number = next_financial_doc_number(''SUP'') — ejecutado como postgres (c0a875f compatible). '
  'Autorización: _mkt_supplier_member_check (trade_marketplace_actor_members.activo) o admin. '
  'immutable_at fijado en creación. LEGAL_GATE OPEN. TAX_GATE OPEN.';


CREATE OR REPLACE FUNCTION public.mkt_fin_generate_settlement_statement(
  p_settlement_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id      uuid;
  v_settle_number text;
  v_period_start  date;
  v_period_end    date;
  v_status        text;
  v_settle_amt    numeric;
  v_currency      text;
  v_sim_only      boolean;
  v_actor_nombre  text;
  v_metadata      jsonb;
  v_doc_number    text;
  v_doc_id        uuid;
BEGIN
  SELECT provider_actor_id, settlement_number,
         period_start, period_end, status,
         COALESCE(settlement_amount, 0),
         COALESCE(currency, 'EUR'),
         COALESCE(simulation_only, true)
    INTO v_actor_id, v_settle_number,
         v_period_start, v_period_end, v_status,
         v_settle_amt, v_currency, v_sim_only
    FROM public.trade_marketplace_settlements
   WHERE id = p_settlement_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GEN_LIQ: settlement % no encontrado.', p_settlement_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_status = 'draft' THEN
    RAISE EXCEPTION
      'GEN_LIQ: settlement % está en estado ''draft''. Solo se puede generar cuando status != ''draft'' (calculated, approved, payable, simulated_paid, closed).',
      p_settlement_id
      USING ERRCODE = 'P0003';
  END IF;

  IF NOT (
    public._mkt_is_platform_admin()
    OR public._mkt_supplier_member_check(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'GEN_LIQ: no autorizado para settlement % (actor %).',
      p_settlement_id, v_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE settlement_id    = p_settlement_id
     AND document_subtype = 'settlement_statement';

  IF FOUND THEN RETURN v_doc_id; END IF;

  SELECT COALESCE(NULLIF(a.nombre, ''), 'Proveedor')
    INTO v_actor_nombre
    FROM public.trade_marketplace_actors a
   WHERE a.id = v_actor_id;

  v_actor_nombre := COALESCE(v_actor_nombre, 'Proveedor');

  SELECT jsonb_build_object(
    'settlement', to_jsonb(s.*),
    'settlement_lines', (
      SELECT jsonb_agg(to_jsonb(sl.*))
      FROM public.trade_marketplace_settlement_lines sl
      WHERE sl.settlement_id = p_settlement_id
    ),
    'simulation_only', v_sim_only,
    'generated_at', now()
  ) INTO v_metadata
  FROM public.trade_marketplace_settlements s
  WHERE s.id = p_settlement_id;

  v_doc_number := public.next_financial_doc_number('LIQ');

  BEGIN
    INSERT INTO public.trade_financial_documents (
      doc_number,         doc_series,         document_type,
      document_subtype,   revenue_type,       payer_type,
      org_id,             actor_id,           settlement_id,
      concept,            customer_name,      period_start,
      period_end,         subtotal,           net_amount,
      tax_rate,           tax_amount,         total_amount,
      currency,           issued_at,          immutable_at,
      metadata
    ) VALUES (
      v_doc_number,
      'LIQ',
      'commercial_summary',
      'settlement_statement',
      'marketplace',
      'provider',
      NULL,
      v_actor_id,
      p_settlement_id,
      'Liquidación de ventas marketplace - ' || v_settle_number,
      v_actor_nombre,
      v_period_start,
      v_period_end,
      v_settle_amt,
      v_settle_amt,
      0::numeric,
      0::numeric,
      v_settle_amt,
      v_currency,
      now(),
      now(),
      v_metadata
    )
    RETURNING id INTO v_doc_id;

  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_doc_id
      FROM public.trade_financial_documents
     WHERE settlement_id    = p_settlement_id
       AND document_subtype = 'settlement_statement';
  END;

  RETURN v_doc_id;
END;
$$;

COMMENT ON FUNCTION public.mkt_fin_generate_settlement_statement IS
  'MP-FIN-5A.2 — Genera settlement_statement para una liquidación. '
  'SECURITY DEFINER (owner=postgres). Requiere status != ''draft''. '
  'NO recalcula: usa importes del Settlement Engine (MP-FIN-2F). '
  'Idempotente vía partial UNIQUE index uq_tfd_settlement_statement_per_settlement. '
  'doc_number = next_financial_doc_number(''LIQ'') — ejecutado como postgres (c0a875f compatible). '
  'org_id = NULL: trade_marketplace_actors no expone org_id. '
  'simulation_only registrado en metadata. '
  'LEGAL_GATE OPEN. TAX_GATE OPEN. STRIPE_GATE OPEN. COMMISSION_GATE OPEN (0% real).';


REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_purchase_summary(uuid)    FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_purchase_summary(uuid)    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_supplier_statement(uuid)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_supplier_statement(uuid)  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_settlement_statement(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_settlement_statement(uuid) TO authenticated;

COMMIT;
;
