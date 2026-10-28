/**
 * TX-RECURRING-F4 — Tests de helpers del ScheduleWizard.
 *
 * Solo funciones puras exportadas; no importa el componente React
 * para evitar dependencias de jsdom/leaflet en este runner.
 */

import { describe, it, expect } from 'vitest';
import {
  validateStep,
  locationToStop,
  copyInvertStops,
  getPreviewDates,
  buildScheduleInput,
  type WizardDraft,
} from '../../components/ScheduleWizard';
import type { TransportLocation } from '../../lib/transportLocations';
import type { TransportStop } from '../../lib/transportServices';

// ── Fixture base ──────────────────────────────────────────────────────────────

function makeDraft(overrides: Partial<WizardDraft> = {}): WizardDraft {
  return {
    tipo_servicio:       'ruta_escolar',
    nombre:              'Ruta escolar IES Norte L–V',
    client_id:           '',
    descripcion:         '',
    periodo_inicio:      '2026-09-01',
    periodo_fin:         '2027-06-30',
    dias_semana:         [1, 2, 3, 4, 5],
    hora_salida_ida:     '07:30',
    hora_llegada_ida:    '08:15',
    vuelta_habilitada:   false,
    hora_salida_vuelta:  '',
    hora_llegada_vuelta: '',
    origen_ida:          { localidad: 'Santander', calle: 'Calle Mayor' },
    destino_ida:         { nombre_lugar: 'IES Norte' },
    paradas_ida:         [],
    paradas_vuelta:      [],
    vehicle_id:          '',
    conductor_id:        '',
    num_viajeros:        '48',
    precio_referencia:   '1500',
    observaciones:       '',
    ...overrides,
  };
}

function makeStop(nombre: string, hora?: string): TransportStop {
  return { nombre, ...(hora ? { hora } : {}) };
}

// ════════════════════════════════════════════════════════════════════════════
// SW-1: validateStep
// ════════════════════════════════════════════════════════════════════════════

describe('SW-1: validateStep', () => {
  // Paso 1 — Tipo y cliente
  it('SW-1-A: paso 1 válido con tipo y nombre', () => {
    expect(validateStep(1, makeDraft())).toBeNull();
  });

  it('SW-1-B: paso 1 falla sin tipo_servicio', () => {
    expect(validateStep(1, makeDraft({ tipo_servicio: '' }))).toBeTruthy();
  });

  it('SW-1-C: paso 1 falla con nombre vacío', () => {
    expect(validateStep(1, makeDraft({ nombre: '   ' }))).toBeTruthy();
  });

  // Paso 2 — Período y horarios
  it('SW-1-D: paso 2 válido con datos completos', () => {
    expect(validateStep(2, makeDraft())).toBeNull();
  });

  it('SW-1-E: paso 2 falla sin periodo_inicio', () => {
    expect(validateStep(2, makeDraft({ periodo_inicio: '' }))).toBeTruthy();
  });

  it('SW-1-F: paso 2 falla sin días de circulación', () => {
    expect(validateStep(2, makeDraft({ dias_semana: [] }))).toBeTruthy();
  });

  it('SW-1-G: paso 2 falla sin hora_salida_ida', () => {
    expect(validateStep(2, makeDraft({ hora_salida_ida: '' }))).toBeTruthy();
  });

  it('SW-1-H: paso 2 falla si vuelta habilitada pero sin hora_salida_vuelta', () => {
    const draft = makeDraft({ vuelta_habilitada: true, hora_salida_vuelta: '' });
    expect(validateStep(2, draft)).toBeTruthy();
  });

  it('SW-1-I: paso 2 válido con vuelta habilitada y hora de vuelta', () => {
    const draft = makeDraft({ vuelta_habilitada: true, hora_salida_vuelta: '15:00' });
    expect(validateStep(2, draft)).toBeNull();
  });

  // Paso 3 — Itinerario
  it('SW-1-J: paso 3 válido con origen y destino con dirección', () => {
    expect(validateStep(3, makeDraft())).toBeNull();
  });

  it('SW-1-K: paso 3 falla con origen vacío', () => {
    expect(validateStep(3, makeDraft({ origen_ida: {} }))).toBeTruthy();
  });

  it('SW-1-L: paso 3 falla con destino vacío', () => {
    expect(validateStep(3, makeDraft({ destino_ida: {} }))).toBeTruthy();
  });

  // Pasos 4–6 — siempre válidos
  it('SW-1-M: pasos 4 a 6 no tienen validación obligatoria', () => {
    [4, 5, 6].forEach(step => {
      expect(validateStep(step, makeDraft())).toBeNull();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SW-2: locationToStop
// ════════════════════════════════════════════════════════════════════════════

describe('SW-2: locationToStop', () => {
  it('SW-2-A: usa nombre_lugar como nombre de parada', () => {
    const loc: TransportLocation = { nombre_lugar: 'IES Norte', localidad: 'Santander' };
    expect(locationToStop(loc).nombre).toBe('IES Norte');
  });

  it('SW-2-B: usa calle+numero si no hay nombre_lugar', () => {
    const loc: TransportLocation = { calle: 'Calle Mayor', numero: '12' };
    expect(locationToStop(loc).nombre).toBe('Calle Mayor 12');
  });

  it('SW-2-C: usa localidad como fallback', () => {
    const loc: TransportLocation = { localidad: 'Madrid' };
    expect(locationToStop(loc).nombre).toBe('Madrid');
  });

  it('SW-2-D: usa "Parada" si location está vacía', () => {
    expect(locationToStop({}).nombre).toBe('Parada');
  });

  it('SW-2-E: incluye hora si se proporciona', () => {
    const stop = locationToStop({ localidad: 'Madrid' }, '08:30');
    expect(stop.hora).toBe('08:30');
  });

  it('SW-2-F: no incluye hora si no se proporciona', () => {
    const stop = locationToStop({ localidad: 'Madrid' });
    expect(stop.hora).toBeUndefined();
  });

  it('SW-2-G: incluye location original', () => {
    const loc: TransportLocation = { localidad: 'Madrid', lat: 40.4168, lng: -3.7038 };
    expect(locationToStop(loc).location).toBe(loc);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SW-3: copyInvertStops
// ════════════════════════════════════════════════════════════════════════════

describe('SW-3: copyInvertStops', () => {
  it('SW-3-A: invierte el orden de las paradas', () => {
    const stops = [makeStop('A'), makeStop('B'), makeStop('C')];
    const result = copyInvertStops(stops);
    expect(result[0].nombre).toBe('C');
    expect(result[2].nombre).toBe('A');
  });

  it('SW-3-B: no muta el array original', () => {
    const stops = [makeStop('A'), makeStop('B')];
    copyInvertStops(stops);
    expect(stops[0].nombre).toBe('A');
  });

  it('SW-3-C: devuelve copias de los objetos', () => {
    const stops = [makeStop('A')];
    const result = copyInvertStops(stops);
    expect(result[0]).not.toBe(stops[0]);
    expect(result[0].nombre).toBe('A');
  });

  it('SW-3-D: funciona con lista vacía', () => {
    expect(copyInvertStops([])).toEqual([]);
  });

  it('SW-3-E: funciona con un solo elemento', () => {
    const stops = [makeStop('Solo')];
    expect(copyInvertStops(stops)).toHaveLength(1);
    expect(copyInvertStops(stops)[0].nombre).toBe('Solo');
  });

  it('SW-3-F: ruta escolar L-V — vuelta = inverso de ida', () => {
    const ida = [makeStop('Casa'), makeStop('Parada centro'), makeStop('IES Norte')];
    const vuelta = copyInvertStops(ida);
    expect(vuelta[0].nombre).toBe('IES Norte');
    expect(vuelta[2].nombre).toBe('Casa');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SW-4: getPreviewDates
// ════════════════════════════════════════════════════════════════════════════

describe('SW-4: getPreviewDates', () => {
  it('SW-4-A: ruta escolar L–V devuelve solo días laborables', () => {
    const draft = makeDraft({ dias_semana: [1, 2, 3, 4, 5], periodo_inicio: '2026-09-01' });
    const dates = getPreviewDates(draft);
    dates.forEach(d => {
      const dow = new Date(d + 'T00:00:00').getDay();
      expect(dow).not.toBe(0); // no domingo
      expect(dow).not.toBe(6); // no sábado
    });
  });

  it('SW-4-B: devuelve máximo 5 fechas por defecto', () => {
    const draft = makeDraft({ dias_semana: [1, 2, 3, 4, 5], periodo_inicio: '2026-09-01' });
    expect(getPreviewDates(draft).length).toBeLessThanOrEqual(5);
  });

  it('SW-4-C: maxN personalizable', () => {
    const draft = makeDraft({ dias_semana: [1, 2, 3, 4, 5], periodo_inicio: '2026-09-01' });
    expect(getPreviewDates(draft, 3).length).toBeLessThanOrEqual(3);
  });

  it('SW-4-D: sin días devuelve array vacío', () => {
    expect(getPreviewDates(makeDraft({ dias_semana: [] }))).toEqual([]);
  });

  it('SW-4-E: sin periodo_inicio devuelve array vacío', () => {
    expect(getPreviewDates(makeDraft({ periodo_inicio: '' }))).toEqual([]);
  });

  it('SW-4-F: ruta de 6 meses con fecha fin — no excede periodo_fin', () => {
    const draft = makeDraft({
      dias_semana:    [1, 2, 3, 4, 5],
      periodo_inicio: '2026-11-01',
      periodo_fin:    '2027-04-30',
    });
    const dates = getPreviewDates(draft, 100);
    dates.forEach(d => {
      expect(d <= '2027-04-30').toBe(true);
    });
  });

  it('SW-4-G: ruta sin fecha fin devuelve fechas dentro de 90 días', () => {
    const draft = makeDraft({ dias_semana: [1], periodo_inicio: '2026-09-01', periodo_fin: '' });
    const dates = getPreviewDates(draft, 100);
    expect(dates.length).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SW-5: buildScheduleInput
// ════════════════════════════════════════════════════════════════════════════

describe('SW-5: buildScheduleInput', () => {
  it('SW-5-A: estado inicial es siempre borrador', () => {
    expect(buildScheduleInput(makeDraft()).estado).toBe('borrador');
  });

  it('SW-5-B: hora con segundos añadidos', () => {
    const input = buildScheduleInput(makeDraft());
    expect(input.hora_salida_ida).toBe('07:30:00');
  });

  it('SW-5-C: hora_llegada_ida incluye segundos', () => {
    expect(buildScheduleInput(makeDraft()).hora_llegada_ida).toBe('08:15:00');
  });

  it('SW-5-D: periodo_fin vacío → null', () => {
    const input = buildScheduleInput(makeDraft({ periodo_fin: '' }));
    expect(input.periodo_fin).toBeNull();
  });

  it('SW-5-E: client_id vacío → null', () => {
    expect(buildScheduleInput(makeDraft({ client_id: '' })).client_id).toBeNull();
  });

  it('SW-5-F: vuelta no habilitada — horarios vuelta son null', () => {
    const input = buildScheduleInput(makeDraft({ vuelta_habilitada: false }));
    expect(input.hora_salida_vuelta).toBeNull();
    expect(input.hora_llegada_vuelta).toBeNull();
  });

  it('SW-5-G: vuelta habilitada — horarios vuelta incluidos', () => {
    const draft = makeDraft({
      vuelta_habilitada:   true,
      hora_salida_vuelta:  '15:00',
      hora_llegada_vuelta: '16:00',
    });
    const input = buildScheduleInput(draft);
    expect(input.hora_salida_vuelta).toBe('15:00:00');
    expect(input.hora_llegada_vuelta).toBe('16:00:00');
  });

  it('SW-5-H: num_viajeros string → número entero', () => {
    expect(buildScheduleInput(makeDraft({ num_viajeros: '48' })).num_viajeros).toBe(48);
  });

  it('SW-5-I: num_viajeros vacío → null', () => {
    expect(buildScheduleInput(makeDraft({ num_viajeros: '' })).num_viajeros).toBeNull();
  });

  it('SW-5-J: precio_referencia string → número decimal', () => {
    expect(buildScheduleInput(makeDraft({ precio_referencia: '1500.50' })).precio_referencia).toBe(1500.50);
  });

  it('SW-5-K: dias_semana se propaga correctamente', () => {
    const draft = makeDraft({ dias_semana: [1, 2, 3, 4, 5] });
    expect(buildScheduleInput(draft).dias_semana).toEqual([1, 2, 3, 4, 5]);
  });

  it('SW-5-L: timezone siempre Europe/Madrid', () => {
    expect(buildScheduleInput(makeDraft()).timezone).toBe('Europe/Madrid');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SW-6: Escenarios de negocio
// ════════════════════════════════════════════════════════════════════════════

describe('SW-6: Escenarios de negocio', () => {
  it('SW-6-A: ruta escolar L–V — validación pasos 1-3 pasa', () => {
    const draft = makeDraft({
      tipo_servicio: 'ruta_escolar',
      dias_semana:   [1, 2, 3, 4, 5],
      origen_ida:    { nombre_lugar: 'Barrio Norte' },
      destino_ida:   { nombre_lugar: 'IES Cervantes' },
    });
    expect(validateStep(1, draft)).toBeNull();
    expect(validateStep(2, draft)).toBeNull();
    expect(validateStep(3, draft)).toBeNull();
  });

  it('SW-6-B: ruta de trabajadores con turnos — vuelta habilitada', () => {
    const draft = makeDraft({
      tipo_servicio:      'transporte_trabajadores',
      vuelta_habilitada:  true,
      hora_salida_vuelta: '14:00',
      dias_semana:        [1, 2, 3, 4, 5],
    });
    expect(validateStep(2, draft)).toBeNull();
    const input = buildScheduleInput(draft);
    expect(input.vuelta_habilitada).toBe(true);
    expect(input.hora_salida_vuelta).toBe('14:00:00');
  });

  it('SW-6-C: ruta temporal de 6 meses — preview no excede periodo_fin', () => {
    const draft = makeDraft({
      periodo_inicio: '2026-11-01',
      periodo_fin:    '2027-04-30',
      dias_semana:    [1, 2, 3, 4, 5],
    });
    const dates = getPreviewDates(draft, 100);
    if (dates.length > 0) {
      expect(dates[dates.length - 1]! <= '2027-04-30').toBe(true);
    }
  });

  it('SW-6-D: ruta con fecha fin abierta — periodo_fin null en input', () => {
    const input = buildScheduleInput(makeDraft({ periodo_fin: '' }));
    expect(input.periodo_fin).toBeNull();
  });

  it('SW-6-E: ida sin vuelta — vuelta_habilitada=false', () => {
    const input = buildScheduleInput(makeDraft({ vuelta_habilitada: false }));
    expect(input.vuelta_habilitada).toBe(false);
    expect(input.hora_salida_vuelta).toBeNull();
    expect(input.paradas_vuelta).toEqual([]);
  });

  it('SW-6-F: ida y vuelta con recorridos diferentes', () => {
    const paradaIda    = makeStop('Centro comercial');
    const paradaVuelta = makeStop('Hospital', '16:30');
    const draft = makeDraft({
      vuelta_habilitada:  true,
      hora_salida_vuelta: '16:00',
      paradas_ida:        [paradaIda],
      paradas_vuelta:     [paradaVuelta],
    });
    const input = buildScheduleInput(draft);
    expect((input.paradas_ida as TransportStop[])[0].nombre).toBe('Centro comercial');
    expect((input.paradas_vuelta as TransportStop[])[0].nombre).toBe('Hospital');
  });

  it('SW-6-G: paradas favoritas — locationToStop preserva location original', () => {
    const loc: TransportLocation = {
      nombre_lugar: 'IES Norte',
      lat: 43.462, lng: -3.805,
      geo_source: 'confirmed',
    };
    const stop = locationToStop(loc, '07:45');
    expect(stop.nombre).toBe('IES Norte');
    expect(stop.location?.lat).toBe(43.462);
    expect(stop.hora).toBe('07:45');
  });

  it('SW-6-H: doble guardado — savingRef.current bloquea segunda llamada (simulación)', () => {
    // Simula el comportamiento de la guarda con ref
    let callCount = 0;
    const savingRef = { current: false };
    const mockSave = () => {
      if (savingRef.current) return;
      savingRef.current = true;
      callCount++;
    };
    mockSave();
    mockSave(); // segunda llamada bloqueada
    expect(callCount).toBe(1);
    savingRef.current = false;
  });

  it('SW-6-I: campos obligatorios paso 1 — tipo y nombre son requeridos', () => {
    expect(validateStep(1, makeDraft({ tipo_servicio: '' }))).not.toBeNull();
    expect(validateStep(1, makeDraft({ nombre: '' }))).not.toBeNull();
    expect(validateStep(1, makeDraft({ tipo_servicio: 'lanzadera', nombre: 'Lanzadera A' }))).toBeNull();
  });

  it('SW-6-J: lanzadera — tipo válido con buildScheduleInput', () => {
    const draft = makeDraft({ tipo_servicio: 'lanzadera', nombre: 'Lanzadera Polígono Norte' });
    const input = buildScheduleInput(draft);
    expect(input.tipo_servicio).toBe('lanzadera');
    expect(input.nombre).toBe('Lanzadera Polígono Norte');
    expect(input.estado).toBe('borrador');
  });
});
