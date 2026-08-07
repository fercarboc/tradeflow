// Contexto de compra del instalador cuando viene desde un presupuesto.
// Persiste en sessionStorage (sesión activa) + localStorage (recuperación tras salir).

export interface MarketplacePurchaseContext {
  source:         'quote' | 'free';
  cartId:         string;
  quoteId?:       string | null;
  quoteRef?:      string | null;      // e.g. "PRE-2026-085"
  customerName?:  string | null;
  projectName?:   string | null;
  orgId?:         string | null;
  lineCount?:     number;             // líneas de material en el presupuesto
  createdAt:      string;             // ISO timestamp
}

const SESSION_KEY = 'mkt_purchase_ctx';
const LOCAL_KEY   = 'mkt_purchase_ctx_bak';
// Tiempo máximo de vida del contexto: 6 horas.
// Después de ese tiempo se considera obsoleto y no se usa para abrir el wizard automáticamente.
const MAX_AGE_MS  = 6 * 60 * 60 * 1000;

export function isContextFresh(ctx: MarketplacePurchaseContext): boolean {
  if (!ctx.createdAt) return false;
  return (Date.now() - new Date(ctx.createdAt).getTime()) < MAX_AGE_MS;
}

export function savePurchaseContext(ctx: MarketplacePurchaseContext): void {
  const json = JSON.stringify(ctx);
  sessionStorage.setItem(SESSION_KEY, json);
  try { localStorage.setItem(LOCAL_KEY, json); } catch { /* quota */ }
}

export function loadPurchaseContext(): MarketplacePurchaseContext | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as MarketplacePurchaseContext;
    if (!ctx.cartId) return null;
    if (!isContextFresh(ctx)) {
      // Contexto expirado — limpiarlo para evitar que el wizard cargue con datos obsoletos
      clearPurchaseContext();
      return null;
    }
    return ctx;
  } catch {
    return null;
  }
}

export function clearPurchaseContext(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('mkt_cart_id');
  try { localStorage.removeItem(LOCAL_KEY); } catch { /* quota */ }
}
