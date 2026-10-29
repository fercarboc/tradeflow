/**
 * transportQuotes.ts — Presupuestos manuales de transporte (TX-C2)
 *
 * Estado: borrador → enviado → aprobado (+servicio creado atómicamente vía RPC)
 *                   → rechazado
 *         cualquier estado no terminal → expirado
 * La aprobación crea automáticamente un trade_transport_service vía
 * la RPC `approve_transport_quote` (SELECT FOR UPDATE en BD).
 */

import { supabase } from './supabase';
import type { TipoServicio } from './transportServices';
export type { TipoServicio };

// ── Estados ───────────────────────────────────────────────────────────────────

export type QuoteEstado =
  | 'borrador'
  | 'enviado'
  | 'aprobado'
  | 'rechazado'
  | 'expirado'
  | 'convertido';

export const QUOTE_ESTADOS: {
  value: QuoteEstado;
  label: string;
  color: string;
}[] = [
  { value: 'borrador',   label: 'Borrador',   color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' },
  { value: 'enviado',    label: 'Enviado',    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800' },
  { value: 'aprobado',   label: 'Aprobado',   color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800' },
  { value: 'rechazado',  label: 'Rechazado',  color: 'bg-red-100 text-red-600 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800' },
  { value: 'expirado',   label: 'Expirado',   color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800' },
  { value: 'convertido', label: 'Convertido', color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800' },
];

// ── Máquina de estados ────────────────────────────────────────────────────────

export const QUOTE_VALID_TRANSITIONS: Record<QuoteEstado, QuoteEstado[]> = {
  borrador:   ['enviado', 'expirado'],
  enviado:    ['aprobado', 'rechazado', 'expirado'],
  aprobado:   ['convertido'],
  rechazado:  [],
  expirado:   [],
  convertido: [],
};

export function canTransition(from: QuoteEstado, to: QuoteEstado): boolean {
  return (QUOTE_VALID_TRANSITIONS[from] ?? []).includes(to);
}

export function isTerminalEstado(estado: QuoteEstado): boolean {
  return ['rechazado', 'expirado', 'convertido'].includes(estado);
}

// ── Parada de itinerario ──────────────────────────────────────────────────────

export interface TransportQuoteStop {
  nombre: string;
  hora?: string;
  direccion?: string;
}

// ── Tipo principal ────────────────────────────────────────────────────────────

export interface TradeTransportQuote {
  id: string;
  org_id: string;
  numero_presupuesto: string;
  client_id?: string | null;
  titulo: string;
  tipo_servicio: TipoServicio;
  estado: QuoteEstado;
  fecha_servicio?: string | null;       // ISO date "YYYY-MM-DD"
  fecha_fin_servicio?: string | null;   // ISO date
  num_viajeros?: number | null;
  itinerario: TransportQuoteStop[];
  coste_estimado?: number | null;
  precio_sugerido?: number | null;
  precio_final?: number | null;
  margen_pct?: number | null;
  notas?: string | null;
  notas_internas?: string | null;
  fecha_expiracion?: string | null;
  servicio_id?: string | null;
  created_at: string;
  updated_at: string;
}

export type TradeTransportQuoteInput = Omit<
  TradeTransportQuote,
  'id' | 'org_id' | 'numero_presupuesto' | 'servicio_id' | 'created_at' | 'updated_at'
>;

// ── Helpers de estado ─────────────────────────────────────────────────────────

export function isQuoteEditable(q: TradeTransportQuote): boolean {
  return q.estado === 'borrador';
}

export function isQuoteSendable(q: TradeTransportQuote): boolean {
  return q.estado === 'borrador';
}

export function isQuoteApprovable(q: TradeTransportQuote): boolean {
  return q.estado === 'enviado';
}

export function isQuoteRejectable(q: TradeTransportQuote): boolean {
  return q.estado === 'enviado';
}

export function getQuoteEstadoInfo(estado: QuoteEstado) {
  return QUOTE_ESTADOS.find(e => e.value === estado) ?? QUOTE_ESTADOS[0];
}

// ── Validación ────────────────────────────────────────────────────────────────

export function validateQuoteInput(input: Partial<TradeTransportQuoteInput>): string[] {
  const errors: string[] = [];
  if (!input.titulo || input.titulo.trim() === '') {
    errors.push('El título del presupuesto es obligatorio');
  }
  if (!input.tipo_servicio) {
    errors.push('El tipo de servicio es obligatorio');
  }
  if (input.num_viajeros !== null && input.num_viajeros !== undefined) {
    if (!Number.isInteger(input.num_viajeros) || input.num_viajeros < 1) {
      errors.push('El número de viajeros debe ser un entero positivo');
    }
  }
  if (input.precio_final !== null && input.precio_final !== undefined) {
    if (input.precio_final < 0) {
      errors.push('El precio final no puede ser negativo');
    }
  }
  if (input.fecha_servicio && input.fecha_fin_servicio) {
    if (new Date(input.fecha_fin_servicio) < new Date(input.fecha_servicio)) {
      errors.push('La fecha de fin no puede ser anterior a la fecha de inicio del servicio');
    }
  }
  if (input.margen_pct !== null && input.margen_pct !== undefined) {
    if (input.margen_pct <= -100 || input.margen_pct >= 100) {
      errors.push('El margen debe estar entre -99.99% y 99.99%');
    }
  }
  return errors;
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/** Lista todos los presupuestos de la organización, más recientes primero. */
export async function loadTransportQuotes(orgId: string): Promise<TradeTransportQuote[]> {
  const { data, error } = await supabase
    .from('trade_transport_quotes')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeTransportQuote[];
}

/** Crea un presupuesto en estado borrador. Número generado automáticamente por el trigger. */
export async function createTransportQuote(
  orgId: string,
  input: TradeTransportQuoteInput,
): Promise<TradeTransportQuote> {
  const errors = validateQuoteInput(input);
  if (errors.length > 0) throw new Error(errors[0]);

  const { data, error } = await supabase
    .from('trade_transport_quotes')
    .insert([{
      org_id:    orgId,
      numero_presupuesto: '', // Trigger sobreescribe este valor
      ...input,
      estado:    'borrador',
      itinerario: input.itinerario ?? [],
    }])
    .select()
    .single();
  if (error) throw error;
  return data as TradeTransportQuote;
}

/** Actualiza campos de un presupuesto (solo en estado borrador, por convención). */
export async function updateTransportQuote(
  quoteId: string,
  orgId: string,
  updates: Partial<Omit<TradeTransportQuoteInput, 'estado'>>,
): Promise<TradeTransportQuote> {
  const { data, error } = await supabase
    .from('trade_transport_quotes')
    .update(updates)
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Presupuesto no encontrado o sin permisos');
  return data as TradeTransportQuote;
}

/**
 * Envía el presupuesto al cliente: borrador → enviado.
 * La transición se hace con .eq('estado', 'borrador') como guardia atómica.
 */
export async function sendTransportQuote(
  quoteId: string,
  orgId: string,
): Promise<TradeTransportQuote> {
  const { data, error } = await supabase
    .from('trade_transport_quotes')
    .update({ estado: 'enviado' })
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .eq('estado', 'borrador')
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo enviar: el presupuesto no existe, sin permisos, o no está en borrador');
  return data as TradeTransportQuote;
}

/**
 * Rechaza el presupuesto: enviado → rechazado.
 * Guardia atómica en la cláusula .eq('estado', 'enviado').
 */
export async function rejectTransportQuote(
  quoteId: string,
  orgId: string,
): Promise<TradeTransportQuote> {
  const { data, error } = await supabase
    .from('trade_transport_quotes')
    .update({ estado: 'rechazado' })
    .eq('id', quoteId)
    .eq('org_id', orgId)
    .eq('estado', 'enviado')
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('No se pudo rechazar: el presupuesto no existe, sin permisos, o no está en estado enviado');
  return data as TradeTransportQuote;
}

/**
 * Aprueba el presupuesto vía RPC (SELECT FOR UPDATE atómico).
 * Crea un trade_transport_service y devuelve su UUID.
 * Solo se puede llamar cuando el presupuesto está en estado "enviado".
 */
export async function approveTransportQuote(quoteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('approve_transport_quote', {
    p_quote_id: quoteId,
  });
  if (error) throw error;
  return data as string;
}
