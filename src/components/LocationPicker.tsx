import { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, X, Check, Loader2, AlertTriangle } from 'lucide-react';
import { isValidLatLng } from './RouteMap';
import { CARTO_KEY, CARTO_URL, CARTO_ATTR } from '../lib/cartoConfig';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface LocationPickerProps {
  /** Dirección o nombre descriptivo mostrado en el encabezado. */
  addressLabel: string;
  /** Coordenadas iniciales — si son válidas se pre-seleccionan en el marcador. */
  initialLat?: number | null;
  initialLng?: number | null;
  /** Callback al confirmar. El componente gestiona el estado de guardado. */
  onConfirm: (lat: number, lng: number) => Promise<void>;
  /** Callback al cancelar — no escribe nada. */
  onCancel: () => void;
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** Centro geográfico de la Península Ibérica — usado cuando no hay coordenadas iniciales. */
const SPAIN_CENTER: [number, number] = [40.4, -3.5];
const ZOOM_INITIAL = 15;
const ZOOM_EMPTY   = 6;

// ── Icono del marcador de selección ──────────────────────────────────────────

function createPickerIcon(): L.DivIcon {
  const html = `<div style="width:28px;height:28px;background:#7c3aed;border:3px solid white;border-radius:50%;box-shadow:0 4px 10px rgba(0,0,0,0.35);cursor:grab"></div>`;
  return L.divIcon({ html, className: '', iconSize: [28, 28], iconAnchor: [14, 14] });
}

// ── Captura de clics en el mapa ───────────────────────────────────────────────
// Definido fuera del componente padre para evitar re-mounts (regla no-inner-components).

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LocationPicker({
  addressLabel,
  initialLat,
  initialLng,
  onConfirm,
  onCancel,
}: LocationPickerProps) {
  const hasValidInitial = isValidLatLng(initialLat, initialLng);

  const [selected, setSelected] = useState<{ lat: number; lng: number } | null>(
    hasValidInitial ? { lat: initialLat!, lng: initialLng! } : null,
  );
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Escape → cancelar (solo cuando no está guardando)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !saving) onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [saving, onCancel]);

  const handleMapClick = useCallback(
    (lat: number, lng: number) => {
      if (!saving) setSelected({ lat, lng });
    },
    [saving],
  );

  const handleDragEnd = useCallback(
    (e: L.DragEndEvent) => {
      if (saving) return;
      const { lat, lng } = (e.target as L.Marker).getLatLng();
      setSelected({ lat, lng });
    },
    [saving],
  );

  async function handleConfirm() {
    if (!selected || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onConfirm(selected.lat, selected.lng);
    } catch (err) {
      setSaveError((err as Error).message || 'Error al guardar la ubicación');
      setSaving(false);
    }
  }

  const mapCenter: [number, number] = hasValidInitial
    ? [initialLat!, initialLng!]
    : SPAIN_CENTER;
  const mapZoom = hasValidInitial ? ZOOM_INITIAL : ZOOM_EMPTY;

  // ── CARTO no configurado ──────────────────────────────────────────────────

  if (!CARTO_KEY) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col bg-white"
        role="dialog"
        aria-modal="true"
        aria-label="Selector de ubicación"
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
            Ajustar ubicación
          </h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <MapPin className="w-12 h-12 text-slate-300" />
          <p className="text-base font-bold text-slate-600">Mapa no disponible</p>
          <p className="text-sm text-slate-400">
            Configura{' '}
            <code className="bg-slate-100 px-1 rounded text-[11px]">
              VITE_CARTO_BASEMAP_API_KEY
            </code>{' '}
            para usar el selector de ubicación.
          </p>
          <button
            onClick={onCancel}
            className="mt-2 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-semibold text-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  // ── Mapa + controles ──────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Selector de ubicación"
    >
      {/* Encabezado */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <button
          onClick={onCancel}
          disabled={saving}
          aria-label="Cerrar"
          className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">
            Ajustar ubicación
          </h2>
          <p className="text-[11px] text-slate-500 truncate">{addressLabel}</p>
        </div>
      </div>

      {/* Banner: sin selección */}
      {!selected && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-blue-100">
          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <p className="text-[11px] text-blue-700">
            Toca el mapa para situar el marcador o arrástralo para ajustar.
          </p>
        </div>
      )}

      {/* Mapa */}
      <div className="flex-1 min-h-0 relative">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
          zoomControl
          data-testid="lp-map"
        >
          <TileLayer url={CARTO_URL} attribution={CARTO_ATTR} />
          <MapClickHandler onMapClick={handleMapClick} />
          {selected && (
            <Marker
              position={[selected.lat, selected.lng]}
              icon={createPickerIcon()}
              draggable
              eventHandlers={{ dragend: handleDragEnd }}
            />
          )}
        </MapContainer>
      </div>

      {/* Pie de página */}
      <div className="shrink-0 bg-white border-t border-slate-200 px-4 py-3">
        <div className="mb-3 min-h-[1.75rem]">
          {selected ? (
            <p className="text-xs font-mono text-slate-600" data-testid="lp-coords">
              {selected.lat.toFixed(5)}°&nbsp;N&nbsp;&nbsp;
              {selected.lng.toFixed(5)}°&nbsp;O
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 italic">
              Sin selección — toca el mapa para situar el marcador
            </p>
          )}
          {saveError && (
            <div className="flex items-center gap-1.5 mt-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-[11px] text-red-600" data-testid="lp-error">{saveError}</p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || saving}
            aria-disabled={!selected || saving}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold cursor-pointer transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Confirmar ubicación
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
