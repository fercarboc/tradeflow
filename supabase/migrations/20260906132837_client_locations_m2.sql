-- M2: location_id nullable + composite FK en presupuestos y contratos (ADITIVO)
-- PH0-MAINT-CLIENT-LOCATIONS-IMPL-1
--
-- Las FK actuales client_id → trade_clients(id) NO se modifican.
-- Se añade composite FK (org_id, client_id, location_id) → trade_client_locations
-- que garantiza org+client+location coherente cuando los tres son NOT NULL.
-- PostgreSQL: si cualquier columna de la FK es NULL, el constraint no se verifica
-- → legacy NULL sigue siendo válido automáticamente.

-- ── Presupuestos ───────────────────────────────────────────────────────────────
ALTER TABLE public.trade_maintenance_presupuestos
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.trade_maintenance_presupuestos
  ADD CONSTRAINT fk_presup_org_client_location
    FOREIGN KEY (org_id, client_id, location_id)
    REFERENCES public.trade_client_locations(org_id, client_id, id)
    ON DELETE RESTRICT;

-- ── Contratos ──────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_maintenance_contratos
  ADD COLUMN IF NOT EXISTS location_id uuid;

ALTER TABLE public.trade_maintenance_contratos
  ADD CONSTRAINT fk_contrato_org_client_location
    FOREIGN KEY (org_id, client_id, location_id)
    REFERENCES public.trade_client_locations(org_id, client_id, id)
    ON DELETE RESTRICT;
