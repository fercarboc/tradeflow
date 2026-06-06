import { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, X, Loader2, CheckCircle, Sparkles, ChevronLeft,
  ShieldCheck, Clock, Wrench, AlertTriangle, Plus, Trash2,
  Search, UserPlus, Building2, User,
} from 'lucide-react';
import { saveMaintenancePresupuesto, loadClients, addClient } from '../lib/supabase';
import type { TradeClient } from '../lib/supabase';

// ── Sectores ──────────────────────────────────────────────────────────────────
const SECTORES = [
  { icon: '🏭', label: 'Industrial / Fábrica',        sla: '1h urgente',   cobertura: '8/5',          criticidad: 'Muy alta' },
  { icon: '🧊', label: 'Alimentación / Frío',          sla: '1h',           cobertura: '24/7',         criticidad: 'Muy alta' },
  { icon: '🏨', label: 'Hostelería',                   sla: '2h',           cobertura: '8/5',          criticidad: 'Alta' },
  { icon: '🏥', label: 'Hospital / Clínica',           sla: '15 min',       cobertura: '24/7/365',     criticidad: 'Extrema' },
  { icon: '🔥', label: 'PCI — Contra Incendios',       sla: 'Inmediato',    cobertura: '24/7/365',     criticidad: 'Extrema' },
  { icon: '🏢', label: 'Oficinas',                     sla: '4h',           cobertura: '8/5',          criticidad: 'Normal' },
  { icon: '🌐', label: 'Redes IT',                     sla: '1h remoto',    cobertura: '8/5',          criticidad: 'Alta' },
  { icon: '🛒', label: 'Retail / Supermercado',        sla: '30 min frío',  cobertura: '24/7',         criticidad: 'Muy alta' },
  { icon: '🏘️', label: 'Comunidades',                 sla: '4h',           cobertura: '8/5',          criticidad: 'Normal' },
  { icon: '🏦', label: 'Banca y Seguros',              sla: '2h',           cobertura: '8/5',          criticidad: 'Muy alta' },
  { icon: '💊', label: 'Farmacéutico / Lab.',          sla: '1h',           cobertura: '8/5',          criticidad: 'Muy alta' },
  { icon: '🏛️', label: 'Admin. Pública',              sla: '4h',           cobertura: '8/5',          criticidad: 'Normal' },
  { icon: '🎓', label: 'Colegios y Educación',         sla: '4h',           cobertura: '8/5',          criticidad: 'Normal' },
  { icon: '🧓', label: 'Residencias de Mayores',       sla: '1h',           cobertura: '24/7/365',     criticidad: 'Extrema' },
  { icon: '🌾', label: 'Agricultura y Ganadería',      sla: '2h',           cobertura: '8/5',          criticidad: 'Alta' },
  { icon: '🚛', label: 'Naves Logísticas',             sla: '1h',           cobertura: '24/7',         criticidad: 'Muy alta' },
  { icon: '🏋️', label: 'Centros Deportivos',          sla: '2h',           cobertura: '8/5',          criticidad: 'Alta' },
  { icon: '☀️', label: 'Energía Solar / FV',           sla: '4h',           cobertura: '8/5',          criticidad: 'Normal' },
  { icon: '🚗', label: 'Automoción / Taller',          sla: '2h',           cobertura: '8/5',          criticidad: 'Alta' },
  { icon: '🖥️', label: 'Data Center / CPD',           sla: '15 min',       cobertura: '24/7/365',     criticidad: 'Extrema' },
  { icon: '🅿️', label: 'Parking y Garajes',           sla: '1h acceso',    cobertura: 'personalizada', criticidad: 'Alta' },
  { icon: '🏗️', label: 'Obras y Construcción',        sla: '4h',           cobertura: 'personalizada', criticidad: 'Alta' },
  { icon: '📡', label: 'Telecomunicaciones',           sla: '1h red',       cobertura: '24/7',         criticidad: 'Muy alta' },
];

// ── Interfaces ────────────────────────────────────────────────────────────────
interface SectorDetalles {
  num_equipos: string;
  potencia_kw: string;
  cobertura: '8/5' | '24/7' | '24/7/365' | 'personalizada';
  visitas_anuales: '1' | '2' | '4' | '12' | '24';
  incluye_piezas: boolean;
  recargo_urgencias: boolean;
  zona: string;
  notas_extra: string;
}

interface ClausulaItem {
  descripcion: string;
  tipo: 'servicio' | 'material' | 'mano_de_obra';
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
}

type Phase = 'cliente' | 'sector' | 'detalles' | 'voz' | 'resultado';

export interface ScreenMantenimientoWizardProps {
  onConfirm: () => void;
  onClose: () => void;
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Equipos típicos por sector (cuando el usuario no describe nada) ────────────
const EQUIPOS_TIPICOS: Record<string, string> = {
  'Industrial / Fábrica':
    'Equipos instalados típicos: compresores de aire comprimido (tornillo y pistón), enfriadoras de agua (chillers), torres de refrigeración, sistemas VRV/VRF de climatización industrial, grupos electrógenos de emergencia, cuadros eléctricos de fuerza y control, bombas hidráulicas, sistemas de aspiración industrial, filtros y descalcificadores de agua.',
  'Alimentación / Frío':
    'Equipos instalados típicos: cámaras frigoríficas positivas (+2/+4°C), cámaras de congelación (-18/-22°C), túneles de congelación en espiral, vitrinas refrigeradas de exposición y murales, evaporadores y condensadores de media/alta temperatura, compresores semi-herméticos y herméticos, centrales de refrigeración, cuadros de regulación electrónica.',
  'Hostelería':
    'Equipos instalados típicos: unidades split de climatización sala y cocina, campanas extractoras de acero inoxidable con motor y filtros de grasas, lavavajillas industrial tipo capota y cinta, cámaras frigoríficas de cocina (positivos y negativos), maquinaria de cocina industrial, termo acumuladores, sistemas de renovación de aire con recuperación de calor.',
  'Hospital / Clínica':
    'Equipos instalados típicos: UTAs (unidades de tratamiento de aire) hospitalarias con filtros HEPA H14, climatización de quirófanos (ISO 5-7) con flujo laminar, grupos de presión de agua sanitaria con redundancia, grupos electrógenos de emergencia con ATS, SAI hospitalario para equipos críticos, sistemas de gases medicinales (oxígeno, vacío, aire medicinal), calderas de vapor y agua caliente.',
  'Oficinas':
    'Equipos instalados típicos: unidades split de climatización inverter (cassette y conducto), fancoils de agua fría/caliente, recuperadores de calor entálpicos, ventilación mecánica controlada (VMC), SAI (sistemas de alimentación ininterrumpida) para servidores y CPD ofimático, cuadros eléctricos y grupo de fuerza, sistemas de control y gestión técnica del edificio (BMS/GTB).',
  'Redes IT':
    'Equipos instalados típicos: servidores rack (torre y blade) en CPD, climatización precisión (precision cooling) tipo downflow y upflow, SAI/UPS de rack y modulares con bypass, switches de core, distribución y acceso (capa 2/3), routers y firewalls perimetrales, sistemas de vigilancia CCTV IP, sistemas de detección precoz de incendio (VESDA), PDUs de rack con monitorización.',
  'Retail / Supermercado':
    'Equipos instalados típicos: murales frigoríficos de lácteos, charcutería y bebidas, islas y arcones de congelados, cámaras de producto terminado y trastienda, racks centralizados de compresores (Bitzer, Copeland), condensadores remotos en cubierta, equipos split de climatización sala de ventas, sistema de monitorización centralizada de temperaturas.',
  'Comunidades':
    'Equipos instalados típicos: ascensores (cabina, grupo tractor, cuadro de maniobras), grupos de presión de agua para suministro, calderas de condensación y biomasa para calefacción centralizada, bombas de recirculación de ACS, depuradora de piscina comunitaria (bomba, filtro, dosificador de cloro, climatizador), ventilación forzada de garaje (jet fans y centralita CO), sistema de intercomunicación y control de accesos.',
  'PCI — Contra Incendios':
    'Sistemas PCI instalados típicos: extintores portátiles (polvo ABC, CO₂), bocas de incendio equipadas (BIE 25mm y 45mm), rociadores automáticos (sprinklers), central de detección de incendios con detectores ópticos y termovelocimétricos, pulsadores manuales de alarma, sirenas y pilotos de señalización, alumbrado de emergencia y señalización evacuación, grupo de presión contra incendios (electrobomba + jockey), hidrantes exteriores, columnas secas, sistema de extinción automática de cocina (ansul/amerex).',
  'Banca y Seguros':
    'Equipos instalados típicos: sistemas de control de acceso biométrico y por tarjeta (Lenel, Honeywell, Bosch), cámaras CCTV IP de alta resolución con grabación redundante, cajas de seguridad y cámaras acorazadas, cajeros automáticos (ATM), sistemas de alarma anti-intrusión y anti-atraco, climatización salas de servidores y CPD interno, SAI/UPS para sistemas críticos, detectores de billetes falsos, puertas blindadas con control de apertura.',
  'Farmacéutico / Lab.':
    'Equipos instalados típicos: UTAs (unidades de tratamiento de aire) con filtros HEPA H13/H14 para salas blancas (ISO 5-7), sistemas de presión diferencial entre zonas (manómetros y control BMS), cámaras de temperatura controlada para medicamentos (+5°C, -20°C, -80°C), autoclaves y esterilizadores, campanas de flujo laminar y de gases, incubadores y centrífugas de laboratorio, sistemas de agua purificada (osmosis inversa, agua para inyección), registradores de temperatura con trazabilidad certificada.',
  'Admin. Pública':
    'Equipos instalados típicos: climatización edificios administrativos (unidades fancoil, UTA central), instalaciones de iluminación LED y alumbrado público (luminarias, armarios de maniobra), fuentes ornamentales y sistemas de riego municipal, semáforos y sistemas de señalización vial, depuradoras de agua y estaciones de bombeo, vehículos y maquinaria municipal (opcional), sistemas de megafonía y CCTV en espacios públicos.',
  'Colegios y Educación':
    'Equipos instalados típicos: calefacción y climatización aulas (radiadores, splits, UTA), sistema de ventilación con control de CO₂ (calidad de aire en aulas), instalaciones de fontanería y aseos (grifos, cisternas, duchas gimnasio), alumbrado de emergencia y señalización evacuación, control de acceso y portería (videoportero, tornos), sistema de megafonía escolar, pantallas digitales y proyectores (no incluidos salvo pacto), pistas deportivas (iluminación, sistemas de riego).',
  'Residencias de Mayores':
    'Equipos instalados típicos: sistemas de climatización 24h con redundancia (cassettes, fancoils, UTA con filtración), ACS centralizada con sistema anti-legionella (acumuladores 60°C, recirculación), grupo electrógeno de emergencia (para sistemas críticos), ascensores con homologación para camillas, sistema de llamada de enfermería (pulsadores habitaciones y baños), instalación contra incendios completa (sprinklers, detección, BIE), sistema de control de accesos, compresor para oxígeno medicinal.',
  'Agricultura y Ganadería':
    'Equipos instalados típicos: motores y bombas de riego (goteo, aspersión, pivot central), sistemas de fertirrigación y dosificación, cámaras frigoríficas para cosecha y productos hortofrutícolas, túneles de secado o frío para almacenamiento, instalaciones de ventilación y climatización de naves ganaderas, equipos de ordeño automático (DeLaval, GEA), silos y transportadores de grano, grupos electrógenos para fincas sin suministro fiable, instalaciones eléctricas de finca (transformadores, cuadros).',
  'Naves Logísticas':
    'Equipos instalados típicos: puertas de muelle seccionales con abrigo de muelle (niveladores, burletes), muelles de carga eléctricos e hidráulicos, puertas rápidas enrollables de alta velocidad, sistemas de transporte automático (cintas, carros AGV), sprinklers y sistema de detección de incendios de gran superficie, instalaciones de carga de baterías para carretillas, climatización de oficinas y zonas de valor añadido, sistemas de gestión de almacén integrados con SCADA, alumbrado LED industrial con telgestión.',
  'Centros Deportivos':
    'Equipos instalados típicos: sistema depuración piscinas (bomba, filtro, dosificador cloro/ácido, sistema UV), climatización vasos de piscina y vestuarios (deshumectadoras), sistemas de Legionella en duchas y ACS, climatización pabellones deportivos (UTA, cortinas de aire), sistemas de ventilación y renovación de aire en salas fitness, máquinas de fitness (no incluidas salvo pacto — garantía fabricante), sistemas de iluminación LED con control DALI, acceso y tornos con sistema de abono, suelos técnicos de parqué flotante (revisión y barnizado).',
  'Energía Solar / FV':
    'Equipos instalados típicos: módulos fotovoltaicos (monocristalinos/policristalinos/bifaciales), inversores de cadena y centrales (SMA, Fronius, Huawei, SolarEdge), optimizadores de potencia y string boxes, contadores de energía bidireccionales, baterías de almacenamiento BYD/Tesla/PYLONTECH, estructura de soporte (cubierta, suelo, marquesina), cableado DC y AC, protecciones (fusibles, varistores, magnetotérmicos), plataforma de monitorización en tiempo real.',
  'Automoción / Taller':
    'Equipos instalados típicos: elevadores de vehículos de 2 y 4 columnas (Ravaglioli, Cascos, Launch), columnas de elevación de tijeras y de fosa, compresores de aire tornillo y pistón con depósito, pistola de impacto y herramienta neumática, máquina de cambio de neumáticos (desmontadora) y equilibradora de ruedas, alineador de dirección 3D, equipos de diagnosis multimarca (Bosch, Snap-on, Texa), puente de lavado automático, banco de pruebas de frenos y emisiones, cargadores de baterías EV.',
  'Data Center / CPD':
    'Equipos instalados típicos: servidores blade y rack (HPE, Dell, Cisco UCS), sistemas UPS modulares redundantes (Vertiv, Eaton, APC) con baterías de litio, climatización de precisión downflow/upflow (Stulz, Liebert, Schneider), grupos electrógenos con ATS automático, sistemas de supresión de incendios gaseoso (FM200, Inergen, CO₂), sistema de monitorización DCIM (temperatura, humedad, energía, seguridad), PDUs de rack inteligentes con medición por toma, switches de core de alta densidad (Cisco Nexus, Juniper), sistemas de KVM y gestión remota.',
  'Parking y Garajes':
    'Equipos instalados típicos: barreras automáticas de acceso (Came, BFT, Faac), terminales de pago automático (parquímetros), sistemas de guiado de vehículos (señalización LED verde/rojo por plaza), detectores de CO/NOx con centralita de alarma y control de ventilación, ventiladores axiales y jet fans para extracción de gases, puertas enrollables y seccionales de acceso, cámaras CCTV con ANPR (lectura de matrículas), alumbrado LED con sensor de presencia, alumbrado de emergencia y señalización evacuación.',
  'Obras y Construcción':
    'Equipos instalados típicos: grúas torre (Liebherr, Potain, Jaso) con cuadro de maniobras, montacargas de obra y plataformas elevadoras (GEDA, Alimak), instalaciones eléctricas provisionales de obra (cuadros ICT, generales y secundarios), grupos electrógenos de obra (400V trifásico), bombas de agua para achique y hormigonado, hormigoneras y camiones bomba (no incluidos), compresores de aire para herramienta neumática, maquinaria de corte y rozadora (no incluidas), instalaciones de alumbrado provisional.',
  'Telecomunicaciones':
    'Equipos instalados típicos: torres de telecomunicación autoportantes y arriostradas (Rohn, Comesa), mástiles en cubierta con pararrayos, equipos de radio BTS/NodeB/eNodeB/gNodeB (Ericsson, Nokia, Huawei, ZTE), sistemas de energía de telecomunicación (rectificadores 48V, baterías AGM/Gel/LFP), sistemas de vigilancia remota NOC (SNMP, NetAct), shelter y abrigos climatizados, líneas de transmisión y sistemas de antenas (RRU, AAU), equipos de microondas PDH/SDH, sistemas fibra óptica y DWDM.',
};

// ── Opciones típicas por sector (chips seleccionables en fase voz) ─────────────
const ITEMS_POR_SECTOR: Record<string, Array<{ label: string; checked: boolean }>> = {
  'Industrial / Fábrica': [
    { label: 'Compresores de aire', checked: true },
    { label: 'Chillers / enfriadoras', checked: true },
    { label: 'Cuadros eléctricos', checked: true },
    { label: 'Sistemas VRV/VRF', checked: false },
    { label: 'Grupos electrógenos', checked: false },
    { label: 'Bombas hidráulicas', checked: false },
    { label: 'Torres de refrigeración', checked: false },
    { label: 'Aspiración industrial', checked: false },
  ],
  'Alimentación / Frío': [
    { label: 'Cámaras frigoríficas (+)', checked: true },
    { label: 'Cámaras de congelación (−)', checked: true },
    { label: 'Central de compresores', checked: true },
    { label: 'Vitrinas refrigeradas', checked: true },
    { label: 'Murales expositores', checked: false },
    { label: 'Condensadores remotos', checked: false },
    { label: 'Monitorización temp.', checked: false },
  ],
  'Hostelería': [
    { label: 'Climatización splits', checked: true },
    { label: 'Campanas extractoras', checked: true },
    { label: 'Cámaras cocina (+/−)', checked: true },
    { label: 'Lavavajillas industrial', checked: false },
    { label: 'Termoacumuladores ACS', checked: false },
    { label: 'Renovación de aire', checked: false },
  ],
  'Hospital / Clínica': [
    { label: 'UTAs hospitalarias HEPA', checked: true },
    { label: 'Climatización quirófanos', checked: true },
    { label: 'Grupos de presión agua', checked: true },
    { label: 'Grupos electrógenos', checked: true },
    { label: 'SAI hospitalario', checked: true },
    { label: 'Gases medicinales', checked: false },
    { label: 'Calderas y ACS', checked: false },
  ],
  'PCI — Contra Incendios': [
    { label: 'Extintores portátiles', checked: true },
    { label: 'BIEs (bocas de incendio)', checked: true },
    { label: 'Central de detección', checked: true },
    { label: 'Detectores y pulsadores', checked: true },
    { label: 'Sirenas y señalización', checked: true },
    { label: 'Alumbrado emergencia', checked: true },
    { label: 'Rociadores / sprinklers', checked: false },
    { label: 'Grupo de presión CI', checked: false },
    { label: 'Hidrantes exteriores', checked: false },
    { label: 'Columnas secas', checked: false },
    { label: 'Extinción cocina (Ansul)', checked: false },
  ],
  'Oficinas': [
    { label: 'Splits inverter / cassette', checked: true },
    { label: 'Cuadros eléctricos', checked: true },
    { label: 'Fancoils agua fría/caliente', checked: false },
    { label: 'Recuperadores de calor', checked: false },
    { label: 'Ventilación mecánica VMC', checked: false },
    { label: 'SAI / UPS servidores', checked: false },
    { label: 'BMS / Gestión edificio', checked: false },
  ],
  'Redes IT': [
    { label: 'Servidores rack', checked: true },
    { label: 'Climatización precisión', checked: true },
    { label: 'SAI/UPS modulares', checked: true },
    { label: 'Switches y routers', checked: true },
    { label: 'Firewalls perimetrales', checked: false },
    { label: 'Cámaras CCTV IP', checked: false },
    { label: 'PDUs inteligentes', checked: false },
    { label: 'Detección VESDA', checked: false },
  ],
  'Retail / Supermercado': [
    { label: 'Murales frigoríficos', checked: true },
    { label: 'Islas y arcones congelados', checked: true },
    { label: 'Central de compresores', checked: true },
    { label: 'Climatización sala ventas', checked: true },
    { label: 'Cámaras de producto', checked: false },
    { label: 'Condensadores cubierta', checked: false },
    { label: 'Monitorización centralizada', checked: false },
  ],
  'Comunidades': [
    { label: 'Ascensores', checked: true },
    { label: 'Grupos de presión agua', checked: true },
    { label: 'Calderas calefacción', checked: false },
    { label: 'Bombas recirculación ACS', checked: false },
    { label: 'Depuradora piscina', checked: false },
    { label: 'Ventilación garaje (CO)', checked: false },
    { label: 'Control de accesos', checked: false },
  ],
  'Banca y Seguros': [
    { label: 'Control acceso biométrico', checked: true },
    { label: 'Cámaras CCTV IP HD', checked: true },
    { label: 'Alarma anti-intrusión', checked: true },
    { label: 'SAI/UPS sistemas críticos', checked: true },
    { label: 'Cajeros automáticos ATM', checked: false },
    { label: 'Climatización CPD interno', checked: false },
    { label: 'Puertas blindadas', checked: false },
  ],
  'Farmacéutico / Lab.': [
    { label: 'UTAs salas blancas HEPA', checked: true },
    { label: 'Control presión diferencial', checked: true },
    { label: 'Registradores trazabilidad', checked: true },
    { label: 'Cámaras temperatura ctrl.', checked: true },
    { label: 'Autoclaves / esterilizadores', checked: false },
    { label: 'Campanas flujo laminar', checked: false },
    { label: 'Agua purificada OI', checked: false },
  ],
  'Admin. Pública': [
    { label: 'Climatización edificio', checked: true },
    { label: 'Cuadros eléctricos', checked: true },
    { label: 'Iluminación LED', checked: false },
    { label: 'Fuentes ornamentales', checked: false },
    { label: 'CCTV espacios públicos', checked: false },
    { label: 'Megafonía', checked: false },
    { label: 'Sistema de riego', checked: false },
  ],
  'Colegios y Educación': [
    { label: 'Calefacción y climatización', checked: true },
    { label: 'Alumbrado emergencia', checked: true },
    { label: 'Fontanería y aseos', checked: true },
    { label: 'Ventilación control CO₂', checked: false },
    { label: 'Control de acceso', checked: false },
    { label: 'Megafonía escolar', checked: false },
    { label: 'Iluminación exterior', checked: false },
  ],
  'Residencias de Mayores': [
    { label: 'Climatización 24h', checked: true },
    { label: 'ACS anti-Legionella', checked: true },
    { label: 'Sistema llamada enfermería', checked: true },
    { label: 'Ascensores (camillas)', checked: true },
    { label: 'Instalación PCI completa', checked: true },
    { label: 'Grupo electrógeno', checked: true },
    { label: 'Control de accesos', checked: false },
    { label: 'Oxígeno medicinal', checked: false },
  ],
  'Agricultura y Ganadería': [
    { label: 'Bombas de riego', checked: true },
    { label: 'Instalaciones eléctricas', checked: true },
    { label: 'Sistema fertirrigación', checked: false },
    { label: 'Cámaras frigoríficas cosecha', checked: false },
    { label: 'Ventilación naves ganaderas', checked: false },
    { label: 'Equipos ordeño automático', checked: false },
    { label: 'Grupos electrógenos', checked: false },
  ],
  'Naves Logísticas': [
    { label: 'Puertas de muelle', checked: true },
    { label: 'Muelles de carga', checked: true },
    { label: 'Puertas rápidas enrollables', checked: true },
    { label: 'Sprinklers / detección', checked: true },
    { label: 'Carga baterías carretillas', checked: false },
    { label: 'Climatización oficinas', checked: false },
    { label: 'Iluminación LED industrial', checked: false },
  ],
  'Centros Deportivos': [
    { label: 'Depuración piscinas', checked: true },
    { label: 'Climatización vasos', checked: true },
    { label: 'ACS + sistema Legionella', checked: true },
    { label: 'Climatización pabellón', checked: false },
    { label: 'Iluminación LED DALI', checked: false },
    { label: 'Control de acceso', checked: false },
    { label: 'Suelos técnicos parqué', checked: false },
  ],
  'Energía Solar / FV': [
    { label: 'Módulos fotovoltaicos', checked: true },
    { label: 'Inversores cadena/central', checked: true },
    { label: 'Contadores bidireccionales', checked: true },
    { label: 'Plataforma monitorización', checked: true },
    { label: 'Baterías almacenamiento', checked: false },
    { label: 'Optimizadores y string box', checked: false },
    { label: 'Estructura soporte', checked: false },
  ],
  'Automoción / Taller': [
    { label: 'Elevadores 2/4 columnas', checked: true },
    { label: 'Compresores de aire', checked: true },
    { label: 'Desmontadora + equilibradora', checked: true },
    { label: 'Alineador de dirección 3D', checked: false },
    { label: 'Equipos de diagnosis', checked: false },
    { label: 'Puente de lavado', checked: false },
    { label: 'Cargadores EV', checked: false },
  ],
  'Data Center / CPD': [
    { label: 'Servidores blade y rack', checked: true },
    { label: 'UPS modulares redundantes', checked: true },
    { label: 'Climatización precisión', checked: true },
    { label: 'Grupos electrógenos ATS', checked: true },
    { label: 'Extinción gaseosa FM200', checked: true },
    { label: 'Sistema DCIM', checked: false },
    { label: 'PDUs inteligentes', checked: false },
    { label: 'Switches core alta densidad', checked: false },
  ],
  'Parking y Garajes': [
    { label: 'Barreras automáticas', checked: true },
    { label: 'Detectores CO/NOx', checked: true },
    { label: 'Ventilación / jet fans', checked: true },
    { label: 'Alumbrado emergencia', checked: true },
    { label: 'Puertas enrollables acceso', checked: true },
    { label: 'Terminales de pago', checked: false },
    { label: 'Cámaras CCTV + ANPR', checked: false },
    { label: 'Iluminación LED', checked: false },
  ],
  'Obras y Construcción': [
    { label: 'Instalaciones eléctricas prov.', checked: true },
    { label: 'Grupos electrógenos obra', checked: false },
    { label: 'Grúas torre', checked: false },
    { label: 'Montacargas de obra', checked: false },
    { label: 'Bombas de achique', checked: false },
    { label: 'Compresores neumáticos', checked: false },
  ],
  'Telecomunicaciones': [
    { label: 'Torres y mástiles', checked: true },
    { label: 'Equipos radio BTS/NodeB', checked: true },
    { label: 'Sistemas energía DC 48V', checked: true },
    { label: 'Baterías AGM/Gel/LFP', checked: true },
    { label: 'Shelter climatizado', checked: false },
    { label: 'Líneas transmisión / antenas', checked: false },
    { label: 'Monitorización NOC', checked: false },
  ],
};

// ── Mapas sector → códigos de BD ─────────────────────────────────────────────
const SECTOR_OFICIO_MAP: Record<string, string> = {
  'Industrial / Fábrica': 'electricidad',
  'Alimentación / Frío': 'climatizacion',
  'Hostelería': 'climatizacion',
  'Hospital / Clínica': 'climatizacion',
  'PCI — Contra Incendios': 'pci',
  'Oficinas': 'climatizacion',
  'Redes IT': 'informatica',
  'Retail / Supermercado': 'climatizacion',
  'Comunidades': 'fontaneria',
  'Banca y Seguros': 'seguridad',
  'Farmacéutico / Lab.': 'climatizacion',
  'Admin. Pública': 'electricidad',
  'Colegios y Educación': 'climatizacion',
  'Residencias de Mayores': 'climatizacion',
  'Agricultura y Ganadería': 'electricidad',
  'Naves Logísticas': 'electricidad',
  'Centros Deportivos': 'fontaneria',
  'Energía Solar / FV': 'energia_solar',
  'Automoción / Taller': 'electricidad',
  'Data Center / CPD': 'informatica',
  'Parking y Garajes': 'electricidad',
  'Obras y Construcción': 'obra_civil',
  'Telecomunicaciones': 'telecomunicaciones',
};

const SECTOR_CODE_MAP: Record<string, string> = {
  'Industrial / Fábrica': 'industrial_general',
  'Alimentación / Frío': 'alimentario',
  'Hostelería': 'hotelero',
  'Hospital / Clínica': 'hospitalario',
  'PCI — Contra Incendios': 'industrial_general',
  'Oficinas': 'oficinas',
  'Redes IT': 'redes_it',
  'Retail / Supermercado': 'supermercado',
  'Comunidades': 'comunidad',
  'Banca y Seguros': 'bancario',
  'Farmacéutico / Lab.': 'farmaceutico',
  'Admin. Pública': 'oficinas',
  'Colegios y Educación': 'educacion',
  'Residencias de Mayores': 'residencia_mayores',
  'Agricultura y Ganadería': 'agricultura',
  'Naves Logísticas': 'logistica',
  'Centros Deportivos': 'deportivo',
  'Energía Solar / FV': 'energia_solar',
  'Automoción / Taller': 'taller_automocion',
  'Data Center / CPD': 'data_center',
  'Parking y Garajes': 'parking',
  'Obras y Construcción': 'obras',
  'Telecomunicaciones': 'telecomunicaciones',
};

const CRITICIDAD_SLA_MAP: Record<string, string> = {
  'Extrema': 'critico',
  'Muy alta': 'urgente',
  'Alta': 'urgente',
  'Normal': 'normal',
};

const FRECUENCIA_MAP: Record<string, string> = {
  '1': 'anual',
  '2': 'semestral',
  '4': 'trimestral',
  '12': 'mensual',
  '24': 'quincenal',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const DEFAULT_DETALLES: SectorDetalles = {
  num_equipos: '1',
  potencia_kw: '',
  cobertura: '8/5',
  visitas_anuales: '2',
  incluye_piezas: false,
  recargo_urgencias: false,
  zona: '',
  notas_extra: '',
};

function buildMantenimientoTexto(
  sector: typeof SECTORES[0],
  d: SectorDetalles,
  extra: string,
): string {
  const lines: string[] = [
    `CONTRATO DE MANTENIMIENTO — ${sector.label.toUpperCase()}`,
    `Criticidad: ${sector.criticidad} | SLA: ${sector.sla} | Cobertura: ${d.cobertura}`,
    `Número de equipos/instalaciones: ${d.num_equipos}`,
  ];
  if (d.potencia_kw) lines.push(`Potencia total instalada: ${d.potencia_kw} kW`);
  lines.push(`Visitas preventivas anuales: ${d.visitas_anuales}`);
  if (d.incluye_piezas) lines.push('Incluye repuestos y piezas en el contrato');
  if (d.recargo_urgencias) lines.push('Incluye recargos por urgencias nocturnas/festivos (según tabla: +25% sábados hasta +70% guardia 24h)');
  if (d.zona) lines.push(`Zona geográfica: ${d.zona}`);
  if (extra.trim()) {
    lines.push(`Descripción adicional del cliente: ${extra.trim()}`);
  } else {
    const tipicos = EQUIPOS_TIPICOS[sector.label];
    if (tipicos) lines.push(tipicos);
  }

  lines.push('');
  lines.push('Genera las partidas de servicio del contrato de mantenimiento:');
  lines.push('- Visitas preventivas (precio/visita o precio anual)');
  lines.push('- Guardia de disponibilidad 24h si aplica (precio/mes)');
  lines.push('- Mano de obra correctiva (precio/hora)');
  lines.push('- Desplazamiento (precio/visita)');
  if (d.incluye_piezas) lines.push('- Repuestos incluidos (estimación anual)');
  lines.push('- Limpieza y mantenimiento preventivo (filtros, consumibles)');
  lines.push(`- Penalización SLA: -5%/hora por cada hora fuera de SLA de ${sector.sla}`);
  lines.push('Expresa las partidas con cantidad, unidad (visita, mes, h, ud) y precio unitario estimado.');

  return lines.join('\n');
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function ScreenMantenimientoWizard({ onConfirm, onClose, orgId, showToast }: ScreenMantenimientoWizardProps) {
  const [phase, setPhase]             = useState<Phase>('cliente');
  const [sector, setSector]           = useState<typeof SECTORES[0] | null>(null);
  const [detalles, setDetalles]       = useState<SectorDetalles>(DEFAULT_DETALLES);
  const [textInput, setTextInput]     = useState('');
  const [recording, setRecording]     = useState(false);
  const [processing, setProcessing]   = useState(false);
  const [clausulas, setClausulas]     = useState<ClausulaItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [saving, setSaving]           = useState(false);
  const recognitionRef                = useRef<unknown>(null);

  // ── Estado de cliente ─────────────────────────────────────────────────────
  const [clientes, setClientes]               = useState<TradeClient[]>([]);
  const [loadingClientes, setLoadingClientes] = useState(true);
  const [searchCliente, setSearchCliente]     = useState('');
  const [clienteId, setClienteId]             = useState<string | null>(null);
  const [clienteNombre, setClienteNombre]     = useState('');
  const [clienteCif, setClienteCif]           = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteEmail, setClienteEmail]       = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteCiudad, setClienteCiudad]       = useState('');
  const [clienteRepresentante, setClienteRepresentante] = useState('');
  const [clienteCargo, setClienteCargo]         = useState('');
  const [modoNuevo, setModoNuevo]             = useState(false);

  useEffect(() => {
    loadClients(orgId)
      .then(cs => setClientes(cs))
      .catch(() => {})
      .finally(() => setLoadingClientes(false));
  }, [orgId]);

  function selectCliente(c: TradeClient) {
    setClienteId(c.id);
    setClienteNombre(c.nombre);
    setClienteCif(c.nif ?? '');
    setClienteTelefono(c.telefono ?? '');
    setClienteEmail(c.email ?? '');
    setClienteDireccion(c.direccion ?? '');
    setClienteCiudad(c.ciudad ?? '');
    setModoNuevo(false);
    setSearchCliente('');
  }

  function clearCliente() {
    setClienteId(null);
    setClienteNombre('');
    setClienteCif('');
    setClienteTelefono('');
    setClienteEmail('');
    setClienteDireccion('');
    setClienteCiudad('');
    setClienteRepresentante('');
    setClienteCargo('');
    setModoNuevo(false);
  }

  const clientesFiltrados = searchCliente.trim()
    ? clientes.filter(c =>
        c.nombre.toLowerCase().includes(searchCliente.toLowerCase()) ||
        (c.nif ?? '').toLowerCase().includes(searchCliente.toLowerCase()) ||
        (c.email ?? '').toLowerCase().includes(searchCliente.toLowerCase()),
      )
    : clientes.slice(0, 8);

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  function setD<K extends keyof SectorDetalles>(key: K, val: SectorDetalles[K]) {
    setDetalles(prev => ({ ...prev, [key]: val }));
  }

  function updateClausula(i: number, key: keyof ClausulaItem, value: ClausulaItem[keyof ClausulaItem]) {
    setClausulas(prev => {
      const next = [...prev];
      const updated = { ...next[i], [key]: value };
      if (key === 'precioUnitario' || key === 'cantidad') {
        updated.total = (key === 'precioUnitario' ? Number(value) : updated.precioUnitario) *
                        (key === 'cantidad' ? Number(value) : updated.cantidad);
      }
      next[i] = updated;
      return next;
    });
  }

  function deleteClausula(i: number) {
    setClausulas(prev => prev.filter((_, idx) => idx !== i));
  }

  function addClausula() {
    setClausulas(prev => [...prev, {
      descripcion: '', tipo: 'servicio', cantidad: 1, unidad: 'ud', precioUnitario: 0, total: 0,
    }]);
  }

  const totalContrato = clausulas.reduce((s, c) => s + (c.precioUnitario * c.cantidad), 0);

  function startRecording() {
    if (!SpeechAPI) { showToast('Dictado no disponible en este navegador. Escribe directamente.', 'info'); return; }
    const r = new SpeechAPI();
    r.lang = 'es-ES'; r.continuous = false; r.interimResults = false;
    r.onresult = (e: any) => {
      const text = (e.results[0]?.[0]?.transcript ?? '').trim();
      setTextInput(prev => prev ? `${prev} ${text}` : text);
    };
    r.onerror = () => { showToast('Error al reconocer voz', 'error'); setRecording(false); };
    r.onend = () => setRecording(false);
    r.start();
    recognitionRef.current = r;
    setRecording(true);
  }

  function stopRecording() { (recognitionRef.current as any)?.stop(); setRecording(false); }

  async function generarContrato() {
    if (!sector) return;
    setProcessing(true);
    try {
      const chips = Object.entries(selectedItems).filter(([, v]) => v).map(([k]) => k);
      const numVisitas = parseInt(detalles.visitas_anuales) || 2;
      const items: ClausulaItem[] = [];
      items.push({
        descripcion: `Revisión preventiva — ${sector.label}`,
        tipo: 'servicio',
        cantidad: numVisitas,
        unidad: 'visita',
        precioUnitario: 150,
        total: numVisitas * 150,
      });
      chips.forEach(chip => items.push({
        descripcion: chip,
        tipo: 'servicio',
        cantidad: numVisitas,
        unidad: 'visita',
        precioUnitario: 0,
        total: 0,
      }));
      items.push({ descripcion: 'Mano de obra correctiva', tipo: 'mano_de_obra', cantidad: 1, unidad: 'h', precioUnitario: 65, total: 65 });
      items.push({ descripcion: 'Desplazamiento', tipo: 'servicio', cantidad: 1, unidad: 'visita', precioUnitario: 40, total: 40 });
      if (detalles.cobertura === '24/7' || detalles.cobertura === '24/7/365') {
        items.push({ descripcion: 'Guardia disponibilidad 24h', tipo: 'servicio', cantidad: 12, unidad: 'mes', precioUnitario: 150, total: 1800 });
      }
      if (detalles.incluye_piezas) {
        items.push({ descripcion: 'Repuestos y materiales (estimación anual)', tipo: 'material', cantidad: 1, unidad: 'año', precioUnitario: 0, total: 0 });
      }
      setClausulas(items);
      setPhase('resultado');
      showToast(`${items.length} partidas generadas — ajusta los precios`, 'success');
    } finally {
      setProcessing(false);
    }
  }

  async function handleSaveDirectly() {
    if (!sector || !orgId) return;
    setSaving(true);
    try {
      // Create new client in CRM if not existing
      let finalClientId = clienteId;
      if (!finalClientId && clienteNombre.trim()) {
        const newClient = await addClient(orgId, {
          nombre: clienteNombre.trim(),
          nif: clienteCif.trim() || undefined,
          telefono: clienteTelefono.trim() || undefined,
          email: clienteEmail.trim() || undefined,
          direccion: clienteDireccion.trim() || undefined,
          ciudad: clienteCiudad.trim() || undefined,
        });
        finalClientId = newClient.id;
      }

      const chips = Object.entries(selectedItems).filter(([, v]) => v).map(([k]) => k);
      const oficio = SECTOR_OFICIO_MAP[sector.label] ?? 'mantenimiento';
      const sectorCode = SECTOR_CODE_MAP[sector.label] ?? 'industrial_general';
      const slaLevel = CRITICIDAD_SLA_MAP[sector.criticidad] ?? 'normal';
      const numVisitas = parseInt(detalles.visitas_anuales) || 2;
      const cuotaAnual = clausulas.reduce((s, c) => s + c.precioUnitario * c.cantidad, 0);
      const descripcionServicios = chips.length > 0
        ? `Mantenimiento ${sector.label}. Equipos: ${chips.join(', ')}.${textInput.trim() ? ` ${textInput.trim()}` : ''}`
        : `Mantenimiento ${sector.label}`;
      await saveMaintenancePresupuesto(orgId, {
        client_id: finalClientId,
        oficio,
        sector: sectorCode,
        nombre_cliente: clienteNombre.trim() || null,
        direccion_instalacion: clienteDireccion.trim() || null,
        sla_nivel: slaLevel,
        cuota_mensual: cuotaAnual / 12,
        cuota_anual: cuotaAnual,
        tipo_facturacion: 'mensual',
        incluye_preventivos: true,
        num_visitas_preventivo: numVisitas,
        incluye_guardia: detalles.cobertura !== '8/5',
        materiales_incluidos: detalles.incluye_piezas,
        descripcion_servicios: descripcionServicios,
        notas: detalles.notas_extra || null,
        ia_json: { clausulas, detalles, sector: sector.label, representante_cliente: clienteRepresentante.trim() || null, cargo_representante: clienteCargo.trim() || null, ciudad_cliente: clienteCiudad.trim() || null },
        generado_por_ia: false,
        estado: 'borrador',
      });
      showToast('Presupuesto de mantenimiento guardado', 'success');
      onConfirm();
    } catch (err) {
      showToast(`Error al guardar: ${String(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (phase === 'sector')    { setPhase('cliente'); return; }
    if (phase === 'detalles')  { setPhase('sector'); return; }
    if (phase === 'voz')       { setPhase('detalles'); return; }
    if (phase === 'resultado') { setPhase('voz'); return; }
    onClose();
  }

  const STEPS: Phase[] = ['cliente', 'sector', 'detalles', 'voz', 'resultado'];
  const stepIdx = STEPS.indexOf(phase);

  return (
    <div className="fixed inset-0 bg-[#0B0F14] z-[60] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/8 shrink-0">
        <button
          onClick={phase === 'sector' ? onClose : handleBack}
          className="flex items-center gap-1.5 text-slate-400 text-sm cursor-pointer"
        >
          {phase === 'sector' ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-bold text-white">Contrato de Mantenimiento</span>
        </div>
        <div className="w-8" />
      </div>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 py-2.5 border-b border-white/8 shrink-0">
        {STEPS.map((s, i) => (
          <div key={s} className={`w-2 h-2 rounded-full transition-all ${
            i === stepIdx ? 'bg-blue-400 scale-125' : i < stepIdx ? 'bg-blue-800' : 'bg-white/10'
          }`} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">

        {/* ── FASE: CLIENTE ── */}
        {phase === 'cliente' && (
          <div className="px-4 py-5 space-y-4 pb-32">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-white">¿Para qué cliente?</h2>
              <p className="text-slate-400 text-sm">Selecciona un cliente existente o crea uno nuevo</p>
            </div>

            {/* Cliente seleccionado */}
            {clienteId && (
              <div className="bg-blue-600/15 border border-blue-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Building2 className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{clienteNombre}</p>
                    {clienteCif && <p className="text-[10px] text-blue-400">{clienteCif}</p>}
                    {clienteDireccion && <p className="text-[10px] text-slate-400 truncate">{clienteDireccion}</p>}
                  </div>
                </div>
                <button onClick={clearCliente} className="p-1 rounded-lg text-slate-500 hover:text-red-400 cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Modo nuevo cliente expandido */}
            {modoNuevo && !clienteId && (
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nuevo cliente</p>
                  <button onClick={() => setModoNuevo(false)} className="p-1 text-slate-600 hover:text-slate-300 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-[9px] text-slate-500 mb-1">Nombre / empresa <span className="text-red-400">*</span></p>
                    <input type="text" value={clienteNombre} onChange={e => setClienteNombre(e.target.value)}
                      placeholder="Empresa Ejemplo S.L." autoFocus
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">CIF / NIF</p>
                      <input type="text" value={clienteCif} onChange={e => setClienteCif(e.target.value)}
                        placeholder="B-12345678"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">Teléfono</p>
                      <input type="tel" value={clienteTelefono} onChange={e => setClienteTelefono(e.target.value)}
                        placeholder="600 000 000"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 mb-1">Email</p>
                    <input type="email" value={clienteEmail} onChange={e => setClienteEmail(e.target.value)}
                      placeholder="contacto@empresa.com"
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">Dirección de la instalación</p>
                      <input type="text" value={clienteDireccion} onChange={e => setClienteDireccion(e.target.value)}
                        placeholder="Calle Ejemplo 1"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">Ciudad</p>
                      <input type="text" value={clienteCiudad} onChange={e => setClienteCiudad(e.target.value)}
                        placeholder="Madrid"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">Representante</p>
                      <input type="text" value={clienteRepresentante} onChange={e => setClienteRepresentante(e.target.value)}
                        placeholder="Juan García"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 mb-1">Cargo</p>
                      <input type="text" value={clienteCargo} onChange={e => setClienteCargo(e.target.value)}
                        placeholder="Gerente"
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Búsqueda y lista si no hay cliente ni modo nuevo */}
            {!clienteId && !modoNuevo && (
              <div className="space-y-3">
                {/* Buscador */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text" value={searchCliente}
                    onChange={e => setSearchCliente(e.target.value)}
                    placeholder="Buscar cliente por nombre, CIF o email…"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {loadingClientes ? (
                  <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-500" /></div>
                ) : clientesFiltrados.length > 0 ? (
                  <div className="space-y-1.5">
                    {!searchCliente && <p className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">Clientes recientes</p>}
                    {clientesFiltrados.map(c => (
                      <button key={c.id} onClick={() => selectCliente(c)}
                        className="w-full bg-slate-900 border border-slate-800 hover:border-blue-500/40 rounded-xl p-3 flex items-center gap-3 text-left cursor-pointer transition-colors">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-200 truncate">{c.nombre}</p>
                          <p className="text-[10px] text-slate-500 truncate">{[c.nif, c.email, c.direccion].filter(Boolean).join(' · ')}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-slate-600 text-xs py-3">
                    {searchCliente ? 'Sin resultados' : 'Sin clientes todavía'}
                  </p>
                )}

                {/* Crear nuevo */}
                <button onClick={() => setModoNuevo(true)}
                  className="w-full py-3 rounded-2xl border border-dashed border-slate-700 hover:border-blue-500/50 text-slate-400 hover:text-blue-400 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <UserPlus className="w-4 h-4" /> Crear nuevo cliente
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FASE: SECTOR ── */}
        {phase === 'sector' && (
          <div className="px-4 py-5 space-y-4">
            <div className="text-center space-y-1.5">
              <h2 className="text-lg font-bold text-white">¿Sector del cliente?</h2>
              <p className="text-slate-400 text-sm">El sector determina el SLA, cobertura y cláusulas del contrato</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SECTORES.map(s => (
                <button
                  key={s.label}
                  onClick={() => { setSector(s); setDetalles({ ...DEFAULT_DETALLES, cobertura: s.cobertura as SectorDetalles['cobertura'] }); setPhase('detalles'); }}
                  className="bg-slate-900 border border-slate-700 hover:border-blue-500/40 rounded-2xl p-3.5 flex flex-col items-start gap-1.5 cursor-pointer active:opacity-70 text-left transition-colors"
                >
                  <span className="text-2xl">{s.icon}</span>
                  <span className="text-xs font-bold text-slate-200 leading-tight">{s.label}</span>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">SLA {s.sla}</span>
                    <span className="text-[9px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">{s.cobertura}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── FASE: DETALLES ── */}
        {phase === 'detalles' && sector && (
          <div className="px-4 py-5 space-y-5 pb-32">
            <div className="text-center space-y-1">
              <span className="text-3xl">{sector.icon}</span>
              <h2 className="text-base font-bold text-white">{sector.label}</h2>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">SLA {sector.sla}</span>
                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">Criticidad {sector.criticidad}</span>
              </div>
            </div>

            {/* Equipos y potencia */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <p className="text-[10px] text-slate-400">Nº equipos</p>
                <div className="flex gap-1.5 flex-wrap">
                  {['1', '2', '3', '4', '5+', '10+'].map(v => (
                    <button key={v} onClick={() => setD('num_equipos', v)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                        detalles.num_equipos === v ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}>{v}</button>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1.5">
                <p className="text-[10px] text-slate-400">Potencia total (kW)</p>
                <input
                  type="number" min="0" step="1"
                  value={detalles.potencia_kw}
                  onChange={e => setD('potencia_kw', e.target.value)}
                  placeholder="Ej: 50"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Cobertura */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-blue-400" /> Cobertura horaria
              </p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: '8/5', label: '8/5 — Horario laboral' },
                  { v: '24/7', label: '24/7 — Todos los días' },
                  { v: '24/7/365', label: '24/7/365 — Crítico' },
                  { v: 'personalizada', label: 'Horario personalizado' },
                ] as const).map(({ v, label }) => (
                  <button key={v} onClick={() => setD('cobertura', v)}
                    className={`py-2 px-3 rounded-xl text-[10px] font-bold cursor-pointer transition-colors text-left ${
                      detalles.cobertura === v ? 'bg-blue-500 text-white' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:border-blue-500/40'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            {/* Visitas preventivas */}
            <div className="space-y-2">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                <Wrench className="w-3 h-3 text-blue-400" /> Visitas preventivas anuales
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { v: '1', label: '1 anual' },
                  { v: '2', label: '2 semestrales' },
                  { v: '4', label: '4 trimestrales' },
                  { v: '12', label: '12 mensuales' },
                  { v: '24', label: '24 quincenales' },
                ].map(({ v, label }) => (
                  <button key={v} onClick={() => setD('visitas_anuales', v as SectorDetalles['visitas_anuales'])}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                      detalles.visitas_anuales === v ? 'bg-blue-500 text-white' : 'bg-slate-900 border border-slate-700 text-slate-400 hover:border-blue-500/40'
                    }`}>{label}</button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-3">
              {[
                { key: 'incluye_piezas', label: 'Repuestos incluidos', sub: 'El contrato cubre piezas y materiales' },
                { key: 'recargo_urgencias', label: 'Recargos urgencias', sub: 'Sábados +25%, festivos +40%, guardia 24h +70%' },
              ].map(({ key, label, sub }) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-200 font-medium">{label}</p>
                    <p className="text-[9px] text-slate-500">{sub}</p>
                  </div>
                  <div
                    onClick={() => setD(key as keyof SectorDetalles, !((detalles as any)[key]) as any)}
                    className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer shrink-0 ${(detalles as any)[key] ? 'bg-blue-500' : 'bg-slate-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${(detalles as any)[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>

            {/* Zona */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Zona / Municipio</p>
              <input
                type="text"
                value={detalles.zona}
                onChange={e => setD('zona', e.target.value)}
                placeholder="Ej: Madrid — zona norte"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}

        {/* ── FASE: VOZ / TEXTO ── */}
        {phase === 'voz' && sector && (
          <div className="flex flex-col">
            <div className="px-4 py-3 bg-blue-600/10 border-b border-blue-500/20">
              <p className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-0.5">Sector activo</p>
              <p className="text-sm font-bold text-white">{sector.icon} {sector.label}</p>
              <p className="text-[10px] text-slate-400">SLA {sector.sla} · {detalles.cobertura} · {detalles.visitas_anuales} visitas/año</p>
            </div>

            <div className="px-4 py-5 space-y-5 pb-32">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Selecciona los equipos del contrato</h3>
                <p className="text-slate-400 text-xs">Marca los que incluye el mantenimiento. Añade detalles por voz o texto si necesitas.</p>
              </div>

              {/* Chips de equipos */}
              {(ITEMS_POR_SECTOR[sector.label] ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Equipos / Sistemas</p>
                  <div className="flex flex-wrap gap-2">
                    {(ITEMS_POR_SECTOR[sector.label] ?? []).map(item => (
                      <button
                        key={item.label}
                        onClick={() => setSelectedItems(prev => ({ ...prev, [item.label]: !prev[item.label] }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          selectedItems[item.label]
                            ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-blue-500/40 hover:text-slate-200'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-600">
                    {Object.values(selectedItems).filter(Boolean).length} elemento{Object.values(selectedItems).filter(Boolean).length !== 1 ? 's' : ''} seleccionado{Object.values(selectedItems).filter(Boolean).length !== 1 ? 's' : ''}
                  </p>
                </div>
              )}

              {/* SLA del sector */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                  <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest">SLA del sector</p>
                </div>
                <p className="text-xs text-slate-300">Respuesta en {sector.sla} · Penalización -5%/h por incumplimiento</p>
              </div>

              {/* Descripción adicional + micrófono inline */}
              <div className="space-y-2">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Descripción adicional (opcional)</p>
                <div className="flex items-start gap-2">
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer shrink-0 mt-0.5 transition-all ${
                      recording
                        ? 'bg-red-500 shadow-[0_0_0_6px_rgba(239,68,68,0.2)]'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {recording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
                  </button>
                  <textarea
                    value={textInput}
                    onChange={e => setTextInput(e.target.value)}
                    placeholder="Añade detalles: antigüedad de equipos, marcas, condiciones especiales…"
                    rows={3}
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>
                {recording && (
                  <p className="text-red-400 text-xs font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block animate-pulse" />
                    Escuchando…
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── FASE: RESULTADO ── */}
        {phase === 'resultado' && sector && (
          <div className="px-4 py-4 space-y-4 pb-32">
            <div className="text-center space-y-1.5">
              <CheckCircle className="w-10 h-10 text-blue-400 mx-auto" />
              <h2 className="text-lg font-bold text-white">{sector.icon} {sector.label}</h2>
              <p className="text-slate-400 text-sm">{clausulas.length} partidas de contrato generadas</p>
            </div>

            {/* Resumen del contrato */}
            <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-3 space-y-1.5">
              <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Condiciones del contrato</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {[
                  ['SLA urgente', sector.sla],
                  ['Cobertura', detalles.cobertura],
                  ['Visitas/año', detalles.visitas_anuales],
                  ['Repuestos', detalles.incluye_piezas ? 'Incluidos' : 'No incluidos'],
                  ['Equipos', detalles.num_equipos],
                  ['Recargos', detalles.recargo_urgencias ? 'Sí' : 'No'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[9px] text-slate-500">{k}: </span>
                    <span className="text-[10px] text-slate-200 font-bold">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Partidas editables */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              {clausulas.map((c, i) => (
                <div key={i} className={`px-3 py-2.5 space-y-1.5 ${i < clausulas.length - 1 ? 'border-b border-slate-800' : ''}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <input
                        value={c.descripcion}
                        onChange={e => updateClausula(i, 'descripcion', e.target.value)}
                        className="w-full bg-transparent text-xs text-white font-medium focus:outline-none focus:bg-slate-800 rounded px-1 py-0.5 -mx-1"
                        placeholder="Descripción de la partida…"
                      />
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
                        c.tipo === 'mano_de_obra' ? 'bg-blue-500/10 text-blue-400'
                        : c.tipo === 'servicio' ? 'bg-violet-500/10 text-violet-400'
                        : 'bg-emerald-500/10 text-emerald-400'
                      }`}>
                        {c.tipo === 'mano_de_obra' ? 'Mano de obra' : c.tipo === 'servicio' ? 'Servicio' : 'Material'}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteClausula(i)}
                      className="p-1 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="number" min="0" step="0.5"
                        value={c.cantidad}
                        onChange={e => updateClausula(i, 'cantidad', Number(e.target.value))}
                        className="w-10 bg-slate-800 rounded px-1 py-0.5 text-white text-center text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span>{c.unidad}</span>
                    </div>
                    <span className="text-slate-700">×</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number" min="0" step="1"
                        value={c.precioUnitario || ''}
                        onChange={e => updateClausula(i, 'precioUnitario', Number(e.target.value))}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-right text-xs text-white focus:outline-none focus:border-blue-500"
                        placeholder="0,00"
                      />
                      <span className="text-[10px] text-slate-500">€</span>
                    </div>
                    <div className="flex-1" />
                    <p className="text-xs font-bold text-slate-200 font-mono shrink-0">
                      {(c.precioUnitario * c.cantidad).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                    </p>
                  </div>
                </div>
              ))}

              {/* Añadir partida */}
              <button
                onClick={addClausula}
                className="w-full py-2.5 flex items-center justify-center gap-1.5 text-[11px] font-bold text-blue-400 hover:bg-blue-500/5 transition-colors border-t border-slate-800 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir partida
              </button>
            </div>

            {/* Resumen del cliente si está asignado */}
            {clienteNombre && (
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-3 flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{clienteNombre}</p>
                  {clienteDireccion && <p className="text-[10px] text-slate-400 truncate">{clienteDireccion}</p>}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wide">Total estimado</span>
              <span className="text-lg font-bold text-white">
                {totalContrato.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
              </span>
            </div>

            <button
              onClick={() => setPhase('voz')}
              className="w-full py-3 rounded-2xl text-xs font-bold text-blue-400 border border-blue-500/30 cursor-pointer"
            >
              ← Ajustar descripción
            </button>
          </div>
        )}
      </div>

      {/* Footer: fase cliente */}
      {phase === 'cliente' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent space-y-2">
          {(clienteId || (modoNuevo && clienteNombre.trim())) && (
            <button
              onClick={() => setPhase('sector')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
              style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}
            >
              Continuar →
            </button>
          )}
          <button
            onClick={() => setPhase('sector')}
            className="w-full py-2.5 rounded-2xl text-slate-500 text-xs font-semibold cursor-pointer hover:text-slate-300 transition-colors"
          >
            Continuar sin asignar cliente
          </button>
        </div>
      )}

      {/* Footer: continuar de detalles a voz */}
      {phase === 'detalles' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={() => {
              const items = ITEMS_POR_SECTOR[sector!.label] ?? [];
              const defaults: Record<string, boolean> = {};
              items.forEach(item => { defaults[item.label] = item.checked; });
              setSelectedItems(defaults);
              setPhase('voz');
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer"
            style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}
          >
            Continuar — seleccionar equipamiento →
          </button>
        </div>
      )}

      {/* Footer: generar contrato (fase voz) */}
      {phase === 'voz' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={generarContrato}
            disabled={processing}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
            style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}
          >
            {processing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generando contrato con IA…</>
              : <><Sparkles className="w-4 h-4" /> Generar partidas del contrato</>
            }
          </button>
        </div>
      )}

      {/* Footer: confirmar (resultado) */}
      {phase === 'resultado' && (
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-gradient-to-t from-[#0B0F14] to-transparent">
          <button
            onClick={handleSaveDirectly}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-40"
            style={{ boxShadow: '0 4px 24px rgba(37,99,235,0.4)' }}
          >
            {saving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
              : <><CheckCircle className="w-4 h-4" /> Guardar presupuesto de mantenimiento</>
            }
          </button>
        </div>
      )}
    </div>
  );
}
