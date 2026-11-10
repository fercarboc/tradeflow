// Genera un PDF (A4) a partir del HTML de la factura Verifactu, en el navegador.
// jspdf y html2canvas se cargan bajo demanda para no aumentar el bundle inicial.

const A4_WIDTH_PX = 794; // 210 mm a 96 dpi

export function invoicePdfFilename(numero: string | null | undefined): string {
  const safe = (numero ?? 'factura').replace(/[^A-Za-z0-9_-]+/g, '-');
  return `Factura_${safe}.pdf`;
}

export async function htmlToPdfFile(html: string, filename: string): Promise<File> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = `position:fixed;left:-10000px;top:0;width:${A4_WIDTH_PX}px;height:1123px;border:0;visibility:hidden`;
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open();
    // Ocultar el botón "Descargar PDF" de la vista web: no debe salir en el documento
    doc.write(html.replace('</head>', '<style>button{display:none!important}</style></head>'));
    doc.close();

    await new Promise<void>(resolve => {
      if (doc.readyState === 'complete') resolve();
      else iframe.onload = () => resolve();
      setTimeout(resolve, 3000);
    });
    try { await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready; } catch { /* sin fuentes web */ }
    await Promise.all(Array.from(doc.images).map(img => img.complete ? null : new Promise(r => {
      img.onload = r; img.onerror = r; setTimeout(r, 4000);
    })));

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
    const canvas = await html2canvas(doc.body, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: A4_WIDTH_PX,
      width: A4_WIDTH_PX,
      height: doc.body.scrollHeight,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const pageW = 210;
    const pageH = 297;
    const pagePxH = Math.floor(canvas.width * (pageH / pageW));
    let offset = 0;
    let first = true;
    while (offset < canvas.height) {
      const sliceH = Math.min(pagePxH, canvas.height - offset);
      const page = document.createElement('canvas');
      page.width = canvas.width;
      page.height = sliceH;
      const ctx = page.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, page.width, page.height);
      ctx.drawImage(canvas, 0, offset, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
      if (!first) pdf.addPage();
      pdf.addImage(page.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, sliceH * (pageW / canvas.width));
      first = false;
      offset += sliceH;
    }

    return new File([pdf.output('blob')], filename, { type: 'application/pdf' });
  } finally {
    iframe.remove();
  }
}

export type ShareResult = 'shared' | 'cancelled' | 'unsupported' | 'needs_gesture';

/** Comparte el PDF con el menú nativo (el usuario elige WhatsApp y el PDF va adjunto). */
export async function shareInvoicePdf(file: File, text: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (!nav.share || !nav.canShare || !nav.canShare({ files: [file] })) return 'unsupported';
  try {
    await nav.share({ files: [file], text, title: file.name });
    return 'shared';
  } catch (err) {
    const name = (err as DOMException)?.name;
    if (name === 'AbortError') return 'cancelled';
    // Se agotó la activación del gesto mientras se generaba el PDF: requiere otro toque
    if (name === 'NotAllowedError') return 'needs_gesture';
    throw err;
  }
}

export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
