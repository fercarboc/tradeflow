-- ============================================================
-- VF-PROD-1: Chain partition — org_id (tenant) + nif_emisor (AEAT-5)
-- ============================================================
--
-- fn_emitir_factura v10
--
-- Único cambio respecto a v9 (mig 20260831204100):
--   · Paso 8: la query de registro anterior filtra por
--     org_id = p_org_id (tenant boundary, sin cambio)
--     AND nif_emisor = trim(v_org.nif) (identidad fiscal, AEAT-5)
--
-- Contexto AEAT-5: cada cadena de encadenamiento debe ser por emisor
-- fiscal, no solo por organización. Una org con cambio de NIF (raro
-- pero posible) generaría dos cadenas independientes — correcto.
-- Para los datos existentes (F-2026-0001, F-2026-0002, nif=13789524N)
-- no hay impacto: la condición adicional es redundante pero no cambia
-- la consulta porque solo hay un NIF emisor en esa org.
--
-- NO TOCA: fn_protect_emitted_invoice, datos existentes, hashes,
-- fiscal_records, outbox, trade_org_members, kill switch.
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
  v_jwt_role        text;
  v_inv             record;
  v_org             record;
  v_orig            record;
  v_prev            record;
  v_org_vf_mode     text;
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
  -- ── 0. Autorización ──────────────────────────────────────
  v_jwt_role := auth.role();

  IF v_jwt_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION
        'Token autenticado sin identidad (sub ausente). Token inválido o expirado.'
        USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations
        WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members
        WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION
        'Acceso no autorizado: el usuario no pertenece a la organización indicada.'
        USING ERRCODE = '42501';
    END IF;

  ELSIF v_jwt_role = 'service_role' OR v_jwt_role IS NULL THEN
    NULL;

  ELSE
    RAISE EXCEPTION
      'No autorizado: el rol "%" no puede emitir facturas.', COALESCE(v_jwt_role, 'unknown')
      USING ERRCODE = '42501';
  END IF;

  -- ── 1. Advisory lock por org ──────────────────────────────
  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  -- ── 2. Leer factura con FOR UPDATE ───────────────────────
  SELECT * INTO v_inv
  FROM public.trade_invoices
  WHERE id = p_invoice_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Factura no encontrada (id: %). Comprueba que pertenece a tu organización.', p_invoice_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.estado != 'Borrador' THEN
    RAISE EXCEPTION
      'La factura debe estar en estado Borrador (estado actual: %)', v_inv.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 3. Determinar TipoFactura VeriFactu ──────────────────
  IF v_inv.tipo_factura = 'rectificativa' THEN

    IF v_inv.serie != 'R' THEN
      RAISE EXCEPTION
        'Una factura rectificativa debe tener serie R (serie actual: %).',
        COALESCE(v_inv.serie, 'NULL')
        USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.rectifica_factura_id IS NULL THEN
      RAISE EXCEPTION
        'La factura rectificativa no tiene referencia a la factura original (rectifica_factura_id es NULL).'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.tipo_factura_vf IS NULL OR
       v_inv.tipo_factura_vf NOT IN ('R1', 'R2', 'R3', 'R4') THEN
      RAISE EXCEPTION
        'La rectificativa requiere clasificación fiscal R1-R4 según la Orden HAC/1177/2024 '
        '(tipo_factura_vf actual: %).',
        COALESCE(v_inv.tipo_factura_vf, 'NULL')
        USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.motivo_rectificacion IS NULL OR trim(v_inv.motivo_rectificacion) = '' THEN
      RAISE EXCEPTION
        'La factura rectificativa requiere motivo de rectificación.'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT id, estado INTO v_orig
    FROM public.trade_invoices
    WHERE id = v_inv.rectifica_factura_id AND org_id = p_org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'La factura original referenciada no existe en esta organización (id: %).',
        v_inv.rectifica_factura_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_orig.estado = 'Borrador' THEN
      RAISE EXCEPTION
        'La factura original no puede estar en estado Borrador.'
        USING ERRCODE = 'P0001';
    END IF;

    v_tipo_vf := v_inv.tipo_factura_vf;

  ELSE
    v_tipo_vf := 'F1';
  END IF;

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

  -- ── 5b. Leer modo VeriFactu de la org ────────────────────
  SELECT verifactu_mode INTO v_org_vf_mode
  FROM public.trade_org_verifactu_config
  WHERE org_id = p_org_id;

  -- ── 6. Timestamp local + ejercicio ───────────────────────
  -- v9: v_local_ts se calcula ANTES de v_year.
  -- v_year deriva del año LOCAL de la organización, no del UTC del servidor.
  -- Esto elimina el bug cross-year: una factura emitida el 31-dic a las 23:30 UTC
  -- (= 01-ene 00:30 en Europe/Madrid) obtiene número del año nuevo (correcto),
  -- no del año que termina en UTC (incorrecto).
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

  -- ── 7. Número definitivo — particionado por ejercicio local ──
  -- v_year = año fiscal en timezone de la org (fuente: v_local_ts).
  -- El COUNT usa el mismo timezone para clasificar facturas anteriores.
  -- fecha_emision NULL (históricas) → NULL AT TIME ZONE → NULL ≠ v_year → excluidas.
  -- fecha_emision de ejercicio anterior → año local anterior ≠ v_year → excluidas.
  v_year := EXTRACT(YEAR FROM v_local_ts)::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id
    AND serie   = v_inv.serie
    AND estado != 'Borrador'
    AND EXTRACT(YEAR FROM (fecha_emision AT TIME ZONE v_org.timezone)) = v_year;
  v_numero := v_inv.serie || '-' || v_year || '-' || lpad((v_count + 1)::text, 4, '0');

  -- ── 8. Registro anterior — cadena por org_id (tenant) + nif_emisor (AEAT-5) ──
  -- Tenant boundary: org_id garantiza aislamiento entre clientes.
  -- Fiscal identity partition: nif_emisor garantiza cadenas independientes
  -- por emisor fiscal (requerimiento AEAT-5 confirmado por email 2026-08-XX).
  SELECT id, numero_factura, hash, generated_at
  INTO v_prev
  FROM public.trade_fiscal_records
  WHERE org_id     = p_org_id
    AND nif_emisor = trim(v_org.nif)
  ORDER BY generated_at DESC
  LIMIT 1;

  -- ── 9. Validación monotonía del encadenamiento ────────────
  IF v_prev.id IS NOT NULL AND v_prev.generated_at > v_generated_at THEN
    RAISE EXCEPTION
      'El último registro fiscal (%) tiene fecha posterior al momento de emisión. '
      'Verifique la sincronización del servidor.',
      v_prev.numero_factura
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 10. Importes ──────────────────────────────────────────
  v_cuota_iva := round(COALESCE(v_inv.iva_importe,
    v_inv.subtotal * v_inv.iva_pct / 100.0), 2);
  v_total     := round(COALESCE(v_inv.total,
    v_inv.subtotal + v_inv.subtotal * v_inv.iva_pct / 100.0), 2);

  -- ── 11. Hash input — formato oficial AEAT v0.1.2 ─────────
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

  -- ── 13b. Outbox — solo org trabflow_verifactu ─────────────
  IF v_org_vf_mode = 'trabflow_verifactu' THEN
    INSERT INTO public.trade_verifactu_outbox (
      fiscal_record_id, org_id, status
    ) VALUES (
      v_fiscal_id, p_org_id, 'pending'
    );
  END IF;

  -- ── 14. Actualizar factura a Emitida ─────────────────────
  -- fn_protect_emitted_invoice v5 dispara aquí y verifica el ledger.
  UPDATE public.trade_invoices SET
    estado                  = 'Emitida',
    numero                  = v_numero,
    fecha                   = v_local_ts::date,
    fecha_emision           = v_generated_at,
    fecha_vencimiento       = (v_generated_at + INTERVAL '30 days')::date,
    verifactu_hash          = v_hash,
    verifactu_hash_anterior = CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.hash END,
    verifactu_generated_at  = v_generated_at,
    fiscal_record_id        = v_fiscal_id,
    tipo_factura_vf         = v_tipo_vf
  WHERE id = p_invoice_id;

  -- ── 15. Devolver resultado ────────────────────────────────
  RETURN jsonb_build_object(
    'invoice_id',            p_invoice_id,
    'fiscal_record_id',      v_fiscal_id,
    'numero',                v_numero,
    'fecha_emision',         v_gen_str,
    'verifactu_hash',        v_hash,
    'tipo_factura_vf',       v_tipo_vf,
    'is_primer_registro',    (v_prev.id IS NULL),
    'outbox_entry_created',  (v_org_vf_mode = 'trabflow_verifactu')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO service_role;
