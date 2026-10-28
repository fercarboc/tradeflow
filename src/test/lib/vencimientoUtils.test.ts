import { describe, it, expect } from 'vitest';
import {
  getVencimientoState,
  VENCIMIENTO_UMBRAL_DIAS,
  VENCIMIENTO_DISPLAY,
  fmtDate,
  type VencimientoState,
} from '../../lib/vencimientoUtils';

// Fecha de referencia fija para tests deterministas
const HOY = new Date(2026, 9, 28); // 28 de octubre de 2026

function isoFecha(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ── VEN-1: getVencimientoState — casos principales ───────────────────────────

describe('getVencimientoState — valores nulos e inválidos', () => {
  it('VEN-1-A: null → no_informado', () => {
    expect(getVencimientoState(null, HOY)).toBe('no_informado');
  });
  it('VEN-1-B: undefined → no_informado', () => {
    expect(getVencimientoState(undefined, HOY)).toBe('no_informado');
  });
  it('VEN-1-C: cadena vacía → no_informado', () => {
    expect(getVencimientoState('', HOY)).toBe('no_informado');
    expect(getVencimientoState('   ', HOY)).toBe('no_informado');
  });
  it('VEN-1-D: fecha no parseable → no_informado', () => {
    expect(getVencimientoState('fecha-invalida', HOY)).toBe('no_informado');
    expect(getVencimientoState('32-13-2025', HOY)).toBe('no_informado');
  });
});

describe('getVencimientoState — vencido', () => {
  it('VEN-2-A: fecha ayer → vencido', () => {
    const ayer = isoFecha(2026, 10, 27);
    expect(getVencimientoState(ayer, HOY)).toBe('vencido');
  });
  it('VEN-2-B: fecha hace un año → vencido', () => {
    expect(getVencimientoState(isoFecha(2025, 10, 28), HOY)).toBe('vencido');
  });
  it('VEN-2-C: fecha hace muchos años → vencido', () => {
    expect(getVencimientoState(isoFecha(2020, 1, 1), HOY)).toBe('vencido');
  });
});

describe('getVencimientoState — vigente', () => {
  it('VEN-3-A: fecha en más de 30 días → vigente', () => {
    const fecha = isoFecha(2026, 12, 1); // más de 30 días
    expect(getVencimientoState(fecha, HOY)).toBe('vigente');
  });
  it('VEN-3-B: fecha en exactamente 31 días → vigente', () => {
    const fecha = isoFecha(2026, 11, 28);
    expect(getVencimientoState(fecha, HOY)).toBe('vigente');
  });
  it('VEN-3-C: fecha en 1 año → vigente', () => {
    expect(getVencimientoState(isoFecha(2027, 10, 28), HOY)).toBe('vigente');
  });
});

describe('getVencimientoState — proximo', () => {
  it('VEN-4-A: fecha exactamente en 30 días → proximo', () => {
    const fecha = isoFecha(2026, 11, 27); // 28 oct + 30 = 27 nov
    expect(getVencimientoState(fecha, HOY)).toBe('proximo');
  });
  it('VEN-4-B: fecha mañana → proximo', () => {
    const fecha = isoFecha(2026, 10, 29);
    expect(getVencimientoState(fecha, HOY)).toBe('proximo');
  });
  it('VEN-4-C: fecha en 15 días → proximo', () => {
    const fecha = isoFecha(2026, 11, 12);
    expect(getVencimientoState(fecha, HOY)).toBe('proximo');
  });
});

describe('getVencimientoState — hoy mismo', () => {
  it('VEN-5-A: fecha es hoy → vencido (expirado hoy = vencido)', () => {
    const hoy = isoFecha(2026, 10, 28);
    expect(getVencimientoState(hoy, HOY)).toBe('vencido');
  });
});

describe('getVencimientoState — umbral personalizado', () => {
  it('VEN-6-A: umbral 7 días — fecha en 8 días → vigente', () => {
    const fecha = isoFecha(2026, 11, 5);
    expect(getVencimientoState(fecha, HOY, 7)).toBe('vigente');
  });
  it('VEN-6-B: umbral 7 días — fecha en 7 días → proximo', () => {
    const fecha = isoFecha(2026, 11, 4);
    expect(getVencimientoState(fecha, HOY, 7)).toBe('proximo');
  });
  it('VEN-6-C: umbral 0 — fecha mañana → vigente', () => {
    const fecha = isoFecha(2026, 10, 29);
    expect(getVencimientoState(fecha, HOY, 0)).toBe('vigente');
  });
});

// ── VEN-7: VENCIMIENTO_DISPLAY — cobertura de todos los estados ──────────────

describe('VENCIMIENTO_DISPLAY — configuración completa', () => {
  const ESTADOS: VencimientoState[] = ['no_informado', 'vigente', 'proximo', 'vencido'];

  it('VEN-7-A: todos los estados tienen label no vacío', () => {
    ESTADOS.forEach(s => {
      expect(VENCIMIENTO_DISPLAY[s].label.length).toBeGreaterThan(0);
    });
  });

  it('VEN-7-B: todos los estados tienen colorClass que incluye bg-', () => {
    ESTADOS.forEach(s => {
      expect(VENCIMIENTO_DISPLAY[s].colorClass).toContain('bg-');
    });
  });

  it('VEN-7-C: todos los estados tienen dotColorClass que incluye bg-', () => {
    ESTADOS.forEach(s => {
      expect(VENCIMIENTO_DISPLAY[s].dotColorClass).toContain('bg-');
    });
  });

  it('VEN-7-D: vigente usa verde (emerald)', () => {
    expect(VENCIMIENTO_DISPLAY.vigente.colorClass).toContain('emerald');
  });

  it('VEN-7-E: vencido usa rojo (red)', () => {
    expect(VENCIMIENTO_DISPLAY.vencido.colorClass).toContain('red');
  });

  it('VEN-7-F: proximo usa ámbar (amber)', () => {
    expect(VENCIMIENTO_DISPLAY.proximo.colorClass).toContain('amber');
  });
});

// ── VEN-8: fmtDate ────────────────────────────────────────────────────────────

describe('fmtDate', () => {
  it('VEN-8-A: null → guión', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
  });
  it('VEN-8-B: cadena vacía → guión', () => {
    expect(fmtDate('')).toBe('—');
  });
  it('VEN-8-C: fecha válida incluye año, mes y día', () => {
    const result = fmtDate('2026-10-28');
    expect(result).toContain('2026');
    expect(result).toContain('10');
    expect(result).toContain('28');
  });
  it('VEN-8-D: fecha inválida → guión', () => {
    expect(fmtDate('no-es-fecha')).toBe('—');
  });
  it('VEN-8-E: resultado no es vacío para fecha válida', () => {
    expect(fmtDate('2025-01-15').length).toBeGreaterThan(3);
  });
});

// ── VEN-9: constante umbral ───────────────────────────────────────────────────

describe('VENCIMIENTO_UMBRAL_DIAS', () => {
  it('VEN-9-A: es 30', () => {
    expect(VENCIMIENTO_UMBRAL_DIAS).toBe(30);
  });
});

// ── VEN-10: flujos de negocio reales ─────────────────────────────────────────

describe('flujos de negocio — ITV y seguro', () => {
  it('VEN-10-A: ITV vence en 25 días → aparece como "próximo"', () => {
    const vencimiento = isoFecha(2026, 11, 22); // 25 días desde 28 oct
    expect(getVencimientoState(vencimiento, HOY)).toBe('proximo');
  });

  it('VEN-10-B: seguro vence en 6 meses → vigente', () => {
    const vencimiento = isoFecha(2027, 4, 28);
    expect(getVencimientoState(vencimiento, HOY)).toBe('vigente');
  });

  it('VEN-10-C: ITV vencida hace 3 meses → vencido (requiere acción)', () => {
    const vencimiento = isoFecha(2026, 7, 28);
    expect(getVencimientoState(vencimiento, HOY)).toBe('vencido');
  });

  it('VEN-10-D: vehículo nuevo sin datos → no_informado', () => {
    expect(getVencimientoState(null, HOY)).toBe('no_informado');
  });
});
