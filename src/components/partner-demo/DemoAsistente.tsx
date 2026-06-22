import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Send, Mic, ArrowRight } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const FULL_MESSAGE = 'Hacer presupuesto para cambio de bañera por plato de ducha en Calle Valencia 245.';

type Stage = 'typing' | 'sending' | 'thinking' | 'done';

export default function DemoAsistente({ onNext }: Props) {
  const [typed, setTyped] = useState('');
  const [stage, setStage] = useState<Stage>('typing');

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setTyped(FULL_MESSAGE.slice(0, i));
      if (i >= FULL_MESSAGE.length) {
        clearInterval(timer);
        setTimeout(() => setStage('sending'), 400);
        setTimeout(() => setStage('thinking'), 900);
        setTimeout(() => setStage('done'), 3200);
      }
    }, 28);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Asistente IA — TradeFlow
          </div>
          <h2 className="text-2xl font-black text-white">¿Qué necesitas hacer?</h2>
        </motion.div>

        {/* Chat messages */}
        <div className="space-y-3 mb-6 min-h-[120px]">
          {/* System message */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 text-white text-[10px] font-black">
              TF
            </div>
            <div className="bg-[#0F0F1A] border border-white/6 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-white/70 max-w-xs">
              Hola, Carlos. ¿En qué puedo ayudarte hoy?
            </div>
          </motion.div>

          {/* User message (typing) */}
          {typed.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-3 justify-end"
            >
              <div className="bg-blue-600 rounded-2xl rounded-tr-sm px-4 py-3 text-sm text-white max-w-xs">
                {typed}
                {stage === 'typing' && (
                  <span className="inline-block w-0.5 h-4 bg-white/70 ml-0.5 animate-pulse align-middle" />
                )}
              </div>
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-white/60 text-[10px] font-bold">
                C
              </div>
            </motion.div>
          )}

          {/* AI thinking */}
          {stage === 'thinking' && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-3"
            >
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </div>
              <div className="bg-[#0F0F1A] border border-white/6 rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </div>

        {/* Input bar */}
        <div className="bg-[#0F0F1A] border border-white/8 rounded-2xl px-4 py-3 flex items-center gap-3 mb-8">
          <div className="flex-1 text-sm text-white/20 italic">
            {stage === 'typing' ? 'Escribiendo...' : 'Mensaje enviado'}
          </div>
          <Mic className="w-4 h-4 text-white/20" />
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${stage === 'sending' ? 'bg-blue-500' : 'bg-white/5'}`}>
            <Send className="w-3.5 h-3.5 text-white/40" />
          </div>
        </div>

        {/* Continue button */}
        {stage === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button
              onClick={onNext}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              Ver respuesta de la IA
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
