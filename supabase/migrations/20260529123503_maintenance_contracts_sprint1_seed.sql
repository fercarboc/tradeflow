
-- ══════════════════════════════════════════════════════════════════════
-- SPRINT 1 — Seed catálogos mantenimiento
-- ══════════════════════════════════════════════════════════════════════

-- ── 7 Oficios ────────────────────────────────────────────────────────

INSERT INTO trade_maintenance_oficios (codigo, nombre, descripcion, icono) VALUES
('fontaneria',   'Fontanería',             'Instalaciones de agua, saneamiento, ACS, gas',                             'Droplets'),
('electricidad', 'Electricidad',           'Instalaciones eléctricas BT, media tensión, grupos electrógenos',          'Zap'),
('climatizacion','Climatización / HVAC',   'Aire acondicionado, ventilación, calefacción central, bombas de calor',    'Wind'),
('limpieza',     'Limpieza Industrial',    'Limpieza técnica de instalaciones, zonas industriales, espacios comunes',  'Sparkles'),
('jardineria',   'Jardinería',             'Mantenimiento de zonas verdes, riego, podas periódicas',                   'Leaf'),
('informatica',  'Informática / Redes',    'Mantenimiento de equipos, redes, servidores, ciberseguridad básica',       'Wifi'),
('ascensores',   'Ascensores / Elevadores','Mantenimiento preventivo y correctivo de elevadores',                      'ArrowUpDown')
ON CONFLICT (codigo) DO NOTHING;

-- ── 4 Niveles SLA ────────────────────────────────────────────────────

INSERT INTO trade_maintenance_sla (nivel, nombre, tiempo_respuesta_min, tiempo_resolucion_min, descripcion, color) VALUES
('critico',    'SLA Crítico',               15,    30,   'Parada de actividad total. 15 min respuesta, 30 min resolución o guardia activa', '#ef4444'),
('urgente',    'SLA Urgente',               60,   240,   'Actividad comprometida. Respuesta 1h, resolución 4h',                            '#f97316'),
('normal',     'SLA Normal',               240,  1440,   'Sin parada de actividad. Respuesta 4h hábiles, resolución 24h',                  '#3b82f6'),
('preventivo', 'Mantenimiento Preventivo', 1440,  2880,  'Visitas programadas. Sin urgencia. 24-48h para coordinación',                    '#10b981')
ON CONFLICT (nivel) DO NOTHING;

-- ── 14 Sectores ──────────────────────────────────────────────────────

INSERT INTO trade_maintenance_sectores (codigo, nombre) VALUES
('oficinas',           'Oficinas y Espacios de Trabajo'),
('comunidad',          'Comunidad de Propietarios'),
('industrial_general', 'Industrial General'),
('alimentario',        'Industria Alimentaria'),
('hospitalario',       'Hospitalario y Salud'),
('hotelero',           'Hotelero y Turismo'),
('retail',             'Retail y Comercio'),
('logistica',          'Logística y Almacenes'),
('restauracion',       'Restauración y Hostelería'),
('gasolineras',        'Gasolineras y Talleres'),
('educacion',          'Educación y Cultura'),
('farmaceutico',       'Farmacéutico y Laboratorios'),
('taller_automocion',  'Taller y Automoción'),
('supermercado',       'Supermercados y Grandes Superficies')
ON CONFLICT (codigo) DO NOTHING;

-- ── 8 Recargos ───────────────────────────────────────────────────────

INSERT INTO trade_maintenance_recargos (codigo, nombre, tipo, porcentaje, descripcion) VALUES
('sabado',       'Sábado',                'horario',  25, 'Trabajos realizados en sábado'),
('domingo',      'Domingo',               'horario',  40, 'Trabajos realizados en domingo'),
('festivo',      'Festivo',               'horario',  50, 'Días festivos nacionales o locales'),
('nocturno',     'Nocturno (22h-06h)',    'horario',  35, 'Trabajos entre las 22:00 y las 06:00'),
('urgencia_2h',  'Urgencia < 2h',         'urgencia', 40, 'Respuesta urgente garantizada en menos de 2 horas'),
('urgencia_1h',  'Urgencia < 1h',         'urgencia', 60, 'Respuesta urgente garantizada en menos de 1 hora'),
('guardia_24h',  'Guardia 24h / 7d',      'guardia',  70, 'Disponibilidad plena 24 horas los 7 días de la semana'),
('sla_maximo',   'SLA Máximo Garantizado','urgencia', 85, 'Nivel máximo de garantía SLA con penalización si no se cumple')
ON CONFLICT (codigo) DO NOTHING;

-- ── 12 Plantillas prioritarias ───────────────────────────────────────

INSERT INTO trade_maintenance_plantillas
  (codigo, nombre, oficio_id, sector_id, sla_nivel,
   precio_min, precio_max, cuota_mensual_base,
   incluye_preventivos, incluye_guardia, num_visitas_preventivo, frecuencia_preventivo,
   materiales_incluidos, penalizacion_sla_pct, variables, clausulas_adicionales)
VALUES
(
  'fontaneria_industrial_alimentaria',
  'Fontanería Industrial Alimentaria',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'fontaneria'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'alimentario'),
  'critico', 700, 2500, 1200,
  true, true, 2, 'mensual', false, 15,
  ARRAY['nombre_empresa','direccion','descripcion_instalacion','num_puntos_agua','tiene_camara_fria','horario_actividad'],
  'Los materiales empleados en intervenciones correctivas no están incluidos. Se facturarán a precio de coste +15% gestión.'
),
(
  'fontaneria_comunidad',
  'Fontanería Comunidad de Propietarios',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'fontaneria'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'comunidad'),
  'urgente', 200, 600, 350,
  true, false, 1, 'trimestral', false, 0,
  ARRAY['nombre_comunidad','direccion','num_viviendas','num_ascensores_agua','tiene_piscina','tiene_riego'],
  'Revisión trimestral de zonas comunes. No se incluyen intervenciones en pisos particulares.'
),
(
  'electricidad_hospital',
  'Electricidad Hospitalaria',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'electricidad'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'hospitalario'),
  'critico', 2000, 10000, 4500,
  true, true, 1, 'mensual', false, 20,
  ARRAY['nombre_centro','direccion','potencia_contratada_kw','tiene_grupo_electrogeno','num_cuadros','superficie_m2'],
  'Guardia 24h/7d para instalaciones críticas de soporte vital. Respuesta máxima 15 minutos para avisos críticos.'
),
(
  'climatizacion_hotel',
  'Climatización Hotelera',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'climatizacion'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'hotelero'),
  'urgente', 1000, 6000, 2500,
  true, false, 2, 'bimensual', false, 10,
  ARRAY['nombre_hotel','direccion','num_habitaciones','num_equipos_split','tiene_chiller','tiene_bomba_calor','marca_principal'],
  'Limpieza de filtros incluida en cada visita. Los gases refrigerantes se facturan aparte.'
),
(
  'frio_supermercado',
  'Frío Industrial Supermercado',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'climatizacion'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'supermercado'),
  'critico', 800, 3500, 1800,
  true, true, 2, 'mensual', false, 15,
  ARRAY['nombre_supermercado','direccion','num_lineales_frio','num_camaras','marca_equipos','superficie_venta_m2'],
  'Guardia urgente para instalaciones de frío conservación de alimentos. Respuesta máxima 1h para evitar pérdida de producto.'
),
(
  'limpieza_oficinas',
  'Limpieza Técnica Oficinas',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'limpieza'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'oficinas'),
  'preventivo', 180, 1200, 450,
  true, false, 4, 'semanal', true, 0,
  ARRAY['nombre_empresa','direccion','superficie_m2','num_plantas','horario_acceso','tiene_cocina','tiene_sala_servidor'],
  'Se incluyen todos los materiales de limpieza. Personal con acceso según horario acordado con el responsable del cliente.'
),
(
  'electricidad_industrial',
  'Electricidad Industrial General',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'electricidad'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'industrial_general'),
  'urgente', 500, 3000, 1200,
  true, false, 1, 'trimestral', false, 10,
  ARRAY['nombre_empresa','direccion','potencia_kw','num_cuadros','num_maquinas_criticas','horario_produccion'],
  'Revisión de todos los cuadros y conexiones incluida. Materiales con necesidad de reposición se presupuestan aparte.'
),
(
  'fontaneria_restauracion',
  'Fontanería Restauración',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'fontaneria'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'restauracion'),
  'urgente', 300, 900, 500,
  true, false, 1, 'bimensual', false, 0,
  ARRAY['nombre_local','direccion','num_maquinas_lavacopas','tiene_camara_frigorifica','horario_apertura','aforo'],
  'Atención prioritaria en horario de servicio para no interrumpir la actividad del restaurante.'
),
(
  'jardineria_comunidad',
  'Jardinería Comunidad de Propietarios',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'jardineria'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'comunidad'),
  'preventivo', 150, 800, 300,
  true, false, 2, 'mensual', true, 0,
  ARRAY['nombre_comunidad','direccion','superficie_zonas_verdes_m2','tiene_piscina','tiene_riego_automatico','num_arboles'],
  'Se incluyen materiales fungibles (abonos, fitosanitarios, sustrato). Plantaciones nuevas no incluidas.'
),
(
  'ascensores_edificio',
  'Ascensores Edificio Residencial',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'ascensores'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'comunidad'),
  'urgente', 80, 300, 150,
  true, false, 1, 'mensual', false, 5,
  ARRAY['nombre_comunidad','direccion','marca_ascensor','modelo','num_paradas','anio_instalacion','num_ascensores'],
  'Mantenimiento obligatorio según normativa vigente. Incluye certificado anual de revisión.'
),
(
  'informatica_oficinas',
  'Informática y Redes Oficinas',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'informatica'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'oficinas'),
  'normal', 200, 1500, 600,
  true, false, 1, 'mensual', false, 0,
  ARRAY['nombre_empresa','direccion','num_equipos','num_servidores','tipo_red','tiene_nube','num_usuarios'],
  'Soporte remoto ilimitado y visita presencial mensual incluidos. El hardware defectuoso no está incluido.'
),
(
  'climatizacion_industrial',
  'Climatización Industrial',
  (SELECT id FROM trade_maintenance_oficios  WHERE codigo = 'climatizacion'),
  (SELECT id FROM trade_maintenance_sectores WHERE codigo = 'industrial_general'),
  'urgente', 600, 4000, 1800,
  true, false, 2, 'trimestral', false, 10,
  ARRAY['nombre_empresa','direccion','superficie_m2','potencia_frigorifica_kw','num_equipos','marca_principal','tipo_produccion'],
  'Revisión semestral completa. Limpieza de condensadores y baterías incluida en cada visita.'
)
ON CONFLICT (codigo) DO NOTHING;
;
