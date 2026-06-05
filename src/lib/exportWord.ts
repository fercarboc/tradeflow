import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import type { ContractVars } from './contractTemplates';
import { getOficioContent } from './contractTemplates';
import type { PartidaPresupuesto } from '../types';

// ── Palette (hex without #) ───────────────────────────────────────────────────
const C_BLUE   = '2563EB';
const C_PURPLE = '7C3AED';
const C_BLACK  = '0F172A';
const C_SLATE  = '475569';
const C_MUTED  = '94A3B8';
const C_WHITE  = 'FFFFFF';
const C_BG     = 'F8FAFC';
const C_NAVY   = '1E3A5F';
const C_GOLD   = 'FFC400';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  left:   { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  right:  { style: BorderStyle.NONE, size: 0, color: C_WHITE },
};

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE / INVOICE DOCX
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocExportOpts {
  tipo: 'presupuesto' | 'factura';
  numero: string;
  fecha: string;
  fechaVencimiento?: string;
  clienteNombre: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  empresa: {
    nombre?: string;
    nif?: string;
    direccion?: string;
    localidad?: string;
    cp?: string;
    email?: string;
    telefonoMovil?: string;
  };
  partidas: PartidaPresupuesto[];
  total: number;
  iva: number;
  estado?: string;
  notas?: string;
}

export async function downloadAsWordDocx(opts: DocExportOpts, filename: string): Promise<void> {
  const accent = opts.tipo === 'factura' ? C_PURPLE : C_BLUE;
  const esFactura = opts.tipo === 'factura';
  const totalIVA = opts.total * (opts.iva / 100);
  const totalConIVA = opts.total + totalIVA;

  const empresaLines = [
    opts.empresa.nif ? `NIF: ${opts.empresa.nif}` : '',
    [opts.empresa.direccion, opts.empresa.localidad, opts.empresa.cp].filter(Boolean).join(', '),
    [opts.empresa.email, opts.empresa.telefonoMovil ? `Tel: ${opts.empresa.telefonoMovil}` : ''].filter(Boolean).join('  ·  '),
  ].filter(Boolean);

  const clienteLines = [
    opts.clienteNombre,
    opts.clienteDireccion || '',
    opts.clienteEmail || '',
    opts.clienteTelefono ? `Tel: ${opts.clienteTelefono}` : '',
  ].filter(Boolean);

  // Items table
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      thCell('Descripción', accent, 48),
      thCell('Cant.', accent, 10),
      thCell('Precio unit.', accent, 20),
      thCell('Subtotal', accent, 22),
    ],
  });

  const dataRows = opts.partidas.map((p, i) =>
    new TableRow({
      children: [
        tdCell(p.descripcion, AlignmentType.LEFT, i, false),
        tdCell(String(p.cantidad), AlignmentType.CENTER, i, false),
        tdCell(`${p.precioUnitario.toFixed(2)} €`, AlignmentType.RIGHT, i, false),
        tdCell(`${p.total.toFixed(2)} €`, AlignmentType.RIGHT, i, true),
      ],
    })
  );

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
    borders: NO_BORDER,
  });

  // Info grid
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          infoCell('EMISOR',   [opts.empresa.nombre || '—', ...empresaLines]),
          infoCell('CLIENTE',  clienteLines),
        ],
      }),
    ],
    borders: NO_BORDER,
  });

  // Totals
  const totalsInner = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      totalRow('Base imponible',   `${opts.total.toFixed(2)} €`,    false),
      totalRow(`IVA ${opts.iva}%`, `${totalIVA.toFixed(2)} €`,      false),
      totalRow('TOTAL',            `${totalConIVA.toFixed(2)} €`,   true, accent),
    ],
    borders: {
      ...NO_BORDER,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      insideVertical:   { style: BorderStyle.NONE,   size: 0, color: C_WHITE  },
    },
  });

  const totalsWrapper = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({ width: { size: 55, type: WidthType.PERCENTAGE }, children: [new Paragraph({ text: '' })], borders: NO_BORDER }),
          new TableCell({ width: { size: 45, type: WidthType.PERCENTAGE }, children: [totalsInner],                  borders: NO_BORDER }),
        ],
      }),
    ],
    borders: NO_BORDER,
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        new Paragraph({ children: [new TextRun({ text: opts.empresa.nombre || 'Mi Empresa', bold: true, size: 36, color: C_BLACK })], spacing: { after: 80 } }),
        new Paragraph({ children: [new TextRun({ text: empresaLines.join('  ·  '), size: 18, color: C_SLATE })], spacing: { after: 240 } }),
        new Paragraph({
          children: [
            new TextRun({ text: `${esFactura ? 'FACTURA' : 'PRESUPUESTO'}  `, bold: true, size: 28, color: accent }),
            new TextRun({ text: opts.numero, bold: true, size: 36, font: 'Courier New', color: C_BLACK }),
          ],
          spacing: { after: 80 },
        }),
        new Paragraph({
          children: [
            new TextRun({ text: `Fecha: ${opts.fecha}`, size: 19, color: C_SLATE }),
            ...(opts.fechaVencimiento ? [new TextRun({ text: `   Vencimiento: ${opts.fechaVencimiento}`, size: 19, color: C_SLATE })] : []),
            ...(opts.estado ? [new TextRun({ text: `   Estado: ${opts.estado}`, size: 19, color: C_SLATE })] : []),
          ],
          spacing: { after: 280 },
        }),
        new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 6 } }, spacing: { after: 200 }, children: [] }),
        infoTable,
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        ...(opts.notas ? [
          new Paragraph({
            children: [
              new TextRun({ text: 'Notas: ', bold: true, size: 18, color: '78350F' }),
              new TextRun({ text: opts.notas, size: 18, color: '78350F' }),
            ],
            shading: { type: ShadingType.SOLID, color: 'FFFBEB', fill: 'FFFBEB' },
            spacing: { before: 60, after: 200 },
          }),
        ] : []),
        itemsTable,
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        totalsWrapper,
        new Paragraph({ spacing: { after: 240 }, children: [] }),
        new Paragraph({
          children: [new TextRun({ text: `Generado con TradeFlow AI · ${opts.empresa.nombre || ''}`, size: 16, color: C_MUTED })],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 4 } },
          spacing: { before: 200 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(blob, `${filename}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT DOCX — complete with all 14 clauses + annexes
// ═══════════════════════════════════════════════════════════════════════════════

export async function downloadContractAsDocx(vars: ContractVars, oficio: string, filename: string): Promise<void> {
  const c = getOficioContent(oficio);

  const cuotaMes  = vars.cuota_mensual  ? parseFloat(vars.cuota_mensual.replace(',', '.'))  : 0;
  const ivaPct    = vars.iva_pct        ? parseFloat(vars.iva_pct)                          : 21;
  const cuotaIVA  = (cuotaMes * ivaPct / 100).toFixed(2).replace('.', ',');
  const cuotaCIVA = (cuotaMes * (1 + ivaPct / 100)).toFixed(2).replace('.', ',');
  const anuSinIVA = (cuotaMes * 12).toFixed(2).replace('.', ',');
  const anuConIVA = (cuotaMes * 12 * (1 + ivaPct / 100)).toFixed(2).replace('.', ',');

  const installations = vars.descripcion_instalaciones
    .split('\n')
    .filter(l => l.trim())
    .map(l => l.trim());

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1080, right: 1080 } } },
      children: [

        // ══ PORTADA ══════════════════════════════════════════════════════════
        cTitle('CONTRATO DE PRESTACIÓN DE SERVICIOS DE MANTENIMIENTO'),
        cSubTitle(c.titulo),
        cRef(vars.referencia),
        cGap(300),

        // Parties table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                partyCell('PRESTADOR DEL SERVICIO', vars.empresa, [
                  `CIF/NIF: ${vars.cif_empresa}`,
                  vars.direccion_empresa,
                  `${vars.telefono_empresa}  ·  ${vars.email_empresa}`,
                ], C_BG),
                partyCell('CLIENTE', vars.nombre_cliente, [
                  `CIF/NIF: ${vars.cif_cliente}`,
                  vars.direccion_cliente,
                  `${vars.telefono_cliente}  ·  ${vars.email_cliente}`,
                  `Repr.: ${vars.representante_cliente} (${vars.cargo_representante})`,
                ], 'FFFBE6'),
              ],
            }),
          ],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            left:   { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            right:  { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            insideHorizontal: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
            insideVertical:   { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
          },
        }),
        cGap(160),

        // Summary bar
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                summaryCell('INICIO',               vars.fecha_inicio || '[ DD/MM/AAAA ]', C_NAVY),
                summaryCell('FIN INICIAL',           vars.fecha_fin    || '[ DD/MM/AAAA ]', C_NAVY),
                summaryCell('CUOTA MES (s/IVA)',     `${vars.cuota_mensual || '—'} EUR`,     C_NAVY),
                summaryCell('TOTAL MES (c/IVA)',     `${cuotaCIVA} EUR`,                     C_GOLD),
              ],
            }),
          ],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            bottom: { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            left:   { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            right:  { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
            insideHorizontal: { style: BorderStyle.NONE,   size: 0, color: C_WHITE },
            insideVertical:   { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
          },
        }),
        cGap(120),
        cCondLine(`Duración: ${vars.duracion_meses} meses · Renovación automática · Forma de pago: ${vars.forma_pago} · Vencimiento día ${vars.dia_vencimiento}`),
        cGap(300),

        // ══ EXPOSITIVO ═══════════════════════════════════════════════════════
        cPara(`En ${vars.ciudad_firma || '[ CIUDAD ]'}, a ${vars.fecha_inicio || '[ DD/MM/AAAA ]'}.`),
        cPara(`De una parte, ${vars.empresa}, con CIF ${vars.cif_empresa}, domiciliada en ${vars.direccion_empresa}, en adelante "EL PRESTADOR".`),
        cPara(`De otra parte, ${vars.nombre_cliente}, con CIF/NIF ${vars.cif_cliente}, domiciliada en ${vars.direccion_cliente}, representada en este acto por ${vars.representante_cliente}, con cargo de ${vars.cargo_representante}, en adelante "EL CLIENTE".`),
        cPara('Ambas partes se reconocen mutuamente plena capacidad legal para suscribir el presente contrato y, a tal efecto,'),
        new Paragraph({ children: [new TextRun({ text: 'ACUERDAN', bold: true, size: 26, color: C_NAVY })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 200 } }),

        // ══ CLÁUSULAS ════════════════════════════════════════════════════════

        // 1. Objeto
        clauseHead('Cláusula 1. Objeto del Contrato'),
        cPara('El presente contrato tiene por objeto la prestación por parte de EL PRESTADOR de los servicios de mantenimiento en las instalaciones indicadas en la Cláusula 3, de acuerdo con el alcance técnico definido en la Cláusula 4 y las condiciones económicas establecidas en la Cláusula 6.'),
        cPara(c.objeto),

        // 2. Duración
        clauseHead('Cláusula 2. Duración y Renovación'),
        cPara(`El presente contrato tendrá una vigencia inicial de ${vars.duracion_meses} meses, con fecha de inicio el ${vars.fecha_inicio || '[ DD/MM/AAAA ]'} y fecha de fin inicial el ${vars.fecha_fin || '[ DD/MM/AAAA ]'}.`),
        cPara('Transcurrido el período inicial, el contrato se renovará de forma automática por períodos anuales sucesivos, salvo que cualquiera de las partes comunique su voluntad de no renovar con una antelación mínima de 30 días naturales mediante comunicación escrita fehaciente.'),
        cPara('Cualquier modificación de las condiciones económicas en el momento de la renovación requerirá acuerdo expreso de ambas partes con al menos 15 días de antelación a la fecha de renovación.'),

        // 3. Instalaciones
        clauseHead('Cláusula 3. Instalaciones y Ubicaciones'),
        cPara('El presente contrato se aplicará a las siguientes instalaciones y/o ubicaciones:'),
        ...installations.map((l, i) => bullet(`${i + 1}. ${l}`)),
        cPara('Cualquier modificación, ampliación o reducción de las instalaciones incluidas en el contrato deberá ser acordada por escrito mediante Anexo adicional firmado por ambas partes, pudiendo implicar una revisión del importe de la cuota.'),

        // 4. Alcance
        clauseHead('Cláusula 4. Alcance del Servicio'),
        subHead2('4.1 Servicios incluidos'),
        cPara('El servicio de mantenimiento comprende las siguientes actuaciones:'),
        ...c.serviciosIncluidos.map(s => bullet(s)),
        subHead2('4.2 Servicios NO incluidos (exclusiones)'),
        cPara('Quedan expresamente excluidas del presente contrato las siguientes actuaciones:'),
        ...c.serviciosExcluidos.map(s => bullet(s)),
        cPara('Cualquier actuación fuera del alcance anterior podrá ser presupuestada y ejecutada previo acuerdo económico entre las partes.'),
        subHead2('4.3 Mantenimiento preventivo'),
        cPara('Con carácter preventivo, se realizarán las siguientes actuaciones periódicas:'),
        ...c.mantenimientoPreventivo.map(s => bullet(s)),

        // 5. SLA
        clauseHead('Cláusula 5. Horario de Servicio y Nivel de Servicio (SLA)'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            slaHeaderRow(),
            slaRow('Horario de guardia ordinaria',     vars.horario_guardia),
            slaRow('Servicio de urgencias',             vars.servicio_urgencias),
            slaRow('Tiempo máximo de respuesta',        vars.tiempo_respuesta),
            slaRow('Tiempo máximo de resolución',       vars.tiempo_resolucion),
            slaRow('Disponibilidad garantizada',        vars.disponibilidad),
            slaRow('Penalización por incumplimiento',   vars.penalizacion_sla),
          ],
          borders: NO_BORDER,
        }),
        cGap(80),
        cPara('En caso de avería o incidencia, EL CLIENTE deberá comunicarlo a través de la plataforma TrabFlow o al teléfono de atención indicado. EL PRESTADOR registrará la incidencia y actuará en los plazos acordados en la presente cláusula.'),

        // 6. Importe
        clauseHead('Cláusula 6. Importe y Condiciones Económicas'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            ecoHeaderRow(),
            ecoRow('Cuota mensual sin IVA',                  `${vars.cuota_mensual || '—'} EUR`, false),
            ecoRow(`IVA (${vars.iva_pct}%)`,                  `${cuotaIVA} EUR`,                  false),
            ecoRow('Cuota mensual TOTAL con IVA',             `${cuotaCIVA} EUR`,                  true),
            ecoRow('Cuota anual sin IVA',                     `${anuSinIVA} EUR`,                  false),
            ecoRow('Cuota anual con IVA',                     `${anuConIVA} EUR`,                  false),
            ecoRow('Forma de pago',                           vars.forma_pago,                     false),
            ecoRow('IBAN para domiciliación',                 vars.iban || '[ ES00 … ]',            false),
            ecoRow('Día de vencimiento',                      `Día ${vars.dia_vencimiento} de cada mes`, false),
          ],
          borders: NO_BORDER,
        }),
        cGap(80),
        cPara('EL PRESTADOR emitirá la correspondiente factura dentro de los primeros 5 días hábiles de cada mes por el servicio prestado. Los precios acordados se revisarán anualmente aplicando el IPC publicado por el INE, salvo pacto expreso en contrario.'),
        cPara('En caso de impago, EL PRESTADOR podrá suspender la prestación del servicio previa comunicación fehaciente con 10 días de antelación, sin perjuicio de reclamar los importes debidos más los intereses de demora legalmente establecidos.'),

        // 7. Obligaciones prestador
        clauseHead('Cláusula 7. Obligaciones de EL PRESTADOR'),
        bullet('Prestar el servicio con la diligencia, profesionalidad y conocimiento técnico requeridos, utilizando medios humanos y materiales adecuados.'),
        bullet('Cumplir los plazos y niveles de servicio definidos en la Cláusula 5.'),
        bullet('Mantener en todo momento las titulaciones, certificaciones y seguros necesarios para la realización de los trabajos contratados.'),
        bullet('Emitir un informe técnico de cada intervención preventiva o correctiva realizada en las instalaciones.'),
        bullet('Tratar con confidencialidad toda la información de EL CLIENTE a la que tenga acceso en el desempeño del servicio.'),
        bullet('Informar proactivamente a EL CLIENTE de cualquier anomalía detectada que pueda afectar al correcto funcionamiento de las instalaciones.'),
        bullet('Cumplir con la normativa de Prevención de Riesgos Laborales y coordinación de actividades empresariales (Real Decreto 171/2004).'),

        // 8. Obligaciones cliente
        clauseHead('Cláusula 8. Obligaciones de EL CLIENTE'),
        bullet('Facilitar el acceso a las instalaciones objeto del contrato en los horarios y condiciones necesarios para la prestación del servicio.'),
        bullet('Designar un interlocutor técnico responsable para la coordinación del servicio.'),
        bullet('Comunicar de forma inmediata cualquier avería, incidencia o anomalía detectada.'),
        bullet('No realizar modificaciones en las instalaciones mantenidas sin previo aviso a EL PRESTADOR.'),
        bullet('Abonar las facturas en los plazos establecidos en la Cláusula 6.'),
        bullet('Proporcionar a EL PRESTADOR la documentación técnica de las instalaciones necesaria para la correcta prestación del servicio.'),

        // 9. Responsabilidad
        clauseHead('Cláusula 9. Responsabilidad y Seguros'),
        cPara(`EL PRESTADOR dispondrá de seguro de Responsabilidad Civil General con una cobertura mínima de ${vars.cobertura_rc} EUR para hacer frente a los daños que pudieran derivarse de la prestación del servicio.`),
        cPara('EL PRESTADOR no será responsable de los daños causados por el mal uso de las instalaciones, por modificaciones realizadas por terceros ajenos al contrato, por situaciones de fuerza mayor o por incumplimientos del CLIENTE de las obligaciones establecidas en la Cláusula 8.'),
        cPara('La responsabilidad máxima de EL PRESTADOR por daños directos derivados del incumplimiento del contrato quedará limitada al importe de las cuotas abonadas en los últimos 6 meses de vigencia.'),

        // 10. Normativa
        clauseHead('Cláusula 10. Normativa Técnica y Legal Aplicable'),
        cPara('EL PRESTADOR llevará a cabo todos los trabajos objeto del presente contrato de conformidad con la normativa técnica y legal vigente, incluyendo entre otras:'),
        ...c.normativa.map(s => bullet(s)),

        // 11. Confidencialidad
        clauseHead('Cláusula 11. Confidencialidad y Protección de Datos'),
        cPara('Ambas partes se comprometen a mantener la más estricta confidencialidad sobre la información intercambiada en el marco del presente contrato, no divulgándola a terceros sin el consentimiento previo por escrito de la otra parte.'),
        cPara('El tratamiento de datos personales derivado de la ejecución del presente contrato se realizará de conformidad con el Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018. EL PRESTADOR actuará como Encargado del Tratamiento respecto a los datos del personal del CLIENTE a los que pudiera tener acceso.'),

        // 12. Modificaciones
        clauseHead('Cláusula 12. Modificaciones del Contrato'),
        cPara('Cualquier modificación de las condiciones del presente contrato deberá realizarse mediante Anexo escrito firmado por ambas partes. Las modificaciones de alcance técnico, instalaciones o importe económico no serán efectivas hasta su formalización por escrito.'),
        cPara('Las variaciones de precio por revisión anual de IPC no requerirán Anexo adicional, siendo suficiente la notificación escrita de EL PRESTADOR con 30 días de antelación.'),

        // 13. Resolución
        clauseHead('Cláusula 13. Causas de Resolución'),
        cPara('El presente contrato podrá resolverse anticipadamente por cualquiera de las partes en los siguientes supuestos:'),
        bullet('a) Mutuo acuerdo de las partes por escrito.'),
        bullet('b) Incumplimiento grave y reiterado de las obligaciones establecidas en el contrato, previa comunicación fehaciente otorgando un plazo de subsanación de 15 días.'),
        bullet('c) Impago de dos o más cuotas consecutivas por parte del CLIENTE.'),
        bullet('d) Cese de actividad de cualquiera de las partes.'),
        bullet('e) Fuerza mayor que imposibilite la prestación del servicio durante más de 3 meses consecutivos.'),
        cPara('La resolución anticipada por causa imputable a una de las partes dará derecho a la otra a exigir el pago de los daños y perjuicios ocasionados conforme a lo establecido en el Código Civil.'),

        // 14. Jurisdicción
        clauseHead('Cláusula 14. Jurisdicción y Legislación Aplicable'),
        cPara(`El presente contrato se rige por la legislación española. Para la resolución de cualquier controversia que pudiera surgir en relación con la interpretación, cumplimiento o ejecución del presente contrato, ambas partes, con renuncia a su fuero propio, se someten expresamente a los Juzgados y Tribunales de ${vars.ciudad_jurisdiccion || vars.ciudad_firma || '[ CIUDAD ]'}.`),
        cPara('Con carácter previo a cualquier actuación judicial, las partes se comprometen a intentar una resolución amistosa de la controversia mediante mediación conforme a la Ley 5/2012 de Mediación en Asuntos Civiles y Mercantiles.'),

        // ══ FIRMAS ═══════════════════════════════════════════════════════════
        cGap(160),
        cPara(`En prueba de conformidad, ambas partes suscriben el presente contrato en dos ejemplares originales de igual valor y efecto, en el lugar y fecha indicados.`),
        cPara(`En ${vars.ciudad_firma || '[ CIUDAD ]'}, a ${vars.fecha_inicio || '[ DD/MM/AAAA ]'}.`),
        cGap(120),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                signCell('EL PRESTADOR', vars.empresa, `CIF: ${vars.cif_empresa}`),
                signCell('EL CLIENTE', vars.nombre_cliente, `CIF: ${vars.cif_cliente}  ·  ${vars.representante_cliente}`),
              ],
            }),
          ],
          borders: NO_BORDER,
        }),

        // ══ ANEXO I ══════════════════════════════════════════════════════════
        cGap(400),
        ...annexHead('ANEXO I — INVENTARIO DE INSTALACIONES Y EQUIPOS', `Contrato: ${vars.referencia}  ·  Cliente: ${vars.nombre_cliente}`),
        cPara('El presente Anexo recoge el inventario detallado de instalaciones, equipos y elementos objeto del presente contrato de mantenimiento. Este inventario podrá ser actualizado mediante documento firmado por ambas partes sin necesidad de modificar el contrato principal.'),
        // Installation inventory table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            annexHeaderRow(['Nº', 'Descripción del equipo / instalación', 'Marca / Modelo', 'Ubicación', 'Año inst.', 'Incluido']),
            ...Array.from({ length: 15 }, (_, i) =>
              new TableRow({
                children: [
                  annexDataCell(String(i + 1), 5),
                  annexDataCell('', 35),
                  annexDataCell('', 22),
                  annexDataCell('', 18),
                  annexDataCell('', 10),
                  annexDataCell('☐', 10),
                ],
              })
            ),
          ],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            left:   { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            right:  { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
          },
        }),
        cGap(80),
        cPara(`Límite de coste para reparaciones correctivas incluidas sin presupuesto adicional: ${vars.limite_correctivo} EUR por actuación.`),

        // ══ ANEXO II ═════════════════════════════════════════════════════════
        cGap(300),
        ...annexHead('ANEXO II — REGISTRO DE ACTUACIONES Y PARTES DE TRABAJO', `Contrato: ${vars.referencia}  ·  Cliente: ${vars.nombre_cliente}`),
        cPara('Cada intervención realizada en el marco del presente contrato quedará registrada mediante Parte de Trabajo que incluirá la siguiente información mínima:'),
        bullet('Número de parte, fecha y hora de la actuación.'),
        bullet('Tipo de intervención: preventiva / correctiva / urgencia.'),
        bullet('Instalación o equipo objeto de la actuación.'),
        bullet('Descripción de los trabajos realizados y materiales empleados.'),
        bullet('Tiempo de intervención y técnico responsable.'),
        bullet('Estado de la instalación al finalizar la intervención.'),
        bullet('Firma del técnico y firma de conformidad del representante del CLIENTE.'),
        cGap(80),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            annexHeaderRow(['Parte Nº', 'Fecha / Hora', 'Tipo', 'Instalación / Equipo', 'Horas', 'Técnico', 'Obs.']),
            ...Array.from({ length: 8 }, () =>
              new TableRow({
                children: [
                  annexDataCell('', 8),
                  annexDataCell('', 14),
                  annexDataCell('', 12),
                  annexDataCell('', 30),
                  annexDataCell('', 8),
                  annexDataCell('', 14),
                  annexDataCell('', 14),
                ],
              })
            ),
          ],
          borders: {
            top:    { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            left:   { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            right:  { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
            insideVertical:   { style: BorderStyle.SINGLE, size: 4, color: 'DDE4ED' },
          },
        }),
        cGap(160),
        new Paragraph({
          children: [new TextRun({ text: `${vars.empresa}  ·  ${vars.referencia}  ·  Generado con TrabFlow AI`, size: 16, color: C_MUTED })],
          alignment: AlignmentType.CENTER,
          border: { top: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 4 } },
          spacing: { before: 120 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(blob, `${filename}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAINTENANCE CONTRACT DOCX — from MaintenanceDocumento structure
// ═══════════════════════════════════════════════════════════════════════════════

export interface MaintenanceDocForExport {
  titulo: string;
  partes: { prestador: string; cliente: string; direccion_servicio: string };
  objeto: string;
  servicios_incluidos: string[];
  servicios_excluidos: string[];
  sla: { nivel: string; tiempo_respuesta: string; tiempo_resolucion: string; horario_cobertura: string; penalizacion: string };
  preventivos: { incluidos: boolean; num_visitas_anio: number; descripcion: string };
  precio: { cuota_mensual_neto: number; iva_pct: number; cuota_mensual_total: number; cuota_anual_total: number; tipo_facturacion: string; forma_pago: string };
  duracion: { vigencia_meses: number; renovacion_automatica: boolean; preaviso_cancelacion_dias: number; clausula_duracion: string };
  materiales: { incluidos: boolean; clausula: string };
  clausulas_adicionales: string[];
  confidencialidad: string;
  jurisdiccion: string;
}

export async function downloadMaintenanceDocAsDocx(doc: MaintenanceDocForExport, filename = 'contrato-mantenimiento'): Promise<void> {
  const fmtEur = (n: number) => n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });

  const mHead = (text: string) => new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: C_NAVY, allCaps: true })],
    spacing: { before: 280, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 4 } },
  });

  const mSub = (label: string, value: string) => new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, bold: true, size: 18, color: C_SLATE }),
      new TextRun({ text: value, size: 18, color: C_BLACK }),
    ],
    spacing: { after: 60 },
  });

  const mBullet = (text: string, color = C_BLACK) => new Paragraph({
    children: [new TextRun({ text: `• ${text}`, size: 18, color })],
    spacing: { after: 40 },
  });

  const mPara = (text: string) => new Paragraph({
    children: [new TextRun({ text, size: 18, color: C_SLATE })],
    spacing: { after: 80 },
  });

  const mNum = (i: number, text: string) => new Paragraph({
    children: [
      new TextRun({ text: `${i}. `, bold: true, size: 18, color: C_NAVY }),
      new TextRun({ text, size: 18, color: C_BLACK }),
    ],
    spacing: { after: 60 },
  });

  const children = [
    // Título
    new Paragraph({
      children: [new TextRun({ text: doc.titulo, bold: true, size: 28, color: C_NAVY, allCaps: true })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),

    // Partes
    mHead('1. Partes del contrato'),
    mSub('Prestador', doc.partes.prestador),
    mSub('Cliente', doc.partes.cliente),
    mSub('Dirección del servicio', doc.partes.direccion_servicio),

    // Objeto
    mHead('2. Objeto del contrato'),
    mPara(doc.objeto),

    // Servicios incluidos
    mHead('3. Servicios incluidos'),
    ...doc.servicios_incluidos.map(s => mBullet(s, C_BLACK)),

    // Servicios excluidos
    mHead('4. Exclusiones'),
    ...doc.servicios_excluidos.map(s => mBullet(s, C_SLATE)),

    // SLA
    mHead('5. Niveles de servicio (SLA)'),
    mSub('Nivel SLA', doc.sla.nivel.toUpperCase()),
    mSub('Tiempo de respuesta', doc.sla.tiempo_respuesta),
    mSub('Tiempo de resolución', doc.sla.tiempo_resolucion),
    mSub('Horario de cobertura', doc.sla.horario_cobertura),
    ...(doc.sla.penalizacion ? [mSub('Penalización por incumplimiento', doc.sla.penalizacion)] : []),

    // Preventivos
    mHead('6. Mantenimiento preventivo'),
    mSub('Preventivos incluidos', doc.preventivos.incluidos ? 'Sí' : 'No'),
    mSub('Número de visitas anuales', String(doc.preventivos.num_visitas_anio)),
    mPara(doc.preventivos.descripcion),

    // Precio
    mHead('7. Precio y facturación'),
    mSub('Cuota mensual (neto)', fmtEur(doc.precio.cuota_mensual_neto)),
    mSub(`IVA (${doc.precio.iva_pct}%)`, fmtEur(doc.precio.cuota_mensual_total - doc.precio.cuota_mensual_neto)),
    mSub('Cuota mensual + IVA', fmtEur(doc.precio.cuota_mensual_total)),
    mSub('Cuota anual + IVA', fmtEur(doc.precio.cuota_anual_total)),
    mSub('Tipo de facturación', doc.precio.tipo_facturacion),
    mSub('Forma de pago', doc.precio.forma_pago),

    // Duración
    mHead('8. Duración y renovación'),
    mPara(doc.duracion.clausula_duracion),
    mSub('Vigencia inicial', `${doc.duracion.vigencia_meses} meses`),
    mSub('Renovación automática', doc.duracion.renovacion_automatica ? 'Sí' : 'No'),
    mSub('Preaviso de cancelación', `${doc.duracion.preaviso_cancelacion_dias} días`),

    // Materiales
    mHead('9. Materiales y repuestos'),
    mPara(doc.materiales.clausula),

    // Cláusulas adicionales
    ...(doc.clausulas_adicionales.length > 0 ? [
      mHead('10. Cláusulas adicionales'),
      ...doc.clausulas_adicionales.map((c, i) => mNum(i + 1, c)),
    ] : []),

    // Confidencialidad
    mHead('11. Confidencialidad'),
    mPara(doc.confidencialidad),

    // Jurisdicción
    mHead('12. Jurisdicción'),
    mPara(doc.jurisdiccion),

    // Firmas
    mHead('13. Firmas'),
    new Paragraph({
      children: [new TextRun({ text: 'En ________________ a _______ de _____________ de _______', size: 18, color: C_SLATE })],
      spacing: { before: 80, after: 200 },
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({
        children: [
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'EL PRESTADOR', bold: true, size: 18, color: C_NAVY })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: doc.partes.prestador, size: 16, color: C_SLATE })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
              new Paragraph({ children: [new TextRun({ text: 'Firma: ___________________', size: 17, color: C_MUTED })], alignment: AlignmentType.CENTER }),
            ],
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
          new TableCell({ width: { size: 4, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [] })], margins: { top: 0, bottom: 0, left: 0, right: 0 } }),
          new TableCell({
            width: { size: 48, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({ children: [new TextRun({ text: 'EL CLIENTE', bold: true, size: 18, color: C_NAVY })], alignment: AlignmentType.CENTER }),
              new Paragraph({ children: [new TextRun({ text: doc.partes.cliente, size: 16, color: C_SLATE })], alignment: AlignmentType.CENTER, spacing: { after: 120 } }),
              new Paragraph({ children: [new TextRun({ text: 'Firma: ___________________', size: 17, color: C_MUTED })], alignment: AlignmentType.CENTER }),
            ],
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
          }),
        ],
      })],
    }),

    // Footer
    new Paragraph({
      children: [new TextRun({ text: 'Generado con TrabFlow · trabflow.com', size: 16, color: C_MUTED })],
      alignment: AlignmentType.CENTER,
      border: { top: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 4 } },
      spacing: { before: 200 },
    }),
  ];

  const word = new Document({ sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1080, right: 1080 } } }, children }] });
  const blob = await Packer.toBlob(word);
  saveBlob(blob, `${filename}.docx`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUOTE/INVOICE helpers
// ═══════════════════════════════════════════════════════════════════════════════

function thCell(text: string, color: string, pct: number): TableCell {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color, fill: color },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 16, color: C_WHITE, allCaps: true })], alignment: text === 'Descripción' ? AlignmentType.LEFT : AlignmentType.CENTER })],
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    borders: NO_BORDER,
  });
}

function tdCell(text: string, align: typeof AlignmentType[keyof typeof AlignmentType], rowIdx: number, bold: boolean): TableCell {
  const bg = rowIdx % 2 === 0 ? C_WHITE : C_BG;
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    children: [new Paragraph({ children: [new TextRun({ text, size: 18, bold, color: bold ? C_BLACK : C_SLATE })], alignment: align })],
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'F1F5F9' } },
  });
}

function infoCell(label: string, lines: string[]): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: C_BG, fill: C_BG },
    children: [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16, color: C_MUTED, allCaps: true })], spacing: { after: 80 } }),
      ...lines.map(l => new Paragraph({ children: [new TextRun({ text: l, size: 19, color: C_BLACK })], spacing: { after: 40 } })),
    ],
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    borders: NO_BORDER,
  });
}

function totalRow(label: string, value: string, isFinal: boolean, accent?: string): TableRow {
  const sz = isFinal ? 24 : 19;
  const bg = isFinal ? 'EFF6FF' : C_WHITE;
  const valCol = isFinal ? (accent || C_BLUE) : C_SLATE;
  return new TableRow({
    children: [
      new TableCell({ shading: { type: ShadingType.SOLID, color: bg, fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: label, size: sz, bold: isFinal, color: isFinal ? C_BLACK : C_SLATE })], spacing: { before: 60, after: 60 } })], margins: { left: 80, right: 40, top: 0, bottom: 0 }, borders: NO_BORDER }),
      new TableCell({ shading: { type: ShadingType.SOLID, color: bg, fill: bg }, children: [new Paragraph({ children: [new TextRun({ text: value, size: sz, bold: isFinal, color: valCol })], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })], margins: { left: 40, right: 80, top: 0, bottom: 0 }, borders: NO_BORDER }),
    ],
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT helpers
// ═══════════════════════════════════════════════════════════════════════════════

function cTitle(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 32, color: C_NAVY, allCaps: true })], alignment: AlignmentType.CENTER, spacing: { after: 100 } });
}
function cSubTitle(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 22, color: C_GOLD })], alignment: AlignmentType.CENTER, spacing: { after: 60 } });
}
function cRef(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: `Referencia: ${text}`, size: 18, color: C_MUTED })], alignment: AlignmentType.CENTER, spacing: { after: 60 } });
}
function cGap(after = 200): Paragraph {
  return new Paragraph({ spacing: { after }, children: [] });
}
function cPara(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 19, color: C_BLACK })], spacing: { after: 100 }, alignment: AlignmentType.BOTH });
}
function cCondLine(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, size: 17, color: C_SLATE })], alignment: AlignmentType.CENTER, spacing: { after: 60 } });
}
function clauseHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 20, color: C_NAVY })],
    spacing: { before: 280, after: 100 },
    border: { left: { style: BorderStyle.SINGLE, color: C_NAVY, size: 20 } },
    indent: { left: 120 },
  });
}
function subHead2(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text, bold: true, size: 18, color: C_SLATE })], spacing: { before: 140, after: 60 } });
}
function bullet(text: string): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: `▸  ${text}`, size: 18, color: C_BLACK })], spacing: { after: 60 }, indent: { left: 160 } });
}
function annexHead(title: string, subtitle: string): Paragraph[] {
  return [
    new Paragraph({ children: [new TextRun({ text: title, bold: true, size: 24, color: C_WHITE })], shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, spacing: { before: 0, after: 40 }, indent: { left: 120, right: 120 } }),
    new Paragraph({ children: [new TextRun({ text: subtitle, size: 16, color: C_MUTED })], shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, spacing: { before: 0, after: 120 }, indent: { left: 120, right: 120 } }),
  ];
}

function partyCell(label: string, name: string, lines: string[], bg: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    children: [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 16, color: C_NAVY, allCaps: true })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 22, color: C_BLACK })], spacing: { after: 60 } }),
      ...lines.filter(Boolean).map(l => new Paragraph({ children: [new TextRun({ text: l, size: 17, color: C_SLATE })], spacing: { after: 40 } })),
    ],
    margins: { top: 140, bottom: 140, left: 140, right: 140 },
    borders: NO_BORDER,
  });
}

function summaryCell(label: string, value: string, bg: string): TableCell {
  const isDark = bg === C_NAVY;
  const textCol = isDark ? C_WHITE : C_BLACK;
  const labelCol = isDark ? 'B0C4DE' : C_SLATE;
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    children: [
      new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 15, color: labelCol, allCaps: true })], alignment: AlignmentType.CENTER, spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: value, bold: true, size: 22, color: textCol })], alignment: AlignmentType.CENTER }),
    ],
    margins: { top: 120, bottom: 120, left: 80, right: 80 },
    borders: NO_BORDER,
  });
}

function slaHeaderRow(): TableRow {
  return new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Parámetro SLA', bold: true, size: 16, color: C_WHITE })] })], margins: { top: 80, bottom: 80, left: 100, right: 60 }, borders: NO_BORDER }),
      new TableCell({ shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Valor acordado', bold: true, size: 16, color: C_WHITE })] })], margins: { top: 80, bottom: 80, left: 60, right: 100 }, borders: NO_BORDER }),
    ],
  });
}

function slaRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, size: 17, color: C_NAVY })] })], margins: { top: 60, bottom: 60, left: 100, right: 60 }, borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8EEF5' } } }),
      new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, size: 17, color: C_BLACK })] })], margins: { top: 60, bottom: 60, left: 60, right: 100 }, borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8EEF5' } } }),
    ],
  });
}

function ecoHeaderRow(): TableRow {
  return new TableRow({
    tableHeader: true,
    children: [
      new TableCell({ shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Concepto', bold: true, size: 16, color: C_WHITE })] })], margins: { top: 80, bottom: 80, left: 100, right: 60 }, borders: NO_BORDER }),
      new TableCell({ shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: 'Importe', bold: true, size: 16, color: C_WHITE })] })], margins: { top: 80, bottom: 80, left: 60, right: 100 }, borders: NO_BORDER }),
    ],
  });
}

function ecoRow(label: string, value: string, isTotal: boolean): TableRow {
  const bg    = isTotal ? 'FFFBE6' : C_WHITE;
  const sz    = isTotal ? 20 : 17;
  const bold  = isTotal;
  return new TableRow({
    children: [
      new TableCell({ shading: { type: ShadingType.SOLID, color: bg, fill: bg }, width: { size: 60, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: label, size: sz, bold, color: isTotal ? C_NAVY : C_SLATE })] })], margins: { top: 60, bottom: 60, left: 100, right: 60 }, borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8EEF5' } } }),
      new TableCell({ shading: { type: ShadingType.SOLID, color: bg, fill: bg }, width: { size: 40, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: value, size: sz, bold, color: isTotal ? C_NAVY : C_BLACK })] })], margins: { top: 60, bottom: 60, left: 60, right: 100 }, borders: { ...NO_BORDER, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E8EEF5' } } }),
    ],
  });
}

function signCell(role: string, name: string, detail: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: [new TextRun({ text: role, bold: true, size: 18, color: C_NAVY, allCaps: true })], alignment: AlignmentType.CENTER, shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY }, spacing: { after: 0 } }),
      new Paragraph({ children: [new TextRun({ text: 'Firma y sello', size: 16, color: C_MUTED })], alignment: AlignmentType.CENTER, spacing: { before: 120, after: 400 } }),
      new Paragraph({ children: [new TextRun({ text: '_'.repeat(36), color: C_MUTED })], spacing: { after: 80 } }),
      new Paragraph({ children: [new TextRun({ text: name, bold: true, size: 18, color: C_BLACK })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: detail, size: 16, color: C_SLATE })], spacing: { after: 40 } }),
      new Paragraph({ children: [new TextRun({ text: 'Fecha: ___________________', size: 16, color: C_SLATE })], spacing: { after: 40 } }),
    ],
    borders: {
      top:    { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
      left:   { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
      right:  { style: BorderStyle.SINGLE, size: 8, color: C_NAVY },
    },
    margins: { top: 0, bottom: 120, left: 120, right: 120 },
  });
}

function annexHeaderRow(cols: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cols.map(t =>
      new TableCell({
        shading: { type: ShadingType.SOLID, color: C_NAVY, fill: C_NAVY },
        children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 15, color: C_WHITE })] })],
        margins: { top: 60, bottom: 60, left: 80, right: 80 },
        borders: NO_BORDER,
      })
    ),
  });
}

function annexDataCell(text: string, pct: number): TableCell {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    children: [new Paragraph({ children: [new TextRun({ text, size: 17, color: C_BLACK })], alignment: text === '☐' || /^\d+$/.test(text) ? AlignmentType.CENTER : AlignmentType.LEFT })],
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: NO_BORDER,
  });
}
