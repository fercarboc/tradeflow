import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { ActivePage } from '../../types';
import DemoIntro from './DemoIntro';
import DemoAsistente from './DemoAsistente';
import DemoAnalisis from './DemoAnalisis';
import DemoPresupuesto from './DemoPresupuesto';
import DemoClienteAcepta from './DemoClienteAcepta';
import DemoRuta from './DemoRuta';
import DemoJornada from './DemoJornada';
import DemoCompletado from './DemoCompletado';
import DemoFactura from './DemoFactura';
import DemoDashboard from './DemoDashboard';
import DemoFinal from './DemoFinal';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

const DEMO_STEPS = 10;

export default function PartnerDemoView({ setCurrentPage }: Props) {
  const [step, setStep] = useState(0);

  const next = useCallback(() => setStep((s) => Math.min(s + 1, DEMO_STEPS)), []);
  const prev = useCallback(() => setStep((s) => Math.max(s - 1, 1)), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCurrentPage(ActivePage.Home);
      if ((e.key === 'ArrowRight' || e.key === ' ') && step > 0 && step < DEMO_STEPS) next();
      if (e.key === 'ArrowLeft' && step > 1) prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, step, setCurrentPage]);

  const renderScreen = () => {
    switch (step) {
      case 0: return <DemoIntro onStart={next} />;
      case 1: return <DemoAsistente onNext={next} />;
      case 2: return <DemoAnalisis onNext={next} />;
      case 3: return <DemoPresupuesto onNext={next} />;
      case 4: return <DemoClienteAcepta onNext={next} />;
      case 5: return <DemoRuta onNext={next} />;
      case 6: return <DemoJornada onNext={next} />;
      case 7: return <DemoCompletado onNext={next} />;
      case 8: return <DemoFactura onNext={next} />;
      case 9: return <DemoDashboard onNext={next} />;
      case 10: return <DemoFinal setCurrentPage={setCurrentPage} />;
      default: return <DemoIntro onStart={next} />;
    }
  };

  return (
    <div className="fixed inset-0 bg-[#06060F] overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Ambient glows */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/3 w-[600px] h-[600px] bg-purple-600/4 rounded-full blur-[120px]" />
      </div>

      {/* Exit button */}
      <button
        onClick={() => setCurrentPage(ActivePage.Home)}
        className="absolute top-5 right-5 z-50 flex items-center gap-1.5 text-white/25 hover:text-white/60 transition-colors text-xs font-medium cursor-pointer"
      >
        <X className="w-4 h-4" />
        Salir
      </button>

      {/* Progress bar (steps 1-9) */}
      {step > 0 && step <= 9 && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-50">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-500 ${
                i === step - 1
                  ? 'w-6 h-1.5 bg-blue-500'
                  : i < step - 1
                  ? 'w-2 h-1.5 bg-blue-500/40'
                  : 'w-2 h-1.5 bg-white/12'
              }`}
            />
          ))}
          <span className="ml-2 text-[10px] text-white/20">{step}/9</span>
        </div>
      )}

      {/* Back */}
      {step > 1 && step < DEMO_STEPS && (
        <button
          onClick={prev}
          className="absolute bottom-6 left-6 z-50 text-xs text-white/20 hover:text-white/50 transition-colors cursor-pointer"
        >
          ← Anterior
        </button>
      )}

      {/* Keyboard hint */}
      {step > 0 && step < DEMO_STEPS && (
        <div className="absolute bottom-6 right-6 z-50 text-[10px] text-white/12">
          ← → Navegar · ESC Salir
        </div>
      )}

      {/* Screen */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="w-full h-full"
        >
          {renderScreen()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
