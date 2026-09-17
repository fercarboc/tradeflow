import {
  resolveTemplate,
  buildTemplateVars,
  ensureAcceptanceUrl,
  DEFAULT_TEMPLATES,
} from './templateEngine';

export interface WhatsAppQuoteParams {
  quote: {
    id: string;
    nombreCliente?: string;
    total: number;
    iva_pct?: number | null;
    fecha?: string;
  };
  empresa?: {
    nombre?: string;
    telefonoMovil?: string;
    email?: string;
    nif?: string;
    direccion?: string;
  };
  customTemplate?: string;
  acceptanceUrl?: string;
  pdfUrl?: string;
}

// Genera el mensaje WhatsApp del presupuesto.
// Usa el template personalizado del org si existe; si no, el DEFAULT_TEMPLATES.whatsapp_presupuesto.
// El mensaje es siempre breve (no incluye el listado de partidas) independientemente
// del número de líneas del presupuesto.
export function buildQuoteWhatsAppMessage(params: WhatsAppQuoteParams): string {
  const { quote, empresa = {}, customTemplate, acceptanceUrl, pdfUrl } = params;
  const iva = quote.iva_pct ?? 21;
  const template = customTemplate || DEFAULT_TEMPLATES.whatsapp_presupuesto;
  const vars = buildTemplateVars({
    empresa: {
      nombre: empresa.nombre,
      telefono: empresa.telefonoMovil,
      email: empresa.email,
      nif: empresa.nif,
      direccion: empresa.direccion,
    },
    cliente: { nombre: quote.nombreCliente ?? '' },
    presupuesto: {
      numero: quote.id,
      fecha: quote.fecha,
      total: quote.total,
      iva,
    },
    enlaceAceptacion: acceptanceUrl,
    enlacePdf: pdfUrl,
  });
  return ensureAcceptanceUrl(resolveTemplate(template, vars), acceptanceUrl);
}

// Construye la URL de WhatsApp (wa.me) con el mensaje pre-rellenado.
// Si `phone` es null/undefined genera un enlace sin número (el usuario elige el contacto).
export function buildWaUrl(phone: string | undefined | null, text: string): string {
  const clean = (phone ?? '').replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
  const num = clean ? (clean.startsWith('34') ? clean : `34${clean}`) : '';
  return num
    ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
}
