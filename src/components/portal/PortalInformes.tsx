import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie,
} from 'recharts';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  ReportingKPI, ReportingKPIsResult,
  SalesReportData, CatalogReportData, OperationalReportData,
  getSupplierReportingKPIs,
  getSupplierReportingSales,
  getSupplierReportingCatalog,
  getSupplierReportingOperational,
} from '../../lib/api/marketplace-portal';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

// ── Tipos de período y sección ────────────────────────────────────────────────

type PeriodPreset   = '7d' | '30d' | 'mes_actual' | 'mes_anterior' | 'custom';
type ReportSection  = 'general' | 'ventas' | 'catalogo' | 'operativo';

interface PeriodDates { from: Date; to: Date }

function getPresetDates(preset: PeriodPreset): PeriodDates {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case '7d':
      return { from: new Date(today.getTime() - 7 * 86_400_000), to: now };
    case '30d':
      return { from: new Date(today.getTime() - 30 * 86_400_000), to: now };
    case 'mes_actual':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now };
    case 'mes_anterior': {
      const firstCurrent = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstPrev    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { from: firstPrev, to: firstCurrent };
    }
    default:
      return { from: new Date(today.getTime() - 30 * 86_400_000), to: now };
  }
}

// ── Helpers de formato ────────────────────────────────────────────────────────

function fmtCurrency(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return val.toLocaleString('es-ES', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 0, maximumFractionDigits: val < 1000 ? 2 : 0,
  });
}

function fmtInteger(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return Math.round(val).toLocaleString('es-ES');
}

function fmtHours(val: number | null): string {
  if (val === null || val === undefined) return '—';
  if (val < 0.02) return '< 1 min';
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

function fmtDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtPct(val: number | null): string {
  if (val === null || val === undefined) return '—';
  return val.toFixed(1) + '%';
}

// ── CSV export ────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: (string | number | null)[][]): void {
  const BOM = '﻿';
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const lines = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))];
  const blob = new Blob([BOM + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Cálculo de delta ──────────────────────────────────────────────────────────

type KPIDirection = 'higher_is_better' | 'lower_is_better' | 'neutral';
interface Delta { pct: number; direction: 'up' | 'down' | 'flat' }

function computeDelta(val: number | null, prev: number | null): Delta | null {
  if (prev === null || prev === undefined) return null;
  if (val  === null || val  === undefined) return null;
  if (prev === 0 && val === 0) return { pct: 0, direction: 'flat' };
  if (prev === 0) return null;
  const pct = Math.round(((val - prev) / Math.abs(prev)) * 100);
  return { pct, direction: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

interface PeriodSelectorProps {
  preset: PeriodPreset; customFrom: string; customTo: string;
  onPreset: (p: PeriodPreset) => void;
  onCustomFrom: (v: string) => void; onCustomTo: (v: string) => void;
}

function PeriodSelector({ preset, customFrom, customTo, onPreset, onCustomFrom, onCustomTo }: PeriodSelectorProps) {
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: '7d',           label: 'Últimos 7 d' },
    { id: '30d',          label: 'Últimos 30 d' },
    { id: 'mes_actual',   label: 'Mes actual' },
    { id: 'mes_anterior', label: 'Mes anterior' },
    { id: 'custom',       label: 'Personalizado' },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((p) => (
          <button key={p.id} onClick={() => onPreset(p.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              preset === p.id
                ? 'bg-teal-600 text-white'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600'
            }`}
          >{p.label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customFrom} max={customTo || fmtDateInput(new Date())}
            onChange={(e) => onCustomFrom(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500" />
          <span className="text-xs text-slate-400">—</span>
          <input type="date" value={customTo} min={customFrom} max={fmtDateInput(new Date())}
            onChange={(e) => onCustomTo(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
      )}
    </div>
  );
}

interface DeltaBadgeProps { delta: Delta | null; direction: KPIDirection }

function DeltaBadge({ delta, direction }: DeltaBadgeProps) {
  if (!delta || delta.direction === 'flat') {
    return <span className="text-xs text-slate-400">Sin cambio</span>;
  }
  const isUp = delta.direction === 'up';
  const arrowUp = (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7 7 7M12 3v18" />
    </svg>
  );
  const arrowDown = (
    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7-7-7M12 21V3" />
    </svg>
  );
  if (direction === 'neutral') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {isUp ? arrowUp : arrowDown}{Math.abs(delta.pct)}%
      </span>
    );
  }
  const isGood = direction === 'higher_is_better' ? isUp : !isUp;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
      isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
    }`}>
      {isUp ? arrowUp : arrowDown}{Math.abs(delta.pct)}%
    </span>
  );
}

interface KPICardProps {
  label: string; value: string; kpi: ReportingKPI | null;
  icon: React.ReactNode; kpiDirection: KPIDirection;
  noDataNote?: string; soloMkt?: boolean; accentClass?: string;
}

function KPICard({ label, value, kpi, icon, kpiDirection, noDataNote, soloMkt, accentClass = 'text-teal-600 dark:text-teal-400' }: KPICardProps) {
  const delta   = kpi ? computeDelta(kpi.valor, kpi.prev) : null;
  const isNoData = kpi?.valor === null;
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
        <div className={`${accentClass} opacity-70`}>{icon}</div>
      </div>
      {isNoData ? (
        <div>
          <p className="text-2xl font-bold text-slate-300 dark:text-slate-600">—</p>
          {noDataNote && <p className="text-xs text-slate-400 mt-1">{noDataNote}</p>}
        </div>
      ) : (
        <div>
          <p className={`text-2xl font-bold ${accentClass} tabular-nums`}>{value}</p>
          <div className="flex items-center gap-2 mt-1 h-4">
            {kpi?.prev !== null && kpi?.prev !== undefined ? (
              <>
                <DeltaBadge delta={delta} direction={kpiDirection} />
                <span className="text-xs text-slate-400">vs período ant.</span>
              </>
            ) : (
              <span className="text-xs text-slate-400">{noDataNote ?? 'Sin comp. período ant.'}</span>
            )}
          </div>
        </div>
      )}
      {soloMkt && (
        <span className="self-start rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          Solo marketplace
        </span>
      )}
    </div>
  );
}

function KPIGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 h-28" />
      ))}
    </div>
  );
}

function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 rounded-xl" />
      ))}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="mb-6 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {msg}
    </div>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 ${className ?? ''}`}>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{title}</p>
      {children}
    </div>
  );
}

// ── Iconos ────────────────────────────────────────────────────────────────────

function IconEuro() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.5 6a8 8 0 1 0 0 12M3 9h8M3 15h8" /></svg>;
}
function IconOrders() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
}
function IconTicket() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 13h4" /></svg>;
}
function IconProduct() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0v10l-8 4m0-14L4 17m8 4V11" /></svg>;
}
function IconUnits() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="2" y="7" width="20" height="14" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /><line x1="12" y1="12" x2="12" y2="17" /><line x1="9" y1="14.5" x2="15" y2="14.5" /></svg>;
}
function IconCancelled() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><line x1="8" y1="8" x2="16" y2="16" /></svg>;
}
function IconAlert() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>;
}
function IconClock() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" /></svg>;
}
function IconTruck() {
  return <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13" rx="1" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 8h4l3 4v5h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
}
function IconDownload() {
  return <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
}

// ── Colores para gráficos ─────────────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  pending:     '#94a3b8',
  confirmed:   '#3b82f6',
  preparing:   '#f59e0b',
  shipped:     '#8b5cf6',
  delivered:   '#10b981',
  completed:   '#0d9488',
  cancelled:   '#ef4444',
};

const PIE_COLORS = ['#0d9488', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#94a3b8'];

const ESTADO_LABELS: Record<string, string> = {
  pending:   'Pendiente',
  confirmed: 'Confirmado',
  preparing: 'Preparando',
  shipped:   'Enviado',
  delivered: 'Entregado',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

// ── GeneralTab ────────────────────────────────────────────────────────────────

interface GeneralTabProps {
  data:       ReportingKPIsResult | null;
  loading:    boolean;
  errMsg:     string | null;
  noDateRange: boolean;
}

function GeneralTab({ data, loading, errMsg, noDateRange }: GeneralTabProps) {
  const kpis   = data?.kpis;
  const periodo = data?.periodo;

  const exportCSV = () => {
    if (!kpis) return;
    const headers = ['KPI', 'Valor actual', 'Valor período anterior', 'Fuente'];
    const rows: (string | number | null)[][] = [
      ['Ventas totales (€)', kpis.ventas.valor, kpis.ventas.prev, kpis.ventas.fuente],
      ['Número de pedidos', kpis.num_pedidos.valor, kpis.num_pedidos.prev, kpis.num_pedidos.fuente],
      ['Ticket medio (€)', kpis.ticket_medio.valor, kpis.ticket_medio.prev, kpis.ticket_medio.fuente],
      ['Productos vendidos', kpis.prod_vendidos.valor, kpis.prod_vendidos.prev, kpis.prod_vendidos.fuente],
      ['Unidades vendidas', kpis.unidades_vendidas.valor, kpis.unidades_vendidas.prev, kpis.unidades_vendidas.fuente],
      ['Pedidos cancelados', kpis.cancelados.valor, kpis.cancelados.prev, kpis.cancelados.fuente],
      ['Pedidos con incidencia', kpis.incidencias.valor, null, kpis.incidencias.fuente],
      ['Tiempo medio confirmación (h)', kpis.avg_confirm_h.valor, null, kpis.avg_confirm_h.fuente],
      ['Tiempo medio hasta envío (h)', kpis.avg_ship_h.valor, null, kpis.avg_ship_h.fuente],
    ];
    const now = new Date().toLocaleDateString('es-ES');
    const from = periodo ? fmtDateLabel(periodo.desde) : '';
    const to   = periodo ? fmtDateLabel(periodo.hasta) : '';
    rows.unshift(['Período', `${from} — ${to}`, null, null]);
    rows.unshift(['Generado', now, null, null]);
    downloadCSV(`tradeflow_kpis_${fmtDateInput(new Date())}.csv`, headers, rows);
  };

  if (noDateRange) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <svg className="h-10 w-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18" />
        </svg>
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Selecciona el rango de fechas</p>
        <p className="text-xs text-slate-400">Elige fecha de inicio y fin para ver el informe</p>
      </div>
    );
  }
  if (errMsg) return <ErrorBanner msg={errMsg} />;
  if (loading) return <KPIGridSkeleton />;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        {periodo && (
          <p className="text-xs text-slate-400">
            Comparado con: {fmtDateLabel(periodo.prev_desde)} — {fmtDateLabel(periodo.prev_hasta)}
          </p>
        )}
        {kpis && (
          <button onClick={exportCSV}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
            <IconDownload />Exportar CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Ventas totales" value={fmtCurrency(kpis?.ventas.valor ?? null)}
          kpi={kpis?.ventas ?? null} icon={<IconEuro />} kpiDirection="higher_is_better"
          accentClass="text-teal-600 dark:text-teal-400" />
        <KPICard label="Número de pedidos" value={fmtInteger(kpis?.num_pedidos.valor ?? null)}
          kpi={kpis?.num_pedidos ?? null} icon={<IconOrders />} kpiDirection="higher_is_better"
          accentClass="text-teal-600 dark:text-teal-400" />
        <KPICard label="Ticket medio" value={fmtCurrency(kpis?.ticket_medio.valor ?? null)}
          kpi={kpis?.ticket_medio ?? null} icon={<IconTicket />} kpiDirection="neutral"
          accentClass="text-teal-600 dark:text-teal-400" noDataNote="Sin pedidos en el período" />
        <KPICard label="Productos vendidos" value={fmtInteger(kpis?.prod_vendidos.valor ?? null)}
          kpi={kpis?.prod_vendidos ?? null} icon={<IconProduct />} kpiDirection="higher_is_better"
          accentClass="text-indigo-600 dark:text-indigo-400" soloMkt />
        <KPICard label="Unidades vendidas" value={fmtInteger(kpis?.unidades_vendidas.valor ?? null)}
          kpi={kpis?.unidades_vendidas ?? null} icon={<IconUnits />} kpiDirection="higher_is_better"
          accentClass="text-indigo-600 dark:text-indigo-400" soloMkt />
        <KPICard label="Pedidos cancelados" value={fmtInteger(kpis?.cancelados.valor ?? null)}
          kpi={kpis?.cancelados ?? null} icon={<IconCancelled />} kpiDirection="lower_is_better"
          accentClass="text-red-500 dark:text-red-400" />
        <KPICard label="Pedidos con incidencia" value={fmtInteger(kpis?.incidencias.valor ?? null)}
          kpi={kpis?.incidencias ?? null} icon={<IconAlert />} kpiDirection="lower_is_better"
          accentClass="text-amber-600 dark:text-amber-400" noDataNote="Sin comp. período ant." soloMkt />
        <KPICard label="Tiempo medio de confirmación" value={fmtHours(kpis?.avg_confirm_h.valor ?? null)}
          kpi={kpis?.avg_confirm_h ?? null} icon={<IconClock />} kpiDirection="lower_is_better"
          accentClass="text-slate-600 dark:text-slate-400" noDataNote="Sin pedidos confirmados" soloMkt />
        <KPICard label="Tiempo medio hasta envío" value={fmtHours(kpis?.avg_ship_h.valor ?? null)}
          kpi={kpis?.avg_ship_h ?? null} icon={<IconTruck />} kpiDirection="lower_is_better"
          accentClass="text-slate-600 dark:text-slate-400" noDataNote="Sin pedidos enviados" soloMkt />
      </div>

      <div className="mt-8 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notas metodológicas</p>
        <ul className="space-y-1">
          <li className="text-xs text-slate-400"><span className="font-medium text-slate-500">Ventas, pedidos y cancelados</span> — incluyen pedidos marketplace y legacy. Se excluyen borradores y pendientes de confirmación.</li>
          <li className="text-xs text-slate-400"><span className="font-medium text-slate-500">Productos, unidades e incidencias</span> — solo pedidos marketplace (legacy no contiene referencia a productos del catálogo).</li>
          <li className="text-xs text-slate-400"><span className="font-medium text-slate-500">Tiempos de ciclo</span> — calculados sobre fechas reales (confirmed_at, shipped_at). Solo marketplace. Sin comparación de período anterior.</li>
          <li className="text-xs text-slate-400"><span className="font-medium text-slate-500">Período anterior</span> — intervalo de igual duración inmediatamente anterior al período seleccionado.</li>
          <li className="text-xs text-slate-400"><span className="font-medium text-slate-500">Semántica de delta</span> — verde = mejora. Para cancelaciones e incidencias, bajar es mejorar.</li>
        </ul>
      </div>
    </>
  );
}

// ── VentasTab ─────────────────────────────────────────────────────────────────

interface VentasTabProps {
  actorId: string;
  dateFrom: Date | null;
  dateTo:   Date | null;
}

function VentasTab({ actorId, dateFrom, dateTo }: VentasTabProps) {
  const [data,    setData]    = useState<SalesReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const fetchRef = useRef(0);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const token = ++fetchRef.current;
    setLoading(true); setErrMsg(null);
    getSupplierReportingSales(actorId, dateFrom, dateTo)
      .then((res) => { if (token === fetchRef.current) { setData(res); setLoading(false); } })
      .catch((e)  => { if (token === fetchRef.current) { setErrMsg(e instanceof Error ? e.message : 'Error al cargar'); setLoading(false); } });
  }, [actorId, dateFrom, dateTo]);

  const exportCSV = () => {
    if (!data) return;
    const now = new Date().toLocaleDateString('es-ES');
    downloadCSV(`tradeflow_ventas_por_dia_${fmtDateInput(new Date())}.csv`,
      ['Fecha', 'Ventas (€)', 'Número de pedidos'],
      [
        ['Generado', now, null],
        ...data.by_day.map((d) => [d.fecha, d.ventas, d.num_pedidos]),
      ]
    );
  };

  if (!dateFrom || !dateTo) {
    return <p className="text-sm text-slate-400 py-12 text-center">Selecciona un período para ver el análisis de ventas.</p>;
  }
  if (errMsg) return <ErrorBanner msg={errMsg} />;
  if (loading) return <SectionSkeleton rows={4} />;
  if (!data) return null;

  const byDayMapped = data.by_day.map((d) => ({ ...d, fecha: d.fecha.slice(5) }));
  const maxOrgTotal = Math.max(...data.by_org.map((o) => o.total), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Ventas y pedidos</h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <IconDownload />Exportar CSV
        </button>
      </div>

      {/* Evolución diaria */}
      {byDayMapped.length > 0 ? (
        <ChartCard title="Evolución de ventas por día">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={byDayMapped} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k€` : `${v}€`} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any, name: any) => [
                  name === 'ventas' ? fmtCurrency(Number(v)) : fmtInteger(Number(v)),
                  name === 'ventas' ? 'Ventas' : 'Pedidos',
                ]}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Area type="monotone" dataKey="ventas" stroke="#0d9488" strokeWidth={2} fill="url(#gradVentas)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      ) : (
        <ChartCard title="Evolución de ventas por día">
          <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin ventas en el período</div>
        </ChartCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución por estado */}
        <ChartCard title="Distribución por estado (marketplace)">
          {data.by_estado.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin pedidos</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={data.by_estado} dataKey="count" nameKey="estado"
                  cx="50%" cy="50%" outerRadius={70} innerRadius={40}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={(props: any) => `${ESTADO_LABELS[props.estado] ?? props.estado} (${props.count})`}
                  labelLine={false}
                >
                  {data.by_estado.map((entry, i) => (
                    <Cell key={entry.estado} fill={ESTADO_COLORS[entry.estado] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(v: any, name: any) => [fmtInteger(Number(v)), ESTADO_LABELS[String(name)] ?? String(name)]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Top compradores */}
        <ChartCard title="Top compradores por volumen (marketplace)">
          {data.by_org.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin datos</div>
          ) : (
            <div className="space-y-2">
              {data.by_org.map((org) => (
                <div key={org.org_nombre}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[60%]">{org.org_nombre}</span>
                    <span className="text-slate-500 tabular-nums">{fmtCurrency(org.total)} · {org.count} ped.</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(org.total / maxOrgTotal) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Pedidos atrasados */}
      {data.atrasados.length > 0 && (
        <ChartCard title={`Pedidos activos sin avanzar > 72 h (${data.atrasados.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <th className="pb-2 font-medium">Número</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                  <th className="pb-2 font-medium text-right">Espera</th>
                </tr>
              </thead>
              <tbody>
                {data.atrasados.map((o) => (
                  <tr key={o.order_id} className="border-b border-slate-50 dark:border-slate-800/60">
                    <td className="py-2 font-mono text-slate-700 dark:text-slate-300">{o.numero}</td>
                    <td className="py-2">
                      <span className="rounded-full px-2 py-0.5 text-xs"
                        style={{ background: ESTADO_COLORS[o.estado] + '22', color: ESTADO_COLORS[o.estado] }}>
                        {ESTADO_LABELS[o.estado] ?? o.estado}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600 dark:text-slate-400 tabular-nums">{fmtCurrency(o.total)}</td>
                    <td className="py-2 text-right font-semibold text-red-500">{o.horas_espera} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      )}
    </div>
  );
}

// ── CatalogoTab ───────────────────────────────────────────────────────────────

interface CatalogoTabProps {
  actorId:  string;
  dateFrom: Date | null;
  dateTo:   Date | null;
}

function CatalogoTab({ actorId, dateFrom, dateTo }: CatalogoTabProps) {
  const [data,    setData]    = useState<CatalogReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const fetchRef = useRef(0);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const token = ++fetchRef.current;
    setLoading(true); setErrMsg(null);
    getSupplierReportingCatalog(actorId, dateFrom, dateTo)
      .then((res) => { if (token === fetchRef.current) { setData(res); setLoading(false); } })
      .catch((e)  => { if (token === fetchRef.current) { setErrMsg(e instanceof Error ? e.message : 'Error al cargar'); setLoading(false); } });
  }, [actorId, dateFrom, dateTo]);

  const exportCSV = () => {
    if (!data) return;
    downloadCSV(`tradeflow_catalogo_${fmtDateInput(new Date())}.csv`,
      ['Descripción', 'Referencia', 'Ventas (€)', 'Pedidos', 'Unidades'],
      [
        ['Generado', new Date().toLocaleDateString('es-ES'), null, null, null],
        ...data.top_por_ventas.map((p) => [p.descripcion, p.ref ?? '', p.total_ventas, p.num_pedidos, p.unidades]),
      ]
    );
  };

  if (!dateFrom || !dateTo) return <p className="text-sm text-slate-400 py-12 text-center">Selecciona un período.</p>;
  if (errMsg) return <ErrorBanner msg={errMsg} />;
  if (loading) return <SectionSkeleton rows={4} />;
  if (!data) return null;

  const { calidad, ia } = data;
  const maxVenta = Math.max(...data.top_por_ventas.map((p) => p.total_ventas), 1);
  const maxUnits = Math.max(...data.top_por_unidades.map((p) => p.unidades), 1);

  const matchStates = ['matched', 'suggested', 'pending_review', 'unmatched', 'rejected'];
  const matchLabels: Record<string, string> = {
    matched:      'Vinculado',
    suggested:    'Sugerido',
    pending_review: 'Pendiente revisión',
    unmatched:    'Sin vincular',
    rejected:     'Rechazado',
  };
  const matchColors: Record<string, string> = {
    matched:      'bg-emerald-500',
    suggested:    'bg-blue-400',
    pending_review: 'bg-amber-400',
    unmatched:    'bg-slate-300 dark:bg-slate-600',
    rejected:     'bg-red-400',
  };

  const totalOfferings = matchStates.reduce((s, k) => s + (ia.distribucion[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Rendimiento del catálogo</h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <IconDownload />Exportar CSV
        </button>
      </div>

      {/* Calidad del catálogo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Activos sin ventas', value: calidad.sin_ventas, of: calidad.total_activas, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Sin stock (activos)', value: calidad.sin_stock,  of: calidad.total_activas, color: 'text-red-500 dark:text-red-400' },
          { label: 'Sin imagen',          value: calidad.sin_imagen, of: calidad.total_activas, color: 'text-slate-500 dark:text-slate-400' },
          { label: 'Inactivos',           value: calidad.inactivos,  of: null,                  color: 'text-slate-500 dark:text-slate-400' },
        ].map(({ label, value, of, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color}`}>{fmtInteger(value)}</p>
            {of !== null && <p className="text-xs text-slate-400">de {fmtInteger(of)} activos</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top por ventas */}
        <ChartCard title="Top 10 productos por ventas en período">
          {data.top_por_ventas.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin ventas en el período</div>
          ) : (
            <div className="space-y-2">
              {data.top_por_ventas.map((p) => (
                <div key={p.offering_id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[55%]" title={p.descripcion}>{p.descripcion}</span>
                    <span className="text-slate-500 tabular-nums">{fmtCurrency(p.total_ventas)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${(p.total_ventas / maxVenta) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        {/* Top por unidades */}
        <ChartCard title="Top 10 productos por unidades vendidas">
          {data.top_por_unidades.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-slate-400">Sin ventas en el período</div>
          ) : (
            <div className="space-y-2">
              {data.top_por_unidades.map((p) => (
                <div key={p.offering_id}>
                  <div className="flex items-center justify-between text-xs mb-0.5">
                    <span className="text-slate-700 dark:text-slate-300 truncate max-w-[55%]" title={p.descripcion}>{p.descripcion}</span>
                    <span className="text-slate-500 tabular-nums">{fmtInteger(p.unidades)} ud.</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full"
                      style={{ width: `${(p.unidades / maxUnits) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Cobertura IA */}
      <ChartCard title="Cobertura de matching IA">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 h-3 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {matchStates.map((state) => {
              const cnt = ia.distribucion[state] ?? 0;
              const pct = totalOfferings > 0 ? (cnt / totalOfferings) * 100 : 0;
              return pct > 0 ? (
                <div key={state} className={`h-full ${matchColors[state]}`} style={{ width: `${pct}%` }} title={`${matchLabels[state]}: ${cnt}`} />
              ) : null;
            })}
          </div>
          <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {totalOfferings > 0 ? fmtPct((ia.distribucion['matched'] ?? 0) * 100 / totalOfferings) : '—'}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          {matchStates.map((state) => {
            const cnt = ia.distribucion[state] ?? 0;
            if (cnt === 0) return null;
            return (
              <div key={state} className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${matchColors[state]}`} />
                <span className="text-xs text-slate-500">{matchLabels[state]}: <strong>{cnt}</strong></span>
              </div>
            );
          })}
        </div>
        {ia.avg_confidence !== null && (
          <p className="text-xs text-slate-400 mt-2">
            Confianza media de matching: <strong className="text-slate-600 dark:text-slate-300">{(ia.avg_confidence * 100).toFixed(1)}%</strong>
          </p>
        )}
        {ia.pending_review > 0 && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
            {ia.pending_review} producto{ia.pending_review > 1 ? 's' : ''} pendiente{ia.pending_review > 1 ? 's' : ''} de revisión de matching
          </p>
        )}
      </ChartCard>
    </div>
  );
}

// ── OperativoTab ──────────────────────────────────────────────────────────────

interface OperativoTabProps {
  actorId:  string;
  dateFrom: Date | null;
  dateTo:   Date | null;
}

function SLABar({ label, pct, target, color }: { label: string; pct: number | null; target: number; color: string }) {
  const v = pct ?? 0;
  const ok = v >= target;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-600 dark:text-slate-400">{label}</span>
        <span className={`font-semibold tabular-nums ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
          {pct !== null ? `${v.toFixed(1)}%` : '—'}
        </span>
      </div>
      <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : 'bg-amber-400'}`}
          style={{ width: `${Math.min(v, 100)}%` }} />
        <div className="absolute top-0 h-full w-px bg-slate-400 dark:bg-slate-600" style={{ left: `${target}%` }} />
      </div>
      <p className="text-xs text-slate-400 mt-0.5">Objetivo: ≥ {target}%</p>
    </div>
  );
}

function TimeCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <div className="text-slate-400">{icon}</div>
      </div>
      <p className="text-xl font-bold text-slate-700 dark:text-slate-200 tabular-nums">{value}</p>
    </div>
  );
}

function OperativoTab({ actorId, dateFrom, dateTo }: OperativoTabProps) {
  const [data,    setData]    = useState<OperationalReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg,  setErrMsg]  = useState<string | null>(null);
  const fetchRef = useRef(0);

  useEffect(() => {
    if (!dateFrom || !dateTo) return;
    const token = ++fetchRef.current;
    setLoading(true); setErrMsg(null);
    getSupplierReportingOperational(actorId, dateFrom, dateTo)
      .then((res) => { if (token === fetchRef.current) { setData(res); setLoading(false); } })
      .catch((e)  => { if (token === fetchRef.current) { setErrMsg(e instanceof Error ? e.message : 'Error al cargar'); setLoading(false); } });
  }, [actorId, dateFrom, dateTo]);

  const exportCSV = () => {
    if (!data) return;
    const { tiempos, sla, incidencias } = data;
    downloadCSV(`tradeflow_operativo_${fmtDateInput(new Date())}.csv`,
      ['Métrica', 'Valor'],
      [
        ['Generado', new Date().toLocaleDateString('es-ES')],
        ['Tiempo medio confirmación (h)', tiempos.avg_confirm_h ?? ''],
        ['Tiempo medio preparación (h)', tiempos.avg_preparing_h ?? ''],
        ['Tiempo medio hasta envío (h)', tiempos.avg_ship_h ?? ''],
        ['Tiempo medio ciclo completo (h)', tiempos.avg_total_cycle_h ?? ''],
        ['Pedidos confirmados en < 24h (%)', sla.pct_confirmed_24h ?? ''],
        ['Pedidos enviados en < 48h (%)', sla.pct_shipped_48h ?? ''],
        ['Total pedidos (excl. cancelados)', sla.total_orders],
        ['Pedidos confirmados', sla.confirmed_orders],
        ['Pedidos enviados', sla.shipped_orders],
        ['Pedidos atrasados (activos > 72h)', data.atrasados_count],
        ['Incidencias totales', incidencias.total],
      ]
    );
  };

  if (!dateFrom || !dateTo) return <p className="text-sm text-slate-400 py-12 text-center">Selecciona un período.</p>;
  if (errMsg) return <ErrorBanner msg={errMsg} />;
  if (loading) return <SectionSkeleton rows={4} />;
  if (!data) return null;

  const { tiempos, sla, atrasados_count, incidencias } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Rendimiento operativo</h2>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-colors">
          <IconDownload />Exportar CSV
        </button>
      </div>

      {/* Tiempos de ciclo */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Tiempos medios de ciclo</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <TimeCard label="Confirmación" value={fmtHours(tiempos.avg_confirm_h)} icon={<IconClock />} />
          <TimeCard label="Preparación" value={fmtHours(tiempos.avg_preparing_h)} icon={<IconOrders />} />
          <TimeCard label="Envío (desde confirmación)" value={fmtHours(tiempos.avg_ship_h)} icon={<IconTruck />} />
          <TimeCard label="Ciclo completo" value={fmtHours(tiempos.avg_total_cycle_h)} icon={<IconEuro />} />
        </div>
        <p className="text-xs text-slate-400 mt-2">Solo pedidos marketplace con timestamps completos. Ciclo completo: desde creación hasta entrega.</p>
      </div>

      {/* SLA */}
      <ChartCard title="Nivel de servicio (SLA)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <SLABar label="Confirmados en < 24 h" pct={sla.pct_confirmed_24h} target={80} color="emerald" />
          <SLABar label="Enviados en < 48 h desde confirmación" pct={sla.pct_shipped_48h} target={70} color="emerald" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>Pedidos activos: <strong>{fmtInteger(sla.total_orders)}</strong></span>
          <span>Confirmados: <strong>{fmtInteger(sla.confirmed_orders)}</strong></span>
          <span>Enviados: <strong>{fmtInteger(sla.shipped_orders)}</strong></span>
        </div>
      </ChartCard>

      {/* Alertas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className={`rounded-xl border p-4 ${
          atrasados_count > 0
            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Pedidos atrasados (&gt; 72 h activos)</p>
          <p className={`text-3xl font-bold tabular-nums ${atrasados_count > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {fmtInteger(atrasados_count)}
          </p>
          <p className="text-xs text-slate-400 mt-1">En estado confirmed, preparing o pending</p>
        </div>
        <div className={`rounded-xl border p-4 ${
          incidencias.total > 0
            ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
        }`}>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Incidencias en el período</p>
          <p className={`text-3xl font-bold tabular-nums ${incidencias.total > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {fmtInteger(incidencias.total)}
          </p>
          <p className="text-xs text-slate-400 mt-1">Pedidos únicos con incidencia reportada</p>
        </div>
      </div>

      {/* Incidencias por día */}
      {incidencias.by_day.length > 0 && (
        <ChartCard title="Incidencias por día">
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={incidencias.by_day.map((d) => ({ ...d, fecha: d.fecha.slice(5) }))}
              margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(v: any) => [fmtInteger(Number(v)), 'Incidencias']}
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="count" fill="#f59e0b" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PortalInformes({ actorId }: Props) {
  const [preset,      setPreset]      = useState<PeriodPreset>('30d');
  const [customFrom,  setCustomFrom]  = useState<string>('');
  const [customTo,    setCustomTo]    = useState<string>('');
  const [section,     setSection]     = useState<ReportSection>('general');
  const [kpiData,     setKpiData]     = useState<ReportingKPIsResult | null>(null);
  const [kpiLoading,  setKpiLoading]  = useState(true);
  const [kpiErr,      setKpiErr]      = useState<string | null>(null);
  const fetchRef = useRef(0);

  const effectiveDates = useCallback((): PeriodDates | null => {
    if (preset === 'custom') {
      if (!customFrom || !customTo) return null;
      return { from: new Date(customFrom + 'T00:00:00'), to: new Date(customTo + 'T23:59:59') };
    }
    return getPresetDates(preset);
  }, [preset, customFrom, customTo]);

  const dates = effectiveDates();

  useEffect(() => {
    if (!dates) return;
    const token = ++fetchRef.current;
    setKpiLoading(true); setKpiErr(null);
    getSupplierReportingKPIs(actorId, dates.from, dates.to)
      .then((res) => { if (token === fetchRef.current) { setKpiData(res); setKpiLoading(false); } })
      .catch((e)  => { if (token === fetchRef.current) { setKpiErr(e instanceof Error ? e.message : 'Error'); setKpiLoading(false); } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, customFrom, customTo, actorId]);

  const handlePreset = (p: PeriodPreset) => {
    setPreset(p);
    if (p !== 'custom') return;
    const d = getPresetDates('30d');
    setCustomFrom(fmtDateInput(d.from));
    setCustomTo(fmtDateInput(d.to));
  };

  const sections: { id: ReportSection; label: string }[] = [
    { id: 'general',   label: 'General' },
    { id: 'ventas',    label: 'Ventas' },
    { id: 'catalogo',  label: 'Catálogo' },
    { id: 'operativo', label: 'Operativo' },
  ];

  const periodo = kpiData?.periodo;

  return (
    <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="px-6 py-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Informes</h1>
              {periodo && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {fmtDateLabel(periodo.desde)} — {fmtDateLabel(periodo.hasta)}
                </p>
              )}
            </div>
            <PeriodSelector
              preset={preset} customFrom={customFrom} customTo={customTo}
              onPreset={handlePreset} onCustomFrom={setCustomFrom} onCustomTo={setCustomTo}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-100 dark:border-slate-800 -mb-5">
            {sections.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  section === s.id
                    ? 'border-teal-600 text-teal-700 dark:text-teal-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >{s.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 p-6">
        {section === 'general' && (
          <GeneralTab
            data={kpiData} loading={kpiLoading} errMsg={kpiErr}
            noDateRange={preset === 'custom' && (!customFrom || !customTo)}
          />
        )}
        {section === 'ventas' && (
          <VentasTab actorId={actorId} dateFrom={dates?.from ?? null} dateTo={dates?.to ?? null} />
        )}
        {section === 'catalogo' && (
          <CatalogoTab actorId={actorId} dateFrom={dates?.from ?? null} dateTo={dates?.to ?? null} />
        )}
        {section === 'operativo' && (
          <OperativoTab actorId={actorId} dateFrom={dates?.from ?? null} dateTo={dates?.to ?? null} />
        )}
      </div>
    </div>
  );
}
