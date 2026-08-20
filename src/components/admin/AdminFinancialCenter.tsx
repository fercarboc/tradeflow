/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import {
  adminGetFinancialDocuments,
  adminGetFinancialSummary,
  adminSendAdDocumentEmail,
  type TradeFinancialDocument,
  type FinancialSummary,
  type FinancialDocFilters,
} from '../../lib/supabase';
import { printAdDocument, downloadAdDocumentPdf } from '../../lib/printAdDocument';
import { exportToCsv as exportCsv } from '../../lib/exportCsv';
import { useToast } from '../ui/Toast';
import {
  CreditCard, Download, RefreshCw, Search, X, BarChart2,
  ExternalLink, Eye, FileText, Printer, Mail, MessageCircle,
  Send, TrendingUp, LineChart as LineChartIcon,
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

function tickFmt(v: number) {
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
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

const CHART_COLORS = {
  saas:       '#3b82f6',
  publicidad: '#8b5cf6',
  marketplace:'#10b981',
  otros:      '#64748b',
  bonificado: '#a78bfa',
  cobrado:    '#34d399',
  pendiente:  '#f59e0b',
  facturado:  '#60a5fa',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#64748b'];

type MonthlyData = {
  month: string; label: string;
  saas_cobrado: number; pub_cobrado: number; pub_comercial: number;
  marketplace: number; total_cobrado: number; facturado: number; pendiente: number;
};

function aggregateByMonth(docs: TradeFinancialDocument[]): MonthlyData[] {
  const map = new Map<string, MonthlyData>();
  for (const doc of docs) {
    const rawDate = doc.period_start ?? doc.created_at.slice(0, 10);
    const key = rawDate.slice(0, 7);
    if (!map.has(key)) {
      map.set(key, {
        month: key,
        label: new Date(key + '-15').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }),
        saas_cobrado: 0, pub_cobrado: 0, pub_comercial: 0,
        marketplace: 0, total_cobrado: 0, facturado: 0, pendiente: 0,
      });
    }
    const m = map.get(key)!;
    m.facturado += doc.commercial_value;
    if (doc.payment_status === 'paid') {
      m.total_cobrado += doc.total_amount;
      if (doc.revenue_type === 'subscription') m.saas_cobrado += doc.total_amount;
      else if (doc.revenue_type === 'advertising') m.pub_cobrado += doc.total_amount;
      else if (doc.revenue_type === 'marketplace') m.marketplace += doc.total_amount;
    } else if (doc.payment_status === 'unpaid') {
      m.pendiente += doc.total_amount;
    }
    if (doc.revenue_type === 'advertising') m.pub_comercial += doc.commercial_value;
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, d]) => d);
}

// ── Sub-componentes de UI básicos (fuera del padre) ────────────────────────

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

function DocDetailModal({
  doc, onClose, onOpenEmail,
}: {
  doc: TradeFinancialDocument;
  onClose: () => void;
  onOpenEmail: (doc: TradeFinancialDocument) => void;
}) {
  const isWaived  = doc.payment_status === 'waived';
  const isAdv     = doc.revenue_type === 'advertising';
  const isSub     = doc.revenue_type === 'subscription';
  const metadata      = doc.metadata ?? {};
  const metaPlan      = typeof metadata.plan === 'string' ? metadata.plan : '';
  const metaCycle     = typeof metadata.billing_cycle === 'string' ? metadata.billing_cycle : '';
  const metaMode      = typeof metadata.pricing_mode === 'string' ? metadata.pricing_mode : '';
  const metaDays      = metadata.estimated_days != null ? String(metadata.estimated_days) : '';

  const phone   = doc.actor_telefono?.replace(/[^+\d]/g, '') ?? '';
  const docUrl  = doc.public_token ? `https://trabflow.com/doc/${doc.public_token}` : '';
  const slotNm  = doc.slot_nombre ?? (typeof metadata.slot_nombre === 'string' ? metadata.slot_nombre : '');

  const waText  = [
    `Hola ${doc.customer_name}, te envío el resumen de tu reserva publicitaria en TrabFlow Marketplace.`,
    ``,
    `Documento: ${doc.doc_number}`,
    slotNm   ? `Espacio: ${slotNm}` : '',
    doc.period_start ? `Periodo: ${dateRange(doc.period_start, doc.period_end)}` : '',
    docUrl   ? `\n${docUrl}` : '',
  ].filter(l => l !== '').join('\n');

  const waUrl = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(waText)}` : '';

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
          {/* Datos del cliente/proveedor */}
          <section>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">
              {isAdv ? 'Proveedor' : 'Cliente'}
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span className="text-slate-500">Empresa: </span>
                <span className="text-slate-200">{doc.customer_name || doc.org_nombre || doc.actor_nombre || '—'}</span>
              </div>
              {(doc.actor_tax_id || doc.customer_nif) && (
                <div>
                  <span className="text-slate-500">NIF/CIF: </span>
                  <span className="text-slate-200 font-mono">{doc.actor_tax_id || doc.customer_nif}</span>
                </div>
              )}
              {doc.customer_email && (
                <div>
                  <span className="text-slate-500">Email: </span>
                  <span className="text-slate-200">{doc.customer_email}</span>
                </div>
              )}
              {doc.actor_telefono && (
                <div>
                  <span className="text-slate-500">Teléfono: </span>
                  <span className="text-slate-200">{doc.actor_telefono}</span>
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
              {isAdv && slotNm && (
                <div>
                  <span className="text-slate-500">Espacio: </span>
                  <span className="text-slate-200">{slotNm}</span>
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
              {doc.sent_at && (
                <div>
                  <span className="text-slate-500">Enviado: </span>
                  <span className="text-slate-200">{fmtDate(doc.sent_at)}{doc.sent_to ? ` → ${doc.sent_to}` : ''}</span>
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
            {/* SaaS: Stripe */}
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
            {/* Publicidad: PDF / email / WA */}
            {isAdv && (
              <>
                <button onClick={() => printAdDocument(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-violet-600 hover:text-violet-300 transition-colors cursor-pointer">
                  <Printer className="h-3.5 w-3.5" /> Ver / Imprimir
                </button>
                <button onClick={() => downloadAdDocumentPdf(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-violet-600 hover:text-violet-300 transition-colors cursor-pointer">
                  <Download className="h-3.5 w-3.5" /> Descargar PDF
                </button>
                <button onClick={() => onOpenEmail(doc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-blue-600 hover:text-blue-300 transition-colors cursor-pointer">
                  <Mail className="h-3.5 w-3.5" /> Enviar email
                </button>
                {waUrl && (
                  <a href={waUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-emerald-600 hover:text-emerald-300 transition-colors cursor-pointer">
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                )}
              </>
            )}
            <button onClick={() => { navigator.clipboard.writeText(doc.doc_number); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors cursor-pointer">
              <FileText className="h-3.5 w-3.5" /> Copiar nº
            </button>
            {docUrl && isAdv && (
              <a href={docUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-slate-600 text-slate-300 hover:border-slate-400 hover:text-white transition-colors cursor-pointer">
                <ExternalLink className="h-3.5 w-3.5" /> Enlace público
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Modal de email ─────────────────────────────────────────────────────────

function EmailModal({
  doc, onClose,
}: {
  doc: TradeFinancialDocument;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const meta = doc.metadata ?? {};
  const slotNm = doc.slot_nombre ?? (typeof meta.slot_nombre === 'string' ? meta.slot_nombre : '');
  const defaultTo = doc.customer_email ?? '';
  const defaultMsg = [
    `Hola ${doc.customer_name},`,
    ``,
    `Te adjuntamos el resumen correspondiente a tu reserva publicitaria en TrabFlow Marketplace.`,
    ``,
    `Documento: ${doc.doc_number}`,
    slotNm ? `Espacio: ${slotNm}` : '',
    doc.period_start ? `Periodo: ${dateRange(doc.period_start, doc.period_end)}` : '',
    ``,
    `Un saludo,`,
    `TrabFlow`,
  ].filter(l => l !== undefined && !(l === '' && false)).join('\n');

  const [toEmail,  setToEmail]  = useState(defaultTo);
  const [message,  setMessage]  = useState(defaultMsg);
  const [sending,  setSending]  = useState(false);

  const handleSend = async () => {
    if (!toEmail.trim()) { toast('error', 'Introduce el email de destino'); return; }
    setSending(true);
    try {
      await adminSendAdDocumentEmail(doc, toEmail.trim(), message.trim());
      toast('success', `Email enviado a ${toEmail}`);
      onClose();
    } catch (e) {
      toast('error', 'Error al enviar email: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-bold text-white">Enviar por email</span>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Para</label>
            <input
              type="email"
              value={toEmail}
              onChange={e => setToEmail(e.target.value)}
              placeholder="email@proveedor.com"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Asunto — <span className="text-slate-500 normal-case font-normal">Documento de publicidad TrabFlow — {doc.doc_number}</span>
            </label>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">Mensaje</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-y font-mono text-xs leading-relaxed"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Se adjuntará automáticamente el resumen del documento {doc.doc_number} con enlace de acceso seguro.
          </p>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={sending}
            className="px-4 py-2 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors disabled:opacity-50">
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Enviando…' : 'Enviar email'}
          </button>
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
          <div className="col-span-4 text-sm text-slate-500 py-4 text-center">Sin datos</div>
        )}
      </div>
      <p className="text-[10px] text-slate-600">Total cobrado real: {fmtEur(total, 0)}</p>
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
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Sin espacios</td></tr>
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
  basico:       { monthly: 29, yearly: 23 },
  pro:          { monthly: 49, yearly: 39 },
  empresa:      { monthly: 89, yearly: 71 },
  empresa_plus: { monthly: 149, yearly: 119 },
  profesional:  { monthly: 69, yearly: 55 },
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
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Tooltip común para gráficos ──────────────────────────────────────────

const TOOLTIP_STYLE = { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 };
const TOOLTIP_LABEL_STYLE = { color: '#f1f5f9', fontWeight: 700 as const };

// ── Gráficos: wrapper ─────────────────────────────────────────────────────

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <div className="text-xs font-bold text-slate-300 mb-3">{title}</div>
      {children}
    </div>
  );
}

// ── Gráfico 1: Evolución de ingresos por mes ─────────────────────────────

function IngresoEvolutionChart({ chartDocs }: { chartDocs: TradeFinancialDocument[] }) {
  const data = aggregateByMonth(chartDocs);
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin datos para el periodo</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={((value: number, name: string) => [fmtEur(value, 2), name]) as never}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
        <Bar dataKey="saas_cobrado" name="SaaS cobrado" fill={CHART_COLORS.saas} radius={[2, 2, 0, 0]} />
        <Bar dataKey="pub_cobrado"  name="Publicidad cobrado" fill={CHART_COLORS.publicidad} radius={[2, 2, 0, 0]} />
        <Bar dataKey="marketplace"  name="Marketplace" fill={CHART_COLORS.marketplace} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico 2: Facturado vs cobrado por mes ───────────────────────────────

function FacturadoCobradoChart({ chartDocs }: { chartDocs: TradeFinancialDocument[] }) {
  const data = aggregateByMonth(chartDocs);
  if (data.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin datos para el periodo</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE}
          formatter={((value: number, name: string) => [fmtEur(value, 2), name]) as never}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
        <Bar dataKey="facturado"     name="Valor comercial" fill={CHART_COLORS.facturado} radius={[2, 2, 0, 0]} />
        <Bar dataKey="total_cobrado" name="Cobrado real"    fill={CHART_COLORS.cobrado}   radius={[2, 2, 0, 0]} />
        <Bar dataKey="pendiente"     name="Pendiente"       fill={CHART_COLORS.pendiente}  radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico 3: Publicidad valor comercial vs cobrado ─────────────────────

function CommercialVsCobradoChart({ summary }: { summary: FinancialSummary }) {
  const advRow = summary.por_tipo?.find(r => r.revenue_type === 'advertising');
  if (!advRow) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin datos de publicidad</div>;
  }
  const data = [
    { name: 'Valor comercial', valor: advRow.valor_comercial },
    { name: 'Bonificado',      valor: advRow.bonificado },
    { name: 'Cobrado',         valor: advRow.cobrado },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={tickFmt} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={42} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
          labelStyle={{ color: '#f1f5f9', fontWeight: 700 }}
          formatter={((value: number) => [fmtEur(value, 2), 'Importe']) as never}
        />
        <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
          <Cell fill={CHART_COLORS.publicidad} />
          <Cell fill={CHART_COLORS.bonificado}  />
          <Cell fill={CHART_COLORS.cobrado}     />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico 4: Origen de ingresos (donut) ────────────────────────────────

function OrigenIngresosChart({ summary }: { summary: FinancialSummary }) {
  const rows = (summary.por_tipo ?? []).filter(r => r.cobrado > 0);
  if (rows.length === 0) {
    const withBonif = (summary.por_tipo ?? []).filter(r => r.bonificado > 0);
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2">
        <p className="text-slate-500 text-xs text-center">0 € cobrados reales</p>
        {withBonif.map(r => (
          <div key={r.revenue_type} className="flex items-center gap-2">
            <RevenueBadge type={r.revenue_type} />
            <span className="text-xs text-violet-400">{fmtEur(r.bonificado, 0)} bonificado</span>
          </div>
        ))}
      </div>
    );
  }
  const data = rows.map(r => ({ name: REVENUE_LABELS[r.revenue_type] ?? r.revenue_type, value: r.cobrado }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
          formatter={((value: number) => [fmtEur(value, 2), 'Cobrado']) as never}
        />
        <Legend wrapperStyle={{ fontSize: 10, color: '#94a3b8' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico 5: Publicidad por espacio ─────────────────────────────────────

const AD_METRIC_LABELS: Record<string, string> = {
  valor_comercial_total: 'Valor comercial',
  dias_reservados:       'Días reservados',
  total_reservas:        'Reservas totales',
};

function AdSpaceBarChart({ summary }: { summary: FinancialSummary }) {
  const [metric, setMetric] = useState<'valor_comercial_total' | 'dias_reservados' | 'total_reservas'>('valor_comercial_total');
  const slots = summary.ad_espacios ?? [];
  if (slots.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin espacios publicitarios</div>;
  }
  const data = slots.map(s => ({
    name: s.slot_nombre.length > 18 ? s.slot_nombre.slice(0, 16) + '…' : s.slot_nombre,
    valor: s[metric] ?? 0,
  }));
  const isEur = metric === 'valor_comercial_total';

  return (
    <div>
      <div className="flex justify-end mb-2">
        <select value={metric} onChange={e => setMetric(e.target.value as typeof metric)}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1 cursor-pointer focus:outline-none">
          {Object.entries(AD_METRIC_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" tickFormatter={isEur ? tickFmt : (v: number) => String(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={((value: number) => [isEur ? fmtEur(value, 0) : value, AD_METRIC_LABELS[metric]]) as never}
          />
          <Bar dataKey="valor" fill={CHART_COLORS.bonificado} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Gráfico 6: Ocupación publicitaria ────────────────────────────────────

function OcupacionChart({ summary }: { summary: FinancialSummary }) {
  const slots = summary.ad_espacios ?? [];
  if (slots.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin datos</div>;
  }
  const maxDias = Math.max(...slots.map(s => s.dias_reservados), 1);
  const data = slots.map(s => ({
    name: s.slot_nombre.length > 18 ? s.slot_nombre.slice(0, 16) + '…' : s.slot_nombre,
    ocupacion: Math.round((s.dias_reservados / maxDias) * 100),
    dias: s.dias_reservados,
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" width={100} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
          formatter={((value: number, _name: string, props: { payload?: { dias?: number } }) => [
            `${value}% relativo (${props.payload?.dias ?? 0} días)`,
            'Actividad',
          ]) as never}
        />
        <Bar dataKey="ocupacion" fill={CHART_COLORS.publicidad} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Gráfico 7: MRR por plan ───────────────────────────────────────────────

function SaasPlansChart({ summary }: { summary: FinancialSummary }) {
  const [metric, setMetric] = useState<'mrr' | 'clientes'>('mrr');
  const rows = summary.saas_planes ?? [];
  if (rows.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-500 text-xs">Sin datos</div>;
  }
  const grouped = rows.reduce<Record<string, { mrr: number; clientes: number }>>((acc, r) => {
    if (!acc[r.plan]) acc[r.plan] = { mrr: 0, clientes: 0 };
    const prices = PLAN_PRICES_MAP[r.plan] ?? { monthly: 0, yearly: 0 };
    const planMrr = r.billing_cycle === 'monthly' ? r.activos * prices.monthly : r.activos * prices.yearly;
    acc[r.plan].mrr     += planMrr;
    acc[r.plan].clientes += r.activos;
    return acc;
  }, {});

  const order = ['basico','pro','profesional','empresa','empresa_plus'];
  const data = Object.entries(grouped)
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([plan, d]) => ({ name: plan.replace('_', ' '), valor: d[metric] }));

  return (
    <div>
      <div className="flex justify-end mb-2">
        <select value={metric} onChange={e => setMetric(e.target.value as 'mrr' | 'clientes')}
          className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] rounded px-2 py-1 cursor-pointer focus:outline-none">
          <option value="mrr">MRR</option>
          <option value="clientes">Clientes activos</option>
        </select>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={metric === 'mrr' ? tickFmt : (v: number) => String(v)} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 11 }}
            formatter={((value: number) => [metric === 'mrr' ? fmtEur(value, 0) + '/mes' : `${value} clientes`, metric === 'mrr' ? 'MRR' : 'Clientes']) as never}
          />
          <Bar dataKey="valor" fill={CHART_COLORS.saas} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── KPIs mini de Gráficos ─────────────────────────────────────────────────

function ChartsKpiCards({ chartDocs }: { chartDocs: TradeFinancialDocument[] }) {
  const cobrado    = chartDocs.filter(d => d.payment_status === 'paid').reduce((s, d) => s + d.total_amount, 0);
  const comercial  = chartDocs.reduce((s, d) => s + d.commercial_value, 0);
  const bonificado = chartDocs.filter(d => d.payment_status === 'waived').reduce((s, d) => s + d.commercial_value, 0);
  const pagadores  = new Set([
    ...chartDocs.filter(d => d.org_id).map(d => d.org_id!),
    ...chartDocs.filter(d => d.actor_id).map(d => d.actor_id!),
  ]).size;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
      <KpiCard label="Ingresos cobrados" value={fmtEur(cobrado, 0)} color="text-emerald-400" />
      <KpiCard label="Valor comercial"   value={fmtEur(comercial, 0)} color="text-blue-300" />
      <KpiCard label="Bonificado"        value={fmtEur(bonificado, 0)} color="text-violet-300" />
      <KpiCard label="Clientes/anunciantes" value={String(pagadores)} color="text-slate-200" />
    </div>
  );
}

// ── Tab de Gráficos ───────────────────────────────────────────────────────

const CHART_PERIOD_OPTIONS = [
  ['this_month',  'Este mes'],
  ['last_month',  'Mes anterior'],
  ['last_3m',     'Últimos 3 meses'],
  ['last_6m',     'Últimos 6 meses'],
  ['this_year',   'Año actual'],
  ['last_year',   'Año anterior'],
  ['all',         'Todo'],
] as const;

function ChartsTab({ summary }: { summary: FinancialSummary | null }) {
  const { toast } = useToast();
  const [chartPeriod,      setChartPeriod]      = useState('this_year');
  const [chartRevenueType, setChartRevenueType] = useState('');
  const [chartDocs,        setChartDocs]        = useState<TradeFinancialDocument[]>([]);
  const [chartLoading,     setChartLoading]     = useState(true);

  const loadChartDocs = useCallback(async (period: string, revenueType: string) => {
    setChartLoading(true);
    try {
      const { from, to } = buildDateRange(period);
      const data = await adminGetFinancialDocuments({
        date_from:    from,
        date_to:      to,
        revenue_type: revenueType || undefined,
      });
      setChartDocs(data);
    } catch (e) {
      toast('error', 'Error al cargar datos de gráficos');
    } finally {
      setChartLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadChartDocs(chartPeriod, chartRevenueType);
  }, [chartPeriod, chartRevenueType, loadChartDocs]);

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500";

  const showAdv  = !chartRevenueType || chartRevenueType === 'advertising';
  const showSaas = !chartRevenueType || chartRevenueType === 'subscription';

  return (
    <div className="space-y-5">
      {/* Filtros de gráficos */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={chartPeriod} onChange={e => setChartPeriod(e.target.value)} className={selectCls}>
          {CHART_PERIOD_OPTIONS.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
        </select>
        <select value={chartRevenueType} onChange={e => setChartRevenueType(e.target.value)} className={selectCls}>
          <option value="">Todas las líneas</option>
          <option value="subscription">SaaS</option>
          <option value="advertising">Publicidad</option>
          <option value="marketplace">Marketplace</option>
          <option value="other">Otros</option>
        </select>
        <button onClick={() => loadChartDocs(chartPeriod, chartRevenueType)}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${chartLoading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-[10px] text-slate-500 ml-1">{chartDocs.length} docs · {CHART_PERIOD_OPTIONS.find(([v]) => v === chartPeriod)?.[1]}</span>
      </div>

      {/* KPIs mini */}
      <ChartsKpiCards chartDocs={chartDocs} />

      {chartLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Cargando gráficos…
        </div>
      ) : (
        <div className="space-y-4">
          {/* Fila 1: evolución + facturado/cobrado */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Evolución de ingresos cobrados por mes">
              <IngresoEvolutionChart chartDocs={chartDocs} />
            </ChartCard>
            <ChartCard title="Facturación y cobros por mes">
              <FacturadoCobradoChart chartDocs={chartDocs} />
            </ChartCard>
          </div>

          {/* Fila 2: origen + publicidad comercial */}
          {summary && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Origen de ingresos">
                <OrigenIngresosChart summary={summary} />
              </ChartCard>
              {showAdv && (
                <ChartCard title="Publicidad: valor comercial vs cobrado">
                  <CommercialVsCobradoChart summary={summary} />
                </ChartCard>
              )}
            </div>
          )}

          {/* Fila 3: por espacio + ocupación */}
          {summary && showAdv && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="Valor publicitario por espacio">
                <AdSpaceBarChart summary={summary} />
              </ChartCard>
              <ChartCard title="Actividad relativa por espacio (días reservados)">
                <OcupacionChart summary={summary} />
              </ChartCard>
            </div>
          )}

          {/* Fila 4: SaaS por plan */}
          {summary && showSaas && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard title="MRR por plan">
                <SaasPlansChart summary={summary} />
              </ChartCard>
              <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 flex items-center justify-center">
                <div className="text-center text-slate-500 text-xs">
                  <TrendingUp className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                  <p>Más gráficos disponibles próximamente</p>
                  <p className="text-slate-600 mt-1">Churn, LTV, forecasting…</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
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

type ActiveTab = 'docs' | 'analytics' | 'charts';

export default function AdminFinancialCenter() {
  const { toast } = useToast();

  const [docs,    setDocs]    = useState<TradeFinancialDocument[]>([]);
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<ActiveTab>('docs');

  const [selectedDoc, setSelectedDoc] = useState<TradeFinancialDocument | null>(null);
  const [emailDoc,    setEmailDoc]    = useState<TradeFinancialDocument | null>(null);

  const [revenueType,   setRevenueType]   = useState('');
  const [payerType,     setPayerType]     = useState('');
  const [estadoFilter,  setEstadoFilter]  = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [periodFilter,  setPeriodFilter]  = useState('all');
  const [searchText,    setSearchText]    = useState('');
  const [planFilter,    setPlanFilter]    = useState('');
  const [cycleFilter,   setCycleFilter]   = useState('');
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
      if (s.ad_espacios) {
        setSlots(s.ad_espacios.map(e => ({ id: e.slot_id, nombre: e.slot_nombre })));
      }
    } catch { /* summary es cosmético */ }
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
      'Token público': d.public_token ?? '',
    }));
    exportCsv(rows, `tradeflow_financiero_${new Date().toISOString().slice(0, 10)}`);
  };

  const kpis = summary?.kpis;

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500 transition-colors";

  const TABS: [ActiveTab, string, React.ElementType][] = [
    ['docs',      'Documentos', FileText],
    ['analytics', 'Análisis',   BarChart2],
    ['charts',    'Gráficos',   LineChartIcon],
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-white">Facturación</h2>
        <p className="text-xs text-slate-400 mt-0.5">Control de ingresos, facturas y líneas de negocio de TrabFlow.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 border border-slate-700 rounded-lg p-1 w-fit">
        {TABS.map(([id, label, Icon]) => (
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
        <KpiCard label="Facturado este mes" value={kpis ? fmtEur(kpis.facturado_mes, 0) : '—'} color="text-blue-300" />
        <KpiCard label="Cobrado este mes"   value={kpis ? fmtEur(kpis.cobrado_mes, 0) : '—'}   color="text-emerald-400" />
        <KpiCard label="Pendiente cobro"    value={kpis ? fmtEur(kpis.pendiente, 0) : '—'}
          color={kpis && kpis.pendiente > 0 ? 'text-yellow-400' : 'text-slate-500'} />
        <KpiCard label="Total YTD cobrado"  value={kpis ? fmtEur(kpis.ytd_cobrado, 0) : '—'}   color="text-purple-300" />
        <KpiCard label="Docs emitidos"      value={kpis ? String(kpis.total_docs) : '—'}         color="text-slate-200" />
        <KpiCard label="Ticket medio"       value={kpis ? fmtEur(kpis.ticket_medio, 0) : '—'}
          sub={kpis && kpis.valor_comercial_bonificado > 0 ? `+${fmtEur(kpis.valor_comercial_bonificado, 0)} bonificado` : undefined}
          color="text-slate-200" />
      </div>

      {/* ── TAB DOCUMENTOS ────────────────────────────────────────────── */}
      {tab === 'docs' && (
        <div className="space-y-4">
          {/* Filtro tipo rápido */}
          <div className="flex flex-wrap gap-1.5">
            {[['', 'Todos'], ['subscription', 'SaaS'], ['advertising', 'Publicidad'], ['marketplace', 'Marketplace'], ['other', 'Otros']].map(([val, label]) => (
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
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500 pointer-events-none" />
              <input type="text" placeholder="Buscar número, empresa, email…" value={searchText} onChange={e => setSearchText(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded pl-8 pr-3 py-1.5 w-52 focus:outline-none focus:border-blue-500 placeholder-slate-600" />
            </div>
            <select value={payerType} onChange={e => setPayerType(e.target.value)} className={selectCls}>
              <option value="">Tipo cliente</option>
              <option value="installer">Instalador</option>
              <option value="installer_company">Empresa instaladora</option>
              <option value="provider">Proveedor</option>
            </select>
            <select value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)} className={selectCls}>
              <option value="">Estado</option>
              {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className={selectCls}>
              <option value="all">Todo el tiempo</option>
              <option value="this_month">Este mes</option>
              <option value="last_month">Mes anterior</option>
              <option value="last_3m">Últimos 3 meses</option>
              <option value="last_6m">Últimos 6 meses</option>
              <option value="this_year">Este año</option>
              <option value="last_year">Año anterior</option>
            </select>
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
            {revenueType === 'advertising' && slots.length > 0 && (
              <select value={slotFilter} onChange={e => setSlotFilter(e.target.value)} className={selectCls}>
                <option value="">Todos los espacios</option>
                {slots.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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
                    const isAdv = doc.revenue_type === 'advertising';

                    return (
                      <tr key={doc.id} className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors">
                        <td className="px-3 py-1.5 font-mono text-slate-200 whitespace-nowrap text-[10px]">{doc.doc_number}</td>
                        <td className="px-3 py-1.5 text-slate-400 whitespace-nowrap">{fmtDate(doc.period_start ?? doc.created_at)}</td>
                        <td className="px-3 py-1.5 max-w-[140px]">
                          <span className="text-slate-200 truncate block">{clientLabel}</span>
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><RevenueBadge type={doc.revenue_type} /></td>
                        <td className="px-3 py-1.5 max-w-[180px]">
                          <span className="text-slate-300 truncate block text-[10px]">{doc.concept}</span>
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap text-[10px]">{dateRange(doc.period_start, doc.period_end)}</td>
                        <td className="px-3 py-1.5 font-mono text-slate-300 whitespace-nowrap">
                          {doc.rate_amount > 0 ? fmtEur(doc.rate_amount, 0) : '—'}
                        </td>
                        <td className="px-3 py-1.5 font-mono whitespace-nowrap">
                          {showDiscount
                            ? <span className="text-violet-400">–{fmtEur(totalDiscount, 0)}</span>
                            : <span className="text-slate-600">—</span>
                          }
                        </td>
                        <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">
                          {isWaived
                            ? <span className="text-violet-300">0 €</span>
                            : <span className="text-white">{fmtEur(doc.total_amount, 0)}</span>
                          }
                        </td>
                        <td className="px-3 py-1.5 whitespace-nowrap"><EstadoBadge estado={doc.estado} /></td>
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
                            {isAdv && (
                              <button onClick={() => printAdDocument(doc)} title="Generar PDF"
                                className="h-6 w-6 rounded border border-slate-700 flex items-center justify-center hover:bg-purple-900/30 hover:border-purple-700 cursor-pointer transition-colors">
                                <Printer className="h-3 w-3 text-slate-400" />
                              </button>
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

      {/* ── TAB GRÁFICOS ──────────────────────────────────────────────── */}
      {tab === 'charts' && (
        <ChartsTab summary={summary} />
      )}

      {/* Modal detalle */}
      {selectedDoc && (
        <DocDetailModal
          doc={selectedDoc}
          onClose={() => setSelectedDoc(null)}
          onOpenEmail={doc => { setSelectedDoc(null); setEmailDoc(doc); }}
        />
      )}

      {/* Modal email */}
      {emailDoc && (
        <EmailModal doc={emailDoc} onClose={() => setEmailDoc(null)} />
      )}
    </div>
  );
}
