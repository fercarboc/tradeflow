/**
 * TX-FACT-1 — Facturar un viaje de mercancías.
 * Crea la factura en 'Borrador' (mismo patrón que trabajos y mantenimiento):
 * después se emite desde Facturas con el flujo VeriFactu (fn_emitir_factura).
 */
import { supabase, createInvoiceFromJob, addClient, type TradeInvoice, type TradeClient } from './supabase';
import { fmtFechaEs, fmtPesoKg } from './transportDocs';
import { tipoCargaLabel } from './transportShipments';
import type { TradeTransportTrip } from './transportTrips';

export interface BillingClientSuggestion {
  fuente: string;              // de dónde sale (DeCA emitido, DeCA recibido, expedición…)
  nombre: string;
  nif: string | null;
  domicilio: string | null;
}

const normNif = (v?: string | null) => (v ?? '').toUpperCase().replace(/[\s.-]/g, '') || null;

/** Factura (no rectificativa) ya creada para el viaje, si existe. */
export async function loadTripInvoice(orgId: string, tripId: string): Promise<TradeInvoice | null> {
  const { data } = await supabase.from('trade_invoices').select('*')
    .eq('org_id', orgId).eq('trip_id', tripId).is('rectifica_factura_id', null).maybeSingle();
  return (data as TradeInvoice) ?? null;
}

/** Datos fiscales del cliente que ya conocemos por los documentos del viaje. */
export async function tripClientSuggestions(orgId: string, tripId: string): Promise<BillingClientSuggestion[]> {
  const [emitidos, recibidos, expediciones] = await Promise.all([
    supabase.from('trade_transport_control_docs').select('numero, cargador_nombre, cargador_nif, cargador_domicilio')
      .eq('org_id', orgId).eq('trip_id', tripId).eq('estado', 'vigente'),
    supabase.from('trade_transport_received_docs').select('emisor_nombre, datos_extraidos')
      .eq('org_id', orgId).eq('trip_id', tripId),
    supabase.from('trade_transport_shipments').select('referencia, cargador_nombre, cargador_nif, cargador_domicilio')
      .eq('org_id', orgId).eq('trip_id', tripId).neq('estado', 'cancelada'),
  ]);
  const out: BillingClientSuggestion[] = [];
  for (const d of (emitidos.data ?? []) as { numero: string; cargador_nombre: string; cargador_nif: string | null; cargador_domicilio: string | null }[]) {
    out.push({ fuente: `DeCA ${d.numero}`, nombre: d.cargador_nombre, nif: normNif(d.cargador_nif), domicilio: d.cargador_domicilio });
  }
  for (const d of (recibidos.data ?? []) as { emisor_nombre: string | null; datos_extraidos: Record<string, string | null> | null }[]) {
    const x = d.datos_extraidos;
    const nombre = x?.cargador_nombre ?? d.emisor_nombre;
    if (nombre) out.push({ fuente: 'DeCA del cliente', nombre, nif: normNif(x?.cargador_nif), domicilio: x?.cargador_domicilio ?? null });
  }
  for (const s of (expediciones.data ?? []) as { referencia: string | null; cargador_nombre: string; cargador_nif: string | null; cargador_domicilio: string | null }[]) {
    out.push({ fuente: `Expedición ${s.referencia ?? ''}`.trim(), nombre: s.cargador_nombre, nif: normNif(s.cargador_nif), domicilio: s.cargador_domicilio });
  }
  // Sin duplicados por NIF (o por nombre si no hay NIF)
  const seen = new Set<string>();
  return out.filter(s => {
    const k = s.nif ?? s.nombre.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

/** Concepto por defecto de la factura de un viaje. */
export function tripInvoiceConcept(trip: TradeTransportTrip, matricula?: string | null): string {
  const partes = [
    `Transporte de mercancías ${trip.origen} → ${trip.destino}`,
    fmtFechaEs(trip.fecha_inicio.slice(0, 10)),
    tipoCargaLabel(trip.tipo_carga),
    trip.peso_kg ? fmtPesoKg(Number(trip.peso_kg)) : '',
    matricula ? `Vehículo ${matricula}` : '',
    trip.referencia ? `Ref. ${trip.referencia}` : '',
  ];
  return partes.filter(Boolean).join(' · ');
}

export interface TripInvoiceInput {
  client: { id: string } | { nombre: string; nif: string | null; domicilio: string | null };
  base: number;           // importe sin IVA
  ivaPct: number;
  concepto: string;
}

/**
 * Crea la factura en Borrador vinculada al viaje. Si el cliente no existe,
 * lo da de alta con los datos fiscales indicados. Lanza error si el viaje
 * ya tiene factura (índice único en BD).
 */
export async function createTripDraftInvoice(orgId: string, trip: TradeTransportTrip, input: TripInvoiceInput): Promise<TradeInvoice> {
  if (!(input.base > 0)) throw new Error('El importe debe ser mayor que 0');
  const existente = await loadTripInvoice(orgId, trip.id);
  if (existente) throw new Error('Este viaje ya tiene factura');

  let clientId: string;
  if ('id' in input.client) {
    clientId = input.client.id;
  } else {
    if (!input.client.nombre.trim()) throw new Error('Indique el cliente a facturar');
    const nif = normNif(input.client.nif);
    const esEmpresa = !!nif && /^[A-HJNP-SUVW]/.test(nif);
    const nuevo: TradeClient = await addClient(orgId, {
      nombre: input.client.nombre.trim(),
      nif: nif ?? undefined,
      direccion: input.client.domicilio?.trim() || undefined,
      tipo_cliente: esEmpresa ? 'empresa' : 'particular',
    });
    clientId = nuevo.id;
  }

  const inv = await createInvoiceFromJob(orgId, '', clientId, [
    { descripcion: input.concepto, cantidad: 1, precioBase: Math.round(input.base * 100) / 100, tipo: 'servicio' },
  ], { ivaPct: input.ivaPct, concepto: input.concepto });

  // Vincular con el viaje (el índice único impide una segunda factura)
  const { error } = await supabase.from('trade_invoices').update({ trip_id: trip.id }).eq('id', inv.id).eq('org_id', orgId);
  if (error) {
    await supabase.from('trade_invoices').delete().eq('id', inv.id).eq('estado', 'Borrador');
    throw new Error(error.code === '23505' ? 'Este viaje ya tiene factura' : error.message);
  }
  // Recordar el cliente en el viaje
  await supabase.from('trade_transport_trips').update({ client_id: clientId }).eq('id', trip.id).eq('org_id', orgId);
  return { ...inv, trip_id: trip.id } as TradeInvoice;
}

export function invoiceStateLabel(inv: TradeInvoice): string {
  if (inv.estado === 'Borrador') return 'Borrador · pendiente de emitir';
  return `${inv.estado}${inv.numero && !inv.numero.startsWith('BORRADOR') ? ` · ${inv.numero}` : ''}`;
}
