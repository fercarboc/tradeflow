-- ══════════════════════════════════════════════════════════════════════
-- TX-EXP-1 — Expediciones (cargas) de transporte de mercancías
--   Una expedición = un envío de un cargador: recogida → entrega.
--   Puede ir asignada a un viaje (trade_transport_trips) y generar su DeCA.
--   Migración puramente aditiva.
-- ══════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  ALTER TABLE public.trade_transport_trips ADD CONSTRAINT trade_transport_trips_org_id_id_key UNIQUE (org_id, id);
EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.trade_transport_shipments (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  referencia            text,                          -- nº interno (EXP-AAAA-NNNN)
  trip_id               uuid,
  client_id             uuid,

  -- Cargador (quien contrata) y destinatario
  cargador_nombre       text        NOT NULL,
  cargador_nif          text,
  cargador_domicilio    text,
  destinatario_nombre   text,
  destinatario_telefono text,

  -- Recorrido
  origen                text        NOT NULL,
  destino               text        NOT NULL,
  fecha_recogida        date        NOT NULL,
  hora_recogida         time,

  -- Mercancía
  naturaleza            text        NOT NULL,
  tipo_carga            text        NOT NULL DEFAULT 'carga_general'
                                    CHECK (tipo_carga IN ('paletizado','carga_general','frigorifica','peligrosas','especial','otro')),
  peso_kg               numeric(12,2) CHECK (peso_kg IS NULL OR peso_kg >= 0),
  num_bultos            int         CHECK (num_bultos IS NULL OR num_bultos >= 0),
  volumen_m3            numeric(10,2) CHECK (volumen_m3 IS NULL OR volumen_m3 >= 0),
  referencia_cargador   text,                          -- albarán / pedido del cliente

  -- Estado y trazabilidad
  estado                text        NOT NULL DEFAULT 'pendiente'
                                    CHECK (estado IN ('pendiente','recogida','entregada','incidencia','cancelada')),
  recogida_at           timestamptz,
  entregada_at          timestamptz,
  receptor_nombre       text,
  incidencia            text,
  observaciones         text,

  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT tsh_trip_org_fk   FOREIGN KEY (org_id, trip_id)
    REFERENCES public.trade_transport_trips(org_id, id) ON DELETE SET NULL (trip_id),
  CONSTRAINT tsh_client_org_fk FOREIGN KEY (org_id, client_id)
    REFERENCES public.trade_clients(org_id, id) ON DELETE SET NULL (client_id)
);

CREATE INDEX IF NOT EXISTS idx_tsh_org_fecha ON public.trade_transport_shipments(org_id, fecha_recogida DESC);
CREATE INDEX IF NOT EXISTS idx_tsh_org_estado ON public.trade_transport_shipments(org_id, estado);
CREATE INDEX IF NOT EXISTS idx_tsh_trip ON public.trade_transport_shipments(trip_id) WHERE trip_id IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_tsh_updated BEFORE UPDATE ON public.trade_transport_shipments
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- Referencia automática EXP-AAAA-NNNN por organización y marcas de tiempo de estado
CREATE OR REPLACE FUNCTION public._tsh_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_anio int; v_n int;
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.referencia IS NULL OR btrim(NEW.referencia) = '') THEN
    v_anio := extract(year FROM (now() AT TIME ZONE 'Europe/Madrid'))::int;
    PERFORM pg_advisory_xact_lock(hashtext('tsh_ref_' || NEW.org_id::text || v_anio));
    SELECT count(*) + 1 INTO v_n FROM trade_transport_shipments
      WHERE org_id = NEW.org_id AND referencia LIKE 'EXP-' || v_anio || '-%';
    NEW.referencia := 'EXP-' || v_anio || '-' || lpad(v_n::text, 4, '0');
  END IF;
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(NEW.created_by, auth.uid()); END IF;
  IF NEW.estado = 'recogida'  AND NEW.recogida_at  IS NULL THEN NEW.recogida_at  := now(); END IF;
  IF NEW.estado = 'entregada' AND NEW.entregada_at IS NULL THEN
    NEW.entregada_at := now();
    NEW.recogida_at  := COALESCE(NEW.recogida_at, now());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_tsh_before_write ON public.trade_transport_shipments;
CREATE TRIGGER trg_tsh_before_write BEFORE INSERT OR UPDATE ON public.trade_transport_shipments
  FOR EACH ROW EXECUTE FUNCTION public._tsh_before_write();

-- RLS: cualquier miembro activo de la org (el conductor marca recogidas/entregas)
ALTER TABLE public.trade_transport_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tsh_select" ON public.trade_transport_shipments;
CREATE POLICY "tsh_select" ON public.trade_transport_shipments FOR SELECT TO authenticated
  USING (org_id = ANY(public._user_org_ids()) OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));

DROP POLICY IF EXISTS "tsh_insert" ON public.trade_transport_shipments;
CREATE POLICY "tsh_insert" ON public.trade_transport_shipments FOR INSERT TO authenticated
  WITH CHECK (
    (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
     OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
    AND EXISTS (SELECT 1 FROM public.trade_organizations o WHERE o.id = org_id AND o.transport_enabled)
  );

DROP POLICY IF EXISTS "tsh_update" ON public.trade_transport_shipments;
CREATE POLICY "tsh_update" ON public.trade_transport_shipments FOR UPDATE TO authenticated
  USING (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
         OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()))
  WITH CHECK (org_id IN (SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true)
         OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()));
-- Sin DELETE: se cancela (estado = 'cancelada').

-- Vínculo del DeCA con la expedición (aditivo; no forma parte del contenido inmutable)
ALTER TABLE public.trade_transport_control_docs ADD COLUMN IF NOT EXISTS shipment_id uuid;
CREATE INDEX IF NOT EXISTS idx_ttcd_shipment ON public.trade_transport_control_docs(shipment_id) WHERE shipment_id IS NOT NULL;
