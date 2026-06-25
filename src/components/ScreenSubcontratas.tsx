/**
 * Módulo de Trabajos Externalizados
 * Interno: "subcontrata" — Visible al cliente: NUNCA (solo "partida de obra")
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Plus, X, Edit2, Trash2, ChevronRight,
  Building2, Briefcase, TrendingUp, Clock, CheckCircle2,
  AlertCircle, Ban, Send, FileText, Phone, Mail, MessageSquare,
  Loader2, ArrowLeft, Users, CreditCard, Receipt, Link,
  Star, MapPin, Shield, Percent,
} from 'lucide-react';
import {
  loadSubcontractors, saveSubcontractor, deleteSubcontractor,
  loadSubcontratas, saveSubcontrata, deleteSubcontrata,
  updateSubcontrataEstado, loadSubcontrataNotes,
  addSubcontrataNota, deleteSubcontrataNota,
  loadJobs, loadContracts, addSubcontrataToJobQuote,
  registrarFacturaSubcontrata, marcarSubcontrataPagada,
} from '../lib/supabase';
import type {
  TradeSubcontractor, TradeSubcontrata, TradeSubcontrataNota,
  TradeJob, TradeContract,
} from '../lib/supabase';

// ── Estado labels (interno — nunca mostrar "subcontrata" al cliente) ────────────

type EstadoKey = TradeSubcontrata['estado'];

const ESTADO_CFG: Record<EstadoKey, { label: string; color: string; icon: React.ReactNode; desc: string }> = {
  pendiente:              { label: 'Borrador',                  color: 'bg-slate-100 text-slate-600 border-slate-200',      icon: <FileText className="w-3 h-3" />,    desc: 'Trabajo pendiente de solicitar' },
  solicitado:             { label: 'Solicitado',                color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: <Send className="w-3 h-3" />,        desc: 'Enviado al proveedor, esperando presupuesto' },
  presupuesto_recibido:   { label: 'Ppto. recibido',           color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: <Receipt className="w-3 h-3" />,     desc: 'Proveedor ha enviado su precio' },
  añadido_presupuesto:    { label: 'En presupuesto',           color: 'bg-violet-50 text-violet-700 border-violet-200',    icon: <FileText className="w-3 h-3" />,    desc: 'Incluido en el presupuesto al cliente' },
  pendiente_cliente:      { label: 'Pte. cliente',             color: 'bg-orange-50 text-orange-700 border-orange-200',    icon: <Clock className="w-3 h-3" />,       desc: 'Presupuesto enviado al cliente, esperando' },
  en_curso:               { label: 'En curso',                 color: 'bg-sky-50 text-sky-700 border-sky-200',             icon: <AlertCircle className="w-3 h-3" />, desc: 'Trabajo en ejecución' },
  completado:             { label: 'Finalizado',               color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle2 className="w-3 h-3" />, desc: 'Trabajo completado por el proveedor' },
  factura_recibida:       { label: 'Factura recibida',         color: 'bg-teal-50 text-teal-700 border-teal-200',          icon: <Receipt className="w-3 h-3" />,     desc: 'Factura del proveedor recibida' },
  pagado:                 { label: 'Pagado',                   color: 'bg-green-50 text-green-700 border-green-200',       icon: <CreditCard className="w-3 h-3" />,  desc: 'Proveedor pagado' },
  cancelado:              { label: 'Cancelado',                color: 'bg-slate-100 text-slate-400 border-slate-200',      icon: <Ban className="w-3 h-3" />,         desc: 'Trabajo cancelado' },
};

const ESTADOS_ORDEN: EstadoKey[] = [
  'pendiente', 'solicitado', 'presupuesto_recibido', 'añadido_presupuesto',
  'pendiente_cliente', 'en_curso', 'completado', 'factura_recibida', 'pagado', 'cancelado',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function margen(coste: number, precio: number) {
  if (precio <= 0) return { euros: 0, pct: 0 };
  const euros = precio - coste;
  const pct = (euros / precio) * 100;
  return { euros, pct };
}

function precioConMargen(coste: number, margenPct: number): number {
  if (margenPct >= 100) return coste;
  return coste / (1 - margenPct / 100);
}

function fmt(n: number) { return n.toFixed(2) + '€'; }
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Draft defaults ─────────────────────────────────────────────────────────────

const EMPTY_SUB = {
  subcontractor_id: '',
  job_id: null as string | null,
  contract_id: null as string | null,
  quote_id: null as string | null,
  descripcion: '',
  coste: 0,
  precio_cliente: 0,
  margenPct: 25, // campo UI para calcular precio
  estado: 'pendiente' as EstadoKey,
  fecha_inicio: null as string | null,
  fecha_fin_prevista: null as string | null,
};

const EMPTY_PROV = {
  nombre: '', nif: '', email: '', telefono: '',
  especialidad: '', notas: '', activo: true,
  // Campos ampliados
  direccion_fiscal: '', direccion_trabajo: '',
  persona_contacto: '', horarios: '', cobertura: '',
  valoracion: 5, estado_proveedor: 'activo' as 'activo' | 'pendiente' | 'bloqueado',
};

// ══════════════════════════════════════════════════════════════════════════════
export default function ScreenSubcontratas({ orgId, showToast }: Props) {
  // data
  const [subcontratas, setSubcontratas]     = useState<TradeSubcontrata[]>([]);
  const [proveedores, setProveedores]       = useState<TradeSubcontractor[]>([]);
  const [jobs, setJobs]                     = useState<TradeJob[]>([]);
  const [contratos, setContratos]           = useState<TradeContract[]>([]);
  const [loading, setLoading]               = useState(true);

  // UI
  const [view, setView]   = useState<'list' | 'detail' | 'proveedores' | 'prov_detail'>('list');
  const [selected, setSelected]             = useState<TradeSubcontrata | null>(null);
  const [selectedProv, setSelectedProv]     = useState<TradeSubcontractor | null>(null);
  const [filterEstado, setFilterEstado]     = useState<'todos' | EstadoKey>('todos');
  const [filterProveedor, setFilterProveedor] = useState('');
  const [search, setSearch]                 = useState('');

  // modal trabajo externalizado
  const [showModal, setShowModal]           = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [draft, setDraft]                   = useState({ ...EMPTY_SUB });
  const [saving, setSaving]                 = useState(false);

  // modal proveedor
  const [showProvModal, setShowProvModal]   = useState(false);
  const [editingProvId, setEditingProvId]   = useState<string | null>(null);
  const [draftProv, setDraftProv]           = useState({ ...EMPTY_PROV });

  // notas
  const [notas, setNotas]                   = useState<TradeSubcontrataNota[]>([]);
  const [notaText, setNotaText]             = useState('');
  const [sendingNota, setSendingNota]       = useState(false);

  // factura recibida / pago
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [draftFactura, setDraftFactura] = useState({ importe: 0, fecha: '', referencia: '' });
  const [savingFactura, setSavingFactura]       = useState(false);

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

  const totalCoste   = filtered.reduce((a, s) => a + s.coste, 0);
  const totalCliente = filtered.reduce((a, s) => a + s.precio_cliente, 0);
  const totalMargen  = totalCliente - totalCoste;

  // ── Handlers — trabajo externalizado ───────────────────────────────────────

  function openNew() {
    setEditingId(null);
    setDraft({ ...EMPTY_SUB, fecha_inicio: new Date().toISOString().split('T')[0] });
    setShowModal(true);
  }

  function openEdit(s: TradeSubcontrata) {
    setEditingId(s.id);
    const mg = s.precio_cliente > 0 ? ((s.precio_cliente - s.coste) / s.precio_cliente * 100) : 25;
    setDraft({
      subcontractor_id: s.subcontractor_id,
      job_id: s.job_id ?? null,
      contract_id: s.contract_id ?? null,
      quote_id: s.quote_id ?? null,
      descripcion: s.descripcion,
      coste: s.coste,
      precio_cliente: s.precio_cliente,
      margenPct: Math.round(mg),
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
      const payload = { ...draft };
      delete (payload as Record<string, unknown>).margenPct;
      const saved = await saveSubcontrata(orgId, payload as Parameters<typeof saveSubcontrata>[1], editingId ?? undefined);
      if (editingId) {
        setSubcontratas(prev => prev.map(s => s.id === saved.id ? saved : s));
        if (selected?.id === saved.id) setSelected(saved);
        showToast('Trabajo actualizado');
      } else {
        setSubcontratas(prev => [saved, ...prev]);
        let msg = 'Trabajo externalizado creado';
        if (draft.job_id && draft.precio_cliente > 0) {
          const r = await addSubcontrataToJobQuote(draft.job_id, saved.id, draft.descripcion, draft.precio_cliente).catch(() => null);
          if (r) msg = `Creado y añadido al presupuesto ${r.quoteNumero}`;
        }
        showToast(msg);
      }
      setShowModal(false);
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSaving(false);
  }

  async function handleDelete(s: TradeSubcontrata) {
    if (!confirm(`¿Eliminar "${s.descripcion}"?`)) return;
    try {
      await deleteSubcontrata(s.id);
      setSubcontratas(prev => prev.filter(x => x.id !== s.id));
      if (selected?.id === s.id) { setSelected(null); setView('list'); }
      showToast('Eliminado');
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
  function openEditProv(p: TradeSubcontractor) {
    setEditingProvId(p.id);
    const extra = p as unknown as Record<string, unknown>;
    setDraftProv({
      nombre: p.nombre, nif: p.nif ?? '', email: p.email ?? '', telefono: p.telefono ?? '',
      especialidad: p.especialidad ?? '', notas: p.notas ?? '', activo: p.activo,
      direccion_fiscal: (extra.direccion_fiscal as string) ?? '',
      direccion_trabajo: (extra.direccion_trabajo as string) ?? '',
      persona_contacto: (extra.persona_contacto as string) ?? '',
      horarios: (extra.horarios as string) ?? '',
      cobertura: (extra.cobertura as string) ?? '',
      valoracion: (extra.valoracion as number) ?? 5,
      estado_proveedor: (extra.estado_proveedor as 'activo' | 'pendiente' | 'bloqueado') ?? 'activo',
    });
    setShowProvModal(true);
  }

  async function handleSaveProv() {
    if (!draftProv.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSaving(true);
    try {
      const { direccion_fiscal, direccion_trabajo, persona_contacto, horarios, cobertura, valoracion, estado_proveedor, ...base } = draftProv;
      const payload = { ...base, direccion_fiscal, direccion_trabajo, persona_contacto, horarios, cobertura, valoracion, estado_proveedor } as Parameters<typeof saveSubcontractor>[1];
      const saved = await saveSubcontractor(orgId, payload, editingProvId ?? undefined);
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
      if (selectedProv?.id === p.id) { setSelectedProv(null); setView('proveedores'); }
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

  // ── Handlers — factura / pago ───────────────────────────────────────────────

  async function handleGuardarFactura() {
    if (!selected || !draftFactura.importe) return;
    setSavingFactura(true);
    try {
      await registrarFacturaSubcontrata(selected.id, draftFactura.importe, draftFactura.fecha, draftFactura.referencia);
      const updated = { ...selected, importe_factura_recibida: draftFactura.importe, fecha_factura_recibida: draftFactura.fecha, referencia_factura_subcontrata: draftFactura.referencia, estado: 'factura_recibida' as EstadoKey };
      setSelected(updated);
      setSubcontratas(prev => prev.map(s => s.id === updated.id ? updated : s));
      setShowFacturaModal(false);
      showToast('Factura registrada');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSavingFactura(false);
  }

  async function handleTogglePago() {
    if (!selected) return;
    const nuevo = !selected.pagado;
    try {
      await marcarSubcontrataPagada(selected.id, nuevo);
      const updated = { ...selected, pagado: nuevo, pagado_at: nuevo ? new Date().toISOString() : null, estado: nuevo ? 'pagado' as EstadoKey : selected.estado };
      setSelected(updated);
      setSubcontratas(prev => prev.map(s => s.id === updated.id ? updated : s));
      showToast(nuevo ? 'Proveedor marcado como pagado' : 'Marcado como pendiente');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  // ── CSS helpers ─────────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-violet-400 placeholder-slate-400';
  const labelCls = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider';

  // ── KPIs dashboard ──────────────────────────────────────────────────────────

  const activos    = subcontratas.filter(s => !['cancelado', 'pagado'].includes(s.estado)).length;
  const pendConf   = subcontratas.filter(s => s.estado === 'pendiente_cliente').length;
  const factPend   = subcontratas.filter(s => s.estado === 'factura_recibida' && !s.pagado).length;
  const beneficio  = subcontratas.filter(s => s.estado === 'pagado').reduce((a, s) => a + (s.precio_cliente - s.coste), 0);

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA DETALLE PROVEEDOR
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'prov_detail' && selectedProv) {
    const extra = selectedProv as unknown as Record<string, unknown>;
    const historial = subcontratas.filter(s => s.subcontractor_id === selectedProv.id);
    const totalFacturado = historial.reduce((a, s) => a + s.coste, 0);
    const ESTADO_COLOR: Record<string, string> = { activo: 'bg-emerald-100 text-emerald-700', pendiente: 'bg-amber-100 text-amber-700', bloqueado: 'bg-red-100 text-red-700' };
    const estadoProv = (extra.estado_proveedor as string) ?? 'activo';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('proveedores')} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"><ArrowLeft className="w-4 h-4" /> Proveedores</button>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${ESTADO_COLOR[estadoProv] ?? ''}`}>{estadoProv}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => openEditProv(selectedProv)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:border-slate-400 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer"><Edit2 className="w-3 h-3" /> Editar</button>
            <button onClick={() => handleDeleteProv(selectedProv)} className="flex items-center gap-1.5 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer"><Trash2 className="w-3 h-3" /> Desactivar</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

            {/* Info principal */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-slate-800">{selectedProv.nombre}</h2>
                  {selectedProv.nif && <p className="text-xs text-slate-400 font-mono mt-0.5">NIF/CIF: {selectedProv.nif}</p>}
                  {selectedProv.especialidad && <p className="text-xs text-slate-500 mt-1">{selectedProv.especialidad}</p>}
                </div>
                {/* Valoración */}
                <div className="flex items-center gap-0.5">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= ((extra.valoracion as number) ?? 5) ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                {selectedProv.telefono && <div><p className={labelCls}>Teléfono</p><a href={`tel:${selectedProv.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-1"><Phone className="w-3 h-3" />{selectedProv.telefono}</a></div>}
                {selectedProv.email && <div><p className={labelCls}>Email</p><a href={`mailto:${selectedProv.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-1"><Mail className="w-3 h-3" />{selectedProv.email}</a></div>}
                {!!extra.persona_contacto && <div><p className={labelCls}>Contacto</p><p className="text-slate-700 mt-1">{String(extra.persona_contacto)}</p></div>}
                {!!extra.horarios && <div><p className={labelCls}>Horarios</p><p className="text-slate-700 mt-1">{String(extra.horarios)}</p></div>}
                {!!extra.direccion_fiscal && <div><p className={labelCls}>Dirección fiscal</p><p className="flex items-center gap-1 text-slate-700 mt-1"><MapPin className="w-3 h-3 text-slate-400 shrink-0" />{String(extra.direccion_fiscal)}</p></div>}
                {!!extra.cobertura && <div><p className={labelCls}>Cobertura geográfica</p><p className="text-slate-700 mt-1">{String(extra.cobertura)}</p></div>}
              </div>
              {selectedProv.notas && <div><p className={labelCls}>Observaciones</p><p className="text-xs text-slate-600 mt-1 bg-slate-50 rounded-xl p-3">{selectedProv.notas}</p></div>}
            </div>

            {/* Historial de trabajos */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Historial de trabajos ({historial.length})</h3>
              {historial.length === 0 ? <p className="text-xs text-slate-400">Sin trabajos asignados</p> : (
                <div className="space-y-2">
                  {historial.map(s => {
                    const cfg = ESTADO_CFG[s.estado] ?? ESTADO_CFG.pendiente;
                    return (
                      <div key={s.id} onClick={() => { setSelected(s); setView('detail'); }}
                        className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-300 cursor-pointer text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-800 truncate">{s.descripcion}</p>
                          {s.numero && <p className="text-violet-500 font-mono text-[10px]">{s.numero}</p>}
                        </div>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
                        <span className="font-mono font-bold text-slate-700 shrink-0">{fmt(s.coste)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar económico */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Resumen económico</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-slate-500">Trabajos realizados</span><span className="font-bold">{historial.length}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-slate-500">Total facturado (coste)</span><span className="font-bold text-red-600">{fmt(totalFacturado)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100"><span className="text-slate-500">Trabajos activos</span><span className="font-bold text-blue-600">{historial.filter(s => !['cancelado', 'pagado', 'completado'].includes(s.estado)).length}</span></div>
                <div className="flex justify-between py-1.5"><span className="text-slate-500">Pagados</span><span className="font-bold text-emerald-600">{historial.filter(s => s.pagado).length}</span></div>
              </div>
            </div>

            <button onClick={() => { openNew(); setDraft(d => ({ ...d, subcontractor_id: selectedProv.id })); }}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase px-4 py-3 rounded-xl cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Nuevo trabajo externalizado
            </button>
          </div>
        </div>
        {showProvModal && <ProveedorModal draft={draftProv} setDraft={setDraftProv} saving={saving} isEdit={!!editingProvId} onSave={handleSaveProv} onClose={() => setShowProvModal(false)} inputCls={inputCls} labelCls={labelCls} />}
        {showModal && <TrabajoModal draft={draft} setDraft={setDraft} proveedores={proveedores} jobs={jobs} contratos={contratos} saving={saving} isEdit={!!editingId} onSave={handleSave} onClose={() => setShowModal(false)} inputCls={inputCls} labelCls={labelCls} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA LISTADO PROVEEDORES
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'proveedores') {
    const ESTADO_PROV_CFG = {
      activo:    { label: 'Activo',    color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      pendiente: { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200' },
      bloqueado: { label: 'Bloqueado', color: 'bg-red-100 text-red-700 border-red-200' },
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer"><ArrowLeft className="w-4 h-4" /> Volver</button>
          <h2 className="text-lg font-black text-slate-800">Proveedores colaboradores</h2>
          <button onClick={openNewProv} className="ml-auto flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Añadir proveedor
          </button>
        </div>

        {proveedores.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">Sin proveedores</p>
            <p className="text-xs text-slate-400 mt-1">Añade los colaboradores a los que externalizas trabajos</p>
            <button onClick={openNewProv} className="mt-4 inline-flex items-center gap-2 text-xs font-bold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Añadir proveedor
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Empresa</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Especialidad</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Contacto</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Estado</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Val.</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proveedores.map(p => {
                  const extra = p as unknown as Record<string, unknown>;
                  const ep = (extra.estado_proveedor as string) ?? 'activo';
                  const epCfg = ESTADO_PROV_CFG[ep as keyof typeof ESTADO_PROV_CFG] ?? ESTADO_PROV_CFG.activo;
                  const val = (extra.valoracion as number) ?? 5;
                  return (
                    <tr key={p.id} onClick={() => { setSelectedProv(p); setView('prov_detail'); }} className="cursor-pointer hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-800">{p.nombre}</p>
                        {p.nif && <p className="text-[10px] font-mono text-slate-400">{p.nif}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.especialidad || '—'}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        {p.telefono && <a href={`tel:${p.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline" onClick={e => e.stopPropagation()}><Phone className="w-3 h-3" />{p.telefono}</a>}
                        {p.email && <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5" onClick={e => e.stopPropagation()}><Mail className="w-3 h-3" />{p.email}</a>}
                      </td>
                      <td className="px-4 py-3 text-center hidden sm:table-cell">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${epCfg.color}`}>{epCfg.label}</span>
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-0.5">
                          {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= val ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />)}
                        </div>
                      </td>
                      <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditProv(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteProv(p)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
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
        {showProvModal && <ProveedorModal draft={draftProv} setDraft={setDraftProv} saving={saving} isEdit={!!editingProvId} onSave={handleSaveProv} onClose={() => setShowProvModal(false)} inputCls={inputCls} labelCls={labelCls} />}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA DETALLE TRABAJO
  // ══════════════════════════════════════════════════════════════════════════

  if (view === 'detail' && selected) {
    const m = margen(selected.coste, selected.precio_cliente);
    const prov = selected.trade_subcontractors;
    const cfg = ESTADO_CFG[selected.estado] ?? ESTADO_CFG.pendiente;
    const estadoIdx = ESTADOS_ORDEN.indexOf(selected.estado);
    const bloqueado = selected.pagado || selected.estado === 'pagado';

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { setView('list'); setSelected(null); }} className="flex items-center gap-1 text-slate-400 hover:text-slate-700 text-sm cursor-pointer">
            <ArrowLeft className="w-4 h-4" /> Trabajos externalizados
          </button>
          {selected.numero && <span className="font-mono text-[10px] font-bold text-violet-500 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">{selected.numero}</span>}
          <span className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
          {bloqueado && (
            <span className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-400 border border-slate-200">
              <Shield className="w-3 h-3" /> Solo lectura
            </span>
          )}
          {!bloqueado && (
            <div className="ml-auto flex gap-2">
              <button onClick={() => openEdit(selected)} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:border-slate-400 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer"><Edit2 className="w-3 h-3" /> Editar</button>
              <button onClick={() => handleDelete(selected)} className="flex items-center gap-1.5 border border-red-200 text-red-500 hover:bg-red-50 font-bold text-xs uppercase px-3 py-1.5 rounded-xl cursor-pointer"><Trash2 className="w-3 h-3" /> Eliminar</button>
            </div>
          )}
        </div>

        {/* Barra de progreso de estados */}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {ESTADOS_ORDEN.filter(e => e !== 'cancelado').map((e, i) => {
              const c = ESTADO_CFG[e];
              const done = ESTADOS_ORDEN.indexOf(e) <= estadoIdx && selected.estado !== 'cancelado';
              const active = e === selected.estado;
              return (
                <button key={e} onClick={() => !bloqueado && handleEstado(selected, e)}
                  disabled={bloqueado}
                  className={`flex items-center gap-1 text-[9px] font-bold px-2 py-1.5 rounded-lg border whitespace-nowrap transition-all shrink-0 ${
                    bloqueado ? 'cursor-default opacity-70' : 'cursor-pointer'
                  } ${
                    active ? c.color + ' border-current' : done ? 'bg-slate-100 text-slate-500 border-slate-200' : 'border-slate-100 text-slate-400 hover:border-slate-300'
                  }`}
                  title={bloqueado ? 'Trabajo cerrado — solo lectura' : c.desc}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">

            {/* Info */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h2 className="text-base font-black text-slate-800">{selected.descripcion}</h2>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className={labelCls}>Proveedor colaborador</p>
                  <p className="font-bold text-slate-800 mt-1">{prov?.nombre ?? '—'}</p>
                  {prov?.especialidad && <p className="text-slate-400">{prov.especialidad}</p>}
                  {prov?.telefono && <a href={`tel:${prov.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-1"><Phone className="w-3 h-3" />{prov.telefono}</a>}
                  {prov?.email && <a href={`mailto:${prov.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5"><Mail className="w-3 h-3" />{prov.email}</a>}
                </div>
                <div>
                  <p className={labelCls}>Vinculado a</p>
                  <div className="mt-1 space-y-0.5">
                    {selected.trade_jobs?.titulo && <p className="font-semibold text-slate-700 flex items-center gap-1"><Briefcase className="w-3 h-3 text-slate-400" />{selected.trade_jobs.titulo}</p>}
                    {selected.trade_contracts?.referencia && <p className="font-semibold text-slate-700 flex items-center gap-1"><FileText className="w-3 h-3 text-slate-400" />{selected.trade_contracts.referencia}</p>}
                    {selected.trade_quotes?.numero && <p className="font-semibold text-violet-700 flex items-center gap-1"><Link className="w-3 h-3" />{selected.trade_quotes.numero}</p>}
                    {!selected.job_id && !selected.contract_id && !selected.quote_id && <p className="text-slate-400">Sin vinculación</p>}
                  </div>
                  <p className={labelCls + ' mt-3'}>Fechas</p>
                  <p className="text-slate-600 mt-1">Inicio: {fmtDate(selected.fecha_inicio)}</p>
                  <p className="text-slate-600">Fin previsto: {fmtDate(selected.fecha_fin_prevista)}</p>
                </div>
              </div>
            </div>

            {/* Notas */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5" /> Anotaciones e historial</h3>
              {notas.length === 0 && <p className="text-xs text-slate-400">Sin anotaciones</p>}
              <div className="space-y-2">
                {notas.map(n => (
                  <div key={n.id} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 flex items-start gap-2 group">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{n.texto}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{fmtDate(n.created_at)}</p>
                    </div>
                    <button onClick={() => handleDeleteNota(n.id)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-red-500 cursor-pointer transition-opacity shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <input type="text" value={notaText} onChange={e => setNotaText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota(); }}}
                  placeholder="Añadir anotación…"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 placeholder-slate-400" />
                <button onClick={handleAddNota} disabled={sendingNota || !notaText.trim()}
                  className="w-9 h-9 bg-violet-600 hover:bg-violet-700 text-white rounded-xl flex items-center justify-center cursor-pointer disabled:opacity-40 shrink-0">
                  {sendingNota ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Derecha */}
          <div className="space-y-4">
            {/* Económico */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Económico (interno)</h3>
              <div className="space-y-1">
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-xs"><span className="text-slate-500">Presupuestado al cliente</span><span className="font-bold text-slate-800">{fmt(selected.precio_cliente)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-xs"><span className="text-slate-500">Coste previsto proveedor</span><span className="font-bold text-red-500">−{fmt(selected.coste)}</span></div>
                {selected.importe_factura_recibida != null && (
                  <div className="flex justify-between py-1.5 border-b border-slate-100 text-xs"><span className="text-slate-500">Factura real recibida</span><span className="font-bold text-red-600">−{fmt(selected.importe_factura_recibida)}</span></div>
                )}
                <div className="flex justify-between py-1.5 bg-slate-50 rounded-xl px-3 mt-1">
                  <span className="text-xs font-bold text-slate-600">Margen intermediación</span>
                  <div className="text-right">
                    <span className={`text-base font-black ${m.euros >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.euros)}</span>
                    <p className={`text-[10px] font-bold ${m.euros >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{m.pct.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Factura recibida */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Factura proveedor</h3>
                <button onClick={() => { setDraftFactura({ importe: selected.importe_factura_recibida ?? selected.coste, fecha: selected.fecha_factura_recibida ?? new Date().toISOString().split('T')[0], referencia: selected.referencia_factura_subcontrata ?? '' }); setShowFacturaModal(true); }}
                  className="text-[10px] font-bold text-violet-600 border border-violet-200 px-2 py-1 rounded-lg hover:bg-violet-50 cursor-pointer">
                  {selected.importe_factura_recibida != null ? 'Editar' : '+ Registrar'}
                </button>
              </div>
              {selected.importe_factura_recibida != null ? (
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Importe</span><span className="font-bold text-red-600">{fmt(selected.importe_factura_recibida)}</span></div>
                  {selected.fecha_factura_recibida && <div className="flex justify-between"><span className="text-slate-400">Fecha</span><span className="text-slate-700">{fmtDate(selected.fecha_factura_recibida)}</span></div>}
                  {selected.referencia_factura_subcontrata && <div className="flex justify-between"><span className="text-slate-400">Ref.</span><span className="font-mono text-slate-700">{selected.referencia_factura_subcontrata}</span></div>}
                </div>
              ) : <p className="text-xs text-slate-400">Pendiente de recibir factura del proveedor</p>}
            </div>

            {/* Pago */}
            <div className={`rounded-xl p-4 border ${selected.pagado ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className={`w-4 h-4 ${selected.pagado ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <p className={`text-xs font-black ${selected.pagado ? 'text-emerald-700' : 'text-slate-600'}`}>{selected.pagado ? 'Proveedor pagado' : 'Pago pendiente'}</p>
                    {selected.pagado_at && <p className="text-[10px] text-emerald-500">{fmtDate(selected.pagado_at)}</p>}
                  </div>
                </div>
                <button onClick={handleTogglePago}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border cursor-pointer ${selected.pagado ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700'}`}>
                  {selected.pagado ? 'Desmarcar' : 'Marcar pagado'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {showModal && <TrabajoModal draft={draft} setDraft={setDraft} proveedores={proveedores} jobs={jobs} contratos={contratos} saving={saving} isEdit={!!editingId} onSave={handleSave} onClose={() => setShowModal(false)} inputCls={inputCls} labelCls={labelCls} />}

        {showFacturaModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFacturaModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-800">Registrar factura del proveedor</h3>
                <button onClick={() => setShowFacturaModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div><label className={labelCls}>Importe *</label><input type="number" min="0" step="0.01" value={draftFactura.importe} onChange={e => setDraftFactura(f => ({ ...f, importe: parseFloat(e.target.value) || 0 }))} className={inputCls + ' mt-1'} autoFocus /></div>
                <div><label className={labelCls}>Fecha</label><input type="date" value={draftFactura.fecha} onChange={e => setDraftFactura(f => ({ ...f, fecha: e.target.value }))} className={inputCls + ' mt-1'} /></div>
                <div><label className={labelCls}>Nº / Referencia factura</label><input type="text" value={draftFactura.referencia} placeholder="Ej: F-2026-0123" onChange={e => setDraftFactura(f => ({ ...f, referencia: e.target.value }))} className={inputCls + ' mt-1'} /></div>
              </div>
              <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setShowFacturaModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer">Cancelar</button>
                <button onClick={handleGuardarFactura} disabled={savingFactura || !draftFactura.importe} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {savingFactura ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}Guardar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA LISTA PRINCIPAL
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-slate-800">Trabajos Externalizados</h2>
          <p className="text-xs text-slate-400 mt-0.5">Gestión interna de trabajos asignados a proveedores colaboradores</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={() => setView('proveedores')} className="flex items-center gap-1.5 border border-slate-200 text-slate-600 hover:border-slate-400 font-bold text-xs uppercase px-3 py-2 rounded-xl cursor-pointer">
            <Users className="w-3.5 h-3.5" /> Proveedores
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nuevo trabajo
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Activos',             value: activos,                  color: 'text-blue-600',    sub: 'en curso o pendientes' },
          { label: 'Pte. confirmación',   value: pendConf,                 color: 'text-amber-600',   sub: 'esperando cliente' },
          { label: 'Facturas pendientes', value: factPend,                 color: 'text-red-600',     sub: 'por pagar' },
          { label: 'Margen obtenido',     value: fmt(beneficio),           color: 'text-emerald-600', sub: 'trabajos cerrados' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
            <p className={`text-xl font-black mt-1 ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Totales */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Coste proveedores',    value: fmt(totalCoste),   color: 'text-red-600' },
            { label: 'Facturado a clientes', value: fmt(totalCliente), color: 'text-slate-800' },
            { label: 'Margen filtrado',      value: fmt(totalMargen),  color: totalMargen >= 0 ? 'text-emerald-600' : 'text-red-600' },
          ].map(k => (
            <div key={k.label} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{k.label}</p>
              <p className={`text-lg font-black mt-0.5 ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1.5 flex-wrap">
          {(['todos', ...ESTADOS_ORDEN] as Array<'todos' | EstadoKey>).map(e => {
            const count = e === 'todos' ? subcontratas.length : subcontratas.filter(s => s.estado === e).length;
            if (e !== 'todos' && count === 0) return null;
            const isActive = filterEstado === e;
            const label = e === 'todos' ? 'Todos' : ESTADO_CFG[e as EstadoKey]?.label ?? e;
            return (
              <button key={e} onClick={() => setFilterEstado(e)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border cursor-pointer transition-all ${isActive ? 'bg-violet-600 text-white border-transparent' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                {label}
                <span className={`text-[9px] font-black px-1.5 rounded-full ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 w-40" />
        <select value={filterProveedor} onChange={e => setFilterProveedor(e.target.value)} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-violet-400 cursor-pointer">
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-14 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500">{subcontratas.length === 0 ? 'Sin trabajos externalizados' : 'Sin resultados'}</p>
          {subcontratas.length === 0 && (
            <>
              <p className="text-xs text-slate-400 mt-1 mb-4 max-w-xs mx-auto">Cuando externalices un trabajo a un proveedor, regístralo aquí para controlar costes y margen sin que el cliente lo vea</p>
              {proveedores.length === 0 && (
                <button onClick={() => setView('proveedores')} className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 border border-violet-200 px-4 py-2 rounded-xl hover:bg-violet-50 cursor-pointer mr-2">
                  <Building2 className="w-3.5 h-3.5" /> Añadir proveedor primero
                </button>
              )}
              <button onClick={openNew} className="inline-flex items-center gap-2 text-xs font-bold bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 cursor-pointer">
                <Plus className="w-3.5 h-3.5" /> Nuevo trabajo
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
                <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Vinculado</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Coste</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">P. cliente</th>
                <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Margen</th>
                <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(s => {
                const m = margen(s.coste, s.precio_cliente);
                const cfg = ESTADO_CFG[s.estado] ?? ESTADO_CFG.pendiente;
                return (
                  <tr key={s.id} onClick={() => { setSelected(s); setView('detail'); }} className="cursor-pointer hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 truncate max-w-[180px]">{s.descripcion}</p>
                      <p className="text-slate-400 flex items-center gap-1 mt-0.5"><Building2 className="w-2.5 h-2.5" />{s.trade_subcontractors?.nombre ?? '—'}
                        {s.numero && <span className="font-mono text-[9px] text-violet-400 ml-1">{s.numero}</span>}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {s.trade_jobs?.titulo && <span className="flex items-center gap-1"><Briefcase className="w-2.5 h-2.5 text-slate-400" />{s.trade_jobs.titulo}</span>}
                      {s.trade_quotes?.numero && <span className="flex items-center gap-1 text-violet-600"><Link className="w-2.5 h-2.5" />{s.trade_quotes.numero}</span>}
                      {!s.job_id && !s.contract_id && !s.quote_id && <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{fmt(s.coste)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 hidden sm:table-cell">{fmt(s.precio_cliente)}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={`font-mono font-black ${m.euros >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(m.euros)}</span>
                      <p className={`text-[9px] ${m.euros >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{m.pct.toFixed(1)}%</p>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.icon}{cfg.label}</span>
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

      {showModal && <TrabajoModal draft={draft} setDraft={setDraft} proveedores={proveedores} jobs={jobs} contratos={contratos} saving={saving} isEdit={!!editingId} onSave={handleSave} onClose={() => setShowModal(false)} inputCls={inputCls} labelCls={labelCls} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — Nuevo / Editar trabajo externalizado
// ══════════════════════════════════════════════════════════════════════════════

interface TrabajoModalProps {
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

function TrabajoModal({ draft, setDraft, proveedores, jobs, contratos, saving, isEdit, onSave, onClose, inputCls, labelCls }: TrabajoModalProps) {
  const set = <K extends keyof typeof EMPTY_SUB>(k: K, v: (typeof EMPTY_SUB)[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  function applyMargen(margenPct: number) {
    const precio = precioConMargen(draft.coste, margenPct);
    setDraft(prev => ({ ...prev, margenPct, precio_cliente: Math.round(precio * 100) / 100 }));
  }

  function applyCostePrecio(coste: number, precio: number) {
    const mg = precio > 0 ? ((precio - coste) / precio * 100) : 0;
    setDraft(prev => ({ ...prev, coste, precio_cliente: precio, margenPct: Math.round(mg) }));
  }

  const m = margen(draft.coste, draft.precio_cliente);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h3 className="font-black text-slate-800">{isEdit ? 'Editar trabajo externalizado' : 'Nuevo trabajo externalizado'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div>
            <label className={labelCls}>Proveedor colaborador *</label>
            <select value={draft.subcontractor_id} onChange={e => set('subcontractor_id', e.target.value)} className={inputCls + ' mt-1'}>
              <option value="">— Selecciona proveedor —</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.especialidad ? ` · ${p.especialidad}` : ''}</option>)}
            </select>
            {proveedores.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Sin proveedores — añade uno desde "Proveedores"</p>}
          </div>

          <div>
            <label className={labelCls}>Descripción del trabajo *</label>
            <input type="text" value={draft.descripcion} onChange={e => set('descripcion', e.target.value)}
              placeholder="Ej: Instalación unidades interiores climatización" className={inputCls + ' mt-1'} />
            <p className="text-[9px] text-slate-400 mt-1">Esta descripción es interna. En el presupuesto al cliente aparece como "Trabajos de instalación" sin mencionar al proveedor.</p>
          </div>

          {/* Vinculación */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Trabajo asociado</label>
              <select value={draft.job_id ?? ''} onChange={e => set('job_id', e.target.value || null)} className={inputCls + ' mt-1'}>
                <option value="">Sin trabajo</option>
                {jobs.filter(j => j.estado !== 'cancelado').map(j => <option key={j.id} value={j.id}>{j.titulo}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contrato mantenimiento</label>
              <select value={draft.contract_id ?? ''} onChange={e => set('contract_id', e.target.value || null)} className={inputCls + ' mt-1'}>
                <option value="">Sin contrato</option>
                {contratos.map(c => <option key={c.id} value={c.id}>{c.referencia}</option>)}
              </select>
            </div>
          </div>

          {/* Económico con calculadora de margen */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Percent className="w-3 h-3" /> Cálculo económico (solo visible internamente)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Coste proveedor *</label>
                <input type="number" min="0" step="0.01" value={draft.coste}
                  onChange={e => {
                    const c = parseFloat(e.target.value) || 0;
                    const precio = precioConMargen(c, draft.margenPct);
                    setDraft(prev => ({ ...prev, coste: c, precio_cliente: Math.round(precio * 100) / 100 }));
                  }}
                  className={inputCls + ' mt-1'} />
              </div>
              <div>
                <label className={labelCls}>Margen %</label>
                <div className="flex gap-1 mt-1">
                  <input type="number" min="0" max="99" value={draft.margenPct}
                    onChange={e => applyMargen(parseInt(e.target.value) || 0)}
                    className="w-20 px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:outline-none focus:border-violet-400" />
                  {[15, 20, 25, 30, 40].map(p => (
                    <button key={p} onClick={() => applyMargen(p)} type="button"
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${draft.margenPct === p ? 'bg-violet-600 text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-violet-300'}`}>
                      {p}%
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div>
              <label className={labelCls}>Precio al cliente (calculado automáticamente)</label>
              <input type="number" min="0" step="0.01" value={draft.precio_cliente}
                onChange={e => applyCostePrecio(draft.coste, parseFloat(e.target.value) || 0)}
                className={inputCls + ' mt-1'} />
            </div>
            {(draft.coste > 0 || draft.precio_cliente > 0) && (
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${m.euros >= 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                <div className="text-xs text-slate-600">
                  <p>Coste: <strong className="text-red-600">{fmt(draft.coste)}</strong></p>
                  <p>Venta: <strong className="text-slate-800">{fmt(draft.precio_cliente)}</strong></p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black ${m.euros >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(m.euros)}</p>
                  <p className="text-[10px] text-slate-500">Margen intermediación ({m.pct.toFixed(1)}%)</p>
                </div>
              </div>
            )}
          </div>

          {/* Fechas + estado */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Fecha inicio</label>
              <input type="date" value={draft.fecha_inicio ?? ''} onChange={e => set('fecha_inicio', e.target.value || null)} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Fin previsto</label>
              <input type="date" value={draft.fecha_fin_prevista ?? ''} onChange={e => set('fecha_fin_prevista', e.target.value || null)} className={inputCls + ' mt-1'} />
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select value={draft.estado} onChange={e => set('estado', e.target.value as EstadoKey)} className={inputCls + ' mt-1'}>
                {ESTADOS_ORDEN.map(e => <option key={e} value={e}>{ESTADO_CFG[e]?.label ?? e}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
          <button onClick={onSave} disabled={saving} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {isEdit ? 'Guardar cambios' : 'Crear trabajo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL — Proveedor (ficha ampliada)
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
  const [tab, setTab] = useState<'basico' | 'avanzado'>('basico');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <h3 className="font-black text-slate-800">{isEdit ? 'Editar proveedor' : 'Nuevo proveedor colaborador'}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 shrink-0">
          {(['basico', 'avanzado'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 border-b-2 cursor-pointer transition-all ${tab === t ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              {t === 'basico' ? 'Datos básicos' : 'Avanzado'}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5 space-y-3 flex-1">
          {tab === 'basico' ? (
            <>
              <div><label className={labelCls}>Razón social *</label><input type="text" value={draft.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Electricidad López S.L." className={inputCls + ' mt-1'} autoFocus /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>NIF / CIF</label><input type="text" value={draft.nif ?? ''} onChange={e => set('nif', e.target.value)} placeholder="B12345678" className={inputCls + ' mt-1'} /></div>
                <div><label className={labelCls}>Estado</label>
                  <select value={draft.estado_proveedor} onChange={e => set('estado_proveedor', e.target.value as 'activo' | 'pendiente' | 'bloqueado')} className={inputCls + ' mt-1'}>
                    <option value="activo">Activo</option>
                    <option value="pendiente">Pendiente validación</option>
                    <option value="bloqueado">Bloqueado</option>
                  </select>
                </div>
              </div>
              <div><label className={labelCls}>Especialidades / Tipos de trabajo</label><input type="text" value={draft.especialidad ?? ''} onChange={e => set('especialidad', e.target.value)} placeholder="Electricidad, Fontanería, Climatización…" className={inputCls + ' mt-1'} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Persona de contacto</label><input type="text" value={draft.persona_contacto ?? ''} onChange={e => set('persona_contacto', e.target.value)} placeholder="Juan García" className={inputCls + ' mt-1'} /></div>
                <div><label className={labelCls}>Teléfono</label><input type="tel" value={draft.telefono ?? ''} onChange={e => set('telefono', e.target.value)} placeholder="600 000 000" className={inputCls + ' mt-1'} /></div>
              </div>
              <div><label className={labelCls}>Email</label><input type="email" value={draft.email ?? ''} onChange={e => set('email', e.target.value)} placeholder="info@empresa.com" className={inputCls + ' mt-1'} /></div>
              <div>
                <label className={labelCls}>Valoración interna</label>
                <div className="flex items-center gap-1.5 mt-2">
                  {[1,2,3,4,5].map(n => (
                    <button key={n} type="button" onClick={() => set('valoracion', n)}
                      className={`w-8 h-8 rounded-lg border cursor-pointer transition-all flex items-center justify-center ${n <= draft.valoracion ? 'bg-amber-400 border-amber-400 text-white' : 'border-slate-200 text-slate-300 hover:border-amber-300'}`}>
                      <Star className={`w-4 h-4 ${n <= draft.valoracion ? 'fill-white' : ''}`} />
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-2">{draft.valoracion}/5</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div><label className={labelCls}>Dirección fiscal</label><input type="text" value={draft.direccion_fiscal ?? ''} onChange={e => set('direccion_fiscal', e.target.value)} placeholder="C/ Ejemplo 1, 28001 Madrid" className={inputCls + ' mt-1'} /></div>
              <div><label className={labelCls}>Dirección de trabajo (si es diferente)</label><input type="text" value={draft.direccion_trabajo ?? ''} onChange={e => set('direccion_trabajo', e.target.value)} placeholder="Zona de cobertura o sede operativa" className={inputCls + ' mt-1'} /></div>
              <div><label className={labelCls}>Cobertura geográfica</label><input type="text" value={draft.cobertura ?? ''} onChange={e => set('cobertura', e.target.value)} placeholder="Madrid y área metropolitana, Toledo…" className={inputCls + ' mt-1'} /></div>
              <div><label className={labelCls}>Horarios de trabajo</label><input type="text" value={draft.horarios ?? ''} onChange={e => set('horarios', e.target.value)} placeholder="L-V 8:00-18:00, urgencias 24h" className={inputCls + ' mt-1'} /></div>
              <div>
                <label className={labelCls}>Observaciones internas</label>
                <textarea value={draft.notas ?? ''} onChange={e => set('notas', e.target.value)} rows={3}
                  placeholder="Condiciones de pago, acuerdos especiales, documentación pendiente…"
                  className={inputCls + ' mt-1 resize-none'} />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-[10px] font-bold text-amber-700 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Documentación</p>
                <p className="text-[10px] text-amber-600 mt-0.5">Próximamente: adjuntar seguros de responsabilidad, certificados PRL, contratos firmados.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
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

