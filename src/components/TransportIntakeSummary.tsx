/**
 * TransportIntakeSummary — Panel informativo del intake de transporte detectado por IA.
 * Muestra los campos extraídos y alerta sobre los pendientes de confirmar.
 * No es un inner component — se importa desde AppDashboardView.
 */
import React from 'react';
import { X, Bus, MapPin, Calendar, Users, Euro, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  getTipoLabel,
  type TransportIntake,
} from '../lib/transportVoiceIntake';

interface TransportIntakeSummaryProps {
  intake: TransportIntake;
  onDismiss: () => void;
  onDateChange?: (fecha: string) => void;
}

const TransportIntakeSummary: React.FC<TransportIntakeSummaryProps> = ({ intake, onDismiss, onDateChange }) => {
  const { intake: d } = intake;

  const rows: { icon: React.ReactNode; label: string; value: string; missing?: boolean }[] = [];

  rows.push({
    icon: <Bus className="w-3 h-3 text-blue-500" />,
    label: 'Tipo',
    value: getTipoLabel(d.tipo_servicio),
    missing: !d.tipo_servicio,
  });

  if (d.origen || d.destino) {
    const ruta = [d.origen, d.destino].filter(Boolean).join(' → ');
    rows.push({
      icon: <MapPin className="w-3 h-3 text-blue-500" />,
      label: 'Ruta',
      value: ruta || '—',
      missing: !d.origen && !d.destino,
    });
  } else {
    rows.push({
      icon: <MapPin className="w-3 h-3 text-amber-400" />,
      label: 'Ruta',
      value: 'No detectada',
      missing: true,
    });
  }

  // Fecha row is rendered separately below (editable when onDateChange is provided)
  const fechaDetectada = d.fecha_servicio ?? null;

  if (d.num_viajeros !== null) {
    rows.push({
      icon: <Users className="w-3 h-3 text-blue-500" />,
      label: 'Viajeros',
      value: `${d.num_viajeros} pax`,
    });
  } else {
    rows.push({
      icon: <Users className="w-3 h-3 text-amber-400" />,
      label: 'Viajeros',
      value: 'No indicado',
      missing: true,
    });
  }

  if (d.precio_base !== null) {
    const precioStr = d.precio_incluye_iva
      ? `${d.precio_base.toLocaleString('es-ES')} € (IVA incl.)`
      : `${d.precio_base.toLocaleString('es-ES')} € + IVA`;
    rows.push({
      icon: <Euro className="w-3 h-3 text-blue-500" />,
      label: 'Precio',
      value: precioStr,
    });
  } else {
    rows.push({
      icon: <Euro className="w-3 h-3 text-amber-400" />,
      label: 'Precio',
      value: 'Pendiente de confirmar',
      missing: true,
    });
  }

  const pendientes = d.campos_pendientes.filter(c => !['origen', 'destino', 'fecha_servicio', 'num_viajeros', 'precio_base'].includes(c));

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-[10.5px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Bus className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-bold text-blue-700 uppercase tracking-wide text-[9px]">
            Transporte detectado por IA
          </span>
        </div>
        <button
          onClick={onDismiss}
          className="text-blue-400 hover:text-blue-600 transition-colors"
          aria-label="Cerrar resumen de transporte"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-1">
            {row.icon}
            <span className={row.missing ? 'text-amber-600' : 'text-gray-600'}>
              <span className="font-semibold">{row.label}:</span>{' '}
              {row.value}
            </span>
          </div>
        ))}
        {/* Fecha — editable cuando se proporciona onDateChange */}
        <div className="flex items-center gap-1 col-span-2">
          {(fechaDetectada && !onDateChange)
            ? <Calendar className="w-3 h-3 text-blue-500 shrink-0" />
            : <Calendar className="w-3 h-3 text-amber-400 shrink-0" />}
          <span className={fechaDetectada ? 'text-gray-600' : 'text-amber-600'}>
            <span className="font-semibold">Fecha:</span>{' '}
            {onDateChange ? (
              <input
                type="date"
                defaultValue={fechaDetectada ?? ''}
                onChange={e => onDateChange(e.target.value)}
                className="border border-blue-300 rounded px-1 py-0.5 text-[10px] text-gray-800 focus:outline-none focus:border-blue-500"
              />
            ) : (
              fechaDetectada
                ? (d.fecha_fin_servicio && d.fecha_fin_servicio !== d.fecha_servicio
                    ? `${d.fecha_servicio} → ${d.fecha_fin_servicio}`
                    : d.fecha_servicio)
                : 'No detectada'
            )}
          </span>
        </div>
      </div>

      {d.condiciones_especiales.length > 0 && (
        <div className="mt-1.5 flex items-start gap-1">
          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-px" />
          <span className="text-gray-600 leading-relaxed">
            <span className="font-semibold">Condiciones:</span>{' '}
            {d.condiciones_especiales.join(' · ')}
          </span>
        </div>
      )}

      {(d.precio_base === null || d.campos_pendientes.length > 0) && (
        <div className="mt-1.5 flex items-start gap-1">
          <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-px" />
          <span className="text-amber-700 leading-relaxed">
            Revisa los campos en naranja antes de enviar al cliente.
            {pendientes.length > 0 && (
              <> Otros pendientes: <em>{pendientes.join(', ')}</em>.</>
            )}
          </span>
        </div>
      )}
    </div>
  );
};

export default TransportIntakeSummary;
