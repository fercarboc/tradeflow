import { ArrowRight, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  onStart: () => void;
}

export default function DemoIntro({ onStart }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="inline-flex items-center gap-2 border border-blue-500/25 bg-blue-500/8 text-blue-400 text-xs font-semibold px-4 py-2 rounded-full mb-10"
        >
          <Zap className="w-3.5 h-3.5" />
          Demo interactiva · Para socios y partners
        </motion.div>

        <h1 className="text-5xl sm:text-6xl lg:text-[76px] font-black text-white leading-[1.0] mb-6 tracking-tight">
          Gestiona una semana{' '}
          <br className="hidden sm:block" />
          de trabajo{' '}
          <span className="bg-gradient-to-r from-blue-400 via-blue-300 to-purple-400 bg-clip-text text-transparent">
            en minutos.
          </span>
        </h1>

        <p className="text-lg lg:text-xl text-white/45 leading-relaxed mb-14 max-w-xl mx-auto">
          Presupuestos, rutas, clientes y facturación impulsados por IA. Sigue la historia de Carlos, un fontanero que transforma su negocio.
        </p>

        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          onClick={onStart}
          className="group inline-flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-base px-8 py-4 rounded-2xl transition-all duration-300 shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 cursor-pointer"
        >
          Ver demostración
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </motion.button>

        <p className="mt-6 text-xs text-white/15">
          ~5 minutos · Historia real · Completamente interactiva
        </p>
      </motion.div>

      {/* Decorative grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
