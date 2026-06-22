import { ActivePage } from '../types';
import {
  BookOpen, Shield, Zap, CheckCircle, ArrowRight, Lock,
  Wrench, FlameKindling, Droplets, Wind, Building2, Sun,
} from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

const NORMATIVAS = [
  { icon: <Zap className="w-5 h-5" />, id: 'REBT', name: 'REBT', full: 'Reglamento Electrotécnico BT', plan: 'Básico', color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20', chunks: 361 },
  { icon: <Wrench className="w-5 h-5" />, id: 'OFICIOS', name: 'Fichas de Oficio', full: '20 oficios con actuaciones técnicas', plan: 'Básico', color: 'text-emerald-400', bg: 'bg-emerald-400/10 border-emerald-400/20', chunks: 1076 },
  { icon: <Wind className="w-5 h-5" />, id: 'RITE', name: 'RITE', full: 'Reglamento Instalaciones Térmicas', plan: 'Empresa', color: 'text-blue-400', bg: 'bg-blue-400/10 border-blue-400/20', chunks: 182 },
  { icon: <Building2 className="w-5 h-5" />, id: 'CTE', name: 'CTE', full: 'Código Técnico de la Edificación', plan: 'Empresa Plus', color: 'text-purple-400', bg: 'bg-purple-400/10 border-purple-400/20', chunks: 737 },
  { icon: <FlameKindling className="w-5 h-5" />, id: 'GAS', name: 'GAS', full: 'Reglamento Combustibles Gaseosos', plan: 'Empresa Plus', color: 'text-orange-400', bg: 'bg-orange-400/10 border-orange-400/20', chunks: 113 },
  { icon: <Droplets className="w-5 h-5" />, id: 'ACS', name: 'ACS', full: 'Prevención y Control de Legionella', plan: 'Empresa Plus', color: 'text-cyan-400', bg: 'bg-cyan-400/10 border-cyan-400/20', chunks: 48 },
  { icon: <Sun className="w-5 h-5" />, id: 'GUIAS', name: 'Guías IDAE', full: 'Guías técnicas IDAE eficiencia energética', plan: 'Empresa Plus', color: 'text-amber-400', bg: 'bg-amber-400/10 border-amber-400/20', chunks: 408 },
];

const PLAN_FEATURES = [
  {
    plan: 'Básico',
    price: '29€/mes',
    color: 'border-slate-600',
    headerColor: 'bg-slate-800',
    categories: ['OFICIOS', 'REBT'],
    queries: '5 consultas/día',
  },
  {
    plan: 'Empresa',
    price: '89€/mes',
    color: 'border-blue-600/40',
    headerColor: 'bg-blue-900/30',
    categories: ['OFICIOS', 'REBT', 'RITE'],
    queries: '30 consultas/día',
  },
  {
    plan: 'Empresa Plus',
    price: '129€/mes',
    color: 'border-violet-500/40',
    headerColor: 'bg-violet-900/30',
    categories: ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS'],
    queries: 'Ilimitadas',
    highlight: true,
  },
];

const EXAMPLE_QUESTIONS = [
  { q: '¿Qué sección mínima necesita un cable monofásico de 20A en instalación empotrada?', cat: 'REBT', icon: <Zap className="w-3.5 h-3.5" /> },
  { q: '¿Cuál es la temperatura mínima de distribución de ACS para prevenir Legionella?', cat: 'ACS', icon: <Droplets className="w-3.5 h-3.5" /> },
  { q: '¿Qué distancia mínima hay que respetar entre tuberías de gas y conductos eléctricos?', cat: 'GAS', icon: <FlameKindling className="w-3.5 h-3.5" /> },
  { q: '¿Qué exige el RITE para el mantenimiento de una climatizadora de 15kW?', cat: 'RITE', icon: <Wind className="w-3.5 h-3.5" /> },
  { q: '¿Cuántos circuitos mínimos tiene que tener una vivienda según ITC-BT-25?', cat: 'REBT', icon: <Zap className="w-3.5 h-3.5" /> },
  { q: '¿Qué grado de protección IP necesita un cuadro eléctrico en una cocina?', cat: 'REBT', icon: <Zap className="w-3.5 h-3.5" /> },
];

const ADVANTAGES = [
  { icon: <Shield className="w-5 h-5 text-emerald-400" />, title: 'Respuestas verificadas', desc: 'Cada respuesta cita el artículo exacto del reglamento oficial. Nada de suposiciones.' },
  { icon: <Zap className="w-5 h-5 text-yellow-400" />, title: 'Respuesta en segundos', desc: 'Sin buscar manualmente en 300 páginas de PDF. Pregunta en lenguaje natural y obtén la respuesta.' },
  { icon: <BookOpen className="w-5 h-5 text-violet-400" />, title: '+2.900 fragmentos indexados', desc: 'REBT, RITE, CTE, GAS, ACS y Guías IDAE completas, con búsqueda semántica inteligente.' },
  { icon: <Wrench className="w-5 h-5 text-blue-400" />, title: '20 oficios cubiertos', desc: 'Fichas técnicas de actuaciones por oficio: electricidad, fontanería, climatización, gas y más.' },
];

export default function AsistenteTecnicoPublicView({ setCurrentPage }: Props) {
  return (
    <div className="min-h-screen bg-[#020B16] text-white">

      {/* Hero */}
      <section className="relative overflow-hidden py-20 px-6">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto text-center space-y-6 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-violet-600/15 border border-violet-500/30 rounded-full px-4 py-1.5"
          >
            <BookOpen className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">Asistente Técnico de Normativa</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl md:text-5xl font-black text-white leading-tight"
          >
            La normativa técnica<br />
            <span className="text-[#00CFE8]">al alcance de tu pregunta</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Pregunta en lenguaje natural sobre normativa técnica (REBT, RITE, CTE, Gas),
            fiscal (IVA, IRPF, Renta) o laboral (Seguridad Social, RETA, cotización).
            Obtén la respuesta exacta con la cita del artículo oficial en segundos —
            sin buscar manualmente en cientos de páginas de PDF.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-7 py-3.5 rounded-xl cursor-pointer transition-all text-sm shadow-lg shadow-violet-900/40"
            >
              Empezar gratis <ArrowRight className="w-4 h-4" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* Ejemplo de consulta animada */}
      <section className="py-14 px-6 bg-slate-900/40">
        <div className="max-w-3xl mx-auto space-y-6">
          <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-widest">Preguntas que ya puedes hacer hoy</p>
          <div className="grid md:grid-cols-2 gap-3">
            {EXAMPLE_QUESTIONS.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3.5 flex gap-3 items-start"
              >
                <span className="mt-0.5 text-slate-400 shrink-0">{item.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-snug">{item.q}</p>
                  <span className="text-[10px] font-bold text-slate-500 mt-1 block">{item.cat}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Ventajas */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">¿Por qué los instaladores lo necesitan?</h2>
            <p className="text-slate-400 text-sm">Tiempo, seguridad y respaldo legal en cada instalación</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {ADVANTAGES.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center shrink-0">
                  {a.icon}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{a.title}</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{a.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Normativa indexada */}
      <section className="py-16 px-6 bg-slate-900/40">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">Normativa técnica indexada</h2>
            <p className="text-slate-400 text-sm">+2.900 fragmentos semánticos de los reglamentos oficiales más usados en España</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {NORMATIVAS.map((n) => (
              <div key={n.id} className={`rounded-2xl border p-4 space-y-2.5 ${n.bg}`}>
                <div className={`flex items-center gap-2.5 ${n.color}`}>
                  {n.icon}
                  <span className="font-bold text-sm">{n.name}</span>
                  <span className="ml-auto text-[10px] font-semibold bg-slate-800/60 px-2 py-0.5 rounded-full text-slate-400">
                    {n.plan}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-snug">{n.full}</p>
                <p className="text-[10px] text-slate-500">{n.chunks.toLocaleString()} fragmentos indexados</p>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-slate-500">
            Base de conocimiento en constante crecimiento. Próximamente: Fotovoltaica, Contra Incendios, Telecomunicaciones ICT.
          </p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">¿Cómo funciona?</h2>
          </div>
          <div className="space-y-4">
            {[
              { step: '1', title: 'Escribe tu pregunta técnica', desc: 'En lenguaje natural, como preguntarías a un compañero experto. Sin tecnicismos forzados.' },
              { step: '2', title: 'Búsqueda semántica en normativa', desc: 'El sistema busca en miles de fragmentos de reglamentos usando IA vectorial para encontrar los más relevantes.' },
              { step: '3', title: 'Respuesta con cita oficial', desc: 'Recibes la respuesta práctica + el artículo exacto que la respalda, con referencia al BOE.' },
              { step: '4', title: 'Valora la respuesta', desc: 'Si la respuesta fue útil o no, el sistema aprende y mejora continuamente.' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-xl bg-violet-600 text-white text-sm font-black flex items-center justify-center shrink-0 mt-0.5">
                  {item.step}
                </div>
                <div>
                  <p className="font-bold text-white text-sm">{item.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Planes */}
      <section className="py-16 px-6 bg-slate-900/40">
        <div className="max-w-4xl mx-auto space-y-10">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-white">Acceso por plan</h2>
            <p className="text-slate-400 text-sm">El Asistente Técnico está incluido en todos los planes de TrabFlow</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {PLAN_FEATURES.map((p) => (
              <div key={p.plan} className={`rounded-2xl border p-5 space-y-4 ${p.color} ${p.highlight ? 'ring-1 ring-violet-500/40' : ''}`}>
                <div className={`rounded-xl px-3 py-2 ${p.headerColor}`}>
                  <p className="font-black text-white text-sm">{p.plan}</p>
                  <p className="text-[#00CFE8] text-xs font-bold">{p.price}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Normativa accesible</p>
                  <div className="space-y-1.5">
                    {NORMATIVAS.map(n => {
                      const hasAccess = p.categories.includes(n.id);
                      return (
                        <div key={n.id} className={`flex items-center gap-2 text-xs ${hasAccess ? 'text-slate-200' : 'text-slate-600'}`}>
                          {hasAccess
                            ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            : <Lock className="w-3.5 h-3.5 shrink-0" />
                          }
                          {n.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="pt-1 border-t border-slate-700/40">
                  <p className="text-xs text-slate-400">Consultas: <span className="font-bold text-slate-200">{p.queries}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-20 px-6">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-3xl font-black text-white">¿Listo para consultar normativa en segundos?</h2>
          <p className="text-slate-400 leading-relaxed">
            Incluido en tu suscripción TrabFlow. Sin coste adicional.
            Disponible en PC y móvil.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => setCurrentPage(ActivePage.Registro)}
              className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-bold px-8 py-3.5 rounded-xl cursor-pointer transition-all shadow-lg shadow-violet-900/40"
            >
              Crear cuenta gratis <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(ActivePage.Precios)}
              className="text-slate-400 hover:text-white text-sm font-semibold cursor-pointer transition-colors"
            >
              Ver todos los planes →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
