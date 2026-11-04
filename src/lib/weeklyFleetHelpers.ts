/**
 * weeklyFleetHelpers.ts — Helpers puros para la vista semanal de flota.
 * TX-TRANSPORT-WEEKLY-FLEET-1 Fase 1
 *
 * Sin dependencias de Supabase ni React. Totalmente testeable.
 *
 * LÍMITES del cálculo de barras (computeWeeklyBarSegments):
 *  - fecha_fin null → placeholder visual de 2h; isOpenEnd=true.
 *    No representa la duración real de la operación.
 *    Renderizar con borde derecho discontinuo para señalizar incertidumbre.
 *  - Operaciones que cruzan los límites de semana: recortadas al rango visible.
 *    No se pierde ningún dato; solo se oculta lo que queda fuera de pantalla.
 *  - Cambios DST: medianoche calculada con new Date('YYYY-MM-DDT00:00:00')
 *    (hora local del dispositivo), lo que maneja correctamente días de 23h
 *    (inicio horario de verano, último domingo de marzo) y 25h (fin, último
 *    domingo de octubre). NUNCA se suma 86_400_000 ms para calcular la
 *    medianoche siguiente.
 */

import { isoDate } from './transportPanelHelpers';

// ── Tipos exportados ──────────────────────────────────────────────────────────

/**
 * Segmento de barra para una operación dentro de un único día-columna.
 * Una operación multidía genera un WeeklyBarSegment por cada día visible.
 */
export interface WeeklyBarSegment {
  /** Índice de columna dentro de la semana de 7 días. 0=Lunes … 6=Domingo. */
  dayIndex: number;
  /** Posición de inicio como % del ancho del día (0–100). */
  leftPct: number;
  /** Ancho de la barra como % del ancho del día. Mínimo 1.5 (siempre visible). */
  widthPct: number;
  /** True cuando el timestamp real de inicio de la operación cae en este día. */
  isStart: boolean;
  /**
   * True cuando el timestamp real de fin de la operación cae en este día.
   * False para operaciones open-ended y para días intermedios.
   */
  isEnd: boolean;
  /**
   * True cuando fecha_fin era null (operación sin hora de fin confirmada).
   * El ancho de barra es un placeholder de 2h, no la duración real.
   * Renderizar con borde derecho discontinuo para comunicar incertidumbre.
   */
  isOpenEnd: boolean;
}

// ── Helper privado ────────────────────────────────────────────────────────────

/**
 * Devuelve la fecha ISO del día siguiente (hora local, DST-safe).
 * Usa mediodía para evitar ambigüedades de DST al llamar a setDate.
 */
function nextDayIso(dayStr: string): string {
  const d = new Date(`${dayStr}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return isoDate(d);
}

// ── Función principal ─────────────────────────────────────────────────────────

/**
 * Calcula los segmentos de barra semanal para una operación.
 *
 * Casos gestionados:
 *  - Inicio y fin en el mismo día
 *  - Multidía (cualquier duración, recortado a la semana visible)
 *  - Operación que empieza antes de weekDays[0] → leftPct = 0 en el primer día visible
 *  - Operación que termina después de weekDays[6] → último día se rellena hasta 100%
 *  - fecha_fin null → placeholder de 2h, isOpenEnd = true
 *  - fecha_inicio inválida → devuelve []
 *
 * @param fechaInicio  - ISO 8601 timestamp de inicio (ej. '2026-11-03T17:00:00')
 * @param fechaFin     - ISO 8601 timestamp de fin, o null si desconocido
 * @param weekDays     - Exactamente 7 Date a medianoche local (Lun–Dom)
 */
export function computeWeeklyBarSegments(
  fechaInicio: string,
  fechaFin: string | null | undefined,
  weekDays: Date[],
): WeeklyBarSegment[] {
  const svcStartMs = new Date(fechaInicio).getTime();
  if (isNaN(svcStartMs)) return [];

  const isOpenEnd = !fechaFin;
  const svcEndMs  = fechaFin
    ? new Date(fechaFin).getTime()
    : svcStartMs + 2 * 3600 * 1000; // 2h placeholder para open-ended

  const segments: WeeklyBarSegment[] = [];

  for (let i = 0; i < weekDays.length; i++) {
    const dayStr     = isoDate(weekDays[i]);
    // Medianoche local (DST-safe: no usa UTC ni suma ms fijos)
    const dayStartMs = new Date(`${dayStr}T00:00:00`).getTime();
    const dayEndMs   = new Date(`${nextDayIso(dayStr)}T00:00:00`).getTime();
    // dayMs puede ser 82_800_000 (23h DST+), 86_400_000 (24h normal) o 90_000_000 (25h DST-)
    const dayMs      = dayEndMs - dayStartMs;

    const visStartMs = Math.max(svcStartMs, dayStartMs);
    const visEndMs   = Math.min(svcEndMs,   dayEndMs);
    if (visEndMs <= visStartMs) continue;

    const leftPct  = Math.max(0, Math.min(100, (visStartMs - dayStartMs) / dayMs * 100));
    const widthPct = Math.max(1.5, Math.min(100 - leftPct, (visEndMs - visStartMs) / dayMs * 100));

    segments.push({
      dayIndex:  i,
      leftPct,
      widthPct,
      isStart:   svcStartMs >= dayStartMs && svcStartMs < dayEndMs,
      isEnd:     !isOpenEnd && svcEndMs > dayStartMs && svcEndMs <= dayEndMs,
      isOpenEnd,
    });
  }

  return segments;
}
