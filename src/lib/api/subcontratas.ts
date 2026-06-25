import { supabase } from '../client';

// ── Subcontratas ──────────────────────────────────────────────────────────────

export interface TradeSubcontractor {
  id: string;
  org_id: string;
  nombre: string;
  nif?: string | null;
  email?: string | null;
  telefono?: string | null;
  especialidad?: string | null;
  notas?: string | null;
  activo: boolean;
  created_at: string;
  // Campos ampliados
  direccion_fiscal?: string | null;
  direccion_trabajo?: string | null;
  persona_contacto?: string | null;
  horarios?: string | null;
  cobertura?: string | null;
  valoracion?: number | null;
  estado_proveedor?: 'activo' | 'pendiente' | 'bloqueado' | null;
}

export interface TradeSubcontrata {
  id: string;
  org_id: string;
  numero?: string | null;          // SUB-YYYY-NNN (generado por trigger)
  subcontractor_id: string;
  job_id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;        // presupuesto directamente vinculado
  descripcion: string;
  coste: number;
  precio_cliente: number;
  estado: 'pendiente' | 'solicitado' | 'presupuesto_recibido' | 'añadido_presupuesto' | 'pendiente_cliente' | 'en_curso' | 'completado' | 'factura_recibida' | 'pagado' | 'cancelado';
  fecha_inicio?: string | null;
  fecha_fin_prevista?: string | null;
  // Facturación de la subcontrata hacia nosotros
  importe_factura_recibida?: number | null;
  fecha_factura_recibida?: string | null;
  referencia_factura_subcontrata?: string | null;
  pagado?: boolean;
  pagado_at?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  trade_subcontractors?: TradeSubcontractor;
  trade_jobs?: { titulo: string } | null;
  trade_contracts?: { referencia: string } | null;
  trade_quotes?: { numero: string } | null;
}

export interface TradeSubcontrataNota {
  id: string;
  subcontrata_id: string;
  org_id: string;
  texto: string;
  created_at: string;
}

// Proveedores (subcontractors)
export async function loadSubcontractors(orgId: string): Promise<TradeSubcontractor[]> {
  const { data, error } = await supabase
    .from('trade_subcontractors')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as TradeSubcontractor[];
}

export async function saveSubcontractor(
  orgId: string,
  payload: Omit<TradeSubcontractor, 'id' | 'org_id' | 'created_at'>,
  id?: string,
): Promise<TradeSubcontractor> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_subcontractors')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as TradeSubcontractor;
  }
  const { data, error } = await supabase
    .from('trade_subcontractors')
    .insert({ ...payload, org_id: orgId })
    .select()
    .single();
  if (error) throw error;
  return data as TradeSubcontractor;
}

export async function deleteSubcontractor(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontractors').update({ activo: false }).eq('id', id);
  if (error) throw error;
}

// Subcontratas
export async function loadSubcontratas(orgId: string): Promise<TradeSubcontrata[]> {
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeSubcontrata[];
}

export async function saveSubcontrata(
  orgId: string,
  payload: Omit<TradeSubcontrata, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_subcontractors' | 'trade_jobs' | 'trade_contracts' | 'trade_quotes'>,
  id?: string,
): Promise<TradeSubcontrata> {
  if (id) {
    const { data, error } = await supabase
      .from('trade_subcontratas')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
      .single();
    if (error) throw error;
    return data as TradeSubcontrata;
  }
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .insert({ ...payload, org_id: orgId })
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .single();
  if (error) throw error;
  return data as TradeSubcontrata;
}

export async function deleteSubcontrata(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontratas').delete().eq('id', id);
  if (error) throw error;
}

export async function updateSubcontrataEstado(
  id: string,
  estado: TradeSubcontrata['estado'],
): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// Notas
export async function loadSubcontrataNotes(subcontrataId: string): Promise<TradeSubcontrataNota[]> {
  const { data, error } = await supabase
    .from('trade_subcontrata_notas')
    .select('*')
    .eq('subcontrata_id', subcontrataId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeSubcontrataNota[];
}

export async function addSubcontrataNota(
  subcontrataId: string,
  orgId: string,
  texto: string,
): Promise<TradeSubcontrataNota> {
  const { data, error } = await supabase
    .from('trade_subcontrata_notas')
    .insert({ subcontrata_id: subcontrataId, org_id: orgId, texto })
    .select()
    .single();
  if (error) throw error;
  return data as TradeSubcontrataNota;
}

export async function deleteSubcontrataNota(id: string): Promise<void> {
  const { error } = await supabase.from('trade_subcontrata_notas').delete().eq('id', id);
  if (error) throw error;
}

// Vincula subcontrata al presupuesto del trabajo: añade una partida con precio_cliente
// Devuelve el número del presupuesto afectado, o null si el trabajo no tiene presupuesto
export async function addSubcontrataToJobQuote(
  jobId: string,
  subcontrataId: string,
  descripcion: string,
  precioCliente: number,
): Promise<{ quoteId: string; quoteNumero: string } | null> {
  const { data: job } = await supabase
    .from('trade_jobs')
    .select('quote_id')
    .eq('id', jobId)
    .maybeSingle();
  if (!job?.quote_id) return null;

  const quoteId = job.quote_id as string;

  // Posición: al final de las partidas actuales
  const { count } = await supabase
    .from('trade_quote_items')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', quoteId);

  const ref = subcontrataId.replace(/-/g, '').substring(0, 8).toUpperCase();
  await supabase.from('trade_quote_items').insert({
    quote_id: quoteId,
    descripcion: `Trabajos subcontratados — ${descripcion} [SUB-${ref}]`,
    tipo: 'mano_de_obra',
    cantidad: 1,
    precio_unitario: precioCliente,
    total: precioCliente,
    posicion: (count ?? 0),
  });

  // Recalcular total del presupuesto
  const { data: items } = await supabase
    .from('trade_quote_items')
    .select('precio_unitario, cantidad')
    .eq('quote_id', quoteId);
  const nuevoTotal = (items ?? []).reduce((s: number, i: { precio_unitario: number; cantidad: number }) => s + i.precio_unitario * i.cantidad, 0);
  await supabase.from('trade_quotes').update({ total_neto: nuevoTotal }).eq('id', quoteId);

  const { data: quote } = await supabase
    .from('trade_quotes')
    .select('numero')
    .eq('id', quoteId)
    .maybeSingle();

  return { quoteId, quoteNumero: quote?.numero ?? quoteId };
}

// Crea subcontrata vinculada directamente a un presupuesto y añade la partida
export async function createSubcontrataFromQuote(
  orgId: string,
  quoteId: string,
  quoteNumero: string,
  payload: Omit<TradeSubcontrata, 'id' | 'org_id' | 'numero' | 'created_at' | 'updated_at' | 'trade_subcontractors' | 'trade_jobs' | 'trade_contracts' | 'trade_quotes'>,
): Promise<TradeSubcontrata> {
  const sub = await saveSubcontrata(orgId, { ...payload, quote_id: quoteId });

  // Añadir partida al presupuesto
  const { count } = await supabase
    .from('trade_quote_items')
    .select('*', { count: 'exact', head: true })
    .eq('quote_id', quoteId);

  const ref = sub.numero ?? sub.id.replace(/-/g, '').substring(0, 8).toUpperCase();
  await supabase.from('trade_quote_items').insert({
    quote_id: quoteId,
    descripcion: `Trabajos subcontratados — ${payload.descripcion} [${ref}]`,
    tipo: 'mano_de_obra',
    cantidad: 1,
    precio_unitario: payload.precio_cliente,
    total: payload.precio_cliente,
    posicion: (count ?? 0),
  });

  // Recalcular total del presupuesto
  const { data: items } = await supabase
    .from('trade_quote_items')
    .select('precio_unitario, cantidad')
    .eq('quote_id', quoteId);
  const nuevoTotal = (items ?? []).reduce((s: number, i: { precio_unitario: number; cantidad: number }) => s + i.precio_unitario * i.cantidad, 0);
  await supabase.from('trade_quotes').update({ total_neto: nuevoTotal }).eq('id', quoteId);

  return sub;
}

// Registrar factura recibida de la subcontrata
export async function registrarFacturaSubcontrata(
  subcontrataId: string,
  importe: number,
  fecha: string,
  referencia: string,
): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({
      importe_factura_recibida: importe,
      fecha_factura_recibida: fecha || null,
      referencia_factura_subcontrata: referencia || null,
      estado: 'factura_recibida',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subcontrataId);
  if (error) throw error;
}

// Marcar subcontrata como pagada
export async function marcarSubcontrataPagada(subcontrataId: string, pagado: boolean): Promise<void> {
  const { error } = await supabase
    .from('trade_subcontratas')
    .update({
      pagado,
      pagado_at: pagado ? new Date().toISOString() : null,
      estado: pagado ? 'pagado' : 'factura_recibida',
      updated_at: new Date().toISOString(),
    })
    .eq('id', subcontrataId);
  if (error) throw error;
}

// Carga subcontratas vinculadas a un presupuesto concreto
export async function loadSubcontratasByQuote(quoteId: string): Promise<TradeSubcontrata[]> {
  const { data, error } = await supabase
    .from('trade_subcontratas')
    .select('*, trade_subcontractors(id,nombre,especialidad,telefono,email), trade_jobs(titulo), trade_contracts(referencia), trade_quotes(numero)')
    .eq('quote_id', quoteId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as TradeSubcontrata[];
}

