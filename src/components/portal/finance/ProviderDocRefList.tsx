// MP-FIN-5B — Provider-emitted document references list.
// Desktop: table. Mobile: stacked cards. "+ Registrar" opens RegisterDocRefModal.
// Independent refresh. No edit/delete — references are append-only.
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Receipt, Plus } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import {
  listProviderDocRefs,
  type ProviderDocRef,
} from '../../../lib/marketplace/finance/financial-documents.service'
import {
  fmtDate, PaginationBar, Th, Td, LoadingRow, EmptyState, ErrorBox, CurrencyAmount,
} from './shared'
import { getDocRefTypeLabel } from './doc-helpers'
import RegisterDocRefModal from './RegisterDocRefModal'

const LIMIT = 20

// ── Mobile card (module-level — no inner components) ──────────────────────────

function DocRefCard({ docRef }: { docRef: ProviderDocRef }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[9px] text-slate-400 bg-slate-700/50 px-1.5 py-0.5 rounded shrink-0 uppercase tracking-wide">
          {getDocRefTypeLabel(docRef.doc_type)}
        </span>
        <span className="font-mono text-xs text-slate-200 truncate">{docRef.doc_number_provider}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{fmtDate(docRef.doc_date_provider)}</span>
        {docRef.doc_amount != null
          ? <CurrencyAmount amount={docRef.doc_amount} currency={docRef.doc_currency} className="text-slate-300" />
          : <span className="text-slate-600">Sin importe</span>}
      </div>
      {docRef.notes && (
        <p className="text-[10px] text-slate-500 truncate">{docRef.notes}</p>
      )}
      <div className="text-[10px] text-slate-600">
        Registrado {fmtDate(docRef.registered_at)}
      </div>
    </div>
  )
}

// ── Main list ─────────────────────────────────────────────────────────────────

export default function ProviderDocRefList({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<ProviderDocRef[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listProviderDocRefs(supabase, actorId, { limit: LIMIT, offset: off })
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
          <h3 className="text-sm font-semibold text-slate-200">Documentos emitidos</h3>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {total} referencia{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-teal-700/50 bg-teal-900/20 text-teal-400 hover:bg-teal-900/40 cursor-pointer transition-colors text-[11px] font-medium"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Registrar</span>
          </button>
          <button
            onClick={() => load(0)}
            disabled={loading}
            className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <ErrorBox message={error} />}

      {/* Desktop table */}
      <div className="hidden sm:block bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Tipo</Th>
                <Th>Nº documento</Th>
                <Th>Fecha</Th>
                <Th>Importe</Th>
                <Th>Pedido</Th>
                <Th>Notas</Th>
                <Th>Registrado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={7} />
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8">
                    <EmptyState icon={Receipt} message="Aún no has registrado referencias documentales." />
                  </td>
                </tr>
              ) : items.map(ref => (
                <tr key={ref.id} className="border-b border-slate-700/50">
                  <Td>
                    <span className="text-[9px] text-slate-300 bg-slate-700/50 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {getDocRefTypeLabel(ref.doc_type)}
                    </span>
                  </Td>
                  <Td mono className="text-slate-200">{ref.doc_number_provider}</Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(ref.doc_date_provider)}</Td>
                  <Td>
                    {ref.doc_amount != null
                      ? <CurrencyAmount amount={ref.doc_amount} currency={ref.doc_currency} />
                      : <span className="text-slate-600">—</span>}
                  </Td>
                  <Td className="text-slate-500 text-[10px]">
                    {/* Abbreviated UUID — not primary info */}
                    <span title={ref.supplier_order_id}>…{ref.supplier_order_id.slice(-8)}</span>
                  </Td>
                  <Td className="text-slate-500 max-w-[120px] truncate">{ref.notes ?? '—'}</Td>
                  <Td className="text-slate-600 text-[10px]">{fmtDate(ref.registered_at)}</Td>
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
          <div className="text-center py-8 text-slate-500 text-xs">Cargando referencias…</div>
        ) : items.length === 0 ? (
          <EmptyState icon={Receipt} message="Aún no has registrado referencias documentales." />
        ) : (
          <>
            {items.map(ref => (
              <DocRefCard key={ref.id} docRef={ref} />
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

      {/* Disclaimer */}
      <p className="text-[10px] text-slate-600 leading-relaxed">
        TrabFlow registra únicamente la referencia de este documento. El documento fiscal, cuando corresponda, es emitido por el proveedor.
      </p>

      {showRegister && (
        <RegisterDocRefModal
          actorId={actorId}
          onSuccess={() => { setShowRegister(false); load(0) }}
          onClose={() => setShowRegister(false)}
        />
      )}
    </div>
  )
}
