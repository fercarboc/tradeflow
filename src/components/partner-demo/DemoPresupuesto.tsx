import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Smartphone, Download, Save, CheckCircle2, Clock, Loader2, FileCheck } from 'lucide-react';

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

type BtnState = 'idle' | 'loading' | 'done';

export default function DemoPresupuesto({ onNext }: Props) {
  const [waState, setWaState] = useState<BtnState>('idle');
  const [pdfState, setPdfState] = useState<BtnState>('idle');
  const [saveState, setSaveState] = useState<BtnState>('idle');

  const allSent = waState === 'done';

  const handleWA = () => {
    if (waState !== 'idle') return;
    setWaState('loading');
    setTimeout(() => setWaState('done'), 1200);
  };

  const handlePDF = () => {
    if (pdfState !== 'idle') return;
    setPdfState('loading');
    // Simulate PDF generation
    setTimeout(() => setPdfState('done'), 1800);
  };

  const handleSave = () => {
    if (saveState !== 'idle') return;
    setSaveState('loading');
    setTimeout(() => setSaveState('done'), 700);
  };

  return (
    // Scrollable container — evita que el botón Continuar quede fuera de vista
    <div className="w-full h-full overflow-y-auto">
      <div className="flex flex-col items-center px-4 pt-16 pb-24 min-h-full justify-center">
        <div className="w-full max-w-xl">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 text-center"
          >
            <h2 className="text-2xl font-black text-white mb-1">Presupuesto generado</h2>
            <p className="text-white/35 text-xs">Generado automáticamente por TradeFlow AI en 2 segundos</p>
          </motion.div>

          {/* Budget card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-[#0C0C18] border border-white/8 rounded-2xl overflow-hidden mb-3"
          >
            {/* Header */}
            <div className="bg-[#0F0F20] border-b border-white/6 px-5 py-3 flex justify-between items-center">
              <div>
                <p className="text-[10px] text-white/30 font-medium uppercase tracking-wider">Presupuesto</p>
                <p className="text-base font-black text-white">#P-2025-0247</p>
                <p className="text-xs text-white/40">María García · Calle Valencia 245</p>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${
                  waState === 'done'
                    ? 'bg-green-500/15 text-green-400'
                    : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {waState === 'done' ? '✓ Enviado' : 'Borrador'}
                </span>
                <p className="text-[10px] text-white/25 mt-1.5">22/06/2025</p>
              </div>
            </div>

            {/* Line items */}
            <div className="px-5 py-3">
              <div className="space-y-1.5">
                {ITEMS.map(({ desc, ref, total }) => (
                  <div key={desc} className="flex items-center justify-between text-xs py-0.5 border-b border-white/4 last:border-0">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-white/75 font-medium truncate">{desc}</p>
                      <p className="text-white/25 text-[10px]">{ref}</p>
                    </div>
                    <span className="text-white font-semibold shrink-0">{total}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-white/8 space-y-1">
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

            {/* Action buttons — todos interactivos */}
            <div className="px-5 pb-4 grid grid-cols-3 gap-2">

              {/* WhatsApp */}
              <button
                onClick={handleWA}
                disabled={waState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  waState === 'done'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                    : 'bg-[#25D366] hover:bg-[#20C55E] text-white'
                }`}
              >
                {waState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : waState === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Smartphone className="w-3.5 h-3.5" />
                )}
                {waState === 'loading' ? 'Enviando…' : waState === 'done' ? 'Enviado' : 'WhatsApp'}
              </button>

              {/* PDF */}
              <button
                onClick={handlePDF}
                disabled={pdfState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  pdfState === 'done'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20'
                    : 'bg-blue-600/20 text-blue-400 border border-blue-500/15 hover:bg-blue-600/30'
                }`}
              >
                {pdfState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : pdfState === 'done' ? (
                  <FileCheck className="w-3.5 h-3.5" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {pdfState === 'loading' ? 'Generando…' : pdfState === 'done' ? 'Listo ✓' : 'PDF'}
              </button>

              {/* Guardar */}
              <button
                onClick={handleSave}
                disabled={saveState === 'loading'}
                className={`flex items-center justify-center gap-1.5 text-xs font-bold py-2.5 rounded-xl transition-all cursor-pointer ${
                  saveState === 'done'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/20'
                    : 'bg-white/5 text-white/50 border border-white/8 hover:bg-white/10 hover:text-white/70'
                }`}
              >
                {saveState === 'loading' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveState === 'done' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saveState === 'loading' ? 'Guardando…' : saveState === 'done' ? 'Guardado' : 'Guardar'}
              </button>
            </div>
          </motion.div>

          {/* Feedback inline al enviar por PDF */}
          <AnimatePresence>
            {pdfState === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 bg-blue-500/8 border border-blue-500/15 rounded-xl px-4 py-2.5 mb-3"
              >
                <FileCheck className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-xs text-white/60">
                  <span className="text-blue-400 font-bold">PDF generado</span> · Presupuesto_P-2025-0247.pdf listo para compartir
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Time comparison — compacto, no ocupa mucho espacio */}
          <AnimatePresence>
            {allSent && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0C0C18] border border-white/8 rounded-xl px-4 py-3.5 mb-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="w-4 h-4 text-white/30 shrink-0" />
                  <p className="text-xs font-bold text-white/50 uppercase tracking-wider">Tiempo empleado</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-500/8 border border-red-500/15 rounded-lg px-3 py-2 text-center">
                    <p className="text-[10px] text-red-400/60 mb-0.5">Método tradicional</p>
                    <p className="text-xl font-black text-red-400">25 min</p>
                  </div>
                  <div className="bg-green-500/8 border border-green-500/15 rounded-lg px-3 py-2 text-center">
                    <p className="text-[10px] text-green-400/60 mb-0.5">Con TradeFlow AI</p>
                    <p className="text-xl font-black text-green-400">30 seg</p>
                  </div>
                </div>
                <p className="text-center text-xs text-white/30 mt-2">
                  <span className="text-white font-bold">50× más rápido</span> · Presupuesto enviado ✓
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Continue button — siempre visible gracias al scroll */}
          {allSent && (
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
    </div>
  );
}
