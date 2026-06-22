import { motion } from 'motion/react';
import { ArrowRight, Mail, Phone, Sparkles } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

export default function DemoFinal({ setCurrentPage }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-6 text-center relative">
      {/* Decorative grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="inline-flex items-center gap-2 border border-blue-500/25 bg-blue-500/8 text-blue-400 text-xs font-semibold px-4 py-2 rounded-full mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            Has visto TradeFlow en acción
          </div>

          <h1 className="text-5xl lg:text-[64px] font-black text-white leading-[1.0] mb-6 tracking-tight">
            ¿Qué harías con{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              40 horas más
            </span>
            {' '}al mes?
          </h1>

          <p className="text-lg text-white/40 leading-relaxed mb-12 max-w-lg mx-auto">
            Deja que la IA gestione el trabajo administrativo mientras tú te dedicas a instalar. Más tiempo, más trabajos, más negocio.
          </p>

          {/* Stats row */}
          <div className="flex justify-center gap-8 mb-12 pb-12 border-b border-white/8">
            {[
              { val: '3 meses', label: 'Gratis en beta' },
              { val: '0 €', label: 'Sin tarjeta de crédito' },
              { val: '< 5 min', label: 'Para empezar' },
            ].map(({ val, label }) => (
              <div key={label}>
                <p className="text-2xl font-black text-white">{val}</p>
                <p className="text-xs text-white/30 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="group flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-8 py-4 rounded-2xl transition-all shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer"
            >
              Solicitar demostración personalizada
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Contacto)}
              className="flex items-center justify-center gap-2 text-white/70 font-semibold text-sm px-8 py-4 rounded-2xl border border-white/12 hover:bg-white/4 transition-colors cursor-pointer"
            >
              Hablar con un especialista
            </button>
          </div>

          {/* Contact */}
          <div className="flex items-center justify-center gap-6 text-xs text-white/25">
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              <span>info@trabflow.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>672 336 572</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
