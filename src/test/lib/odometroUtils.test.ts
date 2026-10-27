import { describe, it, expect } from 'vitest';
import {
  calcOdoEstimado,
  calcDistanciaOdo,
  validateOdometroFinal,
  fmtKm,
  resolveOdometroFinal,
} from '../../lib/odometroUtils';

// ── ODO-1: calcOdoEstimado ────────────────────────────────────────────────────

describe('calcOdoEstimado', () => {
  it('ODO-1-A: inicio + km enteros → suma exacta', () => {
    expect(calcOdoEstimado(175000, '115')).toBe(175115);
  });

  it('ODO-1-B: inicio + km decimales → redondeo al entero más cercano', () => {
    expect(calcOdoEstimado(175000, '115.6')).toBe(175116);
    expect(calcOdoEstimado(175000, '115.4')).toBe(175115);
  });

  it('ODO-1-C: km = 0 → mismo valor que inicio', () => {
    expect(calcOdoEstimado(175000, '0')).toBe(175000);
  });

  it('ODO-1-D: inicio null → null (sin lectura inicial)', () => {
    expect(calcOdoEstimado(null, '115')).toBeNull();
    expect(calcOdoEstimado(undefined, '115')).toBeNull();
  });

  it('ODO-1-E: km vacío → null', () => {
    expect(calcOdoEstimado(175000, '')).toBeNull();
    expect(calcOdoEstimado(175000, '   ')).toBeNull();
  });

  it('ODO-1-F: km NaN → null', () => {
    expect(calcOdoEstimado(175000, 'abc')).toBeNull();
  });

  it('ODO-1-G: km negativo → null (distancia negativa no tiene sentido)', () => {
    expect(calcOdoEstimado(175000, '-10')).toBeNull();
  });

  it('ODO-1-H: inicio 0 funciona', () => {
    expect(calcOdoEstimado(0, '50')).toBe(50);
  });
});

// ── ODO-2: calcDistanciaOdo ───────────────────────────────────────────────────

describe('calcDistanciaOdo', () => {
  it('ODO-2-A: diferencia positiva normal', () => {
    expect(calcDistanciaOdo(175000, '175115')).toBe(115);
  });

  it('ODO-2-B: final igual a inicio → 0', () => {
    expect(calcDistanciaOdo(175000, '175000')).toBe(0);
  });

  it('ODO-2-C: final < inicio → diferencia negativa (no bloquea aquí)', () => {
    expect(calcDistanciaOdo(175000, '174900')).toBe(-100);
  });

  it('ODO-2-D: inicio null → null', () => {
    expect(calcDistanciaOdo(null, '175115')).toBeNull();
    expect(calcDistanciaOdo(undefined, '175115')).toBeNull();
  });

  it('ODO-2-E: final vacío → null', () => {
    expect(calcDistanciaOdo(175000, '')).toBeNull();
    expect(calcDistanciaOdo(175000, '   ')).toBeNull();
  });

  it('ODO-2-F: final NaN → null', () => {
    expect(calcDistanciaOdo(175000, 'abc')).toBeNull();
  });

  it('ODO-2-G: ambos null → null', () => {
    expect(calcDistanciaOdo(null, '')).toBeNull();
  });
});

// ── ODO-3: validateOdometroFinal ─────────────────────────────────────────────

describe('validateOdometroFinal', () => {
  it('ODO-3-A: campo vacío → null (no error)', () => {
    expect(validateOdometroFinal(175000, '')).toBeNull();
    expect(validateOdometroFinal(175000, '   ')).toBeNull();
  });

  it('ODO-3-B: lectura válida mayor que inicio → null', () => {
    expect(validateOdometroFinal(175000, '175115')).toBeNull();
  });

  it('ODO-3-C: lectura igual a inicio → null (servicio corto)', () => {
    expect(validateOdometroFinal(175000, '175000')).toBeNull();
  });

  it('ODO-3-D: lectura menor que inicio → error de validación', () => {
    const err = validateOdometroFinal(175000, '174999');
    expect(err).not.toBeNull();
    expect(err).toContain('174.999');   // formatted final
    expect(err).toContain('175.000');   // formatted inicio
  });

  it('ODO-3-E: inicio null + lectura válida → null (no hay comparación)', () => {
    expect(validateOdometroFinal(null, '175115')).toBeNull();
    expect(validateOdometroFinal(undefined, '175115')).toBeNull();
  });

  it('ODO-3-F: inicio null + campo vacío → null', () => {
    expect(validateOdometroFinal(null, '')).toBeNull();
  });

  it('ODO-3-G: valor no numérico → error de formato', () => {
    const err = validateOdometroFinal(175000, 'abc');
    expect(err).not.toBeNull();
    expect(err).toContain('número entero positivo');
  });

  it('ODO-3-H: valor negativo → error de formato', () => {
    const err = validateOdometroFinal(175000, '-1');
    expect(err).not.toBeNull();
  });

  it('ODO-3-I: caso exacto del bug reportado (115 como odómetro, no como km)', () => {
    // Usuario pone 115 (km recorridos) en el campo de odómetro cuando el inicio era 175000
    const err = validateOdometroFinal(175000, '115');
    expect(err).not.toBeNull();
    expect(err).toContain('115');
    expect(err).toContain('175.000');
  });

  it('ODO-3-J: lectura de 0 con inicio 0 → null (vehículo nuevo)', () => {
    expect(validateOdometroFinal(0, '0')).toBeNull();
  });
});

// ── ODO-4: fmtKm ─────────────────────────────────────────────────────────────

describe('fmtKm', () => {
  it('ODO-4-A: número con millares usa punto como separador (es-ES)', () => {
    const result = fmtKm(175115);
    expect(result).toContain('175');
    expect(result).toContain('115');
    // Verifica que hay separador de millares (punto en es-ES)
    expect(result.length).toBeGreaterThan(6);
  });

  it('ODO-4-B: número pequeño sin separador', () => {
    expect(fmtKm(999)).toBe('999');
  });

  it('ODO-4-C: cero', () => {
    expect(fmtKm(0)).toBe('0');
  });
});

// ── ODO-5: flujo combinado (escenario del bug) ────────────────────────────────

describe('flujo combinado — escenario del bug reportado', () => {
  const INICIO = 175000;

  it('ODO-5-A: usuario declara 115 km → estimado correcto (175115)', () => {
    expect(calcOdoEstimado(INICIO, '115')).toBe(175115);
  });

  it('ODO-5-B: usuario usa estimación → distancia por odómetro = 115', () => {
    const estimado = calcOdoEstimado(INICIO, '115')!;
    expect(calcDistanciaOdo(INICIO, String(estimado))).toBe(115);
  });

  it('ODO-5-C: usuario pone 115 en campo odómetro final → error de validación', () => {
    expect(validateOdometroFinal(INICIO, '115')).not.toBeNull();
  });

  it('ODO-5-D: usuario pone 175115 en campo odómetro final → sin error', () => {
    expect(validateOdometroFinal(INICIO, '175115')).toBeNull();
  });

  it('ODO-5-E: km cambia de 115 a 200 → nuevo estimado 175200 (lectura confirmada no se toca)', () => {
    const nuevoKm = '200';
    const nuevoEstimado = calcOdoEstimado(INICIO, nuevoKm);
    expect(nuevoEstimado).toBe(175200);
    // La lectura confirmada (175115) permanece — resolveOdometroFinal la sigue devolviendo
    expect(resolveOdometroFinal('175115', true)).toBe(175115);
  });

  it('ODO-5-F: km vacío → estimado null (display muestra "—")', () => {
    const estimado = calcOdoEstimado(INICIO, '');
    expect(estimado).toBeNull();
  });
});

// ── ODO-7: resolveOdometroFinal ───────────────────────────────────────────────

describe('resolveOdometroFinal', () => {
  it('ODO-7-A: confirmado + valor válido → retorna entero', () => {
    expect(resolveOdometroFinal('175115', true)).toBe(175115);
  });

  it('ODO-7-B: no confirmado + valor válido → null (no enviar sin confirmación)', () => {
    expect(resolveOdometroFinal('175115', false)).toBeNull();
  });

  it('ODO-7-C: confirmado + campo vacío → null', () => {
    expect(resolveOdometroFinal('', true)).toBeNull();
    expect(resolveOdometroFinal('  ', true)).toBeNull();
  });

  it('ODO-7-D: confirmado + valor no numérico → null', () => {
    expect(resolveOdometroFinal('abc', true)).toBeNull();
  });

  it('ODO-7-E: confirmado + negativo → null', () => {
    expect(resolveOdometroFinal('-1', true)).toBeNull();
  });

  it('ODO-7-F: no confirmado + campo vacío → null', () => {
    expect(resolveOdometroFinal('', false)).toBeNull();
  });

  it('ODO-7-G: confirmado + cero → 0 (vehículo nuevo)', () => {
    expect(resolveOdometroFinal('0', true)).toBe(0);
  });
});

// ── ODO-8: flujo completo con confirmación explícita ─────────────────────────

describe('flujo completo — confirmación explícita requerida', () => {
  const INICIO = 175000;

  it('ODO-8-A: "Usar estimación" copia el valor pero NO confirma automáticamente', () => {
    const estimado = calcOdoEstimado(INICIO, '115')!; // 175115
    // Simula click "Usar estimación": setOdoFinal(String(estimado)), odoConfirmado sigue false
    const odoFinal = String(estimado);
    expect(resolveOdometroFinal(odoFinal, false)).toBeNull(); // no confirmado aún
    expect(resolveOdometroFinal(odoFinal, true)).toBe(175115);  // tras marcar checkbox
  });

  it('ODO-8-B: km cambia tras confirmación → estimado actualiza, lectura confirmada no cambia', () => {
    const odoFinalConfirmado = '175115';
    // km cambia a 200 → nuevo estimado 175200, pero la lectura confirmada es la del usuario
    const nuevoEstimado = calcOdoEstimado(INICIO, '200'); // 175200
    expect(nuevoEstimado).toBe(175200);
    // La lectura confirmada sigue siendo 175115 — component no la toca
    expect(resolveOdometroFinal(odoFinalConfirmado, true)).toBe(175115);
  });

  it('ODO-8-C: editar lectura invalida confirmación — nuevo valor no se envía hasta reconfirmar', () => {
    const nuevaLectura = '175200';
    // handleOdoFinalChange → setOdoConfirmado(false)
    expect(resolveOdometroFinal(nuevaLectura, false)).toBeNull();
    // Tras marcar checkbox de nuevo
    expect(resolveOdometroFinal(nuevaLectura, true)).toBe(175200);
  });

  it('ODO-8-D: cierre sin confirmación → odometro_final = null (km_actual no se actualiza)', () => {
    // El usuario rellena el campo pero no marca el checkbox
    expect(resolveOdometroFinal('175115', false)).toBeNull();
  });

  it('ODO-8-E: cierre con confirmación → odometro_final enviado correctamente', () => {
    expect(resolveOdometroFinal('175115', true)).toBe(175115);
  });

  it('ODO-8-F: campo vacío + confirmado = false → null en ambos casos', () => {
    expect(resolveOdometroFinal('', false)).toBeNull();
    expect(resolveOdometroFinal('', true)).toBeNull();
  });

  it('ODO-8-G: escenario bug original — usuario pone 115 (km viaje) en odómetro → validación bloquea antes de confirmar', () => {
    // validateOdometroFinal rechaza el valor (< inicio)
    const err = validateOdometroFinal(INICIO, '115');
    expect(err).not.toBeNull();
    // resolveOdometroFinal devuelve null incluso si confirmado (no llegaría a confirmarse por la validación)
    // pero si llegara sin validar:
    expect(resolveOdometroFinal('115', true)).toBe(115); // pasa resolveOdometroFinal solo
    // la barrera real es validateOdometroFinal que bloquea el submit
    expect(err).toContain('175.000');
  });
});

// ── ODO-6: casos extremos ─────────────────────────────────────────────────────

describe('casos extremos', () => {
  it('ODO-6-A: inicio muy alto (contador a punto de dar vuelta) — sin inicio → sin comparación', () => {
    expect(validateOdometroFinal(null, '999999')).toBeNull();
  });

  it('ODO-6-B: km con muchos decimales → redondeo correcto', () => {
    // 99.999 km → Math.round → 100 km → 100000 + 100 = 100100
    expect(calcOdoEstimado(100000, '99.999')).toBe(100100);
  });

  it('ODO-6-C: km = "0.0" → estimado = inicio', () => {
    expect(calcOdoEstimado(100000, '0.0')).toBe(100000);
  });

  it('ODO-6-D: validación tolerante a espacios (campo con espacios al usuario escribir)', () => {
    expect(validateOdometroFinal(175000, '  ')).toBeNull();
  });
});
