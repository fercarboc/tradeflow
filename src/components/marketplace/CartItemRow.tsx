import { Minus, Plus, Trash2, Package, AlertTriangle } from 'lucide-react';
import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

interface Props {
  item:        LocalCartItem;
  onUpdateQty: (cartItemId: string, qty: number) => void;
  onRemove:    (cartItemId: string) => void;
}

export default function CartItemRow({ item, onUpdateQty, onRemove }: Props) {
  const subtotal     = item.precioUnitario * item.cantidad;
  const stockWarning = item.stockCantidad != null && item.cantidad > item.stockCantidad;

  return (
    <li className="flex gap-3 py-3 border-b border-gray-100 last:border-0">
      {/* Imagen */}
      <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
        {item.imagen ? (
          <img
            src={item.imagen}
            alt={item.nombre}
            className="w-full h-full object-contain p-1"
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <Package className="w-5 h-5 text-gray-300" />
        )}
      </div>

      {/* Detalles */}
      <div className="flex-1 min-w-0">
        <p className="text-gray-900 text-xs font-semibold leading-snug line-clamp-2">{item.nombre}</p>
        <p className="text-gray-400 text-[10px] mt-0.5">{item.supplierName}</p>
        {item.supplierRef && (
          <p className="text-gray-300 text-[10px]">Ref: {item.supplierRef}</p>
        )}

        {stockWarning && (
          <div className="flex items-center gap-1 mt-1 text-amber-500 text-[10px]">
            <AlertTriangle className="w-3 h-3" />
            Stock insuficiente
          </div>
        )}

        {/* Controles cantidad */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={() => item.cantidad > 1 ? onUpdateQty(item.cartItemId, item.cantidad - 1) : onRemove(item.cartItemId)}
            className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-colors"
            aria-label="Reducir cantidad"
          >
            <Minus className="w-3 h-3 text-gray-500" />
          </button>

          <span className="text-gray-900 text-xs font-bold tabular-nums w-6 text-center">
            {item.cantidad}
          </span>

          <button
            onClick={() => onUpdateQty(item.cartItemId, item.cantidad + 1)}
            className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 flex items-center justify-center transition-colors"
            aria-label="Aumentar cantidad"
          >
            <Plus className="w-3 h-3 text-gray-500" />
          </button>

          <span className="text-gray-400 text-[10px]">{item.unidadComercial}</span>
        </div>
      </div>

      {/* Precio + eliminar */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className="text-gray-900 text-xs font-bold tabular-nums">
          {subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        </p>
        <p className="text-gray-400 text-[10px] tabular-nums">
          {item.precioUnitario.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €/u
        </p>
        <button
          onClick={() => onRemove(item.cartItemId)}
          className="text-gray-300 hover:text-red-500 transition-colors mt-1"
          aria-label={`Eliminar ${item.nombre}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </li>
  );
}
