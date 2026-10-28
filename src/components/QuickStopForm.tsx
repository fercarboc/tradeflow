/**
 * QuickStopForm — Formulario rápido de parada de transporte.
 *
 * Uso: rutas escolares, lanzaderas, transporte de trabajadores.
 * Combina campos de dirección postal estructurada con geocodificación
 * asistida a través de GeoSearchPicker. Las coordenadas son opcionales
 * (el conductor puede confirmarlas in-situ).
 *
 * F4 — Integración con el asistente de rutas recurrentes:
 *   QuickStopForm se usará como paso de configuración de paradas en el
 *   asistente de creación de plantillas (TX-RECURRING-F4). El asistente
 *   recogerá el array de paradas (ida/vuelta separados) y los almacenará
 *   en trade_transport_schedules.paradas_ida / paradas_vuelta como JSONB.
 *   StopFavoriteSelector se llamará antes de QuickStopForm para dar la
 *   opción de reutilizar paradas ya geocodificadas de la organización.
 */

import React, { useState } from 'react';
import { MapPin, Locate, CheckCircle, X } from 'lucide-react';
import type { TransportLocation, TipoLugar } from '../lib/transportLocations';
import { TIPO_LUGAR_OPTIONS } from '../lib/transportLocations';
import GeoSearchPicker from './GeoSearchPicker';
import type { GeoSearchPickerResult } from './GeoSearchPicker';

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPO_LUGAR_F3 = TIPO_LUGAR_OPTIONS.filter(
  o => ['colegio', 'empresa', 'domicilio', 'otro', 'aparcamiento', 'recinto_deportivo', 'estacion'].includes(o.value),
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface QuickStopFormProps {
  orgId:     string;
  onConfirm: (loc: TransportLocation) => void;
  onCancel:  () => void;
  initial?:  Partial<TransportLocation>;
  label?:    string;
}

// ── Helper: construir texto de dirección para el geocoder ─────────────────────

function buildAddressQuery(fields: {
  calle: string; numero: string; cp: string; localidad: string;
}): string {
  const parts = [
    [fields.calle, fields.numero].filter(Boolean).join(' '),
    fields.cp,
    fields.localidad,
  ].filter(Boolean);
  return parts.join(', ');
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function QuickStopForm({
  orgId, onConfirm, onCancel, initial = {}, label = 'Parada',
}: QuickStopFormProps) {
  const [nombre,    setNombre]   = useState(initial.nombre_lugar ?? '');
  const [calle,     setCalle]    = useState(initial.calle ?? '');
  const [numero,    setNumero]   = useState(initial.numero ?? '');
  const [cp,        setCp]       = useState(initial.cp ?? '');
  const [localidad, setLocalidad] = useState(initial.localidad ?? '');
  const [tipoLugar, setTipoLugar] = useState<TipoLugar | ''>(
    (initial.tipo_lugar as TipoLugar) ?? '',
  );
  const [lat,       setLat]      = useState<number | null>(initial.lat ?? null);
  const [lng,       setLng]      = useState<number | null>(initial.lng ?? null);
  const [geoSource, setGeoSource] = useState<TransportLocation['geo_source']>(
    initial.geo_source ?? undefined,
  );
  const [showGeo,   setShowGeo]  = useState(false);

  const hasAddress = !!(calle.trim() || localidad.trim() || cp.trim());
  const hasGeo     = lat != null && lng != null;

  const handleGeoConfirm = (result: GeoSearchPickerResult) => {
    setLat(result.lat);
    setLng(result.lng);
    setGeoSource(result.geo_source);
    setShowGeo(false);
  };

  const handleConfirm = () => {
    const loc: TransportLocation = {
      ...(nombre.trim()    ? { nombre_lugar: nombre.trim() }    : {}),
      ...(tipoLugar        ? { tipo_lugar: tipoLugar }          : {}),
      ...(calle.trim()     ? { calle: calle.trim() }            : {}),
      ...(numero.trim()    ? { numero: numero.trim() }          : {}),
      ...(cp.trim()        ? { cp: cp.trim() }                  : {}),
      ...(localidad.trim() ? { localidad: localidad.trim() }    : {}),
      ...(hasGeo           ? { lat, lng, geo_source: geoSource } : {}),
    };
    onConfirm(loc);
  };

  const canConfirm = hasAddress || hasGeo;

  const addressQuery = buildAddressQuery({ calle, numero, cp, localidad });

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
        role="dialog"
        aria-modal="true"
        aria-label={`Configurar ${label}`}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">{label}</h3>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

            {/* Nombre del lugar */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                Nombre del lugar <span className="text-slate-400 normal-case">(opcional)</span>
              </label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: IES Ramón y Cajal, Empresa ACME"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Tipo de lugar */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                Tipo de lugar
              </label>
              <select
                value={tipoLugar}
                onChange={e => setTipoLugar(e.target.value as TipoLugar | '')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Sin especificar</option>
                {TIPO_LUGAR_F3.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Dirección */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                  Calle
                </label>
                <input
                  type="text"
                  value={calle}
                  onChange={e => setCalle(e.target.value)}
                  placeholder="Avenida de la Paz"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                  Número
                </label>
                <input
                  type="text"
                  value={numero}
                  onChange={e => setNumero(e.target.value)}
                  placeholder="12"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                  Código postal
                </label>
                <input
                  type="text"
                  value={cp}
                  onChange={e => setCp(e.target.value)}
                  placeholder="28014"
                  maxLength={10}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide">
                  Municipio
                </label>
                <input
                  type="text"
                  value={localidad}
                  onChange={e => setLocalidad(e.target.value)}
                  placeholder="Madrid"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Estado geocodificación */}
            {hasGeo ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-green-800">Ubicación confirmada en mapa</p>
                  <p className="text-[10px] font-mono text-green-700">
                    {lat!.toFixed(6)}, {lng!.toFixed(6)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGeo(true)}
                  className="text-xs text-green-700 hover:text-green-900 underline cursor-pointer shrink-0"
                >
                  Ajustar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGeo(true)}
                disabled={!addressQuery.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-blue-300 text-blue-700 text-sm font-semibold rounded-xl hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Locate className="w-4 h-4" />
                Localizar en mapa
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              Añadir parada
            </button>
          </div>
        </div>
      </div>

      {/* Sub-modal geocoder */}
      {showGeo && (
        <GeoSearchPicker
          orgId={orgId}
          initialAddress={addressQuery}
          onConfirm={handleGeoConfirm}
          onCancel={() => setShowGeo(false)}
        />
      )}
    </>
  );
}
