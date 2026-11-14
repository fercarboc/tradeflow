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
  provider?: 'google' | 'nominatim' | 'geoapify';
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
  orgId?: string | null,
): Promise<GeocodeResult | null> {
  const hasEnough = !!(params.direccion || params.localidad || params.cp);
  if (!hasEnough) return null;

  // Primero el geocodificador de Transporte (Geoapify, con caché por empresa), que encuentra
  // mejor las direcciones con número. Si no está disponible (p. ej. técnico sin permiso) o no
  // encuentra nada, se usa el de siempre.
  if (orgId) {
    try {
      const r = await geocodeWithGeoapify(params, orgId);
      if (r) return r;
    } catch { /* se usa el geocodificador de respaldo */ }
  }

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

// ── Geoapify (función `geocode`, la misma que usan las rutas de Transporte) ─────

function norm(t: string): string {
  return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

/** Número de portal: último número suelto de la dirección («Canalejas, 91» → «91»). */
function portalDe(direccion: string): string | null {
  const m = direccion.match(/\b(\d+)\s*[a-zA-Z]?\s*(?:[,º°ª]|$|\s)/g);
  if (!m) return null;
  const last = m[m.length - 1].match(/\d+/);
  return last ? last[0] : null;
}

async function geocodeWithGeoapify(params: GeocodeAddressParams, orgId: string): Promise<GeocodeResult | null> {
  const address = [params.direccion, params.cp, params.localidad, params.provincia, params.pais ?? 'España']
    .map(x => (x ?? '').trim()).filter(Boolean).join(', ');
  const { data, error } = await supabase.functions.invoke<{
    candidates?: Array<{ lat: number; lng: number; display_name: string }>;
    error?: string;
  }>('geocode', { body: { address, org_id: orgId } });
  if (error || !data || data.error) return null;
  const c = data.candidates?.[0];
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return null;

  // Metadatos a partir del texto devuelto, para que validateGeoResult pueda comprobar
  // que el resultado corresponde a lo pedido (solo se rellenan si aparecen en la respuesta).
  const shown = norm(c.display_name ?? '');
  const loc = params.localidad?.trim();
  const cp = params.cp?.trim();
  const dir = params.direccion?.trim() ?? '';
  const calle = norm(dir.replace(/\d.*$/, '').replace(/^(c\/|calle|avda\.?|avenida|plaza|pza\.?|paseo|ctra\.?)\s+/i, '').replace(/[,.]/g, ' '));
  const portal = dir ? portalDe(dir) : null;
  return {
    latitud: c.lat,
    longitud: c.lng,
    formatted_address: c.display_name ?? '',
    provider: 'geoapify',
    country_code: 'ES', // la función restringe la búsqueda a España
    locality: loc && shown.includes(norm(loc)) ? loc : undefined,
    postal_code: cp && shown.includes(cp) ? cp : undefined,
    route: calle && shown.includes(calle) ? calle : undefined,
    house_number: portal && new RegExp(`\\b${portal}\\b`).test(shown) ? portal : undefined,
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
 *  6. If params.direccion contains a portal number (rightmost standalone digit token):
 *     - result.house_number MUST be present (provider must have identified the door).
 *     - result.house_number leading digits MUST equal the requested portal.
 *     ROOFTOP without a confirmed house_number is insufficient when a portal was given.
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

  // Rule 6: when params.direccion contains a portal number, the provider must return a
  // matching house_number. A result that found the street but not the specific door is
  // rejected — ROOFTOP at an unverified address is not sufficient.
  //
  // Portal detection: find the rightmost standalone numeric token in the address.
  //   "Calle Mayor 1"       → portal "1"
  //   "Calle Mayor 5B"      → portal "5"  (leading digits of token)
  //   "Barrio La Lomba"     → null (no trailing number — skips Rule 6)
  //   "Calle del 5 de Oct"  → null ("5" is not the rightmost token since "Oct" follows)
  if (params.direccion?.trim()) {
    const tokens = params.direccion.trim().split(/\s+/);
    let portalRequested: string | null = null;
    for (let i = tokens.length - 1; i >= 0; i--) {
      const m = tokens[i].match(/^(\d+)[A-Za-z]?$/);
      if (m) { portalRequested = m[1]; break; }
    }
    if (portalRequested !== null) {
      if (!result.house_number?.trim()) return false; // provider didn't identify the door
      const resultPortal = result.house_number.trim().match(/^(\d+)/)?.[1] ?? '';
      if (resultPortal !== portalRequested) return false; // wrong door
    }
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
