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
  // Validation metadata forwarded from the edge function (GEO-AUTO-1)
  provider?: 'google' | 'nominatim';
  location_type?: string;
  country_code?: string;
  locality?: string;
  postal_code?: string;
  route?: string;
  house_number?: string;
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
    provider?: string;
    location_type?: string;
    country_code?: string;
    locality?: string;
    postal_code?: string;
    route?: string;
    house_number?: string;
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
    provider: data.provider as 'google' | 'nominatim' | undefined,
    location_type: data.location_type,
    country_code: data.country_code,
    locality: data.locality,
    postal_code: data.postal_code,
    route: data.route,
    house_number: data.house_number,
  };
}

// ── Validación territorial ─────────────────────────────────────────────────────

/**
 * Returns true if params contain at least one locatable field.
 * Mirrors the threshold the edge function applies server-side (pais is always included).
 */
export function hasSufficientAddress(params: GeocodeAddressParams): boolean {
  return !!(params.direccion?.trim() || params.localidad?.trim() || params.cp?.trim());
}

/**
 * Validates a geocoding result against the expected address fields.
 *
 * GEO-AUTO-1 conservatism: requires POSITIVE EVIDENCE, not just absence of contradiction.
 * If the edge function returns no metadata (old deployment), the result is rejected.
 *
 * Rules:
 *  1. country_code MUST be present and equal 'ES' — required positive evidence.
 *  2. At least one of (result.locality, result.postal_code) MUST be present.
 *  3. If params.localidad is non-empty: result.locality MUST be present and substring-match.
 *  4. If both params.cp and result.postal_code are non-empty: they MUST be equal.
 *  5. If params.direccion is non-empty:
 *     - Google (location_type present): only 'ROOFTOP' accepted.
 *       RANGE_INTERPOLATED is an interpolation on a route (deferred to GEO-AUTO-2).
 *       GEOMETRIC_CENTER and APPROXIMATE are city/area centroids — all rejected.
 *     - Nominatim (no location_type): result.route MUST be present (street identified).
 *       Locality-only Nominatim results when a street was requested are rejected.
 *  6. If result.house_number is present AND params.direccion is non-empty:
 *     the house number MUST appear as a token in params.direccion.
 *     Guards against ROOFTOP at a neighboring number.
 *
 * Compatible with old edge function (no metadata) → all results rejected until edge function
 * is updated. This is the safer behavior for a staggered deployment.
 */
export function validateGeoResult(
  result: GeocodeResult,
  params: Pick<GeocodeAddressParams, 'localidad' | 'cp' | 'direccion'>,
): boolean {
  // Rule 1: country must be Spain — fail if absent or wrong
  if (!result.country_code) return false;
  if (result.country_code.toUpperCase() !== 'ES') return false;

  // Rule 2: at least one territorial field must be present
  if (!result.locality?.trim() && !result.postal_code?.trim()) return false;

  // Rule 3: localidad must be verifiable when provided
  if (params.localidad?.trim()) {
    if (!result.locality?.trim()) return false; // can't validate localidad without returned locality
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const expected = norm(params.localidad);
    const got = norm(result.locality);
    if (!got.includes(expected) && !expected.includes(got)) return false;
  }

  // Rule 4: postal_code must match when both are present
  if (params.cp?.trim() && result.postal_code?.trim()) {
    if (result.postal_code.trim() !== params.cp.trim()) return false;
  }

  // Rule 5: when a street address was requested, require address-level precision.
  // Google (location_type present): only ROOFTOP accepted; all other types rejected.
  // Nominatim (no location_type): route must be identified.
  if (params.direccion?.trim()) {
    if (result.location_type) {
      if (result.location_type !== 'ROOFTOP') return false;
    } else {
      if (!result.route?.trim()) return false;
    }
  }

  // Rule 6: when provider returns a house number, it must appear as a token in the requested address.
  if (result.house_number?.trim() && params.direccion?.trim()) {
    const hn = result.house_number.trim();
    if (!params.direccion.split(/[\s,/\-]+/).includes(hn)) return false;
  }

  return true;
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
