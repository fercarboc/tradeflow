-- VF-RECTIFICATIVAS-IMPL FASE 1B — Migration 09
-- Campo tipo_rectificativa (I=diferencias, S=sustitución) per Orden HAC/1177/2024.

-- ── 1. trade_invoices ────────────────────────────────────────
ALTER TABLE public.trade_invoices
  ADD COLUMN IF NOT EXISTS tipo_rectificativa text;

ALTER TABLE public.trade_invoices
  DROP CONSTRAINT IF EXISTS trade_invoices_tipo_rectificativa_check;

ALTER TABLE public.trade_invoices
  ADD CONSTRAINT trade_invoices_tipo_rectificativa_check
  CHECK (tipo_rectificativa IS NULL OR tipo_rectificativa IN ('I', 'S'));

-- ── 2. trade_fiscal_records ──────────────────────────────────
ALTER TABLE public.trade_fiscal_records
  ADD COLUMN IF NOT EXISTS tipo_rectificativa text;

ALTER TABLE public.trade_fiscal_records
  DROP CONSTRAINT IF EXISTS trade_fiscal_records_tipo_rectificativa_check;

ALTER TABLE public.trade_fiscal_records
  ADD CONSTRAINT trade_fiscal_records_tipo_rectificativa_check
  CHECK (tipo_rectificativa IS NULL OR tipo_rectificativa IN ('I', 'S'));

-- ── 3. fn_protect_emitted_invoice — añade tipo_rectificativa ─
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
     (NEW.tipo_rectificativa      IS DISTINCT FROM OLD.tipo_rectificativa)      OR
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

-- ── 4. fn_crear_factura_rectificativa — hardcodea 'I' ────────
CREATE OR REPLACE FUNCTION public.fn_crear_factura_rectificativa(
  p_original_invoice_id  uuid,
  p_org_id               uuid,
  p_tipo_factura_vf      text,
  p_motivo               text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role   text;
  v_orig       record;
  v_rect_id    uuid;
  v_numero_tmp text;
BEGIN
  v_jwt_role := auth.role();

  IF v_jwt_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Token autenticado sin identidad.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_jwt_role = 'service_role' OR v_jwt_role IS NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'No autorizado: rol "%".', COALESCE(v_jwt_role, 'unknown') USING ERRCODE = '42501';
  END IF;

  IF p_tipo_factura_vf NOT IN ('R1', 'R2', 'R3', 'R4') THEN
    RAISE EXCEPTION
      'tipo_factura_vf no válido: "%". Admitidos: R1 (error/art.80.1-2-6), R2 (concurso), R3 (incobrable), R4 (resto).',
      COALESCE(p_tipo_factura_vf, 'NULL')
      USING ERRCODE = 'P0001';
  END IF;

  IF p_motivo IS NULL OR trim(p_motivo) = '' THEN
    RAISE EXCEPTION 'El motivo de rectificación es obligatorio.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  SELECT * INTO v_orig
  FROM public.trade_invoices
  WHERE id = p_original_invoice_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura original no encontrada (id: %).', p_original_invoice_id USING ERRCODE = 'P0002';
  END IF;

  IF v_orig.estado = 'Borrador' THEN
    RAISE EXCEPTION 'No se puede rectificar una factura Borrador.' USING ERRCODE = 'P0001';
  END IF;

  IF v_orig.tipo_factura = 'rectificativa' THEN
    RAISE EXCEPTION 'No se puede rectificar una factura rectificativa.' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trade_invoices
    WHERE org_id = p_org_id AND rectifica_factura_id = p_original_invoice_id AND tipo_factura = 'rectificativa'
  ) THEN
    RAISE EXCEPTION 'Ya existe una rectificativa de esta factura.' USING ERRCODE = 'P0001';
  END IF;

  v_numero_tmp := 'BORRADOR-R-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);

  INSERT INTO public.trade_invoices (
    org_id, client_id, tipo_factura, tipo_factura_vf, tipo_rectificativa,
    serie, estado, numero, concepto,
    subtotal, iva_pct, iva_importe, total,
    razon_social_cliente, nif_cliente, direccion_cliente,
    cp_cliente, localidad_cliente, provincia_cliente, pais_cliente,
    rectifica_factura_id, motivo_rectificacion
  ) VALUES (
    p_org_id, v_orig.client_id, 'rectificativa', p_tipo_factura_vf, 'I',
    'R', 'Borrador', v_numero_tmp,
    'Rectificativa de ' || COALESCE(v_orig.numero, v_orig.id::text),
    -(v_orig.subtotal), v_orig.iva_pct,
    -(COALESCE(v_orig.iva_importe, round(v_orig.subtotal * v_orig.iva_pct / 100.0, 2))),
    -(COALESCE(v_orig.total, round(v_orig.subtotal * (1 + v_orig.iva_pct / 100.0), 2))),
    v_orig.razon_social_cliente, v_orig.nif_cliente, v_orig.direccion_cliente,
    v_orig.cp_cliente, v_orig.localidad_cliente, v_orig.provincia_cliente, v_orig.pais_cliente,
    p_original_invoice_id, p_motivo
  )
  RETURNING id INTO v_rect_id;

  INSERT INTO public.trade_invoice_lines (factura_id, descripcion, cantidad, precio_unitario, subtotal, tipo, orden)
  SELECT v_rect_id, descripcion, cantidad, -(precio_unitario), -(subtotal), tipo, orden
  FROM public.trade_invoice_lines
  WHERE factura_id = p_original_invoice_id
  ORDER BY orden;

  RETURN jsonb_build_object(
    'rectificativa_id',   v_rect_id,
    'original_id',        p_original_invoice_id,
    'original_numero',    v_orig.numero,
    'tipo_factura_vf',    p_tipo_factura_vf,
    'tipo_rectificativa', 'I',
    'motivo',             p_motivo,
    'numero_provisional', v_numero_tmp
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_crear_factura_rectificativa(uuid, uuid, text, text) TO service_role;

-- ── 5. fn_emitir_factura v7 ───────────────────────────────────
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
  v_tipo_rect       text;
  v_cuota_iva       numeric(14,2);
  v_total           numeric(14,2);
  v_fiscal_id       uuid;
BEGIN
  v_jwt_role := auth.role();

  IF v_jwt_role = 'authenticated' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Token autenticado sin identidad.' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.trade_organizations WHERE id = p_org_id AND owner_id = auth.uid()
      UNION ALL
      SELECT 1 FROM public.trade_org_members WHERE org_id = p_org_id AND user_id = auth.uid()
    ) THEN
      RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE = '42501';
    END IF;
  ELSIF v_jwt_role = 'service_role' OR v_jwt_role IS NULL THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'No autorizado: rol "%".', COALESCE(v_jwt_role, 'unknown') USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_org_id::text));

  SELECT * INTO v_inv
  FROM public.trade_invoices
  WHERE id = p_invoice_id AND org_id = p_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Factura no encontrada (id: %).', p_invoice_id USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.estado != 'Borrador' THEN
    RAISE EXCEPTION 'La factura debe estar en Borrador (estado: %).', v_inv.estado USING ERRCODE = 'P0001';
  END IF;

  IF v_inv.tipo_factura = 'rectificativa' THEN
    IF v_inv.serie != 'R' THEN
      RAISE EXCEPTION 'Rectificativa debe tener serie R (actual: %).', COALESCE(v_inv.serie, 'NULL') USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.rectifica_factura_id IS NULL THEN
      RAISE EXCEPTION 'rectifica_factura_id es NULL.' USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.tipo_factura_vf IS NULL OR v_inv.tipo_factura_vf NOT IN ('R1','R2','R3','R4') THEN
      RAISE EXCEPTION 'tipo_factura_vf inválido: %.', COALESCE(v_inv.tipo_factura_vf,'NULL') USING ERRCODE = 'P0001';
    END IF;

    -- Validar tipo_rectificativa = 'I' (único modelo MVP)
    IF v_inv.tipo_rectificativa IS NULL THEN
      RAISE EXCEPTION
        'tipo_rectificativa es NULL. Debe ser ''I'' (por diferencias). '
        'Recrea la rectificativa mediante fn_crear_factura_rectificativa.'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_inv.tipo_rectificativa != 'I' THEN
      RAISE EXCEPTION
        'TipoRectificativa "%" no soportado. Solo se admite rectificación por diferencias (I).',
        v_inv.tipo_rectificativa
        USING ERRCODE = 'P0001';
    END IF;

    IF v_inv.motivo_rectificacion IS NULL OR trim(v_inv.motivo_rectificacion) = '' THEN
      RAISE EXCEPTION 'motivo_rectificacion vacío.' USING ERRCODE = 'P0001';
    END IF;

    SELECT id, estado INTO v_orig
    FROM public.trade_invoices
    WHERE id = v_inv.rectifica_factura_id AND org_id = p_org_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Factura original no encontrada (id: %).', v_inv.rectifica_factura_id USING ERRCODE = 'P0002';
    END IF;
    IF v_orig.estado = 'Borrador' THEN
      RAISE EXCEPTION 'La factura original no puede estar en Borrador.' USING ERRCODE = 'P0001';
    END IF;

    v_tipo_vf   := v_inv.tipo_factura_vf;
    v_tipo_rect := 'I';

  ELSE
    v_tipo_vf   := 'F1';
    v_tipo_rect := NULL;
  END IF;

  IF v_inv.razon_social_cliente IS NULL OR trim(v_inv.razon_social_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: razón social del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.nif_cliente IS NULL OR trim(v_inv.nif_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: NIF del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.direccion_cliente IS NULL OR trim(v_inv.direccion_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: dirección del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.cp_cliente IS NULL OR trim(v_inv.cp_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: código postal del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.localidad_cliente IS NULL OR trim(v_inv.localidad_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: localidad del cliente' USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.provincia_cliente IS NULL OR trim(v_inv.provincia_cliente) = '' THEN
    RAISE EXCEPTION 'Falta: provincia del cliente' USING ERRCODE = 'P0001';
  END IF;

  SELECT nif, COALESCE(timezone, 'Europe/Madrid') AS timezone
  INTO v_org
  FROM public.trade_organizations
  WHERE id = p_org_id;

  IF v_org.nif IS NULL OR trim(v_org.nif) = '' THEN
    RAISE EXCEPTION 'La organización no tiene NIF configurado.' USING ERRCODE = 'P0001';
  END IF;

  v_year := EXTRACT(YEAR FROM NOW())::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id AND serie = v_inv.serie AND estado != 'Borrador';
  v_numero := v_inv.serie || '-' || v_year || '-' || lpad((v_count + 1)::text, 4, '0');

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

  SELECT id, numero_factura, hash, generated_at
  INTO v_prev
  FROM public.trade_fiscal_records
  WHERE org_id = p_org_id
  ORDER BY generated_at DESC
  LIMIT 1;

  IF v_prev.id IS NOT NULL AND v_prev.generated_at > v_generated_at THEN
    RAISE EXCEPTION 'Registro fiscal posterior al momento de emisión: %.', v_prev.numero_factura USING ERRCODE = 'P0001';
  END IF;

  v_cuota_iva := round(COALESCE(v_inv.iva_importe, v_inv.subtotal * v_inv.iva_pct / 100.0), 2);
  v_total     := round(COALESCE(v_inv.total, v_inv.subtotal + v_inv.subtotal * v_inv.iva_pct / 100.0), 2);

  -- Hash canónico AEAT v0.1.2 — 8 campos oficiales.
  -- TipoRectificativa NO entra en el hash.
  v_hash_input :=
      'IDEmisorFactura='            || trim(v_org.nif)
    || '&NumSerieFactura='          || v_numero
    || '&FechaExpedicionFactura='   || v_fecha_vf
    || '&TipoFactura='              || v_tipo_vf
    || '&CuotaTotal='               || to_char(v_cuota_iva, 'FM999999999990.00')
    || '&ImporteTotal='             || to_char(v_total,     'FM999999999990.00')
    || '&Huella='                   || COALESCE(v_prev.hash, '')
    || '&FechaHoraHusoGenRegistro=' || v_gen_str;

  v_hash := upper(encode(
    extensions.digest(convert_to(v_hash_input, 'UTF8'), 'sha256'),
    'hex'
  ));

  INSERT INTO public.trade_fiscal_records (
    org_id, invoice_id, record_type,
    nif_emisor,
    numero_factura, serie_factura, tipo_factura_vf, tipo_rectificativa,
    fecha_expedicion, fecha_expedicion_vf,
    cuota_iva, importe_total,
    previous_record_id, previous_numero, previous_hash,
    hash, hash_input,
    generated_at, generated_at_str, timezone_used
  ) VALUES (
    p_org_id, p_invoice_id, 'alta',
    trim(v_org.nif),
    v_numero, v_inv.serie, v_tipo_vf, v_tipo_rect,
    v_local_ts::date, v_fecha_vf,
    v_cuota_iva, v_total,
    v_prev.id, v_prev.numero_factura,
    CASE WHEN v_prev.id IS NULL THEN NULL ELSE v_prev.hash END,
    v_hash, v_hash_input,
    v_generated_at, v_gen_str, v_org.timezone
  )
  RETURNING id INTO v_fiscal_id;

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

  RETURN jsonb_build_object(
    'invoice_id',          p_invoice_id,
    'fiscal_record_id',    v_fiscal_id,
    'numero',              v_numero,
    'fecha_emision',       v_gen_str,
    'verifactu_hash',      v_hash,
    'tipo_factura_vf',     v_tipo_vf,
    'tipo_rectificativa',  v_tipo_rect,
    'is_primer_registro',  (v_prev.id IS NULL)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO service_role;
;
