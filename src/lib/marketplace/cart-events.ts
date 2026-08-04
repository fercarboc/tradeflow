// Eventos de carrito — sincronización cross-componente y cross-tab
// Usa CustomEvent sobre window; no genera tráfico de red.

const CART_UPDATE_EVENT     = 'tf:cart:update'     as const;
const CART_INVALIDATE_EVENT = 'tf:cart:invalidate' as const;

export interface CartUpdateDetail {
  orgId:     string;
  cartId:    string | null;
  itemCount: number;
}

export interface CartInvalidateDetail {
  orgId:   string;
  reason:  'ordered' | 'cancelled' | 'logout' | 'manual';
}

export function dispatchCartUpdate(detail: CartUpdateDetail): void {
  window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail }));
}

export function dispatchCartInvalidate(detail: CartInvalidateDetail): void {
  window.dispatchEvent(new CustomEvent(CART_INVALIDATE_EVENT, { detail }));
}

// Retornan una función de limpieza (unsub)
export function onCartUpdate(handler: (d: CartUpdateDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<CartUpdateDetail>).detail);
  window.addEventListener(CART_UPDATE_EVENT, listener);
  return () => window.removeEventListener(CART_UPDATE_EVENT, listener);
}

export function onCartInvalidate(handler: (d: CartInvalidateDetail) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<CartInvalidateDetail>).detail);
  window.addEventListener(CART_INVALIDATE_EVENT, listener);
  return () => window.removeEventListener(CART_INVALIDATE_EVENT, listener);
}
