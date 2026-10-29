/**
 * transportVoiceIntake.ts — Tipos y utilidades para el intake de transporte
 * producido por trade-voice-to-quote (TX-C3-A).
 *
 * El edge function devuelve `transport_intake` en la respuesta cuando detecta
 * oficio="transporte". Este módulo expone los tipos y funciones auxiliares para
 * que el frontend lo consuma.
 */

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type TransportTipoServicio =
  | 'excursion'
  | 'traslado_empresa'
  | 'traslado_privado'
  | 'ruta_escolar'
  | 'transporte_trabajadores'
  | 'circuito_turistico'
  | 'aeropuerto'
  | 'discrecional'
  | 'recurrente';

export interface TransportIntakeData {
  tipo_servicio: TransportTipoServicio | null;
  origen: string | null;
  destino: string | null;
  fecha_servicio: string | null;
  fecha_fin_servicio: string | null;
  num_viajeros: number | null;
  precio_base: number | null;
  precio_incluye_iva: boolean;
  precio_origen: 'dictado_usuario' | 'pendiente';
  itinerario: string[];
  condiciones_especiales: string[];
  campos_pendientes: string[];
}

export interface TransportIntake {
  schemaVersion: 1;
  vertical: 'transporte';
  intake: TransportIntakeData;
}

export const TRANSPORT_TIPO_LABELS: Record<TransportTipoServicio, string> = {
  excursion:               'Excursión',
  traslado_empresa:        'Traslado empresa',
  traslado_privado:        'Traslado privado',
  ruta_escolar:            'Ruta escolar',
  transporte_trabajadores: 'Transporte de trabajadores',
  circuito_turistico:      'Circuito turístico',
  aeropuerto:              'Traslado aeropuerto',
  discrecional:            'Servicio discrecional',
  recurrente:              'Servicio recurrente',
};

// ── Validación ────────────────────────────────────────────────────────────────

const VALID_TIPOS = new Set<string>([
  'excursion','traslado_empresa','traslado_privado','ruta_escolar',
  'transporte_trabajadores','circuito_turistico','aeropuerto','discrecional','recurrente',
]);

export function isValidTransportIntake(value: unknown): value is TransportIntake {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.schemaVersion === 1 &&
    v.vertical === 'transporte' &&
    !!v.intake &&
    typeof v.intake === 'object'
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Devuelve el label legible del tipo de servicio, o el valor crudo si no está en el mapa. */
export function getTipoLabel(tipo: TransportTipoServicio | null): string {
  if (!tipo) return '—';
  return TRANSPORT_TIPO_LABELS[tipo] ?? tipo;
}

/** Indica si el intake tiene suficientes datos para prefill de un presupuesto de transporte. */
export function intakeHasPrefillData(intake: TransportIntakeData): boolean {
  return !!(intake.tipo_servicio && (intake.origen || intake.destino || intake.fecha_servicio));
}

/** Devuelve el precio con IVA calculado, o null si no hay precio base. */
export function calcularPrecioConIva(
  intake: TransportIntakeData,
  ivaPct = 21,
): number | null {
  if (intake.precio_base === null) return null;
  if (intake.precio_incluye_iva) return intake.precio_base;
  return Math.round(intake.precio_base * (1 + ivaPct / 100) * 100) / 100;
}

/**
 * Construye un mapa de campos para prefill del formulario de presupuesto de transporte.
 * Solo incluye campos con valor no nulo.
 */
export function buildPrefillFromIntake(
  intake: TransportIntakeData,
): Partial<{
  tipo_servicio: TransportTipoServicio;
  titulo: string;
  fecha_servicio: string;
  fecha_fin_servicio: string;
  num_viajeros: number;
  precio_final: number;
  itinerario: Array<{ nombre: string }>;
  notas: string;
}> {
  const result: ReturnType<typeof buildPrefillFromIntake> = {};

  if (intake.tipo_servicio && VALID_TIPOS.has(intake.tipo_servicio)) {
    result.tipo_servicio = intake.tipo_servicio;
  }
  if (intake.origen || intake.destino) {
    const partes = [intake.origen, intake.destino].filter(Boolean);
    result.titulo = partes.join(' → ');
  }
  if (intake.fecha_servicio) result.fecha_servicio = intake.fecha_servicio;
  if (intake.fecha_fin_servicio) result.fecha_fin_servicio = intake.fecha_fin_servicio;
  if (intake.num_viajeros !== null) result.num_viajeros = intake.num_viajeros;

  const precioConIva = calcularPrecioConIva(intake);
  if (precioConIva !== null) result.precio_final = precioConIva;

  if (intake.itinerario.length > 0) {
    result.itinerario = intake.itinerario.map(nombre => ({ nombre }));
  }
  if (intake.condiciones_especiales.length > 0) {
    result.notas = intake.condiciones_especiales.join('. ');
  }

  return result;
}
