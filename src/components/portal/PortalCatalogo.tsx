import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  PortalOffering, PortalOfferingIAEstado, CatalogImport, CatalogQualityStats,
  getSupplierOfferingsPaged, getCatalogQualityStats, getCatalogImports,
  bulkUpdateOfferings,
  IA_ESTADO_LABELS, IA_ESTADO_COLORS,
  IMPORT_ESTADO_LABELS, IMPORT_ESTADO_COLORS,
} from '../../lib/api/marketplace-portal';
import PortalImportacion from './PortalImportacion';
import PortalProductoSlideOver from './PortalProductoSlideOver';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

type SortKey    = 'updated_at' | 'supplier_ref' | 'descripcion_comercial' | 'precio_venta';
type SlideTab   = 'datos' | 'imagen' | 'estado' | 'ia' | 'historial';
type BulkAction = 'activar' | 'desactivar' | 'stock_on' | 'stock_off';

const SORT_OPTIONS: { value: SortKey; dir: 'asc' | 'desc'; label: string }[] = [
  { value: 'updated_at',            dir: 'desc', label: 'Más reciente' },
  { value: 'supplier_ref',          dir: 'asc',  label: 'Referencia A-Z' },
  { value: 'descripcion_comercial', dir: 'asc',  label: 'Descripción A-Z' },
  { value: 'precio_venta',          dir: 'asc',  label: 'Precio ↑' },
  { value: 'precio_venta',          dir: 'desc', label: 'Precio ↓' },
];

const FMT_EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });

const CONFIRM_MESSAGES: Record<BulkAction, (n: number) => string> = {
  activar:    n => `Activar ${n} producto${n !== 1 ? 's' : ''}. Serán visibles para instaladores.`,
  desactivar: n => `Desactivar ${n} producto${n !== 1 ? 's' : ''}. Dejarán de aparecer en búsquedas.`,
  stock_on:   n => `Marcar ${n} producto${n !== 1 ? 's' : ''} como con stock.`,
  stock_off:  n => `Marcar ${n} producto${n !== 1 ? 's' : ''} como sin stock.`,
};

// ── CSV export ────────────────────────────────────────────────────────────────

function exportOfferingsToCSV(offerings: PortalOffering[], filename: string) {
  const HEADERS = ['Referencia', 'Descripción', 'Precio coste (€)', 'Precio venta (€)', 'Unidad', 'Stock disponible', 'Stock cantidad', 'Plazo entrega (días)', 'Activo', 'Estado IA'];
  const rows = offerings.map(o => [
    o.supplier_ref ?? '',
    o.descripcion_comercial ?? '',
    o.precio_coste?.toString() ?? '',
    o.precio_venta?.toString() ?? '',
    o.unidad,
    o.stock_disponible ? 'SI' : 'NO',
    o.stock_cantidad?.toString() ?? '',
    o.plazo_entrega_dias?.toString() ?? '',
    o.activa ? 'SI' : 'NO',
    IA_ESTADO_LABELS[o.ia_estado as PortalOfferingIAEstado] ?? o.ia_estado,
  ]);
  const csv = [HEADERS, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── IndeterminateCheckbox ────────────────────────────────────────────────────

function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked:       boolean;
  indeterminate: boolean;
  onChange:      () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-teal-600 cursor-pointer"
    />
  );
}

// ── BulkActionBar ────────────────────────────────────────────────────────────

interface BulkBarProps {
  count:        number;
  loading:      boolean;
  onActivar:    () => void;
  onDesactivar: () => void;
  onStockOn:    () => void;
  onStockOff:   () => void;
  onExport:     () => void;
  onClear:      () => void;
}

function BulkActionBar({ count, loading, onActivar, onDesactivar, onStockOn, onStockOff, onExport, onClear }: BulkBarProps) {
  const sep = <div className="w-px h-4 bg-slate-700 mx-0.5 shrink-0" />;
  const btn = (label: string, onClick: () => void, danger = false) => (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 whitespace-nowrap ${
        danger
          ? 'text-red-300 hover:bg-red-500/20 hover:text-red-200'
          : 'text-slate-300 hover:bg-white/10 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none px-4">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-2xl bg-slate-900 shadow-2xl ring-1 ring-slate-700 px-3 py-2 max-w-full overflow-x-auto">
        {loading && (
          <svg className="h-4 w-4 animate-spin text-teal-400 mr-1 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <span className="text-sm font-semibold text-white tabular-nums px-1.5 shrink-0">
          {count} sel.
        </span>
        {sep}
        {btn('Activar', onActivar)}
        {btn('Desactivar', onDesactivar, true)}
        {sep}
        {btn('Con stock', onStockOn)}
        {btn('Sin stock', onStockOff, true)}
        {sep}
        {btn('Exportar CSV', onExport)}
        {sep}
        <button
          onClick={onClear}
          title="Limpiar selección"
          className="rounded-md p-1 text-slate-500 hover:text-white hover:bg-white/10 transition-colors shrink-0"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({ action, count, onConfirm, onCancel }: {
  action:    BulkAction;
  count:     number;
  onConfirm: () => void;
  onCancel:  () => void;
}) {
  const isDanger = action === 'desactivar' || action === 'stock_off';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700 p-6">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">Confirmar acción</h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">{CONFIRM_MESSAGES[action](count)}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${
              isDanger ? 'bg-red-600 hover:bg-red-500' : 'bg-teal-600 hover:bg-teal-500'
            }`}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── UndoToast ─────────────────────────────────────────────────────────────────

function UndoToast({ message, onUndo, onDismiss }: {
  message:   string;
  onUndo:    () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-slate-900 shadow-2xl ring-1 ring-slate-700 px-4 py-3 max-w-xs">
      <p className="text-sm text-slate-200 flex-1 min-w-0 truncate">{message}</p>
      <button
        onClick={onUndo}
        className="shrink-0 text-teal-400 text-sm font-semibold hover:text-teal-300 transition-colors whitespace-nowrap"
      >
        Deshacer
      </button>
      <button onClick={onDismiss} className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors">
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ── QualityPanel ──────────────────────────────────────────────────────────────

interface QualityPanelProps {
  stats:           CatalogQualityStats;
  onFilterActiva?: (v: boolean | undefined) => void;
  onFilterStock?:  (v: boolean | undefined) => void;
}

function QualityPanel({ stats, onFilterActiva, onFilterStock }: QualityPanelProps) {
  if (stats.total === 0) return null;
  const pct = stats.cobertura_pct;

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-6 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-[190px]">
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
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">{stats.matched} / {stats.total} productos</p>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-2 flex-wrap text-xs">
          {stats.sin_imagen > 0 && (
            <Chip color="amber" label={`${stats.sin_imagen} sin imagen`} />
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

// ── OfferingRow ───────────────────────────────────────────────────────────────

interface OfferingRowProps {
  item:     PortalOffering;
  selected: boolean;
  checked:  boolean;
  canMatch: boolean;
  onOpen:   (tab?: SlideTab) => void;
  onCheck:  (e: React.MouseEvent) => void;
}

function OfferingRow({ item, selected, checked, canMatch, onOpen, onCheck }: OfferingRowProps) {
  const ia      = item.ia_estado as PortalOfferingIAEstado;
  const confPct = item.match_confidence != null ? Math.round(item.match_confidence * 100) : null;

  return (
    <tr
      onClick={() => onOpen('datos')}
      className={`cursor-pointer transition-all ${
        selected
          ? 'bg-teal-50 dark:bg-teal-900/20 shadow-[inset_3px_0_0_#0d9488]'
          : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      {/* Checkbox */}
      <td className="pl-3 pr-1 py-2.5 w-9" onClick={onCheck}>
        <input
          type="checkbox"
          checked={checked}
          onChange={() => {}}
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-teal-600 cursor-pointer"
        />
      </td>

      {/* Imagen mini */}
      <td className="px-1 py-2.5 w-10">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-8 w-8 rounded-md object-cover border border-slate-200 dark:border-slate-700" />
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
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${item.activa ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
          <span className="font-mono text-xs text-slate-400 shrink-0 truncate">{item.supplier_ref ?? '—'}</span>
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

      {/* Estado IA compacto */}
      <td className="px-2 py-2.5 hidden lg:table-cell w-36 shrink-0">
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${IA_ESTADO_COLORS[ia] ?? ''}`}>
          {IA_ESTADO_LABELS[ia] ?? ia}{confPct != null ? ` · ${confPct}%` : ''}
        </span>
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
  const [search,       setSearch]       = useState('');
  const [matchFilter,  setMatchFilter]  = useState('');
  const [activaFilter, setActivaFilter] = useState<boolean | undefined>(undefined);
  const [stockFilter,  setStockFilter]  = useState<boolean | undefined>(undefined);
  const [sortIdx,      setSortIdx]      = useState(0);
  const [page,         setPage]         = useState(0);

  // SlideOver
  const [selectedOff, setSelectedOff] = useState<PortalOffering | null>(null);
  const [slideTab,    setSlideTab]    = useState<SlideTab>('datos');

  // MVP-2.2: Multi-select
  const [selectedIds,   setSelectedIds]   = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [bulkLoading,   setBulkLoading]   = useState(false);
  const [undoInfo,      setUndoInfo]      = useState<{ message: string; undo: () => Promise<void> } | null>(null);
  const undoTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const LIMIT      = 20;
  const sort       = SORT_OPTIONS[sortIdx];
  const canWrite   = membership.permissions.includes('offerings:write');
  const canMatch   = membership.permissions.includes('offerings:match');
  const totalPages = Math.ceil(totalCount / LIMIT);

  const allSelected  = selectedIds.size > 0 && items.length > 0 && items.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const load = useCallback(async (q: string, mf: string, activa: boolean | undefined, stock: boolean | undefined, sBy: SortKey, sDir: 'asc' | 'desc', p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getSupplierOfferingsPaged(actorId, {
        search:     q  || undefined,
        matchState: mf || undefined,
        activa,
        stock,
        sortBy:  sBy,
        sortDir: sDir,
        limit:   LIMIT,
        offset:  p * LIMIT,
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

  // Clear selection on any filter/sort/page change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [search, matchFilter, activaFilter, stockFilter, sortIdx, page]);

  const loadQuality = useCallback(() => {
    getCatalogQualityStats(actorId).then(setQuality).catch(() => {});
  }, [actorId]);

  const loadRecentImports = useCallback(() => {
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
    loadQuality();
  };

  // ── Selección múltiple ────────────────────────────────────────────────────

  const toggleSelect = (e: React.MouseEvent, item: PortalOffering) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else                   next.add(item.id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else             setSelectedIds(new Set(items.map(i => i.id)));
  };

  const executeBulkAction = async (action: BulkAction) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const map: Record<BulkAction, { field: 'activa' | 'stock_disponible'; value: boolean; msg: string }> = {
        activar:    { field: 'activa',           value: true,  msg: `${ids.length} producto${ids.length !== 1 ? 's' : ''} activado${ids.length !== 1 ? 's' : ''}` },
        desactivar: { field: 'activa',           value: false, msg: `${ids.length} producto${ids.length !== 1 ? 's' : ''} desactivado${ids.length !== 1 ? 's' : ''}` },
        stock_on:   { field: 'stock_disponible', value: true,  msg: `${ids.length} producto${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} con stock` },
        stock_off:  { field: 'stock_disponible', value: false, msg: `${ids.length} producto${ids.length !== 1 ? 's' : ''} marcado${ids.length !== 1 ? 's' : ''} sin stock` },
      };
      const { field, value: newValue, msg: successMsg } = map[action];

      const changedIds = items
        .filter(i => selectedIds.has(i.id) && (i[field] as boolean) !== newValue)
        .map(i => i.id);

      const updates = field === 'activa'
        ? { activa: newValue }
        : { stock_disponible: newValue };

      await bulkUpdateOfferings(actorId, ids, updates);
      setItems(prev => prev.map(i => selectedIds.has(i.id) ? { ...i, [field]: newValue } : i));

      if (changedIds.length > 0) {
        const undoValue   = !newValue;
        const undoUpdates = field === 'activa' ? { activa: undoValue } : { stock_disponible: undoValue };
        const capturedField = field;
        if (undoTimer.current) clearTimeout(undoTimer.current);
        setUndoInfo({
          message: successMsg,
          undo: async () => {
            await bulkUpdateOfferings(actorId, changedIds, undoUpdates);
            setItems(prev => prev.map(i => changedIds.includes(i.id) ? { ...i, [capturedField]: undoValue } : i));
            setUndoInfo(null);
            loadQuality();
          },
        });
        undoTimer.current = setTimeout(() => setUndoInfo(null), 5000);
      }

      setSelectedIds(new Set());
      loadQuality();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error en la acción masiva');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleExportSelected = () => {
    const sel = items.filter(i => selectedIds.has(i.id));
    exportOfferingsToCSV(sel, `catalogo-seleccion-${new Date().toISOString().slice(0, 10)}.csv`);
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

    {pendingAction && (
      <ConfirmModal
        action={pendingAction}
        count={selectedIds.size}
        onConfirm={() => { const a = pendingAction; setPendingAction(null); executeBulkAction(a); }}
        onCancel={() => setPendingAction(null)}
      />
    )}

    {undoInfo && (
      <UndoToast
        message={undoInfo.message}
        onUndo={() => { undoInfo.undo().catch(console.error); }}
        onDismiss={() => { if (undoTimer.current) clearTimeout(undoTimer.current); setUndoInfo(null); }}
      />
    )}

    {selectedIds.size > 0 && !pendingAction && (
      <BulkActionBar
        count={selectedIds.size}
        loading={bulkLoading}
        onActivar={() => setPendingAction('activar')}
        onDesactivar={() => setPendingAction('desactivar')}
        onStockOn={() => setPendingAction('stock_on')}
        onStockOff={() => setPendingAction('stock_off')}
        onExport={handleExportSelected}
        onClear={() => setSelectedIds(new Set())}
      />
    )}

    <div className="flex h-full bg-slate-50 dark:bg-slate-950">
      <div className={`flex flex-col flex-1 min-w-0 transition-all ${selectedOff ? 'lg:mr-[440px]' : ''}`}>

        {/* Toolbar */}
        <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3">
          {/* Row 1 */}
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
              {SORT_OPTIONS.map((o, i) => <option key={i} value={i}>{o.label}</option>)}
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

            <select
              value={activaFilter === undefined ? '' : activaFilter ? 'true' : 'false'}
              onChange={e => { setActivaFilter(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(0); }}
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

            <select
              value={stockFilter === undefined ? '' : stockFilter ? 'true' : 'false'}
              onChange={e => { setStockFilter(e.target.value === '' ? undefined : e.target.value === 'true'); setPage(0); }}
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

            {hasActiveFilters && (
              <button
                onClick={() => { setSearch(''); setMatchFilter(''); setActivaFilter(undefined); setStockFilter(undefined); setPage(0); }}
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
                  <th className="pl-3 pr-1 py-2.5 w-9">
                    <IndeterminateCheckbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-1 py-2.5 w-10" />
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
                    checked={selectedIds.has(item.id)}
                    canMatch={canMatch}
                    onOpen={tab => openSlide(item, tab)}
                    onCheck={e => toggleSelect(e, item)}
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
            <span className="text-xs text-slate-400 tabular-nums">{page + 1} / {totalPages}</span>
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
          key={selectedOff.id}
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
