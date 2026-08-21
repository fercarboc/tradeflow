// Marketplace Purchase Summary — MP-FIN-1B.1D
// Genera el HTML del "Resumen de compra Marketplace" y lo abre para imprimir/descargar.
// Patrón idéntico a printTradeInvoice.ts: window.open + HTML con CSS embebido.
// LEGAL_GATE: este documento NO es factura fiscal — wording provisional pendiente de dictamen jurídico.
// TAX_GATE: los importes mostrados son los snapshots inmutables del checkout.
// INV-005: comisión TrabFlow no aparece como cargo del comprador.

import type {
  PurchaseSummaryData,
  PurchaseSummarySupplierBlock,
  PurchaseSummaryItem,
} from './marketplace/finance/marketplace-purchase-summary.service'

// ── Helpers de formato ────────────────────────────────────────────────────────

function eur(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toFixed(2) + ' €'
}

function fmtDatetime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}

const DELIVERY_LABELS: Record<string, string> = {
  entrega_obra:       'Entrega en obra',
  entrega_almacen:    'Entrega en almacén/oficina',
  recogida_proveedor: 'Recogida en tienda/almacén',
  por_coordinar:      'Pendiente de coordinar',
}

const PAYMENT_LABELS: Record<string, string> = {
  cuenta_proveedor: 'Cuenta con proveedor',
  transferencia:    'Transferencia bancaria',
  pago_recoger:     'Pago al recoger',
  online:           'Pago online',
  domiciliacion:    'Domiciliación/crédito',
}

// ── Plantilla HTML por ítem ────────────────────────────────────────────────────

function buildItemRow(item: PurchaseSummaryItem, idx: number): string {
  const bg = idx % 2 === 0 ? '#fff' : '#f8fafc'

  if (!item.hasSnapshot || item.itemGross == null) {
    // Ítem legacy: mostrar lo que tenemos sin desglose fiscal
    const unitPrice = item.precioUnitarioNeto ?? 0
    const total     = unitPrice * item.cantidad
    return `
      <tr style="background:${bg}">
        <td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">
          ${escHtml(item.descripcion)}
          ${item.referencia ? `<div style="font-size:9px;font-family:monospace;color:#94a3b8;margin-top:2px">Ref: ${escHtml(item.referencia)}</div>` : ''}
        </td>
        <td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${item.cantidad} ${item.unidad}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">—</td>
        <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">—</td>
        <td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${eur(total)}</td>
      </tr>`
  }

  const descuentoHtml = (item.descuentoImporte > 0 && item.precioUnitarioLista != null)
    ? `<div style="font-size:9px;color:#94a3b8;margin-top:1px;text-decoration:line-through">${eur(item.precioUnitarioLista)}</div>`
    : ''

  return `
    <tr style="background:${bg}">
      <td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">
        ${escHtml(item.descripcion)}
        ${item.referencia ? `<div style="font-size:9px;font-family:monospace;color:#94a3b8;margin-top:2px">Ref: ${escHtml(item.referencia)}</div>` : ''}
      </td>
      <td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${item.cantidad} ${item.unidad}</td>
      <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">
        ${descuentoHtml}${eur(item.precioUnitarioNeto)}
      </td>
      <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${item.taxRate.toFixed(0)}%</td>
      <td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${eur(item.itemGross)}</td>
    </tr>`
}

// ── Bloque por proveedor ───────────────────────────────────────────────────────

function buildSupplierBlock(block: PurchaseSummarySupplierBlock, idx: number): string {
  const accentLight = idx % 2 === 0 ? '#eff6ff' : '#f0fdf4'
  const accentText  = idx % 2 === 0 ? '#1e40af' : '#166534'

  const items = block.items.map((it, i) => buildItemRow(it, i)).join('')

  const hasSnap = block.hasSnapshot

  const portesRow = (hasSnap && block.shippingGrossSnapshot != null && block.shippingGrossSnapshot > 0)
    ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569">
        <span>Portes${block.shippingTaxSnapshot ? ` (IVA ${(block.shippingTaxSnapshot / (block.shippingNetSnapshot || 1) * 100).toFixed(0)}% <span style="font-size:9px;color:#94a3b8">[TAX_GATE]</span>)` : ''}</span>
        <span>${eur(block.shippingGrossSnapshot)}</span>
       </div>`
    : ''

  const subtotalMerc = hasSnap
    ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569">
        <span>Base imponible mercancía</span><span>${eur(block.goodsNetSnapshot)}</span>
       </div>
       <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569">
        <span>IVA mercancía <span style="font-size:9px;color:#94a3b8">[TAX_GATE]</span></span><span>${eur(block.goodsTaxSnapshot)}</span>
       </div>`
    : ''

  const supplierTotal = hasSnap
    ? ((block.goodsGrossSnapshot ?? 0) + (block.shippingGrossSnapshot ?? 0))
    : null

  const deliveryLabel = block.deliveryMethod ? (DELIVERY_LABELS[block.deliveryMethod] ?? block.deliveryMethod) : null
  const paymentLabel  = block.paymentMethod  ? (PAYMENT_LABELS[block.paymentMethod]  ?? block.paymentMethod)  : null

  // Placeholder factura proveedor (estructura futura)
  const invoiceHtml = `
    <div style="margin-top:10px;padding:8px 12px;background:#fafafa;border:1px dashed #e2e8f0;border-radius:8px;font-size:10px;color:#94a3b8">
      <span style="font-weight:700;color:#64748b">Factura del proveedor:</span>
      Pendiente de emisión · <em>El proveedor emitirá su factura fiscal directamente</em>
    </div>`

  return `
    <div style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
      <!-- Cabecera proveedor -->
      <div style="background:${accentLight};padding:12px 16px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:#94a3b8;font-weight:700">Proveedor</div>
          <div style="font-size:14px;font-weight:800;color:${accentText};margin-top:2px">${escHtml(block.actorNombre)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;color:#94a3b8">Pedido proveedor</div>
          <div style="font-family:monospace;font-size:12px;font-weight:700;color:#0f172a">${escHtml(block.numero)}</div>
          ${deliveryLabel ? `<div style="font-size:9px;color:#64748b;margin-top:2px">${escHtml(deliveryLabel)}</div>` : ''}
          ${paymentLabel  ? `<div style="font-size:9px;color:#64748b">${escHtml(paymentLabel)}</div>` : ''}
        </div>
      </div>

      <!-- Tabla de productos -->
      <div style="padding:12px 16px 0">
        <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
          <thead>
            <tr style="background:#1A5A96">
              <th style="padding:8px;font-size:9px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:left;width:42%">Descripción</th>
              <th style="padding:8px;font-size:9px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:center;width:16%">Cantidad</th>
              <th style="padding:8px;font-size:9px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:right;width:16%">P. unit. neto</th>
              <th style="padding:8px;font-size:9px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:right;width:10%">IVA</th>
              <th style="padding:8px;font-size:9px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:right;width:16%">Total</th>
            </tr>
          </thead>
          <tbody>${items || '<tr><td colspan="5" style="padding:12px 8px;color:#94a3b8;font-size:11px">Sin productos</td></tr>'}</tbody>
        </table>
      </div>

      <!-- Subtotales del proveedor -->
      <div style="padding:0 16px 12px">
        <div style="background:#f8fafc;border-radius:8px;padding:12px 16px;margin-top:4px">
          ${subtotalMerc}
          ${portesRow}
          <div style="display:flex;justify-content:space-between;padding:6px 0 0;margin-top:4px;border-top:1px solid #e2e8f0;font-size:13px;font-weight:800;color:#0f172a">
            <span>Total ${escHtml(block.actorNombre)}</span>
            <span>${eur(supplierTotal)}</span>
          </div>
        </div>
        ${invoiceHtml}
      </div>
    </div>`
}

// ── Constructor principal ─────────────────────────────────────────────────────

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function buildPurchaseSummaryHtml(data: PurchaseSummaryData): string {
  const { masterOrder, supplierOrders, totals, isLegacy } = data

  const isSimulation = masterOrder?.isSimulation ?? true
  const numero       = masterOrder?.numero ?? 'SIN-MASTER'
  const fecha        = masterOrder ? fmtDatetime(masterOrder.createdAt) : '—'
  const buyer        = masterOrder?.buyerSnapshot ?? {}
  const buyerNombre  = (buyer.nombre  as string) || (buyer.empresa as string) || '—'
  const buyerEmpresa = (buyer.empresa as string) || ''
  const buyerNif     = (buyer.nif     as string) || ''
  const buyerEmail   = (buyer.email   as string) || ''
  const buyerTel     = (buyer.telefono as string) || ''

  const proveedoresHtml = supplierOrders
    .map((block, i) => buildSupplierBlock(block, i))
    .join('')

  const simulationBanner = isSimulation ? `
    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:10px;padding:12px 20px;margin-bottom:28px;text-align:center">
      <div style="font-size:13px;font-weight:900;color:#92400e;text-transform:uppercase;letter-spacing:1px">
        ⚠ OPERACIÓN DE PRUEBA / SIMULACIÓN — NO SE HA REALIZADO NINGÚN CARGO REAL
      </div>
    </div>` : ''

  const legacyBanner = isLegacy ? `
    <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:8px 16px;margin-bottom:20px;font-size:10px;color:#166534">
      Pedido creado antes del sistema de resumen de compra unificado. Los datos mostrados son los disponibles en el momento del pedido.
    </div>` : ''

  // LEGAL_GATE: texto provisional — wording definitivo pendiente de dictamen jurídico y fiscal
  const disclaimerText = `Este documento es un resumen o justificante de la compra realizada a través del Marketplace de TrabFlow
    y <strong>no constituye factura fiscal</strong>. Cada proveedor es responsable de emitir la factura
    correspondiente a los productos y servicios suministrados. Los importes mostrados corresponden a los
    precios registrados en el momento de la compra y no son modificados con posterioridad.`

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Resumen de compra ${escHtml(numero)}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:860px;margin:auto;font-size:12px}
      @media print{
        body{padding:24px 32px}
        button{display:none!important}
        .no-break{page-break-inside:avoid}
      }
      .print-btn{position:fixed;top:16px;right:16px;background:#1A5A96;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2);z-index:100}
      .top-bar{height:6px;background:linear-gradient(90deg,#1A5A96,#06b6d4);margin:-48px -56px 40px}
      @media print{.top-bar{margin:-24px -32px 32px}}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
      .brand-name{font-size:20px;font-weight:900;color:#0f172a;letter-spacing:-0.5px}
      .brand-sub{font-size:10px;color:#94a3b8;margin-top:2px;letter-spacing:.5px;text-transform:uppercase}
      .doc-pill{background:#1A5A96;color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:99px;display:inline-block;margin-bottom:8px}
      .doc-number{font-size:22px;font-weight:900;color:#0f172a;font-family:monospace}
      .doc-meta{font-size:10.5px;color:#94a3b8;margin-top:6px;line-height:1.8}
      .divider{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
      .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px}
      .info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:6px}
      .section-title{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#94a3b8;font-weight:800;margin:24px 0 14px}
      .global-totals{background:#f8fafc;border-radius:12px;padding:16px 20px;width:300px;margin-left:auto;margin-bottom:32px}
      .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569}
      .tot-row.final{border-top:2px solid #e2e8f0;margin-top:8px;padding-top:10px;font-size:16px;font-weight:900;color:#0f172a}
      .disclaimer{margin-top:28px;padding:14px 20px;background:#f8fafc;border-left:3px solid #1A5A96;border-radius:0 8px 8px 0;font-size:10.5px;color:#475569;line-height:1.7}
      .disclaimer .gate{font-size:8px;font-family:monospace;color:#94a3b8;font-style:normal;vertical-align:super}
      .footer{text-align:center;font-size:10px;color:#cbd5e1;padding-top:20px;border-top:1px solid #f1f5f9;margin-top:20px}
    </style>
  </head><body>
    <button class="print-btn" onclick="window.print()">Descargar PDF</button>
    <div class="top-bar"></div>

    <!-- Cabecera -->
    <div class="header">
      <div>
        <div class="brand-name">TrabFlow</div>
        <div class="brand-sub">Marketplace para instaladores profesionales</div>
      </div>
      <div style="text-align:right">
        <div class="doc-pill">Resumen de compra</div>
        <div class="doc-number">${escHtml(numero)}</div>
        <div class="doc-meta">
          Fecha: ${escHtml(fecha)}<br>
          Estado: ${escHtml(masterOrder?.orderStatus ?? 'creado')}<br>
          Referencia: <span style="font-family:monospace;font-size:10px">${masterOrder?.checkoutKey ? escHtml(masterOrder.checkoutKey.slice(0, 16)) + '…' : '—'}</span>
        </div>
      </div>
    </div>

    ${simulationBanner}
    ${legacyBanner}

    <!-- Datos del comprador -->
    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Comprador</div>
        <div style="font-size:13px;font-weight:700;color:#0f172a">${escHtml(buyerNombre)}</div>
        ${buyerEmpresa && buyerEmpresa !== buyerNombre ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escHtml(buyerEmpresa)}</div>` : ''}
        ${buyerNif    ? `<div style="font-size:11px;color:#64748b;margin-top:2px">NIF/CIF: ${escHtml(buyerNif)}</div>` : ''}
        ${buyerEmail  ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${escHtml(buyerEmail)}</div>` : ''}
        ${buyerTel    ? `<div style="font-size:11px;color:#64748b;margin-top:2px">Tel: ${escHtml(buyerTel)}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">Detalles del pedido</div>
        <div style="font-size:11px;color:#475569;line-height:1.9">
          <b>Nº pedido:</b> ${escHtml(numero)}<br>
          <b>Proveedores:</b> ${supplierOrders.length}<br>
          <b>Moneda:</b> ${escHtml(totals.currency)}<br>
          ${masterOrder ? `<b>Fecha:</b> ${escHtml(fmtDate(masterOrder.createdAt))}` : ''}
        </div>
      </div>
    </div>

    <hr class="divider">

    <!-- Bloques de proveedor -->
    <div class="section-title">Detalle por proveedor</div>
    ${proveedoresHtml}

    <!-- Resumen global -->
    <div class="section-title">Resumen global</div>
    <div class="global-totals">
      ${totals.goodsNet > 0 ? `<div class="tot-row"><span>Base imponible mercancía</span><span>${eur(totals.goodsNet)}</span></div>` : ''}
      ${totals.goodsTax > 0 ? `<div class="tot-row"><span>IVA mercancía <span class="gate">[TAX_GATE]</span></span><span>${eur(totals.goodsTax)}</span></div>` : ''}
      ${totals.goodsGross > 0 ? `<div class="tot-row"><span>Total mercancía</span><span>${eur(totals.goodsGross)}</span></div>` : ''}
      ${totals.shippingGross > 0 ? `<div class="tot-row"><span>Total portes</span><span>${eur(totals.shippingGross)}</span></div>` : ''}
      <div class="tot-row final"><span>TOTAL COMPRA</span><span>${eur(totals.totalGross)}</span></div>
    </div>

    <!-- Información sobre facturación -->
    <!-- LEGAL_GATE: wording provisional pendiente de dictamen jurídico -->
    <!-- TAX_GATE: referencia a factura proveedor pendiente de dictamen fiscal -->
    <div class="disclaimer">
      ${disclaimerText}
    </div>

    <div class="footer">
      TrabFlow Marketplace · Documento generado el ${new Date().toLocaleDateString('es-ES')}
      · <span style="font-family:monospace;font-size:9px">${escHtml(numero)}</span>
    </div>

  </body></html>`
}

// ── Funciones públicas de descarga ─────────────────────────────────────────────

export function printMarketplacePurchaseSummary(data: PurchaseSummaryData): void {
  const html = buildPurchaseSummaryHtml(data)
  const win  = window.open('', '_blank', 'width=960,height=760')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

export function downloadMarketplacePurchaseSummary(data: PurchaseSummaryData): void {
  const html = buildPurchaseSummaryHtml(data)
  const win  = window.open('', '_blank', 'width=960,height=760')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.addEventListener('load', () => {
    setTimeout(() => win.print(), 400)
  })
}
