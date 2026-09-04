-- ============================================================
-- VF-INVOICE-NUMBERING-HARDENING-1
-- trade_invoice_counters + fn_emitir_factura v11
-- ============================================================
--
-- Objetivo: eliminar la numeración COUNT-based y sustituirla
-- por un contador transaccional monotónico por
-- (org_id, nif_emisor, serie, ejercicio).
--
-- La migration es atómica: si cualquier guard falla,
-- ningún objeto se crea y fn_emitir_factura no cambia.
--
-- Contrato número de factura: {serie}-{YYYY}-{NNNN}
-- Restricción de contrato: serie no puede contener '-'.
-- ============================================================

BEGIN;

-- ════════════════════════════════════════════════════════════
-- GUARDS PREFLIGHT
-- ════════════════════════════════════════════════════════════

-- ── GUARD 1: formato válido en todos los fiscal records ──────
DO $$
DECLARE
  bad_count int;
BEGIN
  SELECT COUNT(*) INTO bad_count
  FROM public.trade_fiscal_records
  WHERE NOT (numero_factura ~ '^([^-]+)-([0-9]{4})-([0-9]+)$');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'VF-NUM GUARD-1 FAIL: % fiscal records con formato '
      'numero_factura invalido (contrato: {serie}-{YYYY}-{ordinal}). '
      'Revision manual requerida antes de crear counters.',
      bad_count
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ── GUARD 2: consistencia cruzada serie / año / ordinal ──────
DO $$
DECLARE
  r         record;
  bad_count int := 0;
BEGIN
  FOR r IN
    SELECT
      id,
      numero_factura,
      serie_factura,
      fecha_expedicion,
      SPLIT_PART(numero_factura, '-', 1)             AS snm,
      SPLIT_PART(numero_factura, '-', 2)::int         AS ynm,
      SPLIT_PART(numero_factura, '-', 3)::int         AS ord,
      EXTRACT(YEAR FROM fecha_expedicion::date)::int  AS ydate
    FROM public.trade_fiscal_records
  LOOP
    IF r.snm != r.serie_factura THEN
      RAISE WARNING
        'VF-NUM GUARD-2: id=% num=% serie_from_num=% != serie_factura=%',
        r.id, r.numero_factura, r.snm, r.serie_factura;
      bad_count := bad_count + 1;
    END IF;

    IF r.ynm != r.ydate THEN
      RAISE WARNING
        'VF-NUM GUARD-2: id=% num=% year_from_num=% != year_from_date=%',
        r.id, r.numero_factura, r.ynm, r.ydate;
      bad_count := bad_count + 1;
    END IF;

    IF r.ord <= 0 THEN
      RAISE WARNING
        'VF-NUM GUARD-2: id=% num=% ordinal_invalido=%',
        r.id, r.numero_factura, r.ord;
      bad_count := bad_count + 1;
    END IF;
  END LOOP;

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'VF-NUM GUARD-2 FAIL: % inconsistencias serie/año/ordinal. '
      'Ver WARNINGs anteriores.',
      bad_count
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ── GUARD 3: INVOICE_ONLY en orgs con actividad VeriFactu ───
-- Orgs sin ningún fiscal record quedan fuera de scope.
DO $$
DECLARE
  inv_only_count int;
BEGIN
  SELECT COUNT(*) INTO inv_only_count
  FROM public.trade_invoices ti
  WHERE ti.estado != 'Borrador'
    AND ti.numero ~ '^([^-]+)-([0-9]{4})-([0-9]+)$'
    AND EXISTS (
      SELECT 1 FROM public.trade_fiscal_records tfr
      WHERE tfr.org_id = ti.org_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.trade_fiscal_records tfr2
      WHERE tfr2.invoice_id = ti.id
    );

  IF inv_only_count > 0 THEN
    RAISE EXCEPTION
      'VF-NUM GUARD-3 FAIL: % invoices emitidas sin fiscal record '
      'en orgs con actividad VeriFactu. Riesgo de reutilizacion '
      'de numero. Revision manual requerida.',
      inv_only_count
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ── GUARD 4: sin duplicados para candidata UNIQUE del ledger ─
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT org_id, nif_emisor, numero_factura
    FROM public.trade_fiscal_records
    GROUP BY org_id, nif_emisor, numero_factura
    HAVING COUNT(*) > 1
  ) q;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'VF-NUM GUARD-4 FAIL: % grupos duplicados '
      '(org_id, nif_emisor, numero_factura) en fiscal ledger.',
      dup_count
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- TABLA trade_invoice_counters
-- ════════════════════════════════════════════════════════════

CREATE TABLE public.trade_invoice_counters (
  org_id     uuid        NOT NULL,
  nif_emisor text        NOT NULL
    CONSTRAINT chk_counter_nif_not_empty   CHECK (trim(nif_emisor) != ''),
  serie      text        NOT NULL
    CONSTRAINT chk_counter_serie_not_empty CHECK (trim(serie) != '')
    CONSTRAINT chk_counter_serie_no_hyphen CHECK (serie NOT LIKE '%-%'),
  ejercicio  integer     NOT NULL
    CONSTRAINT chk_counter_ejercicio_range CHECK (ejercicio BETWEEN 2000 AND 9999),
  last_value integer     NOT NULL DEFAULT 0
    CONSTRAINT chk_counter_last_value_nn   CHECK (last_value >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, nif_emisor, serie, ejercicio)
);

-- ════════════════════════════════════════════════════════════
-- PERMISOS — MÍNIMO PRIVILEGIO
-- ════════════════════════════════════════════════════════════
-- fn_emitir_factura es SECURITY DEFINER; opera con permisos
-- del owner (postgres) — no requiere grants adicionales.
-- Ningún rol de aplicación necesita acceso directo al counter.

REVOKE ALL ON TABLE public.trade_invoice_counters FROM PUBLIC;
REVOKE ALL ON TABLE public.trade_invoice_counters FROM anon;
REVOKE ALL ON TABLE public.trade_invoice_counters FROM authenticated;
REVOKE ALL ON TABLE public.trade_invoice_counters FROM service_role;

-- ════════════════════════════════════════════════════════════
-- FUNCIÓN Y TRIGGER DE PROTECCIÓN MONOTÓNICA
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.fn_protect_invoice_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- DELETE: siempre bloqueado.
  -- Un counter eliminado permite que la próxima emisión cree
  -- un nuevo counter desde 0, causando reuse de números ya
  -- comprometidos fiscalmente.
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION
      'trade_invoice_counters: eliminacion prohibida '
      '(org=%, nif=%, serie=%, ejercicio=%)',
      OLD.org_id, OLD.nif_emisor, OLD.serie, OLD.ejercicio
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- PK inmutable.
    IF NEW.org_id     IS DISTINCT FROM OLD.org_id     OR
       NEW.nif_emisor IS DISTINCT FROM OLD.nif_emisor OR
       NEW.serie      IS DISTINCT FROM OLD.serie      OR
       NEW.ejercicio  IS DISTINCT FROM OLD.ejercicio  THEN
      RAISE EXCEPTION
        'trade_invoice_counters: clave primaria inmutable '
        '(org=%, nif=%, serie=%, ejercicio=%)',
        OLD.org_id, OLD.nif_emisor, OLD.serie, OLD.ejercicio
        USING ERRCODE = 'P0001';
    END IF;

    -- Decremento prohibido.
    -- Saltos > 1 hacia adelante están permitidos para facilitar
    -- procedimientos de recuperación que necesiten fijar el counter
    -- a un valor concreto en una sola operación.
    IF NEW.last_value < OLD.last_value THEN
      RAISE EXCEPTION
        'trade_invoice_counters: last_value no puede decrecer '
        '(actual=%, intentado=%, org=%, nif=%, serie=%, ejercicio=%)',
        OLD.last_value, NEW.last_value,
        OLD.org_id, OLD.nif_emisor, OLD.serie, OLD.ejercicio
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_protect_invoice_counter
  BEFORE UPDATE OR DELETE ON public.trade_invoice_counters
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_invoice_counter();

-- ════════════════════════════════════════════════════════════
-- BACKFILL — SEED DESDE FISCAL LEDGER
-- ════════════════════════════════════════════════════════════
-- Fuente primaria: trade_fiscal_records (no COUNT, no trade_invoices).
-- Seed = MAX ordinal históricamente comprometido por partición.
-- ON CONFLICT DO NOTHING: idempotente si se re-ejecuta.

INSERT INTO public.trade_invoice_counters
  (org_id, nif_emisor, serie, ejercicio, last_value, created_at, updated_at)
SELECT
  r.org_id,
  r.nif_emisor,
  r.serie_factura                                               AS serie,
  EXTRACT(YEAR FROM r.fecha_expedicion::date)::int              AS ejercicio,
  MAX(SPLIT_PART(r.numero_factura, '-', 3)::int)                AS last_value,
  now()                                                         AS created_at,
  now()                                                         AS updated_at
FROM public.trade_fiscal_records r
WHERE r.numero_factura ~ '^([^-]+)-([0-9]{4})-([0-9]+)$'
GROUP BY
  r.org_id,
  r.nif_emisor,
  r.serie_factura,
  EXTRACT(YEAR FROM r.fecha_expedicion::date)::int
ON CONFLICT (org_id, nif_emisor, serie, ejercicio) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- POST-BACKFILL ASSERTIONS
-- ════════════════════════════════════════════════════════════

DO $$
DECLARE
  r    record;
  cval int;
  errs int := 0;
BEGIN
  FOR r IN
    SELECT
      org_id,
      nif_emisor,
      serie_factura                                             AS serie,
      EXTRACT(YEAR FROM fecha_expedicion::date)::int            AS ejercicio,
      MAX(SPLIT_PART(numero_factura, '-', 3)::int)              AS max_ordinal
    FROM public.trade_fiscal_records
    GROUP BY
      org_id, nif_emisor, serie_factura,
      EXTRACT(YEAR FROM fecha_expedicion::date)::int
  LOOP
    SELECT last_value INTO cval
    FROM public.trade_invoice_counters
    WHERE org_id    = r.org_id
      AND nif_emisor = r.nif_emisor
      AND serie      = r.serie
      AND ejercicio  = r.ejercicio;

    IF NOT FOUND THEN
      RAISE WARNING
        'VF-NUM POST-BACKFILL: particion sin counter: '
        'org=% nif=% serie=% año=%',
        r.org_id, r.nif_emisor, r.serie, r.ejercicio;
      errs := errs + 1;
    ELSIF cval < r.max_ordinal THEN
      RAISE WARNING
        'VF-NUM POST-BACKFILL: counter(%) < max_ordinal(%) '
        'para org=% nif=% serie=% año=%',
        cval, r.max_ordinal,
        r.org_id, r.nif_emisor, r.serie, r.ejercicio;
      errs := errs + 1;
    END IF;
  END LOOP;

  IF errs > 0 THEN
    RAISE EXCEPTION
      'VF-NUM POST-BACKFILL FAIL: % particiones con counter '
      'insuficiente o ausente. ROLLBACK.',
      errs
      USING ERRCODE = 'P0001';
  END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- UNIQUE EN FISCAL LEDGER
-- ════════════════════════════════════════════════════════════
-- Un numero_factura es único dentro de una cadena AEAT
-- (particionada por org_id + nif_emisor).

CREATE UNIQUE INDEX uq_fiscal_record_org_nif_numero
  ON public.trade_fiscal_records (org_id, nif_emisor, numero_factura);

-- ════════════════════════════════════════════════════════════
-- fn_emitir_factura v11
-- ════════════════════════════════════════════════════════════
--
-- Único cambio respecto a v10: paso 7.
-- SELECT COUNT(*) FROM trade_invoices sustituido por
-- INSERT/ON CONFLICT DO UPDATE sobre trade_invoice_counters.
--
-- RETURNING devuelve last_value ya incrementado.
-- NO aplicar +1 adicional: v_count es el ordinal definitivo.
--
-- NO modificado: advisory lock, state machine, timezone,
-- chain lookup nif_emisor, hash canonical, HASH_NIF_POLICY,
-- fiscal INSERT, invoice UPDATE, outbox.

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

  -- ── 6b. Validar contrato de serie ────────────────────────
  IF v_inv.serie IS NULL OR trim(v_inv.serie) = '' THEN
    RAISE EXCEPTION
      'La factura no tiene serie asignada (NULL o vacía). '
      'Asigna una serie antes de emitir.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_inv.serie LIKE '%-%' THEN
    RAISE EXCEPTION
      'La serie "%" contiene el carácter "-", lo cual viola el contrato '
      'del número de factura ({serie}-{YYYY}-{ordinal}). '
      'La serie no puede contener guiones.', v_inv.serie
      USING ERRCODE = 'P0001';
  END IF;

  -- ── 7. Número definitivo — contador monotónico ───────────
  -- v11: incremento atómico en trade_invoice_counters.
  -- RETURNING devuelve el last_value ya incrementado.
  -- No aplicar +1 adicional.
  v_year := EXTRACT(YEAR FROM v_local_ts)::int;

  INSERT INTO public.trade_invoice_counters
    (org_id, nif_emisor, serie, ejercicio, last_value, updated_at)
  VALUES
    (p_org_id, trim(v_org.nif), v_inv.serie, v_year, 1, now())
  ON CONFLICT (org_id, nif_emisor, serie, ejercicio)
  DO UPDATE SET
    last_value = trade_invoice_counters.last_value + 1,
    updated_at = now()
  RETURNING last_value INTO v_count;

  v_numero := v_inv.serie || '-' || v_year || '-' || lpad(v_count::text, 4, '0');

  -- ── 8. Registro anterior — cadena por org_id + nif_emisor ─
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

COMMIT;
