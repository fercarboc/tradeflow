/**
 * TripRouteMap — mapa A→B para viajes de mercancías.
 * Reutiliza la misma infraestructura Leaflet+CARTO+Geoapify que TransportServiceMap.
 * Solo origen y destino (sin paradas). Perfil de ruta configurable ('truck' por defecto).
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Route, Loader2, Truck } from 'lucide-react';
import { routeWaypoints, formatDuration, formatDistance } from '../lib/geoApi';
import type { RouteResult, RoutingProfile } from '../lib/geoApi';
import { geometryToLeaflet } from '../lib/geoCredits';
import type { TransportLocation } from '../lib/transportLocations';
import { locationToText, locationToAddress, geoValid } from '../lib/transportLocations';
import { CARTO_KEY, CARTO_URL, CARTO_ATTR } from '../lib/cartoConfig';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TripRouteMapProps {
  origen:          string;
  destino:         string;
  origenDetalle?:  TransportLocation | null;
  destinoDetalle?: TransportLocation | null;
  orgId?:          string;
  /** 'truck' para mercancías/mixto, 'light_truck' para reparto, 'bus' para viajeros */
  routingProfile?: RoutingProfile;
  className?:      string;
}

// ── Leaflet helpers (misma lógica que TransportServiceMap) ────────────────────

function makeOriginIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#2563eb;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)">A</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

function makeDestIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#059669;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)">B</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

function MapSizeInvalidator() {
  const map = useMap();
  useEffect(() => { map.invalidateSize(); }, [map]);
  return null;
}

function MapBoundsFitter({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView(points[0], 14); return; }
    try { map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 15 }); }
    catch { /* invalid bounds */ }
  }, [map, points]);
  return null;
}

// ── Itinerario textual A→B ────────────────────────────────────────────────────

function TextAB({ oLabel, dLabel, oAddr, dAddr }: {
  oLabel: string; dLabel: string; oAddr?: string; dAddr?: string;
}) {
  return (
    <div className="p-4 space-y-0">
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-0.5">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-black text-white shrink-0">A</div>
          <div className="w-0.5 bg-slate-200 my-1" style={{ minHeight: 24 }} />
        </div>
        <div className="pb-4 flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-800">{oLabel}</span>
          {oAddr && oAddr !== oLabel && <p className="text-xs text-slate-500 mt-0.5">{oAddr}</p>}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="flex items-start pt-0.5">
          <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-black text-white shrink-0">B</div>
        </div>
        <div className="pb-2 flex-1 min-w-0">
          <span className="text-sm font-semibold text-slate-800">{dLabel}</span>
          {dAddr && dAddr !== dLabel && <p className="text-xs text-slate-500 mt-0.5">{dAddr}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function TripRouteMap({
  origen,
  destino,
  origenDetalle,
  destinoDetalle,
  orgId,
  routingProfile = 'truck',
  className = '',
}: TripRouteMapProps) {
  const [routeResult,  setRouteResult]  = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError,   setRouteError]   = useState('');

  const oLat = origenDetalle?.lat;
  const oLng = origenDetalle?.lng;
  const dLat = destinoDetalle?.lat;
  const dLng = destinoDetalle?.lng;
  const hasOriginCoords = geoValid(oLat, oLng);
  const hasDestCoords   = geoValid(dLat, dLng);

  const handleLoadRoute = useCallback(async () => {
    if (!orgId || !hasOriginCoords || !hasDestCoords) return;
    setRouteLoading(true);
    setRouteError('');
    try {
      const result = await routeWaypoints(
        [{ lat: oLat!, lng: oLng! }, { lat: dLat!, lng: dLng! }],
        orgId,
        undefined,
        routingProfile,
      );
      setRouteResult(result);
      if (!result) setRouteError('No se pudo calcular la ruta.');
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : 'Error al calcular la ruta');
    } finally {
      setRouteLoading(false);
    }
  }, [orgId, oLat, oLng, dLat, dLng, hasOriginCoords, hasDestCoords, routingProfile]);

  const routePolyline = useMemo<[number, number][] | null>(() => {
    if (!routeResult) return null;
    return geometryToLeaflet(routeResult.geometry);
  }, [routeResult]);

  const allPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] = [];
    if (hasOriginCoords) pts.push([oLat!, oLng!]);
    if (hasDestCoords)   pts.push([dLat!, dLng!]);
    return pts;
  }, [hasOriginCoords, hasDestCoords, oLat, oLng, dLat, dLng]);

  const oLabel = (origenDetalle ? locationToText(origenDetalle) : null) || origen || 'Origen';
  const dLabel = (destinoDetalle ? locationToText(destinoDetalle) : null) || destino || 'Destino';
  const oAddr  = origenDetalle ? locationToAddress(origenDetalle) : undefined;
  const dAddr  = destinoDetalle ? locationToAddress(destinoDetalle) : undefined;

  // ── Sin API key CARTO ─────────────────────────────────────────────────────
  if (!CARTO_KEY) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
        <div className="h-24 flex flex-col items-center justify-center gap-1.5">
          <MapPin className="w-6 h-6 text-slate-300" />
          <p className="text-xs text-slate-400 font-semibold">Mapa no disponible</p>
          <p className="text-[10px] text-slate-400">Configura VITE_CARTO_BASEMAP_API_KEY</p>
        </div>
        <div className="border-t border-slate-100">
          <TextAB oLabel={oLabel} dLabel={dLabel} oAddr={oAddr} dAddr={dAddr} />
        </div>
      </div>
    );
  }

  // ── Sin coordenadas: itinerario textual ───────────────────────────────────
  if (allPoints.length < 2) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500">Itinerario</span>
          <span className="ml-auto text-[10px] text-slate-400">
            Localiza el origen y destino para ver el mapa
          </span>
        </div>
        <TextAB oLabel={oLabel} dLabel={dLabel} oAddr={oAddr} dAddr={dAddr} />
      </div>
    );
  }

  // ── Mapa con marcadores A/B ───────────────────────────────────────────────
  const canRequestRoute = !!(orgId && allPoints.length === 2 && !routeResult && !routeLoading);
  const profileLabel = routingProfile === 'light_truck' ? 'Furgoneta' : 'Camión';

  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      {/* Barra de ruta */}
      {(routeResult || routeLoading || routeError || canRequestRoute) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 bg-slate-50/70 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {routeResult && (
              <span className="text-[11px] text-slate-600 font-semibold">
                {formatDistance(routeResult.distance_m)} · {formatDuration(routeResult.duration_s)}
              </span>
            )}
            {routeResult?.profile_warning && (
              <span className="text-[10px] text-amber-600 ml-1" title={routeResult.profile_warning}>
                ⚠ Verificar restricciones
              </span>
            )}
            {routeLoading && (
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                Calculando ruta...
              </span>
            )}
            {routeError && !routeLoading && (
              <span className="text-[11px] text-red-600 truncate">{routeError}</span>
            )}
            {routeResult && (
              <span className="text-[10px] text-slate-400 ml-1">Powered by Geoapify · © OpenStreetMap</span>
            )}
          </div>
          {canRequestRoute && (
            <button
              type="button"
              onClick={handleLoadRoute}
              className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 hover:text-amber-800 border border-amber-200 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 transition-colors shrink-0 cursor-pointer"
            >
              <Route className="w-3 h-3" />
              Ver ruta ({profileLabel})
            </button>
          )}
          {routeError && !routeLoading && !routeResult && (
            <button
              type="button"
              onClick={handleLoadRoute}
              className="text-[11px] text-amber-600 hover:underline shrink-0 cursor-pointer"
            >
              Reintentar
            </button>
          )}
        </div>
      )}

      {/* Mapa Leaflet */}
      <div className="relative" style={{ height: 260 }}>
        <MapContainer
          center={allPoints[0]}
          zoom={12}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} />
          <MapBoundsFitter points={allPoints} />
          <MapSizeInvalidator />
          {routePolyline && (
            <Polyline
              positions={routePolyline}
              pathOptions={{ color: '#d97706', weight: 4, opacity: 0.8 }}
            />
          )}
          {hasOriginCoords && (
            <Marker position={[oLat!, oLng!]} icon={makeOriginIcon()}>
              <Popup>
                <strong className="text-xs text-slate-800">Origen — {oLabel}</strong>
                {oAddr && oAddr !== oLabel && <div className="text-xs text-slate-500 mt-0.5">{oAddr}</div>}
              </Popup>
            </Marker>
          )}
          {hasDestCoords && (
            <Marker position={[dLat!, dLng!]} icon={makeDestIcon()}>
              <Popup>
                <strong className="text-xs text-slate-800">Destino — {dLabel}</strong>
                {dAddr && dAddr !== dLabel && <div className="text-xs text-slate-500 mt-0.5">{dAddr}</div>}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </div>
    </div>
  );
}
