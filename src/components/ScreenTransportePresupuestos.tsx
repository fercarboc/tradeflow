import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, FileText, Send, CheckCircle, XCircle, Clock, ChevronRight, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import {
  loadTransportQuotes,
  createTransportQuote,
  updateTransportQuote,
  sendTransportQuote,
  rejectTransportQuote,
  approveTransportQuote,
  validateQuoteInput,
  isQuoteEditable,
  isQuoteSendable,
  isQuoteApprovable,
  isQuoteRejectable,
  getQuoteEstadoInfo,
  QUOTE_ESTADOS,
  TradeTransportQuote,
  TradeTransportQuoteInput,
  QuoteEstado,
} from '../lib/transportQuotes';
import { TIPO_SERVICIO_OPTIONS } from '../lib/transportServices';

// ── Tipos de props ────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onNavigateToService?: (serviceId: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) return String((e as { message: unknown }).message);
  return 'Error desconocido';
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return iso;
  }
}

function formatEur(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v);
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

interface BadgeProps { estado: QuoteEstado }
function EstadoBadge({ estado }: BadgeProps) {
  const info = getQuoteEstadoInfo(estado);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${info.color}`}>
      {info.label}
    </span>
  );
}

interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}
function FilterTab({ label, count, active, onClick }: FilterTabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap
        ${active
          ? 'bg-indigo-600 text-white'
          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
    >
      {label}
      {count > 0 && (
        <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full
          ${active ? 'bg-indigo-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

interface QuoteRowProps {
  quote: TradeTransportQuote;
  onEdit: (q: TradeTransportQuote) => void;
  onSend: (q: TradeTransportQuote) => void;
  onApprove: (q: TradeTransportQuote) => void;
  onReject: (q: TradeTransportQuote) => void;
  onNavigate: (serviceId: string) => void;
}
function QuoteRow({ quote, onEdit, onSend, onApprove, onReject, onNavigate }: QuoteRowProps) {
  const tipoLabel = TIPO_SERVICIO_OPTIONS.find(o => o.value === quote.tipo_servicio)?.label ?? quote.tipo_servicio;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-slate-400 dark:text-slate-500">
              {quote.numero_presupuesto}
            </span>
            <EstadoBadge estado={quote.estado} />
          </div>
          <p className="mt-1 font-medium text-slate-800 dark:text-slate-100 truncate">
            {quote.titulo}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <span>{tipoLabel}</span>
            {quote.fecha_servicio && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(quote.fecha_servicio)}
                {quote.fecha_fin_servicio && quote.fecha_fin_servicio !== quote.fecha_servicio && (
                  <> → {formatDate(quote.fecha_fin_servicio)}</>
                )}
              </span>
            )}
            {quote.num_viajeros && (
              <span>{quote.num_viajeros} viajeros</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          {quote.precio_final !== null && quote.precio_final !== undefined ? (
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              {formatEur(quote.precio_final)}
            </p>
          ) : quote.precio_sugerido !== null && quote.precio_sugerido !== undefined ? (
            <p className="text-slate-500 dark:text-slate-400 text-sm">
              ~{formatEur(quote.precio_sugerido)}
            </p>
          ) : null}
        </div>
      </div>

      {/* Acciones */}
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {isQuoteEditable(quote) && (
          <button
            onClick={() => onEdit(quote)}
            className="text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-600
              text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Editar
          </button>
        )}
        {isQuoteSendable(quote) && (
          <button
            onClick={() => onSend(quote)}
            className="text-xs px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300
              border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors
              flex items-center gap-1"
          >
            <Send className="w-3 h-3" /> Enviar
          </button>
        )}
        {isQuoteApprovable(quote) && (
          <button
            onClick={() => onApprove(quote)}
            className="text-xs px-2.5 py-1 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300
              border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors
              flex items-center gap-1"
          >
            <CheckCircle className="w-3 h-3" /> Aprobar
          </button>
        )}
        {isQuoteRejectable(quote) && (
          <button
            onClick={() => onReject(quote)}
            className="text-xs px-2.5 py-1 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300
              border border-red-200 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors
              flex items-center gap-1"
          >
            <XCircle className="w-3 h-3" /> Rechazar
          </button>
        )}
        {quote.servicio_id && (
          <button
            onClick={() => onNavigate(quote.servicio_id!)}
            className="text-xs px-2.5 py-1 rounded-md text-indigo-600 dark:text-indigo-400
              hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors
              flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Ver servicio
          </button>
        )}
      </div>
    </div>
  );
}

// ── Formulario de presupuesto ─────────────────────────────────────────────────

interface QuoteFormData {
  titulo: string;
  tipo_servicio: string;
  fecha_servicio: string;
  fecha_fin_servicio: string;
  num_viajeros: string;
  coste_estimado: string;
  precio_sugerido: string;
  precio_final: string;
  margen_pct: string;
  notas: string;
  notas_internas: string;
  fecha_expiracion: string;
}

function emptyForm(): QuoteFormData {
  return {
    titulo: '', tipo_servicio: 'excursion',
    fecha_servicio: '', fecha_fin_servicio: '',
    num_viajeros: '', coste_estimado: '', precio_sugerido: '',
    precio_final: '', margen_pct: '', notas: '',
    notas_internas: '', fecha_expiracion: '',
  };
}

function quoteToForm(q: TradeTransportQuote): QuoteFormData {
  return {
    titulo:             q.titulo,
    tipo_servicio:      q.tipo_servicio,
    fecha_servicio:     q.fecha_servicio ?? '',
    fecha_fin_servicio: q.fecha_fin_servicio ?? '',
    num_viajeros:       q.num_viajeros?.toString() ?? '',
    coste_estimado:     q.coste_estimado?.toString() ?? '',
    precio_sugerido:    q.precio_sugerido?.toString() ?? '',
    precio_final:       q.precio_final?.toString() ?? '',
    margen_pct:         q.margen_pct?.toString() ?? '',
    notas:              q.notas ?? '',
    notas_internas:     q.notas_internas ?? '',
    fecha_expiracion:   q.fecha_expiracion ?? '',
  };
}

function formToInput(f: QuoteFormData): Partial<TradeTransportQuoteInput> {
  const n = (s: string): number | null => {
    const v = parseFloat(s);
    return s.trim() !== '' && isFinite(v) ? v : null;
  };
  const ni = (s: string): number | null => {
    const v = parseInt(s, 10);
    return s.trim() !== '' && isFinite(v) ? v : null;
  };
  const d = (s: string): string | null => s.trim() !== '' ? s.trim() : null;
  return {
    titulo:             f.titulo.trim(),
    tipo_servicio:      f.tipo_servicio as TradeTransportQuoteInput['tipo_servicio'],
    estado:             'borrador',
    fecha_servicio:     d(f.fecha_servicio),
    fecha_fin_servicio: d(f.fecha_fin_servicio),
    num_viajeros:       ni(f.num_viajeros),
    coste_estimado:     n(f.coste_estimado),
    precio_sugerido:    n(f.precio_sugerido),
    precio_final:       n(f.precio_final),
    margen_pct:         n(f.margen_pct),
    notas:              d(f.notas),
    notas_internas:     d(f.notas_internas),
    fecha_expiracion:   d(f.fecha_expiracion),
    itinerario:         [],
  };
}

interface QuoteFormProps {
  initial: QuoteFormData;
  onSave: (data: QuoteFormData) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  title: string;
}
function QuoteForm({ initial, onSave, onCancel, saving, title }: QuoteFormProps) {
  const [form, setForm] = useState<QuoteFormData>(initial);
  const [formErrors, setFormErrors] = useState<string[]>([]);

  const set = (key: keyof QuoteFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = formToInput(form);
    const errs = validateQuoteInput(input);
    if (errs.length > 0) { setFormErrors(errs); return; }
    setFormErrors([]);
    onSave(form);
  }

  const inputCls = 'w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
  const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formErrors.length > 0 && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
              <ul className="list-disc list-inside space-y-1">
                {formErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div>
            <label className={labelCls}>Título del servicio *</label>
            <input className={inputCls} value={form.titulo} onChange={set('titulo')} placeholder="Ej. Excursión Sierra Nevada — Club Senderistas" />
          </div>

          <div>
            <label className={labelCls}>Tipo de servicio *</label>
            <select className={inputCls} value={form.tipo_servicio} onChange={set('tipo_servicio')}>
              {TIPO_SERVICIO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Fecha del servicio</label>
              <input type="date" className={inputCls} value={form.fecha_servicio} onChange={set('fecha_servicio')} />
            </div>
            <div>
              <label className={labelCls}>Fecha de fin</label>
              <input type="date" className={inputCls} value={form.fecha_fin_servicio} onChange={set('fecha_fin_servicio')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nº viajeros</label>
              <input type="number" min="1" step="1" className={inputCls} value={form.num_viajeros} onChange={set('num_viajeros')} placeholder="45" />
            </div>
            <div>
              <label className={labelCls}>Expira el</label>
              <input type="date" className={inputCls} value={form.fecha_expiracion} onChange={set('fecha_expiracion')} />
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-3">Precios (€)</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Coste estimado</label>
                <input type="number" step="0.01" className={inputCls} value={form.coste_estimado} onChange={set('coste_estimado')} placeholder="800.00" />
              </div>
              <div>
                <label className={labelCls}>Precio sugerido</label>
                <input type="number" step="0.01" className={inputCls} value={form.precio_sugerido} onChange={set('precio_sugerido')} placeholder="1000.00" />
              </div>
              <div>
                <label className={labelCls}>Precio final</label>
                <input type="number" step="0.01" className={inputCls} value={form.precio_final} onChange={set('precio_final')} placeholder="980.00" />
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Notas para el cliente</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notas} onChange={set('notas')} placeholder="Incluye transporte de ida y vuelta, guía…" />
          </div>

          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea rows={2} className={`${inputCls} resize-none`} value={form.notas_internas} onChange={set('notas_internas')} placeholder="Solo visible para el equipo" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onCancel}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors flex items-center gap-2">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar presupuesto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────

type FilterKey = 'todos' | QuoteEstado;

export default function ScreenTransportePresupuestos({
  orgId,
  showToast,
  onNavigateToService,
}: Props) {
  const [quotes, setQuotes] = useState<TradeTransportQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('todos');
  const [showForm, setShowForm] = useState(false);
  const [editingQuote, setEditingQuote] = useState<TradeTransportQuote | null>(null);
  const [saving, setSaving] = useState(false);
  const showToastRef = useRef(showToast);
  useEffect(() => { showToastRef.current = showToast; }, [showToast]);

  // ── Carga ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadTransportQuotes(orgId)
      .then(data => { if (!cancelled) setQuotes(data); })
      .catch(e => { if (!cancelled) showToastRef.current(errMsg(e), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orgId]);

  // ── Filtros ───────────────────────────────────────────────────────────────

  const countFor = useCallback(
    (k: FilterKey) => k === 'todos' ? quotes.length : quotes.filter(q => q.estado === k).length,
    [quotes],
  );

  const visible = filter === 'todos' ? quotes : quotes.filter(q => q.estado === filter);

  // ── Crear / Editar ────────────────────────────────────────────────────────

  function openCreate() { setEditingQuote(null); setShowForm(true); }
  function openEdit(q: TradeTransportQuote) { setEditingQuote(q); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditingQuote(null); }

  async function handleSave(formData: QuoteFormData) {
    const input = formToInput(formData) as TradeTransportQuoteInput;
    setSaving(true);
    try {
      if (editingQuote) {
        const updated = await updateTransportQuote(editingQuote.id, orgId, input);
        setQuotes(qs => qs.map(q => q.id === updated.id ? updated : q));
        showToastRef.current('Presupuesto actualizado', 'success');
      } else {
        const created = await createTransportQuote(orgId, input);
        setQuotes(qs => [created, ...qs]);
        showToastRef.current(`Presupuesto ${created.numero_presupuesto} creado`, 'success');
      }
      closeForm();
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setSaving(false);
    }
  }

  // ── Transiciones de estado ────────────────────────────────────────────────

  async function handleSend(q: TradeTransportQuote) {
    setActionLoading(q.id + ':send');
    try {
      const updated = await sendTransportQuote(q.id, orgId);
      setQuotes(qs => qs.map(x => x.id === updated.id ? updated : x));
      showToastRef.current(`Presupuesto ${q.numero_presupuesto} marcado como enviado`, 'success');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleApprove(q: TradeTransportQuote) {
    setActionLoading(q.id + ':approve');
    try {
      const serviceId = await approveTransportQuote(q.id);
      setQuotes(qs => qs.map(x =>
        x.id === q.id ? { ...x, estado: 'aprobado' as QuoteEstado, servicio_id: serviceId } : x
      ));
      showToastRef.current(`Presupuesto aprobado. Servicio creado.`, 'success');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(q: TradeTransportQuote) {
    setActionLoading(q.id + ':reject');
    try {
      const updated = await rejectTransportQuote(q.id, orgId);
      setQuotes(qs => qs.map(x => x.id === updated.id ? updated : x));
      showToastRef.current(`Presupuesto ${q.numero_presupuesto} rechazado`, 'info');
    } catch (e) {
      showToastRef.current(errMsg(e), 'error');
    } finally {
      setActionLoading(null);
    }
  }

  function handleNavigate(serviceId: string) {
    if (onNavigateToService) onNavigateToService(serviceId);
    else showToastRef.current('Navegar al servicio: ' + serviceId, 'info');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      {/* Cabecera */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Presupuestos
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Elabora y envía presupuestos de servicios de transporte
          </p>
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <FilterTab label="Todos" count={countFor('todos')} active={filter === 'todos'} onClick={() => setFilter('todos')} />
        {QUOTE_ESTADOS.map(e => (
          <FilterTab
            key={e.value}
            label={e.label}
            count={countFor(e.value)}
            active={filter === e.value}
            onClick={() => setFilter(e.value)}
          />
        ))}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Cargando presupuestos…
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {filter === 'todos' ? 'Aún no hay presupuestos' : `Sin presupuestos en estado "${getQuoteEstadoInfo(filter as QuoteEstado).label}"`}
          </p>
          {filter === 'todos' && (
            <button
              onClick={openCreate}
              className="mt-3 text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Crear el primer presupuesto
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(q => (
            <div key={q.id} className={actionLoading?.startsWith(q.id) ? 'opacity-60 pointer-events-none' : ''}>
              <QuoteRow
                quote={q}
                onEdit={openEdit}
                onSend={handleSend}
                onApprove={handleApprove}
                onReject={handleReject}
                onNavigate={handleNavigate}
              />
            </div>
          ))}
        </div>
      )}

      {/* Aviso de estado de acción */}
      {actionLoading && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2
          bg-slate-800 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50">
          <Loader2 className="w-4 h-4 animate-spin" />
          Procesando…
        </div>
      )}

      {/* Modal formulario */}
      {showForm && (
        <QuoteForm
          initial={editingQuote ? quoteToForm(editingQuote) : emptyForm()}
          onSave={handleSave}
          onCancel={closeForm}
          saving={saving}
          title={editingQuote ? `Editar ${editingQuote.numero_presupuesto}` : 'Nuevo presupuesto'}
        />
      )}
    </div>
  );
}
