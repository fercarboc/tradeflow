/**
 * transportRates.ts — Tarifas económicas del módulo de transporte
 *
 * El JSONB `transport_rates` en trade_organizations almacena la configuración
 * por empresa. Separa costes internos (lo que cuesta operar) de tarifas de venta
 * (lo que se factura al cliente) para evitar dobles contabilizaciones.
 *
 * Compatibilidad: campos heredados del wizard de onboarding
 *   precio_km, precio_hora, precio_jornada, precio_trayecto
 * están presentes en la interfaz y se leen/escriben correctamente.
 */

import { supabase } from './supabase';

// ── Interfaz principal ────────────────────────────────────────────────────────

export interface TransportRates {
  // ── Costes internos por kilómetro ─────────────────────────────────────────
  /** €/km para kilómetros comerciales (cliente en el vehículo). Incluye coste de combustible si se configura aquí. */
  coste_km_comercial: number | null;
  /** €/km para desplazamientos en vacío (salida cochera, regreso, reposicionamiento). Suele ser menor. */
  coste_km_vacio: number | null;

  // ── Combustible (alternativa a coste_km si no se usa tarifa plana) ────────
  /** Consumo medio del vehículo tipo en litros/100km. */
  consumo_l_100km: number | null;
  /** Precio actual del combustible en €/litro. */
  precio_combustible: number | null;

  // ── Conductor ─────────────────────────────────────────────────────────────
  /** Coste horario del conductor en €/h (según convenio o coste real de nómina). */
  coste_conductor_hora: number | null;
  /** Coste de hora extra del conductor en €/h (jornadas > 8h). */
  coste_conductor_hora_extra: number | null;
  /** Dieta diaria del conductor en €/día (Estatuto de los Trabajadores / convenio colectivo). */
  dieta_conductor_dia: number | null;
  /** Límite de alojamiento del conductor en €/noche. */
  alojamiento_conductor_noche: number | null;

  // ── Vehículo ──────────────────────────────────────────────────────────────
  /** Coste fijo del vehículo por día (amortización, seguro, mantenimiento periódico) en €/día. */
  coste_vehiculo_dia: number | null;

  // ── Gastos generales y margen ─────────────────────────────────────────────
  /** Gastos generales como % sobre el coste directo (administración, seguros, RRHH). */
  overhead_pct: number | null;
  /** Margen comercial objetivo sobre precio de venta (no sobre coste). */
  margin_pct: number | null;

  // ── Tarifas de venta (heredadas del wizard, opcionales) ───────────────────
  /** €/km facturado al cliente (tarifa comercial, no coste interno). */
  precio_km: number | null;
  /** €/hora facturada al cliente. */
  precio_hora: number | null;
  /** €/jornada completa facturada al cliente. */
  precio_jornada: number | null;
  /** Precio fijo por trayecto definido (cuando aplica). */
  precio_trayecto: number | null;
}

// ── Valores por defecto (todos null — el usuario configura) ──────────────────

export const DEFAULT_TRANSPORT_RATES: TransportRates = {
  coste_km_comercial:       null,
  coste_km_vacio:           null,
  consumo_l_100km:          null,
  precio_combustible:       null,
  coste_conductor_hora:     null,
  coste_conductor_hora_extra: null,
  dieta_conductor_dia:      null,
  alojamiento_conductor_noche: null,
  coste_vehiculo_dia:       null,
  overhead_pct:             null,
  margin_pct:               null,
  precio_km:                null,
  precio_hora:              null,
  precio_jornada:           null,
  precio_trayecto:          null,
};

// ── Helpers de validación ────────────────────────────────────────────────────

/** Devuelve true si el valor es un número positivo (>0). */
export function isPositive(v: number | null | undefined): v is number {
  return typeof v === 'number' && isFinite(v) && v > 0;
}

/** Devuelve true si el valor es un porcentaje válido (0-100). */
export function isPct(v: number | null | undefined): v is number {
  return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 100;
}

/**
 * Devuelve true si los datos de combustible son suficientes para calcular un coste por km.
 * Requiere ambos campos: consumo_l_100km Y precio_combustible.
 */
export function hasFuelData(rates: Partial<TransportRates>): boolean {
  return isPositive(rates.consumo_l_100km) && isPositive(rates.precio_combustible);
}

/**
 * Devuelve true si hay algún método de coste por km disponible
 * (coste_km_comercial directo O datos de combustible).
 */
export function hasKmCostMethod(rates: Partial<TransportRates>): boolean {
  return isPositive(rates.coste_km_comercial) || hasFuelData(rates);
}

// ── Parseo seguro de JSONB ────────────────────────────────────────────────────

/**
 * Parsea el valor raw del campo transport_rates (puede ser null, {}, o un objeto).
 * Garantiza que el resultado siempre tiene todos los campos de TransportRates.
 */
export function parseTransportRates(raw: Record<string, unknown> | null | undefined): TransportRates {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TRANSPORT_RATES };
  const r = raw as Record<string, unknown>;
  const num = (k: string): number | null => {
    const v = r[k];
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return isFinite(n) ? n : null;
  };
  return {
    coste_km_comercial:        num('coste_km_comercial'),
    coste_km_vacio:            num('coste_km_vacio'),
    consumo_l_100km:           num('consumo_l_100km'),
    precio_combustible:        num('precio_combustible'),
    coste_conductor_hora:      num('coste_conductor_hora'),
    coste_conductor_hora_extra: num('coste_conductor_hora_extra'),
    dieta_conductor_dia:       num('dieta_conductor_dia'),
    alojamiento_conductor_noche: num('alojamiento_conductor_noche'),
    coste_vehiculo_dia:        num('coste_vehiculo_dia'),
    overhead_pct:              num('overhead_pct'),
    margin_pct:                num('margin_pct'),
    precio_km:                 num('precio_km'),
    precio_hora:               num('precio_hora'),
    precio_jornada:            num('precio_jornada'),
    precio_trayecto:           num('precio_trayecto'),
  };
}

// ── CRUD ────────────────────────────────────────────────────────────────────

/** Carga las tarifas de la organización desde la BD. */
export async function loadTransportRates(orgId: string): Promise<TransportRates> {
  const { data, error } = await supabase
    .from('trade_organizations')
    .select('transport_rates')
    .eq('id', orgId)
    .single();
  if (error) throw error;
  return parseTransportRates((data as { transport_rates: Record<string, unknown> | null }).transport_rates);
}

/**
 * Persiste las tarifas de la organización en la BD.
 * Hace merge con claves existentes para no sobrescribir campos desconocidos del JSONB.
 * Lanza si el update no afectó ninguna fila (RLS o orgId incorrecto).
 */
export async function saveTransportRates(orgId: string, rates: TransportRates): Promise<void> {
  // Cargar claves existentes para hacer merge (preservar campos de otras fases)
  const { data: current, error: loadErr } = await supabase
    .from('trade_organizations')
    .select('transport_rates')
    .eq('id', orgId)
    .single();
  if (loadErr) throw loadErr;

  const existing = (current as { transport_rates: Record<string, unknown> | null }).transport_rates ?? {};
  const merged = { ...existing, ...rates };

  const { data, error } = await supabase
    .from('trade_organizations')
    .update({ transport_rates: merged } as Record<string, unknown>)
    .eq('id', orgId)
    .select('id');
  if (error) throw error;
  // Sin filas devueltas = RLS bloqueó el update o el orgId no coincide
  if (!data || data.length === 0) {
    throw new Error('Sin permisos de escritura sobre esta organización');
  }
}
