import {
  Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun,
  AlignmentType, WidthType, BorderStyle, ShadingType,
} from 'docx';
import type { ContractVars } from './contractTemplates';
import type { PartidaPresupuesto } from '../types';

// ── Palette (hex without #) ───────────────────────────────────────────────────
const C_BLUE   = '2563EB';
const C_PURPLE = '7C3AED';
const C_BLACK  = '0F172A';
const C_SLATE  = '475569';
const C_MUTED  = '94A3B8';
const C_WHITE  = 'FFFFFF';
const C_BG     = 'F8FAFC';

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
  top: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  bottom: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  left: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
  right: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
};

// ─── Quote / Invoice DOCX ────────────────────────────────────────────────────

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

  // ── Items table ──────────────────────────────────────────────────────────
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

  // ── Info grid (2 cols) ────────────────────────────────────────────────────
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          infoCell('EMISOR', [opts.empresa.nombre || '—', ...empresaLines]),
          infoCell('CLIENTE', clienteLines),
        ],
      }),
    ],
    borders: NO_BORDER,
  });

  // ── Totals (right-aligned wrapper) ────────────────────────────────────────
  const totalsInner = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      totalRow('Base imponible', `${opts.total.toFixed(2)} €`, false),
      totalRow(`IVA ${opts.iva}%`, `${totalIVA.toFixed(2)} €`, false),
      totalRow('TOTAL', `${totalConIVA.toFixed(2)} €`, true, accent),
    ],
    borders: {
      ...NO_BORDER,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: C_WHITE },
    },
  });

  const totalsWrapper = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            children: [new Paragraph({ text: '' })],
            borders: NO_BORDER,
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            children: [totalsInner],
            borders: NO_BORDER,
          }),
        ],
      }),
    ],
    borders: NO_BORDER,
  });

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } },
      children: [
        // Company name
        new Paragraph({
          children: [new TextRun({ text: opts.empresa.nombre || 'Mi Empresa', bold: true, size: 36, color: C_BLACK })],
          spacing: { after: 80 },
        }),
        // Company details
        new Paragraph({
          children: [new TextRun({ text: empresaLines.join('  ·  '), size: 18, color: C_SLATE })],
          spacing: { after: 240 },
        }),
        // Document type + number
        new Paragraph({
          children: [
            new TextRun({ text: `${esFactura ? 'FACTURA' : 'PRESUPUESTO'}  `, bold: true, size: 28, color: accent }),
            new TextRun({ text: opts.numero, bold: true, size: 36, font: 'Courier New', color: C_BLACK }),
          ],
          spacing: { after: 80 },
        }),
        // Date + vencimiento
        new Paragraph({
          children: [
            new TextRun({ text: `Fecha: ${opts.fecha}`, size: 19, color: C_SLATE }),
            ...(opts.fechaVencimiento ? [new TextRun({ text: `   Vencimiento: ${opts.fechaVencimiento}`, size: 19, color: C_SLATE })] : []),
            ...(opts.estado ? [new TextRun({ text: `   Estado: ${opts.estado}`, size: 19, color: C_SLATE })] : []),
          ],
          spacing: { after: 280 },
        }),
        // Separator
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 6 } },
          spacing: { after: 200 },
          children: [],
        }),
        // Info grid
        infoTable,
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        // Notes
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
        // Items
        itemsTable,
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        // Totals
        totalsWrapper,
        new Paragraph({ spacing: { after: 240 }, children: [] }),
        // Footer
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

// ─── Contract DOCX ───────────────────────────────────────────────────────────

export async function downloadContractAsDocx(vars: ContractVars, filename: string): Promise<void> {
  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1080, right: 1080 } } },
      children: [
        // Title
        new Paragraph({
          children: [new TextRun({ text: 'CONTRATO DE MANTENIMIENTO', bold: true, size: 36, allCaps: true, color: C_BLUE })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [new TextRun({ text: vars.referencia, size: 22, color: C_SLATE, bold: true })],
          alignment: AlignmentType.CENTER,
          spacing: { after: 480 },
        }),

        // Partes
        sectionHead('PARTES DEL CONTRATO'),
        subHead('PRESTADOR DEL SERVICIO'),
        info(`Empresa: ${vars.empresa}`),
        info(`CIF/NIF: ${vars.cif_empresa}`),
        info(`Dirección: ${vars.direccion_empresa}`),
        info(`Teléfono: ${vars.telefono_empresa}   Email: ${vars.email_empresa}`),
        gap(),

        subHead('CLIENTE'),
        info(`Empresa / Persona: ${vars.nombre_cliente}`),
        info(`CIF/NIF: ${vars.cif_cliente}`),
        info(`Dirección: ${vars.direccion_cliente}`),
        info(`Teléfono: ${vars.telefono_cliente}   Email: ${vars.email_cliente}`),
        info(`Representante: ${vars.representante_cliente} — ${vars.cargo_representante}`),
        gap(),

        // Duración
        sectionHead('DURACIÓN Y CONDICIONES'),
        info(`Inicio: ${vars.fecha_inicio}   Fin: ${vars.fecha_fin}   Duración: ${vars.duracion_meses} meses`),
        info(`Ciudad de firma: ${vars.ciudad_firma}`),
        gap(),

        // Económico
        sectionHead('CONDICIONES ECONÓMICAS'),
        info(`Cuota mensual sin IVA: ${vars.cuota_mensual} €`),
        info(`IVA: ${vars.iva_pct}%`),
        info(`Cuota mensual con IVA: ${vars.cuota_mensual_con_iva} €`),
        info(`Cuota anual sin IVA: ${vars.cuota_anual} €`),
        info(`Período de facturación: ${vars.periodo_facturacion}`),
        info(`Forma de pago: ${vars.forma_pago}`),
        ...(vars.iban ? [info(`IBAN: ${vars.iban}`)] : []),
        info(`Día de vencimiento: ${vars.dia_vencimiento} de cada mes`),
        gap(),

        // SLA
        sectionHead('HORARIO Y NIVELES DE SERVICIO (SLA)'),
        info(`Horario de guardia: ${vars.horario_guardia}`),
        info(`Servicio de urgencias: ${vars.servicio_urgencias}`),
        info(`Tiempo de respuesta: ${vars.tiempo_respuesta}`),
        info(`Tiempo de resolución: ${vars.tiempo_resolucion}`),
        info(`Disponibilidad garantizada: ${vars.disponibilidad}`),
        info(`Penalización SLA: ${vars.penalizacion_sla}`),
        gap(),

        // Instalaciones
        sectionHead('INSTALACIONES INCLUIDAS'),
        ...vars.descripcion_instalaciones
          .split('\n')
          .filter(l => l.trim())
          .map(l => info(`• ${l.trim()}`)),
        gap(),

        // Legal
        sectionHead('DATOS LEGALES'),
        info(`Jurisdicción: ${vars.ciudad_jurisdiccion}`),
        info(`Cobertura RC mínima: ${vars.cobertura_rc} €`),
        info(`Límite coste correctivo incluido: ${vars.limite_correctivo} €`),
        gap(),
        gap(),

        // Firmas
        sectionHead('FIRMAS'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                signCell('EL PRESTADOR', vars.empresa),
                signCell('EL CLIENTE', vars.nombre_cliente),
              ],
            }),
          ],
          borders: NO_BORDER,
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(blob, `${filename}.docx`);
}

// ─── Cell helpers ─────────────────────────────────────────────────────────────

function thCell(text: string, color: string, pct: number): TableCell {
  return new TableCell({
    width: { size: pct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color, fill: color },
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 16, color: C_WHITE, allCaps: true })],
      alignment: text === 'Descripción' ? AlignmentType.LEFT : AlignmentType.CENTER,
    })],
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    borders: NO_BORDER,
  });
}

function tdCell(text: string, align: typeof AlignmentType[keyof typeof AlignmentType], rowIdx: number, bold: boolean): TableCell {
  const bg = rowIdx % 2 === 0 ? C_WHITE : C_BG;
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: bg, fill: bg },
    children: [new Paragraph({
      children: [new TextRun({ text, size: 18, bold, color: bold ? C_BLACK : C_SLATE })],
      alignment: align,
    })],
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
    borders: {
      ...NO_BORDER,
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'F1F5F9' },
    },
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
  const col = isFinal ? C_BLACK : C_SLATE;
  const valCol = isFinal ? (accent || C_BLUE) : C_SLATE;
  const bg = isFinal ? 'EFF6FF' : C_WHITE;
  const cellBorders = { ...NO_BORDER };
  return new TableRow({
    children: [
      new TableCell({
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        children: [new Paragraph({ children: [new TextRun({ text: label, size: sz, bold: isFinal, color: col })], spacing: { before: 60, after: 60 } })],
        margins: { left: 80, right: 40, top: 0, bottom: 0 },
        borders: cellBorders,
      }),
      new TableCell({
        shading: { type: ShadingType.SOLID, color: bg, fill: bg },
        children: [new Paragraph({ children: [new TextRun({ text: value, size: sz, bold: isFinal, color: valCol })], alignment: AlignmentType.RIGHT, spacing: { before: 60, after: 60 } })],
        margins: { left: 40, right: 80, top: 0, bottom: 0 },
        borders: cellBorders,
      }),
    ],
  });
}

function sectionHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: C_BLUE, allCaps: true })],
    spacing: { before: 360, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, color: 'E2E8F0', size: 4 } },
  });
}

function subHead(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 19, color: C_SLATE, allCaps: true })],
    spacing: { before: 160, after: 60 },
  });
}

function info(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 19, color: C_BLACK })],
    spacing: { after: 60 },
  });
}

function gap(): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [] });
}

function signCell(role: string, name: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({ children: [new TextRun({ text: role, bold: true, size: 18, color: C_SLATE, allCaps: true })], spacing: { after: 280 } }),
      new Paragraph({ children: [new TextRun({ text: '_'.repeat(36), color: C_MUTED })], spacing: { after: 100 } }),
      new Paragraph({ children: [new TextRun({ text: name, size: 18, color: C_BLACK })], spacing: { after: 60 } }),
      new Paragraph({ children: [new TextRun({ text: 'Fecha: ___________________', size: 17, color: C_SLATE })], spacing: { after: 60 } }),
    ],
    borders: NO_BORDER,
    margins: { top: 120, bottom: 120, left: 0, right: 200 },
  });
}
