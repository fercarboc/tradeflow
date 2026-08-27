// MP-FIN-5C — Pantalla Documentos del Marketplace (buyer).
// Archivo documental del instalador: resúmenes de compra + refs de proveedor.
// Requiere sesión autenticada con org_id.
import type { Session } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { ArrowLeft, FileText } from 'lucide-react'
import { ActivePage } from '../../types'
import { useSession } from '../../context/SessionContext'
import BuyerDocuments from './BuyerDocuments'

interface Props {
  setCurrentPage: (page: ActivePage) => void
  session: Session | null
}

export default function ScreenDocumentosMarketplace({ setCurrentPage, session }: Props) {
  const { org } = useSession()

  useEffect(() => {
    if (!session) setCurrentPage(ActivePage.Login)
  }, [session, setCurrentPage])

  if (!session || !org?.id) {
    return (
      <div className="min-h-screen bg-[#020B16] flex items-center justify-center">
        <p className="text-slate-500 text-sm">Cargando…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020B16]">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentPage(ActivePage.Marketplace)}
            aria-label="Volver al Marketplace"
            className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-700 hover:bg-slate-800 cursor-pointer transition-colors text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#1A5A96]" />
            <h1 className="text-lg font-bold text-slate-100">Documentos</h1>
          </div>
        </div>
        <p className="text-xs text-slate-500 -mt-2 ml-11">
          Resúmenes de compra y documentos registrados por tus proveedores.
        </p>

        {/* Contenido */}
        <BuyerDocuments orgId={org.id} />
      </div>
    </div>
  )
}
