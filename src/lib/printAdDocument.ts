import type { TradeFinancialDocument } from './supabase';

function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €';
}

function fmtDateEs(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(ms / 86400000) + 1);
}

const DOCTYPE_TITLES: Record<string, string> = {
  commercial_summary: 'Resumen de contratación publicitaria',
  invoice:            'Documento de publicidad',
  proforma:           'Proforma publicitaria',
  credit_note:        'Nota de crédito publicitaria',
};

const ESTADO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  waived:    { label: 'BONIFICADA',  color: '#7c3aed', bg: '#ede9fe' },
  paid:      { label: 'PAGADA',      color: '#065f46', bg: '#d1fae5' },
  pending:   { label: 'PENDIENTE',   color: '#92400e', bg: '#fef3c7' },
  issued:    { label: 'EMITIDA',     color: '#1e40af', bg: '#dbeafe' },
  draft:     { label: 'BORRADOR',    color: '#475569', bg: '#f1f5f9' },
  cancelled: { label: 'CANCELADA',   color: '#991b1b', bg: '#fee2e2' },
  refunded:  { label: 'DEVUELTA',    color: '#92400e', bg: '#fef3c7' },
};

export function buildAdDocumentHtml(doc: TradeFinancialDocument): string {
  const isWaived   = doc.payment_status === 'waived';
  const meta       = doc.metadata ?? {};
  const slotNombre = doc.slot_nombre ?? (typeof meta.slot_nombre === 'string' ? meta.slot_nombre : '');
  const pricingMode= typeof meta.pricing_mode === 'string' ? meta.pricing_mode : '';
  const estDays    = meta.estimated_days != null ? String(meta.estimated_days) : String(daysBetween(doc.period_start, doc.period_end));
  const estado     = ESTADO_LABELS[doc.estado] ?? { label: doc.estado.toUpperCase(), color: '#475569', bg: '#f1f5f9' };
  const docTitle   = DOCTYPE_TITLES[doc.document_type] ?? 'Documento comercial de publicidad';
  const accentColor = '#7c3aed'; // violet — color publicidad

  const provName   = doc.customer_name || (doc as TradeFinancialDocument & { actor_nombre?: string }).actor_nombre || '—';
  const provNif    = (doc as TradeFinancialDocument & { actor_tax_id?: string }).actor_tax_id || doc.customer_nif || '';
  const provEmail  = doc.customer_email || (doc as TradeFinancialDocument & { actor_email?: string }).actor_email || '';
  const provPhone  = (doc as TradeFinancialDocument & { actor_telefono?: string }).actor_telefono || '';

  const fase0Note = isWaived && pricingMode === 'validation_free'
    ? `<div style="background:#ede9fe;border:1px solid #c4b5fd;border-radius:10px;padding:12px 16px;margin-bottom:20px;font-size:11.5px;color:#5b21b6;line-height:1.6">
        <strong>Operación 100% bonificada</strong> durante la fase de validación comercial de TrabFlow.<br>
        Esta contratación no genera obligación de pago en la fase actual.
      </div>`
    : '';

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>${docTitle} — ${doc.doc_number}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:800px;margin:auto;font-size:12px}
    @media print{body{padding:24px 32px}button{display:none!important}.no-print{display:none!important}}
    .print-btn{position:fixed;top:16px;right:16px;display:flex;gap:8px}
    .btn{background:${accentColor};color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
    .btn-outline{background:#f8fafc;color:#475569;border:1px solid #e2e8f0;padding:10px 20px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer}
    .top-bar{height:6px;background:linear-gradient(90deg,${accentColor},#a855f7);margin:-48px -56px 40px}
    @media print{.top-bar{margin:-24px -32px 32px}}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
    .brand{font-size:22px;font-weight:900;color:#7c3aed;letter-spacing:1.5px}
    .brand-sub{font-size:10px;color:#94a3b8;margin-top:2px;letter-spacing:0.5px}
    .doc-pill{background:${accentColor};color:#fff;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:99px;display:inline-block;margin-bottom:8px}
    .doc-number{font-size:22px;font-weight:900;color:#0f172a;font-family:monospace}
    .doc-meta{font-size:10.5px;color:#94a3b8;margin-top:4px;line-height:1.7}
    .estado-badge{display:inline-block;padding:3px 12px;border-radius:99px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;background:${estado.bg};color:${estado.color}}
    .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
    .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px}
    .info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:8px}
    .info-row{font-size:11.5px;color:#334155;line-height:1.8}
    .info-row strong{color:#0f172a}
    .totals-box{background:#f8fafc;border-radius:12px;padding:16px 20px;width:300px;margin-left:auto;margin-bottom:32px}
    .totals-row{display:flex;justify-content:space-between;padding:5px 0;font-size:12px;color:#475569}
    .totals-row.divider-row{border-top:1px solid #e2e8f0;margin-top:8px;padding-top:10px}
    .totals-row.final{font-size:15px;font-weight:900;color:${isWaived ? accentColor : '#0f172a'}}
    .totals-row.commercial{color:#7c3aed;font-size:11px}
    .footer{text-align:center;font-size:10px;color:#cbd5e1;padding-top:20px;border-top:1px solid #f1f5f9;margin-top:20px}
    .concept-table{width:100%;border-collapse:collapse;margin-bottom:20px}
    .concept-table thead{background:${accentColor}}
    .concept-table thead th{padding:10px 12px;font-size:9.5px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px;text-align:left}
    .concept-table td{padding:10px 12px;font-size:11.5px;border-bottom:1px solid #f1f5f9;color:#334155}
    .concept-table td:last-child{text-align:right;font-weight:600;color:#0f172a}
  </style>
</head><body>
  <div class="print-btn no-print">
    <button class="btn-outline" onclick="window.close()">← Cerrar</button>
    <button class="btn" onclick="window.print()">Descargar / Imprimir PDF</button>
  </div>
  <div class="top-bar"></div>

  <div class="header">
    <div>
      <div class="brand">TRABFLOW</div>
      <div class="brand-sub">MARKETPLACE PROFESIONAL</div>
    </div>
    <div style="text-align:right">
      <div class="doc-pill">${docTitle}</div>
      <div class="doc-number">${doc.doc_number}</div>
      <div class="doc-meta">
        Fecha emisión: ${fmtDateEs(doc.created_at)}<br>
        <span class="estado-badge">${estado.label}</span>
      </div>
    </div>
  </div>

  ${fase0Note}

  <div class="info-grid">
    <div class="info-box">
      <div class="info-label">Proveedor anunciante</div>
      <div class="info-row"><strong>${provName}</strong></div>
      ${provNif    ? `<div class="info-row">NIF/CIF: ${provNif}</div>` : ''}
      ${provEmail  ? `<div class="info-row">${provEmail}</div>` : ''}
      ${provPhone  ? `<div class="info-row">Tel: ${provPhone}</div>` : ''}
    </div>
    <div class="info-box">
      <div class="info-label">Datos del documento</div>
      <div class="info-row"><b>Nº:</b> <span style="font-family:monospace">${doc.doc_number}</span></div>
      <div class="info-row"><b>Serie:</b> ${doc.doc_series}</div>
      <div class="info-row"><b>Periodo:</b> ${fmtDateEs(doc.period_start)} – ${fmtDateEs(doc.period_end)}</div>
      ${estDays ? `<div class="info-row"><b>Duración:</b> ${estDays} días</div>` : ''}
    </div>
  </div>

  <hr class="divider">

  <table class="concept-table">
    <thead>
      <tr>
        <th style="width:50%">Espacio publicitario</th>
        <th>Periodo</th>
        <th>Duración</th>
        <th>Valor tarifa</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${slotNombre || 'Publicidad Marketplace TrabFlow'}</td>
        <td>${fmtDateEs(doc.period_start)} – ${fmtDateEs(doc.period_end)}</td>
        <td>${estDays} días</td>
        <td>${fmtEur(doc.rate_amount)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-box">
    <div class="totals-row"><span>Tarifa base</span><span>${fmtEur(doc.rate_amount)}</span></div>
    ${doc.discount_amount > 0 ? `<div class="totals-row"><span>Descuento</span><span>–${fmtEur(doc.discount_amount)}</span></div>` : ''}
    ${doc.promotion_amount > 0 ? `<div class="totals-row" style="color:#7c3aed"><span>Bonificación Fase 0</span><span>–${fmtEur(doc.promotion_amount)}</span></div>` : ''}
    ${doc.tax_rate > 0 ? `<div class="totals-row"><span>IVA (${doc.tax_rate}%)</span><span>${fmtEur((doc as { tax_amount?: number }).tax_amount ?? 0)}</span></div>` : ''}
    <div class="totals-row divider-row final"><span>Total</span><span>${fmtEur(doc.total_amount)}</span></div>
    ${isWaived && doc.commercial_value > 0 ? `
    <div class="totals-row commercial" style="margin-top:8px">
      <span>Valor comercial bonificado</span><span>${fmtEur(doc.commercial_value)}</span>
    </div>` : ''}
  </div>

  <div class="footer">
    TRABFLOW · contacto@trabflow.com · trabflow.com<br>
    Documento generado el ${new Date().toLocaleDateString('es-ES')} · ${doc.doc_number}
  </div>
</body></html>`;
}

export function printAdDocument(doc: TradeFinancialDocument): void {
  const html = buildAdDocumentHtml(doc);
  const win = window.open('', '_blank', 'width=920,height=750');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}

export function downloadAdDocumentPdf(doc: TradeFinancialDocument): void {
  const html = buildAdDocumentHtml(doc);
  const win = window.open('', '_blank', 'width=920,height=750');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.addEventListener('load', () => {
    setTimeout(() => win.print(), 400);
  });
}
