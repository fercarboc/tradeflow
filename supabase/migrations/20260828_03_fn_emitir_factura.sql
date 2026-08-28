-- ============================================================
-- ÁREA B: fn_emitir_factura — emisión fiscal atómica VeriFactu
-- Reemplaza la lógica de emisión del frontend.
-- Requisitos: pgcrypto (disponible), trade_fiscal_records existente.
-- ============================================================

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
  v_prev            record;   -- último registro en la cadena
  v_year            int;
  v_count           int;
  v_numero          text;
  v_generated_at    timestamptz;
  v_local_ts        timestamp;  -- hora local en timezone de la org
  v_utc_ts          timestamp;
  v_offset_minutes  int;
  v_offset_str      text;
  v_gen_str         text;       -- ISO 8601 con offset exacto (usado en hash)
  v_fecha_vf        text;       -- DD-MM-YYYY (para el hash)
  v_hash_input      text;
  v_hash            text;
  v_tipo_vf         text;
  v_cuota_iva       numeric(14,2);
  v_total           numeric(14,2);
  v_fiscal_id       uuid;
BEGIN
  -- ── 1. Advisory lock por org ──────────────────────────────
  -- Serializa todas las emisiones del mismo instalador.
  -- No bloquea emisiones de otras organizaciones.
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

  -- ── 3. Bloquear emisión de rectificativas sin tipo R ─────
  IF v_inv.tipo_factura = 'rectificativa' THEN
    RAISE EXCEPTION
      'Emisión bloqueada: las facturas rectificativas requieren clasificación R1-R5 '
      'según la Orden HAC/1177/2024. Completa la clasificación antes de emitir.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 4. Determinar TipoFactura VeriFactu (L2) ─────────────
  -- Todas las facturas completas de TrabFlow son F1.
  -- F2 (simplificada) no se usa en este sistema.
  v_tipo_vf := 'F1';

  -- ── 5. Validar snapshot fiscal del cliente ────────────────
  IF v_inv.razon_social_cliente IS NULL OR trim(v_inv.razon_social_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: nombre / razón social del cliente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.nif_cliente IS NULL OR trim(v_inv.nif_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: NIF / DNI / CIF del cliente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.direccion_cliente IS NULL OR trim(v_inv.direccion_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: dirección del cliente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.cp_cliente IS NULL OR trim(v_inv.cp_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: código postal del cliente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.localidad_cliente IS NULL OR trim(v_inv.localidad_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: localidad del cliente'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.provincia_cliente IS NULL OR trim(v_inv.provincia_cliente) = '' THEN
    RAISE EXCEPTION 'Faltan datos fiscales: provincia del cliente'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 6. Cargar organización (NIF + timezone) ───────────────
  SELECT nif, COALESCE(timezone, 'Europe/Madrid') AS timezone
  INTO v_org
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF v_org.nif IS NULL OR trim(v_org.nif) = '' THEN
    RAISE EXCEPTION 'La organización no tiene NIF configurado. Completa tus datos fiscales.'
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 7. Número definitivo (atómico dentro del advisory lock) ──
  v_year := EXTRACT(YEAR FROM NOW())::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id
    AND serie = v_inv.serie
    AND estado != 'Borrador';
  v_numero := v_inv.serie || '-' || v_year || '-' || lpad((v_count + 1)::text, 4, '0');

  -- ── 8. Timestamp de generación ────────────────────────────
  -- Una sola instancia. Misma para hash y para persistencia.
  v_generated_at := NOW();

  -- Convertir al timezone de la org para obtener hora local + offset DST automático
  v_local_ts := v_generated_at AT TIME ZONE v_org.timezone;
  v_utc_ts   := v_generated_at AT TIME ZONE 'UTC';
  -- Offset en minutos enteros (maneja DST automáticamente)
  v_offset_minutes := round(EXTRACT(EPOCH FROM (v_local_ts - v_utc_ts)) / 60)::int;
  IF v_offset_minutes >= 0 THEN
    v_offset_str := '+' || lpad((v_offset_minutes / 60)::text, 2, '0')
                  || ':' || lpad((v_offset_minutes % 60)::text, 2, '0');
  ELSE
    v_offset_str := '-' || lpad(((-v_offset_minutes) / 60)::text, 2, '0')
                  || ':' || lpad(((-v_offset_minutes) % 60)::text, 2, '0');
  END IF;
  -- Formato ISO 8601 exacto: YYYY-MM-DDTHH:MM:SS±HH:MM
  v_gen_str  := to_char(v_local_ts, 'YYYY-MM-DD"T"HH24:MI:SS') || v_offset_str;
  -- Fecha en formato VeriFactu: DD-MM-YYYY (basada en hora local de la org)
  v_fecha_vf := to_char(v_local_ts, 'DD-MM-YYYY');

  -- ── 9. Registro anterior — cadena única por org ───────────
  -- La cadena no está particionada por serie (F/M/R).
  -- Un único eslabón por obligado tributario (org_id).
  SELECT id, numero_factura, hash, generated_at
  INTO v_prev
  FROM public.trade_fiscal_records
  WHERE org_id = p_org_id
  ORDER BY generated_at DESC
  LIMIT 1;

  -- ── 10. Validación normativa del encadenamiento ───────────
  -- La norma exige monotonía estricta en los timestamps de la cadena.
  -- El registro anterior no puede tener fecha posterior al momento actual.
  IF v_prev.id IS NOT NULL AND v_prev.generated_at > v_generated_at THEN
    RAISE EXCEPTION
      'El último registro fiscal (%) tiene una fecha/hora posterior al momento de emisión. '
      'Compruebe la sincronización del reloj del servidor.',
      v_prev.numero_factura
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 11. Importes (redondeados a 2 decimales para el hash) ─
  v_cuota_iva := round(COALESCE(v_inv.iva_importe,
    v_inv.subtotal * v_inv.iva_pct / 100.0), 2);
  v_total     := round(COALESCE(v_inv.total,
    v_inv.subtotal + v_inv.subtotal * v_inv.iva_pct / 100.0), 2);

  -- ── 12. Hash input — formato oficial AEAT (v0.1.2, 27/08/2024) ──
  -- Fuente: "Detalle de las especificaciones técnicas para generación
  --          de la huella o hash de los registros de facturación" §3a + §6
  -- Formato: campo=valor&campo=valor (NO separadores ';')
  -- PrimerRegistro: Huella= vacío (NO '0', NO omitir el campo)
  -- Nombres de campo: exactamente los del XSD (IDEmisorFactura, NumSerieFactura, etc.)
  v_hash_input :=
      'IDEmisorFactura='            || trim(v_org.nif)
    || '&NumSerieFactura='          || v_numero
    || '&FechaExpedicionFactura='   || v_fecha_vf
    || '&TipoFactura='              || v_tipo_vf
    || '&CuotaTotal='               || to_char(v_cuota_iva, 'FM999999999990.00')
    || '&ImporteTotal='             || to_char(v_total,     'FM999999999990.00')
    || '&Huella='                   || COALESCE(v_prev.hash, '')
    || '&FechaHoraHusoGenRegistro=' || v_gen_str;

  -- ── 13. Calcular SHA-256 (pgcrypto en schema extensions) ─
  v_hash := upper(encode(
    extensions.digest(convert_to(v_hash_input, 'UTF8'), 'sha256'),
    'hex'
  ));

  -- ── 14. Insertar en trade_fiscal_records ─────────────────
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

  -- ── 15. Actualizar factura a Emitida ─────────────────────
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

  -- ── 16. Devolver datos al frontend ───────────────────────
  RETURN jsonb_build_object(
    'invoice_id',      p_invoice_id,
    'fiscal_record_id', v_fiscal_id,
    'numero',          v_numero,
    'fecha_emision',   v_gen_str,
    'verifactu_hash',  v_hash,
    'is_primer_registro', (v_prev.id IS NULL)
  );
END;
$$;

-- Permisos: solo usuarios autenticados pueden llamar a la RPC
REVOKE ALL ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO authenticated;
