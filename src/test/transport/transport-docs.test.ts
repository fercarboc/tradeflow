/**
 * TX-DOCS-1 — Validaciones de documentos de control (DeCA / hoja de ruta).
 * Mismas reglas que la Edge Function trade-transport-doc.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({ supabase: {} }));

import {
  isValidSpanishNif, isValidNif, normalizeNif, isValidPlate, normalizePlate,
  fmtFechaEs, publicDocUrl, isPublicLinkActive, shareText,
} from '../../lib/transportDocs';

describe('NIF / NIE / CIF', () => {
  it('acepta DNI con letra correcta y rechaza letra incorrecta', () => {
    expect(isValidSpanishNif('12345678Z')).toBe(true);
    expect(isValidSpanishNif('12345678A')).toBe(false);
  });
  it('acepta NIE', () => {
    expect(isValidSpanishNif('X1234567L')).toBe(true);
    expect(isValidSpanishNif('X1234567A')).toBe(false);
  });
  it('acepta CIF de sociedad con dígito de control', () => {
    expect(isValidSpanishNif('A28425270')).toBe(true);   // CIF con control numérico
    expect(isValidSpanishNif('B12345674')).toBe(true);
    expect(isValidSpanishNif('B12345675')).toBe(false);
  });
  it('acepta CIF de entidad con letra de control (P, Q, R, S…)', () => {
    expect(isValidSpanishNif('Q2826000H')).toBe(true);
  });
  it('normaliza espacios, puntos y guiones', () => {
    expect(normalizeNif(' 12.345.678-z ')).toBe('12345678Z');
    expect(isValidNif('12.345.678-z')).toBe(true);
  });
  it('acepta NIF extranjero con prefijo de país', () => {
    expect(isValidNif('PT501964843')).toBe(true);
    expect(isValidNif('ES12345678Z')).toBe(true);
    expect(isValidNif('ES12345678A')).toBe(false);
  });
});

describe('Matrículas', () => {
  it('normaliza y valida', () => {
    expect(normalizePlate('8241 mjr')).toBe('8241MJR');
    expect(isValidPlate('8241 MJR')).toBe(true);
    expect(isValidPlate('R-1234-BCD')).toBe(true);
    expect(isValidPlate('12')).toBe(false);
    expect(isValidPlate('')).toBe(false);
  });
});

describe('Presentación y enlace público', () => {
  it('formatea fecha española', () => {
    expect(fmtFechaEs('2026-11-12')).toBe('12/11/2026');
  });
  it('construye URL pública https', () => {
    expect(publicDocUrl('abc123')).toMatch(/^https:\/\/.+\/abc123$/);
  });
  it('enlace activo solo si vigente y no caducado', () => {
    const futuro = new Date(Date.now() + 3600_000).toISOString();
    const pasado = new Date(Date.now() - 3600_000).toISOString();
    expect(isPublicLinkActive({ estado: 'vigente', public_hasta: futuro })).toBe(true);
    expect(isPublicLinkActive({ estado: 'vigente', public_hasta: pasado })).toBe(false);
    expect(isPublicLinkActive({ estado: 'anulado', public_hasta: futuro })).toBe(false);
    expect(isPublicLinkActive({ estado: 'sustituido', public_hasta: futuro })).toBe(false);
  });
  it('texto para compartir incluye número, ruta y enlace', () => {
    const t = shareText({ tipo: 'deca', numero: 'DECA-2026-000001', origen: 'Santander', destino: 'Burgos', fecha_servicio: '2026-11-12', matricula_vehiculo: '8241MJR', public_token: 'tok' });
    expect(t).toContain('DeCA DECA-2026-000001');
    expect(t).toContain('Santander → Burgos');
    expect(t).toContain('/tok');
  });
});

import { qrToUrl } from '../../lib/transportReceivedDocs';

describe('Documentos recibidos — lectura del QR', () => {
  it('acepta solo enlaces https', () => {
    expect(qrToUrl('https://lavyqo.com/d/abc')).toBe('https://lavyqo.com/d/abc');
    expect(qrToUrl('  https://x.es/d/1  ')).toBe('https://x.es/d/1');
    expect(qrToUrl('http://x.es/d/1')).toBeNull();
    expect(qrToUrl('DECA-2026-000001')).toBeNull();
    expect(qrToUrl(null)).toBeNull();
  });
});

import { shipmentPrefillFromExtracted } from '../../lib/transportReceivedDocs';

describe('DeCA recibido → expedición', () => {
  const datos = {
    tipo_documento: 'deca' as const, numero: 'DECA-77', fecha_transporte: '2026-11-12', hora_salida: '07:30',
    cargador_nombre: 'Carrefour España S.A.', cargador_nif: 'a-28425270', cargador_domicilio: 'Calle Campezo 16, Madrid',
    origen: 'Santander', destino: 'Burgos', paradas: ['Ontaneda', 'El Escudo'], naturaleza_mercancia: 'Material de obra',
    peso_kg: 15500, confianza: 'alta' as const, campos_dudosos: [],
  };
  it('rellena la expedición y vincula el cliente por NIF', () => {
    const p = shipmentPrefillFromExtracted(datos, [{ id: 'c1', nif: 'A28425270' }]);
    expect(p.client_id).toBe('c1');
    expect(p.cargador_nif).toBe('A28425270');
    expect(p.fecha_recogida).toBe('2026-11-12');
    expect(p.hora_recogida).toBe('07:30');
    expect(p.peso_kg).toBe(15500);
    expect(p.referencia_cargador).toBe('DECA-77');
    expect(p.observaciones).toContain('Ontaneda → El Escudo');
  });
  it('descarta fechas u horas mal formadas y no inventa cliente', () => {
    const p = shipmentPrefillFromExtracted({ ...datos, fecha_transporte: '12/11/2026', hora_salida: '25:99' }, []);
    expect(p.fecha_recogida).toBeNull();
    expect(p.hora_recogida).toBeNull();
    expect(p.client_id).toBeNull();
  });
});
