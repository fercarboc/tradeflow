import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  CatalogImport, ImportItemRow, ChunkResult,
  IMPORT_ESTADO_LABELS, IMPORT_ESTADO_COLORS,
  createCatalogImport, upsertCatalogChunk, finalizeCatalogImport,
  failCatalogImport, getCatalogImports, getCatalogImport,
} from '../../lib/api/marketplace-portal';

// ── Constantes ────────────────────────────────────────────────────────────────

const CHUNK_SIZE     = 500;
const PARSER_VERSION = '1';
const POLL_INTERVAL  = 2000;
const POLL_TIMEOUT   = 30000;
const SKIP_COLS      = '' as const;

const STEP_TITLES = [
  'Seleccionar archivo',
  'Mapeo de columnas',
  'Vista previa',
  'Validación',
  'Importación',
  'Análisis IA',
  'Resultado',
];

interface FieldDef {
  key:      string;
  label:    string;
  required: boolean;
  hint:     string;
}

const FIELD_DEFS: FieldDef[] = [
  { key: 'supplier_ref',          label: 'Referencia (SKU)',     required: true,  hint: 'Código único del producto. Obligatorio.' },
  { key: 'descripcion_comercial', label: 'Descripción',          required: true,  hint: 'Nombre comercial del producto. Obligatorio.' },
  { key: 'precio_coste',          label: 'Precio de coste',      required: false, hint: 'Precio neto / coste. Número decimal.' },
  { key: 'precio_venta',          label: 'Precio de venta (PVP)', required: false, hint: 'Precio tarifa. Número decimal.' },
  { key: 'unidad',                label: 'Unidad de medida',     required: false, hint: 'ud, cj, kg, m²... Por defecto: ud.' },
  { key: 'stock_disponible',      label: 'Stock disponible',     required: false, hint: 'SI/NO, 1/0, true/false. Por defecto: sí.' },
  { key: 'stock_cantidad',        label: 'Cantidad en stock',    required: false, hint: 'Número entero de unidades.' },
  { key: 'plazo_entrega_dias',    label: 'Plazo entrega (días)', required: false, hint: 'Número entero de días. Por defecto: 5.' },
];

const FIELD_PATTERNS: Record<string, string[]> = {
  supplier_ref:          ['ref', 'referencia', 'codigo', 'cod', 'sku', 'codart', 'articulo', 'art', 'id', 'clave'],
  descripcion_comercial: ['descripcion', 'nombre', 'producto', 'desc', 'denominacion', 'articulo', 'detalle'],
  precio_coste:          ['coste', 'costoneto', 'preciocosto', 'preciocoste', 'neto', 'precioneto', 'netoprecio'],
  precio_venta:          ['pvp', 'precioventa', 'venta', 'precio', 'tarifa', 'preciodecatalogo'],
  unidad:                ['unidad', 'um', 'udmedida', 'tipoum', 'uom'],
  stock_disponible:      ['disponible', 'stockdisponible', 'activo', 'enstock'],
  stock_cantidad:        ['cantidad', 'existencias', 'qty', 'stockcantidad', 'stkdisponible', 'unidadesstock'],
  plazo_entrega_dias:    ['plazo', 'plazoentreg', 'leadtime', 'diasentrega', 'tipoentrega'],
};

// ── Tipos internos ────────────────────────────────────────────────────────────

interface ParsedFile {
  headers:  string[];
  rows:     string[][];
  hash:     string;
  nombre:   string;
  isXLSX:   boolean;
  encoding?:  'utf-8' | 'windows-1252';
  fffdCount?: number;
}

type ColumnMapping = Record<string, string>;

interface ValidationError {
  fila:   number;
  campo:  string;
  motivo: string;
}

// ── Utilidades puras ──────────────────────────────────────────────────────────

async function computeHash(input: string | ArrayBuffer): Promise<string> {
  const data = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function computeChunkHash(items: ImportItemRow[]): Promise<string> {
  return computeHash(JSON.stringify(items));
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const used = new Set<string>();
  const normalized = headers.map(normalizeHeader);

  FIELD_DEFS.forEach(({ key }) => {
    const patterns = FIELD_PATTERNS[key] ?? [];
    for (const pat of patterns) {
      const idx = normalized.findIndex(n => n.includes(pat) && !used.has(headers[normalized.indexOf(n)]));
      if (idx !== -1) {
        const col = headers[idx];
        if (!used.has(col)) {
          mapping[key] = col;
          used.add(col);
          break;
        }
      }
    }
  });
  return mapping;
}

function detectSeparator(sample: string): string {
  const counts: Record<string, number> = {
    ',': (sample.match(/,/g) ?? []).length,
    ';': (sample.match(/;/g) ?? []).length,
    '\t': (sample.match(/\t/g) ?? []).length,
  };
  return Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a)[0];
}

function parseCSVLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let curr = '';
  let inQ  = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { curr += '"'; i++; } else { inQ = !inQ; } }
    else if (ch === sep && !inQ) { result.push(curr.trim()); curr = ''; }
    else { curr += ch; }
  }
  result.push(curr.trim());
  return result;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };
  const sep     = detectSeparator(lines[0]);
  const headers = parseCSVLine(lines[0], sep);
  const rows    = lines.slice(1).map(l => parseCSVLine(l, sep));
  return { headers, rows };
}

// A0: Intenta UTF-8 estricto; si falla, usa Windows-1252. Detecta U+FFFD residuales.
async function decodeCSVFile(file: File): Promise<{
  text:              string;
  encoding:          'utf-8' | 'windows-1252';
  fffdCount:         number;
  needsConfirmation: boolean;
}> {
  const buf   = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  try {
    const text      = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    const fffdCount = (text.match(/�/g) ?? []).length;
    return { text, encoding: 'utf-8', fffdCount, needsConfirmation: fffdCount > 0 };
  } catch {
    // Bytes inválidos en UTF-8 → el archivo es Windows-1252/Latin-1
    const text      = new TextDecoder('windows-1252').decode(bytes);
    const fffdCount = (text.match(/�/g) ?? []).length;
    return { text, encoding: 'windows-1252', fffdCount, needsConfirmation: true };
  }
}

async function parseFileContent(file: File): Promise<{
  headers: string[]; rows: string[][];
  encoding?: 'utf-8' | 'windows-1252'; fffdCount?: number; needsConfirmation?: boolean;
}> {
  const isXLSX = /\.(xlsx|xls)$/i.test(file.name);
  if (isXLSX) {
    const buf  = await file.arrayBuffer();
    const wb   = XLSX.read(new Uint8Array(buf), { type: 'array', raw: false });
    const ws   = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: false });
    const headers = (data[0] ?? []).map(String);
    const rows    = data.slice(1).map((r: string[]) => r.map(String));
    return { headers, rows };
  }
  const { text, encoding, fffdCount, needsConfirmation } = await decodeCSVFile(file);
  return { ...parseCSV(text), encoding, fffdCount, needsConfirmation };
}

function getColValue(row: string[], headers: string[], col: string): string {
  if (!col || col === SKIP_COLS) return '';
  const idx = headers.indexOf(col);
  return idx >= 0 ? (row[idx] ?? '').trim() : '';
}

function parseNum(v: string): number | null {
  if (!v) return null;
  const n = parseFloat(v.replace(',', '.'));
  return isNaN(n) ? null : n;
}

function parseBool(v: string): boolean | undefined {
  if (!v) return undefined;
  return ['si', 'sí', 'true', '1', 'yes', 'verdadero', 's'].includes(v.toLowerCase()) ? true
    : ['no', 'false', '0', 'n', 'falso'].includes(v.toLowerCase()) ? false
    : undefined;
}

function parseInt10(v: string): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function applyMapping(row: string[], headers: string[], mapping: ColumnMapping, rowIndex: number): ImportItemRow {
  const g = (key: string) => getColValue(row, headers, mapping[key] ?? '');
  return {
    supplier_ref:          g('supplier_ref'),
    descripcion_comercial: g('descripcion_comercial'),
    precio_coste:          parseNum(g('precio_coste')),
    precio_venta:          parseNum(g('precio_venta')),
    unidad:                g('unidad') || undefined,
    stock_disponible:      parseBool(g('stock_disponible')),
    stock_cantidad:        parseInt10(g('stock_cantidad')),
    plazo_entrega_dias:    parseInt10(g('plazo_entrega_dias')),
    fila_original:         rowIndex + 2,
  };
}

function validateAllRows(
  rows: string[][], headers: string[], mapping: ColumnMapping,
): { validRows: ImportItemRow[]; errors: ValidationError[] } {
  const validRows: ImportItemRow[] = [];
  const errors: ValidationError[]  = [];

  rows.forEach((row, idx) => {
    const item = applyMapping(row, headers, mapping, idx);
    const rowErrors: string[] = [];
    if (!item.supplier_ref)          rowErrors.push('Referencia vacía');
    if (!item.descripcion_comercial) rowErrors.push('Descripción vacía');
    if (item.supplier_ref?.includes('�'))          rowErrors.push('Referencia con carácter de reemplazo (codificación inválida)');
    if (item.descripcion_comercial?.includes('�')) rowErrors.push('Descripción con carácter de reemplazo (codificación inválida)');

    if (rowErrors.length > 0) {
      rowErrors.forEach(motivo => errors.push({ fila: idx + 2, campo: motivo.split(' ')[0], motivo }));
    } else {
      validRows.push(item);
    }
  });

  return { validRows, errors };
}

function buildErrorCSV(errors: ValidationError[]): string {
  const header = 'Fila,Campo,Motivo\n';
  const rows   = errors.map(e => `${e.fila},"${e.campo}","${e.motivo}"`).join('\n');
  return header + rows;
}

// ── Paso 1: Seleccionar archivo ────────────────────────────────────────────────

interface Step1Props {
  pendingImports: CatalogImport[];
  onFileParsed:   (pf: ParsedFile, resumeTarget: CatalogImport | null) => void;
  onClose:        () => void;
}

function WizardStep1({ pendingImports, onFileParsed, onClose }: Step1Props) {
  const [dragging, setDragging]   = useState(false);
  const [loading,  setLoading]    = useState(false);
  const [error,    setError]      = useState<string | null>(null);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const [encodingPending, setEncodingPending] = useState<{
    pf: ParsedFile; match: CatalogImport | null;
  } | null>(null);

  const processFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const isXLSX  = /\.(xlsx|xls)$/i.test(file.name);
      const isCsv   = /\.csv$/i.test(file.name);
      if (!isXLSX && !isCsv) { setError('Formatos admitidos: CSV, XLSX, XLS.'); return; }

      const [hash, parsed] = await Promise.all([
        computeHash(await file.arrayBuffer()),
        parseFileContent(file),
      ]);

      if (parsed.headers.length === 0) { setError('El archivo está vacío o no tiene cabecera.'); return; }
      if (parsed.rows.length === 0)    { setError('El archivo no contiene filas de datos.'); return; }

      const pf: ParsedFile = {
        headers: parsed.headers, rows: parsed.rows, hash, nombre: file.name, isXLSX,
        encoding: parsed.encoding, fffdCount: parsed.fffdCount,
      };

      const match = pendingImports.find(imp =>
        imp.estado === 'procesando_importacion' && imp.archivo_hash === hash,
      );

      // A0: Si hay problema de codificación, pedir confirmación antes de continuar
      if (!isXLSX && parsed.needsConfirmation) {
        setEncodingPending({ pf, match: match ?? null });
        return;
      }

      onFileParsed(pf, match ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al leer el archivo.');
    } finally {
      setLoading(false);
    }
  }, [pendingImports, onFileParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const pendingActive = pendingImports.filter(i =>
    i.estado === 'procesando_importacion' || i.estado === 'pendiente_finalizacion',
  );

  return (
    <div className="space-y-6">
      {pendingActive.length > 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-4">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-2">
            Importaciones en curso
          </p>
          <div className="space-y-2">
            {pendingActive.map(imp => (
              <div key={imp.id} className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{imp.nombre_archivo}</p>
                  <p className="text-xs text-slate-400">
                    {imp.chunks_recibidos}/{imp.chunks_esperados} bloques · {imp.filas_ok.toLocaleString('es-ES')} filas
                  </p>
                </div>
                <span className={`shrink-0 ml-3 rounded-full px-2 py-0.5 text-xs font-medium ${IMPORT_ESTADO_COLORS[imp.estado]}`}>
                  {IMPORT_ESTADO_LABELS[imp.estado]}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
            Selecciona el mismo archivo para reanudar, o uno nuevo para iniciar una importación fresca.
          </p>
        </div>
      )}

      {encodingPending ? (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Codificación no estándar detectada
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                <span className="font-medium">{encodingPending.pf.nombre}</span> usa{' '}
                <code className="font-mono text-xs bg-amber-100 dark:bg-amber-900/40 px-1 rounded">
                  {encodingPending.pf.encoding === 'windows-1252' ? 'Windows-1252 (Latin-1)' : 'UTF-8 con U+FFFD'}
                </code>.{' '}
                {encodingPending.pf.encoding === 'windows-1252' ? (
                  <>
                    TrabFlow ha convertido el archivo a UTF-8 automáticamente.
                    {(encodingPending.pf.fffdCount ?? 0) > 0 && (
                      <> <span className="font-medium">{encodingPending.pf.fffdCount} caracteres</span> no tienen equivalente y aparecerán como ▒.</>
                    )}
                  </>
                ) : (
                  <>
                    El archivo contiene <span className="font-medium">{encodingPending.pf.fffdCount} caracteres de reemplazo</span>. Puede haber datos corruptos.
                  </>
                )}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                {encodingPending.pf.rows.length.toLocaleString('es-ES')} filas detectadas · Revisa la vista previa en el paso siguiente antes de confirmar.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={() => setEncodingPending(null)}
              className="rounded-lg border border-amber-300 dark:border-amber-600 px-4 py-2 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                const { pf, match } = encodingPending;
                setEncodingPending(null);
                onFileParsed(pf, match);
              }}
              className="rounded-lg bg-amber-500 hover:bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              Continuar con conversión →
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer transition-colors ${
            dragging
              ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/10'
              : 'border-slate-200 dark:border-slate-700 hover:border-teal-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
          }`}
        >
          {loading ? (
            <>
              <svg className="h-8 w-8 animate-spin text-teal-500 mb-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-slate-500">Procesando archivo…</p>
            </>
          ) : (
            <>
              <svg className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Arrastra aquí tu archivo o <span className="text-teal-500">haz clic para seleccionar</span>
              </p>
              <p className="text-xs text-slate-400 mt-1">CSV, XLSX o XLS. Sin límite de filas.</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
          />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Plantilla recomendada</p>
        <p className="text-xs text-slate-500 mb-2">Columnas esperadas (adaptables en el paso siguiente):</p>
        <div className="flex flex-wrap gap-1.5">
          {['Referencia *', 'Descripción *', 'Precio coste', 'Precio venta', 'Unidad', 'Stock', 'Cantidad stock', 'Plazo días'].map(col => (
            <span key={col} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${col.endsWith('*') ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
              {col}
            </span>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ── Paso 2: Mapeo de columnas ─────────────────────────────────────────────────

interface Step2Props {
  parsedFile:  ParsedFile;
  mapping:     ColumnMapping;
  onMappingChange: (m: ColumnMapping) => void;
  onBack:      () => void;
  onNext:      () => void;
}

function WizardStep2({ parsedFile, mapping, onMappingChange, onBack, onNext }: Step2Props) {
  const colOptions = [{ value: '', label: '— No incluir —' }, ...parsedFile.headers.map(h => ({ value: h, label: h }))];
  const requiredOk = mapping['supplier_ref'] && mapping['descripcion_comercial'];

  const update = (key: string, val: string) => onMappingChange({ ...mapping, [key]: val });

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-48">Campo TrabFlow</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Columna del archivo</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Ayuda</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {FIELD_DEFS.map(({ key, label, required, hint }) => (
              <tr key={key} className="bg-white dark:bg-slate-900">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                    {required && <span className="text-xs bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 rounded-full px-1.5 py-0.5">Req.</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={mapping[key] ?? ''}
                    onChange={(e) => update(key, e.target.value)}
                    className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 dark:bg-slate-800 ${
                      required && !mapping[key]
                        ? 'border-red-300 dark:border-red-700 text-red-600 dark:text-red-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {colOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400 hidden md:table-cell">{hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!requiredOk && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">
            Debes mapear los campos obligatorios: Referencia y Descripción.
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors">
          ← Atrás
        </button>
        <button
          onClick={onNext}
          disabled={!requiredOk}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Ver vista previa →
        </button>
      </div>
    </div>
  );
}

// ── Paso 3: Vista previa ──────────────────────────────────────────────────────

interface Step3Props {
  parsedFile: ParsedFile;
  mapping:    ColumnMapping;
  onBack:     () => void;
  onNext:     () => void;
}

function WizardStep3({ parsedFile, mapping, onBack, onNext }: Step3Props) {
  const preview = parsedFile.rows.slice(0, 10).map((row, idx) => applyMapping(row, parsedFile.headers, mapping, idx));
  const activeFields = FIELD_DEFS.filter(f => mapping[f.key]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Primeras {preview.length} de {parsedFile.rows.length.toLocaleString('es-ES')} filas
        </p>
        <span className="text-xs text-slate-400">{parsedFile.nombre}</span>
      </div>

      <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800">
              <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 w-12">Fila</th>
              {activeFields.map(f => (
                <th key={f.key} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 whitespace-nowrap">
                  {f.label}
                  {f.required && <span className="text-teal-500 ml-0.5">*</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {preview.map((row, i) => {
              const missingRef  = !row.supplier_ref;
              const missingDesc = !row.descripcion_comercial;
              const hasError    = missingRef || missingDesc;
              return (
                <tr key={i} className={hasError ? 'bg-red-50 dark:bg-red-900/10' : 'bg-white dark:bg-slate-900'}>
                  <td className="px-3 py-2 text-slate-400 tabular-nums">{row.fila_original}</td>
                  {activeFields.map(f => {
                    const val = (row as unknown as Record<string, unknown>)[f.key];
                    const isEmpty = val === null || val === undefined || val === '';
                    return (
                      <td key={f.key} className={`px-3 py-2 max-w-[180px] truncate ${f.required && isEmpty ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                        {isEmpty ? <span className="italic text-slate-300 dark:text-slate-600">vacío</span> : String(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors">
          ← Ajustar mapeo
        </button>
        <button
          onClick={onNext}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
        >
          Validar todas las filas →
        </button>
      </div>
    </div>
  );
}

// ── Paso 4: Validación ────────────────────────────────────────────────────────

interface Step4Props {
  parsedFile:        ParsedFile;
  mapping:           ColumnMapping;
  validRows:         ImportItemRow[];
  validationErrors:  ValidationError[];
  onBack:            () => void;
  onNext:            () => void;
}

function WizardStep4({ parsedFile, mapping, validRows, validationErrors, onBack, onNext }: Step4Props) {
  const totalRows = parsedFile.rows.length;
  const pctOk     = totalRows > 0 ? Math.round((validRows.length / totalRows) * 100) : 0;

  const downloadErrors = () => {
    const csv  = buildErrorCSV(validationErrors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'errores_importacion.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center">
          <p className="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">{totalRows.toLocaleString('es-ES')}</p>
          <p className="text-xs text-slate-400 mt-1">Filas totales</p>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{validRows.length.toLocaleString('es-ES')}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Válidas ({pctOk}%)</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${validationErrors.length > 0 ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}>
          <p className={`text-2xl font-bold tabular-nums ${validationErrors.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>
            {validationErrors.length.toLocaleString('es-ES')}
          </p>
          <p className={`text-xs mt-1 ${validationErrors.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Con errores</p>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Primeros {Math.min(validationErrors.length, 20)} errores
            </p>
            <button onClick={downloadErrors} className="text-xs text-teal-500 hover:text-teal-400 underline">
              Descargar CSV completo
            </button>
          </div>
          <div className="overflow-auto max-h-48 rounded-xl border border-red-200 dark:border-red-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-red-50 dark:bg-red-900/10">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 w-20">Fila</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 w-32">Campo</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-100 dark:divide-red-900">
                {validationErrors.slice(0, 20).map((e, i) => (
                  <tr key={i} className="bg-white dark:bg-slate-900">
                    <td className="px-3 py-1.5 text-red-500 tabular-nums">{e.fila}</td>
                    <td className="px-3 py-1.5 text-slate-500">{e.campo}</td>
                    <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400">{e.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {validRows.length > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Las filas con error serán omitidas. Se importarán las {validRows.length.toLocaleString('es-ES')} filas válidas.
            </p>
          )}
        </div>
      )}

      {validRows.length === 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400 font-medium">
            No hay filas válidas para importar. Revisa el mapeo de columnas.
          </p>
        </div>
      )}

      <div className="flex justify-between">
        <button onClick={onBack} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors">
          ← Revisar mapeo
        </button>
        <button
          onClick={onNext}
          disabled={validRows.length === 0}
          className="rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Importar {validRows.length.toLocaleString('es-ES')} filas →
        </button>
      </div>
    </div>
  );
}

// ── Paso 5: Importación ────────────────────────────────────────────────────────

interface Step5Props {
  actorId:              string;
  parsedFile:           ParsedFile;
  mapping:              ColumnMapping;
  validRows:            ImportItemRow[];
  resumeImport:         CatalogImport | null;
  onComplete:           (importId: string) => void;
  onAborted:            () => void;
}

function WizardStep5({ actorId, parsedFile, mapping, validRows, resumeImport, onComplete, onAborted }: Step5Props) {
  const [importId,    setImportId]    = useState<string | null>(resumeImport?.id ?? null);
  const [chunksTotal, setChunksTotal] = useState(0);
  const [chunksDone,  setChunksDone]  = useState(resumeImport?.chunks_recibidos ?? 0);
  const [filasOk,     setFilasOk]     = useState(resumeImport?.filas_ok ?? 0);
  const [filasErr,    setFilasErr]    = useState(resumeImport?.filas_error ?? 0);
  const [importError, setImportError] = useState<string | null>(null);
  const abortRef                      = useRef(false);

  useEffect(() => {
    abortRef.current = false;
    let currentImportId = importId;

    async function run() {
      const startChunk = resumeImport ? resumeImport.chunks_recibidos : 0;
      const total      = Math.ceil(validRows.length / CHUNK_SIZE);
      setChunksTotal(total);

      if (!currentImportId) {
        try {
          const id = await createCatalogImport({
            actorId:         actorId,
            nombreArchivo:   parsedFile.nombre,
            archivoHash:     parsedFile.hash,
            totalFilas:      validRows.length,
            chunkSize:       CHUNK_SIZE,
            chunksEsperados: total,
            mappingConfig:   mapping as Record<string, string>,
            parserVersion:   PARSER_VERSION,
          });
          currentImportId = id;
          setImportId(id);
        } catch (e) {
          setImportError(e instanceof Error ? e.message : 'Error al crear el registro de importación.');
          return;
        }
      }

      for (let i = startChunk; i < total; i++) {
        if (abortRef.current) break;

        const chunk = validRows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        try {
          const hash   = await computeChunkHash(chunk);
          const result: ChunkResult = await upsertCatalogChunk({
            actorId:    actorId,
            importId:   currentImportId,
            chunkIndex: i,
            chunkHash:  hash,
            archivoHash: parsedFile.hash,
            items:      chunk,
          });
          setChunksDone(i + 1);
          setFilasOk(prev => prev + result.ok);
          setFilasErr(prev => prev + result.errores);
        } catch (e) {
          const motivo = e instanceof Error ? e.message : 'Error desconocido';
          setImportError(motivo);
          try { await failCatalogImport(currentImportId, actorId, motivo); } catch { /* best-effort */ }
          return;
        }
      }

      if (!abortRef.current && currentImportId) {
        try {
          await finalizeCatalogImport(currentImportId, actorId);
          onComplete(currentImportId);
        } catch (e) {
          setImportError(e instanceof Error ? e.message : 'Error al finalizar la importación.');
        }
      }
    }

    run();
    return () => { abortRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = chunksTotal > 0 ? Math.round((chunksDone / chunksTotal) * 100) : 0;

  if (importError) {
    return (
      <div className="space-y-6 text-center py-8">
        <div className="inline-flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20 p-4">
          <svg className="h-8 w-8 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-red-600 dark:text-red-400 mb-1">Error en la importación</p>
          <p className="text-sm text-slate-500 max-w-md mx-auto">{importError}</p>
        </div>
        <p className="text-xs text-slate-400">
          Las filas ya importadas ({filasOk.toLocaleString('es-ES')}) han quedado guardadas. Puedes reanudar desde el historial.
        </p>
        <button onClick={onAborted} className="rounded-lg border border-slate-200 dark:border-slate-700 px-5 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors">
          Cerrar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4">
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Importando <span className="font-mono">{parsedFile.nombre}</span>
        </p>
        <p className="text-xs text-slate-400">No cierres el navegador. Puedes minimizarlo.</p>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Bloque {Math.min(chunksDone + 1, chunksTotal)} de {chunksTotal}</span>
          <span className="tabular-nums font-medium text-teal-500">{pct}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{filasOk.toLocaleString('es-ES')}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Importadas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${filasErr > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
          <p className={`text-2xl font-bold tabular-nums ${filasErr > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{filasErr.toLocaleString('es-ES')}</p>
          <p className={`text-xs mt-1 ${filasErr > 0 ? 'text-red-500' : 'text-slate-400'}`}>Rechazadas</p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-slate-400">
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs">Procesando…</span>
      </div>
    </div>
  );
}

// ── Paso 6: Análisis IA ────────────────────────────────────────────────────────

interface Step6Props {
  importId:   string;
  onComplete: (imp: CatalogImport) => void;
  onSkip:     (imp: CatalogImport) => void;
}

function WizardStep6({ importId, onComplete, onSkip }: Step6Props) {
  const [message,  setMessage]  = useState('Esperando análisis IA…');
  const [timedOut, setTimedOut] = useState(false);
  const [imp,      setImp]      = useState<CatalogImport | null>(null);
  const startRef                = useRef(Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const current = await getCatalogImport(importId);
        if (!current) return;
        setImp(current);

        if (current.estado === 'completado') { onComplete(current); return; }
        if (current.estado === 'error')      { onSkip(current); return; }
        if (current.estado === 'matching_procesando') setMessage('Analizando referencias con IA…');
        if (current.estado === 'matching_pendiente')  setMessage('En cola de análisis IA…');

        if (Date.now() - startRef.current > POLL_TIMEOUT) {
          setTimedOut(true);
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL);
      } catch { /* retry */ timer = setTimeout(poll, POLL_INTERVAL * 2); }
    }

    poll();
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importId]);

  return (
    <div className="py-8 text-center space-y-6">
      {!timedOut ? (
        <>
          <div className="inline-flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/20 p-5">
            <svg className="h-10 w-10 animate-spin text-purple-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-slate-800 dark:text-slate-200">{message}</p>
            <p className="text-sm text-slate-400 mt-1">El motor IA está vinculando tus referencias al catálogo TrabFlow.</p>
          </div>
        </>
      ) : (
        <>
          <div className="inline-flex items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/20 p-5">
            <svg className="h-10 w-10 text-teal-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-medium text-slate-800 dark:text-slate-200">Importación completada</p>
            <p className="text-sm text-slate-400 mt-1">El análisis IA continúa en segundo plano. Puedes ver el avance en el catálogo.</p>
          </div>
          <button
            onClick={() => imp && onSkip(imp)}
            className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            Ver catálogo →
          </button>
        </>
      )}
    </div>
  );
}

// ── Paso 7: Resultado ──────────────────────────────────────────────────────────

interface Step7Props {
  imp:              CatalogImport;
  validationErrors: ValidationError[];
  onClose:          () => void;
}

function WizardStep7({ imp, validationErrors, onClose }: Step7Props) {
  const downloadErrors = () => {
    if (validationErrors.length === 0) return;
    const csv  = buildErrorCSV(validationErrors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'errores_importacion.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  const pendingMatch = imp.filas_ok > 0 && imp.estado !== 'completado';

  return (
    <div className="space-y-6 py-4">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/20 p-4">
          <svg className="h-8 w-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Importación finalizada</h3>
        <p className="text-sm text-slate-400">{imp.nombre_archivo}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-4 text-center">
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{imp.filas_ok.toLocaleString('es-ES')}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Importadas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${imp.filas_error > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
          <p className={`text-2xl font-bold tabular-nums ${imp.filas_error > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>{imp.filas_error.toLocaleString('es-ES')}</p>
          <p className={`text-xs mt-1 ${imp.filas_error > 0 ? 'text-red-500' : 'text-slate-400'}`}>Rechazadas</p>
        </div>
        <div className={`rounded-xl border p-4 text-center ${pendingMatch ? 'bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800'}`}>
          <p className={`text-2xl font-bold tabular-nums ${pendingMatch ? 'text-purple-600 dark:text-purple-400' : 'text-slate-400'}`}>
            {pendingMatch ? imp.filas_ok.toLocaleString('es-ES') : '—'}
          </p>
          <p className={`text-xs mt-1 ${pendingMatch ? 'text-purple-500' : 'text-slate-400'}`}>
            {imp.estado === 'completado' ? 'IA procesada' : 'Análisis IA pendiente'}
          </p>
        </div>
      </div>

      {(imp.filas_error > 0 || validationErrors.length > 0) && (
        <button
          onClick={downloadErrors}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-500 transition-colors"
        >
          Descargar informe de errores (CSV)
        </button>
      )}

      {pendingMatch && (
        <div className="rounded-xl bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 px-4 py-3">
          <p className="text-sm text-purple-700 dark:text-purple-300">
            El motor IA está analizando tus referencias en segundo plano. Aparecerán vinculadas en el catálogo en los próximos minutos.
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
      >
        Ir al catálogo
      </button>
    </div>
  );
}

// ── Wizard principal ──────────────────────────────────────────────────────────

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
  onClose:    () => void;
  onComplete: () => void;
}

export default function PortalImportacion({ actorId, membership, onClose, onComplete }: Props) {
  const canWrite = membership.permissions.includes('offerings:write');

  const [step,             setStep]             = useState<number>(1);
  const [pendingImports,   setPendingImports]   = useState<CatalogImport[]>([]);
  const [parsedFile,       setParsedFile]       = useState<ParsedFile | null>(null);
  const [resumeImport,     setResumeImport]     = useState<CatalogImport | null>(null);
  const [mapping,          setMapping]          = useState<ColumnMapping>({});
  const [validRows,        setValidRows]        = useState<ImportItemRow[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [importId,         setImportId]         = useState<string | null>(null);
  const [completedImport,  setCompletedImport]  = useState<CatalogImport | null>(null);
  const [showCloseWarn,    setShowCloseWarn]    = useState(false);

  useEffect(() => {
    getCatalogImports(actorId, 5).then(setPendingImports).catch(() => {});
  }, [actorId]);

  const handleFileParsed = useCallback((pf: ParsedFile, resume: CatalogImport | null) => {
    setParsedFile(pf);
    setResumeImport(resume);
    if (resume) {
      const savedMapping = resume.mapping_config as ColumnMapping;
      setMapping(Object.keys(savedMapping).length > 0 ? savedMapping : autoDetectMapping(pf.headers));
    } else {
      setMapping(autoDetectMapping(pf.headers));
    }
    setStep(resume ? 5 : 2);
  }, []);

  const handleStep3ToStep4 = useCallback(() => {
    if (!parsedFile) return;
    const { validRows: vr, errors } = validateAllRows(parsedFile.rows, parsedFile.headers, mapping);
    setValidRows(vr);
    setValidationErrors(errors);
    setStep(4);
  }, [parsedFile, mapping]);

  const handleImportComplete = useCallback((id: string) => {
    setImportId(id);
    setStep(6);
  }, []);

  const handleMatchingComplete = useCallback((imp: CatalogImport) => {
    setCompletedImport(imp);
    setStep(7);
  }, []);

  const handleClose = useCallback(() => {
    if (step === 5) { setShowCloseWarn(true); return; }
    onClose();
  }, [step, onClose]);

  const confirmClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleFinalClose = useCallback(() => {
    onComplete();
    onClose();
  }, [onComplete, onClose]);

  if (!canWrite) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-8 text-center">
          <p className="text-sm text-slate-500 mb-4">No tienes permiso para importar catálogos.</p>
          <button onClick={onClose} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400">Cerrar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      {showCloseWarn && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">¿Salir durante la importación?</p>
            <p className="text-xs text-slate-500">La importación se detendrá. Las filas ya importadas se conservarán y podrás reanudar desde el historial con el mismo archivo.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setShowCloseWarn(false)} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:border-slate-300 transition-colors">
                Seguir importando
              </button>
              <button onClick={confirmClose} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition-colors">
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              {STEP_TITLES.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors ${
                    i + 1 === step ? 'bg-teal-500' : i + 1 < step ? 'bg-teal-300 dark:bg-teal-700' : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400">Paso {step} de {STEP_TITLES.length}</p>
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{STEP_TITLES[step - 1]}</h2>
          </div>
          {step !== 5 && (
            <button
              onClick={handleClose}
              className="ml-4 shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === 1 && (
            <WizardStep1
              pendingImports={pendingImports}
              onFileParsed={handleFileParsed}
              onClose={onClose}
            />
          )}
          {step === 2 && parsedFile && (
            <WizardStep2
              parsedFile={parsedFile}
              mapping={mapping}
              onMappingChange={setMapping}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {step === 3 && parsedFile && (
            <WizardStep3
              parsedFile={parsedFile}
              mapping={mapping}
              onBack={() => setStep(2)}
              onNext={handleStep3ToStep4}
            />
          )}
          {step === 4 && parsedFile && (
            <WizardStep4
              parsedFile={parsedFile}
              mapping={mapping}
              validRows={validRows}
              validationErrors={validationErrors}
              onBack={() => setStep(2)}
              onNext={() => setStep(5)}
            />
          )}
          {step === 5 && parsedFile && (
            <WizardStep5
              actorId={actorId}
              parsedFile={parsedFile}
              mapping={mapping}
              validRows={validRows}
              resumeImport={resumeImport}
              onComplete={handleImportComplete}
              onAborted={onClose}
            />
          )}
          {step === 6 && importId && (
            <WizardStep6
              importId={importId}
              onComplete={handleMatchingComplete}
              onSkip={(imp) => { setCompletedImport(imp); setStep(7); }}
            />
          )}
          {step === 7 && completedImport && (
            <WizardStep7
              imp={completedImport}
              validationErrors={validationErrors}
              onClose={handleFinalClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
