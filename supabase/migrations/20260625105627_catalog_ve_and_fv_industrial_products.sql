
-- ═══════════════════════════════════════════════════════════════
-- CATÁLOGO VE — Vehículo Eléctrico / Instalación Wallbox
-- ═══════════════════════════════════════════════════════════════
INSERT INTO trade_global_catalog (oficio, familia, codigo, descripcion, unidad, precio_referencia, activo) VALUES

-- Cargadores
('Vehículo Eléctrico','Cargadores','VE-CAR-7M',    'Cargador wallbox 7,4kW monofásico Modo 3 tipo 2',             'ud', 320.00, true),
('Vehículo Eléctrico','Cargadores','VE-CAR-7M-CAB', 'Cargador wallbox 7,4kW monofásico con cable 5m incorporado',  'ud', 390.00, true),
('Vehículo Eléctrico','Cargadores','VE-CAR-11T',    'Cargador wallbox 11kW trifásico Modo 3 tipo 2',               'ud', 480.00, true),
('Vehículo Eléctrico','Cargadores','VE-CAR-22T',    'Cargador wallbox 22kW trifásico Modo 3 tipo 2',               'ud', 620.00, true),
('Vehículo Eléctrico','Cargadores','VE-CAR-22T-GES','Cargador wallbox 22kW trifásico con gestión energética OCPP', 'ud', 890.00, true),
('Vehículo Eléctrico','Cargadores','VE-CAR-SOLAR',  'Cargador wallbox 7,4kW con gestión solar integrada',          'ud', 650.00, true),

-- Cable y canalización
('Vehículo Eléctrico','Cable y canalización','VE-CAB-6M',   'Cable RV-K 3G6mm² monofásico (metro)',          'ml',  2.20, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAB-10M',  'Cable RV-K 3G10mm² monofásico (metro)',         'ml',  3.50, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAB-16M',  'Cable RV-K 3G16mm² monofásico (metro)',         'ml',  5.20, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAB-6T',   'Cable RV-K 5G6mm² trifásico (metro)',           'ml',  3.80, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAB-10T',  'Cable RV-K 5G10mm² trifásico (metro)',          'ml',  5.90, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAN-M20',  'Tubo corrugado M20 libre halógenos (metro)',    'ml',  0.65, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAN-M25',  'Tubo corrugado M25 libre halógenos (metro)',    'ml',  0.85, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAN-RIG',  'Tubo rígido PVC Ø25 garaje (metro)',            'ml',  1.20, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAN-BAN',  'Bandeja perforada 60x100 galvanizada (metro)',  'ml',  8.50, true),
('Vehículo Eléctrico','Cable y canalización','VE-CAN-OBRA', 'Rozas y obra civil canalización (metro lineal)','ml', 12.00, true),

-- Protecciones
('Vehículo Eléctrico','Protecciones','VE-PRO-DIFA40',  'Diferencial tipo A 40A 30mA (ITC-BT-52 obligatorio VE)',  'ud',  68.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-DIFA25',  'Diferencial tipo A 25A 30mA',                             'ud',  62.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-MAG40C',  'Magnetotérmico 1P+N 40A curva C',                         'ud',  22.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-MAG25C',  'Magnetotérmico 1P+N 25A curva C',                         'ud',  18.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-MAG3P40', 'Magnetotérmico 3P 40A curva C trifásico',                 'ud',  45.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-SURGE',   'Protector sobretensiones tipo 2 (1+N)',                   'ud',  85.00, true),
('Vehículo Eléctrico','Protecciones','VE-PRO-CAJA',    'Caja estanca IP55 para protecciones',                     'ud',  28.00, true),

-- Cuadros
('Vehículo Eléctrico','Cuadros','VE-CUA-SUB1',  'Subcuadro 1 cargador: diferencial tipo A + magnetotérmico',  'ud', 145.00, true),
('Vehículo Eléctrico','Cuadros','VE-CUA-SUB4',  'Subcuadro 4 cargadores con gestión de carga',                'ud', 520.00, true),
('Vehículo Eléctrico','Cuadros','VE-CUA-MEDI',  'Equipo de medida individual con ICP',                        'ud', 185.00, true),

-- Tramitación y legalización
('Vehículo Eléctrico','Tramitación','VE-LEG-BOL',   'Boletín eléctrico CIRCE (certificado instalación BT)',    'ud', 120.00, true),
('Vehículo Eléctrico','Tramitación','VE-LEG-PRO',   'Proyecto técnico instalación VE (>10kW o comunitario)',   'ud', 380.00, true),
('Vehículo Eléctrico','Tramitación','VE-LEG-MOVES', 'Gestión subvención MOVES III (tramitación completa)',     'ud', 180.00, true),
('Vehículo Eléctrico','Tramitación','VE-LEG-COMU',  'Comunicación fehacienta a comunidad de propietarios',    'ud',  95.00, true),
('Vehículo Eléctrico','Tramitación','VE-LEG-DISTR', 'Solicitud a distribuidora aumento potencia/nuevo sumin.', 'ud', 150.00, true),

-- Mano de obra
('Vehículo Eléctrico','Mano de obra','VE-MO-TEC', 'Técnico instalador eléctrico VE (hora)',    'h',  52.00, true),
('Vehículo Eléctrico','Mano de obra','VE-MO-AYU', 'Ayudante instalador VE (hora)',             'h',  34.00, true),
('Vehículo Eléctrico','Mano de obra','VE-MO-DES', 'Desplazamiento',                            'ud', 38.00, true),

-- Instalaciones llave en mano
('Vehículo Eléctrico','Instalaciones','VE-INS-7UNI',  'Instalación wallbox 7,4kW vivienda unifamiliar c/material',       'ud', 980.00,  true),
('Vehículo Eléctrico','Instalaciones','VE-INS-7GAR',  'Instalación wallbox 7,4kW garaje comunitario 25m c/material',     'ud', 1350.00, true),
('Vehículo Eléctrico','Instalaciones','VE-INS-22GAR', 'Instalación wallbox 22kW trifásico garaje comunitario c/material', 'ud', 1850.00, true),
('Vehículo Eléctrico','Instalaciones','VE-INS-MULTI', 'Instalación multipunto 4 cargadores garaje c/gestión de carga',   'ud', 5200.00, true);


-- ═══════════════════════════════════════════════════════════════
-- CATÁLOGO FV INDUSTRIAL — ampliación de "Energía Solar"
-- ═══════════════════════════════════════════════════════════════
INSERT INTO trade_global_catalog (oficio, familia, codigo, descripcion, unidad, precio_referencia, activo) VALUES

-- Paneles industriales
('Energía Solar','Paneles fotovoltaicos','SOL-PAN-600',     'Panel fotovoltaico monocristalino 600Wp industrial',         'ud', 210.00, true),
('Energía Solar','Paneles fotovoltaicos','SOL-PAN-BIFI600',  'Panel bifacial doble vidrio 600Wp (suelo/cubierta plana)',   'ud', 245.00, true),

-- Inversores industriales
('Energía Solar','Inversores','SOL-INV-15K',    'Inversor string 15kW trifásico',         'ud', 1650.00, true),
('Energía Solar','Inversores','SOL-INV-20K',    'Inversor string 20kW trifásico',         'ud', 2100.00, true),
('Energía Solar','Inversores','SOL-INV-30K',    'Inversor string 30kW trifásico',         'ud', 2900.00, true),
('Energía Solar','Inversores','SOL-INV-50K',    'Inversor central 50kW trifásico',        'ud', 4200.00, true),
('Energía Solar','Inversores','SOL-INV-MICRO',  'Microinversor 400-600W por panel',       'ud',  165.00, true),
('Energía Solar','Inversores','SOL-INV-OPT',    'Optimizador de potencia por panel',      'ud',   85.00, true),

-- Cableado DC industrial
('Energía Solar','Cableado','SOL-CAB-10DC',  'Cable solar 10mm² (metro)',   'ml',  2.10, true),
('Energía Solar','Cableado','SOL-CAB-16DC',  'Cable solar 16mm² (metro)',   'ml',  3.20, true),
('Energía Solar','Cableado','SOL-CAB-STRB',  'String combiner box 8 entradas c/fusibles', 'ud', 285.00, true),

-- Estructura industrial
('Energía Solar','Estructura','SOL-EST-IND-HOR', 'Estructura suelo anclaje hormigón industrial (por panel)', 'ud', 52.00, true),
('Energía Solar','Estructura','SOL-EST-IND-CUB', 'Estructura cubierta industrial metálica (por panel)',     'ud', 45.00, true),
('Energía Solar','Estructura','SOL-EST-TRAKER',  'Seguidor solar 1 eje (precio por panel)',                 'ud', 95.00, true),

-- Protecciones AC industrial
('Energía Solar','Protecciones','SOL-PRO-IGA63',  'IGA 63A 3P+N AC salida inversor',          'ud',  95.00, true),
('Energía Solar','Protecciones','SOL-PRO-IGA100', 'IGA 100A 3P+N AC',                          'ud', 145.00, true),
('Energía Solar','Protecciones','SOL-PRO-RELVER', 'Relé de vertido / protección de isla',      'ud', 320.00, true),
('Energía Solar','Protecciones','SOL-PRO-ANAT',   'Analizador de red trifásico (monitoriz.)',  'ud', 190.00, true),

-- Monitorización
('Energía Solar','Protecciones','SOL-MON-PRO',    'Sistema monitorización profesional hasta 100kW (datalogger + nube)', 'ud', 280.00, true),

-- Tramitación industrial
('Energía Solar','Instalaciones','SOL-RAI-PREINSC', 'Preinscripción RAIPRE + tramitación REE',            'ud', 380.00, true),
('Energía Solar','Instalaciones','SOL-LEG-IND',     'Legalización industrial + proyecto ingeniería (>10kW)', 'ud', 850.00, true),
('Energía Solar','Instalaciones','SOL-ATR-RED',     'Solicitud ATR conexión red (autoconsumo con excedentes)', 'ud', 220.00, true),

-- Instalaciones industriales llave en mano
('Energía Solar','Instalaciones','SOL-INS-20K-IND',  'Instalación FV 20kW industrial c/material',   'ud', 32000.00, true),
('Energía Solar','Instalaciones','SOL-INS-50K-IND',  'Instalación FV 50kW industrial c/material',   'ud', 72000.00, true),
('Energía Solar','Instalaciones','SOL-INS-100K-IND', 'Instalación FV 100kW industrial c/material',  'ud',130000.00, true);
;
