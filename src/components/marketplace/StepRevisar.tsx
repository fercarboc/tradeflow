import React, { useEffect, useRef, useState } from 'react';
import {
  CartDetail, CartItem, CartProviderSummary, AIAnalysisSuggestion, ProviderAlternative,
  analyzeCartWithAI, updateCartItem, addCartItem, selectOfferingForCartItem,
  autoSelectProviders, getCartProviderSummary,
  AI_TIPO_LABELS, AI_TIPO_COLORS,
} from '../../lib/api/marketplace-checkout';

interface Props {
  cart: CartDetail;
  onCartChanged: () => Promise<void>;
  onNext: () => Promise<void>;
}

type Strategy = 'balance' | 'precio' | 'velocidad' | 'consolidar';

const STRATEGY_OPTS: { id: Strategy; label: string }[] = [
  { id: 'balance',    label: 'Mejor opción' },
  { id: 'precio',     label: 'Menor precio' },
  { id: 'velocidad',  label: 'Más rápido' },
  { id: 'consolidar', label: 'Un solo proveedor' },
];

// ─── Componentes externos (nunca definir dentro del padre) ────────────────────

interface StrategyBarProps {
  strategy: Strategy;
  loading: boolean;
  disabled: boolean;
  result: string | null;
  onStrategyChange: (s: Strategy) => void;
  onApply: () => void;
}

function StrategyBar({ strategy, loading, disabled, result, onStrategyChange, onApply }: StrategyBarProps) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Criterio de selección de proveedor">
          {STRATEGY_OPTS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onStrategyChange(opt.id)}
              aria-pressed={strategy === opt.id}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                strategy === opt.id
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={onApply}
          disabled={disabled || loading}
          aria-label="Aplicar criterio de selección"
          className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          {loading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          )}
          Aplicar
        </button>
      </div>
      {loading && (
        <p className="mt-2 text-xs text-slate-400" aria-live="polite">Seleccionando mejores proveedores...</p>
      )}
      {result && !loading && (
        <p className="mt-2 text-xs text-teal-600 dark:text-teal-400 font-medium" aria-live="polite">{result}</p>
      )}
    </div>
  );
}

// ─── Indicador de calidad derivado de los datos de la alternativa ─────────────

function deriveRankingLabel(
  alt: ProviderAlternative,
  idx: number,
  all: ProviderAlternative[],
): { label: string; colorClass: string } {
  if (!alt.stock_ok) {
    return { label: 'Sin stock', colorClass: 'text-amber-600' };
  }
  if (idx === 0) {
    // Primera posición: explicar por qué
    if (all.some(a => !a.stock_ok)) {
      return { label: 'Stock confirmado', colorClass: 'text-emerald-600' };
    }
    if (alt.precio_coste != null && all.some(a => a.precio_coste != null && a.precio_coste > alt.precio_coste!)) {
      return { label: 'Mejor precio', colorClass: 'text-[#1A5A96]' };
    }
    if (all.some(a => a.delivery_days > alt.delivery_days)) {
      return { label: 'Entrega más rápida', colorClass: 'text-amber-600' };
    }
    return { label: 'Recomendado', colorClass: 'text-emerald-600' };
  }
  // Otras posiciones: indicador contextual
  if (alt.delivery_days === Math.min(...all.map(a => a.delivery_days)) && all.some(a => a.delivery_days > alt.delivery_days)) {
    return { label: 'Más rápido', colorClass: 'text-amber-600' };
  }
  return { label: '', colorClass: '' };
}

function QualityLabel({ alt, idx, all }: { alt: ProviderAlternative; idx: number; all: ProviderAlternative[] }) {
  const { label, colorClass } = deriveRankingLabel(alt, idx, all);
  if (!label) return null;
  return (
    <span className={`flex items-center gap-1 text-[10px] font-medium ${colorClass}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── Confirm de sustitución de proveedor ──────────────────────────────────────

interface ConfirmSubstProps {
  currentName: string;
  newName:     string;
  onConfirm:   () => void;
  onCancel:    () => void;
}

function ConfirmSubstModal({ currentName, newName, onConfirm, onCancel }: ConfirmSubstProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} aria-hidden />
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4 border border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Cambiar proveedor</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Se sustituirá{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{currentName}</span>{' '}
            por{' '}
            <span className="font-semibold text-teal-600">{newName}</span>.{' '}
            La cantidad se conserva.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            Confirmar
          </button>
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Fila de alternativa de proveedor ─────────────────────────────────────────

interface AlternativeRowProps {
  alt:      ProviderAlternative;
  allAlts:  ProviderAlternative[];
  idx:      number;
  selected: boolean;
  selecting: boolean;
  onSelect: () => void;
}

function AlternativeRow({ alt, allAlts, idx, selected, selecting, onSelect }: AlternativeRowProps) {
  return (
    <button
      onClick={selecting ? undefined : onSelect}
      disabled={selecting}
      aria-pressed={selected}
      className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 border ${
        selected
          ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
          : 'border-transparent bg-white dark:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{alt.actor_nombre}</span>
          {alt.actor_verificado && (
            <svg className="h-3.5 w-3.5 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-label="Proveedor verificado">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <QualityLabel alt={alt} idx={idx} all={allAlts} />
          <span className={`text-[10px] ${alt.stock_ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            {alt.stock_ok ? 'En stock' : 'Sin stock'}
          </span>
          <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
          <span className="text-[10px] text-slate-400">{alt.delivery_days}d entrega</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        {alt.precio_coste != null ? (
          <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {alt.precio_coste.toFixed(2)} €
            <span className="text-xs font-normal text-slate-400 ml-0.5">/{alt.unidad}</span>
          </p>
        ) : (
          <p className="text-xs text-slate-400">Sin precio</p>
        )}
      </div>
      {selected && (
        <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500" aria-hidden="true">
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        </div>
      )}
    </button>
  );
}

// ─── Línea de material ────────────────────────────────────────────────────────

interface MaterialLineProps {
  item:          CartItem;
  isFromQuote:   boolean;
  expanded:      boolean;
  toggling:      boolean;
  selecting:     boolean;
  editing:       boolean;
  editQty:       string;
  onToggle:      () => void;
  onToggleExpand: () => void;
  onEditStart:   () => void;
  onEditChange:  (v: string) => void;
  onEditSave:    () => void;
  onEditCancel:  () => void;
  onSelectAlt:   (alt: ProviderAlternative) => void;
}

function MaterialLine({
  item, isFromQuote, expanded, toggling, selecting, editing, editQty,
  onToggle, onToggleExpand, onEditStart, onEditChange, onEditSave, onEditCancel, onSelectAlt,
}: MaterialLineProps) {
  const hasAlts    = item.provider_alternatives.length > 0;
  const hasProvider = item.selected_offering_id !== null;

  return (
    <div className={`rounded-xl border transition-colors ${
      item.activo
        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60'
    }`}>
      <div className="flex items-center gap-3 p-3.5">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={toggling}
          role="checkbox"
          aria-checked={item.activo}
          aria-label={`${item.activo ? 'Desactivar' : 'Activar'} ${item.descripcion_original}`}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:opacity-50 ${
            item.activo
              ? 'border-teal-500 bg-teal-500'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
          }`}
        >
          {item.activo && (
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
            </svg>
          )}
        </button>

        {/* Thumbnail */}
        {item.image_url ? (
          <img
            src={item.image_url}
            alt=""
            className="h-9 w-9 shrink-0 rounded-md object-cover border border-slate-200 dark:border-slate-700 hidden sm:block"
          />
        ) : (
          <div className="h-9 w-9 shrink-0 rounded-md border border-dashed border-slate-200 dark:border-slate-700 hidden sm:flex items-center justify-center bg-slate-50 dark:bg-slate-800">
            <svg className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
          </div>
        )}

        {/* Descripción + proveedor */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug flex-1 min-w-0">
              {item.descripcion_original}
            </p>
            {isFromQuote && item.source_item_type === 'quote_item' && (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#1A5A96]/10 text-[#1A5A96] border border-[#1A5A96]/20">
                Del presupuesto
              </span>
            )}
            {item.ia_añadido && item.ia_tipo && (
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${AI_TIPO_COLORS[item.ia_tipo]}`}>
                {AI_TIPO_LABELS[item.ia_tipo]}
              </span>
            )}
          </div>
          {hasProvider ? (
            <p className="mt-0.5 text-xs text-teal-600 dark:text-teal-400">
              {item.selected_actor_nombre}
              {item.precio_unitario_final != null && (
                <span className="text-slate-400 ml-1">· {item.precio_unitario_final.toFixed(2)} €/{item.unidad}</span>
              )}
            </p>
          ) : hasAlts ? (
            <p className="mt-0.5 text-xs text-amber-500">
              {item.provider_alternatives.length} alternativa{item.provider_alternatives.length > 1 ? 's' : ''} disponible{item.provider_alternatives.length > 1 ? 's' : ''}
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-400">Sin proveedores disponibles</p>
          )}
        </div>

        {/* Cantidad editable */}
        <div className="shrink-0 text-right">
          {editing ? (
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0.01"
                step="any"
                value={editQty}
                onChange={(e) => onEditChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
                autoFocus
                aria-label="Cantidad"
                className="w-16 rounded border border-teal-400 px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
              <button
                onClick={onEditSave}
                className="text-teal-600 hover:text-teal-500 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded"
              >
                OK
              </button>
            </div>
          ) : (
            <button
              onClick={onEditStart}
              title="Editar cantidad"
              aria-label={`Cantidad: ${item.cantidad} ${item.unidad}. Pulsar para editar`}
              className="text-sm tabular-nums text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded"
            >
              {item.cantidad} {item.unidad}
            </button>
          )}
          {item.total_linea != null && item.activo && !editing && (
            <p className="text-xs text-slate-400 tabular-nums mt-0.5">{item.total_linea.toFixed(2)} €</p>
          )}
        </div>

        {/* Cambiar proveedor */}
        {hasAlts && item.activo && (
          <button
            onClick={onToggleExpand}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Cerrar' : 'Cambiar'} proveedor de ${item.descripcion_original}`}
            className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0"
          >
            Cambiar
            <svg
              className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Panel de alternativas */}
      {expanded && hasAlts && (
        <div
          className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50 dark:bg-slate-950"
          role="listbox"
          aria-label="Proveedores disponibles"
        >
          {item.provider_alternatives.map((alt, idx) => (
            <AlternativeRow
              key={alt.offering_id}
              alt={alt}
              allAlts={item.provider_alternatives}
              idx={idx}
              selected={item.selected_offering_id === alt.offering_id}
              selecting={selecting}
              onSelect={() => onSelectAlt(alt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sugerencia IA ────────────────────────────────────────────────────────────

interface AISuggestionRowProps {
  sug: AIAnalysisSuggestion;
  accepting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function AISuggestionRow({ sug, accepting, onAccept, onDismiss }: AISuggestionRowProps) {
  const isAddable = sug.accion === 'add_item';
  const icon = sug.tipo === 'consumible' ? '🔧' : sug.tipo === 'faltante' ? '⚠️' : '💡';

  return (
    <div className="flex items-start gap-3 rounded-lg border border-teal-200 dark:border-teal-800/60 bg-teal-50 dark:bg-teal-950/40 p-3">
      <span className="text-base shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{sug.titulo}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{sug.descripcion}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isAddable && (
          <button
            onClick={onAccept}
            disabled={accepting}
            className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {accepting ? 'Añadiendo...' : '+ Añadir'}
          </button>
        )}
        <button
          onClick={onDismiss}
          aria-label="Ignorar sugerencia"
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500 rounded"
        >
          Ignorar
        </button>
      </div>
    </div>
  );
}

// ─── Resumen por proveedor (pie de página) ────────────────────────────────────

interface ProviderSummaryLineProps { s: CartProviderSummary }

function ProviderSummaryLine({ s }: ProviderSummaryLineProps) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
      <span className="flex items-center gap-1 truncate">
        {s.actor_nombre}
        {s.actor_verificado && (
          <svg className="h-3 w-3 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-label="Verificado">
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )}
        <span className="text-slate-400">· {s.delivery_days}d</span>
        {s.portes > 0 && <span className="text-slate-400">· +{s.portes.toFixed(2)} € portes</span>}
        {s.portes === 0 && <span className="text-emerald-600">· Portes gratis</span>}
      </span>
      <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300 shrink-0 ml-2">
        {s.total_estimado.toFixed(2)} €
      </span>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function StepRevisar({ cart, onCartChanged, onNext }: Props) {
  const [strategy,     setStrategy]     = useState<Strategy>('balance');
  const [autoLoading,  setAutoLoading]  = useState(false);
  const [autoResult,   setAutoResult]   = useState<string | null>(null);
  const [suggestions,  setSuggestions]  = useState<AIAnalysisSuggestion[]>([]);
  const [dismissed,    setDismissed]    = useState<Set<number>>(new Set());
  const [loadingAI,    setLoadingAI]    = useState(false);
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);
  const [selectingId,  setSelectingId]  = useState<string | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editQty,      setEditQty]      = useState('');
  const [summary,      setSummary]      = useState<CartProviderSummary[]>([]);
  const [proceeding,   setProceeding]   = useState(false);
  // Confirmación antes de sustituir proveedor (Fase 6 RC1-C.2)
  const [confirmSubst, setConfirmSubst] = useState<{
    item: CartItem; alt: ProviderAlternative; currentName: string;
  } | null>(null);
  const didAutoSelect = useRef(false);

  const isFromQuote = cart.cart.source_type === 'quote';

  const activeItems  = cart.items.filter((i) => i.activo);
  const withProvider = activeItems.filter((i) => i.selected_offering_id !== null);
  const canProceed   = withProvider.length > 0;

  // Auto-selección al primer montaje si hay items sin proveedor
  useEffect(() => {
    if (didAutoSelect.current) return;
    const needsAutoSelect = activeItems.some(
      (i) => i.selected_offering_id === null && i.provider_alternatives.length > 0
    );
    if (!needsAutoSelect) return;
    didAutoSelect.current = true;
    setAutoLoading(true);
    autoSelectProviders(cart.cart.id, 'balance')
      .then(() => onCartChanged())
      .catch(() => {})
      .finally(() => setAutoLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.cart.id]);

  // Sugerencias IA
  useEffect(() => {
    if (cart.items.length === 0) return;
    setLoadingAI(true);
    analyzeCartWithAI(cart.cart.id)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingAI(false));
  }, [cart.cart.id]);

  // Resumen de proveedores para totales
  useEffect(() => {
    getCartProviderSummary(cart.cart.id)
      .then(setSummary)
      .catch(() => setSummary([]));
  }, [cart.cart.id, cart.items]);

  const applyStrategy = async () => {
    setAutoLoading(true);
    setAutoResult(null);
    try {
      const updated = await autoSelectProviders(cart.cart.id, strategy);
      await onCartChanged();
      setAutoResult(updated > 0
        ? `${updated} ${updated === 1 ? 'artículo actualizado' : 'artículos actualizados'}`
        : 'Sin cambios — ya estaban en la mejor opción');
    } catch {
      setAutoResult('No se pudo aplicar. Inténtalo de nuevo.');
    } finally {
      setAutoLoading(false);
    }
  };

  const toggleItem = async (item: CartItem) => {
    setTogglingId(item.id);
    try {
      await updateCartItem({ itemId: item.id, activo: !item.activo });
      await onCartChanged();
    } finally {
      setTogglingId(null);
    }
  };

  const saveQty = async (item: CartItem) => {
    const qty = parseFloat(editQty);
    if (!isNaN(qty) && qty > 0) {
      setTogglingId(item.id);
      try {
        await updateCartItem({ itemId: item.id, cantidad: qty });
        await onCartChanged();
      } finally {
        setTogglingId(null);
      }
    }
    setEditingId(null);
  };

  const selectOffering = async (item: CartItem, alt: ProviderAlternative) => {
    setSelectingId(item.id);
    try {
      await selectOfferingForCartItem(item.id, alt.offering_id);
      await onCartChanged();
      setExpandedId(null);
    } finally {
      setSelectingId(null);
    }
  };

  // Solicitar confirmación antes de sustituir si el ítem ya tiene proveedor asignado
  const requestSelectOffering = (item: CartItem, alt: ProviderAlternative) => {
    if (
      item.selected_actor_nombre &&
      item.selected_offering_id !== alt.offering_id
    ) {
      setConfirmSubst({ item, alt, currentName: item.selected_actor_nombre });
    } else {
      void selectOffering(item, alt);
    }
  };

  const acceptSuggestion = async (idx: number, sug: AIAnalysisSuggestion) => {
    if (sug.accion !== 'add_item') {
      setDismissed((prev) => new Set([...prev, idx]));
      return;
    }
    setAcceptingIdx(idx);
    try {
      const payload = sug.payload as { descripcion?: string; cantidad?: number; unidad?: string };
      await addCartItem({
        cartId:       cart.cart.id,
        descripcion:  payload.descripcion ?? sug.descripcion,
        cantidad:     payload.cantidad ?? 1,
        unidad:       payload.unidad ?? 'ud',
        iaTipo:       'consumible',
        iaSugerencia: sug.descripcion,
        iaAñadido:    true,
      });
      await onCartChanged();
      setDismissed((prev) => new Set([...prev, idx]));
    } finally {
      setAcceptingIdx(null);
    }
  };

  const handleNext = async () => {
    if (proceeding || !canProceed) return;
    setProceeding(true);
    try { await onNext(); } finally { setProceeding(false); }
  };

  const visibleSuggestions = suggestions.filter(
    (s, idx) => !dismissed.has(idx) && s.tipo !== 'precio_alto'
  );

  const grandTotal    = summary.reduce((acc, s) => acc + s.total_estimado, 0);
  const maxDelivery   = summary.length > 0 ? Math.max(...summary.map((s) => s.delivery_days)) : null;
  const hasAltsGlobal = activeItems.some((i) => i.provider_alternatives.length > 0);

  return (
    <div className="flex flex-col min-h-full">
      {/* Contenido principal con scroll */}
      <div className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl p-4 pb-6 space-y-4">

          {/* Selector de estrategia */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
            <StrategyBar
              strategy={strategy}
              loading={autoLoading}
              disabled={!hasAltsGlobal}
              result={autoResult}
              onStrategyChange={(s) => { setStrategy(s); setAutoResult(null); }}
              onApply={applyStrategy}
            />
          </div>

          {/* Lista de materiales */}
          <div className="space-y-2" role="list" aria-label="Materiales del pedido">
            {cart.items.length === 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
                <p className="text-sm text-slate-500">No hay materiales en este pedido.</p>
              </div>
            )}
            {cart.items.map((item) => (
              <div key={item.id} role="listitem">
                <MaterialLine
                  item={item}
                  isFromQuote={isFromQuote}
                  expanded={expandedId === item.id}
                  toggling={togglingId === item.id}
                  selecting={selectingId === item.id}
                  editing={editingId === item.id}
                  editQty={editQty}
                  onToggle={() => toggleItem(item)}
                  onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  onEditStart={() => { setEditingId(item.id); setEditQty(String(item.cantidad)); }}
                  onEditChange={setEditQty}
                  onEditSave={() => saveQty(item)}
                  onEditCancel={() => setEditingId(null)}
                  onSelectAlt={(alt) => requestSelectOffering(item, alt)}
                />
              </div>
            ))}
          </div>

          {/* Sugerencias IA */}
          {(loadingAI || visibleSuggestions.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">Sugerencias</p>
              {loadingAI ? (
                <div className="space-y-2 animate-pulse" aria-busy="true" aria-label="Cargando sugerencias">
                  {[1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : (
                visibleSuggestions.map((sug, idx) => (
                  <AISuggestionRow
                    key={idx}
                    sug={sug}
                    accepting={acceptingIdx === idx}
                    onAccept={() => acceptSuggestion(idx, sug)}
                    onDismiss={() => setDismissed((prev) => new Set([...prev, idx]))}
                  />
                ))
              )}
            </div>
          )}

          {/* CTA desktop (oculto en móvil donde el sticky lo sustituye) */}
          <div className="hidden sm:block">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              {summary.length > 0 && (
                <div className="space-y-1 mb-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                  {summary.map((s) => <ProviderSummaryLine key={s.actor_id} s={s} />)}
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-black tabular-nums text-slate-900 dark:text-slate-100">
                    {grandTotal > 0 ? `${grandTotal.toFixed(2)} €` : '—'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {withProvider.length} de {activeItems.length} artículos asignados
                    {maxDelivery != null ? ` · ${maxDelivery}d entrega estimada` : ''}
                  </p>
                </div>
                <button
                  onClick={handleNext}
                  disabled={!canProceed || proceeding}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0"
                >
                  {proceeding ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                      Cargando...
                    </>
                  ) : 'Revisar pedido →'}
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CTA sticky móvil */}
      <div className="sm:hidden shrink-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-base font-black tabular-nums text-slate-900 dark:text-slate-100">
              {grandTotal > 0 ? `${grandTotal.toFixed(2)} €` : '—'}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {withProvider.length} de {activeItems.length} artículos
              {maxDelivery != null ? ` · ${maxDelivery}d est.` : ''}
            </p>
          </div>
          <button
            onClick={handleNext}
            disabled={!canProceed || proceeding}
            aria-live="polite"
            className="flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 shrink-0"
          >
            {proceeding ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
            ) : null}
            {proceeding ? 'Cargando...' : 'Revisar →'}
          </button>
        </div>
      </div>

      {/* Modal confirm sustitución de proveedor */}
      {confirmSubst && (
        <ConfirmSubstModal
          currentName={confirmSubst.currentName}
          newName={confirmSubst.alt.actor_nombre}
          onConfirm={async () => {
            const { item, alt } = confirmSubst;
            setConfirmSubst(null);
            await selectOffering(item, alt);
          }}
          onCancel={() => setConfirmSubst(null)}
        />
      )}
    </div>
  );
}
