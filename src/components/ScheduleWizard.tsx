/**
 * ScheduleWizard — Asistente de 6 pasos para crear rutas recurrentes.
 *
 * TX-RECURRING-F4. Crea plantillas en trade_transport_schedules (borrador).
 * No materializa ocurrencias. No genera facturas. No modifica servicios puntuales.
 *
 * F5/F6 pendientes: mapa de recorrido completo (requiere Routing API),
 * pestaña Rutas en pantalla de transporte, check de conflictos real.
 */

import React, { useState, useRef, useMemo } from 'react';
import {
  ChevronLeft, ChevronRight, Check, MapPin, Clock, Users, Truck,
  UserCheck, Plus, Trash2, RotateCcw, AlertTriangle, Loader2, X,
  Calendar, ArrowRight,
} from 'lucide-react';
import type { TransportLocation } from '../lib/transportLocations';
import {
  locationToAddress, locationToText, hasAddress,
  TIPO_LUGAR_OPTIONS,
} from '../lib/transportLocations';
import type { TransportStop } from '../lib/transportServices';
import { TIPO_SERVICIO_OPTIONS } from '../lib/transportServices';
import type { TradeClient, TradeWorker } from '../lib/supabase';
import { getClientDisplayName } from '../lib/supabase';
import type { TradeVehicle } from '../lib/transport';
import {
  createSchedule,
  DIA_SEMANA_LABELS,
  getExpectedOccurrences,
  type DiaSemanaISO,
} from '../lib/transportSchedules';
import QuickStopForm from './QuickStopForm';
import StopFavoriteSelector from './StopFavoriteSelector';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface WizardDraft {
  tipo_servicio:      string;
  nombre:             string;
  client_id:          string;
  descripcion:        string;
  periodo_inicio:     string;
  periodo_fin:        string;
  dias_semana:        DiaSemanaISO[];
  hora_salida_ida:    string;
  hora_llegada_ida:   string;
  vuelta_habilitada:  boolean;
  hora_salida_vuelta: string;
  hora_llegada_vuelta: string;
  origen_ida:         TransportLocation;
  destino_ida:        TransportLocation;
  paradas_ida:        TransportStop[];
  paradas_vuelta:     TransportStop[];
  vehicle_id:         string;
  conductor_id:       string;
  num_viajeros:       string;
  precio_referencia:  string;
  observaciones:      string;
}

// ── Constantes ────────────────────────────────────────────────────────────────

const TIPOS_RECURRENTES = ['ruta_escolar', 'transporte_trabajadores', 'lanzadera', 'otro'];

const DEFAULT_DRAFT: WizardDraft = {
  tipo_servicio:       '',
  nombre:              '',
  client_id:           '',
  descripcion:         '',
  periodo_inicio:      '',
  periodo_fin:         '',
  dias_semana:         [],
  hora_salida_ida:     '',
  hora_llegada_ida:    '',
  vuelta_habilitada:   false,
  hora_salida_vuelta:  '',
  hora_llegada_vuelta: '',
  origen_ida:          {},
  destino_ida:         {},
  paradas_ida:         [],
  paradas_vuelta:      [],
  vehicle_id:          '',
  conductor_id:        '',
  num_viajeros:        '',
  precio_referencia:   '',
  observaciones:       '',
};

const STEP_LABELS = [
  'Tipo',
  'Horario',
  'Itinerario',
  'Recursos',
  'Condiciones',
  'Resumen',
];

// ── Helpers exportados (testeables) ──────────────────────────────────────────

export function validateStep(step: number, draft: WizardDraft): string | null {
  if (step === 1) {
    if (!draft.tipo_servicio) return 'Selecciona el tipo de servicio';
    if (!draft.nombre.trim()) return 'Introduce un nombre para la ruta';
    return null;
  }
  if (step === 2) {
    if (!draft.periodo_inicio) return 'Indica la fecha de inicio';
    if (draft.dias_semana.length === 0) return 'Selecciona al menos un día de circulación';
    if (!draft.hora_salida_ida || !/^\d{2}:\d{2}$/.test(draft.hora_salida_ida))
      return 'Introduce una hora de salida válida (HH:MM)';
    if (draft.vuelta_habilitada && !draft.hora_salida_vuelta)
      return 'Indica la hora de salida del trayecto de vuelta';
    return null;
  }
  if (step === 3) {
    if (!hasAddress(draft.origen_ida)) return 'Indica el origen del trayecto';
    if (!hasAddress(draft.destino_ida)) return 'Indica el destino del trayecto';
    return null;
  }
  return null;
}

export function locationToStop(loc: TransportLocation, hora?: string): TransportStop {
  const nombre =
    loc.nombre_lugar ||
    [loc.calle, loc.numero].filter(Boolean).join(' ') ||
    loc.localidad ||
    'Parada';
  return {
    nombre,
    ...(hora ? { hora } : {}),
    direccion: locationToAddress(loc) || undefined,
    location:  loc,
  };
}

export function copyInvertStops(stops: TransportStop[]): TransportStop[] {
  return [...stops].reverse().map(s => ({ ...s }));
}

export function getPreviewDates(draft: WizardDraft, maxN = 5): string[] {
  if (!draft.periodo_inicio || draft.dias_semana.length === 0) return [];
  const schedule = {
    periodo_inicio: draft.periodo_inicio,
    periodo_fin:    draft.periodo_fin || null,
    dias_semana:    draft.dias_semana,
  };
  const today  = new Date();
  today.setHours(0, 0, 0, 0);
  const inicio = new Date(draft.periodo_inicio + 'T00:00:00');
  const desde  = today > inicio ? today : inicio;
  const hasta  = new Date(desde);
  hasta.setDate(hasta.getDate() + 90);
  return getExpectedOccurrences(schedule, desde, hasta).slice(0, maxN);
}

export function buildScheduleInput(draft: WizardDraft) {
  return {
    nombre:             draft.nombre.trim(),
    tipo_servicio:      draft.tipo_servicio,
    estado:             'borrador' as const,
    client_id:          draft.client_id || null,
    periodo_inicio:     draft.periodo_inicio,
    periodo_fin:        draft.periodo_fin || null,
    dias_semana:        draft.dias_semana,
    timezone:           'Europe/Madrid',
    hora_salida_ida:    draft.hora_salida_ida + ':00',
    hora_llegada_ida:   draft.hora_llegada_ida ? draft.hora_llegada_ida + ':00' : null,
    origen_ida:         draft.origen_ida as Record<string, unknown>,
    destino_ida:        draft.destino_ida as Record<string, unknown>,
    paradas_ida:        draft.paradas_ida as unknown[],
    vuelta_habilitada:  draft.vuelta_habilitada,
    hora_salida_vuelta: draft.vuelta_habilitada && draft.hora_salida_vuelta
      ? draft.hora_salida_vuelta + ':00' : null,
    hora_llegada_vuelta: draft.vuelta_habilitada && draft.hora_llegada_vuelta
      ? draft.hora_llegada_vuelta + ':00' : null,
    paradas_vuelta:     draft.paradas_vuelta as unknown[],
    num_viajeros:       draft.num_viajeros ? parseInt(draft.num_viajeros, 10) : null,
    vehicle_id:         draft.vehicle_id  || null,
    conductor_id:       draft.conductor_id || null,
    precio_referencia:  draft.precio_referencia ? parseFloat(draft.precio_referencia) : null,
    observaciones:      draft.observaciones || null,
  };
}

// ── StepProgress ──────────────────────────────────────────────────────────────

interface StepProgressProps {
  current: number;
  total:   number;
  labels:  string[];
}

function StepProgress({ current, total, labels }: StepProgressProps) {
  return (
    <div className="flex items-center justify-center gap-0 overflow-x-auto">
      {Array.from({ length: total }, (_, i) => {
        const n     = i + 1;
        const done  = n < current;
        const active = n === current;
        return (
          <React.Fragment key={n}>
            <div className="flex flex-col items-center gap-0.5 shrink-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                done   ? 'bg-blue-600 border-blue-600 text-white' :
                active ? 'bg-white border-blue-600 text-blue-600' :
                         'bg-white border-slate-200 text-slate-400'
              }`}>
                {done ? <Check className="w-3.5 h-3.5" /> : n}
              </div>
              <span className={`text-[10px] font-semibold hidden sm:block ${active ? 'text-blue-600' : 'text-slate-400'}`}>
                {labels[i]}
              </span>
            </div>
            {n < total && (
              <div className={`h-0.5 w-6 sm:w-10 shrink-0 mx-0.5 mb-3 ${done ? 'bg-blue-600' : 'bg-slate-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step1TypeClient ───────────────────────────────────────────────────────────

interface Step1Props {
  draft:    WizardDraft;
  clients:  TradeClient[];
  onChange: (patch: Partial<WizardDraft>) => void;
}

function Step1TypeClient({ draft, clients, onChange }: Step1Props) {
  const recurrente = TIPO_SERVICIO_OPTIONS.filter(t => TIPOS_RECURRENTES.includes(t.value));
  const otros      = TIPO_SERVICIO_OPTIONS.filter(t => !TIPOS_RECURRENTES.includes(t.value));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Tipo de ruta *
        </label>
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">Más habituales en rutas recurrentes:</p>
          <div className="grid grid-cols-2 gap-2">
            {recurrente.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => onChange({ tipo_servicio: t.value })}
                className={`px-3 py-2.5 text-sm rounded-xl border text-left font-semibold transition-colors cursor-pointer ${
                  draft.tipo_servicio === t.value
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 pt-1">Otros tipos:</p>
          <select
            value={TIPOS_RECURRENTES.includes(draft.tipo_servicio) ? '' : draft.tipo_servicio}
            onChange={e => { if (e.target.value) onChange({ tipo_servicio: e.target.value }); }}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">— Seleccionar —</option>
            {otros.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Nombre identificativo *
        </label>
        <input
          type="text"
          value={draft.nombre}
          onChange={e => onChange({ nombre: e.target.value })}
          placeholder="Ej: Ruta escolar IES Norte L–V"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Cliente
        </label>
        <select
          value={draft.client_id}
          onChange={e => onChange({ client_id: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Sin cliente asignado</option>
          {clients.map(c => (
            <option key={c.id} value={c.id}>{getClientDisplayName(c)}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Descripción <span className="text-slate-400 normal-case">(opcional)</span>
        </label>
        <textarea
          value={draft.descripcion}
          onChange={e => onChange({ descripcion: e.target.value })}
          rows={2}
          placeholder="Notas internas sobre esta ruta"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Step2Period ────────────────────────────────────────────────────────────────

interface Step2Props {
  draft:    WizardDraft;
  onChange: (patch: Partial<WizardDraft>) => void;
}

function Step2Period({ draft, onChange }: Step2Props) {
  const toggleDia = (d: DiaSemanaISO) => {
    const current = draft.dias_semana;
    onChange({
      dias_semana: current.includes(d)
        ? current.filter(x => x !== d)
        : [...current, d].sort((a, b) => a - b) as DiaSemanaISO[],
    });
  };

  const dias: DiaSemanaISO[] = [1, 2, 3, 4, 5, 6, 7];
  const diaShort: Record<DiaSemanaISO, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Fecha de inicio *
          </label>
          <input
            type="date"
            value={draft.periodo_inicio}
            onChange={e => onChange({ periodo_inicio: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Fecha de fin <span className="text-slate-400 normal-case">(opt.)</span>
          </label>
          <input
            type="date"
            value={draft.periodo_fin}
            min={draft.periodo_inicio}
            onChange={e => onChange({ periodo_fin: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wide">
          Días de circulación *
        </label>
        <div className="flex gap-2">
          {dias.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDia(d)}
              className={`w-9 h-9 rounded-lg text-sm font-bold border transition-colors cursor-pointer ${
                draft.dias_semana.includes(d)
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300'
              }`}
              title={DIA_SEMANA_LABELS[d]}
            >
              {diaShort[d]}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 mt-1">
          Los festivos y días no lectivos se gestionan mediante excepciones una vez activa la ruta.
        </p>
      </div>

      <div className="pt-1 border-t border-slate-100">
        <p className="text-xs font-semibold text-slate-600 mb-3">Trayecto de ida</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
              Hora de salida *
            </label>
            <input
              type="time"
              value={draft.hora_salida_ida}
              onChange={e => onChange({ hora_salida_ida: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
              Llegada estimada <span className="text-slate-400 normal-case">(opt.)</span>
            </label>
            <input
              type="time"
              value={draft.hora_llegada_ida}
              onChange={e => onChange({ hora_llegada_ida: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={draft.vuelta_habilitada}
            onChange={e => onChange({ vuelta_habilitada: e.target.checked })}
            className="w-4 h-4 rounded accent-blue-600"
          />
          <span className="text-sm font-semibold text-slate-700">Activar trayecto de vuelta</span>
        </label>
      </div>

      {draft.vuelta_habilitada && (
        <div className="pl-4 border-l-2 border-blue-200 space-y-3">
          <p className="text-xs font-semibold text-slate-600">Trayecto de vuelta</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Hora de salida *
              </label>
              <input
                type="time"
                value={draft.hora_salida_vuelta}
                onChange={e => onChange({ hora_salida_vuelta: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
                Llegada estimada <span className="text-slate-400 normal-case">(opt.)</span>
              </label>
              <input
                type="time"
                value={draft.hora_llegada_vuelta}
                onChange={e => onChange({ hora_llegada_vuelta: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── LocationField ─────────────────────────────────────────────────────────────

interface LocationFieldProps {
  label:       string;
  value:       TransportLocation;
  onEdit:      () => void;
  placeholder: string;
}

function LocationField({ label, value, onEdit, placeholder }: LocationFieldProps) {
  const text = locationToText(value);
  const addr = locationToAddress(value);
  const filled = hasAddress(value);
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      <button
        type="button"
        onClick={onEdit}
        className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-colors cursor-pointer ${
          filled
            ? 'border-blue-200 bg-blue-50 hover:bg-blue-100'
            : 'border-dashed border-slate-300 bg-white hover:border-blue-300 hover:bg-slate-50'
        }`}
      >
        {filled ? (
          <div>
            <p className="font-semibold text-slate-800 truncate">{text || addr}</p>
            {text && addr && <p className="text-xs text-slate-500 truncate">{addr}</p>}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-slate-400">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{placeholder}</span>
          </div>
        )}
      </button>
    </div>
  );
}

// ── StopRow ───────────────────────────────────────────────────────────────────

interface StopRowProps {
  stop:       TransportStop;
  index:      number;
  total:      number;
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onRemove:   () => void;
}

function StopRow({ stop, index, total, onMoveUp, onMoveDown, onRemove }: StopRowProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white">
      <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-700 truncate">{stop.nombre}</p>
        {stop.hora && <p className="text-xs text-slate-400">{stop.hora}</p>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
          title="Subir"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 cursor-pointer"
          title="Bajar"
        >
          ▼
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="p-1 text-red-400 hover:text-red-600 cursor-pointer"
          title="Eliminar"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Step3Itinerary ────────────────────────────────────────────────────────────

type AddingMode = 'new' | 'favorites' | null;
type AddingTarget = 'origen_ida' | 'destino_ida' | 'parada_ida' | 'parada_vuelta' | null;

interface Step3Props {
  draft:    WizardDraft;
  orgId:    string;
  onChange: (patch: Partial<WizardDraft>) => void;
}

function Step3Itinerary({ draft, orgId, onChange }: Step3Props) {
  const [adding, setAdding]     = useState<{ target: AddingTarget; mode: AddingMode } | null>(null);
  const [stopHora, setStopHora] = useState('');

  const moveStop = (sentido: 'ida' | 'vuelta', idx: number, dir: -1 | 1) => {
    const key = sentido === 'ida' ? 'paradas_ida' : 'paradas_vuelta';
    const arr  = [...draft[key]];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap]!, arr[idx]!];
    onChange({ [key]: arr });
  };

  const removeStop = (sentido: 'ida' | 'vuelta', idx: number) => {
    const key = sentido === 'ida' ? 'paradas_ida' : 'paradas_vuelta';
    onChange({ [key]: draft[key].filter((_, i) => i !== idx) });
  };

  const handleLocationConfirm = (loc: TransportLocation) => {
    if (!adding) return;
    if (adding.target === 'origen_ida') onChange({ origen_ida: loc });
    else if (adding.target === 'destino_ida') onChange({ destino_ida: loc });
    else if (adding.target === 'parada_ida')
      onChange({ paradas_ida: [...draft.paradas_ida, locationToStop(loc, stopHora || undefined)] });
    else if (adding.target === 'parada_vuelta')
      onChange({ paradas_vuelta: [...draft.paradas_vuelta, locationToStop(loc, stopHora || undefined)] });
    setAdding(null);
    setStopHora('');
  };

  const handleAddStop = (target: 'parada_ida' | 'parada_vuelta', mode: AddingMode) => {
    setAdding({ target, mode });
  };

  // Modal activo
  if (adding?.mode === 'new') {
    const isLocation = adding.target === 'origen_ida' || adding.target === 'destino_ida';
    const label = adding.target === 'origen_ida' ? 'Origen'
      : adding.target === 'destino_ida' ? 'Destino'
      : 'Nueva parada';
    return (
      <QuickStopForm
        orgId={orgId}
        label={label}
        onConfirm={handleLocationConfirm}
        onCancel={() => setAdding(null)}
        initial={isLocation
          ? (adding.target === 'origen_ida' ? draft.origen_ida : draft.destino_ida)
          : {}}
      />
    );
  }

  if (adding?.mode === 'favorites') {
    return (
      <StopFavoriteSelector
        orgId={orgId}
        onSelect={handleLocationConfirm}
        onCancel={() => setAdding(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Trayecto de ida */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5 text-blue-500" /> Trayecto de ida
        </p>

        <LocationField
          label="Origen *"
          value={draft.origen_ida}
          placeholder="Clic para añadir el punto de origen"
          onEdit={() => setAdding({ target: 'origen_ida', mode: 'new' })}
        />

        {draft.paradas_ida.length > 0 && (
          <div className="space-y-1.5 pl-3 border-l-2 border-slate-200">
            <p className="text-[11px] font-semibold text-slate-400 uppercase">Paradas intermedias</p>
            {draft.paradas_ida.map((s, i) => (
              <StopRow
                key={i}
                stop={s}
                index={i}
                total={draft.paradas_ida.length}
                onMoveUp={() => moveStop('ida', i, -1)}
                onMoveDown={() => moveStop('ida', i, 1)}
                onRemove={() => removeStop('ida', i)}
              />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleAddStop('parada_ida', 'new')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Parada
          </button>
          <button
            type="button"
            onClick={() => handleAddStop('parada_ida', 'favorites')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            ★ Favoritas
          </button>
        </div>

        <LocationField
          label="Destino *"
          value={draft.destino_ida}
          placeholder="Clic para añadir el punto de destino"
          onEdit={() => setAdding({ target: 'destino_ida', mode: 'new' })}
        />
      </div>

      {/* Trayecto de vuelta */}
      {draft.vuelta_habilitada && (
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-indigo-500 rotate-180" /> Trayecto de vuelta
            </p>
            <button
              type="button"
              onClick={() => onChange({ paradas_vuelta: copyInvertStops(draft.paradas_ida) })}
              className="flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-800 cursor-pointer"
              title="Copiar e invertir paradas de ida"
            >
              <RotateCcw className="w-3 h-3" /> Copiar invertidas
            </button>
          </div>

          <div className="px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs text-indigo-700">
            Origen: {locationToText(draft.destino_ida) || '—'} → Destino: {locationToText(draft.origen_ida) || '—'}
          </div>

          {draft.paradas_vuelta.length > 0 && (
            <div className="space-y-1.5 pl-3 border-l-2 border-indigo-200">
              <p className="text-[11px] font-semibold text-slate-400 uppercase">Paradas intermedias (vuelta)</p>
              {draft.paradas_vuelta.map((s, i) => (
                <StopRow
                  key={i}
                  stop={s}
                  index={i}
                  total={draft.paradas_vuelta.length}
                  onMoveUp={() => moveStop('vuelta', i, -1)}
                  onMoveDown={() => moveStop('vuelta', i, 1)}
                  onRemove={() => removeStop('vuelta', i)}
                />
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAddStop('parada_vuelta', 'new')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Parada vuelta
            </button>
            <button
              type="button"
              onClick={() => handleAddStop('parada_vuelta', 'favorites')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
            >
              ★ Favoritas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Step4Vehicle ──────────────────────────────────────────────────────────────

interface Step4Props {
  draft:    WizardDraft;
  vehicles: TradeVehicle[];
  workers:  TradeWorker[];
  onChange: (patch: Partial<WizardDraft>) => void;
}

function Step4Vehicle({ draft, vehicles, workers, onChange }: Step4Props) {
  const conductor = workers.find(w => w.id === draft.conductor_id);
  const vehicle   = vehicles.find(v => v.id === draft.vehicle_id);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Vehículo habitual <span className="text-slate-400 normal-case">(opcional)</span>
        </label>
        <select
          value={draft.vehicle_id}
          onChange={e => onChange({ vehicle_id: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Sin asignar</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>
              {v.matricula} — {[v.marca, v.modelo_vehiculo].filter(Boolean).join(' ')}
              {v.capacidad_viajeros ? ` (${v.capacidad_viajeros} plazas)` : ''}
            </option>
          ))}
        </select>
        {vehicle?.capacidad_viajeros && (
          <p className="text-xs text-slate-400 mt-1">
            Capacidad: {vehicle.capacidad_viajeros} viajeros
          </p>
        )}
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Conductor habitual <span className="text-slate-400 normal-case">(opcional)</span>
        </label>
        <select
          value={draft.conductor_id}
          onChange={e => onChange({ conductor_id: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">Sin asignar</option>
          {workers.filter(w => w.es_conductor).map(w => (
            <option key={w.id} value={w.id}>{w.nombre}</option>
          ))}
        </select>
        {conductor && !conductor.es_conductor && (
          <p className="text-xs text-amber-600 mt-1">
            Este trabajador no está marcado como conductor.
          </p>
        )}
      </div>

      <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
        <AlertTriangle className="w-3.5 h-3.5 inline text-amber-500 mr-1" />
        Los conflictos de disponibilidad específicos se validarán al materializar cada servicio de la ruta.
        Puedes crear la ruta sin asignar vehículo ni conductor.
      </div>
    </div>
  );
}

// ── Step5Conditions ───────────────────────────────────────────────────────────

interface Step5Props {
  draft:    WizardDraft;
  onChange: (patch: Partial<WizardDraft>) => void;
}

function Step5Conditions({ draft, onChange }: Step5Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Viajeros habituales
          </label>
          <input
            type="number"
            min="1"
            max="9999"
            value={draft.num_viajeros}
            onChange={e => onChange({ num_viajeros: e.target.value })}
            placeholder="48"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
            Precio referencia (€)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={draft.precio_referencia}
            onChange={e => onChange({ precio_referencia: e.target.value })}
            placeholder="1500.00"
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-[10px] text-slate-400 mt-0.5">Informativo. No genera facturas.</p>
        </div>
      </div>

      <div>
        <label className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">
          Observaciones e instrucciones
        </label>
        <textarea
          value={draft.observaciones}
          onChange={e => onChange({ observaciones: e.target.value })}
          rows={3}
          placeholder="Instrucciones para el conductor, puntos de atención especial…"
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>
    </div>
  );
}

// ── Step6Summary ──────────────────────────────────────────────────────────────

interface Step6Props {
  draft:    WizardDraft;
  clients:  TradeClient[];
  vehicles: TradeVehicle[];
  workers:  TradeWorker[];
}

function Step6Summary({ draft, clients, vehicles, workers }: Step6Props) {
  const client  = clients.find(c => c.id === draft.client_id);
  const vehicle = vehicles.find(v => v.id === draft.vehicle_id);
  const conductor = workers.find(w => w.id === draft.conductor_id);

  const tipoLabel = TIPO_SERVICIO_OPTIONS.find(t => t.value === draft.tipo_servicio)?.label ?? draft.tipo_servicio;

  const diasLabel = draft.dias_semana
    .map(d => DIA_SEMANA_LABELS[d].slice(0, 2))
    .join(', ');

  const preview = useMemo(() => getPreviewDates(draft), [draft]);

  const SummaryRow = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500 shrink-0">{label}</span>
      <span className="text-xs font-semibold text-slate-800 text-right">{value || '—'}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-0">
        <SummaryRow label="Tipo" value={tipoLabel} />
        <SummaryRow label="Nombre" value={draft.nombre} />
        <SummaryRow label="Cliente" value={client ? getClientDisplayName(client) : 'Sin asignar'} />
        <SummaryRow label="Inicio" value={draft.periodo_inicio || '—'} />
        <SummaryRow label="Fin" value={draft.periodo_fin || 'Sin fecha de fin'} />
        <SummaryRow label="Días" value={diasLabel || '—'} />
        <SummaryRow label="Salida ida" value={draft.hora_salida_ida || '—'} />
        {draft.hora_llegada_ida && <SummaryRow label="Llegada ida" value={draft.hora_llegada_ida} />}
        {draft.vuelta_habilitada && (
          <>
            <SummaryRow label="Salida vuelta" value={draft.hora_salida_vuelta || '—'} />
            {draft.hora_llegada_vuelta && <SummaryRow label="Llegada vuelta" value={draft.hora_llegada_vuelta} />}
          </>
        )}
        <SummaryRow label="Origen" value={locationToText(draft.origen_ida) || locationToAddress(draft.origen_ida)} />
        <SummaryRow label="Destino" value={locationToText(draft.destino_ida) || locationToAddress(draft.destino_ida)} />
        {draft.paradas_ida.length > 0 && (
          <SummaryRow label="Paradas ida" value={`${draft.paradas_ida.length} parada${draft.paradas_ida.length !== 1 ? 's' : ''}`} />
        )}
        {draft.vuelta_habilitada && draft.paradas_vuelta.length > 0 && (
          <SummaryRow label="Paradas vuelta" value={`${draft.paradas_vuelta.length} parada${draft.paradas_vuelta.length !== 1 ? 's' : ''}`} />
        )}
        {vehicle && <SummaryRow label="Vehículo" value={[vehicle.matricula, vehicle.marca, vehicle.modelo_vehiculo].filter(Boolean).join(' ')} />}
        {conductor && <SummaryRow label="Conductor" value={conductor.nombre} />}
        {draft.num_viajeros && <SummaryRow label="Viajeros" value={draft.num_viajeros} />}
        {draft.precio_referencia && <SummaryRow label="Precio ref." value={`${draft.precio_referencia} €`} />}
      </div>

      {preview.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Próximas ocurrencias previstas:</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.map(d => (
              <span key={d} className="px-2 py-1 bg-blue-50 border border-blue-100 rounded-lg text-xs font-mono text-blue-700">
                {d}
              </span>
            ))}
            <span className="px-2 py-1 text-xs text-slate-400">…</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">
            Vista previa calculada sin escrituras. Los festivos no se excluyen automáticamente.
          </p>
        </div>
      )}

      <div className="px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
        La ruta se guardará como <strong>borrador</strong>. Podrás activarla y materializar
        los servicios individuales desde la pantalla de Rutas.
      </div>
    </div>
  );
}

// ── ScheduleWizard (componente principal) ─────────────────────────────────────

export interface ScheduleWizardProps {
  orgId:    string;
  clients:  TradeClient[];
  vehicles: TradeVehicle[];
  workers:  TradeWorker[];
  onClose:  () => void;
  onSaved:  (nombre: string) => void;
}

export default function ScheduleWizard({
  orgId, clients, vehicles, workers, onClose, onSaved,
}: ScheduleWizardProps) {
  const [step,      setStep]      = useState(1);
  const [draft,     setDraft]     = useState<WizardDraft>(DEFAULT_DRAFT);
  const [stepError, setStepError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const TOTAL = 6;

  const patch = (p: Partial<WizardDraft>) => {
    setDraft(prev => ({ ...prev, ...p }));
    setStepError(null);
  };

  const handleNext = () => {
    const err = validateStep(step, draft);
    if (err) { setStepError(err); return; }
    setStepError(null);
    setStep(s => Math.min(s + 1, TOTAL));
  };

  const handleBack = () => {
    setStepError(null);
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      const input = buildScheduleInput(draft);
      await createSchedule(orgId, input);
      onSaved(draft.nombre);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
      savingRef.current = false;
    } finally {
      setSaving(false);
    }
  };

  const stepContent = (() => {
    switch (step) {
      case 1: return <Step1TypeClient draft={draft} clients={clients} onChange={patch} />;
      case 2: return <Step2Period draft={draft} onChange={patch} />;
      case 3: return <Step3Itinerary draft={draft} orgId={orgId} onChange={patch} />;
      case 4: return <Step4Vehicle draft={draft} vehicles={vehicles} workers={workers} onChange={patch} />;
      case 5: return <Step5Conditions draft={draft} onChange={patch} />;
      case 6: return <Step6Summary draft={draft} clients={clients} vehicles={vehicles} workers={workers} />;
      default: return null;
    }
  })();

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-start md:items-center justify-center bg-black/50 md:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Crear ruta recurrente"
    >
      <div className="bg-white w-full md:rounded-2xl md:shadow-2xl md:max-w-2xl flex flex-col min-h-screen md:min-h-0 md:max-h-[92vh]">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-200 shrink-0 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Nueva ruta recurrente</h2>
                <p className="text-[11px] text-slate-400">Paso {step} de {TOTAL} — {STEP_LABELS[step - 1]}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <StepProgress current={step} total={TOTAL} labels={STEP_LABELS} />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {stepContent}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 shrink-0 space-y-2">
          {stepError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{stepError}</p>
            </div>
          )}
          {saveError && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
              <p className="text-xs text-red-700">{saveError}</p>
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center gap-1.5 px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 1 ? 'Cancelar' : 'Anterior'}
            </button>

            {step < TOTAL ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 cursor-pointer transition-colors"
              >
                Siguiente <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-semibold bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 cursor-pointer transition-colors"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Guardando…</>
                  : <><Check className="w-4 h-4" /> Guardar ruta recurrente</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
