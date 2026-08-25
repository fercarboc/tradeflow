// MP-FIN-4 — Provider Disputes Tab
// Disputas del proveedor con capacidad de añadir evidencias (texto/referencia).

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ShieldAlert, AlertTriangle } from 'lucide-react'
import {
  listSupplierDisputes, getDispute, addDisputeEvidence,
  type SupplierDisputeListItem, type DisputeDetail, type EvidenceType,
} from '../../../lib/marketplace/finance/dispute.service'
import {
  SimBanner, CurrencyAmount, StatusBadge, fmtDate, fmtDateTime,
  PaginationBar, Th, Td, LoadingRow, EmptyState, Modal, ErrorBox,
} from './shared'

const LIMIT = 20

const EVIDENCE_TYPES: EvidenceType[] = [
  'invoice',
  'delivery_proof',
  'tracking',
  'conversation',
  'acceptance',
  'pod',
  'photo',
  'conditions',
  'other',
]

function DisputeDetailModal({ disputeId, onClose }: { disputeId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<DisputeDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEvidenceForm, setShowEvidenceForm] = useState(false)
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('other')
  const [evidenceDesc, setEvidenceDesc] = useState('')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setLoading(true)
    getDispute(disputeId)
      .then(setDetail)
      .catch(e => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [disputeId])

  useEffect(() => { reload() }, [reload])

  const submitEvidence = async () => {
    if (!evidenceDesc.trim() && !evidenceRef.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await addDisputeEvidence({
        disputeId,
        evidenceType,
        description: evidenceDesc.trim() || undefined,
        documentReference: evidenceRef.trim() || undefined,
      })
      setShowEvidenceForm(false)
      setEvidenceDesc('')
      setEvidenceRef('')
      reload()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const selectCls = "w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
  const inputCls = "w-full bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded px-2.5 py-1.5 focus:outline-none focus:border-blue-500"

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <span className="font-mono">{detail?.dispute_number ?? '…'}</span>
          {detail && <StatusBadge status={detail.status} />}
        </span>
      }
      onClose={onClose}
    >
      {loading && <div className="text-slate-500 text-xs py-4">Cargando…</div>}
      {error && <ErrorBox message={error} />}
      {detail && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Motivo: </span><span className="text-slate-300">{detail.reason ?? '—'}</span></div>
            <div><span className="text-slate-500">Importe: </span><CurrencyAmount amount={detail.amount} currency={detail.currency} className="text-red-400" /></div>
            <div><span className="text-slate-500">Abierta: </span><span className="text-slate-300">{fmtDate(detail.opened_at)}</span></div>
            {detail.evidence_due_at && (
              <div><span className="text-slate-500">Plazo evidencias: </span><span className="text-amber-300">{fmtDate(detail.evidence_due_at)}</span></div>
            )}
          </div>

          {detail.chargeback_posted && (
            <div className="flex items-start gap-2 bg-red-950/20 border border-red-800/40 rounded px-2.5 py-2 text-[10px] text-red-400">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>Chargeback aplicado: <strong>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2 }).format(detail.chargeback_amount ?? 0)} {detail.currency}</strong></span>
            </div>
          )}

          {/* Evidencias existentes */}
          {detail.evidence.length > 0 && (
            <div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-2">Evidencias aportadas ({detail.evidence.length})</div>
              <div className="space-y-2">
                {detail.evidence.map(ev => (
                  <div key={ev.id} className="bg-slate-800/60 border border-slate-700 rounded p-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-300 font-semibold">{ev.evidence_type.replace(/_/g, ' ')}</span>
                      <span className="text-[9px] text-slate-600">{fmtDateTime(ev.submitted_at)}</span>
                    </div>
                    {ev.description && <p className="text-slate-400">{ev.description}</p>}
                    {ev.document_reference && <p className="text-slate-500 mt-0.5">Ref: {ev.document_reference}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Añadir evidencia */}
          {(detail.status === 'opened' || detail.status === 'needs_response' || detail.status === 'under_review') && (
            <div>
              {!showEvidenceForm ? (
                <button onClick={() => setShowEvidenceForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-600 text-xs text-slate-300 hover:bg-slate-700 cursor-pointer transition-colors">
                  + Añadir evidencia
                </button>
              ) : (
                <div className="space-y-2 bg-slate-800/40 border border-slate-700 rounded p-3">
                  <div className="text-[9px] text-slate-500 uppercase tracking-wider">Nueva evidencia</div>
                  <select value={evidenceType} onChange={e => setEvidenceType(e.target.value as EvidenceType)} className={selectCls}>
                    {EVIDENCE_TYPES.map(t => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <textarea
                    value={evidenceDesc}
                    onChange={e => setEvidenceDesc(e.target.value)}
                    placeholder="Descripción de la evidencia…"
                    rows={3}
                    className={`${inputCls} resize-none`}
                  />
                  <input
                    value={evidenceRef}
                    onChange={e => setEvidenceRef(e.target.value)}
                    placeholder="Número de referencia (opcional)"
                    className={inputCls}
                  />
                  {submitError && <ErrorBox message={submitError} />}
                  <div className="flex gap-2">
                    <button onClick={submitEvidence} disabled={submitting || (!evidenceDesc.trim() && !evidenceRef.trim())}
                      className="flex-1 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500 disabled:opacity-50 cursor-pointer transition-colors">
                      {submitting ? 'Enviando…' : 'Enviar evidencia'}
                    </button>
                    <button onClick={() => setShowEvidenceForm(false)}
                      className="px-3 py-1.5 rounded border border-slate-700 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="text-[10px] text-slate-700 font-mono">ID: {detail.dispute_id}</div>
        </div>
      )}
    </Modal>
  )
}

export default function ProviderDisputes({ actorId }: { actorId: string }) {
  const [items, setItems] = useState<SupplierDisputeListItem[]>([])
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const openCount = items.filter(d => d.status === 'opened' || d.status === 'needs_response' || d.status === 'under_review').length

  const load = useCallback(async (off = 0) => {
    setLoading(true)
    setError(null)
    try {
      const res = await listSupplierDisputes(actorId, LIMIT, off)
      setItems(res)
      setOffset(off)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [actorId])

  useEffect(() => { load(0) }, [load])

  return (
    <div className="space-y-4">
      <SimBanner />

      {openCount > 0 && (
        <div className="flex items-center gap-2 bg-red-950/20 border border-red-800/50 rounded-lg px-3 py-2 text-xs text-red-400">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{openCount} disputa{openCount !== 1 ? 's' : ''} abierta{openCount !== 1 ? 's' : ''} — revisa y aporta evidencias antes del plazo.</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-200">Disputas</h2>
        <button onClick={() => load(0)} disabled={loading}
          className="h-7 w-7 rounded border border-slate-700 flex items-center justify-center hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && <ErrorBox message={error} />}

      <div className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <Th>Disputa</Th>
                <Th>Importe</Th>
                <Th>Estado</Th>
                <Th>Chargeback</Th>
                <Th>Abierta</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <LoadingRow cols={5} />
              ) : items.length === 0 ? (
                <tr><td colSpan={5} className="py-8"><EmptyState icon={ShieldAlert} message="Sin disputas" /></td></tr>
              ) : items.map(row => (
                <tr key={row.dispute_id}
                  className="border-b border-slate-700/50 hover:bg-slate-800/60 transition-colors cursor-pointer"
                  onClick={() => setSelectedId(row.dispute_id)}>
                  <Td mono className="text-slate-200">{row.dispute_number}</Td>
                  <Td><CurrencyAmount amount={row.amount} currency={row.currency} className="text-red-400" /></Td>
                  <Td><StatusBadge status={row.status} /></Td>
                  <Td className={row.chargeback_posted ? 'text-red-400' : 'text-slate-600'}>
                    {row.chargeback_posted ? '✓' : '—'}
                  </Td>
                  <Td className="text-slate-500 text-[10px]">{fmtDate(row.opened_at)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === LIMIT && (
          <div className="flex justify-end px-4 py-2.5 border-t border-slate-700">
            <button onClick={() => load(offset + LIMIT)}
              className="px-3 py-1 rounded border border-slate-700 text-xs text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors">
              Cargar más
            </button>
          </div>
        )}
      </div>

      {selectedId && (
        <DisputeDetailModal disputeId={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  )
}
