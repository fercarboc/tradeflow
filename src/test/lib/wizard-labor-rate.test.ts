/**
 * Tests de regresión — cálculo y comportamiento de mano de obra en el wizard.
 * Verifica la lógica de tarifa, precio manual y que el stepper no sobrescribe
 * un precio ya fijado por el instalador.
 */
import { describe, it, expect } from 'vitest';

// ─── Replica mínima de handleUpdateWizardItem para pruebas aisladas ────────────
interface PartidaMinima {
  cantidad: number;
  precioUnitario: number;
  total: number;
  tipo: 'material' | 'mano_de_obra';
}

function applyUpdate(item: PartidaMinima, updates: Partial<PartidaMinima>): PartidaMinima {
  const updated = { ...item, ...updates };
  if ('cantidad' in updates || 'precioUnitario' in updates) {
    updated.total = (updated.cantidad || 0) * (updated.precioUnitario || 0);
  }
  return updated;
}

// Simula la lógica del stepper: solo inicializa tarifa si precioUnitario es 0
function stepperUpdate(
  item: PartidaMinima,
  newCantidad: number,
  tarifaConfigurada: number
): Partial<PartidaMinima> {
  return {
    cantidad: newCantidad,
    ...(item.precioUnitario === 0 ? { precioUnitario: tarifaConfigurada } : {}),
  };
}

// ─── Cálculo básico ────────────────────────────────────────────────────────────
describe('cálculo de total mano de obra', () => {
  it('total = cantidad × precioUnitario', () => {
    const item: PartidaMinima = { cantidad: 20, precioUnitario: 7.5, total: 0, tipo: 'mano_de_obra' };
    const result = applyUpdate(item, { precioUnitario: 7.5 });
    expect(result.total).toBe(150);
  });

  it('total = 0 cuando precioUnitario es 0', () => {
    const item: PartidaMinima = { cantidad: 20, precioUnitario: 0, total: 0, tipo: 'mano_de_obra' };
    const result = applyUpdate(item, { cantidad: 20 });
    expect(result.total).toBe(0);
  });

  it('total se recalcula al cambiar cantidad', () => {
    const item: PartidaMinima = { cantidad: 10, precioUnitario: 52, total: 520, tipo: 'mano_de_obra' };
    const result = applyUpdate(item, { cantidad: 15 });
    expect(result.total).toBe(780);
  });

  it('total se recalcula al cambiar precioUnitario', () => {
    const item: PartidaMinima = { cantidad: 20, precioUnitario: 52, total: 1040, tipo: 'mano_de_obra' };
    const result = applyUpdate(item, { precioUnitario: 7.5 });
    expect(result.total).toBe(150);
  });
});

// ─── Comportamiento del stepper ────────────────────────────────────────────────
describe('stepper inicializa tarifa solo si no hay precio fijado', () => {
  const TARIFA_CONFIGURADA = 52;

  it('si precioUnitario es 0, el stepper inicializa con la tarifa configurada', () => {
    const item: PartidaMinima = { cantidad: 5, precioUnitario: 0, total: 0, tipo: 'mano_de_obra' };
    const updates = stepperUpdate(item, 6, TARIFA_CONFIGURADA);
    expect(updates.precioUnitario).toBe(TARIFA_CONFIGURADA);
    const result = applyUpdate(item, updates);
    expect(result.total).toBe(6 * TARIFA_CONFIGURADA);
  });

  it('si precioUnitario ya tiene valor, el stepper NO lo sobrescribe', () => {
    const item: PartidaMinima = { cantidad: 20, precioUnitario: 7.5, total: 150, tipo: 'mano_de_obra' };
    const updates = stepperUpdate(item, 21, TARIFA_CONFIGURADA);
    expect(updates.precioUnitario).toBeUndefined();
    const result = applyUpdate(item, updates);
    // El precio sigue siendo el manual: 21 × 7.5 = 157.5
    expect(result.precioUnitario).toBe(7.5);
    expect(result.total).toBe(157.5);
  });

  it('precio manual no se pierde tras varios incrementos del stepper', () => {
    const PRECIO_MANUAL = 35;
    let item: PartidaMinima = { cantidad: 10, precioUnitario: PRECIO_MANUAL, total: 350, tipo: 'mano_de_obra' };
    // Simular 3 incrementos del stepper
    for (let h = 11; h <= 13; h++) {
      const updates = stepperUpdate(item, h, TARIFA_CONFIGURADA);
      item = applyUpdate(item, updates);
    }
    expect(item.precioUnitario).toBe(PRECIO_MANUAL);
    expect(item.total).toBe(13 * PRECIO_MANUAL);
  });
});

// ─── Label de tarifa activa ────────────────────────────────────────────────────
describe('lógica del label de tarifa activa', () => {
  const TARIFA_CONFIGURADA = 52;

  function getActiveLabelRate(precioUnitario: number, tarifaConfigurada: number): number {
    // Replica la expresión: part.precioUnitario > 0 ? part.precioUnitario : valorHoraOperario
    return precioUnitario > 0 ? precioUnitario : tarifaConfigurada;
  }

  it('muestra tarifa manual cuando precioUnitario > 0', () => {
    expect(getActiveLabelRate(7.5, TARIFA_CONFIGURADA)).toBe(7.5);
  });

  it('muestra tarifa configurada cuando precioUnitario es 0', () => {
    expect(getActiveLabelRate(0, TARIFA_CONFIGURADA)).toBe(TARIFA_CONFIGURADA);
  });

  it('label refleja el precio real que genera el total', () => {
    const precioManual = 35;
    const item: PartidaMinima = { cantidad: 8, precioUnitario: precioManual, total: 280, tipo: 'mano_de_obra' };
    const labelRate = getActiveLabelRate(item.precioUnitario, TARIFA_CONFIGURADA);
    expect(labelRate * item.cantidad).toBe(item.total);
  });
});

// ─── Selección de proveedor: no sobreescribir precio existente ─────────────────
describe('selección de proveedor en paso 4', () => {
  function applySupplierSelection(
    item: PartidaMinima & { precioCoste?: number },
    opt: { precio_venta: number; precio_coste: number }
  ): PartidaMinima & { precioCoste?: number } {
    // Replica la lógica: solo asigna precioUnitario si no hay precio aún
    const updates: Partial<PartidaMinima & { precioCoste?: number }> = {
      ...(item.precioUnitario === 0 ? { precioUnitario: opt.precio_venta } : {}),
      precioCoste: opt.precio_coste,
    };
    return { ...applyUpdate(item, updates), precioCoste: opt.precio_coste };
  }

  it('si no hay precio, usa el precio de venta del proveedor como punto de partida', () => {
    const item = { cantidad: 5, precioUnitario: 0, total: 0, tipo: 'material' as const };
    const opt = { precio_venta: 120, precio_coste: 80 };
    const result = applySupplierSelection(item, opt);
    expect(result.precioUnitario).toBe(120);
    expect(result.precioCoste).toBe(80);
    expect(result.total).toBe(600);
  });

  it('si ya hay precio fijado, NO lo sobrescribe al seleccionar proveedor', () => {
    const item = { cantidad: 5, precioUnitario: 150, total: 750, tipo: 'material' as const };
    const opt = { precio_venta: 120, precio_coste: 80 };
    const result = applySupplierSelection(item, opt);
    expect(result.precioUnitario).toBe(150); // precio del instalador preservado
    expect(result.precioCoste).toBe(80);     // coste registrado
    expect(result.total).toBe(750);          // total sin cambios
  });

  it('precio de coste siempre se registra, independientemente de si hay precio fijado', () => {
    const itemConPrecio = { cantidad: 3, precioUnitario: 200, total: 600, tipo: 'material' as const };
    const itemSinPrecio = { cantidad: 3, precioUnitario: 0, total: 0, tipo: 'material' as const };
    const opt = { precio_venta: 180, precio_coste: 95 };

    expect(applySupplierSelection(itemConPrecio, opt).precioCoste).toBe(95);
    expect(applySupplierSelection(itemSinPrecio, opt).precioCoste).toBe(95);
  });

  it('el margen del instalador queda implícito cuando hay precioCoste y precioUnitario distintos', () => {
    const item = { cantidad: 2, precioUnitario: 250, total: 500, tipo: 'material' as const };
    const opt = { precio_venta: 200, precio_coste: 130 };
    const result = applySupplierSelection(item, opt);
    const margenImplicito = result.precioUnitario - (result.precioCoste ?? 0);
    expect(margenImplicito).toBe(120); // 250 - 130
    expect(margenImplicito).toBeGreaterThan(0);
  });
});
