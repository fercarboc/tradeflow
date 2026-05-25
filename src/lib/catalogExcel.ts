import * as XLSX from 'xlsx';
import type { TradeTarifa } from './supabase';

export type CatalogField = 'codigo' | 'familia' | 'descripcion' | 'precio_base' | 'unidad';

export interface ParsedCatalogRow {
  rowIndex: number;
  codigo: string;
  familia: string;
  descripcion: string;
  precio_base: number;
  unidad: string;
  errors: string[];
  isValid: boolean;
}

const FIELD_ALIASES: Record<CatalogField, string[]> = {
  codigo:      ['codigo', 'ref', 'referencia', 'sku', 'code', 'cod', 'cód'],
  familia:     ['familia', 'categoria', 'grupo', 'category', 'tipo', 'seccion', 'section'],
  descripcion: ['descripcion', 'producto', 'nombre', 'name', 'description', 'articulo', 'concepto', 'item'],
  precio_base: ['precio_base', 'precio', 'pvp', 'importe', 'coste', 'tarifa', 'price', 'base'],
  unidad:      ['unidad', 'ud', 'medida', 'unidades', 'unit', 'uds'],
};

function norm(s: unknown): string {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .replace(/[\s\-/]+/g, '_');
}

function parseDecimalES(s: unknown): number {
  if (typeof s === 'number') return s;
  const cleaned = String(s ?? '').trim().replace(/[^\d,.\-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? NaN : n;
}

export function detectColumns(headers: unknown[]): Partial<Record<CatalogField, number>> {
  const result: Partial<Record<CatalogField, number>> = {};
  headers.forEach((h, idx) => {
    const normalized = norm(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES) as [CatalogField, string[]][]) {
      if (result[field] !== undefined) continue;
      if (aliases.includes(normalized)) result[field] = idx;
    }
  });
  return result;
}

export async function parseExcelFile(file: File): Promise<ParsedCatalogRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' });

  if (rows.length < 2) return [];

  const headers = rows[0] as unknown[];
  const col = detectColumns(headers);

  if (col.descripcion === undefined && col.precio_base === undefined) {
    throw new Error(
      'No se detectaron columnas reconocibles. Verifica que la primera fila tiene encabezados como: codigo, familia, descripcion, precio_base, unidad.',
    );
  }

  return rows
    .slice(1)
    .map((row, i) => {
      const r = row as unknown[];
      const errors: string[] = [];

      const get = (f: CatalogField) => (col[f] !== undefined ? r[col[f]!] : '');

      const descripcion = String(get('descripcion') ?? '').trim();
      const codigo      = String(get('codigo')      ?? '').trim();
      const familia     = String(get('familia')     ?? '').trim() || 'General';
      const unidad      = String(get('unidad')      ?? '').trim() || 'ud';
      const precioRaw   = get('precio_base');
      const precio_base = parseDecimalES(precioRaw);

      if (!descripcion) errors.push('Descripción obligatoria');
      if (isNaN(precio_base)) errors.push(`Precio inválido: "${precioRaw}"`);
      if (!isNaN(precio_base) && precio_base < 0) errors.push('El precio no puede ser negativo');

      return {
        rowIndex: i + 2,
        codigo,
        familia,
        descripcion,
        precio_base: isNaN(precio_base) ? 0 : precio_base,
        unidad,
        errors,
        isValid: errors.length === 0,
      };
    })
    .filter(r => r.descripcion !== '' || r.codigo !== ''); // skip blank rows
}

export function generateExportWorkbook(items: TradeTarifa[]): XLSX.WorkBook {
  const headers = ['codigo', 'familia', 'descripcion', 'precio_base', 'unidad', 'activo'];
  const data: unknown[][] = [
    headers,
    ...items.map(t => [
      t.codigo ?? '',
      t.familia,
      t.descripcion,
      t.precio_base,
      t.unidad,
      t.activo ? 'SI' : 'NO',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 42 }, { wch: 13 }, { wch: 9 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Catálogo');
  return wb;
}

export function generateTemplateWorkbook(): XLSX.WorkBook {
  const data: unknown[][] = [
    ['codigo', 'familia', 'descripcion', 'precio_base', 'unidad'],
    ['TUBO-16',   'Fontanería',    'Tubo multicapa 16mm',      1.25, 'ml'],
    ['MO-01',     'Mano de obra',  'Hora técnico fontanero',  35,    'h'],
    ['TERMO-80',  'Equipos',       'Termo eléctrico 80L',     180,   'ud'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 42 }, { wch: 13 }, { wch: 9 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Plantilla');
  return wb;
}

export function downloadWorkbook(wb: XLSX.WorkBook, filename: string): void {
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
