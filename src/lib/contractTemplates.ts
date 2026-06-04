// Contract HTML template builder — parametrized by oficio and variables

export interface ContractVars {
  // Prestador
  empresa: string;
  cif_empresa: string;
  direccion_empresa: string;
  telefono_empresa: string;
  email_empresa: string;
  logo_url?: string;

  // Cliente
  nombre_cliente: string;
  cif_cliente: string;
  direccion_cliente: string;
  telefono_cliente: string;
  email_cliente: string;
  representante_cliente: string;
  cargo_representante: string;

  // Contrato
  referencia: string;
  ciudad_firma: string;
  fecha_inicio: string;
  fecha_fin: string;
  duracion_meses: string;

  // Económico
  cuota_mensual: string;
  iva_pct: string;
  cuota_mensual_con_iva: string;
  cuota_anual: string;
  periodo_facturacion: 'mensual' | 'trimestral' | 'anual';
  forma_pago: string;
  iban: string;
  dia_vencimiento: string;

  // SLA
  horario_guardia: string;
  servicio_urgencias: string;
  tiempo_respuesta: string;
  tiempo_resolucion: string;
  disponibilidad: string;
  penalizacion_sla: string;

  // Instalaciones (lista separada por saltos de línea)
  descripcion_instalaciones: string;

  // Legal
  ciudad_jurisdiccion: string;
  cobertura_rc: string;
  limite_correctivo: string;
}

export const defaultContractVars: ContractVars = {
  empresa: '', cif_empresa: '', direccion_empresa: '',
  telefono_empresa: '', email_empresa: '', logo_url: undefined,
  nombre_cliente: '', cif_cliente: '', direccion_cliente: '',
  telefono_cliente: '', email_cliente: '',
  representante_cliente: '[ Representante ]', cargo_representante: '[ Cargo ]',
  referencia: '', ciudad_firma: '',
  fecha_inicio: '', fecha_fin: '', duracion_meses: '12',
  cuota_mensual: '', iva_pct: '21', cuota_mensual_con_iva: '', cuota_anual: '',
  periodo_facturacion: 'mensual',
  forma_pago: 'Domiciliación bancaria (SEPA)', iban: '', dia_vencimiento: '5',
  horario_guardia: 'Lunes a viernes de 08:00 a 18:00 h',
  servicio_urgencias: '24 horas / 7 días',
  tiempo_respuesta: 'Máximo 4 horas en días laborables, 8 horas en festivos',
  tiempo_resolucion: '24 horas para averías críticas, 72 horas para incidencias menores',
  disponibilidad: '99% mensual en horario de guardia',
  penalizacion_sla: '5% del importe mensual por cada día de retraso sobre el SLA',
  descripcion_instalaciones: '[ Descripción instalación 1 ]',
  ciudad_jurisdiccion: '', cobertura_rc: '600.000',
  limite_correctivo: '500',
};

// ── Per-oficio content ────────────────────────────────────────────────────────

export interface OficioContent {
  titulo: string;
  objeto: string;
  serviciosIncluidos: string[];
  serviciosExcluidos: string[];
  mantenimientoPreventivo: string[];
  normativa: string[];
}

const OFICIO_CONTENT: Record<string, OficioContent> = {
  fontaneria: {
    titulo: 'Mantenimiento de Instalaciones de Fontanería e Instalaciones Hidráulicas',
    objeto: 'Mantenimiento preventivo y correctivo de instalaciones de fontanería, redes de agua fría y caliente sanitaria (ACS), circuitos de producción, sistemas de presión, tratamiento de agua y red de saneamiento.',
    serviciosIncluidos: [
      'Revisión y mantenimiento de la red de distribución de agua fría y caliente sanitaria (ACS).',
      'Revisión de grupos de presión, bombas de circulación y acumuladores.',
      'Inspección y mantenimiento de tuberías de producción, circuitos de proceso y colectores.',
      'Control y ajuste de válvulas de corte, regulación, seguridad y retención.',
      'Revisión y purga de circuitos para prevención de la legionela (Real Decreto 865/2003).',
      'Inspección de filtros, descalcificadores, osmosis y sistemas de tratamiento de agua.',
      'Revisión de la red de saneamiento: sifones, sumideros y arquetas.',
      'Atención a averías, fugas y roturas en el horario de guardia acordado.',
      'Emisión de informes técnicos de cada intervención preventiva y correctiva.',
    ],
    serviciosExcluidos: [
      'Actuaciones en circuitos de proceso que requieran la paralización de la producción salvo acuerdo expreso previo.',
      'Sustitución de equipos principales (bombas, acumuladores, equipos de tratamiento) cuyo coste supere el límite del Anexo I.',
      'Obras civiles o intervenciones en soleras, paredes o estructura del edificio.',
      'Sistemas de contra incendios (BIEs, rociadores), que requerirán contrato específico.',
      'Actuaciones en instalaciones de proceso alimentario que requieran homologación APPCC específica no contemplada.',
    ],
    mantenimientoPreventivo: [
      'Revisión semestral de la red de ACS y medición de temperatura para control de legionela.',
      'Revisión trimestral de grupos de presión y bombas de circulación.',
      'Análisis y control anual de la calidad del agua según parámetros acordados.',
      'Revisión semestral de válvulas de seguridad y llenado.',
      'Inspección anual de la red de saneamiento con test de presión si aplica.',
    ],
    normativa: [
      'Real Decreto 865/2003 — Criterios higiénico-sanitarios para la prevención y control de la legionelosis.',
      'Real Decreto 140/2003 — Criterios sanitarios de la calidad del agua de consumo humano.',
      'Código Técnico de la Edificación (CTE) — Documento Básico HS 4 (Suministro de Agua).',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  electricidad: {
    titulo: 'Mantenimiento de Instalaciones Eléctricas de Baja Tensión',
    objeto: 'Mantenimiento preventivo y correctivo de instalaciones eléctricas de baja tensión, cuadros eléctricos, circuitos de alumbrado y fuerza, sistemas de protección y puesta a tierra.',
    serviciosIncluidos: [
      'Revisión y mantenimiento de cuadros eléctricos generales y secundarios.',
      'Inspección de circuitos de alumbrado, tomas de corriente y fuerza.',
      'Verificación y ajuste de protecciones: interruptores automáticos, diferenciales y fusibles.',
      'Comprobación del sistema de puesta a tierra y equipotencialidad.',
      'Revisión de sistemas de alumbrado de emergencia y señalización.',
      'Inspección de instalaciones de climatización eléctrica y ventilación.',
      'Atención a averías eléctricas en el horario de guardia acordado.',
      'Emisión de informes técnicos de cada intervención preventiva y correctiva.',
    ],
    serviciosExcluidos: [
      'Actuaciones en alta tensión o centros de transformación, que requieren contrato específico.',
      'Sustitución de cuadros eléctricos principales o transformadores.',
      'Obras civiles: rozas, canaletas empotradas o modificación de la envolvente del edificio.',
      'Instalaciones de energías renovables (fotovoltaica, aerogeneración) sin convenio específico.',
      'Instalaciones de telecomunicaciones o redes de datos.',
    ],
    mantenimientoPreventivo: [
      'Revisión semestral de cuadros eléctricos: limpieza, apriete de bornes, comprobación de protecciones.',
      'Medición anual de resistencia de aislamiento de los circuitos.',
      'Comprobación trimestral del correcto funcionamiento de interruptores diferenciales.',
      'Verificación anual de la continuidad y valor de la puesta a tierra.',
      'Revisión semestral de alumbrado de emergencia y señalización.',
    ],
    normativa: [
      'Real Decreto 842/2002 — Reglamento Electrotécnico para Baja Tensión (REBT) e Instrucciones Técnicas Complementarias.',
      'Real Decreto 337/2014 — Reglamento sobre condiciones técnicas y garantías de seguridad en instalaciones eléctricas de alta tensión.',
      'Código Técnico de la Edificación (CTE) — Documento Básico SI (Seguridad en caso de incendio).',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  climatizacion: {
    titulo: 'Mantenimiento de Instalaciones de Climatización y Ventilación',
    objeto: 'Mantenimiento preventivo y correctivo de instalaciones de climatización (frío y calor), ventilación mecánica, sistemas de tratamiento de aire y control de temperatura, garantizando el confort y la eficiencia energética.',
    serviciosIncluidos: [
      'Revisión y mantenimiento de unidades interiores y exteriores de climatización (splits, multisplits, VRV/VRF).',
      'Limpieza y desinfección de filtros, evaporadores, condensadores y bandejas de condensados.',
      'Revisión de circuitos de refrigerante, presiones y estanqueidad del circuito frigorífico.',
      'Inspección y mantenimiento de calderas, circuladoras y sistemas de calefacción.',
      'Revisión de sistemas de ventilación mecánica, recuperadores de calor y climatizadoras.',
      'Comprobación y calibración de sondas de temperatura, termostatos y controles.',
      'Atención a averías de climatización en el horario de guardia acordado.',
      'Emisión de informes técnicos de cada intervención preventiva y correctiva.',
    ],
    serviciosExcluidos: [
      'Sustitución de compresores, grupos condensadores o climatizadoras completas.',
      'Recarga de gas refrigerante por fugas derivadas de manipulación externa o corrosión estructural.',
      'Obras civiles: apertura de techos, paredes o conductos empotrados.',
      'Sistemas de contra incendios o detección de CO.',
      'Instalaciones de proceso industrial con fluidos no convencionales.',
    ],
    mantenimientoPreventivo: [
      'Limpieza y revisión semestral de filtros, evaporadores y condensadores.',
      'Revisión trimestral de presiones y estanqueidad del circuito frigorífico (F-GAS).',
      'Comprobación anual del rendimiento y eficiencia energética (COP/EER).',
      'Revisión semestral de sistemas de control y regulación (termostatos, sondas, BMS).',
      'Purga y tratamiento anual del agua de los circuitos de calefacción.',
    ],
    normativa: [
      'Reglamento de Instalaciones Térmicas en los Edificios (RITE) — Real Decreto 1027/2007.',
      'Reglamento (UE) 517/2014 — Gases fluorados de efecto invernadero (F-GAS).',
      'Real Decreto 115/2017 — Comercialización y manipulación de gases fluorados.',
      'Código Técnico de la Edificación (CTE) — Documento Básico HE (Ahorro de Energía).',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  informatica: {
    titulo: 'Mantenimiento de Infraestructura Informática y Redes de Datos',
    objeto: 'Mantenimiento preventivo y correctivo de la infraestructura informática, redes de datos estructuradas, sistemas Wi-Fi, servidores, equipos de usuario y comunicaciones, garantizando la continuidad y seguridad del servicio.',
    serviciosIncluidos: [
      'Mantenimiento y monitorización de la red de datos: switches, routers, firewalls y puntos de acceso Wi-Fi.',
      'Revisión y gestión de servidores físicos y virtuales: parches de seguridad, actualizaciones, rendimiento.',
      'Mantenimiento preventivo de equipos de usuario: PC, portátiles, impresoras y periféricos.',
      'Soporte remoto y presencial para incidencias de usuario y sistema operativo.',
      'Supervisión de copias de seguridad (backup) y verificación mensual de integridad.',
      'Gestión de usuarios y permisos en Active Directory o equivalente.',
      'Revisión periódica de antivirus, EDR y herramientas de seguridad perimetral.',
      'Atención a incidencias críticas (caída de red, servidor inaccesible) según SLA acordado.',
      'Emisión de informes técnicos mensuales sobre el estado de la infraestructura.',
    ],
    serviciosExcluidos: [
      'Sustitución de hardware deteriorado (servidores, switches, PCs) cuyo coste supere el límite del Anexo I.',
      'Desarrollo o modificación de software a medida, aplicaciones o bases de datos.',
      'Migraciones completas de plataforma o implantación de nuevos sistemas ERP/CRM.',
      'Recuperación de datos ante siniestro (ransomware, borrado accidental) de backups no gestionados bajo este contrato.',
      'Instalación de cableado estructurado nuevo o reformas de red física.',
      'Soporte de aplicaciones de terceros con acceso remoto propio del fabricante.',
    ],
    mantenimientoPreventivo: [
      'Revisión mensual del estado de servidores: espacio, rendimiento, logs de errores y actualizaciones.',
      'Verificación mensual de la integridad y restaurabilidad de las copias de seguridad.',
      'Revisión trimestral de firewall, reglas de seguridad y certificados SSL/TLS.',
      'Auditoría semestral de usuarios y permisos: altas, bajas y modificaciones.',
      'Test anual de recuperación ante desastres (DRP) con informe de resultados.',
      'Revisión semestral de licencias de software y cumplimiento normativo.',
    ],
    normativa: [
      'Reglamento (UE) 2016/679 (RGPD) — Protección de Datos de Carácter Personal.',
      'Ley Orgánica 3/2018 (LOPDGDD) — Protección de Datos y Garantía de Derechos Digitales.',
      'Real Decreto-ley 12/2018 — Seguridad de las redes y sistemas de información (NIS).',
      'Esquema Nacional de Seguridad (ENS) — Real Decreto 311/2022, si aplica al CLIENTE.',
      'ISO/IEC 27001 — Sistemas de gestión de la seguridad de la información (referencia).',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
    ],
  },
  limpieza: {
    titulo: 'Servicio de Limpieza y Mantenimiento Higiénico-Sanitario',
    objeto: 'Prestación de servicios de limpieza, desinfección y mantenimiento higiénico-sanitario de las instalaciones del CLIENTE, garantizando los estándares de higiene y salubridad requeridos.',
    serviciosIncluidos: [
      'Limpieza diaria/semanal de superficies, suelos, ventanas interiores y zonas comunes.',
      'Desinfección periódica de aseos, vestuarios y zonas de alta concurrencia.',
      'Limpieza de cristales interiores y exteriores según frecuencia acordada.',
      'Reposición de consumibles: papel higiénico, jabón, papel de manos (precio no incluido).',
      'Tratamiento específico de zonas de cocina, comedor y áreas de preparación de alimentos.',
      'Eliminación de residuos y gestión de contenedores de reciclaje.',
      'Limpieza profunda trimestral/semestral de moquetas, tapicerías y difícil acceso.',
      'Emisión de registro de actuaciones y albaranes por cada servicio prestado.',
    ],
    serviciosExcluidos: [
      'Limpieza de fachadas exteriores o trabajos en altura que requieran plataformas o andamios.',
      'Tratamientos de plagas o desratización (requieren empresa especializada y autorizada).',
      'Lavado y planchado de ropa o uniformes del CLIENTE.',
      'Limpieza de maquinaria industrial, equipos de producción o instalaciones técnicas específicas.',
      'Consumibles y productos de limpieza (se facturarán por separado o son suministrados por el CLIENTE).',
    ],
    mantenimientoPreventivo: [
      'Planificación mensual del programa de limpieza con calendar y frecuencias acordadas.',
      'Revisión trimestral del plan de higiene y ajuste de frecuencias si se detectan deficiencias.',
      'Auditoría semestral de calidad con ficha de inspección firmada por ambas partes.',
      'Formación anual del personal en técnicas de limpieza e higiene (APPCC si aplica).',
    ],
    normativa: [
      'Real Decreto 783/2001 — Reglamento sobre protección sanitaria contra radiaciones ionizantes.',
      'Real Decreto 1254/1999 — Medidas de control de los riesgos inherentes a los accidentes graves.',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  jardineria: {
    titulo: 'Servicio de Jardinería y Mantenimiento de Espacios Verdes',
    objeto: 'Mantenimiento periódico de jardines, zonas verdes, arbolado y espacios exteriores de las instalaciones del CLIENTE, garantizando su estado óptimo, seguridad y valor estético durante todo el año.',
    serviciosIncluidos: [
      'Siega y recorte de céspedes y praderas en la frecuencia acordada según temporada.',
      'Poda y formación de setos, arbustos y árboles según calendario fitosanitario.',
      'Escarda y control de malas hierbas en zonas ajardinadas y caminos.',
      'Abonado y tratamientos fitosanitarios preventivos según necesidades del arbolado.',
      'Riego manual o supervisión del sistema de riego automático existente.',
      'Limpieza de hojas, ramas y residuos vegetales en toda la zona ajardinada.',
      'Plantación estacional de flores y plantas de temporada (coste de plantas no incluido).',
      'Emisión de informes periódicos sobre el estado de las zonas verdes.',
    ],
    serviciosExcluidos: [
      'Instalación o reparación de sistemas de riego automático y redes de agua.',
      'Tala de árboles de gran porte que requieran maquinaria especializada o permisos municipales.',
      'Suministro de plantas, árboles, semillas o materiales de jardinería (se presupuestan por separado).',
      'Obras de paisajismo: diseño, construcción de jardines, pavimentación o movimientos de tierra.',
      'Tratamientos de plagas con productos fitosanitarios que requieran empresa homologada nivel 2.',
    ],
    mantenimientoPreventivo: [
      'Programa mensual de visitas adaptado a la temporada: alta frecuencia primavera-verano, menor en otoño-invierno.',
      'Poda de formación anual de arbolado ornamental y revisión de estado fitosanitario.',
      'Análisis anual del suelo y planificación de abonados y enmiendas si aplica.',
      'Revisión semestral del sistema de riego automático: emisores, programación y estanqueidad.',
    ],
    normativa: [
      'Real Decreto 1311/2012 — Uso sostenible de productos fitosanitarios.',
      'Ley 43/2003 — Montes y normativa autonómica de arbolado urbano aplicable.',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  ascensores: {
    titulo: 'Mantenimiento de Aparatos Elevadores — Ascensores y Plataformas',
    objeto: 'Mantenimiento preventivo y correctivo de ascensores, montacargas, salvaescaleras y plataformas elevadoras, conforme al Real Decreto 57/2005 y la instrucción técnica complementaria ITC-AEM1, garantizando la seguridad de los usuarios y la conformidad reglamentaria.',
    serviciosIncluidos: [
      'Mantenimiento mensual reglamentario conforme a ITC-AEM1 y normativa EN 13015.',
      'Revisión de puertas de cabina y rellano: cierre, apertura de emergencia y mecanismos de seguridad.',
      'Inspección de guías, contrapesos, cables de tracción y poleas.',
      'Comprobación de paracaídas, limitador de velocidad y sistema amortiguador.',
      'Revisión del cuadro de maniobras, contactores, relés de seguridad e iluminación.',
      'Verificación del sistema de comunicación de emergencia y alarma.',
      'Atención a averías y rescate de personas atrapadas en cabina (24h según SLA).',
      'Acompañamiento en inspecciones reglamentarias (OCA/OIT) y tramitación de comunicaciones.',
      'Emisión de libro de mantenimiento reglamentario y partes de trabajo.',
    ],
    serviciosExcluidos: [
      'Modernización o renovación completa del ascensor (guías, grupo tractor, cuadro de maniobras).',
      'Reparación de daños por vandalismo, mal uso intencionado o causas ajenas al mantenimiento.',
      'Obras civiles: reformas del hueco, foso o sala de máquinas.',
      'Tramitación de licencias o permisos administrativos ante organismos públicos.',
      'Adaptación reglamentaria a nuevas normativas de accesibilidad o seguridad (requiere presupuesto específico).',
    ],
    mantenimientoPreventivo: [
      'Visita mensual de mantenimiento reglamentario con registro en libro de aparato.',
      'Prueba semestral de paracaídas, limitador de velocidad y dispositivos de seguridad.',
      'Revisión anual completa del grupo tractor, reductor y freno.',
      'Engrase semestral de guías, poleas y mecanismos de movimiento.',
      'Coordinación y acompañamiento en la inspección periódica de OCA/OIT (cada 2 o 4 años según uso).',
    ],
    normativa: [
      'Real Decreto 57/2005 — Prescripciones para el incremento de la seguridad del parque de ascensores existente.',
      'ITC-AEM1 — Ascensores (Instrucción Técnica Complementaria).',
      'Real Decreto 1644/2008 — Normas para la comercialización y puesta en servicio de las máquinas.',
      'EN 81-20 y EN 81-50 — Normas de seguridad para ascensores.',
      'EN 13015 — Mantenimiento de ascensores y escaleras mecánicas.',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
  general: {
    titulo: 'Mantenimiento de Instalaciones y Servicios Técnicos',
    objeto: 'Mantenimiento preventivo y correctivo de las instalaciones y sistemas técnicos de las instalaciones del CLIENTE, según el alcance definido en las presentes condiciones.',
    serviciosIncluidos: [
      'Revisión y mantenimiento periódico de las instalaciones objeto del contrato.',
      'Atención a averías e incidencias en el horario de guardia acordado.',
      'Suministro de mano de obra especializada para intervenciones incluidas en el contrato.',
      'Coordinación y gestión de las actuaciones preventivas y correctivas.',
      'Emisión de informes técnicos de cada intervención realizada.',
    ],
    serviciosExcluidos: [
      'Sustitución de equipos principales cuyo coste supere el límite del Anexo I.',
      'Obras civiles o modificaciones estructurales del edificio.',
      'Actuaciones que requieran paralización de la actividad del CLIENTE sin acuerdo previo.',
      'Instalaciones o servicios no contemplados expresamente en el presente contrato.',
    ],
    mantenimientoPreventivo: [
      'Revisiones periódicas según plan de mantenimiento acordado.',
      'Comprobaciones de seguridad y funcionamiento de los equipos incluidos.',
      'Informe anual de estado de las instalaciones con recomendaciones de mejora.',
    ],
    normativa: [
      'Normativa técnica y sectorial aplicable al tipo de instalación objeto del contrato.',
      'Ley 31/1995 de Prevención de Riesgos Laborales y normativa de desarrollo.',
      'Real Decreto 171/2004 — Coordinación de actividades empresariales.',
      'Reglamento (UE) 2016/679 (RGPD) y Ley Orgánica 3/2018 (LOPDGDD).',
    ],
  },
};

export function getOficioContent(oficio: string): OficioContent {
  const k = oficio.toLowerCase()
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/á/g, 'a').replace(/é/g, 'e').replace(/ú/g, 'u');
  if (k.includes('font') || k.includes('plom') || k.includes('agua')) return OFICIO_CONTENT.fontaneria;
  if (k.includes('electr')) return OFICIO_CONTENT.electricidad;
  if (k.includes('clima') || k.includes('frig') || k.includes('aire') || k.includes('hvac')) return OFICIO_CONTENT.climatizacion;
  if (k.includes('inform') || k.includes('red') || k.includes('it') || k.includes('datos') || k.includes('servidor') || k.includes('wifi') || k.includes('redes')) return OFICIO_CONTENT.informatica;
  if (k.includes('limpiez') || k.includes('higien') || k.includes('sanitari')) return OFICIO_CONTENT.limpieza;
  if (k.includes('jardin') || k.includes('zona verde') || k.includes('paisaj')) return OFICIO_CONTENT.jardineria;
  if (k.includes('ascensor') || k.includes('elevador') || k.includes('montacargas') || k.includes('escalera mecanica')) return OFICIO_CONTENT.ascensores;
  return OFICIO_CONTENT.general;
}

// ── Sector-specific clauses ───────────────────────────────────────────────────

const SECTOR_CLAUSES: Record<string, { titulo: string; cuerpo: string }> = {
  industrial: {
    titulo: 'Condiciones Especiales — Entorno Industrial',
    cuerpo: `<p>Dado el carácter industrial de las instalaciones del CLIENTE, se establecen las siguientes condiciones adicionales:</p>
<ul>
<li><strong>Parada de producción:</strong> Las intervenciones que puedan implicar parada de línea de producción serán planificadas y coordinadas con al menos 48 horas de antelación, salvo emergencias críticas documentadas. En caso de parada no pactada imputable a EL PRESTADOR, se aplicará una penalización adicional del 3% de la cuota mensual por cada hora de paralización, hasta un máximo del 15% mensual.</li>
<li><strong>Guardia de disponibilidad:</strong> EL PRESTADOR garantizará técnico de guardia localizable 24h/7 días para atención telefónica inmediata e intervención presencial según SLA crítico acordado.</li>
<li><strong>Coordinación de actividades:</strong> Todas las intervenciones se ajustarán al Plan de Coordinación de Actividades Empresariales del CLIENTE conforme al Real Decreto 171/2004.</li>
<li><strong>Equipos de protección:</strong> El personal de EL PRESTADOR portará en todo momento los EPIs reglamentarios exigidos en las instalaciones industriales del CLIENTE.</li>
</ul>`,
  },
  alimentario: {
    titulo: 'Condiciones Especiales — Sector Alimentario y Cadena de Frío',
    cuerpo: `<p>En consideración a los requisitos específicos del sector alimentario, las partes acuerdan las siguientes condiciones:</p>
<ul>
<li><strong>Garantía de cadena de frío:</strong> Para instalaciones de refrigeración y congelación, EL PRESTADOR garantiza tiempo de respuesta máximo de 30 minutos ante alarma de temperatura fuera de rango, 24 horas al día, 7 días a la semana.</li>
<li><strong>APPCC y trazabilidad:</strong> Todas las actuaciones en zonas de manipulación de alimentos se realizarán cumpliendo el sistema APPCC del CLIENTE y la normativa de higiene alimentaria. EL PRESTADOR aportará la documentación de trazabilidad requerida.</li>
<li><strong>Responsabilidad por merma de producto:</strong> En caso de avería de equipos de frío con pérdida de producto directamente imputable al incumplimiento del SLA de respuesta por parte de EL PRESTADOR, y previa documentación fehaciente de la merma, EL PRESTADOR responderá hasta el límite establecido en su póliza de RC. Las partes deberán notificar la incidencia de forma inmediata y documentar las temperaturas registradas.</li>
<li><strong>Normativa alimentaria:</strong> Se cumplirá en todo momento el Reglamento (CE) 852/2004 sobre higiene de los productos alimenticios y el Real Decreto 993/2014 sobre frío industrial.</li>
</ul>`,
  },
  hospitalario: {
    titulo: 'Condiciones Especiales — Entorno Sanitario y Hospitalario',
    cuerpo: `<p>Dado el carácter crítico de los servicios sanitarios, se establecen las condiciones especiales siguientes:</p>
<ul>
<li><strong>Cobertura 24/7/365:</strong> El servicio se prestará ininterrumpidamente las 24 horas del día, los 365 días del año, sin excepciones por festivos, puentes o períodos vacacionales.</li>
<li><strong>SLA crítico:</strong> El tiempo máximo de respuesta para incidencias que afecten a sistemas de soporte vital, quirófanos o UCI es de 15 minutos desde la notificación. La no atención en este plazo conllevará las penalizaciones máximas establecidas en la Cláusula 5.</li>
<li><strong>Responsabilidad civil ampliada:</strong> EL PRESTADOR mantendrá en vigor una póliza de Responsabilidad Civil específica para actividades en centros sanitarios con cobertura no inferior a 1.000.000 EUR, aportando certificado de vigencia con carácter anual.</li>
<li><strong>Libro de mantenimiento sanitario:</strong> Se llevará el libro de mantenimiento reglamentario según el Real Decreto 1027/2007 y la normativa autonómica de instalaciones sanitarias aplicable.</li>
<li><strong>Formación específica:</strong> El personal asignado acreditará formación en prevención de infecciones nosocomiales y conocimiento de los protocolos del CLIENTE antes del inicio del servicio.</li>
</ul>`,
  },
  hostelero: {
    titulo: 'Condiciones Especiales — Sector Hostelería y Restauración',
    cuerpo: `<p>En atención a las necesidades específicas del sector hostelero, se acuerdan las siguientes condiciones:</p>
<ul>
<li><strong>Cobertura en fines de semana y festivos:</strong> El servicio incluye cobertura básica de urgencias los fines de semana y festivos, con recargo aplicable sobre el precio/hora estándar según la tabla de la Cláusula 7.</li>
<li><strong>Temporada alta:</strong> Durante los períodos de máxima ocupación (julio-agosto y Semana Santa), los tiempos de respuesta SLA se reducirán en un 30% respecto a los valores estándar, sin coste adicional.</li>
<li><strong>Intervención discreta:</strong> Las actuaciones en zonas comunes o de atención al público se realizarán preferentemente fuera del horario de servicio al cliente o en momentos de menor afluencia, coordinando acceso con el responsable del establecimiento.</li>
<li><strong>Equipos de cocina:</strong> Las intervenciones en maquinaria de cocina (hornos, cámaras, lavavajillas industriales) se coordinarán con el jefe de cocina para minimizar la interrupción del servicio.</li>
</ul>`,
  },
  hotelero: {
    titulo: 'Condiciones Especiales — Sector Hotelero',
    cuerpo: `<p>En atención a las necesidades específicas del sector hotelero, se acuerdan las siguientes condiciones:</p>
<ul>
<li><strong>Cobertura en fines de semana y festivos:</strong> El servicio incluye cobertura básica de urgencias los fines de semana y festivos, con recargo aplicable según la tabla de la Cláusula 7.</li>
<li><strong>Temporada alta:</strong> Durante los períodos de máxima ocupación (julio-agosto y Semana Santa), los tiempos de respuesta se reducirán en un 30% respecto a los valores estándar.</li>
<li><strong>Acceso a habitaciones:</strong> Las actuaciones en habitaciones de huéspedes se coordinarán con la dirección del hotel y se realizarán respetando la privacidad y las normas internas del establecimiento.</li>
<li><strong>Discreción y uniformidad:</strong> El personal de EL PRESTADOR portará uniforme identificativo y actuará con la discreción propia de los estándares hoteleros exigidos por el CLIENTE.</li>
</ul>`,
  },
  retail: {
    titulo: 'Condiciones Especiales — Sector Retail y Gran Superficie',
    cuerpo: `<p>Para instalaciones de retail y gran superficie, se establecen las siguientes condiciones:</p>
<ul>
<li><strong>SLA de equipos de frío:</strong> Para cámaras de conservación, expositores frigoríficos y equipos de congelación, el tiempo de respuesta máximo es de 30 minutos desde la notificación de avería, 24 horas al día, 7 días a la semana.</li>
<li><strong>Responsabilidad por pérdida de producto:</strong> Ante avería de frio directamente imputable al incumplimiento del SLA de respuesta, y previa documentación de la pérdida, EL PRESTADOR responderá hasta el límite de su póliza de RC, previa comunicación inmediata de la incidencia.</li>
<li><strong>Horario de intervención:</strong> Las actuaciones en sala de ventas o zonas de acceso al público se realizarán preferentemente antes de apertura o después del cierre del establecimiento, salvo urgencias que requieran intervención inmediata.</li>
<li><strong>Guardia 24h frío industrial:</strong> EL PRESTADOR garantizará técnico de guardia localizable 24h/7 días para incidencias relacionadas con equipos de refrigeración industrial.</li>
</ul>`,
  },
  supermercado: {
    titulo: 'Condiciones Especiales — Supermercado y Distribución Alimentaria',
    cuerpo: `<p>Para establecimientos de distribución alimentaria, se establecen las condiciones del sector alimentario/retail indicadas a continuación:</p>
<ul>
<li><strong>SLA de equipos de frío:</strong> Tiempo de respuesta máximo de 30 minutos ante alarma de temperatura fuera de rango en cámaras o expositores, 24h/7 días.</li>
<li><strong>APPCC:</strong> Las intervenciones en zonas de manipulación de alimentos cumplirán los requisitos del sistema APPCC del CLIENTE.</li>
<li><strong>Guardia frío industrial:</strong> Técnico de guardia localizable 24h/7 días para frío industrial.</li>
<li><strong>Responsabilidad pérdida producto:</strong> EL PRESTADOR responderá por pérdida de producto en caso de incumplimiento documentado del SLA de respuesta, hasta el límite de su póliza de RC.</li>
</ul>`,
  },
  oficinas: {
    titulo: 'Condiciones Especiales — Edificio de Oficinas',
    cuerpo: `<p>Para edificios de oficinas y espacios de trabajo, se acuerdan las siguientes condiciones:</p>
<ul>
<li><strong>Acceso coordinado:</strong> Todas las actuaciones serán coordinadas con el administrador o responsable de las instalaciones del edificio, respetando los protocolos de seguridad y acceso establecidos.</li>
<li><strong>Horario de intervención:</strong> Las intervenciones de carácter no urgente se realizarán preferentemente en horario de 08:00 a 18:00 h, lunes a viernes, para minimizar la interrupción de la actividad del CLIENTE.</li>
<li><strong>Actuaciones en fin de semana:</strong> Las intervenciones urgentes en fin de semana o festivos tendrán el recargo establecido en la tabla de la Cláusula 7 y requerirán confirmación por parte del responsable del CLIENTE.</li>
</ul>`,
  },
  comunidad: {
    titulo: 'Condiciones Especiales — Comunidad de Propietarios',
    cuerpo: `<p>Para comunidades de propietarios, se acuerdan las siguientes condiciones:</p>
<ul>
<li><strong>Interlocución:</strong> EL CLIENTE designará al Presidente de la Comunidad o al Administrador de Fincas como interlocutor válido para la solicitud de servicios, aprobación de presupuestos y firma de partes de trabajo.</li>
<li><strong>Aprobación de gastos:</strong> Las reparaciones que superen el límite correctivo del Anexo I requerirán aprobación previa de la Junta de Propietarios o de la persona expresamente autorizada por ésta.</li>
<li><strong>Aviso a propietarios:</strong> Para intervenciones que puedan afectar a los suministros de la comunidad (agua, electricidad) se notificará a los propietarios con al menos 24 horas de antelación.</li>
</ul>`,
  },
};

export function getSectorClauseHTML(sector: string): string | null {
  const k = (sector ?? '').toLowerCase()
    .replace(/í/g, 'i').replace(/ó/g, 'o').replace(/á/g, 'a').replace(/é/g, 'e').replace(/ú/g, 'u');

  let entry: { titulo: string; cuerpo: string } | undefined;
  if (k.includes('industrial') || k.includes('fabrica') || k.includes('fabr')) entry = SECTOR_CLAUSES.industrial;
  else if (k.includes('alimentari') || k.includes('aliment') || k.includes('haccp') || k.includes('appcc')) entry = SECTOR_CLAUSES.alimentario;
  else if (k.includes('hospital') || k.includes('clinic') || k.includes('sanitari')) entry = SECTOR_CLAUSES.hospitalario;
  else if (k.includes('hotel') && !k.includes('hostel')) entry = SECTOR_CLAUSES.hotelero;
  else if (k.includes('hostel') || k.includes('restaur') || k.includes('hosteleri')) entry = SECTOR_CLAUSES.hostelero;
  else if (k.includes('supermercado') || k.includes('super ')) entry = SECTOR_CLAUSES.supermercado;
  else if (k.includes('retail') || k.includes('gran superficie') || k.includes('tienda')) entry = SECTOR_CLAUSES.retail;
  else if (k.includes('oficina') || k.includes('coworking')) entry = SECTOR_CLAUSES.oficinas;
  else if (k.includes('comunidad') || k.includes('vecinos') || k.includes('propietarios')) entry = SECTOR_CLAUSES.comunidad;

  if (!entry) return null;
  return `<div class="section">
  <div class="section-title"><span>${esc(entry.titulo)}</span></div>
  ${entry.cuerpo}
</div>`;
}

// ── HTML builder ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function listItems(items: string[]): string {
  return items.map(i => `<li>${esc(i)}</li>`).join('');
}

function installationList(raw: string): string {
  const lines = raw.split('\n').filter(l => l.trim());
  return lines.map((l, i) => `<li><strong>${i + 1}.</strong> ${esc(l.trim())}</li>`).join('');
}

export function buildContractHTML(v: ContractVars, oficio: string, sector?: string): string {
  const c = getOficioContent(oficio);
  const logoHtml = v.logo_url
    ? `<img src="${v.logo_url}" alt="Logo" style="max-height:52px;max-width:160px;object-fit:contain" />`
    : `<div style="width:52px;height:52px;background:#1e3a5f;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#FFC400;font-weight:900;font-size:18px">TF</div>`;

  const cuotaMes = v.cuota_mensual ? parseFloat(v.cuota_mensual.replace(',', '.')) : 0;
  const ivaPct = v.iva_pct ? parseFloat(v.iva_pct) : 21;
  const cuotaConIva = (cuotaMes * (1 + ivaPct / 100)).toFixed(2).replace('.', ',');
  const cuotaAnualSinIva = (cuotaMes * 12).toFixed(2).replace('.', ',');
  const cuotaAnualConIva = (cuotaMes * 12 * (1 + ivaPct / 100)).toFixed(2).replace('.', ',');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Contrato de Mantenimiento · ${esc(v.referencia)}</title>
<style>
  @page { size: A4; margin: 18mm 18mm 20mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9.5pt; color: #1a1a2e; line-height: 1.5; background: #fff; }

  /* Header */
  .page-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 18px; }
  .header-right { text-align: right; font-size: 7.5pt; color: #555; }
  .header-ref { font-weight: 700; color: #1e3a5f; font-size: 8pt; }

  /* Title block */
  .contract-title-block { background: #1e3a5f; color: white; padding: 16px 20px; border-radius: 6px; text-align: center; margin-bottom: 20px; }
  .contract-title-block h1 { font-size: 15pt; font-weight: 900; margin-bottom: 4px; }
  .contract-title-block h2 { font-size: 10pt; font-weight: 600; color: #FFC400; margin-bottom: 6px; }
  .contract-title-block .ref-line { font-size: 8pt; color: #b0c4de; }

  /* Parties table */
  .parties-table { display: grid; grid-template-columns: 1fr 1fr; gap: 0; margin-bottom: 16px; border: 1.5px solid #1e3a5f; border-radius: 6px; overflow: hidden; }
  .party-cell { padding: 12px 14px; }
  .party-cell.prestador { background: #eef2f8; border-right: 1.5px solid #1e3a5f; }
  .party-cell.cliente { background: #fffbe6; }
  .party-label { font-size: 7pt; font-weight: 900; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; }
  .party-name { font-size: 10.5pt; font-weight: 900; color: #1a1a2e; margin-bottom: 3px; }
  .party-detail { font-size: 8.5pt; color: #444; line-height: 1.4; }

  /* Summary bar */
  .summary-bar { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1.5px solid #1e3a5f; border-radius: 6px; overflow: hidden; margin-bottom: 12px; }
  .summary-cell { padding: 10px 12px; text-align: center; }
  .summary-cell.dark { background: #1e3a5f; color: white; }
  .summary-cell.accent { background: #FFC400; color: #1a1a2e; }
  .summary-label { font-size: 6.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.75; margin-bottom: 3px; }
  .summary-value { font-size: 12pt; font-weight: 900; }
  .conditions-line { font-size: 7.5pt; color: #555; text-align: center; margin-bottom: 20px; }

  /* Sections */
  .section { margin-bottom: 16px; page-break-inside: avoid; }
  .section-title { background: #eef2f8; border-left: 4px solid #1e3a5f; padding: 6px 12px; margin-bottom: 8px; border-radius: 0 4px 4px 0; }
  .section-title span { font-size: 9pt; font-weight: 900; color: #1e3a5f; text-transform: uppercase; letter-spacing: 0.05em; }
  .section-subtitle { font-size: 8.5pt; font-weight: 700; color: #1e3a5f; margin: 8px 0 4px; }
  p { font-size: 9pt; margin-bottom: 6px; text-align: justify; }
  ul { padding-left: 16px; margin-bottom: 6px; }
  ul li { font-size: 9pt; margin-bottom: 3px; list-style: none; padding-left: 10px; position: relative; }
  ul li::before { content: "▸"; position: absolute; left: -4px; color: #1e3a5f; font-size: 8pt; }

  /* SLA table */
  .sla-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8px; }
  .sla-table th { background: #1e3a5f; color: white; padding: 7px 10px; text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
  .sla-table td { padding: 6px 10px; border-bottom: 1px solid #e8eef5; }
  .sla-table tr:nth-child(even) td { background: #f5f7fa; }
  .sla-table td:first-child { font-weight: 600; color: #1e3a5f; }

  /* Economic table */
  .eco-table { width: 100%; border-collapse: collapse; font-size: 8.5pt; margin-bottom: 8px; }
  .eco-table th { background: #1e3a5f; color: white; padding: 7px 10px; text-align: left; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
  .eco-table td { padding: 6px 10px; border-bottom: 1px solid #e8eef5; }
  .eco-table td:first-child { font-weight: 600; }
  .eco-table td:last-child { font-weight: 700; }
  .eco-table tr.total-row td { background: #fffbe6; font-weight: 900; font-size: 10pt; color: #1e3a5f; }

  /* Annex */
  .annex-title { background: #1e3a5f; color: white; padding: 10px 14px; border-radius: 6px; margin-bottom: 10px; }
  .annex-title h3 { font-size: 11pt; font-weight: 900; }
  .annex-subtitle { font-size: 8pt; color: #b0c4de; margin-top: 2px; }
  .annex-table { width: 100%; border-collapse: collapse; font-size: 8pt; margin-bottom: 8px; }
  .annex-table th { background: #1e3a5f; color: white; padding: 6px 8px; text-align: left; font-size: 7.5pt; font-weight: 700; }
  .annex-table td { padding: 5px 8px; border-bottom: 1px solid #dde4ed; }
  .annex-table tr:nth-child(even) td { background: #f5f7fa; }

  /* Signature block */
  .sig-block { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  .sig-cell { border: 1.5px solid #1e3a5f; border-radius: 6px; overflow: hidden; }
  .sig-cell-header { background: #1e3a5f; color: white; padding: 8px 12px; font-weight: 900; font-size: 8.5pt; text-align: center; text-transform: uppercase; }
  .sig-cell-body { padding: 14px 12px; }
  .sig-line { border-top: 1px solid #999; height: 40px; margin-bottom: 6px; }
  .sig-label { font-size: 7.5pt; color: #777; text-align: center; margin-bottom: 4px; }
  .sig-name { font-size: 9pt; font-weight: 700; }
  .sig-detail { font-size: 7.5pt; color: #555; }

  /* Page break */
  .page-break { page-break-before: always; }

  /* Footer */
  .doc-footer { margin-top: 20px; padding-top: 8px; border-top: 1px solid #dde4ed; font-size: 7pt; color: #888; display: flex; justify-content: space-between; }

  /* Print only page header repetition */
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>

<!-- ═══ PAGE 1: COVER ═══ -->
<div class="page-header">
  ${logoHtml}
  <div class="header-right">
    <div class="header-ref">CONTRATO DE MANTENIMIENTO · Ref: ${esc(v.referencia)}</div>
    <div>${esc(v.empresa)} · ${esc(v.email_empresa)}</div>
  </div>
</div>

<div class="contract-title-block">
  <h1>CONTRATO DE PRESTACIÓN DE SERVICIOS DE MANTENIMIENTO</h1>
  <h2>${esc(c.titulo)}</h2>
  <div class="ref-line">Referencia: ${esc(v.referencia)}</div>
</div>

<div class="parties-table">
  <div class="party-cell prestador">
    <div class="party-label">Prestador del Servicio</div>
    <div class="party-name">${esc(v.empresa)}</div>
    <div class="party-detail">
      CIF: ${esc(v.cif_empresa)}<br>
      ${esc(v.direccion_empresa)}<br>
      ${esc(v.telefono_empresa)} · ${esc(v.email_empresa)}
    </div>
  </div>
  <div class="party-cell cliente">
    <div class="party-label">Cliente</div>
    <div class="party-name">${esc(v.nombre_cliente)}</div>
    <div class="party-detail">
      CIF/NIF: ${esc(v.cif_cliente)}<br>
      ${esc(v.direccion_cliente)}<br>
      ${esc(v.telefono_cliente)} · ${esc(v.email_cliente)}<br>
      Representante: ${esc(v.representante_cliente)} (${esc(v.cargo_representante)})
    </div>
  </div>
</div>

<div class="summary-bar">
  <div class="summary-cell dark">
    <div class="summary-label">Inicio</div>
    <div class="summary-value">${esc(v.fecha_inicio || '[ DD/MM/AAAA ]')}</div>
  </div>
  <div class="summary-cell dark">
    <div class="summary-label">Fin inicial</div>
    <div class="summary-value">${esc(v.fecha_fin || '[ DD/MM/AAAA ]')}</div>
  </div>
  <div class="summary-cell dark">
    <div class="summary-label">Cuota mensual (s/IVA)</div>
    <div class="summary-value">${esc(v.cuota_mensual || '[ XXX,XX ]')} EUR</div>
  </div>
  <div class="summary-cell accent">
    <div class="summary-label">Total mes c/IVA</div>
    <div class="summary-value">${esc(cuotaConIva)} EUR</div>
  </div>
</div>

<p class="conditions-line">
  Duración: ${esc(v.duracion_meses)} meses · Renovación: automática por períodos anuales sucesivos ·
  Forma de pago: ${esc(v.forma_pago)} · Vencimiento día ${esc(v.dia_vencimiento)}
</p>

<!-- ═══ BODY ═══ -->

<div class="section page-break">
  <p><strong>EXPOSITIVO</strong></p>
  <p>En ${esc(v.ciudad_firma || '[ CIUDAD ]')}, a ${esc(v.fecha_inicio || '[ DD/MM/AAAA ]')}.</p>
  <p>De una parte, <strong>${esc(v.empresa)}</strong>, con CIF <strong>${esc(v.cif_empresa)}</strong>, domiciliada en ${esc(v.direccion_empresa)}, en adelante <em>"EL PRESTADOR"</em>.</p>
  <p>De otra parte, <strong>${esc(v.nombre_cliente)}</strong>, con CIF/NIF <strong>${esc(v.cif_cliente)}</strong>, domiciliada en ${esc(v.direccion_cliente)}, representada en este acto por <strong>${esc(v.representante_cliente)}</strong>, con cargo de <strong>${esc(v.cargo_representante)}</strong>, en adelante <em>"EL CLIENTE"</em>.</p>
  <p>Ambas partes se reconocen mutuamente plena capacidad legal para suscribir el presente contrato y, a tal efecto,</p>
  <p style="font-size:11pt;font-weight:900;margin:10px 0 8px">ACUERDAN</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 1. Objeto del Contrato</span></div>
  <p>El presente contrato tiene por objeto la prestación por parte de EL PRESTADOR de los servicios de mantenimiento en las instalaciones indicadas en la Cláusula 3, de acuerdo con el alcance técnico definido en la Cláusula 4 y las condiciones económicas establecidas en la Cláusula 6.</p>
  <p>${esc(c.objeto)}</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 2. Duración y Renovación</span></div>
  <p>El presente contrato tendrá una vigencia inicial de <strong>${esc(v.duracion_meses)} meses</strong>, con fecha de inicio el <strong>${esc(v.fecha_inicio || '[ DD/MM/AAAA ]')}</strong> y fecha de fin inicial el <strong>${esc(v.fecha_fin || '[ DD/MM/AAAA ]')}</strong>.</p>
  <p>Transcurrido el período inicial, el contrato se renovará de forma automática por períodos anuales sucesivos, salvo que cualquiera de las partes comunique su voluntad de no renovar con una antelación mínima de 30 días naturales mediante comunicación escrita fehaciente.</p>
  <p>Cualquier modificación de las condiciones económicas en el momento de la renovación requerirá acuerdo expreso de ambas partes con al menos 15 días de antelación a la fecha de renovación.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 3. Instalaciones y Ubicaciones</span></div>
  <p>El presente contrato se aplicará a las siguientes instalaciones y/o ubicaciones:</p>
  <ul>${installationList(v.descripcion_instalaciones)}</ul>
  <p>Cualquier modificación, ampliación o reducción de las instalaciones incluidas en el contrato deberá ser acordada por escrito mediante Anexo adicional firmado por ambas partes, pudiendo implicar una revisión del importe de la cuota.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 4. Alcance del Servicio</span></div>
  <div class="section-subtitle">4.1 Servicios incluidos</div>
  <p>El servicio de mantenimiento comprende las siguientes actuaciones:</p>
  <ul>${listItems(c.serviciosIncluidos)}</ul>
  <div class="section-subtitle">4.2 Servicios NO incluidos (exclusiones)</div>
  <p>Quedan expresamente excluidas del presente contrato las siguientes actuaciones:</p>
  <ul>${listItems(c.serviciosExcluidos)}</ul>
  <p>Cualquier actuación fuera del alcance anterior podrá ser presupuestada y ejecutada previo acuerdo económico entre las partes.</p>
  <div class="section-subtitle">4.3 Mantenimiento preventivo</div>
  <p>Con carácter preventivo, se realizarán las siguientes actuaciones periódicas:</p>
  <ul>${listItems(c.mantenimientoPreventivo)}</ul>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 5. Horario de Servicio y Nivel de Servicio (SLA)</span></div>
  <table class="sla-table">
    <tr><th>Parámetro SLA</th><th>Valor acordado</th></tr>
    <tr><td>Horario de guardia ordinaria</td><td>${esc(v.horario_guardia)}</td></tr>
    <tr><td>Servicio de urgencias</td><td>${esc(v.servicio_urgencias)}</td></tr>
    <tr><td>Tiempo máximo de respuesta</td><td>${esc(v.tiempo_respuesta)}</td></tr>
    <tr><td>Tiempo máximo de resolución</td><td>${esc(v.tiempo_resolucion)}</td></tr>
    <tr><td>Disponibilidad garantizada</td><td>${esc(v.disponibilidad)}</td></tr>
    <tr><td>Penalización por incumplimiento SLA</td><td>${esc(v.penalizacion_sla)}</td></tr>
  </table>
  <p>En caso de avería o incidencia, EL CLIENTE deberá comunicarlo preferentemente a través de la plataforma TrabFlow o al teléfono de atención indicado. EL PRESTADOR registrará la incidencia y actuará en los plazos acordados en la presente cláusula.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 6. Importe y Condiciones Económicas</span></div>
  <table class="eco-table">
    <tr><th>Concepto</th><th>Importe</th></tr>
    <tr><td>Cuota mensual sin IVA</td><td>${esc(v.cuota_mensual || '[ XXX,XX ]')} EUR</td></tr>
    <tr><td>IVA (${esc(v.iva_pct)}%)</td><td>${esc(((cuotaMes * ivaPct) / 100).toFixed(2).replace('.', ','))} EUR</td></tr>
    <tr class="total-row"><td>Cuota mensual TOTAL con IVA</td><td>${esc(cuotaConIva)} EUR</td></tr>
    <tr><td>Cuota anual sin IVA</td><td>${esc(cuotaAnualSinIva)} EUR</td></tr>
    <tr><td>Cuota anual con IVA</td><td>${esc(cuotaAnualConIva)} EUR</td></tr>
    <tr><td>Forma de pago</td><td>${esc(v.forma_pago)}</td></tr>
    <tr><td>IBAN para domiciliación</td><td>${esc(v.iban || '[ ES00 0000 0000 00 0000000000 ]')}</td></tr>
    <tr><td>Día de vencimiento</td><td>Día ${esc(v.dia_vencimiento)} de cada mes</td></tr>
  </table>
  <p>EL PRESTADOR emitirá la correspondiente factura dentro de los primeros 5 días hábiles de cada mes por el servicio prestado. Los precios acordados se revisarán anualmente aplicando el IPC publicado por el INE, salvo pacto expreso en contrario.</p>
  <p>En caso de impago, EL PRESTADOR podrá suspender la prestación del servicio previa comunicación fehaciente con 10 días de antelación, sin perjuicio de reclamar los importes debidos más los intereses de demora legalmente establecidos.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 7. Obligaciones de EL PRESTADOR</span></div>
  <ul>
    <li>Prestar el servicio con la diligencia, profesionalidad y conocimiento técnico requeridos, utilizando medios humanos y materiales adecuados.</li>
    <li>Cumplir los plazos y niveles de servicio definidos en la Cláusula 5.</li>
    <li>Mantener en todo momento las titulaciones, certificaciones y seguros necesarios para la realización de los trabajos contratados.</li>
    <li>Emitir un informe técnico de cada intervención preventiva o correctiva realizada en las instalaciones.</li>
    <li>Tratar con confidencialidad toda la información de EL CLIENTE a la que tenga acceso en el desempeño del servicio.</li>
    <li>Informar proactivamente a EL CLIENTE de cualquier anomalía detectada que pueda afectar al correcto funcionamiento de las instalaciones.</li>
    <li>Cumplir con la normativa de Prevención de Riesgos Laborales y coordinación de actividades empresariales (Real Decreto 171/2004).</li>
  </ul>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 8. Obligaciones de EL CLIENTE</span></div>
  <ul>
    <li>Facilitar el acceso a las instalaciones objeto del contrato en los horarios y condiciones necesarios para la prestación del servicio.</li>
    <li>Designar un interlocutor técnico responsable para la coordinación del servicio.</li>
    <li>Comunicar de forma inmediata cualquier avería, incidencia o anomalía detectada.</li>
    <li>No realizar modificaciones en las instalaciones mantenidas sin previo aviso a EL PRESTADOR.</li>
    <li>Abonar las facturas en los plazos establecidos en la Cláusula 6.</li>
    <li>Proporcionar a EL PRESTADOR la documentación técnica de las instalaciones necesaria para la correcta prestación del servicio.</li>
  </ul>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 9. Responsabilidad y Seguros</span></div>
  <p>EL PRESTADOR dispondrá de seguro de Responsabilidad Civil General con una cobertura mínima de <strong>${esc(v.cobertura_rc)} EUR</strong> para hacer frente a los daños que pudieran derivarse de la prestación del servicio.</p>
  <p>EL PRESTADOR no será responsable de los daños causados por el mal uso de las instalaciones, por modificaciones realizadas por terceros ajenos al contrato, por situaciones de fuerza mayor o por incumplimientos del CLIENTE de las obligaciones establecidas en la Cláusula 8.</p>
  <p>La responsabilidad máxima de EL PRESTADOR por daños directos derivados del incumplimiento del contrato quedará limitada al importe de las cuotas abonadas en los últimos 6 meses de vigencia.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 10. Normativa Técnica y Legal Aplicable</span></div>
  <p>EL PRESTADOR llevará a cabo todos los trabajos objeto del presente contrato de conformidad con la normativa técnica y legal vigente, incluyendo entre otras:</p>
  <ul>${listItems(c.normativa)}</ul>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 11. Confidencialidad y Protección de Datos</span></div>
  <p>Ambas partes se comprometen a mantener la más estricta confidencialidad sobre la información intercambiada en el marco del presente contrato, no divulgándola a terceros sin el consentimiento previo por escrito de la otra parte.</p>
  <p>El tratamiento de datos personales derivado de la ejecución del presente contrato se realizará de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018. EL PRESTADOR actuará como Encargado del Tratamiento respecto a los datos del personal del CLIENTE a los que pudiera tener acceso.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 12. Modificaciones del Contrato</span></div>
  <p>Cualquier modificación de las condiciones del presente contrato deberá realizarse mediante Anexo escrito firmado por ambas partes. Las modificaciones de alcance técnico, instalaciones o importe económico no serán efectivas hasta su formalización por escrito.</p>
  <p>Las variaciones de precio por revisión anual de IPC no requerirán Anexo adicional, siendo suficiente la notificación escrita de EL PRESTADOR con 30 días de antelación.</p>
</div>

<div class="section">
  <div class="section-title"><span>Cláusula 13. Causas de Resolución</span></div>
  <p>El presente contrato podrá resolverse anticipadamente por cualquiera de las partes en los siguientes supuestos:</p>
  <ul style="list-style-type: lower-alpha; padding-left: 20px">
    <li style="padding-left: 4px">Mutuo acuerdo de las partes por escrito.</li>
    <li style="padding-left: 4px">Incumplimiento grave y reiterado de las obligaciones establecidas en el contrato, previa comunicación fehaciente otorgando un plazo de subsanación de 15 días.</li>
    <li style="padding-left: 4px">Impago de dos o más cuotas consecutivas por parte del CLIENTE.</li>
    <li style="padding-left: 4px">Cese de actividad de cualquiera de las partes.</li>
    <li style="padding-left: 4px">Fuerza mayor que imposibilite la prestación del servicio durante más de 3 meses consecutivos.</li>
  </ul>
  <p>La resolución anticipada por causa imputable a una de las partes dará derecho a la otra a exigir el pago de los daños y perjuicios ocasionados conforme a lo establecido en el Código Civil.</p>
</div>

${sector ? (getSectorClauseHTML(sector) ?? '') : ''}

<div class="section">
  <div class="section-title"><span>Cláusula 14. Jurisdicción y Legislación Aplicable</span></div>
  <p>El presente contrato se rige por la legislación española. Para la resolución de cualquier controversia que pudiera surgir en relación con la interpretación, cumplimiento o ejecución del presente contrato, ambas partes, con renuncia a su fuero propio, se someten expresamente a los Juzgados y Tribunales de <strong>${esc(v.ciudad_jurisdiccion || v.ciudad_firma || '[ CIUDAD ]')}</strong>.</p>
  <p>Con carácter previo a cualquier actuación judicial, las partes se comprometen a intentar una resolución amistosa de la controversia mediante mediación conforme a la Ley 5/2012 de Mediación en Asuntos Civiles y Mercantiles.</p>
</div>

<!-- Signatures -->
<div class="section">
  <p>En prueba de conformidad, ambas partes suscriben el presente contrato en dos ejemplares originales de igual valor y efecto, en el lugar y fecha indicados.</p>
  <p><strong>En ${esc(v.ciudad_firma || '[ CIUDAD ]')}, a ${esc(v.fecha_inicio || '[ DD/MM/AAAA ]')}</strong></p>
  <div class="sig-block">
    <div class="sig-cell">
      <div class="sig-cell-header">EL PRESTADOR</div>
      <div class="sig-cell-body">
        <div class="sig-label">Firma y sello</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(v.empresa)}</div>
        <div class="sig-detail">CIF: ${esc(v.cif_empresa)}</div>
        <div class="sig-detail">Fecha: _______________</div>
      </div>
    </div>
    <div class="sig-cell">
      <div class="sig-cell-header">EL CLIENTE</div>
      <div class="sig-cell-body">
        <div class="sig-label">Firma y sello</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(v.nombre_cliente)}</div>
        <div class="sig-detail">CIF: ${esc(v.cif_cliente)} · Repr: ${esc(v.representante_cliente)}</div>
        <div class="sig-detail">Fecha: _______________</div>
      </div>
    </div>
  </div>
</div>

<!-- ═══ ANNEX I ═══ -->
<div class="page-break">
  <div class="annex-title">
    <h3>ANEXO I — INVENTARIO DE INSTALACIONES Y EQUIPOS</h3>
    <div class="annex-subtitle">Contrato: ${esc(v.referencia)} · Cliente: ${esc(v.nombre_cliente)}</div>
  </div>
  <p>El presente Anexo recoge el inventario detallado de instalaciones, equipos y elementos objeto del presente contrato de mantenimiento. Este inventario podrá ser actualizado mediante documento firmado por ambas partes sin necesidad de modificar el contrato principal.</p>
  <table class="annex-table">
    <tr>
      <th style="width:4%">Nº</th>
      <th style="width:36%">Descripción del equipo / instalación</th>
      <th style="width:22%">Marca / Modelo</th>
      <th style="width:18%">Ubicación</th>
      <th style="width:10%">Año inst.</th>
      <th style="width:10%">Incluido</th>
    </tr>
    ${Array.from({length: 15}, (_, i) => `<tr style="height:28px"><td style="text-align:center;color:#999">${i+1}</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td style="text-align:center">☐</td></tr>`).join('')}
  </table>
  <p style="margin-top:12px">Límite de coste para reparaciones correctivas incluidas sin presupuesto adicional: <strong>${esc(v.limite_correctivo)} EUR</strong> por actuación.</p>
  <p style="margin-top:8px;font-size:10px;color:#666">Firma de conformidad del inventario — Prestador: ___________________________ &nbsp;&nbsp; Cliente: ___________________________</p>
</div>

<!-- ═══ ANNEX II ═══ -->
<div class="page-break">
  <div class="annex-title">
    <h3>ANEXO II — REGISTRO DE ACTUACIONES Y PARTES DE TRABAJO</h3>
    <div class="annex-subtitle">Contrato: ${esc(v.referencia)} · Cliente: ${esc(v.nombre_cliente)}</div>
  </div>
  <p>Cada intervención realizada en el marco del presente contrato quedará registrada mediante Parte de Trabajo que incluirá la siguiente información mínima:</p>
  <ul>
    <li>Número de parte, fecha y hora de la actuación.</li>
    <li>Tipo de intervención: preventiva / correctiva / urgencia.</li>
    <li>Instalación o equipo objeto de la actuación.</li>
    <li>Descripción de los trabajos realizados y materiales empleados.</li>
    <li>Tiempo de intervención y técnico responsable.</li>
    <li>Estado de la instalación al finalizar la intervención.</li>
    <li>Firma del técnico y firma de conformidad del representante del CLIENTE.</li>
  </ul>
  <table class="annex-table">
    <tr>
      <th>Parte Nº</th>
      <th>Fecha / Hora</th>
      <th>Tipo</th>
      <th>Instalación / Equipo</th>
      <th>Horas</th>
      <th>Técnico</th>
      <th>Observaciones</th>
    </tr>
    ${[1,2,3,4,5].map(() => `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`).join('')}
  </table>
  <div class="doc-footer">
    <span>${esc(v.empresa)} · ${esc(v.referencia)} · Contrato de Mantenimiento</span>
    <span>Generado con TrabFlow AI · trabflow.com</span>
  </div>
</div>

</body>
</html>`;
}
