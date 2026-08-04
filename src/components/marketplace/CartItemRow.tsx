import { Minus, Plus, Trash2, Package, AlertTriangle } from 'lucide-react';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

interface Props {
  item:           LocalCartItem;
  onUpdateQty:    (cartItemId: string, qty: number) => void;
  onRemove:       (cartItemId: string) => void;
}

export default function CartItemRow({ item, onUpdateQty, onRemove }: Props) {
  const subtotal = item.precioUnitario * item.cantidad;
  const stockWarning = item.stockCantidad != null && item.cantidad > item.stockCantidad;

  return (
    <li className="flex gap-3 py-3 border-b border-white/6 last:border-0">
      {/* Imagen */}
      <div className="w-12 h-12 rounded-xl bg-[#0a1929] flex items-center justify-center shrink-0 overflow-hidden">
        {item.imagen ? (
          <img
            src={item.imagen}
            alt={item.nombre}
            className="w-full h-full object-contain p-1"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-5 h-5 text-white/20" />
        )}
      </div>

      {/* Detalles */}
      <div className="flex-1 min-w-0">
        <p className="text-white text-xs font-medium leading-snug line-clamp-2">{item.nombre}</p>
        <p className="text-white/35 text-[10px] mt-0.5">{item.supplierName}</p>
        {item.supplierRef && (
          <p className="text-white/25 text-[10px]">Ref: {item.supplierRef}</p>
        )}

        {stockWarning && (
          <div className="flex items-center gap-1 mt-1 text-amber-400 text-[10px]">
            <AlertTriangle className="w-3 h-3" />
            Stock insuficiente
          </div>
        )}

        {/* Controles de cantidad */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => item.cantidad > 1 ? onUpdateQty(item.cartItemId, item.cantidad - 1) : onRemove(item.cartItemId)}
            className="w-6 h-6 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Reducir cantidad"
          >
            <Minus className="w-3 h-3 text-white/60" />
          </button>

          <span className="text-white text-xs font-semibold tabular-nums w-6 text-center">
            {item.cantidad}
          </span>

          <button
            onClick={() => onUpdateQty(item.cartItemId, item.cantidad + 1)}
            className="w-6 h-6 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center transition-colors"
            aria-label="Aumentar cantidad"
          >
            <Plus className="w-3 h-3 text-white/60" />
          </button>

          <span className="text-white/30 text-[10px]">{item.unidadComercial}</span>
        </div>
      </div>

      {/* Precio + eliminar */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-white text-xs font-semibold tabular-nums">
          {subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </p>
        <p className="text-white/30 text-[10px] tabular-nums">
          {item.precioUnitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/u
        </p>
        <button
          onClick={() => onRemove(item.cartItemId)}
          className="text-white/20 hover:text-red-400 transition-colors mt-1"
          aria-label={`Eliminar ${item.nombre}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
