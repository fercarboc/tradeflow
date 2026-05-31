import React, { useState, useEffect, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { TradeClient, TradeQuote } from '../lib/supabase';
import { useSession } from '../context/SessionContext';

type InvoiceWithClient = {
  id: string; org_id: string; quote_id?: string; client_id?: string;
  numero: string; fecha: string; estado: 'Pendiente' | 'Pagada' | 'Vencida';
  subtotal: number; iva_pct: number; iva_importe: number; total: number;
  paid_at?: string; created_at: string; updated_at: string;
  trade_clients?: { nombre: string } | null;
};

type Period = 'month' | 'quarter' | 'year' | 'all';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month',   label: 'Este mes' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year',    label: 'Este año' },
  { value: 'all',     label: 'Todo' },
];

function periodStart(period: Period): Date | null {
  const now = new Date();
  if (period === 'month')   return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'quarter') { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d; }
  if (period === 'year')    return new Date(now.getFullYear(), 0, 1);
  return null;
}

function fmt(n: number): string {
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

interface Props {
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ScreenIngresos({ showToast }: Props) {
  const { org } = useSession();
  const [period, setPeriod] = useState<Period>('year');
  const [invoices, setInvoices] = useState<InvoiceWithClient[]>([]);
  const [pipeline, setPipeline] = useState<Pick<TradeQuote, 'id' | 'total_con_iva' | 'estado' | 'fecha' | 'client_id'>[]>([]);
  const [clientes, setClientes] = useState<Pick<TradeClient, 'id' | 'nombre' | 'total_facturado'>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!org) return;
    Promise.all([
      supabase
        .from('trade_invoices')
        .select('*, trade_clients(nombre)')
        .eq('org_id', org.id)
        .order('fecha', { ascending: false }),
      supabase
        .from('trade_quotes')
        .select('id, total_con_iva, estado, fecha, client_id')
        .eq('org_id', org.id)
        .eq('estado', 'Aceptado'),
      supabase
        .from('trade_clients')
        .select('id, nombre, total_facturado')
        .eq('org_id', org.id)
        .order('total_facturado', { ascending: false })
        .limit(8),
    ])
      .then(([invRes, qRes, cliRes]) => {
        setInvoices((invRes.data ?? []) as InvoiceWithClient[]);
        setPipeline((qRes.data ?? []) as typeof pipeline);
        setClientes((cliRes.data ?? []) as typeof clientes);
      })
      .catch(() => showToast('Error cargando datos de ingresos', 'error'))
      .finally(() => setLoading(false));
  }, [org]);

  const start = periodStart(period);
  const filtered = invoices.filter(i => !start || new Date(i.fecha) >= start);

  const totalFacturado = filtered.reduce((s, i) => s + i.total, 0);
  const totalCobrado   = filtered.filter(i => i.estado === 'Pagada').reduce((s, i) => s + i.total, 0);
  const totalPendiente = filtered.filter(i => i.estado !== 'Pagada').reduce((s, i) => s + i.total, 0);
  const pipelineTotal  = pipeline.reduce((s, q) => s + (q.total_con_iva ?? 0), 0);
  const vencidas       = filtered.filter(i => i.estado === 'Vencida').length;
  const cobradoPct     = totalFacturado > 0 ? Math.round((totalCobrado / totalFacturado) * 100) : 0;

  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const y = d.getFullYear();
      const m = d.getMonth();
      const label = d.toLocaleString('es-ES', { month: 'short' });
      const value = invoices
        .filter(inv => {
          const fd = new Date(inv.fecha);
          return fd.getFullYear() === y && fd.getMonth() === m;
        })
        .reduce((s, inv) => s + inv.total, 0);
      months.push({ label, value });
    }
    return months;
  }, [invoices]);

  const chartMax = Math.max(...monthlyData.map(m => m.value), 1);

  if (loading) {
    return <div className="p-6 text-slate-400 text-sm">Cargando datos...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">

      {/* Cabecera + filtro de período */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rentabilidad y facturación de tu negocio</p>
        </div>
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                period === p.value
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total facturado</p>
          <p className="text-2xl font-black text-slate-900">{fmt(totalFacturado)}</p>
          <p className="text-xs text-slate-400">{filtered.length} factura{filtered.length !== 1 ? 's' : ''} en el periodo</p>
        </div>

        <div className="bg-white border border-emerald-200 rounded-xl p-5 space-y-1.5">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Cobrado</p>
          <p className="text-2xl font-black text-emerald-600">{fmt(totalCobrado)}</p>
          <div className="flex items-center gap-2 pt-0.5">
            <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${cobradoPct}%` }} />
            </div>
            <span className="text-xs text-slate-400 shrink-0">{cobradoPct}%</span>
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-xl p-5 space-y-1.5">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Pendiente de cobro</p>
          <p className="text-2xl font-black text-amber-600">{fmt(totalPendiente)}</p>
          <p className="text-xs text-slate-400">
            {vencidas > 0 ? `${vencidas} vencida${vencidas !== 1 ? 's' : ''}` : 'Sin facturas vencidas'}
          </p>
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-5 space-y-1.5">
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Pipeline</p>
          <p className="text-2xl font-black text-purple-600">{fmt(pipelineTotal)}</p>
          <p className="text-xs text-slate-400">
            {pipeline.length} presup. aceptado{pipeline.length !== 1 ? 's' : ''} sin facturar
          </p>
        </div>
      </div>

      {/* Gráfico de barras mensual */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-5">
          Ingresos por mes — últimos 6 meses
        </p>
        <div className="flex items-end gap-2" style={{ height: '120px' }}>
          {monthlyData.map((m, i) => {
            const pct = chartMax > 0 ? (m.value / chartMax) * 100 : 0;
            const hasValue = m.value > 0;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1" style={{ height: '100%' }}>
                <div className="flex-1 w-full flex items-end">
                  <div
                    className={`w-full rounded-t transition-all ${hasValue ? 'bg-blue-500 hover:bg-blue-400' : 'bg-slate-100'}`}
                    style={{ height: hasValue ? `${Math.max(pct, 3)}%` : '3%' }}
                    title={fmt(m.value)}
                  />
                </div>
                <span className="text-[9px] text-slate-400 uppercase font-medium">{m.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-slate-400 font-mono">
          <span>0 €</span>
          <span>{fmt(chartMax)}</span>
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
            const isLast = idx === clientes.length - 1;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${!isLast ? 'border-b border-slate-100' : ''}`}
              >
                <span className="text-xs font-bold text-slate-300 w-4 shrink-0">{idx + 1}</span>
                <div className="flex-grow min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{c.nombre}</p>
                  <div className="mt-1.5 h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 shrink-0">{fmt(c.total_facturado)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabla facturas recientes */}
      {filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Facturas del periodo</p>
            <span className="text-[10px] text-slate-400">{filtered.length} factura{filtered.length !== 1 ? 's' : ''}</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Nº</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Cliente</th>
                <th className="text-left px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px] hidden sm:table-cell">Fecha</th>
                <th className="text-right px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Total</th>
                <th className="text-center px-4 py-2.5 font-bold text-slate-400 uppercase tracking-wider text-[9px]">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.slice(0, 20).map(inv => {
                const estadoBadge =
                  inv.estado === 'Pagada'   ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  inv.estado === 'Vencida'  ? 'bg-red-50 text-red-600 border-red-200' :
                                              'bg-amber-50 text-amber-600 border-amber-200';
                const rowTint =
                  inv.estado === 'Pagada'  ? 'bg-emerald-50/30' :
                  inv.estado === 'Vencida' ? 'bg-red-50/30' : '';
                return (
                  <tr key={inv.id} className={`transition-colors hover:brightness-95 ${rowTint}`}>
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-600 whitespace-nowrap text-[10px]">{inv.numero}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 truncate max-w-[130px] text-[10px]">{inv.trade_clients?.nombre ?? '—'}</td>
                    <td className="px-4 py-2.5 text-slate-400 hidden sm:table-cell whitespace-nowrap">{inv.fecha}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{fmt(inv.total)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${estadoBadge}`}>{inv.estado}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Estado vacío */}
      {invoices.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
          <TrendingUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No hay datos de facturación aún.</p>
          <p className="text-xs text-slate-400 mt-1">Los datos aparecerán cuando crees y cobres tus primeras facturas.</p>
        </div>
      )}
    </div>
  );
}
