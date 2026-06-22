import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, CheckCircle2, CalendarPlus, Route, ShoppingCart, ClipboardList } from 'lucide-react';

interface Props {
  onNext: () => void;
}

function ConfettiPiece({ index }: { index: number }) {
  const colors = ['#3B82F6', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#60A5FA'];
  const color = colors[index % colors.length];
  const left = (index * 7.3) % 100;
  const delay = (index * 0.08) % 1;
  const size = 6 + (index % 4) * 2;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${left}%`,
        top: '-10px',
        width: size,
        height: size,
        backgroundColor: color,
        borderRadius: index % 2 === 0 ? '50%' : '2px',
        animation: `confettiFall ${1.5 + delay}s ease-in ${delay}s forwards`,
        opacity: 0,
      }}
    />
  );
}

const OPTIONS = [
  { icon: CalendarPlus, label: 'Añadir a agenda', color: '#3B82F6' },
  { icon: Route, label: 'Añadir a ruta', color: '#A78BFA', selected: true },
  { icon: ShoppingCart, label: 'Solicitar materiales', color: '#FBBF24' },
  { icon: ClipboardList, label: 'Crear orden de trabajo', color: '#34D399' },
];

export default function DemoClienteAcepta({ onNext }: Props) {
  const [showOptions, setShowOptions] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showNext, setShowNext] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowOptions(true), 1500);
    return () => clearTimeout(t);
  }, []);

  const handleSelect = (label: string) => {
    if (selected) return;
    setSelected(label);
    setTimeout(() => setShowNext(true), 400);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4 relative overflow-hidden">
      {/* Confetti */}
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {Array.from({ length: 30 }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}

      <div className="w-full max-w-md">
        {/* WhatsApp notification */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="bg-[#0F0F1A] border border-white/8 rounded-2xl px-5 py-5 mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
                <path d="M12 0C5.373 0 0 5.373 0 12c0 2.082.535 4.04 1.47 5.748L.036 23.456a.5.5 0 0 0 .509.544l5.877-.844A11.954 11.954 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.892 0-3.666-.51-5.19-1.4l-.37-.22-3.836.55.572-3.715-.238-.375A9.983 9.983 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-white/35 font-medium">WHATSAPP</p>
              <p className="text-sm font-bold text-white">María García</p>
            </div>
            <div className="ml-auto">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>

          <div className="bg-[#17171F] rounded-xl px-4 py-3 border border-white/4">
            <p className="text-sm text-white/80 mb-1">
              ✅ <strong>María García</strong> ha aceptado el presupuesto
            </p>
            <p className="text-xs text-white/35">Presupuesto #P-2025-0247 · 1.490,50 €</p>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <p className="text-xs text-green-400 font-semibold">Trabajo confirmado · hace 2 minutos</p>
          </div>
        </motion.div>

        {/* Next steps */}
        <AnimatePresence>
          {showOptions && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <p className="text-center text-white/50 text-sm mb-4">¿Qué quieres hacer ahora?</p>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {OPTIONS.map(({ icon: Icon, label, color }) => (
                  <button
                    key={label}
                    onClick={() => handleSelect(label)}
                    className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border transition-all cursor-pointer ${
                      selected === label
                        ? 'border-blue-500/40 bg-blue-500/10'
                        : selected
                        ? 'border-white/4 bg-white/2 opacity-40'
                        : 'border-white/6 bg-[#0F0F1A] hover:border-white/15 hover:bg-white/3'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: `${color}18` }}
                    >
                      <Icon className="w-4.5 h-4.5" style={{ color }} />
                    </div>
                    <span className="text-xs font-semibold text-white/70">{label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {showNext && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            <button
              onClick={onNext}
              className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
            >
              Ver optimización de ruta
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
