-- ══════════════════════════════════════════════════════════════════════════════
-- TX-C2 — Presupuestos manuales de transporte
-- ══════════════════════════════════════════════════════════════════════════════
-- Tabla trade_transport_quotes: estado borrador→enviado→aprobado(+servicio)|rechazado|expirado
-- RPC approve_transport_quote: SELECT FOR UPDATE → crea servicio de forma atómica
-- Auto-numeración: TX-YYYY-NNNN por organización (trigger BEFORE INSERT)
-- RLS: organización propietaria o miembro accede a sus propios presupuestos
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Tabla principal ───────────────────────────────────────────────────────

CREATE TABLE public.trade_transport_quotes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid        NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  numero_presupuesto  text        NOT NULL,
  client_id           uuid        REFERENCES public.trade_clients(id) ON DELETE SET NULL,
  titulo              text        NOT NULL,
  tipo_servicio       text        NOT NULL,
  estado              text        NOT NULL DEFAULT 'borrador'
    CONSTRAINT chk_quote_estado
      CHECK (estado IN ('borrador','enviado','aprobado','rechazado','expirado','convertido')),
  fecha_servicio      date,
  fecha_fin_servicio  date,
  num_viajeros        integer     CONSTRAINT chk_quote_viajeros CHECK (num_viajeros IS NULL OR num_viajeros > 0),
  itinerario          jsonb       NOT NULL DEFAULT '[]',
  coste_estimado      numeric(10,2),
  precio_sugerido     numeric(10,2),
  precio_final        numeric(10,2),
  margen_pct          numeric(5,2),
  notas               text,
  notas_internas      text,
  fecha_expiracion    date,
  servicio_id         uuid        REFERENCES public.trade_transport_services(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, numero_presupuesto)
);

-- ── 2. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX idx_transport_quotes_org_id
  ON public.trade_transport_quotes (org_id);

CREATE INDEX idx_transport_quotes_org_estado
  ON public.trade_transport_quotes (org_id, estado);

-- ── 3. Trigger: auto-numeración TX-YYYY-NNNN ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.generate_transport_quote_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_yr  text    := to_char(now(), 'YYYY');
  v_cnt integer;
BEGIN
  SELECT count(*) INTO v_cnt
  FROM public.trade_transport_quotes
  WHERE org_id = NEW.org_id
    AND numero_presupuesto LIKE 'TX-' || v_yr || '-%';

  NEW.numero_presupuesto :=
    'TX-' || v_yr || '-' || lpad((v_cnt + 1)::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_quote_number
  BEFORE INSERT ON public.trade_transport_quotes
  FOR EACH ROW EXECUTE FUNCTION public.generate_transport_quote_number();

-- ── 4. Trigger: updated_at automático ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_transport_quote_updated_at()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transport_quote_updated_at
  BEFORE UPDATE ON public.trade_transport_quotes
  FOR EACH ROW EXECUTE FUNCTION public.touch_transport_quote_updated_at();

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.trade_transport_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org accede a sus presupuestos de transporte"
  ON public.trade_transport_quotes
  FOR ALL
  USING (
    org_id IN (
      SELECT id  FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid()
    )
  );

-- ── 6. RPC: approve_transport_quote ──────────────────────────────────────────
-- Bloquea la fila con FOR UPDATE, verifica estado='enviado',
-- crea el servicio de transporte e interpreta la aprobación de forma atómica.
-- Devuelve el UUID del servicio creado.

CREATE OR REPLACE FUNCTION public.approve_transport_quote(p_quote_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_quote     public.trade_transport_quotes;
  v_service_id uuid;
  v_fecha_ini timestamptz;
  v_fecha_fin timestamptz;
BEGIN
  -- Bloqueo exclusivo: evita doble aprobación concurrente
  SELECT * INTO v_quote
  FROM public.trade_transport_quotes
  WHERE id = p_quote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Presupuesto no encontrado: %', p_quote_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_quote.estado <> 'enviado' THEN
    RAISE EXCEPTION 'Solo se puede aprobar un presupuesto en estado "enviado". Estado actual: %', v_quote.estado
      USING ERRCODE = 'P0001';
  END IF;

  -- Conversión date → timestamptz (hora por defecto 08:00)
  v_fecha_ini := COALESCE(
    (v_quote.fecha_servicio::text || ' 08:00:00')::timestamptz,
    now()
  );
  IF v_quote.fecha_fin_servicio IS NOT NULL THEN
    v_fecha_fin := (v_quote.fecha_fin_servicio::text || ' 23:59:00')::timestamptz;
  END IF;

  -- Crear servicio de transporte a partir del presupuesto
  INSERT INTO public.trade_transport_services (
    org_id,
    quote_id,
    titulo,
    tipo_servicio,
    estado,
    fecha_inicio,
    fecha_fin,
    num_viajeros,
    paradas,
    precio_acordado
  ) VALUES (
    v_quote.org_id,
    v_quote.id,
    v_quote.titulo,
    v_quote.tipo_servicio,
    'confirmado',
    v_fecha_ini,
    v_fecha_fin,
    v_quote.num_viajeros,
    COALESCE(v_quote.itinerario, '[]'::jsonb),
    v_quote.precio_final
  )
  RETURNING id INTO v_service_id;

  -- Actualizar presupuesto: aprobado + enlace al servicio
  UPDATE public.trade_transport_quotes
  SET
    estado      = 'aprobado',
    servicio_id = v_service_id,
    updated_at  = now()
  WHERE id = p_quote_id;

  RETURN v_service_id;
END;
$$;
