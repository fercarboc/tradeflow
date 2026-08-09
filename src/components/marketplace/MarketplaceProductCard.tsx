import { Package, Truck, Plus, ChevronRight, MapPin } from 'lucide-react';
import type { MarketplaceCatalogItem, TopOfferingMini } from '../../lib/api/marketplace-catalog';

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

const FAMILIA_COLORS: Record<string, string> = {
  'fontanería':    '#3B82F6',
  'electricidad':  '#F59E0B',
  'albañilería':   '#8B5CF6',
  'carpintería':   '#92400E',
  'pintura':       '#EC4899',
  'climatización': '#06B6D4',
  'soldadura':     '#EF4444',
};

function familiaColor(familia: string | null | undefined): string {
  if (!familia) return '#6B7280';
  const lower = familia.toLowerCase();
  for (const [key, color] of Object.entries(FAMILIA_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return '#1A5A96';
}

// ─── Fila de mini-tabla (una offering) ───────────────────────────────────────

interface MiniRowProps {
  offer:   TopOfferingMini;
  isFirst: boolean;
}

function ProviderMiniRow({ offer, isFirst }: MiniRowProps) {
  return (
    <div className={`flex items-center justify-between gap-2 py-1.5 ${
      isFirst ? 'border-b border-dashed border-[#1A5A96]/15 pb-2 mb-0.5' : ''
    }`}>
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        {/* Indicador stock */}
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            offer.stock_disponible ? 'bg-emerald-500' : 'bg-amber-400'
          }`}
          title={offer.stock_disponible ? 'Stock disponible' : 'Sin stock'}
          aria-hidden="true"
        />
        <span className={`text-xs truncate ${
          isFirst ? 'text-[#1A5A96] font-semibold' : 'text-gray-500 font-normal'
        }`}>
          {offer.actor_nombre}
        </span>
      </div>
      <span className={`text-xs tabular-nums shrink-0 ${
        isFirst ? 'text-[#1A5A96] font-bold' : 'text-gray-500 font-medium'
      }`}>
        {fmt(offer.precio_coste)}
      </span>
    </div>
  );
}

// ─── Tarjeta de producto ──────────────────────────────────────────────────────

export default function MarketplaceProductCard({ item, onAddBest, onViewOptions, hasPickupNearby }: Props) {
  const hasMultiple   = item.offering_count > 1;
  const fColor        = familiaColor(item.familia);

  // Top offerings para la mini-tabla (máx 3 del servidor, nosotros mostramos max 3 desktop / 2 mobile)
  const topOffers     = item.top_offerings ?? [];
  const extraCount    = item.offering_count - topOffers.length;  // offerings ocultas más allá del top3

  return (
    <article
      className="flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#1A5A96]/30 hover:shadow-md transition-all group"
      onClick={() => hasMultiple && onViewOptions(item)}
      style={{ cursor: hasMultiple ? 'pointer' : 'default' }}
    >
      {/* Imagen */}
      <div className="relative h-32 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.nombre_canonico}
            className="h-full w-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-10 h-10 text-gray-200" />
        )}

        {/* Stock badge */}
        <span className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          item.stock_ok
            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
            : 'bg-amber-50 text-amber-600 border border-amber-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.stock_ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {item.stock_ok ? 'Stock' : 'Agotado'}
        </span>
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        {/* Familia */}
        {item.familia && (
          <span
            className="self-start text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{ background: fColor + '18', color: fColor }}
          >
            {item.familia}
          </span>
        )}

        {/* Nombre */}
        <h3 className="text-gray-900 text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#1A5A96] transition-colors">
          {item.nombre_canonico}
        </h3>

        {/* ── Un solo proveedor ─────────────────────────────────────────────── */}
        {!hasMultiple && (
          <>
            {item.best_actor_nombre && (
              <p className="text-[11px] text-gray-500 font-medium truncate">
                {item.best_actor_nombre}
              </p>
            )}
            {item.precio_min != null && (
              <p className="text-[#1A5A96] text-lg font-black tabular-nums">
                {fmt(item.precio_min)}
              </p>
            )}
            {item.plazo_min != null && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400">
                <Truck className="w-3 h-3" />
                {item.plazo_min === 1 ? 'Entrega en 1 día' : `Entrega en ${item.plazo_min} días`}
              </span>
            )}
          </>
        )}

        {/* ── Multiproveedor: mini-tabla ────────────────────────────────────── */}
        {hasMultiple && topOffers.length > 0 && (
          <div className="flex-1">
            {/* Desktop: máx 3 / Mobile: máx 2 */}
            <div className="hidden sm:block">
              {topOffers.map((offer, idx) => (
                <ProviderMiniRow key={offer.actor_nombre + idx} offer={offer} isFirst={idx === 0} />
              ))}
            </div>
            <div className="sm:hidden">
              {topOffers.slice(0, 2).map((offer, idx) => (
                <ProviderMiniRow key={offer.actor_nombre + idx} offer={offer} isFirst={idx === 0} />
              ))}
            </div>

            {/* "+N opciones" si hay más que las mostradas */}
            {extraCount > 0 && (
              <p className="text-[10px] text-[#1A5A96] font-semibold mt-1.5">
                +{extraCount} opción{extraCount > 1 ? 'es' : ''} más
              </p>
            )}
            {/* En móvil también contar las no mostradas del top3 */}
            {extraCount === 0 && topOffers.length > 2 && (
              <p className="sm:hidden text-[10px] text-[#1A5A96] font-semibold mt-1.5">
                +1 opción más
              </p>
            )}
          </div>
        )}

        {/* Plazo (multiproveedor) */}
        {hasMultiple && item.plazo_min != null && (
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Truck className="w-3 h-3" />
            {item.plazo_min === 1 ? 'Desde 1 día' : `Desde ${item.plazo_min} días`}
          </span>
        )}

        {/* Botones */}
        <div className="flex gap-2 pt-1 mt-auto" onClick={e => e.stopPropagation()}>
          {/* Un proveedor: botón Añadir directo */}
          {!hasMultiple && (
            <button
              onClick={() => onAddBest(item)}
              disabled={!item.best_offering_id}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A5A96] hover:bg-[#154d82] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Añadir
            </button>
          )}

          {/* Multiproveedor: CTA "Comparar todas" + botón Añadir mejor */}
          {hasMultiple && (
            <>
              <button
                onClick={() => onViewOptions(item)}
                className="flex-1 flex items-center justify-center gap-1 bg-[#1A5A96] hover:bg-[#154d82] text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-colors"
              >
                Comparar todas
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onAddBest(item)}
                disabled={!item.best_offering_id}
                title={`Añadir ${item.best_actor_nombre ?? 'mejor opción'}`}
                aria-label={`Añadir mejor opción (${item.best_actor_nombre ?? ''})`}
                className="flex items-center justify-center w-9 h-9 rounded-xl bg-gray-100 hover:bg-[#1A5A96]/10 disabled:opacity-40 disabled:cursor-not-allowed text-gray-500 hover:text-[#1A5A96] transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Señal de recogida local */}
        {hasPickupNearby && (
          <p className="text-[10px] text-[#1A5A96] font-medium flex items-center gap-1 mt-0.5">
            <MapPin className="w-2.5 h-2.5 shrink-0" />
            Recogida local disponible
          </p>
        )}

        {/* Tooltip transparencia (multiproveedor) */}
        {hasMultiple && (
          <p className="text-[9px] text-gray-300 text-center leading-tight mt-0.5">
            Ordenado por stock, precio y plazo
          </p>
        )}
      </div>
    </article>
  );
}
