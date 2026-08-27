// MP-FIN-4 — Provider Finance Main Container
// 8 tabs: Resumen, Movimientos, Pedidos, Liquidaciones, Devoluciones, Disputas, Retenciones, Documentos
// Integrado en PortalProveedorView como tab 'finanzas'.
// RLS + explicit actorId filter — proveedor solo ve sus propios datos.

import { useState } from 'react'
import type { MarketplaceMyMembership } from '../../../lib/api/marketplace-actors'
import ProviderFinanceOverview from './ProviderFinanceOverview'
import ProviderMovements from './ProviderMovements'
import ProviderOrders from './ProviderOrders'
import ProviderSettlements from './ProviderSettlements'
import ProviderRefunds from './ProviderRefunds'
import ProviderDisputes from './ProviderDisputes'
import ProviderReserves from './ProviderReserves'
import ProviderDocuments from './ProviderDocuments'

type FinanceTab = 'overview' | 'movements' | 'orders' | 'settlements' | 'refunds' | 'disputes' | 'reserves' | 'documents'

const TABS: { id: FinanceTab; label: string; shortLabel: string }[] = [
  { id: 'overview',     label: 'Resumen',        shortLabel: 'Resumen' },
  { id: 'movements',   label: 'Movimientos',     shortLabel: 'Movimientos' },
  { id: 'orders',      label: 'Pedidos',         shortLabel: 'Pedidos' },
  { id: 'settlements', label: 'Liquidaciones',   shortLabel: 'Liquid.' },
  { id: 'refunds',     label: 'Devoluciones',    shortLabel: 'Devoluc.' },
  { id: 'disputes',    label: 'Disputas',        shortLabel: 'Disputas' },
  { id: 'reserves',    label: 'Retenciones',     shortLabel: 'Retenc.' },
  { id: 'documents',   label: 'Documentos',      shortLabel: 'Docs' },
]

interface Props {
  actorId: string
  membership: MarketplaceMyMembership
}

export default function ProviderFinance({ actorId, membership }: Props) {
  const [activeTab, setActiveTab] = useState<FinanceTab>('overview')

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':     return <ProviderFinanceOverview actorId={actorId} />
      case 'movements':   return <ProviderMovements actorId={actorId} />
      case 'orders':      return <ProviderOrders actorId={actorId} />
      case 'settlements': return <ProviderSettlements actorId={actorId} />
      case 'refunds':     return <ProviderRefunds actorId={actorId} />
      case 'disputes':    return <ProviderDisputes actorId={actorId} />
      case 'reserves':    return <ProviderReserves actorId={actorId} />
      case 'documents':   return <ProviderDocuments actorId={actorId} />
      default:            return null
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">Finanzas</h1>
          <p className="text-xs text-slate-500 mt-0.5">{membership.actor_nombre}</p>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-500 bg-amber-950/30 border border-amber-800/30 px-2 py-0.5 rounded">
          Simulación
        </span>
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 min-w-max sm:min-w-0 sm:flex-wrap">
          {TABS.map(({ id, label, shortLabel }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activeTab === id
                  ? 'bg-teal-900/50 text-teal-300 border border-teal-800/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span className="sm:hidden">{shortLabel}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div>
        {renderTab()}
      </div>
    </div>
  )
}
