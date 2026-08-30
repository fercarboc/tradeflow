
-- RC1-C.5A.2 — Drop + recrear get_supplier_checkout_config con supplier_locations

DROP FUNCTION IF EXISTS public.get_supplier_checkout_config(uuid[]);

CREATE FUNCTION public.get_supplier_checkout_config(p_actor_ids uuid[])
RETURNS TABLE(
  actor_id                 uuid,
  actor_nombre             text,
  actor_verificado         boolean,
  permite_entrega          boolean,
  permite_recogida         boolean,
  permite_coordinar        boolean,
  payment_methods_allowed  text[],
  portes_gratis_desde      numeric,
  coste_portes             numeric,
  plazo_entrega_dias       integer,
  plazo_confirmacion_h     integer,
  mensaje_instaladores     text,
  pickup_points            jsonb,
  supplier_locations       jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    a.id,
    a.nombre,
    a.verificado,
    COALESCE(cfg.permite_entrega, true),
    COALESCE(
      CASE
        WHEN EXISTS(
          SELECT 1
          FROM public.trade_marketplace_supplier_locations sl
          WHERE sl.actor_id = a.id AND sl.activa = true AND sl.permite_recogida = true
        ) THEN true
        ELSE cfg.permite_recogida
      END,
      false
    ),
    COALESCE(cfg.permite_coordinar_entrega, true),
    COALESCE(cfg.payment_methods_allowed, ARRAY['cuenta_proveedor','transferencia']),
    cfg.portes_gratis_desde,
    cfg.coste_portes,
    COALESCE(cfg.plazo_entrega_dias, 5),
    COALESCE(cfg.plazo_confirmacion_h, 24),
    cfg.mensaje_instaladores,
    '[]'::jsonb,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id',                   sl.id,
            'codigo_interno',       sl.codigo_interno,
            'nombre',               sl.nombre,
            'tipo',                 sl.tipo::text,
            'direccion_linea1',     sl.direccion_linea1,
            'localidad',            sl.localidad,
            'provincia',            sl.provincia,
            'codigo_postal',        sl.codigo_postal,
            'telefono',             sl.telefono,
            'horario',              sl.horario,
            'permite_recogida',     sl.permite_recogida,
            'permite_entrega_local', sl.permite_entrega_local,
            'radio_servicio_km',    sl.radio_servicio_km,
            'orden',                sl.orden
          ) ORDER BY sl.orden, sl.nombre
        )
        FROM public.trade_marketplace_supplier_locations sl
        WHERE sl.actor_id = a.id AND sl.activa = true
      ),
      '[]'::jsonb
    )
  FROM public.trade_marketplace_actors a
  LEFT JOIN public.trade_marketplace_supplier_config cfg ON cfg.actor_id = a.id
  WHERE a.id = ANY(p_actor_ids)
$$;

COMMENT ON FUNCTION public.get_supplier_checkout_config IS
  'RC1-C.5A.2: supplier_locations desde trade_marketplace_supplier_locations. pickup_points siempre [] (deprecated).';
;
