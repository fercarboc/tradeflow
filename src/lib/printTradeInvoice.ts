import type { TradeInvoice, TradeInvoiceLine } from './supabase';

interface OrgInfo {
  nombre?: string;
  razon_social?: string;
  cif?: string;
  nif?: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  logo_url?: string;
  iva_default?: number;
}

export function printTradeInvoice(
  inv: TradeInvoice & { trade_clients?: { nombre: string } | null },
  lines: TradeInvoiceLine[],
  org: OrgInfo,
) {
  const esRectificativa = inv.tipo_factura === 'rectificativa';
  const accentColor = esRectificativa ? '#dc2626' : inv.serie === 'M' ? '#7c3aed' : '#2563eb';
  const tipoLabel = esRectificativa ? 'Factura Rectificativa' : 'Factura';

  const clienteNombre = inv.razon_social_cliente ?? inv.trade_clients?.nombre ?? '—';
  const clienteNif    = inv.nif_cliente ?? '';
  const clienteDir    = inv.direccion_cliente ?? '';

  const empresaNombre = org.razon_social ?? org.nombre ?? 'Empresa';
  const empresaCif    = org.cif ?? org.nif ?? '';
  const empresaDir    = [org.direccion, org.ciudad].filter(Boolean).join(', ');

  const subtotal  = inv.subtotal ?? 0;
  const ivaPct    = inv.iva_pct ?? 21;
  const ivaImport = inv.iva_importe ?? subtotal * (ivaPct / 100);
  const total     = inv.total ?? subtotal + ivaImport;

  const rows = lines.length > 0
    ? lines.map((l, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">${l.descripcion}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${l.cantidad}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${(l.precio_unitario ?? 0).toFixed(2)}€</td>
        <td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${(l.subtotal ?? 0).toFixed(2)}€</td>
      </tr>`).join('')
    : `<tr><td colspan="4" style="padding:14px 8px;text-align:center;color:#94a3b8;font-size:11px">${inv.concepto ?? '—'}</td></tr>`;

  const logoHtml = org.logo_url
    ? `<img src="${org.logo_url}" alt="Logo" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px" />`
    : '';

  const estadoBadge = () => {
    const e = inv.estado ?? '';
    if (e === 'Pagada')   return `<span class="badge badge-paid">Pagada</span>`;
    if (e === 'Vencida')  return `<span class="badge badge-overdue">Vencida</span>`;
    if (e === 'Borrador') return `<span class="badge badge-draft">Borrador</span>`;
    return `<span class="badge badge-pending">${e}</span>`;
  };

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>${tipoLabel} ${inv.numero}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:800px;margin:auto;font-size:12px}
      @media print{body{padding:24px 32px}button{display:none!important}}
      .print-btn{position:fixed;top:16px;right:16px;background:${accentColor};color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
      .top-bar{height:6px;background:linear-gradient(90deg,${accentColor},${esRectificativa ? '#f87171' : accentColor === '#7c3aed' ? '#a855f7' : '#06b6d4'});margin:-48px -56px 40px}
      @media print{.top-bar{margin:-24px -32px 32px}}
      .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
      .company-name{font-size:18px;font-weight:800;color:#0f172a}
      .company-sub{font-size:11px;color:#64748b;line-height:1.6;margin-top:4px}
      .doc-pill{background:${accentColor};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:99px;display:inline-block;margin-bottom:8px}
      .doc-number{font-size:22px;font-weight:900;color:#0f172a;font-family:monospace}
      .doc-meta{font-size:10.5px;color:#94a3b8;margin-top:4px;line-height:1.7}
      .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
      .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
      .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px}
      .info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:6px}
      table{width:100%;border-collapse:collapse;margin-bottom:20px}
      thead{background:${accentColor}}
      thead th{padding:10px 8px;font-size:9.5px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px}
      .totals-box{background:#f8fafc;border-radius:12px;padding:16px 20px;width:260px;margin-left:auto;margin-bottom:32px}
      .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569}
      .totals-row.final{border-top:1px solid #e2e8f0;margin-top:8px;padding-top:10px;font-size:15px;font-weight:900;color:#0f172a}
      .badge{display:inline-block;padding:3px 12px;border-radius:99px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
      .badge-pending{background:#fef3c7;color:#92400e}
      .badge-paid{background:#d1fae5;color:#065f46}
      .badge-overdue{background:#fee2e2;color:#991b1b}
      .badge-draft{background:#f1f5f9;color:#475569}
      .footer{text-align:center;font-size:10px;color:#cbd5e1;padding-top:20px;border-top:1px solid #f1f5f9}
      ${esRectificativa ? '.rectif-notice{background:#fee2e2;border:1px solid #fca5a5;border-radius:10px;padding:10px 16px;margin-bottom:20px;font-size:11px;color:#991b1b;font-weight:600}' : ''}
    </style>
  </head><body>
    <button class="print-btn" onclick="window.print()">Descargar PDF</button>
    <div class="top-bar"></div>

    <div class="header">
      <div>
        ${logoHtml}
        <div class="company-name">${empresaNombre}</div>
        <div class="company-sub">
          ${empresaCif ? `CIF: ${empresaCif}<br>` : ''}
          ${empresaDir ? `${empresaDir}<br>` : ''}
          ${org.telefono ? `Tel: ${org.telefono}<br>` : ''}
          ${org.email ?? ''}
        </div>
      </div>
      <div style="text-align:right">
        <div class="doc-pill">${tipoLabel}</div>
        <div class="doc-number">${inv.numero}</div>
        <div class="doc-meta">
          Emisión: ${inv.fecha_emision ? inv.fecha_emision.split('T')[0] : inv.fecha ?? '—'}<br>
          ${inv.fecha_vencimiento ? `Vencimiento: ${inv.fecha_vencimiento}<br>` : ''}
          ${estadoBadge()}
        </div>
      </div>
    </div>

    ${esRectificativa ? `<div class="rectif-notice">⚠ Factura rectificativa de ${inv.factura_original_id ? 'la factura original' : ''}. Anula y sustituye los importes de la factura original.</div>` : ''}

    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Facturado a</div>
        <div style="font-size:12.5px;font-weight:700;color:#0f172a">${clienteNombre}</div>
        ${clienteNif ? `<div style="font-size:11px;color:#64748b;margin-top:2px">NIF/CIF: ${clienteNif}</div>` : ''}
        ${clienteDir ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${clienteDir}</div>` : ''}
      </div>
      <div class="info-box">
        <div class="info-label">Datos de la factura</div>
        <div style="font-size:11px;color:#475569;line-height:1.9">
          <b>Nº:</b> ${inv.numero}<br>
          <b>Serie:</b> ${inv.serie ?? 'F'}<br>
          ${inv.metodo_pago ? `<b>Método de pago:</b> ${inv.metodo_pago}<br>` : ''}
          ${inv.paid_at ? `<b>Cobrada:</b> ${inv.paid_at.split('T')[0]}` : ''}
        </div>
      </div>
    </div>

    <hr class="divider">

    <table>
      <thead>
        <tr>
          <th style="text-align:left;width:50%">Descripción</th>
          <th style="text-align:center;width:12%">Cant.</th>
          <th style="text-align:right;width:18%">Precio unit.</th>
          <th style="text-align:right;width:20%">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row"><span>Base imponible</span><span>${subtotal.toFixed(2)}€</span></div>
      <div class="totals-row"><span>IVA (${ivaPct}%)</span><span>${ivaImport.toFixed(2)}€</span></div>
      <div class="totals-row final"><span>TOTAL</span><span>${total.toFixed(2)}€</span></div>
    </div>

    <div class="footer">
      ${empresaNombre}${empresaCif ? ` · CIF ${empresaCif}` : ''}${empresaDir ? ` · ${empresaDir}` : ''}<br>
      Documento generado el ${new Date().toLocaleDateString('es-ES')}
    </div>
  </body></html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}
