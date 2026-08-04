import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSession } from './SessionContext';
import { getCartDetail } from '../lib/api/marketplace-checkout';
import {
  CART_STATE_DEFAULT,
  clearCartStorage,
  loadCartState,
  saveCartState,
} from '../lib/marketplace/cart-storage';
import type { CartState, DeliveryMethod } from '../lib/marketplace/cart-storage';
import {
  dispatchCartInvalidate,
  dispatchCartUpdate,
  onCartInvalidate,
} from '../lib/marketplace/cart-events';

export type { CartState, DeliveryMethod };

// ─── Tipos del contexto ───────────────────────────────────────────────────────

export interface CartActions {
  setCartId:         (cartId: string) => void;
  selectSupplier:    (upId: string, offeringId: string) => void;
  setDeliveryMethod: (method: DeliveryMethod, addressId?: string) => void;
  hydrateFromDb:     (cartId: string) => Promise<void>;
  clearCart:         (reason?: 'ordered' | 'cancelled' | 'manual') => void;
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

export function CarritoProvider({ children }: { children: ReactNode }) {
  const { org } = useSession();
  const orgId = org?.id ?? null;

  const [state, setState]       = useState<CartState>(CART_STATE_DEFAULT);
  const [isLoading, setLoading] = useState(false);

  // Refs para coordinar hidratación vs. persistencia sin re-renders adicionales
  const prevOrgRef   = useRef<string | null>(null);
  const hydratedRef  = useRef(false);

  // ── Hidratación + persistencia ────────────────────────────────────────────
  // Único efecto que mezcla orgId y state como deps para evitar la condición
  // de carrera entre hidratación (carga storage) y persistencia (guarda storage).
  useEffect(() => {
    if (!orgId) {
      prevOrgRef.current  = null;
      hydratedRef.current = false;
      return;
    }

    if (orgId !== prevOrgRef.current) {
      // Org nueva → hidratar desde storage, no persistir en este ciclo
      prevOrgRef.current  = orgId;
      hydratedRef.current = false;
      const saved = loadCartState(orgId);
      setState(saved ?? CART_STATE_DEFAULT);
      hydratedRef.current = true;
      return;
    }

    // Misma org, estado cambió → persistir
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
      hydratedRef.current = true; // permitir persistencia tras reset
    });
  }, [orgId]);

  // ── Acciones ──────────────────────────────────────────────────────────────

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

  const hydrateFromDb = useCallback(async (cartId: string) => {
    setLoading(true);
    try {
      const detail = await getCartDetail(cartId);
      setState(prev => ({
        ...prev,
        cartId,
        sourceType: detail.cart.source_type,
        items:      detail.items,
      }));
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

  // ── Valor del contexto ────────────────────────────────────────────────────

  const value: CartContextValue = {
    state,
    isLoading,
    actions: { setCartId, selectSupplier, setDeliveryMethod, hydrateFromDb, clearCart },
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
