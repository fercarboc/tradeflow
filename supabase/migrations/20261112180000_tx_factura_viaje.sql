-- ══════════════════════════════════════════════════════════════════════
-- TX-FACT-1 — Facturar viajes de mercancías y servicios de viajeros
--   Vínculo opcional factura ↔ viaje / servicio. La factura se crea en
--   'Borrador' y se emite con el flujo VeriFactu existente (fn_emitir_factura).
--   No se toca numeración, hash ni encadenamiento. Aditiva.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trade_transport_trips(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS transport_service_id uuid REFERENCES public.trade_transport_services(id) ON DELETE SET NULL;

-- Una sola factura (no rectificativa) por viaje y por servicio: evita facturar dos veces
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_invoices_trip
  ON public.trade_invoices(trip_id) WHERE trip_id IS NOT NULL AND rectifica_factura_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_trade_invoices_transport_service
  ON public.trade_invoices(transport_service_id) WHERE transport_service_id IS NOT NULL AND rectifica_factura_id IS NULL;

-- El cliente de un viaje puede quedar vinculado a la ficha de cliente (antes solo texto)
ALTER TABLE public.trade_transport_trips
  ADD COLUMN IF NOT EXISTS client_id uuid;
DO $$ BEGIN
  ALTER TABLE public.trade_transport_trips
    ADD CONSTRAINT ttt_client_org_fk FOREIGN KEY (org_id, client_id)
    REFERENCES public.trade_clients(org_id, id) ON DELETE SET NULL (client_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
