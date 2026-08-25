// MP-FIN-4 — Shared UI primitives for Provider Finance tabs
// All components defined at module level (no inner components).

import type { LucideIcon } from 'lucide-react'

// ── Date helpers ─────────────────────────────────────────────────────────────

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function fmtDateTime(s: string | null | undefined): string {
  if (!s) return '—'
  return new Date(s).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Currency ─────────────────────────────────────────────────────────────────

interface CurrencyAmountProps {
  amount: number | null | undefined
  currency?: string
  className?: string
}

export function CurrencyAmount({ amount, currency = 'EUR', className = '' }: CurrencyAmountProps) {
  const val = amount ?? 0
  const formatted = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(val))
  const sign = val < 0 ? '−' : ''
  return (
    <span className={`tabular-nums ${className}`}>
      {sign}{formatted} {currency}
    </span>
  )
}

// ── Simulation Banner ─────────────────────────────────────────────────────────

export function SimBanner() {
  return (
    <div className="flex items-center gap-2 bg-amber-950/20 border border-amber-800/40 rounded-lg px-3 py-2 text-[10px] text-amber-400">
      <span className="font-bold uppercase tracking-wider">Modo simulación</span>
      <span className="text-amber-600">·</span>
      <span className="text-amber-600">Los importes son datos de simulación interna, no transferencias reales.</span>
    </div>
  )
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  // Settlements
  draft:            'text-slate-400 bg-slate-800',
  calculated:       'text-blue-300 bg-blue-900/30',
  approved:         'text-emerald-300 bg-emerald-900/30',
  simulated_paid:   'text-teal-300 bg-teal-900/30',
  closed:           'text-slate-500 bg-slate-800',
  cancelled:        'text-red-400 bg-red-900/20',
  // Reserves
  active:           'text-blue-300 bg-blue-900/30',
  partially_released: 'text-amber-300 bg-amber-900/20',
  released:         'text-emerald-300 bg-emerald-900/30',
  expired:          'text-yellow-500 bg-yellow-900/20',
  // Disputes
  open:             'text-orange-300 bg-orange-900/20',
  under_review:     'text-amber-300 bg-amber-900/20',
  resolved:         'text-emerald-300 bg-emerald-900/30',
  // Ledger
  confirmed:        'text-emerald-400 bg-emerald-900/30',
  pending:          'text-amber-300 bg-amber-900/20',
  reversed:         'text-slate-400 bg-slate-800',
  failed:           'text-red-400 bg-red-900/20',
  // Orders
  confirmado:       'text-emerald-300 bg-emerald-900/30',
  pendiente:        'text-amber-300 bg-amber-900/20',
  enviado:          'text-blue-300 bg-blue-900/30',
  entregado:        'text-teal-300 bg-teal-900/30',
  cancelado:        'text-red-400 bg-red-900/20',
  // Refunds
  requested:        'text-amber-300 bg-amber-900/20',
  processing:       'text-blue-300 bg-blue-900/30',
  completed:        'text-emerald-300 bg-emerald-900/30',
  partial:          'text-yellow-300 bg-yellow-900/20',
  rejected:         'text-red-400 bg-red-900/20',
  // Payment
  paid:             'text-emerald-300 bg-emerald-900/30',
  unpaid:           'text-slate-400 bg-slate-800',
}

interface StatusBadgeProps { status: string; className?: string }

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? 'text-slate-400 bg-slate-800'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${colors} ${className}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Table primitives ──────────────────────────────────────────────────────────

interface ThProps { children: React.ReactNode; className?: string }
export function Th({ children, className = '' }: ThProps) {
  return (
    <th className={`px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
  )
}

interface TdProps { children: React.ReactNode; className?: string; mono?: boolean }
export function Td({ children, className = '', mono = false }: TdProps) {
  return (
    <td className={`px-3 py-2.5 text-xs ${mono ? 'font-mono' : ''} ${className}`}>
      {children}
    </td>
  )
}

interface LoadingRowProps { cols: number }
export function LoadingRow({ cols }: LoadingRowProps) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-slate-500 text-xs">Cargando…</td>
    </tr>
  )
}

interface EmptyStateProps { icon: LucideIcon; message: string }
export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-slate-600">
      <Icon className="h-8 w-8" />
      <span className="text-xs">{message}</span>
    </div>
  )
}

// ── Pagination ─────────────────────────────────────────────────────────────────

interface PaginationBarProps {
  total: number
  limit: number
  offset: number
  onPrev: () => void
  onNext: () => void
}

export function PaginationBar({ total, limit, offset, onPrev, onNext }: PaginationBarProps) {
  const page = Math.floor(offset / limit) + 1
  const pages = Math.ceil(total / limit)
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-700 text-xs text-slate-500">
      <span>Pág. {page} de {pages} · {total} total</span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={offset === 0}
          className="px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors">
          ‹ Ant.
        </button>
        <button onClick={onNext} disabled={offset + limit >= total}
          className="px-2.5 py-1 rounded border border-slate-700 hover:bg-slate-700 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors">
          Sig. ›
        </button>
      </div>
    </div>
  )
}

// ── Error box ────────────────────────────────────────────────────────────────

interface ErrorBoxProps { message: string }
export function ErrorBox({ message }: ErrorBoxProps) {
  return (
    <div className="bg-red-950/30 border border-red-800 rounded-lg px-3 py-2 text-xs text-red-400">{message}</div>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────

interface CardProps { children: React.ReactNode; className?: string }
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-slate-800/50 border border-slate-700 rounded-lg ${className}`}>
      {children}
    </div>
  )
}

// ── Detail modal shell ────────────────────────────────────────────────────────

interface ModalProps {
  title: React.ReactNode
  onClose: () => void
  children: React.ReactNode
}

export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div className="text-sm font-bold text-white">{title}</div>
          <button onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer transition-colors">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// ── KPI card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: React.ReactNode
  note?: string
  highlight?: 'green' | 'blue' | 'amber' | 'red' | 'none'
}

export function KpiCard({ label, value, note, highlight = 'none' }: KpiCardProps) {
  const valueColor = {
    green: 'text-emerald-400',
    blue:  'text-blue-300',
    amber: 'text-amber-300',
    red:   'text-red-400',
    none:  'text-slate-200',
  }[highlight]

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
      <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold tabular-nums leading-tight ${valueColor}`}>{value}</div>
      {note && <div className="text-[9px] text-slate-600 mt-0.5">{note}</div>}
    </div>
  )
}
