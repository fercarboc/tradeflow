/**
 * transportLocations.ts — Tipos de ubicación y contacto para servicios de transporte.
 * TRANSPORT-ROUTE-ADDRESS-1: modelo reutilizable por servicios, presupuestos (TQ-1A),
 * agenda, partes de servicio y planificación de rutas.
 */

// ── Catálogos ─────────────────────────────────────────────────────────────────

export const TIPO_LUGAR_OPTIONS = [
  { value: 'hotel',             label: 'Hotel' },
  { value: 'aeropuerto',        label: 'Aeropuerto' },
  { value: 'estacion',          label: 'Estación (tren / autobús)' },
  { value: 'colegio',           label: 'Colegio / Centro educativo' },
  { value: 'asociacion',        label: 'Asociación / Club' },
  { value: 'empresa',           label: 'Empresa / Oficina' },
  { value: 'domicilio',         label: 'Domicilio particular' },
  { value: 'recinto_deportivo', label: 'Recinto deportivo' },
  { value: 'aparcamiento',      label: 'Aparcamiento' },
  { value: 'otro',              label: 'Otro' },
] as const;

export const TIPO_FUNCION_OPTIONS = [
  { value: 'responsable_grupo', label: 'Responsable del grupo' },
  { value: 'guia',              label: 'Guía' },
  { value: 'coordinador',       label: 'Coordinador/a' },
  { value: 'encargado',         label: 'Encargado/a' },
  { value: 'otro',              label: 'Otro' },
] as const;

export const TIPO_OPERACION_OPTIONS = [
  { value: 'recogida',       label: 'Recogida' },
  { value: 'bajada',         label: 'Bajada' },
  { value: 'parada_tecnica', label: 'Parada técnica' },
  { value: 'otro',           label: 'Otro' },
] as const;

export type TipoLugar          = typeof TIPO_LUGAR_OPTIONS[number]['value'];
export type TipoFuncionContacto = typeof TIPO_FUNCION_OPTIONS[number]['value'];
export type TipoOperacionParada = typeof TIPO_OPERACION_OPTIONS[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Punto geográfico con dirección postal completa.
 * Todos los campos son opcionales: un punto puede ser tan detallado como necesite
 * el operador. No se exige número de calle cuando el lugar no lo tiene.
 * Las coordenadas son opcionales y solo deben marcarse como "confirmed" si
 * han sido verificadas explícitamente por el usuario.
 */
export interface TransportLocation {
  nombre_lugar?:    string;          // "Hotel NH Las Américas"
  tipo_lugar?:      TipoLugar;       // 'hotel' | 'aeropuerto' | ...
  calle?:           string;          // "Avenida de América"
  numero?:          string;          // "11" — omitir si el lugar no tiene número
  cp?:              string;          // "28003"
  localidad?:       string;          // "Madrid"
  provincia?:       string;          // "Madrid"
  pais?:            string;          // "España"
  terminal?:        string;          // "T1" — terminal, dársena, andén, acceso
  punto_encuentro?: string;          // "Puerta salidas internacionales / zona buses"
  indicaciones?:    string;          // Instrucciones específicas para el conductor
  lat?:             number | null;   // Solo si geocodificado o confirmado
  lng?:             number | null;
  geo_source?:      'manual' | 'geocoded' | 'confirmed';
}

/**
 * Persona de contacto: responsable operativo durante el servicio.
 * Distinto del cliente contratante (que es el que recibe la factura).
 * El conductor usará este contacto durante el servicio.
 */
export interface TransportContact {
  nombre?:        string;                 // "María García López"
  organizacion?:  string;                 // "IES Cervantes / Club Atletismo"
  funcion?:       TipoFuncionContacto;    // 'responsable_grupo' | ...
  telefono?:      string;                 // Móvil principal (llamar en ruta)
  telefono_alt?:  string;                 // Alternativo opcional
  email?:         string;
  observaciones?: string;                 // Notas adicionales de contacto
}

/**
 * Segmento de trayecto: ida, vuelta, etapa de viaje multidía, etc.
 * Modelado para reutilización futura en TQ-1A presupuestos y contratos.
 * UI multi-segmento pendiente (T2).
 */
export interface TransportSegment {
  id?:           string;
  tipo?:         'ida' | 'vuelta' | 'tramo';
  label?:        string;       // "Ida", "Vuelta", "Día 2 — Visita"
  origen?:       TransportLocation;
  destino?:      TransportLocation;
  fecha_inicio?: string;       // ISO timestamptz
  fecha_fin?:    string;       // ISO timestamptz
  orden?:        number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Genera una representación de texto corta a partir de TransportLocation.
 *  Prioriza: nombre_lugar > localidad > dirección postal. */
export function locationToText(loc: TransportLocation | null | undefined): string {
  if (!loc) return '';
  if (loc.nombre_lugar) return loc.nombre_lugar;
  if (loc.localidad)   return loc.localidad;
  const parts = [loc.calle, loc.numero].filter(Boolean).join(' ');
  return parts || '';
}

/** Genera la dirección completa en una línea para mostrar al conductor. */
export function locationToAddress(loc: TransportLocation | null | undefined): string {
  if (!loc) return '';
  const line1Parts = [loc.calle, loc.numero].filter(Boolean).join(' ');
  const line2Parts = [loc.cp, loc.localidad, loc.provincia].filter(Boolean).join(', ');
  const parts = [loc.nombre_lugar, line1Parts, line2Parts].filter(Boolean);
  return parts.join(' — ');
}

/** True si la ubicación tiene al menos un campo de dirección postal. */
export function hasAddress(loc: TransportLocation | null | undefined): boolean {
  if (!loc) return false;
  return !!(loc.nombre_lugar || loc.calle || loc.localidad || loc.cp);
}

/** True si el contacto tiene al menos nombre o teléfono. */
export function hasContact(c: TransportContact | null | undefined): boolean {
  if (!c) return false;
  return !!(c.nombre || c.telefono);
}

/** Genera un objeto vacío de TransportLocation. */
export function emptyLocation(): TransportLocation {
  return {};
}

/** Genera un objeto vacío de TransportContact. */
export function emptyContact(): TransportContact {
  return {};
}

/** Valida un número de teléfono español de forma permisiva.
 *  Acepta formato con o sin prefijo +34, espacios y guiones.
 *  Solo para UI — no bloquea el guardado si es inválido. */
export function isValidSpanishPhone(tel: string): boolean {
  if (!tel.trim()) return true;   // vacío = válido (campo opcional)
  const clean = tel.trim().replace(/[\s\-().]/g, '');
  // Móvil/fijo español con o sin +34
  return /^(\+?34)?[6789]\d{8}$/.test(clean);
}

/** Formatea un teléfono para enlace tel: */
export function phoneHref(tel: string | undefined): string | null {
  if (!tel?.trim()) return null;
  const clean = tel.trim().replace(/[\s\-().]/g, '');
  return `tel:${clean}`;
}
