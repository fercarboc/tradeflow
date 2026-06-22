import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, Clock, FileText } from 'lucide-react';

interface Props {
  onNext: () => void;
}

export default function DemoCompletado({ onNext }: Props) {
  const [marked, setMarked] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  const handleMark = () => {
    setMarked(true);
    setTimeout(() => setShowPrompt(true), 800);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h2 className="text-3xl font-black text-white mb-2">Trabajo finalizado</h2>
          <p className="text-white/40 text-sm">Cambio de bañera por plato de ducha · María García</p>
        </motion.div>

        {/* Work card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className={`bg-[#0C0C18] border rounded-2xl px-5 py-5 mb-6 transition-all ${
            marked ? 'border-green-500/25 bg-green-500/4' : 'border-white/8'
          }`}
        >
          <div className="flex items-center gap-4 mb-5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
              marked ? 'bg-green-500/20' : 'bg-blue-500/15'
            }`}>
              <CheckCircle2 className={`w-6 h-6 transition-colors ${marked ? 'text-green-400' : 'text-blue-400'}`} />
            </div>
            <div className="text-left">
              <p className="font-bold text-white">Cambio bañera → plato ducha</p>
              <p className="text-xs text-white/40">C/ Valencia 245 · Hoy 11:30 – 14:00</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white/3 border border-white/5 rounded-xl px-2 py-2.5 text-center">
              <Clock className="w-4 h-4 text-white/30 mx-auto mb-1" />
              <p className="text-sm font-black text-white">2,5h</p>
              <p className="text-[10px] text-white/30">duración</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-2 py-2.5 text-center">
              <FileText className="w-4 h-4 text-white/30 mx-auto mb-1" />
              <p className="text-sm font-black text-white">4</p>
              <p className="text-[10px] text-white/30">fotos</p>
            </div>
            <div className="bg-white/3 border border-white/5 rounded-xl px-2 py-2.5 text-center">
              <CheckCircle2 className="w-4 h-4 text-white/30 mx-auto mb-1" />
              <p className="text-sm font-black text-white">Firmado</p>
              <p className="text-[10px] text-white/30">parte campo</p>
            </div>
          </div>

          {!marked ? (
            <button
              onClick={handleMark}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer"
            >
              ✓ Marcar como completado
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-2 text-green-400 text-sm font-bold py-3"
            >
              <CheckCircle2 className="w-5 h-5" />
              Trabajo completado · 14:02
            </motion.div>
          )}
        </motion.div>

        {/* AI prompt */}
        <AnimatePresence>
          {showPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 border border-blue-500/15 rounded-2xl px-5 py-4 mb-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-[10px] font-black">
                  TF
                </div>
                <p className="text-sm text-white/80 leading-relaxed">
                  ¡Trabajo registrado! ¿Quieres que genere la factura para María García ahora?
                </p>
              </div>
              <button
                onClick={onNext}
                className="group w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
              >
                Generar factura
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
