import React, { useEffect, useState } from 'react';
import {
  CartDetail, CartItem, CartProviderSummary, ProviderAlternative,
  getCartProviderSummary, selectOfferingForCartItem, autoSelectProviders,
} from '../../lib/api/marketplace-checkout';

interface Props {
  cart: CartDetail;
  onCartChanged: () => Promise<void>;
  onNext: () => Promise<void>;
}

type Strategy = 'balance' | 'precio' | 'velocidad' | 'consolidar';

const STRATEGY_LABELS: Record<Strategy, string> = {
  balance:    'Equilibrado',
  precio:     'Precio más bajo',
  velocidad:  'Entrega más rápida',
  consolidar: 'Menos proveedores',
};

export default function StepComparar({ cart, onCartChanged, onNext }: Props) {
  const [summary,        setSummary]        = useState<CartProviderSummary[]>([]);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [expandedId,     setExpandedId]     = useState<string | null>(null);
  const [selectingId,    setSelectingId]    = useState<string | null>(null);
  const [autoStrategy,   setAutoStrategy]   = useState<Strategy>('balance');
  const [autoLoading,    setAutoLoading]    = useState(false);
  const [autoResult,     setAutoResult]     = useState<string | null>(null);
  const [proceeding,     setProceeding]     = useState(false);

  const activeItems = cart.items.filter((i) => i.activo);
  const withAlt     = activeItems.filter((i) => i.provider_alternatives.length > 0);
  const noProvider  = activeItems.filter((i) => i.selected_offering_id === null && i.universal_product_id !== null);
  const canProceed  = activeItems.some((i) => i.selected_offering_id !== null);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const s = await getCartProviderSummary(cart.cart.id);
      setSummary(s);
    } catch {
      setSummary([]);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, [cart.cart.id, cart.items]);

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

  const runAutoSelect = async () => {
    setAutoLoading(true);
    setAutoResult(null);
    try {
      const updated = await autoSelectProviders(cart.cart.id, autoStrategy);
      await onCartChanged();
      setAutoResult(`${updated} ${updated === 1 ? 'artículo actualizado' : 'artículos actualizados'}`);
    } catch (e) {
      setAutoResult('Error al auto-seleccionar');
    } finally {
      setAutoLoading(false);
    }
  };

  const handleNext = async () => {
    if (proceeding) return;
    setProceeding(true);
    try { await onNext(); } finally { setProceeding(false); }
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
      {/* ─── Lista de ítems con alternativas ───────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Comparar proveedores
          </h2>
          {noProvider.length > 0 && (
            <span className="text-xs text-amber-600 font-medium">
              {noProvider.length} sin proveedor
            </span>
          )}
        </div>

        {/* Auto-selección */}
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300 shrink-0">Auto-seleccionar:</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STRATEGY_LABELS) as Strategy[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setAutoStrategy(s)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    autoStrategy === s
                      ? 'bg-teal-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {STRATEGY_LABELS[s]}
                </button>
              ))}
            </div>
            <button
              onClick={runAutoSelect}
              disabled={autoLoading || withAlt.length === 0}
              className="ml-auto flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            >
              {autoLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
                </svg>
              )}
              Auto
            </button>
            {autoResult && (
              <span className="text-xs text-teal-600 dark:text-teal-400 font-medium">{autoResult}</span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {activeItems.map((item) => (
            <ItemCompareRow
              key={item.id}
              item={item}
              expanded={expandedId === item.id}
              selecting={selectingId === item.id}
              onToggleExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onSelect={(alt) => selectOffering(item, alt)}
            />
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!canProceed || proceeding}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {proceeding ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : null}
            Confirmar selección →
          </button>
        </div>
      </div>

      {/* ─── Resumen de proveedores ─────────────────────────────────────── */}
      <div className="w-full lg:w-72 shrink-0">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Resumen por proveedor</h3>
          </div>
          {loadingSummary ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2].map((i) => <div key={i} className="h-20 rounded-lg bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : summary.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Selecciona proveedores para ver el resumen.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {summary.map((s) => (
                <ProviderSummaryRow key={s.actor_id} s={s} />
              ))}
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-slate-700 dark:text-slate-300">Total</span>
                  <span className="tabular-nums text-slate-900 dark:text-slate-100">
                    {summary.reduce((acc, s) => acc + s.total_estimado, 0).toFixed(2)} €
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Incluye portes estimados</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ItemCompareRow ────────────────────────────────────────────────────────────

interface ItemCompareRowProps {
  item: CartItem;
  expanded: boolean;
  selecting: boolean;
  onToggleExpand: () => void;
  onSelect: (alt: ProviderAlternative) => void;
}

function ItemCompareRow({ item, expanded, selecting, onToggleExpand, onSelect }: ItemCompareRowProps) {
  const hasAlts = item.provider_alternatives.length > 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="flex items-center gap-3 p-3.5">
        {/* Estado */}
        <div className={`h-2 w-2 rounded-full shrink-0 ${
          item.selected_offering_id ? 'bg-teal-500' : hasAlts ? 'bg-amber-400' : 'bg-slate-300'
        }`} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {item.descripcion_original}
          </p>
          {item.selected_actor_nombre ? (
            <p className="text-xs text-teal-600 dark:text-teal-400 mt-0.5">
              {item.selected_actor_nombre}
              {item.precio_unitario_final != null && (
                <span className="ml-1 text-slate-400">· {item.precio_unitario_final.toFixed(2)} €/{item.unidad}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-0.5">
              {hasAlts ? `${item.provider_alternatives.length} alternativa${item.provider_alternatives.length > 1 ? 's' : ''}` : 'Sin proveedores disponibles'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm tabular-nums text-slate-500">{item.cantidad} {item.unidad}</span>
          {hasAlts && (
            <button
              onClick={onToggleExpand}
              className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              Cambiar
              <svg className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Alternativas expandibles */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2 bg-slate-50 dark:bg-slate-950">
          {item.provider_alternatives.map((alt) => (
            <AlternativeRow
              key={alt.offering_id}
              alt={alt}
              selected={item.selected_offering_id === alt.offering_id}
              selecting={selecting}
              onSelect={() => onSelect(alt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AlternativeRow ────────────────────────────────────────────────────────────

interface AlternativeRowProps {
  alt: ProviderAlternative;
  selected: boolean;
  selecting: boolean;
  onSelect: () => void;
}

function AlternativeRow({ alt, selected, selecting, onSelect }: AlternativeRowProps) {
  const scoreColor = alt.score >= 75 ? 'text-emerald-600' : alt.score >= 50 ? 'text-amber-600' : 'text-slate-500';

  return (
    <div className={`flex items-center gap-3 rounded-lg p-3 transition-colors cursor-pointer border ${
      selected
        ? 'border-teal-400 bg-teal-50 dark:bg-teal-950/30'
        : 'border-transparent bg-white dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-900 hover:border-slate-200 dark:hover:border-slate-700'
    }`}
      onClick={selecting ? undefined : onSelect}
    >
      {/* Score */}
      <div className="shrink-0 text-center">
        <p className={`text-lg font-black tabular-nums leading-none ${scoreColor}`}>{alt.score}</p>
        <p className="text-[10px] text-slate-400 leading-none">pts</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{alt.actor_nombre}</p>
          {alt.actor_verificado && (
            <svg className="h-3.5 w-3.5 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`flex items-center gap-0.5 text-[10px] ${alt.stock_ok ? 'text-emerald-600' : 'text-slate-400'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${alt.stock_ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            {alt.stock_ok ? 'En stock' : 'Sin stock'}
          </span>
          <span className="text-[10px] text-slate-400">·</span>
          <span className="text-[10px] text-slate-400">{alt.delivery_days}d entrega</span>
          {alt.portes_gratis_desde != null && (
            <>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-400">Gratis +{alt.portes_gratis_desde}€</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        {alt.precio_coste != null ? (
          <>
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {alt.precio_coste.toFixed(2)} €
            </p>
            <p className="text-[10px] text-slate-400">/{alt.unidad}</p>
          </>
        ) : (
          <p className="text-xs text-slate-400">Sin precio</p>
        )}
      </div>

      {selected && (
        <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-teal-500">
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── ProviderSummaryRow ────────────────────────────────────────────────────────

function ProviderSummaryRow({ s }: { s: CartProviderSummary }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{s.actor_nombre}</p>
          {s.actor_verificado && (
            <svg className="h-3.5 w-3.5 text-teal-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          )}
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 shrink-0">
          {s.total_estimado.toFixed(2)} €
        </span>
      </div>
      <div className="flex justify-between text-xs text-slate-400">
        <span>{s.items_count} artículo{s.items_count !== 1 ? 's' : ''} · {s.delivery_days}d</span>
        {s.portes > 0 && <span>+{s.portes.toFixed(2)} € portes</span>}
        {s.portes === 0 && <span className="text-emerald-600">Portes gratis</span>}
      </div>
    </div>
  );
}
