import { Package, Truck, Plus, ChevronRight } from 'lucide-react';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';

interface Props {
  item:             MarketplaceCatalogItem;
  onAddBest:        (item: MarketplaceCatalogItem) => void;
  onViewOptions:    (item: MarketplaceCatalogItem) => void;
  hasPickupNearby?: boolean;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ─── Disponibilidad B8: jerarquía de 5 niveles ────────────────────────────────

interface AvailBadge { label: string; cls: string; dotCls: string; }

function getAvailBadge(stockOk: boolean, hasPickup: boolean, plazoMin: number | null): AvailBadge {
  if (stockOk && hasPickup)
    return { label: 'Recogida local', cls: 'bg-teal-50 text-teal-700 border-teal-200',    dotCls: 'bg-teal-500' };
  if (stockOk && plazoMin != null && plazoMin <= 1)
    return { label: 'Disponible hoy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dotCls: 'bg-emerald-500' };
  if (stockOk)
    return { label: 'En stock',       cls: 'bg-emerald-50 text-emerald-600 border-emerald-200', dotCls: 'bg-emerald-500' };
  if (plazoMin != null && plazoMin > 0)
    return { label: 'Bajo pedido',    cls: 'bg-amber-50 text-amber-700 border-amber-200',   dotCls: 'bg-amber-400' };
  return   { label: 'Sin stock',      cls: 'bg-gray-100 text-gray-500 border-gray-200',    dotCls: 'bg-gray-400' };
}

// ─── Color de fondo por oficio (B5: fallback con identidad visual) ─────────────

const OFICIO_STYLE: Record<string, { bg: string; text: string }> = {
  fontaneria:    { bg: '#EFF6FF', text: '#3B82F6' },
  electricidad:  { bg: '#FFFBEB', text: '#F59E0B' },
  albanileria:   { bg: '#F5F3FF', text: '#8B5CF6' },
  carpinteria:   { bg: '#FEF3C7', text: '#92400E' },
  pintura:       { bg: '#FDF2F8', text: '#EC4899' },
  climatizacion: { bg: '#ECFEFF', text: '#06B6D4' },
  soldadura:     { bg: '#FEF2F2', text: '#EF4444' },
};

function oficioStyle(oficio: string | null | undefined) {
  return OFICIO_STYLE[(oficio ?? '').toLowerCase()] ?? { bg: '#F9FAFB', text: '#1A5A96' };
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

export default function MarketplaceProductCard({
  item, onAddBest, onViewOptions, hasPickupNearby = false,
}: Props) {
  const hasMultiple = item.offering_count > 1;
  const avail       = getAvailBadge(item.stock_ok, hasPickupNearby, item.plazo_min);
  const style       = oficioStyle(item.oficio);

  return (
    <article
      className={`flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#1A5A96]/30 hover:shadow-md transition-all group ${
        hasMultiple ? 'cursor-pointer' : ''
      }`}
      onClick={hasMultiple ? () => onViewOptions(item) : undefined}
    >
      {/* Imagen / fallback coloreado por oficio (B5) */}
      <div
        className="relative h-28 sm:h-32 flex items-center justify-center overflow-hidden border-b border-gray-100"
        style={{ background: style.bg }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.nombre_canonico}
            className="h-full w-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-9 h-9" style={{ color: style.text }} />
        )}

        {/* Badge de disponibilidad — jerarquía B8 */}
        <span className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${avail.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${avail.dotCls}`} />
          {avail.label}
        </span>
      </div>

      {/* Cuerpo — orden B2: qué → precio → proveedor → disponibilidad → acción */}
      <div className="flex flex-col flex-1 p-3 gap-1.5">
        {/* Familia */}
        {item.familia && (
          <span
            className="self-start text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{ background: style.bg, color: style.text }}
          >
            {item.familia}
          </span>
        )}

        {/* Nombre del producto */}
        <h3 className="text-gray-900 text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#1A5A96] transition-colors">
          {item.nombre_canonico}
        </h3>

        {/* Precio dominante (B6) */}
        {item.precio_min != null && (
          <p className="text-[#1A5A96] text-lg font-black tabular-nums leading-tight">
            {hasMultiple ? `Desde ${fmt(item.precio_min)}` : fmt(item.precio_min)}
          </p>
        )}

        {/* Proveedor — B7: nombre si 1, conteo si varios */}
        {hasMultiple ? (
          <p className="text-xs text-gray-500">
            {item.offering_count} proveedores
          </p>
        ) : item.best_actor_nombre ? (
          <p className="text-[11px] text-gray-500 truncate">{item.best_actor_nombre}</p>
        ) : null}

        {/* Plazo de entrega */}
        {item.plazo_min != null && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Truck className="w-3 h-3 shrink-0" />
            {hasMultiple
              ? (item.plazo_min <= 1 ? 'Desde 1 día' : `Desde ${item.plazo_min} días`)
              : (item.plazo_min <= 1 ? 'Entrega en 1 día' : `Entrega en ${item.plazo_min} días`)
            }
          </span>
        )}

        <div className="flex-1" />

        {/* CTA — B9: directo si 1 proveedor, Comparar si varios */}
        <div className="pt-1" onClick={e => e.stopPropagation()}>
          {hasMultiple ? (
            <button
              onClick={() => onViewOptions(item)}
              className="w-full flex items-center justify-center gap-1.5 bg-[#1A5A96] hover:bg-[#154d82] text-white text-xs font-bold py-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              Comparar
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => onAddBest(item)}
              disabled={!item.best_offering_id}
              className="w-full flex items-center justify-center gap-1.5 bg-[#1A5A96] hover:bg-[#154d82] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A5A96]"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir
            </button>
          )}
        </div>

        {hasMultiple && (
          <p className="text-[9px] text-gray-300 text-center leading-tight">
            Ordenado por stock, precio y plazo
          </p>
        )}
      </div>
    </article>
  );
}
