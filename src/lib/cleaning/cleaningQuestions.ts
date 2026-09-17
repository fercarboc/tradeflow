// Motor de preguntas dinámicas para sector Limpieza.
// TrabFlow decide qué preguntar; la IA interpreta el lenguaje natural.
// Las preguntas se activan SÓLO para datos relevantes que faltan.

import { CleaningQuoteIntake, SpaceType, ServiceType } from './cleaningIntake';

export type FieldPriority = 'required' | 'recommended' | 'optional';

export interface FieldDef {
  key: keyof CleaningQuoteIntake;
  label: string;
  question: string;
  // Por defecto 'optional'. Se eleva a 'required'/'recommended' en los casos declarados.
  defaultPriority: FieldPriority;
  // Eleva la prioridad para combinaciones concretas de (spaceType, serviceType).
  elevations?: {
    spaceTypes?: SpaceType[];
    serviceTypes?: ServiceType[];
    priority: FieldPriority;
  }[];
}

// Catálogo declarativo de todos los campos con sus prioridades por contexto.
const FIELD_DEFS: FieldDef[] = [
  {
    key: 'spaceType',
    label: 'Tipo de espacio',
    question: '¿Qué tipo de espacio es? (vivienda, oficina, local, comunidad…)',
    defaultPriority: 'required',
  },
  {
    key: 'serviceType',
    label: 'Tipo de servicio',
    question: '¿Qué tipo de limpieza necesitas? (integral, puntual, fin de obra, cristales…)',
    defaultPriority: 'required',
  },
  {
    key: 'recurrence',
    label: 'Puntual o recurrente',
    question: '¿Es una limpieza puntual o un servicio recurrente/periódico?',
    defaultPriority: 'required',
  },
  {
    key: 'surfaceM2',
    label: 'Superficie (m²)',
    question: '¿Cuántos metros cuadrados tiene el espacio aproximadamente?',
    defaultPriority: 'recommended',
    elevations: [
      { spaceTypes: ['local_comercial', 'nave', 'oficina', 'despacho'], priority: 'required' },
    ],
  },
  {
    key: 'rooms',
    label: 'Habitaciones',
    question: '¿Cuántas habitaciones/dormitorios tiene?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['vivienda'], priority: 'recommended' },
    ],
  },
  {
    key: 'bathrooms',
    label: 'Baños / aseos',
    question: '¿Cuántos baños o aseos tiene?',
    defaultPriority: 'recommended',
    elevations: [
      { spaceTypes: ['vivienda', 'oficina', 'local_comercial'], priority: 'required' },
    ],
  },
  {
    key: 'floors',
    label: 'Plantas',
    question: '¿Cuántas plantas tiene el edificio/espacio?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['comunidad', 'edificio'], priority: 'required' },
    ],
  },
  {
    key: 'portals',
    label: 'Portales',
    question: '¿Cuántos portales tiene la comunidad?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['comunidad', 'edificio'], priority: 'recommended' },
    ],
  },
  {
    key: 'elevators',
    label: 'Ascensores',
    question: '¿Tiene ascensor? ¿Cuántos?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['comunidad', 'edificio'], priority: 'recommended' },
    ],
  },
  {
    key: 'garage',
    label: 'Garaje',
    question: '¿Incluye limpieza de garaje?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['comunidad', 'edificio'], priority: 'recommended' },
    ],
  },
  {
    key: 'terrace',
    label: 'Terraza',
    question: '¿Hay terraza o patio que limpiar?',
    defaultPriority: 'optional',
    elevations: [
      { spaceTypes: ['vivienda'], priority: 'recommended' },
    ],
  },
  {
    key: 'windows',
    label: 'Cristales / ventanas',
    question: '¿Incluimos la limpieza de cristales y ventanas?',
    defaultPriority: 'optional',
    elevations: [
      { serviceTypes: ['cristales', 'limpieza_integral', 'fin_de_obra'], priority: 'required' },
      { spaceTypes: ['local_comercial', 'oficina'], priority: 'recommended' },
    ],
  },
  {
    key: 'blinds',
    label: 'Persianas',
    question: '¿Hay que limpiar también las persianas?',
    defaultPriority: 'optional',
    elevations: [
      { serviceTypes: ['limpieza_integral', 'fin_de_obra'], priority: 'recommended' },
    ],
  },
  {
    key: 'furnishingState',
    label: 'Estado del inmueble',
    question: '¿Está vacío, parcialmente amueblado, amueblado o completamente equipado?',
    defaultPriority: 'optional',
    elevations: [
      {
        spaceTypes: ['vivienda', 'local_comercial', 'oficina'],
        serviceTypes: ['limpieza_integral', 'fin_de_obra', 'cambio_inquilino'],
        priority: 'recommended',
      },
    ],
  },
  {
    key: 'workers',
    label: 'Operarios',
    question: '¿Con cuántos operarios vas a realizar el servicio?',
    defaultPriority: 'optional',
  },
  {
    key: 'estimatedHoursPerWorker',
    label: 'Horas por operario/visita',
    question: '¿Cuántas horas estimadas por operario y visita?',
    defaultPriority: 'optional',
  },
  {
    key: 'visitsPerWeek',
    label: 'Visitas/semana',
    question: '¿Cuántas visitas por semana?',
    defaultPriority: 'optional',
    elevations: [
      {
        serviceTypes: ['mantenimiento'],
        spaceTypes: ['comunidad', 'oficina', 'edificio'],
        priority: 'required',
      },
    ],
  },
  {
    key: 'visitsPerMonth',
    label: 'Visitas/mes',
    question: '¿Cuántas visitas al mes si no es semanal?',
    defaultPriority: 'optional',
  },
];

function getEffectivePriority(
  def: FieldDef,
  spaceType?: SpaceType,
  serviceType?: ServiceType,
): FieldPriority {
  let best: FieldPriority = def.defaultPriority;
  const order: Record<FieldPriority, number> = { optional: 0, recommended: 1, required: 2 };

  for (const elev of def.elevations ?? []) {
    const spaceMatch = !elev.spaceTypes || (spaceType && elev.spaceTypes.includes(spaceType));
    const serviceMatch = !elev.serviceTypes || (serviceType && elev.serviceTypes.includes(serviceType));
    if (spaceMatch && serviceMatch) {
      if (order[elev.priority] > order[best]) best = elev.priority;
    }
  }
  return best;
}

// Verifica si un campo está aún ausente en el intake.
function isMissing(intake: Partial<CleaningQuoteIntake>, key: keyof CleaningQuoteIntake): boolean {
  const v = intake[key];
  return v === undefined || v === null;
}

export interface ActiveQuestion {
  key: keyof CleaningQuoteIntake;
  label: string;
  question: string;
  priority: FieldPriority;
}

// Devuelve únicamente las preguntas relevantes para los datos AUSENTES.
// Si recurrence está detectado como 'one_off', descarta preguntas de visitas.
export function getMissingQuestions(
  intake: Partial<CleaningQuoteIntake>,
): ActiveQuestion[] {
  const { spaceType, serviceType, recurrence } = intake;
  const result: ActiveQuestion[] = [];

  for (const def of FIELD_DEFS) {
    // Si ya está informado, no preguntar.
    if (!isMissing(intake, def.key)) continue;

    // Si la recurrencia es one_off, no preguntar campos de frecuencia de visitas.
    if (recurrence === 'one_off' && (def.key === 'visitsPerWeek' || def.key === 'visitsPerMonth')) continue;

    // Si no es comunidad/edificio, no preguntar portales ni plantas de forma obligatoria.
    if (def.key === 'portals' && spaceType !== 'comunidad' && spaceType !== 'edificio') continue;

    const priority = getEffectivePriority(def, spaceType, serviceType);
    // Solo mostrar required y recommended.
    if (priority === 'optional') continue;

    result.push({ key: def.key, label: def.label, question: def.question, priority });
  }

  // required primero, recommended después.
  result.sort((a, b) => {
    const order: Record<FieldPriority, number> = { required: 0, recommended: 1, optional: 2 };
    return order[a.priority] - order[b.priority];
  });

  return result;
}
