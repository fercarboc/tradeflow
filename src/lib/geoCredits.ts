/**
 * geoCredits — Cálculo de créditos Geoapify.
 *
 * Geocodificación: 1 crédito por petición.
 * Routing:
 *   - 1 crédito por cada par de waypoints consecutivos (segmentos)
 *   - + floor(distancia_m / 500_000) créditos de distancia
 *   - + 1 si route_details está activado
 *   - + 1 si elevation está activado
 *   - + 1 por cada regla avoid usada
 *
 * Fuente: apidocs.geoapify.com/docs/routing — verificado 2026-10-26.
 */

export function geocodeCredits(): number {
  return 1;
}

export interface RoutingCreditOptions {
  routeDetails?: boolean;
  elevation?:    boolean;
  avoidCount?:   number;
}

/**
 * Calcula créditos de una petición de routing.
 * waypointCount: número total de waypoints (origen + paradas + destino).
 * distanceM: distancia total en metros (disponible en la respuesta de la API).
 */
export function routingCredits(
  waypointCount: number,
  distanceM:     number,
  opts: RoutingCreditOptions = {}
): number {
  if (waypointCount < 2) return 0;
  const segments         = waypointCount - 1;
  const distanceSurcharge = Math.floor(distanceM / 500_000);
  const optionSurcharge  =
    (opts.routeDetails ? 1 : 0) +
    (opts.elevation    ? 1 : 0) +
    (opts.avoidCount ?? 0);
  return segments + distanceSurcharge + optionSurcharge;
}

/** Convierte coordenadas GeoJSON [lng, lat] a Leaflet [lat, lng]. */
export function geojsonToLeaflet(
  coordinates: ReadonlyArray<[number, number]>
): [number, number][] {
  return coordinates.map(([lng, lat]) => [lat, lng]);
}

/**
 * Genera la clave de caché para una ruta.
 * Preserva el orden de los waypoints — cambiar el orden cambia la ruta.
 * Redondea a 6 decimales (~0.1 m) para absorber ruido de representación flotante.
 */
export function routeCacheKey(
  waypoints: ReadonlyArray<{ lat: number; lng: number }>
): string {
  return JSON.stringify(
    waypoints.map(w => [
      Math.round(w.lat * 1e6) / 1e6,
      Math.round(w.lng * 1e6) / 1e6,
    ])
  );
}

/** Normaliza una dirección para geocodificación: trim, espacios, lowercase. */
export function normalizeAddressForSearch(address: string): string {
  return address.trim().replace(/\s+/g, ' ').toLowerCase();
}
