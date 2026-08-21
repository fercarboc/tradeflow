// Marketplace Purchase Summary Service — MP-FIN-1B.1D
// Prepara los datos del "Resumen de compra Marketplace" desde snapshots inmutables.
// NUNCA recalcula precios desde el catálogo actual (INV-007).
// INV-005: comisión TrabFlow no se expone al comprador.
// LEGAL_GATE: el documento resultante NO es factura fiscal.
// TAX_GATE: los tipos de IVA devueltos son los del snapshot (21% por defecto).

import { supabase } from '../../supabase'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface PurchaseSummaryItem {
  id:                        string
  referencia:                string | null
  descripcion:               string
  cantidad:                  number
  unidad:                    string
  precioUnitarioNeto:        number | null   // ex-IVA, del snapshot
  precioUnitarioLista:       number | null   // precio catálogo, ex-IVA
  descuentoTipo:             string | null
  descuentoImporte:          number
  taxRate:                   number          // % IVA (snapshot, ej. 21)
  itemNet:                   number | null   // base imponible línea
  itemTax:                   number | null   // IVA línea
  itemGross:                 number | null   // total línea con IVA
  hasSnapshot:               boolean
  currency:                  string
}

// Placeholder para factura del proveedor (estructura futura — MP-FIN-3+)
export interface InvoicePlaceholder {
  status:      'pending' | 'available'
  invoiceRef:  string | null
  invoiceDate: string | null
  downloadUrl: string | null
}

export interface PurchaseSummarySupplierBlock {
  supplierOrderId:      string
  numero:               string
  actorId:              string
  actorNombre:          string
  goodsNetSnapshot:     number | null
  goodsTaxSnapshot:     number | null
  goodsGrossSnapshot:   number | null
  shippingNetSnapshot:  number | null
  shippingTaxSnapshot:  number | null
  shippingGrossSnapshot: number | null
  financialSnapshotAt:  string | null
  paymentStatus:        string
  currency:             string
  deliveryMethod:       string | null
  paymentMethod:        string | null
  hasSnapshot:          boolean
  items:                PurchaseSummaryItem[]
  // Placeholder estructura futura para factura del proveedor
  invoicePlaceholder:   InvoicePlaceholder
}

export interface PurchaseSummaryMasterOrder {
  id:                 string
  numero:             string
  checkoutKey:        string
  orgId:              string | null
  buyerSnapshot:      Record<string, unknown>
  orderStatus:        string
  paymentStatus:      string
  goodsNetTotal:      number
  goodsTaxTotal:      number
  goodsGrossTotal:    number
  shippingNetTotal:   number
  shippingTaxTotal:   number
  shippingGrossTotal: number
  checkoutGrossTotal: number
  currency:           string
  isSimulation:       boolean   // external_provider === 'simulation'
  createdAt:          string
}

export interface PurchaseSummaryData {
  isLegacy:       boolean
  masterOrder:    PurchaseSummaryMasterOrder | null
  supplierOrders: PurchaseSummarySupplierBlock[]
  totals: {
    goodsNet:      number
    goodsTax:      number
    goodsGross:    number
    shippingGross: number
    totalGross:    number
    currency:      string
  }
}

// ── Mapeo JSONB → tipos ────────────────────────────────────────────────────────

function mapItem(raw: Record<string, unknown>): PurchaseSummaryItem {
  return {
    id:                  raw.id as string,
    referencia:          (raw.referencia as string | null) ?? null,
    descripcion:         raw.descripcion as string,
    cantidad:            Number(raw.cantidad ?? 0),
    unidad:              (raw.unidad as string) ?? 'ud',
    precioUnitarioNeto:  raw.precio_unitario_neto_snapshot != null ? Number(raw.precio_unitario_neto_snapshot) : null,
    precioUnitarioLista: raw.precio_unitario_lista_snapshot != null ? Number(raw.precio_unitario_lista_snapshot) : null,
    descuentoTipo:       (raw.descuento_tipo_snapshot as string | null) ?? null,
    descuentoImporte:    Number(raw.descuento_importe_snapshot ?? 0),
    taxRate:             Number(raw.tax_rate_snapshot ?? 21),
    itemNet:             raw.item_net_snapshot != null ? Number(raw.item_net_snapshot) : null,
    itemTax:             raw.item_tax_snapshot != null ? Number(raw.item_tax_snapshot) : null,
    itemGross:           raw.item_gross_snapshot != null ? Number(raw.item_gross_snapshot) : null,
    hasSnapshot:         Boolean(raw.has_snapshot),
    currency:            (raw.currency as string) ?? 'EUR',
  }
}

function mapSupplierBlock(raw: Record<string, unknown>): PurchaseSummarySupplierBlock {
  const items = ((raw.items as Array<Record<string, unknown>>) ?? []).map(mapItem)
  const inv   = (raw.invoice_placeholder as Record<string, unknown>) ?? {}
  return {
    supplierOrderId:      raw.supplier_order_id as string,
    numero:               raw.numero as string,
    actorId:              raw.actor_id as string,
    actorNombre:          raw.actor_nombre as string,
    goodsNetSnapshot:     raw.goods_net_snapshot != null ? Number(raw.goods_net_snapshot) : null,
    goodsTaxSnapshot:     raw.goods_tax_snapshot != null ? Number(raw.goods_tax_snapshot) : null,
    goodsGrossSnapshot:   raw.goods_gross_snapshot != null ? Number(raw.goods_gross_snapshot) : null,
    shippingNetSnapshot:  raw.shipping_net_snapshot != null ? Number(raw.shipping_net_snapshot) : null,
    shippingTaxSnapshot:  raw.shipping_tax_snapshot != null ? Number(raw.shipping_tax_snapshot) : null,
    shippingGrossSnapshot: raw.shipping_gross_snapshot != null ? Number(raw.shipping_gross_snapshot) : null,
    financialSnapshotAt:  (raw.financial_snapshot_at as string | null) ?? null,
    paymentStatus:        (raw.payment_status as string) ?? 'unpaid',
    currency:             (raw.currency as string) ?? 'EUR',
    deliveryMethod:       (raw.delivery_method as string | null) ?? null,
    paymentMethod:        (raw.payment_method as string | null) ?? null,
    hasSnapshot:          Boolean(raw.has_snapshot),
    items,
    invoicePlaceholder: {
      status:      (inv.status as 'pending' | 'available') ?? 'pending',
      invoiceRef:  (inv.invoice_ref as string | null) ?? null,
      invoiceDate: (inv.invoice_date as string | null) ?? null,
      downloadUrl: (inv.download_url as string | null) ?? null,
    },
  }
}

function mapMasterOrder(raw: Record<string, unknown>): PurchaseSummaryMasterOrder {
  return {
    id:                 raw.id as string,
    numero:             raw.numero as string,
    checkoutKey:        raw.checkout_key as string,
    orgId:              (raw.org_id as string | null) ?? null,
    buyerSnapshot:      (raw.buyer_snapshot as Record<string, unknown>) ?? {},
    orderStatus:        (raw.order_status as string) ?? 'created',
    paymentStatus:      (raw.payment_status as string) ?? 'unpaid',
    goodsNetTotal:      Number(raw.goods_net_total ?? 0),
    goodsTaxTotal:      Number(raw.goods_tax_total ?? 0),
    goodsGrossTotal:    Number(raw.goods_gross_total ?? 0),
    shippingNetTotal:   Number(raw.shipping_net_total ?? 0),
    shippingTaxTotal:   Number(raw.shipping_tax_total ?? 0),
    shippingGrossTotal: Number(raw.shipping_gross_total ?? 0),
    checkoutGrossTotal: Number(raw.checkout_gross_total ?? 0),
    currency:           (raw.currency as string) ?? 'EUR',
    isSimulation:       (raw.external_provider as string) === 'simulation',
    createdAt:          raw.created_at as string,
  }
}

function buildTotals(
  masterOrder: PurchaseSummaryMasterOrder | null,
  supplierOrders: PurchaseSummarySupplierBlock[]
): PurchaseSummaryData['totals'] {
  if (masterOrder) {
    return {
      goodsNet:      masterOrder.goodsNetTotal,
      goodsTax:      masterOrder.goodsTaxTotal,
      goodsGross:    masterOrder.goodsGrossTotal,
      shippingGross: masterOrder.shippingGrossTotal,
      totalGross:    masterOrder.checkoutGrossTotal,
      currency:      masterOrder.currency,
    }
  }
  // Legacy: sumar desde supplier orders
  const goodsGross    = supplierOrders.reduce((s, o) => s + (o.goodsGrossSnapshot ?? 0), 0)
  const shippingGross = supplierOrders.reduce((s, o) => s + (o.shippingGrossSnapshot ?? 0), 0)
  return {
    goodsNet:      0,
    goodsTax:      0,
    goodsGross,
    shippingGross,
    totalGross:    goodsGross + shippingGross,
    currency:      supplierOrders[0]?.currency ?? 'EUR',
  }
}

function mapSummaryData(raw: Record<string, unknown>): PurchaseSummaryData {
  const isLegacy       = Boolean(raw.is_legacy)
  const supplierOrders = ((raw.supplier_orders as Array<Record<string, unknown>>) ?? []).map(mapSupplierBlock)
  const masterOrder    = raw.master_order
    ? mapMasterOrder(raw.master_order as Record<string, unknown>)
    : null
  return {
    isLegacy,
    masterOrder,
    supplierOrders,
    totals: buildTotals(masterOrder, supplierOrders),
  }
}

// ── Puntos de entrada públicos ─────────────────────────────────────────────────

export async function getPurchaseSummaryByCheckoutKey(
  checkoutKey: string
): Promise<PurchaseSummaryData | null> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_purchase_summary_data', {
    p_checkout_key: checkoutKey,
    p_order_id:     null,
  })
  if (error) throw new Error(`getPurchaseSummaryByCheckoutKey: ${error.message}`)
  if (!data) return null
  return mapSummaryData(data as Record<string, unknown>)
}

export async function getPurchaseSummaryByOrderId(
  orderId: string
): Promise<PurchaseSummaryData | null> {
  const { data, error } = await (supabase as any).rpc('mkt_fin_get_purchase_summary_data', {
    p_checkout_key: null,
    p_order_id:     orderId,
  })
  if (error) throw new Error(`getPurchaseSummaryByOrderId: ${error.message}`)
  if (!data) return null
  return mapSummaryData(data as Record<string, unknown>)
}
