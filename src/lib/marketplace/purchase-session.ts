// Sesión unificada de compra marketplace — persiste paso del wizard, datos de entrega y comprador.
// TTL 6h. Complementa MarketplacePurchaseContext (que guarda cart_id + datos del presupuesto).
// RC1-C.6.3: clave namespaciada por quoteId para aislar sesiones de presupuestos distintos.

import type { DeliveryOptionPerProvider, BuyerSnapshot } from '../api/marketplace-checkout';

export type CheckoutStep = 'revisar' | 'entrega' | 'confirmar' | 'exito';

export interface MarketplacePurchaseSession {
  session_id:       string;
  org_id:           string | null;
  quote_id:         string | null;
  quote_ref:        string | null;
  client_name:      string | null;
  obra:             string | null;
  cart_id:          string | null;
  checkout_key:     string;
  current_route:    'catalog' | 'checkout';
  checkout_step:    CheckoutStep;
  delivery_options: Record<string, DeliveryOptionPerProvider> | null;
  buyer_data:       BuyerSnapshot | null;
  actor_ids:        string[];  // actores con ítems asignados — persiste para reconstruir providerSummary
  created_at:       string;
  updated_at:       string;
  expires_at:       string;
}

const SESSION_PREFIX = 'mkt_purchase_session';
const TTL_MS = 6 * 60 * 60 * 1000;

function sessionKey(quoteId: string | null | undefined): string {
  return quoteId ? `${SESSION_PREFIX}_${quoteId}` : `${SESSION_PREFIX}_noquote`;
}

export function createPurchaseSession(opts: {
  orgId:       string | null;
  quoteId:     string | null;
  quoteRef:    string | null;
  clientName:  string | null;
  obra:        string | null;
  cartId:      string | null;
  // checkout_key se genera internamente — nunca desde el ciclo de vida del componente
}): MarketplacePurchaseSession {
  const now = new Date().toISOString();
  return {
    session_id:       crypto.randomUUID(),
    org_id:           opts.orgId,
    quote_id:         opts.quoteId ?? null,
    quote_ref:        opts.quoteRef ?? null,
    client_name:      opts.clientName ?? null,
    obra:             opts.obra ?? null,
    cart_id:          opts.cartId,
    checkout_key:     crypto.randomUUID(),
    current_route:    'checkout',
    checkout_step:    'revisar',
    delivery_options: null,
    buyer_data:       null,
    actor_ids:        [],
    created_at:       now,
    updated_at:       now,
    expires_at:       new Date(Date.now() + TTL_MS).toISOString(),
  };
}

export function savePurchaseSession(session: MarketplacePurchaseSession): void {
  try {
    const updated = { ...session, updated_at: new Date().toISOString() };
    const json    = JSON.stringify(updated);
    const key     = sessionKey(session.quote_id);
    sessionStorage.setItem(key, json);
    localStorage.setItem(key, json);
  } catch { /* quota */ }
}

export function loadPurchaseSession(quoteId?: string | null): MarketplacePurchaseSession | null {
  try {
    const key = sessionKey(quoteId);
    const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as MarketplacePurchaseSession;
    if (!s.expires_at || new Date(s.expires_at).getTime() < Date.now()) {
      clearPurchaseSession(quoteId);
      return null;
    }
    // Retrocompatibilidad: actor_ids puede faltar en sesiones guardadas antes de RC1-C.6.3
    if (!s.actor_ids) s.actor_ids = [];
    return s;
  } catch {
    return null;
  }
}

export function clearPurchaseSession(quoteId?: string | null): void {
  const key     = sessionKey(quoteId);
  const cartKey = quoteId ? `mkt_cart_id_${quoteId}` : 'mkt_cart_id_noquote';
  sessionStorage.removeItem(key);
  sessionStorage.removeItem(cartKey);
  sessionStorage.removeItem(SESSION_PREFIX); // clave legacy sin quoteId
  try {
    localStorage.removeItem(key);
    localStorage.removeItem(SESSION_PREFIX); // clave legacy sin quoteId
  } catch { /* quota */ }
}
