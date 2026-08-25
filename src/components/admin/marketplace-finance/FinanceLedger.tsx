// MP-FIN-3 — Finance Ledger Tab
// Ledger global inmutable con filtros y paginación.
// INV-009: Solo lectura. NO existe botón Editar.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, X, Search, Lock } from 'lucide-react'
import { getAdminLedger, getAdminProvidersList, type AdminLedgerRow } from '../../../lib/marketplace/finance/admin-finance.service'
import {
  SimulationBanner, CurrencyAmount, FinancialStatusBadge,
  fmtDateTime, fmtShortId, PaginationBar, Th, Td, LoadingRow, EmptyState,
} from './shared'

const LIMIT = 50

const ENTRY_TYPES = [
  'GOODS_ENTITLEMENT',
  'SHIPPING_ENTITLEMENT',
  'GOODS_REFUND_REVERSAL',
  'SHIPPING_REFUND_REVERSAL',
  'CHARGEBACK_DEBIT',
  'CHARGEBACK_FEE',
  'CHARGEBACK_CREDIT',
  'COMMISSION_SIM_ACCRUAL',
  'PENDING_TO_AVAILABLE',
  'RESERVE_HOLD',
  'RESERVE_RELEASE',
  'BALANCE_RECOVERY',
  'FUTURE_SETOFF',
  'SETTLEMENT_PAID_SIMULATION',
]

function EntryDetailPanel({ entry, onClose }: { entry: AdminLedgerRow; onClose: () => void }) {
  const rows: Array<[string, string | null | number]> = [
    ['ID', entry.id],
    ['Tipo', entry.entry_type],
    ['Importe', `${entry.amount} ${entry.currency}`],
    ['Estado', entry.status],
    ['Fecha (occurred_at)', entry.occurred_at],
    ['Fecha (created_at)', entry.created_at],
    ['Actor', entry.actor_nombre ?? entry.actor_id ?? '—'],
    ['Master Order', entry.master_order_id ?? '—'],
    ['Supplier Order', entry.supplier_order_id ?? '—'],
    ['Settlement', entry.settlement_id ?? '—'],
    ['Refund', entry.refund_id ?? '—'],
    ['Dispute', entry.dispute_id ?? '—'],
    ['Reserve', entry.reserve_id ?? '—'],
    ['Recovery', entry.recovery_id ?? '—'],
    ['Correlation ID', entry.correlation_id ?? '—'],
    ['Source Event', entry.source_event_id ?? '—'],
    ['External provider', entry.external_provider ?? '—'],
    ['Descripción', entry.description ?? '—'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">{entry.entry_type}</span>
              <FinancialStatusBadge status={entry.status} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Lock className="h-3 w-3 text-slate-600" />
              <span className="text-[10px] text-slate-500">Ledger inmutable — solo lectura</span>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded border border-slate-700 hover:bg-slate-700 cursor-pointer">
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="p-5">
          {/* Importe destacado */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 text-center">
            <CurrencyAmount
              amount={entry.amount}
              currency={entry.currency}
              className={`text-2xl font-bold ${entry.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
              showSign
            />
          </div>

          {/* Campos */}
          <div className="space-y-1.5">
            {rows.map(([label, val]) => (
              <div key={label} className="flex gap-2 text-xs">
                <span className="text-slate-500 w-32 flex-shrink-0">{label}</span>
                <span className="text-slate-300 font-mono text-[10px] break-all">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function FinanceLedger() {
  const [items, setItems] = useState<AdminLedgerRow[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<AdminLedgerRow | null>(null)
  const [providers, setProviders] = useState<Array<{ actor_id: string; nombre: string }>>([])

  // Filters
  const [filterActor, setFilterActor] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCurrency, setFilterCurrency] = useState('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminLedger({
        actorId: filterActor || undefined,
        entryType: filterType || undefined,
        currency: filterCurrency || undefined,
        limit: LIMIT,
        offset: off,
      })
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filterActor, filterType, filterCurrency])

  useEffect(() => {
    getAdminProvidersList()
      .then(rows => setProviders(rows.map(r => ({ actor_id: r.actor_id, nombre: r.nombre }))))
      .catch(console.error)
    load(0)
  }, [])

  const selectCls = "bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 cursor-pointer focus:outline-none focus:border-blue-500"

  return (
    <div className="space-y-4">
      <SimulationBanner />

      {/* Cabecera */}
      <div className="flex items-center gap-2">
        <Lock className="h-4 w-4 text-slate-500" />
        <p className="text-xs text-slate-500">
          El ledger es inmutable. No existe función de edición. Ajustes = nuevas entradas compensatorias.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterActor} onChange={e => setFilterActor(e.target.value)} className={selectCls}>
          <option value="">Todos los proveedores</option>
          {providers.map(p => <option key={p.actor_id} value={p.actor_id}>{p.nombre}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className={selectCls}>
          <option value="">Todos los tipos</option>
          {ENTRY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterCurrency} onChange={e => setFilterCurrency(e.target.value)} className={selectCls}>
          <option value="">Todas las monedas</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>
        <button onClick={() => load(0)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer transition-colors">
          <Search className="h-3 w-3 inline mr-1" /> Filtrar
        </button>
        <button onClick={() => load(0)}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <span className="text-xs text-slate-500">{total} entr{total !== 1 ? 'adas' : 'ada'}</span>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}

      {/* Tabla */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Fecha</Th>
                <Th>Tipo</Th>
                <Th>Proveedor</Th>
                <Th>Importe</Th>
                <Th>Currency</Th>
                <Th>Estado</Th>
                <Th>Supplier Order</Th>
                <Th>Settlement</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={8} />
              ) : items.length === 0 ? (
                <tr><td colSpan={8} className="py-8">
                  <EmptyState message="Sin movimientos de ledger" />
                </td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelected(row)}>
                  <Td className="text-slate-400 whitespace-nowrap">{fmtDateTime(row.occurred_at)}</Td>
                  <Td mono className="text-slate-300 text-[10px]">{row.entry_type}</Td>
                  <Td className="text-slate-400 max-w-[100px] truncate">{row.actor_nombre ?? '—'}</Td>
                  <Td>
                    <CurrencyAmount
                      amount={row.amount}
                      currency={row.currency}
                      className={row.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}
                      showSign
                    />
                  </Td>
                  <Td className="text-slate-500">{row.currency}</Td>
                  <Td><FinancialStatusBadge status={row.status} /></Td>
                  <Td mono className="text-slate-500 text-[10px]">
                    {row.supplier_order_id ? fmtShortId(row.supplier_order_id) : '—'}
                  </Td>
                  <Td mono className="text-slate-500 text-[10px]">
                    {row.settlement_id ? fmtShortId(row.settlement_id) : '—'}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar
            total={total}
            limit={LIMIT}
            offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)}
          />
        )}
      </div>

      {selected && <EntryDetailPanel entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
