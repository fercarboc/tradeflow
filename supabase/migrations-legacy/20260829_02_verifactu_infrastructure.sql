-- ============================================================
-- VF-1 — VERIFACTU INFRASTRUCTURE PREPARATION
-- Tablas: trade_verifactu_system_config, trade_org_verifactu_config,
--         trade_verifactu_outbox
-- RPC:    admin_get_verifactu_system_config (SECURITY DEFINER)
-- fn_emitir_factura v7: outbox atómico para trabflow_verifactu orgs
--
-- PROTECCIONES ABSOLUTAS:
--   · transmission_enabled = false (kill switch)
--   · enabled = false
--   · environment = 'disabled' (nunca 'production')
--   · producer_nif = NULL (NIF TrabFlow pendiente)
--   · installation_number = NULL (pendiente confirmación AEAT)
--   · multiple_ot_indicator = NULL (pendiente confirmación AEAT)
--   · No certificados ni claves en tabla
--   · system_config INVISIBLE a tenants normales (RLS: sin policy)
--   · F-2026-0001: protegida por ausencia de config → external_billing
-- ============================================================


-- ── 1. trade_verifactu_system_config ─────────────────────────
-- Tabla de fila única (id=1 enforced).
-- No hay SELECT policy para authenticated → directa devuelve 0 rows.
-- Lectura admin-only vía RPC admin_get_verifactu_system_config().
-- Escritura: solo service_role (admin backend — no desde frontend).

CREATE TABLE IF NOT EXISTS public.trade_verifactu_system_config (
  id                              INT PRIMARY KEY DEFAULT 1,
  -- Kill switch (ambas deben ser true para transmitir — imposible en VF-1)
  enabled                         BOOLEAN NOT NULL DEFAULT false,
  transmission_enabled            BOOLEAN NOT NULL DEFAULT false,
  -- Entorno: 'disabled' mientras no haya NIF + certificado + acuerdo
  environment                     TEXT NOT NULL DEFAULT 'disabled'
    CHECK (environment IN ('disabled', 'sandbox', 'production')),
  -- Identificación SIF (Orden HAC/1177/2024)
  sistema_nombre                  TEXT NOT NULL DEFAULT 'TrabFlow',    -- max 30
  sistema_id                      TEXT NOT NULL DEFAULT 'TF',          -- max 2
  sistema_version                 TEXT NOT NULL DEFAULT '1.0',         -- max 50
  -- Productor: NIF pendiente (empresa aún sin NIF/CIF definitivo)
  producer_nombre_razon           TEXT NOT NULL DEFAULT 'TrabFlow Technologies, S.L.',
  producer_nif                    TEXT,                                -- NULL hasta NIF definitivo
  -- Instalación: valores pendientes confirmación AEAT (SaaS cloud ≠ física)
  installation_number             TEXT,                                -- NULL hasta respuesta AEAT
  multiple_ot_indicator           TEXT
    CHECK (multiple_ot_indicator IS NULL OR multiple_ot_indicator IN ('S', 'N')),
  -- Requisitos legales
  collaboration_agreement_status  TEXT NOT NULL DEFAULT 'pending'
    CHECK (collaboration_agreement_status IN ('pending', 'active', 'suspended')),
  certificate_status              TEXT NOT NULL DEFAULT 'not_configured'
    CHECK (certificate_status IN ('not_configured', 'configured', 'active', 'expired')),
  -- WebService AEAT (vacío hasta VF-2)
  soap_endpoint                   TEXT NOT NULL DEFAULT '',
  -- Política de reintentos para outbox worker
  retry_max_attempts              INT NOT NULL DEFAULT 3,
  retry_backoff_seconds           INT NOT NULL DEFAULT 60,
  -- Notas internas admin
  notes                           TEXT,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                      UUID REFERENCES auth.users(id),
  -- Garantiza fila única
  CONSTRAINT single_row CHECK (id = 1)
);

-- Fila única inicial: fail-closed en todos los campos
INSERT INTO public.trade_verifactu_system_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- RLS: habilitado, sin policy para authenticated → directa devuelve 0 rows.
-- SECURITY DEFINER RPC admin_get_verifactu_system_config() bypasea RLS.
ALTER TABLE public.trade_verifactu_system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verifactu_system_config_select" ON public.trade_verifactu_system_config;
-- NO creamos policy SELECT genérica. Sin policy = 0 rows para authenticated.

REVOKE INSERT, UPDATE, DELETE ON public.trade_verifactu_system_config FROM authenticated;
REVOKE SELECT ON public.trade_verifactu_system_config FROM authenticated;


-- ── 2. RPC: admin_get_verifactu_system_config ─────────────────
-- SERVER-SIDE AUTHORIZATION: authenticated → debe estar en public.admin_users (is_active=true).
-- service_role (worker, migrations) bypasea el check (auth.role() != 'authenticated').
-- RLS sigue activo: la tabla directa devuelve 0 rows sin este RPC.
-- NOTA: tabla correcta es public.admin_users (trade_admin_users no existe en producción).

CREATE OR REPLACE FUNCTION public.admin_get_verifactu_system_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.trade_verifactu_system_config;
BEGIN
  -- Autenticado → verificar que es admin TrabFlow activo.
  -- service_role bypasea (no hay JWT → auth.role() devuelve 'service_role').
  IF auth.role() = 'authenticated' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.admin_users
      WHERE user_id = auth.uid() AND is_active = true
    ) THEN
      RAISE EXCEPTION 'access_denied: requiere admin TrabFlow'
      USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.trade_verifactu_system_config
  WHERE id = 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN row_to_json(v_row)::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_verifactu_system_config() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_get_verifactu_system_config() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_verifactu_system_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_verifactu_system_config() TO service_role;


-- ── 3. trade_org_verifactu_config ─────────────────────────────
-- Una fila por org. Sin fila = external_billing (seguro por defecto).
-- F-2026-0001: sin fila aquí → no genera outbox en ningún caso.

CREATE TABLE IF NOT EXISTS public.trade_org_verifactu_config (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                           UUID NOT NULL UNIQUE
    REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  verifactu_mode                   TEXT NOT NULL DEFAULT 'external_billing'
    CHECK (verifactu_mode IN ('external_billing', 'trabflow_verifactu')),
  collaboration_agreement_signed   BOOLEAN NOT NULL DEFAULT false,
  collaboration_agreement_date     DATE,
  activated_at                     TIMESTAMPTZ,
  deactivated_at                   TIMESTAMPTZ,
  notes                            TEXT,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_verifactu_config_org_id
  ON public.trade_org_verifactu_config (org_id);

ALTER TABLE public.trade_org_verifactu_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_verifactu_config_select_own" ON public.trade_org_verifactu_config;
CREATE POLICY "org_verifactu_config_select_own"
  ON public.trade_org_verifactu_config
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
    UNION
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
  ));

REVOKE INSERT, UPDATE, DELETE ON public.trade_org_verifactu_config FROM authenticated;


-- ── 4. trade_verifactu_outbox ──────────────────────────────────
-- UNIQUE(fiscal_record_id): exactamente una entrada por registro fiscal.
-- Solo authenticated puede SELECT su propia org.
-- INSERT/UPDATE/DELETE: solo backend (fn_emitir_factura + worker).

CREATE TABLE IF NOT EXISTS public.trade_verifactu_outbox (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_record_id    UUID NOT NULL UNIQUE
    REFERENCES public.trade_fiscal_records(id),
  org_id              UUID NOT NULL
    REFERENCES public.trade_organizations(id),
  status              TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'sending', 'accepted', 'accepted_with_errors',
      'rejected', 'retry_pending', 'failed_permanent'
    )),
  attempt_count       INT NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ,
  last_error          TEXT,
  accepted_at         TIMESTAMPTZ,
  aeat_csv            TEXT,
  aeat_response_raw   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verifactu_outbox_status
  ON public.trade_verifactu_outbox (status, created_at)
  WHERE status IN ('pending', 'retry_pending');

CREATE INDEX IF NOT EXISTS idx_verifactu_outbox_org_id
  ON public.trade_verifactu_outbox (org_id, created_at DESC);

ALTER TABLE public.trade_verifactu_outbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verifactu_outbox_select_own" ON public.trade_verifactu_outbox;
CREATE POLICY "verifactu_outbox_select_own"
  ON public.trade_verifactu_outbox
  FOR SELECT TO authenticated
  USING (org_id IN (
    SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
    UNION
    SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
  ));

REVOKE INSERT, UPDATE, DELETE ON public.trade_verifactu_outbox FROM authenticated;


-- ── 5. fn_emitir_factura v7 ────────────────────────────────────
-- ÚNICO cambio funcional respecto a v6:
--   (a) Añade variable v_org_vf_mode
--   (b) Lee verifactu_mode de trade_org_verifactu_config (paso 5b)
--   (c) Si verifactu_mode = 'trabflow_verifactu': INSERT outbox (paso 13b)
--   (d) Devuelve 'outbox_entry_created' en el resultado
--
-- TODO LO DEMÁS ES IDÉNTICO A V6:
--   · Autorización (auth.role / auth.uid / org membership)
--   · Advisory lock (pg_advisory_xact_lock por org)
--   · Lectura factura FOR UPDATE
--   · TipoFactura (F1 / R1-R4)
--   · Validación snapshot fiscal cliente
--   · Carga organización / NIF
--   · Numeración (COUNT-based + advisory lock)
--   · Timestamp DST-aware
--   · Cadena fiscal (prev record ORDER BY generated_at)
--   · Monotonía de encadenamiento
--   · Importes (cuota_iva, importe_total)
--   · Hash input (formato oficial AEAT v0.1.2)
--   · SHA-256 (extensions.digest)
--   · INSERT trade_fiscal_records
--   · UPDATE trade_invoices → Emitida
--   · Permisos REVOKE/GRANT

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
  v_org_vf_mode     text;           -- v7: modo verifactu de la org
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
  -- ── 0. Fail-closed: autorización por auth.role() ──────────
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

  -- ── 5b. Leer modo VeriFactu de la org (v7) ───────────────
  -- Sin fila en trade_org_verifactu_config = NULL → external_billing (seguro).
  -- F-2026-0001 y orgs sin config explícita nunca generan outbox.
  SELECT verifactu_mode INTO v_org_vf_mode
  FROM public.trade_org_verifactu_config
  WHERE org_id = p_org_id;

  -- ── 6. Número definitivo ──────────────────────────────────
  v_year := EXTRACT(YEAR FROM NOW())::int;
  SELECT COUNT(*) INTO v_count
  FROM public.trade_invoices
  WHERE org_id = p_org_id
    AND serie   = v_inv.serie
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

  -- ── 13b. Outbox entry — solo org trabflow_verifactu (v7) ─
  -- Atómico: si falla el INSERT en outbox, toda la tx hace rollback.
  -- En VF-1 ninguna org tiene verifactu_mode='trabflow_verifactu',
  -- por lo que este bloque nunca se ejecuta en producción actual.
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

-- ── Permisos fn_emitir_factura ───────────────────────────────
REVOKE ALL ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_emitir_factura(uuid, uuid) TO service_role;
