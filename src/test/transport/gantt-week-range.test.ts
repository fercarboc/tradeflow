/**
 * gantt-week-range.test.ts — POSTDEPLOY-UX-FIX-1 / BLOQUE A / CARGA SEMANAL
 *
 * Verifica la lógica de construcción de límites UTC para la consulta de viajes
 * semanal y el predicado de solapamiento equivalente al usado por
 * loadTripsOverlappingRange (mismo patrón que loadServicesOverlappingRange).
 *
 *   WR-1  Viaje de 22:00–23:59: solapamiento con el día
 *   WR-2  Viaje de 23:00–01:00: solapamiento en ambos días
 *   WR-3  Viaje cercano a medianoche UTC: capturado con límite UTC correcto
 *   WR-4  Semana que cruza DST de primavera (2026-03-29)
 *   WR-5  Semana que cruza DST de otoño (2026-10-25)
 *   WR-6  Viaje iniciado antes de la semana y finalizado dentro de ella
 *   WR-7  Round-trip consistencia: weekStart → toISOString → getTime()
 *   WR-8  tripsDesde ≤ tripsHasta (bounds bien ordenados)
 *   WR-9  Bounds cubren exactamente 7 días locales (no depende de TZ)
 *   WR-10 Predicado de solapamiento: casos negativos
 */

import { describe, it, expect } from 'vitest';
import { startOfWeek, addDays, serviceOverlapsDay } from '../../lib/transportPanelHelpers';

// ── Predicado de solapamiento (espejo del server-side, string comparison en UTC ISO) ─

/**
 * Replica la condición de loadTripsOverlappingRange:
 *   fecha_inicio <= hasta AND (fecha_fin >= desde OR fecha_fin IS NULL)
 */
function tripsOverlapRange(
  trip: { fecha_inicio: string; fecha_fin?: string | null },
  desde: string,
  hasta: string,
): boolean {
  const inicioOk = trip.fecha_inicio <= hasta;
  const finOk    = !trip.fecha_fin || trip.fecha_fin >= desde;
  return inicioOk && finOk;
}

/**
 * Construye los límites UTC de la semana del Gantt (espejo de loadWeek).
 * weekStart debe tener local midnight (setHours(0,0,0,0) — ya lo hace startOfWeek).
 * weekEnd debe tener local midnight (lo garantiza addDays).
 */
function buildWeekBoundsUTC(weekStart: Date, weekEnd: Date): { desde: string; hasta: string } {
  return {
    desde: weekStart.toISOString(),
    hasta: new Date(
      weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999,
    ).toISOString(),
  };
}

// ── WR-1: Viaje de 22:00–23:59 ────────────────────────────────────────────────

describe('WR-1 — viaje de 22:00–23:59 dentro de la semana', () => {
  const weekStart = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2, 2026
  const weekEnd   = addDays(weekStart, 6);
  const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);

  // Viaje en hora local: lunes Nov 2 a las 22:00-23:59 local
  // Usamos timestamp local (sin Z) para independencia de TZ del entorno
  const tripLocalStr = new Date(2026, 10, 2, 22, 0, 0).toISOString();
  const tripEndStr   = new Date(2026, 10, 2, 23, 59, 0).toISOString();

  it('WR-1-1: el viaje 22:00–23:59 solapea con la semana', () => {
    const trip = { fecha_inicio: tripLocalStr, fecha_fin: tripEndStr };
    expect(tripsOverlapRange(trip, desde, hasta)).toBe(true);
  });

  it('WR-1-2: serviceOverlapsDay confirma el viaje 22:00–23:59 en el mismo día local', () => {
    expect(serviceOverlapsDay({ fecha_inicio: tripLocalStr, fecha_fin: tripEndStr }, '2026-11-02')).toBe(true);
  });
});

// ── WR-2: Viaje de 23:00–01:00 ────────────────────────────────────────────────

describe('WR-2 — viaje de 23:00–01:00 (cross-midnight)', () => {
  const weekStart = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2
  const weekEnd   = addDays(weekStart, 6);
  const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);

  const tripStart = new Date(2026, 10, 2, 23, 0, 0).toISOString();   // Mon 23:00
  const tripEnd   = new Date(2026, 10, 3,  1, 0, 0).toISOString();   // Tue 01:00

  it('WR-2-1: el viaje 23:00–01:00 solapea con la semana', () => {
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });

  it('WR-2-2: serviceOverlapsDay confirma el viaje en el día de inicio (lunes)', () => {
    expect(serviceOverlapsDay({ fecha_inicio: tripStart, fecha_fin: tripEnd }, '2026-11-02')).toBe(true);
  });

  it('WR-2-3: serviceOverlapsDay confirma el viaje en el día de fin (martes)', () => {
    expect(serviceOverlapsDay({ fecha_inicio: tripStart, fecha_fin: tripEnd }, '2026-11-03')).toBe(true);
  });
});

// ── WR-3: Viaje cercano a medianoche UTC ──────────────────────────────────────

describe('WR-3 — viaje cercano a medianoche UTC (límite correcto vs incorrecto)', () => {
  // Simula un escenario UTC+1 con strings UTC explícitos.
  // En UTC+1 el lunes local empieza a las 23:00 UTC del domingo anterior.
  //
  // Usando strings UTC explícitos (timezone-independiente):
  //   tripsDesde correcto:  "2026-11-01T23:00:00Z"  (local lunes 00:00 en UTC+1)
  //   tripsDesde incorrecto: "2026-11-02T00:00:00Z" (UTC midnight, ignora offset)
  //
  // Viaje: inicia 23:30 UTC del domingo = local 00:30 del lunes (UTC+1)
  //   debe estar en la semana del lunes → el límite correcto lo captura.

  const desdeCorrectoUTC1   = '2026-11-01T23:00:00.000Z';  // local lunes 00:00 en UTC+1
  const desdeIncorrecto     = '2026-11-02T00:00:00.000Z';  // UTC midnight (bug)
  const hastaEjemplo        = '2026-11-08T22:59:59.999Z';  // local domingo 23:59 en UTC+1

  const trip = {
    fecha_inicio: '2026-11-01T23:30:00Z',   // UTC+1: lunes 00:30
    fecha_fin:    '2026-11-01T23:45:00Z',   // UTC+1: lunes 00:45
  };

  it('WR-3-1: con tripsDesde correcto (UTC equiv de local midnight), el viaje se incluye', () => {
    expect(tripsOverlapRange(trip, desdeCorrectoUTC1, hastaEjemplo)).toBe(true);
  });

  it('WR-3-2: con tripsDesde incorrecto (UTC midnight), el viaje queda excluido (documenta el bug)', () => {
    expect(tripsOverlapRange(trip, desdeIncorrecto, hastaEjemplo)).toBe(false);
  });
});

// ── WR-4: Semana que cruza DST de primavera (2026-03-29) ─────────────────────

describe('WR-4 — DST primavera 2026: semana 23-29 de marzo', () => {
  // En España el 29 de marzo de 2026 a las 02:00 los relojes adelantan a las 03:00 (UTC+1→UTC+2).
  // La semana local: lunes 23 de marzo → domingo 29 de marzo.

  const weekStart = startOfWeek(new Date(2026, 2, 23)); // Mon Mar 23
  const weekEnd   = addDays(weekStart, 6);               // Sun Mar 29

  it('WR-4-1: weekStart es lunes 23 de marzo', () => {
    expect(weekStart.getFullYear()).toBe(2026);
    expect(weekStart.getMonth()).toBe(2);   // 0-indexed → marzo
    expect(weekStart.getDate()).toBe(23);
    expect(weekStart.getDay()).toBe(1);     // lunes
  });

  it('WR-4-2: weekEnd es domingo 29 de marzo', () => {
    expect(weekEnd.getDate()).toBe(29);
    expect(weekEnd.getDay()).toBe(0);       // domingo
  });

  it('WR-4-3: buildWeekBoundsUTC genera fechas válidas (no NaN, no lanza)', () => {
    const bounds = buildWeekBoundsUTC(weekStart, weekEnd);
    expect(isNaN(new Date(bounds.desde).getTime())).toBe(false);
    expect(isNaN(new Date(bounds.hasta).getTime())).toBe(false);
  });

  it('WR-4-4: desde < hasta (límites bien ordenados)', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    expect(desde < hasta).toBe(true);
  });

  it('WR-4-5: un viaje el domingo 29 a las 22:00 local solapea con la semana', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    const tripStart = new Date(2026, 2, 29, 22, 0, 0).toISOString();
    const tripEnd   = new Date(2026, 2, 29, 23, 30, 0).toISOString();
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });

  it('WR-4-6: un viaje el lunes 23 a las 00:30 local solapea con la semana', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    const tripStart = new Date(2026, 2, 23, 0, 30, 0).toISOString();
    const tripEnd   = new Date(2026, 2, 23, 1, 0, 0).toISOString();
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });
});

// ── WR-5: Semana que cruza DST de otoño (2026-10-25) ─────────────────────────

describe('WR-5 — DST otoño 2026: semana 19-25 de octubre', () => {
  // En España el 25 de octubre de 2026 a las 03:00 los relojes retrasan a las 02:00 (UTC+2→UTC+1).
  // La semana local: lunes 19 de octubre → domingo 25 de octubre.

  const weekStart = startOfWeek(new Date(2026, 9, 19)); // Mon Oct 19
  const weekEnd   = addDays(weekStart, 6);               // Sun Oct 25

  it('WR-5-1: weekStart es lunes 19 de octubre', () => {
    expect(weekStart.getDate()).toBe(19);
    expect(weekStart.getMonth()).toBe(9);  // octubre
    expect(weekStart.getDay()).toBe(1);   // lunes
  });

  it('WR-5-2: weekEnd es domingo 25 de octubre', () => {
    expect(weekEnd.getDate()).toBe(25);
    expect(weekEnd.getDay()).toBe(0);     // domingo
  });

  it('WR-5-3: buildWeekBoundsUTC genera fechas válidas en semana con hora doble', () => {
    const bounds = buildWeekBoundsUTC(weekStart, weekEnd);
    expect(isNaN(new Date(bounds.desde).getTime())).toBe(false);
    expect(isNaN(new Date(bounds.hasta).getTime())).toBe(false);
  });

  it('WR-5-4: desde < hasta (límites bien ordenados en semana con hora doble)', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    expect(desde < hasta).toBe(true);
  });

  it('WR-5-5: un viaje el domingo 25 (hora doble: 02:30 primera vez) solapea', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    // 2026-10-25T02:30:00 local — hora durante la caída de DST
    const tripStart = new Date(2026, 9, 25, 2, 30, 0).toISOString();
    const tripEnd   = new Date(2026, 9, 25, 3, 30, 0).toISOString();
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });

  it('WR-5-6: un viaje el domingo 25 a las 23:59 solapea con la semana', () => {
    const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);
    const tripStart = new Date(2026, 9, 25, 23, 30, 0).toISOString();
    const tripEnd   = new Date(2026, 9, 25, 23, 59, 0).toISOString();
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });
});

// ── WR-6: Viaje iniciado antes de la semana y finalizado dentro ───────────────

describe('WR-6 — viaje iniciado antes de la semana, finalizado dentro', () => {
  // El bug original: loadTransportTrips solo filtraba fecha_inicio >= desde.
  // Un viaje que empieza el domingo anterior y termina el martes no aparecía.

  const weekStart = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2
  const weekEnd   = addDays(weekStart, 6);
  const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);

  it('WR-6-1: viaje que empieza el domingo anterior y termina el martes: solapea', () => {
    // Domingo Nov 1 a las 20:00
    const tripStart = new Date(2026, 10, 1, 20, 0, 0).toISOString();
    // Martes Nov 3 a las 10:00
    const tripEnd   = new Date(2026, 10, 3, 10, 0, 0).toISOString();

    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });

  it('WR-6-2: con el filtro solo-inicio (bug), el mismo viaje quedaría fuera', () => {
    const tripStart = new Date(2026, 10, 1, 20, 0, 0).toISOString();
    // El bug: fecha_inicio < desde → no pasa el filtro gte(fecha_inicio, desde)
    expect(tripStart >= desde).toBe(false); // confirma que el viaje se habría perdido
  });

  it('WR-6-3: viaje que termina exactamente al inicio de la semana (límite): solapea', () => {
    const tripStart = new Date(2026, 10, 1, 10, 0, 0).toISOString();
    const tripEnd   = weekStart.toISOString(); // exactamente desde
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(true);
  });

  it('WR-6-4: viaje que termina antes del inicio de la semana: no solapea', () => {
    const tripStart = new Date(2026, 9, 28, 10, 0, 0).toISOString(); // Oct 28
    const tripEnd   = new Date(2026, 9, 29, 10, 0, 0).toISOString(); // Oct 29
    expect(tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta)).toBe(false);
  });
});

// ── WR-7: Round-trip consistencia ─────────────────────────────────────────────

describe('WR-7 — round-trip: weekStart → toISOString → getTime()', () => {
  it('WR-7-1: toISOString round-trip preserva el timestamp exacto', () => {
    const weekStart = startOfWeek(new Date(2026, 10, 4));
    const ts1 = weekStart.getTime();
    const ts2 = new Date(weekStart.toISOString()).getTime();
    expect(ts1).toBe(ts2);
  });

  it('WR-7-2: weekStart ya tiene local midnight (setHours 0,0,0,0)', () => {
    const weekStart = startOfWeek(new Date(2026, 10, 4, 15, 30, 0)); // hora cualquiera
    expect(weekStart.getHours()).toBe(0);
    expect(weekStart.getMinutes()).toBe(0);
    expect(weekStart.getSeconds()).toBe(0);
    expect(weekStart.getMilliseconds()).toBe(0);
  });
});

// ── WR-8: Bounds bien ordenados ────────────────────────────────────────────────

describe('WR-8 — tripsDesde ≤ tripsHasta', () => {
  it('WR-8-1: desde < hasta para semana normal', () => {
    const ws = startOfWeek(new Date(2026, 5, 8)); // Mon Jun 8
    const we = addDays(ws, 6);
    const { desde, hasta } = buildWeekBoundsUTC(ws, we);
    expect(desde < hasta).toBe(true);
  });

  it('WR-8-2: desde < hasta en semana de año nuevo', () => {
    const ws = startOfWeek(new Date(2026, 11, 28)); // week of Dec 28
    const we = addDays(ws, 6);
    const { desde, hasta } = buildWeekBoundsUTC(ws, we);
    expect(desde < hasta).toBe(true);
  });
});

// ── WR-9: 7 días locales cubiertos ────────────────────────────────────────────

describe('WR-9 — los bounds cubren exactamente 7 días locales', () => {
  const weeks = [
    { label: 'semana normal',          date: new Date(2026, 10, 4) },
    { label: 'semana DST primavera',   date: new Date(2026, 2, 23) },
    { label: 'semana DST otoño',       date: new Date(2026, 9, 19) },
    { label: 'semana año nuevo',       date: new Date(2026, 11, 28) },
  ];

  for (const { label, date } of weeks) {
    it(`WR-9: ${label} → 7 días cubiertos`, () => {
      const ws = startOfWeek(date);
      const we = addDays(ws, 6);
      const { desde, hasta } = buildWeekBoundsUTC(ws, we);

      // Cada uno de los 7 días locales debe tener al menos un viaje "capturado"
      for (let i = 0; i < 7; i++) {
        const day = addDays(ws, i);
        // Trip: 12:00–13:00 local en ese día
        const tripStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12, 0, 0).toISOString();
        const tripEnd   = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 13, 0, 0).toISOString();
        expect(
          tripsOverlapRange({ fecha_inicio: tripStart, fecha_fin: tripEnd }, desde, hasta),
          `día ${i + 1} (${day.toDateString()}) no solapea con los bounds`,
        ).toBe(true);
      }
    });
  }
});

// ── WR-10: Casos negativos del predicado ──────────────────────────────────────

describe('WR-10 — predicado de solapamiento: casos negativos', () => {
  const weekStart = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2
  const weekEnd   = addDays(weekStart, 6);
  const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);

  it('WR-10-1: viaje completamente antes de la semana no solapea', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 9, 25, 10, 0, 0).toISOString(),
      fecha_fin:    new Date(2026, 9, 25, 12, 0, 0).toISOString(),
    }, desde, hasta)).toBe(false);
  });

  it('WR-10-2: viaje completamente después de la semana no solapea', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 10, 10, 10, 0, 0).toISOString(),
      fecha_fin:    new Date(2026, 10, 10, 12, 0, 0).toISOString(),
    }, desde, hasta)).toBe(false);
  });

  it('WR-10-3: viaje con fecha_fin null que empieza antes: sigue solapando (puede ser en curso)', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 9, 25, 10, 0, 0).toISOString(),
      fecha_fin:    null,
    }, desde, hasta)).toBe(true);
  });

  it('WR-10-4: viaje con fecha_fin null que empieza después de hasta: no solapea', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 10, 10, 10, 0, 0).toISOString(),
      fecha_fin:    null,
    }, desde, hasta)).toBe(false);
  });
});

// ── WR-11: Regresión Viajeros — mismos límites UTC unificados ─────────────────
//
// Tras unificar weekDesde/weekHasta para Viajeros (loadServicesOverlappingRange)
// y Mercancías (loadTripsOverlappingRange), ambas usan el mismo predicado de
// solapamiento. Estos tests verifican que los servicios de Viajeros cercanos a
// medianoche también quedarían cubiertos.

describe('WR-11 — regresión Viajeros: servicios próximos a medianoche', () => {
  const weekStart = startOfWeek(new Date(2026, 10, 4)); // Mon Nov 2
  const weekEnd   = addDays(weekStart, 6);
  const { desde, hasta } = buildWeekBoundsUTC(weekStart, weekEnd);

  it('WR-11-1: servicio Viajeros a las 22:30 del lunes solapea con la semana', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 10, 2, 22, 30, 0).toISOString(),
      fecha_fin:    new Date(2026, 10, 2, 23, 55, 0).toISOString(),
    }, desde, hasta)).toBe(true);
  });

  it('WR-11-2: servicio 23:00–01:00 (nocturno) solapea con la semana', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 10, 2, 23, 0, 0).toISOString(),
      fecha_fin:    new Date(2026, 10, 3,  1, 0, 0).toISOString(),
    }, desde, hasta)).toBe(true);
  });

  it('WR-11-3: con límite UTC explícito, servicio cercano a medianoche UTC se captura', () => {
    // Simula UTC+1: servicio "2026-11-01T23:30:00Z" = local lunes 00:30
    // weekDesde = weekStart.toISOString() = "2026-11-01T23:00:00Z" en UTC+1
    // Si se usa el límite correcto ("2026-11-01T23:00:00Z"), el servicio está dentro.
    // El predicado directo sobre el string UTC:
    const desdeUTC1 = '2026-11-01T23:00:00.000Z';  // weekStart en UTC+1
    const hastaUTC1 = '2026-11-08T22:59:59.999Z';  // weekEnd en UTC+1
    const svc = {
      fecha_inicio: '2026-11-01T23:30:00Z',  // local lunes 00:30 en UTC+1
      fecha_fin:    '2026-11-01T23:55:00Z',
    };
    expect(tripsOverlapRange(svc, desdeUTC1, hastaUTC1)).toBe(true);
  });

  it('WR-11-4: servicio iniciado el domingo anterior y terminado el miércoles: solapea', () => {
    expect(tripsOverlapRange({
      fecha_inicio: new Date(2026, 10, 1, 18, 0, 0).toISOString(), // domingo
      fecha_fin:    new Date(2026, 10, 4, 12, 0, 0).toISOString(), // miércoles
    }, desde, hasta)).toBe(true);
  });

  it('WR-11-5: serviceOverlapsDay confirma el servicio nocturno 22:30–23:55 en el día local', () => {
    const svcStart = new Date(2026, 10, 2, 22, 30, 0).toISOString();
    const svcEnd   = new Date(2026, 10, 2, 23, 55, 0).toISOString();
    expect(serviceOverlapsDay({ fecha_inicio: svcStart, fecha_fin: svcEnd }, '2026-11-02')).toBe(true);
  });
});
