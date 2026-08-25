// MP-FIN-4 — Provider Reserves Tab
// Reservas/retenciones del proveedor.
// CRÍTICO: Explicar que reserva ≠ pérdida económica — bloqueo temporal.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Lock } from 'lucide-react'
import {
  listProviderReserves, getReserve,
  type ReserveDetail,
} from '../../../lib/marketplace/finance/reserve.service'
import type { ReserveListResult } from '../../../lib/marketplace/finance/reserve.service'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 20

function ReserveDetailModal({ reserveId, onClose }: { reserveId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ReserveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getReserve(reserveId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [reserveId])

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-blue-400" />
          <span className="font-mono">{detail?.reserve_number ?? '…'}</span>
          {detail && <StatusBadge status={detail.status} />}
        </span>
      }
      onClose={onClose}
    >
      {loading && <div className="text-slate-500 text-xs py-4">Cargando…</div>}
      {error && <ErrorBox message={error} />}
      {detail && (
        <div className="space-y-4 text-xs">
          {/* Conceptual note */}
          <div className="bg-blue-950/20 border border-blue-800/30 rounded px-3 py-2 text-[10px] text-blue-300">
            Una retención bloquea temporalmente fondos de tu saldo disponible.
            No es una pérdida — el importe se libera automáticamente al resolverse.
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Tipo: </span><span className="text-slate-300">{detail.reserve_type.replace(/_/g, ' ')}</span></div>
            <div><span className="text-slate-500">Inicio: </span><span className="text-slate-300">{fmtDateTime(detail.starts_at)}</span></div>
            {detail.release_at && <div><span className="text-slate-500">Liberación: </span><span className="text-amber-300">{fmtDate(detail.release_at)}</span></div>}
            {detail.released_at && <div><span className="text-slate-500">Liberado: </span><span className="text-emerald-400">{fmtDateTime(detail.released_at)}</span></div>}
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importes</div>
            <div className="flex justify-between">
              <span className="text-slate-400">Retenido</span>
              <CurrencyAmount amount={detail.reserved_amount} currency={detail.currency} className="text-blue-300" />
            </div>
            {detail.released_amount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-400">Ya liberado</span>
                <CurrencyAmount amount={detail.released_amount} currency={detail.currency} className="text-emerald-400" />
              </div>
            )}
            <div className="border-t border-slate-700 pt-1 flex justify-between font-semibold">
              <span className="text-white">Restante</span>
              <CurrencyAmount amount={detail.remaining_amount} currency={detail.currency} className="text-white" />
            </div>
          </div>

          {detail.reason && (
            <div className="bg-slate-800/40 border border-slate-700 rounded p-2.5 text-[10px] text-slate-400">
              <div className="text-[9px] text-slate-600 uppercase tracking-wider mb-1">Motivo</div>
              {detail.reason}
            </div>
          )}

          <div className="text-[10px] text-slate-700 font-mono">ID: {detail.id}</div>
        </div>
      )}
    </Modal>
  )
}

export default function ProviderReserves({ actorId }: { actorId: string }) {
  const [result, setResult] = useState<ReserveListResult | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listProviderReserves(actorId, LIMIT, off)
      setResult(res)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load(0) }, [load])

  const items = result?.items ?? []
  const total = result?.total ?? 0

  return (
    <div className="space-y-4">
      <SimBanner />

      {/* Conceptual note */}
      <div className="flex items-start gap-2 bg-blue-950/20 border border-blue-800/30 rounded-lg px-3 py-2 text-xs">
        <Lock className="h-3.5 w-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
        <span className="text-blue-300">
          Las retenciones bloquean fondos temporalmente pero no son pérdidas económicas.
          El importe aparece en tu saldo retenido y se libera automáticamente.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Retenciones</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{total} retenci{total !== 1 ? 'ones' : 'ón'}</span>
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
                <Th>Retención</Th>
                <Th>Tipo</Th>
                <Th>Retenido</Th>
                <Th>Restante</Th>
                <Th>Liberar</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-8"><EmptyState icon={Lock} message="Sin retenciones activas" /></td></tr>
              ) : items.map(row => (
                <tr key={row.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.id)}>
                  <Td mono className="text-slate-200">{row.reserve_number}</Td>
                  <Td className="text-slate-400 text-[10px]">{row.reserve_type.replace(/_/g, ' ')}</Td>
                  <Td><CurrencyAmount amount={row.reserved_amount} currency={row.currency} className="text-blue-300" /></Td>
                  <Td><CurrencyAmount amount={row.remaining_amount} currency={row.currency} className="text-blue-400" /></Td>
                  <Td className={`text-[10px] ${row.release_at ? 'text-amber-300' : 'text-slate-600'}`}>
                    {row.release_at ? fmtDate(row.release_at) : '—'}
                  </Td>
                  <Td><StatusBadge status={row.status} /></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar total={total} limit={LIMIT} offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)} />
        )}
      </div>

      {selectedId && <ReserveDetailModal reserveId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  )
}
