import { TrendingUp, CheckCircle2, Euro, Clock, BarChart3 } from 'lucide-react';

const FEATURES = [
  { icon: TrendingUp, text: 'Métricas de negocio en tiempo real' },
  { icon: Euro, text: 'Seguimiento de facturación mensual' },
  { icon: Clock, text: 'Tiempo medio por tipo de trabajo' },
  { icon: BarChart3, text: 'Tasa de aceptación de presupuestos' },
  { icon: CheckCircle2, text: 'Estado de trabajos pendientes y cerrados' },
];

function MetricCard({
  label,
  value,
  sub,
  color,
  note,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  note: string;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
        <span className="text-[10px] text-gray-300 font-medium italic">{note}</span>
      </div>
      <p className="text-3xl font-black mb-1" style={{ color }}>
        {value}
      </p>
      <p className="text-xs text-gray-400">{sub}</p>
      <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: '68%', backgroundColor: color, opacity: 0.7 }}
        />
      </div>
    </div>
  );
}

export default function DashboardSection() {
  return (
    <section className="bg-white py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#C8922A] mb-4">Panel de control</p>
            <h2 className="text-3xl lg:text-4xl font-black text-[#1C2535] leading-tight mb-5">
              Tu negocio,{' '}
              <span className="text-[#1A5A96]">siempre bajo control</span>
            </h2>
            <p className="text-[#1C2535]/55 leading-relaxed mb-8">
              Consulta en un vistazo cuánto has facturado, qué trabajos tienes pendientes y cómo evoluciona tu negocio. Disponible en móvil y escritorio.
            </p>

            <ul className="space-y-4">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1A5A96]/8 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#1A5A96]" />
                  </div>
                  <span className="text-sm font-medium text-[#1C2535]/75">{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <MetricCard
              label="Facturación mensual"
              value="8.340 €"
              sub="Ejemplo ilustrativo"
              color="#1A5A96"
              note="Ejemplo"
            />
            <div className="grid grid-cols-2 gap-4">
              <MetricCard
                label="Presupuestos"
                value="24"
                sub="Este mes · Ejemplo"
                color="#4A6741"
                note="Ejemplo"
              />
              <MetricCard
                label="Aceptación"
                value="71%"
                sub="Tasa media · Ejemplo"
                color="#C8922A"
                note="Ejemplo"
              />
            </div>

            <div className="bg-[#F5F6F8] rounded-2xl p-5 border border-gray-100">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Trabajos recientes</p>
              {[
                { cliente: 'García, Antonio', trabajo: 'Cambio caldera', estado: 'Cobrado', color: '#4A6741' },
                { cliente: 'López, María', trabajo: 'Inst. eléctrica', estado: 'Pendiente', color: '#C8922A' },
                { cliente: 'Ruiz, Pedro', trabajo: 'Fuga gas', estado: 'En curso', color: '#1A5A96' },
              ].map(({ cliente, trabajo, estado, color }) => (
                <div key={cliente} className="flex items-center justify-between py-2 border-b border-gray-200 last:border-0">
                  <div>
                    <p className="text-xs font-bold text-[#1C2535]">{cliente}</p>
                    <p className="text-[10px] text-gray-400">{trabajo}</p>
                  </div>
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${color}15`, color }}
                  >
                    {estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
