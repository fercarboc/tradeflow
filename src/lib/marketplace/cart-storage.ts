import type { CartSourceType } from '../api/marketplace-checkout';

// ─── Tipos locales del carrito ────────────────────────────────────────────────

export type DeliveryMethod = 'delivery' | 'pickup';

// Origen de cada línea del carrito (compatibilidad futura con presupuestos, reórdenes, etc.)
export type LineaOrigen =
  | 'free'
  | 'quote'
  | 'reorder'
  | 'job'
  | 'field_action'
  | 'maintenance_incident'
  | 'manual';

// Representación frontend de un ítem del carrito.
// No es el CartItem del backend (trade_marketplace_cart_items) — es el estado local
// que se persiste en localStorage y se sincroniza con el servidor en RC1-C.
export interface LocalCartItem {
  cartItemId:         string;           // UUID generado en frontend (crypto.randomUUID)
  universalProductId: string;
  universalVariantId?: string | null;
  offeringId:         string;
  supplierActorId:    string;
  supplierName:       string;
  supplierRef?:       string | null;
  nombre:             string;           // nombre_canonico del UP
  imagen?:            string | null;
  cantidad:           number;
  unidadTecnica:      string;           // unidad del UP
  unidadComercial:    string;           // unidad de la offering (puede diferir)
  precioUnitario:     number;           // precio_coste — precio de compra del instalador
  stockDisponible:    boolean;
  stockCantidad?:     number | null;
  plazoEntregaDias:   number;
  sourceType:         CartSourceType;
  quoteId?:           string | null;
  quoteItemId?:       string | null;
  lineaOrigen:        LineaOrigen;
}

export interface CartState {
  cartId:             string | null;
  sourceType:         CartSourceType;
  items:              LocalCartItem[];
  selectedSuppliers:  Record<string, string>; // up_id → offering_id preferida
  deliveryMethod:     DeliveryMethod;
  deliveryAddressId?: string;
}

export const CART_STATE_DEFAULT: CartState = {
  cartId:            null,
  sourceType:        'free',
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
