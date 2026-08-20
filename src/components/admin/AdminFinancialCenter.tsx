/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  adminGetFinancialDocuments,
  adminGetFinancialSummary,
  type TradeFinancialDocument,
  type FinancialSummary,
  type FinancialDocFilters,
} from '../../lib/supabase';
import { exportToCsv as exportCsv } from '../../lib/exportCsv';
import { useToast } from '../ui/Toast';
import {
  CreditCard, Download, RefreshCw, Search, X, TrendingUp, Euro,
  Clock, BarChart2, Filter, ChevronDown, ExternalLink, Eye,
  Megaphone, Repeat, ShoppingCart, Package, FileText, CheckCircle,
  AlertTriangle, Building2, Users, Zap,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtEur(n: number, decimals = 0) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n) + ' €';
}

function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dateRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '—';
  const s = start ? new Date(start).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '?';
  const e = end   ? new Date(end).toLocaleDateString('es-ES',   { day: '2-digit', month: '2-digit', year: '2-digit' }) : '?';
  return `${s} – ${e}`;
}

const REVENUE_LABELS: Record<string, string> = {
  subscription:     'SaaS',
  advertising:      'Publicidad',
  marketplace:      'Marketplace',
  provider_service: 'Proveedor',
  other:            'Otro',
};

const REVENUE_COLORS: Record<string, string> = {
  subscription:     'bg-blue-900/40 text-blue-300 border-blue-800',
  advertising:      'bg-purple-900/40 text-purple-300 border-purple-800',
  marketplace:      'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  provider_service: 'bg-orange-900/40 text-orange-300 border-orange-800',
  other:            'bg-slate-700 text-slate-400 border-slate-600',
};

const ESTADO_COLORS: Record<string, string> = {
  draft:     'bg-slate-700 text-slate-400 border-slate-600',
  issued:    'bg-blue-900/40 text-blue-300 border-blue-800',
  pending:   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  paid:      'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  waived:    'bg-violet-900/40 text-violet-300 border-violet-800',
  cancelled: 'bg-red-900/40 text-red-300 border-red-800',
  refunded:  'bg-orange-900/40 text-orange-300 border-orange-800',
};

const ESTADO_LABELS: Record<string, string> = {
  draft: 'Borrador', issued: 'Emitida', pending: 'Pendiente',
  paid: 'Pagada', waived: 'Bonificada', cancelled: 'Cancelada', refunded: 'Devuelta',
};

const DOCTYPE_LABELS: Record<string, string> = {
  invoice: 'Factura',
  commercial_summary: 'Resumen comercial',
  proforma: 'Proforma',
  credit_note: 'Nota crédito',
};

// ── Sub-componentes (fuera del padre para evitar re-mounts) ────────────────

function RevenueBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${REVENUE_COLORS[type] ?? REVENUE_COLORS.other}`}>
      {REVENUE_LABELS[type] ?? type}
    </span>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${ESTADO_COLORS[estado] ?? ESTADO_COLORS.draft}`}>
      {ESTADO_LABELS[estado] ?? estado}
    </span>
  );
}

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
      <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1 leading-tight">{label}</div>
      <div className={`text-xl font-bold ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Modal de detalle de documento ─────────────────────────────────────────

function DocDetailModal({ doc, onClose }: { doc: TradeFinancialDocument; onClose: () => void }) {
  const isWaived  = doc.payment_status === 'waived';
  const isAdv     = doc.revenue_type === 'advertising';
  const isSub     = doc.revenue_type === 'subscription';
  const metadata      = doc.metadata ?? {};
  const metaPlan      = typeof metadata.plan === 'string' ? metadata.plan : '';
  const metaCycle     = typeof metadata.billing_cycle === 'string' ? metadata.billing_cycle : '';
  const metaMode      = typeof metadata.pricing_mode === 'string' ? metadata.pricing_mode : '';
  const metaDays      = metadata.estimated_days != null ? String(metadata.estimated_days) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-slate-400" />
            <div>
              <div className="text-sm font-bold text-white font-mono">{doc.doc_number}</div>
              <div className="text-[10px] text-slate-400">{DOCTYPE_LABELS[doc.document_type] ?? doc.document_type}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RevenueBadge type={doc.revenue_type} />
            <EstadoBadge estado={doc.estado} />
            <button onClick={onClose}
              className="ml-2 h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer transition-colors">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Datos del cliente */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              {isAdv ? 'Proveedor' : 'Cliente'}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">Empresa: </span>
                <span className="text-slate-200">{doc.customer_name || doc.org_nombre || doc.actor_nombre || '—'}</span>
              </div>
              {doc.customer_nif && (
                <div>
                  <span className="text-slate-500">NIF/CIF: </span>
                  <span className="text-slate-200 font-mono">{doc.customer_nif}</span>
                </div>
              )}
              {doc.customer_email && (
                <div>
                  <span className="text-slate-500">Email: </span>
                  <span className="text-slate-200">{doc.customer_email}</span>
                </div>
              )}
            </div>
          </section>

          {/* Concepto */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Concepto</h3>
            <div className="text-sm text-slate-200 mb-2">{doc.concept}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              {(doc.period_start || doc.period_end) && (
                <div>
                  <span className="text-slate-500">Periodo: </span>
                  <span className="text-slate-200">{dateRange(doc.period_start, doc.period_end)}</span>
                </div>
              )}
              {isSub && metaPlan && (
                <div>
                  <span className="text-slate-500">Plan: </span>
                  <span className="text-slate-200 capitalize">{metaPlan}</span>
                </div>
              )}
              {isSub && metaCycle && (
                <div>
                  <span className="text-slate-500">Ciclo: </span>
                  <span className="text-slate-200">{metaCycle === 'monthly' ? 'Mensual' : 'Anual'}</span>
                </div>
              )}
              {isAdv && doc.slot_nombre && (
                <div>
                  <span className="text-slate-500">Espacio: </span>
                  <span className="text-slate-200">{doc.slot_nombre}</span>
                </div>
              )}
              {isAdv && metaMode && (
                <div>
                  <span className="text-slate-500">Promoción: </span>
                  <span className="text-slate-200">{metaMode === 'validation_free' ? 'Fase 0 — Bonificación completa' : metaMode}</span>
                </div>
              )}
              {isAdv && metaDays && (
                <div>
                  <span className="text-slate-500">Duración: </span>
                  <span className="text-slate-200">{metaDays} días</span>
                </div>
              )}
            </div>
          </section>

          {/* Desglose económico */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Desglose económico</h3>
            <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Tarifa base</span>
                <span className="text-slate-200 font-mono">{fmtEur(doc.rate_amount, 2)}</span>
              </div>
              {doc.discount_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Descuento</span>
                  <span className="text-orange-400 font-mono">–{fmtEur(doc.discount_amount, 2)}</span>
                </div>
              )}
              {doc.promotion_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">{isAdv ? 'Bonificación Fase 0' : 'Promoción'}</span>
                  <span className="text-violet-400 font-mono">–{fmtEur(doc.promotion_amount, 2)}</span>
                </div>
              )}
              {doc.tax_rate > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">IVA ({doc.tax_rate}%)</span>
                  <span className="text-slate-200 font-mono">{fmtEur(doc.tax_amount, 2)}</span>
                </div>
              )}
              <div className="border-t border-slate-700 pt-1.5 flex justify-between font-semibold">
                <span className={isWaived ? 'text-violet-300' : 'text-white'}>Total</span>
                <span className={`font-mono text-sm ${isWaived ? 'text-violet-300' : 'text-white'}`}>
                  {fmtEur(doc.total_amount, 2)}
                </span>
              </div>
              {isWaived && doc.commercial_value > 0 && (
                <div className="flex justify-between text-slate-500">
                  <span>Valor comercial bonificado</span>
                  <span className="font-mono">{fmtEur(doc.commercial_value, 2)}</span>
                </div>
              )}
            </div>
            {isWaived && (
              <p className="text-[10px] text-violet-400 mt-2 italic">
                Operación 100 % bonificada durante fase de validación comercial.
              </p>
            )}
          </section>

          {/* Pago */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">Pago</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">Estado: </span>
                <EstadoBadge estado={doc.estado} />
              </div>
              {doc.paid_at && (
                <div>
                  <span className="text-slate-500">Fecha cobro: </span>
                  <span className="text-slate-200">{fmtDate(doc.paid_at)}</span>
                </div>
              )}
              {doc.payment_method && (
                <div>
                  <span className="text-slate-500">Método: </span>
                  <span className="text-slate-200">{doc.payment_method}</span>
                </div>
              )}
              {doc.stripe_invoice_id && (
                <div>
                  <span className="text-slate-500">Stripe ID: </span>
                  <span className="text-slate-200 font-mono text-[10px]">{doc.stripe_invoice_id}</span>
                </div>
              )}
            </div>
          </section>

          {/* Acciones */}
          <section className="flex flex-wrap gap-2 pt-1">
            {doc.invoice_url && (
              <a href={doc.invoice_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-blue-600 hover:text-blue-300 transition-colors cursor-pointer">
                <ExternalLink className="h-3.5 w-3.5" /> Ver Stripe
              </a>
            )}
            {doc.invoice_pdf_url && (
              <a href={doc.invoice_pdf_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-emerald-600 hover:text-emerald-300 transition-colors cursor-pointer">
                <Download className="h-3.5 w-3.5" /> PDF Stripe
              </a>
            )}
            <button onClick={() => { navigator.clipboard.writeText(doc.doc_number); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors cursor-pointer">
              <FileText className="h-3.5 w-3.5" /> Copiar número
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Analytics: Origen de ingresos ─────────────────────────────────────────

function RevenueByTypeSection({ summary }: { summary: FinancialSummary }) {
  const total = summary.por_tipo?.reduce((s, r) => s + (r.cobrado ?? 0), 0) ?? 0;
  const totalComercial = summary.por_tipo?.reduce((s, r) => s + (r.valor_comercial ?? 0), 0) ?? 0;

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Origen de ingresos</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(summary.por_tipo ?? []).map(row => {
          const pctCobrado = totalComercial > 0 ? Math.round((row.valor_comercial / totalComercial) * 100) : 0;
          return (
            <div key={row.revenue_type} className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <RevenueBadge type={row.revenue_type} />
                <span className="text-xs text-slate-500">{row.docs} doc{row.docs !== 1 ? 's' : ''}</span>
              </div>
              <div className="text-lg font-bold text-white">{fmtEur(row.cobrado, 0)}</div>
              <div className="text-[10px] text-slate-500">cobrado</div>
              {row.bonificado > 0 && (
                <div className="text-[10px] text-violet-400 mt-0.5">+{fmtEur(row.bonificado, 0)} bonificado</div>
              )}
              <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${pctCobrado}%` }} />
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">{pctCobrado}% del valor comercial</div>
            </div>
          );
        })}
        {(!summary.por_tipo || summary.por_tipo.length === 0) && (
          <div className="col-span-4 text-sm text-slate-500 py-4 text-center">Sin datos de ingresos todavía</div>
        )}
      </div>
    </div>
  );
}

// ── Analytics: Publicidad por espacio ─────────────────────────────────────

function AdSpaceSection({ summary }: { summary: FinancialSummary }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Publicidad por espacio</h3>
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Espacio','Formato','Reservas activas','Días reservados','Valor tarifa','Valor comercial','Proveedores'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(summary.ad_espacios ?? []).map(slot => (
                <tr key={slot.slot_id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                  <td className="px-3 py-1.5 text-slate-200 font-medium whitespace-nowrap">{slot.slot_nombre}</td>
                  <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap text-[10px]">{slot.formato}</td>
                  <td className="px-3 py-1.5">
                    <span className={`font-bold ${slot.reservas_activas > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
                      {slot.reservas_activas}
                    </span>
                    <span className="text-slate-600 ml-1">/ {slot.total_reservas}</span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-300 font-mono">{slot.dias_reservados} d</td>
                  <td className="px-3 py-1.5 text-slate-300 font-mono">{fmtEur(slot.valor_tarifa, 0)}</td>
                  <td className="px-3 py-1.5 font-mono">
                    <span className={slot.valor_comercial_total > 0 ? 'text-violet-300' : 'text-slate-500'}>
                      {fmtEur(slot.valor_comercial_total, 0)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-slate-300">{slot.proveedores_activos}</td>
                </tr>
              ))}
              {(!summary.ad_espacios || summary.ad_espacios.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Sin espacios publicitarios</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Analytics: SaaS por plan ──────────────────────────────────────────────

const PLAN_PRICES_MAP: Record<string, { monthly: number; yearly: number }> = {
  basico: { monthly: 29, yearly: 23 },
  pro: { monthly: 49, yearly: 39 },
  empresa: { monthly: 89, yearly: 71 },
  empresa_plus: { monthly: 149, yearly: 119 },
  profesional: { monthly: 69, yearly: 55 },
};

function SaasPlansSection({ summary }: { summary: FinancialSummary }) {
  const rows = summary.saas_planes ?? [];
  const grouped = rows.reduce<Record<string, { monthly: number; yearly: number; en_prueba: number; cancelados: number }>>((acc, r) => {
    if (!acc[r.plan]) acc[r.plan] = { monthly: 0, yearly: 0, en_prueba: 0, cancelados: 0 };
    if (r.billing_cycle === 'monthly') acc[r.plan].monthly = r.activos;
    else acc[r.plan].yearly = r.activos;
    acc[r.plan].en_prueba  += r.en_prueba;
    acc[r.plan].cancelados += r.cancelados;
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">SaaS por plan</h3>
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                {['Plan','Activos mensual','Activos anual','En prueba','MRR','ARR'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).sort(([a], [b]) => {
                const order = ['basico','pro','profesional','empresa','empresa_plus'];
                return order.indexOf(a) - order.indexOf(b);
              }).map(([plan, data]) => {
                const prices = PLAN_PRICES_MAP[plan] ?? { monthly: 0, yearly: 0 };
                const mrr = data.monthly * prices.monthly + data.yearly * prices.yearly;
                return (
                  <tr key={plan} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                    <td className="px-3 py-1.5 text-slate-200 font-medium capitalize">{plan.replace('_', ' ')}</td>
                    <td className="px-3 py-1.5 text-slate-300">{data.monthly}</td>
                    <td className="px-3 py-1.5 text-slate-300">{data.yearly}</td>
                    <td className="px-3 py-1.5 text-yellow-400">{data.en_prueba}</td>
                    <td className="px-3 py-1.5 text-emerald-400 font-mono font-semibold">{fmtEur(mrr, 0)}/mes</td>
                    <td className="px-3 py-1.5 text-slate-300 font-mono">{fmtEur(mrr * 12, 0)}</td>
                  </tr>
                );
              })}
              {Object.keys(grouped).length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sin datos de suscripciones</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Filtro de rango de fechas ─────────────────────────────────────────────

function buildDateRange(period: string): { from?: string; to?: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  if (period === 'this_month') {
    return { from: `${y}-${pad(m + 1)}-01`, to: iso(new Date(y, m + 1, 0)) };
  }
  if (period === 'last_month') {
    const lm = m === 0 ? 11 : m - 1;
    const ly = m === 0 ? y - 1 : y;
    return { from: `${ly}-${pad(lm + 1)}-01`, to: iso(new Date(ly, lm + 1, 0)) };
  }
  if (period === 'last_3m') {
    return { from: iso(new Date(y, m - 2, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
  if (period === 'last_6m') {
    return { from: iso(new Date(y, m - 5, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
  if (period === 'this_year') {
    return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
  if (period === 'last_year') {
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  }
  return {};
}

// ── Componente principal ──────────────────────────────────────────────────

type ActiveTab = 'docs' | 'analytics';

export default function AdminFinancialCenter() {
  const { toast } = useToast();

  // Datos
  const [docs,    setDocs]    = useState<TradeFinancialDocument[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<ActiveTab>('docs');

  // Detalle
  const [selectedDoc, setSelectedDoc] = useState<TradeFinancialDocument | null>(null);

  // Filtros
  const [revenueType,   setRevenueType]   = useState('');
  const [payerType,     setPayerType]     = useState('');
  const [estadoFilter,  setEstadoFilter]  = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [periodFilter,  setPeriodFilter]  = useState('all');
  const [searchText,    setSearchText]    = useState('');
  // Filtros dinámicos suscripciones
  const [planFilter,    setPlanFilter]    = useState('');
  const [cycleFilter,   setCycleFilter]   = useState('');
  // Filtros dinámicos publicidad — lista de slots disponibles
  const [slotFilter,    setSlotFilter]    = useState('');
  const [slots, setSlots] = useState<{ id: string; nombre: string }[]>([]);

  const buildFilters = useCallback((): FinancialDocFilters => {
    const { from, to } = buildDateRange(periodFilter);
    return {
      revenue_type:   revenueType   || undefined,
      payer_type:     payerType     || undefined,
      estado:         estadoFilter  || undefined,
      payment_status: paymentFilter || undefined,
      date_from:      from,
      date_to:        to,
      search:         searchText    || undefined,
      plan:           planFilter    || undefined,
      billing_cycle:  cycleFilter   || undefined,
      slot_id:        slotFilter    || undefined,
    };
  }, [revenueType, payerType, estadoFilter, paymentFilter, periodFilter, searchText, planFilter, cycleFilter, slotFilter]);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminGetFinancialDocuments(buildFilters());
      setDocs(data);
    } catch (e) {
      toast('error', 'Error al cargar documentos: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [buildFilters, toast]);

  const loadSummary = useCallback(async () => {
    try {
      const s = await adminGetFinancialSummary();
      setSummary(s);
      // Extraer slots únicos de ad_espacios para el filtro
      if (s.ad_espacios) {
        setSlots(s.ad_espacios.map(e => ({ id: e.slot_id, nombre: e.slot_nombre })));
      }
    } catch (e) {
      // summary es cosmético, no bloqueante
    }
  }, []);

  useEffect(() => {
    loadDocs();
  }, [revenueType, payerType, estadoFilter, paymentFilter, periodFilter, planFilter, cycleFilter, slotFilter]);

  useEffect(() => {
    loadSummary();
  }, []);

  const handleSearch = (e: { preventDefault: () => void }) => { e.preventDefault(); loadDocs(); };

  const clearFilters = () => {
    setRevenueType(''); setPayerType(''); setEstadoFilter(''); setPaymentFilter('');
    setPeriodFilter('all'); setSearchText(''); setPlanFilter(''); setCycleFilter(''); setSlotFilter('');
  };

  const hasFilters = !!(revenueType || payerType || estadoFilter || paymentFilter || periodFilter !== 'all' || searchText || planFilter || cycleFilter || slotFilter);

  const handleExportCsv = () => {
    const rows = docs.map(d => ({
      'Número': d.doc_number,
      'Fecha': fmtDate(d.period_start ?? d.created_at),
      'Cliente/Proveedor': d.customer_name || d.org_nombre || d.actor_nombre || '',
      'Tipo': REVENUE_LABELS[d.revenue_type] ?? d.revenue_type,
      'Concepto': d.concept,
      'Periodo': dateRange(d.period_start, d.period_end),
      'Tarifa (€)': d.rate_amount.toFixed(2),
      'Descuento (€)': d.discount_amount.toFixed(2),
      'Bonificación (€)': d.promotion_amount.toFixed(2),
      'Valor comercial (€)': d.commercial_value.toFixed(2),
      'Total (€)': d.total_amount.toFixed(2),
      'Estado': ESTADO_LABELS[d.estado] ?? d.estado,
      'Pago': d.payment_status,
      'Cobrado el': fmtDate(d.paid_at),
      'Stripe ID': d.stripe_invoice_id ?? '',
    }));
    exportCsv(rows, `tradeflow_financiero_${new Date().toISOString().slice(0, 10)}`);
  };

  const kpis = summary?.kpis;

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white">Facturación</h2>
        <p className="text-xs text-slate-400 mt-0.5">Control de ingresos, facturas y líneas de negocio de TrabFlow.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-1 w-fit">
        {([['docs', 'Documentos', FileText], ['analytics', 'Análisis', BarChart2]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors ${
              tab === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
      </div>

      {/* KPI cards — siempre visibles */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          label="Facturado este mes"
          value={kpis ? fmtEur(kpis.facturado_mes, 0) : '—'}
          color="text-blue-300"
        />
        <KpiCard
          label="Cobrado este mes"
          value={kpis ? fmtEur(kpis.cobrado_mes, 0) : '—'}
          color="text-emerald-400"
        />
        <KpiCard
          label="Pendiente cobro"
          value={kpis ? fmtEur(kpis.pendiente, 0) : '—'}
          color={kpis && kpis.pendiente > 0 ? 'text-yellow-400' : 'text-slate-500'}
        />
        <KpiCard
          label="Total YTD cobrado"
          value={kpis ? fmtEur(kpis.ytd_cobrado, 0) : '—'}
          color="text-purple-300"
        />
        <KpiCard
          label="Docs emitidos"
          value={kpis ? String(kpis.total_docs) : '—'}
          color="text-slate-200"
        />
        <KpiCard
          label="Ticket medio"
          value={kpis ? fmtEur(kpis.ticket_medio, 0) : '—'}
          sub={kpis && kpis.valor_comercial_bonificado > 0 ? `+${fmtEur(kpis.valor_comercial_bonificado, 0)} bonificado` : undefined}
          color="text-slate-200"
        />
      </div>

      {/* ── TAB DOCUMENTOS ────────────────────────────────────────────── */}
      {tab === 'docs' && (
        <div className="space-y-4">

          {/* Filtro tipo de ingreso (tabs rápidos) */}
          <div className="flex flex-wrap gap-1.5">
            {[
              ['', 'Todos'],
              ['subscription', 'SaaS'],
              ['advertising', 'Publicidad'],
              ['marketplace', 'Marketplace'],
              ['other', 'Otros'],
            ].map(([val, label]) => (
              <button key={val} onClick={() => { setRevenueType(val); setPlanFilter(''); setCycleFilter(''); setSlotFilter(''); }}
                className={`px-3 py-1.5 rounded text-xs font-semibold cursor-pointer transition-colors border ${
                  revenueType === val
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Barra de filtros */}
          <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar número, empresa, email…"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-blue-500 placeholder-slate-600"
              />
            </div>

            {/* Tipo cliente */}
            <select value={payerType} onChange={e => setPayerType(e.target.value)} className={selectCls}>
              <option value="">Tipo cliente</option>
              <option value="installer">Instalador</option>
              <option value="installer_company">Empresa instaladora</option>
              <option value="provider">Proveedor</option>
            </select>

            {/* Estado documento */}
            <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} className={selectCls}>
              <option value="">Estado</option>
              <option value="draft">Borrador</option>
              <option value="issued">Emitida</option>
              <option value="pending">Pendiente</option>
              <option value="paid">Pagada</option>
              <option value="waived">Bonificada</option>
              <option value="cancelled">Cancelada</option>
              <option value="refunded">Devuelta</option>
            </select>

            {/* Periodo */}
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className={selectCls}>
              <option value="all">Todo el tiempo</option>
              <option value="this_month">Este mes</option>
              <option value="last_month">Mes anterior</option>
              <option value="last_3m">Últimos 3 meses</option>
              <option value="last_6m">Últimos 6 meses</option>
              <option value="this_year">Este año</option>
              <option value="last_year">Año anterior</option>
            </select>

            {/* Filtros dinámicos — SaaS */}
            {revenueType === 'subscription' && (
              <>
                <select value={planFilter} onChange={e => setPlanFilter(e.target.value)} className={selectCls}>
                  <option value="">Plan</option>
                  <option value="basico">Básico</option>
                  <option value="pro">Pro</option>
                  <option value="profesional">Profesional</option>
                  <option value="empresa">Empresa</option>
                  <option value="empresa_plus">Empresa Plus</option>
                </select>
                <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)} className={selectCls}>
                  <option value="">Ciclo</option>
                  <option value="monthly">Mensual</option>
                  <option value="yearly">Anual</option>
                </select>
              </>
            )}

            {/* Filtros dinámicos — Publicidad */}
            {revenueType === 'advertising' && slots.length > 0 && (
              <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)} className={selectCls}>
                <option value="">Todos los espacios</option>
                {slots.map(s => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            )}

            <button type="submit"
              className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors">
              Buscar
            </button>

            {hasFilters && (
              <button type="button" onClick={clearFilters}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 cursor-pointer transition-colors">
                <X className="h-3 w-3" /> Limpiar
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-slate-500">{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
              <button type="button" onClick={handleExportCsv} title="Exportar CSV"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white hover:border-emerald-700 hover:bg-emerald-900/20 cursor-pointer transition-colors">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
              <button type="button" onClick={() => { loadDocs(); loadSummary(); }}
                className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
                <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </form>

          {/* Tabla unificada */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    {['Documento','Fecha','Cliente/Proveedor','Tipo','Concepto','Periodo','Tarifa','Dcto','Total','Estado','Acciones'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11} className="px-4 py-10 text-center text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin inline-block mr-2" />Cargando documentos…
                    </td></tr>
                  ) : docs.length === 0 ? (
                    <tr><td colSpan={11} className="px-4 py-10 text-center">
                      <CreditCard className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                      <p className="text-slate-500">No hay documentos que coincidan</p>
                      {hasFilters && <p className="text-slate-600 text-[10px] mt-1">Prueba a quitar algunos filtros</p>}
                    </td></tr>
                  ) : docs.map(doc => {
                    const clientLabel = doc.customer_name || doc.org_nombre || doc.actor_nombre || '—';
                    const showDiscount = doc.discount_amount > 0 || doc.promotion_amount > 0;
                    const totalDiscount = doc.discount_amount + doc.promotion_amount;
                    const isWaived = doc.payment_status === 'waived';

                    return (
                      <tr key={doc.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        {/* Documento */}
                        <td className="px-3 py-1.5 font-mono text-slate-200 whitespace-nowrap text-[10px]">
                          {doc.doc_number}
                        </td>
                        {/* Fecha */}
                        <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">
                          {fmtDate(doc.period_start ?? doc.created_at)}
                        </td>
                        {/* Cliente */}
                        <td className="px-3 py-1.5 max-w-[140px]">
                          <span className="text-slate-200 truncate block">{clientLabel}</span>
                        </td>
                        {/* Tipo */}
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <RevenueBadge type={doc.revenue_type} />
                        </td>
                        {/* Concepto */}
                        <td className="px-3 py-1.5 max-w-[180px]">
                          <span className="text-slate-300 truncate block text-[10px]">{doc.concept}</span>
                        </td>
                        {/* Periodo */}
                        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap text-[10px]">
                          {dateRange(doc.period_start, doc.period_end)}
                        </td>
                        {/* Tarifa */}
                        <td className="px-3 py-1.5 font-mono text-slate-300 whitespace-nowrap">
                          {doc.rate_amount > 0 ? fmtEur(doc.rate_amount, 0) : '—'}
                        </td>
                        {/* Dcto */}
                        <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                          {showDiscount
                            ? <span className="text-violet-400">–{fmtEur(totalDiscount, 0)}</span>
                            : <span className="text-slate-600">—</span>
                          }
                        </td>
                        {/* Total */}
                        <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">
                          {isWaived
                            ? <span className="text-violet-300">0 €</span>
                            : <span className="text-white">{fmtEur(doc.total_amount, 0)}</span>
                          }
                        </td>
                        {/* Estado */}
                        <td className="px-3 py-1.5 whitespace-nowrap">
                          <EstadoBadge estado={doc.estado} />
                        </td>
                        {/* Acciones */}
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-1">
                            <button onClick={() => setSelectedDoc(doc)} title="Ver detalle"
                              className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center hover:bg-blue-900/30 hover:border-blue-700 cursor-pointer transition-colors">
                              <Eye className="h-3 w-3 text-slate-400" />
                            </button>
                            {doc.invoice_url && (
                              <a href={doc.invoice_url} target="_blank" rel="noopener noreferrer" title="Stripe"
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
                                <ExternalLink className="h-3 w-3 text-slate-400" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB ANÁLISIS ──────────────────────────────────────────────── */}
      {tab === 'analytics' && summary && (
        <div className="space-y-8">
          <RevenueByTypeSection summary={summary} />
          <AdSpaceSection summary={summary} />
          <SaasPlansSection summary={summary} />
        </div>
      )}

      {tab === 'analytics' && !summary && (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Cargando análisis…
        </div>
      )}

      {/* Modal detalle */}
      {selectedDoc && (
        <DocDetailModal doc={selectedDoc} onClose={() => setSelectedDoc(null)} />
      )}
    </div>
  );
}
