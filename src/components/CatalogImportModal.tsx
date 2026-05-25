import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, CheckCircle, RotateCcw, Loader2 } from 'lucide-react';
import { parseExcelFile, type ParsedCatalogRow } from '../lib/catalogExcel';
import { importCatalogItems, type CatalogImportItem } from '../lib/supabase';

type ImportMode = 'add' | 'update' | 'replace';

interface Props {
  orgId: string | null;
  isLiveMode: boolean;
  onDone: (inserted: number, updated: number, errors: number) => void;
  onClose: () => void;
}

const MODE_INFO: Record<ImportMode, { label: string; desc: string; color: string }> = {
  add:     { label: 'Añadir nuevos',         desc: 'Inserta solo los productos que no existen aún. Los existentes no se tocan.', color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' },
  update:  { label: 'Actualizar existentes', desc: 'Actualiza los productos que coincidan por código o descripción. Inserta los nuevos.', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/30' },
  replace: { label: 'Reemplazar catálogo',   desc: 'Desactiva todo el catálogo actual y carga el nuevo. Operación reversible (soft delete).', color: 'border-red-500 bg-red-50 dark:bg-red-950/30' },
};

export default function CatalogImportModal({ orgId, isLiveMode, onDone, onClose }: Props) {
  const [mode, setMode]             = useState<ImportMode>('add');
  const [step, setStep]             = useState<'idle' | 'parsed' | 'importing' | 'done'>('idle');
  const [parsedRows, setParsedRows] = useState<ParsedCatalogRow[]>([]);
  const [parseError, setParseError] = useState<string>('');
  const [result, setResult]         = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
  const [dragOver, setDragOver]     = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows   = parsedRows.filter(r => r.isValid);
  const invalidRows = parsedRows.filter(r => !r.isValid);

  async function handleFile(file: File) {
    setParseError('');
    try {
      const rows = await parseExcelFile(file);
      if (rows.length === 0) {
        setParseError('El archivo no contiene filas de datos (o solo tiene encabezados).');
        return;
      }
      setParsedRows(rows);
      setStep('parsed');
    } catch (e: unknown) {
      setParseError((e as Error).message);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleConfirm() {
    if (!isLiveMode || !orgId) return;
    setStep('importing');
    const items: CatalogImportItem[] = validRows.map(r => ({
      codigo:      r.codigo,
      familia:     r.familia,
      descripcion: r.descripcion,
      precio_base: r.precio_base,
      unidad:      r.unidad,
    }));
    try {
      const res = await importCatalogItems(orgId, items, mode);
      setResult(res);
      setStep('done');
    } catch (e: unknown) {
      setResult({ inserted: 0, updated: 0, errors: [(e as Error).message] });
      setStep('done');
    }
  }

  function handleDone() {
    if (result) onDone(result.inserted, result.updated, result.errors.length);
    else onClose();
  }

  function resetToIdle() {
    setStep('idle');
    setParsedRows([]);
    setParseError('');
    setResult(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-500" />
            <span className="font-bold text-sm text-slate-800 dark:text-white">Importar catálogo desde Excel</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">

          {/* ── STEP: idle ── */}
          {step === 'idle' && (
            <>
              {/* Modo de importación */}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-2">Modo de importación</span>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(MODE_INFO) as ImportMode[]).map(m => (
                    <label
                      key={m}
                      className={`flex items-start gap-3 border rounded-xl p-3.5 cursor-pointer transition-all ${
                        mode === m ? MODE_INFO[m].color + ' border-2' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        value={m}
                        checked={mode === m}
                        onChange={() => setMode(m)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <div>
                        <span className="font-bold text-xs text-slate-800 dark:text-white block">{MODE_INFO[m].label}</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">{MODE_INFO[m].desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  dragOver
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <Upload className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Arrastra tu Excel aquí o haz clic para seleccionar</p>
                <p className="text-[10px] text-slate-400 mt-1">Formatos: .xlsx · .xls · .csv</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={onFileInput}
                />
              </div>

              {parseError && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-3">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-700 dark:text-red-300">{parseError}</span>
                </div>
              )}

              {!isLiveMode && (
                <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl p-3">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    Inicia sesión con datos reales para poder importar al catálogo.
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── STEP: parsed (preview) ── */}
          {step === 'parsed' && (
            <>
              {/* Resumen */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
                  <span className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 block">{validRows.length}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-emerald-600 dark:text-emerald-500">Filas válidas</span>
                </div>
                <div className={`border rounded-xl p-3 text-center ${invalidRows.length > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                  <span className={`text-lg font-bold font-mono block ${invalidRows.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>{invalidRows.length}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400">Con errores</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-center">
                  <span className="text-lg font-bold font-mono text-slate-600 dark:text-slate-300 block">{parsedRows.length}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400">Total filas</span>
                </div>
              </div>

              {/* Modo seleccionado */}
              <div className={`border rounded-xl p-3 text-xs ${MODE_INFO[mode].color}`}>
                <span className="font-bold text-slate-800 dark:text-white">{MODE_INFO[mode].label}:</span>{' '}
                <span className="text-slate-600 dark:text-slate-300">{MODE_INFO[mode].desc}</span>
                {mode === 'replace' && (
                  <div className="flex items-center gap-1.5 mt-1.5 text-red-600 dark:text-red-400 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Todo el catálogo actual quedará desactivado antes de importar.
                  </div>
                )}
              </div>

              {/* Preview tabla */}
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-slate-400 block mb-2">
                  Vista previa (primeras {Math.min(10, parsedRows.length)} filas)
                </span>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                        {['Fila', 'Código', 'Familia', 'Descripción', 'Precio', 'Ud.', ''].map(h => (
                          <th key={h} className="text-left text-[9px] font-mono font-bold uppercase text-slate-400 px-3 py-2 whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedRows.slice(0, 10).map(row => (
                        <tr key={row.rowIndex} className={row.isValid ? 'hover:bg-slate-50 dark:hover:bg-slate-800/40' : 'bg-red-50/60 dark:bg-red-950/20'}>
                          <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{row.rowIndex}</td>
                          <td className="px-3 py-2 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{row.codigo || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded text-[9px] font-bold">{row.familia}</span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[200px] truncate">{row.descripcion || <span className="text-red-400 italic">vacío</span>}</td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-800 dark:text-white whitespace-nowrap">{row.precio_base.toFixed(2)} €</td>
                          <td className="px-3 py-2 text-slate-400 font-mono whitespace-nowrap">{row.unidad}</td>
                          <td className="px-3 py-2">
                            {row.isValid
                              ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                              : <span title={row.errors.join(', ')}><AlertTriangle className="h-3.5 w-3.5 text-red-400 cursor-help" /></span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsedRows.length > 10 && (
                  <p className="text-[10px] text-slate-400 mt-1 text-right font-mono">... y {parsedRows.length - 10} filas más</p>
                )}
              </div>

              {/* Errores detallados */}
              {invalidRows.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 space-y-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase text-red-500 block">Filas con errores (se saltarán)</span>
                  {invalidRows.slice(0, 5).map(r => (
                    <div key={r.rowIndex} className="text-[10px] text-red-700 dark:text-red-300">
                      <span className="font-mono font-bold">Fila {r.rowIndex}:</span> {r.errors.join(' · ')}
                    </div>
                  ))}
                  {invalidRows.length > 5 && (
                    <span className="text-[10px] text-red-400 font-mono">... y {invalidRows.length - 5} más</span>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── STEP: importing ── */}
          {step === 'importing' && (
            <div className="py-12 flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Importando catálogo...</span>
              <span className="text-xs text-slate-400">Esto puede tardar unos segundos si hay muchos productos.</span>
            </div>
          )}

          {/* ── STEP: done ── */}
          {step === 'done' && result && (
            <div className="py-6 flex flex-col items-center gap-5 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500" />
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm mb-1">¡Importación completada!</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  El catálogo ha sido actualizado correctamente.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 w-full">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center">
                  <span className="text-2xl font-bold font-mono text-emerald-600 block">{result.inserted}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-emerald-600">Nuevos</span>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-center">
                  <span className="text-2xl font-bold font-mono text-blue-600 block">{result.updated}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-blue-600">Actualizados</span>
                </div>
                <div className={`border rounded-xl p-3 text-center ${result.errors.length > 0 ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'}`}>
                  <span className={`text-2xl font-bold font-mono block ${result.errors.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>{result.errors.length}</span>
                  <span className="text-[9px] font-mono font-bold uppercase text-slate-400">Errores</span>
                </div>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-3 w-full text-left space-y-1">
                  <span className="text-[9px] font-mono font-bold uppercase text-red-500 block">Errores de inserción</span>
                  {result.errors.slice(0, 5).map((e, i) => (
                    <p key={i} className="text-[10px] text-red-700 dark:text-red-300">{e}</p>
                  ))}
                  {result.errors.length > 5 && <p className="text-[10px] text-red-400 font-mono">... y {result.errors.length - 5} más</p>}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer buttons */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div>
            {step === 'parsed' && (
              <button
                onClick={resetToIdle}
                className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Cambiar archivo
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {step !== 'importing' && step !== 'done' && (
              <button
                onClick={onClose}
                className="border border-slate-200 dark:border-slate-600 text-slate-500 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
            )}
            {step === 'parsed' && (
              <button
                onClick={handleConfirm}
                disabled={validRows.length === 0 || !isLiveMode}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Importar {validRows.length} producto{validRows.length !== 1 ? 's' : ''}
              </button>
            )}
            {step === 'done' && (
              <button
                onClick={handleDone}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2 rounded-lg cursor-pointer transition-colors"
              >
                Cerrar y recargar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
