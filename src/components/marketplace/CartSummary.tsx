import type { LocalCartItem } from '../../lib/marketplace/cart-storage';

interface Props {
  items: LocalCartItem[];
}

interface SupplierGroup {
  supplierName:   string;
  supplierActorId: string;
  items:          LocalCartItem[];
  subtotal:       number;
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

export default function CartSummary({ items }: Props) {
  const groups   = groupBySupplier(items);
  const grandTotal = items.reduce((s, it) => s + it.precioUnitario * it.cantidad, 0);
  const lineCount  = items.length;

  if (lineCount === 0) return null;

  return (
    <div className="border-t border-white/8 pt-3 space-y-2">
      {groups.map(g => (
        <div key={g.supplierActorId} className="flex justify-between text-xs">
          <span className="text-white/40 truncate mr-2">{g.supplierName}</span>
          <span className="text-white/60 font-medium tabular-nums shrink-0">
            {g.subtotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>
      ))}

      {groups.length > 1 && (
        <div className="flex justify-between text-sm font-bold border-t border-white/8 pt-2 mt-2">
          <span className="text-white">Total estimado</span>
          <span className="text-[#00CFE8] tabular-nums">
            {grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>
      )}

      {groups.length === 1 && (
        <div className="flex justify-between text-sm font-bold">
          <span className="text-white">Total</span>
          <span className="text-[#00CFE8] tabular-nums">
            {grandTotal.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
          </span>
        </div>
      )}

      <p className="text-white/20 text-[10px] text-center pt-1">
        {lineCount} línea{lineCount !== 1 ? 's' : ''} · IVA no incluido
      </p>
    </div>
  );
}
