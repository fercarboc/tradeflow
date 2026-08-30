-- E4.C.3.3.1 — Migration 4: Fix chk_booking_origen + tighten RLS INSERT
ALTER TABLE public.trade_marketplace_ad_bookings
  DROP CONSTRAINT IF EXISTS chk_booking_origen;

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD CONSTRAINT chk_booking_origen CHECK (
    origen = ANY(ARRAY['admin'::text, 'portal_request'::text, 'portal_supplier'::text])
  );

DROP POLICY IF EXISTS ad_bookings_supplier_insert ON public.trade_marketplace_ad_bookings;

CREATE POLICY ad_bookings_supplier_insert
  ON public.trade_marketplace_ad_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    public._is_actor_member(actor_id)
    AND estado = 'REQUESTED'
    AND origen = 'portal_supplier'
  );;
