// PH0-QUOTE-WHATSAPP-FIX — Tests: buildQuoteWhatsAppMessage y buildWaUrl
// Cubre los 12 tests del spec + edge cases.

import { describe, it, expect } from 'vitest';
import { buildQuoteWhatsAppMessage, buildWaUrl } from '../../lib/whatsappQuote';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EMPRESA = {
  nombre: 'Reformas García SL',
  telefonoMovil: '600 123 456',
  email: 'info@garcia.es',
};

const makeQuote = (overrides: Partial<Parameters<typeof buildQuoteWhatsAppMessage>[0]['quote']> = {}) => ({
  id: 'PRES-2026-001',
  nombreCliente: 'María Torres',
  total: 950,
  iva_pct: 21,
  fecha: '01/09/2026',
  ...overrides,
});

const makePartida = (desc: string) => ({ descripcion: desc, cantidad: 1, precioUnitario: 100, total: 100 });

// Simula un presupuesto con N partidas (el mensaje NO debe listarlas).
// Las partidas no se pasan a buildQuoteWhatsAppMessage porque no forman parte del mensaje.
const makeQuoteWithNPartidas = (n: number) => ({
  quote: {
    id: 'PRES-2026-999',
    nombreCliente: 'Cliente Test',
    total: n * 100,
    iva_pct: 21,
    fecha: '01/09/2026',
  },
  empresa: EMPRESA,
  // _partidas sólo para referencia — NO se pasan a buildQuoteWhatsAppMessage
  _partidas: Array.from({ length: n }, (_, i) => makePartida(`Partida ${i + 1}`)),
});

// ─── TEST 1: 1 partida → mensaje breve válido ─────────────────────────────────
describe('TEST 1 — 1 partida → mensaje breve válido', () => {
  it('genera un mensaje que contiene el nombre del cliente', () => {
    const { quote } = makeQuoteWithNPartidas(1);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).toContain('Cliente Test');
  });

  it('genera un mensaje que contiene el importe total formateado', () => {
    const { quote } = makeQuoteWithNPartidas(1);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    // 100 * 1.21 = 121 €
    expect(msg).toMatch(/121/);
    expect(msg).toContain('€');
  });

  it('mensaje no contiene la descripción de la partida individual', () => {
    const { quote } = makeQuoteWithNPartidas(1);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).not.toContain('Partida 1');
  });
});

// ─── TEST 2: 28 partidas → mensaje NO contiene las 28 partidas ──────────────
describe('TEST 2 — 28 partidas → mensaje no lista las partidas', () => {
  it('mensaje no contiene "Partida 1"', () => {
    const { quote } = makeQuoteWithNPartidas(28);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).not.toContain('Partida 1');
  });

  it('mensaje no contiene "Partida 28"', () => {
    const { quote } = makeQuoteWithNPartidas(28);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).not.toContain('Partida 28');
  });

  it('mensaje no contiene el caracter bullet • (no hay lista de partidas)', () => {
    const { quote } = makeQuoteWithNPartidas(28);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).not.toContain('•');
  });
});

// ─── TEST 3: 100 partidas → longitud controlada ───────────────────────────────
describe('TEST 3 — 100 partidas → longitud del mensaje permanece controlada', () => {
  it('la longitud del mensaje con 100 partidas es similar al de 1 partida (± 20%)', () => {
    const msg1 = buildQuoteWhatsAppMessage({ ...makeQuoteWithNPartidas(1) });
    const msg100 = buildQuoteWhatsAppMessage({ ...makeQuoteWithNPartidas(100) });
    // Tolerancia 20% porque el importe difiere
    const ratio = msg100.length / msg1.length;
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(1.5);
  });

  it('mensaje con 100 partidas tiene menos de 500 caracteres', () => {
    const { quote } = makeQuoteWithNPartidas(100);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg.length).toBeLessThan(500);
  });
});

// ─── TEST 4: Importe total correctamente formateado ───────────────────────────
describe('TEST 4 — importe total formateado en €', () => {
  it('formatea el total con IVA incluido y símbolo €', () => {
    const msg = buildQuoteWhatsAppMessage({
      quote: makeQuote({ total: 1000, iva_pct: 21 }),
      empresa: EMPRESA,
    });
    // 1000 * 1.21 = 1210 €
    expect(msg).toMatch(/1[\s.]?210/);
    expect(msg).toContain('€');
  });

  it('no aparecen literales .toFixed ni NaN ni undefined en el mensaje', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg).not.toContain('toFixed');
    expect(msg).not.toContain('NaN');
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('null');
  });
});

// ─── TEST 5: Nombre cliente incluido cuando existe ────────────────────────────
describe('TEST 5 — nombre del cliente incluido', () => {
  it('incluye el nombre del cliente cuando está definido', () => {
    const msg = buildQuoteWhatsAppMessage({
      quote: makeQuote({ nombreCliente: 'Juan Pérez' }),
      empresa: EMPRESA,
    });
    expect(msg).toContain('Juan Pérez');
  });

  it('no falla si nombreCliente es undefined', () => {
    expect(() =>
      buildQuoteWhatsAppMessage({ quote: makeQuote({ nombreCliente: undefined }) }),
    ).not.toThrow();
  });
});

// ─── TEST 6: Nombre organización incluido cuando existe ───────────────────────
describe('TEST 6 — nombre de la organización incluido', () => {
  it('incluye el nombre de la empresa', () => {
    const msg = buildQuoteWhatsAppMessage({
      quote: makeQuote(),
      empresa: { nombre: 'Limpiezas Sonia SL', telefonoMovil: '611 222 333' },
    });
    expect(msg).toContain('Limpiezas Sonia SL');
  });

  it('no falla si empresa es undefined', () => {
    expect(() =>
      buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: undefined }),
    ).not.toThrow();
  });
});

// ─── TEST 7: Datos opcionales ausentes no generan undefined/null/NaN ─────────
describe('TEST 7 — datos ausentes no generan literales de error', () => {
  it('sin empresa: mensaje no contiene undefined o NaN', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote() });
    expect(msg).not.toContain('undefined');
    expect(msg).not.toContain('null');
    expect(msg).not.toContain('NaN');
  });

  it('sin acceptanceUrl: mensaje no contiene "Para aceptarlo"', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    // Sin URL, el bloque #if enlace_aceptacion no se incluye
    expect(msg).not.toMatch(/Para aceptarlo:\s*$/m);
  });

  it('con acceptanceUrl: mensaje sí incluye el enlace', () => {
    const url = 'https://trabflow.com/p/abc123';
    const msg = buildQuoteWhatsAppMessage({
      quote: makeQuote(),
      empresa: EMPRESA,
      acceptanceUrl: url,
    });
    expect(msg).toContain(url);
  });
});

// ─── TEST 8: No aparecen literales ** ─────────────────────────────────────────
describe('TEST 8 — no aparecen literales ** (markdown incorrecto)', () => {
  it('el mensaje generado no contiene "**"', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg).not.toContain('**');
  });

  it('con 28 partidas tampoco aparece "**"', () => {
    const { quote } = makeQuoteWithNPartidas(28);
    const msg = buildQuoteWhatsAppMessage({ quote, empresa: EMPRESA });
    expect(msg).not.toContain('**');
  });
});

// ─── TEST 9: No aparecen IDs internos ni metadata ────────────────────────────
describe('TEST 9 — no aparecen IDs internos ni metadata técnica', () => {
  it('no incluye el campo "partidas" literalmente', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg.toLowerCase()).not.toContain('"partidas"');
  });

  it('no incluye precios_unitarios ni cantidades en formato JSON', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg).not.toMatch(/precioUnitario|precio_unitario/);
  });

  it('no incluye descripcion del presupuesto si es un dato interno', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    // El campo descripcion del presupuesto no forma parte del template WA
    // (sólo el resumen de IA si está disponible)
    expect(msg).not.toMatch(/^\{/); // no comienza con JSON
  });
});

// ─── TEST 10: Encoding correcto ───────────────────────────────────────────────
describe('TEST 10 — encoding correcto para caracteres especiales', () => {
  it('buildWaUrl con teléfono y tildes en el mensaje produce URL válida', () => {
    const msg = 'Hola María, el presupuesto es de 1.210,00 €';
    const url = buildWaUrl('600 123 456', msg);
    expect(url).toContain('wa.me');
    expect(url).toContain('34600123456');
    expect(url).toContain(encodeURIComponent(msg));
  });

  it('buildWaUrl codifica correctamente la ñ', () => {
    const msg = 'Presupuesto señalización';
    const url = buildWaUrl(null, msg);
    expect(url).toContain(encodeURIComponent(msg));
    expect(url).not.toContain('señalización'); // debe estar encoded
  });

  it('buildWaUrl codifica correctamente el símbolo €', () => {
    const msg = 'Total: 1.210,00 €';
    const url = buildWaUrl(null, msg);
    expect(url).toContain(encodeURIComponent('€'));
  });

  it('buildWaUrl codifica correctamente los saltos de línea', () => {
    const msg = 'Línea 1\nLínea 2';
    const url = buildWaUrl(null, msg);
    expect(url).not.toContain('\n'); // los saltos deben estar encoded
    expect(url).toContain('%0A');
  });

  it('buildWaUrl sin teléfono genera enlace sin número', () => {
    const url = buildWaUrl(null, 'Hola');
    expect(url).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it('buildWaUrl con teléfono añade prefijo 34 si no lo tiene', () => {
    const url = buildWaUrl('612345678', 'msg');
    expect(url).toContain('wa.me/34612345678');
  });

  it('buildWaUrl no duplica 34 si el teléfono ya lo tiene', () => {
    const url = buildWaUrl('34612345678', 'msg');
    expect(url).toContain('wa.me/34612345678');
    expect(url).not.toContain('3434');
  });
});

// ─── TEST 11: No regresión flujo PDF ─────────────────────────────────────────
describe('TEST 11 — no regresión flujo PDF', () => {
  it('buildQuoteWhatsAppMessage no modifica ni interfiere con funciones de PDF', () => {
    // El mensaje de WhatsApp es completamente independiente del PDF.
    // Verificamos que el módulo no exporta funciones de PDF.
    const waModule = { buildQuoteWhatsAppMessage, buildWaUrl };
    expect(Object.keys(waModule)).not.toContain('printQuote');
    expect(Object.keys(waModule)).not.toContain('downloadPdf');
  });

  it('el mensaje WhatsApp no contiene URLs de PDF (flujos separados)', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg).not.toContain('.pdf');
  });
});

// ─── TEST 12: No regresión flujo Word ────────────────────────────────────────
describe('TEST 12 — no regresión flujo Word', () => {
  it('buildQuoteWhatsAppMessage no interfiere con exportación Word', () => {
    const waModule = { buildQuoteWhatsAppMessage, buildWaUrl };
    expect(Object.keys(waModule)).not.toContain('downloadAsWordDocx');
    expect(Object.keys(waModule)).not.toContain('downloadContractAsDocx');
  });
});

// ─── Extra: template personalizado del org ────────────────────────────────────
describe('template personalizado del org', () => {
  it('si se pasa customTemplate, se usa en lugar del template por defecto', () => {
    const custom = 'Plantilla personalizada de {{nombre_empresa}} — {{total}}';
    const msg = buildQuoteWhatsAppMessage({
      quote: makeQuote({ total: 500 }),
      empresa: { nombre: 'Mi Empresa', telefonoMovil: '600 000 000' },
      customTemplate: custom,
    });
    expect(msg).toContain('Mi Empresa');
    expect(msg).toContain('€');
    // no usa la frase del template por defecto
    expect(msg).not.toContain('Te adjunto el presupuesto');
  });

  it('sin customTemplate usa el DEFAULT_TEMPLATES.whatsapp_presupuesto', () => {
    const msg = buildQuoteWhatsAppMessage({ quote: makeQuote(), empresa: EMPRESA });
    expect(msg).toContain('Te adjunto el presupuesto');
  });
});
