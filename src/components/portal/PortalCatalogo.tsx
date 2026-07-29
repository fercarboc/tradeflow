import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOffering, PortalOfferingIAEstado, CatalogImport, CatalogQualityStats,
  getSupplierOfferingsPaged, getCatalogQualityStats, getCatalogImports,
  IA_ESTADO_LABELS, IA_ESTADO_COLORS,
  IMPORT_ESTADO_LABELS, IMPORT_ESTADO_COLORS,
} from '../../lib/api/marketplace-portal';
import PortalImportacion from './PortalImportacion';
import PortalProductoSlideOver from './PortalProductoSlideOver';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

type SortKey = 'updated_at' | 'supplier_ref' | 'descripcion_comercial' | 'precio_venta';
type SlideTab = 'datos' | 'imagen' | 'estado' | 'ia' | 'historial';

const SORT_OPTIONS: { value: SortKey; dir: 'asc' | 'desc'; label: string }[] = [
  { value: 'updated_at',          dir: 'desc', label: 'Más reciente' },
  { value: 'supplier_ref',        dir: 'asc',  label: 'Referencia A-Z' },
  { value: 'descripcion_comercial', dir: 'asc', label: 'Descripción A-Z' },
  { value: 'precio_venta',        dir: 'asc',  label: 'Precio ↑' },
  { value: 'precio_venta',        dir: 'desc', label: 'Precio ↓' },
];

const FMT_EUR  = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

// ── Panel de calidad del catálogo ─────────────────────────────────────────────

interface QualityPanelProps {
  stats: CatalogQualityStats;
  onFilterActiva?: (v: boolean | undefined) => void;
  onFilterStock?:  (v: boolean | undefined) => void;
}

function QualityPanel({ stats, onFilterActiva, onFilterStock }: QualityPanelProps) {
  if (stats.total === 0) return null;
  const pct = stats.cobertura_pct;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-[160px]">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-xs font-medium text-slate-500">Cobertura IA</span>
              <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">{pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap text-xs">
          <Chip color="emerald" label={`${stats.matched} vinculados`} />
          {stats.sin_imagen > 0 && (
            <Chip color="amber"  label={`${stats.sin_imagen} sin imagen`} />
          )}
          {stats.sin_stock > 0 && (
            <Chip
              color="orange"
              label={`${stats.sin_stock} sin stock`}
              onClick={() => onFilterStock?.(false)}
              clickable
            />
          )}
          {stats.inactivos > 0 && (
            <Chip
              color="slate"
              label={`${stats.inactivos} inactivos`}
              onClick={() => onFilterActiva?.(false)}
              clickable
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Chip({ color, label, onClick, clickable }: {
  color:     'emerald' | 'amber' | 'orange' | 'slate' | 'red';
  label:     string;
  onClick?:  () => void;
  clickable?: boolean;
}) {
  const colors = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    orange:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    slate:   'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
    red:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span
      onClick={clickable ? onClick : undefined}
      className={`rounded-full px-2.5 py-0.5 font-medium ${colors[color]} ${clickable ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
    >
      {label}
    </span>
  );
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────

interface OfferingRowProps {
  item:       PortalOffering;
  selected:   boolean;
  canMatch:   boolean;
  onOpen:     (tab?: SlideTab) => void;
}

function OfferingRow({ item, selected, canMatch, onOpen }: OfferingRowProps) {
  return (
    <tr
      onClick={() => onOpen('datos')}
      className={`cursor-pointer transition-colors ${
        selected
          ? 'bg-teal-50 dark:bg-teal-900/10'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      {/* Imagen mini */}
      <td className="pl-4 pr-2 py-2.5 w-10">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-8 w-8 rounded-md object-cover border border-slate-200 dark:border-slate-700"
          />
        ) : (
          <div className="h-8 w-8 rounded-md border border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center">
            <svg className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
        )}
      </td>

      {/* Ref + descripción */}
      <td className="px-2 py-2.5 max-w-0 w-full">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-xs text-slate-400 shrink-0">{item.supplier_ref ?? '—'}</span>
          {!item.activa && (
            <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-500 dark:text-slate-400">
              Inactivo
            </span>
          )}
        </div>
        <p className="text-sm text-slate-800 dark:text-slate-200 truncate leading-snug">
          {item.descripcion_comercial ?? '—'}
        </p>
        {item.up_familia && (
          <p className="text-xs text-slate-400 truncate">{item.up_familia}</p>
        )}
      </td>

      {/* Precio */}
      <td className="px-2 py-2.5 text-right hidden md:table-cell w-28 shrink-0">
        <p className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {item.precio_venta != null ? FMT_EUR.format(item.precio_venta) : '—'}
        </p>
        <p className="text-xs tabular-nums text-slate-400">{item.unidad}</p>
      </td>

      {/* Stock */}
      <td className="px-2 py-2.5 text-center hidden lg:table-cell w-24 shrink-0">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
          item.stock_disponible
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
        }`}>
          {item.stock_disponible ? 'Con stock' : 'Sin stock'}
        </span>
      </td>

      {/* Estado IA */}
      <td className="px-2 py-2.5 hidden lg:table-cell w-28 shrink-0">
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${IA_ESTADO_COLORS[item.ia_estado as PortalOfferingIAEstado] ?? ''}`}>
          {IA_ESTADO_LABELS[item.ia_estado as PortalOfferingIAEstado] ?? item.ia_estado}
        </span>
        {item.match_confidence != null && (
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{Math.round(item.match_confidence * 100)}%</p>
        )}
      </td>

      {/* Acción IA */}
      <td className="pr-4 pl-2 py-2.5 w-10 shrink-0">
        {canMatch && (
          <button
            onClick={e => { e.stopPropagation(); onOpen('ia'); }}
            title="Motor IA"
            className={`rounded-md p-1.5 transition-colors ${
              selected
                ? 'bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400'
                : 'text-slate-300 hover:bg-slate-100 hover:text-teal-600 dark:hover:bg-slate-800'
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

function TableSkeleton() {
  return (
    <div className="animate-pulse p-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-14 rounded bg-slate-100 dark:bg-slate-800" />
      ))}
    </div>
  );
}

// ── PortalCatalogo ────────────────────────────────────────────────────────────

export default function PortalCatalogo({ actorId, membership }: Props) {
  const [items,         setItems]         = useState<PortalOffering[]>([]);
  const [totalCount,    setTotalCount]    = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [quality,       setQuality]       = useState<CatalogQualityStats | null>(null);
  const [recentImports, setRecentImports] = useState<CatalogImport[]>([]);
  const [historialOpen, setHistorialOpen] = useState(false);
  const [showImport,    setShowImport]    = useState(false);

  // Filters & sort
  const [search,      setSearch]      = useState('');
  const [matchFilter, setMatchFilter] = useState('');
  const [activaFilter, setActivaFilter] = useState<boolean | undefined>(undefined);
  const [stockFilter,  setStockFilter]  = useState<boolean | undefined>(undefined);
  const [sortIdx,     setSortIdx]     = useState(0);
  const [page,        setPage]        = useState(0);

  // SlideOver
  const [selectedOff, setSelectedOff] = useState<PortalOffering | null>(null);
  const [slideTab,    setSlideTab]    = useState<SlideTab>('datos');

  const LIMIT  = 20;
  const sort   = SORT_OPTIONS[sortIdx];
  const canWrite = membership.permissions.includes('offerings:write');
  const canMatch = membership.permissions.includes('offerings:match');
  const totalPages = Math.ceil(totalCount / LIMIT);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, mf: string, activa: boolean | undefined, stock: boolean | undefined, sBy: SortKey, sDir: 'asc' | 'desc', p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplierOfferingsPaged(actorId, {
        search:     q     || undefined,
        matchState: mf    || undefined,
        activa,
        stock,
        sortBy:     sBy,
        sortDir:    sDir,
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

  useEffect(() => {
    load(search, matchFilter, activaFilter, stockFilter, sort.value, sort.dir, page);
  }, [load, search, matchFilter, activaFilter, stockFilter, sort.value, sort.dir, page]);

  const loadQuality = useCallback(async () => {
    getCatalogQualityStats(actorId).then(setQuality).catch(() => {});
  }, [actorId]);

  const loadRecentImports = useCallback(async () => {
    getCatalogImports(actorId, 5).then(setRecentImports).catch(() => {});
  }, [actorId]);

  useEffect(() => { loadQuality(); loadRecentImports(); }, [loadQuality, loadRecentImports]);

  const handleSearchChange = (v: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(v); setPage(0); }, 300);
  };

  const handleImportComplete = () => {
    setShowImport(false);
    loadRecentImports();
    loadQuality();
    load(search, matchFilter, activaFilter, stockFilter, sort.value, sort.dir, 0);
    setPage(0);
  };

  const openSlide = (item: PortalOffering, tab: SlideTab = 'datos') => {
    setSelectedOff(item);
    setSlideTab(tab);
  };

  const handleSlideUpdated = (patch: Partial<PortalOffering>) => {
    setItems(prev => prev.map(it => it.id === selectedOff?.id ? { ...it, ...patch } : it));
    if (selectedOff) setSelectedOff(prev => prev ? { ...prev, ...patch } : prev);
    // Refresh quality stats silently
    loadQuality();
  };

  const hasActiveFilters = !!search || !!matchFilter || activaFilter !== undefined || stockFilter !== undefined;

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
      <div className={`flex flex-col flex-1 min-w-0 transition-all ${selectedOff ? 'lg:mr-[440px]' : ''}`}>

        {/* Toolbar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
          {/* Row 1: Search + Sort + Importar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"
                fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar ref, descripción..."
                defaultValue={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            <select
              value={sortIdx}
              onChange={e => { setSortIdx(Number(e.target.value)); setPage(0); }}
              className="hidden sm:block rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {SORT_OPTIONS.map((o, i) => (
                <option key={i} value={i}>{o.label}</option>
              ))}
            </select>

            <span className="hidden sm:block text-xs text-slate-400 tabular-nums whitespace-nowrap">
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

          {/* Row 2: Filters */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {/* Match state */}
            <select
              value={matchFilter}
              onChange={e => { setMatchFilter(e.target.value); setPage(0); }}
              className={`rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                matchFilter
                  ? 'border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <option value="">IA: Todos</option>
              <option value="matched">IA: Vinculados</option>
              <option value="suggested">IA: Sugeridos</option>
              <option value="pending_review">IA: Por revisar</option>
              <option value="unmatched">IA: Sin vincular</option>
            </select>

            {/* Activa filter */}
            <select
              value={activaFilter === undefined ? '' : activaFilter ? 'true' : 'false'}
              onChange={e => {
                setActivaFilter(e.target.value === '' ? undefined : e.target.value === 'true');
                setPage(0);
              }}
              className={`rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                activaFilter !== undefined
                  ? 'border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <option value="">Estado: Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>

            {/* Stock filter */}
            <select
              value={stockFilter === undefined ? '' : stockFilter ? 'true' : 'false'}
              onChange={e => {
                setStockFilter(e.target.value === '' ? undefined : e.target.value === 'true');
                setPage(0);
              }}
              className={`rounded-md border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                stockFilter !== undefined
                  ? 'border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              <option value="">Stock: Todos</option>
              <option value="true">Con stock</option>
              <option value="false">Sin stock</option>
            </select>

            {/* Clear filters */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  setSearch('');
                  setMatchFilter('');
                  setActivaFilter(undefined);
                  setStockFilter(undefined);
                  setPage(0);
                }}
                className="rounded-md px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-colors"
              >
                Limpiar filtros
              </button>
            )}

            <span className="sm:hidden text-xs text-slate-400 tabular-nums ml-auto">
              {totalCount} prod.
            </span>
          </div>

          {/* Importaciones recientes */}
          {recentImports.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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

        {/* Quality panel */}
        {quality && quality.total > 0 && (
          <QualityPanel
            stats={quality}
            onFilterActiva={v => { setActivaFilter(v); setPage(0); }}
            onFilterStock={v => { setStockFilter(v); setPage(0); }}
          />
        )}

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
              <p className="text-sm text-slate-400">
                {hasActiveFilters ? 'Sin productos con estos filtros.' : 'El catálogo está vacío.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => { setSearch(''); setMatchFilter(''); setActivaFilter(undefined); setStockFilter(undefined); setPage(0); }}
                  className="text-xs text-teal-600 hover:underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="pl-4 pr-2 py-2.5 w-10" />
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide">Producto</th>
                  <th className="px-2 py-2.5 text-right text-xs font-semibold text-slate-400 uppercase tracking-wide hidden md:table-cell">Precio</th>
                  <th className="px-2 py-2.5 text-center text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Stock</th>
                  <th className="px-2 py-2.5 text-left text-xs font-semibold text-slate-400 uppercase tracking-wide hidden lg:table-cell">Motor IA</th>
                  <th className="pr-4 pl-2 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(item => (
                  <OfferingRow
                    key={item.id}
                    item={item}
                    selected={selectedOff?.id === item.id}
                    canMatch={canMatch}
                    onOpen={(tab) => openSlide(item, tab)}
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
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Anterior
            </button>
            <span className="text-xs text-slate-400 tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente →
            </button>
          </div>
        )}
      </div>

      {/* SlideOver */}
      {selectedOff && (
        <PortalProductoSlideOver
          actorId={actorId}
          offering={selectedOff}
          canWrite={canWrite}
          canMatch={canMatch}
          initialTab={slideTab}
          onClose={() => setSelectedOff(null)}
          onUpdated={handleSlideUpdated}
        />
      )}
    </div>
    </>
  );
}
