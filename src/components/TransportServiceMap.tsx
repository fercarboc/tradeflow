/**
 * TransportServiceMap — mapa de marcadores para un servicio de transporte de viajeros.
 * Usa CARTO + Leaflet. Sin polylines (no representamos líneas rectas como carreteras).
 * Si no hay coordenadas válidas, renderiza el fallback textual de itinerario.
 */

import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, AlertTriangle } from 'lucide-react';
import type { TradeTransportService } from '../lib/transportServices';
import { locationToText, locationToAddress } from '../lib/transportLocations';
import { CARTO_KEY, CARTO_URL, CARTO_ATTR } from '../lib/cartoConfig';

// ── Helpers ───────────────────────────────────────────────────────────────────

function geoValid(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GeoPoint {
  type: 'origin' | 'stop' | 'destination';
  index?: number;
  label: string;
  detail?: string;
  hora?: string;
  lat: number;
  lng: number;
}

interface TextWaypoint {
  type: 'origin' | 'stop' | 'destination';
  index?: number;
  label: string;
  address?: string;
  hora?: string;
}

// ── Leaflet custom icons ───────────────────────────────────────────────────────

function makeOriginIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#2563eb;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)">A</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

function makeStopIcon(n: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#475569;color:#fff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)">${n}</div>`,
    className: '', iconSize: [26, 26], iconAnchor: [13, 13],
  });
}

function makeDestIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="background:#059669;color:#fff;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.3)">B</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

// ── Leaflet child helpers ─────────────────────────────────────────────────────

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
    catch { /* invalid bounds guard */ }
  }, [map, points]);
  return null;
}

// ── Text itinerary (fallback when no map) ─────────────────────────────────────

function TextItinerary({ waypoints }: { waypoints: TextWaypoint[] }) {
  return (
    <div className="p-4 space-y-0">
      {waypoints.map((wp, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center pt-0.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 ${
              wp.type === 'origin' ? 'bg-blue-600' :
              wp.type === 'destination' ? 'bg-emerald-600' : 'bg-slate-500'}`}>
              {wp.type === 'origin' ? 'A' : wp.type === 'destination' ? 'B' : wp.index}
            </div>
            {i < waypoints.length - 1 && (
              <div className="w-0.5 bg-slate-200 my-1" style={{ minHeight: 20 }} />
            )}
          </div>
          <div className="pb-4 flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800 leading-tight">{wp.label}</span>
              {wp.hora && (
                <span className="text-xs font-mono text-slate-500 shrink-0 mt-0.5">{wp.hora}</span>
              )}
            </div>
            {wp.address && (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{wp.address}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface TransportServiceMapProps {
  service: TradeTransportService;
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TransportServiceMap({ service, className = '' }: TransportServiceMapProps) {
  // Count total location points (origin + every stop + destination)
  const totalLocations = 2 + service.paradas.length;

  // Build geo points (only those with valid coords)
  const geoPoints = useMemo<GeoPoint[]>(() => {
    const pts: GeoPoint[] = [];

    const od = service.origen_detalle;
    if (od && geoValid(od.lat, od.lng)) {
      const label = locationToText(od) || service.origen || 'Origen';
      const detail = locationToAddress(od);
      pts.push({ type: 'origin', label, detail: detail !== label ? detail : undefined, lat: od.lat!, lng: od.lng! });
    }

    service.paradas.forEach((p, i) => {
      const loc = p.location;
      if (loc && geoValid(loc.lat, loc.lng)) {
        const detail = locationToAddress(loc) || p.direccion || undefined;
        pts.push({ type: 'stop', index: i + 1, label: p.nombre, detail, hora: p.hora, lat: loc.lat!, lng: loc.lng! });
      }
    });

    const dd = service.destino_detalle;
    if (dd && geoValid(dd.lat, dd.lng)) {
      const label = locationToText(dd) || service.destino || 'Destino';
      const detail = locationToAddress(dd);
      pts.push({ type: 'destination', label, detail: detail !== label ? detail : undefined, lat: dd.lat!, lng: dd.lng! });
    }

    return pts;
  }, [service]);

  // Build text waypoints for fallback or "always-shown" itinerary
  const textWaypoints = useMemo<TextWaypoint[]>(() => {
    const wps: TextWaypoint[] = [];

    const od = service.origen_detalle;
    const oLabel = (od ? locationToText(od) : null) || service.origen || 'Sin origen';
    const oAddr  = od ? locationToAddress(od) : service.origen || undefined;
    wps.push({ type: 'origin', label: oLabel, address: oAddr !== oLabel ? oAddr : undefined });

    service.paradas.forEach((p, i) => {
      const loc = p.location;
      const addr = loc ? locationToAddress(loc) : p.direccion || undefined;
      wps.push({ type: 'stop', index: i + 1, label: p.nombre, address: addr, hora: p.hora });
    });

    const dd = service.destino_detalle;
    const dLabel = (dd ? locationToText(dd) : null) || service.destino || 'Sin destino';
    const dAddr  = dd ? locationToAddress(dd) : service.destino || undefined;
    wps.push({ type: 'destination', label: dLabel, address: dAddr !== dLabel ? dAddr : undefined });

    return wps;
  }, [service]);

  const allPoints = useMemo<[number, number][]>(() => geoPoints.map(p => [p.lat, p.lng]), [geoPoints]);
  const missingGeo = totalLocations - geoPoints.length;

  // CARTO key missing
  if (!CARTO_KEY) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
        <div className="h-28 flex flex-col items-center justify-center gap-1.5">
          <MapPin className="w-7 h-7 text-slate-300" />
          <p className="text-xs text-slate-400 font-semibold">Mapa no disponible</p>
          <p className="text-[10px] text-slate-400">Configura VITE_CARTO_BASEMAP_API_KEY</p>
        </div>
        <div className="border-t border-slate-100">
          <TextItinerary waypoints={textWaypoints} />
        </div>
      </div>
    );
  }

  // No valid coordinates — show text itinerary only
  if (geoPoints.length === 0) {
    return (
      <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/70">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-500">Itinerario</span>
          <span className="ml-auto text-[10px] text-slate-400">Sin coordenadas — vista textual</span>
        </div>
        <TextItinerary waypoints={textWaypoints} />
      </div>
    );
  }

  // Map with valid points
  return (
    <div className={`bg-white border border-slate-200 rounded-xl overflow-hidden ${className}`}>
      <div className="relative" style={{ height: 260 }}>
        <MapContainer
          center={allPoints[0]!}
          zoom={12}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          zoomControl
        >
          <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} />
          <MapBoundsFitter points={allPoints} />
          <MapSizeInvalidator />
          {geoPoints.map((pt, i) => (
            <Marker
              key={i}
              position={[pt.lat, pt.lng]}
              icon={pt.type === 'origin' ? makeOriginIcon() : pt.type === 'destination' ? makeDestIcon() : makeStopIcon(pt.index!)}
            >
              <Popup>
                <strong className="text-xs text-slate-800">
                  {pt.type === 'origin' ? 'Origen' : pt.type === 'destination' ? 'Destino' : `Parada ${pt.index}`}
                  {' — '}{pt.label}
                </strong>
                {pt.hora && <div className="text-xs text-slate-600 mt-0.5">{pt.hora}</div>}
                {pt.detail && <div className="text-xs text-slate-500 mt-0.5">{pt.detail}</div>}
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {missingGeo > 0 && (
          <div className="absolute bottom-2 left-2 right-2 bg-amber-50/90 backdrop-blur-sm border border-amber-200 rounded-xl px-3 py-1.5 flex items-center gap-2" style={{ zIndex: 1000 }}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <p className="text-[10px] text-amber-700">
              {missingGeo} ubicación{missingGeo > 1 ? 'es' : ''} sin coordenadas no aparece{missingGeo > 1 ? 'n' : ''} en el mapa
            </p>
          </div>
        )}
      </div>

      {/* Text itinerary below map — always useful for times and addresses */}
      <div className="border-t border-slate-100">
        <TextItinerary waypoints={textWaypoints} />
      </div>
    </div>
  );
}
