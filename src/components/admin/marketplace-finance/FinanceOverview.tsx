// MP-FIN-3 — Finance Overview Tab
// Primera pantalla: KPIs globales, GMV vs Revenue, Requiere Atención.
// GMV ≠ Revenue TrabFlow — invariante visual inamovible.

import { useEffect, useState } from 'react'
import { RefreshCw, AlertTriangle, TrendingUp, ShoppingCart, Users, RotateCcw, Shield, Wallet } from 'lucide-react'
import { getAdminFinanceOverview, type AdminFinanceOverview } from '../../../lib/marketplace/finance/admin-finance.service'
import { SimulationBanner, KpiCard, SimulationBadge, CurrencyAmount, fmtDate } from './shared'

function AttentionCard({ icon: Icon, label, value, detail, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  detail?: string
  color: string
}) {
  return (
    <div className={`flex items-center gap-3 bg-slate-800/50 border rounded-lg px-3 py-2.5 ${color}`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white">{label}</div>
        {detail && <div className="text-[10px] text-slate-400">{detail}</div>}
      </div>
      <span className="text-sm font-bold tabular-nums text-white">{value}</span>
    </div>
  )
}

export default function FinanceOverview({ onRefresh }: { onRefresh?: () => void }) {
  const [data, setData] = useState<AdminFinanceOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const overview = await getAdminFinanceOverview()
      setData(overview)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <SimulationBanner />
        <div className="flex items-center justify-center py-16 text-slate-500">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Cargando visión financiera…
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SimulationBanner />
        <div className="bg-red-950/30 border border-red-800 rounded-lg p-4 text-sm text-red-400">{error}</div>
      </div>
    )
  }

  const b = data?.balances
  const r = data?.refunds
  const d = data?.disputes
  const n = data?.negative
  const s = data?.settlements

  const gmv = data?.gmv_total ?? 0
  const realRevenue = 0  // Fase 0: commission real = 0 (COMMISSION_GATE cerrado)
  const simRevenue = gmv * 0.02  // 2% simulado — solo referencia, no facturado

  const openDisputes = d?.open_disputes ?? 0
  const negProviders = n?.providers_in_deficit ?? 0
  const pendingSettlements = (s?.settlements_draft ?? 0) + (s?.settlements_calculated ?? 0) + (s?.settlements_approved ?? 0)

  const attentionItems = [
    openDisputes > 0 && {
      icon: Shield, label: `${openDisputes} dispute${openDisputes !== 1 ? 's' : ''} abierto${openDisputes !== 1 ? 's' : ''}`,
      value: openDisputes, detail: 'Requieren revisión', color: 'border-red-800/60',
    },
    negProviders > 0 && {
      icon: AlertTriangle, label: `${negProviders} proveedor${negProviders !== 1 ? 'es' : ''} con saldo negativo`,
      value: n ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(n.total_deficit) + ' €' : negProviders,
      detail: 'Déficit total acumulado', color: 'border-orange-800/60',
    },
    pendingSettlements > 0 && {
      icon: Wallet, label: `${pendingSettlements} settlement${pendingSettlements !== 1 ? 's' : ''} pendiente${pendingSettlements !== 1 ? 's' : ''}`,
      value: pendingSettlements, detail: 'Sin simular pago', color: 'border-amber-800/60',
    },
  ].filter(Boolean) as Array<{ icon: React.ElementType; label: string; value: string | number; detail: string; color: string }>

  return (
    <div className="space-y-6">
      <SimulationBanner />

      {/* ── GMV vs Revenue ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* GMV */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">GMV Marketplace</div>
          <div className="text-2xl font-bold text-blue-300 tabular-nums">
            <CurrencyAmount amount={gmv} currency="EUR" decimals={2} className="text-blue-300 text-2xl font-bold" />
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Valor bruto de ventas — NO es ingreso TrabFlow (INV-001)
          </p>
        </div>

        {/* Revenue TrabFlow */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Ingresos TrabFlow Marketplace</div>
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-slate-500 mb-0.5">Ingresos reales</div>
              <div className="text-xl font-bold text-slate-400 tabular-nums">0,00 EUR</div>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <div className="text-[10px] text-slate-500 mb-0.5">Potencial simulado (2%)</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-amber-300 tabular-nums font-mono">
                    {new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(simRevenue)} EUR
                  </span>
                  <SimulationBadge />
                </div>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            Comisión real = 0% (COMMISSION_GATE cerrado)
          </p>
        </div>
      </div>

      {/* ── Requiere Atención ─────────────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Requiere Atención</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {attentionItems.map((item, i) => (
              <AttentionCard key={i} {...item} />
            ))}
          </div>
        </div>
      )}

      {/* ── KPIs globales ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">KPIs globales</h3>
          <button onClick={load}
            className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Pedidos */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Pedidos</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Master Orders" value={String(data?.master_orders_count ?? 0)}
              color="text-slate-200" />
            <KpiCard label="Supplier Orders" value={String(data?.supplier_orders_count ?? 0)}
              color="text-slate-200" />
            <KpiCard label="Proveedores activos" value={String(data?.providers_with_activity ?? 0)}
              color="text-slate-200" />
            <KpiCard label="Refunds totales" value={String(r?.total_refunds ?? 0)}
              color={r && r.total_refunds > 0 ? 'text-orange-300' : 'text-slate-200'} />
          </div>
        </div>

        {/* Balances */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Balances de proveedores (EUR)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Pending"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_provider_pending) + ' €' : '—'}
              color="text-yellow-300" />
            <KpiCard label="Available"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_provider_available) + ' €' : '—'}
              color="text-emerald-400" />
            <KpiCard label="Reserved"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_provider_reserved) + ' €' : '—'}
              color="text-blue-300" />
            <KpiCard label="Negative"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_provider_negative) + ' €' : '—'}
              color={b && b.total_provider_negative > 0 ? 'text-red-400' : 'text-slate-400'}
              warning={(b?.total_provider_negative ?? 0) > 0} />
          </div>
        </div>

        {/* Devoluciones */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Devoluciones</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Total devuelto"
              value={r ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(r.total_refunded_gross) + ' €' : '—'}
              color="text-orange-300" />
            <KpiCard label="Refund rate"
              value={gmv > 0 && r ? (r.total_refunded_gross / gmv * 100).toFixed(1) + '%' : '—'}
              color="text-slate-200" />
            <KpiCard label="Disputas abiertas" value={String(d?.open_disputes ?? 0)}
              color={openDisputes > 0 ? 'text-red-400' : 'text-slate-200'}
              warning={openDisputes > 0} />
            <KpiCard label="Total disputado"
              value={d ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(d.total_disputed_amount) + ' €' : '—'}
              color="text-slate-200" />
          </div>
        </div>

        {/* Settlements */}
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Liquidaciones</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Settlements pendientes" value={String(pendingSettlements)}
              color={pendingSettlements > 0 ? 'text-amber-300' : 'text-slate-200'} />
            <KpiCard label="Simul. pagados" value={String(s?.total_simulated_paid ?? 0)}
              color="text-emerald-400" />
            <KpiCard label="Historical settled"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_historical_settled) + ' €' : '—'}
              color="text-slate-200" sub="Flujo acumulado — no forma parte del TEB" />
            <KpiCard label="Total Económico Proveedores"
              value={b ? new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(b.total_economic_balance) + ' €' : '—'}
              color="text-white" />
          </div>
        </div>
      </div>

      {/* ── Calculado el ──────────────────────────────────────────────────── */}
      <p className="text-[10px] text-slate-600">
        Calculado: {fmtDate(data?.calculated_at)} · Datos en tiempo real del ledger.
      </p>
    </div>
  )
}
