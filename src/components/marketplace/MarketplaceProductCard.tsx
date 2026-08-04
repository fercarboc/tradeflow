import { Package, Truck, Plus, ChevronRight } from 'lucide-react';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';

interface Props {
  item:          MarketplaceCatalogItem;
  onAddBest:     (item: MarketplaceCatalogItem) => void;
  onViewOptions: (item: MarketplaceCatalogItem) => void;
}

function fmt(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Simple color per familia (visual differentiation)
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

export default function MarketplaceProductCard({ item, onAddBest, onViewOptions }: Props) {
  const multiproveedor = item.actor_nombres.length > 1;
  const fColor = familiaColor(item.familia);

  return (
    <article className="flex flex-col bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-gray-300 hover:shadow-md transition-all group">
      {/* Imagen */}
      <div className="relative h-36 bg-gray-50 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.nombre_canonico}
            className="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-10 h-10 text-gray-200" />
        )}

        {/* Oferta badge */}
        {multiproveedor && (
          <span className="absolute top-2 left-2 bg-[#1A5A96] text-white text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full">
            {item.actor_nombres.length} proveedores
          </span>
        )}

        {/* Stock badge */}
        <span className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
          item.stock_ok ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${item.stock_ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {item.stock_ok ? 'Stock' : 'Agotado'}
        </span>
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Familia badge */}
        {item.familia && (
          <span
            className="self-start text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md"
            style={{ background: fColor + '18', color: fColor }}
          >
            {item.familia}
          </span>
        )}

        {/* Nombre */}
        <h3 className="text-gray-900 text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#1A5A96] transition-colors -mt-1">
          {item.nombre_canonico}
        </h3>

        {/* Proveedor + plazo */}
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span className="truncate mr-2">
            {multiproveedor
              ? `${item.actor_nombres[0]} +${item.actor_nombres.length - 1}`
              : (item.actor_nombres[0] ?? '—')}
          </span>
          {item.plazo_min != null && (
            <span className="flex items-center gap-1 shrink-0">
              <Truck className="w-3 h-3" />
              {item.plazo_min === 1 ? '1 día' : `${item.plazo_min}d`}
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="mt-auto">
          {item.precio_min != null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-gray-400 text-[10px]">desde</span>
              <span className="text-[#1A5A96] text-base font-black tabular-nums">
                {fmt(item.precio_min)}
              </span>
            </div>
          ) : (
            <span className="text-gray-300 text-sm">Precio no disponible</span>
          )}
          {item.precio_max != null && item.precio_max !== item.precio_min && (
            <p className="text-gray-300 text-[10px]">— hasta {fmt(item.precio_max)}</p>
          )}
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAddBest(item)}
            disabled={!item.best_offering_id}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#1A5A96] hover:bg-[#154d82] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir
          </button>

          {item.offering_count > 1 && (
            <button
              onClick={() => onViewOptions(item)}
              className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 text-xs font-medium py-2.5 px-3 rounded-xl transition-colors"
              aria-label="Ver opciones de proveedores"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              {item.offering_count}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
