// MP-FIN-4 — Provider Documents Tab
// Placeholder — módulo de documentos financieros (facturas, certificados) pendiente.

import { FileText } from 'lucide-react'
import { SimBanner } from './shared'

export default function ProviderDocuments() {
  return (
    <div className="space-y-4">
      <SimBanner />
      <div className="flex flex-col items-center gap-4 py-16 text-slate-600">
        <FileText className="h-12 w-12" />
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-400">Documentos financieros</p>
          <p className="text-xs mt-1 max-w-xs">
            En esta sección estarán disponibles facturas, certificados de retención
            y otros documentos financieros. Próximamente.
          </p>
        </div>
      </div>
    </div>
  )
}
