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

// ─── RC1-C.3 — Checkout Multiproveedor ────────────────────────────────────────

export type DeliveryMethod = 'entrega_obra' | 'entrega_almacen' | 'recogida_proveedor' | 'por_coordinar';
export type PaymentMethod  = 'cuenta_proveedor' | 'transferencia' | 'pago_recoger' | 'online' | 'domiciliacion';

export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  entrega_obra:       'Entrega en obra',
  entrega_almacen:    'Entrega en almacén/oficina',
  recogida_proveedor: 'Recogida en tienda/almacén',
  por_coordinar:      'Pendiente de coordinar',
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cuenta_proveedor: 'Cuenta con proveedor',
  transferencia:    'Transferencia bancaria',
  pago_recoger:     'Pago al recoger',
  online:           'Pago online',
  domiciliacion:    'Domiciliación/crédito',
};

export interface DeliveryAddress {
  calle:           string;
  cp:              string;
  ciudad:          string;
  provincia?:      string;
  pais?:           string;
  nombre_contacto: string;
  telefono_contacto: string;
  franja_horaria?: string;
  instrucciones?:  string;
}

export interface PickupPoint {
  id:        string;
  nombre:    string;
  direccion: DeliveryAddress;
  telefono:  string | null;
  orden:     number;
}

// ─── RC1-C.5A.2 — Locations (trade_marketplace_supplier_locations) ────────────

export type SupplierLocationTipo = 'tienda' | 'almacen' | 'delegacion' | 'punto_recogida';

export const SUPPLIER_LOCATION_TIPO_LABELS: Record<SupplierLocationTipo, string> = {
  tienda:          'Tienda',
  almacen:         'Almacén',
  delegacion:      'Delegación',
  punto_recogida:  'Punto de recogida',
};

export interface SupplierLocation {
  id:                    string;
  codigo_interno:        string | null;
  nombre:                string;
  tipo:                  SupplierLocationTipo;
  direccion_linea1:      string | null;
  localidad:             string;
  provincia:             string;
  codigo_postal:         string | null;
  telefono:              string | null;
  horario:               Record<string, unknown> | null;
  permite_recogida:      boolean;
  permite_entrega_local: boolean;
  radio_servicio_km:     number | null;
  orden:                 number;
}

export interface SupplierCheckoutConfig {
  actor_id:                string;
  actor_nombre:            string;
  actor_verificado:        boolean;
  permite_entrega:         boolean;
  permite_recogida:        boolean;
  permite_coordinar:       boolean;
  payment_methods_allowed: PaymentMethod[];
  portes_gratis_desde:     number | null;
  coste_portes:            number | null;
  plazo_entrega_dias:      number;
  plazo_confirmacion_h:    number;
  mensaje_instaladores:    string | null;
  /** @deprecated desde RC1-C.5A.2 — siempre vacío; usar supplier_locations */
  pickup_points:           PickupPoint[];
  /** RC1-C.5A.2: locations activas del proveedor */
  supplier_locations:      SupplierLocation[];
}

export interface DeliveryOptionPerProvider {
  delivery_method:           DeliveryMethod;
  delivery_address?:         DeliveryAddress;
  /** @deprecated usar pickup_location_id */
  pickup_point_id?:          string | null;
  /** RC1-C.5A.2: id de la location seleccionada */
  pickup_location_id?:       string | null;
  /** RC1-C.5A.2: snapshot de la location en el momento del pedido */
  pickup_location_snapshot?: SupplierLocation | null;
  payment_method:            PaymentMethod;
  notas?:                    string;
}

export interface BuyerSnapshot {
  nombre:   string;
  empresa:  string;
  nif:      string;
  email:    string;
  telefono: string;
}

export interface OrderByIdRow {
  order_id:         string;
  numero:           string;
  actor_nombre:     string;
  actor_verificado: boolean;
  estado:           string;
  total:            number;
  items_count:      number;
  delivery_method:  DeliveryMethod | null;
  delivery_address: DeliveryAddress | null;
  pickup_point_id:  string | null;
  payment_method:   PaymentMethod | null;
  created_at:       string;
  confirmed_at:     string | null;
  shipped_at:       string | null;
  completed_at:     string | null;
}

export async function getSupplierCheckoutConfigs(actorIds: string[]): Promise<SupplierCheckoutConfig[]> {
  const { data, error } = await (supabase as any).rpc('get_supplier_checkout_config', {
    p_actor_ids: actorIds,
  });
  if (error) rpcError('getSupplierCheckoutConfigs', error);
  return (data ?? []) as SupplierCheckoutConfig[];
}

export async function checkoutCartV2(params: {
  cartId:        string;
  deliveryData:  Record<string, DeliveryOptionPerProvider>;
  buyerSnapshot: BuyerSnapshot;
  checkoutKey:   string;
}): Promise<string[]> {
  const { data, error } = await (supabase as any).rpc('checkout_cart_v2', {
    p_cart_id:        params.cartId,
    p_delivery_data:  params.deliveryData,
    p_buyer_snapshot: params.buyerSnapshot,
    p_checkout_key:   params.checkoutKey,
  });
  if (error) rpcError('checkoutCartV2', error);
  return (data ?? []) as string[];
}

export async function getOrdersByIds(orderIds: string[]): Promise<OrderByIdRow[]> {
  const { data, error } = await (supabase as any).rpc('get_orders_by_ids', { p_order_ids: orderIds });
  if (error) rpcError('getOrdersByIds', error);
  return (data ?? []) as OrderByIdRow[];
}

// ─── Carrito libre (sin presupuesto) ────────────────────────────────────────

export async function createFreeCart(orgId: string): Promise<string> {
  const { data, error } = await (supabase as any).rpc('create_free_cart', { p_org_id: orgId });
  if (error) rpcError('createFreeCart', error);
  return data as string;
}

export interface FreeCartItemInput {
  descripcion:          string;
  cantidad:             number;
  unidad:               string;
  universal_product_id: string | null;
  offering_id:          string;
  actor_id:             string;
  precio_unitario:      number;
}

export async function addFreeCartItems(cartId: string, items: FreeCartItemInput[]): Promise<void> {
  const { error } = await (supabase as any).rpc('add_free_cart_items', {
    p_cart_id: cartId,
    p_items:   items,
  });
  if (error) rpcError('addFreeCartItems', error);
}

// Recuperación ante timeout: busca pedidos existentes para esta clave de idempotencia.
// Si el RPC completó en backend antes de que el cliente recibiera el timeout, los pedidos
// ya existen y no hay que crearlos de nuevo.
export async function getOrdersByCheckoutKey(checkoutKey: string): Promise<string[]> {
  if (!checkoutKey) return [];
  const { data } = await (supabase as any)
    .from('trade_marketplace_orders')
    .select('id')
    .eq('checkout_key', checkoutKey)
    .neq('estado', 'cancelled');
  return ((data ?? []) as Array<{ id: string }>).map(r => r.id);
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

// ─── RC1-C.3A — Sprint Guest-1: Tipos para checkout de invitados ──────────────
// Feature flag: VITE_GUEST_CHECKOUT_ENABLED — activar en Sprint Guest-2
// Edge Function checkout-guest y token management también en Sprint Guest-2.

export type PrecioTipo =
  | 'pvd'
  | 'pvp'
  | 'promo_publica'
  | 'promo_profesional'
  | 'condicion_particular';

export type BuyerMode = 'public' | 'professional';

export interface EffectivePriceResult {
  precio_neto:        number;
  precio_con_iva:     number;
  tax_rate:           number;
  currency:           string;
  precio_tipo:        PrecioTipo;
  regla_aplicada:     string;
  promotion_id:       string | null;
  condition_id:       string | null;
  condition_price_id: string | null;
  resolution_version: number;
  valid_until:        string | null;
}

export interface OfferingPromo {
  id:              string;
  offering_id:     string;
  audience:        'public' | 'professional' | 'both';
  precio_promo_neto: number;
  descuento_pct:   number | null;
  etiqueta:        string | null;
  valid_from:      string;
  valid_until:     string;
  activa:          boolean;
}

export interface GuestBuyer {
  email:    string;
  nombre:   string;
  empresa?: string;
  telefono?: string;
  nif?:     string;
}

export interface GuestCartItem {
  offering_id:     string;
  cantidad:        number;
  precio_neto:     number;
  precio_con_iva:  number;
  tax_rate:        number;
  currency:        string;
  precio_tipo:     PrecioTipo;
  promotion_id:    string | null;
}

export interface GuestDeliveryOption {
  actor_id:        string;
  delivery_method: DeliveryMethod;
  delivery_address?: DeliveryAddress;
  pickup_point_id?: string | null;
  notas?:          string;
}

// Sprint Guest-2: payload para Edge Function checkout-guest
export interface GuestCheckoutPayload {
  buyer:         GuestBuyer;
  items:         GuestCartItem[];
  delivery:      GuestDeliveryOption[];
  checkout_key:  string;
  turnstile_token: string;
}

// Sprint Guest-2: respuesta de Edge Function checkout-guest
export interface GuestCheckoutResult {
  guest_customer_id: string;
  order_ids:         string[];
  session_token:     string;
  token_prefix:      string;
  expires_at:        string;
}

// ─── RC1-C.5A.2 — Locations & price resolution ────────────────────────────────

export interface LocationForActor extends SupplierLocation {
  distancia_km: number | null;
}

export async function getLocationsForActor(params: {
  actorId:       string;
  permiteRecogida?: boolean;
  obraLat?:      number | null;
  obraLon?:      number | null;
}): Promise<LocationForActor[]> {
  const { data, error } = await (supabase as any).rpc('get_locations_for_actor', {
    p_actor_id:        params.actorId,
    p_permite_recogida: params.permiteRecogida ?? null,
    p_obra_lat:        params.obraLat ?? null,
    p_obra_lon:        params.obraLon ?? null,
  });
  if (error) rpcError('getLocationsForActor', error);
  return (data ?? []) as LocationForActor[];
}

export interface LocalStockResult {
  stock_status:     string;
  stock_cantidad:   number | null;
  disponible_hoy:   boolean;
  stock_source:     string;
}

export async function getLocalStock(params: {
  offeringId:  string;
  locationId:  string;
}): Promise<LocalStockResult | null> {
  const { data, error } = await (supabase as any).rpc('get_local_stock', {
    p_offering_id: params.offeringId,
    p_location_id: params.locationId,
  });
  if (error) rpcError('getLocalStock', error);
  const rows = data as LocalStockResult[];
  return rows?.[0] ?? null;
}

export interface EffectivePriceResultV2 {
  net_amount:         number;
  tax_rate:           number;
  gross_amount:       number;
  price_source:       string;
  promotion_id:       string | null;
  location_id:        string | null;
  valid_until:        string | null;
  resolution_version: string;
}

export async function resolveEffectivePriceWithLocation(params: {
  offeringId:      string;
  orgId?:          string | null;
  locationId?:     string | null;
  comunidadAuto?:  string | null;
  cantidad?:       number;
}): Promise<EffectivePriceResultV2 | null> {
  const { data, error } = await (supabase as any).rpc('resolve_effective_offering_price', {
    p_offering_id:    params.offeringId,
    p_org_id:         params.orgId ?? null,
    p_location_id:    params.locationId ?? null,
    p_comunidad_auto: params.comunidadAuto ?? null,
    p_cantidad:       params.cantidad ?? 1,
  });
  if (error) rpcError('resolveEffectivePriceWithLocation', error);
  const rows = data as EffectivePriceResultV2[];
  return rows?.[0] ?? null;
}

// Sprint Guest-2: resultado de seguimiento de pedido invitado
export interface GuestOrderTrackingResult {
  order_id:        string;
  numero:          string;
  actor_nombre:    string;
  estado:          string;
  total:           number;
  items_count:     number;
  created_at:      string;
  confirmed_at:    string | null;
  shipped_at:      string | null;
  completed_at:    string | null;
}

// Sprint Guest-2: función para resolver precio efectivo vía RPC
export async function resolveEffectivePrice(params: {
  offeringId: string;
  buyerMode:  BuyerMode;
  orgId?:     string;
  quantity?:  number;
}): Promise<EffectivePriceResult> {
  const { data, error } = await (supabase as any).rpc('resolve_effective_offering_price', {
    p_offering_id: params.offeringId,
    p_buyer_mode:  params.buyerMode,
    p_org_id:      params.orgId ?? null,
    p_quantity:    params.quantity ?? 1,
  });
  if (error) rpcError('resolveEffectivePrice', error);
  const rows = data as EffectivePriceResult[];
  if (!rows || rows.length === 0) throw new Error('[resolveEffectivePrice] Sin resultado');
  return rows[0];
}
