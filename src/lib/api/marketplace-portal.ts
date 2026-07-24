import { supabase } from '../client';

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
  created_at:            string;
  total_count:           number;
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
    limit?:      number;
    offset?:     number;
  },
): Promise<PortalOfferingPage> {
  const { data, error } = await db.rpc('get_supplier_offerings_paged', {
    p_actor_id:   actorId,
    p_search:     opts?.search     ?? null,
    p_match_state: opts?.matchState ?? null,
    p_limit:      opts?.limit      ?? 20,
    p_offset:     opts?.offset     ?? 0,
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
    precio_coste?:         number;
    precio_venta?:         number;
    stock_disponible?:     boolean;
    stock_cantidad?:       number;
    descripcion_comercial?: string;
    plazo_entrega_dias?:   number;
    activa?:               boolean;
  },
): Promise<void> {
  const { error } = await db.rpc('update_supplier_offering', {
    p_offering_id:          offeringId,
    p_precio_coste:         updates.precio_coste         ?? null,
    p_precio_venta:         updates.precio_venta         ?? null,
    p_stock_disponible:     updates.stock_disponible     ?? null,
    p_stock_cantidad:       updates.stock_cantidad        ?? null,
    p_descripcion_comercial: updates.descripcion_comercial ?? null,
    p_plazo_entrega_dias:   updates.plazo_entrega_dias   ?? null,
    p_activa:               updates.activa               ?? null,
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
  return (data ?? []) as MatchCandidate[];
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
