// MP-FIN-5B — TrabFlow financial documents list
// Renders supplier_statement and settlement_statement documents for the actor.
// Desktop: table. Mobile: stacked cards. Pagination 20/page. Independent refresh.
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, FileText, Lock } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import {
  getProviderDocuments,
  type FinDocListItem,
} from '../../../lib/marketplace/finance/financial-documents.service'
import {
  StatusBadge, fmtDate, PaginationBar, Th, Td, LoadingRow, EmptyState, ErrorBox, CurrencyAmount,
} from './shared'
import { getDocSubtypeLabel } from './doc-helpers'
import FinDocDetailModal from './FinDocDetailModal'

const LIMIT = 20

// ── Mobile card (module-level — no inner components) ──────────────────────────

function FinDocCard({ doc, onView }: { doc: FinDocListItem; onView: () => void }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-200 truncate">{doc.doc_number}</span>
        <span className="text-[9px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide">
          {getDocSubtypeLabel(doc.document_subtype)}
        </span>
      </div>
      <p className="text-[11px] text-slate-400 truncate">{doc.concept}</p>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{doc.issued_at ? fmtDate(doc.issued_at) : '—'}</span>
        <CurrencyAmount amount={doc.total_amount} currency={doc.currency} className="text-slate-200 font-semibold" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={doc.estado} />
          {doc.immutable_at && <Lock className="h-3 w-3 text-slate-500" aria-label="Documento inmutable" />}
        </div>
        <button
          onClick={onView}
          className="text-[11px] text-teal-400 hover:text-teal-300 cursor-pointer transition-colors"
        >
          Ver detalle
        </button>
      </div>
    </div>
  )
}

// ── Main list component ───────────────────────────────────────────────────────

export default function FinDocList({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<FinDocListItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getProviderDocuments(supabase, actorId, { limit: LIMIT, offset: off })
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Documentos TrabFlow</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">{total} documento{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => load(0)}
          disabled={loading}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      {/* Desktop table */}
      <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Nº documento</Th>
                <Th>Tipo</Th>
                <Th>Concepto</Th>
                <Th>Fecha</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={7} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8">
                    <EmptyState icon={FileText} message="Aún no hay documentos disponibles." />
                  </td>
                </tr>
              ) : items.map(doc => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(doc.id)}
                >
                  <Td mono className="text-slate-200">{doc.doc_number}</Td>
                  <Td>
                    <span className="text-[9px] text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {getDocSubtypeLabel(doc.document_subtype)}
                    </span>
                  </Td>
                  <Td className="text-slate-400 max-w-[200px] truncate">{doc.concept}</Td>
                  <Td className="text-slate-500 text-[10px]">{doc.issued_at ? fmtDate(doc.issued_at) : '—'}</Td>
                  <Td>
                    <CurrencyAmount amount={doc.total_amount} currency={doc.currency} className="text-slate-200 font-semibold" />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={doc.estado} />
                      {doc.immutable_at && <Lock className="h-3 w-3 text-slate-500" aria-label="Inmutable" />}
                    </div>
                  </Td>
                  <Td>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedId(doc.id) }}
                      className="text-[11px] text-teal-400 hover:text-teal-300 cursor-pointer transition-colors"
                    >
                      Ver
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <PaginationBar
            total={total} limit={LIMIT} offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)}
          />
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Cargando documentos…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={FileText} message="Aún no hay documentos disponibles." />
        ) : (
          <>
            {items.map(doc => (
              <FinDocCard key={doc.id} doc={doc} onView={() => setSelectedId(doc.id)} />
            ))}
            {total > LIMIT && (
              <PaginationBar
                total={total} limit={LIMIT} offset={offset}
                onPrev={() => load(Math.max(0, offset - LIMIT))}
                onNext={() => load(offset + LIMIT)}
              />
            )}
          </>
        )}
      </div>

      {/* Disclaimer — always visible */}
      <p className="text-[10px] text-slate-600 leading-relaxed">
        Documentos informativos generados por TrabFlow a partir de la actividad registrada en el Marketplace. No constituyen facturas fiscales.
      </p>

      {selectedId && (
        <FinDocDetailModal documentId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
