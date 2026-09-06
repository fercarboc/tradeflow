-- M1: trade_client_locations + UNIQUE barriers
-- PH0-MAINT-CLIENT-LOCATIONS-IMPL-1

-- ── Prerequisito: UNIQUE(org_id, id) en trade_clients ──────────────────────────
-- Permite la composite FK desde locations → clients (org_id, id).
-- id ya es PK globalmente único; (org_id, id) es superkey natural. Sin efecto operativo.
ALTER TABLE public.trade_clients
  ADD CONSTRAINT trade_clients_org_id_id_key UNIQUE (org_id, id);

-- ── Tabla de ubicaciones de servicio ───────────────────────────────────────────
CREATE TABLE public.trade_client_locations (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  client_id  uuid        NOT NULL,
  nombre     text        NOT NULL,
  direccion  text,
  ciudad     text,
  cp         text,
  provincia  text,
  pais       text        NOT NULL DEFAULT 'ES',
  notas      text,
  activa     boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite FK: garantiza que client_id pertenece al mismo org_id
  CONSTRAINT fk_location_org_client
    FOREIGN KEY (org_id, client_id)
    REFERENCES public.trade_clients(org_id, id)
    ON DELETE RESTRICT,

  -- Superkey para composite FK desde presupuestos/contratos
  CONSTRAINT trade_client_locations_org_client_id_key
    UNIQUE (org_id, client_id, id)
);

CREATE INDEX trade_client_locations_org_client_idx
  ON public.trade_client_locations (org_id, client_id);

CREATE INDEX trade_client_locations_org_activa_idx
  ON public.trade_client_locations (org_id)
  WHERE activa = true;

-- ── RLS ────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trade_client_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loc_all" ON public.trade_client_locations
  FOR ALL
  USING  (org_id = ANY (public._user_org_ids()))
  WITH CHECK (org_id = ANY (public._user_org_ids()));

-- ── Barreras de referencia únicas que faltaban ─────────────────────────────────
-- Previene dos contratos con la misma referencia en la misma org.
-- NULL excluido (legacy compatible).
CREATE UNIQUE INDEX trade_contracts_org_referencia_uidx
  ON public.trade_contracts (org_id, referencia)
  WHERE referencia IS NOT NULL;

-- Previene dos contratos de mantenimiento con el mismo número en la misma org.
-- NULL excluido (legacy 1047165e compatible).
CREATE UNIQUE INDEX trade_maintenance_contratos_org_numero_uidx
  ON public.trade_maintenance_contratos (org_id, numero)
  WHERE numero IS NOT NULL;
