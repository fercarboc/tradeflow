/**
 * Generación del PDF de documentos de control administrativo en transporte.
 *
 *  · DeCA de mercancías       — Orden FOM/2861/2012, art. 6
 *  · Hoja de ruta de viajeros — Orden FOM/1230/2013, art. 2
 *
 * Requisitos Resolución DGTCF 5-jun-2026 (BOE-A-2026-12784) cubiertos aquí:
 *  · PDF nativo (texto generado a partir de datos estructurados, no imagen).
 *  · Fecha/hora de creación y modificación como metadatos del PDF.
 *  · Código QR incrustado con la URL única del documento.
 *  · Tamaño muy inferior a 5 MB (solo fuentes estándar y vectores).
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import QRCode from 'npm:qrcode@1.5.4';

export type DocTipo = 'deca' | 'hoja_ruta';

export interface Parada { nombre: string; hora?: string | null }

export interface ControlDocData {
  tipo: DocTipo;
  numero: string;
  public_url: string;
  creado_en: Date;
  transportista_nombre: string;
  transportista_nif: string;
  transportista_domicilio?: string | null;
  cargador_nombre: string;
  cargador_nif?: string | null;
  cargador_domicilio?: string | null;
  origen: string;
  destino: string;
  paradas: Parada[];
  fecha_servicio: string;          // YYYY-MM-DD
  hora_salida?: string | null;     // HH:MM
  fecha_fin?: string | null;       // ISO
  naturaleza_mercancia?: string | null;
  peso_kg?: number | null;
  otra_magnitud?: string | null;
  autorizacion_especial?: string | null;
  matricula_vehiculo: string;
  matricula_remolque?: string | null;
  conductor_nombre?: string | null;
  conductor_nif?: string | null;
  naturaleza_servicio?: string | null;
  servicio_referencia?: string | null;
  observaciones?: string | null;
  sustituye_numero?: string | null;
  motivo_modificacion?: string | null;
}

export const NATURALEZA_SERVICIO_LABEL: Record<string, string> = {
  discrecional: 'Discrecional',
  refuerzo_regular: 'Discrecional - refuerzo de servicio regular de uso general',
  colaboracion_regular_especial: 'Discrecional - colaboración en transporte regular de uso especial',
  turistico: 'Turístico',
};

// ── Utilidades ────────────────────────────────────────────────────────

const INK   = rgb(0.11, 0.145, 0.208);   // #1C2535
const GREY  = rgb(0.42, 0.45, 0.50);
const LIGHT = rgb(0.95, 0.96, 0.97);
const GOLD  = rgb(0.784, 0.573, 0.165);  // #C8922A

/** Las fuentes estándar usan WinAnsi: sustituimos lo que no se puede codificar. */
export function winAnsiSafe(s: string): string {
  return s
    .replace(/[→⇒➜]/g, '>')
    .replace(/[“”«»]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/ /g, ' ')
    // Rango WinAnsi aproximado: ASCII imprimible + Latin-1 + € º ª
    .replace(/[^\x20-\x7E¡-ÿ€]/g, '');
}

function fmtFecha(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function fmtFechaHoraMadrid(d: Date): string {
  const f = new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  return f.format(d).replace(',', ' a las');
}

function fmtPeso(kg: number): string {
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(kg) + ' kg';
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/).map(winAnsiSafe)) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) { line = test; continue; }
      if (line) out.push(line);
      // palabra más larga que la línea: partir a la fuerza
      let rest = w;
      while (font.widthOfTextAtSize(rest, size) > maxWidth) {
        let i = rest.length;
        while (i > 1 && font.widthOfTextAtSize(rest.slice(0, i), size) > maxWidth) i--;
        out.push(rest.slice(0, i));
        rest = rest.slice(i);
      }
      line = rest;
    }
    out.push(line);
  }
  return out.length ? out : [''];
}

function drawQr(page: PDFPage, text: string, x: number, yTop: number, size: number) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n: number = qr.modules.size;
  const quiet = 2;
  const cell = size / (n + quiet * 2);
  page.drawRectangle({ x, y: yTop - size, width: size, height: size, color: rgb(1, 1, 1) });
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.modules.get(r, c)) {
        page.drawRectangle({
          x: x + (c + quiet) * cell,
          y: yTop - (r + quiet + 1) * cell,
          width: cell + 0.05, height: cell + 0.05,
          color: rgb(0, 0, 0),
        });
      }
    }
  }
}

// ── Construcción de las casillas ──────────────────────────────────────

interface Casilla { titulo: string; valor: string; ancho: 'medio' | 'completo' }

function casillas(d: ControlDocData): Casilla[] {
  const ruta = d.paradas.length
    ? d.paradas.map(p => p.hora ? `${p.nombre} (${p.hora})` : p.nombre).join(' > ')
    : '';

  if (d.tipo === 'deca') {
    const cargador = [d.cargador_nombre, d.cargador_nif ? `NIF: ${d.cargador_nif}` : '', d.cargador_domicilio ?? '']
      .filter(Boolean).join('\n');
    const transportista = [d.transportista_nombre, `NIF: ${d.transportista_nif}`, d.transportista_domicilio ?? '']
      .filter(Boolean).join('\n');
    const peso = d.peso_kg != null ? fmtPeso(Number(d.peso_kg)) : (d.otra_magnitud ?? '');
    const obs = [d.observaciones ?? '', ruta ? `Paradas: ${ruta}` : ''].filter(Boolean).join('\n');
    const list: Casilla[] = [
      { titulo: '1 · Cargador contractual', valor: cargador, ancho: 'medio' },
      { titulo: '2 · Transportista efectivo', valor: transportista, ancho: 'medio' },
      { titulo: '3 · Lugar de origen (carga)', valor: d.origen, ancho: 'medio' },
      { titulo: '4 · Lugar de destino (descarga)', valor: d.destino, ancho: 'medio' },
      { titulo: '5 · Naturaleza de la mercancía', valor: d.naturaleza_mercancia ?? '', ancho: 'medio' },
      { titulo: d.peso_kg != null ? '6 · Peso' : '6 · Cantidad (otra magnitud)', valor: peso, ancho: 'medio' },
      { titulo: '7 · Matrícula del vehículo', valor: d.matricula_vehiculo, ancho: 'medio' },
      { titulo: '8 · Remolque / semirremolque', valor: d.matricula_remolque ?? '-', ancho: 'medio' },
      { titulo: '9 · Fecha de realización del transporte', valor: fmtFecha(d.fecha_servicio) + (d.hora_salida ? `  ·  Salida ${d.hora_salida}` : ''), ancho: 'medio' },
      { titulo: '10 · Autorización especial de circulación', valor: d.autorizacion_especial || 'No requerida', ancho: 'medio' },
      { titulo: '11 · Observaciones', valor: obs || '-', ancho: 'completo' },
    ];
    return list;
  }

  // Hoja de ruta
  const contratante = [d.cargador_nombre, d.cargador_nif ? `NIF: ${d.cargador_nif}` : '']
    .filter(Boolean).join('\n');
  const empresa = [d.transportista_nombre, `NIF: ${d.transportista_nif}`, d.transportista_domicilio ?? '']
    .filter(Boolean).join('\n');
  let naturaleza = NATURALEZA_SERVICIO_LABEL[d.naturaleza_servicio ?? ''] ?? (d.naturaleza_servicio ?? '');
  if (d.servicio_referencia) naturaleza += `\nServicio: ${d.servicio_referencia}`;
  let fechas = `${fmtFecha(d.fecha_servicio)}${d.hora_salida ? `  ·  Salida ${d.hora_salida}` : ''}`;
  if (d.fecha_fin) {
    const fin = new Date(d.fecha_fin);
    fechas += `\nFin / regreso: ${fmtFechaHoraMadrid(fin)}`;
  }
  return [
    { titulo: '1 · Empresa transportista', valor: empresa, ancho: 'medio' },
    { titulo: '2 · Contratante del servicio', valor: contratante, ancho: 'medio' },
    { titulo: '3 · Origen', valor: d.origen, ancho: 'medio' },
    { titulo: '4 · Destino', valor: d.destino, ancho: 'medio' },
    { titulo: '5 · Paradas intermedias', valor: ruta || 'Sin paradas', ancho: 'completo' },
    { titulo: '6 · Fecha del servicio', valor: fechas, ancho: 'medio' },
    { titulo: '7 · Matrícula del autobús', valor: d.matricula_vehiculo, ancho: 'medio' },
    { titulo: '8 · Conductor', valor: `${d.conductor_nombre ?? ''}\nNIF: ${d.conductor_nif ?? ''}`, ancho: 'medio' },
    { titulo: '9 · Naturaleza del servicio', valor: naturaleza, ancho: 'medio' },
    { titulo: '10 · Observaciones', valor: d.observaciones || '-', ancho: 'completo' },
  ];
}

// ── API principal ─────────────────────────────────────────────────────

export async function buildControlDocPdf(d: ControlDocData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const titulo = d.tipo === 'deca' ? 'Documento de Control Administrativo (DeCA)' : 'Hoja de Ruta';
  pdf.setTitle(`${titulo} ${d.numero}`);
  pdf.setSubject(d.tipo === 'deca'
    ? 'Transporte público de mercancías por carretera - Orden FOM/2861/2012'
    : 'Transporte público de viajeros por carretera - Orden FOM/1230/2013');
  pdf.setAuthor(winAnsiSafe(`${d.transportista_nombre} (${d.transportista_nif})`));
  pdf.setCreator('TrabFlow');
  pdf.setProducer('TrabFlow - trabflow.com');
  pdf.setCreationDate(d.creado_en);
  pdf.setModificationDate(d.creado_en);
  pdf.setLanguage('es-ES');

  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 36;
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  const text = (s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    page.drawText(winAnsiSafe(s), { x, y: yy, size, font: f, color });

  // Cabecera
  const qrSize = 104;
  const headW = W - qrSize - 14;
  page.drawRectangle({ x: M, y: y - 4, width: 46, height: 3, color: GOLD });
  y -= 22;
  for (const l of wrap(titulo.toUpperCase(), bold, 17, headW)) { text(l, M, y, 17, bold); y -= 20; }
  const sub = d.tipo === 'deca'
    ? 'Transporte público de mercancías por carretera · Orden FOM/2861/2012'
    : 'Transporte público de viajeros por carretera · Orden FOM/1230/2013';
  for (const l of wrap(sub, font, 8.5, headW)) { text(l, M, y, 8.5, font, GREY); y -= 11; }
  y -= 8;
  text('Nº', M, y, 10, font, GREY); text(d.numero, M + 22, y, 11, bold); y -= 15;
  text('Fecha del transporte', M, y, 10, font, GREY);
  text(fmtFecha(d.fecha_servicio) + (d.hora_salida ? `   Salida ${d.hora_salida}` : ''), M + 112, y, 11, bold);
  y -= 15;

  const yQrTop = page.getHeight() - M - 4;
  drawQr(page, d.public_url, M + W - qrSize, yQrTop, qrSize);
  const urlLines = wrap(d.public_url, font, 5.6, qrSize);
  let uy = yQrTop - qrSize - 7;
  for (const l of urlLines) { text(l, M + W - qrSize, uy, 5.6, font, GREY); uy -= 7; }
  y = Math.min(y, uy) - 10;

  if (d.sustituye_numero) {
    const msg = `Este documento SUSTITUYE al Nº ${d.sustituye_numero}, cuyos datos dejan de ser válidos.` +
      (d.motivo_modificacion ? ` Motivo: ${d.motivo_modificacion}` : '');
    const lines = wrap(msg, bold, 9, W - 16);
    const h = lines.length * 12 + 10;
    page.drawRectangle({ x: M, y: y - h, width: W, height: h, color: rgb(1, 0.96, 0.88), borderColor: GOLD, borderWidth: 0.8 });
    let ly = y - 14;
    for (const l of lines) { text(l, M + 8, ly, 9, bold); ly -= 12; }
    y -= h + 10;
  }

  // Rejilla de casillas
  const list = casillas(d);
  const gap = 0;
  const pad = 7;
  const tSize = 7.2;
  const vSize = 10.5;
  let i = 0;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 1.2, color: INK });
  while (i < list.length) {
    const row: Casilla[] = list[i].ancho === 'completo' || list[i + 1]?.ancho === 'completo' || !list[i + 1]
      ? [list[i]]
      : [list[i], list[i + 1]];
    const colW = row.length === 2 ? W / 2 : W;
    const linesPer = row.map(c => wrap(c.valor, bold, vSize, colW - pad * 2));
    const h = Math.max(...linesPer.map(l => l.length)) * (vSize + 3) + 14 + pad * 2;
    row.forEach((c, k) => {
      const x = M + k * colW;
      page.drawRectangle({ x, y: y - 14, width: colW, height: 14, color: LIGHT });
      text(c.titulo.toUpperCase(), x + pad, y - 10, tSize, bold, GREY);
      let ly = y - 14 - pad - vSize + 2;
      for (const l of linesPer[k]) { text(l, x + pad, ly, vSize, bold); ly -= vSize + 3; }
      if (k === 1) page.drawLine({ start: { x, y }, end: { x, y: y - h }, thickness: 0.8, color: INK });
    });
    y -= h + gap;
    page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: INK });
    i += row.length;
  }

  // Pie
  y -= 16;
  text(`Emitido el ${fmtFechaHoraMadrid(d.creado_en)} (hora peninsular). Documento electrónico generado antes del inicio del servicio.`, M, y, 8, font, INK);
  y -= 11;
  const legal = d.tipo === 'deca'
    ? 'Ejemplares: cargador contractual y transportista efectivo (art. 8). Conservación mínima: 1 año (art. 9). Formato electrónico conforme a la Resolución de la DGTCF de 5 de junio de 2026 (BOE-A-2026-12784).'
    : 'Conservación por la empresa transportista: 1 año desde su realización (art. 1.2). Formato electrónico conforme a la Resolución de la DGTCF de 5 de junio de 2026 (BOE-A-2026-12784).';
  for (const l of wrap(legal, font, 7, W)) { text(l, M, y, 7, font, GREY); y -= 9; }

  text('Generado con TrabFlow · trabflow.com', M, M - 10, 7, font, GREY);

  return await pdf.save({ useObjectStreams: true });
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}
