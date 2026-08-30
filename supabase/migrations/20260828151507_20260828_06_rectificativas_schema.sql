-- ============================================================
-- VF-RECTIFICATIVAS-IMPL FASE 1 — Migration 06
-- Añadir tipo_factura_vf a trade_invoices.
-- Actualizar fn_protect_emitted_invoice para cubrir el nuevo campo
-- y restaurar iva_importe/total (dropped accidentally in _02).
-- ============================================================

-- ── 1. Columna tipo_factura_vf en trade_invoices ─────────────
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS tipo_factura_vf text;

ALTER TABLE public.trade_invoices
  DROP CONSTRAINT IF EXISTS trade_invoices_tipo_factura_vf_check;

ALTER TABLE public.trade_invoices
  ADD CONSTRAINT trade_invoices_tipo_factura_vf_check
  CHECK (tipo_factura_vf IS NULL OR tipo_factura_vf IN ('F1','F2','R1','R2','R3','R4','R5'));

-- ── 2. Actualizar fn_protect_emitted_invoice ─────────────────
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
     (NEW.iva_importe             IS DISTINCT FROM OLD.iva_importe)             OR
     (NEW.total                   IS DISTINCT FROM OLD.total)                   OR
     (NEW.tipo_factura            IS DISTINCT FROM OLD.tipo_factura)            OR
     (NEW.tipo_factura_vf         IS DISTINCT FROM OLD.tipo_factura_vf)         OR
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
;
