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

/**
 * Techo conservador de suplemento de distancia por ruta.
 * Cubre hasta 4 000 km totales (floor(4000/500) = 8) — suficiente
 * para cualquier ruta de transporte terrestre en España.
 * Se usa para la reserva previa a la llamada a Geoapify cuando la
 * distancia real aún no se conoce.
 */
export const MAX_DISTANCE_SURCHARGE_CAP = 8;

/**
 * Créditos a reservar ANTES de llamar a Geoapify (coste máximo garantizado).
 * = segmentos + MAX_DISTANCE_SURCHARGE_CAP
 * La diferencia (reserva - real) se libera en geo_reconcile tras la respuesta.
 */
export function routeReservationCredits(waypointCount: number): number {
  if (waypointCount < 2) return 0;
  return (waypointCount - 1) + MAX_DISTANCE_SURCHARGE_CAP;
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

const EARTH_RADIUS_KM = 6371;

/** Distancia en km entre dos puntos lat/lng (fórmula de Haversine). */
export function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Suma de distancias en línea recta entre waypoints consecutivos (km). */
export function totalRouteHaversineKm(
  waypoints: ReadonlyArray<{ lat: number; lng: number }>,
): number {
  if (waypoints.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += haversineKm(
      waypoints[i].lat,     waypoints[i].lng,
      waypoints[i + 1].lat, waypoints[i + 1].lng,
    );
  }
  return total;
}

/**
 * Distancia máxima en línea recta (km) que garantiza que el coste por
 * carretera no supera MAX_DISTANCE_SURCHARGE_CAP.
 * Factor carretera ≈ 1.3 → 4 000 km / 1.3 ≈ 3 077 km. Límite: 3 000 km.
 */
export const MAX_ROUTE_STRAIGHT_KM = 3000;

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
