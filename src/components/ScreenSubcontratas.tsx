import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Edit2, Trash2, ChevronRight, ChevronDown,
  Building2, Briefcase, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Ban, Send, FileText, Phone, Mail, MessageSquare,
  Loader2, ArrowLeft, Users,
} from 'lucide-react';
import {
  loadSubcontractors, saveSubcontractor, deleteSubcontractor,
  loadSubcontratas, saveSubcontrata, deleteSubcontrata,
  updateSubcontrataEstado, loadSubcontrataNotes,
  addSubcontrataNota, deleteSubcontrataNota,
  loadJobs, loadContracts,
} from '../lib/supabase';
import type {
  TradeSubcontractor, TradeSubcontrata, TradeSubcontrataNota,
  TradeJob, TradeContract,
} from '../lib/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────────

type EstadoKey = TradeSubcontrata['estado'];

const ESTADO_CFG: Record<EstadoKey, { label: string; color: string; icon: React.ReactNode }> = {
  pendiente:  { label: 'Pendiente',  color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: <Clock className="w-3 h-3" /> },
  en_curso:   { label: 'En curso',   color: 'bg-blue-50 text-blue-700 border-blue-200',      icon: <AlertCircle className="w-3 h-3" /> },
  completado: { label: 'Completado', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelado:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-500 border-slate-200',  icon: <Ban className="w-3 h-3" /> },
};

function margen(coste: number, precio: number) {
  if (precio <= 0) return { euros: 0, pct: 0 };
  const euros = precio - coste;
  const pct = (euros / precio) * 100;
  return { euros, pct };
}

function fmt(n: number) { return n.toFixed(2) + '€'; }
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Empty draft ────────────────────────────────────────────────────────────────

const EMPTY_SUB: Omit<TradeSubcontrata, 'id' | 'org_id' | 'created_at' | 'updated_at' | 'trade_subcontractors' | 'trade_jobs' | 'trade_contracts'> = {
  subcontractor_id: '',
  job_id: null,
  contract_id: null,
  descripcion: '',
  coste: 0,
  precio_cliente: 0,
  estado: 'pendiente',
  fecha_inicio: null,
  fecha_fin_prevista: null,
};

const EMPTY_PROV: Omit<TradeSubcontractor, 'id' | 'org_id' | 'created_at'> = {
  nombre: '', nif: '', email: '', telefono: '', especialidad: '', notas: '', activo: true,
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function ScreenSubcontratas({ orgId, showToast }: Props) {
  // data
  const [subcontratas, setSubcontratas]     = useState<TradeSubcontrata[]>([]);
  const [proveedores, setProveedores]       = useState<TradeSubcontractor[]>([]);
  const [jobs, setJobs]                     = useState<TradeJob[]>([]);
  const [contratos, setContratos]           = useState<TradeContract[]>([]);
  const [loading, setLoading]               = useState(true);

  // UI state
  const [view, setView]                     = useState<'list' | 'detail' | 'proveedores'>('list');
  const [selected, setSelected]             = useState<TradeSubcontrata | null>(null);
  const [filterEstado, setFilterEstado]     = useState<'todos' | EstadoKey>('todos');
  const [filterProveedor, setFilterProveedor] = useState('');
  const [search, setSearch]                 = useState('');

  // modal subcontrata
  const [showModal, setShowModal]           = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [draft, setDraft]                   = useState(EMPTY_SUB);
  const [saving, setSaving]                 = useState(false);

  // modal proveedor
  const [showProvModal, setShowProvModal]   = useState(false);
  const [editingProvId, setEditingProvId]   = useState<string | null>(null);
  const [draftProv, setDraftProv]           = useState(EMPTY_PROV);

  // notas
  const [notas, setNotas]                   = useState<TradeSubcontrataNota[]>([]);
  const [notaText, setNotaText]             = useState('');
  const [sendingNota, setSendingNota]       = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [subs, provs, js, cs] = await Promise.all([
        loadSubcontratas(orgId),
        loadSubcontractors(orgId),
        loadJobs(orgId).catch(() => [] as TradeJob[]),
        loadContracts(orgId).catch(() => [] as TradeContract[]),
      ]);
      setSubcontratas(subs);
      setProveedores(provs);
      setJobs(js);
      setContratos(cs);
    } catch (e: unknown) {
      showToast('Error cargando datos: ' + (e as Error).message, 'error');
    }
    setLoading(false);
  }, [orgId, showToast]);

  useEffect(() => { reload(); }, [reload]);

  const reloadNotas = useCallback(async (subId: string) => {
    const ns = await loadSubcontrataNotes(subId).catch(() => []);
    setNotas(ns);
  }, []);

  useEffect(() => {
    if (selected) reloadNotas(selected.id);
    else setNotas([]);
  }, [selected, reloadNotas]);

  // ── Filtering ───────────────────────────────────────────────────────────────

  const filtered = subcontratas.filter(s => {
    if (filterEstado !== 'todos' && s.estado !== filterEstado) return false;
    if (filterProveedor && s.subcontractor_id !== filterProveedor) return false;
    if (search) {
      const q = search.toLowerCase();
      const prov = s.trade_subcontractors?.nombre?.toLowerCase() ?? '';
      const job  = s.trade_jobs?.titulo?.toLowerCase() ?? '';
      const cont = s.trade_contracts?.referencia?.toLowerCase() ?? '';
      const desc = s.descripcion.toLowerCase();
      if (!prov.includes(q) && !job.includes(q) && !cont.includes(q) && !desc.includes(q)) return false;
    }
    return true;
  });

  // ── Totals ──────────────────────────────────────────────────────────────────

  const totalCoste    = filtered.reduce((a, s) => a + s.coste, 0);
  const totalCliente  = filtered.reduce((a, s) => a + s.precio_cliente, 0);
  const totalMargen   = totalCliente - totalCoste;

  // ── Handlers — subcontrata ──────────────────────────────────────────────────

  function openNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_SUB, fecha_inicio: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  function openEdit(s: TradeSubcontrata) {
    setEditingId(s.id);
    setDraft({
      subcontractor_id: s.subcontractor_id,
      job_id: s.job_id ?? null,
      contract_id: s.contract_id ?? null,
      descripcion: s.descripcion,
      coste: s.coste,
      precio_cliente: s.precio_cliente,
      estado: s.estado,
      fecha_inicio: s.fecha_inicio ?? null,
      fecha_fin_prevista: s.fecha_fin_prevista ?? null,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!draft.subcontractor_id) { showToast('Selecciona un proveedor', 'error'); return; }
    if (!draft.descripcion.trim()) { showToast('Añade una descripción', 'error'); return; }
    setSaving(true);
    try {
      const saved = await saveSubcontrata(orgId, draft, editingId ?? undefined);
      if (editingId) {
        setSubcontratas(prev => prev.map(s => s.id === saved.id ? saved : s));
        if (selected?.id === saved.id) setSelected(saved);
      } else {
        setSubcontratas(prev => [saved, ...prev]);
      }
      setShowModal(false);
      showToast(editingId ? 'Subcontrata actualizada' : 'Subcontrata creada');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSaving(false);
  }

  async function handleDelete(s: TradeSubcontrata) {
    if (!confirm(`¿Eliminar subcontrata "${s.descripcion}"?`)) return;
    try {
      await deleteSubcontrata(s.id);
      setSubcontratas(prev => prev.filter(x => x.id !== s.id));
      if (selected?.id === s.id) { setSelected(null); setView('list'); }
      showToast('Subcontrata eliminada');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  async function handleEstado(s: TradeSubcontrata, estado: EstadoKey) {
    try {
      await updateSubcontrataEstado(s.id, estado);
      const updated = { ...s, estado };
      setSubcontratas(prev => prev.map(x => x.id === s.id ? updated : x));
      if (selected?.id === s.id) setSelected(updated);
      showToast('Estado actualizado');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  // ── Handlers — proveedores ──────────────────────────────────────────────────

  function openNewProv() { setEditingProvId(null); setDraftProv({ ...EMPTY_PROV }); setShowProvModal(true); }
  function openEditProv(p: TradeSubcontractor) { setEditingProvId(p.id); setDraftProv({ nombre: p.nombre, nif: p.nif ?? '', email: p.email ?? '', telefono: p.telefono ?? '', especialidad: p.especialidad ?? '', notas: p.notas ?? '', activo: p.activo }); setShowProvModal(true); }

  async function handleSaveProv() {
    if (!draftProv.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      const saved = await saveSubcontractor(orgId, draftProv, editingProvId ?? undefined);
      if (editingProvId) setProveedores(prev => prev.map(p => p.id === saved.id ? saved : p));
      else setProveedores(prev => [...prev, saved]);
      setShowProvModal(false);
      showToast(editingProvId ? 'Proveedor actualizado' : 'Proveedor añadido');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSaving(false);
  }

  async function handleDeleteProv(p: TradeSubcontractor) {
    if (!confirm(`¿Desactivar a "${p.nombre}"?`)) return;
    try {
      await deleteSubcontractor(p.id);
      setProveedores(prev => prev.filter(x => x.id !== p.id));
      showToast('Proveedor desactivado');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  // ── Handlers — notas ───────────────────────────────────────────────────────

  async function handleAddNota() {
    if (!notaText.trim() || !selected) return;
    setSendingNota(true);
    try {
      const nota = await addSubcontrataNota(selected.id, orgId, notaText.trim());
      setNotas(prev => [...prev, nota]);
      setNotaText('');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSendingNota(false);
  }

  async function handleDeleteNota(id: string) {
    try {
      await deleteSubcontrataNota(id);
      setNotas(prev => prev.filter(n => n.id !== id));
    } catch { /* ignore */ }
  }

  // ── Render helpers ──────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-violet-400 placeholder-slate-400';
  const labelCls = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider';

  // ══════════════════════════════════════════════════════════════════════════
  // VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Proveedores view ────────────────────────────────────────────────────────

  if (view === 'proveedores') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <h2 className="text-lg font-black text-slate-800">Proveedores / Subcontratistas</h2>
          <button onClick={openNewProv} className="ml-auto flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Añadir proveedor
          </button>
        </div>

        {proveedores.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">Sin proveedores</p>
            <p className="text-xs text-slate-400 mt-1">Añade las empresas a las que subcontratas trabajos</p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Especialidad</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Contacto</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">NIF</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedores.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800">{p.nombre}</p>
                      {p.notas && <p className="text-slate-400 text-[10px] mt-0.5 truncate max-w-[200px]">{p.notas}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.especialidad || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {p.telefono && <a href={`tel:${p.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline"><Phone className="w-3 h-3" />{p.telefono}</a>}
                      {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5"><Mail className="w-3 h-3" />{p.email}</a>}
                    </td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell font-mono">{p.nif || '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditProv(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteProv(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showProvModal && <ProveedorModal
          draft={draftProv} setDraft={setDraftProv}
          saving={saving} isEdit={!!editingProvId}
          onSave={handleSaveProv} onClose={() => setShowProvModal(false)}
          inputCls={inputCls} labelCls={labelCls}
        />}
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  if (view === 'detail' && selected) {
    const m = margen(selected.coste, selected.precio_cliente);
    const prov = selected.trade_subcontractors;
    const cfg = ESTADO_CFG[selected.estado];

    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Subcontratas
          </button>
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>
            {cfg.icon}{cfg.label}
          </span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:border-slate-400 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer">
              <Edit2 className="w-3 h-3" /> Editar
            </button>
            <button onClick={() => handleDelete(selected)} className="flex items-center gap-1.5 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer">
              <Trash2 className="w-3 h-3" /> Eliminar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left — info */}
          <div className="lg:col-span-2 space-y-4">

            {/* Descripción + datos */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-black text-slate-800">{selected.descripcion}</h2>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className={labelCls}>Proveedor</p>
                  <p className="font-bold text-slate-800 mt-1">{prov?.nombre ?? '—'}</p>
                  {prov?.especialidad && <p className="text-slate-400">{prov.especialidad}</p>}
                  {prov?.telefono && <a href={`tel:${prov.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-1"><Phone className="w-3 h-3" />{prov.telefono}</a>}
                  {prov?.email && <a href={`mailto:${prov.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5"><Mail className="w-3 h-3" />{prov.email}</a>}
                </div>
                <div>
                  <p className={labelCls}>Vinculado a</p>
                  <div className="mt-1">
                    {selected.trade_jobs?.titulo && <p className="font-semibold text-slate-700 flex items-center gap-1"><Briefcase className="w-3 h-3 text-slate-400" />{selected.trade_jobs.titulo}</p>}
                    {selected.trade_contracts?.referencia && <p className="font-semibold text-slate-700 flex items-center gap-1"><FileText className="w-3 h-3 text-slate-400" />{selected.trade_contracts.referencia}</p>}
                    {!selected.job_id && !selected.contract_id && <p className="text-slate-400">Sin vinculación</p>}
                  </div>
                  <p className={labelCls + ' mt-3'}>Fechas</p>
                  <p className="text-slate-600 mt-1">Inicio: {fmtDate(selected.fecha_inicio)}</p>
                  <p className="text-slate-600">Fin previsto: {fmtDate(selected.fecha_fin_prevista)}</p>
                </div>
              </div>
            </div>

            {/* Notas / historial */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5" /> Anotaciones e historial
              </h3>
              {notas.length === 0 && <p className="text-xs text-slate-400">Sin anotaciones todavía</p>}
              <div className="space-y-2">
                {notas.map(n => (
                  <div key={n.id} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{n.texto}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.created_at)}</p>
                    </div>
                    <button onClick={() => handleDeleteNota(n.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 cursor-pointer transition-opacity shrink-0">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              {/* Input nueva nota */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text" value={notaText} onChange={e => setNotaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota(); }}}
                  placeholder="Añadir anotación…"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 placeholder-slate-400"
                />
                <button
                  onClick={handleAddNota} disabled={sendingNota || !notaText.trim()}
                  className="w-9 h-9 bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0"
                >
                  {sendingNota ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Right — económico + estado */}
          <div className="space-y-4">
            {/* Resumen económico */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Económico</h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Coste subcontrata</span>
                  <span className="text-sm font-bold text-red-600">−{fmt(selected.coste)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                  <span className="text-xs text-slate-500">Lo que cobras al cliente</span>
                  <span className="text-sm font-bold text-slate-800">{fmt(selected.precio_cliente)}</span>
                </div>
                <div className="flex justify-between items-center py-2 bg-slate-50 rounded-xl px-3">
                  <span className="text-xs font-bold text-slate-600">Tu margen</span>
                  <div className="text-right">
                    <span className={`text-base font-black ${m.euros >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.euros)}</span>
                    <p className={`text-[10px] font-bold ${m.euros >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{m.pct.toFixed(1)}% sobre precio</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Cambiar estado */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3">Cambiar estado</h3>
              {(Object.keys(ESTADO_CFG) as EstadoKey[]).map(e => (
                <button
                  key={e} onClick={() => handleEstado(selected, e)}
                  className={`w-full flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border cursor-pointer transition-all ${
                    selected.estado === e ? ESTADO_CFG[e].color + ' border-current' : 'border-slate-100 text-slate-500 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {ESTADO_CFG[e].icon} {ESTADO_CFG[e].label}
                  {selected.estado === e && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {showModal && <SubcontrataModal
          draft={draft} setDraft={setDraft}
          proveedores={proveedores} jobs={jobs} contratos={contratos}
          saving={saving} isEdit={!!editingId}
          onSave={handleSave} onClose={() => setShowModal(false)}
          inputCls={inputCls} labelCls={labelCls}
        />}
      </div>
    );
  }

  // ── List view (default) ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-slate-800">Subcontratas</h2>
          <p className="text-xs text-slate-400 mt-0.5">Trabajos que externalices, con control de costes y margen</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setView('proveedores')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:border-slate-400 font-bold text-xs uppercase px-3 py-2 rounded-xl cursor-pointer">
            <Users className="w-3.5 h-3.5" /> Proveedores
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nueva subcontrata
          </button>
        </div>
      </div>

      {/* KPI row */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Coste total',       value: fmt(totalCoste),   sub: `${filtered.length} subcontrata${filtered.length !== 1 ? 's' : ''}`, color: 'text-red-600' },
            { label: 'Facturado cliente', value: fmt(totalCliente), sub: 'Por estas subcontratas', color: 'text-slate-800' },
            { label: 'Margen total',      value: fmt(totalMargen),  sub: totalCliente > 0 ? ((totalMargen / totalCliente) * 100).toFixed(1) + '% sobre precio' : '—', color: totalMargen >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={`text-xl font-black mt-1 ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Estado chips */}
        <div className="flex gap-1.5 flex-wrap">
          {(['todos', ...Object.keys(ESTADO_CFG)] as Array<'todos' | EstadoKey>).map(e => {
            const count = e === 'todos' ? subcontratas.length : subcontratas.filter(s => s.estado === e).length;
            if (e !== 'todos' && count === 0) return null;
            const isActive = filterEstado === e;
            const label = e === 'todos' ? 'Todos' : ESTADO_CFG[e as EstadoKey].label;
            return (
              <button key={e} onClick={() => setFilterEstado(e)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${
                  isActive ? 'bg-violet-600 text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                }`}
              >
                {label}
                <span className={`text-[9px] font-black px-1.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar…"
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 w-40"
        />
        <select value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 cursor-pointer">
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Table / empty */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">
            {subcontratas.length === 0 ? 'Sin subcontratas todavía' : 'Sin resultados para este filtro'}
          </p>
          {subcontratas.length === 0 && (
            <>
              <p className="text-xs text-slate-400 mt-1 mb-4 max-w-xs mx-auto">
                Cuando externalices un trabajo — puntual o de mantenimiento — regístralo aquí para controlar costes y margen
              </p>
              {proveedores.length === 0 && (
                <button onClick={() => setView('proveedores')} className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 border border-violet-200 px-4 py-2 rounded-xl hover:bg-violet-50 cursor-pointer mr-2">
                  <Building2 className="w-3.5 h-3.5" /> Añadir proveedor primero
                </button>
              )}
              <button onClick={openNew} className="inline-flex items-center gap-2 text-xs font-bold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Nueva subcontrata
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Descripción / Proveedor</th>
                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Vinculado a</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Coste</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Precio cliente</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Margen</th>
                <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => {
                const m = margen(s.coste, s.precio_cliente);
                const cfg = ESTADO_CFG[s.estado];
                return (
                  <tr key={s.id} onClick={() => { setSelected(s); setView('detail'); }}
                    className="cursor-pointer hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 truncate max-w-[180px]">{s.descripcion}</p>
                      <p className="text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-2.5 h-2.5" />
                        {s.trade_subcontractors?.nombre ?? '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {s.trade_jobs?.titulo && <span className="flex items-center gap-1"><Briefcase className="w-2.5 h-2.5 text-slate-400" />{s.trade_jobs.titulo}</span>}
                      {s.trade_contracts?.referencia && <span className="flex items-center gap-1"><FileText className="w-2.5 h-2.5 text-slate-400" />{s.trade_contracts.referencia}</span>}
                      {!s.job_id && !s.contract_id && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{fmt(s.coste)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 hidden sm:table-cell">{fmt(s.precio_cliente)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={`font-mono font-black ${m.euros >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.euros)}</span>
                      <p className={`text-[9px] ${m.euros >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{m.pct.toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>
                        {cfg.icon}{cfg.label}
                      </span>
                    </td>
                    <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDelete(s)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && <SubcontrataModal
        draft={draft} setDraft={setDraft}
        proveedores={proveedores} jobs={jobs} contratos={contratos}
        saving={saving} isEdit={!!editingId}
        onSave={handleSave} onClose={() => setShowModal(false)}
        inputCls={inputCls} labelCls={labelCls}
      />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — Nueva / Editar subcontrata
// ══════════════════════════════════════════════════════════════════════════════

interface SubcontrataModalProps {
  draft: typeof EMPTY_SUB;
  setDraft: React.Dispatch<React.SetStateAction<typeof EMPTY_SUB>>;
  proveedores: TradeSubcontractor[];
  jobs: TradeJob[];
  contratos: TradeContract[];
  saving: boolean;
  isEdit: boolean;
  onSave: () => void;
  onClose: () => void;
  inputCls: string;
  labelCls: string;
}

function SubcontrataModal({ draft, setDraft, proveedores, jobs, contratos, saving, isEdit, onSave, onClose, inputCls, labelCls }: SubcontrataModalProps) {
  const set = <K extends keyof typeof EMPTY_SUB>(k: K, v: (typeof EMPTY_SUB)[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  const m = margen(draft.coste, draft.precio_cliente);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h3 className="font-black text-slate-800">{isEdit ? 'Editar subcontrata' : 'Nueva subcontrata'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {/* Proveedor */}
          <div>
            <label className={labelCls}>Proveedor / Subcontratista *</label>
            <select value={draft.subcontractor_id} onChange={e => set('subcontractor_id', e.target.value)}
              className={inputCls + ' mt-1'}>
              <option value="">— Selecciona proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.especialidad ? ` · ${p.especialidad}` : ''}</option>)}
            </select>
            {proveedores.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Sin proveedores — cierra y añade uno primero desde "Proveedores"</p>}
          </div>

          {/* Descripción */}
          <div>
            <label className={labelCls}>Descripción del trabajo *</label>
            <input type="text" value={draft.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Ej: Instalación eléctrica del local, zona norte" className={inputCls + ' mt-1'} />
          </div>

          {/* Vinculación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Trabajo (opcional)</label>
              <select value={draft.job_id ?? ''} onChange={e => set('job_id', e.target.value || null)}
                className={inputCls + ' mt-1'}>
                <option value="">Sin trabajo</option>
                {jobs.filter(j => j.estado !== 'cancelado').map(j => <option key={j.id} value={j.id}>{j.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contrato mantenimiento (opcional)</label>
              <select value={draft.contract_id ?? ''} onChange={e => set('contract_id', e.target.value || null)}
                className={inputCls + ' mt-1'}>
                <option value="">Sin contrato</option>
                {contratos.map((c: TradeContract) => <option key={c.id} value={c.id}>{c.referencia}</option>)}
              </select>
            </div>
          </div>

          {/* Económico */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Coste (lo que te cobra) *</label>
              <input type="number" min="0" step="0.01" value={draft.coste}
                onChange={e => set('coste', parseFloat(e.target.value) || 0)}
                className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Precio al cliente (lo que cobras tú) *</label>
              <input type="number" min="0" step="0.01" value={draft.precio_cliente}
                onChange={e => set('precio_cliente', parseFloat(e.target.value) || 0)}
                className={inputCls + ' mt-1'} />
            </div>
          </div>

          {/* Margen preview */}
          {(draft.coste > 0 || draft.precio_cliente > 0) && (
            <div className={`rounded-xl px-4 py-3 flex items-center justify-between text-sm ${m.euros >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
              <span className="text-xs font-bold text-slate-600">Tu margen</span>
              <div className="text-right">
                <span className={`font-black ${m.euros >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(m.euros)}</span>
                <span className={`text-xs ml-2 ${m.euros >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>({m.pct.toFixed(1)}%)</span>
              </div>
            </div>
          )}

          {/* Fechas + estado */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fecha inicio</label>
              <input type="date" value={draft.fecha_inicio ?? ''} onChange={e => set('fecha_inicio', e.target.value || null)}
                className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Fin previsto</label>
              <input type="date" value={draft.fecha_fin_prevista ?? ''} onChange={e => set('fecha_fin_prevista', e.target.value || null)}
                className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={draft.estado} onChange={e => set('estado', e.target.value as EstadoKey)}
                className={inputCls + ' mt-1'}>
                {(Object.keys(ESTADO_CFG) as EstadoKey[]).map(e => (
                  <option key={e} value={e}>{ESTADO_CFG[e].label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {isEdit ? 'Guardar cambios' : 'Crear subcontrata'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — Proveedor
// ══════════════════════════════════════════════════════════════════════════════

interface ProveedorModalProps {
  draft: typeof EMPTY_PROV;
  setDraft: React.Dispatch<React.SetStateAction<typeof EMPTY_PROV>>;
  saving: boolean;
  isEdit: boolean;
  onSave: () => void;
  onClose: () => void;
  inputCls: string;
  labelCls: string;
}

function ProveedorModal({ draft, setDraft, saving, isEdit, onSave, onClose, inputCls, labelCls }: ProveedorModalProps) {
  const set = <K extends keyof typeof EMPTY_PROV>(k: K, v: (typeof EMPTY_PROV)[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
          <h3 className="font-black text-slate-800">{isEdit ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className={labelCls}>Nombre empresa *</label>
            <input type="text" value={draft.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="ElecPro S.L." className={inputCls + ' mt-1'} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>NIF / CIF</label>
              <input type="text" value={draft.nif ?? ''} onChange={e => set('nif', e.target.value)}
                placeholder="B12345678" className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Especialidad</label>
              <input type="text" value={draft.especialidad ?? ''} onChange={e => set('especialidad', e.target.value)}
                placeholder="Electricidad, Fontanería…" className={inputCls + ' mt-1'} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Teléfono</label>
              <input type="tel" value={draft.telefono ?? ''} onChange={e => set('telefono', e.target.value)}
                placeholder="600 000 000" className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={draft.email ?? ''} onChange={e => set('email', e.target.value)}
                placeholder="info@empresa.com" className={inputCls + ' mt-1'} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={draft.notas ?? ''} onChange={e => set('notas', e.target.value)}
              rows={2} placeholder="Condiciones de pago, observaciones…"
              className={inputCls + ' mt-1 resize-none'} />
          </div>
        </div>
        <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {isEdit ? 'Guardar' : 'Añadir proveedor'}
          </button>
        </div>
      </div>
    </div>
  );
}
