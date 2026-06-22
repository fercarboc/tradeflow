import { motion } from 'motion/react';
import { ArrowRight, MapPin, CheckCircle2 } from 'lucide-react';

interface Props {
  onNext: () => void;
}

const TRABAJOS = [
  {
    hora: '09:00',
    duracion: '2h',
    cliente: 'Antonio Martínez',
    trabajo: 'Instalación calentador eléctrico',
    direccion: 'C/ Goya 78, Madrid',
    estado: 'completado',
    color: '#34D399',
    km: '4,2 km',
  },
  {
    hora: '11:30',
    duracion: '2,5h',
    cliente: 'María García',
    trabajo: 'Cambio bañera por plato de ducha',
    direccion: 'C/ Valencia 245, Madrid',
    estado: 'hoy',
    color: '#3B82F6',
    km: '3,1 km',
  },
  {
    hora: '16:00',
    duracion: '1h',
    cliente: 'Pedro Ruiz',
    trabajo: 'Revisión anual caldera',
    direccion: 'C/ Alcalá 310, Madrid',
    estado: 'pendiente',
    color: '#FBBF24',
    km: '5,8 km',
  },
];

const ESTADO_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  completado: { bg: 'bg-green-500/12 border-green-500/20', text: 'text-green-400', label: 'Completado' },
  hoy: { bg: 'bg-blue-500/12 border-blue-500/20', text: 'text-blue-400', label: '← Nuevo' },
  pendiente: { bg: 'bg-yellow-500/12 border-yellow-500/20', text: 'text-yellow-400', label: 'Pendiente' },
};

export default function DemoJornada({ onNext }: Props) {
  return (
    <div className="flex flex-col items-center justify-center w-full h-full px-4">
      <div className="w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <h2 className="text-2xl font-black text-white mb-1">Jornada de mañana</h2>
          <p className="text-white/35 text-sm">Martes, 24 de junio · Ruta optimizada</p>
        </motion.div>

        {/* Summary bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0F0F1A] border border-white/6 rounded-2xl px-5 py-3.5 mb-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-5">
            <div className="text-center">
              <p className="text-xl font-black text-white">3</p>
              <p className="text-[10px] text-white/30">trabajos</p>
            </div>
            <div className="w-px h-8 bg-white/8" />
            <div className="text-center">
              <p className="text-xl font-black text-white">13,1</p>
              <p className="text-[10px] text-white/30">km total</p>
            </div>
            <div className="w-px h-8 bg-white/8" />
            <div className="text-center">
              <p className="text-xl font-black text-white">5,5h</p>
              <p className="text-[10px] text-white/30">productivo</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/15 rounded-xl px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-bold text-green-400">Ruta óptima</span>
          </div>
        </motion.div>

        {/* Work items */}
        <div className="space-y-2.5 mb-6">
          {TRABAJOS.map(({ hora, duracion, cliente, trabajo, direccion, estado, color, km }, i) => (
            <motion.div
              key={hora}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.15 }}
              className={`bg-[#0C0C18] border rounded-2xl px-4 py-3.5 flex gap-3 ${
                estado === 'hoy' ? 'border-blue-500/25 bg-blue-500/4' : 'border-white/6'
              }`}
            >
              {/* Time */}
              <div className="text-right shrink-0 w-12 pt-0.5">
                <p className="text-sm font-black text-white">{hora}</p>
                <p className="text-[10px] text-white/30">{duracion}</p>
              </div>

              {/* Color line */}
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div className="w-px flex-1 mt-1" style={{ backgroundColor: `${color}30` }} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{trabajo}</p>
                    <p className="text-xs text-white/40">{cliente}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold border px-2 py-0.5 rounded-full ${ESTADO_STYLE[estado].bg} ${ESTADO_STYLE[estado].text}`}>
                    {ESTADO_STYLE[estado].label}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-[10px] text-white/30">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate">{direccion}</span>
                  <span className="ml-1 shrink-0">· {km}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex justify-center"
        >
          <button
            onClick={onNext}
            className="group flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all cursor-pointer shadow-lg shadow-blue-500/20"
          >
            Marcar trabajo completado
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </motion.div>
      </div>
    </div>
  );
}
