/**
 * geoApi — Cliente frontend para las Edge Functions de geocodificación y routing.
 * Todas las peticiones van al backend autenticado (Edge Functions).
 * Nunca llama directamente a Geoapify desde el navegador.
 *
 * Diseño testable: las funciones principales aceptan un parámetro opcional
 * `invoker` para sustituir supabase.functions.invoke en tests sin vi.mock.
 */

import { supabase } from './supabase';
import type { TransportLocation } from './transportLocations';
import { locationToAddress, locationToText } from './transportLocations';

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface GeocodingCandidate {
  lat:          number;
  lng:          number;
  display_name: string;
  confidence?:  number;
}

export interface GeocodingResult {
  candidates:  GeocodingCandidate[];
  ambiguous:   boolean;
  cached:      boolean;
  provider:    string;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat] — convertir a [lat, lng] para Leaflet
}

export interface RouteResult {
  geometry:   GeoJSONLineString;
  distance_m: number;
  duration_s: number;
  provider:   string;
  cached:     boolean;
}

export type GeoFieldName = 'origen_detalle' | 'destino_detalle';

// Tipo del invoker: compatible con supabase.functions.invoke
export type FunctionInvoker = (
  fnName: string,
  opts: { body: Record<string, unknown> }
) => Promise<{ data: unknown; error: { message: string } | null }>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Construye el texto de búsqueda desde una TransportLocation. */
export function buildSearchText(loc: TransportLocation | null): string {
  if (!loc) return '';
  return locationToAddress(loc) || locationToText(loc) || '';
}

const defaultInvoker: FunctionInvoker = (fnName, opts) =>
  supabase.functions.invoke(fnName, opts) as Promise<{ data: unknown; error: { message: string } | null }>;

// ── Funciones públicas ────────────────────────────────────────────────────────

/**
 * Geocodifica una dirección para la organización indicada.
 * El backend autentica al usuario, aplica rate limit y usa la caché.
 */
export async function geocodeAddress(
  address:   string,
  orgId:     string,
  invoker:   FunctionInvoker = defaultInvoker
): Promise<GeocodingResult> {
  const { data, error } = await invoker('geocode', { body: { address, org_id: orgId } as Record<string, unknown> });
  if (error) throw new Error(error.message || 'Error en geocodificación');
  const result = data as GeocodingResult & { error?: string };
  if (result?.error) throw new Error(result.error);
  return result;
}

/**
 * Solicita una ruta por carretera para una serie de waypoints.
 * El orden de los waypoints define el recorrido — no se reordena.
 * Devuelve null si hay menos de 2 waypoints válidos.
 */
export async function routeWaypoints(
  waypoints: Array<{ lat: number; lng: number }>,
  orgId:     string,
  invoker:   FunctionInvoker = defaultInvoker
): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;
  const { data, error } = await invoker('route', { body: { waypoints, org_id: orgId } as Record<string, unknown> });
  if (error) throw new Error(error.message || 'Error en cálculo de ruta');
  if (!data) return null;
  const result = data as RouteResult & { error?: string };
  if (result?.error) throw new Error(result.error);
  return result;
}

/**
 * Persiste coordenadas en origen_detalle o destino_detalle de un servicio.
 * Usa el RPC update_transport_location — validación y permisos en la DB.
 */
export async function saveTransportLocation(
  serviceId: string,
  field:     GeoFieldName,
  lat:       number,
  lng:       number,
  geoSource: 'geocoded' | 'confirmed' | 'manual' = 'confirmed'
): Promise<void> {
  const { error } = await supabase.rpc('update_transport_location', {
    p_service_id: serviceId,
    p_field:      field,
    p_lat:        lat,
    p_lng:        lng,
    p_geo_source: geoSource,
  });
  if (error) throw new Error(error.message);
}

/**
 * Persiste coordenadas en una parada específica (por índice 0-based).
 */
export async function saveTransportStopLocation(
  serviceId:  string,
  stopIndex:  number,
  lat:        number,
  lng:        number,
  geoSource:  'geocoded' | 'confirmed' | 'manual' = 'confirmed'
): Promise<void> {
  const { error } = await supabase.rpc('update_transport_stop_location', {
    p_service_id:  serviceId,
    p_stop_index:  stopIndex,
    p_lat:         lat,
    p_lng:         lng,
    p_geo_source:  geoSource,
  });
  if (error) throw new Error(error.message);
}

/** Formatea duración en segundos como "X h Y min" o "Y min". */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins  = Math.round((seconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${mins} min`;
  return `${mins} min`;
}

/** Formatea distancia en metros como "X,X km" o "X m". */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
  return `${meters} m`;
}
