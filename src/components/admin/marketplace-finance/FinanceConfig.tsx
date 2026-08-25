// MP-FIN-3 — Finance Config Tab
// Display-only de la configuración financiera actual.
// NUNCA expone claves sensibles. Gates como LEGAL, TAX, STRIPE mostrados en PENDING.

import { useEffect, useState } from 'react'
import { RefreshCw, Lock, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { getFinancialConfig } from '../../../lib/marketplace/finance/financial-config.service'
import type { FinancialConfig } from '../../../lib/marketplace/finance/types/commission.types'
import { SimulationBanner, GateBadge } from './shared'

function GateRow({ label, open, note }: { label: string; open: boolean; note?: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${open ? 'bg-emerald-400' : 'bg-slate-600'}`} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300">{label}</span>
          <GateBadge gate={label} open={open} />
        </div>
        {note && <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>}
      </div>
      {open
        ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
        : <Clock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />}
    </div>
  )
}

function ConfigRow({ label, value, mono }: { label: string; value: string | number | boolean; mono?: boolean }) {
  const display = typeof value === 'boolean'
    ? (value ? 'true' : 'false')
    : String(value)

  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-800 last:border-0 text-xs">
      <span className="text-slate-500 w-56 flex-shrink-0">{label}</span>
      <span className={`text-slate-300 ${mono ? 'font-mono' : ''}`}>{display}</span>
    </div>
  )
}

export default function FinanceConfig() {
  const [config, setConfig] = useState<FinancialConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getFinancialConfig()
      .then(setConfig)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  return (
    <div className="space-y-6 max-w-2xl">
      <SimulationBanner />

      {/* Header note */}
      <div className="flex items-start gap-2 bg-slate-800/50 border border-slate-700 rounded-lg px-4 py-3 text-xs">
        <Lock className="h-3.5 w-3.5 text-slate-500 flex-shrink-0 mt-0.5" />
        <span className="text-slate-400">
          Esta sección muestra la configuración financiera actual en modo lectura.
          Los valores solo pueden modificarse mediante SQL directo en la tabla <span className="font-mono text-slate-300">trade_marketplace_financial_config</span>.
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Configuración activa</h3>
        <button onClick={load}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <div className="bg-red-950/30 border border-red-800 rounded-lg p-3 text-xs text-red-400">{error}</div>}
      {loading && <div className="text-xs text-slate-500">Cargando…</div>}

      {config && (
        <div className="space-y-6">
          {/* Gates — estado de apertura de cada puerta lógica */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Gates del sistema financiero</h4>

            <GateRow
              label="STRIPE_GATE"
              open={config.stripeConnectEnabled}
              note="Stripe Connect real. PENDING — requiere cuenta Stripe empresarial y dictamen legal."
            />
            <GateRow
              label="LEGAL_GATE"
              open={config.realPaymentsEnabled}
              note="Pagos reales habilitados. PENDING — requiere dictamen legal y fiscal previo."
            />
            <GateRow
              label="TAX_GATE"
              open={false}
              note="Cálculo fiscal real. PENDING — fuera de Fase 0."
            />
            <GateRow
              label="COMMISSION_GATE"
              open={config.commissionEnabled}
              note={`Comisión real = ${(config.commissionRealRate * 100).toFixed(1)}%. PENDING — en Fase 0 real = 0%.`}
            />
            <GateRow
              label="SETTLEMENT_GATE"
              open={config.settlementsEnabled}
              note="Liquidaciones habilitadas."
            />
            <GateRow
              label="RESERVE_GATE"
              open={config.reservesEnabled}
              note="Sistema de reservas habilitado."
            />
          </div>

          {/* Modo de pago */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Modo de pago</h4>
            <ConfigRow label="payment.mode" value={config.paymentMode} mono />
            <ConfigRow label="payment.simulation_enabled" value={config.simulationEnabled} />
            <ConfigRow label="payment.real_payments_enabled" value={config.realPaymentsEnabled} />
            <ConfigRow label="payment.stripe_connect_enabled" value={config.stripeConnectEnabled} />
          </div>

          {/* Comisiones */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Comisiones</h4>
            <ConfigRow label="commission.enabled" value={config.commissionEnabled} />
            <ConfigRow label="commission.simulation_rate" value={`${(config.commissionSimulationRate * 100).toFixed(2)}% (referencia)`} />
            <ConfigRow label="commission.real_rate" value={`${(config.commissionRealRate * 100).toFixed(2)}% (COMMISSION_GATE cerrado)`} />
          </div>

          {/* Settlements */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Liquidaciones</h4>
            <ConfigRow label="settlement.enabled" value={config.settlementsEnabled} />
            <ConfigRow label="settlement.frequency" value={config.settlementFrequency} mono />
            <ConfigRow label="settlement.hold_days" value={`${config.settlementHoldDays} días`} />
            <ConfigRow label="settlement.real_payouts_enabled" value={config.realPayoutsEnabled} />
          </div>

          {/* Módulos */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <h4 className="text-[10px] text-slate-400 uppercase tracking-wider mb-3">Módulos</h4>
            <ConfigRow label="reserve.enabled" value={config.reservesEnabled} />
            <ConfigRow label="refund.enabled" value={config.refundsEnabled} />
            <ConfigRow label="dispute.enabled" value={config.disputesEnabled} />
          </div>

          {/* Aviso DETENTE */}
          <div className="flex items-start gap-2 bg-amber-950/20 border border-amber-800/40 rounded-lg px-4 py-3 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-semibold">Aviso importante</p>
              <p className="text-amber-300/80 mt-1">
                Cualquier modificación de gates (LEGAL_GATE, STRIPE_GATE, TAX_GATE) requiere autorización explícita.
                No activar pagos reales sin dictamen legal/fiscal documentado.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
