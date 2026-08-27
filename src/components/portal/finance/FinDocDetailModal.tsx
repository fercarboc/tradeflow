// MP-FIN-5B — Financial document detail modal.
// Renders SEMANTICALLY based on document_subtype (not generic JSON).
// supplier_statement: supplier_order snapshot + items table.
// settlement_statement: settlement snapshot + lines table + simulation warning.
import { useEffect, useState } from 'react'
import { FileText, Lock, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../lib/supabase'
import {
  getDocumentDetail,
  type FinDocDetail,
} from '../../../lib/marketplace/finance/financial-documents.service'
import {
  Modal, StatusBadge, CurrencyAmount, fmtDate, fmtDateTime, ErrorBox, Th, Td,
} from './shared'
import {
  getDocSubtypeLabel,
  getSettlementLineLabel,
  extractSupplierStatementMeta,
  extractSettlementStatementMeta,
  type SupplierStatementMeta,
  type SettlementStatementMeta,
} from './doc-helpers'

// ── Supplier Statement body (module-level — no inner components) ───────────────

function SupplierStatementBody({ doc, meta }: { doc: FinDocDetail; meta: SupplierStatementMeta }) {
  const so = meta.supplier_order
  const items = meta.items ?? []
  const currency = doc.currency

  return (
    <div className="space-y-4 text-xs">
      {/* Pedido de referencia */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <span className="text-slate-500">Pedido proveedor: </span>
          <span className="font-mono text-slate-200">{so.numero}</span>
        </div>
        <div>
          <span className="text-slate-500">Estado pedido: </span>
          <StatusBadge status={so.estado} />
        </div>
        {so.confirmed_at && (
          <div>
            <span className="text-slate-500">Confirmado: </span>
            <span className="text-slate-300">{fmtDate(so.confirmed_at)}</span>
          </div>
        )}
        {so.financial_snapshot_at && (
          <div>
            <span className="text-slate-500">Snapshot: </span>
            <span className="text-slate-400 text-[10px]">{fmtDateTime(so.financial_snapshot_at)}</span>
          </div>
        )}
        {so.delivery_method && (
          <div className="col-span-2">
            <span className="text-slate-500">Método de envío: </span>
            <span className="text-slate-300">{so.delivery_method}</span>
          </div>
        )}
        {so.notas && (
          <div className="col-span-2">
            <span className="text-slate-500">Notas: </span>
            <span className="text-slate-400">{so.notas}</span>
          </div>
        )}
      </div>

      {/* Importes del documento */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Importes del pedido</div>
        {so.goods_gross_snapshot != null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Mercancía (gross)</span>
            <CurrencyAmount amount={so.goods_gross_snapshot} currency={currency} className="text-emerald-400" />
          </div>
        )}
        {so.shipping_gross_snapshot != null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Envío (gross)</span>
            <CurrencyAmount amount={so.shipping_gross_snapshot} currency={currency} />
          </div>
        )}
        {so.tax_rate_snapshot != null && so.tax_rate_snapshot > 0 && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">IVA ({so.tax_rate_snapshot}%)</span>
            <CurrencyAmount
              amount={(so.goods_tax_snapshot ?? 0) + (so.shipping_tax_snapshot ?? 0)}
              currency={currency}
              className="text-slate-500"
            />
          </div>
        )}
        <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold">
          <span className="text-white">Total documento</span>
          <CurrencyAmount amount={doc.total_amount} currency={currency} className="text-white" />
        </div>
      </div>

      {/* Líneas */}
      {items.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">
            Líneas del pedido
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <Th>Descripción</Th>
                    <Th>Ref.</Th>
                    <Th>Ud.</Th>
                    <Th>Cant.</Th>
                    <Th>Precio neto</Th>
                    <Th>Total neto</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => (
                    <tr key={it.id ?? String(idx)} className="border-b border-slate-700/50">
                      <Td className="text-slate-300 max-w-[160px] truncate">
                        {it.descripcion ?? '—'}
                      </Td>
                      <Td mono className="text-slate-500 text-[10px]">{it.referencia ?? '—'}</Td>
                      <Td className="text-slate-500">{it.unidad ?? '—'}</Td>
                      <Td className="text-slate-300 tabular-nums">{it.cantidad}</Td>
                      <Td>
                        <CurrencyAmount
                          amount={it.precio_unitario_neto_snapshot ?? it.precio_unitario}
                          currency={it.currency}
                          className="text-slate-400"
                        />
                      </Td>
                      <Td>
                        <CurrencyAmount
                          amount={it.item_net_snapshot}
                          currency={it.currency}
                          className="text-slate-300 font-semibold"
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer — always visible */}
      <div className="text-[10px] text-slate-600 border-t border-slate-700/50 pt-3">
        Documento informativo. No constituye factura fiscal.
      </div>
    </div>
  )
}

// ── Settlement Statement body ──────────────────────────────────────────────────

function SettlementStatementBody({ doc, meta }: { doc: FinDocDetail; meta: SettlementStatementMeta }) {
  const s = meta.settlement
  const lines = meta.settlement_lines ?? []
  const currency = doc.currency
  const simOnly = meta.simulation_only

  return (
    <div className="space-y-4 text-xs">
      {/* Simulation warning — MUY visible por spec */}
      {simOnly && (
        <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 font-semibold text-[11px]">Operación simulada</p>
            <p className="text-amber-500 text-[10px] mt-0.5">
              Esta liquidación es una simulación interna. No representa una transferencia bancaria real.
            </p>
          </div>
        </div>
      )}

      {/* Periodo y estado */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <div>
          <span className="text-slate-500">Liquidación: </span>
          <span className="font-mono text-slate-200">{s.settlement_number}</span>
        </div>
        <div>
          <span className="text-slate-500">Estado: </span>
          <StatusBadge status={s.status} />
        </div>
        <div className="col-span-2">
          <span className="text-slate-500">Periodo: </span>
          <span className="text-slate-200">{fmtDate(s.period_start)} – {fmtDate(s.period_end)}</span>
        </div>
        {s.calculated_at && (
          <div>
            <span className="text-slate-500">Calculado: </span>
            <span className="text-slate-400 text-[10px]">{fmtDateTime(s.calculated_at)}</span>
          </div>
        )}
        {s.approved_at && (
          <div>
            <span className="text-slate-500">Aprobado: </span>
            <span className="text-emerald-400 text-[10px]">{fmtDateTime(s.approved_at)}</span>
          </div>
        )}
      </div>

      {/* Resumen financiero */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 space-y-1.5">
        <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">Resumen financiero</div>
        {s.sales_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Ventas del periodo</span>
            <CurrencyAmount amount={s.sales_amount} currency={currency} className="text-emerald-400" />
          </div>
        )}
        {s.shipping_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Portes</span>
            <CurrencyAmount amount={s.shipping_amount} currency={currency} />
          </div>
        )}
        {s.refund_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Devoluciones</span>
            <CurrencyAmount amount={-s.refund_amount} currency={currency} className="text-orange-400" />
          </div>
        )}
        {s.chargeback_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Disputas</span>
            <CurrencyAmount amount={-s.chargeback_amount} currency={currency} className="text-red-400" />
          </div>
        )}
        {s.chargeback_reversal_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Resolución disputas</span>
            <CurrencyAmount amount={s.chargeback_reversal_amount} currency={currency} className="text-emerald-400" />
          </div>
        )}
        {s.reserve_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Retenciones</span>
            <CurrencyAmount amount={-s.reserve_amount} currency={currency} className="text-blue-400" />
          </div>
        )}
        {s.reserve_release_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Lib. retenciones</span>
            <CurrencyAmount amount={s.reserve_release_amount} currency={currency} className="text-blue-300" />
          </div>
        )}
        {s.recovery_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-400">Recuperación saldo neg.</span>
            <CurrencyAmount amount={-s.recovery_amount} currency={currency} className="text-orange-400" />
          </div>
        )}
        {s.adjustment_amount !== 0 && s.adjustment_amount != null && (
          <div className="flex justify-between">
            <span className="text-slate-400">Ajuste</span>
            <CurrencyAmount amount={s.adjustment_amount} currency={currency} />
          </div>
        )}
        {s.commission_amount !== 0 && s.commission_amount != null && (
          <div className="flex justify-between text-[10px]">
            <span className="text-slate-500">Comisión plataforma</span>
            <CurrencyAmount amount={-s.commission_amount} currency={currency} className="text-slate-500" />
          </div>
        )}
        <div className="border-t border-slate-700 pt-1.5 flex justify-between font-bold">
          <span className="text-emerald-300">Importe liquidación (sim.)</span>
          <CurrencyAmount amount={doc.total_amount} currency={currency} className="text-emerald-300 font-bold" />
        </div>
      </div>

      {/* Movimientos incluidos */}
      {lines.length > 0 && (
        <div>
          <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">
            Movimientos incluidos
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700">
                    <Th>Concepto</Th>
                    <Th>Importe bruto</Th>
                    <Th>Incluido</Th>
                    <Th>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((ln, idx) => (
                    <tr key={ln.id ?? String(idx)} className="border-b border-slate-700/50">
                      <Td className="text-slate-300">{getSettlementLineLabel(ln.entry_type)}</Td>
                      <Td>
                        <CurrencyAmount amount={ln.gross_amount} currency={ln.currency} />
                      </Td>
                      <Td>
                        <CurrencyAmount
                          amount={ln.included_amount}
                          currency={ln.currency}
                          className="text-slate-200 font-semibold"
                        />
                      </Td>
                      <Td className="text-[9px] text-slate-500">{ln.line_status}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Disclaimer — always visible */}
      <div className="text-[10px] text-slate-500 border-t border-slate-700/50 pt-3">
        Documento informativo. Operación simulada. No constituye factura fiscal ni representa una transferencia bancaria real.
      </div>
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function FinDocDetailModal({
  documentId,
  onClose,
}: {
  documentId: string
  onClose: () => void
}) {
  const [doc, setDoc] = useState<FinDocDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDocumentDetail(supabase, documentId)
      .then(setDoc)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [documentId])

  const title = doc ? (
    <span className="flex items-center gap-2 flex-wrap">
      <FileText className="h-4 w-4 text-teal-400 shrink-0" />
      <span className="font-mono">{doc.doc_number}</span>
      <span className="text-[9px] text-slate-400 font-normal bg-slate-700/50 px-1.5 py-0.5 rounded uppercase tracking-wide">
        {getDocSubtypeLabel(doc.document_subtype)}
      </span>
      <StatusBadge status={doc.estado} />
      {doc.immutable_at && <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-label="Inmutable" />}
    </span>
  ) : <span className="text-slate-400">Cargando documento…</span>

  const renderBody = () => {
    if (!doc) return null
    if (doc.document_subtype === 'supplier_statement') {
      const meta = extractSupplierStatementMeta(doc.metadata)
      if (!meta) {
        return <div className="text-xs text-slate-500 py-2">Datos del documento no disponibles.</div>
      }
      return <SupplierStatementBody doc={doc} meta={meta} />
    }
    if (doc.document_subtype === 'settlement_statement') {
      const meta = extractSettlementStatementMeta(doc.metadata)
      if (!meta) {
        return <div className="text-xs text-slate-500 py-2">Datos del documento no disponibles.</div>
      }
      return <SettlementStatementBody doc={doc} meta={meta} />
    }
    return <div className="text-xs text-slate-500 py-2">Tipo de documento no soportado en este visor.</div>
  }

  return (
    <Modal title={title} onClose={onClose}>
      {loading && (
        <div className="text-slate-500 text-xs py-6 text-center">Cargando documento…</div>
      )}
      {error && (
        <ErrorBox message={`No se pudo cargar el detalle: ${error}`} />
      )}
      {!loading && !error && renderBody()}
    </Modal>
  )
}
