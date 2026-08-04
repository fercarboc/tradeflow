import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession } from './SessionContext';
import {
  CART_STATE_DEFAULT,
  clearCartStorage,
  loadCartState,
  saveCartState,
} from '../lib/marketplace/cart-storage';
import type { CartState, DeliveryMethod, LocalCartItem, LineaOrigen } from '../lib/marketplace/cart-storage';
import {
  dispatchCartInvalidate,
  dispatchCartUpdate,
  onCartInvalidate,
} from '../lib/marketplace/cart-events';

export type { CartState, DeliveryMethod, LocalCartItem, LineaOrigen };

// ─── Tipos del contexto ───────────────────────────────────────────────────────

export interface CartActions {
  setCartId:         (cartId: string) => void;
  selectSupplier:    (upId: string, offeringId: string) => void;
  setDeliveryMethod: (method: DeliveryMethod, addressId?: string) => void;
  hydrateFromDb:     (cartId: string) => Promise<void>;
  clearCart:         (reason?: 'ordered' | 'cancelled' | 'manual') => void;
  // RC1-B — gestión de ítems local
  addItem:           (item: Omit<LocalCartItem, 'cartItemId'>) => void;
  updateQuantity:    (cartItemId: string, qty: number) => void;
  removeItem:        (cartItemId: string) => void;
}

export interface CartContextValue {
  state:     CartState;
  isLoading: boolean;
  actions:   CartActions;
}

// ─── Contexto ─────────────────────────────────────────────────────────────────

export const CartContext = createContext<CartContextValue | null>(null);

export function useCartContext(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCartContext must be used inside CarritoProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

const GUEST_CART_KEY = 'trabflow:marketplace:guest-cart';

function readGuestCart(): CartState | null {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    return raw ? (JSON.parse(raw) as CartState) : null;
  } catch {
    return null;
  }
}

function writeGuestCart(s: CartState) {
  try { localStorage.setItem(GUEST_CART_KEY, JSON.stringify(s)); } catch { /* lleno */ }
}

function clearGuestCart() {
  try { localStorage.removeItem(GUEST_CART_KEY); } catch { /* noop */ }
}

export function CarritoProvider({ children }: { children: ReactNode }) {
  const { org } = useSession();
  const orgId = org?.id ?? null;

  const [state, setState]       = useState<CartState>(CART_STATE_DEFAULT);
  const [isLoading, setLoading] = useState(false);

  // undefined = "aún no inicializado" — distinto de null (guest) o string (org)
  const prevOrgRef  = useRef<string | null | undefined>(undefined);
  const hydratedRef = useRef(false);

  // ── Hidratación + persistencia ────────────────────────────────────────────
  // Un único efecto combinado para evitar la carrera hidratación vs persistencia.
  useEffect(() => {
    if (!orgId) {
      // Sin sesión: cargar/persistir guest cart
      if (prevOrgRef.current !== orgId) {
        // Cambio a null (primer render o sign-out)
        prevOrgRef.current  = orgId;
        hydratedRef.current = false;
        const guest = readGuestCart();
        setState(guest ?? CART_STATE_DEFAULT);
        hydratedRef.current = true;
        return;
      }
      // orgId sigue siendo null y el estado cambió: persistir guest cart
      if (hydratedRef.current) {
        writeGuestCart(state);
      }
      return;
    }

    if (orgId !== prevOrgRef.current) {
      // Cambio de org (o primer login desde guest)
      const wasGuest = prevOrgRef.current === null;
      prevOrgRef.current  = orgId;
      hydratedRef.current = false;
      const saved = loadCartState(orgId);
      const base  = saved ?? CART_STATE_DEFAULT;

      if (wasGuest) {
        // Fusionar guest cart → org cart (sin duplicar por offeringId)
        const guest = readGuestCart();
        if (guest && guest.items.length > 0) {
          clearGuestCart();
          const extraItems = guest.items.filter(
            gi => !base.items.some(oi => oi.offeringId === gi.offeringId),
          );
          setState({ ...base, items: [...base.items, ...extraItems] });
        } else {
          setState(base);
        }
      } else {
        setState(base);
      }
      hydratedRef.current = true;
      return;
    }

    if (hydratedRef.current) {
      saveCartState(orgId, state);
      dispatchCartUpdate({ orgId, cartId: state.cartId, itemCount: state.items.length });
    }
  }, [orgId, state]);

  // ── Invalidación cross-tab ────────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;
    return onCartInvalidate(({ orgId: oid }) => {
      if (oid !== orgId) return;
      clearCartStorage(orgId);
      setState(CART_STATE_DEFAULT);
      hydratedRef.current = true;
    });
  }, [orgId]);

  // ── Acciones básicas ──────────────────────────────────────────────────────

  const setCartId = useCallback((cartId: string) => {
    setState(prev => ({ ...prev, cartId }));
  }, []);

  const selectSupplier = useCallback((upId: string, offeringId: string) => {
    setState(prev => ({
      ...prev,
      selectedSuppliers: { ...prev.selectedSuppliers, [upId]: offeringId },
    }));
  }, []);

  const setDeliveryMethod = useCallback((method: DeliveryMethod, addressId?: string) => {
    setState(prev => ({
      ...prev,
      deliveryMethod:    method,
      deliveryAddressId: addressId,
    }));
  }, []);

  // RC1-C: sincronizará con BD. En RC1-B sólo actualiza cartId.
  const hydrateFromDb = useCallback(async (cartId: string) => {
    setLoading(true);
    try {
      setState(prev => ({ ...prev, cartId }));
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCart = useCallback((reason: 'ordered' | 'cancelled' | 'manual' = 'manual') => {
    if (orgId) {
      clearCartStorage(orgId);
      dispatchCartInvalidate({ orgId, reason });
    }
    setState(CART_STATE_DEFAULT);
    hydratedRef.current = true;
  }, [orgId]);

  // ── Gestión de ítems (RC1-B) ──────────────────────────────────────────────

  const addItem = useCallback((item: Omit<LocalCartItem, 'cartItemId'>) => {
    setState(prev => {
      // Misma offering → incrementar cantidad
      const idx = prev.items.findIndex(i => i.offeringId === item.offeringId);
      if (idx >= 0) {
        return {
          ...prev,
          items: prev.items.map((it, i) =>
            i === idx ? { ...it, cantidad: it.cantidad + item.cantidad } : it,
          ),
        };
      }
      // Nueva línea
      return {
        ...prev,
        items: [
          ...prev.items,
          { ...item, cartItemId: crypto.randomUUID() },
        ],
      };
    });
  }, []);

  const updateQuantity = useCallback((cartItemId: string, qty: number) => {
    const safeQty = Math.max(1, Math.round(qty));
    setState(prev => ({
      ...prev,
      items: prev.items.map(it =>
        it.cartItemId === cartItemId ? { ...it, cantidad: safeQty } : it,
      ),
    }));
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setState(prev => ({
      ...prev,
      items: prev.items.filter(it => it.cartItemId !== cartItemId),
    }));
  }, []);

  // ── Valor del contexto ────────────────────────────────────────────────────

  const value: CartContextValue = {
    state,
    isLoading,
    actions: {
      setCartId,
      selectSupplier,
      setDeliveryMethod,
      hydrateFromDb,
      clearCart,
      addItem,
      updateQuantity,
      removeItem,
    },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
