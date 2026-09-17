// Sector Limpieza — tipos, parser determinista y utilidades de intake.
// El parser NUNCA inventa valores: los campos no detectados quedan null/undefined.
// La IA interpreta lenguaje natural; este módulo decide estructura y reglas.

export type SpaceType =
  | 'vivienda'
  | 'oficina'
  | 'despacho'
  | 'local_comercial'
  | 'comunidad'
  | 'garaje'
  | 'nave'
  | 'edificio'
  | 'otro';

export type ServiceType =
  | 'limpieza_integral'
  | 'limpieza_general'
  | 'mantenimiento'
  | 'puntual'
  | 'fin_de_obra'
  | 'cristales'
  | 'limpieza_profunda'
  | 'cambio_inquilino'
  | 'otro';

export type Recurrence = 'one_off' | 'recurring';

export type FurnishingState = 'vacio' | 'parcialmente_amueblado' | 'amueblado' | 'equipado';

export type DirtLevel = 'normal' | 'suciedad_alta' | 'suciedad_muy_alta' | 'fin_de_obra';

// Frecuencia para una tarea concreta dentro de un contrato recurrente.
export interface TaskFrequency {
  task: string;      // ej: 'portal', 'escaleras', 'garaje', 'cristales'
  timesPerWeek?: number;   // null si se expresa en otras unidades
  timesPerMonth?: number;
}

// Contrato de intake de presupuesto de limpieza.
// Todos los campos son opcionales; los no detectados quedan undefined/null.
export interface CleaningQuoteIntake {
  spaceType?: SpaceType;
  serviceType?: ServiceType;
  recurrence?: Recurrence;

  // Dimensiones físicas
  surfaceM2?: number;
  rooms?: number;
  bathrooms?: number;
  kitchens?: number;
  floors?: number;
  portals?: number;
  elevators?: number;

  // Elementos adicionales
  garage?: boolean;
  terrace?: boolean;
  windows?: boolean;
  blinds?: boolean;
  escaparates?: boolean;

  // Estado
  furnishingState?: FurnishingState;
  dirtLevel?: DirtLevel;

  // Operarios y tiempos
  workers?: number;
  estimatedHoursPerWorker?: number;
  estimatedDuration?: number;   // horas de duración del servicio (= estimatedHoursPerWorker si un solo turno)

  // Recurrencia
  visitsPerWeek?: number;
  visitsPerMonth?: number;
  frequencies?: TaskFrequency[];  // frecuencias específicas por tarea

  notes?: string;
}

// Metadata tipada para trade_quotes.metadata (vertical cleaning).
export interface CleaningQuoteMetadata {
  vertical: 'cleaning';
  schemaVersion: 1;
  intake: CleaningQuoteIntake;
}

// ─── Parser determinista ───────────────────────────────────────────────────────
// Extrae datos estructurados de texto libre en español.
// No requiere LLM. Los valores ausentes quedan undefined.

const WORD_NUMBERS: Record<string, string> = {
  'cero': '0', 'un': '1', 'una': '1', 'uno': '1', 'dos': '2', 'tres': '3',
  'cuatro': '4', 'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8',
  'nueve': '9', 'diez': '10', 'once': '11', 'doce': '12', 'trece': '13',
  'catorce': '14', 'quince': '15', 'veinte': '20',
};

// Reemplaza palabras numéricas en español por su dígito equivalente.
// Solo sustituye tokens completos para evitar falsos positivos.
function normalizeWordNumbers(text: string): string {
  return text.replace(/\b(cero|uno?|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|veinte)\b/gi,
    (match) => WORD_NUMBERS[match.toLowerCase()] ?? match);
}

function extractNumber(text: string, patterns: RegExp[]): number | undefined {
  const normalized = normalizeWordNumbers(text);
  for (const re of patterns) {
    const m = normalized.match(re);
    if (m) {
      const n = parseFloat(m[1].replace(',', '.'));
      if (!isNaN(n) && n > 0) return n;
    }
  }
  return undefined;
}

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some(p => p.test(text));
}

const SPACE_RULES: [RegExp, SpaceType][] = [
  [/\b(piso|vivienda|apartamento|casa|chalet|ático|atico|dúplex|duplex|hogar)\b/i, 'vivienda'],
  [/\boficina\b/i, 'oficina'],
  [/\bdespacho\b/i, 'despacho'],
  [/\b(local\s+comercial|local\b(?!\s+de\s+ocio))/i, 'local_comercial'],
  [/\b(comunidad|comunidades|portal|portales|escalera|rellano)\b/i, 'comunidad'],
  [/\bgaraje\b/i, 'garaje'],
  [/\bnave\b/i, 'nave'],
  [/\bedificio\b/i, 'edificio'],
];

const SERVICE_RULES: [RegExp, ServiceType][] = [
  [/\bfin\s+de\s+obra\b|\bpost[- ]?obra\b|\btras\s+reforma\b/i, 'fin_de_obra'],
  [/\bintegral\b/i, 'limpieza_integral'],
  [/\bcristal(es)?\b/i, 'cristales'],
  [/\bcambio\s+de\s+inquilino\b/i, 'cambio_inquilino'],
  [/\bprofunda\b/i, 'limpieza_profunda'],
  [/\bmantenimiento\b/i, 'mantenimiento'],
  [/\bpuntual\b|\buna\s+sola\s+vez\b|\buna\s+vez\b/i, 'puntual'],
  [/\bgeneral\b/i, 'limpieza_general'],
];

const RECURRING_SIGNALS = [
  /\b(\d+)\s*veces?\s*(a\s+la\s+|por\s+|\/\s*)?semana\b/i,
  /\b(\d+)\s*visitas?\s*(a\s+la\s+|por\s+|\/\s*)?semana\b/i,
  /\b(\d+)\s*veces?\s*(al\s+|por\s+|\/\s*)?mes\b/i,
  /\bsemanal(mente)?\b/i,
  /\bmensu(al|almente)\b/i,
  /\brecurrente\b|\bperiódic(o|a)\b|\bcontrato\b/i,
];

const ONE_OFF_SIGNALS = [
  /\bpuntual\b/i,
  /\buna\s+sola\s+vez\b/i,
  // "una vez" sin periodo de tiempo (no "una vez al mes", "una vez a la semana")
  /\buna\s+vez\b(?!\s+(?:al?\s+mes|a\s+la\s+semana|por\s+semana|al\s+año))/i,
  /\b(un\s+)?día\s+concreto\b/i,
];

function detectRecurrence(text: string): Recurrence | undefined {
  const normalized = normalizeWordNumbers(text);
  if (matchesAny(text, ONE_OFF_SIGNALS)) return 'one_off';
  if (matchesAny(normalized, RECURRING_SIGNALS)) return 'recurring';
  // 'fin_de_obra' implica puntual
  if (/\bfin\s+de\s+obra\b/i.test(text)) return 'one_off';
  return undefined;
}

function extractTaskFrequencies(text: string): TaskFrequency[] {
  const normalized = normalizeWordNumbers(text);
  const freqs: TaskFrequency[] = [];
  const taskPatterns: [RegExp, string, 'week' | 'month'][] = [
    [/garaje[^\d]*(\d+)\s*vez(?:ces)?\s*(?:al?\s*)?mes/i, 'garaje', 'month'],
    [/garaje[^\d]*(\d+)\s*vez(?:ces)?\s*(?:a\s+la\s*|por\s*)?semana/i, 'garaje', 'week'],
    [/cristales?[^\d]*(\d+)\s*vez(?:ces)?\s*(?:a\s+la\s*|por\s*)?semana/i, 'cristales', 'week'],
    [/cristales?[^\d]*(\d+)\s*vez(?:ces)?\s*(?:al?\s*)?mes/i, 'cristales', 'month'],
    [/ascensor[^\d]*(\d+)\s*vez(?:ces)?\s*(?:a\s+la\s*|por\s*)?semana/i, 'ascensor', 'week'],
    [/escaleras?[^\d]*(\d+)\s*vez(?:ces)?\s*(?:a\s+la\s*|por\s*)?semana/i, 'escaleras', 'week'],
    [/portal[^\d]*(\d+)\s*vez(?:ces)?\s*(?:a\s+la\s*|por\s*)?semana/i, 'portal', 'week'],
  ];
  for (const [re, task, unit] of taskPatterns) {
    const m = normalized.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (isNaN(n)) continue;
      if (!freqs.find(f => f.task === task)) {
        freqs.push(unit === 'month' ? { task, timesPerMonth: n } : { task, timesPerWeek: n });
      }
    }
  }
  return freqs;
}

export function parseCleaningIntake(text: string): Partial<CleaningQuoteIntake> {

  // Space type
  let spaceType: SpaceType | undefined;
  for (const [re, st] of SPACE_RULES) {
    if (re.test(text)) { spaceType = st; break; }
  }

  // Service type
  let serviceType: ServiceType | undefined;
  for (const [re, sv] of SERVICE_RULES) {
    if (re.test(text)) { serviceType = sv; break; }
  }

  const recurrence = detectRecurrence(text);

  // Surface m2
  const surfaceM2 = extractNumber(text, [
    /(\d+(?:[.,]\d+)?)\s*(?:metros?\s+cuadrados?|m[²2])/i,
    /(\d+(?:[.,]\d+)?)\s*metros?\b/i,  // "45 metros" sin cuadrados
    /(\d+(?:[.,]\d+)?)\s*m\b/,          // "45 m"
  ]);

  // Rooms (habitaciones/dormitorios)
  const rooms = extractNumber(text, [
    /(\d+)\s*habitaci[oó]n(?:es)?/i,
    /(\d+)\s*dormitori(?:o|os)/i,
    /(\d+)\s*cuarto(?:s)?\b/i,
  ]);

  // Bathrooms
  const bathrooms = extractNumber(text, [
    /(\d+)\s*ba[ñn]os?/i,
    /(\d+)\s*ase(?:o|os)\b/i,
  ]);

  // Floors
  const floors = extractNumber(text, [
    /(\d+)\s*planta(?:s)?\b/i,
    /(\d+)\s*pis(?:o|os)\b/i,
  ]);

  // Portals
  const portals = extractNumber(text, [
    /(\d+)\s*portal(?:es)?\b/i,
  ]);

  // Elevators
  const elevators = extractNumber(text, [
    /(\d+)\s*ascensor(?:es)?\b/i,
    /(\d+)\s*elevador(?:es)?\b/i,
  ]);

  // Workers
  const workers = extractNumber(text, [
    /(\d+)\s*(?:personas?|operari(?:o|os)|trabajador(?:es)?|emplead(?:o|os))\b/i,
    /vamos\s+(\d+)\b/i,
    /somos\s+(\d+)\b/i,
  ]);

  // Hours per worker
  const estimatedHoursPerWorker = extractNumber(text, [
    /(\d+(?:[.,]\d+)?)\s*horas?\s+(?:por\s+persona|cada\s+uno|por\s+operario)/i,
    /unas?\s+(\d+(?:[.,]\d+)?)\s*horas?\b/i,
    /(\d+(?:[.,]\d+)?)\s*h(?:oras?)?\s+(?:por\s+)?visita/i,
    /(\d+(?:[.,]\d+)?)\s*horas?\b/i,  // fallback
  ]);

  const textN = normalizeWordNumbers(text);

  // Visits per week
  const visitsPerWeekMatch = textN.match(/(\d+)\s*veces?\s*(?:a\s+la\s*|por\s*)semana/i)
    ?? textN.match(/(\d+)\s*visitas?\s*(?:a\s+la\s*|por\s*)semana/i);
  const visitsPerWeek = visitsPerWeekMatch ? parseInt(visitsPerWeekMatch[1], 10) : undefined;

  // Visits per month
  const visitsPerMonthMatch = textN.match(/(\d+)\s*veces?\s*(?:al?\s*|por\s*)mes/i)
    ?? textN.match(/(\d+)\s*visitas?\s*(?:al?\s*|por\s*)mes/i);
  const visitsPerMonth = visitsPerMonthMatch ? parseInt(visitsPerMonthMatch[1], 10) : undefined;

  // Booleans
  const garage = /\bgaraje\b/i.test(text) ? true : undefined;
  const terrace = /\bterraza\b/i.test(text) ? true : undefined;
  const windows = /\bventana(?:s)?\b|\bcristal(?:es)?\b|\bvidrio(?:s)?\b/i.test(text) ? true : undefined;
  const blinds = /\bpersiana(?:s)?\b/i.test(text) ? true : undefined;
  const escaparates = /\bescaparate(?:s)?\b/i.test(text) ? true : undefined;

  // Furnishing state
  let furnishingState: FurnishingState | undefined;
  if (/sin\s+muebles|prácticamente\s+(?:sin|vac[íi])|completamente\s+vac[íi]|vac[íi](?:a|o)\b/i.test(text)) {
    furnishingState = 'vacio';
  } else if (/parcialmente\s+amueblad|medio\s+amueblad/i.test(text)) {
    furnishingState = 'parcialmente_amueblado';
  } else if (/amueblad[oa]\b/i.test(text)) {
    furnishingState = 'amueblado';
  } else if (/equipad[oa]\b/i.test(text)) {
    furnishingState = 'equipado';
  }

  // Dirt level
  let dirtLevel: DirtLevel | undefined;
  if (/fin\s+de\s+obra|post[- ]?obra|tras\s+reforma/i.test(text)) {
    dirtLevel = 'fin_de_obra';
  } else if (/suciedad\s+(?:muy\s+alta|extrema)|muy\s+suci[oa]/i.test(text)) {
    dirtLevel = 'suciedad_muy_alta';
  } else if (/suciedad\s+alta|bastante\s+suci[oa]/i.test(text)) {
    dirtLevel = 'suciedad_alta';
  }

  // Task-level frequencies (e.g. "garaje una vez al mes")
  const frequencies = extractTaskFrequencies(text);

  const result: Partial<CleaningQuoteIntake> = {};
  if (spaceType !== undefined) result.spaceType = spaceType;
  if (serviceType !== undefined) result.serviceType = serviceType;
  if (recurrence !== undefined) result.recurrence = recurrence;
  if (surfaceM2 !== undefined) result.surfaceM2 = surfaceM2;
  if (rooms !== undefined) result.rooms = rooms;
  if (bathrooms !== undefined) result.bathrooms = bathrooms;
  if (floors !== undefined) result.floors = floors;
  if (portals !== undefined) result.portals = portals;
  if (elevators !== undefined) result.elevators = elevators;
  if (garage !== undefined) result.garage = garage;
  if (terrace !== undefined) result.terrace = terrace;
  if (windows !== undefined) result.windows = windows;
  if (blinds !== undefined) result.blinds = blinds;
  if (escaparates !== undefined) result.escaparates = escaparates;
  if (furnishingState !== undefined) result.furnishingState = furnishingState;
  if (dirtLevel !== undefined) result.dirtLevel = dirtLevel;
  if (workers !== undefined) result.workers = workers;
  if (estimatedHoursPerWorker !== undefined) result.estimatedHoursPerWorker = estimatedHoursPerWorker;
  if (visitsPerWeek !== undefined) result.visitsPerWeek = visitsPerWeek;
  if (visitsPerMonth !== undefined) result.visitsPerMonth = visitsPerMonth;
  if (frequencies.length > 0) result.frequencies = frequencies;

  return result;
}

// ─── Cálculo determinista de horas-persona ────────────────────────────────────
export interface PersonHoursResult {
  personHours: number | null;   // workers × hoursPerWorker
  estimatedDuration: number | null;  // duración si trabajan simultáneamente
}

export function calculatePersonHours(intake: Partial<CleaningQuoteIntake>): PersonHoursResult {
  const { workers, estimatedHoursPerWorker } = intake;
  if (workers == null || estimatedHoursPerWorker == null) {
    return { personHours: null, estimatedDuration: null };
  }
  return {
    personHours: workers * estimatedHoursPerWorker,
    estimatedDuration: estimatedHoursPerWorker,  // si todos trabajan simultáneamente
  };
}

// ─── Builder de texto para el prompt de IA ────────────────────────────────────
// Convierte el intake estructurado en texto legible que la edge function puede
// procesar. Nunca incluye precios — eso es tarea del profesional.
export function buildCleaningPromptText(intake: Partial<CleaningQuoteIntake>, extraNotes?: string): string {
  const lines: string[] = ['Sector: Limpieza'];

  if (intake.spaceType) {
    const labels: Record<SpaceType, string> = {
      vivienda: 'Vivienda / piso', oficina: 'Oficina', despacho: 'Despacho',
      local_comercial: 'Local comercial', comunidad: 'Comunidad de propietarios',
      garaje: 'Garaje', nave: 'Nave industrial', edificio: 'Edificio', otro: 'Espacio otro',
    };
    lines.push(`Tipo de espacio: ${labels[intake.spaceType]}`);
  }

  if (intake.serviceType) {
    const labels: Record<ServiceType, string> = {
      limpieza_integral: 'Limpieza integral', limpieza_general: 'Limpieza general',
      mantenimiento: 'Servicio de mantenimiento recurrente', puntual: 'Limpieza puntual',
      fin_de_obra: 'Limpieza fin de obra / post-reforma', cristales: 'Limpieza de cristales',
      limpieza_profunda: 'Limpieza profunda', cambio_inquilino: 'Cambio de inquilino', otro: 'Servicio otro',
    };
    lines.push(`Tipo de servicio: ${labels[intake.serviceType]}`);
  }

  if (intake.recurrence) {
    lines.push(`Modalidad: ${intake.recurrence === 'one_off' ? 'Puntual (una sola vez)' : 'Recurrente / contrato'}`);
  }

  if (intake.surfaceM2) lines.push(`Superficie: ${intake.surfaceM2} m²`);
  if (intake.rooms) lines.push(`Habitaciones: ${intake.rooms}`);
  if (intake.bathrooms) lines.push(`Baños/aseos: ${intake.bathrooms}`);
  if (intake.kitchens) lines.push(`Cocinas: ${intake.kitchens}`);
  if (intake.floors) lines.push(`Plantas: ${intake.floors}`);
  if (intake.portals) lines.push(`Portales: ${intake.portals}`);
  if (intake.elevators) lines.push(`Ascensores: ${intake.elevators}`);

  const extras: string[] = [];
  if (intake.garage) extras.push('garaje');
  if (intake.terrace) extras.push('terraza');
  if (intake.windows) extras.push('cristales/ventanas');
  if (intake.blinds) extras.push('persianas');
  if (intake.escaparates) extras.push('escaparates');
  if (extras.length > 0) lines.push(`Elementos adicionales: ${extras.join(', ')}`);

  if (intake.furnishingState) {
    const labels: Record<FurnishingState, string> = {
      vacio: 'Vacío / sin muebles', parcialmente_amueblado: 'Parcialmente amueblado',
      amueblado: 'Amueblado', equipado: 'Completamente equipado',
    };
    lines.push(`Estado del inmueble: ${labels[intake.furnishingState]}`);
  }

  if (intake.dirtLevel) {
    const labels: Record<DirtLevel, string> = {
      normal: 'Suciedad normal', suciedad_alta: 'Suciedad alta',
      suciedad_muy_alta: 'Suciedad muy alta', fin_de_obra: 'Restos de obra',
    };
    lines.push(`Nivel de suciedad: ${labels[intake.dirtLevel]}`);
  }

  if (intake.workers || intake.estimatedHoursPerWorker) {
    const { personHours, estimatedDuration } = calculatePersonHours(intake);
    if (intake.workers) lines.push(`Operarios previstos: ${intake.workers}`);
    if (intake.estimatedHoursPerWorker) lines.push(`Horas por operario/visita: ${intake.estimatedHoursPerWorker} h`);
    if (personHours != null) lines.push(`Horas-persona totales: ${personHours} h`);
    if (estimatedDuration != null && (intake.workers ?? 1) > 1) {
      lines.push(`Duración estimada del servicio: ${estimatedDuration} h`);
    }
  }

  if (intake.visitsPerWeek) lines.push(`Frecuencia: ${intake.visitsPerWeek} visitas/semana`);
  if (intake.visitsPerMonth) lines.push(`Frecuencia: ${intake.visitsPerMonth} visitas/mes`);

  if (intake.frequencies && intake.frequencies.length > 0) {
    lines.push('Frecuencias por tarea:');
    for (const f of intake.frequencies) {
      if (f.timesPerWeek != null) lines.push(`  - ${f.task}: ${f.timesPerWeek} veces/semana`);
      else if (f.timesPerMonth != null) lines.push(`  - ${f.task}: ${f.timesPerMonth} vez/mes`);
    }
  }

  if (intake.notes) lines.push(`Observaciones: ${intake.notes}`);
  if (extraNotes) lines.push(`Notas adicionales: ${extraNotes}`);

  lines.push('');
  lines.push('Proponer partidas de limpieza necesarias para este servicio. El profesional aplica sus propias tarifas — dejar precio_unitario 0 y requiere_revision: true en TODAS las partidas. NO asumir ningún importe automático. Los consumibles también con precio 0.');
  lines.push('NO incluir partidas de gestión o retirada de residuos de obra ni alquiler de contenedor — eso es responsabilidad del contratista de reforma, no del servicio de limpieza.');

  return lines.join('\n');
}

// ─── Conversión a metadata de quote ───────────────────────────────────────────
export function toCleaningQuoteMetadata(intake: Partial<CleaningQuoteIntake>): Record<string, unknown> {
  const meta: CleaningQuoteMetadata = { vertical: 'cleaning', schemaVersion: 1, intake };
  return meta as unknown as Record<string, unknown>;
}

// ─── Utilidad de parseo para inputs numéricos del intake ──────────────────────
// 0 es un valor válido para baños, plantas y habitaciones (p. ej. trastero sin aseos).
// Para superficie, operarios y horas, 0 no es significativo → devuelve undefined.
const ZERO_ALLOWED_NUMERIC_KEYS = new Set([
  'bathrooms', 'floors', 'rooms', 'elevators', 'portals', 'kitchens',
]);

export function parseNumericField(key: string, raw: string): number | undefined {
  const trimmed = raw.replace(',', '.').trim();
  if (trimmed === '') return undefined;
  const n = parseFloat(trimmed);
  if (isNaN(n) || n < 0) return undefined;
  if (n === 0 && !ZERO_ALLOWED_NUMERIC_KEYS.has(key)) return undefined;
  return n;
}
