/**
 * Tests unitarios — parser determinista de CleaningQuoteIntake.
 * Sin LLM, sin red. Todos los tests son deterministas y rápidos.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCleaningIntake,
  calculatePersonHours,
  buildCleaningPromptText,
  toCleaningQuoteMetadata,
} from '../../lib/cleaning/cleaningIntake';
import { getMissingQuestions } from '../../lib/cleaning/cleaningQuestions';

// ─── Clasificación de espacio ────────────────────────────────────────────────
describe('spaceType detection', () => {
  it('detecta vivienda desde "piso"', () => {
    expect(parseCleaningIntake('Limpieza de piso').spaceType).toBe('vivienda');
  });

  it('detecta vivienda desde "vivienda"', () => {
    expect(parseCleaningIntake('Limpieza integral de vivienda').spaceType).toBe('vivienda');
  });

  it('detecta vivienda desde "apartamento"', () => {
    expect(parseCleaningIntake('Apartamento en la playa').spaceType).toBe('vivienda');
  });

  it('detecta oficina', () => {
    expect(parseCleaningIntake('Presupuesto limpieza oficina').spaceType).toBe('oficina');
  });

  it('detecta local_comercial desde "local de 45 metros"', () => {
    expect(parseCleaningIntake('Limpieza de local de 45 metros fin de obra').spaceType).toBe('local_comercial');
  });

  it('detecta comunidad', () => {
    expect(parseCleaningIntake('Limpieza de comunidad').spaceType).toBe('comunidad');
  });

  it('detecta garaje', () => {
    expect(parseCleaningIntake('Limpieza de garaje').spaceType).toBe('garaje');
  });

  it('detecta nave', () => {
    expect(parseCleaningIntake('Limpieza nave industrial').spaceType).toBe('nave');
  });
});

// ─── Clasificación de servicio ───────────────────────────────────────────────
describe('serviceType detection', () => {
  it('detecta fin_de_obra', () => {
    expect(parseCleaningIntake('Limpieza fin de obra de un local').serviceType).toBe('fin_de_obra');
  });

  it('detecta fin_de_obra desde "post-obra"', () => {
    expect(parseCleaningIntake('Limpieza post-obra').serviceType).toBe('fin_de_obra');
  });

  it('detecta limpieza_integral', () => {
    expect(parseCleaningIntake('Limpieza integral de vivienda').serviceType).toBe('limpieza_integral');
  });

  it('detecta puntual', () => {
    expect(parseCleaningIntake('Limpieza puntual de local').serviceType).toBe('puntual');
  });

  it('detecta mantenimiento', () => {
    expect(parseCleaningIntake('Contrato de mantenimiento y limpieza de oficina').serviceType).toBe('mantenimiento');
  });

  it('detecta cristales', () => {
    expect(parseCleaningIntake('Limpieza de cristales y escaparates').serviceType).toBe('cristales');
  });
});

// ─── Recurrencia ─────────────────────────────────────────────────────────────
describe('recurrence detection', () => {
  it('detecta one_off desde "puntual"', () => {
    expect(parseCleaningIntake('Limpieza puntual de local 45 m').recurrence).toBe('one_off');
  });

  it('detecta one_off desde "fin de obra" (implícito)', () => {
    expect(parseCleaningIntake('Limpieza fin de obra').recurrence).toBe('one_off');
  });

  it('detecta recurring desde "2 veces/semana"', () => {
    expect(parseCleaningIntake('Comunidad 2 veces por semana').recurrence).toBe('recurring');
  });

  it('detecta recurring desde "semanal"', () => {
    expect(parseCleaningIntake('Servicio de limpieza semanal').recurrence).toBe('recurring');
  });

  it('no asume recurrencia si solo dice "comunidad"', () => {
    const r = parseCleaningIntake('Limpieza de comunidad');
    expect(r.recurrence).toBeUndefined();
  });

  it('no asume recurrencia si solo dice "oficina"', () => {
    const r = parseCleaningIntake('Presupuesto limpieza oficina');
    expect(r.recurrence).toBeUndefined();
  });
});

// ─── No invención de datos ────────────────────────────────────────────────────
describe('no invención de datos', () => {
  it('no inventa superficie si no se menciona', () => {
    expect(parseCleaningIntake('Limpieza de comunidad').surfaceM2).toBeUndefined();
  });

  it('no inventa operarios si no se mencionan', () => {
    expect(parseCleaningIntake('Limpieza integral de vivienda').workers).toBeUndefined();
  });

  it('no inventa horas si no se mencionan', () => {
    expect(parseCleaningIntake('Limpieza integral de vivienda').estimatedHoursPerWorker).toBeUndefined();
  });

  it('no inventa bathrooms si no se mencionan', () => {
    expect(parseCleaningIntake('Limpieza de local de 45 metros').bathrooms).toBeUndefined();
  });

  it('devuelve objeto vacío para texto vacío', () => {
    const r = parseCleaningIntake('');
    expect(r.spaceType).toBeUndefined();
    expect(r.serviceType).toBeUndefined();
    expect(r.workers).toBeUndefined();
  });
});

// ─── Extracción de superficie ─────────────────────────────────────────────────
describe('surface extraction', () => {
  it('extrae m2 de "45 metros"', () => {
    expect(parseCleaningIntake('Local de 45 metros').surfaceM2).toBe(45);
  });

  it('extrae m2 de "80 m²"', () => {
    expect(parseCleaningIntake('Local de 80 m²').surfaceM2).toBe(80);
  });

  it('extrae m2 de "80 metros cuadrados"', () => {
    expect(parseCleaningIntake('Nave de 80 metros cuadrados').surfaceM2).toBe(80);
  });
});

// ─── Extracción de habitaciones y baños ──────────────────────────────────────
describe('rooms and bathrooms extraction', () => {
  it('extrae habitaciones', () => {
    expect(parseCleaningIntake('Vivienda con dos habitaciones').rooms).toBe(2);
  });

  it('extrae baños', () => {
    expect(parseCleaningIntake('Dos baños y salón').bathrooms).toBe(2);
  });

  it('extrae plantas', () => {
    expect(parseCleaningIntake('Cinco plantas').floors).toBe(5);
  });

  it('extrae ascensores', () => {
    expect(parseCleaningIntake('Comunidad con un ascensor').elevators).toBe(1);
  });
});

// ─── Operarios y horas ────────────────────────────────────────────────────────
describe('workers and hours extraction', () => {
  it('extrae operarios de "dos personas"', () => {
    expect(parseCleaningIntake('Vamos dos personas unas cuatro horas').workers).toBe(2);
  });

  it('extrae horas de "cuatro horas"', () => {
    expect(parseCleaningIntake('Vamos dos personas unas cuatro horas').estimatedHoursPerWorker).toBe(4);
  });

  it('extrae operarios de "vamos 2"', () => {
    expect(parseCleaningIntake('Vamos 2 operarios').workers).toBe(2);
  });
});

// ─── Cálculo horas-persona ───────────────────────────────────────────────────
describe('calculatePersonHours', () => {
  it('calcula correctamente 2 operarios × 4h = 8 horas-persona', () => {
    const r = calculatePersonHours({ workers: 2, estimatedHoursPerWorker: 4 });
    expect(r.personHours).toBe(8);
    expect(r.estimatedDuration).toBe(4);
  });

  it('devuelve null si faltan operarios', () => {
    expect(calculatePersonHours({ estimatedHoursPerWorker: 4 }).personHours).toBeNull();
  });

  it('devuelve null si faltan horas', () => {
    expect(calculatePersonHours({ workers: 2 }).personHours).toBeNull();
  });

  it('calcula 1 operario × 3h = 3 horas-persona', () => {
    const r = calculatePersonHours({ workers: 1, estimatedHoursPerWorker: 3 });
    expect(r.personHours).toBe(3);
  });
});

// ─── Frecuencias por tarea ────────────────────────────────────────────────────
describe('task frequencies', () => {
  it('extrae frecuencia general de comunidad (2 veces/semana)', () => {
    const r = parseCleaningIntake('Comunidad dos veces por semana, cinco plantas, un ascensor y garaje una vez al mes');
    expect(r.visitsPerWeek).toBe(2);
  });

  it('extrae frecuencia específica de garaje (1 vez/mes)', () => {
    const r = parseCleaningIntake('Comunidad dos veces por semana, cinco plantas, un ascensor y garaje una vez al mes');
    const gFreq = r.frequencies?.find(f => f.task === 'garaje');
    expect(gFreq?.timesPerMonth).toBe(1);
  });

  it('preserva frecuencia de garaje diferente de la frecuencia general', () => {
    const r = parseCleaningIntake('Comunidad dos veces por semana y garaje una vez al mes');
    expect(r.visitsPerWeek).toBe(2);
    const gFreq = r.frequencies?.find(f => f.task === 'garaje');
    expect(gFreq?.timesPerMonth).toBe(1);
    // La frecuencia general (2/semana) ≠ frecuencia garaje (1/mes)
    expect(r.visitsPerWeek).not.toBe(undefined);
    expect(gFreq?.timesPerMonth).not.toBe(undefined);
  });

  it('detecta plantas y ascensor correctamente', () => {
    const r = parseCleaningIntake('Cinco plantas y un ascensor');
    expect(r.floors).toBe(5);
    expect(r.elevators).toBe(1);
  });
});

// ─── Casos de aceptación completos ───────────────────────────────────────────
describe('acceptance cases', () => {
  it('CASO A — local fin de obra 45m', () => {
    const r = parseCleaningIntake('Limpieza de local de 45 metros fin de obra');
    expect(r.spaceType).toBe('local_comercial');
    expect(r.serviceType).toBe('fin_de_obra');
    expect(r.surfaceM2).toBe(45);
    expect(r.recurrence).toBe('one_off');
    expect(r.workers).toBeUndefined();   // no se mencionaron
  });

  it('CASO B — comunidad sin recurrencia indicada', () => {
    const r = parseCleaningIntake('Limpieza de comunidad');
    expect(r.spaceType).toBe('comunidad');
    expect(r.recurrence).toBeUndefined();   // NO asumir recurrente
  });

  it('CASO C — oficina sin recurrencia indicada', () => {
    const r = parseCleaningIntake('Limpieza de oficina');
    expect(r.spaceType).toBe('oficina');
    expect(r.recurrence).toBeUndefined();   // NO asumir recurrente
  });

  it('CASO D — comunidad con frecuencias detalladas', () => {
    const r = parseCleaningIntake('Limpieza de comunidad dos veces por semana, cinco plantas, un ascensor y garaje una vez al mes');
    expect(r.spaceType).toBe('comunidad');
    expect(r.recurrence).toBe('recurring');
    expect(r.visitsPerWeek).toBe(2);
    expect(r.floors).toBe(5);
    expect(r.elevators).toBe(1);
    const gFreq = r.frequencies?.find(f => f.task === 'garaje');
    expect(gFreq?.timesPerMonth).toBe(1);
  });

  it('CASO E — local 80m puntual con operarios y horas', () => {
    const r = parseCleaningIntake('Local de 80 metros, limpieza puntual, dos baños, escaparate, vamos dos personas unas cuatro horas');
    expect(r.spaceType).toBe('local_comercial');
    expect(r.serviceType).toBe('puntual');
    expect(r.surfaceM2).toBe(80);
    expect(r.bathrooms).toBe(2);
    expect(r.escaparates).toBe(true);
    expect(r.workers).toBe(2);
    expect(r.estimatedHoursPerWorker).toBe(4);
    const { personHours, estimatedDuration } = calculatePersonHours(r);
    expect(personHours).toBe(8);
    expect(estimatedDuration).toBe(4);
  });

  it('CASO F — vivienda integral sin muebles', () => {
    const r = parseCleaningIntake(
      'Limpieza integral de vivienda con dos habitaciones, dos baños, salón y terraza. Hay que limpiar ventanas, persianas, muebles de cocina, baños y el resto de la vivienda. Está prácticamente sin muebles.'
    );
    expect(r.spaceType).toBe('vivienda');
    expect(r.serviceType).toBe('limpieza_integral');
    expect(r.rooms).toBe(2);
    expect(r.bathrooms).toBe(2);
    expect(r.terrace).toBe(true);
    expect(r.windows).toBe(true);
    expect(r.blinds).toBe(true);
    expect(r.furnishingState).toBe('vacio');
    expect(r.workers).toBeUndefined();   // no se mencionaron
  });
});

// ─── Metadata y serialización ─────────────────────────────────────────────────
describe('metadata', () => {
  it('toCleaningQuoteMetadata produce estructura con vertical y schemaVersion', () => {
    const intake = parseCleaningIntake('Limpieza de local fin de obra');
    const meta = toCleaningQuoteMetadata(intake);
    expect(meta.vertical).toBe('cleaning');
    expect(meta.schemaVersion).toBe(1);
    expect(meta.intake).toBeDefined();
  });

  it('es serializable a JSON sin pérdida', () => {
    const intake = parseCleaningIntake('Local 45 m, fin de obra');
    const meta = toCleaningQuoteMetadata(intake);
    const json = JSON.parse(JSON.stringify(meta));
    expect(json.vertical).toBe('cleaning');
    expect(json.intake.spaceType).toBe('local_comercial');
  });

  it('es compatible con presupuesto sin metadata (undefined)', () => {
    // Simula un presupuesto existente sin campo metadata
    const quote: { metadata?: Record<string, unknown> } = {};
    expect(quote.metadata).toBeUndefined();
    // El sistema no debe fallar al operar sobre presupuestos sin metadata
    expect(() => quote.metadata?.['vertical']).not.toThrow();
  });
});

// ─── Motor de preguntas ───────────────────────────────────────────────────────
describe('getMissingQuestions', () => {
  it('pide spaceType si no está detectado', () => {
    const q = getMissingQuestions({});
    expect(q.some(x => x.key === 'spaceType')).toBe(true);
  });

  it('pide recurrence si no está detectada', () => {
    const q = getMissingQuestions({ spaceType: 'comunidad' });
    expect(q.some(x => x.key === 'recurrence')).toBe(true);
  });

  it('no pide visitsPerWeek si recurrence es one_off', () => {
    const q = getMissingQuestions({ spaceType: 'local_comercial', serviceType: 'fin_de_obra', recurrence: 'one_off' });
    expect(q.some(x => x.key === 'visitsPerWeek')).toBe(false);
  });

  it('pide superficie si es local y no está indicada', () => {
    const q = getMissingQuestions({ spaceType: 'local_comercial', serviceType: 'puntual', recurrence: 'one_off' });
    expect(q.some(x => x.key === 'surfaceM2')).toBe(true);
    const def = q.find(x => x.key === 'surfaceM2');
    expect(def?.priority).toBe('required');
  });

  it('pide baños para vivienda', () => {
    const q = getMissingQuestions({ spaceType: 'vivienda', serviceType: 'limpieza_integral' });
    expect(q.some(x => x.key === 'bathrooms')).toBe(true);
  });

  it('no pide campos ya presentes', () => {
    const q = getMissingQuestions({ spaceType: 'oficina', serviceType: 'mantenimiento', recurrence: 'recurring', surfaceM2: 100 });
    expect(q.some(x => x.key === 'spaceType')).toBe(false);
    expect(q.some(x => x.key === 'surfaceM2')).toBe(false);
  });

  it('pide visitsPerWeek para comunidad recurrente', () => {
    const q = getMissingQuestions({ spaceType: 'comunidad', serviceType: 'mantenimiento', recurrence: 'recurring' });
    expect(q.some(x => x.key === 'visitsPerWeek')).toBe(true);
    const v = q.find(x => x.key === 'visitsPerWeek');
    expect(v?.priority).toBe('required');
  });
});

// ─── buildCleaningPromptText ──────────────────────────────────────────────────
describe('buildCleaningPromptText', () => {
  it('incluye tipo de espacio y servicio', () => {
    const text = buildCleaningPromptText({ spaceType: 'vivienda', serviceType: 'fin_de_obra' });
    expect(text).toContain('Vivienda');
    expect(text).toContain('fin de obra');
  });

  it('incluye horas-persona calculadas', () => {
    const text = buildCleaningPromptText({ workers: 2, estimatedHoursPerWorker: 5 });
    expect(text).toContain('10 h');   // personHours = 2×5
  });

  it('NO incluye precio fijo de 20€/h ni ningún precio de mano de obra', () => {
    const text = buildCleaningPromptText({ spaceType: 'vivienda', workers: 2, estimatedHoursPerWorker: 3 });
    expect(text).not.toMatch(/20\s*€\/h/);
    expect(text).not.toMatch(/precio.*mano/i);
    expect(text).toContain('requiere_revision');
  });

  it('incluye frecuencias por tarea si existen', () => {
    const text = buildCleaningPromptText({
      spaceType: 'comunidad',
      frequencies: [{ task: 'garaje', timesPerMonth: 1 }],
    });
    expect(text).toContain('garaje');
    expect(text).toContain('1 vez/mes');
  });
});
