import { useEffect, useState } from 'react';
import { X, Package, Truck, ShieldCheck, Plus, Loader2 } from 'lucide-react';
import type { MarketplaceCatalogItem, OfferingDetail } from '../../lib/api/marketplace-catalog';
import { getOfferingsForUp } from '../../lib/api/marketplace-catalog';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

interface Props {
  item:    MarketplaceCatalogItem | null;
  onClose: () => void;
  onAdd:   (item: Omit<LocalCartItem, 'cartItemId'>) => void;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function MarketplaceProductSlideOver({ item, onClose, onAdd }: Props) {
  const [offerings, setOfferings] = useState<OfferingDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) { setOfferings([]); return; }
    setLoading(true);
    setError(null);
    getOfferingsForUp(item.up_id)
      .then(setOfferings)
      .catch(e => setError(e instanceof Error ? e.message : 'Error al cargar opciones'))
      .finally(() => setLoading(false));
  }, [item?.up_id]);

  // Trap focus + ESC
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose]);

  const isOpen = item !== null;

  function handleAdd(o: OfferingDetail) {
    if (!item) return;
    onAdd({
      universalProductId: item.up_id,
      offeringId:         o.offering_id,
      supplierActorId:    o.actor_id,
      supplierName:       o.actor_nombre,
      supplierRef:        o.supplier_ref,
      nombre:             item.nombre_canonico,
      imagen:             o.image_url ?? item.image_url,
      cantidad:           1,
      unidadTecnica:      item.unidad,
      unidadComercial:    o.unidad,
      precioUnitario:     o.precio_coste ?? 0,
      stockDisponible:    o.stock_disponible,
      stockCantidad:      o.stock_cantidad,
      plazoEntregaDias:   o.plazo_dias,
      sourceType:         'free',
      lineaOrigen:        'manual',
    });
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 h-full w-full max-w-md bg-[#0a1929] border-l border-white/10 z-50 flex flex-col transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-modal="true"
        role="dialog"
        aria-label={item?.nombre_canonico}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-white/8">
          <div className="w-16 h-16 rounded-xl bg-[#0d1f38] flex items-center justify-center shrink-0">
            {item?.image_url ? (
              <img
                src={item.image_url}
                alt={item.nombre_canonico}
                className="w-full h-full object-contain p-2 rounded-xl"
              />
            ) : (
              <Package className="w-8 h-8 text-white/20" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/40 text-[10px] uppercase tracking-wider">{item?.familia}</p>
            <h2 className="text-white font-bold text-base leading-tight line-clamp-2">
              {item?.nombre_canonico}
            </h2>
            <p className="text-white/40 text-xs mt-0.5">{item?.offering_count} opción{(item?.offering_count ?? 0) > 1 ? 'es' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white/70 transition-colors ml-2 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 text-[#00CFE8] animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-red-400 text-sm text-center py-8">{error}</p>
          )}

          {!loading && !error && offerings.length === 0 && (
            <p className="text-white/30 text-sm text-center py-8">Sin opciones disponibles</p>
          )}

          {offerings.map((o, i) => (
            <OfferingRow key={o.offering_id} offering={o} rank={i} onAdd={() => handleAdd(o)} />
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/8">
          <p className="text-white/25 text-[10px] text-center">
            Precio de compra instalador (precio_coste). Ordenado por stock y precio.
          </p>
        </div>
      </div>
    </>
  );
}

function OfferingRow({ offering: o, rank, onAdd }: {
  offering: OfferingDetail;
  rank: number;
  onAdd: () => void;
}) {
  return (
    <div className="bg-[#0d1f38] border border-white/8 rounded-xl p-4 flex flex-col gap-3">
      {/* Proveedor */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {rank === 0 && (
            <span className="text-[9px] bg-[#00CFE8]/15 text-[#00CFE8] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
              Recomendado
            </span>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-white font-semibold text-sm">{o.actor_nombre}</span>
              {o.actor_verificado && (
                <span title="Proveedor verificado">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00CFE8]" aria-label="Proveedor verificado" />
                </span>
              )}
            </div>
            {o.supplier_ref && (
              <p className="text-white/30 text-[10px]">Ref: {o.supplier_ref}</p>
            )}
          </div>
        </div>
        {/* Precio */}
        <div className="text-right shrink-0">
          <p className="text-[#00CFE8] font-bold text-base tabular-nums">
            {o.precio_coste != null
              ? o.precio_coste.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
              : '—'}
          </p>
          <p className="text-white/30 text-[10px]">/{o.unidad}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-[11px]">
        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
          o.stock_disponible
            ? 'bg-emerald-500/15 text-emerald-400'
            : 'bg-amber-500/15 text-amber-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${o.stock_disponible ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          {o.stock_disponible
            ? o.stock_cantidad != null ? `${o.stock_cantidad} en stock` : 'Stock disponible'
            : 'Sin stock'}
        </span>

        <span className="flex items-center gap-1 text-white/40">
          <Truck className="w-3 h-3" />
          {o.plazo_dias === 1 ? '1 día' : `${o.plazo_dias} días`}
        </span>
      </div>

      {/* Descripción */}
      {o.descripcion && (
        <p className="text-white/35 text-[11px] leading-relaxed line-clamp-2">{o.descripcion}</p>
      )}

      {/* CTA */}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 bg-[#00CFE8] hover:bg-[#00b8cf] text-[#020B16] font-bold text-sm py-2.5 rounded-xl transition-colors"
      >
        <Plus className="w-4 h-4" />
        Añadir al carrito
      </button>
    </div>
  );
}
