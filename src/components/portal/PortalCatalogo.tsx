import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOffering, PortalOfferingIAEstado, MatchCandidate,
  CatalogImport,
  getSupplierOfferingsPaged, updateSupplierOffering,
  matchOfferingToUP, unmatchOffering, getOfferingMatchCandidates,
  getCatalogImports,
  IA_ESTADO_LABELS, IA_ESTADO_COLORS,
  IMPORT_ESTADO_LABELS, IMPORT_ESTADO_COLORS,
} from '../../lib/api/marketplace-portal';
import PortalImportacion from './PortalImportacion';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

const MATCH_STATE_OPTIONS = [
  { value: '',              label: 'Todos' },
  { value: 'matched',       label: 'Vinculados' },
  { value: 'suggested',     label: 'Sugeridos' },
  { value: 'pending_review',label: 'Por revisar' },
  { value: 'unmatched',     label: 'Sin vincular' },
];

export default function PortalCatalogo({ actorId, membership }: Props) {
  const [items,         setItems]         = useState<PortalOffering[]>([]);
  const [totalCount,    setTotalCount]    = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [matchFilter,   setMatchFilter]   = useState('');
  const [page,          setPage]          = useState(0);
  const [selectedOff,   setSelectedOff]   = useState<PortalOffering | null>(null);
  const [error,         setError]         = useState<string | null>(null);
  const [showImport,    setShowImport]    = useState(false);
  const [recentImports, setRecentImports] = useState<CatalogImport[]>([]);
  const [historialOpen, setHistorialOpen] = useState(false);

  const LIMIT = 20;

  const load = useCallback(async (q: string, mf: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplierOfferingsPaged(actorId, {
        search:     q || undefined,
        matchState: mf || undefined,
        limit:      LIMIT,
        offset:     p * LIMIT,
      });
      setItems(result.items);
      setTotalCount(result.totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(search, matchFilter, page); }, [load, search, matchFilter, page]);

  const handleSearchChange = (v: string) => { setSearch(v); setPage(0); };
  const handleFilterChange = (v: string) => { setMatchFilter(v); setPage(0); };

  const canWrite = membership.permissions.includes('offerings:write');
  const canMatch = membership.permissions.includes('offerings:match');

  const totalPages = Math.ceil(totalCount / LIMIT);

  const loadRecentImports = useCallback(async () => {
    try {
      const list = await getCatalogImports(actorId, 5);
      setRecentImports(list);
    } catch { /* silencioso */ }
  }, [actorId]);

  useEffect(() => { loadRecentImports(); }, [loadRecentImports]);

  const handleImportComplete = () => {
    setShowImport(false);
    loadRecentImports();
    load(search, matchFilter, page);
  };

  return (
    <>
    {showImport && (
      <PortalImportacion
        actorId={actorId}
        membership={membership}
        onClose={() => setShowImport(false)}
        onComplete={handleImportComplete}
      />
    )}

    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      {/* Table panel */}
      <div className={`flex flex-col flex-1 min-w-0 transition-all ${selectedOff ? 'lg:mr-[420px]' : ''}`}>
        {/* Toolbar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por ref, descripción..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <select
              value={matchFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {MATCH_STATE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <span className="text-xs text-slate-400 tabular-nums whitespace-nowrap">
              {totalCount} producto{totalCount !== 1 ? 's' : ''}
            </span>
            {canWrite && (
              <button
                onClick={() => setShowImport(true)}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-500 transition-colors shrink-0"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Importar
              </button>
            )}
          </div>

          {/* Historial de importaciones */}
          {recentImports.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setHistorialOpen(o => !o)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <svg className={`h-3.5 w-3.5 transition-transform ${historialOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
                Importaciones recientes ({recentImports.length})
              </button>
              {historialOpen && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {recentImports.map(imp => (
                    <div key={imp.id} className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{imp.nombre_archivo}</p>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {imp.filas_ok.toLocaleString('es-ES')} ok
                          {imp.filas_error > 0 && <span className="text-red-400 ml-1">· {imp.filas_error} err</span>}
                          {' · '}
                          {new Date(imp.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${IMPORT_ESTADO_COLORS[imp.estado]}`}>
                        {IMPORT_ESTADO_LABELS[imp.estado]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <TableSkeleton />
          ) : error ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col h-40 items-center justify-center gap-2">
              <p className="text-sm text-slate-400">No se encontraron productos.</p>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripción</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Precio</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Stock</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Catálogo TrabFlow</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item) => (
                  <OfferingRow
                    key={item.id}
                    item={item}
                    selected={selectedOff?.id === item.id}
                    canWrite={canWrite}
                    canMatch={canMatch}
                    onSelect={() => setSelectedOff(prev => prev?.id === item.id ? null : item)}
                    onUpdated={() => load(search, matchFilter, page)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-400 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* Matching drawer */}
      {selectedOff && (
        <MatchingDrawer
          offering={selectedOff}
          canMatch={canMatch}
          onClose={() => setSelectedOff(null)}
          onMatched={() => {
            setSelectedOff(null);
            load(search, matchFilter, page);
          }}
        />
      )}
    </div>
    </>
  );
}

interface OfferingRowProps {
  item:       PortalOffering;
  selected:   boolean;
  canWrite:   boolean;
  canMatch:   boolean;
  onSelect:   () => void;
  onUpdated:  () => void;
}

function OfferingRow({ item, selected, canWrite, canMatch, onSelect, onUpdated }: OfferingRowProps) {
  const [busy, setBusy] = useState(false);

  const toggleStock = async () => {
    if (!canWrite || busy) return;
    setBusy(true);
    try {
      await updateSupplierOffering(item.id, { stock_disponible: !item.stock_disponible });
      onUpdated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr
      className={`transition-colors ${selected ? 'bg-teal-50 dark:bg-teal-900/10' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-slate-500">{item.supplier_ref ?? '—'}</span>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-slate-800 dark:text-slate-200 truncate">
          {item.descripcion_comercial ?? '—'}
        </p>
        {item.up_familia && (
          <p className="text-xs text-slate-400 truncate">{item.up_familia}</p>
        )}
      </td>
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {item.precio_coste != null
            ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(item.precio_coste)
            : '—'}
        </span>
      </td>
      <td className="px-4 py-3 text-center hidden lg:table-cell">
        <button
          onClick={toggleStock}
          disabled={!canWrite || busy}
          title={item.stock_disponible ? 'Con stock — clic para quitar' : 'Sin stock — clic para marcar'}
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
            item.stock_disponible
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-200'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200'
          } ${(!canWrite || busy) ? 'cursor-default' : 'cursor-pointer'}`}
        >
          {item.stock_disponible ? 'Con stock' : 'Sin stock'}
        </button>
      </td>
      <td className="px-4 py-3 max-w-[160px]">
        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">
          {item.up_nombre_canonico ?? <span className="text-slate-400">Sin vincular</span>}
        </p>
        {item.match_confidence != null && (
          <p className="text-xs text-slate-400">{Math.round(item.match_confidence * 100)}% confianza</p>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${IA_ESTADO_COLORS[item.ia_estado as PortalOfferingIAEstado] ?? ''}`}>
          {IA_ESTADO_LABELS[item.ia_estado as PortalOfferingIAEstado] ?? item.ia_estado}
        </span>
      </td>
      <td className="px-4 py-3">
        {canMatch && (
          <button
            onClick={onSelect}
            title="Vincular / ver detalles"
            className={`rounded-md p-1.5 transition-colors ${
              selected
                ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                : 'text-slate-400 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}

interface MatchingDrawerProps {
  offering:  PortalOffering;
  canMatch:  boolean;
  onClose:   () => void;
  onMatched: () => void;
}

function MatchingDrawer({ offering, canMatch, onClose, onMatched }: MatchingDrawerProps) {
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [query,      setQuery]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [matching,   setMatching]   = useState<string | null>(null);
  const [unmatching, setUnmatching] = useState(false);
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCandidates = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getOfferingMatchCandidates(offering.id, q || undefined, 8);
      setCandidates(res);
    } finally {
      setLoading(false);
    }
  }, [offering.id]);

  useEffect(() => { loadCandidates(''); }, [loadCandidates]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => loadCandidates(v), 300);
  };

  const handleMatch = async (upId: string) => {
    if (!canMatch || matching) return;
    setMatching(upId);
    try {
      await matchOfferingToUP(offering.id, upId, 'supplier');
      onMatched();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setMatching(null);
    }
  };

  const handleUnmatch = async () => {
    if (!canMatch || unmatching) return;
    setUnmatching(true);
    try {
      await unmatchOffering(offering.id);
      onMatched();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al desvincular');
    } finally {
      setUnmatching(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="flex items-start gap-3 border-b border-slate-200 dark:border-slate-800 px-5 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-400 mb-0.5">Vinculación</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {offering.supplier_ref && <span className="font-mono text-slate-500 mr-1.5">{offering.supplier_ref}</span>}
            {offering.descripcion_comercial ?? 'Producto sin descripción'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {IA_ESTADO_LABELS[offering.ia_estado as PortalOfferingIAEstado]} · {offering.ia_explicacion}
          </p>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Vinculación actual */}
      {offering.match_state === 'matched' && offering.up_nombre_canonico && (
        <div className="mx-5 mt-4 flex items-start gap-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10 p-3">
          <svg className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Vinculado a</p>
            <p className="text-sm text-slate-900 dark:text-slate-100 truncate">{offering.up_nombre_canonico}</p>
            {offering.up_familia && <p className="text-xs text-slate-500">{offering.up_familia}</p>}
          </div>
          {canMatch && (
            <button
              onClick={handleUnmatch}
              disabled={unmatching}
              className="shrink-0 text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              {unmatching ? '...' : 'Desvincular'}
            </button>
          )}
        </div>
      )}

      {/* Buscador */}
      {canMatch && (
        <div className="px-5 pt-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            {offering.match_state === 'matched' ? 'Cambiar vinculación' : 'Buscar en catálogo TrabFlow'}
          </p>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Nombre, EAN, familia..."
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
      )}

      {/* Candidatos */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <svg className="h-5 w-5 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : candidates.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-slate-400">
              {query ? 'Sin resultados para esa búsqueda.' : 'Sin candidatos automáticos.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">Prueba con el nombre, EAN o familia del producto.</p>
          </div>
        ) : (
          candidates.map((c) => (
            <div
              key={c.up_id}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">
                    {c.nombre_canonico}
                  </p>
                  {c.familia && <p className="text-xs text-slate-400">{c.familia}</p>}
                  {c.marca && <p className="text-xs text-slate-500">{c.marca}</p>}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold tabular-nums ${c.score >= 80 ? 'text-emerald-600' : c.score >= 50 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {c.score}%
                  </span>
                  <p className="text-xs text-slate-400 leading-none">similitud</p>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-2 leading-relaxed">{c.explicacion}</p>

              <div className="flex flex-wrap gap-1 mb-3">
                {c.match_ean     && <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">EAN</span>}
                {c.match_mpn     && <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">MPN</span>}
                {c.match_marca   && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">Marca</span>}
                {c.match_familia && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">Familia</span>}
                {c.match_descripcion && <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">Descripción</span>}
                {c.ofertas_count > 0 && (
                  <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500">
                    {c.ofertas_count} proveedor{c.ofertas_count > 1 ? 'es' : ''}
                  </span>
                )}
              </div>

              {canMatch && (
                <button
                  onClick={() => handleMatch(c.up_id)}
                  disabled={!!matching}
                  className={`w-full rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    matching === c.up_id
                      ? 'bg-teal-500 text-white cursor-wait'
                      : 'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50'
                  }`}
                >
                  {matching === c.up_id ? 'Vinculando...' : 'Vincular'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-12 rounded bg-slate-200 dark:bg-slate-800" />
      ))}
    </div>
  );
}
