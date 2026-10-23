import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertTriangle } from 'lucide-react';
import type { RouteJob, GeoLocation } from '../lib/routeOptimizer';
import type { TradeJob } from '../lib/supabase';
import { CARTO_KEY, CARTO_URL, CARTO_ATTR } from '../lib/cartoConfig';

const ESTADO_DONE: Set<TradeJob['estado']> = new Set(['completado', 'cancelado']);

// ── Coordinate validation ─────────────────────────────────────────────────────
/** Returns true only for numeric, finite, in-range lat/lng pairs. */
export function isValidLatLng(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    lat != null && lng != null &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
}

// ── Custom div icons (numbered markers, no default Leaflet image URLs needed) ─
function createNumberedIcon(n: number, done: boolean): L.DivIcon {
  const bg = done ? '#10b981' : '#3b82f6';
  const html = `<div style="background:${bg};color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">${n}</div>`;
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
}

function createStartIcon(): L.DivIcon {
  const html = `<div style="background:#1d4ed8;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)">&#9654;</div>`;
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
}

// ── Child: calls invalidateSize after mount so Leaflet knows container dimensions ─
function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

// ── Child: fits map bounds whenever the point set changes ─────────────────────
function MapBoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    try {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 });
    } catch {
      // invalid bounds guard — no-op
    }
  }, [map, points]);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface RouteMapProps {
  routeJobs: RouteJob[];
  startLocation: string | GeoLocation;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RouteMap({ routeJobs, startLocation, className = '' }: RouteMapProps) {
  const geoJobs = useMemo(
    () => routeJobs.filter(j => isValidLatLng(j.latitud, j.longitud)),
    [routeJobs],
  );

  const startGeo = useMemo<GeoLocation | null>(() => {
    if (typeof startLocation === 'string') return null;
    if (!isValidLatLng(startLocation.lat, startLocation.lng)) return null;
    return startLocation;
  }, [startLocation]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = geoJobs.map(j => [j.latitud!, j.longitud!]);
    if (startGeo) pts.unshift([startGeo.lat, startGeo.lng]);
    return pts;
  }, [geoJobs, startGeo]);

  // allPoints[0] is always defined here (guarded by the allPoints.length === 0 early return below)
  const noGeoCount = routeJobs.length - geoJobs.length;

  if (routeJobs.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-2xl ${className}`}>
        <MapPin className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-xs text-slate-400 font-semibold">Sin trabajos en el mapa</p>
      </div>
    );
  }

  if (!CARTO_KEY) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-2xl ${className}`}>
        <MapPin className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-xs text-slate-400 font-semibold">Mapa no disponible</p>
        <p className="text-[10px] text-slate-400 mt-1">Configura VITE_CARTO_BASEMAP_API_KEY</p>
      </div>
    );
  }

  // No valid coordinates at all (no geocoded jobs and no geocoded start): never center on a default city
  if (allPoints.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-slate-100 rounded-2xl gap-1 ${className}`}>
        <MapPin className="w-8 h-8 text-slate-300 mb-1" />
        <p className="text-xs text-slate-400 font-semibold text-center px-4">Sin ubicaciones geolocalizadas</p>
        <p className="text-[10px] text-slate-400 text-center px-4">Edita los trabajos en Planificación para añadir su dirección</p>
      </div>
    );
  }

  const defaultCenter: [number, number] = allPoints[0]!;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`}>
      <MapContainer
        center={defaultCenter}
        zoom={12}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
        zoomControl
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} />
        <MapBoundsFitter points={allPoints} />
        <MapSizeInvalidator />

        {startGeo && (
          <Marker position={[startGeo.lat, startGeo.lng]} icon={createStartIcon()}>
            <Popup>
              <strong className="text-xs">Inicio</strong>
              <div className="text-xs text-slate-500">{startGeo.label ?? 'Punto de partida'}</div>
            </Popup>
          </Marker>
        )}

        {geoJobs.map(job => (
          <Marker
            key={job.id}
            position={[job.latitud!, job.longitud!]}
            icon={createNumberedIcon(job.orden_ruta, ESTADO_DONE.has(job.estado))}
          >
            <Popup>
              <strong className="text-xs text-slate-800">{job.titulo}</strong>
              {job.trade_clients?.nombre && (
                <div className="text-xs text-slate-600">{job.trade_clients.nombre}</div>
              )}
              {job.direccion && (
                <div className="text-xs text-slate-500">
                  {[job.direccion, job.localidad].filter(Boolean).join(', ')}
                </div>
              )}
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {noGeoCount > 0 && (
        <div
          className="absolute bottom-2 left-2 right-2 bg-amber-50/90 backdrop-blur-sm border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-2"
          style={{ zIndex: 1000 }}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <p className="text-[10px] text-amber-700">
            {noGeoCount} trabajo{noGeoCount > 1 ? 's' : ''} sin coordenadas no aparecen en el mapa
          </p>
        </div>
      )}
    </div>
  );
}
