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
