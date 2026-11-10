import QRCode from 'qrcode';
import type { TradeInvoice, TradeInvoiceLine, FiscalSnapshot } from './supabase';

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
  // Datos bancarios para el cobro (trade_organizations.iban / banco / titular_cuenta)
  iban?: string | null;
  banco?: string | null;
  titular_cuenta?: string | null;
}

function escHtml(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Formatea IBAN en grupos de 4: ES12 3456 7890 ... */
export function formatIban(iban: string): string {
  return iban.replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
}

export async function buildInvoiceHtml(
  inv: TradeInvoice & { trade_clients?: { nombre: string } | null },
  lines: TradeInvoiceLine[],
  org: OrgInfo,
  numeroOriginal?: string,
  fiscalSnapshot?: FiscalSnapshot | null,
): Promise<string> {
  const esRectificativa = inv.tipo_factura === 'rectificativa';
  const accentColor = esRectificativa ? '#dc2626' : inv.serie === 'M' ? '#7c3aed' : '#2563eb';
  const tipoLabel = esRectificativa ? 'Factura Rectificativa' : 'Factura';

  const clienteNombre = inv.razon_social_cliente ?? inv.trade_clients?.nombre ?? '—';
  const clienteNif    = inv.nif_cliente ?? '';
  const clienteDir    = inv.direccion_cliente ?? '';
  const clienteCp         = inv.cp_cliente ?? '';
  const clienteLocalidad  = inv.localidad_cliente ?? '';
  const clienteProvincia  = inv.provincia_cliente ?? '';
  const clientePais       = inv.pais_cliente ?? '';

  const empresaNombre = org.razon_social ?? org.nombre ?? 'Empresa';
  const empresaCif    = org.cif ?? org.nif ?? '';
  const empresaDir    = [org.direccion, org.ciudad].filter(Boolean).join(', ');

  const ibanFmt = org.iban && org.iban.trim() ? formatIban(org.iban) : '';
  const pagoBlock = ibanFmt ? `
    <div class="pago-box">
      <div class="info-label">Datos para el pago</div>
      <div style="font-size:11px;color:#475569;line-height:1.9">
        <b>Forma de pago:</b> Transferencia bancaria<br>
        ${org.titular_cuenta ? `<b>Titular:</b> ${escHtml(org.titular_cuenta)}<br>` : ''}
        <b>IBAN:</b> <span style="font-family:'Courier New',monospace;font-weight:700;color:#0f172a;letter-spacing:0.5px">${escHtml(ibanFmt)}</span><br>
        <b>Concepto:</b> Factura ${escHtml(inv.numero ?? '')}
      </div>
    </div>` : '';

  const subtotal  = inv.subtotal ?? 0;
  const ivaPct    = inv.iva_pct ?? 21;
  const ivaImport = inv.iva_importe ?? subtotal * (ivaPct / 100);
  const total     = inv.total ?? subtotal + ivaImport;

  // ── Partidas: mismo detalle que el presupuesto impreso ──────────────────────
  // Agrupadas por oficio (familia) con subtotal por sección; mano de obra al final.
  // Bajo cada descripción: marca · modelo · medidas (si vienen del presupuesto).
  const OFICIO_LABELS: Record<string, string> = {
    fontaneria: 'Fontanería', electricidad: 'Electricidad', albanileria: 'Albañilería',
    climatizacion: 'Climatización', pintura: 'Pintura', carpinteria: 'Carpintería',
    cerrajeria: 'Cerrajería', suelos_alicatados: 'Suelos y alicatados',
    suelos_tarimas: 'Suelos y tarimas', pladur_escayola: 'Pladur y escayola',
    telecomunicaciones: 'Telecomunicaciones', impermeabilizacion: 'Impermeabilización',
    tejados_cubiertas: 'Tejados y cubiertas', reforma_integral: 'Reforma integral',
    fachadas: 'Fachadas', mantenimiento_general: 'Mantenimiento', energia_solar: 'Energía solar',
    cristaleria: 'Cristalería', instalador_cctv: 'CCTV y seguridad', informatica: 'Informática',
    contra_incendios: 'Contra incendios', persianas: 'Persianas', multiservicio: 'Multiservicio',
    jardineria: 'Jardinería', limpieza: 'Limpieza', mecanica: 'Mecánica',
    gestion_residuos: 'Gestión de residuos', cocina_amueblada: 'Cocina',
  };
  const groups: { key: string; label: string; items: TradeInvoiceLine[] }[] = [];
  lines.forEach(l => {
    const isLabor = l.tipo === 'mano_de_obra';
    const raw = l.familia?.trim() || '';
    const key = isLabor ? '___labor___' : (raw || '___other___');
    const label = isLabor ? 'Mano de obra' : (OFICIO_LABELS[raw] ?? (raw || 'Partidas'));
    let g = groups.find(x => x.key === key);
    if (!g) { g = { key, label, items: [] }; groups.push(g); }
    g.items.push(l);
  });
  groups.sort((a, b) => a.key === '___labor___' ? 1 : b.key === '___labor___' ? -1 : 0);
  const showSections = groups.length > 1;

  const lineRow = (l: TradeInvoiceLine, j: number, pre: string) => {
    const detalle = [l.marca, l.modelo, l.medidas].filter(v => v && String(v).trim()).map(v => escHtml(String(v))).join(' · ');
    const cant = `${l.cantidad}${l.unidad ? ` ${escHtml(l.unidad)}` : ''}`;
    const dto = l.descuento_pct ? `<div style="font-size:9.5px;color:#16a34a;margin-top:2px">Dto. ${l.descuento_pct}%</div>` : '';
    return `
      <tr style="background:${j % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">${pre}${escHtml(l.descripcion ?? '')}${detalle ? `<div style="font-size:9.5px;color:#94a3b8;margin-top:2px">${detalle}</div>` : ''}${dto}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${cant}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${(l.precio_unitario ?? 0).toFixed(2)}€</td>
        <td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${(l.subtotal ?? 0).toFixed(2)}€</td>
      </tr>`;
  };

  let rows = '';
  if (lines.length === 0) {
    rows = `<tr><td colspan="4" style="padding:14px 8px;text-align:left;color:#334155;font-size:11.5px">${escHtml(inv.concepto ?? '—')}</td></tr>`;
  } else {
    groups.forEach(({ label, items }, gi) => {
      const sn = String(gi + 1).padStart(2, '0');
      if (showSections) rows += `<tr><td colspan="4" style="background:${accentColor};color:#fff;font-weight:800;font-size:9.5px;text-transform:uppercase;letter-spacing:1.2px;padding:8px 10px">${sn} — ${escHtml(label)}</td></tr>`;
      items.forEach((l, j) => { rows += lineRow(l, j, showSections ? `${gi + 1}.${j + 1} ` : ''); });
      if (showSections) {
        const st = items.reduce((acc, x) => acc + (x.subtotal ?? 0), 0);
        rows += `<tr style="background:#f0f4f8"><td colspan="3" style="padding:6px 8px;font-size:10px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Subtotal ${sn}:</td><td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:800;color:${accentColor};border-bottom:2px solid #e2e8f0">${st.toFixed(2)}€</td></tr>`;
      }
    });
  }

  // Concepto general de la obra (descripción del presupuesto), encima de la tabla
  const conceptoHtml = inv.concepto && lines.length > 0
    ? `<div style="font-size:11.5px;color:#334155;margin-bottom:10px"><b>Concepto:</b> ${escHtml(inv.concepto)}</div>`
    : '';

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

  // ── QR AEAT: fuente autoritativa = snapshot fiscal (trade_fiscal_records) ──
  // Fail-closed: si snapshot ausente o numserie no coincide → omitir QR.
  // Nunca usar org.nif como fallback para NIF del emisor en un QR fiscal oficial.
  let qrSvgBlock: string | null = null;
  if (inv.fiscal_record_id) {
    if (fiscalSnapshot) {
      if (fiscalSnapshot.numero_factura !== (inv.numero ?? '')) {
        // Mismatch entre serial en factura y en ledger fiscal → no generar QR
        console.error(
          '[VF-QR] FAIL_CLOSED: fiscal_record.numero_factura !== invoice.numero',
          { fiscal: fiscalSnapshot.numero_factura, invoice: inv.numero },
        );
      } else {
        const aeatUrl = [
          'https://www2.agenciatributaria.es/wlpl/TIKE-CONT/ValidarQR',
          `?nif=${encodeURIComponent(fiscalSnapshot.nif_emisor)}`,
          `&numserie=${encodeURIComponent(fiscalSnapshot.numero_factura)}`,
          // fecha_expedicion_vf ya está en DD-MM-YYYY (formato AEAT); no reconvertir
          `&fecha=${encodeURIComponent(fiscalSnapshot.fecha_expedicion_vf)}`,
          `&importe=${encodeURIComponent(fiscalSnapshot.importe_total.toFixed(2))}`,
        ].join('');
        qrSvgBlock = await QRCode.toString(aeatUrl, { type: 'svg', width: 96, margin: 1 });
      }
    } else {
      // fiscal_record_id presente pero sin snapshot → fail closed, QR omitido
      console.warn('[VF-QR] FAIL_CLOSED: fiscal_record_id present but fiscalSnapshot not provided — QR omitted');
    }
  }

  // Valores de display en bloque VeriFactu: priorizar snapshot fiscal (inmutable)
  const displayNifEmisora = fiscalSnapshot?.nif_emisor ?? empresaCif ?? '—';
  const displayFechaEmision = fiscalSnapshot?.fecha_expedicion_vf
    ?? (inv.fecha_emision ?? inv.fecha ?? '').split('T')[0];

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>${tipoLabel} ${inv.numero}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:800px;margin:auto;font-size:12px}
      @media print{body{padding:24px 32px}button{display:none!important}tr{break-inside:avoid;page-break-inside:avoid}.totals-box{break-inside:avoid;page-break-inside:avoid}.verifactu-block{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}}
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
      .pago-box{border:1px solid #e2e8f0;border-radius:12px;padding:14px 18px;margin-bottom:24px;break-inside:avoid;page-break-inside:avoid}
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

    ${esRectificativa ? `<div class="rectif-notice">⚠ Factura rectificativa${numeroOriginal ? ` de ${numeroOriginal}` : (inv.rectifica_factura_id ? ' de la factura original' : '')}${inv.motivo_rectificacion ? ` · Motivo: ${inv.motivo_rectificacion}` : ''}</div>` : ''}

    <div class="info-grid">
      <div class="info-box">
        <div class="info-label">Facturado a</div>
        <div style="font-size:12.5px;font-weight:700;color:#0f172a">${clienteNombre}</div>
        ${clienteNif ? `<div style="font-size:11px;color:#64748b;margin-top:2px">NIF/CIF: ${clienteNif}</div>` : ''}
        ${clienteDir ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${clienteDir}</div>` : ''}
        ${(clienteCp || clienteLocalidad) ? `<div style="font-size:11px;color:#64748b;margin-top:1px">${[clienteCp, clienteLocalidad].filter(Boolean).join(' ')}</div>` : ''}
        ${clienteProvincia ? `<div style="font-size:11px;color:#64748b;margin-top:1px">${clienteProvincia}</div>` : ''}
        ${clientePais && clientePais !== 'España' ? `<div style="font-size:11px;color:#64748b;margin-top:1px">${clientePais}</div>` : ''}
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

    ${conceptoHtml}
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

    ${pagoBlock}

    <div class="footer">
      ${empresaNombre}${empresaCif ? ` · CIF ${empresaCif}` : ''}${empresaDir ? ` · ${empresaDir}` : ''}<br>
      Documento generado el ${new Date().toLocaleDateString('es-ES')}
    </div>

    ${inv.fiscal_record_id ? `
    <!-- SECCIÓN VERIFACTU -->
    <div class="verifactu-block" style="margin-top:20px;border-top:2px solid #e2e8f0;padding-top:16px">
      <div style="display:flex;align-items:flex-start;gap:16px">
        ${qrSvgBlock ? `<!-- QR code AEAT (generado localmente, fuente: ledger fiscal) -->
        <div style="flex-shrink:0;text-align:center">
          <div style="display:inline-block;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden;width:96px;height:96px">
            ${qrSvgBlock}
          </div>
          <p style="font-size:8px;color:#94a3b8;margin-top:4px;text-align:center">Verificar</p>
        </div>` : ''}
        <!-- Datos VeriFactu -->
        <div style="flex:1;min-width:0">
          <p style="font-size:9px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px">
            Registro VeriFactu · RD 1007/2023
          </p>
          <p style="font-size:8.5px;color:#64748b;line-height:1.7;margin-bottom:4px">
            <span style="font-weight:700;color:#334155">Nº Factura:</span> ${inv.numero}<br>
            <span style="font-weight:700;color:#334155">Fecha emisión:</span> ${displayFechaEmision}<br>
            <span style="font-weight:700;color:#334155">Emisor CIF:</span> ${displayNifEmisora}<br>
            ${inv.verifactu_hash_anterior ? `<span style="font-weight:700;color:#334155">Encadenamiento:</span> Sí<br>` : ''}
          </p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 10px;margin-top:4px">
            <p style="font-size:8px;color:#94a3b8;margin-bottom:3px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Huella digital SHA-256</p>
            <p style="font-family:'Courier New',monospace;font-size:8px;color:#334155;word-break:break-all;line-height:1.5">
              ${inv.verifactu_hash}
            </p>
          </div>
          <p style="font-size:7.5px;color:#cbd5e1;margin-top:6px">
            Factura expedida conforme al Reglamento de Sistemas de Facturación Verificable (VeriFactu).
            La huella garantiza la integridad e inalterabilidad del registro.
          </p>
        </div>
      </div>
    </div>
    ` : `
    <div style="margin-top:16px;padding-top:12px;border-top:1px solid #f1f5f9;text-align:center;font-size:9px;color:#cbd5e1;line-height:1.6">
      Factura expedida en el marco del Reglamento de Sistemas de Facturación Verificable (VeriFactu) · RD 1007/2023<br>
      Registro en proceso de validación fiscal.
    </div>
    `}
  </body></html>`;

  return html;
}

export async function printTradeInvoice(
  inv: TradeInvoice & { trade_clients?: { nombre: string } | null },
  lines: TradeInvoiceLine[],
  org: OrgInfo,
  numeroOriginal?: string,
  fiscalSnapshot?: FiscalSnapshot | null,
  // Ventana abierta de forma síncrona en el gesto del usuario (móvil: los navegadores
  // bloquean window.open tras un await). Opcional: sin él se mantiene el comportamiento previo.
  preOpenedWin?: Window | null,
) {
  const html = await buildInvoiceHtml(inv, lines, org, numeroOriginal, fiscalSnapshot);
  const win = preOpenedWin ?? window.open('', '_blank', 'width=900,height=700');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
}
