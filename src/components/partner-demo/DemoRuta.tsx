import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, MapPin, TrendingDown, Clock } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const STOPS = [
  { x: 22, y: 68, label: 'Inicio\nTaller', num: '●', color: '#6B7280' },
  { x: 42, y: 28, label: 'Martínez\nCalentador', num: '1', color: '#3B82F6' },
  { x: 65, y: 52, label: 'García\nBañera', num: '2', color: '#A78BFA' },
  { x: 80, y: 22, label: 'Ruiz\nCaldera', num: '3', color: '#34D399' },
];

const PATH_BEFORE = '22,68 80,22 42,28 65,52';
const PATH_AFTER = '22,68 42,28 65,52 80,22';

export default function DemoRuta({ onNext }: Props) {
  const [showOptimized, setShowOptimized] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setShowOptimized(true), 1000);
    const t2 = setTimeout(() => setShowStats(true), 1800);
    const t3 = setTimeout(() => setShowButton(true), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <MapPin className="w-3.5 h-3.5" />
            Planificación de ruta
          </div>
          <h2 className="text-2xl font-black text-white">Ruta optimizada por IA</h2>
        </motion.div>

        {/* Map comparison */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Before */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0C0C18] border border-red-500/15 rounded-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-red-400/70 uppercase tracking-wider">Sin optimizar</span>
              <span className="text-[10px] text-white/30">38 km</span>
            </div>
            <div className="p-2">
              <svg viewBox="0 0 100 80" className="w-full h-32">
                <defs>
                  <pattern id="grid-before" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M10 0L0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="80" fill="url(#grid-before)" />
                <polyline points={PATH_BEFORE} fill="none" stroke="#F87171" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6" />
                {STOPS.map((s) => (
                  <g key={s.label}>
                    <circle cx={s.x} cy={s.y} r="4" fill={s.color} opacity="0.8" />
                    <circle cx={s.x} cy={s.y} r="2" fill="white" />
                  </g>
                ))}
              </svg>
            </div>
          </motion.div>

          {/* After */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: showOptimized ? 1 : 0, x: showOptimized ? 0 : 20 }}
            transition={{ duration: 0.5 }}
            className="bg-[#0C0C18] border border-green-500/15 rounded-2xl overflow-hidden"
          >
            <div className="px-3 py-2 border-b border-white/5 flex items-center justify-between">
              <span className="text-[10px] font-bold text-green-400/70 uppercase tracking-wider">Optimizada ✓</span>
              <span className="text-[10px] text-green-400/70">29 km</span>
            </div>
            <div className="p-2">
              <svg viewBox="0 0 100 80" className="w-full h-32">
                <defs>
                  <pattern id="grid-after" width="10" height="10" patternUnits="userSpaceOnUse">
                    <path d="M10 0L0 0 0 10" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100" height="80" fill="url(#grid-after)" />
                <polyline points={PATH_AFTER} fill="none" stroke="#34D399" strokeWidth="1.5" opacity="0.8" />
                {/* Animated route indicator */}
                {showOptimized && (
                  <circle r="2.5" fill="#34D399" opacity="0.9">
                    <animateMotion dur="3s" repeatCount="indefinite" path={`M ${PATH_AFTER.replace(/,/g, ' ').replace(/ /g, ' L ').replace('L', 'M')}`} />
                  </circle>
                )}
                {STOPS.map((s, i) => (
                  <g key={s.label}>
                    <circle cx={s.x} cy={s.y} r="5" fill={s.color} opacity="0.2" />
                    <circle cx={s.x} cy={s.y} r="3.5" fill={s.color} opacity="0.85" />
                    <text x={s.x} y={s.y + 1} textAnchor="middle" fontSize="4" fill="white" fontWeight="bold" dominantBaseline="middle">
                      {i === 0 ? '●' : i}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </motion.div>
        </div>

        {/* AI response */}
        <AnimatePresence>
          {showStats && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-600/8 to-purple-600/8 border border-blue-500/12 rounded-2xl px-4 py-4 mb-5"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-[10px] font-black">
                  TF
                </div>
                <div>
                  <p className="text-sm text-white/80 leading-relaxed">
                    He añadido este trabajo a la ruta de mañana y he reordenado los 3 trabajos del día para minimizar desplazamientos.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/8 border border-green-500/12 rounded-xl px-3 py-2.5 text-center">
                  <TrendingDown className="w-4 h-4 text-green-400 mx-auto mb-1" />
                  <p className="text-base font-black text-green-400">−22%</p>
                  <p className="text-[10px] text-white/35">desplazamiento</p>
                </div>
                <div className="bg-blue-500/8 border border-blue-500/12 rounded-xl px-3 py-2.5 text-center">
                  <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
                  <p className="text-base font-black text-blue-400">−9 km</p>
                  <p className="text-[10px] text-white/35">menos recorrido</p>
                </div>
                <div className="bg-purple-500/8 border border-purple-500/12 rounded-xl px-3 py-2.5 text-center">
                  <MapPin className="w-4 h-4 text-purple-400 mx-auto mb-1" />
                  <p className="text-base font-black text-purple-400">3</p>
                  <p className="text-[10px] text-white/35">paradas mañana</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button
              onClick={onNext}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              Ver agenda del día
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
