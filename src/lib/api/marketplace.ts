import { supabase } from '../client';

// ── Tipos de estado ───────────────────────────────────────────────────────────

export type MarketplaceValidationState =
  | 'draft'
  | 'pending_review'
  | 'validated'
  | 'rejected'
  | 'merged';

export type MarketplaceProductOrigin =
  | 'global_catalog'
  | 'supplier_import'
  | 'admin_manual'
  | 'brand_official'
  | 'ai_suggested';

export type MarketplaceMatchState =
  | 'matched'
  | 'suggested'
  | 'pending_review'
  | 'unmatched'
  | 'rejected';

export type MarketplaceMatchMethod =
  | 'ean'
  | 'mpn'
  | 'semantic'
  | 'admin'
  | 'supplier'
  | 'auto_seed';

// ── Entidades ─────────────────────────────────────────────────────────────────

export interface MarketplaceBrand {
  id: string;
  nombre: string;
  slug: string;
  website?: string | null;
  logo_url?: string | null;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceCategory {
  id: string;
  nombre: string;
  slug: string;
  parent_id?: string | null;
  oficio?: string | null;
  icono?: string | null;
  posicion: number;
  activa: boolean;
  created_at: string;
  children?: MarketplaceCategory[];
}

export interface MarketplaceUniversalProduct {
  id: string;
  nombre_canonico: string;
  descripcion?: string | null;
  category_id?: string | null;
  oficio: string;
  familia: string;
  subfamilia?: string | null;
  unidad: string;
  marca?: string | null;
  modelo?: string | null;
  ean?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  manufacturer_ref?: string | null;
  manufacturer_id?: string | null;
  especificaciones: Record<string, unknown>;
  es_generico: boolean;
  validation_state: MarketplaceValidationState;
  merged_into_id?: string | null;
  origen: MarketplaceProductOrigin;
  normalization_version: number;
  global_catalog_id?: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones resueltas (join opcional)
  category?: MarketplaceCategory;
  brand?: MarketplaceBrand;
  variants?: MarketplaceUniversalProductVariant[];
  offerings?: MarketplaceSupplierOffering[];
}

export interface MarketplaceUniversalProductVariant {
  id: string;
  universal_product_id: string;
  nombre: string;
  ean?: string | null;
  gtin?: string | null;
  manufacturer_ref?: string | null;
  atributos: Record<string, unknown>;
  activa: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketplaceSupplierOffering {
  id: string;
  universal_product_id?: string | null;
  variant_id?: string | null;
  supplier_catalog_id: string;
  supplier_product_id?: string | null;
  supplier_ref?: string | null;
  descripcion_comercial: string;
  precio_coste?: number | null;
  precio_venta?: number | null;
  unidad: string;
  stock_disponible: boolean;
  stock_cantidad?: number | null;
  plazo_entrega_dias: number;
  activa: boolean;
  match_state: MarketplaceMatchState;
  match_method?: MarketplaceMatchMethod | null;
  match_confidence?: number | null;
  matched_by?: string | null;
  matched_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Relaciones resueltas (join opcional)
  supplier_catalog?: { supplier_name: string; supplier_key: string } | null;
  universal_product?: MarketplaceUniversalProduct | null;
}

// ── Tipo de retorno de search_marketplace_offerings ───────────────────────────

export interface MarketplaceOfferingSearchResult {
  universal_product_id: string;
  nombre_canonico: string;
  oficio: string;
  familia: string;
  unidad: string;
  marca?: string | null;
  modelo?: string | null;
  ean?: string | null;
  es_generico: boolean;
  ofertas_count: number;
  mejor_precio_coste?: number | null;
  mejor_supplier_name?: string | null;
  mejor_supplier_key?: string | null;
  mejor_offering_id?: string | null;
  score: number;
  image_url?: string | null;
}

// El cliente Supabase sin tipos estrictos de tablas nuevas (pre-type-generation).
// Se actualizará con `supabase gen types` tras aplicar la migración en prod.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ── API functions ─────────────────────────────────────────────────────────────

export async function searchMarketplaceOfferings(
  orgId: string,
  query: string,
  opts?: {
    categoryId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<MarketplaceOfferingSearchResult[]> {
  const { data, error } = await db.rpc('search_marketplace_offerings', {
    p_query:       query,
    p_org_id:      orgId,
    p_category_id: opts?.categoryId ?? null,
    p_limit:       opts?.limit ?? 10,
    p_offset:      opts?.offset ?? 0,
  });
  if (error) throw error;
  return (data ?? []) as MarketplaceOfferingSearchResult[];
}

export async function loadMarketplaceCategories(
  parentId?: string | null,
): Promise<MarketplaceCategory[]> {
  let q = db
    .from('trade_marketplace_categories')
    .select('*')
    .eq('activa', true)
    .order('posicion');
  if (parentId !== undefined) {
    q = parentId === null
      ? q.is('parent_id', null)
      : q.eq('parent_id', parentId);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketplaceCategory[];
}

export async function loadUniversalProduct(
  id: string,
): Promise<MarketplaceUniversalProduct | null> {
  const { data, error } = await db
    .from('trade_marketplace_universal_products')
    .select(`
      *,
      category:trade_marketplace_categories(id, nombre, slug, oficio, icono),
      brand:trade_marketplace_brands(id, nombre, slug, logo_url),
      variants:trade_marketplace_universal_product_variants(*),
      offerings:trade_marketplace_supplier_offerings(
        id, supplier_ref, descripcion_comercial, precio_coste, precio_venta,
        unidad, stock_disponible, stock_cantidad, plazo_entrega_dias,
        match_state, match_confidence,
        supplier_catalog:trade_supplier_catalogs(supplier_name, supplier_key)
      )
    `)
    .eq('id', id)
    .eq('validation_state', 'validated')
    .single();
  if (error) return null;
  return data as MarketplaceUniversalProduct;
}

export async function loadOfferingsForUniversalProduct(
  universalProductId: string,
  orgId: string,
): Promise<MarketplaceSupplierOffering[]> {
  // Obtiene los catálogos habilitados de la org usando el cliente tipado (tabla conocida)
  const { data: orgSuppliers } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id')
    .eq('org_id', orgId)
    .eq('enabled', true);

  const catalogIds = (orgSuppliers ?? []).map(
    (s: { catalog_id: string }) => s.catalog_id,
  );
  if (!catalogIds.length) return [];

  const { data, error } = await db
    .from('trade_marketplace_supplier_offerings')
    .select(`
      *,
      supplier_catalog:trade_supplier_catalogs(supplier_name, supplier_key)
    `)
    .eq('universal_product_id', universalProductId)
    .eq('match_state', 'matched')
    .eq('activa', true)
    .in('supplier_catalog_id', catalogIds)
    .order('precio_coste', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as MarketplaceSupplierOffering[];
}
