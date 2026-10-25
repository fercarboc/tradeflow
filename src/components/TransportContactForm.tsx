/**
 * TransportContactForm — Formulario de persona de contacto operativo.
 * TRANSPORT-ROUTE-ADDRESS-1: responsable del grupo, guía, coordinador, etc.
 * Distinto del cliente contratante (quien recibe la factura).
 * El conductor usará este contacto durante el servicio.
 * No expone teléfonos en páginas públicas ni en logs.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Phone, User } from 'lucide-react';
import {
  TIPO_FUNCION_OPTIONS,
  hasContact,
  isValidSpanishPhone,
} from '../lib/transportLocations';
import type { TransportContact } from '../lib/transportLocations';

interface Props {
  label:    string;                     // "Contacto principal", "Responsable de parada"
  value:    TransportContact | null;
  onChange: (c: TransportContact | null) => void;
  compact?: boolean;
}

const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
const labelCls = 'block text-[11px] font-semibold text-slate-500 mb-0.5 uppercase tracking-wide';

function contactSummary(c: TransportContact | null | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.nombre) parts.push(c.nombre);
  if (c.telefono) parts.push(c.telefono);
  return parts.join(' · ');
}

export default function TransportContactForm({ label, value, onChange, compact = true }: Props) {
  const [expanded, setExpanded] = useState(!compact || hasContact(value));

  const c = value ?? {};
  const summary = contactSummary(value);

  const set = (k: keyof TransportContact, v: string) => {
    const updated = { ...c, [k]: v || undefined };
    const nonEmpty = Object.values(updated).some(Boolean);
    onChange(nonEmpty ? updated : null);
  };

  const phoneWarn = (tel: string | undefined) =>
    tel && !isValidSpanishPhone(tel);

  return (
    <div className="border border-slate-200 rounded-lg bg-slate-50/50">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-left cursor-pointer"
      >
        <div className="flex items-center gap-2 min-w-0">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-700">{label}</span>
          {!expanded && summary && (
            <span className="text-xs text-slate-500 truncate ml-1">{summary}</span>
          )}
          {!expanded && !summary && (
            <span className="text-xs text-slate-400 italic ml-1">Sin contacto</span>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        }
      </button>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2.5 border-t border-slate-200">
          {/* Nombre + Organización */}
          <div className="grid grid-cols-2 gap-2 pt-2.5">
            <div>
              <label className={labelCls}>Nombre y apellidos</label>
              <input
                type="text"
                value={c.nombre ?? ''}
                onChange={e => set('nombre', e.target.value)}
                placeholder="María García López"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Organización / Empresa</label>
              <input
                type="text"
                value={c.organizacion ?? ''}
                onChange={e => set('organizacion', e.target.value)}
                placeholder="IES Cervantes / Asociación…"
                className={inputCls}
              />
            </div>
          </div>

          {/* Función + Teléfono */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Función</label>
              <select
                value={c.funcion ?? ''}
                onChange={e => set('funcion', e.target.value)}
                className={inputCls}
              >
                <option value="">— Sin especificar —</option>
                {TIPO_FUNCION_OPTIONS.map(f => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                <Phone className="w-3 h-3 inline mr-0.5" />
                Teléfono móvil
              </label>
              <input
                type="tel"
                value={c.telefono ?? ''}
                onChange={e => set('telefono', e.target.value)}
                placeholder="600 000 000"
                className={inputCls + (phoneWarn(c.telefono) ? ' border-amber-300 focus:ring-amber-400' : '')}
              />
              {phoneWarn(c.telefono) && (
                <p className="text-[11px] text-amber-600 mt-0.5">Formato no reconocido — revisa el número</p>
              )}
            </div>
          </div>

          {/* Teléfono alternativo + Email */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Teléfono alternativo</label>
              <input
                type="tel"
                value={c.telefono_alt ?? ''}
                onChange={e => set('telefono_alt', e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                value={c.email ?? ''}
                onChange={e => set('email', e.target.value)}
                placeholder="Opcional"
                className={inputCls}
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className={labelCls}>Observaciones de contacto</label>
            <textarea
              rows={2}
              value={c.observaciones ?? ''}
              onChange={e => set('observaciones', e.target.value)}
              placeholder="Disponible a partir de las 8h, no llaman antes de las 7h…"
              className={inputCls + ' resize-none'}
            />
          </div>
        </div>
      )}
    </div>
  );
}
