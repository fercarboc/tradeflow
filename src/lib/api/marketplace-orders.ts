import { supabase } from '../supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type OrderLifecycleEstado =
  | 'pending' | 'confirmed' | 'preparing' | 'shipped'
  | 'delivered' | 'completed' | 'cancelled';

export interface ActiveOrder {
  id:               string;
  numero:           string;
  estado:           OrderLifecycleEstado;
  actor_id:         string;
  actor_nombre:     string;
  actor_verificado: boolean;
  total:            number;
  items_count:      number;
  tracking_ref:     string | null;
  tracking_url:     string | null;
  notas_proveedor:  string | null;
  source_ref:       string | null;
  created_at:       string;
  confirmed_at:     string | null;
  preparing_at:     string | null;
  shipped_at:       string | null;
  delivered_at:     string | null;
  cancelled_at:     string | null;
  total_count:      number;
}

export interface OrderHistoryRow {
  id:           string;
  numero:       string;
  estado:       OrderLifecycleEstado;
  actor_nombre: string;
  total:        number;
  items_count:  number;
  source_ref:   string | null;
  created_at:   string;
  completed_at: string | null;
  total_count:  number;
}

export interface OrderEvent {
  id:          string;
  tipo:        string;
  from_estado: string | null;
  to_estado:   string | null;
  actor_type:  'installer' | 'supplier' | 'system';
  notas:       string | null;
  payload:     Record<string, unknown>;
  created_at:  string;
}

export interface OrderFullDetail {
  order: {
    id:               string;
    numero:           string;
    estado:           OrderLifecycleEstado;
    actor_id:         string;
    actor_nombre:     string;
    actor_verificado: boolean;
    org_id:           string;
    subtotal:         number;
    coste_envio:      number;
    total:            number;
    notas:            string | null;
    notas_proveedor:  string | null;
    tracking_ref:     string | null;
    tracking_url:     string | null;
    delivery_address: string | null;
    cancel_reason:    string | null;
    created_at:       string;
    confirmed_at:     string | null;
    preparing_at:     string | null;
    shipped_at:       string | null;
    delivered_at:     string | null;
    cancelled_at:     string | null;
    completed_at:     string | null;
  };
  items: {
    id:              string;
    referencia:      string | null;
    descripcion:     string;
    unidad:          string;
    cantidad:        number;
    precio_unitario: number | null;
    precio_total:    number | null;
  }[];
  events: OrderEvent[];
  supplier_config: {
    horario_entrega: string | null;
    mensaje_instaladores: string | null;
    permite_recogida: boolean;
  } | null;
}

// ─── Labels de UI ─────────────────────────────────────────────────────────────

export const LIFECYCLE_ESTADO_LABELS: Record<OrderLifecycleEstado, string> = {
  pending:   'Pendiente de confirmar',
  confirmed: 'Confirmado',
  preparing: 'En preparación',
  shipped:   'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export const LIFECYCLE_ESTADO_COLORS: Record<OrderLifecycleEstado, string> = {
  pending:   'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  preparing: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  shipped:   'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  delivered: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
};

export const LIFECYCLE_TIMELINE: { estado: OrderLifecycleEstado; label: string }[] = [
  { estado: 'pending',   label: 'Recibido' },
  { estado: 'confirmed', label: 'Confirmado' },
  { estado: 'preparing', label: 'Preparando' },
  { estado: 'shipped',   label: 'Enviado' },
  { estado: 'delivered', label: 'Entregado' },
];

export function getLifecycleStep(estado: OrderLifecycleEstado): number {
  return LIFECYCLE_TIMELINE.findIndex((s) => s.estado === estado);
}

export const EVENT_TYPE_LABELS: Record<string, string> = {
  state_changed:      'Cambio de estado',
  delivery_confirmed: 'Entrega confirmada',
  cancelled:          'Cancelado',
  note_added:         'Nota añadida',
  tracking_updated:   'Tracking actualizado',
};

// ─── RPCs ─────────────────────────────────────────────────────────────────────

function err(ctx: string, e: unknown): never {
  throw new Error(`[${ctx}] ${e instanceof Error ? e.message : String(e)}`);
}

export async function prepareMarketplaceOrder(orderId: string, notas?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('prepare_marketplace_order', {
    p_order_id: orderId, p_notas: notas ?? null,
  });
  if (error) err('prepareMarketplaceOrder', error);
}

export async function deliverMarketplaceOrder(orderId: string, notas?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('deliver_marketplace_order', {
    p_order_id: orderId, p_notas: notas ?? null,
  });
  if (error) err('deliverMarketplaceOrder', error);
}

export async function cancelMarketplaceOrder(orderId: string, reason?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('cancel_marketplace_order', {
    p_order_id: orderId,
    p_reason: reason ?? 'Cancelado por el usuario',
  });
  if (error) err('cancelMarketplaceOrder', error);
}

export async function getOrderFullDetail(orderId: string): Promise<OrderFullDetail> {
  const { data, error } = await (supabase as any).rpc('get_order_full_detail', { p_order_id: orderId });
  if (error) err('getOrderFullDetail', error);
  return data as OrderFullDetail;
}

export async function getOrgActiveOrders(params: {
  orgId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: ActiveOrder[]; totalCount: number }> {
  const { data, error } = await (supabase as any).rpc('get_org_active_orders', {
    p_org_id:  params.orgId,
    p_limit:   params.limit ?? 50,
    p_offset:  params.offset ?? 0,
  });
  if (error) err('getOrgActiveOrders', error);
  const rows = (data ?? []) as ActiveOrder[];
  return { items: rows, totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0 };
}

export async function getOrgOrderHistory(params: {
  orgId: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: OrderHistoryRow[]; totalCount: number }> {
  const { data, error } = await (supabase as any).rpc('get_org_order_history', {
    p_org_id:  params.orgId,
    p_limit:   params.limit ?? 20,
    p_offset:  params.offset ?? 0,
  });
  if (error) err('getOrgOrderHistory', error);
  const rows = (data ?? []) as OrderHistoryRow[];
  return { items: rows, totalCount: rows.length > 0 ? Number(rows[0].total_count) : 0 };
}

export async function getOrderEvents(orderId: string): Promise<OrderEvent[]> {
  const { data, error } = await (supabase as any).rpc('get_order_events', { p_order_id: orderId });
  if (error) err('getOrderEvents', error);
  return (data ?? []) as OrderEvent[];
}

// ─── Extender shipSupplierOrder con tracking_url (sobreescribe firma anterior)
export async function shipMarketplaceOrderWithTracking(params: {
  orderId:     string;
  trackingRef?: string;
  trackingUrl?: string;
  notas?:       string;
}): Promise<void> {
  const { error } = await (supabase as any).rpc('ship_supplier_order', {
    p_order_id:    params.orderId,
    p_source:      'marketplace',
    p_tracking:    params.trackingRef ?? null,
    p_tracking_url: params.trackingUrl ?? null,
    p_notas:       params.notas ?? null,
  });
  if (error) err('shipMarketplaceOrderWithTracking', error);
}

export async function prepareOrderFromPortal(orderId: string, notas?: string): Promise<void> {
  const { error } = await (supabase as any).rpc('prepare_marketplace_order', {
    p_order_id: orderId, p_notas: notas ?? null,
  });
  if (error) err('prepareOrderFromPortal', error);
}
