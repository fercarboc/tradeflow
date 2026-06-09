import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FileText, RefreshCw, CheckCircle2, Clock, AlertTriangle, X,
  Download, Eye, Search, RotateCcw, FileDown,
  Banknote, CreditCard, Building2, Smartphone,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  loadAllInvoices, emitirFactura, markInvoicePaid,
  loadInvoiceLines, anularPago, crearFacturaRectificadora, markInvoicePendiente,
  TradeInvoice, TradeInvoiceLine,
} from '../lib/supabase';
import { printTradeInvoice } from '../lib/printTradeInvoice';
import { useSession } from '../context/SessionContext';

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type EstadoFilter = 'todos' | 'Borrador' | 'Emitida' | 'Pagada' | 'Vencida' | 'Pendiente';

const ESTADO_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  Borrador: { label: 'Borrador',  bg: 'bg-slate-50',   text: 'text-slate-500', border: 'border-slate-200' },
  Emitida:  { label: 'Emitida',   bg: 'bg-blue-50',    text: 'text-blue-700',  border: 'border-blue-200' },
  Enviada:  { label: 'Enviada',   bg: 'bg-indigo-50',  text: 'text-indigo-700',border: 'border-indigo-200' },
  Pendiente:{ label: 'Pendiente', bg: 'bg-amber-50',   text: 'text-amber-700', border: 'border-amber-200' },
  Pagada:   { label: 'Pagada',    bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  Vencida:  { label: 'Vencida',   bg: 'bg-red-50',     text: 'text-red-700',   border: 'border-red-200' },
  Cancelada:{ label: 'Cancelada', bg: 'bg-slate-100',  text: 'text-slate-400', border: 'border-slate-200' },
  Devuelta: { label: 'Devuelta',  bg: 'bg-orange-50',  text: 'text-orange-700',border: 'border-orange-200' },
};

const METODO_PAGO_ICON: Record<string, React.ReactNode> = {
  efectivo:       <Banknote className="w-3.5 h-3.5" />,
  bizum:          <Smartphone className="w-3.5 h-3.5" />,
  tarjeta:        <CreditCard className="w-3.5 h-3.5" />,
  transferencia:  <Building2 className="w-3.5 h-3.5" />,
  domiciliacion:  <Building2 className="w-3.5 h-3.5" />,
};

const METODO_PAGO_OPTIONS = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo',      label: 'Efectivo' },
  { value: 'bizum',         label: 'Bizum' },
  { value: 'tarjeta',       label: 'Tarjeta' },
  { value: 'domiciliacion', label: 'Domiciliación' },
];

// ── Component ─────────────────────────────────────────────────────────────

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  isLiveMode: boolean;
}

type InvoiceWithClient = TradeInvoice & { trade_clients?: { nombre: string } | null };

export default function ScreenFacturas({ showToast, isLiveMode }: Props) {
  const { org } = useSession();
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<EstadoFilter>('todos');
  const [filterSerie, setFilterSerie] = useState<'todos' | 'F' | 'M'>('todos');
  const [search, setSearch] = useState('');
  const [selectedInv, setSelectedInv] = useState<InvoiceWithClient | null>(null);
  const [invLines, setInvLines] = useState<TradeInvoiceLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [emitting, setEmitting] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<TradeInvoice['metodo_pago']>('transferencia');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingInv, setPayingInv] = useState<InvoiceWithClient | null>(null);
  const [showGestoria, setShowGestoria]     = useState(false);
  const [anulando, setAnulando]             = useState<string | null>(null);
  const [rectificando, setRectificando]     = useState<string | null>(null);
  const [pendienting, setPendienting]       = useState<string | null>(null);
  const [gestoriaPeriod, setGestoriaPeriod] = useState(() => {
    const now = new Date();
    const q = Math.ceil((now.getMonth() + 1) / 3);
    return `${now.getFullYear()}-Q${q}`;
  });

  const fetchInvoices = useCallback(async () => {
    if (!org) return;
    setLoading(true);
    try {
      const data = await loadAllInvoices(org.id);
      setInvoices(data as InvoiceWithClient[]);
    } catch {
      showToast('Error cargando facturas', 'error');
    } finally {
      setLoading(false);
    }
  }, [org]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const filtered = useMemo(() => {
    return invoices.filter(inv => {
      if (filterEstado !== 'todos' && inv.estado !== filterEstado) return false;
      if (filterSerie !== 'todos' && inv.serie !== filterSerie) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const clientName = (inv.trade_clients?.nombre ?? '').toLowerCase();
        if (!inv.numero.toLowerCase().includes(q) && !clientName.includes(q) && !(inv.concepto ?? '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [invoices, filterEstado, filterSerie, search]);

  const counts = useMemo(() => ({
    borrador: invoices.filter(i => i.estado === 'Borrador').length,
    emitida:  invoices.filter(i => i.estado === 'Emitida' || i.estado === 'Pendiente').length,
    pagada:   invoices.filter(i => i.estado === 'Pagada').length,
    vencida:  invoices.filter(i => i.estado === 'Vencida').length,
  }), [invoices]);

  async function openDetail(inv: InvoiceWithClient) {
    setSelectedInv(inv);
    setLoadingLines(true);
    try {
      const lines = await loadInvoiceLines(inv.id);
      setInvLines(lines);
    } catch {
      setInvLines([]);
    } finally {
      setLoadingLines(false);
    }
  }

  async function handleEmitir(inv: InvoiceWithClient) {
    if (!isLiveMode || !org) return;
    setEmitting(inv.id);
    try {
      const updated = await emitirFactura(inv.id, org.id);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updated } : i));
      if (selectedInv?.id === inv.id) setSelectedInv(prev => prev ? { ...prev, ...updated } : prev);
      showToast(`Factura ${updated.numero} emitida`, 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Error al emitir factura', 'error');
    } finally {
      setEmitting(null);
    }
  }

  async function handlePay(inv: InvoiceWithClient, method: TradeInvoice['metodo_pago']) {
    if (!isLiveMode) return;
    setPaying(inv.id);
    try {
      await markInvoicePaid(inv.id);
      const updates = { estado: 'Pagada' as const, metodo_pago: method, paid_at: new Date().toISOString() };
      await supabase.from('trade_invoices').update({ metodo_pago: method }).eq('id', inv.id);
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updates } : i));
      if (selectedInv?.id === inv.id) setSelectedInv(prev => prev ? { ...prev, ...updates } : prev);
      showToast('Factura marcada como pagada', 'success');
    } catch {
      showToast('Error al marcar factura', 'error');
    } finally {
      setPaying(null);
      setShowPayModal(false);
      setPayingInv(null);
    }
  }

  async function handleAnularPago(inv: InvoiceWithClient) {
    if (!isLiveMode) return;
    if (!window.confirm(`¿Anular el pago de ${inv.numero}? La factura volverá a estado Emitida.`)) return;
    setAnulando(inv.id);
    try {
      await anularPago(inv.id);
      const updates = { estado: 'Emitida' as const, paid_at: undefined, metodo_pago: undefined };
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updates } : i));
      if (selectedInv?.id === inv.id) setSelectedInv(prev => prev ? { ...prev, ...updates } : prev);
      showToast('Pago anulado — factura vuelve a Emitida', 'info');
    } catch {
      showToast('Error al anular el pago', 'error');
    } finally {
      setAnulando(null);
    }
  }

  async function handleCrearRectificadora(inv: InvoiceWithClient) {
    if (!isLiveMode || !org) return;
    if (!window.confirm(`¿Crear factura rectificativa de ${inv.numero}? Se creará como borrador con importes negativos.`)) return;
    setRectificando(inv.id);
    try {
      const rect = await crearFacturaRectificadora(inv.id, org.id);
      setInvoices(prev => [{ ...rect, trade_clients: inv.trade_clients } as InvoiceWithClient, ...prev]);
      showToast(`Rectificativa creada como borrador — emítela cuando esté lista`, 'success');
      setSelectedInv(null);
    } catch {
      showToast('Error al crear la rectificativa', 'error');
    } finally {
      setRectificando(null);
    }
  }

  async function handleMarcarPendiente(inv: InvoiceWithClient) {
    if (!isLiveMode) return;
    setPendienting(inv.id);
    try {
      await markInvoicePendiente(inv.id);
      const updates = { estado: 'Pendiente' as const };
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, ...updates } : i));
      if (selectedInv?.id === inv.id) setSelectedInv(prev => prev ? { ...prev, ...updates } : prev);
      showToast('Factura marcada como Pendiente de cobro', 'info');
    } catch {
      showToast('Error al actualizar estado', 'error');
    } finally {
      setPendienting(null);
    }
  }

  function handlePrintInvoice(inv: InvoiceWithClient, lines: TradeInvoiceLine[]) {
    if (!org) return;
    printTradeInvoice(inv, lines, {
      nombre: org.nombre,
      cif: org.nif,
      direccion: org.direccion,
      ciudad: org.ciudad,
      telefono: org.telefono,
      email: org.email,
      logo_url: org.logo_url,
    });
  }

  // ── Gestoría CSV export ───────────────────────────────────────────────────

  function exportGestoriaCSV() {
    const [yearStr, qStr] = gestoriaPeriod.split('-Q');
    const year = parseInt(yearStr);
    const quarter = parseInt(qStr);
    const monthStart = (quarter - 1) * 3 + 1;
    const monthEnd = monthStart + 2;

    const gestoriaInvoices = invoices.filter(inv => {
      if (inv.estado === 'Borrador' || inv.estado === 'Cancelada') return false;
      const emisDate = inv.fecha_emision ? new Date(inv.fecha_emision) : inv.fecha ? new Date(inv.fecha + 'T00:00:00') : null;
      if (!emisDate) return false;
      return emisDate.getFullYear() === year && emisDate.getMonth() + 1 >= monthStart && emisDate.getMonth() + 1 <= monthEnd;
    });

    const header = ['Número', 'Fecha Emisión', 'Serie', 'Cliente', 'NIF Cliente', 'Base Imponible', 'IVA %', 'Cuota IVA', 'Total', 'Estado', 'Método Pago', 'Fecha Cobro'];
    const rows = gestoriaInvoices.map(inv => [
      inv.numero,
      inv.fecha_emision ? inv.fecha_emision.split('T')[0] : inv.fecha,
      inv.serie ?? '',
      inv.trade_clients?.nombre ?? inv.razon_social_cliente ?? '',
      inv.nif_cliente ?? '',
      inv.subtotal.toFixed(2),
      inv.iva_pct.toString(),
      inv.iva_importe.toFixed(2),
      inv.total.toFixed(2),
      inv.estado,
      inv.metodo_pago ?? '',
      inv.paid_at ? inv.paid_at.split('T')[0] : '',
    ]);

    const totalBase = gestoriaInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalIva = gestoriaInvoices.reduce((s, i) => s + (i.iva_importe ?? 0), 0);
    const totalTotal = gestoriaInvoices.reduce((s, i) => s + i.total, 0);
    rows.push(['', '', '', '', 'TOTAL', totalBase.toFixed(2), '', totalIva.toFixed(2), totalTotal.toFixed(2), '', '', '']);

    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `facturas_${gestoriaPeriod}_gestoria.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportadas ${gestoriaInvoices.length} facturas para gestoría`, 'success');
  }

  const estadoCfg = (estado: string) => ESTADO_CFG[estado] ?? ESTADO_CFG['Borrador'];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl">

      {/* Cabecera */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gestión de facturas</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGestoria(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Gestoría
          </button>
          <button onClick={fetchInvoices} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Borrador', value: counts.borrador, color: 'text-slate-600' },
          { label: 'Emitida',  value: counts.emitida,  color: 'text-blue-600' },
          { label: 'Pagada',   value: counts.pagada,   color: 'text-emerald-600' },
          { label: 'Vencida',  value: counts.vencida,  color: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className="bg-white border border-slate-200 rounded-xl p-3 text-center">
            <p className={`text-lg font-black ${k.color}`}>{k.value}</p>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar factura..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {(['todos', 'Borrador', 'Emitida', 'Pendiente', 'Pagada', 'Vencida'] as EstadoFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilterEstado(f)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterEstado === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f === 'todos' ? 'Todos' : f}
            </button>
          ))}
        </div>
        <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5">
          {([['todos', 'Todo'], ['F', 'F-'], ['M', 'M-']] as [string, string][]).map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilterSerie(v as typeof filterSerie)}
              className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors cursor-pointer ${filterSerie === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista facturas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Cargando facturas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No hay facturas que coincidan con los filtros.</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Número</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Cliente</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden md:table-cell">Fecha</th>
                <th className="text-right px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Total</th>
                <th className="text-center px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Estado</th>
                <th className="text-center px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] w-28">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(inv => {
                const cfg = estadoCfg(inv.estado);
                const isBorrador = inv.estado === 'Borrador';
                const isPendiente = inv.estado === 'Emitida' || inv.estado === 'Pendiente';
                return (
                  <tr
                    key={inv.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${isBorrador ? 'bg-slate-50/50' : ''}`}
                    onClick={() => openDetail(inv)}
                  >
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-600 text-[10px] whitespace-nowrap">
                      {isBorrador ? <span className="text-slate-400 italic">Sin número</span> : inv.numero}
                      {inv.serie && <span className={`ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded ${inv.serie === 'M' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>{inv.serie}-</span>}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 truncate max-w-[120px] text-[11px]">
                      {inv.trade_clients?.nombre ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 hidden md:table-cell whitespace-nowrap">
                      {fmtDate(inv.fecha_emision ?? inv.fecha)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                      {fmt(inv.total)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        {isBorrador && (
                          <button
                            onClick={() => handleEmitir(inv)}
                            disabled={!isLiveMode || emitting === inv.id}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            {emitting === inv.id ? '...' : 'Emitir'}
                          </button>
                        )}
                        {isPendiente && (
                          <button
                            onClick={() => { setPayingInv(inv); setShowPayModal(true); }}
                            disabled={!isLiveMode}
                            className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer transition-colors"
                          >
                            Cobrar
                          </button>
                        )}
                        {!isBorrador && (
                          <button
                            onClick={() => handlePrintInvoice(inv, [])}
                            className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
                            title="Ver PDF"
                          >
                            <FileDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => openDetail(inv)}
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal detalle factura */}
      {selectedInv && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg border border-slate-200 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {selectedInv.estado === 'Borrador' ? 'Borrador de factura' : selectedInv.numero}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{selectedInv.trade_clients?.nombre ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2">
                {(() => {
                  const cfg = estadoCfg(selectedInv.estado);
                  return (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      {cfg.label}
                    </span>
                  );
                })()}
                <button onClick={() => setSelectedInv(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Concepto / líneas */}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Detalle</p>
                {loadingLines ? (
                  <p className="text-xs text-slate-400">Cargando líneas...</p>
                ) : invLines.length > 0 ? (
                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 border-b border-slate-100">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-400 font-bold text-[9px] uppercase tracking-wider">Descripción</th>
                          <th className="text-right px-3 py-2 text-slate-400 font-bold text-[9px] uppercase tracking-wider">Cant.</th>
                          <th className="text-right px-3 py-2 text-slate-400 font-bold text-[9px] uppercase tracking-wider">P.U.</th>
                          <th className="text-right px-3 py-2 text-slate-400 font-bold text-[9px] uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {invLines.map(line => (
                          <tr key={line.id}>
                            <td className="px-3 py-2 text-slate-700">{line.descripcion}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{line.cantidad}</td>
                            <td className="px-3 py-2 text-right text-slate-500">{fmt(line.precio_unitario)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-900">{fmt(line.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">{selectedInv.concepto ?? 'Sin detalle de líneas'}</p>
                )}
              </div>

              {/* Totales */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Base imponible</span>
                  <span className="font-semibold">{fmt(selectedInv.subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>IVA ({selectedInv.iva_pct}%)</span>
                  <span className="font-semibold">{fmt(selectedInv.iva_importe ?? selectedInv.subtotal * selectedInv.iva_pct / 100)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>{fmt(selectedInv.total)}</span>
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">Fecha emisión</p>
                  <p className="text-slate-700">{fmtDate(selectedInv.fecha_emision ?? selectedInv.fecha)}</p>
                </div>
                {selectedInv.fecha_vencimiento && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">Vencimiento</p>
                    <p className="text-slate-700">{fmtDate(selectedInv.fecha_vencimiento)}</p>
                  </div>
                )}
                {selectedInv.metodo_pago && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">Método pago</p>
                    <div className="flex items-center gap-1 text-slate-700">
                      {METODO_PAGO_ICON[selectedInv.metodo_pago]}
                      <span className="capitalize">{selectedInv.metodo_pago}</span>
                    </div>
                  </div>
                )}
                {selectedInv.paid_at && (
                  <div>
                    <p className="text-slate-400 text-[10px] uppercase tracking-wider font-bold mb-0.5">Fecha cobro</p>
                    <p className="text-slate-700">{fmtDate(selectedInv.paid_at)}</p>
                  </div>
                )}
              </div>

              {/* Datos fiscales snapshot */}
              {(selectedInv.razon_social_cliente || selectedInv.nif_cliente) && (
                <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Datos fiscales cliente</p>
                  {selectedInv.razon_social_cliente && <p className="text-slate-700 font-medium">{selectedInv.razon_social_cliente}</p>}
                  {selectedInv.nif_cliente && <p className="text-slate-500">NIF: {selectedInv.nif_cliente}</p>}
                  {selectedInv.direccion_cliente && <p className="text-slate-500">{selectedInv.direccion_cliente}</p>}
                </div>
              )}
            </div>

            {/* Acciones del detalle */}
            <div className="px-5 py-4 border-t border-slate-100 space-y-2">
              <div className="flex gap-2">
                {selectedInv.estado === 'Borrador' && (
                  <button
                    onClick={() => handleEmitir(selectedInv)}
                    disabled={!isLiveMode || emitting === selectedInv.id}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {emitting === selectedInv.id ? 'Emitiendo...' : '✓ Emitir factura'}
                  </button>
                )}
                {selectedInv.estado === 'Emitida' && (
                  <button
                    onClick={() => handleMarcarPendiente(selectedInv)}
                    disabled={!isLiveMode || pendienting === selectedInv.id}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    {pendienting === selectedInv.id ? '...' : '⏳ Pendiente'}
                  </button>
                )}
                {(selectedInv.estado === 'Emitida' || selectedInv.estado === 'Pendiente') && (
                  <button
                    onClick={() => { setPayingInv(selectedInv); setShowPayModal(true); }}
                    disabled={!isLiveMode}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    ✓ Cobrada
                  </button>
                )}
                {selectedInv.estado === 'Pagada' && (
                  <button
                    onClick={() => handleAnularPago(selectedInv)}
                    disabled={!isLiveMode || anulando === selectedInv.id}
                    className="flex-1 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {anulando === selectedInv.id ? '...' : 'Anular pago'}
                  </button>
                )}
                <button
                  onClick={() => setSelectedInv(null)}
                  className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  Cerrar
                </button>
              </div>
              {/* Fila secundaria: PDF + Rectificadora */}
              <div className="flex gap-2">
                {selectedInv.estado !== 'Borrador' && (
                  <button
                    onClick={() => handlePrintInvoice(selectedInv, invLines)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Ver PDF
                  </button>
                )}
                {(selectedInv.estado === 'Emitida' || selectedInv.estado === 'Pagada' || selectedInv.estado === 'Pendiente') && selectedInv.tipo_factura !== 'rectificativa' && (
                  <button
                    onClick={() => handleCrearRectificadora(selectedInv)}
                    disabled={!isLiveMode || rectificando === selectedInv.id}
                    className="flex-1 py-2 rounded-xl border border-orange-200 text-orange-600 bg-orange-50 hover:bg-orange-100 text-xs font-semibold disabled:opacity-50 cursor-pointer transition-colors flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {rectificando === selectedInv.id ? '...' : 'Crear rectificativa'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal cobro */}
      {showPayModal && payingInv && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Registrar cobro</h3>
              <button onClick={() => setShowPayModal(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Factura</p>
              <p className="text-sm font-semibold text-slate-800">{payingInv.numero} — {fmt(payingInv.total)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Método de pago</p>
              <div className="grid grid-cols-2 gap-2">
                {METODO_PAGO_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setPayMethod(opt.value as TradeInvoice['metodo_pago'])}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer ${
                      payMethod === opt.value
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {METODO_PAGO_ICON[opt.value]}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowPayModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handlePay(payingInv, payMethod)}
                disabled={paying === payingInv.id}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 cursor-pointer transition-colors"
              >
                {paying === payingInv.id ? '...' : 'Confirmar cobro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gestoría */}
      {showGestoria && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-slate-200 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">Exportar para Gestoría</h3>
                <p className="text-xs text-slate-400 mt-0.5">Libro de facturas emitidas del trimestre</p>
              </div>
              <button onClick={() => setShowGestoria(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Período</p>
                <select
                  value={gestoriaPeriod}
                  onChange={e => setGestoriaPeriod(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-400 cursor-pointer"
                >
                  {(() => {
                    const now = new Date();
                    const opts = [];
                    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
                      for (let q = 4; q >= 1; q--) {
                        opts.push({ value: `${y}-Q${q}`, label: `${y} — T${q} (${['Ene-Mar','Abr-Jun','Jul-Sep','Oct-Dic'][q-1]})` });
                      }
                    }
                    return opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>);
                  })()}
                </select>
              </div>

              {/* Resumen del período seleccionado */}
              {(() => {
                const [yearStr, qStr] = gestoriaPeriod.split('-Q');
                const year = parseInt(yearStr);
                const quarter = parseInt(qStr);
                const monthStart = (quarter - 1) * 3 + 1;
                const monthEnd = monthStart + 2;
                const periodInvs = invoices.filter(inv => {
                  if (inv.estado === 'Borrador' || inv.estado === 'Cancelada') return false;
                  const d = inv.fecha_emision ? new Date(inv.fecha_emision) : inv.fecha ? new Date(inv.fecha + 'T00:00:00') : null;
                  if (!d) return false;
                  return d.getFullYear() === year && d.getMonth() + 1 >= monthStart && d.getMonth() + 1 <= monthEnd;
                });
                const totalBase = periodInvs.reduce((s, i) => s + i.subtotal, 0);
                const totalIva  = periodInvs.reduce((s, i) => s + (i.iva_importe ?? 0), 0);
                const totalCobrado = periodInvs.filter(i => i.estado === 'Pagada').reduce((s, i) => s + i.total, 0);
                return (
                  <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600"><span>Facturas emitidas</span><span className="font-bold">{periodInvs.length}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Base imponible total</span><span className="font-bold">{fmt(totalBase)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>IVA repercutido (modelo 303)</span><span className="font-bold text-blue-700">{fmt(totalIva)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-bold"><span>Total cobrado</span><span>{fmt(totalCobrado)}</span></div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowGestoria(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={exportGestoriaCSV}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold cursor-pointer transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Exportar CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
