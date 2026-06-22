import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const DETECTIONS = [
  { label: 'Cambio de bañera por plato de ducha', delay: 0.3 },
  { label: 'Dirección: Calle Valencia 245, Madrid', delay: 0.6 },
  { label: 'Tipo de trabajo: Reforma de baño', delay: 0.9 },
  { label: 'Tiempo estimado: 2 días', delay: 1.2 },
];

export default function DemoAnalisis({ onNext }: Props) {
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowButton(true), 2000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <Sparkles className="w-3.5 h-3.5" />
            Análisis automático completado
          </div>
          <h2 className="text-3xl font-black text-white mb-2">He detectado:</h2>
          <p className="text-white/40 text-sm">La IA ha analizado tu solicitud en menos de 1 segundo.</p>
        </motion.div>

        {/* Detection cards */}
        <div className="space-y-3 mb-8">
          {DETECTIONS.map(({ label, delay }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="flex items-center gap-3 bg-[#0F0F1A] border border-white/6 rounded-xl px-4 py-3.5"
            >
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <span className="text-white font-medium text-sm">{label}</span>
            </motion.div>
          ))}
        </div>

        {/* AI suggestion */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/15 rounded-2xl px-5 py-4 mb-8"
        >
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 text-white text-[10px] font-black">
              TF
            </div>
            <div>
              <p className="text-sm text-white/80 leading-relaxed">
                Basándome en trabajos similares, he preparado un presupuesto detallado con los materiales habituales para este tipo de reforma.
              </p>
              <p className="text-xs text-blue-400/70 mt-1.5 font-medium">
                Precio referencia de mercado · IVA incluido
              </p>
            </div>
          </div>
        </motion.div>

        {showButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button
              onClick={onNext}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-7 py-3.5 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              Generar presupuesto
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
