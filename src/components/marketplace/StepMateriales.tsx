import React, { useEffect, useState } from 'react';
import {
  CartDetail, CartItem, AIAnalysisSuggestion,
  analyzeCartWithAI, addCartItem, updateCartItem,
  AI_TIPO_LABELS, AI_TIPO_COLORS,
} from '../../lib/api/marketplace-checkout';

interface Props {
  cart: CartDetail;
  onCartChanged: () => Promise<void>;
  onNext: () => Promise<void>;
}

export default function StepMateriales({ cart, onCartChanged, onNext }: Props) {
  const [suggestions,  setSuggestions]  = useState<AIAnalysisSuggestion[]>([]);
  const [dismissed,    setDismissed]    = useState<Set<number>>(new Set());
  const [loadingAI,    setLoadingAI]    = useState(false);
  const [acceptingIdx, setAcceptingIdx] = useState<number | null>(null);
  const [togglingId,   setTogglingId]   = useState<string | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editQty,      setEditQty]      = useState('');
  const [proceeding,   setProceeding]   = useState(false);

  const activeItems = cart.items.filter((i) => i.activo);
  const hasItems    = activeItems.length > 0;

  useEffect(() => {
    if (cart.items.length === 0) return;
    setLoadingAI(true);
    analyzeCartWithAI(cart.cart.id)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingAI(false));
  }, [cart.cart.id]);

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

  const acceptSuggestion = async (idx: number, sug: AIAnalysisSuggestion) => {
    if (sug.accion !== 'add_item') {
      setDismissed((prev) => new Set([...prev, idx]));
      return;
    }
    setAcceptingIdx(idx);
    try {
      const payload = sug.payload as { descripcion?: string; cantidad?: number; unidad?: string };
      await addCartItem({
        cartId:      cart.cart.id,
        descripcion: payload.descripcion ?? sug.descripcion,
        cantidad:    payload.cantidad ?? 1,
        unidad:      payload.unidad ?? 'ud',
        iaTipo:      'consumible',
        iaSugerencia: sug.descripcion,
        iaAñadido:   true,
      });
      await onCartChanged();
      setDismissed((prev) => new Set([...prev, idx]));
    } finally {
      setAcceptingIdx(null);
    }
  };

  const dismiss = (idx: number) => {
    setDismissed((prev) => new Set([...prev, idx]));
  };

  const handleNext = async () => {
    if (proceeding || !hasItems) return;
    setProceeding(true);
    try {
      await onNext();
    } finally {
      setProceeding(false);
    }
  };

  const visibleSuggestions = suggestions.filter(
    (_, idx) => !dismissed.has(idx) && suggestions[idx].tipo !== 'precio_alto'
  );

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 flex flex-col lg:flex-row gap-6">
      {/* ─── Lista de materiales ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Materiales a pedir
          </h2>
          <span className="text-xs text-slate-400 tabular-nums">
            {activeItems.length} de {cart.items.length} seleccionados
          </span>
        </div>

        {cart.items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-500">No se encontraron materiales en este carrito.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.items.map((item) => (
              <MaterialRow
                key={item.id}
                item={item}
                toggling={togglingId === item.id}
                editing={editingId === item.id}
                editQty={editQty}
                onToggle={() => toggleItem(item)}
                onEditStart={() => { setEditingId(item.id); setEditQty(String(item.cantidad)); }}
                onEditChange={setEditQty}
                onEditSave={() => saveQty(item)}
                onEditCancel={() => setEditingId(null)}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleNext}
            disabled={!hasItems || proceeding}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {proceeding ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Cargando...
              </>
            ) : (
              <>Comparar proveedores →</>
            )}
          </button>
        </div>
      </div>

      {/* ─── Panel IA ─────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-80 shrink-0">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-3">
            <div className="flex items-center gap-1.5 rounded-full bg-teal-900/10 px-2 py-0.5">
              <svg className="h-3 w-3 text-teal-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 010 2h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 010-2h1a7 7 0 017-7h1V5.73A2 2 0 0112 2z" />
              </svg>
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400">Asistente IA</span>
            </div>
          </div>

          {loadingAI ? (
            <div className="p-4 space-y-2 animate-pulse">
              {[1, 2].map((i) => <div key={i} className="h-16 rounded-lg bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : visibleSuggestions.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-slate-400">Sin sugerencias adicionales para este carrito.</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {visibleSuggestions.map((sug, idx) => (
                <AISuggestionCard
                  key={idx}
                  sug={sug}
                  accepting={acceptingIdx === idx}
                  onAccept={() => acceptSuggestion(idx, sug)}
                  onDismiss={() => dismiss(idx)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Resumen rápido */}
        {cart.summary.total_estimado > 0 && (
          <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-400 mb-3">Resumen estimado</p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Materiales activos</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {activeItems.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Con proveedor</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">
                  {cart.summary.items_con_proveedor}
                </span>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-800 pt-1.5 flex justify-between text-sm font-semibold">
                <span className="text-slate-700 dark:text-slate-300">Total estimado</span>
                <span className="tabular-nums text-teal-600 dark:text-teal-400">
                  {cart.summary.total_estimado.toFixed(2)} €
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MaterialRow ─────────────────────────────────────────────────────────────

interface MaterialRowProps {
  item: CartItem;
  toggling: boolean;
  editing: boolean;
  editQty: string;
  onToggle: () => void;
  onEditStart: () => void;
  onEditChange: (v: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function MaterialRow({
  item, toggling, editing, editQty,
  onToggle, onEditStart, onEditChange, onEditSave, onEditCancel,
}: MaterialRowProps) {
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3.5 transition-colors ${
      item.activo
        ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
        : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 opacity-60'
    }`}>
      {/* Checkbox toggle */}
      <button
        onClick={onToggle}
        disabled={toggling}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
          item.activo
            ? 'border-teal-500 bg-teal-500'
            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
        } disabled:opacity-50`}
      >
        {item.activo && (
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug flex-1">
            {item.descripcion_original}
          </p>
          {item.ia_añadido && item.ia_tipo && (
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${AI_TIPO_COLORS[item.ia_tipo]}`}>
              {AI_TIPO_LABELS[item.ia_tipo]}
            </span>
          )}
        </div>

        {item.up_nombre_canonico && (
          <p className="mt-0.5 text-xs text-slate-400 truncate">
            {item.up_nombre_canonico}
            {item.up_familia && <span className="ml-1 opacity-60">· {item.up_familia}</span>}
          </p>
        )}

        {item.selected_actor_nombre && (
          <p className="mt-1 text-xs text-teal-600 dark:text-teal-400">
            Proveedor: {item.selected_actor_nombre}
            {item.precio_unitario_final != null && (
              <span className="ml-1 text-slate-400 dark:text-slate-500">
                · {item.precio_unitario_final.toFixed(2)} €/{item.unidad}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Cantidad */}
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
              className="w-16 rounded border border-teal-400 px-1.5 py-0.5 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <button onClick={onEditSave}
              className="text-teal-600 hover:text-teal-500 text-xs font-medium">OK</button>
          </div>
        ) : (
          <button
            onClick={onEditStart}
            className="text-sm tabular-nums text-slate-700 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors font-medium"
            title="Editar cantidad"
          >
            {item.cantidad} {item.unidad}
          </button>
        )}
        {item.total_linea != null && item.activo && (
          <p className="text-xs text-slate-400 tabular-nums mt-0.5">{item.total_linea.toFixed(2)} €</p>
        )}
      </div>
    </div>
  );
}

// ─── AISuggestionCard ─────────────────────────────────────────────────────────

interface AISuggestionCardProps {
  sug: AIAnalysisSuggestion;
  accepting: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}

function AISuggestionCard({ sug, accepting, onAccept, onDismiss }: AISuggestionCardProps) {
  const isAddable = sug.accion === 'add_item';
  return (
    <div className="rounded-lg border border-teal-100 dark:border-teal-900/40 bg-teal-50 dark:bg-teal-950/30 p-3">
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base leading-none shrink-0 mt-0.5">
          {sug.tipo === 'consumible'   ? '🔧'
          : sug.tipo === 'faltante'   ? '⚠️'
          : sug.tipo === 'optimizacion' ? '💡' : '🤖'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{sug.titulo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{sug.descripcion}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onDismiss}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Ignorar
        </button>
        {isAddable && (
          <button
            onClick={onAccept}
            disabled={accepting}
            className="flex items-center gap-1 rounded-md bg-teal-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
          >
            {accepting ? 'Añadiendo...' : '+ Añadir'}
          </button>
        )}
      </div>
    </div>
  );
}
