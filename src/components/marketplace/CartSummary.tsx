import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

const IVA = 0.21;

interface Props {
  items: LocalCartItem[];
}

interface SupplierGroup {
  supplierName:    string;
  supplierActorId: string;
  items:           LocalCartItem[];
  subtotal:        number;
}

function groupBySupplier(items: LocalCartItem[]): SupplierGroup[] {
  const map = new Map<string, SupplierGroup>();
  for (const item of items) {
    const existing = map.get(item.supplierActorId);
    if (existing) {
      existing.items.push(item);
      existing.subtotal += item.precioUnitario * item.cantidad;
    } else {
      map.set(item.supplierActorId, {
        supplierName:    item.supplierName,
        supplierActorId: item.supplierActorId,
        items:           [item],
        subtotal:        item.precioUnitario * item.cantidad,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'es'));
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export default function CartSummary({ items }: Props) {
  if (items.length === 0) return null;

  const groups    = groupBySupplier(items);
  const subtotal  = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const ivaAmount = subtotal * IVA;
  const total     = subtotal + ivaAmount;
  const lineCount = items.length;

  return (
    <div className="border-t border-gray-100 pt-3 space-y-2">
      {/* Desglose por proveedor */}
      {groups.map(g => (
        <div key={g.supplierActorId} className="flex justify-between text-xs">
          <span className="text-gray-500 truncate mr-2">{g.supplierName}</span>
          <span className="text-gray-700 font-medium tabular-nums shrink-0">{fmt(g.subtotal)}</span>
        </div>
      ))}

      {/* Subtotal */}
      <div className="flex justify-between text-xs text-gray-500 border-t border-gray-100 pt-2 mt-1">
        <span>Subtotal ({lineCount} línea{lineCount !== 1 ? 's' : ''})</span>
        <span className="tabular-nums font-medium text-gray-700">{fmt(subtotal)}</span>
      </div>

      {/* IVA */}
      <div className="flex justify-between text-xs text-gray-400">
        <span>IVA (21%)</span>
        <span className="tabular-nums">{fmt(ivaAmount)}</span>
      </div>

      {/* Total */}
      <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 mt-1">
        <span className="text-gray-900">Total estimado</span>
        <span className="text-[#1A5A96] tabular-nums">{fmt(total)}</span>
      </div>

      <p className="text-gray-400 text-[10px] text-center">
        Precios sin gastos de envío
      </p>
    </div>
  );
}
