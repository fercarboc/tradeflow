import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, BookOpen, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, AlertCircle, Loader2, Shield, Zap, Lock, X } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const PLAN_CATEGORIES: Record<string, string[]> = {
  basico:       ['OFICIOS', 'REBT'],
  profesional:  ['OFICIOS', 'REBT', 'RITE'],
  empresa:      ['OFICIOS', 'REBT', 'RITE'],
  empresa_plus: ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS'],
};

const ALL_CATEGORIES = ['OFICIOS', 'REBT', 'RITE', 'CTE', 'GAS', 'ACS', 'GUIAS'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  OFICIOS: 'Fichas de Oficio',
  REBT:    'REBT – Electricidad',
  RITE:    'RITE – Climatización',
  CTE:     'CTE – Construcción',
  GAS:     'Gas – Reglamento',
  ACS:     'ACS / Legionella',
  GUIAS:   'Guías IDAE',
};

const DAILY_LIMITS: Record<string, number> = {
  basico: 5,
  profesional: 30,
  empresa: 30,
  empresa_plus: Infinity,
};

const EXAMPLE_QUERIES = [
  '¿Qué sección mínima necesita un cable de 16A en instalación empotrada?',
  '¿Cuál es la temperatura mínima de distribución de ACS según normativa?',
  '¿Qué distancia mínima hay entre tubos de gas y electricidad?',
  '¿Qué requiere la ITC-BT-25 para viviendas?',
  '¿Qué mantenimiento periódico exige el RITE para climatización?',
];

interface NormSource {
  document: string;
  article_id: string | null;
  article_title: string | null;
  excerpt: string;
  boe_ref: string | null;
}

interface NormMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: NormSource[];
  confidence?: 'high' | 'medium' | 'low' | 'none';
  query_id?: string | null;
  chunks_used?: number;
  latency_ms?: number;
  rated?: 1 | -1 | null;
  error?: boolean;
}

// ── Componentes auxiliares (fuera del componente padre) ───────────────────────

interface ConfidenceBadgeProps { confidence: string }
function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
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

interface SourceCardProps { source: NormSource; index: number }
function SourceCard({ source, index }: SourceCardProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-700/60 rounded-xl overflow-hidden bg-slate-800/40">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer hover:bg-slate-700/30 transition-colors"
      >
        <span className="w-5 h-5 rounded-full bg-violet-600/25 text-violet-400 text-[10px] font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-200 truncate">
            {source.document}{source.article_id ? ` · ${source.article_id}` : ''}
          </p>
          {source.article_title && (
            <p className="text-[10px] text-slate-400 truncate">{source.article_title}</p>
          )}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 space-y-1.5 border-t border-slate-700/40">
          {source.excerpt && (
            <p className="text-[11px] text-slate-300 leading-relaxed italic">"{source.excerpt}"</p>
          )}
          {source.boe_ref && (
            <p className="text-[10px] text-slate-500">Referencia: {source.boe_ref}</p>
          )}
        </div>
      )}
    </div>
  );
}

interface AssistantBubbleProps {
  msg: NormMessage;
  onRate: (queryId: string, rating: 1 | -1) => void;
}
function AssistantBubble({ msg, onRate }: AssistantBubbleProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const hasSources = msg.sources && msg.sources.length > 0;

  return (
    <div className="flex gap-3 items-start">
      <div className="w-7 h-7 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 mt-0.5">
        <BookOpen className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="flex-1 space-y-2.5 max-w-[calc(100%-2.5rem)]">
        <div className={`rounded-2xl rounded-tl-sm px-4 py-3 ${msg.error ? 'bg-red-900/30 border border-red-700/40' : 'bg-slate-800 border border-slate-700/50'}`}>
          <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
        </div>

        {!msg.error && (
          <div className="flex flex-wrap items-center gap-2">
            {msg.confidence && <ConfidenceBadge confidence={msg.confidence} />}
            {hasSources && (
              <button
                onClick={() => setSourcesOpen(v => !v)}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 transition-colors cursor-pointer"
              >
                {msg.sources!.length} fuente{msg.sources!.length !== 1 ? 's' : ''}
                {sourcesOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
              </button>
            )}
            {msg.query_id && (
              <div className="flex items-center gap-1 ml-auto">
                <span className="text-[10px] text-slate-500 mr-0.5">¿Útil?</span>
                <button
                  onClick={() => msg.query_id && onRate(msg.query_id, 1)}
                  disabled={msg.rated !== undefined && msg.rated !== null}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${msg.rated === 1 ? 'text-emerald-400 bg-emerald-500/15' : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'} disabled:opacity-50 disabled:cursor-default`}
                >
                  <ThumbsUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => msg.query_id && onRate(msg.query_id, -1)}
                  disabled={msg.rated !== undefined && msg.rated !== null}
                  className={`p-1 rounded-lg transition-colors cursor-pointer ${msg.rated === -1 ? 'text-red-400 bg-red-500/15' : 'text-slate-500 hover:text-red-400 hover:bg-red-500/10'} disabled:opacity-50 disabled:cursor-default`}
                >
                  <ThumbsDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {sourcesOpen && hasSources && (
          <div className="space-y-1.5">
            {msg.sources!.map((s, i) => <SourceCard key={i} source={s} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

interface CategoryChipProps {
  category: string;
  active: boolean;
  locked: boolean;
  onToggle: () => void;
  onUpgrade: () => void;
}
function CategoryChip({ category, active, locked, onToggle, onUpgrade }: CategoryChipProps) {
  if (locked) {
    return (
      <button
        onClick={onUpgrade}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-700 bg-slate-800/40 text-slate-500 cursor-pointer hover:border-violet-500/50 hover:text-violet-400 transition-colors"
      >
        <Lock className="w-2.5 h-2.5" />
        {CATEGORY_LABELS[category] ?? category}
      </button>
    );
  }
  return (
    <button
      onClick={onToggle}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
        active
          ? 'border-violet-500 bg-violet-600/20 text-violet-300'
          : 'border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300'
      }`}
    >
      {CATEGORY_LABELS[category] ?? category}
    </button>
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => PLAN_CATEGORIES[plan] ?? ['OFICIOS', 'REBT']);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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

  const toggleCategory = useCallback((cat: string) => {
    setSelectedCategories(prev => {
      if (prev.includes(cat)) {
        return prev.length > 1 ? prev.filter(c => c !== cat) : prev;
      }
      return [...prev, cat];
    });
  }, []);

  const sendQuery = useCallback(async (queryText: string) => {
    const text = queryText.trim();
    if (!text || loading || rateLimitReached) return;

    const userMsg: NormMessage = { id: crypto.randomUUID(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/trade-norm-query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: text,
          category_filter: selectedCategories,
        }),
      });

      const data = await res.json();

      if (res.status === 429 || data.error === 'RATE_LIMIT_EXCEEDED') {
        setQueriesUsed(dailyLimit);
        const errMsg: NormMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: data.message ?? `Has alcanzado el límite de ${dailyLimit} consultas diarias en el plan ${plan}.`,
          error: true,
        };
        setMessages(prev => [...prev, errMsg]);
        return;
      }

      if (!res.ok || data.error) {
        throw new Error(data.detail ?? data.error ?? 'Error desconocido');
      }

      const assistantMsg: NormMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text:        data.answer ?? '',
        sources:     data.sources ?? [],
        confidence:  data.confidence ?? 'none',
        query_id:    data.query_id ?? null,
        chunks_used: data.chunks_used ?? 0,
        latency_ms:  data.latency_ms ?? 0,
        rated:       null,
      };
      setMessages(prev => [...prev, assistantMsg]);
      if (orgId) setQueriesUsed(prev => prev + 1);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error de conexión';
      showToast(msg, 'error');
      const errMsg: NormMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: 'No se pudo obtener respuesta. Comprueba tu conexión e inténtalo de nuevo.',
        error: true,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, rateLimitReached, session, selectedCategories, dailyLimit, plan, orgId, showToast]);

  const handleRate = useCallback(async (queryId: string, rating: 1 | -1) => {
    setMessages(prev => prev.map(m => m.query_id === queryId ? { ...m, rated: rating } : m));
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
      await fetch(`${SUPABASE_URL}/functions/v1/trade-norm-query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query_id: queryId, rating }),
      });
    } catch {
      // silent
    }
  }, [session]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendQuery(input);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-slate-800 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
          <BookOpen className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-white">Asistente Técnico</h2>
          <p className="text-[11px] text-slate-400">Consulta normativa REBT, RITE, CTE, GAS y más</p>
        </div>
        {!isUnlimited && (
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-semibold text-slate-400">
              {queriesUsed}/{dailyLimit} hoy
            </span>
            <div className="w-20 h-1 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ratePct >= 100 ? 'bg-red-500' : ratePct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                style={{ width: `${ratePct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Category filter chips */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-slate-800/60 shrink-0 overflow-x-auto scrollbar-hide">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">Filtrar:</span>
        {ALL_CATEGORIES.map(cat => (
          <CategoryChip
            key={cat}
            category={cat}
            active={selectedCategories.includes(cat)}
            locked={!allowedCats.includes(cat)}
            onToggle={() => toggleCategory(cat)}
            onUpgrade={() => setShowUpgradeModal(true)}
          />
        ))}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-5 py-8">
            <div className="w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-violet-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-slate-200">Consulta la normativa técnica</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Pregunta sobre secciones de cable, temperaturas, distancias, requisitos reglamentarios…
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full max-w-md">
              {EXAMPLE_QUERIES.slice(0, 4).map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuery(q)}
                  className="text-left text-xs text-slate-300 bg-slate-800/60 border border-slate-700/50 hover:border-violet-500/40 hover:bg-violet-500/5 rounded-xl px-3.5 py-2.5 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id}>
            {msg.role === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-violet-600 rounded-2xl rounded-tr-sm px-4 py-2.5">
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

      {/* Rate limit reached banner */}
      {rateLimitReached && (
        <div className="mx-5 mb-3 flex items-center gap-3 bg-amber-900/30 border border-amber-700/40 rounded-xl px-4 py-3 shrink-0">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300 flex-1">
            Límite diario alcanzado ({dailyLimit} consultas). Se restablece mañana.
          </p>
          <button
            onClick={() => setShowUpgradeModal(true)}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 cursor-pointer shrink-0 flex items-center gap-1"
          >
            Mejorar <Zap className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 px-5 pb-5 pt-3 border-t border-slate-800">
        <div className={`flex items-end gap-2.5 bg-slate-800 border rounded-2xl px-3.5 py-2.5 transition-colors ${rateLimitReached ? 'border-slate-700/40 opacity-50' : 'border-slate-700 focus-within:border-violet-500/60'}`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || rateLimitReached}
            placeholder={rateLimitReached ? 'Límite diario alcanzado' : 'Pregunta sobre normativa técnica…'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none outline-none leading-relaxed max-h-28 overflow-y-auto disabled:cursor-not-allowed"
            style={{ scrollbarWidth: 'none' }}
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={!input.trim() || loading || rateLimitReached}
            className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors cursor-pointer"
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 text-center">
          Las respuestas se basan en la normativa indexada. Verifica siempre con el reglamento oficial.
        </p>
      </div>

      {/* Upgrade modal */}
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
              <p className="text-sm text-slate-400">Tu plan actual <span className="font-semibold text-slate-300">{plan}</span> incluye:</p>
            </div>
            <div className="space-y-1.5">
              {ALL_CATEGORIES.map(cat => (
                <div key={cat} className={`flex items-center gap-2.5 text-xs ${allowedCats.includes(cat) ? 'text-slate-200' : 'text-slate-600'}`}>
                  {allowedCats.includes(cat)
                    ? <div className="w-4 h-4 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /></div>
                    : <div className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center"><Lock className="w-2 h-2 text-slate-600" /></div>
                  }
                  {CATEGORY_LABELS[cat]}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Para acceder a CTE, GAS, ACS y Guías IDAE actualiza al plan <strong className="text-violet-400">Empresa Plus</strong>.</p>
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              Ver planes y precios
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
