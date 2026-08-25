// MP-FIN-3 — Admin Marketplace Finance Section
// Contenedor con 12 tabs. SimulationBanner visible en todo momento.
// NO crea lógica financiera nueva — solo visualización + control + trazabilidad.

import { useState } from 'react'
import {
  BarChart3, ShoppingCart, Store, BookOpen, Wallet, Banknote,
  RotateCcw, ShieldAlert, Lock, TrendingUp, RefreshCw, Settings, GitCompare,
} from 'lucide-react'
import { SimulationBanner } from './marketplace-finance/shared'
import FinanceOverview from './marketplace-finance/FinanceOverview'
import FinanceOrders from './marketplace-finance/FinanceOrders'
import FinanceProviders from './marketplace-finance/FinanceProviders'
import FinanceLedger from './marketplace-finance/FinanceLedger'
import FinanceBalances from './marketplace-finance/FinanceBalances'
import FinanceSettlements from './marketplace-finance/FinanceSettlements'
import FinanceRefunds from './marketplace-finance/FinanceRefunds'
import FinanceDisputes from './marketplace-finance/FinanceDisputes'
import FinanceReserves from './marketplace-finance/FinanceReserves'
import FinanceRecoveries from './marketplace-finance/FinanceRecoveries'
import FinanceConciliation from './marketplace-finance/FinanceConciliation'
import FinanceConfig from './marketplace-finance/FinanceConfig'

type TabId =
  | 'overview'
  | 'orders'
  | 'providers'
  | 'ledger'
  | 'balances'
  | 'settlements'
  | 'refunds'
  | 'disputes'
  | 'reserves'
  | 'recoveries'
  | 'conciliation'
  | 'config'

interface Tab {
  id: TabId
  label: string
  Icon: React.ElementType
  short: string
}

const TABS: Tab[] = [
  { id: 'overview',     label: 'Resumen',        Icon: BarChart3,    short: 'Resumen'      },
  { id: 'orders',       label: 'Pedidos',         Icon: ShoppingCart, short: 'Pedidos'      },
  { id: 'providers',    label: 'Proveedores',     Icon: Store,        short: 'Proveedores'  },
  { id: 'ledger',       label: 'Ledger',          Icon: BookOpen,     short: 'Ledger'       },
  { id: 'balances',     label: 'Saldos',          Icon: Wallet,       short: 'Saldos'       },
  { id: 'settlements',  label: 'Liquidaciones',   Icon: Banknote,     short: 'Liquids.'     },
  { id: 'refunds',      label: 'Devoluciones',    Icon: RotateCcw,    short: 'Devols.'      },
  { id: 'disputes',     label: 'Disputas',        Icon: ShieldAlert,  short: 'Disputas'     },
  { id: 'reserves',     label: 'Reservas',        Icon: Lock,         short: 'Reservas'     },
  { id: 'recoveries',   label: 'Recuperaciones',  Icon: TrendingUp,   short: 'Recups.'      },
  { id: 'conciliation', label: 'Conciliación',    Icon: GitCompare,   short: 'Concil.'      },
  { id: 'config',       label: 'Configuración',   Icon: Settings,     short: 'Config.'      },
]

export default function AdminMarketplaceFinanceSection() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const ActiveComponent = {
    overview:    FinanceOverview,
    orders:      FinanceOrders,
    providers:   FinanceProviders,
    ledger:      FinanceLedger,
    balances:    FinanceBalances,
    settlements: FinanceSettlements,
    refunds:     FinanceRefunds,
    disputes:    FinanceDisputes,
    reserves:    FinanceReserves,
    recoveries:   FinanceRecoveries,
    conciliation: FinanceConciliation,
    config:       FinanceConfig,
  }[activeTab]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Finanzas Marketplace</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Visualización · Control · Trazabilidad · SIMULATION ONLY
          </p>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-700/60 bg-amber-950/20 text-[10px] text-amber-300">
          <RefreshCw className="h-3 w-3" />
          MODO SIMULACIÓN
        </div>
      </div>

      {/* Simulation banner global */}
      <SimulationBanner />

      {/* Tabs */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-0.5 min-w-max">
          {TABS.map(tab => {
            const Icon = tab.Icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap
                  ${active
                    ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'}
                `}
              >
                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${active ? 'text-blue-400' : ''}`} />
                <span className="hidden lg:inline">{tab.label}</span>
                <span className="lg:hidden">{tab.short}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0">
        <ActiveComponent />
      </div>
    </div>
  )
}
