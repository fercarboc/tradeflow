import { supabase } from '../client';

// ── Pedidos de material a proveedores ─────────────────────────────────────────

export interface SupplierOrderLine {
  id: string;
  order_id: string;
  descripcion: string;
  referencia?: string | null;
  cantidad: number;
  unidad: string;
  precio_unitario?: number | null;
  created_at: string;
}

export interface SupplierOrder {
  id: string;
  org_id: string;
  catalog_id: string;
  quote_id?: string | null;
  job_id?: string | null;
  estado: 'borrador' | 'enviado' | 'confirmado' | 'recibido' | 'cancelado';
  notas?: string | null;
  total?: number | null;
  created_at: string;
  updated_at: string;
  trade_supplier_catalogs?: { supplier_name: string; supplier_key: string; contact_email?: string | null } | null;
  trade_supplier_order_lines?: SupplierOrderLine[];
  trade_quotes?: { numero: string; descripcion?: string | null; trade_clients?: { nombre: string; telefono?: string | null } | null } | null;
}

export async function loadSupplierOrders(orgId: string): Promise<SupplierOrder[]> {
  const { data, error } = await supabase
    .from('trade_supplier_orders')
    .select('*, trade_supplier_catalogs(supplier_name, supplier_key, contact_email), trade_supplier_order_lines(*), trade_quotes(numero, descripcion, trade_clients(nombre, telefono))')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierOrder[];
}

export async function createSupplierOrder(
  orgId: string,
  catalogId: string,
  lines: Omit<SupplierOrderLine, 'id' | 'order_id' | 'created_at'>[],
  opts?: { quoteId?: string; jobId?: string; notas?: string },
): Promise<SupplierOrder> {
  const total = lines.reduce((sum, l) => sum + l.cantidad * (l.precio_unitario ?? 0), 0);
  const { data: order, error: oErr } = await supabase
    .from('trade_supplier_orders')
    .insert({ org_id: orgId, catalog_id: catalogId, quote_id: opts?.quoteId ?? null, job_id: opts?.jobId ?? null, notas: opts?.notas ?? null, total })
    .select()
    .single();
  if (oErr) throw oErr;

  if (lines.length > 0) {
    const { error: lErr } = await supabase
      .from('trade_supplier_order_lines')
      .insert(lines.map(l => ({ ...l, order_id: order.id })));
    if (lErr) throw lErr;
  }
  return order as SupplierOrder;
}

export async function updateSupplierOrderEstado(
  id: string,
  estado: SupplierOrder['estado'],
): Promise<void> {
  const { error } = await supabase
    .from('trade_supplier_orders')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSupplierOrder(id: string): Promise<void> {
  const { error } = await supabase.from('trade_supplier_orders').delete().eq('id', id);
  if (error) throw error;
}

export async function loadSupplierCatalogs(orgId: string): Promise<{
  id: string; supplier_key: string; supplier_name: string; contact_email?: string | null; margen_pct_default: number;
}[]> {
  const { data, error } = await supabase
    .from('trade_supplier_catalogs')
    .select('id, supplier_key, supplier_name, contact_email, margen_pct_default')
    .eq('is_active', true)
    .order('prioridad');
  if (error) throw error;
  // Filter to only catalogs the org has enabled
  const { data: orgSettings } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id')
    .eq('org_id', orgId)
    .eq('enabled', true);
  const enabledIds = new Set((orgSettings ?? []).map((s: { catalog_id: string }) => s.catalog_id));
  return ((data ?? []) as { id: string; supplier_key: string; supplier_name: string; contact_email?: string | null; margen_pct_default: number }[])
    .filter(c => enabledIds.has(c.id));
}

export interface ActiveSupplierProduct {
  id: string;
  ref_proveedor: string | null;
  descripcion: string;
  marca: string | null;
  familia: string | null;
  precio_coste: number;
  unidad: string;
}

export interface ActiveSupplierCatalog {
  catalog_id: string;
  supplier_name: string;
  supplier_key: string;
  margen_pct: number;
  products: ActiveSupplierProduct[];
}

export async function loadActiveSupplierCatalogs(orgId: string): Promise<ActiveSupplierCatalog[]> {
  const { data: orgSup, error: e1 } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id, margen_override')
    .eq('org_id', orgId)
    .eq('enabled', true);
  if (e1 || !orgSup?.length) return [];

  const catalogIds = (orgSup as { catalog_id: string; margen_override: number | null }[]).map(s => s.catalog_id);

  const [catRes, prodRes] = await Promise.all([
    supabase
      .from('trade_supplier_catalogs')
      .select('id, supplier_name, supplier_key, margen_pct_default')
      .in('id', catalogIds),
    supabase
      .from('trade_supplier_products')
      .select('id, catalog_id, ref_proveedor, descripcion, marca, familia, precio_coste, unidad')
      .in('catalog_id', catalogIds)
      .eq('activo', true)
      .order('familia')
      .order('descripcion'),
  ]);

  if (catRes.error || prodRes.error) return [];

  const catalogMap = new Map(
    ((catRes.data ?? []) as { id: string; supplier_name: string; supplier_key: string; margen_pct_default: number }[])
      .map(c => [c.id, c])
  );

  return (orgSup as { catalog_id: string; margen_override: number | null }[]).map(s => {
    const cat = catalogMap.get(s.catalog_id);
    return {
      catalog_id: s.catalog_id,
      supplier_name: cat?.supplier_name ?? '',
      supplier_key: cat?.supplier_key ?? '',
      margen_pct: s.margen_override ?? cat?.margen_pct_default ?? 0,
      products: ((prodRes.data ?? []) as (ActiveSupplierProduct & { catalog_id: string })[])
        .filter(p => p.catalog_id === s.catalog_id),
    };
  });
}

export interface OrgCatalogSupplierName {
  catalog_id: string;
  supplier_name: string;
}

export async function loadOrgCatalogSupplierNames(orgId: string): Promise<OrgCatalogSupplierName[]> {
  const { data: orgSup, error: e1 } = await supabase
    .from('trade_org_suppliers')
    .select('catalog_id')
    .eq('org_id', orgId)
    .eq('enabled', true);
  if (e1 || !orgSup?.length) return [];

  const catalogIds = (orgSup as { catalog_id: string }[]).map(s => s.catalog_id);
  const { data, error } = await supabase
    .from('trade_supplier_catalogs')
    .select('id, supplier_name')
    .in('id', catalogIds)
    .eq('is_active', true)
    .order('supplier_name');
  if (error) return [];
  return ((data ?? []) as { id: string; supplier_name: string }[]).map(c => ({
    catalog_id: c.id,
    supplier_name: c.supplier_name,
  }));
}

export interface QuoteWithPendingMaterial {
  id: string;
  numero: string;
  descripcion: string | null;
  cliente_nombre: string | null;
  fecha: string;
  pendingItems: {
    id: string;
    descripcion: string;
    cantidad: number;
    precio_unitario: number;
    supplier_key: string | null;
    supplier_name: string | null;
    catalog_variant_id: string | null;
  }[];
}

export async function loadAcceptedQuotesWithPendingMaterial(orgId: string): Promise<QuoteWithPendingMaterial[]> {
  const { data, error } = await supabase
    .from('trade_quotes')
    .select(`
      id, numero, descripcion, fecha,
      trade_clients(nombre),
      trade_quote_items(id, descripcion, tipo, cantidad, precio_unitario, supplier_key, supplier_name, catalog_variant_id, material_order_placed)
    `)
    .eq('org_id', orgId)
    .eq('estado', 'Aceptado')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as {
    id: string; numero: string; descripcion: string | null; fecha: string;
    trade_clients: { nombre: string } | null;
    trade_quote_items: { id: string; tipo: string; material_order_placed: boolean | null; descripcion: string | null; cantidad: number; precio_unitario: number; supplier_key: string | null; supplier_name: string | null; catalog_variant_id: string | null }[];
  }[])
    .map(q => ({
      id: q.id,
      numero: q.numero,
      descripcion: q.descripcion,
      cliente_nombre: q.trade_clients?.nombre ?? null,
      fecha: q.fecha,
      pendingItems: (q.trade_quote_items ?? [])
        .filter(i => i.tipo === 'material' && !i.material_order_placed)
        .map(i => ({
          id: i.id,
          descripcion: i.descripcion ?? '',
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          supplier_key: i.supplier_key ?? null,
          supplier_name: i.supplier_name ?? null,
          catalog_variant_id: i.catalog_variant_id ?? null,
        })),
    }))
    .filter(q => q.pendingItems.length > 0);
}

export async function markQuoteItemsOrdered(itemIds: string[]): Promise<void> {
  if (!itemIds.length) return;
  const { error } = await supabase
    .from('trade_quote_items')
    .update({ material_order_placed: true })
    .in('id', itemIds);
  if (error) throw error;
}




