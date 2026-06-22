import { MapPin, Clock, ChevronRight } from 'lucide-react';

const AGENDA_ITEMS = [
  { hora: '08:00', cliente: 'García, A.', trabajo: 'Instalación caldera', tipo: 'instalacion', km: '3.2 km' },
  { hora: '10:30', cliente: 'Pérez, M.', trabajo: 'Revisión anual gas', tipo: 'revision', km: '7.8 km' },
  { hora: '13:00', cliente: 'López, J.', trabajo: 'Reparación fuga', tipo: 'urgencia', km: '2.1 km' },
  { hora: '16:00', cliente: 'Martín, C.', trabajo: 'Presupuesto reforma', tipo: 'presupuesto', km: '5.4 km' },
];

const TIPO_COLOR: Record<string, string> = {
  instalacion: '#1A5A96',
  revision: '#4A6741',
  urgencia: '#B84E35',
  presupuesto: '#C8922A',
};

const RUTA_STOPS = [
  { x: 20, y: 70, label: 'García' },
  { x: 45, y: 30, label: 'Pérez' },
  { x: 65, y: 55, label: 'López' },
  { x: 82, y: 25, label: 'Martín' },
];

function AgendaMockup() {
  return (
    <div className="bg-[#0F1A27] rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40 font-medium">HOY · MARTES 17 JUN</p>
          <p className="text-sm font-bold text-white">4 trabajos · 18.5 km</p>
        </div>
        <span className="text-xs bg-[#4A6741]/20 text-[#4A6741] font-bold px-2 py-1 rounded-full">
          Optimizada
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {AGENDA_ITEMS.map((item) => (
          <div key={item.hora} className="px-4 py-3 flex items-center gap-3">
            <div className="text-right shrink-0 w-10">
              <p className="text-xs font-bold text-white/60">{item.hora}</p>
            </div>
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: TIPO_COLOR[item.tipo] }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{item.trabajo}</p>
              <p className="text-[10px] text-white/40">{item.cliente}</p>
            </div>
            <div className="shrink-0 flex items-center gap-1 text-white/30">
              <MapPin className="w-3 h-3" />
              <span className="text-[10px]">{item.km}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MapaMockup() {
  return (
    <div className="bg-[#0F1A27] rounded-2xl border border-white/10 overflow-hidden h-44">
      <div className="px-4 py-2.5 border-b border-white/10">
        <p className="text-xs font-bold text-white/60">RUTA OPTIMIZADA</p>
      </div>
      <div className="relative h-32 mx-4 my-2">
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60">
          <defs>
            <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100" height="60" fill="url(#grid)" />
          <polyline
            points={RUTA_STOPS.map((s) => `${s.x},${s.y}`).join(' ')}
            fill="none"
            stroke="#1A5A96"
            strokeWidth="1.5"
            strokeDasharray="3 2"
            opacity="0.7"
          />
          {RUTA_STOPS.map((stop, i) => (
            <g key={i}>
              <circle cx={stop.x} cy={stop.y} r="3.5" fill="#1A5A96" opacity="0.9" />
              <circle cx={stop.x} cy={stop.y} r="2" fill="white" />
              <text
                x={stop.x}
                y={stop.y - 6}
                textAnchor="middle"
                fontSize="5"
                fill="rgba(255,255,255,0.5)"
              >
                {stop.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export default function PlanificacionSection() {
  return (
    <section className="bg-[#1C2535] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/20 text-[#7AB4E0] text-xs font-bold px-3 py-1.5 rounded-full mb-6">
              <Clock className="w-3.5 h-3.5" />
              Planificación inteligente
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-5">
              Tu agenda y rutas,{' '}
              <span className="text-[#C8922A]">siempre optimizadas</span>
            </h2>
            <p className="text-[#8A9BB5] leading-relaxed mb-8">
              Organiza todos tus trabajos del día con un vistazo. TrabFlow calcula la ruta más eficiente para minimizar desplazamientos y maximizar tu tiempo productivo.
            </p>

            <ul className="space-y-4">
              {[
                { icon: MapPin, text: 'Optimización automática de rutas entre clientes' },
                { icon: Clock, text: 'Agenda visual con estados por tipo de trabajo' },
                { icon: ChevronRight, text: 'Partes de campo directamente desde el móvil' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#C8922A]" />
                  </div>
                  <span className="text-sm text-white/70 mt-1.5">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <AgendaMockup />
            <MapaMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
