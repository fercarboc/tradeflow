import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Send, Download, CheckCircle2, Clock } from 'lucide-react';

interface Props {
  onNext: () => void;
}

type SendState = 'idle' | 'sending' | 'sent';

export default function DemoFactura({ onNext }: Props) {
  const [sendState, setSendState] = useState<SendState>('idle');

  const handleSend = () => {
    if (sendState !== 'idle') return;
    setSendState('sending');
    setTimeout(() => setSendState('sent'), 1000);
  };

  return (
    <div className="flex items-center justify-center w-full h-full px-4 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 text-center"
        >
          <h2 className="text-2xl font-black text-white mb-1">Factura generada</h2>
          <p className="text-white/35 text-xs">Generada automáticamente a partir del presupuesto aceptado</p>
        </motion.div>

        {/* Invoice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#0C0C18] border border-white/8 rounded-2xl overflow-hidden mb-4"
        >
          {/* Header */}
          <div className="bg-[#0F0F20] border-b border-white/6 px-5 py-4 flex justify-between items-start">
            <div>
              <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Factura</p>
              <p className="text-base font-black text-white">#F-2025-0089</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/25">24 Jun 2025</p>
              <span className="text-[10px] font-bold bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full mt-1 inline-block">
                Emitida
              </span>
            </div>
          </div>

          <div className="px-5 py-4">
            {/* Client & company */}
            <div className="grid grid-cols-2 gap-4 mb-4 pb-4 border-b border-white/5">
              <div>
                <p className="text-[10px] text-white/25 mb-1 uppercase tracking-wider">Cliente</p>
                <p className="text-sm font-bold text-white">María García</p>
                <p className="text-xs text-white/40">C/ Valencia 245</p>
                <p className="text-xs text-white/40">28006 Madrid</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/25 mb-1 uppercase tracking-wider">Instalador</p>
                <p className="text-sm font-bold text-white">Carlos López</p>
                <p className="text-xs text-white/40">Fontanería López</p>
                <p className="text-xs text-white/40">NIF: 12345678A</p>
              </div>
            </div>

            {/* Concept */}
            <div className="mb-4 pb-4 border-b border-white/5">
              <p className="text-[10px] text-white/25 mb-2 uppercase tracking-wider">Concepto</p>
              <p className="text-sm text-white/80">Reforma de baño: cambio de bañera por plato de ducha antideslizante con mampara. Incluye materiales e instalación completa.</p>
            </div>

            {/* Amounts */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-white/40">
                <span>Base imponible</span>
                <span>1.355,00 €</span>
              </div>
              <div className="flex justify-between text-xs text-white/40">
                <span>IVA (10%)</span>
                <span>135,50 €</span>
              </div>
              <div className="flex justify-between text-sm font-black text-white pt-1 border-t border-white/8">
                <span>TOTAL A PAGAR</span>
                <span className="text-base">1.490,50 €</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 grid grid-cols-3 gap-2">
            <button
              onClick={handleSend}
              className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer col-span-1 ${
                sendState === 'sent'
                  ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                  : 'bg-blue-600 hover:bg-blue-500 text-white'
              }`}
            >
              {sendState === 'sent' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              {sendState === 'sending' ? '...' : sendState === 'sent' ? 'Enviada' : 'Enviar'}
            </button>
            <button className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-white/5 text-white/50 border border-white/8 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              Descargar
            </button>
            <button className="flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl bg-green-600/15 text-green-400 border border-green-500/15 cursor-pointer">
              € Cobrado
            </button>
          </div>
        </motion.div>

        {/* Time indicator */}
        {sendState === 'sent' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#0C0C18] border border-white/8 rounded-xl px-4 py-3 mb-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2 text-white/50 text-xs">
              <Clock className="w-3.5 h-3.5" />
              <span>Factura enviada en <strong className="text-white">15 segundos</strong></span>
            </div>
            <span className="text-[10px] font-bold text-green-400 bg-green-500/10 border border-green-500/15 px-2 py-0.5 rounded-full">
              Trabajo cerrado ✓
            </span>
          </motion.div>
        )}

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
              Ver el impacto total
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
