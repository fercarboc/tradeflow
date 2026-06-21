import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, BookOpen, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, AlertCircle, Loader2, Shield, Zap, Lock, X, Mic, MicOff, ExternalLink } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const PLAN_CATEGORIES: Record<string, string[]> = {
  basico:       ['OFICIOS', 'REBT', 'AEAT_VERIFACTU'],
  profesional:  ['OFICIOS', 'REBT', 'RITE', 'AEAT_VERIFACTU', 'AEAT_IVA', 'AEAT_RENTA', 'AEAT_FACTURACION'],
  empresa:      ['OFICIOS', 'REBT', 'RITE', 'AEAT_VERIFACTU', 'AEAT_IVA', 'AEAT_RENTA', 'AEAT_FACTURACION', 'AEAT_RENTA_CCAA', 'AEAT_SOCIEDADES'],
  empresa_plus: ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS',
                 'AEAT_VERIFACTU', 'AEAT_IVA', 'AEAT_RENTA', 'AEAT_FACTURACION', 'AEAT_RENTA_CCAA', 'AEAT_SOCIEDADES', 'AEAT_PATRIMONIO',
                 'SS_LGSS', 'SS_AFILIACION', 'SS_COTIZACION', 'SS_RETA', 'SS_BONIFICACIONES', 'SS_AUTONOMO_COLABORADOR', 'SS_SISTEMA_RED', 'SS_BOLETINES_RED'],
};

const ALL_TECH_CATEGORIES   = ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS'] as const;
const ALL_FISCAL_CATEGORIES = ['AEAT_VERIFACTU', 'AEAT_IVA', 'AEAT_RENTA', 'AEAT_FACTURACION', 'AEAT_RENTA_CCAA', 'AEAT_SOCIEDADES', 'AEAT_PATRIMONIO'] as const;
const ALL_SS_CATEGORIES     = ['SS_LGSS', 'SS_AFILIACION', 'SS_COTIZACION', 'SS_RETA', 'SS_BONIFICACIONES', 'SS_AUTONOMO_COLABORADOR', 'SS_SISTEMA_RED', 'SS_BOLETINES_RED'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  OFICIOS:                'Fichas de Oficio',
  REBT:                   'REBT',
  RITE:                   'RITE',
  CTE:                    'CTE',
  GAS:                    'GAS',
  ACS:                    'ACS',
  GUIAS:                  'Guías IDAE',
  AEAT_VERIFACTU:         'VeriFactu',
  AEAT_IVA:               'IVA',
  AEAT_RENTA:             'Renta IRPF',
  AEAT_FACTURACION:       'Facturación',
  AEAT_RENTA_CCAA:        'Renta CCAA',
  AEAT_SOCIEDADES:        'Sociedades',
  AEAT_PATRIMONIO:        'Patrimonio',
  SS_LGSS:                'LGSS',
  SS_AFILIACION:          'Afiliación',
  SS_COTIZACION:          'Cotización',
  SS_RETA:                'RETA',
  SS_BONIFICACIONES:      'Bonificaciones',
  SS_AUTONOMO_COLABORADOR:'Autón. Colaborador',
  SS_SISTEMA_RED:         'Sistema RED',
  SS_BOLETINES_RED:       'Boletines RED',
};

const DAILY_LIMITS: Record<string, number> = {
  basico: 5, profesional: 30, empresa: 30, empresa_plus: Infinity,
};

const EXAMPLE_QUERIES = [
  { q: '¿Qué sección mínima necesita un cable de 16A en instalación empotrada?',          cat: 'REBT'     },
  { q: '¿Qué IVA aplica a la instalación de aerotermia en vivienda de más de 2 años?',    cat: 'IVA'      },
  { q: '¿Cuántos circuitos mínimos debe tener una vivienda según el REBT?',               cat: 'REBT'     },
  { q: '¿Cuándo es obligatorio emitir facturas rectificativas según el reglamento AEAT?', cat: 'Factura'  },
  { q: '¿Puedo contratar a mi hijo en la empresa? ¿Cuál es su régimen en la SS?',         cat: 'SS'       },
  { q: '¿Qué plazo tengo para comunicar la baja de un trabajador a la Seguridad Social?', cat: 'SS'       },
];

// Tipos del Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: Event) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

interface NormSource {
  document: string;
  article_id: string | null;
  article_title: string | null;
  excerpt: string;
  boe_ref: string | null;
  comunidad_autonoma?: string | null;
}

interface NormMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: NormSource[];
  confidence?: 'high' | 'medium' | 'low' | 'none';
  naturaleza?: 'obligacion_legal' | 'recomendacion_tecnica' | 'interpretacion';
  requires_fiscal_disclaimer?: boolean;
  needs_dgt_disclaimer?: boolean;
  needs_importass_link?: boolean;
  comunidad_autonoma?: string | null;
  query_id?: string | null;
  chunks_used?: number;
  rated?: 1 | -1 | null;
  error?: boolean;
}

// ── Sub-componentes (definidos fuera del padre) ───────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high:   { label: 'Alta precisión',    cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    medium: { label: 'Precisión media',   cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    low:    { label: 'Precisión baja',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    none:   { label: 'Sin datos exactos', cls: 'bg-slate-600/30 text-slate-400 border-slate-600/40' },
  };
  const cfg = map[confidence] ?? map.none;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>
      <Shield className="w-2.5 h-2.5" />
      {cfg.label}
    </span>
  );
}

function SourceCard({ source, index }: { source: NormSource; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-800/40">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer hover:bg-slate-700/30 transition-colors">
        <span className="w-5 h-5 rounded-full bg-violet-600/25 text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">{source.document}{source.article_id ? ` · ${source.article_id}` : ''}</p>
          {source.article_title && <p className="text-[10px] text-slate-400 truncate">{source.article_title}</p>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 border-t border-slate-700/40 space-y-1.5 pt-2">
          {source.excerpt && <p className="text-[11px] text-slate-300 leading-relaxed italic">"{source.excerpt}"</p>}
          {source.boe_ref && <p className="text-[10px] text-slate-500">Ref: {source.boe_ref}</p>}
        </div>
      )}
    </div>
  );
}

const NATURALEZA_LABELS: Record<string, { label: string; cls: string }> = {
  obligacion_legal:     { label: 'Obligación legal',    cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  recomendacion_tecnica:{ label: 'Recomendación',       cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  interpretacion:       { label: 'Interpretación DGT',  cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
};

function AssistantBubble({ msg, onRate }: { msg: NormMessage; onRate: (id: string, r: 1 | -1) => void }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasSources = msg.sources && msg.sources.length > 0;
  const natCfg = msg.naturaleza ? NATURALEZA_LABELS[msg.naturaleza] : null;
  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
        <BookOpen className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${msg.error ? 'bg-red-900/30 border border-red-700/40' : 'bg-slate-800 border border-slate-700/50'}`}>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        </div>
        {msg.comunidad_autonoma && (
          <div className="inline-flex items-center gap-1.5 text-[10px] text-violet-300 bg-violet-500/10 border border-violet-500/25 rounded-full px-2.5 py-0.5">
            <span className="font-semibold">CCAA:</span> {msg.comunidad_autonoma}
          </div>
        )}
        {!msg.error && (
          <div className="flex flex-wrap items-center gap-2">
            {msg.confidence && <ConfidenceBadge confidence={msg.confidence} />}
            {natCfg && (
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${natCfg.cls}`}>
                {natCfg.label}
              </span>
            )}
            {hasSources && (
              <button onClick={() => setSourcesOpen(v => !v)} className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors cursor-pointer">
                {msg.sources!.length} fuente{msg.sources!.length !== 1 ? 's' : ''}
                {sourcesOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            )}
            {msg.query_id && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[10px] text-slate-500 mr-0.5">¿Útil?</span>
                <button onClick={() => msg.query_id && onRate(msg.query_id, 1)} disabled={msg.rated != null} className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${msg.rated === 1 ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'}`}><ThumbsUp className="w-3.5 h-3.5" /></button>
                <button onClick={() => msg.query_id && onRate(msg.query_id, -1)} disabled={msg.rated != null} className={`p-1 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default ${msg.rated === -1 ? 'text-red-400 bg-red-500/15' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'}`}><ThumbsDown className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        )}
        {sourcesOpen && hasSources && (
          <div className="space-y-1.5">{msg.sources!.map((s, i) => <SourceCard key={i} source={s} index={i} />)}</div>
        )}
        {msg.requires_fiscal_disclaimer && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-900/20 border border-amber-700/30">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-300/80 leading-relaxed">Información orientativa basada en manuales AEAT. Para decisiones fiscales con impacto económico, confirma con tu gestoría antes de actuar.</p>
          </div>
        )}

        {msg.needs_dgt_disclaimer && (
          <div className="rounded-xl bg-blue-950/40 border border-blue-700/30 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-blue-300">Posible criterio interpretativo DGT</p>
            <p className="text-[11px] text-blue-200/70 leading-relaxed">La aplicación concreta puede depender de consultas vinculantes de la Dirección General de Tributos no indexadas en TrabFlow.</p>
            <a href="https://petete.tributos.hacienda.gob.es/consultas/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" />
              Buscador oficial de doctrina tributaria AEAT
            </a>
          </div>
        )}

        {msg.needs_importass_link && (
          <div className="rounded-xl bg-cyan-950/40 border border-cyan-700/30 p-3 space-y-1.5">
            <p className="text-[11px] font-semibold text-cyan-300">Trámite oficial — Portal Importass</p>
            <p className="text-[11px] text-cyan-200/70 leading-relaxed">Se ha encontrado normativa relacionada con este trámite. Para ejecutarlo (alta, baja, cambio de base, vida laboral, certificados…) puedes acceder al portal oficial de la Seguridad Social para autónomos, empresas y trabajadores.</p>
            <a href="https://portal.seg-social.gob.es/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer">
              <ExternalLink className="w-3 h-3" />
              Acceder a Importass (Seguridad Social)
            </a>
          </div>
        )}

        {/* Aviso IA — siempre visible */}
        <div className="flex items-center gap-1.5 px-2 py-1">
          <AlertCircle className="w-3 h-3 text-slate-600 shrink-0" />
          <p className="text-[10px] text-slate-600">La IA puede cometer fallos. Verifica siempre en las fuentes oficiales antes de tomar decisiones.</p>
        </div>

      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  orgId: string | null;
  plan: string;
  session: Session | null;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ScreenAsistenteTecnico({ orgId, plan, session, showToast }: Props) {
  const [messages, setMessages] = useState<NormMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [queriesUsed, setQueriesUsed] = useState(0);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => PLAN_CATEGORIES[plan] ?? ['OFICIOS', 'REBT', 'AEAT_VERIFACTU']);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Estado de voz
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [voiceSupported] = useState(() => getSpeechRecognition() !== null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const finalTranscriptRef = useRef('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const allowedCats = PLAN_CATEGORIES[plan] ?? ['OFICIOS', 'REBT'];
  const dailyLimit = DAILY_LIMITS[plan] ?? 5;
  const isUnlimited = !isFinite(dailyLimit);
  const ratePct = isUnlimited ? 0 : Math.min(100, (queriesUsed / dailyLimit) * 100);
  const rateLimitReached = !isUnlimited && queriesUsed >= dailyLimit;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Limpieza del reconocimiento al desmontar
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev =>
      prev.includes(cat) ? (prev.length > 1 ? prev.filter(c => c !== cat) : prev) : [...prev, cat]
    );
  }, []);

  const sendQuery = useCallback(async (queryText: string) => {
    const text = queryText.trim();
    if (!text || loading || rateLimitReached) return;
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text }]);
    setInput('');
    setLoading(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-norm-query`, {
        method: 'POST', headers,
        body: JSON.stringify({ query: text, category_filter: selectedCategories }),
      });
      const data = await res.json();
      if (res.status === 429 || data.error === 'RATE_LIMIT_EXCEEDED') {
        setQueriesUsed(dailyLimit);
        setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: data.message ?? `Límite de ${dailyLimit} consultas/día alcanzado.`, error: true }]);
        return;
      }
      if (!res.ok || data.error) throw new Error(data.detail ?? data.error ?? 'Error');
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: data.answer ?? '', sources: data.sources ?? [], confidence: data.confidence ?? 'none', naturaleza: data.naturaleza, requires_fiscal_disclaimer: data.requires_fiscal_disclaimer ?? false, needs_dgt_disclaimer: data.needs_dgt_disclaimer ?? false, needs_importass_link: data.needs_importass_link ?? false, comunidad_autonoma: data.comunidad_autonoma ?? null, query_id: data.query_id ?? null, rated: null }]);
      if (orgId) setQueriesUsed(p => p + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Error de conexión', 'error');
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', text: 'No se pudo obtener respuesta. Comprueba tu conexión.', error: true }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, rateLimitReached, session, selectedCategories, dailyLimit, orgId, showToast]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    // onend se encargará de actualizar el estado
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) return;

    const initialText = input; // captura el texto previo en closure
    finalTranscriptRef.current = ''; // solo texto nuevo dictado
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.lang = 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsRecording(true);
      setInterimText('');
    };

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      // e.results contiene TODOS los resultados desde el inicio de la sesión,
      // así que reconstruimos desde cero en cada evento (evita duplicados).
      let newFinal = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          newFinal += (newFinal ? ' ' : '') + e.results[i][0].transcript;
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      finalTranscriptRef.current = newFinal;
      setInput([initialText, newFinal].filter(Boolean).join(' '));
      setInterimText(interim);
    };

    recognition.onerror = () => {
      setIsRecording(false);
      setInterimText('');
      showToast('Error en el micrófono. Comprueba los permisos.', 'error');
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText('');
      setInput([initialText, finalTranscriptRef.current].filter(Boolean).join(' ') || initialText);
      setTimeout(() => inputRef.current?.focus(), 100);
    };

    try {
      recognition.start();
    } catch {
      showToast('No se pudo iniciar el micrófono.', 'error');
    }
  }, [input, showToast]);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); }
  };

  // Al enviar por voz: para grabación y envía
  const handleVoiceSend = useCallback(() => {
    if (isRecording) stopRecording();
    const text = finalTranscriptRef.current || input;
    if (text.trim()) sendQuery(text.trim());
  }, [isRecording, stopRecording, input, sendQuery]);

  const handleRate = useCallback(async (queryId: string, rating: 1 | -1) => {
    setMessages(prev => prev.map(m => m.query_id === queryId ? { ...m, rated: rating } : m));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      await fetch(`${SUPABASE_URL}/functions/v1/trade-norm-query`, { method: 'POST', headers, body: JSON.stringify({ query_id: queryId, rating }) });
    } catch { /* silent */ }
  }, [session]);

  const hasMessages = messages.length > 0;
  const displayText = isRecording && interimText
    ? input + (input ? ' ' : '') + interimText
    : input;

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 relative">

      {/* ── Barra superior compacta ── */}
      <div className="shrink-0 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-white">Asistente Técnico &amp; Fiscal</span>
            <span className="text-slate-500 mx-2 text-xs">·</span>
            <span className="text-xs text-slate-400">Normativa técnica · Manuales AEAT</span>
          </div>
          {voiceSupported && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Mic className="w-3 h-3 text-slate-500" />
              <span className="text-[10px] text-slate-500">Voz disponible</span>
            </div>
          )}
          {!isUnlimited && (
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${ratePct >= 100 ? 'bg-red-500' : ratePct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`} style={{ width: `${ratePct}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-slate-400 whitespace-nowrap">{queriesUsed}/{dailyLimit} hoy</span>
            </div>
          )}
        </div>

        {/* Chips de categoría — Técnico */}
        <div className="max-w-4xl mx-auto px-5 pt-0 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider shrink-0 w-12">Técnico</span>
          {ALL_TECH_CATEGORIES.map(cat => {
            const locked = !allowedCats.includes(cat);
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => locked ? setShowUpgradeModal(true) : toggleCategory(cat)}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  locked  ? 'border-slate-700/50 bg-transparent text-slate-600 hover:border-slate-600 hover:text-slate-500'
                  : active ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                           : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
                }`}
              >
                {locked && <Lock className="w-2 h-2" />}
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
        {/* Chips de categoría — Fiscal AEAT */}
        <div className="max-w-4xl mx-auto px-5 pb-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-semibold text-amber-600/80 uppercase tracking-wider shrink-0 w-12">Fiscal</span>
          {ALL_FISCAL_CATEGORIES.map(cat => {
            const locked = !allowedCats.includes(cat);
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => locked ? setShowUpgradeModal(true) : toggleCategory(cat)}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  locked  ? 'border-slate-700/50 bg-transparent text-slate-600 hover:border-slate-600 hover:text-slate-500'
                  : active ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                           : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-amber-600/40 hover:text-amber-300/70'
                }`}
              >
                {locked && <Lock className="w-2 h-2" />}
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
        {/* Chips de categoría — Seguridad Social */}
        <div className="max-w-4xl mx-auto px-5 pb-2.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <span className="text-[10px] font-semibold text-cyan-600/80 uppercase tracking-wider shrink-0 w-12">SS</span>
          {ALL_SS_CATEGORIES.map(cat => {
            const locked = !allowedCats.includes(cat);
            const active = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => locked ? setShowUpgradeModal(true) : toggleCategory(cat)}
                className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer ${
                  locked  ? 'border-slate-700/50 bg-transparent text-slate-600 hover:border-slate-600 hover:text-slate-500'
                  : active ? 'border-cyan-500 bg-cyan-600/20 text-cyan-300'
                           : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-cyan-600/40 hover:text-cyan-300/70'
                }`}
              >
                {locked && <Lock className="w-2 h-2" />}
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Área de mensajes ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto px-5 py-5 space-y-5 h-full">

          {/* Estado vacío */}
          {!hasMessages && (
            <div className="flex flex-col justify-center h-full gap-6 pb-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50">
                <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Normativa técnica y fiscal para instaladores</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    REBT · RITE · CTE · GAS · IVA · IRPF · Facturación · VeriFactu
                    {voiceSupported && <span className="text-violet-400"> · Dicta por voz con el micrófono</span>}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Ejemplos de consulta</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {EXAMPLE_QUERIES.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => sendQuery(item.q)}
                      className="text-left flex items-start gap-3 text-xs text-slate-300 bg-slate-800/50 border border-slate-700/50 hover:border-violet-500/40 hover:bg-violet-500/5 rounded-xl px-3.5 py-3 transition-colors cursor-pointer group"
                    >
                      <span className="shrink-0 mt-0.5 text-[10px] font-bold text-violet-500 bg-violet-500/10 px-1.5 py-0.5 rounded-md">{item.cat}</span>
                      <span className="leading-snug group-hover:text-white transition-colors">{item.q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Mensajes */}
          {messages.map(msg => (
            <div key={msg.id}>
              {msg.role === 'user' ? (
                <div className="flex justify-end">
                  <div className="max-w-[75%] bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
                    <p className="text-sm text-white leading-relaxed">{msg.text}</p>
                  </div>
                </div>
              ) : (
                <AssistantBubble msg={msg} onRate={handleRate} />
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-start">
              <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                <span className="text-xs text-slate-400">Buscando en normativa…</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Rate limit banner ── */}
      {rateLimitReached && (
        <div className="shrink-0 border-t border-amber-700/30 bg-amber-900/20">
          <div className="max-w-4xl mx-auto px-5 py-2.5 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs text-amber-300 flex-1">Límite diario de {dailyLimit} consultas alcanzado. Se restablece mañana.</p>
            <button onClick={() => setShowUpgradeModal(true)} className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1 shrink-0">
              Mejorar plan <Zap className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Input + voz ── */}
      <div className="shrink-0 border-t border-slate-800 bg-slate-950/80 px-5 py-4">
        <div className="max-w-4xl mx-auto space-y-2">

          {/* Banner de grabación activa */}
          {isRecording && (
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-xs font-semibold text-red-400 flex-1">Grabando… habla con claridad</span>
              {interimText && (
                <span className="text-[11px] text-slate-400 italic truncate max-w-[60%]">{interimText}</span>
              )}
              <button onClick={stopRecording} className="text-[10px] font-bold text-red-400 hover:text-red-300 cursor-pointer shrink-0 underline underline-offset-2">
                Detener
              </button>
            </div>
          )}

          <div className={`flex items-end gap-2 bg-slate-800 border rounded-2xl px-4 py-3 transition-colors ${
            isRecording ? 'border-red-500/50 shadow-[0_0_0_3px_rgba(239,68,68,0.08)]'
            : rateLimitReached ? 'opacity-50 border-slate-700'
            : 'border-slate-700 focus-within:border-violet-500/60'
          }`}>
            <textarea
              ref={inputRef}
              value={displayText}
              onChange={e => { if (!isRecording) setInput(e.target.value); }}
              onKeyDown={handleKeyDown}
              disabled={loading || rateLimitReached}
              readOnly={isRecording}
              placeholder={
                isRecording ? 'Escuchando…'
                : rateLimitReached ? 'Límite diario alcanzado'
                : 'Escribe o dicta tu consulta técnica o fiscal (REBT, RITE, IVA, IRPF…)'
              }
              rows={1}
              className={`flex-1 bg-transparent text-sm placeholder-slate-500 resize-none outline-none leading-relaxed max-h-32 overflow-y-auto disabled:cursor-not-allowed ${
                isRecording ? 'text-slate-300 cursor-default' : 'text-slate-100'
              }`}
              style={{ scrollbarWidth: 'none' }}
            />

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Botón micrófono */}
              {voiceSupported && !rateLimitReached && (
                <button
                  onClick={handleMicClick}
                  disabled={loading}
                  title={isRecording ? 'Detener grabación' : 'Dictar consulta por voz'}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    isRecording
                      ? 'bg-red-500 hover:bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.4)] animate-pulse'
                      : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
                  }`}
                >
                  {isRecording
                    ? <MicOff className="w-3.5 h-3.5 text-white" />
                    : <Mic className="w-3.5 h-3.5" />
                  }
                </button>
              )}

              {/* Botón enviar */}
              <button
                onClick={isRecording ? handleVoiceSend : () => sendQuery(input)}
                disabled={(!displayText.trim() && !isRecording) || loading || rateLimitReached}
                title={isRecording ? 'Parar y enviar' : 'Enviar consulta'}
                className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-600 text-center">
            {voiceSupported
              ? 'Pulsa el micrófono para dictar · Enter para enviar · Basado en normativa oficial indexada'
              : 'Las respuestas se basan exclusivamente en la normativa indexada. Verifica con el reglamento oficial.'
            }
          </p>
        </div>
      </div>

      {/* ── Modal upgrade ── */}
      {showUpgradeModal && (
        <div className="absolute inset-0 bg-black/70 z-50 flex items-center justify-center p-5" onClick={() => setShowUpgradeModal(false)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-violet-400" />
              </div>
              <button onClick={() => setShowUpgradeModal(false)} className="text-slate-500 hover:text-slate-300 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">Amplía tu acceso a normativa</h3>
              <p className="text-sm text-slate-400">Plan actual: <span className="font-semibold text-slate-300">{plan}</span></p>
            </div>
            <div className="space-y-2.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Técnico</p>
              <div className="space-y-1.5">
                {ALL_TECH_CATEGORIES.map(cat => {
                  const has = allowedCats.includes(cat);
                  return (
                    <div key={cat} className={`flex items-center gap-2.5 text-xs ${has ? 'text-slate-200' : 'text-slate-600'}`}>
                      {has
                        ? <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /></div>
                        : <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><Lock className="w-2 h-2 text-slate-600" /></div>
                      }
                      {CATEGORY_LABELS[cat]}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-1">Fiscal AEAT</p>
              <div className="space-y-1.5">
                {ALL_FISCAL_CATEGORIES.map(cat => {
                  const has = allowedCats.includes(cat);
                  return (
                    <div key={cat} className={`flex items-center gap-2.5 text-xs ${has ? 'text-amber-200' : 'text-slate-600'}`}>
                      {has
                        ? <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /></div>
                        : <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><Lock className="w-2 h-2 text-slate-600" /></div>
                      }
                      {CATEGORY_LABELS[cat]}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pt-1">Seguridad Social</p>
              <div className="space-y-1.5">
                {ALL_SS_CATEGORIES.map(cat => {
                  const has = allowedCats.includes(cat);
                  return (
                    <div key={cat} className={`flex items-center gap-2.5 text-xs ${has ? 'text-cyan-200' : 'text-slate-600'}`}>
                      {has
                        ? <div className="w-4 h-4 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-cyan-400" /></div>
                        : <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><Lock className="w-2 h-2 text-slate-600" /></div>
                      }
                      {CATEGORY_LABELS[cat]}
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-xs text-slate-500">Normativa técnica, fiscal y laboral completa con el plan <strong className="text-violet-400">Empresa Plus</strong>.</p>
            <button onClick={() => setShowUpgradeModal(false)} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-2.5 rounded-xl transition-colors cursor-pointer">
              Ver planes y precios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

