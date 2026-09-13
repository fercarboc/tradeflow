// MP-FIN-5C — Bloque B: Referencias documentales de proveedor visibles al comprador. Light UI.
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
import { fmtDate, CurrencyAmount } from '../portal/finance/shared'
import {
  LightTh, LightTd, LightLoadingRow,
  LightEmptyState, LightPaginationBar, LightErrorBox,
} from './BuyerDocShared'
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
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0">
          {getDocRefTypeLabel(r.doc_type)}
        </span>
        <span className="font-mono text-xs text-gray-900 truncate text-right">{r.doc_number_provider}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-500 truncate">{r.actor_nombre}</span>
        <span className="text-gray-400 font-mono text-[10px] shrink-0 ml-2">{r.supplier_order_numero}</span>
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-gray-400">{fmtDate(r.doc_date_provider)}</span>
        {r.doc_amount != null ? (
          <CurrencyAmount amount={r.doc_amount} currency={r.doc_currency} className="text-gray-700" />
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </div>
      {r.notes && (
        <p className="text-[10px] text-gray-400 truncate">{r.notes}</p>
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
  const [items, setItems]     = useState<BuyerDocRef[]>([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [docType, setDocType] = useState<ProviderDocRefType | ''>('')

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
            <h3 className="text-sm font-semibold text-gray-900">Documentos de proveedores</h3>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {loading ? 'Cargando…' : `${total} referencia${total !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Filtro de tipo */}
          <select
            value={docType}
            onChange={e => setDocType(e.target.value as ProviderDocRefType | '')}
            className="text-[11px] bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-700 cursor-pointer focus:outline-none focus:border-[#1A5A96]"
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
            className="h-7 w-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <LightErrorBox message={error} />}

      {/* Desktop table */}
      <div className="hidden sm:block bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <LightTh>Tipo</LightTh>
                <LightTh>Nº documento</LightTh>
                <LightTh>Proveedor</LightTh>
                <LightTh>Pedido</LightTh>
                <LightTh>Fecha ref.</LightTh>
                <LightTh>Importe</LightTh>
                <LightTh>Registrado</LightTh>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LightLoadingRow cols={7} />
              ) : isEmpty ? (
                <tr>
                  <td colSpan={7} className="py-8">
                    {search || docType
                      ? <LightEmptyState icon={Receipt} message="No se encontraron documentos con esta búsqueda." />
                      : <LightEmptyState icon={Receipt} message="Aún no hay documentos registrados por tus proveedores." />
                    }
                  </td>
                </tr>
              ) : items.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <LightTd>
                    <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded uppercase tracking-wide">
                      {getDocRefTypeLabel(r.doc_type)}
                    </span>
                  </LightTd>
                  <LightTd mono className="text-gray-900">{r.doc_number_provider}</LightTd>
                  <LightTd className="text-gray-700 max-w-[150px] truncate">{r.actor_nombre}</LightTd>
                  <LightTd mono className="text-gray-400 text-[10px]">
                    <span title={r.supplier_order_id}>{r.supplier_order_numero}</span>
                  </LightTd>
                  <LightTd className="text-gray-400 text-[10px]">{fmtDate(r.doc_date_provider)}</LightTd>
                  <LightTd>
                    {r.doc_amount != null
                      ? <CurrencyAmount amount={r.doc_amount} currency={r.doc_currency} className="text-gray-700" />
                      : <span className="text-gray-300">—</span>
                    }
                  </LightTd>
                  <LightTd className="text-gray-400 text-[10px]">{fmtDate(r.registered_at)}</LightTd>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > LIMIT && (
          <LightPaginationBar
            total={total} limit={LIMIT} offset={offset}
            onPrev={() => load(Math.max(0, offset - LIMIT))}
            onNext={() => load(offset + LIMIT)}
          />
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {loading ? (
          <div className="text-center py-8 text-gray-400 text-xs">Cargando documentos…</div>
        ) : isEmpty ? (
          search || docType
            ? <LightEmptyState icon={Receipt} message="No se encontraron documentos con esta búsqueda." />
            : <LightEmptyState icon={Receipt} message="Aún no hay documentos registrados por tus proveedores." />
        ) : (
          <>
            {items.map(r => <DocRefCard key={r.id} ref={r} />)}
            {total > LIMIT && (
              <LightPaginationBar
                total={total} limit={LIMIT} offset={offset}
                onPrev={() => load(Math.max(0, offset - LIMIT))}
                onNext={() => load(offset + LIMIT)}
              />
            )}
          </>
        )}
      </div>

      {/* Disclaimer — siempre visible */}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        Documento registrado por el proveedor. TrabFlow muestra únicamente la referencia disponible.
        El documento fiscal, cuando corresponda, es emitido por el proveedor.
      </p>
    </div>
  )
}
