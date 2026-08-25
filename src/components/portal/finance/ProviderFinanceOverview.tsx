// MP-FIN-4 — Provider Finance Overview Tab
// Muestra posición financiera del proveedor: balances, alertas, resumen.
// INVARIANTES: historical_settled ∉ TEB (INV-B03). Comisión real = 0%.

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, AlertTriangle, Info } from 'lucide-react'
import { getProviderBalance, type ProviderBalance } from '../../../lib/marketplace/finance/provider-finance.service'
import { SimBanner, CurrencyAmount, KpiCard, ErrorBox, fmtDateTime } from './shared'

interface Props {
  actorId: string
}

export default function ProviderFinanceOverview({ actorId }: Props) {
  const [balance, setBalance] = useState<ProviderBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const b = await getProviderBalance(actorId)
      setBalance(b)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load() }, [load])

  const fmt = (v: number) =>
    new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)

  return (
    <div className="space-y-4">
      <SimBanner />

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Posición financiera</h2>
        <button onClick={load} disabled={loading}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {loading && !balance && (
        <div className="text-center py-8 text-slate-500 text-xs">Cargando balance…</div>
      )}

      {balance && (
        <>
          {/* Alerta saldo negativo */}
          {balance.negative_amount > 0 && (
            <div className="flex items-start gap-2 bg-red-950/20 border border-red-800/50 rounded-lg px-3 py-2.5 text-xs">
              <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-semibold">Saldo negativo activo</p>
                <p className="text-red-400/80 mt-0.5">
                  Tienes {fmt(balance.negative_amount)} EUR de saldo negativo. Este importe se recuperará
                  automáticamente con futuros ingresos.
                </p>
              </div>
            </div>
          )}

          {/* Balance cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Saldo total (TEB)"
              value={<CurrencyAmount amount={balance.total_economic_balance} currency={balance.currency} />}
              note="Disponible + pendiente + reservado − negativo"
              highlight={balance.total_economic_balance >= 0 ? 'green' : 'red'}
            />
            <KpiCard
              label="Disponible"
              value={<CurrencyAmount amount={balance.available_amount} currency={balance.currency} />}
              highlight="green"
            />
            <KpiCard
              label="Pendiente"
              value={<CurrencyAmount amount={balance.pending_amount} currency={balance.currency} />}
              note="Pedidos aún no confirmados"
              highlight="amber"
            />
            <KpiCard
              label="Retenido"
              value={<CurrencyAmount amount={balance.reserved_amount} currency={balance.currency} />}
              note="Bloqueo temporal — no es pérdida"
              highlight="blue"
            />
          </div>

          {/* Nota: historical_settled separado */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
              <Info className="h-3 w-3" />
              Historial (flujo — no incluido en TEB)
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Liquidado históricamente</span>
              <CurrencyAmount amount={balance.historical_settled} currency={balance.currency} className="text-slate-500" />
            </div>
            <p className="text-[10px] text-slate-600">
              El importe liquidado históricamente es un registro de flujo. No forma parte del saldo actual (TEB).
            </p>
          </div>

          {/* Meta */}
          <div className="text-[10px] text-slate-700 space-y-0.5">
            {balance.last_recalculated_at && (
              <div>Balance calculado: {fmtDateTime(balance.last_recalculated_at)}</div>
            )}
            <div>Estrategia: {balance.projection_strategy}</div>
            <div>Actor: {balance.actor_id}</div>
          </div>
        </>
      )}
    </div>
  )
}
