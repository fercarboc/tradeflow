/**
 * geoProviders — Interfaces de proveedor intercambiables para geocodificación y routing.
 * La implementación de Geoapify es la única activa. Para migrar a otro proveedor,
 * implementar las interfaces y cambiar la variable de entorno GEOCODING_PROVIDER.
 */

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface GeocodingCandidate {
  lat:          number;
  lng:          number;
  display_name: string;
  confidence?:  number;   // 0–1 si el proveedor lo devuelve
}

export interface GeocodingOptions {
  countrycodes?: string[];
  limit?:        number;
  language?:     string;
}

export interface GeocodingProvider {
  name: string;
  geocode(address: string, opts?: GeocodingOptions): Promise<GeocodingCandidate[]>;
}

export interface RouteWaypoint {
  lat: number;
  lng: number;
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat] pairs (GeoJSON standard)
}

export interface RouteResult {
  geometry:   GeoJSONLineString;
  distance_m: number;
  duration_s: number;
  provider:   string;
}

export interface RoutingProvider {
  name: string;
  route(waypoints: RouteWaypoint[], profile?: string): Promise<RouteResult | null>;
}

// ── Geoapify implementation ───────────────────────────────────────────────────

const GEOAPIFY_GEOCODE_URL  = 'https://api.geoapify.com/v1/geocode/search';
const GEOAPIFY_ROUTING_URL  = 'https://api.geoapify.com/v1/routing';

export class GeoapifyGeocodingProvider implements GeocodingProvider {
  readonly name = 'geoapify';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async geocode(address: string, opts?: GeocodingOptions): Promise<GeocodingCandidate[]> {
    const params = new URLSearchParams({
      text:   address,
      lang:   opts?.language ?? 'es',
      limit:  String(opts?.limit ?? 5),
      format: 'json',
      apiKey: this.apiKey,
    });
    if (opts?.countrycodes?.length) {
      params.set('filter', `countrycode:${opts.countrycodes.join(',')}`);
    }

    const res = await fetch(`${GEOAPIFY_GEOCODE_URL}?${params}`);
    if (!res.ok) {
      if (res.status === 402) throw new Error('GEO_QUOTA_EXCEEDED');
      if (res.status === 429) throw new Error('GEO_RATE_LIMITED');
      if (res.status === 401) throw new Error('GEO_AUTH_FAILED');
      throw new Error(`GEO_HTTP_${res.status}`);
    }

    const body = await res.json() as {
      results?: Array<{
        lat: number; lon: number;
        formatted: string;
        rank?: { confidence?: number };
      }>;
    };

    return (body.results ?? []).map(r => ({
      lat:          r.lat,
      lng:          r.lon,
      display_name: r.formatted,
      confidence:   r.rank?.confidence,
    }));
  }
}

export class GeoapifyRoutingProvider implements RoutingProvider {
  readonly name = 'geoapify';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async route(waypoints: RouteWaypoint[], profile = 'bus'): Promise<RouteResult | null> {
    if (waypoints.length < 2) return null;

    const waypointsParam = waypoints
      .map(w => `${w.lat},${w.lng}`)
      .join('|');

    const params = new URLSearchParams({
      waypoints: waypointsParam,
      mode:      profile,
      apiKey:    this.apiKey,
    });

    const res = await fetch(`${GEOAPIFY_ROUTING_URL}?${params}`);
    if (!res.ok) {
      if (res.status === 402) throw new Error('GEO_QUOTA_EXCEEDED');
      if (res.status === 429) throw new Error('GEO_RATE_LIMITED');
      if (res.status === 401) throw new Error('GEO_AUTH_FAILED');
      throw new Error(`GEO_HTTP_${res.status}`);
    }

    const body = await res.json() as {
      features?: Array<{
        geometry: { type: string; coordinates: [number, number][] };
        properties: { distance?: number; time?: number };
      }>;
    };

    const feature = body.features?.[0];
    if (!feature) return null;

    return {
      geometry:   feature.geometry as GeoJSONLineString,
      distance_m: Math.round(feature.properties.distance ?? 0),
      duration_s: Math.round(feature.properties.time ?? 0),
      provider:   this.name,
    };
  }
}
