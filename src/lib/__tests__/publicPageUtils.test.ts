import { describe, it, expect } from 'vitest';
import { slugify, isValidSlug, requestToDescription, waNumber, defaultPreguntas, emptyPage } from '../publicPageUtils';

describe('slugify', () => {
  it('genera direcciones válidas desde nombres en español', () => {
    expect(slugify('Fontanería García')).toBe('fontaneria-garcia');
    expect(slugify('  Reformas Peña & Hijos, S.L. ')).toBe('reformas-pena-hijos-s-l');
    expect(isValidSlug(slugify('Clima Norte 24h'))).toBe(true);
  });
  it('rechaza direcciones demasiado cortas o con símbolos', () => {
    expect(isValidSlug('ab')).toBe(false);
    expect(isValidSlug('mi_empresa')).toBe(false);
    expect(isValidSlug('-mal-')).toBe(false);
  });
});

describe('requestToDescription', () => {
  it('une las respuestas para el presupuesto y la IA', () => {
    const d = requestToDescription({
      respuestas: [{ pregunta: 'Tipo de pintura', respuesta: 'Interior' }, { pregunta: 'm²', respuesta: '2 habitaciones y 2 baños' }, { pregunta: 'Vacía', respuesta: ' ' }],
      mensaje: '',
    });
    expect(d).toBe('Tipo de pintura: Interior. m²: 2 habitaciones y 2 baños');
  });
});

describe('waNumber', () => {
  it('añade el prefijo español a móviles de 9 cifras', () => {
    expect(waNumber('672 336 572')).toBe('34672336572');
    expect(waNumber('+34 672336572')).toBe('34672336572');
    expect(waNumber('0034672336572')).toBe('34672336572');
  });
});

describe('página inicial', () => {
  it('propone preguntas según el oficio y empieza desactivada', () => {
    expect(defaultPreguntas('Pintor')[0].opciones).toContain('Interior');
    const p = emptyPage('Clima Norte', 'Climatización', '600000000');
    expect(p.activa).toBe(false);
    expect(p.slug).toBe('clima-norte');
    expect(p.preguntas.length).toBeGreaterThan(0);
  });
});
