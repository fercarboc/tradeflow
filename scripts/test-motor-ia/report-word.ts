import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
} from 'docx';
import { writeFileSync } from 'node:fs';
import type { TestResult, Category } from './types.js';

const CATEGORIES: Category[] = [
  'OK_CATALOGO',
  'OK_MIXTO',
  'SOLO_SUGERIDAS',
  'VACIO',
  'ERROR_TECNICO',
  'PRECIO_INVALIDO',
];

function bold(text: string): TextRun {
  return new TextRun({ text, bold: true });
}

function cell(text: string, shade?: string, bold_?: boolean): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: shade, fill: shade } : undefined,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: bold_, size: 18 })],
        alignment: AlignmentType.CENTER,
      }),
    ],
    margins: { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

function headerCell(text: string): TableCell {
  return cell(text, '2E4057', true);
}

export async function generateWord(results: TestResult[], outputPath: string): Promise<void> {
  const total = results.length;
  const runDate = new Date().toLocaleString('es-ES');

  // Global stats
  const counts: Record<string, number> = {};
  for (const cat of CATEGORIES) counts[cat] = 0;
  for (const r of results) counts[r.classification.category]++;

  const ok = counts['OK_CATALOGO'] + counts['OK_MIXTO'];
  const errors = counts['VACIO'] + counts['ERROR_TECNICO'] + counts['PRECIO_INVALIDO'];
  const okPct = Math.round((ok / total) * 100);
  const errorPct = Math.round((errors / total) * 100);
  const coincide = results.filter(r => r.classification.coincide_oficio === 'SI').length;
  const coincidePct = Math.round((coincide / total) * 100);
  const avgLatency = Math.round(results.reduce((s, r) => s + r.latency_ms, 0) / total);
  const p95Latency = (() => {
    const sorted = [...results].sort((a, b) => a.latency_ms - b.latency_ms);
    return sorted[Math.floor(total * 0.95)]?.latency_ms ?? 0;
  })();

  // Per-oficio stats
  const oficios = [...new Set(results.map(r => r.oficio))].sort();

  // Build table rows for per-oficio summary
  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell('Oficio'),
        headerCell('Total'),
        headerCell('OK_CAT'),
        headerCell('OK_MIX'),
        headerCell('SUGER'),
        headerCell('VACÍO'),
        headerCell('ERROR'),
        headerCell('P.INV'),
        headerCell('Tasa OK'),
        headerCell('Latencia'),
      ],
    }),
  ];

  for (const oficio of oficios) {
    const group = results.filter(r => r.oficio === oficio);
    const g = group.length;
    const gc: Record<string, number> = {};
    for (const cat of CATEGORIES) gc[cat] = 0;
    for (const r of group) gc[r.classification.category]++;
    const gOk = gc['OK_CATALOGO'] + gc['OK_MIXTO'];
    const gPct = Math.round((gOk / g) * 100);
    const gLat = Math.round(group.reduce((s, r) => s + r.latency_ms, 0) / g);

    const rowShade = gPct >= 70 ? 'E8F5E9' : gPct >= 40 ? 'FFF9C4' : 'FFEBEE';

    tableRows.push(
      new TableRow({
        children: [
          cell(oficio, rowShade),
          cell(String(g), rowShade),
          cell(String(gc['OK_CATALOGO']), rowShade),
          cell(String(gc['OK_MIXTO']), rowShade),
          cell(String(gc['SOLO_SUGERIDAS']), rowShade),
          cell(String(gc['VACIO']), rowShade),
          cell(String(gc['ERROR_TECNICO']), rowShade),
          cell(String(gc['PRECIO_INVALIDO']), rowShade),
          cell(`${gPct}%`, rowShade, true),
          cell(`${gLat}ms`, rowShade),
        ],
      }),
    );
  }

  // Total row
  tableRows.push(
    new TableRow({
      children: [
        cell('TOTAL', 'B0BEC5', true),
        cell(String(total), 'B0BEC5', true),
        cell(String(counts['OK_CATALOGO']), 'B0BEC5', true),
        cell(String(counts['OK_MIXTO']), 'B0BEC5', true),
        cell(String(counts['SOLO_SUGERIDAS']), 'B0BEC5', true),
        cell(String(counts['VACIO']), 'B0BEC5', true),
        cell(String(counts['ERROR_TECNICO']), 'B0BEC5', true),
        cell(String(counts['PRECIO_INVALIDO']), 'B0BEC5', true),
        cell(`${okPct}%`, 'B0BEC5', true),
        cell(`${avgLatency}ms`, 'B0BEC5', true),
      ],
    }),
  );

  // Top failures
  const topFailures = results
    .filter(r => ['VACIO', 'ERROR_TECNICO', 'PRECIO_INVALIDO'].includes(r.classification.category))
    .slice(0, 10)
    .map(
      r =>
        new Paragraph({
          children: [
            new TextRun({ text: `[${r.id}] ${r.oficio} — ${r.classification.category}: `, bold: true, size: 18 }),
            new TextRun({ text: r.texto.slice(0, 80), size: 18 }),
            r.classification.error_detalle
              ? new TextRun({ text: ` (${r.classification.error_detalle})`, color: 'CC0000', size: 18 })
              : new TextRun(''),
          ],
          spacing: { after: 60 },
        }),
    );

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            text: 'Informe Ejecutivo — Motor IA Voz-a-Presupuesto',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Fecha de ejecución: `, bold: true }),
              new TextRun(runDate),
              new TextRun({ text: `   |   Consultas totales: `, bold: true }),
              new TextRun(String(total)),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({ text: '1. Resumen Global', heading: HeadingLevel.HEADING_2 }),

          new Paragraph({
            children: [
              bold('Tasa de éxito (OK_CATALOGO + OK_MIXTO): '),
              new TextRun(`${ok} / ${total} (${okPct}%)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              bold('Tasa de error (VACÍO + ERROR_TECNICO + P.INV): '),
              new TextRun(`${errors} / ${total} (${errorPct}%)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              bold('Coincidencia de oficio detectado: '),
              new TextRun(`${coincide} / ${total} (${coincidePct}%)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              bold('Latencia media: '),
              new TextRun(`${avgLatency}ms   `),
              bold('P95: '),
              new TextRun(`${p95Latency}ms`),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [bold('Distribución por categoría:')],
            spacing: { after: 100 },
          }),
          ...CATEGORIES.map(
            cat =>
              new Paragraph({
                children: [
                  new TextRun({ text: `  • ${cat}: `, bold: true }),
                  new TextRun(`${counts[cat]} (${Math.round((counts[cat] / total) * 100)}%)`),
                ],
                spacing: { after: 60 },
              }),
          ),

          new Paragraph({ text: '', spacing: { after: 200 } }),
          new Paragraph({ text: '2. Resultados por Oficio', heading: HeadingLevel.HEADING_2 }),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: tableRows,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1 },
              bottom: { style: BorderStyle.SINGLE, size: 1 },
              left: { style: BorderStyle.SINGLE, size: 1 },
              right: { style: BorderStyle.SINGLE, size: 1 },
              insideH: { style: BorderStyle.SINGLE, size: 1 },
              insideV: { style: BorderStyle.SINGLE, size: 1 },
            },
          }),

          new Paragraph({ text: '', spacing: { after: 300 } }),
          new Paragraph({ text: '3. Principales Fallos', heading: HeadingLevel.HEADING_2 }),

          ...(topFailures.length > 0
            ? topFailures
            : [new Paragraph({ children: [new TextRun('Sin fallos registrados.')] })]),

          new Paragraph({ text: '', spacing: { after: 300 } }),
          new Paragraph({ text: '4. Criterios de Aceptación', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Tasa OK ≥ 70%: ', bold: true }),
              new TextRun(`${okPct >= 70 ? '✅ CUMPLE' : '❌ NO CUMPLE'} (${okPct}%)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Coincidencia oficio ≥ 80%: ', bold: true }),
              new TextRun(`${coincidePct >= 80 ? '✅ CUMPLE' : '❌ NO CUMPLE'} (${coincidePct}%)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Latencia media ≤ 10 000ms: ', bold: true }),
              new TextRun(`${avgLatency <= 10000 ? '✅ CUMPLE' : '❌ NO CUMPLE'} (${avgLatency}ms)`),
            ],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'ERROR_TECNICO ≤ 2%: ', bold: true }),
              new TextRun(
                `${Math.round((counts['ERROR_TECNICO'] / total) * 100) <= 2 ? '✅ CUMPLE' : '❌ NO CUMPLE'} (${Math.round((counts['ERROR_TECNICO'] / total) * 100)}%)`,
              ),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [new TextRun({ text: 'Generado por test-motor-ia — TrabFlow', color: '888888', size: 16 })],
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  writeFileSync(outputPath, buffer);
  console.log(`[word] Guardado: ${outputPath}`);
}
