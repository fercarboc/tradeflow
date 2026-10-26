/**
 * GeoSearchPicker — Modal de búsqueda geocodificada y confirmación de ubicación.
 *
 * Flujo:
 *   1. Input de dirección (pre-rellenado). Búsqueda solo al pulsar "Buscar".
 *   2. Lista de candidatos (si hay más de uno).
 *   3. Mapa de confirmación con marcador arrastrable.
 *   4. Botón "Confirmar" → llama onConfirm({lat, lng, display_name, geo_source}).
 *
 * Sin inner components. Todos los sub-componentes son funciones de módulo.
 * Sin autocomplete: Geoapify no admite peticiones por tecla desde este perfil.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, X, AlertTriangle, CheckCircle, Crosshair } from 'lucide-react';
import type { GeocodingCandidate, FunctionInvoker } from '../lib/geoApi';
import { geocodeAddress } from '../lib/geoApi';
import { geoValid } from '../lib/transportLocations';
import { CARTO_KEY, CARTO_URL, CARTO_ATTR } from '../lib/cartoConfig';

// ── Icono del marcador de confirmación ────────────────────────────────────────

const confirmIcon = new L.DivIcon({
  className: '',
  html: `<div style="
    width: 28px; height: 28px; border-radius: 50% 50% 50% 0;
    background: #3b82f6; border: 2px solid white;
    transform: rotate(-45deg); box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
});

// ── DragMarker — marcador arrastrable que actualiza coordenadas al soltar ──────

interface DragMarkerProps {
  lat:    number;
  lng:    number;
  onMove: (lat: number, lng: number) => void;
}

function DragMarker({ lat, lng, onMove }: DragMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  useMapEvents({});

  return (
    <Marker
      position={[lat, lng]}
      icon={confirmIcon}
      draggable
      ref={markerRef}
      eventHandlers={{
        dragend: () => {
          const pos = markerRef.current?.getLatLng();
          if (pos) onMove(pos.lat, pos.lng);
        },
      }}
    />
  );
}

// ── CandidateButton — un resultado de geocodificación ─────────────────────────

interface CandidateButtonProps {
  candidate: GeocodingCandidate;
  selected:  boolean;
  onClick:   () => void;
}

function CandidateButton({ candidate, selected, onClick }: CandidateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all cursor-pointer ${
        selected
          ? 'bg-blue-50 border-blue-300 text-blue-900'
          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-2">
        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
        <span className="leading-snug">{candidate.display_name}</span>
      </div>
      {candidate.confidence != null && (
        <span className="ml-5 text-[10px] text-slate-400 font-mono">
          confianza {Math.round(candidate.confidence * 100)}%
        </span>
      )}
    </button>
  );
}

// ── ConfirmMap — mapa pequeño con marcador arrastrable ────────────────────────

interface ConfirmMapProps {
  lat:    number;
  lng:    number;
  onMove: (lat: number, lng: number) => void;
}

function ConfirmMap({ lat, lng, onMove }: ConfirmMapProps) {
  if (!CARTO_KEY) {
    return (
      <div className="h-32 bg-slate-100 border border-slate-200 rounded-xl flex flex-col items-center justify-center gap-1">
        <MapPin className="w-6 h-6 text-slate-300" />
        <p className="text-xs text-slate-400">Mapa no disponible (sin clave CARTO)</p>
        <p className="text-xs font-mono text-slate-500">{lat.toFixed(6)}, {lng.toFixed(6)}</p>
      </div>
    );
  }

  return (
    <div className="h-48 rounded-xl overflow-hidden border border-slate-200">
      <MapContainer
        key={`${lat.toFixed(5)},${lng.toFixed(5)}`}
        center={[lat, lng]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        zoomControl
        scrollWheelZoom={false}
      >
        <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} />
        <DragMarker lat={lat} lng={lng} onMove={onMove} />
      </MapContainer>
    </div>
  );
}

// ── GeoSearchPicker — componente principal ────────────────────────────────────

export interface GeoSearchPickerResult {
  lat:          number;
  lng:          number;
  display_name: string;
  geo_source:   'confirmed' | 'manual';
}

interface Props {
  orgId:          string;
  initialAddress: string;
  onConfirm:      (result: GeoSearchPickerResult) => void;
  onCancel:       () => void;
  invoker?:       FunctionInvoker;
}

type PickerState = 'idle' | 'loading' | 'results' | 'confirming' | 'manual' | 'error';

export default function GeoSearchPicker({ orgId, initialAddress, onConfirm, onCancel, invoker }: Props) {
  const [query,       setQuery]      = useState(initialAddress);
  const [state,       setState]      = useState<PickerState>('idle');
  const [candidates,  setCandidates] = useState<GeocodingCandidate[]>([]);
  const [selected,    setSelected]   = useState<GeocodingCandidate | null>(null);
  const [confirmLat,  setConfirmLat] = useState(0);
  const [confirmLng,  setConfirmLng] = useState(0);
  const [errorMsg,    setErrorMsg]   = useState('');
  const [manualLat,   setManualLat]  = useState('');
  const [manualLng,   setManualLng]  = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setState('loading');
    setErrorMsg('');
    try {
      const result = await geocodeAddress(q, orgId, invoker);
      setCandidates(result.candidates);
      if (result.candidates.length === 0) {
        setState('error');
        setErrorMsg('No se encontraron resultados. Prueba con una dirección más específica.');
        return;
      }
      if (result.candidates.length === 1) {
        const c = result.candidates[0]!;
        setSelected(c);
        setConfirmLat(c.lat);
        setConfirmLng(c.lng);
        setState('confirming');
      } else {
        setState('results');
      }
    } catch (err) {
      setState('error');
      const msg = err instanceof Error ? err.message : 'Error desconocido';
      if (msg.includes('RATE_GLOBAL'))     setErrorMsg('Límite global alcanzado. Espera 1 segundo.');
      else if (msg.includes('RATE_ORG'))   setErrorMsg('Cuota diaria de la organización agotada.');
      else if (msg.includes('FORBIDDEN'))  setErrorMsg('Sin permiso para geocodificar.');
      else if (msg.includes('CONFIG'))     setErrorMsg('Servicio de mapas no configurado.');
      else                                 setErrorMsg(`Error: ${msg}`);
    }
  }, [query, orgId, invoker]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSearch(); }
  };

  const handleSelectCandidate = (c: GeocodingCandidate) => {
    setSelected(c);
    setConfirmLat(c.lat);
    setConfirmLng(c.lng);
    setState('confirming');
  };

  const handleConfirm = () => {
    if (!geoValid(confirmLat, confirmLng)) return;
    onConfirm({
      lat:          confirmLat,
      lng:          confirmLng,
      display_name: selected?.display_name ?? query,
      geo_source:   'confirmed',
    });
  };

  const handleManualConfirm = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (!geoValid(lat, lng)) {
      setErrorMsg('Coordenadas inválidas. Lat: -90 a 90, Lng: -180 a 180.');
      return;
    }
    onConfirm({ lat, lng, display_name: query || 'Coordenadas manuales', geo_source: 'manual' });
  };

  return (
    <div
      className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Localizar ubicación</h3>
          </div>
          <button type="button" onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Search input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Introduce la dirección o nombre del lugar"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={state === 'loading'}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={state === 'loading' || !query.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {state === 'loading'
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Search className="w-4 h-4" />
              }
              Buscar
            </button>
          </div>

          {/* Error */}
          {state === 'error' && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Candidate list */}
          {state === 'results' && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500">Selecciona el resultado correcto:</p>
              {candidates.map((c, i) => (
                <CandidateButton
                  key={i}
                  candidate={c}
                  selected={selected === c}
                  onClick={() => handleSelectCandidate(c)}
                />
              ))}
            </div>
          )}

          {/* Confirm map */}
          {state === 'confirming' && geoValid(confirmLat, confirmLng) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <p className="text-xs font-semibold text-slate-700">
                  Confirma la posición. Puedes arrastrar el marcador si necesitas ajustarla.
                </p>
              </div>
              <ConfirmMap
                lat={confirmLat}
                lng={confirmLng}
                onMove={(lat, lng) => { setConfirmLat(lat); setConfirmLng(lng); }}
              />
              <p className="text-[10px] font-mono text-slate-400 text-center">
                {confirmLat.toFixed(6)}, {confirmLng.toFixed(6)}
              </p>
              <div className="text-[10px] text-slate-400 text-center">
                Powered by Geoapify · © OpenStreetMap contributors
              </div>
            </div>
          )}

          {/* Manual entry */}
          {state === 'manual' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-600">Introducir coordenadas manualmente:</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase">Latitud</label>
                  <input
                    type="number" step="any" min="-90" max="90"
                    value={manualLat}
                    onChange={e => setManualLat(e.target.value)}
                    placeholder="43.4628"
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase">Longitud</label>
                  <input
                    type="number" step="any" min="-180" max="180"
                    value={manualLng}
                    onChange={e => setManualLng(e.target.value)}
                    placeholder="-3.8050"
                    className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {errorMsg && <p className="text-xs text-red-600">{errorMsg}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          <button
            type="button"
            onClick={() => { setState(s => s === 'manual' ? 'idle' : 'manual'); setErrorMsg(''); }}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Coordenadas manuales
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            {state === 'confirming' && (
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!geoValid(confirmLat, confirmLng)}
                className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Confirmar ubicación
              </button>
            )}
            {state === 'manual' && (
              <button
                type="button"
                onClick={handleManualConfirm}
                className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Usar estas coordenadas
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
