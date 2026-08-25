// MP-FIN-4 — Provider Movements Tab
// Historial de movimientos del ledger del proveedor.
// Muestra etiquetas humanizadas. Signos desde perspectiva del proveedor.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ArrowUpRight, ArrowDownLeft, List } from 'lucide-react'
import {
  getProviderLedgerEntries, humanizeEntryType,
  type ProviderLedgerResult,
} from '../../../lib/marketplace/finance/provider-finance.service'
import type { LedgerEntry } from '../../../lib/marketplace/finance/types/ledger.types'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 25

// Desde perspectiva del proveedor, positivo = ingresa, negativo = sale
// El ledger usa perspectiva TrabFlow, que es la inversa para algunos tipos
const PROVIDER_POSITIVE_TYPES = new Set([
  'GOODS_ENTITLEMENT', 'SHIPPING_ENTITLEMENT', 'COMMISSION_REVERSAL',
  'COMMISSION_TAX_REVERSAL', 'CHARGEBACK_CREDIT', 'RESERVE_RELEASE',
  'BALANCE_RECOVERY', 'PROVIDER_ADJUSTMENT',
])

function amountSign(entry: LedgerEntry): number {
  // amount en ledger es perspectiva TrabFlow: positive = TrabFlow recibe
  // Para proveedor, GOODS_ENTITLEMENT (positivo en TrabFlow) = ingreso del proveedor
  if (PROVIDER_POSITIVE_TYPES.has(entry.entryType)) return Math.abs(entry.amount)
  return -Math.abs(entry.amount)
}

function MovementDetailModal({ entry, onClose }: { entry: LedgerEntry; onClose: () => void }) {
  const providerAmount = amountSign(entry)
  return (
    <Modal title={humanizeEntryType(entry.entryType)} onClose={onClose}>
      <div className="space-y-3 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div><span className="text-slate-500">Tipo: </span><span className="text-slate-300 font-mono text-[10px]">{entry.entryType}</span></div>
          <div><span className="text-slate-500">Estado: </span><StatusBadge status={entry.status} /></div>
          <div><span className="text-slate-500">Fecha: </span><span className="text-slate-300">{fmtDateTime(entry.occurredAt)}</span></div>
          <div><span className="text-slate-500">Currency: </span><span className="text-slate-300">{entry.currency}</span></div>
        </div>

        <div className={`bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex justify-between items-center`}>
          <span className="text-slate-400">Importe</span>
          <CurrencyAmount
            amount={providerAmount}
            currency={entry.currency}
            className={providerAmount >= 0 ? 'text-emerald-400 font-bold text-sm' : 'text-red-400 font-bold text-sm'}
          />
        </div>

        {entry.description && (
          <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Descripción</div>
            <p className="text-slate-300">{entry.description}</p>
          </div>
        )}

        <div className="space-y-1 text-[10px] text-slate-600 font-mono">
          <div>ID: {entry.id}</div>
          {entry.supplierOrderId && <div>Pedido: {entry.supplierOrderId}</div>}
          {entry.settlementId && <div>Liquidación: {entry.settlementId}</div>}
          {entry.refundId && <div>Devolución: {entry.refundId}</div>}
          {entry.correlationId && <div>Correlación: {entry.correlationId}</div>}
          {entry.compensatesEntryId && <div>Compensa: {entry.compensatesEntryId}</div>}
        </div>
      </div>
    </Modal>
  )
}

export default function ProviderMovements({ actorId }: { actorId: string }) {
  const [result, setResult] = useState<ProviderLedgerResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<LedgerEntry | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProviderLedgerEntries(actorId, LIMIT, off)
      setResult(data)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load(0) }, [load])

  const total = result?.total ?? 0
  const items = result?.items ?? []

  return (
    <div className="space-y-4">
      <SimBanner />

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Movimientos</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{total} entradas</span>
          <button onClick={() => load(0)} disabled={loading}
            className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Fecha</Th>
                <Th>Movimiento</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={4} />
              ) : items.length === 0 ? (
                <tr><td colSpan={4} className="py-8"><EmptyState icon={List} message="Sin movimientos" /></td></tr>
              ) : items.map(entry => {
                const pAmount = amountSign(entry)
                return (
                  <tr key={entry.id}
                    className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    onClick={() => setSelected(entry)}>
                    <Td className="text-slate-500 text-[10px] whitespace-nowrap">{fmtDate(entry.occurredAt)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        {pAmount >= 0
                          ? <ArrowUpRight className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                          : <ArrowDownLeft className="h-3 w-3 text-red-500 flex-shrink-0" />}
                        <span className="text-slate-200">{humanizeEntryType(entry.entryType)}</span>
                      </div>
                      {entry.description && (
                        <div className="text-[10px] text-slate-600 mt-0.5 truncate max-w-[180px]">{entry.description}</div>
                      )}
                    </Td>
                    <Td>
                      <CurrencyAmount
                        amount={pAmount}
                        currency={entry.currency}
                        className={pAmount >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400'}
                      />
                    </Td>
                    <Td><StatusBadge status={entry.status} /></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar total={total} limit={LIMIT} offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)} />
        )}
      </div>

      {selected && <MovementDetailModal entry={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
