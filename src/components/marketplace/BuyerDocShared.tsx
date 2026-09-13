// Light-themed UI primitives for buyer document screens (Marketplace light UI).
// Parallel to src/components/portal/finance/shared.tsx (dark theme, provider portal).
// Do NOT use these in the provider finance portal — use shared.tsx there.
import type { LucideIcon } from 'lucide-react'

// ── Status badge ──────────────────────────────────────────────────────────────

const LIGHT_STATUS_COLORS: Record<string, string> = {
  draft:              'text-gray-500 bg-gray-100',
  calculated:         'text-blue-600 bg-blue-50',
  approved:           'text-emerald-600 bg-emerald-50',
  simulated_paid:     'text-teal-600 bg-teal-50',
  closed:             'text-gray-400 bg-gray-100',
  cancelled:          'text-red-600 bg-red-50',
  active:             'text-blue-600 bg-blue-50',
  partially_released: 'text-amber-600 bg-amber-50',
  released:           'text-emerald-600 bg-emerald-50',
  expired:            'text-yellow-600 bg-yellow-50',
  open:               'text-orange-600 bg-orange-50',
  under_review:       'text-amber-600 bg-amber-50',
  resolved:           'text-emerald-600 bg-emerald-50',
  confirmed:          'text-emerald-600 bg-emerald-50',
  pending:            'text-amber-600 bg-amber-50',
  reversed:           'text-gray-400 bg-gray-100',
  failed:             'text-red-600 bg-red-50',
  confirmado:         'text-emerald-600 bg-emerald-50',
  pendiente:          'text-amber-600 bg-amber-50',
  enviado:            'text-blue-600 bg-blue-50',
  entregado:          'text-teal-600 bg-teal-50',
  cancelado:          'text-red-600 bg-red-50',
  requested:          'text-amber-600 bg-amber-50',
  processing:         'text-blue-600 bg-blue-50',
  completed:          'text-emerald-600 bg-emerald-50',
  partial:            'text-yellow-600 bg-yellow-50',
  rejected:           'text-red-600 bg-red-50',
  paid:               'text-emerald-600 bg-emerald-50',
  unpaid:             'text-gray-400 bg-gray-100',
}

export function LightStatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const colors = LIGHT_STATUS_COLORS[status] ?? 'text-gray-500 bg-gray-100'
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider ${colors} ${className}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

// ── Table primitives ──────────────────────────────────────────────────────────

export function LightTh({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2.5 text-left text-[9px] font-semibold uppercase tracking-wider text-gray-400 ${className}`}>
      {children}
    </th>
  )
}

export function LightTd({ children, className = '', mono = false }: { children: React.ReactNode; className?: string; mono?: boolean }) {
  return (
    <td className={`px-3 py-2.5 text-xs ${mono ? 'font-mono' : ''} ${className}`}>
      {children}
    </td>
  )
}

export function LightLoadingRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-3 py-6 text-center text-gray-400 text-xs">Cargando…</td>
    </tr>
  )
}

export function LightEmptyState({ icon: Icon, message }: { icon: LucideIcon; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-gray-300">
      <Icon className="h-8 w-8" />
      <span className="text-xs text-gray-400">{message}</span>
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────────────────

export function LightPaginationBar({ total, limit, offset, onPrev, onNext }: {
  total: number; limit: number; offset: number; onPrev: () => void; onNext: () => void
}) {
  const page  = Math.floor(offset / limit) + 1
  const pages = Math.ceil(total / limit)
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
      <span>Pág. {page} de {pages} · {total} total</span>
      <div className="flex gap-2">
        <button onClick={onPrev} disabled={offset === 0}
          className="px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors">
          ‹ Ant.
        </button>
        <button onClick={onNext} disabled={offset + limit >= total}
          className="px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-default transition-colors">
          Sig. ›
        </button>
      </div>
    </div>
  )
}

// ── Error box ─────────────────────────────────────────────────────────────────

export function LightErrorBox({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">{message}</div>
  )
}
