/**
 * Tests unitarios — propuesta de partidas de limpieza.
 * Sin LLM, sin red. Los precios siempre son 0 (el profesional los fija).
 */
import { describe, it, expect } from 'vitest';
import { proposeLineItems } from '../../lib/cleaning/cleaningLineItems';
import { parseCleaningIntake } from '../../lib/cleaning/cleaningIntake';

// ─── Sin precios universales ──────────────────────────────────────────────────
describe('no universal prices', () => {
  it('todas las partidas propuestas tienen precioUnitario = 0', () => {
    const intake = parseCleaningIntake('Limpieza integral de vivienda dos habitaciones dos baños');
    const items = proposeLineItems(intake);
    expect(items.length).toBeGreaterThan(0);
    items.forEach(item => {
      expect(item.precioUnitario).toBe(0);
      expect(item.total).toBe(0);
      expect(item.requiere_revision).toBe(true);
    });
  });

  it('No se aplica tarifa de 20€/h automáticamente', () => {
    const intake = { spaceType: 'vivienda' as const, serviceType: 'limpieza_integral' as const };
    const items = proposeLineItems(intake);
    items.forEach(item => {
      expect(item.precioUnitario).toBe(0);
    });
  });
});

// ─── Vivienda ─────────────────────────────────────────────────────────────────
describe('proposeLineItems — vivienda', () => {
  it('propone partidas generales para vivienda', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'limpieza_integral' });
    const ids = items.map(i => i.id);
    expect(ids).toContain('general_barrer_fregar');
    expect(ids).toContain('general_polvo');
    expect(ids).toContain('salon_integral');
  });

  it('propone cocina si hay vivienda (no vacío)', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', furnishingState: 'amueblado' });
    expect(items.some(i => i.id === 'cocina_muebles_ext')).toBe(true);
  });

  it('NO propone cocina interior si está vacía', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', furnishingState: 'vacio' });
    expect(items.some(i => i.id === 'cocina_muebles_ext')).toBe(false);
  });

  it('propone baños con cantidad = número de baños', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', bathrooms: 2 });
    const bano = items.find(i => i.id === 'bano_integral');
    expect(bano).toBeDefined();
    expect(bano?.cantidad).toBe(2);
  });
});

// ─── Oficina ─────────────────────────────────────────────────────────────────
describe('proposeLineItems — oficina', () => {
  it('propone puestos de trabajo para oficina', () => {
    const items = proposeLineItems({ spaceType: 'oficina', serviceType: 'puntual' });
    expect(items.some(i => i.id === 'ofic_puestos')).toBe(true);
  });

  it('propone office para oficina', () => {
    const items = proposeLineItems({ spaceType: 'oficina' });
    expect(items.some(i => i.id === 'ofic_office')).toBe(true);
  });

  it('propone cristales si está marcado', () => {
    const items = proposeLineItems({ spaceType: 'oficina', windows: true });
    expect(items.some(i => i.id === 'cristales_ventanas')).toBe(true);
  });

  it('propone papeleras solo para servicio recurrente', () => {
    const recurrente = proposeLineItems({ spaceType: 'oficina', recurrence: 'recurring' });
    const puntual = proposeLineItems({ spaceType: 'oficina', recurrence: 'one_off' });
    expect(recurrente.some(i => i.id === 'ofic_papeleras')).toBe(true);
    expect(puntual.some(i => i.id === 'ofic_papeleras')).toBe(false);
  });
});

// ─── Comunidad ────────────────────────────────────────────────────────────────
describe('proposeLineItems — comunidad', () => {
  it('propone portal y escaleras para comunidad', () => {
    const items = proposeLineItems({ spaceType: 'comunidad' });
    const ids = items.map(i => i.id);
    expect(ids).toContain('com_portal');
    expect(ids).toContain('com_escaleras');
  });

  it('propone ascensor solo si hay ascensores', () => {
    const conAscensor = proposeLineItems({ spaceType: 'comunidad', elevators: 1 });
    const sinAscensor = proposeLineItems({ spaceType: 'comunidad' });
    expect(conAscensor.some(i => i.id === 'com_ascensor')).toBe(true);
    expect(sinAscensor.some(i => i.id === 'com_ascensor')).toBe(false);
  });

  it('propone garaje comunitario solo si está indicado', () => {
    const conGaraje = proposeLineItems({ spaceType: 'comunidad', garage: true });
    const sinGaraje = proposeLineItems({ spaceType: 'comunidad' });
    expect(conGaraje.some(i => i.id === 'com_garaje')).toBe(true);
    expect(sinGaraje.some(i => i.id === 'com_garaje')).toBe(false);
  });
});

// ─── Local comercial ──────────────────────────────────────────────────────────
describe('proposeLineItems — local_comercial', () => {
  it('propone escaparate para local con escaparate', () => {
    const items = proposeLineItems({ spaceType: 'local_comercial', escaparates: true });
    expect(items.some(i => i.id === 'cristales_escaparate')).toBe(true);
  });

  it('propone baños si los hay', () => {
    const items = proposeLineItems({ spaceType: 'local_comercial', bathrooms: 2 });
    const bano = items.find(i => i.id === 'bano_integral');
    expect(bano?.cantidad).toBe(2);
  });
});

// ─── Fin de obra ──────────────────────────────────────────────────────────────
describe('proposeLineItems — fin_de_obra', () => {
  it('propone partidas específicas de fin de obra', () => {
    const items = proposeLineItems({ spaceType: 'local_comercial', serviceType: 'fin_de_obra', recurrence: 'one_off' });
    const ids = items.map(i => i.id);
    expect(ids).toContain('fo_polvo_obra');
    expect(ids).toContain('fo_suelos');
    expect(ids).toContain('fo_limpieza_final');
  });

  it('incluye cristales en fin de obra', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'fin_de_obra' });
    expect(items.some(i => i.id === 'cristales_ventanas')).toBe(true);
  });

  it('NO incluye mobiliario instalado si está vacío', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'fin_de_obra', furnishingState: 'vacio' });
    expect(items.some(i => i.id === 'fo_mobiliario_instalado')).toBe(false);
  });
});

// ─── Recurrente ───────────────────────────────────────────────────────────────
describe('proposeLineItems — recurring', () => {
  it('propone servicio mensual para oficina recurrente', () => {
    const items = proposeLineItems({ spaceType: 'oficina', recurrence: 'recurring' });
    expect(items.some(i => i.id === 'rec_servicio_mensual')).toBe(true);
  });

  it('NO propone servicio mensual para puntual', () => {
    const items = proposeLineItems({ spaceType: 'oficina', recurrence: 'one_off' });
    expect(items.some(i => i.id === 'rec_servicio_mensual')).toBe(false);
  });
});

// ─── Inclusión / exclusión / edición de partidas propuestas ──────────────────
describe('professional edits proposed items', () => {
  it('las partidas propuestas son mutables (no congeladas)', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'limpieza_integral' });
    expect(() => {
      // El profesional puede cambiar cantidad y descripción
      const item = items[0];
      (item as any).cantidad = 3;
      (item as any).descripcion = 'Modificado por profesional';
    }).not.toThrow();
  });

  it('se pueden filtrar partidas (simulando exclusión por parte del profesional)', () => {
    const items = proposeLineItems({ spaceType: 'vivienda', serviceType: 'limpieza_integral', bathrooms: 2 });
    const sinBanos = items.filter(i => !i.id.startsWith('bano_'));
    expect(sinBanos.some(i => i.id.startsWith('bano_'))).toBe(false);
    expect(sinBanos.length).toBeGreaterThan(0);
  });

  it('se pueden añadir partidas adicionales', () => {
    const items = proposeLineItems({ spaceType: 'vivienda' });
    const extra = {
      id: 'custom_1',
      categoria: 'Personalizado',
      descripcion: 'Limpieza de trastero',
      unidad: 'hora' as const,
      tipo: 'mano_de_obra' as const,
      cantidad: 2,
      precioUnitario: 0 as const,
      total: 0 as const,
      requiere_revision: true as const,
    };
    const combined = [...items, extra];
    expect(combined.some(i => i.id === 'custom_1')).toBe(true);
  });
});

// ─── Casos de aceptación con propuesta ───────────────────────────────────────
describe('acceptance cases with line items', () => {
  it('CASO A — local fin de obra 45m: propone partidas de fin de obra', () => {
    const intake = parseCleaningIntake('Limpieza de local de 45 metros fin de obra');
    const items = proposeLineItems(intake);
    expect(items.some(i => i.id === 'fo_polvo_obra')).toBe(true);
    expect(items.some(i => i.id === 'fo_suelos')).toBe(true);
    items.forEach(i => expect(i.precioUnitario).toBe(0));
  });

  it('CASO D — comunidad recurrente: propone portal, escaleras', () => {
    const intake = parseCleaningIntake('Limpieza de comunidad dos veces por semana, cinco plantas, un ascensor y garaje una vez al mes');
    const items = proposeLineItems(intake);
    const ids = items.map(i => i.id);
    expect(ids).toContain('com_portal');
    expect(ids).toContain('com_escaleras');
    expect(ids).toContain('com_ascensor');
    expect(ids).toContain('com_garaje');
  });

  it('CASO E — local 80m puntual: propone partidas generales + baños', () => {
    const intake = parseCleaningIntake('Local de 80 metros, limpieza puntual, dos baños, escaparate, vamos dos personas unas cuatro horas');
    const items = proposeLineItems(intake);
    expect(items.some(i => i.id === 'cristales_escaparate')).toBe(true);
    const bano = items.find(i => i.id === 'bano_integral');
    expect(bano?.cantidad).toBe(2);
    items.forEach(i => expect(i.precioUnitario).toBe(0));
  });

  it('CASO F — vivienda integral sin muebles: propone cristales, persianas, NO muebles ext', () => {
    const intake = parseCleaningIntake(
      'Limpieza integral de vivienda con dos habitaciones, dos baños, salón y terraza. Hay que limpiar ventanas, persianas, muebles de cocina, baños y el resto de la vivienda. Está prácticamente sin muebles.'
    );
    const items = proposeLineItems(intake);
    expect(items.some(i => i.id === 'cristales_ventanas')).toBe(true);
    expect(items.some(i => i.id === 'cristales_persianas')).toBe(true);
    expect(items.some(i => i.id === 'terraza_barrido')).toBe(true);
    // Sin muebles → no debe proponer limpieza exterior de muebles
    expect(items.some(i => i.id === 'cocina_muebles_ext')).toBe(false);
    items.forEach(i => expect(i.precioUnitario).toBe(0));
  });
});
