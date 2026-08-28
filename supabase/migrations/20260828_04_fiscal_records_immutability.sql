-- ============================================================
-- VF-GAP-LEDGER-IMMUTABILITY
-- trade_fiscal_records: inmutabilidad por enforcement de BD
-- Cierra deuda técnica del commit d653a98.
-- ============================================================

-- ── 1. Trigger BEFORE UPDATE OR DELETE ──────────────────────
-- Aplica a TODOS los roles, incluyendo postgres y service_role.
-- El único bypass legítimo es DISABLE TRIGGER (requiere superuser).
-- No hay excepciones por estado: el ledger es append-only sin condiciones.

CREATE OR REPLACE FUNCTION public.fn_protect_fiscal_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION
      'Los registros fiscales son inmutables y no pueden modificarse. '
      'Una corrección requiere un nuevo registro fiscal (anulación). (id: %)', OLD.id
      USING ERRCODE = 'P0001';
  END IF;
  -- TG_OP = 'DELETE'
  RAISE EXCEPTION
    'Los registros fiscales son inmutables y no pueden eliminarse. (id: %)', OLD.id
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_fiscal_record ON public.trade_fiscal_records;
CREATE TRIGGER trg_protect_fiscal_record
  BEFORE UPDATE OR DELETE ON public.trade_fiscal_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_fiscal_record();

-- ── 2. Revocar INSERT, UPDATE, DELETE de authenticated ──────
-- INSERT solo puede producirse vía RPC fiscal con SECURITY DEFINER.
-- authenticated solo conserva SELECT (filtrado además por RLS).
REVOKE INSERT, UPDATE, DELETE ON public.trade_fiscal_records FROM authenticated;

-- service_role conserva todos sus privilegios (operaciones admin).
-- Los triggers bloquean modificaciones accidentales incluso desde service_role.

-- ── 3. RLS: policy ALL → SELECT-only para authenticated ────
-- La policy anterior (cmd=ALL) incluía INSERT/UPDATE/DELETE implícitamente.
DROP POLICY IF EXISTS "org_own_fiscal_records" ON public.trade_fiscal_records;

CREATE POLICY "fiscal_records_select_own_org"
  ON public.trade_fiscal_records
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
    UNION
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
  ));

-- ── 4. fn_emitir_factura: añadir verificación auth.uid() ────
-- Impide emitir facturas de otra organización aunque el caller
-- conozca p_org_id y p_invoice_id de otra org.
-- Si auth.uid() IS NULL (service_role / contexto admin sin JWT)
-- se omite la verificación para no bloquear usos admin legítimos.
CREATE OR REPLACE FUNCTION public.fn_emitir_factura(
  p_invoice_id  uuid,
  p_org_id      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv             record;
  v_org             record;
  v_prev            record;
  v_year            int;
  v_count           int;
  v_numero          text;
  v_generated_at    timestamptz;
  v_local_ts        timestamp;
  v_utc_ts          timestamp;
  v_offset_minutes  int;
  v_offset_str      text;
  v_gen_str         text;
  v_fecha_vf        text;
  v_hash_input      text;
  v_hash            text;
  v_tipo_vf         text;
  v_cuota_iva       numeric(14,2);
  v_total           numeric(14,2);
  v_fiscal_id       uuid;
BEGIN
  -- ── 0. Verificar pertenencia del caller a la org ──────────
  -- Bloquea intentos de emitir facturas de otra organización.
  -- Se omite cuando auth.uid() IS NULL (service_role sin JWT).
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations
        WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members
        WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION
        'Acceso no autorizado: el usuario no pertenece a la organización.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- ── 1. Advisory lock por org ──────────────────────────────
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  -- ── 2. Leer factura con FOR UPDATE ───────────────────────
  SELECT * INTO v_inv
  FROM public.trade_invoices
  WHERE id = p_invoice_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada (id: %)', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.estado != 'Borrador' THEN
    RAISE EXCEPTION 'La factura debe estar en estado Borrador (estado actual: %)', v_inv.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Bloquear rectificativas sin clasificación R ───────
  IF v_inv.tipo_factura = 'rectificativa' THEN
    RAISE EXCEPTION
      'Emisión bloqueada: las facturas rectificativas requieren clasificación R1-R5 según la Orden HAC/1177/2024.'
      USING ERRCODE = 'P0001';
  END IF;

  v_tipo_vf := 'F1';

  -- ── 4. Validar snapshot fiscal del cliente ────────────────
  IF v_inv.razon_social_cliente IS NULL OR trim(v_inv.razon_social_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: nombre / razón social del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.nif_cliente IS NULL OR trim(v_inv.nif_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: NIF / DNI / CIF del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.direccion_cliente IS NULL OR trim(v_inv.direccion_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: dirección del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.cp_cliente IS NULL OR trim(v_inv.cp_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: código postal del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.localidad_cliente IS NULL OR trim(v_inv.localidad_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: localidad del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.provincia_cliente IS NULL OR trim(v_inv.provincia_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: provincia del cliente' USING ERRCODE = 'P0001';
  END IF;

  -- ── 5. Cargar organización ────────────────────────────────
  SELECT nif, COALESCE(timezone, 'Europe/Madrid') AS timezone
  INTO v_org
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF v_org.nif IS NULL OR trim(v_org.nif) = '' THEN
    RAISE EXCEPTION 'La organización no tiene NIF configurado.' USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Número definitivo (dentro del advisory lock) ──────
  v_year := EXTRACT(YEAR FROM NOW())::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id
    AND serie = v_inv.serie
    AND estado != 'Borrador';
  v_numero := v_inv.serie || '-' || v_year || '-' || lpad((v_count + 1)::text, 4, '0');

  -- ── 7. Timestamp DST-aware ────────────────────────────────
  v_generated_at   := NOW();
  v_local_ts       := v_generated_at AT TIME ZONE v_org.timezone;
  v_utc_ts         := v_generated_at AT TIME ZONE 'UTC';
  v_offset_minutes := round(EXTRACT(EPOCH FROM (v_local_ts - v_utc_ts)) / 60)::int;

  IF v_offset_minutes >= 0 THEN
    v_offset_str := '+' || lpad((v_offset_minutes / 60)::text, 2, '0')
                  || ':' || lpad((v_offset_minutes % 60)::text, 2, '0');
  ELSE
    v_offset_str := '-' || lpad(((-v_offset_minutes) / 60)::text, 2, '0')
                  || ':' || lpad(((-v_offset_minutes) % 60)::text, 2, '0');
  END IF;

  v_gen_str  := to_char(v_local_ts, 'YYYY-MM-DD"T"HH24:MI:SS') || v_offset_str;
  v_fecha_vf := to_char(v_local_ts, 'DD-MM-YYYY');

  -- ── 8. Registro anterior — cadena única por org ───────────
  SELECT id, numero_factura, hash, generated_at
  INTO v_prev
  FROM public.trade_fiscal_records
  WHERE org_id = p_org_id
  ORDER BY generated_at DESC
  LIMIT 1;

  -- ── 9. Validación monotonía del encadenamiento ────────────
  IF v_prev.id IS NOT NULL AND v_prev.generated_at > v_generated_at THEN
    RAISE EXCEPTION
      'El último registro fiscal (%) tiene fecha posterior al momento de emisión. Verifique la sincronización del servidor.',
      v_prev.numero_factura
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 10. Importes ──────────────────────────────────────────
  v_cuota_iva := round(COALESCE(v_inv.iva_importe,
    v_inv.subtotal * v_inv.iva_pct / 100.0), 2);
  v_total     := round(COALESCE(v_inv.total,
    v_inv.subtotal + v_inv.subtotal * v_inv.iva_pct / 100.0), 2);

  -- ── 11. Hash input — formato oficial AEAT v0.1.2 ─────────
  -- campo=valor& — PrimerRegistro: Huella= vacío (no "0")
  v_hash_input :=
      'IDEmisorFactura='            || trim(v_org.nif)
    || '&NumSerieFactura='          || v_numero
    || '&FechaExpedicionFactura='   || v_fecha_vf
    || '&TipoFactura='              || v_tipo_vf
    || '&CuotaTotal='               || to_char(v_cuota_iva, 'FM999999999990.00')
    || '&ImporteTotal='             || to_char(v_total,     'FM999999999990.00')
    || '&Huella='                   || COALESCE(v_prev.hash, '')
    || '&FechaHoraHusoGenRegistro=' || v_gen_str;

  -- ── 12. SHA-256 ───────────────────────────────────────────
  v_hash := upper(encode(
    extensions.digest(convert_to(v_hash_input, 'UTF8'), 'sha256'),
    'hex'
  ));

  -- ── 13. Insertar en ledger fiscal ────────────────────────
  INSERT INTO public.trade_fiscal_records (
    org_id, invoice_id, record_type,
    nif_emisor,
    numero_factura, serie_factura, tipo_factura_vf,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    previous_record_id, previous_numero, previous_hash,
    hash, hash_input,
    generated_at, generated_at_str, timezone_used
  ) VALUES (
    p_org_id, p_invoice_id, 'alta',
    trim(v_org.nif),
    v_numero, v_inv.serie, v_tipo_vf,
    v_local_ts::date, v_fecha_vf,
    v_cuota_iva, v_total,
    v_prev.id, v_prev.numero_factura,
    CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.hash END,
    v_hash, v_hash_input,
    v_generated_at, v_gen_str, v_org.timezone
  )
  RETURNING id INTO v_fiscal_id;

  -- ── 14. Actualizar factura a Emitida ─────────────────────
  UPDATE public.trade_invoices SET
    estado                  = 'Emitida',
    numero                  = v_numero,
    fecha                   = v_local_ts::date,
    fecha_emision           = v_generated_at,
    fecha_vencimiento       = (v_generated_at + INTERVAL '30 days')::date,
    verifactu_hash          = v_hash,
    verifactu_hash_anterior = CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.hash END,
    verifactu_generated_at  = v_generated_at,
    fiscal_record_id        = v_fiscal_id
  WHERE id = p_invoice_id;

  -- ── 15. Devolver resultado ────────────────────────────────
  RETURN jsonb_build_object(
    'invoice_id',          p_invoice_id,
    'fiscal_record_id',    v_fiscal_id,
    'numero',              v_numero,
    'fecha_emision',       v_gen_str,
    'verifactu_hash',      v_hash,
    'is_primer_registro',  (v_prev.id IS NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO authenticated;
