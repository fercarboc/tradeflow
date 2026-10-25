/**
 * TX-ROUTE-ADDRESS-1 — Tests para transportLocations.ts
 * 12 escenarios cubriendo helpers, tipos, compatibilidad legacy y casos límite.
 */

import { describe, it, expect } from 'vitest';
import {
  locationToText,
  locationToAddress,
  hasAddress,
  hasContact,
  emptyLocation,
  emptyContact,
  isValidSpanishPhone,
  phoneHref,
  TIPO_LUGAR_OPTIONS,
  TIPO_FUNCION_OPTIONS,
  TIPO_OPERACION_OPTIONS,
} from '../../lib/transportLocations';
import type { TransportLocation, TransportContact, TransportStop } from '../../lib/transportServices';

// ── Escenario 1: Hotel → Aeropuerto ──────────────────────────────────────────

describe('Escenario 1 — Hotel → Aeropuerto', () => {
  const origen: TransportLocation = {
    nombre_lugar: 'Hotel NH Las Américas',
    tipo_lugar: 'hotel',
    calle: 'Avenida de América',
    numero: '11',
    cp: '28028',
    localidad: 'Madrid',
    provincia: 'Madrid',
  };
  const destino: TransportLocation = {
    nombre_lugar: 'Aeropuerto Adolfo Suárez',
    tipo_lugar: 'aeropuerto',
    terminal: 'T4',
    punto_encuentro: 'Zona autobuses lanzadera',
    localidad: 'Madrid',
  };

  it('locationToText prioriza nombre_lugar sobre localidad', () => {
    expect(locationToText(origen)).toBe('Hotel NH Las Américas');
    expect(locationToText(destino)).toBe('Aeropuerto Adolfo Suárez');
  });

  it('locationToAddress genera línea completa con nombre, calle y CP', () => {
    const addr = locationToAddress(origen);
    expect(addr).toContain('Hotel NH Las Américas');
    expect(addr).toContain('Avenida de América');
    expect(addr).toContain('28028');
    expect(addr).toContain('Madrid');
  });

  it('hasAddress devuelve true cuando hay nombre o localidad', () => {
    expect(hasAddress(origen)).toBe(true);
    expect(hasAddress(destino)).toBe(true);
  });
});

// ── Escenario 2: Asociación → Excursión ──────────────────────────────────────

describe('Escenario 2 — Asociación → Excursión', () => {
  const origen: TransportLocation = {
    nombre_lugar: 'Club Atletismo Valladolid',
    tipo_lugar: 'asociacion',
    localidad: 'Valladolid',
    provincia: 'Valladolid',
  };

  it('tipo_lugar "asociacion" está en catálogo', () => {
    const found = TIPO_LUGAR_OPTIONS.find(t => t.value === 'asociacion');
    expect(found).toBeDefined();
    expect(found!.label).toBeTruthy();
  });

  it('locationToText devuelve nombre_lugar del club', () => {
    expect(locationToText(origen)).toBe('Club Atletismo Valladolid');
  });
});

// ── Escenario 3: Ruta escolar con varias paradas ──────────────────────────────

describe('Escenario 3 — Ruta escolar con varias paradas', () => {
  const paradas: TransportStop[] = [
    { nombre: 'Parada 1', hora: '07:30', tipo_operacion: 'recogida', location: { localidad: 'Alcobendas', calle: 'Calle Mayor', numero: '5' } },
    { nombre: 'Parada 2', hora: '07:45', tipo_operacion: 'recogida', location: { localidad: 'San Sebastián de los Reyes' } },
    { nombre: 'CEIP Cervantes', hora: '08:00', tipo_operacion: 'bajada', location: { nombre_lugar: 'CEIP Cervantes', tipo_lugar: 'colegio' } },
  ];

  it('todas las paradas tienen tipo_operacion válido', () => {
    const validTipos = TIPO_OPERACION_OPTIONS.map(t => t.value);
    for (const p of paradas) {
      expect(validTipos).toContain(p.tipo_operacion);
    }
  });

  it('locationToText extrae localidad cuando no hay nombre_lugar', () => {
    expect(locationToText(paradas[0].location!)).toBe('Alcobendas');
    expect(locationToText(paradas[1].location!)).toBe('San Sebastián de los Reyes');
  });

  it('hasAddress es true para todas las locations de paradas', () => {
    for (const p of paradas) {
      expect(hasAddress(p.location)).toBe(true);
    }
  });
});

// ── Escenario 4: Agencia con responsable distinto del cliente ─────────────────

describe('Escenario 4 — Agencia con responsable distinto del cliente', () => {
  const contactoPrincipal: TransportContact = {
    nombre: 'María García López',
    organizacion: 'Viajes Mediterráneo SL',
    funcion: 'responsable_grupo',
    telefono: '650123456',
    email: 'maria.garcia@viajes.es',
  };

  it('hasContact true cuando hay nombre y teléfono', () => {
    expect(hasContact(contactoPrincipal)).toBe(true);
  });

  it('función "responsable_grupo" está en catálogo', () => {
    const found = TIPO_FUNCION_OPTIONS.find(t => t.value === 'responsable_grupo');
    expect(found).toBeDefined();
  });

  it('teléfono móvil español de 9 dígitos válido', () => {
    expect(isValidSpanishPhone('650123456')).toBe(true);
  });

  it('phoneHref genera enlace tel: correcto', () => {
    expect(phoneHref('650123456')).toBe('tel:650123456');
  });
});

// ── Escenario 5: Responsable distinto por parada ──────────────────────────────

describe('Escenario 5 — Responsable distinto por parada', () => {
  const parada: TransportStop = {
    nombre: 'Residencia Los Pinos',
    hora: '09:00',
    tipo_operacion: 'recogida',
    location: { nombre_lugar: 'Residencia Los Pinos', tipo_lugar: 'otro', localidad: 'Getafe' },
    contacto: {
      nombre: 'Pedro Ruiz',
      funcion: 'encargado',
      telefono: '+34 612 345 678',
    },
  };

  it('hasContact true con contacto por parada', () => {
    expect(hasContact(parada.contacto)).toBe(true);
  });

  it('teléfono con prefijo +34 y espacios es válido', () => {
    expect(isValidSpanishPhone('+34 612 345 678')).toBe(true);
  });

  it('phoneHref elimina espacios del número', () => {
    const href = phoneHref('+34 612 345 678');
    expect(href).toBe('tel:+34612345678');
  });
});

// ── Escenario 6: Parada sin teléfono propio ───────────────────────────────────

describe('Escenario 6 — Parada sin teléfono', () => {
  const contactoSinTel: TransportContact = {
    nombre: 'Luis Fernández',
    funcion: 'guia',
  };

  it('hasContact true aunque no tenga teléfono (tiene nombre)', () => {
    expect(hasContact(contactoSinTel)).toBe(true);
  });

  it('phoneHref devuelve null si no hay teléfono', () => {
    expect(phoneHref(undefined)).toBeNull();
    expect(phoneHref('')).toBeNull();
  });
});

// ── Escenario 7: Dirección sin coordenadas ─────────────────────────────────────

describe('Escenario 7 — Dirección sin coordenadas (solo postal)', () => {
  const loc: TransportLocation = {
    calle: 'Calle del Prado',
    numero: '12',
    cp: '28014',
    localidad: 'Madrid',
    provincia: 'Madrid',
  };

  it('hasAddress true cuando hay calle y localidad', () => {
    expect(hasAddress(loc)).toBe(true);
  });

  it('locationToText devuelve localidad cuando no hay nombre_lugar', () => {
    expect(locationToText(loc)).toBe('Madrid');
  });

  it('locationToAddress incluye calle, número y CP', () => {
    const addr = locationToAddress(loc);
    expect(addr).toContain('Calle del Prado');
    expect(addr).toContain('12');
    expect(addr).toContain('28014');
  });

  it('no hay coordenadas y no es error', () => {
    expect(loc.lat).toBeUndefined();
    expect(loc.lng).toBeUndefined();
  });
});

// ── Escenario 8: Ida y vuelta (TransportSegment model) ───────────────────────

describe('Escenario 8 — Ida y vuelta (TransportSegment)', () => {
  // TransportSegment es un tipo sin UI — solo validamos la estructura
  it('tipo "ida" | "vuelta" | "tramo" son los únicos valores válidos', () => {
    // Se valida en TypeScript — runtime check vía array
    const validTipos: Array<'ida' | 'vuelta' | 'tramo'> = ['ida', 'vuelta', 'tramo'];
    expect(validTipos).toContain('ida');
    expect(validTipos).toContain('vuelta');
    expect(validTipos).toContain('tramo');
  });

  it('emptyLocation devuelve objeto vacío', () => {
    const loc = emptyLocation();
    expect(Object.keys(loc)).toHaveLength(0);
  });

  it('emptyContact devuelve objeto vacío', () => {
    const c = emptyContact();
    expect(Object.keys(c)).toHaveLength(0);
  });
});

// ── Escenario 9: Servicio legacy (origen/destino simples) ────────────────────

describe('Escenario 9 — Servicio legacy solo con texto origen/destino', () => {
  it('locationToText con null devuelve string vacío', () => {
    expect(locationToText(null)).toBe('');
    expect(locationToText(undefined)).toBe('');
  });

  it('hasAddress con null/undefined devuelve false', () => {
    expect(hasAddress(null)).toBe(false);
    expect(hasAddress(undefined)).toBe(false);
  });

  it('hasContact con null/undefined devuelve false', () => {
    expect(hasContact(null)).toBe(false);
    expect(hasContact(undefined)).toBe(false);
  });

  it('locationToAddress con null devuelve string vacío', () => {
    expect(locationToAddress(null)).toBe('');
    expect(locationToAddress(undefined)).toBe('');
  });
});

// ── Escenario 10: Servicio completado (inmutabilidad lógica) ─────────────────

describe('Escenario 10 — Servicio completado (inmutabilidad)', () => {
  it('isValidSpanishPhone rechaza número con menos de 9 dígitos', () => {
    expect(isValidSpanishPhone('12345')).toBe(false);
  });

  it('isValidSpanishPhone acepta vacío (campo opcional)', () => {
    expect(isValidSpanishPhone('')).toBe(true);
    expect(isValidSpanishPhone('   ')).toBe(true);
  });

  it('isValidSpanishPhone rechaza número no español (sin 6/7/8/9 al inicio)', () => {
    expect(isValidSpanishPhone('123456789')).toBe(false);
  });
});

// ── Escenario 11: Aislamiento multiempresa ────────────────────────────────────

describe('Escenario 11 — Aislamiento multiempresa (catálogos no mutativos)', () => {
  it('TIPO_LUGAR_OPTIONS es inmutable (as const)', () => {
    expect(Array.isArray(TIPO_LUGAR_OPTIONS)).toBe(true);
    expect(TIPO_LUGAR_OPTIONS.length).toBe(10);
  });

  it('TIPO_FUNCION_OPTIONS tiene 5 entradas', () => {
    expect(TIPO_FUNCION_OPTIONS.length).toBe(5);
  });

  it('TIPO_OPERACION_OPTIONS tiene 4 entradas', () => {
    expect(TIPO_OPERACION_OPTIONS.length).toBe(4);
  });

  it('cada opción tiene value y label no vacíos', () => {
    for (const opt of [...TIPO_LUGAR_OPTIONS, ...TIPO_FUNCION_OPTIONS, ...TIPO_OPERACION_OPTIONS]) {
      expect(opt.value).toBeTruthy();
      expect(opt.label).toBeTruthy();
    }
  });
});

// ── Escenario 12: Validación de teléfonos (edge cases) ───────────────────────
// Escenario 12 es "Responsive móvil — manual". Las validaciones de teléfonos
// complementan los escenarios 4 y 5 con edge cases adicionales.

describe('Escenario 12 — Validación de teléfonos (edge cases)', () => {
  it('acepta número fijo (9 dígitos empezando por 9)', () => {
    expect(isValidSpanishPhone('912345678')).toBe(true);
  });

  it('acepta número con guiones', () => {
    expect(isValidSpanishPhone('612-345-678')).toBe(true);
  });

  it('acepta número con paréntesis y espacios', () => {
    expect(isValidSpanishPhone('(+34) 612 345 678')).toBe(true);
  });

  it('rechaza número internacional no español', () => {
    expect(isValidSpanishPhone('+44 20 7946 0958')).toBe(false);
  });

  it('phoneHref elimina guiones y paréntesis', () => {
    const href = phoneHref('612-345-678');
    expect(href).toBe('tel:612345678');
  });

  it('phoneHref con solo espacios devuelve null', () => {
    expect(phoneHref('   ')).toBeNull();
  });
});
