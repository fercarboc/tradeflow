import { supabase } from '../supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type CartEstado = 'active' | 'reviewing' | 'checkout' | 'ordered' | 'cancelled' | 'saved';
export type CartSourceType = 'quote' | 'job' | 'field_action' | 'maintenance_incident' | 'manual' | 'free' | 'reorder';
export type CartItemIATipo = 'consumible' | 'equivalente' | 'faltante' | 'optimizacion';
export type AIAnalysisAccion = 'add_item' | 'select_provider' | 'review_price' | 'group_orders';

export interface Cart {
  id: string;
  org_id: string;
  source_type: CartSourceType;
  source_id: string | null;
  source_ref: string | null;
  estado: CartEstado;
  notas: string | null;
  created_at: string;
}

export interface ProviderAlternative {
  offering_id: string;
  actor_id: string;
  actor_nombre: string;
  actor_slug: string;
  actor_verificado: boolean;
  precio_coste: number | null;
  precio_venta: number | null;
  unidad: string;
  delivery_days: number;
  stock_ok: boolean;
  stock_cantidad: number | null;
  permite_entrega: boolean;
  pedido_minimo: number | null;
  portes_gratis_desde: number | null;
  score: number;
}

export interface CartItem {
  id: string;
  source_item_type: string | null;
  source_item_id: string | null;
  descripcion_original: string;
  descripcion_compra: string | null;
  cantidad: number;
  unidad: string;
  universal_product_id: string | null;
  up_nombre_canonico: string | null;
  up_familia: string | null;
  up_match_confidence: number | null;
  up_match_method: string | null;
  image_url: string | null;
  selected_offering_id: string | null;
  selected_actor_id: string | null;
  selected_actor_nombre: string | null;
  provider_alternatives: ProviderAlternative[];
  ia_tipo: CartItemIATipo | null;
  ia_sugerencia: string | null;
  ia_añadido: boolean;
  precio_unitario_final: number | null;
  total_linea: number | null;
  activo: boolean;
}

export interface CartSummary {
  total_items: number;
  items_con_up: number;
  items_con_proveedor: number;
  total_estimado: number;
  providers_count: number;
}

export interface CartDetail {
  cart: Cart;
  items: CartItem[];
  summary: CartSummary;
}

export interface AIAnalysisSuggestion {
  tipo: string;
  titulo: string;
  descripcion: string;
  item_id: string | null;
  accion: AIAnalysisAccion;
  payload: Record<string, unknown>;
}

export interface CartProviderSummary {
  actor_id: string;
  actor_nombre: string;
  actor_verificado: boolean;
  items_count: number;
  subtotal: number;
  portes: number;
  total_estimado: number;
  delivery_days: number;
}

export interface CartOrderStatus {
  order_id: string;
  actor_nombre: string;
  actor_verificado: boolean;
  estado: string;
  total: number;
  items_count: number;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  completed_at: string | null;
}

export interface OrgCartRow {
  id: string;
  source_type: CartSourceType;
  source_ref: string | null;
  estado: CartEstado;
  items_count: number;
  total: number;
  created_at: string;
  ordered_at: string | null;
}

// ─── Constantes de UI ──────────────────────────────────────────────────────────

export const CART_ESTADO_LABELS: Record<CartEstado, string> = {
  active:    'Activo',
  reviewing: 'En revisión',
  checkout:  'Confirmando',
  ordered:   'Pedido realizado',
  cancelled: 'Cancelado',
  saved:     'Guardado',
};

export const SOURCE_TYPE_LABELS: Record<CartSourceType, string> = {
  quote:                'Presupuesto',
  job:                  'Trabajo',
  field_action:         'Actuación',
  maintenance_incident: 'Incidencia mantenimiento',
  manual:               'Pedido manual',
  free:                 'Compra libre',
  reorder:              'Repetición de pedido',
};

export const AI_TIPO_LABELS: Record<CartItemIATipo, string> = {
  consumible:   'Consumible sugerido',
  equivalente:  'Equivalente sugerido',
  faltante:     'Material faltante',
  optimizacion: 'Optimización',
};

export const AI_TIPO_COLORS: Record<CartItemIATipo, string> = {
  consumible:   'text-teal-600 bg-teal-50',
  equivalente:  'text-blue-600 bg-blue-50',
  faltante:     'text-amber-600 bg-amber-50',
  optimizacion: 'text-violet-600 bg-violet-50',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function rpcError(context: string, error: unknown): never {
  const msg = error instanceof Error
    ? error.message
    : (typeof error === 'object' && error !== null && 'message' in error)
      ? String((error as { message: unknown }).message)
      : String(error);
  throw new Error(`[${context}] ${msg}`);
}

// ─── RPCs ───────────────────────────────────────────────────────────────────

export async function createCartFromQuote(quoteId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_cart_from_quote', { p_quote_id: quoteId });
  if (error) rpcError('createCartFromQuote', error);
  return data as string;
}

export async function createCartFromJob(jobId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_cart_from_job', { p_job_id: jobId });
  if (error) rpcError('createCartFromJob', error);
  return data as string;
}

export async function createCartFromFieldAction(actionId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_cart_from_field_action', { p_action_id: actionId });
  if (error) rpcError('createCartFromFieldAction', error);
  return data as string;
}

export async function createCartFromMaintenanceIncident(incidentId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_cart_from_maintenance_incident', { p_incident_id: incidentId });
  if (error) rpcError('createCartFromMaintenanceIncident', error);
  return data as string;
}

export async function getCartDetail(cartId: string): Promise<CartDetail> {
  const { data, error } = await (supabase as any).rpc('get_cart_detail', { p_cart_id: cartId });
  if (error) rpcError('getCartDetail', error);
  return data as CartDetail;
}

export async function analyzeCartWithAI(cartId: string): Promise<AIAnalysisSuggestion[]> {
  const { data, error } = await (supabase as any).rpc('analyze_cart_with_ai', { p_cart_id: cartId });
  if (error) rpcError('analyzeCartWithAI', error);
  return (data ?? []) as AIAnalysisSuggestion[];
}

export async function addCartItem(params: {
  cartId: string;
  descripcion: string;
  cantidad?: number;
  unidad?: string;
  iaTipo?: CartItemIATipo | null;
  iaSugerencia?: string | null;
  iaAñadido?: boolean;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc('add_cart_item', {
    p_cart_id:     params.cartId,
    p_descripcion: params.descripcion,
    p_cantidad:    params.cantidad ?? 1,
    p_unidad:      params.unidad ?? 'ud',
    p_ia_tipo:     params.iaTipo ?? null,
    p_ia_sugerencia: params.iaSugerencia ?? null,
    p_ia_añadido:  params.iaAñadido ?? false,
  });
  if (error) rpcError('addCartItem', error);
  return data as string;
}

export async function selectOfferingForCartItem(itemId: string, offeringId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('select_offering_for_cart_item', {
    p_item_id:    itemId,
    p_offering_id: offeringId,
  });
  if (error) rpcError('selectOfferingForCartItem', error);
}

export async function autoSelectProviders(
  cartId: string,
  strategy: 'balance' | 'precio' | 'velocidad' | 'consolidar' = 'balance'
): Promise<number> {
  const { data, error } = await (supabase as any).rpc('auto_select_providers', {
    p_cart_id:  cartId,
    p_strategy: strategy,
  });
  if (error) rpcError('autoSelectProviders', error);
  return data as number;
}

export async function updateCartItem(params: {
  itemId: string;
  cantidad?: number;
  unidad?: string;
  descripcion?: string;
  activo?: boolean;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('update_cart_item', {
    p_item_id:     params.itemId,
    p_cantidad:    params.cantidad ?? null,
    p_unidad:      params.unidad ?? null,
    p_descripcion: params.descripcion ?? null,
    p_activo:      params.activo ?? null,
  });
  if (error) rpcError('updateCartItem', error);
}

export async function getCartProviderSummary(cartId: string): Promise<CartProviderSummary[]> {
  const { data, error } = await (supabase as any).rpc('get_cart_provider_summary', { p_cart_id: cartId });
  if (error) rpcError('getCartProviderSummary', error);
  return (data ?? []) as CartProviderSummary[];
}

export async function checkoutCart(cartId: string): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc('checkout_cart', { p_cart_id: cartId });
  if (error) rpcError('checkoutCart', error);
  return (data ?? []) as string[];
}

export async function getCartOrderStatus(cartId: string): Promise<CartOrderStatus[]> {
  const { data, error } = await (supabase as any).rpc('get_cart_order_status', { p_cart_id: cartId });
  if (error) rpcError('getCartOrderStatus', error);
  return (data ?? []) as CartOrderStatus[];
}

export async function listOrgCarts(params: {
  orgId: string;
  estado?: CartEstado;
  limit?: number;
  offset?: number;
}): Promise<OrgCartRow[]> {
  const { data, error } = await (supabase as any).rpc('list_org_carts', {
    p_org_id:  params.orgId,
    p_estado:  params.estado ?? null,
    p_limit:   params.limit ?? 20,
    p_offset:  params.offset ?? 0,
  });
  if (error) rpcError('listOrgCarts', error);
  return (data ?? []) as OrgCartRow[];
}
