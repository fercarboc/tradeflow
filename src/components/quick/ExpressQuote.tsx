// Modo Exprés — piezas de interfaz del asistente de presupuestos móvil.
// Componentes de presentación puros: el estado y la lógica viven en AppDashboardView.
import React from 'react';
import { Mic, PencilLine, Camera, Plus, Star, Search, Send, BellRing, FileText, Eye, Check } from 'lucide-react';
import type { Presupuesto } from '../../types';
import type { QuoteTemplate } from '../../lib/quoteTemplates';
import type { QuoteLinkTracking, ExpressQuoteFilter } from '../../lib/quoteTracking';
import { trackingState, daysSince } from '../../lib/quoteTracking';

const eur = (n: number) =>
  n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ─── Progreso de 4 pasos ─────────────────────────────────────────────────────
export const EXPRESS_STEPS = ['partidas', 'cliente', 'pago', 'enviar'] as const;
export type ExpressStep = typeof EXPRESS_STEPS[number];
const STEP_LABEL: Record<ExpressStep, string> = { partidas: 'Partidas', cliente: 'Cliente', pago: 'IVA', enviar: 'Enviar' };

export function ExpressProgress({ step, onGo }: { step: ExpressStep; onGo?: (s: ExpressStep) => void }) {
  const cur = EXPRESS_STEPS.indexOf(step);
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="Pasos del presupuesto">
      {EXPRESS_STEPS.map((s, i) => {
        const done = i < cur;
        const active = i === cur;
        return (
          <li key={s} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <button
              type="button"
              disabled={!done || !onGo}
              onClick={() => onGo?.(s)}
              aria-current={active ? 'step' : undefined}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                done ? 'bg-emerald-100 text-emerald-700 cursor-pointer' :
                active ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-300'
              }`}
            >
              {done ? <Check className="w-4 h-4" /> : i + 1}
            </button>
            <span className={`text-[11px] font-semibold truncate ${active ? 'text-blue-700' : done ? 'text-emerald-700' : 'text-gray-400'}`}>
              {STEP_LABEL[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Total fijo ──────────────────────────────────────────────────────────────
export function ExpressTotalBar({ base, ivaPct, count, sinPrecio }: { base: number; ivaPct: number; count: number; sinPrecio: number }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 block">Total con IVA</span>
        <span className="text-2xl font-black text-gray-900 font-mono leading-tight">{eur(base * (1 + ivaPct / 100))}</span>
      </div>
      <div className="text-right text-xs text-gray-500 leading-snug">
        <span className="block">{count} partida{count !== 1 ? 's' : ''}</span>
        {sinPrecio > 0 && <span className="block font-bold text-amber-600">{sinPrecio} sin precio</span>}
      </div>
    </div>
  );
}

// ─── Cómo empezar ────────────────────────────────────────────────────────────
function StartCard({ icon, title, desc, onClick, tone }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void; tone: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 bg-white border-2 border-gray-200 active:border-blue-500 rounded-2xl p-4 text-left cursor-pointer transition-colors"
    >
      <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-base font-bold text-gray-900">{title}</span>
        <span className="block text-sm text-gray-500 leading-snug">{desc}</span>
      </span>
    </button>
  );
}

export function ExpressStartPanel({ onVoz, onTexto, onFoto, onManual }: { onVoz: () => void; onTexto: () => void; onFoto: () => void; onManual: () => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold text-gray-900">¿Cómo quieres empezar?</h2>
      <StartCard icon={<Mic className="w-6 h-6 text-blue-700" />} tone="bg-blue-50" title="Dictar por voz" desc="Cuenta el trabajo y la IA prepara las partidas" onClick={onVoz} />
      <StartCard icon={<PencilLine className="w-6 h-6 text-violet-700" />} tone="bg-violet-50" title="Escribirlo" desc="Describe el trabajo con tus palabras" onClick={onTexto} />
      <StartCard icon={<Camera className="w-6 h-6 text-emerald-700" />} tone="bg-emerald-50" title="Desde una foto" desc="Foto del equipo o la avería" onClick={onFoto} />
      <button type="button" onClick={onManual} className="w-full text-center text-sm font-semibold text-blue-700 py-2 cursor-pointer">
        + Añadir partidas a mano
      </button>
    </div>
  );
}

// ─── Plantillas a la vista ───────────────────────────────────────────────────
export function QuoteTemplatesStrip({
  templates, loading, onUse, title = 'Tus plantillas', emptyHint,
}: {
  templates: QuoteTemplate[];
  loading?: boolean;
  onUse: (t: QuoteTemplate) => void;
  title?: string;
  emptyHint?: string;
}) {
  return (
    <section className="space-y-2" aria-label={title}>
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Cargando plantillas…</p>
      ) : templates.length === 0 ? (
        <p className="text-sm text-gray-500 bg-white border border-dashed border-gray-300 rounded-2xl p-3 leading-snug">
          {emptyHint ?? 'Aún no tienes plantillas. Al enviar un presupuesto, marca «Guardar como plantilla» y aparecerá aquí.'}
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x" style={{ scrollbarWidth: 'none' }}>
          {templates.map(t => {
            const base = (t.partidas ?? []).reduce((s, p) => s + (Number(p.cantidad) || 0) * (Number(p.precioUnitario) || 0), 0);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onUse(t)}
                className="snap-start shrink-0 w-44 bg-white border-2 border-amber-200 active:border-amber-400 rounded-2xl p-3 text-left cursor-pointer"
              >
                <span className="block text-sm font-bold text-gray-900 line-clamp-2 leading-snug min-h-[2.5rem]">{t.nombre}</span>
                <span className="block text-xs text-gray-500 mt-1">{(t.partidas ?? []).length} partida{(t.partidas ?? []).length !== 1 ? 's' : ''}</span>
                <span className="block text-sm font-mono font-bold text-gray-900">{eur(base)}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── Seguimiento de presupuestos ─────────────────────────────────────────────
const FILTERS: { key: ExpressQuoteFilter; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'borrador', label: 'Borrador' },
  { key: 'enviado', label: 'Enviado' },
  { key: 'visto', label: 'Visto' },
  { key: 'aceptado', label: 'Aceptado' },
  { key: 'facturado', label: 'Facturado' },
];

const STATE_STYLE: Record<Exclude<ExpressQuoteFilter, 'todos'>, { badge: string; border: string; label: string }> = {
  borrador:  { badge: 'bg-gray-100 text-gray-600',      border: 'border-l-gray-300',    label: 'Borrador' },
  enviado:   { badge: 'bg-blue-50 text-blue-700',       border: 'border-l-blue-400',    label: 'Enviado' },
  visto:     { badge: 'bg-violet-50 text-violet-700',   border: 'border-l-violet-400',  label: 'Visto' },
  aceptado:  { badge: 'bg-emerald-50 text-emerald-700', border: 'border-l-emerald-500', label: 'Aceptado' },
  facturado: { badge: 'bg-indigo-50 text-indigo-700',   border: 'border-l-indigo-400',  label: 'Facturado' },
};

export type ExpressQuoteAction = 'enviar' | 'recordar' | 'facturar' | 'ver_factura';

const ACTION: Record<Exclude<ExpressQuoteFilter, 'todos'>, { key: ExpressQuoteAction; label: string; icon: React.ReactNode; cls: string }> = {
  borrador:  { key: 'enviar',      label: 'Enviar',      icon: <Send className="w-4 h-4" />,     cls: 'bg-[#25D366] text-white' },
  enviado:   { key: 'recordar',    label: 'Recordar',    icon: <BellRing className="w-4 h-4" />, cls: 'bg-blue-50 text-blue-700 border border-blue-200' },
  visto:     { key: 'recordar',    label: 'Recordar',    icon: <BellRing className="w-4 h-4" />, cls: 'bg-violet-50 text-violet-700 border border-violet-200' },
  aceptado:  { key: 'facturar',    label: 'Facturar',    icon: <FileText className="w-4 h-4" />, cls: 'bg-emerald-600 text-white' },
  facturado: { key: 'ver_factura', label: 'Ver factura', icon: <Eye className="w-4 h-4" />,      cls: 'bg-gray-100 text-gray-700' },
};

export function ExpressQuoteList({
  quotes, tracking, filter, onFilter, search, onSearch, onOpen, onAction, onNew,
}: {
  quotes: Presupuesto[];
  tracking: Record<string, QuoteLinkTracking>;
  filter: ExpressQuoteFilter;
  onFilter: (f: ExpressQuoteFilter) => void;
  search: string;
  onSearch: (s: string) => void;
  onOpen: (q: Presupuesto) => void;
  onAction: (q: Presupuesto, a: ExpressQuoteAction) => void;
  onNew: () => void;
}) {
  const withState = quotes.map(q => ({ q, st: trackingState(q.estado, tracking[q.id]) }));
  const counts = withState.reduce<Record<string, number>>((acc, { st }) => { acc[st] = (acc[st] ?? 0) + 1; return acc; }, {});
  const needle = search.trim().toLowerCase();
  const visible = withState
    .filter(({ q, st }) => (filter === 'todos' || st === filter) &&
      (!needle || (q.nombreCliente ?? '').toLowerCase().includes(needle) || (q.descripcion ?? '').toLowerCase().includes(needle)))
    .sort((a, b) => (b.q.fecha ?? '').localeCompare(a.q.fecha ?? ''));

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onNew}
        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-2xl py-4 text-base font-bold shadow-sm active:bg-blue-700 cursor-pointer"
      >
        <Plus className="w-5 h-5" /> Nuevo presupuesto
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} role="tablist" aria-label="Filtrar por estado">
        {FILTERS.map(f => {
          const n = f.key === 'todos' ? quotes.length : (counts[f.key] ?? 0);
          const on = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onFilter(f.key)}
              className={`shrink-0 px-3.5 py-2 rounded-full text-sm font-semibold border cursor-pointer transition-colors ${
                on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {f.label} <span className={on ? 'text-white/70' : 'text-gray-400'}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          placeholder="Buscar cliente o trabajo"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
        />
      </div>

      {visible.map(({ q, st }) => {
        const style = STATE_STYLE[st];
        const action = ACTION[st];
        const total = q.total * (1 + (q.iva_pct ?? 21) / 100);
        const dias = daysSince(q.fecha);
        const viewedAt = tracking[q.id]?.viewedAt;
        const ago = (d: number | null) => d == null ? '' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} d`;
        const sub =
          st === 'visto' && viewedAt ? `Visto ${ago(daysSince(viewedAt))}` :
          st === 'enviado' && dias != null ? `Enviado ${ago(dias)} · sin abrir` :
          dias != null ? (dias === 0 ? 'Hoy' : dias === 1 ? 'Ayer' : `Hace ${dias} d`) : '';
        return (
          <div
            key={q.id}
            data-testid="quote-row"
            className={`bg-white border border-gray-100 border-l-4 ${style.border} rounded-2xl shadow-sm overflow-hidden`}
          >
            <button type="button" onClick={() => onOpen(q)} className="w-full text-left px-4 pt-3 pb-2 cursor-pointer flex items-start gap-2">
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold text-gray-900 truncate">{q.nombreCliente || 'Sin cliente'}</span>
                <span className="block text-sm text-gray-500 truncate">{q.descripcion}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-base font-black font-mono text-gray-900">{total.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €</span>
                <span className={`inline-block mt-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>{style.label}</span>
              </span>
            </button>
            <div className="flex items-center justify-between gap-2 px-4 pb-3">
              <span className="text-xs text-gray-400 truncate">{q.id}{sub ? ` · ${sub}` : ''}</span>
              <button
                type="button"
                onClick={() => onAction(q, action.key)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold cursor-pointer ${action.cls}`}
              >
                {action.icon}{action.label}
              </button>
            </div>
          </div>
        );
      })}

      {visible.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          {filter === 'todos' && !needle ? 'Todavía no hay presupuestos' : 'Nada con este filtro'}
        </div>
      )}
    </div>
  );
}
