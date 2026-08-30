-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-5A.2 — Document Generation RPCs
--
-- Tres RPCs SECURITY DEFINER para generación idempotente de documentos
-- financieros de marketplace.
--
-- COMPATIBILIDAD CON c0a875f (security hotfix trade_doc_number_seq):
--   next_financial_doc_number() tiene EXECUTE revocada de PUBLIC/authenticated.
--   Estas RPCs son SECURITY DEFINER (owner=postgres), que tiene EXECUTE.
--   authenticated → RPC (SECURITY DEFINER) → postgres → next_financial_doc_number ✓
--   El cliente nunca obtiene acceso directo a la función de secuencia.
--   Verificado en test de compatibilidad arquitectónica pre-implementación.
--
-- SERIES (referencias internas, NO numeración fiscal):
--   MKP — purchase_summary:    doc_number = master_order.numero (sin nueva secuencia)
--   SUP — supplier_statement:  next_financial_doc_number('SUP') vía postgres
--   LIQ — settlement_statement: next_financial_doc_number('LIQ') vía postgres
--
-- RESTRICCIONES ARQUITECTÓNICAS:
--   - trade_marketplace_actors NO tiene org_id → settlement usa org_id = NULL
--   - _mkt_supplier_member_check usa trade_marketplace_actor_members.activo
--   - trade_org_members usa columna activo (columna active no existe — bug corregido)
--   - Todas las RPCs: immutable_at fijado en creación (snapshot congelado)
--   - NO generación automática por triggers — solo RPCs explícitas
--
-- SNAPSHOTS (allowlist explícita — NO to_jsonb(row.*)):
--   Los snapshots usan jsonb_build_object con campos explícitos para evitar
--   que columnas futuras o sensibles entren automáticamente en documentos.
--   Campos excluidos por clase C: commission_*, sim_commission_*, external_*,
--   psp_fee_estimated, gmv_*, created_by, approved_by, correlation_id,
--   idempotency_key, commissionable_*, precio_unitario_lista_snapshot,
--   ledger_entry_id, notes en settlements, metadata en settlements.
--
-- GATES: LEGAL_GATE=OPEN · TAX_GATE=OPEN · STRIPE_GATE=OPEN
-- NO PDF · NO frontend · NO Stripe · NO payouts · NO transfers
-- COM bloqueada por TAX_GATE — sin generador activo
-- COMMISSION real = 0% — source of truth: Settlement Engine (MP-FIN-2F)
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. mkt_fin_generate_purchase_summary(p_master_order_id uuid) RETURNS uuid
--
-- Genera un documento purchase_summary para un master_order.
--
-- master_order existe = checkout_cart_v2 completó la transacción:
--   - carrito validado (proveedores activos, items con actor seleccionado)
--   - supplier orders creadas con snapshot financiero
--   - totales agregados calculados y escritos
--   - cart.estado = 'ordered'
--   - mkt_fin_create_master_order() retornó la fila
--   La existencia del registro es suficiente; no se necesita precondición adicional.
--   (payment_status puede ser 'unpaid' en modo simulación — es el estado canónico)
--
-- doc_number: reutiliza master_order.numero (MKP-YYYY-NNNN).
--   Ventaja: sin consumo adicional de secuencia MKP; referencia compartida.
--   Riesgo de colisión doc_number manejado con excepción defensiva.
--
-- Autorización: miembro de la org compradora (trade_org_members.activo = true)
--               O admin de plataforma (_mkt_is_platform_admin).
-- Snapshot: allowlist explícita de master_order + supplier_orders + items en metadata.
-- immutable_at: fijado en creación — el documento queda congelado.
-- ─────────────────────────────────────────────────────────────────────────

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
  -- 1. Cargar master order
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

  -- 2. Autorización: miembro de la org compradora o admin de plataforma
  IF NOT (
    public._mkt_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.trade_org_members
       WHERE org_id  = v_org_id
         AND user_id = auth.uid()
         AND activo  = true
    )
  ) THEN
    RAISE EXCEPTION 'GEN_PS: no autorizado para master_order %.', p_master_order_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 3. Idempotencia: devolver doc_id si ya fue generado
  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE master_order_id = p_master_order_id
     AND document_subtype = 'purchase_summary';

  IF FOUND THEN RETURN v_doc_id; END IF;

  -- 4. Snapshot de metadata — allowlist explícita (NO to_jsonb(row.*))
  --    Campos C excluidos: gmv_*, external_payment_intent_id, external_provider,
  --    psp_fee_estimated, checkout_key, cart_id, guest_customer_id, payment_status
  SELECT jsonb_build_object(
    'master_order', jsonb_build_object(
      'id',                        mo.id,
      'numero',                    mo.numero,
      'org_id',                    mo.org_id,
      'buyer_snapshot',            mo.buyer_snapshot,
      'delivery_address_snapshot', mo.delivery_address_snapshot,
      'order_status',              mo.order_status,
      'goods_net_total',           mo.goods_net_total,
      'goods_tax_total',           mo.goods_tax_total,
      'goods_gross_total',         mo.goods_gross_total,
      'shipping_net_total',        mo.shipping_net_total,
      'shipping_tax_total',        mo.shipping_tax_total,
      'shipping_gross_total',      mo.shipping_gross_total,
      'checkout_gross_total',      mo.checkout_gross_total,
      'currency',                  mo.currency,
      'confirmed_at',              mo.confirmed_at,
      'created_at',                mo.created_at
    ),
    'supplier_orders', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'order', jsonb_build_object(
            'id',                      so.id,
            'actor_id',                so.actor_id,
            'numero',                  so.numero,
            'estado',                  so.estado,
            'goods_gross_snapshot',    so.goods_gross_snapshot,
            'shipping_gross_snapshot', so.shipping_gross_snapshot,
            'tax_rate_snapshot',       so.tax_rate_snapshot,
            'currency',                so.currency,
            'delivery_method',         so.delivery_method,
            'confirmed_at',            so.confirmed_at,
            'created_at',              so.created_at
          ),
          'items', (
            SELECT jsonb_agg(jsonb_build_object(
              'id',                            oi.id,
              'referencia',                    oi.referencia,
              'descripcion',                   oi.descripcion,
              'unidad',                        oi.unidad,
              'cantidad',                      oi.cantidad,
              'precio_unitario',               oi.precio_unitario,
              'precio_unitario_neto_snapshot', oi.precio_unitario_neto_snapshot,
              'descuento_tipo_snapshot',       oi.descuento_tipo_snapshot,
              'descuento_importe_snapshot',    oi.descuento_importe_snapshot,
              'tax_rate_snapshot',             oi.tax_rate_snapshot,
              'item_net_snapshot',             oi.item_net_snapshot,
              'item_tax_snapshot',             oi.item_tax_snapshot,
              'item_gross_snapshot',           oi.item_gross_snapshot,
              'currency',                      oi.currency
            ))
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

  -- 5. Insertar documento
  --    doc_number = master_order.numero: mismo identificador MKP como referencia cruzada.
  --    SECURITY DEFINER: corre como postgres — puede INSERT en trade_financial_documents.
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
      v_numero,                    -- MKP-YYYY-NNNN (master_order.numero)
      'MKP',
      'commercial_summary',
      'purchase_summary',
      'marketplace',
      'installer_company',
      v_org_id,
      NULL,                        -- buyer: sin actor_id
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
      v_net,           -- subtotal = net (sin IVA separado)
      v_net,           -- net_amount
      0::numeric,      -- tax_rate = 0 (multi-tipo, no hay valor único)
      v_tax,
      COALESCE(v_total, v_net + v_tax),
      v_currency,
      now(),           -- issued_at
      now(),           -- immutable_at — snapshot congelado desde creación
      v_metadata
    )
    RETURNING id INTO v_doc_id;

  EXCEPTION WHEN unique_violation THEN
    -- Condición de carrera: otra llamada concurrente ganó la inserción
    SELECT id INTO v_doc_id
      FROM public.trade_financial_documents
     WHERE master_order_id = p_master_order_id
       AND document_subtype = 'purchase_summary';

    IF v_doc_id IS NULL THEN
      -- Colisión en doc_number con otro tipo de documento — no debería ocurrir
      RAISE EXCEPTION
        'GEN_PS: colisión de doc_number % para master_order %. '
        'El número ya existe en otro tipo de documento.',
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
  'Autorización: miembro de la org compradora (trade_org_members.activo = true) o admin. '
  'immutable_at fijado en creación — snapshot congelado. '
  'Snapshot con allowlist explícita — sin to_jsonb(row.*). '
  'LEGAL_GATE OPEN. TAX_GATE OPEN. STRIPE_GATE OPEN. '
  'Compatible con c0a875f: next_financial_doc_number no se invoca para MKP.';


-- ─────────────────────────────────────────────────────────────────────────
-- 2. mkt_fin_generate_supplier_statement(p_supplier_order_id uuid) RETURNS uuid
--
-- Genera un documento supplier_statement para un supplier_order (trade_marketplace_orders).
--
-- Precondición: financial_snapshot_at IS NOT NULL (snapshot tomado por el sistema).
-- doc_number: next_financial_doc_number('SUP') — invocado como postgres (SECURITY DEFINER).
--   authenticated no tiene EXECUTE; la RPC hace el trabajo server-side.
--
-- Autorización: miembro del actor proveedor (_mkt_supplier_member_check)
--               O admin de plataforma.
-- Snapshot: allowlist explícita de supplier_order + items en metadata.
--   Campos C excluidos: commission_*, sim_commission_*, external_payment_id,
--   external_transfer_id, external_provider, notas_proveedor, payment_status,
--   checkout_key, cart_id, provider_payable_snapshot, buyer_snapshot,
--   guest_email, guest_customer_id.
-- ─────────────────────────────────────────────────────────────────────────

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
  -- 1. Cargar supplier order
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

  -- 2. Precondición: snapshot financiero tomado
  IF v_snap_at IS NULL THEN
    RAISE EXCEPTION
      'GEN_SS: supplier_order % sin snapshot financiero (financial_snapshot_at IS NULL). '
      'El pedido debe ser procesado antes de generar el extracto.',
      p_supplier_order_id
      USING ERRCODE = 'P0003';
  END IF;

  -- 3. Autorización: miembro del actor proveedor o admin
  --    _mkt_supplier_member_check usa trade_marketplace_actor_members.activo
  IF NOT (
    public._mkt_is_platform_admin()
    OR public._mkt_supplier_member_check(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'GEN_SS: no autorizado para supplier_order % (actor %).',
      p_supplier_order_id, v_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Idempotencia
  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE supplier_order_id = p_supplier_order_id
     AND document_subtype  = 'supplier_statement';

  IF FOUND THEN RETURN v_doc_id; END IF;

  -- 5. Calcular importes netos desde snapshot bruto
  --    net = gross / (1 + tax_rate/100) — preserva los importes del snapshot
  IF v_tax_rate > 0 THEN
    v_net := ROUND(v_gross / (1 + v_tax_rate / 100), 2);
  ELSE
    v_net := v_gross;
  END IF;
  v_tax := ROUND(v_gross - v_net, 2);

  -- 6. Nombre del actor proveedor (campo 'nombre', NOT NULL en trade_marketplace_actors)
  SELECT COALESCE(NULLIF(a.nombre, ''), 'Proveedor')
    INTO v_actor_nombre
    FROM public.trade_marketplace_actors a
   WHERE a.id = v_actor_id;

  v_actor_nombre := COALESCE(v_actor_nombre, 'Proveedor');

  -- 7. Snapshot de metadata — allowlist explícita (NO to_jsonb(row.*))
  --    El proveedor ve su pedido; commission_* excluido (margen interno de plataforma)
  SELECT jsonb_build_object(
    'supplier_order', jsonb_build_object(
      'id',                      so.id,
      'actor_id',                so.actor_id,
      'org_id',                  so.org_id,
      'numero',                  so.numero,
      'estado',                  so.estado,
      'notas',                   so.notas,
      'goods_net_snapshot',      so.goods_net_snapshot,
      'goods_tax_snapshot',      so.goods_tax_snapshot,
      'goods_gross_snapshot',    so.goods_gross_snapshot,
      'shipping_net_snapshot',   so.shipping_net_snapshot,
      'shipping_tax_snapshot',   so.shipping_tax_snapshot,
      'shipping_gross_snapshot', so.shipping_gross_snapshot,
      'tax_rate_snapshot',       so.tax_rate_snapshot,
      'currency',                so.currency,
      'delivery_method',         so.delivery_method,
      'financial_snapshot_at',   so.financial_snapshot_at,
      'confirmed_at',            so.confirmed_at,
      'created_at',              so.created_at
    ),
    'items', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',                            oi.id,
        'referencia',                    oi.referencia,
        'descripcion',                   oi.descripcion,
        'unidad',                        oi.unidad,
        'cantidad',                      oi.cantidad,
        'precio_unitario',               oi.precio_unitario,
        'precio_unitario_neto_snapshot', oi.precio_unitario_neto_snapshot,
        'descuento_tipo_snapshot',       oi.descuento_tipo_snapshot,
        'descuento_importe_snapshot',    oi.descuento_importe_snapshot,
        'tax_rate_snapshot',             oi.tax_rate_snapshot,
        'item_net_snapshot',             oi.item_net_snapshot,
        'item_tax_snapshot',             oi.item_tax_snapshot,
        'item_gross_snapshot',           oi.item_gross_snapshot,
        'currency',                      oi.currency
      ))
      FROM public.trade_marketplace_order_items oi
      WHERE oi.order_id = p_supplier_order_id
    ),
    'generated_at', now()
  ) INTO v_metadata
  FROM public.trade_marketplace_orders so
  WHERE so.id = p_supplier_order_id;

  -- 8. Número de documento SUP
  --    SECURITY DEFINER → corre como postgres → postgres tiene EXECUTE ✓ (c0a875f)
  v_doc_number := public.next_financial_doc_number('SUP');

  -- 9. Insertar documento
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
      v_buyer_org_id,       -- org del comprador (referencia cruzada)
      v_actor_id,           -- actor proveedor (source of authority)
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
      now(),                -- immutable_at — snapshot congelado
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
  'immutable_at fijado en creación. '
  'Snapshot con allowlist explícita — commission_* excluido (margen interno de plataforma). '
  'LEGAL_GATE OPEN. TAX_GATE OPEN.';


-- ─────────────────────────────────────────────────────────────────────────
-- 3. mkt_fin_generate_settlement_statement(p_settlement_id uuid) RETURNS uuid
--
-- Genera un documento settlement_statement para una liquidación.
--
-- Precondición: settlement.status != 'draft' (debe estar calculada).
-- doc_number: next_financial_doc_number('LIQ') — invocado como postgres.
--
-- NO RECALCULA — usa importes congelados del Settlement Engine (MP-FIN-2F).
-- simulation_only = true registrado en metadata (STRIPE_GATE OPEN).
-- commission_amount = 0 en snapshot (COMMISSION_GATE: comisión real = 0%).
--
-- Autorización: miembro del actor proveedor (_mkt_supplier_member_check)
--               O admin de plataforma.
--
-- NOTA: trade_marketplace_actors NO tiene org_id → org_id = NULL en el documento.
--
-- Snapshot: allowlist explícita de settlement + lines en metadata.
--   Campos C excluidos: created_by, approved_by, correlation_id, idempotency_key,
--   external_provider, external_id, notes, metadata, settlement_ledger_entry_id,
--   opening_*, available_amount_at_calc, reserved_amount_at_calc,
--   negative_amount_at_calc, simulated_paid_at, closed_at, cancelled_at.
-- ─────────────────────────────────────────────────────────────────────────

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
  -- 1. Cargar settlement
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

  -- 2. Precondición: estado calculado (no borrador)
  IF v_status = 'draft' THEN
    RAISE EXCEPTION
      'GEN_LIQ: settlement % está en estado ''draft''. '
      'Solo se puede generar cuando status != ''draft'' '
      '(calculated, approved, payable, simulated_paid, closed).',
      p_settlement_id
      USING ERRCODE = 'P0003';
  END IF;

  -- 3. Autorización: miembro del actor proveedor o admin
  IF NOT (
    public._mkt_is_platform_admin()
    OR public._mkt_supplier_member_check(v_actor_id)
  ) THEN
    RAISE EXCEPTION 'GEN_LIQ: no autorizado para settlement % (actor %).',
      p_settlement_id, v_actor_id
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Idempotencia
  SELECT id INTO v_doc_id
    FROM public.trade_financial_documents
   WHERE settlement_id    = p_settlement_id
     AND document_subtype = 'settlement_statement';

  IF FOUND THEN RETURN v_doc_id; END IF;

  -- 5. Nombre del actor proveedor
  SELECT COALESCE(NULLIF(a.nombre, ''), 'Proveedor')
    INTO v_actor_nombre
    FROM public.trade_marketplace_actors a
   WHERE a.id = v_actor_id;

  v_actor_nombre := COALESCE(v_actor_nombre, 'Proveedor');

  -- 6. Snapshot de metadata — allowlist explícita (NO to_jsonb(row.*))
  --    commission_amount incluido: es el desglose de plataforma que el proveedor
  --    necesita para reconciliar la liquidación. created_by/approved_by excluidos.
  SELECT jsonb_build_object(
    'settlement', jsonb_build_object(
      'id',                         s.id,
      'settlement_number',          s.settlement_number,
      'provider_actor_id',          s.provider_actor_id,
      'currency',                   s.currency,
      'period_start',               s.period_start,
      'period_end',                 s.period_end,
      'status',                     s.status,
      'sales_amount',               s.sales_amount,
      'shipping_amount',            s.shipping_amount,
      'refund_amount',              s.refund_amount,
      'chargeback_amount',          s.chargeback_amount,
      'chargeback_reversal_amount', s.chargeback_reversal_amount,
      'recovery_amount',            s.recovery_amount,
      'reserve_amount',             s.reserve_amount,
      'reserve_release_amount',     s.reserve_release_amount,
      'commission_amount',          s.commission_amount,
      'commission_tax_amount',      s.commission_tax_amount,
      'adjustment_amount',          s.adjustment_amount,
      'gross_activity',             s.gross_activity,
      'net_activity',               s.net_activity,
      'max_payable',                s.max_payable,
      'settlement_amount',          s.settlement_amount,
      'simulation_only',            s.simulation_only,
      'calculated_at',              s.calculated_at,
      'approved_at',                s.approved_at,
      'created_at',                 s.created_at
    ),
    'settlement_lines', (
      SELECT jsonb_agg(jsonb_build_object(
        'id',               sl.id,
        'settlement_id',    sl.settlement_id,
        'supplier_order_id', sl.supplier_order_id,
        'master_order_id',  sl.master_order_id,
        'entry_type',       sl.entry_type,
        'gross_amount',     sl.gross_amount,
        'currency',         sl.currency,
        'included_amount',  sl.included_amount,
        'line_status',      sl.line_status,
        'created_at',       sl.created_at
      ))
      FROM public.trade_marketplace_settlement_lines sl
      WHERE sl.settlement_id = p_settlement_id
    ),
    'simulation_only', v_sim_only,
    'generated_at', now()
  ) INTO v_metadata
  FROM public.trade_marketplace_settlements s
  WHERE s.id = p_settlement_id;

  -- 7. Número de documento LIQ — SECURITY DEFINER: corre como postgres ✓
  v_doc_number := public.next_financial_doc_number('LIQ');

  -- 8. Insertar documento
  --    org_id = NULL: trade_marketplace_actors no tiene org_id (arquitectura actores)
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
      NULL,               -- actors no tienen org_id en trade_marketplace_actors
      v_actor_id,
      p_settlement_id,
      'Liquidación de ventas marketplace - ' || v_settle_number,
      v_actor_nombre,
      v_period_start,
      v_period_end,
      v_settle_amt,       -- subtotal = settlement_amount (source: Settlement Engine)
      v_settle_amt,       -- net_amount
      0::numeric,         -- TAX_GATE OPEN: sin IVA real
      0::numeric,         -- tax_amount = 0 (COMMISSION real = 0%)
      v_settle_amt,       -- total_amount
      v_currency,
      now(),
      now(),              -- immutable_at — snapshot congelado
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
  'Snapshot con allowlist explícita — created_by/approved_by/external_* excluidos. '
  'simulation_only registrado en metadata. '
  'LEGAL_GATE OPEN. TAX_GATE OPEN. STRIPE_GATE OPEN. COMMISSION_GATE OPEN (0% real).';


-- ─────────────────────────────────────────────────────────────────────────
-- Grants — patrón estándar MP-FIN compatible con c0a875f
--
-- REVOKE EXECUTE FROM PUBLIC: PostgreSQL lo concede por defecto al crear funciones.
-- GRANT EXECUTE TO authenticated: el cliente invoca la RPC con su JWT.
-- La RPC valida ownership server-side y genera doc_number como postgres.
-- authenticated NUNCA obtiene EXECUTE sobre next_financial_doc_number.
-- trade_doc_number_seq NUNCA es accesible directamente.
-- ─────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_purchase_summary(uuid)    FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_purchase_summary(uuid)    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_supplier_statement(uuid)  FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_supplier_statement(uuid)  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mkt_fin_generate_settlement_statement(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mkt_fin_generate_settlement_statement(uuid) TO authenticated;

COMMIT;
