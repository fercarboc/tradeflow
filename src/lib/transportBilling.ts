/**
 * TX-FACT-1 / TX-CIERRE-1 — Facturar transporte.
 * Viajes de mercancías, expediciones (grupaje: una factura por cargador) y
 * servicios de viajeros. La factura se crea en 'Borrador' (mismo patrón que
 * trabajos y mantenimiento) y se emite después desde Facturas con VeriFactu.
 */
import { supabase, createInvoiceFromJob, addClient, type TradeInvoice, type TradeClient } from './supabase';
import { fmtFechaEs, fmtPesoKg } from './transportDocs';
import { tipoCargaLabel, type TradeTransportShipment } from './transportShipments';
import type { TradeTransportTrip } from './transportTrips';
import type { TradeTransportService } from './transportServices';

export type BillingKind = 'trip' | 'service' | 'shipment';

/** Columna de trade_invoices que enlaza cada tipo (índice único en BD). */
export const BILLING_LINK_COLUMN: Record<BillingKind, 'trip_id' | 'transport_service_id' | 'shipment_id'> = {
  trip: 'trip_id',
  service: 'transport_service_id',
  shipment: 'shipment_id',
};

const BILLING_SOURCE_TABLE: Record<BillingKind, string> = {
  trip: 'trade_transport_trips',
  service: 'trade_transport_services',
  shipment: 'trade_transport_shipments',
};

export const BILLING_NOUN: Record<BillingKind, string> = {
  trip: 'viaje',
  service: 'servicio',
  shipment: 'expedición',
};

export interface BillingClientSuggestion {
  fuente: string;              // de dónde sale (DeCA emitido, DeCA recibido, expedición…)
  nombre: string;
  nif: string | null;
  domicilio: string | null;
}

export const normNif = (v?: string | null) => (v ?? '').toUpperCase().replace(/[\s.-]/g, '') || null;

/** Factura (no rectificativa) ya creada para el viaje, servicio o expedición. */
export async function loadTransportInvoice(orgId: string, kind: BillingKind, id: string): Promise<TradeInvoice | null> {
  const { data } = await supabase.from('trade_invoices').select('*')
    .eq('org_id', orgId).eq(BILLING_LINK_COLUMN[kind], id).is('rectifica_factura_id', null).maybeSingle();
  return (data as TradeInvoice) ?? null;
}

/** Facturas de varios elementos de una vez: id del elemento → factura. */
export async function loadTransportInvoiceMap(orgId: string, kind: BillingKind, ids: string[]): Promise<Record<string, TradeInvoice>> {
  if (ids.length === 0) return {};
  const col = BILLING_LINK_COLUMN[kind];
  const out: Record<string, TradeInvoice> = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data } = await supabase.from('trade_invoices').select('*')
      .eq('org_id', orgId).in(col, ids.slice(i, i + 150)).is('rectifica_factura_id', null);
    for (const inv of (data ?? []) as (TradeInvoice & Record<string, unknown>)[]) {
      const k = inv[col] as string | null;
      if (k) out[k] = inv;
    }
  }
  return out;
}

export const loadTripInvoice = (orgId: string, tripId: string) => loadTransportInvoice(orgId, 'trip', tripId);

function dedupe(list: BillingClientSuggestion[]): BillingClientSuggestion[] {
  const seen = new Set<string>();
  return list.filter(s => {
    const k = s.nif ?? s.nombre.toLowerCase();
    if (!s.nombre || seen.has(k)) return false;
    seen.add(k); return true;
  });
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
  return dedupe(out);
}

/** El cargador de la expedición y los DeCA vinculados a ella. */
export async function shipmentClientSuggestions(orgId: string, sh: TradeTransportShipment): Promise<BillingClientSuggestion[]> {
  const out: BillingClientSuggestion[] = [
    { fuente: `Expedición ${sh.referencia ?? ''}`.trim(), nombre: sh.cargador_nombre, nif: normNif(sh.cargador_nif), domicilio: sh.cargador_domicilio },
  ];
  const { data } = await supabase.from('trade_transport_control_docs').select('numero, cargador_nombre, cargador_nif, cargador_domicilio')
    .eq('org_id', orgId).eq('shipment_id', sh.id).eq('estado', 'vigente');
  for (const d of (data ?? []) as { numero: string; cargador_nombre: string; cargador_nif: string | null; cargador_domicilio: string | null }[]) {
    out.push({ fuente: `DeCA ${d.numero}`, nombre: d.cargador_nombre, nif: normNif(d.cargador_nif), domicilio: d.cargador_domicilio });
  }
  return dedupe(out);
}

/** Contacto del servicio y hojas de ruta emitidas para él. */
export async function serviceClientSuggestions(orgId: string, s: TradeTransportService): Promise<BillingClientSuggestion[]> {
  const out: BillingClientSuggestion[] = [];
  const { data } = await supabase.from('trade_transport_control_docs').select('numero, cargador_nombre, cargador_nif, cargador_domicilio')
    .eq('org_id', orgId).eq('service_id', s.id).eq('estado', 'vigente');
  for (const d of (data ?? []) as { numero: string; cargador_nombre: string | null; cargador_nif: string | null; cargador_domicilio: string | null }[]) {
    if (d.cargador_nombre) out.push({ fuente: `Hoja de ruta ${d.numero}`, nombre: d.cargador_nombre, nif: normNif(d.cargador_nif), domicilio: d.cargador_domicilio });
  }
  const c = s.contacto_principal;
  const nombre = c?.organizacion || c?.nombre;
  if (nombre) out.push({ fuente: 'Contacto del servicio', nombre, nif: null, domicilio: null });
  return dedupe(out);
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

/** Concepto por defecto de la factura de una expedición. */
export function shipmentInvoiceConcept(sh: TradeTransportShipment): string {
  const partes = [
    `Porte ${sh.origen} → ${sh.destino}`,
    fmtFechaEs(sh.fecha_recogida),
    sh.naturaleza,
    sh.peso_kg ? fmtPesoKg(Number(sh.peso_kg)) : '',
    sh.num_bultos ? `${sh.num_bultos} bultos` : '',
    sh.referencia ? `Exp. ${sh.referencia}` : '',
    sh.referencia_cargador ? `Su ref. ${sh.referencia_cargador}` : '',
  ];
  return partes.filter(Boolean).join(' · ');
}

/** Concepto por defecto de la factura de un servicio de viajeros. */
export function serviceInvoiceConcept(s: TradeTransportService, matricula?: string | null): string {
  const ruta = [s.origen, s.destino].filter(Boolean).join(' → ');
  const partes = [
    `Servicio de transporte de viajeros${ruta ? ` ${ruta}` : ''}`,
    s.titulo && s.titulo !== ruta ? s.titulo : '',
    fmtFechaEs(s.fecha_inicio.slice(0, 10)),
    s.num_viajeros ? `${s.num_viajeros} plazas` : '',
    matricula ? `Vehículo ${matricula}` : '',
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
 * Crea la factura en Borrador vinculada al viaje, servicio o expedición. Si el
 * cliente no existe, lo da de alta con los datos fiscales indicados. Lanza
 * error si el elemento ya tiene factura (índice único en BD).
 */
export async function createTransportDraftInvoice(
  orgId: string, kind: BillingKind, id: string, input: TripInvoiceInput,
): Promise<TradeInvoice> {
  const noun = BILLING_NOUN[kind];
  if (!(input.base > 0)) throw new Error('El importe debe ser mayor que 0');
  const existente = await loadTransportInvoice(orgId, kind, id);
  if (existente) throw new Error(`Este ${noun === 'expedición' ? 'porte' : noun} ya tiene factura`);

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

  // Vincular (el índice único impide una segunda factura)
  const col = BILLING_LINK_COLUMN[kind];
  const { error } = await supabase.from('trade_invoices').update({ [col]: id }).eq('id', inv.id).eq('org_id', orgId);
  if (error) {
    await supabase.from('trade_invoices').delete().eq('id', inv.id).eq('estado', 'Borrador');
    throw new Error(error.code === '23505' ? `Este ${noun} ya tiene factura` : error.message);
  }
  // Recordar el cliente en el elemento facturado (no bloquea si falla)
  await supabase.from(BILLING_SOURCE_TABLE[kind]).update({ client_id: clientId }).eq('id', id).eq('org_id', orgId);
  return { ...inv, [col]: id } as TradeInvoice;
}

export const createTripDraftInvoice = (orgId: string, trip: TradeTransportTrip, input: TripInvoiceInput) =>
  createTransportDraftInvoice(orgId, 'trip', trip.id, input);

export function invoiceStateLabel(inv: TradeInvoice): string {
  if (inv.estado === 'Borrador') return 'Borrador · pendiente de emitir';
  return `${inv.estado}${inv.numero && !inv.numero.startsWith('BORRADOR') ? ` · ${inv.numero}` : ''}`;
}
