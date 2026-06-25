import { supabase } from '../client';

// ── Mayoristas / Distribuidores de material ────────────────────────────────

export interface TradeMayorista {
  id: string;
  org_id: string;
  nombre: string;
  razon_social?: string | null;
  nif?: string | null;
  direccion_fiscal?: string | null;
  cp?: string | null;
  ciudad?: string | null;
  provincia?: string | null;
  telefono?: string | null;
  email?: string | null;
  persona_contacto?: string | null;
  web?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
}

export interface TradeCompra {
  id: string;
  org_id: string;
  mayorista_id?: string | null;
  subcontrata_id?: string | null;
  catalog_supplier_id?: string | null;
  referencia_factura?: string | null;
  concepto: string;
  importe: number;
  iva_pct: number;
  fecha?: string | null;
  fecha_vencimiento?: string | null;
  pagado: boolean;
  pagado_at?: string | null;
  job_id?: string | null;
  notas?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  trade_mayoristas?: { nombre: string } | null;
  trade_subcontractors?: { nombre: string } | null;
  trade_supplier_catalogs?: { supplier_name: string } | null;
  trade_jobs?: { titulo: string } | null;
}

export async function loadMayoristas(orgId: string): Promise<TradeMayorista[]> {
  const { data, error } = await supabase
    .from('trade_mayoristas')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeMayorista[];
}

export async function saveMayorista(
  orgId: string,
  payload: Omit<TradeMayorista, 'id' | 'org_id' | 'created_at'>,
  id?: string,
): Promise<TradeMayorista> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_mayoristas')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TradeMayorista;
  }
  const { data, error } = await supabase
    .from('trade_mayoristas')
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeMayorista;
}

export async function deleteMayorista(id: string): Promise<void> {
  const { error } = await supabase.from('trade_mayoristas').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

export async function loadCompras(orgId: string): Promise<TradeCompra[]> {
  const { data, error } = await supabase
    .from('trade_compras')
    .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_supplier_catalogs(supplier_name), trade_jobs(titulo)')
    .eq('org_id', orgId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeCompra[];
}

export async function saveCompra(
  orgId: string,
  payload: Omit<TradeCompra, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_mayoristas' | 'trade_subcontractors' | 'trade_supplier_catalogs' | 'trade_jobs'>,
  id?: string,
): Promise<TradeCompra> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_compras')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_supplier_catalogs(supplier_name), trade_jobs(titulo)')
      .single();
    if (error) throw error;
    return data as TradeCompra;
  }
  const { data, error } = await supabase
    .from('trade_compras')
    .insert({ ...payload, org_id: orgId })
    .select('*, trade_mayoristas(nombre), trade_subcontractors(nombre), trade_supplier_catalogs(supplier_name), trade_jobs(titulo)')
    .single();
  if (error) throw error;
  return data as TradeCompra;
}

export async function deleteCompra(id: string): Promise<void> {
  const { error } = await supabase.from('trade_compras').delete().eq('id', id);
  if (error) throw error;
}

export async function marcarCompraPagada(id: string, pagado: boolean): Promise<void> {
  const { error } = await supabase
    .from('trade_compras')
    .update({ pagado, pagado_at: pagado ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

