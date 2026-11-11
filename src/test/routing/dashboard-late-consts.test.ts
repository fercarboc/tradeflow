/**
 * Regresión: en AppDashboardView las vistas móviles se definen DESPUÉS del
 * `return (` principal del componente. Ahí solo valen declaraciones `function`
 * (se elevan); una `const`/`let` a ese nivel queda en zona muerta temporal y
 * cualquier onClick que la use falla en silencio (bug menú «Más» de transporte).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('AppDashboardView — sin const/let tras el return principal', () => {
  it('no declara const/let a nivel de componente después del return', () => {
    const src = readFileSync(resolve(__dirname, '../../components/AppDashboardView.tsx'), 'utf8').split('\n');
    const mainReturn = src.findIndex((l, i) => i > 1000 && /^  return \($/.test(l));
    expect(mainReturn).toBeGreaterThan(0);
    const late = src
      .map((l, i) => ({ l, n: i + 1 }))
      .filter(({ l, n }) => n > mainReturn && /^  (const|let) [A-Za-z_]/.test(l));
    expect(late.map(x => `${x.n}: ${x.l.trim()}`)).toEqual([]);
  });
});
