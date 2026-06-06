/**
 * geocoder.ts
 * Helper para convertir una dirección postal en coordenadas GPS.
 * Llama a la edge function `trade-geocode-address` (Nominatim / Google Maps).
 * No expone ninguna API key en el cliente.
 */

import { supabase } from './supabase';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export type GeoStatus = 'idle' | 'loading' | 'ok' | 'not_found' | 'error';

export interface GeocodeResult {
  latitud: number;
  longitud: number;
  formatted_address: string;
}

export interface GeocodeAddressParams {
  direccion?: string | null;
  localidad?: string | null;
  cp?: string | null;
  provincia?: string | null;
  pais?: string | null;
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Convierte una dirección postal en coordenadas GPS mediante la edge function.
 * Devuelve `null` si la dirección no se encontró o si hubo un error.
 */
export async function geocodeAddress(
  params: GeocodeAddressParams,
): Promise<GeocodeResult | null> {
  const hasEnough = !!(params.direccion || params.localidad || params.cp);
  if (!hasEnough) return null;

  const { data, error } = await supabase.functions.invoke<{
    status: string;
    latitud: number | null;
    longitud: number | null;
    formatted_address: string | null;
  }>('trade-geocode-address', {
    body: {
      direccion: params.direccion ?? undefined,
      localidad: params.localidad ?? undefined,
      cp: params.cp ?? undefined,
      provincia: params.provincia ?? undefined,
      pais: params.pais ?? 'España',
    },
  });

  if (error || !data || data.status !== 'ok' || data.latitud == null) return null;

  return {
    latitud: data.latitud,
    longitud: data.longitud!,
    formatted_address: data.formatted_address ?? '',
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Comprueba si los campos de dirección han cambiado respecto al valor anterior. */
export function addressChanged(
  current: { direccion?: string | null; localidad?: string | null; cp?: string | null },
  previous: { direccion?: string | null; localidad?: string | null; cp?: string | null } | null | undefined,
): boolean {
  if (!previous) return true;
  return (
    current.direccion !== previous.direccion ||
    current.localidad !== previous.localidad ||
    current.cp !== previous.cp
  );
}
