import {
  FileText,
  Route,
  Bot,
  Receipt,
  PenLine,
  Users,
} from 'lucide-react';

const CARDS = [
  {
    icon: FileText,
    color: '#1A5A96',
    title: 'Presupuestos PDF',
    description: 'Genera presupuestos profesionales en segundos con tu logo, partidas y totales con IVA. Envía por WhatsApp o email.',
  },
  {
    icon: Route,
    color: '#C8922A',
    title: 'Rutas y planificación',
    description: 'Organiza tu jornada con trabajos ordenados por distancia. Menos kilómetros, más horas facturables.',
  },
  {
    icon: Bot,
    color: '#4A6741',
    title: 'Normativa con IA',
    description: 'Consulta REBT, RITE, CTE, Gas, IVA, IRPF y Seguridad Social al instante. Respuestas técnicas en segundos.',
  },
  {
    icon: Receipt,
    color: '#B84E35',
    title: 'Facturación',
    description: 'Convierte presupuestos en facturas con un toque. Control de cobros, pendientes y estado de cada trabajo.',
  },
  {
    icon: PenLine,
    color: '#1A5A96',
    title: 'Firma digital',
    description: 'Tus clientes firman el presupuesto desde el móvil en el acto. Sin impresoras, sin papel, sin esperas.',
  },
  {
    icon: Users,
    color: '#C8922A',
    title: 'Gestión de equipo',
    description: 'Asigna trabajos a tus técnicos, consulta su ubicación y estado en tiempo real desde el panel de control.',
  },
];

export default function FuncionesSection() {
  return (
    <section className="bg-[#F5F6F8] py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-xs font-bold uppercase tracking-widest text-[#1A5A96] mb-3">Todo incluido</p>
          <h2 className="text-3xl lg:text-4xl font-black text-[#1C2535] mb-4">
            Cada herramienta que necesitas
          </h2>
          <p className="text-[#1C2535]/55 max-w-xl mx-auto leading-relaxed">
            Diseñado específicamente para fontaneros, electricistas, instaladores de gas, climatización y reformistas.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {CARDS.map(({ icon: Icon, color, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-gray-200 hover:shadow-lg transition-all group"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ backgroundColor: `${color}15` }}
              >
                <Icon className="w-5 h-5" style={{ color }} />
              </div>
              <h3 className="font-bold text-[#1C2535] mb-2">{title}</h3>
              <p className="text-sm text-[#1C2535]/55 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
