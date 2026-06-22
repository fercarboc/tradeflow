import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Clock, TrendingUp, Zap, BarChart3 } from 'lucide-react';

interface Props {
  onNext: () => void;
}

function useCountUp(target: number, duration = 1800, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        setValue(target);
        clearInterval(timer);
      } else {
        setValue(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, start]);
  return value;
}

const METRICS = [
  {
    icon: Clock,
    label: 'Horas administrativas ahorradas al mes',
    value: 40,
    unit: 'h',
    prefix: '+',
    color: '#3B82F6',
    bg: 'from-blue-600/10 to-blue-600/5',
    border: 'border-blue-500/15',
    sub: 'Más tiempo para instalar y crecer',
  },
  {
    icon: TrendingUp,
    label: 'Más presupuestos enviados',
    value: 35,
    unit: '%',
    prefix: '+',
    color: '#34D399',
    bg: 'from-green-600/10 to-green-600/5',
    border: 'border-green-500/15',
    sub: 'Mayor conversión de oportunidades',
  },
  {
    icon: Zap,
    label: 'Reducción tiempo de planificación',
    value: 70,
    unit: '%',
    prefix: '−',
    color: '#A78BFA',
    bg: 'from-purple-600/10 to-purple-600/5',
    border: 'border-purple-500/15',
    sub: 'De 2 horas a menos de 30 minutos',
  },
  {
    icon: BarChart3,
    label: 'Facturación procesada más rápido',
    value: 3,
    unit: '×',
    prefix: '',
    suffix: ' más rápida',
    color: '#FBBF24',
    bg: 'from-yellow-600/10 to-yellow-600/5',
    border: 'border-yellow-500/15',
    sub: 'Menos tiempo de cobro, más flujo de caja',
  },
];

export default function DemoDashboard({ onNext }: Props) {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), 400);
    return () => clearTimeout(t);
  }, []);

  const v0 = useCountUp(40, 1600, started);
  const v1 = useCountUp(35, 1600, started);
  const v2 = useCountUp(70, 1600, started);
  const v3 = useCountUp(3, 1200, started);
  const values = [v0, v1, v2, v3];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 py-12">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <BarChart3 className="w-3.5 h-3.5" />
            Impacto en tu negocio
          </div>
          <h2 className="text-3xl lg:text-4xl font-black text-white mb-2 leading-tight">
            Resultados reales.
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              En semanas, no en años.
            </span>
          </h2>
          <p className="text-white/35 text-sm">Basado en datos de instaladores que usan TradeFlow.</p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 mb-8">
          {METRICS.map(({ icon: Icon, label, unit, prefix, suffix, color, bg, border, sub }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className={`bg-gradient-to-br ${bg} border ${border} rounded-2xl px-5 py-4`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${color}20` }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <p className="text-[10px] text-white/40 font-medium leading-tight">{label}</p>
              </div>
              <p className="text-4xl font-black mb-1" style={{ color }}>
                {prefix}{values[i]}{unit}{suffix ?? ''}
              </p>
              <p className="text-[11px] text-white/30 leading-snug">{sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Summary statement */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="bg-gradient-to-r from-blue-600/8 to-purple-600/8 border border-white/6 rounded-2xl px-6 py-4 mb-6 text-center"
        >
          <p className="text-sm text-white/60 leading-relaxed">
            Un instalador que factura{' '}
            <span className="text-white font-bold">4.000 €/mes</span> con TradeFlow
            puede escalar a{' '}
            <span className="text-green-400 font-bold">12.000 €/mes</span>
            {' '}en 90 días, sin contratar personal adicional.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4 }}
          className="flex justify-center"
        >
          <button
            onClick={onNext}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-8 py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/25"
          >
            Ver conclusión
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
