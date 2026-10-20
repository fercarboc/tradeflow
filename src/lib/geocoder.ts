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

/** Comprueba si los campos de dirección de un trabajo han cambiado respecto al valor anterior. */
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

// ── Geocodificación de organizaciones ─────────────────────────────────────────

export interface OrgAddressFields {
  direccion?: string | null;
  localidad?: string | null;
  ciudad?: string | null;   // campo legacy — usado como fallback cuando localidad está vacío
  cp?: string | null;
  provincia?: string | null;
  pais?: string | null;
}

/**
 * Construye los parámetros de geocodificación a partir de los datos de una organización.
 * Usa `localidad` de forma prioritaria; cae en `ciudad` (campo legacy) si `localidad` está vacío.
 */
export function buildOrgGeocodeParams(org: OrgAddressFields): GeocodeAddressParams {
  return {
    direccion: org.direccion,
    localidad: org.localidad ?? org.ciudad ?? undefined,
    cp: org.cp ?? undefined,
    provincia: org.provincia ?? undefined,
    pais: org.pais ?? 'España',
  };
}

/**
 * Devuelve true si los campos de dirección de una organización han cambiado de forma que
 * requieren invalidar las coordenadas almacenadas y volver a geocodificar.
 * Incluye `pais` porque es editable desde los ajustes de empresa.
 * Ignora cambios puramente fiscales (nombre, NIF, email, teléfono, IBAN, IVA).
 */
export function orgAddressChanged(
  next: { direccion?: string | null; localidad?: string | null; cp?: string | null; provincia?: string | null; pais?: string | null },
  prev: OrgAddressFields | null | undefined,
): boolean {
  if (!prev) return true;
  const prevLocalidad = prev.localidad ?? prev.ciudad ?? '';
  return (
    (next.direccion ?? '') !== (prev.direccion  ?? '')    ||
    (next.localidad ?? '') !== prevLocalidad               ||
    (next.cp        ?? '') !== (prev.cp         ?? '')    ||
    (next.provincia ?? '') !== (prev.provincia  ?? '')    ||
    (next.pais ?? 'España') !== (prev.pais ?? 'España')
  );
}

// ── Scheduler de geocodificación ───────────────────────────────────────────────

export type GeocodeFn = (params: GeocodeAddressParams) => Promise<GeocodeResult | null>;

export interface GeoScheduler {
  /** Lanza una geocodificación. Cualquier llamada anterior queda invalidada. */
  schedule(params: GeocodeAddressParams, onSuccess: (geo: GeocodeResult) => void): void;
  /** Invalida cualquier llamada pendiente sin lanzar otra nueva. */
  cancel(): void;
}

/**
 * Crea un scheduler que garantiza que solo la geocodificación más reciente
 * llama a `onSuccess`. Las llamadas anteriores se descartan en silencio.
 *
 * Acepta una función de geocodificación inyectable para facilitar los tests.
 */
export function createGeoScheduler(geocodeFn: GeocodeFn = geocodeAddress): GeoScheduler {
  let currentCallId: string | null = null;

  return {
    schedule(params, onSuccess) {
      const callId = Math.random().toString(36).slice(2);
      currentCallId = callId;
      void geocodeFn(params).then(geo => {
        if (currentCallId !== callId) return; // stale o cancelada
        if (geo) onSuccess(geo);
      });
    },
    cancel() {
      currentCallId = null;
    },
  };
}
