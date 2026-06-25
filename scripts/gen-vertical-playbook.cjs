/* eslint-disable */
'use strict';
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, AlignmentType, BorderStyle, ShadingType, PageBreak,
  convertInchesToTwip, TableLayoutType, Header, Footer, PageNumber,
  NumberingFormat,
} = require('docx');
const fs = require('fs');
const path = require('path');

// ── Colors ─────────────────────────────────────────────────────────────────
const BLUE   = '1A5A96';
const DARK   = '0F1A2E';
const GRAY   = 'F5F6F8';
const ACCENT = 'C8922A';
const GREEN  = '1A7A5A';
const RED    = 'B84E35';
const WHITE  = 'FFFFFF';
const TEXT   = '1C2535';
const MUTED  = '64748B';

// ── Helpers ─────────────────────────────────────────────────────────────────
const pt = (n) => n * 20; // half-points → twips

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: pt(18), after: pt(8) },
    children: [new TextRun({ text, bold: true, size: pt(20), color: DARK })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: pt(14), after: pt(6) },
    children: [new TextRun({ text, bold: true, size: pt(14), color: BLUE })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: pt(10), after: pt(4) },
    children: [new TextRun({ text, bold: true, size: pt(12), color: ACCENT })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: pt(4), after: pt(4) },
    children: [new TextRun({ text, size: pt(11), color: opts.color || TEXT, bold: opts.bold || false, italics: opts.italic || false })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { before: pt(2), after: pt(2) },
    children: [new TextRun({ text, size: pt(11), color: TEXT })],
  });
}
function gap(lines = 1) {
  return Array.from({ length: lines }, () => new Paragraph({ children: [new TextRun({ text: '' })] }));
}
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}
function labelValue(label, value) {
  return new Paragraph({
    spacing: { before: pt(3), after: pt(3) },
    children: [
      new TextRun({ text: label + ': ', bold: true, size: pt(11), color: BLUE }),
      new TextRun({ text: value, size: pt(11), color: TEXT }),
    ],
  });
}

function sectionHeader(num, title, subtitle) {
  return [
    new Paragraph({
      shading: { type: ShadingType.SOLID, color: DARK },
      spacing: { before: pt(14), after: pt(2) },
      children: [
        new TextRun({ text: `${num}. ${title}`, bold: true, size: pt(16), color: WHITE }),
      ],
    }),
    subtitle ? new Paragraph({
      shading: { type: ShadingType.SOLID, color: BLUE },
      spacing: { before: 0, after: pt(10) },
      children: [new TextRun({ text: subtitle, size: pt(10), color: WHITE, italics: true })],
    }) : null,
  ].filter(Boolean);
}

function simpleTable(headers, rows, colWidths) {
  const headerRow = new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => new TableCell({
      shading: { type: ShadingType.SOLID, color: BLUE },
      width: { size: colWidths[i], type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: pt(9), color: WHITE })] })],
    })),
  });
  const dataRows = rows.map((row, ri) => new TableRow({
    children: row.map((cell, ci) => new TableCell({
      shading: { type: ShadingType.SOLID, color: ri % 2 === 0 ? 'FFFFFF' : 'F8FAFC' },
      width: { size: colWidths[ci], type: WidthType.PERCENTAGE },
      children: [new Paragraph({ children: [new TextRun({ text: String(cell), size: pt(9.5), color: TEXT })] })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    rows: [headerRow, ...dataRows],
  });
}

// ── Cover ──────────────────────────────────────────────────────────────────
const cover = [
  new Paragraph({ spacing: { before: pt(40), after: pt(4) }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'ANÁLISIS ESTRATÉGICO DE PRODUCTO', bold: true, size: pt(26), color: DARK })] }),
  new Paragraph({ spacing: { before: pt(2), after: pt(4) }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Documento interno · Versión 2.0 · Junio 2026', size: pt(11), color: MUTED })] }),
  new Paragraph({ spacing: { before: pt(8), after: pt(4) }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nuevos Verticales Estratégicos', bold: true, size: pt(18), color: BLUE })] }),
  new Paragraph({ spacing: { before: pt(2), after: pt(2) }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Cargadores de Vehículo Eléctrico & Fotovoltaica Industrial', bold: true, size: pt(16), color: ACCENT })] }),
  new Paragraph({ spacing: { before: pt(4), after: pt(30) }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Viabilidad · Mercado · Arquitectura IA · Flujo de Usuario · Integraciones · Monitorización · Automatizaciones · ROI', size: pt(11), color: MUTED, italics: true })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'TrabFlow Technologies, S.L.  ·  Majadahonda, Madrid  ·  2026', size: pt(10), color: MUTED })] }),
  pageBreak(),
];

// ── Section 01: Resumen Ejecutivo ──────────────────────────────────────────
const s01 = [
  ...sectionHeader('01', 'Resumen Ejecutivo', 'Potencial de mercado · Encaje · Prioridad · Dificultad · Ingresos'),
  body('Conclusión principal: Ambos verticales son estratégicamente prioritarios para TrabFlow en 2026-2028. Los cargadores VE tienen un perfil de entrada más rápido y un volumen de actuaciones más accesible. La fotovoltaica industrial ofrece tickets más altos y recurrencia estructural vía contratos O&M, pero requiere mayor inversión en Base Maestra y normativa RAG. La recomendación es entrar en paralelo con distinta velocidad: VE en Q3 2026, Fotovoltaica Industrial en Q1 2027.', { bold: false }),
  ...gap(),
  simpleTable(
    ['Vertical', 'Mercado ESP', 'Ticket medio', 'Recurrencia', 'Dificultad', 'Score'],
    [
      ['Cargadores VE', '€2.100M (2025)', '€600–2.500', 'Alta (O&M)', 'Media', '9/10'],
      ['Fotovoltaica Industrial', '€4.800M (2025)', '€2.000–15.000', 'Muy alta (O&M)', 'Alta', '8/10'],
      ['Electricidad (ref.)', '€19.300M', '€300–1.200', 'Media', 'Baja', '—'],
      ['Fontanería (ref.)', '€8.200M', '€250–900', 'Media', 'Baja', '—'],
    ],
    [22, 18, 18, 16, 14, 12]
  ),
  ...gap(),
  body('Potencial de ingresos para TrabFlow (3 años)', { bold: true }),
  simpleTable(
    ['Vertical', 'Año 1', 'Año 2', 'Año 3'],
    [
      ['Cargadores VE', '€18.000–€35.000', '€55.000–€90.000', '€120.000–€200.000'],
      ['Fotovoltaica Industrial', '€12.000–€25.000', '€45.000–€80.000', '€150.000–€280.000'],
      ['TOTAL combinado', '€30.000–€60.000', '€100.000–€170.000', '€270.000–€480.000'],
    ],
    [30, 23, 23, 24]
  ),
  pageBreak(),
];

// ── NEW SECTION A: Arquitectura IA del Vertical ────────────────────────────
const sA = [
  ...sectionHeader('A', 'Arquitectura IA del Vertical', 'Cómo detecta · Prompts · Embeddings · Normativa · Plantillas · Materiales · Contratos'),

  h2('A.1 Principio Fundamental de TrabFlow'),
  body('La IA de TrabFlow no inventa. Detecta una actuación técnica en la conversación del instalador y ejecuta una plantilla preconfigurada con materiales, reglas de cálculo y partidas reales de la Base Maestra. Este principio diferencial se aplica igual en VE y Fotovoltaica que en electricidad o fontanería.'),
  ...gap(),

  h2('A.2 Pipeline de Detección de Actuación'),
  h3('Paso 1 — Entrada multimodal'),
  bullet('Voz transcrita por Whisper (OpenAI) → texto en español técnico'),
  bullet('Imagen procesada por vision model → descripción del elemento visible'),
  bullet('Texto libre tecleado directamente en el chat'),
  bullet('Datos de formulario estructurado (tipo trabajo, ubicación, kW)'),

  h3('Paso 2 — Clasificador de intención (Prompt Layer 1)'),
  body('Prompt de sistema (extracto representativo):', { italic: true }),
  new Paragraph({
    spacing: { before: pt(4), after: pt(4) },
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    children: [new TextRun({
      text: 'Eres el asistente técnico de TrabFlow para instaladores de VE y fotovoltaica. Tu tarea es identificar la actuación técnica descrita y mapearla al identificador exacto de la Base Maestra (ej: "VE-01", "FV-26"). Si hay ambigüedad, devuelve las 3 actuaciones más probables con score de confianza 0-1. Si no hay actuación clara, solicita aclaración concreta al instalador.',
      size: pt(10), color: '334155', italics: true,
    })],
  }),

  h3('Paso 3 — Búsqueda semántica en Base Maestra (Embeddings)'),
  body('Modelo de embeddings: voyage-3-lite (Voyage AI) — proveedor único ya integrado en TrabFlow. Índice vectorial: HNSW (m=16, ef_construction=64) sobre pgvector 0.5+. Búsqueda híbrida vector + FTS para referencias exactas de artículos.'),
  simpleTable(
    ['Colección Vectorial', 'Contenido indexado', 'Dimensiones', 'Similitud'],
    [
      ['bm_ve_actuaciones', '50 actuaciones VE con materiales, normativa, palabras clave técnicas', '1536', 'cosine'],
      ['bm_fv_actuaciones', '100 actuaciones FV con materiales, normativa, palabras clave técnicas', '1536', 'cosine'],
      ['normativa_ve', 'ITC-BT-52, REBT, MOVES III, AFIR, manuales fabricantes', '1536', 'cosine'],
      ['normativa_fv', 'RD 244/2019, RD 1183/2020, IEC 62446, IEC 61724, guías IDAE', '1536', 'cosine'],
      ['contratos_plantillas', 'Cláusulas O&M VE y FV, SLAs, condiciones económicas', '1536', 'cosine'],
    ],
    [28, 40, 16, 16]
  ),

  ...gap(),
  h3('Paso 4 — Generación de presupuesto (Prompt Layer 2)'),
  body('Una vez identificada la actuación (ej: FV-26: Inspección termográfica de paneles), el sistema ejecuta:'),
  bullet('Carga de plantilla de la Base Maestra con partidas predefinidas'),
  bullet('Inyección de parámetros del instalador: potencia planta (kWp), número de paneles, tipo de estructura, accesibilidad'),
  bullet('Cálculo de materiales: fórmulas por kWp o por panel desde la Base Maestra'),
  bullet('Aplicación de margen configurado por la org'),
  bullet('Generación de PDF/Word con formato TrabFlow'),

  ...gap(),
  h2('A.3 Embeddings necesarios por vertical'),
  simpleTable(
    ['Vertical', 'Colecciones', 'Docs a indexar', 'Coste estimado indexación', 'Actualización'],
    [
      ['VE', '2 (actuaciones + normativa)', '~250 fragmentos', '< €2', 'Por versión normativa'],
      ['FV Industrial', '3 (actuaciones + normativa + contratos)', '~500 fragmentos', '< €5', 'Semestral + nuevas IEC'],
      ['Total ambos', '5 colecciones', '~750 fragmentos', '< €8 total', 'Automático vía pipeline'],
    ],
    [18, 22, 22, 22, 16]
  ),

  ...gap(),
  h2('A.4 Normativa consultada por el asistente RAG'),
  h3('Cargadores VE'),
  bullet('ITC-BT-52 (REBT) — normativa madre, todas las instalaciones VE'),
  bullet('RD 266/2021 (MOVES III) — subvenciones vigentes, requisitos documentales'),
  bullet('Reglamento AFIR 2023/1804 — objetivos europeos, obligaciones 2025-2030'),
  bullet('IEC 61851 — modos de carga 1/2/3/4, obligaciones técnicas'),
  bullet('OCPP 1.6/2.0 — protocolo comunicación cargador-plataforma'),
  bullet('Ley 49/1960 de Propiedad Horizontal — mayorías comunidades'),
  bullet('Manuales Wallbox, ABB, Schneider, Circutor — configuración y puesta en marcha'),

  h3('Fotovoltaica Industrial'),
  bullet('RD 244/2019 — autoconsumo, modalidades, compensación excedentes, registro'),
  bullet('RD 1183/2020 — acceso y conexión a red, solicitud ATR'),
  bullet('IEC 62446-1 y -3 — documentación y termografía FV'),
  bullet('IEC 61724 — sistemas de monitorización, PR, irradiancia'),
  bullet('IEC 62548 — diseño DC: secciones, fusibles, caídas de tensión'),
  bullet('Guías técnicas IDAE — instalación FV residencial e industrial'),
  bullet('Manuales Huawei FusionSolar, Sungrow, SolarEdge, Fronius, Enphase'),

  ...gap(),
  h2('A.5 Plantillas que ejecuta la IA'),
  simpleTable(
    ['Plantilla', 'Trigger IA', 'Output generado', 'Módulo TrabFlow'],
    [
      ['Presupuesto VE', 'Detección actuación VE-xx', 'PDF presupuesto con partidas ITC-BT-52', 'Presupuestos'],
      ['Presupuesto FV', 'Detección actuación FV-xx', 'PDF presupuesto con partidas IEC 62446', 'Presupuestos'],
      ['Parte de trabajo VE', 'Inicio trabajo desde planificación', 'Checklist digital + foto instalación', 'Partes'],
      ['Parte termografía FV', 'Actuación FV-26/27/28/29', 'Informe termografía con puntos calientes', 'Partes'],
      ['Informe O&M mensual FV', 'Cron mensual + datos monitorización', 'PDF producción real vs. estimada, KPIs', 'Contratos O&M'],
      ['Contrato O&M VE', 'Aceptación presupuesto + solicitud contrato', 'DOCX 14+ cláusulas, SLA, cuota', 'Contratos'],
      ['Contrato O&M FV', 'Aceptación presupuesto + solicitud contrato', 'DOCX con niveles Vigilancia/Preventivo/Full', 'Contratos'],
      ['Memoria técnica legalización VE', 'Actuación VE-11 (legalización)', 'DOCX memoria + esquema unifilar borrador', 'Documentación'],
      ['Solicitud subvención MOVES III', 'Actuación VE-10', 'Documentación normalizada para tramitación', 'Documentación'],
    ],
    [24, 26, 30, 20]
  ),

  ...gap(),
  h2('A.6 Materiales que propone la IA'),
  body('La IA no inventa referencias de material. Propone los materiales de la Base Maestra para cada actuación, con tres fuentes priorizadas:'),
  bullet('1ª prioridad: catálogo del proveedor activado por la org (OBRAMAT, Saltoki, proveedor propio)'),
  bullet('2ª prioridad: referencias genéricas de la Base Maestra (sin proveedor específico)'),
  bullet('3ª prioridad: descripción técnica sin referencia (instalador completa manualmente)'),
  ...gap(),
  body('Ejemplos de propuestas automáticas para FV-26 (Inspección termográfica):'),
  simpleTable(
    ['Material propuesto', 'Referencia Base Maestra', 'Unidad', 'Fuente'],
    [
      ['Cámara termográfica certificada (alquiler)', 'FV-MAT-TERM-001', 'Día', 'BM genérica'],
      ['Informe termografía IEC TS 62446-3', 'FV-MAT-TERM-002', 'Ud', 'Plantilla doc'],
      ['Desplazamiento técnico especialista', 'COM-DESP-001', 'Viaje', 'BM genérica'],
      ['Mano de obra inspección (h)', 'COM-MO-INSP', 'h', 'BM genérica'],
    ],
    [34, 26, 14, 26]
  ),

  ...gap(),
  h2('A.7 Contratos que genera la IA'),
  simpleTable(
    ['Contrato', 'Vertical', 'Cláusulas clave IA', 'Formato', 'Firma digital'],
    [
      ['O&M Básico VE', 'VE', 'SLA tiempo respuesta, preventivos/año, exclusiones', 'DOCX + PDF', 'Sí'],
      ['O&M Premium VE', 'VE', 'NOC 24/7, repuestos incluidos, penalizaciones', 'DOCX + PDF', 'Sí'],
      ['O&M Vigilancia FV', 'FV', 'Monitorización remota, alertas email, informe mensual', 'DOCX + PDF', 'Sí'],
      ['O&M Preventivo FV', 'FV', 'Visitas anuales, checklist IEC 62446, PR garantizado', 'DOCX + PDF', 'Sí'],
      ['O&M Full Service FV', 'FV', 'SLA 99,5%, dron, limpiezas, NOC, bonus/penalización', 'DOCX + PDF', 'Sí'],
      ['Contrato de instalación VE', 'VE', 'Especificaciones técnicas, garantía 2 años, tramitación', 'DOCX + PDF', 'Sí'],
      ['Contrato de instalación FV', 'FV', 'Potencia, inversor, garantías, legalización incluida', 'DOCX + PDF', 'Sí'],
    ],
    [22, 10, 40, 14, 14]
  ),
  pageBreak(),
];

// ── NEW SECTION B: Customer Journey ───────────────────────────────────────
const sB = [
  ...sectionHeader('B', 'Flujo Completo del Usuario', 'Customer Journey · Del primer contacto a la renovación del contrato'),

  h2('B.1 Customer Journey — Cargadores VE'),
  body('Escenario: instalador eléctrico habilitado VE recibe llamada de comunidad de propietarios de 12 plazas.'),
  ...gap(),
  simpleTable(
    ['Etapa', 'Qué hace el instalador', 'Qué hace TrabFlow IA', 'Output generado'],
    [
      ['1. Cliente llama', 'Recibe llamada. Apunta datos básicos', '—', '—'],
      ['2. Captura voz/imagen', 'Abre TrabFlow, graba descripción por voz o foto del garaje', 'Transcribe, detecta "instalación infraestructura recarga comunidad 12 plazas" → VE-05', 'Actuación identificada'],
      ['3. IA genera presupuesto', 'Revisa partidas generadas', 'Aplica BM VE-05: cuadro distribución VE, ramales x12, contadores. Calcula por plaza × 12', 'Presupuesto borrador en 30s'],
      ['4. Ajuste y envío', 'Ajusta margen, añade nota, envía', 'Genera PDF con logo. Envía WA/email con enlace aceptación pública', 'PDF presupuesto + link /p/{token}'],
      ['5. Cliente acepta', 'Notificación en TrabFlow', 'Marca presupuesto como Aceptado. Dispara alerta push al instalador', 'Push notification'],
      ['6. Planificación', 'Asigna técnico, fecha', 'Crea trabajo en planificación. Muestra ruta óptima del día', 'Trabajo planificado'],
      ['7. Parte de trabajo', 'Técnico en obra registra parte desde móvil', 'Checklist digital VE-05. Captura foto cada punto recarga instalado', 'Parte digital firmado'],
      ['8. Factura', 'Convierte presupuesto en factura', 'Genera FAC-20xx. Serie F o M. IVA 21%. VeriFactu hash automático', 'Factura PDF + enlace público'],
      ['9. Envío WA', 'Pulsa botón WA', 'Mensaje con enlace factura trabflow.com/factura/{token}', 'WA enviado con enlace'],
      ['10. Contrato O&M', 'Propone mantenimiento anual', 'Sugiere contrato O&M VE Básico: €18/punto/mes × 12 = €2.592/año', 'DOCX contrato borrador'],
      ['11. Firma digital', 'Cliente firma desde su móvil', 'Registra firma. Estado → Activo', 'Contrato firmado'],
      ['12. Avisos automáticos', 'Sin acción', 'Cron anual: crea revisión preventiva. Notifica instalador 30 días antes', 'Trabajo preventivo creado'],
      ['13. Renovación', 'Sin acción', 'Cron a 11 meses: alerta "Contrato vence en 30 días". Propone renovación', 'Email/push renovación'],
      ['14. CRM actualizado', '—', 'Cliente en CRM con historial: 12 puntos recarga, 1 contrato activo, facturación acumulada', 'CRM completo'],
    ],
    [14, 26, 36, 24]
  ),

  ...gap(),
  h2('B.2 Customer Journey — Fotovoltaica Industrial (O&M Provider)'),
  body('Escenario: empresa O&M gestiona cartera de 15 plantas industriales entre 100-500 kWp.'),
  ...gap(),
  simpleTable(
    ['Etapa', 'Qué hace el gestor O&M', 'Qué hace TrabFlow IA', 'Output generado'],
    [
      ['1. Alta planta', 'Registra nueva planta en TrabFlow: 250 kWp, Huawei, cubierta industrial', 'Crea ficha planta. Activa monitorización Huawei FusionSolar API', 'Ficha planta + KPIs en vivo'],
      ['2. Contrato O&M', 'Genera contrato O&M Completo para el cliente', 'Plantilla FV: SLA 98,5%, 2 visitas/año, limpieza, termografía, informe mensual, €520/mes', 'DOCX contrato firmado'],
      ['3. Preventivo programado', 'Sin acción', 'Cron semestral: crea trabajo "Mantenimiento preventivo FV-11". Asigna técnico disponible', 'Trabajo planificado'],
      ['4. Técnico en campo', 'Técnico ejecuta preventivo con checklist IEC 62446', 'Parte digital con 25 puntos checklist. Fotos obligatorias por punto. Firma cliente', 'Parte certificado'],
      ['5. Alarma producción', 'Recibe push: "Planta -18% producción vs. estimada"', 'IA detecta anomalía en PR vs. PVGIS. Clasifica causa probable: suciedad o avería string', 'Alerta IA con diagnóstico'],
      ['6. Diagnóstico avería', 'Abre incidencia. Asigna técnico urgente', 'Genera presupuesto actuación FV-30 (diagnóstico caída producción). Historial planta', 'Presupuesto + parte avería'],
      ['7. Termografía', 'Técnico realiza inspección termográfica con dron', 'Parte FV-28 con informe IEC TS 62446-3. Identifica 3 paneles con hot spot. Prioriza sustitución', 'Informe termografía PDF'],
      ['8. Sustitución paneles', 'Genera presupuesto sustitución FV-31 × 3 paneles', 'Aplica BM FV-31: panel equivalente, MC4, mano obra. Pedido material a proveedor catálogo', 'Presupuesto + pedido material'],
      ['9. Informe mensual', 'Sin acción', 'Cron día 1 de mes: genera PDF con producción real 18.420 kWh vs. estimada 19.100 kWh. PR: 94,4%', 'Informe PDF al cliente'],
      ['10. Facturación recurrente', 'Sin acción', 'Cron día 28: genera FAC-M automática del contrato O&M. VeriFactu. Envía WA con enlace', 'Factura enviada automáticamente'],
      ['11. Incidencia recurrente', 'Revisa histórico de incidencias', 'IA detecta 5ª avería en inversor string mismo cuadro → sugiere "proponer sustitución inversor"', 'Alerta + presupuesto borrador'],
      ['12. Revisión anual', 'Sin acción', 'Cron anual: crea "Auditoría técnica completa FV-65". Genera informe anual de auditoría FV-45', 'Trabajo + informe auditoría'],
      ['13. CRM corporativo', '—', 'Cliente en CRM: 15 plantas, €9.000/mes recurrente, 3 incidencias activas, NPS 8/10', 'CRM completo O&M provider'],
    ],
    [14, 26, 36, 24]
  ),
  pageBreak(),
];

// ── NEW SECTION C: Integraciones ───────────────────────────────────────────
const sC = [
  ...sectionHeader('C', 'Integraciones Técnicas', 'APIs de inversores · Protocolos industriales · Home Automation · IoT energético'),

  h2('C.1 APIs de Inversores y Monitorizadores'),
  simpleTable(
    ['API / Plataforma', 'Fabricante', 'Protocolo', 'Datos disponibles', 'Prioridad', 'Timeline'],
    [
      ['FusionSolar OpenAPI', 'Huawei', 'REST + OAuth2', 'Producción, alarmas, inversores, strings, temperatura', 'Muy Alta', 'Q1 2027'],
      ['SolarEdge Monitoring API', 'SolarEdge', 'REST API Key', 'Producción, potencia, energía, optimizadores panel a panel', 'Muy Alta', 'Q1 2027'],
      ['Solar.web API', 'Fronius', 'REST + OAuth2', 'Producción, alarmas, inversores, Push events', 'Alta', 'Q2 2027'],
      ['Enlighten API', 'Enphase', 'REST API Key', 'Producción por microinversor, consumo, alarmas', 'Media', 'Q2 2027'],
      ['iSolarCloud API', 'Sungrow', 'REST + MQTT', 'Producción, rendimiento, alarmas, sensores meteorológicos', 'Alta', 'Q1 2027'],
      ['Wallbox API', 'Wallbox', 'REST + OAuth2', 'Estado cargador, energía dispensada, usuarios, sesiones', 'Muy Alta', 'Q3 2026'],
      ['ABB Terra Cloud', 'ABB', 'REST API', 'Estado cargador, sesiones, consumo, alertas', 'Alta', 'Q4 2026'],
    ],
    [20, 14, 14, 30, 12, 10]
  ),

  ...gap(),
  h2('C.2 Protocolos Industriales'),
  simpleTable(
    ['Protocolo', 'Uso en TrabFlow', 'Hardware compatible', 'Implementación', 'Complejidad'],
    [
      ['Modbus TCP/RTU', 'Lectura de inversores sin nube. Planta sin conexión internet', 'Inversores Huawei, Sungrow, Fronius, ABB', 'Gateway IoT → Supabase Edge Function', 'Alta'],
      ['MQTT (IoT)', 'Telemetría en tiempo real de sensores, contadores, dataloggers', 'Victron, Shelly, dataloggers industriales', 'Broker MQTT → Edge Function → dashboard', 'Media'],
      ['OCPP 1.6/2.0', 'Integración con plataformas de gestión de recarga VE', 'Wallbox, ABB, Circutor, Zaptec', 'Backend OCPP como servicio externo integrado vía API', 'Alta'],
    ],
    [18, 30, 28, 30, 14]
  ),

  ...gap(),
  h2('C.3 Ecosistema Home Automation / IoT Energético'),
  simpleTable(
    ['Plataforma / Dispositivo', 'Integración TrabFlow', 'Caso de uso real', 'API/Protocolo', 'Prioridad'],
    [
      ['Home Assistant', 'Webhook HA → TrabFlow: alarma producción, temperatura, consumo', 'Instalador con planta residencial + HA como hub IoT', 'REST Webhook + MQTT', 'Media'],
      ['Shelly (Pro EM, 3EM)', 'Lectura consumo/producción en tiempo real vía Shelly Cloud API', 'Monitor de autoconsumo económico. Muy habitual en España', 'REST API + MQTT', 'Alta'],
      ['Victron Energy (Venus OS)', 'Lectura GX Portal: baterías, producción, consumo, SOC', 'Instalaciones con baterías LFP. O&M de sistemas híbridos', 'VRM API (REST)', 'Alta'],
      ['Fronius Solar.web', 'Integración bidireccional: lectura + push de alarmas', 'O&M de plantas Fronius. Generación automática de informe en TrabFlow', 'Solar.web REST API', 'Alta'],
      ['SMA Sunny Portal', 'Lectura producción. Canal a instaladores SMA', 'Parque FV con inversores SMA heredados', 'REST API', 'Media'],
      ['Goodwe SEMS Portal', 'API producción + alertas inversores Goodwe', 'Instalaciones residencial-industrial pequeño', 'REST API', 'Baja-Media'],
    ],
    [22, 28, 28, 14, 8]
  ),

  ...gap(),
  h2('C.4 Modelo de integración técnica en TrabFlow'),
  body('Todas las integraciones siguen el mismo patrón arquitectónico para no crear dependencias frágiles:'),
  bullet('Edge Function dedicada por fabricante (trade-inversor-{fabricante})'),
  bullet('Tabla trade_plant_readings en Supabase para almacenar lecturas time-series'),
  bullet('Cron cada 15 min para polling de APIs que no tienen push'),
  bullet('MQTT broker (Mosquitto en Fly.io) para protocolos push en tiempo real'),
  bullet('Normalización a esquema común: timestamp, plant_id, kw_now, kwh_today, kwh_total, pr, temp_inv, alerts[]'),
  bullet('Dashboard TrabFlow consume siempre el esquema normalizado, independiente del fabricante'),
  pageBreak(),
];

// ── NEW SECTION D: Automatizaciones IA ────────────────────────────────────
const sD = [
  ...sectionHeader('D', 'Automatizaciones IA', 'TrabFlow Proactivo · Triggers · Acciones automáticas · Ciclo de vida completo'),

  h2('D.1 Principio de Automatización Proactiva'),
  body('TrabFlow pasa de ser una herramienta de gestión reactiva (el instalador abre la app y hace algo) a una plataforma proactiva que detecta situaciones, genera trabajos, crea presupuestos y avisa al instalador sin que este tenga que hacer nada. Esto multiplica el valor percibido y la retención.'),

  ...gap(),
  h2('D.2 Automatizaciones post-instalación'),
  simpleTable(
    ['Trigger', 'Condición', 'Acción TrabFlow IA', 'Delay', 'Módulo'],
    [
      ['Presupuesto aceptado (VE)', 'tipo=instalación + potencia>7kW', 'Crear borrador contrato O&M VE Básico. Notificar instalador para proponer al cliente', 'Inmediato', 'Contratos'],
      ['Presupuesto aceptado (FV)', 'tipo=instalación + kWp>20', 'Crear borrador contrato O&M FV Preventivo. Adjuntar propuesta PDF al CRM cliente', 'Inmediato', 'Contratos'],
      ['Parte de trabajo completado (FV)', 'actuación=comisionado FV-87', 'Generar informe de puesta en marcha IEC 62446. Activar monitorización planta', 'Al cerrar parte', 'Monitorización'],
      ['Trabajo completado (VE)', 'actuación=instalación wallbox', 'Crear primera revisión preventiva en 12 meses. Añadir punto de recarga al CRM cliente', 'Al facturar', 'Planificación'],
      ['Factura pagada (FV)', 'importe>5.000€', 'Sugerir ampliar contrato O&M al nivel superior. Enviar email personalizado al cliente', 'Al marcar pagada', 'CRM'],
    ],
    [22, 24, 32, 12, 10]
  ),

  ...gap(),
  h2('D.3 Automatizaciones post-avería'),
  simpleTable(
    ['Trigger', 'Condición', 'Acción TrabFlow IA', 'Módulo'],
    [
      ['Alarma monitorización FV', 'PR < 85% durante >2 días', 'Crear incidencia urgente. Generar presupuesto borrador FV-30 (diagnóstico). Push al instalador', 'Monitorización + Planificación'],
      ['Alarma monitorización FV', 'String offline > 4h', 'Crear tarea diagnóstico. Adjuntar histórico del string al parte', 'Monitorización + Partes'],
      ['Avería cerrada (FV)', 'componente=inversor sustituido', 'Registrar en historial equipo. Activar seguimiento garantía fabricante. Alerta en 30 días para verificación post-reparación', 'CRM + Contratos'],
      ['Alarma VE', 'Estado cargador OCPP: faulted > 2h', 'Crear incidencia. Generar presupuesto VE-17 (diagnóstico avería punto recarga)', 'Monitorización VE'],
      ['Avería reincidente', '>=3 averías mismo equipo en 12 meses', 'IA propone al instalador: "Este equipo ha fallado 3 veces. ¿Proponer sustitución al cliente?"', 'CRM + IA proactiva'],
    ],
    [22, 26, 36, 16]
  ),

  ...gap(),
  h2('D.4 Automatizaciones por ciclo temporal'),
  simpleTable(
    ['Trigger temporal', 'Condición', 'Acción TrabFlow IA', 'Frecuencia'],
    [
      ['12 meses desde instalación VE', 'Sin revisión preventiva registrada', 'Crear trabajo "Mantenimiento preventivo anual VE-19". Notificar instalador', 'Anual'],
      ['6 meses desde último preventivo FV', 'Contrato O&M activo nivel Preventivo+', 'Crear trabajo "Mantenimiento semestral FV-12". Asignar técnico disponible', 'Semestral'],
      ['Día 1 de mes', 'Planta FV con monitorización activa', 'Generar informe mensual de producción (actuación FV-44). PDF automático al cliente', 'Mensual'],
      ['5 incidencias acumuladas', 'Mismo equipo en planta FV', 'IA propone: "Hemos detectado 5 incidencias en el inversor X. Considera proponer sustitución"', 'A demanda'],
      ['30 días antes vencimiento contrato', 'Contrato O&M cualquier nivel', 'Email renovación al instalador + borrador nuevo contrato con precio actualizado', 'Por contrato'],
      ['11 meses contrato O&M', 'Contrato activo', 'Alerta al instalador: "El contrato de {cliente} vence en 30 días". Propuesta automática', 'Por contrato'],
      ['Aniversario instalación FV (5 años)', 'Planta FV en cartera O&M', 'Crear trabajo "Revisión quinquenal FV-88". Recordatorio evaluación degradación paneles', 'Quinquenal'],
      ['1 año sin actividad (cliente VE)', 'Sin presupuesto ni trabajo en 12m', 'Push re-engagement: "Tienes 3 puntos de recarga sin revisión anual"', 'Anual'],
    ],
    [24, 24, 36, 16]
  ),

  ...gap(),
  h2('D.5 Automatizaciones de reporting'),
  simpleTable(
    ['Informe automático', 'Trigger', 'Formato', 'Destinatario', 'Módulo'],
    [
      ['Informe mensual producción FV', 'Cron día 1 de mes', 'PDF con KPIs, gráfico, PR, incidencias', 'Cliente final (email)', 'Contratos O&M'],
      ['Informe semestral O&M VE', 'Cron semestral', 'PDF: puntos revisados, estado, recomendaciones', 'Cliente final', 'Contratos O&M'],
      ['Informe anual auditoría FV', 'Cron anual', 'PDF completo IEC 62446: termografía, mediciones, histórico', 'Cliente final', 'Contratos O&M'],
      ['Resumen semanal instalador', 'Cron lunes 8:00', 'Push/email: trabajos semana, facturas pendientes, alertas activas', 'Instalador', 'Dashboard'],
      ['Alerta degradación paneles', 'Análisis mensual producción histórica', 'Email: "Producción de planta X ha caído un 4% vs. año anterior"', 'Instalador', 'Monitorización IA'],
    ],
    [24, 20, 26, 16, 14]
  ),
  pageBreak(),
];

// ── NEW SECTION E: Módulo Monitorización ──────────────────────────────────
const sE = [
  ...sectionHeader('E', 'Módulo de Monitorización FV', 'KPIs · Dashboards · Alarmas IA · Comparativa PVGIS · Módulo Premium'),

  h2('E.1 Visión del módulo'),
  body('La monitorización es el corazón del O&M fotovoltaico. Sin datos de producción en tiempo real no hay posibilidad de SLA, ni de informe automatizado, ni de detección de averías. TrabFlow ofrece un módulo de monitorización unificado que normaliza datos de cualquier fabricante y los presenta con valor añadido para el instalador y para su cliente final.'),
  body('Modelo de negocio: Módulo Monitorización como add-on premium (+€29/mes sobre plan base) o incluido en Plan Empresa+. Diferenciación frente a plataformas de monitorización puras (Huawei, SolarEdge) que no tienen la capa de gestión (contratos, partes, facturación).'),

  ...gap(),
  h2('E.2 KPIs del módulo'),
  simpleTable(
    ['KPI', 'Definición', 'Fuente de datos', 'Frecuencia', 'Alerta IA si'],
    [
      ['Producción diaria (kWh)', 'Energía generada en el día actual', 'API inversor / Modbus', 'Cada 15 min', 'Producción < 70% del día equivalente año anterior'],
      ['Producción mensual (kWh)', 'Acumulado del mes en curso', 'Calculado desde lecturas', 'Diario', 'Mensual < 85% estimación PVGIS'],
      ['Producción anual (kWh)', 'Acumulado del año en curso', 'Calculado desde lecturas', 'Mensual', 'Anual < 90% estimación PVGIS'],
      ['Performance Ratio (PR %)', '(Producción real / Producción ideal) × 100', 'Calculado: kWh / (kWp × irrad.)', 'Diario', 'PR < 80% durante >3 días consecutivos'],
      ['Yield específico (kWh/kWp)', 'Producción total / potencia pico instalada', 'Calculado', 'Mensual', 'Yield < 85% histórico mismo mes'],
      ['Horas equivalentes (h FP)', 'kWh producidos / kWp instalados', 'Calculado', 'Mensual', 'HEP < 80% estimación zona climática'],
      ['Temperatura módulos (°C)', 'Temperatura superficie panel en tiempo real', 'Sonda / API inversor', 'Cada 15 min', 'Temperatura > 85°C → alerta punto caliente'],
      ['Temperatura inversor (°C)', 'Temperatura interna del inversor', 'API inversor', 'Cada 15 min', 'Temperatura > 70°C → alerta ventilación'],
      ['Irradiancia (W/m²)', 'Radiación solar en plano del panel', 'Piranómetro / estimación satelital', 'Cada 15 min', 'Irradiancia alta + producción baja → avería probable'],
      ['Factor de capacidad (%)', 'Producción real / Producción máxima teórica', 'Calculado', 'Mensual', 'CF < 12% zonas alta irradiancia → revisión urgente'],
      ['Estado strings', 'Corriente y tensión por string. Comparativa entre strings', 'API inversor / Modbus RS485', 'Cada 15 min', 'String con corriente <70% de la media del resto'],
      ['Estado comunicación inversor', 'Online / Offline / Error', 'Heartbeat API', 'Cada 5 min', 'Offline > 30 min → notificación inmediata'],
    ],
    [24, 28, 20, 14, 14]
  ),

  ...gap(),
  h2('E.3 Alarmas y clasificación IA'),
  simpleTable(
    ['Tipo de alarma', 'Causa probable (IA)', 'Severidad', 'Acción automática TrabFlow'],
    [
      ['PR < 80% 3 días', 'Suciedad paneles / sombra nueva / avería string', 'Media', 'Crear incidencia. Sugerir FV-21 (limpieza) o FV-30 (diagnóstico)'],
      ['String offline', 'Fusible quemado / conector MC4 / avería módulo', 'Alta', 'Crear incidencia urgente FV-35/36. Notificar instalador y cliente'],
      ['Inversor offline', 'Avería inversor / fallo comunicaciones / corte red', 'Crítica', 'Push inmediato. Crear incidencia crítica FV-32. Generar presupuesto borrador'],
      ['Temperatura > 85°C módulo', 'Hot spot / célula dañada / sombra parcial', 'Alta', 'Programar termografía FV-26. Avisar al cliente del riesgo'],
      ['Temperatura inversor > 70°C', 'Filtros obstruidos / ventilación deficiente', 'Media', 'Crear tarea FV-24 (limpieza filtros inversor)'],
      ['Producción mensual -15% PVGIS', 'Degradación / suciedad severa / avería módulos', 'Media', 'Incluir en informe mensual con análisis causa y propuesta actuación'],
      ['5ª incidencia mismo equipo', 'Equipo al final de vida útil', 'Informativa', 'IA proactiva: proponer sustitución al instalador con análisis coste-beneficio'],
    ],
    [22, 28, 12, 38]
  ),

  ...gap(),
  h2('E.4 Comparativa con PVGIS'),
  body('PVGIS (Photovoltaic Geographical Information System) de la JRC-European Commission ofrece estimaciones de producción solar por coordenadas geográficas, orientación e inclinación. TrabFlow integra la API PVGIS para:'),
  bullet('Comparar producción real mensual vs. producción estimada PVGIS para la localización exacta de la planta'),
  bullet('Calcular PR ajustado por irradiancia real del mes (no solo temperatura)'),
  bullet('Detectar pérdidas anómalas que no se explican por meteorología'),
  bullet('Generar gráficos de "real vs. esperado" en informes mensuales automáticos'),
  ...gap(),
  body('Ejemplo: Planta 250 kWp en Sevilla, orientación Sur 30°. PVGIS estima 375.000 kWh/año. TrabFlow mide 355.000 kWh/año. Desviación: -5,3%. IA clasifica: "Dentro de rango normal (suciedad estacional o temperatura alta). Recomendación: programar limpieza preventiva."'),

  ...gap(),
  h2('E.5 Dashboards'),
  h3('Dashboard instalador (gestión de cartera)'),
  bullet('Vista resumen: N plantas activas, producción total hoy/mes/año, alertas activas, contratos venciendo'),
  bullet('Vista por planta: KPIs individuales, comparativa PVGIS, histórico incidencias, próximas visitas'),
  bullet('Mapa de calor: plantas por estado (verde/amarillo/rojo según PR y alertas activas)'),
  bullet('Ranking de plantas por rendimiento: identifica las que necesitan atención urgente'),

  h3('Dashboard cliente final (portal de producción)'),
  bullet('URL única por planta: trabflow.com/mi-planta/{token}'),
  bullet('Producción hoy en tiempo real con gráfico de barras por hora'),
  bullet('Producción mensual vs. estimada (barra de progreso)'),
  bullet('Ahorro económico estimado (€/mes, €/año) vs. tarifa de red'),
  bullet('CO₂ evitado equivalente (kg, árboles plantados equivalentes)'),
  bullet('Últimas 3 incidencias resueltas con fecha de resolución'),
  bullet('Estado del contrato O&M: nivel, próxima visita, técnico asignado'),

  pageBreak(),
];

// ── NEW SECTION F: Modelo Económico ───────────────────────────────────────
const sF = [
  ...sectionHeader('F', 'Modelo Económico de Implementación', 'Costes de desarrollo · ROI · Break even · Infraestructura IA'),

  h2('F.1 Estimación de horas de desarrollo'),
  simpleTable(
    ['Módulo / Tarea', 'Vertical', 'Horas estimadas', 'Perfil', 'Prioridad'],
    [
      ['Base Maestra VE (50 actuaciones)', 'VE', '80–120h', 'Técnico contenido + IA testing', 'Crítica'],
      ['Base Maestra FV (100 actuaciones)', 'FV', '160–240h', 'Técnico contenido + IA testing', 'Crítica'],
      ['Embeddings + colecciones vectoriales', 'Ambos', '20–30h', 'Backend developer', 'Crítica'],
      ['Normativa RAG VE (indexación + prompts)', 'VE', '30–50h', 'Backend + QA prompts', 'Alta'],
      ['Normativa RAG FV (indexación + prompts)', 'FV', '40–60h', 'Backend + QA prompts', 'Alta'],
      ['Contratos O&M VE (plantillas + lógica)', 'VE', '30–50h', 'Producto + Backend', 'Alta'],
      ['Contratos O&M FV (4 niveles + lógica)', 'FV', '50–80h', 'Producto + Backend', 'Alta'],
      ['Integraciones API inversores (3 fabricantes)', 'FV', '60–100h', 'Backend developer', 'Media'],
      ['Módulo Monitorización (dashboard + KPIs)', 'FV', '80–120h', 'Frontend + Backend', 'Media'],
      ['Automatizaciones IA (triggers + crons)', 'Ambos', '40–60h', 'Backend developer', 'Media'],
      ['Customer Journey completo (flujo end-to-end)', 'Ambos', '20–30h', 'QA + Producto', 'Alta'],
      ['Portal cliente público (/mi-planta)', 'FV', '30–50h', 'Frontend developer', 'Media'],
      ['TOTAL ESTIMADO', 'Ambos', '640–990h', '—', '—'],
    ],
    [36, 10, 16, 22, 16]
  ),

  ...gap(),
  h2('F.2 Coste de desarrollo estimado'),
  simpleTable(
    ['Concepto', 'Coste unitario', 'Volumen', 'Coste total estimado'],
    [
      ['Desarrollo interno (CEO + CTO)', '€0 (coste oportunidad)', '640–990h', '€0 cash-out directo'],
      ['Freelance especializado (si se subcontrata)', '€45–€65/h', '400h back + 200h front', '€27.000–€42.000'],
      ['QA técnico contenido verticales', '€30–€40/h', '200h', '€6.000–€8.000'],
      ['Total si 100% externo', '—', '—', '€33.000–€50.000'],
      ['Total si 50% interno + 50% externo', '—', '—', '€16.500–€25.000'],
    ],
    [30, 20, 22, 28]
  ),

  ...gap(),
  h2('F.3 Coste de infraestructura IA mensual'),
  simpleTable(
    ['Componente', 'Uso estimado/mes (100 usuarios)', 'Coste unit.', 'Coste mensual est.'],
    [
      ['OpenAI GPT-4o mini (generación presupuestos)', '500.000 tokens/mes', '€0.15/1M input', '€0.08/mes'],
      ['OpenAI Whisper (transcripción voz)', '200 minutos/mes', '€0.006/min', '€1.20/mes'],
      ['Voyage AI embeddings (búsqueda actuaciones)', '2M tokens/mes', '€0.02/1M', '€0.04/mes'],
      ['Supabase (DB + Edge Functions + Storage)', 'Plan Pro', '€25/mes', '€25/mes'],
      ['APIs inversores (polling 15min × 100 plantas)', 'Incluido en fabricante', '€0', '€0'],
      ['Crons automatizaciones (Supabase pg_cron)', 'Incluido en Supabase Pro', '€0', '€0'],
      ['TOTAL infraestructura IA/mes (100 usuarios)', '—', '—', '~€26–€35/mes'],
    ],
    [36, 24, 18, 22]
  ),
  body('Conclusión: el coste marginal de IA por usuario es < €0.35/mes. Con plan base €49/mes el margen bruto de infraestructura supera el 99%. El coste no es infraestructura, es desarrollo y contenido.', { italic: true }),

  ...gap(),
  h2('F.4 Coste Base Maestra'),
  simpleTable(
    ['Vertical', 'Actuaciones', 'Horas redacción', 'Horas IA testing', 'Embeddings (1 vez)', 'Mantenimiento/año'],
    [
      ['VE', '50', '60h', '20h', '< €1', '10h/año (nuevas normas)'],
      ['FV Industrial', '100', '120h', '40h', '< €2', '20h/año (IEC actualizaciones)'],
      ['TOTAL', '150', '180h', '60h', '< €3', '30h/año'],
    ],
    [14, 14, 18, 18, 18, 18]
  ),

  ...gap(),
  h2('F.5 ROI y Break Even'),
  simpleTable(
    ['Escenario', 'Inversión total', 'ARR objetivo (Año 2)', 'Break even', 'ROI a 3 años'],
    [
      ['Conservador (50% interno)', '€16.500', '€100.000', '~2 meses ARR', '18x'],
      ['Moderado (30% externo)', '€25.000', '€170.000', '~1,8 meses ARR', '20x'],
      ['Agresivo (100% externo)', '€50.000', '€270.000', '~2,2 meses ARR', '16x'],
    ],
    [25, 18, 22, 18, 17]
  ),
  body('Los tres escenarios muestran un ROI excepcional porque el modelo SaaS con facturación recurrente O&M multiplica el LTV sin incrementar el CAPEX. El break even se produce antes del primer cliente fidelizado con contrato O&M anual.', { italic: true }),

  ...gap(),
  h2('F.6 Priorización de inversión por impacto/coste'),
  simpleTable(
    ['Inversión', 'Coste est.', 'Impacto en ARR', 'Tiempo de retorno', 'Prioridad'],
    [
      ['Base Maestra VE (50 act.)', '€8.000–€12.000', 'Alto. Diferenciación inmediata', '< 6 meses', '#1'],
      ['Contratos O&M VE', '€3.000–€5.000', 'Muy alto. Recurrencia directa', '< 3 meses', '#2'],
      ['Normativa RAG VE', '€2.500–€4.000', 'Alto. Retención y NPS', '< 6 meses', '#3'],
      ['Base Maestra FV (100 act.)', '€15.000–€22.000', 'Muy alto. Ticket más alto', '6–12 meses', '#4'],
      ['Módulo Monitorización FV', '€8.000–€12.000', 'Alto. Add-on premium €29/mes', '12–18 meses', '#5'],
      ['Integraciones API inversores', '€6.000–€9.000', 'Medio-alto. Retención O&M', '12–18 meses', '#6'],
      ['Automatizaciones IA', '€4.000–€6.000', 'Alto. Diferenciación y retención', '< 12 meses', '#7'],
    ],
    [28, 14, 22, 18, 18]
  ),
  pageBreak(),
];

// ── NEW SECTION G: RAG Normativo ──────────────────────────────────────────
const sG = [
  ...sectionHeader('G', 'Asistente RAG Normativo', 'Catálogo normativa · BD · Pipeline · Integración · Roadmap 10 semanas · Validación'),

  h2('G.1 Arquitectura del Sistema RAG'),
  body('El asistente normativo usa RAG (Retrieval-Augmented Generation) con pgvector en Supabase. Cuando el instalador hace una consulta técnica, el sistema recupera los fragmentos más relevantes de normativa indexada y los inyecta en el contexto del modelo antes de generar la respuesta. La IA nunca inventa normativa: solo cita lo que está en la base.'),
  ...gap(),
  simpleTable(
    ['Componente', 'Tecnología elegida', 'Alternativa descartada', 'Razón'],
    [
      ['Índice vectorial', 'HNSW (pgvector 0.5+)', 'IVFFlat', 'Sin entrenamiento previo, mejor recall, más rápido en <100k chunks'],
      ['Embeddings', 'voyage-3-lite (Voyage AI)', 'text-embedding-3-small (OpenAI)', 'Ya integrado en TrabFlow, proveedor único, coste comparable'],
      ['Búsqueda', 'Híbrida: vector + FTS (RRF 70/30)', 'Solo vector', 'Mejora recall en referencias exactas (ej: art. 3.2 ITC-BT-52)'],
      ['Clasificador consultas', 'Haiku 4.5 micro-call (5 tokens out)', 'Keywords lista fija', 'Detecta intención semántica, no literal. Coste <€0,0001/consulta'],
      ['Feedback loop', 'trade_installer_needs existente', 'Sin feedback', 'Consultas sin respuesta satisfactoria → mejora continua del corpus'],
      ['LLM respuesta', 'Claude Haiku 4.5 (trade-chatbot)', 'GPT-4o mini', 'Ya desplegado, coste óptimo, latencia baja'],
    ],
    [22, 22, 24, 32]
  ),

  ...gap(),
  h2('G.2 Catálogo de Normativa a Indexar'),
  h3('Cargadores VE — Normativa prioritaria'),
  simpleTable(
    ['Código', 'Título', 'Fuente', 'Acceso', 'Coste', 'Prioridad'],
    [
      ['ITC-BT-52', 'Instrucción Técnica Complementaria — Infraestructura para la recarga de VE (REBT)', 'BOE', 'Libre', '€0', 'Crítica'],
      ['REBT RD 842/2002', 'Reglamento Electrotécnico para Baja Tensión + ITC complementarias', 'BOE', 'Libre', '€0', 'Crítica'],
      ['RD 266/2021', 'MOVES III — Subvenciones puntos de recarga y VE eléctrico', 'BOE', 'Libre', '€0', 'Alta'],
      ['Regl. 2023/1804 (AFIR)', 'Infraestructura de combustibles alternativos — objetivos y plazos 2025-2030', 'EUR-Lex', 'Libre', '€0', 'Alta'],
      ['IEC 61851-1', 'Sistema de carga conductiva para VE — Modos de carga 1/2/3/4', 'UNE (síntesis propia)', 'Síntesis interna', '€100–150', 'Alta'],
      ['OCPP 1.6 / 2.0', 'Open Charge Point Protocol — comunicación cargador-backend', 'OCA', 'Libre (registro)', '€0', 'Media'],
      ['Ley 49/1960 art.17', 'Ley de Propiedad Horizontal — mayorías para instalación VE en comunidades', 'BOE', 'Libre', '€0', 'Alta'],
    ],
    [17, 32, 10, 14, 9, 12]
  ),

  ...gap(),
  h3('Fotovoltaica Industrial — Normativa prioritaria'),
  simpleTable(
    ['Código', 'Título', 'Fuente', 'Acceso', 'Coste', 'Prioridad'],
    [
      ['RD 244/2019', 'Autoconsumo fotovoltaico — modalidades, compensación excedentes, registro RAIPRE', 'BOE', 'Libre', '€0', 'Crítica'],
      ['RD 1183/2020', 'Acceso y conexión a la red — solicitud ATR, permisos de acceso y conexión', 'BOE', 'Libre', '€0', 'Crítica'],
      ['IEC 62446-1', 'Sistemas FV conectados a red — documentación, pruebas, mantenimiento', 'UNE (síntesis propia)', 'Síntesis interna', '€150–200', 'Crítica'],
      ['IEC TS 62446-3', 'Inspección termográfica de plantas FV en campo — metodología y reporte', 'UNE (síntesis propia)', 'Síntesis interna', '€120–180', 'Alta'],
      ['IEC 61724-1', 'Monitorización de sistemas FV — Performance Ratio, medición de rendimiento', 'UNE (síntesis propia)', 'Síntesis interna', '€100–150', 'Alta'],
      ['IEC 62548', 'Diseño de instalaciones DC: secciones de cable, fusibles, caídas de tensión', 'UNE (síntesis propia)', 'Síntesis interna', '€80–120', 'Alta'],
      ['Guía IDAE 2024', 'Criterios técnicos para instalación FV residencial e industrial', 'IDAE', 'Libre', '€0', 'Media'],
    ],
    [17, 32, 10, 14, 9, 12]
  ),
  body('Inversión única normas UNE/IEC: €900–€1.300. Las normas BOE y EUR-Lex se indexan directamente. Las UNE/IEC se indexan como síntesis propias redactadas por técnico cualificado (obligatorio por derechos de autor).', { italic: true }),

  ...gap(),
  h2('G.3 Esquema de Base de Datos'),
  new Paragraph({
    spacing: { before: pt(4), after: pt(2) },
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    children: [new TextRun({ text: 'trade_normativa_docs: id, codigo, titulo, vertical (ve|fv|electrico|global), oficio_tags TEXT[], fuente_url, fuente_tipo (boe|une|idae|fabricante), version, fecha_vigor DATE, prioridad SMALLINT (1=crítica, 2=alta, 3=media), activo BOOLEAN', size: pt(9.5), color: '334155' })],
  }),
  new Paragraph({
    spacing: { before: pt(2), after: pt(2) },
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    children: [new TextRun({ text: 'trade_normativa_chunks: id, doc_id (→ trade_normativa_docs), chunk_index, contenido TEXT (400-600 tokens, 50 solapamiento), seccion TEXT, embedding vector(1536)', size: pt(9.5), color: '334155' })],
  }),
  new Paragraph({
    spacing: { before: pt(2), after: pt(4) },
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    children: [new TextRun({ text: 'Índice: HNSW (m=16, ef_construction=64) sobre embedding vector_cosine_ops — sin entrenamiento previo, ~5ms por consulta, max 100k chunks sin degradación', size: pt(9.5), color: '334155' })],
  }),

  ...gap(),
  h2('G.4 Pipeline de Indexación'),
  simpleTable(
    ['Paso', 'Función Python', 'Descripción', 'Herramienta'],
    [
      ['1', 'download_norm_pdf()', 'Descarga PDF desde URL (BOE, EUR-Lex, IDAE, OCA)', 'requests'],
      ['2', 'extract_text()', 'Extrae texto preservando estructura de artículos y secciones', 'pdfplumber / PyMuPDF'],
      ['3', 'clean_text()', 'Elimina cabeceras BOE, números de página, artefactos de escaneado', 'regex + heurísticas'],
      ['4', 'chunk_by_article()', 'Divide por artículo/sección. 400-600 tokens. 50 tokens solapamiento entre chunks', 'tiktoken'],
      ['5', 'embed_chunks()', 'Embeddings en batches de 100. voyage-3-lite → vector(1536)', 'Voyage AI API'],
      ['6', 'load_to_supabase()', 'Upsert en trade_normativa_chunks por (doc_id, chunk_index). Idempotente.', 'supabase-py'],
    ],
    [8, 22, 46, 24]
  ),
  body('Tiempo de indexación por norma: 5-15 min. Coste embeddings corpus completo VE+FV: <€8 (inversión única). Re-indexación parcial posible: solo docs modificados.', { italic: true }),

  ...gap(),
  h2('G.5 Búsqueda Híbrida — RPC match_normativa_chunks'),
  body('La RPC combina similitud vectorial (70% peso) y full-text search en español (30% peso) mediante Reciprocal Rank Fusion. Esto mejora el recall cuando el instalador cita artículos exactos (ej: "artículo 3.2 ITC-BT-52") que la búsqueda vectorial pura podría no recuperar.'),
  ...gap(),
  new Paragraph({
    spacing: { before: pt(4), after: pt(4) },
    shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
    children: [new TextRun({ text: 'match_normativa_chunks(query_embedding vector(1536), query_text TEXT, vertical_filter TEXT, prioridad_max SMALLINT=3, match_count INT=6) → TABLE(chunk_id, doc_codigo, titulo, seccion, contenido, score FLOAT). Score = 0.7×vector_sim + 0.3×ts_rank.', size: pt(9.5), color: '334155' })],
  }),

  ...gap(),
  h2('G.6 Integración en trade-chatbot Edge Function'),
  simpleTable(
    ['Componente', 'Descripción', 'Detalle técnico'],
    [
      ['OFICIO_TO_VERTICAL', 'Mapeo oficio del instalador → filtro vertical RAG', 'electricidad → ve|electrico, solar → fv, ambos → null (búsqueda global)'],
      ['classifyQueryIntent()', 'Micro-llamada Haiku 4.5: ¿Es consulta normativa? → normativa|operacional|comercial', '~50 tokens entrada, 1-5 tokens salida. <€0,0001/consulta'],
      ['getRelevantNormativa()', 'Llama a match_normativa_chunks con embedding pregunta + filtro vertical', 'Devuelve top-6 chunks, ~2.400 tokens de contexto máximo'],
      ['buildSystemPrompt()', 'Inyecta contexto RAG: fragmentos normativa + instrucción de citar fuente exacta', '"Basa tu respuesta EXCLUSIVAMENTE en: [chunks]. Cita el documento y artículo."'],
      ['logNormasUsadas()', 'Guarda doc_codigos citados en trade_chatbot_logs para analítica', 'Identifica normativa más consultada → prioriza mantenimiento'],
      ['Feedback loop', 'Rating <3/5 guarda en trade_installer_needs(resolved=false)', 'Revisión semanal → gaps en corpus → mejora continua del RAG'],
    ],
    [22, 40, 38]
  ),

  ...gap(),
  h2('G.7 Roadmap de Implementación RAG — 10 semanas'),
  simpleTable(
    ['Fase', 'Semanas', 'Entregable', 'Horas dev'],
    [
      ['F1 — Infraestructura', '1-2', 'Tablas BD + índice HNSW + RPC híbrida. trade-chatbot con micro-classifier. Primer chunk de prueba indexado.', '12-16h'],
      ['F2 — REBT + ITC-BT-52', '3-4', 'Corpus REBT + ITC-BT-52 + MOVES III indexado. Cubre ~80% de consultas VE actuales. Validación 8 preguntas VE.', '10-14h'],
      ['F3 — Vertical VE completo', '5-6', 'AFIR + IEC 61851 + OCPP + Ley PH indexados. Suite completa 15 preguntas VE aprobada al ≥80%.', '8-12h'],
      ['F4 — Vertical FV completo', '7-8', 'RD 244/2019 + RD 1183/2020 + IEC 62446 + IEC 61724 + IDAE. Suite 15 preguntas FV aprobada al ≥80%.', '10-14h'],
      ['F5 — QA + mejora continua', '9-10', 'Feedback loop activo. Dashboard analítica normas. Proceso mantenimiento documentado. Target global ≥90%.', '6-8h'],
    ],
    [22, 10, 50, 12]
  ),
  body('Total: 46-64h desarrollo + €900-€1.300 inversión única en síntesis normas UNE/IEC. Coste mensual operativo: ~€0,18/usuario/mes. Margen bruto del módulo: >99%.', { italic: true }),

  ...gap(),
  h2('G.8 Suite de Validación — 30 Preguntas'),
  h3('Vertical VE — muestra representativa'),
  simpleTable(
    ['ID', 'Pregunta de prueba', 'Norma esperada', 'Criterio de éxito'],
    [
      ['VE-01', '¿Cuál es el calibre mínimo de cable para un wallbox 7,4 kW monofásico en circuito de 10m?', 'ITC-BT-52 § cálculo conductor', 'Sección correcta + artículo citado'],
      ['VE-02', '¿Qué protecciones son obligatorias en un punto de recarga modo 3?', 'ITC-BT-52 + IEC 61851-1', 'Nombra protecciones reglamentarias'],
      ['VE-03', '¿Cuántos votos necesito en la comunidad para instalar cargador VE?', 'Ley 49/1960 art. 17', 'Mayoría cualificada correcta'],
      ['VE-04', '¿Qué documenta una memoria técnica para legalizar infraestructura VE comunitaria?', 'ITC-BT-52 + REBT', 'Lista documentos reglamentarios'],
      ['VE-05', '¿Cuál es el plazo para solicitar la subvención MOVES III tras instalar?', 'RD 266/2021', 'Plazo correcto en días'],
      ['VE-06', '¿Es obligatorio contador bidireccional en wallbox con gestión de carga dinámica?', 'ITC-BT-52', 'Sí/No correcto + artículo'],
      ['VE-07', '¿Qué exige AFIR para puntos de recarga en autopistas en 2025?', 'Regl. 2023/1804', 'kW mínimos y plazos correctos'],
      ['VE-08', '¿Necesito proyecto visado para instalar 3 wallbox en garaje comunitario?', 'REBT + ITC-BT-52', 'Umbral de proyecto correcto'],
    ],
    [8, 44, 22, 26]
  ),
  ...gap(),
  h3('Vertical FV — muestra representativa'),
  simpleTable(
    ['ID', 'Pregunta de prueba', 'Norma esperada', 'Criterio de éxito'],
    [
      ['FV-01', '¿Qué modalidades de autoconsumo recoge el RD 244/2019?', 'RD 244/2019', 'Las 3 modalidades correctas'],
      ['FV-02', '¿Es obligatorio el registro RAIPRE para una instalación FV de 150 kWp?', 'RD 244/2019', 'Sí + umbral y organismo correcto'],
      ['FV-03', '¿Qué pruebas exige la IEC 62446-1 al comisionar una planta FV?', 'IEC 62446-1', 'Lista pruebas de comisionado'],
      ['FV-04', '¿Cómo se calcula el Performance Ratio según IEC 61724?', 'IEC 61724-1', 'Fórmula correcta con irradiancia'],
      ['FV-05', '¿Qué sección de cable DC se usa para 10A en sistema FV a 1.000V DC?', 'IEC 62548', 'Sección mínima correcta'],
      ['FV-06', '¿Cómo solicito punto de acceso ATR para planta de 500 kWp?', 'RD 1183/2020', 'Proceso y organismo correcto'],
      ['FV-07', '¿Qué documentación entrego al cliente final de una instalación FV industrial?', 'IEC 62446-1 + RD 244', 'Lista documentos completa'],
      ['FV-08', '¿Cuántos termogramas hay que entregar según IEC TS 62446-3 en una inspección anual?', 'IEC TS 62446-3', 'Número y condiciones correctas'],
    ],
    [8, 44, 22, 26]
  ),
  body('Criterio global: ≥80% de respuestas con cita de norma correcta e información técnicamente precisa al finalizar F4. Target tras F5: ≥90%.', { italic: true }),

  ...gap(),
  h2('G.9 Mantenimiento y Escalabilidad del Corpus'),
  simpleTable(
    ['Proceso', 'Frecuencia', 'Acción', 'Responsable'],
    [
      ['Monitor BOE/EUR-Lex', 'Continuo', 'Alerta automática por keywords (REBT, VE, autoconsumo, fotovoltaica, ITC-BT)', 'Sistema (alertas.boe.es API)'],
      ['Revisión corpus RAG', 'Trimestral', 'Verificar vigencia normas, re-indexar si hay modificaciones o nuevas versiones', 'Técnico TrabFlow'],
      ['Análisis trade_installer_needs', 'Semanal', 'Revisar consultas sin respuesta satisfactoria → identificar gaps del corpus', 'Producto TrabFlow'],
      ['Re-indexación parcial', 'A demanda', 'Pipeline Python solo para docs afectados. Upsert idempotente en trade_normativa_chunks', 'Backend dev'],
      ['Nuevos verticales', 'A demanda', 'Añadir vertical nuevo en campo "vertical". Pipeline 100% reutilizable sin cambios código', 'Backend dev'],
    ],
    [22, 14, 40, 24]
  ),
  body('Escalabilidad diseñada: Gas, RITE, ICT, PCI como próximos verticales. Solo requieren nuevos docs en trade_normativa_docs y ejecutar pipeline. Zero cambios estructurales.', { italic: true }),

  pageBreak(),
];

// ── Sections 02-14 (original condensed) ────────────────────────────────────
const sOriginal = [
  ...sectionHeader('02', 'Tamaño de Mercado', 'España · Europa · Instaladores · Crecimiento'),
  h2('2.1 Cargadores VE'),
  simpleTable(
    ['Indicador', 'Datos 2025-2026'],
    [
      ['Mercado España (instalación puntos recarga)', '~€2.100M anuales'],
      ['Mercado Europa', '€18.000M anuales. Objetivo 3,5M puntos recarga en 2030 (AFIR)'],
      ['Puntos de recarga activos en España', '~180.000 (2025). Objetivo: 340.000 en 2030 (PNIEC)'],
      ['Instaladores especializados VE en España', '~8.000–12.000 empresas habilitadas'],
      ['Crecimiento esperado (CAGR 2025-2030)', '22–28% anual. Impulsado por AFIR, MOVES III'],
      ['Ticket medio wallbox residencial', '€600–€1.200'],
      ['Ticket medio punto carga empresarial', '€1.500–€5.000'],
      ['Ticket medio contrato O&M (por punto/año)', '€120–€300/punto/año'],
    ],
    [45, 55]
  ),
  ...gap(),
  h2('2.2 Fotovoltaica Industrial'),
  simpleTable(
    ['Indicador', 'Datos 2025-2026'],
    [
      ['Mercado España (instalación + O&M FV)', '~€4.800M anuales'],
      ['Potencia instalada España', '~40 GW (2025). Objetivo 76 GW en 2030 (PNIEC)'],
      ['Mercado O&M específico', '€1.200M anuales en España. Crecimiento estructural garantizado'],
      ['Empresas instaladoras FV en España', '~6.000–9.000 activas'],
      ['Crecimiento esperado O&M (CAGR 2025-2030)', '18–24% anual'],
      ['Ticket medio contrato O&M (100 kWp/año)', '€2.000–€5.000/año'],
      ['Ticket medio contrato O&M completo (500 kWp)', '€8.000–€20.000/año'],
      ['Ticket medio instalación nueva industrial (100 kWp)', '€60.000–€120.000'],
    ],
    [45, 55]
  ),
  pageBreak(),

  ...sectionHeader('07', 'Contratos de Mantenimiento O&M', 'Plantillas · SLA · Cuotas · Niveles de servicio'),
  h2('7.1 Cargadores VE — Niveles de Servicio'),
  simpleTable(
    ['Parámetro', 'Básico', 'Estándar', 'Premium', 'Crítico 24/7'],
    [
      ['Cuota mensual / punto', '€12–€18', '€20–€28', '€35–€50', '€60–€90'],
      ['Tiempo respuesta incidencia', '48h', '24h', '8h', '2h'],
      ['Preventivo anual', '1 visita', '2 visitas', '2 visitas + termografía', '2 visitas + termografía + test carga'],
      ['Monitorización remota', 'No', 'Básica', 'Avanzada con alertas', 'Tiempo real + NOC'],
      ['Penalización SLA', 'No', '5% cuota', '10% cuota', '20% cuota'],
    ],
    [28, 18, 18, 18, 18]
  ),
  ...gap(),
  body('Ejemplo: 50 puntos de recarga × €25/punto/mes = €1.250/mes = €15.000/año por un solo cliente.'),
  ...gap(),
  h2('7.2 Fotovoltaica Industrial — Niveles de Servicio O&M'),
  simpleTable(
    ['Parámetro', 'Vigilancia', 'Preventivo', 'O&M Completo', 'Full Service'],
    [
      ['Cuota mensual (100 kWp)', '€150–€200', '€250–€350', '€400–€600', '€700–€1.200'],
      ['Cuota mensual (500 kWp)', '€400–€600', '€700–€1.000', '€1.200–€1.800', '€2.000–€3.500'],
      ['Preventivos / año', '—', '1 visita', '2 visitas', '4 visitas'],
      ['Termografía', 'No', 'No', 'Anual', 'Anual + dron'],
      ['SLA disponibilidad planta', 'No', '≥97%', '≥98,5%', '≥99,5%'],
      ['Penalización SLA', 'No', '5% factura', '10% factura', '20% + bonus si supera'],
    ],
    [28, 18, 18, 18, 18]
  ),
  ...gap(),
  body('Ejemplo: 10 plantas × 200 kWp × €900/mes = €9.000/mes = €108.000/año de ingresos recurrentes.'),
  pageBreak(),

  ...sectionHeader('12', 'Roadmap de Implementación', '5 fases por vertical'),
  h2('12.1 Cargadores VE'),
  simpleTable(
    ['Fase', 'Nombre', 'Contenido clave', 'Timeline'],
    [
      ['F1', 'MVP VE', 'Activar sub-oficio VE. Primeras 10 actuaciones BM VE. Formularios ITC-BT-52', 'Q3 2026 (8 sem.)'],
      ['F2', 'Base Maestra VE', 'Implementar 50 actuaciones VE con materiales y reglas de cálculo', 'Q4 2026 (6 sem.)'],
      ['F3', 'Contratos O&M VE', 'Módulo contratos O&M VE. SLA. Facturación recurrente. Preventivos', 'Q4 2026 (4 sem.)'],
      ['F4', 'Normativa RAG VE', 'ITC-BT-52, REBT, MOVES III, AFIR en asistente RAG', 'Q1 2027 (4 sem.)'],
      ['F5', 'Catálogo + Integraciones', 'Catálogo Wallbox, ABB, Circutor. API VE. Partner AEDIVE', 'Q1-Q2 2027'],
    ],
    [8, 20, 50, 22]
  ),
  ...gap(),
  h2('12.2 Fotovoltaica Industrial'),
  simpleTable(
    ['Fase', 'Nombre', 'Contenido clave', 'Timeline'],
    [
      ['F1', 'MVP FV Industrial', '20 actuaciones iniciales. Presupuesto FV básico y parte de trabajo', 'Q1 2027 (10 sem.)'],
      ['F2', 'Base Maestra FV', '100 actuaciones FV completas. Termografía, monitorización, legalizaciones', 'Q2 2027 (8 sem.)'],
      ['F3', 'Contratos O&M FV', '4 niveles de servicio. Informes automáticos. Dashboard cliente', 'Q2 2027 (5 sem.)'],
      ['F4', 'Normativa RAG FV', 'RD 244/2019, RD 1183/2020, IEC 62446, IEC 61724 en RAG', 'Q3 2027 (4 sem.)'],
      ['F5', 'Catálogo + Integraciones', 'APIs Huawei, Sungrow, SolarEdge. Monitorización básica. Canal UNEF', 'Q3-Q4 2027'],
    ],
    [8, 20, 50, 22]
  ),
  pageBreak(),

  ...sectionHeader('14', 'Recomendación Final', 'Decisiones estratégicas · ROI · Priorización'),
  h2('14.1 ¿Debe TrabFlow entrar en estos verticales?'),
  simpleTable(
    ['Pregunta', 'Cargadores VE', 'Fotovoltaica Industrial'],
    [
      ['¿Debe TrabFlow entrar?', 'Sí, con alta prioridad', 'Sí, con alta prioridad'],
      ['¿Cuándo entrar?', 'Q3 2026 (MVP 8-10 semanas)', 'Q1 2027 (tras consolidar VE)'],
      ['¿Ingresos potenciales?', '€120.000–€200.000 ARR en Año 3', '€150.000–€280.000 ARR en Año 3'],
      ['ROI esperado', 'Alto. CAC bajo, LTV alto por O&M', 'Muy alto. Ticket alto, O&M plurianual'],
    ],
    [30, 35, 35]
  ),
  ...gap(),
  h2('14.2 Vertical Playbook — Plantilla replicable'),
  body('Este documento establece el estándar para nuevos verticales de TrabFlow. Para cada nuevo oficio (PCI, Aerotermia, Frío Industrial, Domótica, Gas Industrial):'),
  simpleTable(
    ['Sección', 'Contenido estándar'],
    [
      ['Mercado', 'TAM, SAM, SOM Spain. CAGR. Perfil instalador target'],
      ['Problemas', 'Top 10 dolores del instalador específico'],
      ['Base Maestra', 'Actuaciones con materiales, normativa, complejidad'],
      ['Arquitectura IA', 'Prompts, embeddings, colecciones, plantillas específicas'],
      ['Flujo usuario', 'Customer journey completo del vertical'],
      ['Normativa', 'RAG: normativa crítica, alta, media a indexar'],
      ['Integraciones', 'APIs fabricantes + protocolos + IoT del oficio'],
      ['Automatizaciones', 'Triggers temporales + eventos + reporting automático'],
      ['Monitorización', 'KPIs específicos del oficio (si aplica)'],
      ['Contratos', 'Plantillas O&M con SLA y niveles de servicio'],
      ['Roadmap', '5 fases: MVP → BM → Contratos → RAG → Integraciones'],
      ['Modelo económico', 'Costes desarrollo, infraestructura IA, ROI, break even'],
    ],
    [30, 70]
  ),
  ...gap(),
  h2('14.3 Métricas de éxito a 18 meses'),
  simpleTable(
    ['KPI', 'Objetivo 6m', 'Objetivo 12m', 'Objetivo 18m'],
    [
      ['Usuarios activos VE', '50', '200', '500'],
      ['Usuarios activos FV Industrial', '—', '50', '200'],
      ['ARR combinado VE + FV', '€15.000', '€60.000', '€180.000'],
      ['Contratos O&M activos en plataforma', '10', '80', '300'],
      ['Acuerdos sectoriales cerrados', 'AEDIVE', 'AEDIVE + UNEF', 'AEDIVE + UNEF + ANES'],
      ['Plantas FV monitorizadas', '—', '20', '100'],
      ['Informes O&M generados automáticamente', '—', '200/mes', '1.000/mes'],
      ['NPS usuarios VE y FV', '>40', '>50', '>60'],
    ],
    [34, 22, 22, 22]
  ),
];

// ── Footer ──────────────────────────────────────────────────────────────────
const docFooter = [
  ...gap(2),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({ text: 'TrabFlow Technologies, S.L.  ·  Documento interno estratégico  ·  Versión 2.0  ·  Junio 2026', size: pt(9), color: MUTED }),
    ],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Confidencial · No distribuir sin autorización', size: pt(9), color: MUTED, bold: true })],
  }),
];

// ── Build document ──────────────────────────────────────────────────────────
const allChildren = [
  ...cover,
  ...s01,
  ...sA,
  ...sB,
  ...sC,
  ...sD,
  ...sE,
  ...sF,
  ...sG,
  ...sOriginal,
  ...docFooter,
];

const doc = new Document({
  styles: {
    paragraphStyles: [
      {
        id: 'Normal',
        name: 'Normal',
        run: { font: 'Calibri', size: pt(11) },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        margin: {
          top: convertInchesToTwip(0.9),
          bottom: convertInchesToTwip(0.9),
          left: convertInchesToTwip(1.0),
          right: convertInchesToTwip(1.0),
        },
      },
    },
    children: allChildren,
  }],
});

Packer.toBuffer(doc).then(buffer => {
  const outPath = path.join(__dirname, '..', 'docs', 'TrabFlow_Vertical_Playbook_VE_FV_v2.docx');
  fs.writeFileSync(outPath, buffer);
  console.log('Documento generado: ' + outPath);
}).catch(e => {
  console.error('Error:', e.message);
});
