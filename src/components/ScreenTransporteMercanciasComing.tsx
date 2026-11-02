import React from 'react';
import { Truck, Package, FileText, Clock, ChevronRight } from 'lucide-react';

interface Props {
  /** Nombre de la funcionalidad que todavía no está disponible. */
  feature: 'viajes' | 'expediciones' | 'documentos';
  onNavigate?: (tab: string) => void;
}

const FEATURE_CONFIG: Record<Props['feature'], {
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  items: string[];
}> = {
  viajes: {
    title: 'Viajes Operativos',
    subtitle: 'Próximamente en Mercancías',
    description: 'Planifica y gestiona viajes con múltiples tramos, cargas y conductores. Asigna vehículos, registra kilómetros y cierra partes de viaje.',
    icon: <Truck className="w-10 h-10 text-amber-500" />,
    items: [
      'Viajes multitramo con cargadores independientes',
      'Asignación de vehículo y conductor',
      'Registro de odómetro y parte de viaje',
      'FSM: borrador → confirmado → en curso → completado',
    ],
  },
  expediciones: {
    title: 'Expediciones y Cargas',
    subtitle: 'Próximamente en Mercancías',
    description: 'Gestiona cada carga dentro de un viaje: remitente, destinatario, punto de recogida y entrega, peso, bultos y referencia del documento del cargador.',
    icon: <Package className="w-10 h-10 text-amber-500" />,
    items: [
      'Una o varias expediciones por viaje',
      'Carga y descarga en tramos distintos',
      'Trazabilidad de eventos (recogida, entrega, incidencia)',
      'Firma del receptor y evidencia fotográfica',
    ],
  },
  documentos: {
    title: 'Gestión Documental',
    subtitle: 'Próximamente en Mercancías',
    description: 'Custodia los documentos de transporte del cargador (DeCA, carta de porte, CMR) y ponlos a disposición del conductor en campo.',
    icon: <FileText className="w-10 h-10 text-amber-500" />,
    items: [
      'Adjuntar PDF del cargador a cada expedición',
      'Acceso del conductor en campo sin conexión',
      'QR externo del cargador (consulta, no generación)',
      'Historial documental por expedición',
    ],
  },
};

export default function ScreenTransporteMercanciasComing({ feature, onNavigate }: Props) {
  const cfg = FEATURE_CONFIG[feature];

  return (
    <div className="flex flex-col items-center justify-start min-h-[420px] px-6 py-10 gap-8 max-w-xl mx-auto">
      {/* Icono + cabecera */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
          {cfg.icon}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">{cfg.subtitle}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{cfg.title}</h2>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">{cfg.description}</p>
        </div>
      </div>

      {/* Lista de funcionalidades previstas */}
      <div className="w-full bg-amber-50 border border-amber-200 rounded-xl p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-3">Lo que incluirá</p>
        <ul className="space-y-2">
          {cfg.items.map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Accesos a módulos ya disponibles */}
      {onNavigate && (
        <div className="w-full">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Disponible ahora</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { tab: 'transporte_vehiculos', label: 'Flota', icon: <Truck className="w-4 h-4" /> },
              { tab: 'transporte_conductores', label: 'Conductores', icon: <Package className="w-4 h-4" /> },
              { tab: 'transporte_tarifas', label: 'Tarifas', icon: <FileText className="w-4 h-4" /> },
              { tab: 'transporte_panel', label: 'Panel', icon: <ChevronRight className="w-4 h-4" /> },
            ].map(({ tab, label, icon }) => (
              <button
                key={tab}
                onClick={() => onNavigate(tab)}
                className="flex items-center gap-2 px-4 py-3 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
              >
                <span className="text-gray-400">{icon}</span>
                {label}
                <ChevronRight className="w-3.5 h-3.5 text-gray-300 ml-auto" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
