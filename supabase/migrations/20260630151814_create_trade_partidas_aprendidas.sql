
-- Tabla para aprendizaje automático de partidas IA
CREATE TABLE IF NOT EXISTS public.trade_partidas_aprendidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.trade_organizations(id) ON DELETE CASCADE,
  descripcion text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('material', 'mano_de_obra')),
  precio_unitario numeric(10,2) NOT NULL CHECK (precio_unitario > 0),
  veces_usado integer NOT NULL DEFAULT 1,
  precio_promedio numeric(10,2),
  origen text NOT NULL DEFAULT 'sugerida_ia',
  oficio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, descripcion, tipo)
);

-- RLS
ALTER TABLE public.trade_partidas_aprendidas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_read_partidas_aprendidas"
  ON public.trade_partidas_aprendidas FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "org_members_can_insert_partidas_aprendidas"
  ON public.trade_partidas_aprendidas FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

CREATE POLICY "org_members_can_update_partidas_aprendidas"
  ON public.trade_partidas_aprendidas FOR UPDATE
  USING (
    org_id IN (
      SELECT id FROM public.trade_organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM public.trade_org_members WHERE user_id = auth.uid() AND activo = true
    )
  );

-- Índice para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_partidas_aprendidas_org_desc
  ON public.trade_partidas_aprendidas (org_id, descripcion);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at_partidas_aprendidas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partidas_aprendidas_updated_at
  BEFORE UPDATE ON public.trade_partidas_aprendidas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_partidas_aprendidas();

-- RPC upsert_partida_aprendida: inserta o actualiza precio promedio y contador
CREATE OR REPLACE FUNCTION public.upsert_partida_aprendida(
  p_org_id uuid,
  p_descripcion text,
  p_tipo text,
  p_precio_unitario numeric,
  p_oficio text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trade_partidas_aprendidas
    (org_id, descripcion, tipo, precio_unitario, precio_promedio, veces_usado, oficio)
  VALUES
    (p_org_id, p_descripcion, p_tipo, p_precio_unitario, p_precio_unitario, 1, p_oficio)
  ON CONFLICT (org_id, descripcion, tipo) DO UPDATE SET
    veces_usado     = trade_partidas_aprendidas.veces_usado + 1,
    precio_promedio = ROUND(
      (trade_partidas_aprendidas.precio_promedio * trade_partidas_aprendidas.veces_usado + p_precio_unitario)
      / (trade_partidas_aprendidas.veces_usado + 1),
      2
    ),
    precio_unitario = p_precio_unitario,
    updated_at      = now();
END;
$$;
;
