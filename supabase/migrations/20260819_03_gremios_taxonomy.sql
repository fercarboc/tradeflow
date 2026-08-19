-- ═══════════════════════════════════════════════════════════════════════════
-- Taxonomía completa de gremios para publicidad + multiselección
-- No destructivo: extiende trade_maintenance_oficios con grupo + aliases
-- Añade target_ids (uuid[]) a bookings y campaigns para multiselección
-- INVARIANTE: publicidad ≠ ranking. Sin efecto en orden orgánico.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extender tabla de gremios con grupo y aliases ─────────────────────

ALTER TABLE public.trade_maintenance_oficios
  ADD COLUMN IF NOT EXISTS grupo   text,
  ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}';

-- ── 2. Multiselección: columnas target_ids en bookings y campaigns ────────

ALTER TABLE public.trade_marketplace_ad_bookings
  ADD COLUMN IF NOT EXISTS target_ids uuid[] DEFAULT NULL;

ALTER TABLE public.trade_marketplace_ad_campaigns
  ADD COLUMN IF NOT EXISTS target_ids uuid[] DEFAULT NULL;

-- ── 3. Seed: taxonomía completa (upsert por codigo) ───────────────────────

INSERT INTO public.trade_maintenance_oficios (id, codigo, nombre, grupo, aliases, activo) VALUES

-- INSTALACIONES
(gen_random_uuid(), 'electricidad',     'Electricidad',               'Instalaciones',        ARRAY['electricista','instalaciones electricas','electricidad general'], true),
(gen_random_uuid(), 'fontaneria',       'Fontanería',                 'Instalaciones',        ARRAY['fontanero','agua','tuberias','saneamiento general'], true),
(gen_random_uuid(), 'gas',              'Gas',                        'Instalaciones',        ARRAY['instalador gas','gas natural','butano','propano'], true),
(gen_random_uuid(), 'climatizacion',    'Climatización / HVAC',       'Instalaciones',        ARRAY['clima','hvac','frigorifico','frigorista','clima hvac'], true),
(gen_random_uuid(), 'aire_acond',       'Aire acondicionado',         'Instalaciones',        ARRAY['aire','ac','split','bomba de calor','aa'], true),
(gen_random_uuid(), 'calefaccion',      'Calefacción',                'Instalaciones',        ARRAY['radiadores','suelo radiante','caldera','calefactor'], true),
(gen_random_uuid(), 'aerotermia',       'Aerotermia',                 'Instalaciones',        ARRAY['bomba calor aerotermia','aerotermico'], true),
(gen_random_uuid(), 'geotermia',        'Geotermia',                  'Instalaciones',        ARRAY['geotermico','energia geotermica'], true),
(gen_random_uuid(), 'fotovoltaica',     'Energía solar / Fotovoltaica','Instalaciones',       ARRAY['solar','placas solares','paneles solares','fotovoltaico','autoconsumo'], true),
(gen_random_uuid(), 'renovables',       'Energías renovables',        'Instalaciones',        ARRAY['energia verde','renovable','biomasa'], true),
(gen_random_uuid(), 'frio_industrial',  'Frío industrial / Refrigeración','Instalaciones',    ARRAY['frigorista','camaras frigorificas','refrigeracion industrial'], true),
(gen_random_uuid(), 'ventilacion',      'Ventilación',                'Instalaciones',        ARRAY['extraccion','recuperador calor','vmcs'], true),
(gen_random_uuid(), 'saneamiento',      'Saneamiento',                'Instalaciones',        ARRAY['alcantarillado','desagues','residuales'], true),
(gen_random_uuid(), 'agua',             'Tratamiento de agua',        'Instalaciones',        ARRAY['osmosis','descalcificador','depuradora','calidad agua'], true),
(gen_random_uuid(), 'domotica',         'Domótica',                   'Instalaciones',        ARRAY['smart home','automatizacion hogar','konnex','knx'], true),
(gen_random_uuid(), 'telecomunicaciones','Telecomunicaciones',        'Instalaciones',        ARRAY['teleco','irc','ict','fibra','coaxial'], true),
(gen_random_uuid(), 'informatica',      'Informática / Redes',        'Instalaciones',        ARRAY['red','wifi','it','cableado estructurado','rack'], true),
(gen_random_uuid(), 'seguridad',        'Seguridad / Alarmas',        'Instalaciones',        ARRAY['alarma','camara seguridad','cctv','control acceso'], true),
(gen_random_uuid(), 'incendios',        'Protección contra incendios','Instalaciones',        ARRAY['pci','extintor','rociadores','bies','deteccion incendios'], true),
(gen_random_uuid(), 'antenas',          'Antenas',                    'Instalaciones',        ARRAY['television','tdt','satelite','antena colectiva'], true),
(gen_random_uuid(), 'porteros',         'Porteros / Videoporteros',   'Instalaciones',        ARRAY['videoportero','intercomunicador','portero automatico'], true),
(gen_random_uuid(), 'recarga_ev',       'Puntos de recarga / EV',     'Instalaciones',        ARRAY['cargador electrico','ev','wallbox','movilidad electrica'], true),

-- CONSTRUCCIÓN Y REFORMAS
(gen_random_uuid(), 'reformas',         'Reformas integrales',        'Construcción y reformas', ARRAY['reforma','reformista','rehabilitacion integral'], true),
(gen_random_uuid(), 'construccion',     'Construcción',               'Construcción y reformas', ARRAY['constructor','obra nueva','contratista','promotor'], true),
(gen_random_uuid(), 'albanileria',      'Albañilería',                'Construcción y reformas', ARRAY['albanil','obra','ladrillo','cemento','hormigon'], true),
(gen_random_uuid(), 'obra_civil',       'Obra civil',                 'Construcción y reformas', ARRAY['civil','infraestructura','obra publica'], true),
(gen_random_uuid(), 'rehabilitacion',   'Rehabilitación',             'Construcción y reformas', ARRAY['rehab','restauracion','patrimonio'], true),
(gen_random_uuid(), 'fachadas',         'Fachadas',                   'Construcción y reformas', ARRAY['fachada','sate','revestimiento exterior'], true),
(gen_random_uuid(), 'cubiertas',        'Cubiertas / Tejados',        'Construcción y reformas', ARRAY['tejado','cubierta','teja','pizarra','impermeabilizacion cubierta'], true),
(gen_random_uuid(), 'impermeabilizacion','Impermeabilización',        'Construcción y reformas', ARRAY['impermeable','filtraciones','humedad'], true),
(gen_random_uuid(), 'aislamiento',      'Aislamiento',                'Construcción y reformas', ARRAY['aislante','termico','acustico','lana mineral'], true),
(gen_random_uuid(), 'pladur',           'Pladur / Yeso laminado',     'Construcción y reformas', ARRAY['pladur','carton yeso','tabique','falso techo'], true),
(gen_random_uuid(), 'yeseros',          'Yeseros / Escayolistas',     'Construcción y reformas', ARRAY['yeso','escayola','moldura','estuco'], true),
(gen_random_uuid(), 'demoliciones',     'Demoliciones',               'Construcción y reformas', ARRAY['demolicion','derribo','picado'], true),
(gen_random_uuid(), 'excavaciones',     'Excavaciones',               'Construcción y reformas', ARRAY['excavacion','movimiento tierras','desbroce','zanja'], true),

-- ACABADOS
(gen_random_uuid(), 'pintura',          'Pintura',                    'Acabados',             ARRAY['pintor','pintura interior','pintura exterior','barniz','esmalte'], true),
(gen_random_uuid(), 'decoracion',       'Decoración',                 'Acabados',             ARRAY['decorador','interiorismo','diseno interior'], true),
(gen_random_uuid(), 'alicatado',        'Alicatado',                  'Acabados',             ARRAY['alicatador','azulejo','ceramica','gresite'], true),
(gen_random_uuid(), 'suelos',           'Suelos / Pavimentos',        'Acabados',             ARRAY['pavimento','solado','suelo','baldosa','gres','porcelanico'], true),
(gen_random_uuid(), 'parquet',          'Parquet / Tarima',           'Acabados',             ARRAY['parquet','tarima','madera','tarima flotante','vinilo'], true),
(gen_random_uuid(), 'microcemento',     'Microcemento',               'Acabados',             ARRAY['microcemento','cemento pulido','resina'], true),
(gen_random_uuid(), 'piedra',           'Piedra / Mármol',            'Acabados',             ARRAY['marmol','granito','piedra natural','caliza','pizarra'], true),

-- CARPINTERÍA Y CERRAMIENTOS
(gen_random_uuid(), 'carpinteria',      'Carpintería',                'Carpintería y cerramientos', ARRAY['carpintero','madera','mueble a medida'], true),
(gen_random_uuid(), 'carpinteria_met',  'Carpintería metálica',       'Carpintería y cerramientos', ARRAY['metal','acero','hierro','forja'], true),
(gen_random_uuid(), 'aluminio',         'Aluminio / PVC',             'Carpintería y cerramientos', ARRAY['aluminio','pvc','plastico','rotura puente termico'], true),
(gen_random_uuid(), 'ventanas',         'Ventanas',                   'Carpintería y cerramientos', ARRAY['ventana','ventanal','doble acristalamiento'], true),
(gen_random_uuid(), 'puertas',          'Puertas',                    'Carpintería y cerramientos', ARRAY['puerta','puerta blindada','acceso'], true),
(gen_random_uuid(), 'persianas',        'Persianas / Toldos',         'Carpintería y cerramientos', ARRAY['persiana','toldo','sombraje','enrollable'], true),
(gen_random_uuid(), 'cerrajeria',       'Cerrajería',                 'Carpintería y cerramientos', ARRAY['cerrajero','cerradura','llave','apertura'], true),
(gen_random_uuid(), 'cristaleria',      'Cristalería / Vidrio',       'Carpintería y cerramientos', ARRAY['cristal','vidrio','vidrier','templado','mampara'], true),
(gen_random_uuid(), 'cerramientos',     'Cerramientos',               'Carpintería y cerramientos', ARRAY['cerramiento','valla','barandilla','cierre'], true),

-- BAÑOS Y COCINAS
(gen_random_uuid(), 'banos',            'Reformas de baños',          'Baños y cocinas',      ARRAY['bano','aseo','cuarto de bano','sanitario','ducha'], true),
(gen_random_uuid(), 'cocinas',          'Reformas de cocinas',        'Baños y cocinas',      ARRAY['cocina','muebles cocina','encimera','office'], true),
(gen_random_uuid(), 'sanitarios',       'Instalación de sanitarios',  'Baños y cocinas',      ARRAY['sanitario','inodoro','lavabo','bañera','plato ducha'], true),

-- EXTERIOR
(gen_random_uuid(), 'jardineria',       'Jardinería',                 'Exterior y piscinas',  ARRAY['jardinero','paisajismo','cesped','plantas','arbol'], true),
(gen_random_uuid(), 'riego',            'Riego',                      'Exterior y piscinas',  ARRAY['riego automatico','goteo','aspersion'], true),
(gen_random_uuid(), 'piscinas',         'Piscinas',                   'Exterior y piscinas',  ARRAY['piscina','construccion piscina','mantenimiento piscina','depuradora piscina'], true),
(gen_random_uuid(), 'cerramientos_ext', 'Cerramientos exteriores',    'Exterior y piscinas',  ARRAY['valla','malla','cerramiento exterior','porton'], true),

-- SERVICIOS TÉCNICOS
(gen_random_uuid(), 'mantenimiento',    'Mantenimiento',              'Servicios técnicos',   ARRAY['mantenimiento preventivo','sat','correctivo'], true),
(gen_random_uuid(), 'mant_industrial',  'Mantenimiento industrial',   'Servicios técnicos',   ARRAY['industrial','maquinaria industrial','planta'], true),
(gen_random_uuid(), 'reparaciones',     'Reparaciones',               'Servicios técnicos',   ARRAY['reparacion','averias','servicio tecnico'], true),
(gen_random_uuid(), 'electrodomesticos','Electrodomésticos',          'Servicios técnicos',   ARRAY['lavadora','nevera','lavavajillas','secadora'], true),
(gen_random_uuid(), 'ascensores',       'Ascensores / Elevadores',    'Servicios técnicos',   ARRAY['ascensor','elevador','montacargas','salvaescaleras'], true),
(gen_random_uuid(), 'puertas_auto',     'Puertas automáticas',        'Servicios técnicos',   ARRAY['puerta automatica','garaje','barrera','automatismo'], true),
(gen_random_uuid(), 'calderas',         'Calderas',                   'Servicios técnicos',   ARRAY['caldera','condensacion','biomasa caldera','mantenimiento caldera'], true),
(gen_random_uuid(), 'grupos_presion',   'Grupos de presión / Bombas', 'Servicios técnicos',   ARRAY['bomba agua','presion','hidroforo'], true),
(gen_random_uuid(), 'limpieza',         'Limpieza industrial',        'Servicios técnicos',   ARRAY['limpieza','limpieza industrial','desinfeccion'], true),

-- OTROS PROFESIONALES
(gen_random_uuid(), 'arquitectura',     'Arquitectura / Ingeniería',  'Otros profesionales',  ARRAY['arquitecto','ingeniero','tecnico','aparejador'], true),
(gen_random_uuid(), 'interiorismo',     'Interiorismo',               'Otros profesionales',  ARRAY['interiorista','decorador','diseno','home staging'], true),
(gen_random_uuid(), 'multiservicio',    'Empresas multiservicio',     'Otros profesionales',  ARRAY['multiservicio','instalador multiservicio','reformista','contratista','facility'], true),
(gen_random_uuid(), 'administradores',  'Administradores de fincas',  'Otros profesionales',  ARRAY['administrador fincas','comunidad propietarios','icp'], true)

ON CONFLICT (codigo) DO UPDATE SET
  nombre  = EXCLUDED.nombre,
  grupo   = EXCLUDED.grupo,
  aliases = EXCLUDED.aliases,
  activo  = true;

-- ── 4. Actualizar gremios existentes con grupo + aliases ──────────────────
-- (Los que ya tenían IDs estables — el ON CONFLICT DO UPDATE ya los cubre)

-- ── 5. Actualizar request_ad_slot_v2 para soporte multiselección ──────────

CREATE OR REPLACE FUNCTION public.request_ad_slot_v2(
  p_actor_id    uuid,
  p_slot_id     text,
  p_inicio      date,
  p_fin         date,
  p_mensaje     text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id   uuid DEFAULT NULL,
  p_target_ids  uuid[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_label        text;
  v_target_labels       text[];
  v_rate_amount         numeric(10,2);
  v_rate_currency       char(3);
  v_rate_unit           text;
  v_min_days            integer;
  v_max_days            integer;
  v_days                integer;
  v_estimated_total     numeric(10,2);
  v_booking_id          uuid;
  v_existing_count      integer;
  v_tid                 uuid;
BEGIN
  IF NOT public._is_actor_member(p_actor_id) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_inicio < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha de inicio no puede ser en el pasado';
  END IF;
  IF p_fin < p_inicio THEN
    RAISE EXCEPTION 'La fecha de fin debe ser posterior al inicio';
  END IF;

  SELECT COUNT(*) INTO v_existing_count
  FROM public.trade_marketplace_ad_bookings
  WHERE actor_id = p_actor_id
    AND slot_id  = p_slot_id
    AND estado NOT IN ('REJECTED','CANCELLED','EXPIRED')
    AND inicio   <= p_fin
    AND fin      >= p_inicio;

  IF v_existing_count > 0 THEN
    RAISE EXCEPTION 'Ya existe una solicitud activa para este espacio en esas fechas';
  END IF;

  SELECT rate_amount, rate_currency, rate_unit, min_duration_days, max_duration_days
  INTO   v_rate_amount, v_rate_currency, v_rate_unit, v_min_days, v_max_days
  FROM   public.trade_marketplace_ad_slots
  WHERE  id = p_slot_id AND activo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Espacio no encontrado o no disponible: %', p_slot_id;
  END IF;

  v_days := (p_fin - p_inicio) + 1;

  IF v_min_days IS NOT NULL AND v_days < v_min_days THEN
    RAISE EXCEPTION 'La duración mínima para este espacio es % días (seleccionaste %)', v_min_days, v_days;
  END IF;
  IF v_max_days IS NOT NULL AND v_days > v_max_days THEN
    RAISE EXCEPTION 'La duración máxima para este espacio es % días (seleccionaste %)', v_max_days, v_days;
  END IF;

  IF v_rate_amount IS NOT NULL AND v_rate_unit IS NOT NULL THEN
    v_estimated_total := CASE v_rate_unit
      WHEN 'day'   THEN v_rate_amount * v_days
      WHEN 'week'  THEN v_rate_amount * CEIL(v_days::numeric / 7)
      WHEN 'month' THEN v_rate_amount * CEIL(v_days::numeric / 30)
      ELSE NULL
    END;
  END IF;

  -- Resolución de target: multiselección (target_ids) tiene prioridad
  IF p_target_type = 'TRADE' AND p_target_ids IS NOT NULL AND array_length(p_target_ids, 1) > 0 THEN
    -- Multiselección de gremios
    SELECT array_agg(nombre ORDER BY nombre) INTO v_target_labels
    FROM public.trade_maintenance_oficios
    WHERE id = ANY(p_target_ids) AND activo = true;

    v_target_label := array_to_string(v_target_labels, ', ');
    -- p_target_id = primer elemento para compat con columna singular
    p_target_id := p_target_ids[1];

  ELSIF p_target_type IS NOT NULL AND p_target_id IS NOT NULL THEN
    IF p_target_type = 'CATEGORY' THEN
      SELECT nombre INTO v_target_label FROM public.trade_marketplace_categories WHERE id = p_target_id AND activa = true;
    ELSIF p_target_type = 'TRADE' THEN
      SELECT nombre INTO v_target_label FROM public.trade_maintenance_oficios WHERE id = p_target_id AND activo = true;
    ELSIF p_target_type = 'BRAND' THEN
      SELECT nombre INTO v_target_label FROM public.trade_marketplace_brands WHERE id = p_target_id AND activa = true;
    ELSIF p_target_type = 'SUPPLIER' THEN
      IF p_target_id <> p_actor_id THEN
        RAISE EXCEPTION 'Un proveedor solo puede promocionarse a sí mismo como SUPPLIER';
      END IF;
      SELECT nombre INTO v_target_label FROM public.trade_marketplace_actors WHERE id = p_target_id;
    ELSIF p_target_type = 'PRODUCT' THEN
      SELECT nombre_canonico INTO v_target_label FROM public.trade_marketplace_universal_products WHERE id = p_target_id AND validation_state = 'VALIDATED';
    ELSIF p_target_type = 'OFFERING' THEN
      SELECT o.descripcion_comercial INTO v_target_label
      FROM public.trade_marketplace_supplier_offerings o
      JOIN public.trade_marketplace_actors a ON a.supplier_catalog_id = o.supplier_catalog_id
      WHERE o.id = p_target_id AND a.id = p_actor_id AND o.activa = true;
    ELSE
      RAISE EXCEPTION 'Tipo de objetivo no reconocido: %', p_target_type;
    END IF;

    IF v_target_label IS NULL THEN
      RAISE EXCEPTION 'Objetivo no encontrado o no disponible (tipo: %, id: %)', p_target_type, p_target_id;
    END IF;
  END IF;

  INSERT INTO public.trade_marketplace_ad_bookings (
    slot_id, actor_id, estado, inicio, fin, origen, notas,
    target_type, target_id, target_label, target_ids,
    rate_amount_snapshot, rate_currency_snapshot, rate_unit_snapshot,
    estimated_days_snapshot, estimated_total_snapshot,
    commercial_terms_snapshot
  ) VALUES (
    p_slot_id, p_actor_id, 'REQUESTED', p_inicio, p_fin, 'portal_supplier',
    p_mensaje,
    p_target_type, p_target_id, v_target_label,
    CASE WHEN p_target_type = 'TRADE' AND p_target_ids IS NOT NULL THEN p_target_ids ELSE NULL END,
    v_rate_amount, COALESCE(v_rate_currency, 'EUR'), v_rate_unit,
    v_days, v_estimated_total,
    jsonb_build_object(
      'rate_amount',      v_rate_amount,
      'rate_currency',    COALESCE(v_rate_currency, 'EUR'),
      'rate_unit',        v_rate_unit,
      'days',             v_days,
      'estimated_total',  v_estimated_total,
      'target_type',      p_target_type,
      'target_label',     v_target_label,
      'target_ids',       p_target_ids,
      'snapshot_at',      now()::text
    )
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('request_id', v_booking_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_ad_slot_v2(uuid, text, date, date, text, text, uuid, uuid[])
  TO authenticated;
