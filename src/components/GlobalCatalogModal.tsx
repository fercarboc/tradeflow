/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { X, Download, Search, Check, Loader2, Globe } from 'lucide-react';
import { loadGlobalCatalog, importFromGlobalCatalog } from '../lib/supabase';
import type { TradeGlobalCatalogItem } from '../lib/supabase';

interface GlobalCatalogModalProps {
  orgId: string;
  onDone: (imported: number) => void;
  onClose: () => void;
}

const ALL_OFICIOS = [
  'Fontanería', 'Electricidad', 'Climatización / HVAC', 'Calefacción',
  'Albañilería', 'Reformas', 'Carpintería / Ventanas', 'Cerrajería',
  'Pintura', 'Suelos y Tarimas', 'Pladur / Escayola', 'Jardinería',
  'Cristalería', 'Persianas / Cierres', 'Telecomunicaciones',
  'Energía Solar', 'Vehículo Eléctrico', 'CCTV / Seguridad', 'Ascensores',
  'Taller Mecánico', 'Limpieza Industrial',
];

export default function GlobalCatalogModal({ orgId, onDone, onClose }: GlobalCatalogModalProps) {
  const [step, setStep] = useState<'select' | 'preview' | 'importing'>('select');
  const [selectedOficios, setSelectedOficios] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<TradeGlobalCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const toggleOficio = (o: string) => {
    setSelectedOficios(prev => {
      const n = new Set(prev);
      if (n.has(o)) n.delete(o); else n.add(o);
      return n;
    });
  };

  const handlePreview = async () => {
    if (selectedOficios.size === 0) return;
    setLoading(true);
    try {
      const data = await loadGlobalCatalog([...selectedOficios]);
      setItems(data);
      setStep('preview');
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const allFamilies = [...new Set(items.map(i => i.familia))].sort();

  const toggleFamily = (f: string) => {
    setFamilyFilter(prev => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f); else n.add(f);
      return n;
    });
  };

  const filteredItems = items.filter(item => {
    const matchFamily = familyFilter.size === 0 || familyFilter.has(item.familia);
    const q = searchText.toLowerCase();
    const matchSearch = !q || item.descripcion.toLowerCase().includes(q) || item.familia.toLowerCase().includes(q);
    return matchFamily && matchSearch;
  });

  const handleImport = async () => {
    setImporting(true);
    setStep('importing');
    try {
      const familias = familyFilter.size > 0 ? [...familyFilter] : undefined;
      const count = await importFromGlobalCatalog(orgId, [...selectedOficios], familias);
      onDone(count);
    } catch {
      setStep('preview');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d1f38] border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-[#FFC400]/15 flex items-center justify-center">
              <Globe className="h-4 w-4 text-[#FFC400]" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-white">Catálogo Base TRABFLOW</h2>
              <p className="text-[10px] text-white/40">+830 productos con precios orientativos 2026</p>
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors">
            <X className="h-4 w-4 text-white/60" />
          </button>
        </div>

        {/* Step: select oficios */}
        {step === 'select' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <p className="text-xs text-white/50 leading-relaxed">
                Selecciona los oficios que trabajas. Los productos se copiarán a <strong className="text-white">tu catálogo propio</strong> con los precios orientativos — después ajusta los tuyos.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ALL_OFICIOS.map(o => {
                  const sel = selectedOficios.has(o);
                  return (
                    <button
                      key={o}
                      onClick={() => toggleOficio(o)}
                      className={`relative text-left px-3 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                        sel
                          ? 'border-[#FFC400] bg-[#FFC400]/10 text-[#FFC400]'
                          : 'border-white/10 bg-white/5 text-white/50 hover:border-white/25 hover:text-white'
                      }`}
                    >
                      {sel && (
                        <span className="absolute top-1.5 right-1.5 h-4 w-4 bg-[#FFC400] rounded-full flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-[#020B16]" />
                        </span>
                      )}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-white/35">{selectedOficios.size} oficio{selectedOficios.size !== 1 ? 's' : ''} seleccionado{selectedOficios.size !== 1 ? 's' : ''}</span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/15 text-white/50 text-xs font-bold cursor-pointer hover:text-white transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handlePreview}
                  disabled={selectedOficios.size === 0 || loading}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FFC400] hover:brightness-110 disabled:opacity-40 text-[#020B16] text-xs font-black uppercase tracking-wider cursor-pointer transition-all"
                >
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Ver productos →
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: preview + filter */}
        {step === 'preview' && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Search + family pills */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-white/10 bg-white/5 text-xs text-white placeholder:text-white/25 focus:border-[#FFC400]/40 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setStep('select')}
                  className="px-3 py-2 rounded-xl border border-white/10 text-white/40 text-[10px] font-bold cursor-pointer hover:text-white transition-colors"
                >
                  ← Cambiar oficios
                </button>
              </div>

              {allFamilies.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setFamilyFilter(new Set())}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                      familyFilter.size === 0
                        ? 'bg-[#00CFE8] text-[#020B16]'
                        : 'bg-white/5 border border-white/10 text-white/40 hover:text-white'
                    }`}
                  >
                    Todas ({items.length})
                  </button>
                  {allFamilies.map(f => {
                    const count = items.filter(i => i.familia === f).length;
                    const active = familyFilter.has(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFamily(f)}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                          active
                            ? 'bg-[#00CFE8] text-[#020B16]'
                            : 'bg-white/5 border border-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {f} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Product list */}
              <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/8">
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Código</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Familia</th>
                      <th className="text-left px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Descripción</th>
                      <th className="text-right px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Precio ref.</th>
                      <th className="text-center px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/40">Ud.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.slice(0, 200).map((item, i) => (
                      <tr key={item.id} className={`border-b border-white/5 ${i % 2 === 0 ? '' : 'bg-white/3'}`}>
                        <td className="px-3 py-1.5 font-mono text-[10px] text-white/40">{item.codigo}</td>
                        <td className="px-3 py-1.5 text-white/50">{item.familia}</td>
                        <td className="px-3 py-1.5 text-white">{item.descripcion}</td>
                        <td className="px-3 py-1.5 text-right font-bold text-[#FFC400]">{item.precio_referencia.toFixed(2)} €</td>
                        <td className="px-3 py-1.5 text-center text-white/40">{item.unidad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredItems.length > 200 && (
                  <div className="px-3 py-2 bg-white/3 text-[10px] text-white/30 text-center">
                    Mostrando 200 de {filteredItems.length} productos
                  </div>
                )}
                {filteredItems.length === 0 && (
                  <div className="px-3 py-8 text-center text-xs text-white/30">
                    Sin resultados para ese filtro
                  </div>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-white/35">
                {filteredItems.length} producto{filteredItems.length !== 1 ? 's' : ''} se importarán a tu catálogo
              </span>
              <div className="flex gap-2">
                <button onClick={onClose} className="px-4 py-2 rounded-xl border border-white/15 text-white/50 text-xs font-bold cursor-pointer hover:text-white transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={filteredItems.length === 0 || importing}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#FFC400] hover:brightness-110 disabled:opacity-40 text-[#020B16] text-xs font-black uppercase tracking-wider cursor-pointer transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  Importar {filteredItems.length} productos
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: importing */}
        {step === 'importing' && (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center space-y-4">
              <Loader2 className="h-10 w-10 text-[#FFC400] animate-spin mx-auto" />
              <p className="text-sm font-bold text-white">Importando productos...</p>
              <p className="text-xs text-white/40">Los productos ya existentes en tu catálogo no se duplican</p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
