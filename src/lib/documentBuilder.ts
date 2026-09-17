// Pure document building helpers for PDF generation.
// Extracted from AppDashboardView so they can be unit-tested without mounting
// the full React component tree.
import type { PartidaPresupuesto } from '../types';
import type { PreparedDocumentPhoto } from './quotePhotos';

export interface EmpresaDocData {
  nombre?: string;
  nif?: string;
  email?: string;
  telefonoMovil?: string;
  direccion?: string;
  localidad?: string;
  cp?: string;
  provincia?: string;
}

export interface BuildDocumentOpts {
  tipo: 'presupuesto' | 'factura';
  numero: string;
  fecha: string;
  fechaVencimiento?: string;
  clienteNombre: string;
  clienteDireccion?: string;
  clienteEmail?: string;
  clienteTelefono?: string;
  empresa: EmpresaDocData;
  logoUrl?: string;
  partidas: PartidaPresupuesto[];
  total: number;
  iva: number;
  estado?: string;
  notas?: string;
  photos?: PreparedDocumentPhoto[];
}

export function buildPhotosHtml(photos: PreparedDocumentPhoto[]): string {
  const n = photos.length;
  const colStyle = n === 1
    ? 'display:block;margin:0 auto;max-width:480px'
    : `display:grid;grid-template-columns:repeat(${n},1fr);gap:16px`;
  const figures = photos.map(p => {
    const labelHtml = [
      p.area_label ? `<div style="font-size:10.5px;font-weight:700;color:#475569;margin-top:6px">${p.area_label}</div>` : '',
      p.caption    ? `<div style="font-size:10px;color:#94a3b8;margin-top:2px">${p.caption}</div>` : '',
    ].join('');
    return `<figure style="margin:0;break-inside:avoid;page-break-inside:avoid">
        <img src="${p.dataUrl}" alt="" style="width:100%;height:180px;object-fit:cover;border-radius:6px;display:block" />
        ${labelHtml ? `<figcaption style="text-align:center">${labelHtml}</figcaption>` : ''}
      </figure>`;
  }).join('');
  return `<div style="margin:32px 0 24px">
      <div style="font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0">Fotografías de referencia</div>
      <div style="${colStyle}">${figures}</div>
    </div>`;
}

export function buildDocumentHTML(opts: BuildDocumentOpts): string {
  const totalIVA = opts.total * (opts.iva / 100);
  const totalConIVA = opts.total + totalIVA;
  const esFactura = opts.tipo === 'factura';
  const accentColor = esFactura ? '#7c3aed' : '#2563eb';

  const _OFICIO_LABELS: Record<string, string> = {
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
  const _pGroups: { key: string; label: string; items: typeof opts.partidas }[] = [];
  opts.partidas.forEach((p) => {
    const isLabor = p.tipo === 'mano_de_obra';
    const rawKey = p.familia?.trim() || '';
    const key = isLabor ? '___labor___' : (rawKey || '___other___');
    const label = isLabor ? 'Mano de obra' : (_OFICIO_LABELS[rawKey] ?? (rawKey || 'Partidas'));
    let g = _pGroups.find(x => x.key === key);
    if (!g) { g = { key, label, items: [] }; _pGroups.push(g); }
    g.items.push(p);
  });
  _pGroups.sort((a, b) => a.key === '___labor___' ? 1 : b.key === '___labor___' ? -1 : 0);
  const _showSec = _pGroups.length > 1;
  let rows = '';
  _pGroups.forEach(({ label, items }, gi) => {
    const sn = String(gi + 1).padStart(2, '0');
    const sTotal = items.reduce((s, x) => s + x.total, 0);
    if (_showSec) rows += `<tr class="section-header"><td colspan="4" style="background:${accentColor};color:#fff;font-weight:800;font-size:9.5px;text-transform:uppercase;letter-spacing:1.2px;padding:8px 10px">${sn} — ${label}</td></tr>`;
    items.forEach((p, j) => {
      const pre = _showSec ? `${gi + 1}.${j + 1} ` : '';
      rows += `<tr style="background:${j % 2 === 0 ? '#fff' : '#f8fafc'}"><td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">${pre}${p.descripcion}</td><td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${p.cantidad}</td><td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${p.precioUnitario.toFixed(2)}€</td><td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${p.total.toFixed(2)}€</td></tr>`;
    });
    if (_showSec) rows += `<tr class="section-subtotal" style="background:#f0f4f8"><td colspan="3" style="padding:6px 8px;font-size:10px;text-align:right;color:#64748b;font-weight:600;border-bottom:2px solid #e2e8f0">Subtotal ${sn}:</td><td style="padding:6px 8px;font-size:11px;text-align:right;font-weight:800;color:${accentColor};border-bottom:2px solid #e2e8f0">${sTotal.toFixed(2)}€</td></tr>`;
  });

  const logoHtml = opts.logoUrl
    ? `<img src="${opts.logoUrl}" alt="Logo" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px" />`
    : '';

  const clienteLines = [
    `<div style="font-size:12.5px;font-weight:700;color:#0f172a">${opts.clienteNombre}</div>`,
    opts.clienteDireccion ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${opts.clienteDireccion}</div>` : '',
    opts.clienteEmail ? `<div style="font-size:11px;color:#64748b">${opts.clienteEmail}</div>` : '',
    opts.clienteTelefono ? `<div style="font-size:11px;color:#64748b">Tel: ${opts.clienteTelefono}</div>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>${esFactura ? 'Factura' : 'Presupuesto'} ${opts.numero}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:800px;margin:auto;font-size:12px}
        @media print{body{padding:24px 32px}button{display:none!important}.page-break{page-break-before:always}tr{break-inside:avoid;page-break-inside:avoid}.section-header{break-after:avoid;page-break-after:avoid}.section-subtotal{break-before:avoid;page-break-before:avoid}.totals-box{break-inside:avoid;page-break-inside:avoid}thead{display:table-header-group}}
        .print-btn{position:fixed;top:16px;right:16px;background:${accentColor};color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
        .top-bar{height:6px;background:linear-gradient(90deg,${accentColor},${esFactura ? '#a855f7' : '#06b6d4'});margin:-48px -56px 40px;border-radius:0}
        @media print{.top-bar{margin:-24px -32px 32px}}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
        .company-name{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.3px}
        .company-sub{font-size:11px;color:#64748b;line-height:1.6;margin-top:4px}
        .doc-pill{background:${accentColor};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:99px;display:inline-block;margin-bottom:8px}
        .doc-number{font-size:22px;font-weight:900;color:#0f172a;font-family:monospace;letter-spacing:-0.5px}
        .doc-meta{font-size:10.5px;color:#94a3b8;margin-top:4px;line-height:1.7}
        .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
        .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px}
        .info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:10px;overflow:hidden}
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
        .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:11px;color:#78350f}
      </style>
    </head><body>
      <button class="print-btn" onclick="window.print()">Descargar PDF</button>
      <div class="top-bar"></div>

      <div class="header">
        <div>
          ${logoHtml}
          <div class="company-name">${opts.empresa.nombre || 'Mi Empresa'}</div>
          <div class="company-sub">
            ${opts.empresa.nif ? `NIF: ${opts.empresa.nif}<br>` : ''}
            ${opts.empresa.direccion ? `${opts.empresa.direccion}${opts.empresa.localidad ? `, ${opts.empresa.localidad}` : ''}${opts.empresa.cp ? ` ${opts.empresa.cp}` : ''}<br>` : ''}
            ${opts.empresa.email ? `${opts.empresa.email}` : ''}${opts.empresa.telefonoMovil ? ` · Tel: ${opts.empresa.telefonoMovil}` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div class="doc-pill">${esFactura ? 'Factura' : 'Presupuesto'}</div>
          <div class="doc-number">${opts.numero}</div>
          <div class="doc-meta">
            Fecha: ${opts.fecha}<br>
            ${opts.fechaVencimiento ? `Vencimiento: ${opts.fechaVencimiento}<br>` : ''}
            ${opts.estado ? `<span class="badge ${opts.estado === 'Pagada' ? 'badge-paid' : opts.estado === 'Pendiente' ? 'badge-pending' : opts.estado === 'Vencida' ? 'badge-overdue' : 'badge-draft'}">${opts.estado}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">Emisor</div>
          <div style="font-size:12.5px;font-weight:700;color:#0f172a">${opts.empresa.nombre || '—'}</div>
          ${opts.empresa.nif ? `<div style="font-size:11px;color:#64748b">NIF: ${opts.empresa.nif}</div>` : ''}
          ${opts.empresa.provincia ? `<div style="font-size:11px;color:#64748b">${opts.empresa.provincia}</div>` : ''}
        </div>
        <div class="info-box">
          <div class="info-label">Cliente</div>
          ${clienteLines || '<div style="font-size:12px;color:#64748b">—</div>'}
        </div>
      </div>

      ${opts.notas ? `<div class="notes-box"><strong>Notas:</strong> ${opts.notas}</div>` : ''}

      <table>
        <thead><tr>
          <th style="text-align:left;width:48%">Descripción</th>
          <th style="text-align:center;width:10%">Cant.</th>
          <th style="text-align:right;width:20%">Precio unit.</th>
          <th style="text-align:right;width:22%">Subtotal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row"><span>Base imponible</span><span>${opts.total.toFixed(2)}€</span></div>
        <div class="totals-row"><span>IVA ${opts.iva}%</span><span>${totalIVA.toFixed(2)}€</span></div>
        <div class="totals-row final"><span>TOTAL</span><span>${totalConIVA.toFixed(2)}€</span></div>
      </div>

      ${opts.photos && opts.photos.length > 0 ? buildPhotosHtml(opts.photos) : ''}

      <div class="footer">
        Generado con TradeFlow AI · ${opts.empresa.nombre || ''}${opts.empresa.email ? ` · ${opts.empresa.email}` : ''}
      </div>
    </body></html>`;
}
