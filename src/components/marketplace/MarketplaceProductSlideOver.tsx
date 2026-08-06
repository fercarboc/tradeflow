import { useEffect, useRef, useState } from 'react';
import { X, Package, Truck, ShieldCheck, Plus, Loader2, Star, Info } from 'lucide-react';
import type { MarketplaceCatalogItem, OfferingDetail } from '../../lib/api/marketplace-catalog';
import { getOfferingsForUp } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

// ─── Ranking reason ──────────────────────────────────────────────────────────

const RANKING_REASON_LABEL: Record<string, string> = {
  'in_stock':              'Stock confirmado',
  'best_price':            'Mejor precio',
  'fast_delivery':         'Entrega más rápida',
  'deterministic_tiebreak': '',
};

const RANKING_REASON_COLOR: Record<string, string> = {
  'in_stock':   'bg-emerald-50 text-emerald-700 border border-emerald-200',
  'best_price': 'bg-[#1A5A96]/8 text-[#1A5A96] border border-[#1A5A96]/20',
  'fast_delivery': 'bg-amber-50 text-amber-700 border border-amber-200',
};

// ─── Confirm dialog de sustitución ──────────────────────────────────────────

interface ConfirmSubstProps {
  currentName: string;
  newName:     string;
  onSubstitute: () => void;
  onAddAlso:   () => void;
  onCancel:    () => void;
}

function ConfirmSubstDialog({ currentName, newName, onSubstitute, onAddAlso, onCancel }: ConfirmSubstProps) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm">Cambiar proveedor</h3>
          <p className="mt-1 text-sm text-gray-600 leading-relaxed">
            Se sustituirá <span className="font-semibold text-gray-900">{currentName}</span> por{' '}
            <span className="font-semibold text-[#1A5A96]">{newName}</span>.{' '}
            La cantidad se conserva.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onSubstitute}
            className="w-full rounded-xl bg-[#1A5A96] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#154d82] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
          >
            Sustituir proveedor
          </button>
          <button
            onClick={onAddAlso}
            className="w-full rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            Añadir también (línea separada)
          </button>
          <button
            onClick={onCancel}
            className="w-full text-sm text-gray-400 hover:text-gray-600 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400 rounded"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  item:               MarketplaceCatalogItem | null;
  onClose:            () => void;
  onAdd:              (item: Omit<LocalCartItem, 'cartItemId'>) => void;
  // Opcional: para marcar la offering actualmente seleccionada en el carrito
  currentOfferingId?: string | null;
  currentProviderName?: string | null;
  // Opcional: para sustituir una offering existente en el carrito
  onSubstitute?:      (offering: OfferingDetail, qty: number) => void;
  // Cantidad actual en carrito (para conservar en sustitución)
  currentQty?:        number;
}

// ─── SlideOver principal ─────────────────────────────────────────────────────

export default function MarketplaceProductSlideOver({
  item, onClose, onAdd,
  currentOfferingId, currentProviderName,
  onSubstitute, currentQty,
}: Props) {
  const [offerings,  setOfferings]  = useState<OfferingDetail[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [confirmOffer, setConfirmOffer] = useState<OfferingDetail | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) { setOfferings([]); return; }
    setLoading(true);
    setError(null);
    getOfferingsForUp(item.up_id)
      .then(setOfferings)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar opciones'))
      .finally(() => setLoading(false));
  }, [item?.up_id]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmOffer) setConfirmOffer(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose, confirmOffer]);

  // Cerrar tooltip al hacer click fuera
  useEffect(() => {
    if (!showTooltip) return;
    const handler = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTooltip]);

  const isOpen = item !== null;

  function buildCartItem(o: OfferingDetail): Omit<LocalCartItem, 'cartItemId'> {
    return {
      universalProductId: item!.up_id,
      offeringId:         o.offering_id,
      supplierActorId:    o.actor_id,
      supplierName:       o.actor_nombre,
      supplierRef:        o.supplier_ref,
      nombre:             item!.nombre_canonico,
      imagen:             o.image_url ?? item!.image_url,
      cantidad:           currentQty ?? 1,
      unidadTecnica:      item!.unidad,
      unidadComercial:    o.unidad,
      precioUnitario:     o.precio_coste ?? 0,
      stockDisponible:    o.stock_disponible,
      plazoEntregaDias:   o.plazo_dias,
      sourceType:         'free',
      lineaOrigen:        'manual',
    };
  }

  function handleSelectOffering(o: OfferingDetail) {
    if (!item) return;
    const isCurrentInCart = o.offering_id === currentOfferingId;

    // Ya está seleccionado → no hace nada
    if (isCurrentInCart) return;

    // Si hay una offering ya seleccionada y se puede sustituir → confirm dialog
    if (currentOfferingId && onSubstitute) {
      setConfirmOffer(o);
      return;
    }

    // Modo libre: añadir directamente
    onAdd(buildCartItem(o));
    onClose();
  }

  function handleSubstitute() {
    if (!confirmOffer || !onSubstitute) return;
    onSubstitute(confirmOffer, currentQty ?? 1);
    setConfirmOffer(null);
    onClose();
  }

  function handleAddAlso() {
    if (!confirmOffer) return;
    onAdd(buildCartItem(confirmOffer));
    setConfirmOffer(null);
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-white border-l border-gray-200 z-50 flex flex-col transform transition-transform duration-300 shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-label={item?.nombre_canonico}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-gray-100 bg-gray-50">
          <div className="w-16 h-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0">
            {item?.image_url ? (
              <img
                src={item.image_url}
                alt={item.nombre_canonico}
                className="w-full h-full object-contain p-2 rounded-xl"
              />
            ) : (
              <Package className="w-8 h-8 text-gray-200" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-gray-400 text-[10px] uppercase tracking-wider">{item?.familia}</p>
            <h2 className="text-gray-900 font-bold text-base leading-tight line-clamp-2">
              {item?.nombre_canonico}
            </h2>
            <p className="text-gray-400 text-xs mt-0.5">
              {item?.offering_count} opción{(item?.offering_count ?? 0) > 1 ? 'es' : ''} disponible{(item?.offering_count ?? 0) > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-600 transition-colors ml-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] rounded"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Subtítulo + tooltip transparencia */}
        <div className="px-5 py-3 border-b border-gray-100 bg-[#1A5A96]/5 flex items-center justify-between gap-3">
          <p className="text-[#1A5A96] text-xs font-semibold">
            Comparativa de proveedores — precio de compra instalador
          </p>
          {/* Botón info */}
          <div className="relative shrink-0" ref={tooltipRef}>
            <button
              onClick={() => setShowTooltip(v => !v)}
              aria-label="Criterio de ordenación"
              className="flex items-center justify-center w-5 h-5 rounded-full text-[#1A5A96]/50 hover:text-[#1A5A96] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] rounded-full"
            >
              <Info className="w-4 h-4" />
            </button>
            {showTooltip && (
              <div className="absolute right-0 top-6 w-60 bg-white border border-gray-200 rounded-xl p-3 shadow-lg z-10 text-xs text-gray-600 leading-relaxed">
                Ordenado por disponibilidad, precio y plazo. La publicidad no modifica esta comparativa.
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#1A5A96] animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm text-center py-8">{error}</p>
          )}

          {!loading && !error && offerings.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-8">Sin opciones disponibles</p>
          )}

          {offerings.map((o, i) => (
            <OfferingRow
              key={o.offering_id}
              offering={o}
              rank={i}
              isSelected={o.offering_id === currentOfferingId}
              hasSubstituteMode={!!(currentOfferingId && onSubstitute)}
              onSelect={() => handleSelectOffering(o)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50">
          <p className="text-gray-400 text-[10px] text-center">
            Precio de compra instalador. Ordenado por stock, precio y plazo.
            La publicidad no modifica esta comparativa.
          </p>
        </div>
      </div>

      {/* Confirm substitution dialog */}
      {confirmOffer && currentProviderName && (
        <ConfirmSubstDialog
          currentName={currentProviderName}
          newName={confirmOffer.actor_nombre}
          onSubstitute={handleSubstitute}
          onAddAlso={handleAddAlso}
          onCancel={() => setConfirmOffer(null)}
        />
      )}
    </>
  );
}

// ─── Fila de offering ────────────────────────────────────────────────────────

interface OfferingRowProps {
  offering:         OfferingDetail;
  rank:             number;
  isSelected:       boolean;
  hasSubstituteMode: boolean;
  onSelect:         () => void;
}

function OfferingRow({ offering: o, rank, isSelected, hasSubstituteMode, onSelect }: OfferingRowProps) {
  const isRecomendado = rank === 0;
  const reason        = o.ranking_reason ?? '';
  const reasonLabel   = RANKING_REASON_LABEL[reason] ?? '';
  const reasonColor   = RANKING_REASON_COLOR[reason] ?? '';

  const ctaLabel = isSelected
    ? 'Seleccionado'
    : hasSubstituteMode
      ? 'Sustituir'
      : 'Añadir al carrito';

  return (
    <div className={`border rounded-xl p-4 flex flex-col gap-3 transition-colors ${
      isSelected
        ? 'bg-emerald-50 border-emerald-200'
        : isRecomendado
          ? 'bg-[#1A5A96]/5 border-[#1A5A96]/20'
          : 'bg-white border-gray-200 hover:border-gray-300'
    }`}>
      {/* Proveedor + precio */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Badges: Recomendado / Seleccionado / ranking reason */}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {isSelected && (
              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-600 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
                </svg>
                Seleccionado
              </span>
            )}
            {!isSelected && isRecomendado && (
              <span className="inline-flex items-center gap-1 text-[9px] bg-[#1A5A96] text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                <Star className="w-2.5 h-2.5" />
                Recomendado
              </span>
            )}
            {reasonLabel && !isSelected && (
              <span className={`inline-flex text-[9px] px-2 py-0.5 rounded-full font-semibold ${reasonColor}`}>
                {reasonLabel}
              </span>
            )}
            {o.actor_verificado && (
              <span className="inline-flex items-center gap-1 text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                <ShieldCheck className="w-2.5 h-2.5" />
                Verificado
              </span>
            )}
          </div>
          <p className="text-gray-900 font-semibold text-sm">{o.actor_nombre}</p>
          {o.supplier_ref && (
            <p className="text-gray-400 text-[10px]">Ref: {o.supplier_ref}</p>
          )}
        </div>

        {/* Precio */}
        <div className="text-right shrink-0">
          <p className={`font-black text-xl tabular-nums leading-none ${
            isSelected ? 'text-emerald-700' : 'text-[#1A5A96]'
          }`}>
            {o.precio_coste != null
              ? o.precio_coste.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
              : '—'}
          </p>
          <p className="text-gray-400 text-[10px]">/{o.unidad}</p>
        </div>
      </div>

      {/* Meta: stock y plazo */}
      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium ${
          o.stock_disponible
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            : 'bg-amber-50 text-amber-700 border border-amber-100'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${o.stock_disponible ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {o.stock_disponible
            ? o.stock_cantidad != null ? `${o.stock_cantidad} uds en stock` : 'Stock disponible'
            : 'Sin stock'}
        </span>

        {o.plazo_dias != null && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium bg-gray-50 text-gray-600 border border-gray-100">
            <Truck className="w-3 h-3" />
            {o.plazo_dias === 1 ? '1 día' : `${o.plazo_dias} días`}
          </span>
        )}
      </div>

      {/* Observaciones */}
      {o.descripcion && (
        <p className="text-gray-500 text-[11px] leading-relaxed line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
          {o.descripcion}
        </p>
      )}

      {/* CTA */}
      <button
        onClick={onSelect}
        disabled={isSelected}
        aria-pressed={isSelected}
        className={`w-full flex items-center justify-center gap-2 font-bold text-sm py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96] ${
          isSelected
            ? 'bg-emerald-100 text-emerald-700 cursor-default'
            : isRecomendado
              ? 'bg-[#1A5A96] hover:bg-[#154d82] text-white'
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
        }`}
      >
        {isSelected ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
        ) : (
          <Plus className="w-4 h-4" />
        )}
        {ctaLabel}
      </button>
    </div>
  );
}
