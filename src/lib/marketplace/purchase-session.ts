// Sesión unificada de compra marketplace — persiste paso del wizard, datos de entrega y comprador.
// TTL 6h. Complementa MarketplacePurchaseContext (que guarda cart_id + datos del presupuesto).

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
  created_at:       string;
  updated_at:       string;
  expires_at:       string;
}

const SESSION_KEY = 'mkt_purchase_session';
const TTL_MS = 6 * 60 * 60 * 1000;

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
    created_at:       now,
    updated_at:       now,
    expires_at:       new Date(Date.now() + TTL_MS).toISOString(),
  };
}

export function savePurchaseSession(session: MarketplacePurchaseSession): void {
  try {
    const updated = { ...session, updated_at: new Date().toISOString() };
    const json = JSON.stringify(updated);
    sessionStorage.setItem(SESSION_KEY, json);
    localStorage.setItem(SESSION_KEY, json);
  } catch { /* quota */ }
}

export function loadPurchaseSession(): MarketplacePurchaseSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as MarketplacePurchaseSession;
    if (!s.expires_at || new Date(s.expires_at).getTime() < Date.now()) {
      clearPurchaseSession();
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearPurchaseSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  try { localStorage.removeItem(SESSION_KEY); } catch { /* quota */ }
}
