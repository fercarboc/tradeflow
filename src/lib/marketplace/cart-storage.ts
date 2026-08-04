import type { CartItem, CartSourceType } from '../api/marketplace-checkout';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type DeliveryMethod = 'delivery' | 'pickup';

export interface CartState {
  cartId:             string | null;
  sourceType:         CartSourceType;
  items:              CartItem[];
  selectedSuppliers:  Record<string, string>; // up_id → offering_id
  deliveryMethod:     DeliveryMethod;
  deliveryAddressId?: string;
}

export const CART_STATE_DEFAULT: CartState = {
  cartId:            null,
  sourceType:        'manual',
  items:             [],
  selectedSuppliers: {},
  deliveryMethod:    'delivery',
};

// ─── Almacenamiento ──────────────────────────────────────────────────────────

const KEY_PREFIX      = 'tf_mkt_cart_v1_';
const STORAGE_VERSION = 1;

function storageKey(orgId: string): string {
  return `${KEY_PREFIX}${orgId}`;
}

export function saveCartState(orgId: string, state: CartState): void {
  try {
    localStorage.setItem(storageKey(orgId), JSON.stringify({ v: STORAGE_VERSION, state }));
  } catch {
    // localStorage puede no estar disponible (modo privado, cuota llena, etc.)
  }
}

export function loadCartState(orgId: string): CartState | null {
  try {
    const raw = localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed: { v?: number; state?: CartState } = JSON.parse(raw);
    if (parsed?.v !== STORAGE_VERSION) {
      clearCartStorage(orgId);
      return null;
    }
    return parsed.state ?? null;
  } catch {
    return null;
  }
}

export function clearCartStorage(orgId: string): void {
  try {
    localStorage.removeItem(storageKey(orgId));
  } catch {}
}
