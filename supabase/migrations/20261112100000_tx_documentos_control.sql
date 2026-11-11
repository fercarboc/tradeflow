-- ══════════════════════════════════════════════════════════════════════
-- TX-DOCS-1 — Documentos de control administrativo en transporte
--   · DeCA de mercancías  (Orden FOM/2861/2012, art. 6)
--   · Hoja de ruta de viajeros (Orden FOM/1230/2013, art. 2)
--   · Requisitos electrónicos: Resolución DGTCF de 5-jun-2026
--     (BOE-A-2026-12784): PDF ≤ 5 MB, QR con URL única HTTPS,
--     fecha/hora de creación y modificación, descarga directa sin login,
--     conservación ≥ 1 año, modificación = nuevo PDF conservando el original.
--
-- Diseño:
--   · Los datos se guardan como SNAPSHOT (inmutable) en el momento de emisión.
--   · Toda escritura pasa por la Edge Function trade-transport-doc
--     (service_role). Los usuarios autenticados solo pueden LEER su org.
--   · Modificar = emitir documento nuevo con sustituye_a = id anterior
--     (el anterior pasa a estado 'sustituido' y se conserva).
--   · Migración puramente aditiva.
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. NIF del conductor (obligatorio en la hoja de ruta de viajeros) ──
ALTER TABLE public.trade_workers
  ADD COLUMN IF NOT EXISTS nif text;

-- ── 2. Contadores de numeración por org / tipo / año ───────────────────
CREATE TABLE IF NOT EXISTS public.trade_transport_doc_counters (
  org_id  uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  tipo    text NOT NULL CHECK (tipo IN ('deca','hoja_ruta')),
  anio    int  NOT NULL,
  ultimo  int  NOT NULL DEFAULT 0,
  PRIMARY KEY (org_id, tipo, anio)
);

ALTER TABLE public.trade_transport_doc_counters ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo service_role / SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.tx_doc_next_number(p_org_id uuid, p_tipo text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_anio int := extract(year FROM (now() AT TIME ZONE 'Europe/Madrid'))::int;
  v_n    int;
BEGIN
  INSERT INTO trade_transport_doc_counters (org_id, tipo, anio, ultimo)
  VALUES (p_org_id, p_tipo, v_anio, 1)
  ON CONFLICT (org_id, tipo, anio)
  DO UPDATE SET ultimo = trade_transport_doc_counters.ultimo + 1
  RETURNING ultimo INTO v_n;

  RETURN (CASE p_tipo WHEN 'deca' THEN 'DECA' ELSE 'HR' END)
         || '-' || v_anio || '-' || lpad(v_n::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.tx_doc_next_number(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tx_doc_next_number(uuid, text) TO service_role;

-- ── 3. Tabla principal ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_transport_control_docs (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  tipo                  text        NOT NULL CHECK (tipo IN ('deca','hoja_ruta')),
  numero                text        NOT NULL,
  estado                text        NOT NULL DEFAULT 'vigente'
                                    CHECK (estado IN ('vigente','sustituido','anulado')),

  -- Token de la URL pública (≥ 128 bits de entropía, generado en servidor)
  public_token          text        NOT NULL UNIQUE CHECK (char_length(public_token) >= 32),

  -- Vínculos opcionales con entidades operativas (no afectan al snapshot)
  service_id            uuid,       -- trade_transport_services (viajeros)
  trip_id               uuid,       -- trade_transport_trips   (mercancías)
  vehicle_id            uuid,
  conductor_id          uuid,
  client_id             uuid,

  -- Transportista efectivo / empresa transportista (siempre la org emisora)
  transportista_nombre    text      NOT NULL,
  transportista_nif       text      NOT NULL,
  transportista_domicilio text,

  -- Cargador contractual (DeCA) / contratante del servicio (hoja de ruta)
  cargador_nombre       text        NOT NULL,
  cargador_nif          text,
  cargador_domicilio    text,

  -- Ruta
  origen                text        NOT NULL,
  destino               text        NOT NULL,
  paradas               jsonb       NOT NULL DEFAULT '[]'::jsonb
                                    CHECK (jsonb_typeof(paradas) = 'array'),

  -- Fechas del servicio (zona Europe/Madrid en presentación)
  fecha_servicio        date        NOT NULL,
  hora_salida           time,
  fecha_fin             timestamptz,           -- regreso/fin (viajeros, opcional)

  -- Mercancías
  naturaleza_mercancia  text,
  peso_kg               numeric(12,2) CHECK (peso_kg IS NULL OR peso_kg >= 0),
  otra_magnitud         text,                  -- si el peso es de difícil determinación
  autorizacion_especial text,                  -- art. 6.e
  matricula_remolque    text,

  -- Vehículo y conductor
  matricula_vehiculo    text        NOT NULL,
  conductor_nombre      text,
  conductor_nif         text,

  -- Viajeros: naturaleza del servicio (art. 2.1 Orden FOM/1230/2013)
  naturaleza_servicio   text        CHECK (naturaleza_servicio IS NULL OR naturaleza_servicio IN (
                                      'discrecional','refuerzo_regular',
                                      'colaboracion_regular_especial','turistico')),
  servicio_referencia   text,                  -- identifica la línea / transporte al que se refuerza o colabora

  observaciones         text,

  -- Modificaciones (método 2 de la Resolución: PDF nuevo, original conservado)
  sustituye_a           uuid        REFERENCES public.trade_transport_control_docs(id) ON DELETE SET NULL,
  motivo_modificacion   text,
  anulado_at            timestamptz,
  motivo_anulacion      text,

  -- Fichero
  pdf_path              text,
  pdf_sha256            text,
  pdf_bytes             int,

  -- Disponibilidad del enlace público (fin de servicio + 7 días naturales)
  public_hasta          timestamptz NOT NULL,

  created_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (org_id, numero),

  CONSTRAINT ttcd_deca_campos CHECK (
    tipo <> 'deca' OR (
      naturaleza_mercancia IS NOT NULL
      AND (peso_kg IS NOT NULL OR otra_magnitud IS NOT NULL)
      AND cargador_nif IS NOT NULL
      AND cargador_domicilio IS NOT NULL
    )
  ),
  CONSTRAINT ttcd_hoja_ruta_campos CHECK (
    tipo <> 'hoja_ruta' OR (
      naturaleza_servicio IS NOT NULL
      AND conductor_nombre IS NOT NULL
      AND conductor_nif IS NOT NULL
      AND cargador_nif IS NOT NULL
    )
  ),
  CONSTRAINT ttcd_pdf_path_scoped CHECK (
    pdf_path IS NULL OR split_part(pdf_path, '/', 1) = org_id::text
  )
);

CREATE INDEX IF NOT EXISTS idx_ttcd_org_fecha   ON public.trade_transport_control_docs(org_id, fecha_servicio DESC);
CREATE INDEX IF NOT EXISTS idx_ttcd_org_tipo    ON public.trade_transport_control_docs(org_id, tipo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ttcd_service     ON public.trade_transport_control_docs(service_id) WHERE service_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ttcd_trip        ON public.trade_transport_control_docs(trip_id)    WHERE trip_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ttcd_sustituye   ON public.trade_transport_control_docs(sustituye_a) WHERE sustituye_a IS NOT NULL;

CREATE OR REPLACE TRIGGER trg_ttcd_updated
  BEFORE UPDATE ON public.trade_transport_control_docs
  FOR EACH ROW EXECUTE FUNCTION public.trade_set_updated_at();

-- ── 4. Inmutabilidad del contenido ─────────────────────────────────────
-- Una vez emitido, solo pueden cambiar: estado, anulación, datos del PDF
-- (que se rellenan justo tras la emisión) y updated_at.
CREATE OR REPLACE FUNCTION public._ttcd_inmutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.org_id, NEW.tipo, NEW.numero, NEW.public_token,
      NEW.transportista_nombre, NEW.transportista_nif, NEW.transportista_domicilio,
      NEW.cargador_nombre, NEW.cargador_nif, NEW.cargador_domicilio,
      NEW.origen, NEW.destino, NEW.paradas, NEW.fecha_servicio, NEW.hora_salida, NEW.fecha_fin,
      NEW.naturaleza_mercancia, NEW.peso_kg, NEW.otra_magnitud, NEW.autorizacion_especial,
      NEW.matricula_remolque, NEW.matricula_vehiculo, NEW.conductor_nombre, NEW.conductor_nif,
      NEW.naturaleza_servicio, NEW.servicio_referencia, NEW.observaciones,
      NEW.sustituye_a, NEW.motivo_modificacion, NEW.created_at, NEW.created_by)
     IS DISTINCT FROM
     (OLD.org_id, OLD.tipo, OLD.numero, OLD.public_token,
      OLD.transportista_nombre, OLD.transportista_nif, OLD.transportista_domicilio,
      OLD.cargador_nombre, OLD.cargador_nif, OLD.cargador_domicilio,
      OLD.origen, OLD.destino, OLD.paradas, OLD.fecha_servicio, OLD.hora_salida, OLD.fecha_fin,
      OLD.naturaleza_mercancia, OLD.peso_kg, OLD.otra_magnitud, OLD.autorizacion_especial,
      OLD.matricula_remolque, OLD.matricula_vehiculo, OLD.conductor_nombre, OLD.conductor_nif,
      OLD.naturaleza_servicio, OLD.servicio_referencia, OLD.observaciones,
      OLD.sustituye_a, OLD.motivo_modificacion, OLD.created_at, OLD.created_by)
  THEN
    RAISE EXCEPTION 'TX_DOC_INMUTABLE: el contenido de un documento de control emitido no se puede modificar; emita uno nuevo que lo sustituya';
  END IF;

  -- El PDF solo se escribe una vez
  IF OLD.pdf_path IS NOT NULL AND NEW.pdf_path IS DISTINCT FROM OLD.pdf_path THEN
    RAISE EXCEPTION 'TX_DOC_INMUTABLE: el PDF de un documento emitido no se puede reemplazar';
  END IF;

  -- Estados terminales
  IF OLD.estado IN ('sustituido','anulado') AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'TX_DOC_ESTADO: un documento % no puede cambiar de estado', OLD.estado;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ttcd_inmutable ON public.trade_transport_control_docs;
CREATE TRIGGER trg_ttcd_inmutable
  BEFORE UPDATE ON public.trade_transport_control_docs
  FOR EACH ROW EXECUTE FUNCTION public._ttcd_inmutable();

-- Sin borrado: conservación obligatoria ≥ 1 año
CREATE OR REPLACE FUNCTION public._ttcd_no_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.created_at > now() - interval '13 months' THEN
    RAISE EXCEPTION 'TX_DOC_CONSERVACION: los documentos de control deben conservarse al menos un año';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_ttcd_no_delete ON public.trade_transport_control_docs;
CREATE TRIGGER trg_ttcd_no_delete
  BEFORE DELETE ON public.trade_transport_control_docs
  FOR EACH ROW EXECUTE FUNCTION public._ttcd_no_delete();

-- ── 5. RLS: solo lectura para miembros de la org ───────────────────────
ALTER TABLE public.trade_transport_control_docs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ttcd_select" ON public.trade_transport_control_docs;
CREATE POLICY "ttcd_select" ON public.trade_transport_control_docs
  FOR SELECT TO authenticated
  USING (
    org_id = ANY(public._user_org_ids())
    OR org_id IN (SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid())
  );
-- INSERT / UPDATE / DELETE: sin políticas → solo service_role (Edge Function).

-- ── 6. Storage privado para los PDF ────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transport-control-docs', 'transport-control-docs', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "transport_control_docs_read" ON storage.objects;
CREATE POLICY "transport_control_docs_read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'transport-control-docs'
  AND (
    (storage.foldername(name))[1] IN (SELECT unnest(public._user_org_ids())::text)
    OR (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.trade_organizations WHERE owner_id = auth.uid()
    )
  )
);
-- Escritura en el bucket: solo service_role.

COMMENT ON TABLE public.trade_transport_control_docs IS
  'DeCA (mercancías, Orden FOM/2861/2012) y hojas de ruta (viajeros, Orden FOM/1230/2013) en formato electrónico según Resolución DGTCF 5-jun-2026. Snapshot inmutable; escritura solo vía Edge Function trade-transport-doc.';
