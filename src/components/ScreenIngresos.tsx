import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, RefreshCw, Plus, X,
  Edit2, Trash2, CheckCircle2, Loader2, Building2,
  Phone, Mail, Globe, MapPin, Receipt, CreditCard,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TradeClient, TradeQuote } from '../lib/supabase';
import {
  loadMayoristas, saveMayorista, deleteMayorista,
  loadCompras, saveCompra, deleteCompra, marcarCompraPagada,
  loadSubcontratas, loadSubcontractors,
} from '../lib/supabase';
import type { TradeMayorista, TradeCompra, TradeSubcontrata, TradeSubcontractor } from '../lib/supabase';
import { useSession } from '../context/SessionContext';

// ── Types ──────────────────────────────────────────────────────────────────────

type InvoiceRow = {
  id: string; org_id: string; quote_id?: string; client_id?: string;
  numero: string; fecha: string; estado: 'Pendiente' | 'Pagada' | 'Vencida';
  subtotal: number; iva_pct: number; iva_importe: number; total: number;
  paid_at?: string; created_at: string; updated_at: string;
  trade_clients?: { nombre: string } | null;
};

type Period = 'month' | 'quarter' | 'year' | 'all';
type MainTab = 'ingresos' | 'gastos' | 'resultado';
type GastosTab = 'compras' | 'externalizados' | 'mayoristas';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month',   label: 'Este mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year',    label: 'Este año' },
  { value: 'all',     label: 'Todo' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
  if (p === 'year')    return new Date(now.getFullYear(), 0, 1);
  return null;
}

function fmt(n: number) { return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }); }
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

const EMPTY_COMPRA = {
  mayorista_id: null as string | null,
  subcontrata_id: null as string | null,
  referencia_factura: '',
  concepto: '',
  importe: 0,
  iva_pct: 21,
  fecha: new Date().toISOString().split('T')[0],
  fecha_vencimiento: null as string | null,
  pagado: false,
  pagado_at: null as string | null,
  job_id: null as string | null,
  notas: '',
};

const EMPTY_MAYOR = {
  nombre: '', razon_social: '', nif: '',
  direccion_fiscal: '', cp: '', ciudad: '', provincia: '',
  telefono: '', email: '', persona_contacto: '', web: '', notas: '',
  activo: true,
};

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ScreenIngresos({ showToast }: Props) {
  const { org } = useSession();
  const [mainTab, setMainTab] = useState<MainTab>('ingresos');
  const [gastosTab, setGastosTab] = useState<GastosTab>('compras');
  const [period, setPeriod] = useState<Period>('year');
  const [loading, setLoading] = useState(true);

  // Ingresos data
  const [invoices, setInvoices]   = useState<InvoiceRow[]>([]);
  const [pipeline, setPipeline]   = useState<Pick<TradeQuote, 'id' | 'total_con_iva' | 'estado' | 'fecha' | 'client_id'>[]>([]);
  const [clientes, setClientes]   = useState<Pick<TradeClient, 'id' | 'nombre' | 'total_facturado'>[]>([]);

  // Gastos data
  const [compras, setCompras]           = useState<TradeCompra[]>([]);
  const [mayoristas, setMayoristas]     = useState<TradeMayorista[]>([]);
  const [externas, setExternas]         = useState<TradeSubcontrata[]>([]);
  const [subcontractors, setSubcontractors] = useState<TradeSubcontractor[]>([]);

  // Modal compra
  const [showCompraModal, setShowCompraModal] = useState(false);
  const [editingCompraId, setEditingCompraId] = useState<string | null>(null);
  const [draftCompra, setDraftCompra]         = useState({ ...EMPTY_COMPRA });
  const [savingCompra, setSavingCompra]       = useState(false);

  // Modal mayorista
  const [showMayorModal, setShowMayorModal] = useState(false);
  const [editingMayorId, setEditingMayorId] = useState<string | null>(null);
  const [draftMayor, setDraftMayor]         = useState({ ...EMPTY_MAYOR });
  const [savingMayor, setSavingMayor]       = useState(false);

  const reload = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const [invRes, qRes, cliRes, cpRes, myRes, extRes, subRes] = await Promise.all([
        supabase.from('trade_invoices').select('*, trade_clients(nombre)').eq('org_id', org.id).order('fecha', { ascending: false }),
        supabase.from('trade_quotes').select('id, total_con_iva, estado, fecha, client_id').eq('org_id', org.id).eq('estado', 'Aceptado'),
        supabase.from('trade_clients').select('id, nombre, total_facturado').eq('org_id', org.id).order('total_facturado', { ascending: false }).limit(8),
        loadCompras(org.id),
        loadMayoristas(org.id),
        loadSubcontratas(org.id),
        loadSubcontractors(org.id),
      ]);
      setInvoices((invRes.data ?? []) as InvoiceRow[]);
      setPipeline((qRes.data ?? []) as typeof pipeline);
      setClientes((cliRes.data ?? []) as typeof clientes);
      setCompras(cpRes);
      setMayoristas(myRes);
      setExternas(extRes);
      setSubcontractors(subRes);
    } catch { showToast('Error cargando datos', 'error'); }
    setLoading(false);
  }, [org, showToast]);

  useEffect(() => { reload(); }, [reload]);

  // ── Filtros por período ────────────────────────────────────────────────────

  const start = periodStart(period);
  const filtInv = invoices.filter(i => !start || new Date(i.fecha) >= start);
  const filtComp = compras.filter(c => !start || !c.fecha || new Date(c.fecha) >= start);
  const filtExt  = externas.filter(s => s.importe_factura_recibida != null && (!start || new Date(s.created_at) >= start));

  // ── KPIs Ingresos ──────────────────────────────────────────────────────────

  const totalFacturado = filtInv.reduce((s, i) => s + i.total, 0);
  const totalCobrado   = filtInv.filter(i => i.estado === 'Pagada').reduce((s, i) => s + i.total, 0);
  const totalPendiente = filtInv.filter(i => i.estado !== 'Pagada').reduce((s, i) => s + i.total, 0);
  const pipelineTotal  = pipeline.reduce((s, q) => s + (q.total_con_iva ?? 0), 0);
  const vencidas       = filtInv.filter(i => i.estado === 'Vencida').length;
  const cobradoPct     = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0;

  // ── KPIs Gastos ────────────────────────────────────────────────────────────

  const totalCompras       = filtComp.reduce((s, c) => s + c.importe * (1 + c.iva_pct / 100), 0);
  const comprasPagadas     = filtComp.filter(c => c.pagado).reduce((s, c) => s + c.importe * (1 + c.iva_pct / 100), 0);
  const comprasPendientes  = totalCompras - comprasPagadas;
  const totalExternas      = filtExt.reduce((s, e) => s + (e.importe_factura_recibida ?? e.coste), 0);
  const externasPagadas    = filtExt.filter(e => e.pagado).reduce((s, e) => s + (e.importe_factura_recibida ?? e.coste), 0);
  const totalGastos        = totalCompras + totalExternas;

  // ── KPIs Resultado ─────────────────────────────────────────────────────────

  const resultado     = totalCobrado - (comprasPagadas + externasPagadas);
  const margenBruto   = totalFacturado > 0 ? ((totalFacturado - totalGastos) / totalFacturado * 100) : 0;

  // ── Chart mensual ──────────────────────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const y = d.getFullYear(); const m = d.getMonth();
      const label = d.toLocaleString('es-ES', { month: 'short' });
      const ingresos = invoices.filter(inv => { const fd = new Date(inv.fecha); return fd.getFullYear() === y && fd.getMonth() === m; }).reduce((s, inv) => s + inv.total, 0);
      const gastos = compras.filter(c => c.fecha && (() => { const fd = new Date(c.fecha!); return fd.getFullYear() === y && fd.getMonth() === m; })()).reduce((s, c) => s + c.importe, 0);
      months.push({ label, ingresos, gastos });
    }
    return months;
  }, [invoices, compras]);

  const chartMax = Math.max(...monthlyData.flatMap(m => [m.ingresos, m.gastos]), 1);

  // ── Handlers compras ───────────────────────────────────────────────────────

  function openNewCompra(mayorId?: string) {
    setEditingCompraId(null);
    setDraftCompra({ ...EMPTY_COMPRA, fecha: new Date().toISOString().split('T')[0], mayorista_id: mayorId ?? null });
    setShowCompraModal(true);
  }

  function openEditCompra(c: TradeCompra) {
    setEditingCompraId(c.id);
    setDraftCompra({
      mayorista_id: c.mayorista_id ?? null,
      subcontrata_id: c.subcontrata_id ?? null,
      referencia_factura: c.referencia_factura ?? '',
      concepto: c.concepto,
      importe: c.importe,
      iva_pct: c.iva_pct,
      fecha: c.fecha ?? new Date().toISOString().split('T')[0],
      fecha_vencimiento: c.fecha_vencimiento ?? null,
      pagado: c.pagado,
      pagado_at: c.pagado_at ?? null,
      job_id: c.job_id ?? null,
      notas: c.notas ?? '',
    });
    setShowCompraModal(true);
  }

  async function handleSaveCompra() {
    if (!org || !draftCompra.concepto.trim()) { showToast('Añade un concepto', 'error'); return; }
    setSavingCompra(true);
    try {
      const payload = { ...draftCompra, referencia_factura: draftCompra.referencia_factura || null, fecha_vencimiento: draftCompra.fecha_vencimiento || null, notas: draftCompra.notas || null };
      const saved = await saveCompra(org.id, payload, editingCompraId ?? undefined);
      if (editingCompraId) setCompras(prev => prev.map(c => c.id === saved.id ? saved : c));
      else setCompras(prev => [saved, ...prev]);
      setShowCompraModal(false);
      showToast(editingCompraId ? 'Factura actualizada' : 'Factura registrada');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSavingCompra(false);
  }

  async function handleDeleteCompra(c: TradeCompra) {
    if (!confirm(`¿Eliminar "${c.concepto}"?`)) return;
    try {
      await deleteCompra(c.id);
      setCompras(prev => prev.filter(x => x.id !== c.id));
      showToast('Eliminado');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  async function handleToggleCompraPago(c: TradeCompra) {
    try {
      await marcarCompraPagada(c.id, !c.pagado);
      setCompras(prev => prev.map(x => x.id === c.id ? { ...x, pagado: !c.pagado, pagado_at: !c.pagado ? new Date().toISOString() : null } : x));
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  // ── Handlers mayoristas ────────────────────────────────────────────────────

  function openNewMayor() { setEditingMayorId(null); setDraftMayor({ ...EMPTY_MAYOR }); setShowMayorModal(true); }
  function openEditMayor(m: TradeMayorista) {
    setEditingMayorId(m.id);
    setDraftMayor({ nombre: m.nombre, razon_social: m.razon_social ?? '', nif: m.nif ?? '', direccion_fiscal: m.direccion_fiscal ?? '', cp: m.cp ?? '', ciudad: m.ciudad ?? '', provincia: m.provincia ?? '', telefono: m.telefono ?? '', email: m.email ?? '', persona_contacto: m.persona_contacto ?? '', web: m.web ?? '', notas: m.notas ?? '', activo: m.activo });
    setShowMayorModal(true);
  }

  async function handleSaveMayor() {
    if (!org || !draftMayor.nombre.trim()) { showToast('El nombre es obligatorio', 'error'); return; }
    setSavingMayor(true);
    try {
      const saved = await saveMayorista(org.id, draftMayor as Parameters<typeof saveMayorista>[1], editingMayorId ?? undefined);
      if (editingMayorId) setMayoristas(prev => prev.map(m => m.id === saved.id ? saved : m));
      else setMayoristas(prev => [...prev, saved]);
      setShowMayorModal(false);
      showToast(editingMayorId ? 'Proveedor actualizado' : 'Proveedor añadido');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
    setSavingMayor(false);
  }

  async function handleDeleteMayor(m: TradeMayorista) {
    if (!confirm(`¿Desactivar "${m.nombre}"?`)) return;
    try {
      await deleteMayorista(m.id);
      setMayoristas(prev => prev.filter(x => x.id !== m.id));
      showToast('Desactivado');
    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
  }

  // ── CSS helpers ────────────────────────────────────────────────────────────

  const inputCls = 'w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:border-blue-400 placeholder-slate-400';
  const labelCls = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider';

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* Cabecera + período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rentabilidad de tu negocio</p>
          <button onClick={reload} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-50" title="Actualizar">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${period === p.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs principales */}
      <div className="flex border-b border-slate-200 gap-1">
        {([
          { id: 'ingresos',  label: 'Ingresos',   color: 'text-blue-600',   active: 'border-blue-600' },
          { id: 'gastos',    label: 'Gastos',      color: 'text-red-600',    active: 'border-red-600' },
          { id: 'resultado', label: 'Resultado',   color: 'text-emerald-600',active: 'border-emerald-600' },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)}
            className={`text-xs font-bold uppercase tracking-wider px-5 py-2.5 border-b-2 cursor-pointer transition-all ${
              mainTab === t.id ? `${t.active} ${t.color}` : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

      {/* ══ TAB INGRESOS ══ */}
      {!loading && mainTab === 'ingresos' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <KpiCard label="Total facturado" value={fmt(totalFacturado)} sub={`${filtInv.length} facturas`} color="text-slate-900" border="border-slate-200" />
            <KpiCard label="Cobrado" value={fmt(totalCobrado)} sub={`${cobradoPct}% del total`} color="text-emerald-600" border="border-emerald-200" progress={cobradoPct} progressColor="bg-emerald-500" />
            <KpiCard label="Pendiente de cobro" value={fmt(totalPendiente)} sub={vencidas > 0 ? `${vencidas} vencida${vencidas !== 1 ? 's' : ''}` : 'Sin vencidas'} color="text-amber-600" border="border-amber-200" />
            <KpiCard label="Pipeline" value={fmt(pipelineTotal)} sub={`${pipeline.length} presup. aceptados sin facturar`} color="text-purple-600" border="border-purple-200" />
          </div>

          {/* Gráfico */}
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-5">Ingresos vs Gastos — últimos 6 meses</p>
            <div className="flex items-end gap-3" style={{ height: '120px' }}>
              {monthlyData.map((m, i) => {
                const iPct = chartMax > 0 ? (m.ingresos / chartMax) * 100 : 0;
                const gPct = chartMax > 0 ? (m.gastos / chartMax) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ height: '100%' }}>
                    <div className="flex-1 w-full flex items-end gap-0.5">
                      <div className={`flex-1 rounded-t transition-all ${m.ingresos > 0 ? 'bg-blue-500' : 'bg-slate-100'}`} style={{ height: `${Math.max(iPct, 3)}%` }} title={`Ingresos: ${fmt(m.ingresos)}`} />
                      <div className={`flex-1 rounded-t transition-all ${m.gastos > 0 ? 'bg-red-400' : 'bg-slate-100'}`} style={{ height: `${Math.max(gPct, 3)}%` }} title={`Gastos: ${fmt(m.gastos)}`} />
                    </div>
                    <span className="text-[9px] text-slate-400 uppercase font-medium">{m.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Ingresos</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-400 inline-block" /> Gastos compras</span>
            </div>
          </div>

          {/* Top clientes */}
          {clientes.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top clientes por facturación</p>
              </div>
              {clientes.map((c, idx) => {
                const maxVal = clientes[0]?.total_facturado ?? 1;
                const pct = maxVal > 0 ? (c.total_facturado / maxVal) * 100 : 0;
                return (
                  <div key={c.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx < clientes.length - 1 ? 'border-b border-slate-100' : ''}`}>
                    <span className="text-xs font-bold text-slate-300 w-4">{idx + 1}</span>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</p>
                      <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                    </div>
                    <span className="text-sm font-bold text-slate-900 shrink-0">{fmt(c.total_facturado)}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Facturas */}
          {filtInv.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas del periodo</p>
                <span className="text-[10px] text-slate-400">{filtInv.length} facturas</span>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Nº</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Cliente</th>
                  <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Fecha</th>
                  <th className="text-right px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Total</th>
                  <th className="text-center px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Estado</th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {filtInv.slice(0, 20).map(inv => {
                    const badge = inv.estado === 'Pagada' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : inv.estado === 'Vencida' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-600 border-amber-200';
                    return (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-600 text-[10px]">{inv.numero}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800 truncate max-w-[130px] text-[10px]">{inv.trade_clients?.nombre ?? '—'}</td>
                        <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell">{inv.fecha}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">{fmt(inv.total)}</td>
                        <td className="px-4 py-2.5 text-center"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>{inv.estado}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {invoices.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No hay datos de facturación aún.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB GASTOS ══ */}
      {!loading && mainTab === 'gastos' && (
        <div className="space-y-5">

          {/* KPIs gastos */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total compras mat." value={fmt(totalCompras)} sub={`${filtComp.length} facturas`} color="text-red-600" border="border-red-200" />
            <KpiCard label="Compras pagadas" value={fmt(comprasPagadas)} sub={fmt(comprasPendientes) + ' pendiente'} color="text-slate-700" border="border-slate-200" />
            <KpiCard label="Facturas externas" value={fmt(totalExternas)} sub={`${filtExt.length} trabajos`} color="text-orange-600" border="border-orange-200" />
            <KpiCard label="Total gastos" value={fmt(totalGastos)} sub="compras + externalizados" color="text-red-700" border="border-red-300" />
          </div>

          {/* Subtabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {([
              { id: 'compras',       label: `Compras material (${compras.length})` },
              { id: 'externalizados', label: `Externalizados (${externas.filter(e => e.importe_factura_recibida != null).length})` },
              { id: 'mayoristas',    label: `Proveedores (${mayoristas.length})` },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setGastosTab(t.id)}
                className={`text-[11px] font-bold px-4 py-2 rounded-lg cursor-pointer transition-all ${gastosTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ─ Compras material ─ */}
          {gastosTab === 'compras' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Facturas de compra de material y suministros</p>
                <button onClick={() => openNewCompra()} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Nueva factura
                </button>
              </div>

              {filtComp.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sin facturas de compra</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Registra las facturas de material y suministros que recibes</p>
                  <button onClick={() => openNewCompra()} className="inline-flex items-center gap-2 text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-xl hover:bg-red-700 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Añadir factura
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Concepto / Proveedor</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden md:table-cell">Ref. factura</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Fecha</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Importe</th>
                      <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Pago</th>
                      <th className="px-2 py-3"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtComp.map(c => {
                        const totalConIva = c.importe * (1 + c.iva_pct / 100);
                        return (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800 truncate max-w-[180px]">{c.concepto}</p>
                              {c.trade_mayoristas?.nombre && <p className="text-slate-400 flex items-center gap-1 mt-0.5"><Building2 className="w-2.5 h-2.5" />{c.trade_mayoristas.nombre}</p>}
                              {!c.trade_mayoristas?.nombre && c.trade_subcontractors?.nombre && <p className="text-violet-500 flex items-center gap-1 mt-0.5"><Building2 className="w-2.5 h-2.5" />{c.trade_subcontractors.nombre} <span className="text-[9px] text-violet-400">(servicio)</span></p>}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono hidden md:table-cell">{c.referencia_factura || '—'}</td>
                            <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{fmtDate(c.fecha)}</td>
                            <td className="px-4 py-3 text-right">
                              <p className="font-mono font-bold text-red-600">{fmt(totalConIva)}</p>
                              <p className="text-[9px] text-slate-400">{fmt(c.importe)} + {c.iva_pct}% IVA</p>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button onClick={() => handleToggleCompraPago(c)}
                                className={`text-[9px] font-bold px-2.5 py-1 rounded-full border cursor-pointer transition-all ${c.pagado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'}`}>
                                {c.pagado ? 'Pagada' : 'Pendiente'}
                              </button>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditCompra(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteCompra(c)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Total periodo</span>
                    <span className="text-red-600">{fmt(totalCompras)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Externalizados ─ */}
          {gastosTab === 'externalizados' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Facturas recibidas de proveedores colaboradores (trabajos externalizados)</p>
              {filtExt.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sin facturas de proveedores</p>
                  <p className="text-xs text-slate-400 mt-1">Las facturas aparecen aquí cuando las registras desde Externalizados</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Descripción / Proveedor</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden md:table-cell">Ref.</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Fecha</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Importe</th>
                      <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Pago</th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtExt.map(e => (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-800 truncate max-w-[180px]">{e.descripcion}</p>
                            {e.trade_subcontractors?.nombre && <p className="text-slate-400 flex items-center gap-1 mt-0.5"><Building2 className="w-2.5 h-2.5" />{e.trade_subcontractors.nombre}</p>}
                            {e.numero && <span className="font-mono text-[9px] text-violet-500">{e.numero}</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[10px] hidden md:table-cell">{e.referencia_factura_subcontrata || '—'}</td>
                          <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{fmtDate(e.fecha_factura_recibida)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{fmt(e.importe_factura_recibida ?? e.coste)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full border ${e.pagado ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-600 border-amber-200'}`}>
                              {e.pagado ? 'Pagado' : 'Pendiente'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between text-xs font-bold">
                    <span className="text-slate-500">Total periodo</span>
                    <span className="text-red-600">{fmt(totalExternas)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─ Mayoristas ─ */}
          {gastosTab === 'mayoristas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500">Distribuidores y mayoristas de material</p>
                <button onClick={openNewMayor} className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Añadir proveedor material
                </button>
              </div>
              {mayoristas.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                  <Building2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Sin proveedores de material</p>
                  <p className="text-xs text-slate-400 mt-1 mb-4">Añade tus distribuidores y mayoristas habituales</p>
                  <button onClick={openNewMayor} className="inline-flex items-center gap-2 text-xs font-bold bg-slate-700 text-white px-4 py-2 rounded-xl hover:bg-slate-800 cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> Añadir proveedor
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Empresa</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden md:table-cell">NIF</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Contacto</th>
                      <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden lg:table-cell">Dirección</th>
                      <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Compras</th>
                      <th className="px-2 py-3"></th>
                    </tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {mayoristas.map(m => {
                        const totalM = compras.filter(c => c.mayorista_id === m.id).reduce((s, c) => s + c.importe, 0);
                        return (
                          <tr key={m.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-800">{m.nombre}</p>
                              {m.razon_social && m.razon_social !== m.nombre && <p className="text-slate-400 text-[10px]">{m.razon_social}</p>}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono hidden md:table-cell">{m.nif || '—'}</td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              {m.telefono && <a href={`tel:${m.telefono}`} className="flex items-center gap-1 text-blue-600 hover:underline" onClick={e => e.stopPropagation()}><Phone className="w-3 h-3" />{m.telefono}</a>}
                              {m.email && <a href={`mailto:${m.email}`} className="flex items-center gap-1 text-blue-600 hover:underline mt-0.5" onClick={e => e.stopPropagation()}><Mail className="w-3 h-3" />{m.email}</a>}
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {(m.ciudad || m.provincia) && <p className="text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" />{[m.ciudad, m.provincia].filter(Boolean).join(', ')}</p>}
                              {m.direccion_fiscal && <p className="text-slate-400 text-[10px] mt-0.5">{m.direccion_fiscal}</p>}
                            </td>
                            <td className="px-4 py-3 text-right hidden sm:table-cell">
                              <p className="font-mono font-bold text-slate-700">{fmt(totalM)}</p>
                              <button onClick={() => { openNewCompra(m.id); }} className="text-[9px] text-blue-600 hover:underline mt-0.5 cursor-pointer">+ Añadir factura</button>
                            </td>
                            <td className="px-2 py-3">
                              <div className="flex items-center gap-1">
                                <button onClick={() => openEditMayor(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                <button onClick={() => handleDeleteMayor(m)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB RESULTADO ══ */}
      {!loading && mainTab === 'resultado' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard label="Ingresos cobrados" value={fmt(totalCobrado)} sub="facturas pagadas" color="text-emerald-600" border="border-emerald-200" />
            <KpiCard label="Gastos pagados" value={fmt(comprasPagadas + externasPagadas)} sub={`compras + externalizados`} color="text-red-600" border="border-red-200" />
            <div className={`bg-white rounded-xl p-5 border-2 ${resultado >= 0 ? 'border-emerald-400' : 'border-red-400'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>Resultado neto</p>
              <p className={`text-3xl font-black mt-1 ${resultado >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(resultado)}</p>
              <p className="text-xs text-slate-400 mt-1">cobrado − gastos pagados</p>
            </div>
          </div>

          {/* Desglose */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Desglose del periodo</p>
            <div className="space-y-2 text-sm">
              <ResultRow label="Facturación bruta" value={totalFacturado} color="text-slate-800" />
              <ResultRow label="  − Compras de material" value={-totalCompras} color="text-red-600" indent />
              <ResultRow label="  − Facturas externalizados" value={-totalExternas} color="text-red-600" indent />
              <div className="border-t border-slate-200 pt-2">
                <ResultRow label="Margen bruto estimado" value={totalFacturado - totalGastos} color={(totalFacturado - totalGastos) >= 0 ? 'text-emerald-700' : 'text-red-700'} bold />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Margen: {margenBruto.toFixed(1)}%</p>
            </div>
          </div>

          {/* Pendientes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-2">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5" /> Por cobrar (clientes)</p>
              <p className="text-2xl font-black text-amber-700">{fmt(totalPendiente)}</p>
              <p className="text-xs text-amber-600">{vencidas > 0 ? `${vencidas} factura${vencidas !== 1 ? 's' : ''} vencida${vencidas !== 1 ? 's' : ''}` : 'Sin facturas vencidas'}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-2">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5"><Receipt className="w-3.5 h-3.5" /> Por pagar (proveedores)</p>
              <p className="text-2xl font-black text-red-700">{fmt(comprasPendientes + (totalExternas - externasPagadas))}</p>
              <p className="text-xs text-red-600">compras + externalizados pendientes</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL FACTURA COMPRA ══ */}
      {showCompraModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCompraModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-black text-slate-800">{editingCompraId ? 'Editar factura de compra' : 'Nueva factura de compra'}</h3>
              <button onClick={() => setShowCompraModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              <div>
                <label className={labelCls}>Concepto / Descripción *</label>
                <input type="text" value={draftCompra.concepto} onChange={e => setDraftCompra(d => ({ ...d, concepto: e.target.value }))} placeholder="Ej: Material eléctrico instalación nave industrial" className={inputCls + ' mt-1'} autoFocus />
              </div>
              <div>
                <label className={labelCls}>Proveedor</label>
                <div className="flex gap-2 mt-1">
                  <select
                    value={
                      draftCompra.subcontrata_id ? `s:${draftCompra.subcontrata_id}` :
                      draftCompra.mayorista_id ? `m:${draftCompra.mayorista_id}` : ''
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (!val) {
                        setDraftCompra(d => ({ ...d, mayorista_id: null, subcontrata_id: null }));
                      } else if (val.startsWith('m:')) {
                        setDraftCompra(d => ({ ...d, mayorista_id: val.slice(2), subcontrata_id: null }));
                      } else if (val.startsWith('s:')) {
                        setDraftCompra(d => ({ ...d, subcontrata_id: val.slice(2), mayorista_id: null }));
                      }
                    }}
                    className={inputCls}
                  >
                    <option value="">— Sin proveedor / Proveedor puntual —</option>
                    {mayoristas.length > 0 && (
                      <optgroup label="Proveedores de material">
                        {mayoristas.map(m => <option key={m.id} value={`m:${m.id}`}>{m.nombre}{m.nif ? ` (${m.nif})` : ''}</option>)}
                      </optgroup>
                    )}
                    {subcontractors.length > 0 && (
                      <optgroup label="Proveedores de servicio (subcontratas)">
                        {subcontractors.map(s => <option key={s.id} value={`s:${s.id}`}>{s.nombre}{s.especialidad ? ` — ${s.especialidad}` : ''}</option>)}
                      </optgroup>
                    )}
                  </select>
                  <button type="button" onClick={openNewMayor} title="Añadir proveedor de material" className="px-3 py-2 border border-slate-200 rounded-xl text-slate-500 hover:border-slate-400 cursor-pointer shrink-0">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Referencia factura</label>
                  <input type="text" value={draftCompra.referencia_factura} onChange={e => setDraftCompra(d => ({ ...d, referencia_factura: e.target.value }))} placeholder="Ej: F-2026-1234" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Fecha factura</label>
                  <input type="date" value={draftCompra.fecha} onChange={e => setDraftCompra(d => ({ ...d, fecha: e.target.value }))} className={inputCls + ' mt-1'} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Importe base (sin IVA) *</label>
                  <input type="number" min="0" step="0.01" value={draftCompra.importe} onChange={e => setDraftCompra(d => ({ ...d, importe: parseFloat(e.target.value) || 0 }))} className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>IVA %</label>
                  <div className="flex gap-1 mt-1">
                    {[0, 10, 21].map(v => (
                      <button key={v} type="button" onClick={() => setDraftCompra(d => ({ ...d, iva_pct: v }))}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold border cursor-pointer ${draftCompra.iva_pct === v ? 'bg-slate-700 text-white border-transparent' : 'border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                        {v}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              {draftCompra.importe > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex justify-between text-xs">
                  <span className="text-slate-500">Total con IVA</span>
                  <span className="font-black text-slate-800">{fmt(draftCompra.importe * (1 + draftCompra.iva_pct / 100))}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fecha vencimiento</label>
                  <input type="date" value={draftCompra.fecha_vencimiento ?? ''} onChange={e => setDraftCompra(d => ({ ...d, fecha_vencimiento: e.target.value || null }))} className={inputCls + ' mt-1'} />
                </div>
                <div className="flex items-end pb-0.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={draftCompra.pagado} onChange={e => setDraftCompra(d => ({ ...d, pagado: e.target.checked }))} className="w-4 h-4 accent-emerald-600" />
                    <span className="text-xs font-bold text-slate-600">Ya pagada</span>
                  </label>
                </div>
              </div>
              <div>
                <label className={labelCls}>Notas</label>
                <textarea value={draftCompra.notas} onChange={e => setDraftCompra(d => ({ ...d, notas: e.target.value }))} rows={2} className={inputCls + ' mt-1 resize-none'} />
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowCompraModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
              <button onClick={handleSaveCompra} disabled={savingCompra} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingCompra ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editingCompraId ? 'Guardar cambios' : 'Registrar factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL MAYORISTA ══ */}
      {showMayorModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMayorModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-black text-slate-800">{editingMayorId ? 'Editar proveedor material' : 'Nuevo proveedor de material'}</h3>
              <button onClick={() => setShowMayorModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-3 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Nombre comercial *</label>
                  <input type="text" value={draftMayor.nombre} onChange={e => setDraftMayor(d => ({ ...d, nombre: e.target.value }))} placeholder="Ej: Roca Distribuciones" className={inputCls + ' mt-1'} autoFocus />
                </div>
                <div>
                  <label className={labelCls}>Razón social</label>
                  <input type="text" value={draftMayor.razon_social} onChange={e => setDraftMayor(d => ({ ...d, razon_social: e.target.value }))} placeholder="Roca Distribuciones S.L." className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>NIF / CIF</label>
                  <input type="text" value={draftMayor.nif} onChange={e => setDraftMayor(d => ({ ...d, nif: e.target.value }))} placeholder="B12345678" className={inputCls + ' mt-1'} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Dirección fiscal</label>
                  <input type="text" value={draftMayor.direccion_fiscal} onChange={e => setDraftMayor(d => ({ ...d, direccion_fiscal: e.target.value }))} placeholder="C/ Industria 5, Polígono Sur" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>CP</label>
                  <input type="text" value={draftMayor.cp} onChange={e => setDraftMayor(d => ({ ...d, cp: e.target.value }))} placeholder="28080" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Ciudad</label>
                  <input type="text" value={draftMayor.ciudad} onChange={e => setDraftMayor(d => ({ ...d, ciudad: e.target.value }))} placeholder="Madrid" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Provincia</label>
                  <input type="text" value={draftMayor.provincia} onChange={e => setDraftMayor(d => ({ ...d, provincia: e.target.value }))} className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Teléfono</label>
                  <input type="tel" value={draftMayor.telefono} onChange={e => setDraftMayor(d => ({ ...d, telefono: e.target.value }))} placeholder="91 000 00 00" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={draftMayor.email} onChange={e => setDraftMayor(d => ({ ...d, email: e.target.value }))} placeholder="pedidos@empresa.com" className={inputCls + ' mt-1'} />
                </div>
                <div>
                  <label className={labelCls}>Persona de contacto</label>
                  <input type="text" value={draftMayor.persona_contacto} onChange={e => setDraftMayor(d => ({ ...d, persona_contacto: e.target.value }))} placeholder="Juan García" className={inputCls + ' mt-1'} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Web</label>
                  <input type="text" value={draftMayor.web} onChange={e => setDraftMayor(d => ({ ...d, web: e.target.value }))} placeholder="https://empresa.com" className={inputCls + ' mt-1'} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Observaciones</label>
                  <textarea value={draftMayor.notas} onChange={e => setDraftMayor(d => ({ ...d, notas: e.target.value }))} rows={2} placeholder="Condiciones de pago, descuentos, etc." className={inputCls + ' mt-1 resize-none'} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowMayorModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
              <button onClick={handleSaveMayor} disabled={savingMayor} className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingMayor ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editingMayorId ? 'Guardar' : 'Añadir proveedor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-componentes auxiliares ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, color, border, progress, progressColor }: {
  label: string; value: string; sub: string; color: string; border: string; progress?: number; progressColor?: string;
}) {
  return (
    <div className={`bg-white border rounded-xl p-5 space-y-1.5 ${border}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      {progress !== undefined ? (
        <div className="flex items-center gap-2 pt-0.5">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${progressColor}`} style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-slate-400 shrink-0">{progress}%</span>
        </div>
      ) : (
        <p className="text-xs text-slate-400">{sub}</p>
      )}
    </div>
  );
}

function ResultRow({ label, value, color, indent, bold }: {
  label: string; value: number; color: string; indent?: boolean; bold?: boolean;
}) {
  return (
    <div className={`flex justify-between items-center py-1.5 ${indent ? 'pl-4' : ''} ${bold ? 'font-black' : ''}`}>
      <span className={`text-slate-600 ${bold ? 'font-black' : ''}`}>{label}</span>
      <span className={`font-mono ${bold ? 'text-lg font-black' : 'font-bold'} ${color}`}>
        {value >= 0 ? '' : ''}{Math.abs(value).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
      </span>
    </div>
  );
}
