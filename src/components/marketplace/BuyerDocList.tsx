// MP-FIN-5C — Bloque A: Resúmenes de compra del instalador (purchase_summary).
// Recibe orgId y search (debounced) desde BuyerDocuments.
// Desktop: tabla. Mobile: tarjetas. Paginación 20/página.
// No inner components — todos definidos a nivel de módulo.
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  getBuyerDocuments,
  type FinDocListItem,
} from '../../lib/marketplace/finance/financial-documents.service'
import {
  StatusBadge, fmtDate, PaginationBar, Th, Td, LoadingRow, EmptyState, ErrorBox, CurrencyAmount,
} from '../portal/finance/shared'
import BuyerDocDetailModal from './BuyerDocDetailModal'

const LIMIT = 20

// ── Mobile card ───────────────────────────────────────────────────────────────

function BuyerDocCard({ doc, onView }: { doc: FinDocListItem; onView: () => void }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-xs text-slate-200 truncate">{doc.doc_number}</span>
        <StatusBadge status={doc.estado} />
      </div>
      <p className="text-[11px] text-slate-400 truncate">{doc.concept}</p>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{fmtDate(doc.issued_at)}</span>
        <CurrencyAmount amount={doc.total_amount} currency={doc.currency} className="text-slate-200 font-semibold" />
      </div>
      <div className="flex justify-end">
        <button
          onClick={onView}
          className="text-[11px] text-[#1A5A96] hover:text-[#2470b8] cursor-pointer transition-colors"
        >
          Ver detalle
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgId: string
  search: string
}

export default function BuyerDocList({ orgId, search }: Props) {
  const [items, setItems]         = useState<FinDocListItem[]>([])
  const [total, setTotal]         = useState(0)
  const [offset, setOffset]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getBuyerDocuments(supabase, orgId, {
        limit: LIMIT, offset: off, search: search || null,
      })
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [orgId, search])

  useEffect(() => { load(0) }, [load])

  const isEmpty = !loading && !error && items.length === 0

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">Resúmenes de compra</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {loading ? 'Cargando…' : `${total} documento${total !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={() => load(0)}
          disabled={loading}
          aria-label="Actualizar lista de resúmenes"
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
                <Th>Concepto</Th>
                <Th>Fecha</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th>{''}</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={6} />
              ) : isEmpty ? (
                <tr>
                  <td colSpan={6} className="py-8">
                    {search
                      ? <EmptyState icon={FileText} message="No se encontraron documentos con esta búsqueda." />
                      : <EmptyState icon={FileText} message="Aún no tienes resúmenes de compra disponibles." />
                    }
                  </td>
                </tr>
              ) : items.map(doc => (
                <tr
                  key={doc.id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(doc.id)}
                >
                  <Td mono className="text-slate-200">{doc.doc_number}</Td>
                  <Td className="text-slate-400 max-w-[200px] truncate">{doc.concept}</Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(doc.issued_at)}</Td>
                  <Td>
                    <CurrencyAmount amount={doc.total_amount} currency={doc.currency} className="text-slate-200 font-semibold" />
                  </Td>
                  <Td><StatusBadge status={doc.estado} /></Td>
                  <Td>
                    <button
                      onClick={e => { e.stopPropagation(); setSelectedId(doc.id) }}
                      className="text-[11px] text-[#1A5A96] hover:text-[#2470b8] cursor-pointer transition-colors"
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
          <div className="text-center py-8 text-slate-500 text-xs">Cargando resúmenes…</div>
        ) : isEmpty ? (
          search
            ? <EmptyState icon={FileText} message="No se encontraron documentos con esta búsqueda." />
            : <EmptyState icon={FileText} message="Aún no tienes resúmenes de compra disponibles." />
        ) : (
          <>
            {items.map(doc => (
              <BuyerDocCard key={doc.id} doc={doc} onView={() => setSelectedId(doc.id)} />
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

      {/* Disclaimer — siempre visible */}
      <p className="text-[10px] text-slate-600 leading-relaxed">
        Resumen informativo de la compra realizada en el Marketplace. No constituye factura fiscal.
      </p>

      {selectedId && (
        <BuyerDocDetailModal documentId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
