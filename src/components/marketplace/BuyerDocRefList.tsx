// MP-FIN-5C — Bloque B: Referencias documentales de proveedor visibles al comprador.
// Solo lectura. actor_nombre y supplier_order_numero vienen del servidor (JOIN en RPC).
// No UUID como información principal. No botón de registro.
// No inner components — todos definidos a nivel de módulo.
import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  listBuyerDocRefs,
  type BuyerDocRef,
  type ProviderDocRefType,
} from '../../lib/marketplace/finance/financial-documents.service'
import {
  fmtDate, CurrencyAmount, PaginationBar, Th, Td, LoadingRow, EmptyState, ErrorBox,
} from '../portal/finance/shared'
import { getDocRefTypeLabel } from '../portal/finance/doc-helpers'

const LIMIT = 20

const DOC_TYPE_OPTIONS: { value: ProviderDocRefType | ''; label: string }[] = [
  { value: '',              label: 'Todos' },
  { value: 'invoice',       label: 'Facturas' },
  { value: 'credit_note',   label: 'Rectificativas' },
  { value: 'delivery_note', label: 'Albaranes' },
  { value: 'other',         label: 'Otros' },
]

// ── Mobile card (module-level) ────────────────────────────────────────────────

function DocRefCard({ ref: r }: { ref: BuyerDocRef }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
          {getDocRefTypeLabel(r.doc_type)}
        </span>
        <span className="font-mono text-xs text-slate-200 truncate text-right">{r.doc_number_provider}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400 truncate">{r.actor_nombre}</span>
        <span className="text-slate-500 font-mono text-[10px] shrink-0 ml-2">{r.supplier_order_numero}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-500">{fmtDate(r.doc_date_provider)}</span>
        {r.doc_amount != null ? (
          <CurrencyAmount amount={r.doc_amount} currency={r.doc_currency} className="text-slate-300" />
        ) : (
          <span className="text-slate-600">—</span>
        )}
      </div>
      {r.notes && (
        <p className="text-[10px] text-slate-600 truncate">{r.notes}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  orgId: string
  search: string
}

export default function BuyerDocRefList({ orgId, search }: Props) {
  const [items, setItems]       = useState<BuyerDocRef[]>([])
  const [total, setTotal]       = useState(0)
  const [offset, setOffset]     = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [docType, setDocType]   = useState<ProviderDocRefType | ''>('')

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listBuyerDocRefs(supabase, orgId, {
        limit:   LIMIT,
        offset:  off,
        search:  search || null,
        docType: (docType || null) as ProviderDocRefType | null,
      })
      setItems(res.items)
      setTotal(res.total)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [orgId, search, docType])

  useEffect(() => { load(0) }, [load])

  const isEmpty = !loading && !error && items.length === 0

  return (
    <div className="space-y-3">
      {/* Header + filtro tipo */}
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Documentos de proveedores</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {loading ? 'Cargando…' : `${total} referencia${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro de tipo */}
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as ProviderDocRefType | '')}
            className="text-[11px] bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 cursor-pointer"
            aria-label="Filtrar por tipo de documento"
          >
            {DOC_TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button
            onClick={() => load(0)}
            disabled={loading}
            aria-label="Actualizar lista de documentos de proveedor"
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
                <Th>Proveedor</Th>
                <Th>Pedido</Th>
                <Th>Fecha ref.</Th>
                <Th>Importe</Th>
                <Th>Registrado</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={7} />
              ) : isEmpty ? (
                <tr>
                  <td colSpan={7} className="py-8">
                    {search || docType
                      ? <EmptyState icon={Receipt} message="No se encontraron documentos con esta búsqueda." />
                      : <EmptyState icon={Receipt} message="Aún no hay documentos registrados por tus proveedores." />
                    }
                  </td>
                </tr>
              ) : items.map(r => (
                <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-800/40 transition-colors">
                  <Td>
                    <span className="text-[9px] bg-slate-700/50 text-slate-300 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {getDocRefTypeLabel(r.doc_type)}
                    </span>
                  </Td>
                  <Td mono className="text-slate-200">{r.doc_number_provider}</Td>
                  <Td className="text-slate-300 max-w-[150px] truncate">{r.actor_nombre}</Td>
                  <Td mono className="text-slate-400 text-[10px]">
                    <span title={r.supplier_order_id}>{r.supplier_order_numero}</span>
                  </Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(r.doc_date_provider)}</Td>
                  <Td>
                    {r.doc_amount != null
                      ? <CurrencyAmount amount={r.doc_amount} currency={r.doc_currency} className="text-slate-300" />
                      : <span className="text-slate-600">—</span>
                    }
                  </Td>
                  <Td className="text-slate-600 text-[10px]">{fmtDate(r.registered_at)}</Td>
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
        ) : isEmpty ? (
          search || docType
            ? <EmptyState icon={Receipt} message="No se encontraron documentos con esta búsqueda." />
            : <EmptyState icon={Receipt} message="Aún no hay documentos registrados por tus proveedores." />
        ) : (
          <>
            {items.map(r => <DocRefCard key={r.id} ref={r} />)}
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
        Documento registrado por el proveedor. TrabFlow muestra únicamente la referencia disponible.
        El documento fiscal, cuando corresponda, es emitido por el proveedor.
      </p>
    </div>
  )
}
