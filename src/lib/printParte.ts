import type { ParteInfo } from './supabase';

export function printParte(info: ParteInfo): void {
  const logoHtml = info.org_logo_url
    ? `<img src="${info.org_logo_url}" alt="${info.org_nombre}" style="max-height:56px;max-width:180px;object-fit:contain;display:block;margin-bottom:6px" />`
    : '';

  const firmaHtml = info.firma_url
    ? `<div style="border:1.5px solid #e2e8f0;border-radius:12px;padding:12px;background:#fafafa;text-align:center">
        <img src="${info.firma_url}" alt="Firma" style="max-height:100px;max-width:100%;object-fit:contain;display:inline-block" />
       </div>
       <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:8px">
        <span style="color:#10b981;font-size:15px">✓</span>
        <span style="font-size:10.5px;font-weight:700;color:#059669;text-transform:uppercase;letter-spacing:.8px">Trabajo aceptado y firmado</span>
       </div>
       ${info.cliente_nombre ? `<p style="text-align:center;font-size:10px;color:#94a3b8;margin-top:4px">${info.cliente_nombre}</p>` : ''}`
    : `<p style="color:#94a3b8;font-size:11px;text-align:center;padding:24px 0">Sin firma de conformidad registrada</p>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Parte de Trabajo — ${info.job_titulo}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:720px;margin:auto;font-size:12px}
    @media print{body{padding:24px 32px}button{display:none!important}.top-bar{margin:-24px -32px 32px!important}}
    .print-btn{position:fixed;top:16px;right:16px;background:#059669;color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    .top-bar{height:6px;background:linear-gradient(90deg,#059669,#10b981);margin:-48px -56px 40px}
    .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px}
    .company-name{font-size:16px;font-weight:800;color:#0f172a}
    .section-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:6px}
    .divider{border:none;border-top:1px solid #e2e8f0;margin:20px 0}
    .badge-ok{display:inline-flex;align-items:center;gap:5px;background:#d1fae5;color:#065f46;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.8px;padding:4px 12px;border-radius:99px}
    .info-row{display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:11.5px;color:#334155}
    .info-icon{color:#94a3b8;font-size:13px;width:16px;text-align:center}
    .notas-box{background:#f8fafc;border-radius:10px;padding:14px 16px;font-size:11.5px;color:#334155;line-height:1.6;white-space:pre-wrap;word-break:break-word}
    .firma-section{margin-top:24px}
    .footer{text-align:center;font-size:10px;color:#cbd5e1;padding-top:20px;border-top:1px solid #f1f5f9;margin-top:32px}
  </style>
</head><body>
  <button class="print-btn" onclick="window.print()">Descargar PDF</button>
  <div class="top-bar"></div>

  <div class="header">
    <div>
      ${logoHtml}
      <div class="company-name">${info.org_nombre}</div>
    </div>
    <div style="text-align:right">
      <div class="badge-ok">✓ Completado</div>
      <p style="font-size:9.5px;color:#94a3b8;margin-top:6px;letter-spacing:.5px">PARTE DE TRABAJO</p>
    </div>
  </div>

  <h1 style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:16px;line-height:1.2">${info.job_titulo}</h1>

  <div>
    ${info.cliente_nombre ? `<div class="info-row"><span class="info-icon">👤</span>${info.cliente_nombre}</div>` : ''}
    ${(info.job_fecha || info.job_hora_fin) ? `<div class="info-row"><span class="info-icon">📅</span>${[info.job_fecha, info.job_hora_fin].filter(Boolean).join(' · ')}</div>` : ''}
  </div>

  ${info.job_notas ? `
  <div class="divider"></div>
  <p class="section-label">Descripción del trabajo</p>
  <div class="notas-box">${info.job_notas.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
  ` : ''}

  <div class="firma-section">
    <div class="divider"></div>
    <p class="section-label">Conformidad del cliente</p>
    ${firmaHtml}
  </div>

  <div class="footer">
    Documento generado por <strong>TRABFLOW</strong> · ${new Date().toLocaleDateString('es-ES')}
  </div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
