import { Package, Truck, Users, Plus, ChevronRight } from 'lucide-react';
import type { MarketplaceCatalogItem } from '../../lib/api/marketplace-catalog';

interface Props {
  item:         MarketplaceCatalogItem;
  onAddBest:    (item: MarketplaceCatalogItem) => void;
  onViewOptions: (item: MarketplaceCatalogItem) => void;
}

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function MarketplaceProductCard({ item, onAddBest, onViewOptions }: Props) {
  const multiproveedor = item.actor_nombres.length > 1;

  return (
    <article className="flex flex-col bg-[#0d1f38] border border-white/8 rounded-2xl overflow-hidden hover:border-[#00CFE8]/30 hover:shadow-[0_0_20px_rgba(0,207,232,0.05)] transition-all group">
      {/* Imagen */}
      <div className="relative h-40 bg-[#0a1929] flex items-center justify-center overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.nombre_canonico}
            className="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-12 h-12 text-white/15" />
        )}
        {/* Badge multiproveedor */}
        {multiproveedor && (
          <span className="absolute top-2 right-2 bg-blue-500/20 text-blue-300 text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border border-blue-500/30">
            {item.actor_nombres.length} proveedores
          </span>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 p-4 gap-3">
        {/* Nombre y familia */}
        <div>
          <p className="text-[10px] text-white/35 uppercase tracking-wider font-medium mb-1">
            {item.familia}
          </p>
          <h3 className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-[#00CFE8] transition-colors">
            {item.nombre_canonico}
          </h3>
          {item.subfamilia && (
            <p className="text-white/35 text-[11px] mt-0.5 line-clamp-1">{item.subfamilia}</p>
          )}
        </div>

        {/* Meta */}
        <div className="flex flex-wrap gap-2 text-[11px]">
          {/* Stock */}
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
            item.stock_ok
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-amber-500/15 text-amber-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${item.stock_ok ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {item.stock_ok ? 'Disponible' : 'Sin stock'}
          </span>

          {/* Plazo */}
          {item.plazo_min != null && (
            <span className="flex items-center gap-1 text-white/40">
              <Truck className="w-3 h-3" />
              {item.plazo_min === 1 ? '1 día' : `${item.plazo_min} días`}
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="mt-auto">
          {item.precio_min != null && (
            <div className="flex items-baseline gap-1">
              <span className="text-white/40 text-[10px]">desde</span>
              <span className="text-[#00CFE8] text-base font-bold tabular-nums">
                {formatPrice(item.precio_min)}
              </span>
              {item.precio_max != null && item.precio_max !== item.precio_min && (
                <span className="text-white/30 text-[10px]">
                  — {formatPrice(item.precio_max)}
                </span>
              )}
            </div>
          )}

          {/* Proveedor */}
          <div className="flex items-center gap-1 mt-0.5">
            <Users className="w-3 h-3 text-white/25" />
            <span className="text-white/35 text-[10px]">
              {multiproveedor
                ? item.actor_nombres.join(', ')
                : item.actor_nombres[0] ?? '—'}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAddBest(item)}
            disabled={!item.best_offering_id}
            className="flex-1 flex items-center justify-center gap-1.5 bg-[#00CFE8] hover:bg-[#00b8cf] disabled:opacity-40 disabled:cursor-not-allowed text-[#020B16] text-xs font-bold py-2 rounded-xl transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Añadir
          </button>

          {item.offering_count > 1 && (
            <button
              onClick={() => onViewOptions(item)}
              className="flex items-center gap-1 bg-white/8 hover:bg-white/12 text-white/70 hover:text-white text-xs font-medium py-2 px-3 rounded-xl transition-colors"
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
