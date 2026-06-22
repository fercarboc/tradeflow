import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Send, Download, CheckCircle2, Clock, Loader2, FileCheck, Euro } from 'lucide-react';

interface Props {
  onNext: () => void;
}

type BtnState = 'idle' | 'loading' | 'done';

export default function DemoFactura({ onNext }: Props) {
  const [sendState, setSendState] = useState<BtnState>('idle');
  const [downloadState, setDownloadState] = useState<BtnState>('idle');
  const [cobradoState, setCobradoState] = useState<BtnState>('idle');

  const handleSend = () => {
    if (sendState !== 'idle') return;
    setSendState('loading');
    setTimeout(() => setSendState('done'), 1000);
  };

  const handleDownload = () => {
    if (downloadState !== 'idle') return;
    setDownloadState('loading');
    setTimeout(() => setDownloadState('done'), 1800);
  };

  const handleCobrado = () => {
    if (cobradoState !== 'idle') return;
    setCobradoState('loading');
    setTimeout(() => setCobradoState('done'), 600);
  };

  const canContinue = sendState === 'done';

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="flex flex-col items-center px-4 pt-16 pb-24 min-h-full justify-center">
        <div className="w-full max-w-md">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-center"
          >
            <h2 className="text-2xl font-black text-white mb-1">Factura generada</h2>
            <p className="text-white/35 text-xs">Generada automáticamente a partir del presupuesto aceptado</p>
          </motion.div>

          {/* Invoice card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[#0C0C18] border border-white/8 rounded-2xl overflow-hidden mb-3"
          >
            {/* Header */}
            <div className="bg-[#0F0F20] border-b border-white/6 px-5 py-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Factura</p>
                <p className="text-base font-black text-white">#F-2025-0089</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-white/25">24 Jun 2025</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block transition-all ${
                  cobradoState === 'done'
                    ? 'bg-green-500/15 text-green-400'
                    : sendState === 'done'
                    ? 'bg-blue-500/15 text-blue-400'
                    : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {cobradoState === 'done' ? '€ Cobrada' : sendState === 'done' ? 'Emitida' : 'Pendiente'}
                </span>
              </div>
            </div>

            <div className="px-5 py-3">
              {/* Client & company */}
              <div className="grid grid-cols-2 gap-4 mb-3 pb-3 border-b border-white/5">
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
              <div className="mb-3 pb-3 border-b border-white/5">
                <p className="text-[10px] text-white/25 mb-1.5 uppercase tracking-wider">Concepto</p>
                <p className="text-sm text-white/80">Reforma de baño: cambio de bañera por plato de ducha antideslizante con mampara. Materiales e instalación completa.</p>
              </div>

              {/* Amounts */}
              <div className="space-y-1">
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

            {/* Action buttons — todos interactivos */}
            <div className="px-5 pb-4 grid grid-cols-3 gap-2">

              {/* Enviar email */}
              <button
                onClick={handleSend}
                disabled={sendState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  sendState === 'done'
                    ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {sendState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : sendState === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sendState === 'loading' ? 'Enviando…' : sendState === 'done' ? 'Enviada' : 'Enviar'}
              </button>

              {/* Descargar PDF */}
              <button
                onClick={handleDownload}
                disabled={downloadState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  downloadState === 'done'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20'
                    : 'bg-white/5 text-white/50 border border-white/8 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {downloadState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : downloadState === 'done' ? (
                  <FileCheck className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {downloadState === 'loading' ? 'Generando…' : downloadState === 'done' ? 'Listo ✓' : 'Descargar'}
              </button>

              {/* Registrar cobro */}
              <button
                onClick={handleCobrado}
                disabled={cobradoState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  cobradoState === 'done'
                    ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/20'
                    : 'bg-green-600/15 text-green-400 border border-green-500/15 hover:bg-green-600/25'
                }`}
              >
                {cobradoState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : cobradoState === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Euro className="w-3.5 h-3.5" />
                )}
                {cobradoState === 'loading' ? '...' : cobradoState === 'done' ? 'Cobrada ✓' : 'Registrar cobro'}
              </button>
            </div>
          </motion.div>

          {/* Feedback messages inline */}
          <AnimatePresence>
            {downloadState === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-purple-500/8 border border-purple-500/15 rounded-xl px-4 py-2.5 mb-3"
              >
                <FileCheck className="w-4 h-4 text-purple-400 shrink-0" />
                <p className="text-xs text-white/60">
                  <span className="text-purple-400 font-bold">PDF generado</span> · Factura_F-2025-0089.pdf descargada
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {cobradoState === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-yellow-500/8 border border-yellow-500/15 rounded-xl px-4 py-2.5 mb-3"
              >
                <CheckCircle2 className="w-4 h-4 text-yellow-400 shrink-0" />
                <p className="text-xs text-white/60">
                  <span className="text-yellow-400 font-bold">Cobro registrado</span> · 1.490,50 € · Trabajo completamente cerrado
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time indicator — solo tras enviar */}
          <AnimatePresence>
            {sendState === 'done' && (
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
          </AnimatePresence>

          {/* Continue — siempre accesible por scroll */}
          {canContinue && (
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
    </div>
  );
}
