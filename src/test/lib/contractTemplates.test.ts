/**
 * Tests — contractTemplates: formatPostalAddress, buildContractHTML address mapping.
 *
 * To run:  npx vitest run src/test/lib/contractTemplates.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  formatPostalAddress,
  buildContractHTML,
  defaultContractVars,
  ContractVars,
} from '../../lib/contractTemplates';

// ── formatPostalAddress ───────────────────────────────────────────────────────

describe('formatPostalAddress', () => {
  it('Case 1 — org full postal: street + cp + localidad + provincia', () => {
    const result = formatPostalAddress('Calle Mayor 1', '39699', 'Ontaneda', 'Cantabria');
    expect(result).toBe('Calle Mayor 1, 39699 Ontaneda, Cantabria');
  });

  it('Case 2 — client full postal (real production data)', () => {
    const result = formatPostalAddress(
      'Calle La Iglesia 5',
      '39699',
      'CORVERA DE TORANZO',
      'cantabria',
    );
    expect(result).toBe('Calle La Iglesia 5, 39699 CORVERA DE TORANZO, cantabria');
  });

  it('handles missing street — cp+localidad+provincia only', () => {
    const result = formatPostalAddress(null, '28001', 'Madrid', 'Madrid');
    expect(result).toBe('28001 Madrid, Madrid');
  });

  it('handles missing cp — street+localidad+provincia only', () => {
    const result = formatPostalAddress('Av. Principal 10', null, 'Santander', 'Cantabria');
    expect(result).toBe('Av. Principal 10, Santander, Cantabria');
  });

  it('handles all-empty inputs — returns empty string without garbage', () => {
    const result = formatPostalAddress(null, null, null, null);
    expect(result).toBe('');
  });

  it('Case 4 — never contains [ CIUDAD ], undefined, or null literals', () => {
    const result = formatPostalAddress('Calle A', '39699', 'Ontaneda', 'Cantabria');
    expect(result).not.toContain('[ CIUDAD ]');
    expect(result).not.toContain('undefined');
    expect(result).not.toContain('null');
  });
});

// ── buildContractHTML — lugar de formalización ────────────────────────────────

const BASE_VARS: ContractVars = {
  ...defaultContractVars,
  empresa: 'Fontanería Ruiz SL',
  cif_empresa: 'B12345678',
  direccion_empresa: 'Calle Mayor 1, 39699 Ontaneda, Cantabria',
  telefono_empresa: '600 111 222',
  email_empresa: 'info@ruiz.es',
  nombre_cliente: 'Cliente Test SA',
  cif_cliente: 'A87654321',
  direccion_cliente: 'Calle La Iglesia 5, 39699 CORVERA DE TORANZO, cantabria',
  telefono_cliente: '611 222 333',
  email_cliente: 'cliente@test.com',
  referencia: 'TF-MANT-2026-0001',
  fecha_inicio: '01/09/2026',
  fecha_fin: '31/08/2027',
  cuota_mensual: '150,00',
  cuota_mensual_con_iva: '181,50',
  cuota_anual: '1.800,00',
  iban: 'ES91 2100 0418 4502 0005 1332',
};

describe('buildContractHTML — lugar de formalización', () => {
  it('Case 1 — org with localidad: renders "En Ontaneda, a 01/09/2026."', () => {
    const html = buildContractHTML({ ...BASE_VARS, ciudad_firma: 'Ontaneda' }, 'fontaneria');
    expect(html).toContain('En Ontaneda, a 01/09/2026.');
  });

  it('Case 3 — empty org localidad: renders "A 01/09/2026." without "En ,"', () => {
    const html = buildContractHTML({ ...BASE_VARS, ciudad_firma: '' }, 'fontaneria');
    expect(html).toContain('A 01/09/2026.');
    expect(html).not.toMatch(/En\s*,\s*a/);
  });

  it('Case 4 — no output contains [ CIUDAD ], undefined, or null literals', () => {
    const html1 = buildContractHTML({ ...BASE_VARS, ciudad_firma: 'Ontaneda' }, 'fontaneria');
    const html2 = buildContractHTML({ ...BASE_VARS, ciudad_firma: '' }, 'fontaneria');
    for (const html of [html1, html2]) {
      expect(html).not.toContain('[ CIUDAD ]');
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('null');
    }
  });

  it('Clause 14 with ciudad_firma populated: includes city name in jurisdiction text', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: 'Ontaneda', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales de');
    expect(html).toContain('Ontaneda');
    expect(html).not.toContain('[ CIUDAD ]');
  });

  it('Clause 14 with no city at all: jurisdiction text still has no placeholder', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: '', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).not.toContain('[ CIUDAD ]');
    expect(html).not.toContain('undefined');
  });
});

// ── buildContractHTML — Cláusula 14 jurisdiction conditional ─────────────────

describe('buildContractHTML — Cláusula 14 jurisdiction', () => {
  it('ciudad_jurisdiccion present: uses ciudad_jurisdiccion in jurisdiction text', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: 'Ontaneda', ciudad_jurisdiccion: 'Santander' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales de');
    expect(html).toContain('Santander');
    expect(html).not.toContain('de .');
  });

  it('ciudad_firma present, ciudad_jurisdiccion empty: uses ciudad_firma in jurisdiction text', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: 'ONTANEDA', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales de');
    expect(html).toContain('ONTANEDA');
    expect(html).not.toContain('de .');
  });

  it('ciudad_jurisdiccion="" AND ciudad_firma="": renders "Juzgados y Tribunales competentes" — no "de ."', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: '', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales competentes');
    expect(html).not.toContain('de .');
    expect(html).not.toContain('[ CIUDAD ]');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});

// ── buildContractHTML — prestador localidad mapping ──────────────────────────

describe('buildContractHTML — prestador localidad (pilot: ONTANEDA)', () => {
  it('localidad prestador "ONTANEDA": lugar de formalización shows "En ONTANEDA, a {fecha}."', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: 'ONTANEDA', direccion_empresa: 'Calle Mayor 1, 39699 ONTANEDA, CANTABRIA' },
      'fontaneria',
    );
    expect(html).toContain('En ONTANEDA, a 01/09/2026.');
    expect(html).not.toMatch(/En\s*,\s*a/);
  });

  it('localidad prestador "ONTANEDA": Clause 14 shows ONTANEDA', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: 'ONTANEDA', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales de');
    expect(html).toContain('ONTANEDA');
  });

  it('localidad prestador ausente: lugar de formalización shows "A {fecha}." — no "En ,"', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: '' },
      'fontaneria',
    );
    expect(html).toContain('A 01/09/2026.');
    expect(html).not.toMatch(/En\s*,\s*a/);
  });

  it('localidad prestador ausente: Clause 14 shows "competentes" — no "de ."', () => {
    const html = buildContractHTML(
      { ...BASE_VARS, ciudad_firma: '', ciudad_jurisdiccion: '' },
      'fontaneria',
    );
    expect(html).toContain('Juzgados y Tribunales competentes');
    expect(html).not.toContain('de .');
  });
});

// ── buildContractHTML — cliente dirección completa ───────────────────────────

describe('buildContractHTML — cliente dirección completa', () => {
  it('dirección cliente con cp+localidad+provincia: aparece en HTML', () => {
    const clienteDir = formatPostalAddress(
      'Calle La Iglesia 5',
      '39699',
      'CORVERA DE TORANZO',
      'cantabria',
    );
    const html = buildContractHTML(
      { ...BASE_VARS, direccion_cliente: clienteDir },
      'fontaneria',
    );
    expect(html).toContain('39699 CORVERA DE TORANZO');
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('null');
  });
});
