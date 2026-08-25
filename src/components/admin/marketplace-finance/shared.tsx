// MP-FIN-3 — Shared UI components for Admin Marketplace Finance
// NO inner components: each is defined at module level and exported.

import { AlertTriangle, X } from 'lucide-react'
import { useState } from 'react'

// ── Formatters ─────────────────────────────────────────────────────────────

export function fmtCurrency(amount: number, currency = 'EUR', decimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount) + ' ' + currency
}

export function fmtDate(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(d?: string | null): string {
  if (!d) return '—'
  return new Date(d).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function fmtShortId(id: string): string {
  return id.slice(0, 8) + '…'
}

// ── SimulationBanner ───────────────────────────────────────────────────────

export function SimulationBanner() {
  return (
    <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/60 rounded-lg px-4 py-2.5">
      <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">MODO SIMULACIÓN</span>
        <span className="text-xs text-amber-500 ml-2">No se está moviendo dinero real. Todos los datos son internos de prueba.</span>
      </div>
    </div>
  )
}

// ── SimulationBadge ────────────────────────────────────────────────────────

export function SimulationBadge() {
  return (
    <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-amber-950/40 text-amber-400 border-amber-800">
      SIMULACIÓN
    </span>
  )
}

// ── CurrencyAmount ─────────────────────────────────────────────────────────

export function CurrencyAmount({
  amount,
  currency = 'EUR',
  decimals = 2,
  className = '',
  showSign = false,
}: {
  amount: number
  currency?: string
  decimals?: number
  className?: string
  showSign?: boolean
}) {
  const isNeg = amount < 0
  const base = className || (isNeg ? 'text-red-400' : 'text-slate-200')
  const sign = showSign && amount > 0 ? '+' : ''
  return (
    <span className={`font-mono tabular-nums ${base}`}>
      {sign}{fmtCurrency(amount, currency, decimals)}
    </span>
  )
}

// ── KpiCard ────────────────────────────────────────────────────────────────

export function KpiCard({
  label,
  value,
  sub,
  color,
  warning,
}: {
  label: string
  value: string
  sub?: string
  color?: string
  warning?: boolean
}) {
  return (
    <div className={`bg-slate-800/50 border rounded-lg p-3 ${warning ? 'border-amber-800/60' : 'border-slate-700'}`}>
      <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-1 leading-tight">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${color ?? 'text-white'}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── FinancialStatusBadge ───────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  // Settlement states
  draft:          'bg-slate-700 text-slate-400 border-slate-600',
  calculated:     'bg-blue-900/40 text-blue-300 border-blue-800',
  approved:       'bg-violet-900/40 text-violet-300 border-violet-800',
  payable:        'bg-cyan-900/40 text-cyan-300 border-cyan-800',
  simulated_paid: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  closed:         'bg-slate-700 text-slate-400 border-slate-600',
  adjusted:       'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  cancelled:      'bg-red-900/40 text-red-400 border-red-800',
  // Reserve states
  active:            'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  partially_released:'bg-blue-900/40 text-blue-300 border-blue-800',
  released:          'bg-slate-700 text-slate-400 border-slate-600',
  expired:           'bg-orange-900/40 text-orange-300 border-orange-800',
  // Dispute states
  opened:            'bg-red-900/40 text-red-400 border-red-800',
  needs_response:    'bg-orange-900/40 text-orange-300 border-orange-800',
  evidence_submitted:'bg-blue-900/40 text-blue-300 border-blue-800',
  under_review:      'bg-violet-900/40 text-violet-300 border-violet-800',
  won:               'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  lost:              'bg-red-900/40 text-red-400 border-red-800',
  accepted:          'bg-amber-900/40 text-amber-300 border-amber-800',
  // Refund states
  requested:  'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  processing: 'bg-blue-900/40 text-blue-300 border-blue-800',
  processed:  'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  rejected:   'bg-red-900/40 text-red-400 border-red-800',
  failed:     'bg-red-900/40 text-red-400 border-red-800',
  // Recovery states
  pending:   'bg-yellow-900/40 text-yellow-300 border-yellow-800',
  partial:   'bg-blue-900/40 text-blue-300 border-blue-800',
  completed: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  // Generic
  paid:       'bg-emerald-900/40 text-emerald-300 border-emerald-800',
  created:    'bg-slate-700 text-slate-400 border-slate-600',
  fulfilled:  'bg-emerald-900/40 text-emerald-300 border-emerald-800',
}

export function FinancialStatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? 'bg-slate-700 text-slate-400 border-slate-600'
  return (
    <span className={`inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${cls}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── GateBadge ──────────────────────────────────────────────────────────────

export function GateBadge({ gate, open }: { gate: string; open: boolean }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${open ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      <span className="text-xs font-mono text-slate-300">{gate}</span>
      <span className={`text-[10px] font-semibold ${open ? 'text-emerald-400' : 'text-amber-400'}`}>
        {open ? 'ABIERTO' : '⏳ PENDIENTE'}
      </span>
    </div>
  )
}

// ── ReconciliationBadge ────────────────────────────────────────────────────

export function ReconciliationBadge({ status }: { status: 'MATCH' | 'MISMATCH' | 'unknown' }) {
  if (status === 'MATCH') {
    return <span className="text-[10px] font-bold text-emerald-400">✓ Reconciliado</span>
  }
  if (status === 'MISMATCH') {
    return <span className="text-[10px] font-bold text-red-400">⚠ Diferencia detectada</span>
  }
  return <span className="text-[10px] text-slate-500">—</span>
}

// ── ConfirmModal ───────────────────────────────────────────────────────────

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  danger,
}: {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
  danger?: boolean
}) {
  const [busy, setBusy] = useState(false)

  const handle = async () => {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <span className="text-sm font-bold text-white">{title}</span>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-300 mb-2">{message}</p>
          <p className="text-xs text-amber-400">
            Esta acción es una simulación y modificará el ledger interno de pruebas.
          </p>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="px-4 py-2 rounded text-xs font-semibold border border-slate-700 text-slate-400 hover:text-white cursor-pointer transition-colors">
            Cancelar
          </button>
          <button onClick={handle} disabled={busy}
            className={`px-4 py-2 rounded text-xs font-semibold cursor-pointer transition-colors disabled:opacity-50 ${
              danger ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}>
            {busy ? 'Ejecutando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── EmptyState ─────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, message }: { icon?: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
      {Icon && <Icon className="h-8 w-8 mb-2 text-slate-700" />}
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── LoadingRow ─────────────────────────────────────────────────────────────

export function LoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-slate-500 text-sm">
        Cargando…
      </td>
    </tr>
  )
}

// ── PaginationBar ──────────────────────────────────────────────────────────

export function PaginationBar({
  total,
  limit,
  offset,
  onPrev,
  onNext,
}: {
  total: number
  limit: number
  offset: number
  onPrev: () => void
  onNext: () => void
}) {
  const from = offset + 1
  const to = Math.min(offset + limit, total)
  const canPrev = offset > 0
  const canNext = to < total

  return (
    <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700 text-xs text-slate-400">
      <span>{from}–{to} de {total}</span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={!canPrev}
          className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-colors">
          ‹ Anterior
        </button>
        <button onClick={onNext} disabled={!canNext}
          className="px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-30 cursor-pointer transition-colors">
          Siguiente ›
        </button>
      </div>
    </div>
  )
}

// ── TableHeader ────────────────────────────────────────────────────────────

export function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
      {children}
    </th>
  )
}

export function Td({ children, mono, className }: { children: React.ReactNode; mono?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-1.5 text-xs ${mono ? 'font-mono' : ''} ${className ?? ''}`}>
      {children}
    </td>
  )
}
