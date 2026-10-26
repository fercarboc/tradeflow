/**
 * TransportLocationForm — Formulario de punto geográfico completo.
 * TRANSPORT-ROUTE-ADDRESS-1: origen, destino o parada de un servicio.
 * Componente controlado; el padre gestiona el estado.
 * Todos los campos son opcionales. No fuerza número de calle ni coordenadas.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Crosshair } from 'lucide-react';
import {
  TIPO_LUGAR_OPTIONS,
  locationToAddress,
  hasAddress,
} from '../lib/transportLocations';
import type { TransportLocation } from '../lib/transportLocations';
import GeoSearchPicker from './GeoSearchPicker';
import type { GeoSearchPickerResult } from './GeoSearchPicker';

interface Props {
  label:    string;                    // "Origen", "Destino", "Parada"
  value:    TransportLocation | null;
  onChange: (loc: TransportLocation | null) => void;
  required?: boolean;
  compact?:  boolean;                  // true = mostrar resumen colapsable
  orgId?:   string;                    // cuando se proporciona, muestra botón Localizar
}

const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide';

export default function TransportLocationForm({ label, value, onChange, required = false, compact = true, orgId }: Props) {
  const [expanded,    setExpanded]   = useState(!compact || hasAddress(value));
  const [showPicker,  setShowPicker] = useState(false);

  const loc = value ?? {};

  const set = (k: keyof TransportLocation, v: string | null) => {
    const updated = { ...loc, [k]: v || undefined };
    onChange(Object.keys(updated).length === 0 ? null : updated);
  };

  const handlePickerConfirm = (result: GeoSearchPickerResult) => {
    setShowPicker(false);
    onChange({ ...loc, lat: result.lat, lng: result.lng, geo_source: result.geo_source });
  };

  const initialAddress = locationToAddress(value) || loc.nombre_lugar || '';
  const summary = hasAddress(value) ? locationToAddress(value) : '';

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50/50">
      {showPicker && orgId && (
        <GeoSearchPicker
          orgId={orgId}
          initialAddress={initialAddress}
          onConfirm={handlePickerConfirm}
          onCancel={() => setShowPicker(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center px-3 py-2 gap-2">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="flex-1 flex items-center gap-2 min-w-0 text-left cursor-pointer"
        >
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">
            {label}{required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
          {!expanded && summary && (
            <span className="text-xs text-slate-500 truncate ml-1">{summary}</span>
          )}
          {!expanded && !summary && (
            <span className="text-xs text-slate-400 italic ml-1">Sin detalles</span>
          )}
        </button>
        {orgId && (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-2 py-0.5 rounded-full bg-blue-50 hover:bg-blue-100 transition-colors shrink-0 cursor-pointer"
          >
            <Crosshair className="w-3 h-3" />
            Localizar
          </button>
        )}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          className="shrink-0 cursor-pointer"
        >
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          }
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-200">
          {/* Nombre + Tipo */}
          <div className="grid grid-cols-2 gap-2 pt-2.5">
            <div>
              <label className={labelCls}>Nombre del lugar</label>
              <input
                type="text"
                value={loc.nombre_lugar ?? ''}
                onChange={e => set('nombre_lugar', e.target.value)}
                placeholder='Ej. "Hotel NH Las Américas"'
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Tipo de lugar</label>
              <select
                value={loc.tipo_lugar ?? ''}
                onChange={e => set('tipo_lugar', e.target.value)}
                className={inputCls}
              >
                <option value="">— Sin clasificar —</option>
                {TIPO_LUGAR_OPTIONS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Calle + Número */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className={labelCls}>Calle / Vía</label>
              <input
                type="text"
                value={loc.calle ?? ''}
                onChange={e => set('calle', e.target.value)}
                placeholder='Ej. "Avenida de América"'
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Número</label>
              <input
                type="text"
                value={loc.numero ?? ''}
                onChange={e => set('numero', e.target.value)}
                placeholder="11 (opcional)"
                className={inputCls}
              />
            </div>
          </div>

          {/* CP + Localidad + Provincia */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className={labelCls}>Código postal</label>
              <input
                type="text"
                value={loc.cp ?? ''}
                onChange={e => set('cp', e.target.value)}
                placeholder="28003"
                maxLength={10}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Localidad</label>
              <input
                type="text"
                value={loc.localidad ?? ''}
                onChange={e => set('localidad', e.target.value)}
                placeholder="Madrid"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Provincia</label>
              <input
                type="text"
                value={loc.provincia ?? ''}
                onChange={e => set('provincia', e.target.value)}
                placeholder="Madrid"
                className={inputCls}
              />
            </div>
          </div>

          {/* Terminal / Punto de encuentro */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Terminal / Dársena / Andén</label>
              <input
                type="text"
                value={loc.terminal ?? ''}
                onChange={e => set('terminal', e.target.value)}
                placeholder="T1, Andén 3, Acceso Norte…"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Punto de encuentro</label>
              <input
                type="text"
                value={loc.punto_encuentro ?? ''}
                onChange={e => set('punto_encuentro', e.target.value)}
                placeholder="Zona de autobuses, puerta B…"
                className={inputCls}
              />
            </div>
          </div>

          {/* Indicaciones para el conductor */}
          <div>
            <label className={labelCls}>Indicaciones de acceso para el conductor</label>
            <textarea
              rows={2}
              value={loc.indicaciones ?? ''}
              onChange={e => set('indicaciones', e.target.value)}
              placeholder="Acceso por el lateral norte, aparcar en zona amarilla…"
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
