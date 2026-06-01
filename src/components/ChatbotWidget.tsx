import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import { callChatbot, sendTrabflowEmail } from '../lib/supabase';
import type { ChatbotMessage, ChatbotContext, ChatbotResponse } from '../lib/supabase';

// Oficios conocidos por la app
const KNOWN_OFICIOS = [
  'Fontanería','Electricidad','Climatización / HVAC','Calefacción','Reformas',
  'Albañilería','Carpintería / Ventanas','Cerrajería','Pintura','Suelos y Tarimas',
  'Pladur / Escayola','Jardinería','Cristalería','Persianas / Cierres',
  'Telecomunicaciones','CCTV / Seguridad','Energía Solar','Ascensores',
  'Taller Mecánico','Limpieza Industrial',
];

const INITIAL_CHIPS = [
  '¿Cómo hago un presupuesto por voz?',
  '¿Cómo envío por WhatsApp?',
  '¿Qué diferencia hay entre los planes?',
  '¿Cómo creo un contrato de mantenimiento?',
  '¿Cómo actualizo mis precios?',
  '¿Cómo facturo a un cliente?',
];

// ── Flujo para oficio desconocido ─────────────────────────────────────────────
interface UnknownOficioState {
  step: 1 | 2 | 3 | 4;
  oficio: string;
  util: string;
  funciones: string;
  necesidades: string;
}

const UNKNOWN_FLOW_STEPS: Array<{ field: keyof UnknownOficioState; question: string; placeholder: string }> = [
  { field: 'oficio',      question: '¿Cuál es tu oficio o especialidad exactamente?',                                                     placeholder: 'Ej: Instalador de piscinas, técnico de gasodomésticos...' },
  { field: 'util',        question: '¿Crees que una app para crear presupuestos por voz, facturas y gestionar clientes te sería útil?',   placeholder: 'Sí, bastante / No mucho / Depende de...' },
  { field: 'funciones',   question: '¿Qué funcionalidades necesitarías para tu trabajo diario?',                                          placeholder: 'Ej: Presupuestos con fotos, control de materiales, partes de trabajo...' },
  { field: 'necesidades', question: '¿Algo más que quieras añadir o alguna necesidad específica de tu sector?',                          placeholder: 'Opcional — cuéntanos lo que quieras' },
];

interface ChatbotWidgetProps {
  context: ChatbotContext;
  onNavigate: (page: string) => void;
}

export default function ChatbotWidget({ context, onNavigate }: ChatbotWidgetProps) {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState<Array<ChatbotMessage & { parsed?: ChatbotResponse }>>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showInitial, setShowInitial] = useState(true);
  const [unknownFlow, setUnknownFlow] = useState<UnknownOficioState | null>(null);
  const [unknownSent, setUnknownSent] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;
    setShowInitial(false);
    setInput('');

    const userMsg: ChatbotMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await callChatbot(text, history, context);

      if (res.unknownOficio && !unknownFlow) {
        // Iniciar flujo de oficio desconocido
        setUnknownFlow({ step: 1, oficio: '', util: '', funciones: '', necesidades: '' });
      }

      setMessages(prev => [...prev, { role: 'assistant', content: res.answer, parsed: res }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Lo siento, ha ocurrido un error. Inténtalo de nuevo en un momento.',
        parsed: { answer: '', chips: [], action: null, canAnswer: true, unknownOficio: false },
      }]);
    }
    setLoading(false);
  }

  // ── Flujo oficio desconocido ──────────────────────────────────────────────
  async function handleUnknownFlowInput(value: string) {
    if (!unknownFlow || !value.trim()) return;
    const step = unknownFlow.step;
    const field = UNKNOWN_FLOW_STEPS[step - 1].field;
    const updated = { ...unknownFlow, [field]: value };

    if (step < 4) {
      setUnknownFlow({ ...updated, step: (step + 1) as 1|2|3|4 });
    } else {
      // Paso final: enviar email
      setUnknownFlow({ ...updated, step: 4 });
      try {
        await sendTrabflowEmail({
          type: 'contact_admin',
          nombre: `[OFICIO NUEVO] ${updated.oficio}`,
          email: context.orgId ?? 'sin org',
          oficio: `Nuevo oficio: ${updated.oficio}`,
          ciudad: `Útil: ${updated.util}\nFunciones: ${updated.funciones}\nNecesidades: ${updated.necesidades}`,
        });
      } catch { /* fire and forget */ }
      setUnknownSent(true);
      setUnknownFlow(null);
    }
  }

  const currentStep = unknownFlow ? UNKNOWN_FLOW_STEPS[unknownFlow.step - 1] : null;

  return (
    <>
      {/* Botón flotante */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 right-4 z-[80] w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all active:scale-95 sm:bottom-6"
          aria-label="Abrir ayuda"
        >
          <MessageCircle className="w-5 h-5" />
        </button>
      )}

      {/* Panel del chat */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-end sm:justify-end sm:p-4 sm:pb-6">
          {/* Overlay móvil */}
          <div className="absolute inset-0 bg-black/40 sm:hidden" onClick={() => setIsOpen(false)} />

          <div className="relative w-full sm:w-[380px] h-[85vh] sm:h-[560px] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl flex flex-col shadow-2xl overflow-hidden">

            {/* Header */}
            <div className="bg-blue-600 px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-xs uppercase tracking-wider">Asistente TrabFlow</p>
                <p className="text-blue-100 text-[10px]">Ayuda sobre la aplicación</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-white/70 hover:text-white cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

              {/* Mensaje de bienvenida */}
              {showInitial && messages.length === 0 && (
                <div className="space-y-3">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm p-3 max-w-[85%]">
                    <p className="text-xs text-slate-800 dark:text-white leading-relaxed">
                      ¡Hola! Soy el asistente de TrabFlow. Puedo ayudarte con cualquier duda sobre la app: presupuestos, contratos, catálogo, envíos y planes.
                    </p>
                    {context.oficio && (
                      <p className="text-[10px] text-blue-600 mt-1 font-semibold">Tu oficio: {context.oficio}</p>
                    )}
                  </div>

                  {/* Chips iniciales */}
                  <div>
                    <p className="text-[9px] text-slate-400 font-mono uppercase tracking-wider mb-2">Preguntas frecuentes</p>
                    <div className="flex flex-wrap gap-1.5">
                      {INITIAL_CHIPS.map(chip => (
                        <button
                          key={chip}
                          onClick={() => sendMessage(chip)}
                          className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-medium px-3 py-1.5 rounded-full cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Historial de mensajes */}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] space-y-2 ${msg.role === 'user' ? '' : ''}`}>
                    <div className={`rounded-2xl px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white rounded-tl-sm'
                    }`}>
                      {msg.role === 'assistant' ? msg.content : msg.content}
                    </div>

                    {/* Action button */}
                    {msg.role === 'assistant' && msg.parsed?.action && (
                      <button
                        onClick={() => { onNavigate(msg.parsed!.action!.page); setIsOpen(false); }}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-1.5 cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        {msg.parsed.action.label} <ChevronRight className="w-3 h-3" />
                      </button>
                    )}

                    {/* Chips sugeridos — solo en el último mensaje del asistente */}
                    {msg.role === 'assistant' && i === messages.length - 1 && msg.parsed?.chips && msg.parsed.chips.length > 0 && !unknownFlow && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {msg.parsed.chips.map(chip => (
                          <button
                            key={chip}
                            onClick={() => sendMessage(chip)}
                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] px-2.5 py-1 rounded-full cursor-pointer hover:border-blue-300 hover:text-blue-600 transition-colors"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Loading */}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3">
                    <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                  </div>
                </div>
              )}

              {/* Flujo oficio desconocido */}
              {unknownFlow && currentStep && !unknownSent && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 space-y-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                    Cuéntanos sobre tu oficio ({unknownFlow.step}/4)
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{currentStep.question}</p>
                  <UnknownOficioInput
                    placeholder={currentStep.placeholder}
                    onSubmit={handleUnknownFlowInput}
                  />
                </div>
              )}

              {/* Confirmación oficio desconocido */}
              {unknownSent && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-1">¡Gracias por compartirlo!</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Hemos registrado tu oficio y necesidades. Nuestro equipo lo revisará para ver si podemos incluirlo en TrabFlow. Te contactaremos si hay novedades.
                  </p>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!unknownFlow && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex gap-2 items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                    placeholder="Escribe tu pregunta..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 placeholder-slate-400"
                    disabled={loading}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={loading || !input.trim()}
                    className="w-9 h-9 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5 text-center">TrabFlow AI · Solo sobre funcionalidades de la app</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Sub-componente a nivel de módulo para el input del flujo desconocido
function UnknownOficioInput({ placeholder, onSubmit }: { placeholder: string; onSubmit: (v: string) => void }) {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) { onSubmit(val); setVal(''); } }}
        placeholder={placeholder}
        className="flex-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
        autoFocus
      />
      <button
        onClick={() => { if (val.trim()) { onSubmit(val); setVal(''); } }}
        disabled={!val.trim()}
        className="w-9 h-9 bg-amber-500 hover:bg-amber-600 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
