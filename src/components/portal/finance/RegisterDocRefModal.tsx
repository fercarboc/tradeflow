// MP-FIN-5B — Register provider document reference form.
// Uses getProviderSupplierOrders to build a human-friendly order selector (no UUID input).
// Validates client-side; server is authority. Keeps modal open on error.
import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../../lib/supabase'
import {
  registerProviderDocRef,
  PROVIDER_DOC_REF_TYPES,
  type ProviderDocRefType,
} from '../../../lib/marketplace/finance/financial-documents.service'
import {
  getProviderSupplierOrders,
  type ProviderSupplierOrderListItem,
} from '../../../lib/marketplace/finance/provider-finance.service'
import { Modal, ErrorBox } from './shared'
import { getDocRefTypeLabel, formatOrderSelectorLabel } from './doc-helpers'

interface Props {
  actorId: string
  onSuccess: () => void
  onClose: () => void
}

export default function RegisterDocRefModal({ actorId, onSuccess, onClose }: Props) {
  // Order selector
  const [orders, setOrders] = useState<ProviderSupplierOrderListItem[]>([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [ordersError, setOrdersError] = useState<string | null>(null)

  // Form fields
  const [supplierOrderId, setSupplierOrderId] = useState('')
  const [docType, setDocType] = useState<ProviderDocRefType>('invoice')
  const [docNumber, setDocNumber] = useState('')
  const [docDate, setDocDate] = useState('')
  const [docAmount, setDocAmount] = useState('')
  const [docCurrency, setDocCurrency] = useState('EUR')
  const [notes, setNotes] = useState('')

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Load first 50 orders for selector — sufficient for most providers
  useEffect(() => {
    getProviderSupplierOrders(actorId, 50, 0)
      .then(res => setOrders(res.items))
      .catch(e => setOrdersError(e instanceof Error ? e.message : String(e)))
      .finally(() => setOrdersLoading(false))
  }, [actorId])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!supplierOrderId) errs.supplierOrderId = 'Selecciona un pedido.'
    if (!docNumber.trim()) errs.docNumber = 'El número de documento es obligatorio.'
    if (docNumber.trim().length > 500) errs.docNumber = 'El número no puede superar 500 caracteres.'
    if (!docDate) errs.docDate = 'La fecha es obligatoria.'
    if (docAmount && (isNaN(Number(docAmount)) || Number(docAmount) < 0)) {
      errs.docAmount = 'El importe debe ser un número positivo.'
    }
    if (docCurrency.trim() && docCurrency.trim().length !== 3) {
      errs.docCurrency = 'La divisa debe tener exactamente 3 letras (ej. EUR).'
    }
    if (notes.length > 500) errs.notes = 'Las notas no pueden superar 500 caracteres.'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await registerProviderDocRef(supabase, {
        supplierOrderId,
        docType,
        docNumberProvider: docNumber.trim(),
        docDateProvider:   docDate,
        docAmount:         docAmount ? Number(docAmount) : null,
        docCurrency:       docCurrency.trim().toUpperCase() || 'EUR',
        notes:             notes.trim() || null,
      })
      onSuccess()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const inputCls = 'w-full bg-slate-800 border border-slate-600 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-teal-600 transition-colors'
  const labelCls = 'block text-[10px] text-slate-400 mb-1 font-medium'
  const errCls   = 'text-[10px] text-red-400 mt-0.5'

  return (
    <Modal title="Registrar referencia documental" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">

        {submitError && <ErrorBox message={submitError} />}

        {/* Pedido — select con etiqueta humana, nunca UUID directo */}
        <div>
          <label className={labelCls} htmlFor="rdrf-order">
            Pedido proveedor <span className="text-red-400">*</span>
          </label>
          {ordersLoading ? (
            <div className="text-slate-500 text-[11px] py-1.5">Cargando pedidos…</div>
          ) : ordersError ? (
            <ErrorBox message={`No se pudieron cargar los pedidos: ${ordersError}`} />
          ) : orders.length === 0 ? (
            <p className="text-[11px] text-slate-500 py-1">
              No hay pedidos disponibles. Necesitas al menos un pedido para registrar una referencia.
            </p>
          ) : (
            <select
              id="rdrf-order"
              value={supplierOrderId}
              onChange={e => setSupplierOrderId(e.target.value)}
              className={inputCls}
            >
              <option value="">— Selecciona un pedido —</option>
              {orders.map(o => (
                <option key={o.id} value={o.id}>
                  {formatOrderSelectorLabel(o.numero, o.goods_gross_snapshot, o.shipping_gross_snapshot, o.currency)}
                </option>
              ))}
            </select>
          )}
          {fieldErrors.supplierOrderId && <p className={errCls}>{fieldErrors.supplierOrderId}</p>}
        </div>

        {/* Tipo de documento */}
        <div>
          <label className={labelCls} htmlFor="rdrf-type">
            Tipo de documento <span className="text-red-400">*</span>
          </label>
          <select
            id="rdrf-type"
            value={docType}
            onChange={e => setDocType(e.target.value as ProviderDocRefType)}
            className={inputCls}
          >
            {PROVIDER_DOC_REF_TYPES.map(t => (
              <option key={t} value={t}>{getDocRefTypeLabel(t)}</option>
            ))}
          </select>
        </div>

        {/* Número de documento */}
        <div>
          <label className={labelCls} htmlFor="rdrf-number">
            Número de documento <span className="text-red-400">*</span>
          </label>
          <input
            id="rdrf-number"
            type="text"
            value={docNumber}
            onChange={e => setDocNumber(e.target.value)}
            maxLength={500}
            placeholder="ej. FAC-2026-0123"
            className={inputCls}
          />
          {fieldErrors.docNumber && <p className={errCls}>{fieldErrors.docNumber}</p>}
        </div>

        {/* Fecha */}
        <div>
          <label className={labelCls} htmlFor="rdrf-date">
            Fecha del documento <span className="text-red-400">*</span>
          </label>
          <input
            id="rdrf-date"
            type="date"
            value={docDate}
            onChange={e => setDocDate(e.target.value)}
            className={inputCls}
          />
          {fieldErrors.docDate && <p className={errCls}>{fieldErrors.docDate}</p>}
        </div>

        {/* Importe + Divisa */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="rdrf-amount">Importe (opcional)</label>
            <input
              id="rdrf-amount"
              type="number"
              min="0"
              step="0.01"
              value={docAmount}
              onChange={e => setDocAmount(e.target.value)}
              placeholder="0.00"
              className={inputCls}
            />
            {fieldErrors.docAmount && <p className={errCls}>{fieldErrors.docAmount}</p>}
          </div>
          <div>
            <label className={labelCls} htmlFor="rdrf-currency">Divisa (opcional)</label>
            <input
              id="rdrf-currency"
              type="text"
              value={docCurrency}
              onChange={e => setDocCurrency(e.target.value.toUpperCase().slice(0, 3))}
              maxLength={3}
              placeholder="EUR"
              className={`${inputCls} uppercase`}
            />
            {fieldErrors.docCurrency && <p className={errCls}>{fieldErrors.docCurrency}</p>}
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className={labelCls} htmlFor="rdrf-notes">
            Notas (opcional)
          </label>
          <textarea
            id="rdrf-notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Opcional — máx. 500 caracteres"
            className={`${inputCls} resize-none`}
          />
          {fieldErrors.notes && <p className={errCls}>{fieldErrors.notes}</p>}
          {notes.length > 450 && (
            <p className="text-[10px] text-slate-600 mt-0.5">{notes.length}/500</p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-3 pt-1 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded border border-slate-600 text-slate-400 hover:bg-slate-700 cursor-pointer transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || ordersLoading || orders.length === 0}
            className="px-4 py-1.5 rounded bg-teal-700 hover:bg-teal-600 text-white font-medium cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
          >
            {submitting ? 'Registrando…' : 'Registrar'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
