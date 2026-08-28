-- ============================================================
-- ÁREA A: Campos fiscales en clientes + snapshots en facturas
-- ÁREA B: Timezone en organizaciones + trade_fiscal_records
-- ============================================================

-- ── 1. trade_clients: 3 columnas fiscales nuevas ───────────
ALTER TABLE public.trade_clients
  ADD COLUMN IF NOT EXISTS cp        text,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS pais      text DEFAULT 'España';

-- ── 2. trade_organizations: timezone de facturación ────────
-- Default: Europe/Madrid (península). Canarias usaría Europe/Canary.
ALTER TABLE public.trade_organizations
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Madrid';

-- ── 3. trade_fiscal_records: ledger fiscal append-only ─────
-- Cada fila = un registro fiscal en la cadena VeriFactu.
-- Soporta altas (F1/F2) y anulaciones (futuro) en la misma secuencia.
-- trade_invoices representa el documento; trade_fiscal_records la cadena fiscal.
CREATE TABLE IF NOT EXISTS public.trade_fiscal_records (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.trade_organizations(id),
  invoice_id          uuid        REFERENCES public.trade_invoices(id),
  record_type         text        NOT NULL CHECK (record_type IN ('alta', 'anulacion')),
  -- Identificación del emisor (snapshot inmutable)
  nif_emisor          text        NOT NULL,
  -- Datos del documento fiscal
  numero_factura      text        NOT NULL,
  serie_factura       text,
  tipo_factura_vf     text        NOT NULL,                     -- F1, F2, R1-R5 (L2 VeriFactu)
  fecha_expedicion    date        NOT NULL,
  fecha_expedicion_vf text        NOT NULL,                     -- DD-MM-YYYY (para el hash)
  cuota_iva           numeric(14,2) NOT NULL,
  importe_total       numeric(14,2) NOT NULL,
  -- Registro anterior (encadenamiento) — NULL = PrimerRegistro
  previous_record_id  uuid        REFERENCES public.trade_fiscal_records(id),
  previous_numero     text,                                     -- NULL si PrimerRegistro
  previous_hash       text,                                     -- NULL ≡ "0" en el hash input
  -- Huella de este registro
  hash                text        NOT NULL,                     -- SHA-256 hex uppercase
  hash_input          text        NOT NULL,                     -- cadena exacta hasheada (auditoría)
  -- Timestamp de generación
  generated_at        timestamptz NOT NULL,
  generated_at_str    text        NOT NULL,                     -- ISO 8601 con offset usado en hash
  timezone_used       text        NOT NULL DEFAULT 'Europe/Madrid',
  payload_version     text        NOT NULL DEFAULT '1.0',
  created_at          timestamptz NOT NULL DEFAULT now(),

  -- Prevenir doble alta o doble anulación del mismo documento
  CONSTRAINT uq_fiscal_record_invoice_type UNIQUE (invoice_id, record_type)
);

CREATE INDEX IF NOT EXISTS idx_tfr_org_generated
  ON public.trade_fiscal_records (org_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tfr_invoice
  ON public.trade_fiscal_records (invoice_id);

-- RLS: misma política que trade_invoices (propietario de la org)
ALTER TABLE public.trade_fiscal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_own_fiscal_records" ON public.trade_fiscal_records
  USING (org_id IN (
    SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
    UNION
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (org_id IN (
    SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
    UNION
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
  ));

-- ── 4. trade_invoices: snapshot completo + FK al registro fiscal ──
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS localidad_cliente  text,
  ADD COLUMN IF NOT EXISTS cp_cliente         text,
  ADD COLUMN IF NOT EXISTS provincia_cliente  text,
  ADD COLUMN IF NOT EXISTS pais_cliente       text,
  ADD COLUMN IF NOT EXISTS fiscal_record_id   uuid REFERENCES public.trade_fiscal_records(id);

-- ── 5. Actualizar trigger de protección ────────────────────
-- Incluir los nuevos campos snapshot y fiscal_record_id en los campos protegidos post-emisión.
CREATE OR REPLACE FUNCTION public.fn_protect_emitted_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado = 'Borrador' THEN
    RETURN NEW;
  END IF;

  IF NEW.estado = 'Borrador' THEN
    RAISE EXCEPTION
      'No se puede revertir a Borrador una factura ya emitida (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  IF (NEW.numero                  IS DISTINCT FROM OLD.numero)                  OR
     (NEW.serie                   IS DISTINCT FROM OLD.serie)                   OR
     (NEW.fecha                   IS DISTINCT FROM OLD.fecha)                   OR
     (NEW.fecha_emision           IS DISTINCT FROM OLD.fecha_emision)           OR
     (NEW.subtotal                IS DISTINCT FROM OLD.subtotal)                OR
     (NEW.iva_pct                 IS DISTINCT FROM OLD.iva_pct)                 OR
     (NEW.tipo_factura            IS DISTINCT FROM OLD.tipo_factura)            OR
     (NEW.razon_social_cliente    IS DISTINCT FROM OLD.razon_social_cliente)    OR
     (NEW.nif_cliente             IS DISTINCT FROM OLD.nif_cliente)             OR
     (NEW.direccion_cliente       IS DISTINCT FROM OLD.direccion_cliente)       OR
     (NEW.localidad_cliente       IS DISTINCT FROM OLD.localidad_cliente)       OR
     (NEW.cp_cliente              IS DISTINCT FROM OLD.cp_cliente)              OR
     (NEW.provincia_cliente       IS DISTINCT FROM OLD.provincia_cliente)       OR
     (NEW.pais_cliente            IS DISTINCT FROM OLD.pais_cliente)            OR
     (NEW.org_id                  IS DISTINCT FROM OLD.org_id)                  OR
     (NEW.client_id               IS DISTINCT FROM OLD.client_id)               OR
     (NEW.quote_id                IS DISTINCT FROM OLD.quote_id)                OR
     (NEW.job_id                  IS DISTINCT FROM OLD.job_id)                  OR
     (NEW.contract_id             IS DISTINCT FROM OLD.contract_id)             OR
     (NEW.rectifica_factura_id    IS DISTINCT FROM OLD.rectifica_factura_id)    OR
     (NEW.motivo_rectificacion    IS DISTINCT FROM OLD.motivo_rectificacion)    OR
     (NEW.verifactu_hash          IS DISTINCT FROM OLD.verifactu_hash)          OR
     (NEW.verifactu_hash_anterior IS DISTINCT FROM OLD.verifactu_hash_anterior) OR
     (NEW.verifactu_generated_at  IS DISTINCT FROM OLD.verifactu_generated_at)  OR
     (NEW.fiscal_record_id        IS DISTINCT FROM OLD.fiscal_record_id)
  THEN
    RAISE EXCEPTION
      'Campo fiscal protegido: no se pueden alterar datos de una factura emitida (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
