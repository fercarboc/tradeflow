import { supabase } from '../supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── Tipos de estado ───────────────────────────────────────────────────────────

export type PortalOrderEstado =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export type PortalOfferingIAEstado =
  | 'compatible'
  | 'revisar'
  | 'duplicado'
  | 'mejor_coincidencia'
  | 'sin_up'
  | 'sin_stock';

export type PortalNotificationTipo =
  | 'order_received'
  | 'order_cancelled'
  | 'invitation'
  | 'incident'
  | 'catalog_alert'
  | 'system';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface PortalDashboardStats {
  total_offerings:    number;
  matched_offerings:  number;
  unmatched_offerings: number;
  no_stock_offerings: number;
  coverage_pct:       number;
  pending_orders:     number;
  confirmed_orders:   number;
  completed_orders:   number;
  total_buyers:       number;
  month_revenue:      number;
}

export interface PortalActionItem {
  tipo:       string;
  severidad:  'critical' | 'warning' | 'info';
  titulo:     string;
  descripcion: string;
  count_items: number;
  cta_label:  string;
  cta_target: 'catalogo' | 'pedidos' | 'equipo' | 'config';
}

export interface PortalAIInsight {
  insight_type: string;
  titulo:       string;
  descripcion:  string;
  valor:        number | null;
  unidad:       string | null;
  accion:       string;
}

// ── Catálogo / Offerings ──────────────────────────────────────────────────────

export interface PortalOffering {
  id:                    string;
  supplier_ref:          string | null;
  descripcion_comercial: string | null;
  precio_coste:          number | null;
  precio_venta:          number | null;
  unidad:                string;
  stock_disponible:      boolean;
  stock_cantidad:        number | null;
  plazo_entrega_dias:    number | null;
  match_state:           string;
  match_method:          string | null;
  match_confidence:      number | null;
  universal_product_id:  string | null;
  up_nombre_canonico:    string | null;
  up_familia:            string | null;
  ia_estado:             PortalOfferingIAEstado;
  ia_explicacion:        string;
  activa:                boolean;
  image_url:             string | null;
  created_at:            string;
  updated_at:            string;
  total_count:           number;
}

export interface OfferingEvent {
  id:            string;
  tipo:          'importado' | 'editado' | 'precio' | 'stock' | 'imagen' | 'estado' | 'ia_vinculado' | 'ia_desvinculado';
  datos_antes:   Record<string, unknown> | null;
  datos_despues: Record<string, unknown> | null;
  created_at:    string;
}

export interface CatalogQualityStats {
  total:        number;
  matched:      number;
  sin_imagen:   number;
  sin_stock:    number;
  inactivos:    number;
  cobertura_pct: number;
}

export interface PortalOfferingPage {
  items:      PortalOffering[];
  totalCount: number;
}

export interface MatchCandidate {
  up_id:            string;
  nombre_canonico:  string;
  familia:          string | null;
  oficio:           string | null;
  marca:            string | null;
  modelo:           string | null;
  ean:              string | null;
  mpn:              string | null;
  score:            number;
  match_ean:        boolean;
  match_mpn:        boolean;
  match_marca:      boolean;
  match_familia:    boolean;
  match_descripcion: boolean;
  explicacion:      string;
  ofertas_count:    number;
}

// ── Pedidos ───────────────────────────────────────────────────────────────────

export interface PortalOrder {
  id:             string;
  source:         'legacy' | 'marketplace';
  numero:         string;
  org_nombre:     string;
  org_id:         string;
  estado:         PortalOrderEstado;
  original_estado: string;
  total:          number;
  items_count:    number;
  notas:          string | null;
  created_at:     string;
  confirmed_at:   string | null;
  shipped_at:     string | null;
  completed_at:   string | null;
  total_count:    number;
}

export interface PortalOrderPage {
  items:      PortalOrder[];
  totalCount: number;
}

// ── Detalle de pedido (SlideOver MVP-4) ───────────────────────────────────────

export interface PortalOrderItem {
  id:              string;
  referencia:      string | null;
  descripcion:     string;
  unidad:          string;
  cantidad:        number;
  precio_unitario: number | null;
  precio_total:    number | null;
}

export interface PortalOrderEvent {
  id:          string;
  tipo:        string;
  from_estado: string | null;
  to_estado:   string | null;
  actor_type:  string;
  notas:       string | null;
  created_at:  string;
}

export interface PortalPickupLocationSnapshot {
  id:               string;
  nombre:           string;
  direccion_linea1: string | null;
  codigo_postal:    string | null;
  localidad:        string | null;
  provincia:        string | null;
  telefono:         string | null;
}

export interface PortalOrderDetailOrder {
  id:                       string;
  numero:                   string;
  estado:                   PortalOrderEstado;
  actor_id:                 string;
  actor_nombre:             string;
  actor_verificado:         boolean;
  org_id:                   string;
  subtotal:                 number;
  coste_envio:              number;
  total:                    number;
  notas:                    string | null;
  notas_proveedor:          string | null;
  tracking_ref:             string | null;
  tracking_url:             string | null;
  delivery_address:         string | null;
  delivery_method:          string | null;
  payment_method:           string | null;
  delivery_notas:           string | null;
  direccion_entrega:        Record<string, unknown> | null;
  pickup_location_id:       string | null;
  pickup_location_snapshot: PortalPickupLocationSnapshot | null;
  cancel_reason:            string | null;
  created_at:               string;
  confirmed_at:             string | null;
  preparing_at:             string | null;
  shipped_at:               string | null;
  delivered_at:             string | null;
  cancelled_at:             string | null;
  completed_at:             string | null;
}

export interface PortalOrderDetail {
  order:           PortalOrderDetailOrder;
  items:           PortalOrderItem[];
  events:          PortalOrderEvent[];
  supplier_config: {
    horario_entrega:       Record<string, unknown> | null;
    mensaje_instaladores:  string | null;
    permite_recogida:      boolean;
  } | null;
}

export interface SupplierOrderAlerts {
  pending_count:  number;
  pending_urgent: number;
  atrasados:      number;
}

// ── Health Score ──────────────────────────────────────────────────────────────

export interface SupplierHealthScore {
  score:           number;
  cobertura_pts:   number;
  stock_pts:       number;
  respuesta_pts:   number;
  completado_pts:  number;
  cobertura_pct:   number;
  stock_pct:       number;
  avg_confirm_h:   number | null;
  completion_rate: number;
}

// ── Notificaciones ────────────────────────────────────────────────────────────

export interface PortalNotification {
  id:         string;
  tipo:       PortalNotificationTipo;
  titulo:     string;
  cuerpo:     string | null;
  ref_id:     string | null;
  ref_tipo:   string | null;
  leida:      boolean;
  leida_at:   string | null;
  created_at: string;
}

// ── Configuración del proveedor ───────────────────────────────────────────────

export interface SupplierConfig {
  id:                     string;
  actor_id:               string;
  permite_recogida:       boolean;
  permite_entrega:        boolean;
  radio_entrega_km:       number | null;
  pedido_minimo:          number | null;
  portes_gratis_desde:    number | null;
  coste_portes:           number | null;
  permite_urgencias:      boolean;
  coste_urgencia:         number | null;
  horario_recogida:       Record<string, unknown> | null;
  horario_entrega:        Record<string, unknown> | null;
  plazo_confirmacion_h:   number;
  plazo_preparacion_dias: number;
  plazo_entrega_dias:     number;
  mensaje_instaladores:   string | null;
  created_at:             string;
  updated_at:             string;
}

// ── API — Dashboard ───────────────────────────────────────────────────────────

export async function getSupplierDashboardStats(
  actorId: string,
): Promise<PortalDashboardStats> {
  const { data, error } = await db.rpc('get_supplier_dashboard_stats', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return data as PortalDashboardStats;
}

export async function getSupplierActionCenter(
  actorId: string,
): Promise<PortalActionItem[]> {
  const { data, error } = await db.rpc('get_supplier_action_center', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return (data ?? []) as PortalActionItem[];
}

export async function getSupplierAIInsights(
  actorId: string,
): Promise<PortalAIInsight[]> {
  const { data, error } = await db.rpc('get_supplier_ai_insights', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return (data ?? []) as PortalAIInsight[];
}

// ── API — Catálogo ────────────────────────────────────────────────────────────

export async function getSupplierOfferingsPaged(
  actorId: string,
  opts?: {
    search?:     string;
    matchState?: string;
    activa?:     boolean;
    stock?:      boolean;
    sortBy?:     string;
    sortDir?:    'asc' | 'desc';
    limit?:      number;
    offset?:     number;
  },
): Promise<PortalOfferingPage> {
  const { data, error } = await db.rpc('get_supplier_offerings_paged', {
    p_actor_id:    actorId,
    p_search:      opts?.search     ?? null,
    p_match_state: opts?.matchState ?? null,
    p_activa:      opts?.activa     ?? null,
    p_stock:       opts?.stock      ?? null,
    p_sort_by:     opts?.sortBy     ?? 'updated_at',
    p_sort_dir:    opts?.sortDir    ?? 'desc',
    p_limit:       opts?.limit      ?? 20,
    p_offset:      opts?.offset     ?? 0,
  });
  if (error) throw error;
  const rows = (data ?? []) as PortalOffering[];
  return {
    items:      rows,
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function updateSupplierOffering(
  offeringId: string,
  updates: {
    precio_coste?:          number | null;
    precio_venta?:          number | null;
    stock_disponible?:      boolean;
    stock_cantidad?:        number | null;
    descripcion_comercial?: string;
    plazo_entrega_dias?:    number;
    activa?:                boolean;
    unidad?:                string;
  },
  actorId?: string,
): Promise<void> {
  const { error } = await db.rpc('update_supplier_offering', {
    p_offering_id:           offeringId,
    p_precio_coste:          updates.precio_coste          ?? null,
    p_precio_venta:          updates.precio_venta          ?? null,
    p_stock_disponible:      updates.stock_disponible      ?? null,
    p_stock_cantidad:        updates.stock_cantidad         ?? null,
    p_descripcion_comercial: updates.descripcion_comercial ?? null,
    p_plazo_entrega_dias:    updates.plazo_entrega_dias    ?? null,
    p_activa:                updates.activa                ?? null,
    p_unidad:                updates.unidad                ?? null,
    p_actor_id:              actorId                       ?? null,
  });
  if (error) throw error;
}

export async function updateOfferingImage(
  actorId:    string,
  offeringId: string,
  imageUrl:   string | null,
): Promise<void> {
  const { error } = await db.rpc('update_offering_image', {
    p_actor_id:    actorId,
    p_offering_id: offeringId,
    p_image_url:   imageUrl,
  });
  if (error) throw error;
}

export async function uploadOfferingImage(
  actorId:    string,
  offeringId: string,
  file:       File,
): Promise<string> {
  const path = `${actorId}/${offeringId}`;
  const { error } = await supabase.storage
    .from('marketplace-offerings')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('marketplace-offerings').getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteOfferingImageFile(
  actorId:    string,
  offeringId: string,
): Promise<void> {
  await supabase.storage
    .from('marketplace-offerings')
    .remove([`${actorId}/${offeringId}`]);
}

export async function getOfferingEvents(
  actorId:    string,
  offeringId: string,
  limit = 30,
): Promise<OfferingEvent[]> {
  const { data, error } = await db.rpc('get_offering_events', {
    p_actor_id:    actorId,
    p_offering_id: offeringId,
    p_limit:       limit,
  });
  if (error) throw error;
  return (data ?? []) as OfferingEvent[];
}

export async function getCatalogQualityStats(
  actorId: string,
): Promise<CatalogQualityStats> {
  const { data, error } = await db.rpc('get_catalog_quality_stats', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return (data ?? { total: 0, matched: 0, sin_imagen: 0, sin_stock: 0, inactivos: 0, cobertura_pct: 0 }) as CatalogQualityStats;
}

export async function bulkUpdateOfferings(
  actorId: string,
  ids: string[],
  updates: { activa?: boolean; stock_disponible?: boolean },
): Promise<number> {
  const { data, error } = await db.rpc('bulk_update_offerings', {
    p_actor_id:         actorId,
    p_ids:              ids,
    p_activa:           updates.activa           ?? null,
    p_stock_disponible: updates.stock_disponible ?? null,
  });
  if (error) throw error;
  return (data as { updated: number })?.updated ?? 0;
}

export async function recordOfferingEvent(params: {
  actorId:      string;
  offeringId:   string;
  tipo:         'ia_vinculado' | 'ia_desvinculado';
  datosDespues: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db.rpc('record_offering_event', {
    p_actor_id:      params.actorId,
    p_offering_id:   params.offeringId,
    p_tipo:          params.tipo,
    p_datos_antes:   null,
    p_datos_despues: params.datosDespues,
  });
  if (error) throw error;
}

export async function matchOfferingToUP(
  offeringId: string,
  upId: string,
  method: 'admin' | 'supplier' = 'supplier',
): Promise<void> {
  const { error } = await db.rpc('match_offering_to_up', {
    p_offering_id: offeringId,
    p_up_id:       upId,
    p_method:      method,
  });
  if (error) throw error;
}

export async function unmatchOffering(offeringId: string): Promise<void> {
  const { error } = await db.rpc('unmatch_offering', { p_offering_id: offeringId });
  if (error) throw error;
}

export async function getOfferingMatchCandidates(
  offeringId: string,
  query?: string,
  limit = 5,
): Promise<MatchCandidate[]> {
  const { data, error } = await db.rpc('get_offering_match_candidates', {
    p_offering_id: offeringId,
    p_query:       query ?? null,
    p_limit:       limit,
  });
  if (error) throw error;
  // RPC returns first column as "id"; MatchCandidate uses "up_id"
  return ((data ?? []) as Array<Record<string, unknown>>).map(row => ({
    ...row,
    up_id: row['id'],
  })) as MatchCandidate[];
}

// ── API — Pedidos ─────────────────────────────────────────────────────────────

export async function getSupplierOrdersUnified(
  actorId: string,
  opts?: {
    estado?:  string;
    limit?:   number;
    offset?:  number;
  },
): Promise<PortalOrderPage> {
  const { data, error } = await db.rpc('get_supplier_orders_unified', {
    p_actor_id: actorId,
    p_estado:   opts?.estado ?? null,
    p_limit:    opts?.limit  ?? 20,
    p_offset:   opts?.offset ?? 0,
  });
  if (error) throw error;
  const rows = (data ?? []) as PortalOrder[];
  return {
    items:      rows,
    totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0,
  };
}

export async function confirmSupplierOrder(
  orderId: string,
  source: 'legacy' | 'marketplace' = 'legacy',
): Promise<void> {
  const { error } = await db.rpc('confirm_supplier_order', {
    p_order_id: orderId,
    p_source:   source,
  });
  if (error) throw error;
}

export async function shipSupplierOrder(
  orderId: string,
  source: 'legacy' | 'marketplace' = 'legacy',
  tracking?: string,
): Promise<void> {
  const { error } = await db.rpc('ship_supplier_order', {
    p_order_id: orderId,
    p_source:   source,
    p_tracking: tracking ?? null,
  });
  if (error) throw error;
}

// ── API — Pedidos MVP-4 ───────────────────────────────────────────────────────

export async function getSupplierOrderDetail(
  actorId: string,
  orderId: string,
): Promise<PortalOrderDetail> {
  const { data, error } = await db.rpc('get_supplier_order_detail', {
    p_actor_id: actorId,
    p_order_id: orderId,
  });
  if (error) throw error;
  return data as PortalOrderDetail;
}

export async function getSupplierOrderAlerts(
  actorId: string,
): Promise<SupplierOrderAlerts> {
  const { data, error } = await db.rpc('get_supplier_order_alerts', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return (data ?? { pending_count: 0, pending_urgent: 0, atrasados: 0 }) as SupplierOrderAlerts;
}

export async function cancelSupplierOrder(
  orderId:  string,
  actorId:  string,
  reason?:  string,
): Promise<void> {
  const { error } = await db.rpc('cancel_supplier_order', {
    p_order_id: orderId,
    p_actor_id: actorId,
    p_reason:   reason ?? null,
  });
  if (error) throw error;
}

export async function markSupplierOrderIncident(
  orderId:     string,
  actorId:     string,
  description: string,
): Promise<void> {
  const { error } = await db.rpc('mark_supplier_order_incident', {
    p_order_id:    orderId,
    p_actor_id:    actorId,
    p_description: description,
  });
  if (error) throw error;
}

export async function bulkConfirmSupplierOrders(
  actorId:  string,
  orderIds: string[],
): Promise<number> {
  const { data, error } = await db.rpc('bulk_confirm_supplier_orders', {
    p_actor_id:  actorId,
    p_order_ids: orderIds,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function bulkShipSupplierOrders(
  actorId:  string,
  orderIds: string[],
  tracking?: string,
): Promise<number> {
  const { data, error } = await db.rpc('bulk_ship_supplier_orders', {
    p_actor_id:  actorId,
    p_order_ids: orderIds,
    p_tracking:  tracking ?? null,
  });
  if (error) throw error;
  return (data as number) ?? 0;
}

// ── API — Health Score ────────────────────────────────────────────────────────

export async function getSupplierHealthScore(
  actorId: string,
): Promise<SupplierHealthScore | null> {
  const { data, error } = await db.rpc('get_supplier_health_score', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return data && data.length > 0 ? (data[0] as SupplierHealthScore) : null;
}

// ── API — Notificaciones ──────────────────────────────────────────────────────

export async function getSupplierNotifications(
  actorId: string,
  opts?: { limit?: number; unreadOnly?: boolean },
): Promise<PortalNotification[]> {
  const { data, error } = await db.rpc('get_supplier_notifications', {
    p_actor_id:    actorId,
    p_limit:       opts?.limit      ?? 20,
    p_unread_only: opts?.unreadOnly ?? false,
  });
  if (error) throw error;
  return (data ?? []) as PortalNotification[];
}

export async function markNotificationsRead(
  actorId: string,
  ids: string[],
): Promise<void> {
  const { error } = await db.rpc('mark_notifications_read', {
    p_actor_id:        actorId,
    p_notification_ids: ids,
  });
  if (error) throw error;
}

export async function getUnreadNotificationCount(actorId: string): Promise<number> {
  const { count, error } = await db
    .from('trade_marketplace_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('actor_id', actorId)
    .eq('leida', false);
  if (error) return 0;
  return count ?? 0;
}

// ── API — Configuración ───────────────────────────────────────────────────────

export async function getSupplierConfig(actorId: string): Promise<SupplierConfig | null> {
  const { data, error } = await db
    .from('trade_marketplace_supplier_config')
    .select('*')
    .eq('actor_id', actorId)
    .maybeSingle();
  if (error) throw error;
  return data as SupplierConfig | null;
}

export async function upsertSupplierConfig(
  actorId: string,
  updates: Partial<Omit<SupplierConfig, 'id' | 'actor_id' | 'created_at' | 'updated_at'>>,
): Promise<void> {
  const { error } = await db
    .from('trade_marketplace_supplier_config')
    .upsert({ actor_id: actorId, ...updates }, { onConflict: 'actor_id' });
  if (error) throw error;
}

// ── API — Crear actor proveedor ───────────────────────────────────────────────

export async function createMarketplaceActor(params: {
  nombre:     string;
  legalName?: string;
  taxId?:     string;
  country?:   string;
  catalogId?: string;
}): Promise<string> {
  const { data, error } = await db.rpc('create_marketplace_actor', {
    p_nombre:     params.nombre,
    p_legal_name: params.legalName  ?? null,
    p_tax_id:     params.taxId      ?? null,
    p_country:    params.country    ?? 'ES',
    p_catalog_id: params.catalogId  ?? null,
  });
  if (error) throw error;
  return data as string;
}

// ── Helpers de etiquetas ──────────────────────────────────────────────────────

export const ORDER_ESTADO_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  shipped:   'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const IA_ESTADO_LABELS: Record<PortalOfferingIAEstado, string> = {
  compatible:       'Compatible',
  revisar:          'Revisar',
  duplicado:        'Duplicado',
  mejor_coincidencia: 'Sugerido',
  sin_up:           'Sin vincular',
  sin_stock:        'Sin stock',
};

export const IA_ESTADO_COLORS: Record<PortalOfferingIAEstado, string> = {
  compatible:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  revisar:          'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  duplicado:        'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  mejor_coincidencia: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  sin_up:           'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  sin_stock:        'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export const ORDER_TIMELINE: { estado: string; label: string }[] = [
  { estado: 'pending',   label: 'Pedido' },
  { estado: 'confirmed', label: 'Confirmado' },
  { estado: 'preparing', label: 'Preparando' },
  { estado: 'shipped',   label: 'Enviado' },
  { estado: 'delivered', label: 'Entregado' },
  { estado: 'completed', label: 'Completado' },
];

export function getOrderTimelineStep(estado: string): number {
  return ORDER_TIMELINE.findIndex((s) => s.estado === estado);
}

// ── API — Dashboard MVP-3 ─────────────────────────────────────────────────────

export interface ActivityFeedItem {
  id:           string;
  event_source: 'offering' | 'import';
  tipo:         string;
  titulo:       string;
  descripcion:  string;
  count_items:  number;
  ref_id:       string | null;
  created_at:   string;
}

export interface PortalIAStats {
  linked:         number;
  pending:        number;
  avg_confidence: number | null;
  to_review:      number;
  with_issues:    number;
}

export async function getSupplierActivityFeed(
  actorId: string,
  limit = 15,
): Promise<ActivityFeedItem[]> {
  const { data, error } = await db.rpc('get_supplier_activity_feed', {
    p_actor_id: actorId,
    p_limit:    limit,
  });
  if (error) throw error;
  return (data ?? []) as ActivityFeedItem[];
}

export async function getSupplierIAStats(actorId: string): Promise<PortalIAStats> {
  const { data, error } = await db.rpc('get_supplier_ia_stats', {
    p_actor_id: actorId,
  });
  if (error) throw error;
  return (data ?? { linked: 0, pending: 0, avg_confidence: null, to_review: 0, with_issues: 0 }) as PortalIAStats;
}

// ── Importación de catálogo ───────────────────────────────────────────────────

export type CatalogImportEstado =
  | 'procesando_importacion'
  | 'pendiente_finalizacion'
  | 'matching_pendiente'
  | 'matching_procesando'
  | 'completado'
  | 'error'
  | 'cancelado';

export interface CatalogImport {
  id:                string;
  actor_id:          string;
  nombre_archivo:    string;
  archivo_hash:      string;
  chunk_size:        number;
  mapping_config:    Record<string, string>;
  parser_version:    string;
  estado:            CatalogImportEstado;
  modo:              string;
  total_filas:       number;
  chunks_esperados:  number;
  chunks_recibidos:  number;
  filas_ok:          number;
  filas_error:       number;
  filas_duplicadas:  number;
  started_at:        string;
  completed_at:      string | null;
  created_at:        string;
  updated_at:        string;
}

export interface ImportItemRow {
  supplier_ref:          string;
  descripcion_comercial: string;
  precio_coste?:         number | null;
  precio_venta?:         number | null;
  unidad?:               string;
  stock_disponible?:     boolean;
  stock_cantidad?:       number | null;
  plazo_entrega_dias?:   number | null;
  fila_original:         number;
}

export interface ChunkResult {
  ok:               number;
  errores:          number;
  cached:           boolean;
  nuevo_estado?:    string;
  chunks_recibidos?: number;
  chunks_esperados?: number;
}

export const IMPORT_ESTADO_LABELS: Record<CatalogImportEstado, string> = {
  procesando_importacion: 'Importando',
  pendiente_finalizacion: 'Pendiente de finalizar',
  matching_pendiente:     'Esperando análisis IA',
  matching_procesando:    'Analizando con IA',
  completado:             'Completado',
  error:                  'Error',
  cancelado:              'Cancelado',
};

export const IMPORT_ESTADO_COLORS: Record<CatalogImportEstado, string> = {
  procesando_importacion: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  pendiente_finalizacion: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  matching_pendiente:     'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  matching_procesando:    'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completado:             'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  error:                  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  cancelado:              'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
};

export async function createCatalogImport(params: {
  actorId:         string;
  nombreArchivo:   string;
  archivoHash:     string;
  totalFilas:      number;
  chunkSize:       number;
  chunksEsperados: number;
  mappingConfig:   Record<string, string>;
  parserVersion?:  string;
}): Promise<string> {
  const { data, error } = await db.rpc('create_catalog_import', {
    p_actor_id:         params.actorId,
    p_nombre_archivo:   params.nombreArchivo,
    p_archivo_hash:     params.archivoHash,
    p_total_filas:      params.totalFilas,
    p_chunk_size:       params.chunkSize,
    p_chunks_esperados: params.chunksEsperados,
    p_mapping_config:   params.mappingConfig,
    p_parser_version:   params.parserVersion ?? '1',
  });
  if (error) throw error;
  return data as string;
}

export async function upsertCatalogChunk(params: {
  actorId:    string;
  importId:   string;
  chunkIndex: number;
  chunkHash:  string;
  archivoHash: string;
  items:      ImportItemRow[];
}): Promise<ChunkResult> {
  const { data, error } = await db.rpc('upsert_catalog_offerings_chunk', {
    p_actor_id:    params.actorId,
    p_import_id:   params.importId,
    p_chunk_index: params.chunkIndex,
    p_chunk_hash:  params.chunkHash,
    p_archivo_hash: params.archivoHash,
    p_items:       params.items,
  });
  if (error) throw error;
  return data as ChunkResult;
}

export async function finalizeCatalogImport(importId: string, actorId: string): Promise<void> {
  const { error } = await db.rpc('finalize_catalog_import', {
    p_import_id: importId,
    p_actor_id:  actorId,
  });
  if (error) throw error;
}

export async function failCatalogImport(importId: string, actorId: string, motivo: string): Promise<void> {
  const { error } = await db.rpc('fail_catalog_import', {
    p_import_id: importId,
    p_actor_id:  actorId,
    p_motivo:    motivo,
  });
  if (error) throw error;
}

export async function cancelCatalogImport(importId: string, actorId: string): Promise<void> {
  const { error } = await db.rpc('cancel_catalog_import', {
    p_import_id: importId,
    p_actor_id:  actorId,
  });
  if (error) throw error;
}

export async function getCatalogImports(
  actorId: string,
  limit = 10,
): Promise<CatalogImport[]> {
  const { data, error } = await db
    .from('trade_catalog_imports')
    .select('*')
    .eq('actor_id', actorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CatalogImport[];
}

export async function getCatalogImport(importId: string): Promise<CatalogImport | null> {
  const { data, error } = await db
    .from('trade_catalog_imports')
    .select('*')
    .eq('id', importId)
    .maybeSingle();
  if (error) throw error;
  return data as CatalogImport | null;
}

// ── MVP-5: Gestión de equipo ──────────────────────────────────────────────────

export type TeamInvitationEstado = 'pending' | 'accepted' | 'expired' | 'cancelled';

export interface TeamMember {
  id:               string;
  actor_id:         string;
  user_id:          string;
  email:            string;
  nombre:           string;
  role_id:          string;
  role_nombre:      string;
  role_priority:    number;
  activo:           boolean;
  accepted_at:      string | null;
  last_accessed_at: string | null;
  created_at:       string;
}

export interface TeamMemberPage {
  items:       TeamMember[];
  totalCount:  number;
}

export interface TeamInvitation {
  id:               string;
  actor_id:         string;
  role_id:          string;
  role_nombre:      string;
  role_priority:    number;
  email:            string;
  estado:           TeamInvitationEstado;
  expires_at:       string;
  invited_by:       string | null;
  invited_by_email: string | null;
  created_at:       string;
}

export interface TeamRole {
  id:          string;
  nombre:      string;
  descripcion: string | null;
  permissions: string[];
  priority:    number;
}

export interface AuditLogEntry {
  id:          string;
  user_id:     string | null;
  user_email:  string | null;
  user_nombre: string;
  event_type:  string;
  event_data:  Record<string, unknown>;
  created_at:  string;
}

export interface AuditLogPage {
  items:      AuditLogEntry[];
  totalCount: number;
}

// ── API — Equipo MVP-5 ────────────────────────────────────────────────────────

export async function getSupplierTeam(
  actorId: string,
  opts?: { search?: string; activo?: boolean; limit?: number; offset?: number },
): Promise<TeamMemberPage> {
  const { data, error } = await db.rpc('get_supplier_team', {
    p_actor_id: actorId,
    p_search:   opts?.search ?? null,
    p_activo:   opts?.activo ?? null,
    p_limit:    opts?.limit  ?? 25,
    p_offset:   opts?.offset ?? 0,
  });
  if (error) throw error;
  const res = data as { items: TeamMember[]; total_count: number };
  return { items: res.items ?? [], totalCount: res.total_count ?? 0 };
}

export async function getSupplierInvitations(actorId: string): Promise<TeamInvitation[]> {
  const { data, error } = await db.rpc('get_supplier_invitations', { p_actor_id: actorId });
  if (error) throw error;
  return (data ?? []) as TeamInvitation[];
}

export async function revokeSupplierInvitation(actorId: string, invitationId: string): Promise<void> {
  const { error } = await db.rpc('revoke_supplier_invitation', {
    p_actor_id:      actorId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function resendSupplierInvitation(
  actorId:      string,
  invitationId: string,
): Promise<{ rawToken: string }> {
  const { data, error } = await db.rpc('resend_supplier_invitation', {
    p_actor_id:      actorId,
    p_invitation_id: invitationId,
  });
  if (error) throw error;
  return { rawToken: data as string };
}

export async function createSupplierInvitation(
  actorId: string,
  email:   string,
  roleId:  string,
): Promise<{ rawToken: string }> {
  const { data, error } = await db.rpc('create_marketplace_invitation', {
    p_actor_id: actorId,
    p_role_id:  roleId,
    p_email:    email.toLowerCase().trim(),
  });
  if (error) throw error;
  return { rawToken: data as string };
}

export async function deactivateTeamMember(actorId: string, memberId: string): Promise<void> {
  const { error } = await db.rpc('deactivate_team_member', {
    p_actor_id:  actorId,
    p_member_id: memberId,
  });
  if (error) throw error;
}

export async function reactivateTeamMember(actorId: string, memberId: string): Promise<void> {
  const { error } = await db.rpc('reactivate_team_member', {
    p_actor_id:  actorId,
    p_member_id: memberId,
  });
  if (error) throw error;
}

export async function updateTeamMemberRole(
  actorId:  string,
  memberId: string,
  roleId:   string,
): Promise<void> {
  const { error } = await db.rpc('update_team_member_role', {
    p_actor_id:  actorId,
    p_member_id: memberId,
    p_role_id:   roleId,
  });
  if (error) throw error;
}

export async function getSupplierAuditLog(
  actorId: string,
  opts?: { limit?: number; offset?: number },
): Promise<AuditLogPage> {
  const { data, error } = await db.rpc('get_supplier_audit_log', {
    p_actor_id: actorId,
    p_limit:    opts?.limit  ?? 50,
    p_offset:   opts?.offset ?? 0,
  });
  if (error) throw error;
  const res = data as { items: AuditLogEntry[]; total_count: number };
  return { items: res.items ?? [], totalCount: res.total_count ?? 0 };
}

export async function getSupplierRoles(actorId: string): Promise<TeamRole[]> {
  const { data, error } = await db.rpc('get_supplier_roles', { p_actor_id: actorId });
  if (error) throw error;
  return (data ?? []) as TeamRole[];
}

// ── MVP-6: Reporting ──────────────────────────────────────────────────────────

export interface ReportingKPI {
  valor:  number | null;
  prev:   number | null;
  fuente: 'marketplace+legacy' | 'solo_marketplace';
}

export interface ReportingKPIs {
  ventas:            ReportingKPI;
  num_pedidos:       ReportingKPI;
  ticket_medio:      ReportingKPI;
  prod_vendidos:     ReportingKPI;
  unidades_vendidas: ReportingKPI;
  cancelados:        ReportingKPI;
  incidencias:       ReportingKPI;
  avg_confirm_h:     ReportingKPI;
  avg_ship_h:        ReportingKPI;
}

export interface ReportingKPIsResult {
  periodo: {
    desde:      string;
    hasta:      string;
    prev_desde: string;
    prev_hasta: string;
  };
  kpis: ReportingKPIs;
}

export async function getSupplierReportingKPIs(
  actorId:  string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<ReportingKPIsResult> {
  const { data, error } = await db.rpc('get_supplier_reporting_kpis', {
    p_actor_id:  actorId,
    p_date_from: dateFrom.toISOString(),
    p_date_to:   dateTo.toISOString(),
  });
  if (error) throw error;
  return data as ReportingKPIsResult;
}

// ── MVP-6.2: Ventas ───────────────────────────────────────────────────────────

export interface SalesByDay {
  fecha:       string;
  ventas:      number;
  num_pedidos: number;
}

export interface SalesByEstado {
  estado: string;
  count:  number;
  total:  number;
}

export interface SalesByOrg {
  org_nombre: string;
  count:      number;
  total:      number;
}

export interface OrderAtrasado {
  order_id:    string;
  numero:      string;
  estado:      string;
  total:       number;
  created_at:  string;
  horas_espera: number;
}

export interface SalesReportData {
  by_day:    SalesByDay[];
  by_estado: SalesByEstado[];
  by_org:    SalesByOrg[];
  atrasados: OrderAtrasado[];
}

export async function getSupplierReportingSales(
  actorId:  string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<SalesReportData> {
  const { data, error } = await db.rpc('get_supplier_reporting_sales', {
    p_actor_id:  actorId,
    p_date_from: dateFrom.toISOString(),
    p_date_to:   dateTo.toISOString(),
  });
  if (error) throw error;
  return data as SalesReportData;
}

// ── MVP-6.3: Catálogo ─────────────────────────────────────────────────────────

export interface CatalogTopProduct {
  offering_id:  string;
  descripcion:  string;
  ref:          string | null;
  total_ventas: number;
  num_pedidos:  number;
  unidades:     number;
}

export interface CatalogTopByUnits {
  offering_id:  string;
  descripcion:  string;
  ref:          string | null;
  unidades:     number;
  total_ventas: number;
}

export interface CatalogCalidad {
  total_activas: number;
  sin_ventas:    number;
  sin_stock:     number;
  sin_imagen:    number;
  inactivos:     number;
}

export interface CatalogIA {
  distribucion:   Record<string, number>;
  avg_confidence: number | null;
  pending_review: number;
}

export interface CatalogReportData {
  top_por_ventas:   CatalogTopProduct[];
  top_por_unidades: CatalogTopByUnits[];
  calidad:          CatalogCalidad;
  ia:               CatalogIA;
}

export async function getSupplierReportingCatalog(
  actorId:  string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<CatalogReportData> {
  const { data, error } = await db.rpc('get_supplier_reporting_catalog', {
    p_actor_id:  actorId,
    p_date_from: dateFrom.toISOString(),
    p_date_to:   dateTo.toISOString(),
  });
  if (error) throw error;
  return data as CatalogReportData;
}

// ── MVP-6.4: Operativo ────────────────────────────────────────────────────────

export interface OperationalTiempos {
  avg_confirm_h:     number | null;
  avg_preparing_h:   number | null;
  avg_ship_h:        number | null;
  avg_total_cycle_h: number | null;
}

export interface OperationalSLA {
  total_orders:      number;
  confirmed_orders:  number;
  shipped_orders:    number;
  pct_confirmed_24h: number | null;
  pct_shipped_48h:   number | null;
}

export interface OperationalIncidentDay {
  fecha: string;
  count: number;
}

export interface OperationalReportData {
  tiempos:         OperationalTiempos;
  sla:             OperationalSLA;
  atrasados_count: number;
  incidencias: {
    total:  number;
    by_day: OperationalIncidentDay[];
  };
}

export async function getSupplierReportingOperational(
  actorId:  string,
  dateFrom: Date,
  dateTo:   Date,
): Promise<OperationalReportData> {
  const { data, error } = await db.rpc('get_supplier_reporting_operational', {
    p_actor_id:  actorId,
    p_date_from: dateFrom.toISOString(),
    p_date_to:   dateTo.toISOString(),
  });
  if (error) throw error;
  return data as OperationalReportData;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MVP-7 — Credenciales API e historial de sincronizaciones
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiCredential {
  id:           string;
  nombre:       string;
  key_prefix:   string;
  scopes:       string[];
  activa:       boolean;
  expires_at:   string;
  grace_until:  string | null;
  last_used_at: string | null;
  last_ip:      string | null;
  revoked_at:   string | null;
  created_at:   string;
}

export interface ApiCredentialCreated {
  credential_id: string;
  raw_key:       string;
  key_prefix:    string;
}

export interface ApiSyncLogEntry {
  id:                 string;
  endpoint:           string;
  idempotency_key:    string | null;
  source_system:      string | null;
  ip:                 string | null;
  started_at:         string;
  finished_at:        string | null;
  status:             'processing' | 'completed' | 'failed' | 'duplicate';
  rows_received:      number | null;
  rows_inserted:      number | null;
  rows_updated:       number | null;
  rows_rejected:      number | null;
  error_detail:       string | null;
  credential_nombre:  string;
  credential_prefix:  string;
}

export async function getApiCredentials(actorId: string): Promise<ApiCredential[]> {
  const { data, error } = await db.rpc('get_api_credentials', { p_actor_id: actorId });
  if (error) throw error;
  return (data ?? []) as ApiCredential[];
}

export async function createApiCredential(
  actorId:   string,
  nombre:    string,
  scopes:    string[],
  expiresAt: Date,
): Promise<ApiCredentialCreated> {
  const { data, error } = await db.rpc('create_api_credential', {
    p_actor_id:   actorId,
    p_nombre:     nombre,
    p_scopes:     scopes,
    p_expires_at: expiresAt.toISOString(),
  });
  if (error) throw error;
  return data as ApiCredentialCreated;
}

export async function revokeApiCredential(credentialId: string, actorId: string): Promise<void> {
  const { error } = await db.rpc('revoke_api_credential', {
    p_credential_id: credentialId,
    p_actor_id:      actorId,
  });
  if (error) throw error;
}

export async function rotateApiCredential(
  credentialId: string,
  actorId:      string,
): Promise<ApiCredentialCreated & { old_credential_id: string; grace_until: string }> {
  const { data, error } = await db.rpc('rotate_api_credential', {
    p_credential_id: credentialId,
    p_actor_id:      actorId,
  });
  if (error) throw error;
  return data as ApiCredentialCreated & { old_credential_id: string; grace_until: string };
}

export async function getApiSyncLog(actorId: string, limit = 50): Promise<ApiSyncLogEntry[]> {
  const { data, error } = await db.rpc('get_supplier_api_sync_log', {
    p_actor_id: actorId,
    p_limit:    limit,
  });
  if (error) throw error;
  return (data ?? []) as ApiSyncLogEntry[];
}
