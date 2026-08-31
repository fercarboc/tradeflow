-- ============================================================
-- VF-2-FIX: State machine, Inmutabilidad tipo_factura_vf,
--            Numeración por ejercicio
-- ============================================================
--
-- Fixes:
--   1. fn_protect_emitted_invoice v4
--      · Borrador → estado ∉ {Borrador, Emitida} → BLOQUEA
--        (impide Borrador→Pagada, Borrador→Pendiente, etc.)
--      · tipo_factura_vf añadido a campos fiscales protegidos
--   2. fn_emitir_factura v8
--      · Bug cross-year: COUNT filtra ahora por ejercicio (fecha_emision)
--
-- NO TOCA: datos existentes, hashes, fiscal_records, outbox, kill switch.
-- ============================================================


-- ── 1. fn_protect_emitted_invoice v4 ────────────────────────
--
-- Cambios respecto a v3 (mig 20260828082639):
--   · Bloque Borrador: solo permite NEW.estado IN ('Borrador', 'Emitida')
--     Cualquier otra transición directa (Pagada, Pendiente, Devuelta, ...)
--     queda bloqueada — solo fn_emitir_factura puede emitir.
--   · tipo_factura_vf añadido a la lista de campos fiscales protegidos.
--
CREATE OR REPLACE FUNCTION public.fn_protect_emitted_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Desde Borrador solo se permiten:
  --   · Edición del borrador (NEW.estado = 'Borrador')
  --   · Emisión vía fn_emitir_factura (NEW.estado = 'Emitida')
  -- Cualquier otra transición directa queda bloqueada a nivel BD.
  IF OLD.estado = 'Borrador' THEN
    IF NEW.estado NOT IN ('Borrador', 'Emitida') THEN
      RAISE EXCEPTION
        'Un borrador solo puede pasar a Emitida vía fn_emitir_factura. '
        'Transición Borrador → % no permitida (id: %).',
        NEW.estado, OLD.id
        USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
  END IF;

  -- Revertir a Borrador desde cualquier estado emitido: prohibido.
  IF NEW.estado = 'Borrador' THEN
    RAISE EXCEPTION
      'No se puede revertir a Borrador una factura ya emitida (id: %).',
      OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  -- Campos fiscales inmutables post-emisión.
  -- tipo_factura_vf añadido en v4 (no estaba en versiones anteriores).
  IF (NEW.numero                  IS DISTINCT FROM OLD.numero)                  OR
     (NEW.serie                   IS DISTINCT FROM OLD.serie)                   OR
     (NEW.fecha                   IS DISTINCT FROM OLD.fecha)                   OR
     (NEW.fecha_emision           IS DISTINCT FROM OLD.fecha_emision)           OR
     (NEW.subtotal                IS DISTINCT FROM OLD.subtotal)                OR
     (NEW.iva_pct                 IS DISTINCT FROM OLD.iva_pct)                 OR
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
      'Campo fiscal protegido: no se pueden alterar datos de una factura emitida (id: %).',
      OLD.id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;


-- ── 2. fn_emitir_factura v8 ──────────────────────────────────
--
-- Único cambio funcional respecto a v7 (mig 20260830134544):
--   Paso 6: COUNT filtra por EXTRACT(YEAR FROM fecha_emision) = v_year.
--
-- Criterio de ejercicio: fecha_emision es el sello temporal atómico
-- establecido por esta RPC (SECURITY DEFINER) en el momento de emisión.
-- Está protegido por el trigger fn_protect_emitted_invoice. Es NULL para:
--   · Borradores (no emitidos)
--   · Facturas históricas emitidas antes del sistema VeriFactu
-- Filtrar por EXTRACT(YEAR FROM fecha_emision) = v_year aísla la secuencia
-- por ejercicio sin reclasificar el histórico ni usar COALESCE arbitrario.
--
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

  -- ── 6. Número definitivo — particionado por ejercicio ─────
  -- Criterio de ejercicio: fecha_emision (ver comentario de cabecera).
  v_year := EXTRACT(YEAR FROM NOW())::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id
    AND serie   = v_inv.serie
    AND estado != 'Borrador'
    AND EXTRACT(YEAR FROM fecha_emision) = v_year;  -- v8: partición por ejercicio
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
