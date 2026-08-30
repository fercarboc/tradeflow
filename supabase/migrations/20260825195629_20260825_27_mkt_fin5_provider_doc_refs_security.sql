
-- MP-FIN-5A.1 SECURITY FIX — provider_doc_refs
--
-- VULNERABILIDAD: La policy FOR ALL con WITH CHECK (actor_id = ANY(_mkt_actor_ids_for_user()))
-- no verifica que supplier_order_id pertenezca al actor_id del proveedor autenticado.
-- Un proveedor B podría insertar: supplier_order_id = pedido_de_A, actor_id = actor_B
-- y superar el WITH CHECK si actor_B pertenece al usuario.
--
-- SOLUCIÓN: RPC SECURITY DEFINER que deriva actor_id y buyer_org_id del supplier order.
-- El cliente no aporta actor_id ni buyer_org_id — los inyecta el servidor.
-- INSERT/UPDATE directos revocados de authenticated.

-- ─── 1. Actualizar policy de proveedor: SELECT only ───────────────────────
-- El proveedor puede leer sus propias refs vía RLS.
-- Escrituras solo a través de la RPC.

DROP POLICY IF EXISTS provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_provider_select
  ON public.trade_marketplace_provider_doc_refs
  FOR SELECT TO authenticated
  USING (actor_id = ANY(public._mkt_actor_ids_for_user()));

-- ─── 2. RPC SECURITY DEFINER para registro seguro ────────────────────────
-- Recibe solo los datos que el proveedor puede aportar legitimamente.
-- actor_id y buyer_org_id se derivan del pedido en el servidor.

CREATE OR REPLACE FUNCTION public.mkt_fin_register_provider_doc_ref(
  p_supplier_order_id    uuid,
  p_doc_type             text,
  p_doc_number_provider  text,
  p_doc_date_provider    date,
  p_doc_amount           numeric  DEFAULT NULL,
  p_doc_currency         char(3)  DEFAULT 'EUR',
  p_notes                text     DEFAULT NULL
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

  -- 2. Verificar que el usuario autenticado pertenece al actor del pedido
  --    _mkt_actor_ids_for_user() es SECURITY DEFINER — no manipulable desde cliente
  IF NOT (v_actor_id = ANY(public._mkt_actor_ids_for_user())) THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: no autorizado. '
      'El pedido % pertenece al actor %, '
      'que no es accesible para el usuario actual.',
      p_supplier_order_id, v_actor_id;
  END IF;

  -- 3. Validar doc_type (redundante con CHECK, pero explícito para mensajes claros)
  IF p_doc_type NOT IN ('invoice', 'credit_note', 'delivery_note', 'other') THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: doc_type % no válido. '
      'Valores aceptados: invoice, credit_note, delivery_note, other.',
      p_doc_type;
  END IF;

  -- 4. Insertar con actor_id y buyer_org_id derivados del servidor
  --    El cliente no puede manipular estos valores
  INSERT INTO public.trade_marketplace_provider_doc_refs (
    supplier_order_id,
    actor_id,       -- derivado del pedido, no del cliente
    buyer_org_id,   -- derivado del pedido, NULL para guest
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

COMMENT ON FUNCTION public.mkt_fin_register_provider_doc_ref IS
  'RPC segura para registrar una referencia documental del proveedor. '
  'SECURITY DEFINER: actor_id y buyer_org_id se derivan del supplier order '
  'en el servidor — el cliente no los aporta. '
  'Verifica que auth.uid() pertenezca al actor del pedido antes de insertar. '
  'INSERT/UPDATE directos en trade_marketplace_provider_doc_refs revocados '
  'de authenticated; toda escritura pasa por esta función. '
  'TAX_GATE OPEN: no valida corrección fiscal del documento referenciado.';

-- ─── 3. Ajustar grants: revocar INSERT/UPDATE directos ───────────────────
-- INSERT/UPDATE directos quedan revocados.
-- La RPC tiene SECURITY DEFINER y puede insertar sin pasar por RLS.

REVOKE INSERT, UPDATE ON public.trade_marketplace_provider_doc_refs FROM authenticated;

-- SELECT sigue disponible; la RLS filtra por actor o buyer_org
GRANT SELECT ON public.trade_marketplace_provider_doc_refs TO authenticated;

-- Proveedor autenticado puede llamar a la RPC
GRANT EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref TO authenticated;
;
