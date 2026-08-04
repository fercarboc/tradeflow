import { supabase } from '../supabase';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Tipos ────────────────────────────────────────────────────────────────────

// Un producto universal navegable con resumen de sus offerings disponibles.
// Devuelto por get_marketplace_catalog_paged (RC1-B).
export interface MarketplaceCatalogItem {
  up_id:             string;
  nombre_canonico:   string;
  descripcion:       string | null;
  familia:           string;
  subfamilia:        string | null;
  oficio:            string;
  unidad:            string;
  image_url:         string | null;
  offering_count:    number;
  precio_min:        number | null;
  precio_max:        number | null;
  stock_ok:          boolean;
  plazo_min:         number | null;
  actor_ids:         string[];
  actor_nombres:     string[];
  best_offering_id:  string | null;
  best_actor_id:     string | null;
  best_actor_nombre: string | null;
  best_precio:       number | null;
  best_stock:        boolean;
  best_plazo:        number | null;
  best_supplier_ref: string | null;
  best_unidad:       string | null;
  total_count:       number;
}

// Una offering concreta dentro del SlideOver de opciones.
export interface OfferingDetail {
  offering_id:      string;
  supplier_ref:     string | null;
  descripcion:      string;
  actor_id:         string;
  actor_nombre:     string;
  actor_verificado: boolean;
  precio_coste:     number | null;
  unidad:           string;
  stock_disponible: boolean;
  stock_cantidad:   number | null;
  plazo_dias:       number;
  image_url:        string | null;
}

export interface CatalogFilters {
  query?:     string;
  familia?:   string;
  oficio?:    string;
  onlyStock?: boolean;
  sortBy?:    'nombre' | 'precio_asc' | 'plazo_asc';
  limit?:     number;
  offset?:    number;
}

export interface CatalogPage {
  items:   MarketplaceCatalogItem[];
  total:   number;
  hasMore: boolean;
}

// ─── API ──────────────────────────────────────────────────────────────────────

// Precio del instalador: precio_coste — precio B2B de compra al proveedor.
// precio_venta sería el PVP al consumidor final (no relevante aquí).
// Decisión documentada en RC1_B_MARKETPLACE_BASE.md §Precios.

export async function getMarketplaceCatalog(
  filters: CatalogFilters = {},
): Promise<CatalogPage> {
  const limit  = filters.limit  ?? 24;
  const offset = filters.offset ?? 0;

  const { data, error } = await db.rpc('get_marketplace_catalog_paged', {
    p_query:      filters.query     || null,
    p_familia:    filters.familia   || null,
    p_oficio:     filters.oficio    || null,
    p_only_stock: filters.onlyStock ?? false,
    p_sort_by:    filters.sortBy    ?? 'nombre',
    p_limit:      limit,
    p_offset:     offset,
  });

  if (error) throw error;

  const rows = (data ?? []) as MarketplaceCatalogItem[];
  const total = rows[0]?.total_count ?? 0;

  return {
    items:   rows,
    total:   Number(total),
    hasMore: offset + rows.length < Number(total),
  };
}

export async function getOfferingsForUp(
  upId: string,
): Promise<OfferingDetail[]> {
  const { data, error } = await db.rpc('get_offerings_for_up', {
    p_up_id: upId,
  });
  if (error) throw error;
  return (data ?? []) as OfferingDetail[];
}

// Familias únicas del catálogo activo (para filtros)
export async function getMarketplaceFamilias(): Promise<string[]> {
  const { data, error } = await db
    .from('trade_marketplace_universal_products')
    .select('familia')
    .eq('validation_state', 'validated')
    .order('familia');
  if (error) throw error;
  const all = (data ?? []).map((r: { familia: string }) => r.familia);
  return [...new Set<string>(all)].sort();
}
