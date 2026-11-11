// Mi página online — lógica pura (sin acceso a BD), reutilizable y testeable.

export interface PreguntaFormulario {
  id: string;
  etiqueta: string;
  tipo: 'texto' | 'opciones';
  opciones?: string[];
  obligatoria?: boolean;
}

export interface CifraDestacada {
  valor: string;
  etiqueta: string;
}

export interface PublicPage {
  id?: string;
  org_id?: string;
  slug: string;
  activa: boolean;
  nombre: string;
  oficio: string;
  whatsapp: string;
  acerca: string;
  acerca_on: boolean;
  servicios: string[];
  servicios_on: boolean;
  cifras: CifraDestacada[];
  cifras_on: boolean;
  preguntas: PreguntaFormulario[];
  portfolio: string[];
  portfolio_on: boolean;
  portada_url: string;
}

export type EstadoSolicitud = 'nuevo' | 'contactado' | 'convertido' | 'rechazado';

export interface PageRequest {
  id: string;
  nombre: string;
  telefono: string;
  respuestas: { pregunta: string; respuesta: string }[];
  mensaje: string;
  estado: EstadoSolicitud;
  quote_numero: string | null;
  created_at: string;
}

/** «Fontanería García» → «fontaneria-garcia» (válido para la URL /pro/{slug}). */
export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/ñ/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) && slug.length >= 3 && slug.length <= 60;
}

/** Preguntas iniciales sugeridas según el oficio (el instalador puede cambiarlas). */
export function defaultPreguntas(oficio: string): PreguntaFormulario[] {
  const o = oficio.toLowerCase();
  if (o.includes('pint')) {
    return [
      { id: 'tipo', etiqueta: 'Tipo de pintura', tipo: 'opciones', opciones: ['Interior', 'Exterior', 'Decorativa', 'Impermeabilización'], obligatoria: true },
      { id: 'tamano', etiqueta: 'Número de habitaciones o m²', tipo: 'texto' },
      { id: 'detalles', etiqueta: 'Detalles adicionales', tipo: 'texto' },
    ];
  }
  if (o.includes('elec')) {
    return [
      { id: 'tipo', etiqueta: 'Tipo de trabajo', tipo: 'opciones', opciones: ['Avería', 'Instalación nueva', 'Boletín / certificado', 'Otro'], obligatoria: true },
      { id: 'detalles', etiqueta: 'Describe el trabajo', tipo: 'texto' },
    ];
  }
  if (o.includes('font') || o.includes('plom')) {
    return [
      { id: 'tipo', etiqueta: 'Tipo de trabajo', tipo: 'opciones', opciones: ['Fuga / avería', 'Baño o cocina', 'Termo / calentador', 'Otro'], obligatoria: true },
      { id: 'detalles', etiqueta: 'Describe el trabajo', tipo: 'texto' },
    ];
  }
  if (o.includes('clima') || o.includes('aire') || o.includes('calef')) {
    return [
      { id: 'tipo', etiqueta: 'Tipo de trabajo', tipo: 'opciones', opciones: ['Instalación', 'Mantenimiento', 'Avería', 'Otro'], obligatoria: true },
      { id: 'detalles', etiqueta: 'Equipo y detalles', tipo: 'texto' },
    ];
  }
  return [
    { id: 'tipo', etiqueta: '¿Qué necesitas?', tipo: 'texto', obligatoria: true },
    { id: 'detalles', etiqueta: 'Detalles adicionales', tipo: 'texto' },
  ];
}

export function emptyPage(nombre: string, oficio: string, whatsapp: string): PublicPage {
  return {
    slug: slugify(nombre) || 'mi-empresa',
    activa: false,
    nombre,
    oficio,
    whatsapp,
    acerca: '',
    acerca_on: true,
    servicios: [],
    servicios_on: true,
    cifras: [],
    cifras_on: false,
    preguntas: defaultPreguntas(oficio),
    portfolio: [],
    portfolio_on: false,
    portada_url: '',
  };
}

/** Texto que se pasa al presupuesto (y a la IA) al convertir una solicitud. */
export function requestToDescription(r: Pick<PageRequest, 'respuestas' | 'mensaje'>): string {
  const lines = (r.respuestas ?? [])
    .filter(x => x.respuesta?.trim())
    .map(x => `${x.pregunta}: ${x.respuesta}`);
  if (r.mensaje?.trim()) lines.push(r.mensaje.trim());
  return lines.join('. ');
}

/** Teléfono para wa.me: solo dígitos y prefijo 34 si es un número español sin prefijo. */
export function waNumber(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length === 9) return `34${digits}`;
  return digits.replace(/^00/, '');
}

export const ESTADO_SOLICITUD_LABEL: Record<EstadoSolicitud, string> = {
  nuevo: 'Nuevo',
  contactado: 'Contactado',
  convertido: 'Convertido',
  rechazado: 'Rechazado',
};
