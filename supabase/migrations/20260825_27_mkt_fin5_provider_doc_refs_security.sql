-- ════════════════════════════════════════════════════════════════════════════
-- MP-FIN-5A.1 SECURITY FIX — trade_marketplace_provider_doc_refs
--
-- VULNERABILIDAD CORREGIDA:
--   La policy FOR ALL del proveedor verificaba únicamente que actor_id
--   perteneciera al usuario autenticado (_mkt_actor_ids_for_user()).
--   NO verificaba que supplier_order_id perteneciera también a ese actor_id.
--   Un usuario del Actor B podría intentar:
--     supplier_order_id = pedido del Actor A
--     actor_id          = actor_B
--   superando el WITH CHECK sin relación real con el pedido.
--
-- SOLUCIÓN:
--   A) RPC SECURITY DEFINER mkt_fin_register_provider_doc_ref.
--      El cliente aporta solo los datos que puede conocer legítimamente.
--      actor_id y buyer_org_id se derivan del supplier order en el servidor.
--      auth.uid() → _mkt_actor_ids_for_user() verifica pertenencia al actor real.
--
--   B) INSERT/UPDATE directos revocados de authenticated.
--      Toda escritura canalizada por la RPC.
--
--   C) Policy de proveedor: FOR ALL → FOR SELECT.
--      El proveedor solo puede leer sus propias refs por RLS.
--      La creación requiere la RPC.
--
-- INVARIANTES MANTENIDOS:
--   Múltiples refs por supplier_order (sin UNIQUE constraint).
--   buyer_org_id = NULL para guest checkout (no acceso público vía IS NOT NULL).
--   TAX_GATE OPEN: sin validación fiscal del documento referenciado.
--   LEGAL_GATE OPEN: las refs son informativas, no emitidas por TrabFlow.
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 1: Actualizar policy de proveedor — FOR ALL → FOR SELECT
--
-- El proveedor puede leer sus propias refs.
-- La escritura requiere pasar por mkt_fin_register_provider_doc_ref.
-- ─────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS provider_doc_refs_provider_all
  ON public.trade_marketplace_provider_doc_refs;

DROP POLICY IF EXISTS provider_doc_refs_provider_select
  ON public.trade_marketplace_provider_doc_refs;

CREATE POLICY provider_doc_refs_provider_select
  ON public.trade_marketplace_provider_doc_refs
  FOR SELECT TO authenticated
  USING (actor_id = ANY(public._mkt_actor_ids_for_user()));

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 2: RPC SECURITY DEFINER — registro seguro de provider_doc_refs
--
-- PARÁMETROS QUE RECIBE (datos que el proveedor puede aportar):
--   p_supplier_order_id   — el pedido al que se vincula la ref
--   p_doc_type            — tipo de documento (invoice, credit_note, etc.)
--   p_doc_number_provider — número asignado por el proveedor en sus sistemas
--   p_doc_date_provider   — fecha del documento según el proveedor
--   p_doc_amount          — importe (opcional — puede omitirse)
--   p_doc_currency        — moneda (por defecto EUR)
--   p_notes               — notas operativas libres
--
-- PARÁMETROS QUE NO RECIBE (derivados server-side):
--   actor_id    → trade_marketplace_orders.actor_id (fuente de autoridad)
--   buyer_org_id→ trade_marketplace_orders.org_id   (fuente de autoridad)
--   registered_by → auth.uid()
--
-- LÓGICA:
--   1. SELECT actor_id, org_id FROM trade_marketplace_orders WHERE id = p_supplier_order_id
--   2. EXCEPTION si el pedido no existe
--   3. EXCEPTION si auth.uid() no pertenece al actor del pedido
--      (via _mkt_actor_ids_for_user() — SECURITY DEFINER, tamper-proof)
--   4. INSERT con actor_id y buyer_org_id derivados del servidor
-- ─────────────────────────────────────────────────────────────────────────

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
  -- 1. Obtener actor_id y buyer_org_id del pedido (fuente de verdad, no del cliente)
  SELECT actor_id, org_id
    INTO v_actor_id, v_buyer_org_id
    FROM public.trade_marketplace_orders
   WHERE id = p_supplier_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: supplier_order_id % no encontrado.',
      p_supplier_order_id;
  END IF;

  -- 2. Verificar que auth.uid() pertenece al actor del pedido
  --    _mkt_actor_ids_for_user() es SECURITY DEFINER — no manipulable desde cliente
  IF NOT (v_actor_id = ANY(public._mkt_actor_ids_for_user())) THEN
    RAISE EXCEPTION
      'PROVIDER_DOC_REF: no autorizado. '
      'El pedido % pertenece al actor %, '
      'que no es accesible para el usuario actual.',
      p_supplier_order_id, v_actor_id;
  END IF;

  -- 3. Insertar con actor_id y buyer_org_id derivados del servidor
  INSERT INTO public.trade_marketplace_provider_doc_refs (
    supplier_order_id,
    actor_id,        -- derivado del pedido; el cliente no lo aporta
    buyer_org_id,    -- derivado del pedido; NULL para guest checkout
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
  'Registro seguro de referencias documentales del proveedor. '
  'SECURITY DEFINER: actor_id y buyer_org_id se derivan del supplier order '
  'en el servidor — el cliente no puede aportar ni falsificar estos valores. '
  'auth.uid() verificado contra _mkt_actor_ids_for_user() (también SECURITY DEFINER). '
  'INSERT/UPDATE directos revocados de authenticated; toda escritura pasa aquí. '
  'TAX_GATE OPEN: no valida corrección fiscal del documento externo. '
  'LEGAL_GATE OPEN: registra referencia informativa, no emite documento.';

-- ─────────────────────────────────────────────────────────────────────────
-- PARTE 3: Grants actualizados
--
-- Antes: GRANT SELECT, INSERT, UPDATE TO authenticated
-- Ahora: GRANT SELECT TO authenticated (INSERT/UPDATE solo via RPC)
-- ─────────────────────────────────────────────────────────────────────────

-- Revocar INSERT/UPDATE/DELETE directos — las refs son registros históricos
-- Toda escritura se canaliza por la RPC SECURITY DEFINER
REVOKE INSERT, UPDATE, DELETE ON public.trade_marketplace_provider_doc_refs FROM authenticated;

-- SELECT disponible (filtrado por RLS: actor propio, buyer_org propio, admin)
GRANT SELECT ON public.trade_marketplace_provider_doc_refs TO authenticated;

-- REVOKE EXECUTE de PUBLIC (PostgreSQL lo concede a PUBLIC por defecto al crear funciones)
-- Defense-in-depth: aunque auth.uid()=NULL triggea EXCEPTION igualmente, mejor no exponer la firma
REVOKE EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref FROM PUBLIC;

-- Solo authenticated puede invocar la RPC
GRANT EXECUTE ON FUNCTION public.mkt_fin_register_provider_doc_ref TO authenticated;

COMMIT;
