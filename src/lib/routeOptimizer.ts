/**
 * routeOptimizer.ts
 * Helpers de optimización de ruta diaria y generación de URLs de Google Maps.
 * Sin dependencias externas — usa únicamente la fórmula de Haversine para
 * calcular distancias entre coordenadas geográficas.
 */

import type { TradeJob } from './supabase';

// ── Tipos públicos ─────────────────────────────────────────────────────────────

export interface GeoLocation {
  lat: number;
  lng: number;
  label?: string;
}

export interface RouteJob extends TradeJob {
  orden_ruta: number;
}

// Pesos de prioridad: menor número = se ejecuta antes.
const PRIORITY_ORDER: Record<TradeJob['prioridad'], number> = {
  urgente: 0,
  alta:    1,
  normal:  2,
  baja:    3,
};

// ── Fórmula de Haversine ───────────────────────────────────────────────────────

/** Devuelve la distancia en kilómetros entre dos puntos geográficos. */
export function haversineKm(a: GeoLocation, b: GeoLocation): number {
  const R = 6371; // radio medio de la Tierra en km
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.asin(Math.sqrt(h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

// ── Optimización de ruta ───────────────────────────────────────────────────────

/**
 * Ordena los trabajos del día usando una heurística "nearest neighbor":
 *
 * 1. Los trabajos URGENTES se colocan siempre al principio, ordenados por
 *    cercanía al punto de salida.
 * 2. El resto se recorre desde el último punto visitado buscando el vecino
 *    más cercano con coordenadas disponibles.
 * 3. Los trabajos sin coordenadas se añaden al final, respetando su
 *    prioridad relativa entre ellos.
 *
 * @param jobs          Trabajos del día (cualquier orden).
 * @param startLocation Coordenadas de inicio del técnico / empresa.
 * @returns             Array ordenado con `orden_ruta` asignado (1-based).
 */
export function optimizeDailyRoute(
  jobs: TradeJob[],
  startLocation: GeoLocation,
): RouteJob[] {
  if (jobs.length === 0) return [];

  // Separa trabajos con y sin coordenadas
  const withCoords  = jobs.filter(j => j.latitud != null && j.longitud != null);
  const noCoords    = jobs.filter(j => j.latitud == null || j.longitud == null);

  // ── Fase 1: urgentes geolocalizable primero ──────────────────────────────
  const urgentWithCoords  = withCoords.filter(j => j.prioridad === 'urgente');
  const restWithCoords    = withCoords.filter(j => j.prioridad !== 'urgente');

  const orderedUrgents = nearestNeighbor(urgentWithCoords, startLocation);
  const lastAfterUrgents =
    orderedUrgents.length > 0
      ? toGeo(orderedUrgents[orderedUrgents.length - 1])!
      : startLocation;

  // ── Fase 2: resto con coordenadas, nearest neighbor ──────────────────────
  const orderedRest = nearestNeighbor(restWithCoords, lastAfterUrgents);

  // ── Fase 3: sin coordenadas, ordenados por prioridad ─────────────────────
  const orderedNoCoords = [...noCoords].sort(
    (a, b) => PRIORITY_ORDER[a.prioridad] - PRIORITY_ORDER[b.prioridad],
  );

  // ── Combina y asigna orden_ruta ───────────────────────────────────────────
  const ordered = [...orderedUrgents, ...orderedRest, ...orderedNoCoords];
  return ordered.map((job, i) => ({ ...job, orden_ruta: i + 1 }) as RouteJob);
}

/** Nearest-neighbor greedy sobre una lista de trabajos con coordenadas. */
function nearestNeighbor(jobs: TradeJob[], from: GeoLocation): TradeJob[] {
  const remaining = [...jobs];
  const route: TradeJob[] = [];
  let current = from;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const geo = toGeo(remaining[i]);
      if (!geo) continue; // seguridad extra
      const d = haversineKm(current, geo);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }

    const next = remaining.splice(nearestIdx, 1)[0];
    route.push(next);
    current = toGeo(next) ?? current;
  }

  return route;
}

/** Extrae GeoLocation de un TradeJob, o null si no tiene coordenadas. */
function toGeo(job: TradeJob): GeoLocation | null {
  if (job.latitud == null || job.longitud == null) return null;
  return { lat: job.latitud, lng: job.longitud, label: job.titulo };
}

// ── URL de Google Maps ─────────────────────────────────────────────────────────

/**
 * Construye una URL de Google Maps con waypoints para toda la ruta.
 *
 * Formato: https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...
 *
 * @param jobs          Trabajos ya ordenados (con orden_ruta asignado).
 * @param origin        Dirección o coordenadas de inicio.
 * @param destination   Dirección o coordenadas de destino final (opcional;
 *                      si se omite, el último trabajo actúa como destino).
 */
export function buildGoogleMapsUrl(
  jobs: TradeJob[],
  origin: string | GeoLocation,
  destination?: string | GeoLocation,
): string {
  const BASE = 'https://www.google.com/maps/dir/?api=1';

  const encodePoint = (p: string | GeoLocation): string =>
    typeof p === 'string'
      ? encodeURIComponent(p)
      : encodeURIComponent(`${p.lat},${p.lng}`);

  // Construye la cadena de dirección de un trabajo: prioriza coords, luego texto
  const jobToPoint = (j: TradeJob): string | null => {
    if (j.latitud != null && j.longitud != null) return `${j.latitud},${j.longitud}`;
    const parts = [j.direccion, j.localidad, j.cp].filter(Boolean).join(', ');
    return parts || null;
  };

  const points = jobs.map(jobToPoint).filter((p): p is string => p !== null);
  if (points.length === 0) return BASE + `&origin=${encodePoint(origin)}`;

  const dest = destination
    ? encodePoint(destination)
    : encodeURIComponent(points[points.length - 1]);

  const waypoints =
    points.length > 1
      ? '&waypoints=' + points.slice(0, -1).map(encodeURIComponent).join('|')
      : '';

  return `${BASE}&origin=${encodePoint(origin)}&destination=${dest}${waypoints}&travelmode=driving`;
}

/**
 * Estima el tiempo total de la ruta en minutos:
 * suma de duraciones de cada trabajo + 15 min de desplazamiento entre paradas.
 */
export function estimateRouteDuration(jobs: TradeJob[]): number {
  const TRAVEL_MIN_PER_STOP = 15;
  const workMinutes = jobs.reduce(
    (acc, j) => acc + (j.duracion_horas ?? 1) * 60,
    0,
  );
  const travelMinutes = Math.max(0, jobs.length - 1) * TRAVEL_MIN_PER_STOP;
  return workMinutes + travelMinutes;
}
