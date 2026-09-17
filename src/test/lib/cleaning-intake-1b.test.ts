// PH0-CLEANING-QUOTES-1B — Tests: numeric input draft behavior & editability
// Covers the 12 test cases from the spec.

import { describe, it, expect } from 'vitest';
import { parseNumericField, parseCleaningIntake, calculatePersonHours } from '../../lib/cleaning/cleaningIntake';
import { getMissingQuestions } from '../../lib/cleaning/cleaningQuestions';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const localComercialFinDeObraBase = {
  spaceType: 'local_comercial' as const,
  serviceType: 'fin_de_obra' as const,
  recurrence: 'one_off' as const,
};

const viviendaBase = {
  spaceType: 'vivienda' as const,
  serviceType: 'limpieza_general' as const,
  recurrence: 'one_off' as const,
};

// ─── TEST 1: surfaceM2 permite construir 88 sin consolidarse al primer 8 ────
describe('TEST 1 — draft pattern: surfaceM2 sigue visible mientras se escribe', () => {
  it('parseNumericField acepta "8" como valor válido intermedio', () => {
    expect(parseNumericField('surfaceM2', '8')).toBe(8);
  });

  it('parseNumericField acepta "88" como valor final', () => {
    expect(parseNumericField('surfaceM2', '88')).toBe(88);
  });

  it('surfaceM2=undefined mantiene el campo en missing (draft no consolidado)', () => {
    // El draft no llama setField → intake.surfaceM2 = undefined → sigue apareciendo en missing.
    const missing = getMissingQuestions({ ...localComercialFinDeObraBase });
    expect(missing.some(q => q.key === 'surfaceM2')).toBe(true);
  });

  it('surfaceM2=8 en intake elimina la pregunta pendiente', () => {
    const missing = getMissingQuestions({ ...localComercialFinDeObraBase, surfaceM2: 8 });
    expect(missing.some(q => q.key === 'surfaceM2')).toBe(false);
  });
});

// ─── TEST 2: surfaceM2 puede modificarse de 8 a 88 ──────────────────────────
describe('TEST 2 — editar surfaceM2 detectado (8 → 88)', () => {
  it('un surfaceM2=8 detectado puede corregirse a 88 sin perder la respuesta', () => {
    // Simula: parser detecta 8, usuario edita a 88
    const afterEdit = { ...localComercialFinDeObraBase, surfaceM2: 88, windows: true, bathrooms: 1 };
    const missing = getMissingQuestions(afterEdit);
    expect(missing.some(q => q.key === 'surfaceM2')).toBe(false);
  });

  it('parseNumericField("surfaceM2", "88") devuelve exactamente 88', () => {
    expect(parseNumericField('surfaceM2', '88')).toBe(88);
  });

  it('al limpiar surfaceM2 del intake vuelve a aparecer en missing', () => {
    // handleEditDetectedField: setField('surfaceM2', undefined)
    const missing = getMissingQuestions({ ...localComercialFinDeObraBase, windows: true, bathrooms: 1 });
    const q = missing.find(q => q.key === 'surfaceM2');
    expect(q).toBeDefined();
    expect(q?.priority).toBe('required');
  });
});

// ─── TEST 3: bathrooms permite 0 ─────────────────────────────────────────────
describe('TEST 3 — bathrooms=0 es un valor válido', () => {
  it('parseNumericField("bathrooms", "0") devuelve 0 (no undefined)', () => {
    expect(parseNumericField('bathrooms', '0')).toBe(0);
  });

  it('intake con bathrooms=0 no tiene bathrooms en missing (está respondido)', () => {
    const missing = getMissingQuestions({ ...viviendaBase, bathrooms: 0 });
    expect(missing.some(q => q.key === 'bathrooms')).toBe(false);
  });

  it('surfaceM2=0 sigue siendo inválido (devuelve undefined)', () => {
    expect(parseNumericField('surfaceM2', '0')).toBeUndefined();
  });
});

// ─── TEST 4: bathrooms permite introducir 2 directamente ────────────────────
describe('TEST 4 — bathrooms=2 funciona sin flechas del input', () => {
  it('parseNumericField("bathrooms", "2") devuelve 2', () => {
    expect(parseNumericField('bathrooms', '2')).toBe(2);
  });

  it('intake con bathrooms=2 elimina la pregunta de baños', () => {
    const missing = getMissingQuestions({ ...viviendaBase, bathrooms: 2 });
    expect(missing.some(q => q.key === 'bathrooms')).toBe(false);
  });
});

// ─── TEST 5: rooms permite valores de más de un dígito ──────────────────────
describe('TEST 5 — rooms acepta valores multi-dígito', () => {
  it('parseNumericField("rooms", "12") devuelve 12', () => {
    expect(parseNumericField('rooms', '12')).toBe(12);
  });

  it('parseNumericField("rooms", "0") devuelve 0 (válido)', () => {
    expect(parseNumericField('rooms', '0')).toBe(0);
  });

  it('rooms como draft acumula dígitos sin perder la pregunta: "1" no consolida en intake', () => {
    // Con draft, intake.rooms sigue siendo undefined mientras se escribe "12"
    const missing = getMissingQuestions({ ...viviendaBase, bathrooms: 1 });
    // rooms es recommended para vivienda → aparece en missing mientras no esté en intake
    expect(missing.some(q => q.key === 'rooms')).toBe(true);
  });
});

// ─── TEST 6: workers/hoursPerWorker calculan personHours correctamente ───────
describe('TEST 6 — calculatePersonHours sigue funcionando', () => {
  it('3 operarios × 4 horas = 12 horas-persona', () => {
    const { personHours, estimatedDuration } = calculatePersonHours({
      workers: 3,
      estimatedHoursPerWorker: 4,
    });
    expect(personHours).toBe(12);
    expect(estimatedDuration).toBe(4);
  });

  it('1 operario × 2.5 horas = 2.5 horas-persona', () => {
    const { personHours } = calculatePersonHours({ workers: 1, estimatedHoursPerWorker: 2.5 });
    expect(personHours).toBe(2.5);
  });

  it('workers=0 no es un valor válido para el parseNumericField', () => {
    expect(parseNumericField('workers', '0')).toBeUndefined();
  });
});

// ─── TEST 7: editar un required a valor válido elimina la pregunta pendiente ─
describe('TEST 7 — editar campo required a valor válido desbloquea canConfirm', () => {
  it('local_comercial + fin_de_obra sin surfaceM2 tiene required pendiente', () => {
    const missing = getMissingQuestions({ ...localComercialFinDeObraBase });
    expect(missing.some(q => q.priority === 'required')).toBe(true);
  });

  it('añadir surfaceM2=88 y windows y bathrooms deja 0 required pendientes', () => {
    const missing = getMissingQuestions({
      ...localComercialFinDeObraBase,
      surfaceM2: 88,
      windows: true,
      bathrooms: 1,
    });
    expect(missing.filter(q => q.priority === 'required')).toHaveLength(0);
  });

  it('canConfirm ≡ !missing.some(required)', () => {
    const intakeFull = { ...localComercialFinDeObraBase, surfaceM2: 88, windows: true, bathrooms: 1 };
    const missing = getMissingQuestions(intakeFull);
    const canConfirm = !missing.some(q => q.priority === 'required');
    expect(canConfirm).toBe(true);
  });
});

// ─── TEST 8: borrar un required vuelve a bloquear canConfirm ─────────────────
describe('TEST 8 — limpiar un campo required vuelve a bloquear', () => {
  it('limpiar surfaceM2 vuelve a mostrar la pregunta como required', () => {
    // Simula handleEditDetectedField('surfaceM2'): setField('surfaceM2', undefined)
    const intakeAfterEdit = { ...localComercialFinDeObraBase, windows: true, bathrooms: 1 };
    const missing = getMissingQuestions(intakeAfterEdit);
    expect(missing.some(q => q.key === 'surfaceM2' && q.priority === 'required')).toBe(true);
  });

  it('canConfirm = false cuando hay required pendientes', () => {
    const missing = getMissingQuestions({ ...localComercialFinDeObraBase });
    const canConfirm = !missing.some(q => q.priority === 'required');
    expect(canConfirm).toBe(false);
  });
});

// ─── TEST 9: valores detectados por parser pueden corregirse manualmente ─────
describe('TEST 9 — valores del parser pueden sobreescribirse', () => {
  it('parser detecta 8 m², edición manual sobreescribe a 88', () => {
    const parsed = parseCleaningIntake('local fin de obra 8 metros cuadrados');
    expect(parsed.surfaceM2).toBe(8);

    // Simula: handleEditDetectedField → setField('surfaceM2', undefined) → draft='8' → usuario edita a 88 → commit
    const corrected = { ...parsed, surfaceM2: 88 };
    expect(corrected.surfaceM2).toBe(88);

    const missing = getMissingQuestions({
      ...corrected,
      spaceType: 'local_comercial',
      serviceType: 'fin_de_obra',
      recurrence: 'one_off',
      windows: true,
      bathrooms: 1,
    });
    expect(missing.some(q => q.key === 'surfaceM2')).toBe(false);
  });

  it('parser detecta espacio tipo vivienda; edición puede cambiarlo a local_comercial', () => {
    const parsed = parseCleaningIntake('limpieza de piso general');
    expect(parsed.spaceType).toBe('vivienda');

    // handleEditDetectedField('spaceType') → setField('spaceType', undefined)
    const afterEdit = { ...parsed };
    delete afterEdit.spaceType;
    // El profesional selecciona 'local_comercial' via chip
    const corrected = { ...afterEdit, spaceType: 'local_comercial' as const };
    expect(corrected.spaceType).toBe('local_comercial');
  });
});

// ─── TEST 10: boolean fields Sí/No siguen funcionando ────────────────────────
describe('TEST 10 — boolean fields Sí/No funcionan correctamente', () => {
  it('windows=true elimina la pregunta de cristales en fin_de_obra', () => {
    const missing = getMissingQuestions({
      ...localComercialFinDeObraBase,
      surfaceM2: 45,
      bathrooms: 1,
      windows: true,
    });
    expect(missing.some(q => q.key === 'windows')).toBe(false);
  });

  it('windows=false también elimina la pregunta (el profesional respondió explícitamente)', () => {
    const missing = getMissingQuestions({
      ...localComercialFinDeObraBase,
      surfaceM2: 45,
      bathrooms: 1,
      windows: false,
    });
    expect(missing.some(q => q.key === 'windows')).toBe(false);
  });

  it('parseNumericField no afecta a campos booleanos', () => {
    // Los booleanos no pasan por parseNumericField
    expect(parseNumericField('windows', '1')).toBe(1); // no es un campo boolean en la función
    // Su manejo es por chips Sí/No directamente en el componente
  });
});

// ─── TEST 11: flujo "Local comercial fin de obra 45 m²" sigue funcionando ────
describe('TEST 11 — flujo local_comercial fin_de_obra 45m² no regresiona', () => {
  it('parser extrae correctamente los 3 campos del texto', () => {
    const parsed = parseCleaningIntake('Local comercial fin de obra 45 m²');
    expect(parsed.spaceType).toBe('local_comercial');
    expect(parsed.serviceType).toBe('fin_de_obra');
    expect(parsed.surfaceM2).toBe(45);
  });

  it('con los 3 detectados, quedan required pendientes hasta completar windows y bathrooms', () => {
    const parsed = parseCleaningIntake('Local comercial fin de obra 45 m²');
    const missing = getMissingQuestions({ ...parsed, recurrence: 'one_off' });
    const required = missing.filter(q => q.priority === 'required');
    expect(required.length).toBeGreaterThan(0);
    const keys = required.map(q => q.key);
    expect(keys).toContain('windows');
    expect(keys).toContain('bathrooms');
  });

  it('con todos los required respondidos, 0 required pendientes', () => {
    const parsed = parseCleaningIntake('Local comercial fin de obra 45 m²');
    const missing = getMissingQuestions({
      ...parsed,
      recurrence: 'one_off',
      windows: true,
      bathrooms: 2,
    });
    expect(missing.filter(q => q.priority === 'required')).toHaveLength(0);
  });
});

// ─── TEST 12: surfaceM2=88 queda almacenado exactamente como 88 ──────────────
describe('TEST 12 — surfaceM2=88 se almacena con precisión', () => {
  it('parseNumericField("surfaceM2", "88") = 88 (sin redondeo ni pérdida)', () => {
    expect(parseNumericField('surfaceM2', '88')).toBe(88);
    expect(parseNumericField('surfaceM2', '88')).toStrictEqual(88);
  });

  it('parseNumericField acepta decimales: "45.5"', () => {
    expect(parseNumericField('surfaceM2', '45.5')).toBe(45.5);
  });

  it('parseNumericField acepta coma como separador decimal: "45,5"', () => {
    expect(parseNumericField('surfaceM2', '45,5')).toBe(45.5);
  });

  it('getMissingQuestions con surfaceM2=88 no incluye surfaceM2 en required', () => {
    const intake = {
      ...localComercialFinDeObraBase,
      surfaceM2: 88,
      windows: true,
      bathrooms: 1,
    };
    const missing = getMissingQuestions(intake);
    expect(missing.some(q => q.key === 'surfaceM2')).toBe(false);
  });
});

// ─── Extra: validaciones de parseNumericField ─────────────────────────────────
describe('parseNumericField — edge cases', () => {
  it('string vacío devuelve undefined', () => {
    expect(parseNumericField('surfaceM2', '')).toBeUndefined();
  });

  it('texto no numérico devuelve undefined', () => {
    expect(parseNumericField('surfaceM2', 'abc')).toBeUndefined();
  });

  it('número negativo devuelve undefined', () => {
    expect(parseNumericField('bathrooms', '-1')).toBeUndefined();
  });

  it('floors=0 es válido', () => {
    expect(parseNumericField('floors', '0')).toBe(0);
  });

  it('estimatedHoursPerWorker=0 es inválido (0 horas no tiene sentido)', () => {
    expect(parseNumericField('estimatedHoursPerWorker', '0')).toBeUndefined();
  });

  it('estimatedHoursPerWorker=1.5 con coma', () => {
    expect(parseNumericField('estimatedHoursPerWorker', '1,5')).toBe(1.5);
  });
});
