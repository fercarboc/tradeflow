
-- Fix: remove iva_importe and total from fiscal field check.
-- These are GENERATED ALWAYS columns; PostgreSQL recomputes them in the BEFORE
-- trigger's NEW row and the precision may differ from the stored value, causing
-- false positives (e.g. blocking Emitida→Pagada transitions).
-- Their inputs (subtotal, iva_pct) are already protected, so removing these two
-- checks does not weaken immutability.
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
     (NEW.org_id                  IS DISTINCT FROM OLD.org_id)                  OR
     (NEW.client_id               IS DISTINCT FROM OLD.client_id)               OR
     (NEW.quote_id                IS DISTINCT FROM OLD.quote_id)                OR
     (NEW.job_id                  IS DISTINCT FROM OLD.job_id)                  OR
     (NEW.contract_id             IS DISTINCT FROM OLD.contract_id)             OR
     (NEW.rectifica_factura_id    IS DISTINCT FROM OLD.rectifica_factura_id)    OR
     (NEW.motivo_rectificacion    IS DISTINCT FROM OLD.motivo_rectificacion)    OR
     (NEW.verifactu_hash          IS DISTINCT FROM OLD.verifactu_hash)          OR
     (NEW.verifactu_hash_anterior IS DISTINCT FROM OLD.verifactu_hash_anterior) OR
     (NEW.verifactu_generated_at  IS DISTINCT FROM OLD.verifactu_generated_at)
  THEN
    RAISE EXCEPTION
      'Campo fiscal protegido: no se pueden alterar datos de una factura emitida (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;
;
