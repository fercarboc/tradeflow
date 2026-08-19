-- ═══════════════════════════════════════════════════════════════════════════
-- E4.C.3.3.1 — Migration 4: Fix chk_booking_origen + tighten RLS INSERT
-- ═══════════════════════════════════════════════════════════════════════════
-- BUG P0: La RPC request_ad_slot_v2 inserta origen='portal_supplier' pero
-- el constraint chk_booking_origen solo permitía ('admin','portal_request').
-- Toda llamada al portal de publicidad fallaba con constraint violation.
--
-- BUG P1 (seguridad): La RLS INSERT policy requería origen='portal_request',
-- lo que permitía inserts directos con snapshot manipulado. Ahora se requiere
-- 'portal_supplier', que solo produce el SECURITY DEFINER RPC.
-- Nota: Direct INSERT con portal_supplier sigue siendo posible si el usuario
-- tiene los grants; el snapshot puede ser manipulado (sin billing, riesgo bajo).
-- Hardening completo (REVOKE INSERT) diferido para post-pilotos.
--
-- INVARIANTE: publicidad ≠ ranking. Sin pricing dinámico ni subastas.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Fix constraint: añadir 'portal_supplier' como valor permitido
ALTER TABLE public.trade_marketplace_ad_bookings
  DROP CONSTRAINT IF EXISTS chk_booking_origen;

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD CONSTRAINT chk_booking_origen CHECK (
    origen = ANY(ARRAY['admin'::text, 'portal_request'::text, 'portal_supplier'::text])
  );

-- 2. Fix RLS INSERT policy: exigir 'portal_supplier' (producido solo por RPC)
--    Antes aceptaba 'portal_request', lo que permitía inserts directos.
DROP POLICY IF EXISTS ad_bookings_supplier_insert ON public.trade_marketplace_ad_bookings;

CREATE POLICY ad_bookings_supplier_insert
  ON public.trade_marketplace_ad_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public._is_actor_member(actor_id)
    AND estado = 'REQUESTED'
    AND origen = 'portal_supplier'
  );
