-- ============================================================
-- FASE 3: verifactu_generated_at
-- Timestamp exacto de generación del registro fiscal.
-- Nullable para compatibilidad con registros históricos.
-- Toda nueva emisión via emitirFactura() debe poblarlo.
-- ============================================================
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS verifactu_generated_at timestamptz;

-- ============================================================
-- FASE 7: Inmutabilidad de facturas emitidas
-- ============================================================

-- ── 1. BEFORE UPDATE en trade_invoices ─────────────────────
-- Allowlist de campos mutables post-emisión:
--   estado (no puede volver a Borrador), paid_at, metodo_pago,
--   fecha_vencimiento, notas_internas, devuelta_at, devuelta_motivo,
--   updated_at (gestionado por trigger existente).
-- Todo lo demás es campo fiscal protegido.

CREATE OR REPLACE FUNCTION public.fn_protect_emitted_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mientras sea Borrador, todo puede cambiar (edición en curso).
  IF OLD.estado = 'Borrador' THEN
    RETURN NEW;
  END IF;

  -- No se puede revertir a Borrador.
  IF NEW.estado = 'Borrador' THEN
    RAISE EXCEPTION
      'No se puede revertir a Borrador una factura ya emitida (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  -- Verificar campos fiscales protegidos.
  IF (NEW.numero                 IS DISTINCT FROM OLD.numero)                 OR
     (NEW.serie                  IS DISTINCT FROM OLD.serie)                  OR
     (NEW.fecha                  IS DISTINCT FROM OLD.fecha)                  OR
     (NEW.fecha_emision          IS DISTINCT FROM OLD.fecha_emision)          OR
     (NEW.subtotal               IS DISTINCT FROM OLD.subtotal)               OR
     (NEW.iva_pct                IS DISTINCT FROM OLD.iva_pct)                OR
     (NEW.iva_importe            IS DISTINCT FROM OLD.iva_importe)            OR
     (NEW.total                  IS DISTINCT FROM OLD.total)                  OR
     (NEW.tipo_factura           IS DISTINCT FROM OLD.tipo_factura)           OR
     (NEW.razon_social_cliente   IS DISTINCT FROM OLD.razon_social_cliente)   OR
     (NEW.nif_cliente            IS DISTINCT FROM OLD.nif_cliente)            OR
     (NEW.direccion_cliente      IS DISTINCT FROM OLD.direccion_cliente)      OR
     (NEW.org_id                 IS DISTINCT FROM OLD.org_id)                 OR
     (NEW.client_id              IS DISTINCT FROM OLD.client_id)              OR
     (NEW.quote_id               IS DISTINCT FROM OLD.quote_id)               OR
     (NEW.job_id                 IS DISTINCT FROM OLD.job_id)                 OR
     (NEW.contract_id            IS DISTINCT FROM OLD.contract_id)            OR
     (NEW.rectifica_factura_id   IS DISTINCT FROM OLD.rectifica_factura_id)   OR
     (NEW.motivo_rectificacion   IS DISTINCT FROM OLD.motivo_rectificacion)   OR
     (NEW.verifactu_hash         IS DISTINCT FROM OLD.verifactu_hash)         OR
     (NEW.verifactu_hash_anterior IS DISTINCT FROM OLD.verifactu_hash_anterior) OR
     (NEW.verifactu_generated_at IS DISTINCT FROM OLD.verifactu_generated_at)
  THEN
    RAISE EXCEPTION
      'Campo fiscal protegido: no se pueden alterar datos de una factura emitida (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_emitted_invoice ON public.trade_invoices;
CREATE TRIGGER trg_protect_emitted_invoice
  BEFORE UPDATE ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_emitted_invoice();

-- ── 2. BEFORE DELETE en trade_invoices ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_protect_emitted_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.estado != 'Borrador' THEN
    RAISE EXCEPTION
      'No se puede eliminar una factura que no esté en estado Borrador (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_emitted_invoice_delete ON public.trade_invoices;
CREATE TRIGGER trg_protect_emitted_invoice_delete
  BEFORE DELETE ON public.trade_invoices
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_emitted_invoice_delete();

-- ── 3. BEFORE INSERT OR UPDATE OR DELETE en trade_invoice_lines ─
-- Bloquea toda modificación de líneas si la factura padre no es Borrador.
CREATE OR REPLACE FUNCTION public.fn_protect_emitted_invoice_lines()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado   text;
  v_factura_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_factura_id := OLD.factura_id;
  ELSE
    v_factura_id := NEW.factura_id;
  END IF;

  SELECT estado INTO v_estado
  FROM public.trade_invoices
  WHERE id = v_factura_id;

  IF v_estado IS DISTINCT FROM 'Borrador' THEN
    RAISE EXCEPTION
      'No se pueden modificar líneas de una factura que no esté en Borrador (factura_id: %)', v_factura_id
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_emitted_invoice_lines ON public.trade_invoice_lines;
CREATE TRIGGER trg_protect_emitted_invoice_lines
  BEFORE INSERT OR UPDATE OR DELETE ON public.trade_invoice_lines
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_emitted_invoice_lines();
