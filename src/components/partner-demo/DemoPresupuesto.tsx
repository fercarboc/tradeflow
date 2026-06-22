import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Smartphone, Download, Save, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const ITEMS = [
  { desc: 'Mano de obra especialista (8h)', ref: '8 h × 45 €/h', total: '360,00 €' },
  { desc: 'Desmontaje y retirada bañera', ref: '1 ud', total: '80,00 €' },
  { desc: 'Plato ducha antideslizante 80×80', ref: '1 ud', total: '320,00 €' },
  { desc: 'Mampara cristal templado 6mm', ref: '1 ud', total: '280,00 €' },
  { desc: 'Grifería monomando termoestática', ref: '1 ud', total: '195,00 €' },
  { desc: 'Materiales e instalación', ref: '1 ud', total: '85,00 €' },
  { desc: 'Desplazamiento', ref: '1 ud', total: '35,00 €' },
];

type SendState = 'idle' | 'sending' | 'sent';

export default function DemoPresupuesto({ onNext }: Props) {
  const [sendState, setSendState] = useState<SendState>('idle');

  const handleSend = () => {
    if (sendState !== 'idle') return;
    setSendState('sending');
    setTimeout(() => setSendState('sent'), 1200);
  };

  return (
    <div className="flex items-center justify-center w-full h-full px-4 py-16">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-center"
        >
          <h2 className="text-2xl font-black text-white mb-1">Presupuesto generado</h2>
          <p className="text-white/35 text-xs">Generado automáticamente por TradeFlow AI en 2 segundos</p>
        </motion.div>

        {/* Budget card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#0C0C18] border border-white/8 rounded-2xl overflow-hidden mb-4"
        >
          {/* Header */}
          <div className="bg-[#0F0F20] border-b border-white/6 px-5 py-4 flex justify-between items-start">
            <div>
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Presupuesto</p>
              <p className="text-base font-black text-white">#P-2025-0247</p>
              <p className="text-xs text-white/40 mt-0.5">María García · Calle Valencia 245</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold bg-yellow-500/15 text-yellow-400 px-2.5 py-1 rounded-full">
                Borrador
              </span>
              <p className="text-[10px] text-white/25 mt-1.5">22/06/2025</p>
            </div>
          </div>

          {/* Line items */}
          <div className="px-5 py-3">
            <div className="space-y-2">
              {ITEMS.map(({ desc, ref, total }) => (
                <div key={desc} className="flex items-center justify-between text-xs py-1 border-b border-white/4 last:border-0">
                  <div className="flex-1 min-w-0 mr-3">
                    <p className="text-white/75 font-medium truncate">{desc}</p>
                    <p className="text-white/25">{ref}</p>
                  </div>
                  <span className="text-white font-semibold shrink-0">{total}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 pt-3 border-t border-white/8 space-y-1.5">
              <div className="flex justify-between text-xs text-white/40">
                <span>Base imponible</span>
                <span>1.355,00 €</span>
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>IVA (10% construcción)</span>
                <span>135,50 €</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-1">
                <span>TOTAL</span>
                <span className="text-lg">1.490,50 €</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 grid grid-cols-3 gap-2">
            <button
              onClick={handleSend}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                sendState === 'sent'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                  : 'bg-[#25D366] hover:bg-[#20C55E] text-white'
              }`}
            >
              {sendState === 'sent' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
              {sendState === 'sending' ? 'Enviando...' : sendState === 'sent' ? 'Enviado' : 'WhatsApp'}
            </button>
            <button className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/15 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
            <button className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-white/5 text-white/50 border border-white/8 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          </div>
        </motion.div>

        {/* Time comparison */}
        <AnimatePresence>
          {sendState === 'sent' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0C0C18] border border-white/8 rounded-2xl px-5 py-4 mb-4"
            >
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Tiempo empleado
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-red-500/8 border border-red-500/15 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-red-400/70 mb-1">Método tradicional</p>
                  <p className="text-2xl font-black text-red-400">25 min</p>
                </div>
                <div className="bg-green-500/8 border border-green-500/15 rounded-xl px-3 py-2.5 text-center">
                  <p className="text-[10px] text-green-400/70 mb-1">Con TradeFlow</p>
                  <p className="text-2xl font-black text-green-400">30 seg</p>
                </div>
              </div>
              <p className="text-center text-xs text-white/30 mt-2.5">
                <span className="text-white font-bold">50× más rápido</span> · Presupuesto enviado correctamente
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {sendState === 'sent' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex justify-center"
          >
            <button
              onClick={onNext}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              Ver respuesta del cliente
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
