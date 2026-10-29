import { describe, it, expect } from 'vitest';
import {
  estimateTripCost,
  computeMargin,
  priceFromMargin,
  validateTripInput,
  missingRateFields,
  TripInput,
} from '../../lib/transportCostEngine';
import { TransportRates, DEFAULT_TRANSPORT_RATES } from '../../lib/transportRates';

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseRates: TransportRates = {
  ...DEFAULT_TRANSPORT_RATES,
  coste_km_comercial: 1.20,
  coste_km_vacio: 0.80,
  coste_conductor_hora: 15.0,
  coste_conductor_hora_extra: 22.5,
  dieta_conductor_dia: 25.0,
  alojamiento_conductor_noche: 80.0,
  coste_vehiculo_dia: 50.0,
  overhead_pct: 10,
  margin_pct: 20,
};

const oneDay: TripInput = {
  legs: [{ km_comercial: 200, horas: 4, km_vacio: 20 }],
  num_conductores: 1,
};

// ── CE-1: Excursión de 1 día ─────────────────────────────────────────────────

describe('CE-1: excursión 1 día, 1 conductor', () => {
  it('calcula km comerciales', () => {
    const r = estimateTripCost(oneDay, baseRates);
    const line = r.lines.find(l => l.concepto === 'Kilómetros comerciales');
    expect(line).toBeDefined();
    expect(line!.importe).toBeCloseTo(200 * 1.20);
  });

  it('calcula km en vacío', () => {
    const r = estimateTripCost(oneDay, baseRates);
    const line = r.lines.find(l => l.concepto === 'Kilómetros en vacío');
    expect(line).toBeDefined();
    expect(line!.importe).toBeCloseTo(20 * 0.80);
  });

  it('calcula horas conductor', () => {
    const r = estimateTripCost(oneDay, baseRates);
    const line = r.lines.find(l => l.concepto?.includes('Horas conductor'));
    expect(line).toBeDefined();
    expect(line!.importe).toBeCloseTo(4 * 15.0);
  });

  it('aplica overhead y margen para precio sugerido', () => {
    const r = estimateTripCost(oneDay, baseRates);
    expect(r.coste_directo).toBeGreaterThan(0);
    expect(r.coste_con_overhead).toBeCloseTo(r.coste_directo * 1.10);
    expect(r.precio_sugerido).toBeCloseTo(r.coste_con_overhead / 0.80);
  });

  it('no hay warnings con tarifas completas', () => {
    const r = estimateTripCost(oneDay, baseRates);
    const codes = r.warnings.map(w => w.code);
    expect(codes).not.toContain('MISSING_KM_COST');
    expect(codes).not.toContain('MISSING_CONDUCTOR_HORA');
  });
});

// ── CE-2: Circuito 4 días ─────────────────────────────────────────────────────

describe('CE-2: circuito 4 días, 3 pernoctaciones empresa', () => {
  const circuito: TripInput = {
    legs: [
      { km_comercial: 150, horas: 3, km_vacio: 30 },
      { km_comercial: 200, horas: 4 },
      { km_comercial: 180, horas: 3.5 },
      { km_comercial: 160, horas: 3 },
    ],
    num_conductores: 1,
    pernoctaciones: [
      { a_cargo_de: 'empresa' },
      { a_cargo_de: 'empresa' },
      { a_cargo_de: 'empresa' },
    ],
  };

  it('suma correctamente los km de todos los tramos', () => {
    const r = estimateTripCost(circuito, baseRates);
    const kmLine = r.lines.find(l => l.concepto === 'Kilómetros comerciales');
    expect(kmLine!.cantidad).toBeCloseTo(690);
  });

  it('incluye 3 noches de alojamiento a cargo de la empresa', () => {
    const r = estimateTripCost(circuito, baseRates);
    const alojLines = r.lines.filter(l => l.concepto === 'Alojamiento conductor');
    expect(alojLines.length).toBe(3);
    const total = alojLines.reduce((s, l) => s + l.importe, 0);
    expect(total).toBeCloseTo(3 * 80.0);
  });

  it('incluye dietas para 3 noches', () => {
    const r = estimateTripCost(circuito, baseRates);
    const dietaLine = r.lines.find(l => l.concepto === 'Dietas conductor');
    expect(dietaLine).toBeDefined();
    expect(dietaLine!.importe).toBeCloseTo(3 * 25.0);
  });

  it('aplica coste vehículo para 4 días', () => {
    const r = estimateTripCost(circuito, baseRates);
    const vLine = r.lines.find(l => l.concepto?.includes('vehículo'));
    expect(vLine).toBeDefined();
    expect(vLine!.cantidad).toBe(4);
    expect(vLine!.importe).toBeCloseTo(4 * 50.0);
  });
});

// ── CE-3: Tramos múltiples, horas extra en jornada de 1 día ──────────────────

describe('CE-3: viaje con 10 horas en 1 día — genera horas extra', () => {
  const viaje: TripInput = {
    // 10 horas totales, sin pernoctaciones → límite jornada = 8h → 2h extra
    legs: [
      { km_comercial: 300, horas: 5 },
      { km_comercial: 300, horas: 5 },
    ],
    num_conductores: 1,
    pernoctaciones: [],
  };

  it('detecta 2 horas extra cuando se superan 8h en un solo día', () => {
    const r = estimateTripCost(viaje, baseRates);
    const extra = r.lines.find(l => l.concepto === 'Horas extra conductor');
    expect(extra).toBeDefined();
    expect(extra!.cantidad).toBeGreaterThan(0);
    expect(extra!.importe).toBeCloseTo(2 * 22.5);
  });
});

// ── CE-4: Alojamiento pagado por la agencia ───────────────────────────────────

describe('CE-4: alojamiento pagado por cliente / agencia', () => {
  const viaje: TripInput = {
    legs: [{ km_comercial: 250, horas: 5 }],
    num_conductores: 1,
    pernoctaciones: [
      { a_cargo_de: 'cliente' },
      { a_cargo_de: 'incluido_tarifa' },
    ],
  };

  it('NO incluye líneas de alojamiento de empresa', () => {
    const r = estimateTripCost(viaje, baseRates);
    const alojLines = r.lines.filter(l => l.concepto === 'Alojamiento conductor');
    expect(alojLines.length).toBe(0);
  });

  it('sí incluye dietas (hay pernoctaciones)', () => {
    const r = estimateTripCost(viaje, baseRates);
    const dieta = r.lines.find(l => l.concepto === 'Dietas conductor');
    expect(dieta).toBeDefined();
    expect(dieta!.cantidad).toBe(2);
  });
});

// ── CE-5: Dietas de la empresa ────────────────────────────────────────────────

describe('CE-5: dietas conductor empresa', () => {
  it('multiplica dietas por número de conductores', () => {
    const input: TripInput = {
      legs: [{ km_comercial: 100, horas: 3 }],
      num_conductores: 2,
      pernoctaciones: [{ a_cargo_de: 'empresa' }],
    };
    const r = estimateTripCost(input, baseRates);
    const dieta = r.lines.find(l => l.concepto === 'Dietas conductor');
    expect(dieta!.cantidad).toBe(2);  // 1 día × 2 conductores
    expect(dieta!.importe).toBeCloseTo(2 * 25.0);
  });
});

// ── CE-6: Dos conductores ─────────────────────────────────────────────────────

describe('CE-6: dos conductores en el servicio', () => {
  const dosConductores: TripInput = {
    legs: [{ km_comercial: 400, horas: 8 }],
    num_conductores: 2,
  };

  it('dobla el coste de conductor', () => {
    const r = estimateTripCost(dosConductores, baseRates);
    const condLine = r.lines.find(l => l.concepto?.includes('conductores'));
    expect(condLine).toBeDefined();
    expect(condLine!.cantidad).toBe(16);  // 8h × 2
    expect(condLine!.importe).toBeCloseTo(8 * 15.0 * 2);
  });
});

// ── CE-7: Kilómetros en vacío ─────────────────────────────────────────────────

describe('CE-7: kilómetros en vacío (vacío km)', () => {
  it('usa coste_km_vacio cuando está configurado', () => {
    const input: TripInput = {
      legs: [{ km_comercial: 100, horas: 2, km_vacio: 50 }],
      num_conductores: 1,
    };
    const r = estimateTripCost(input, baseRates);
    const vLine = r.lines.find(l => l.concepto === 'Kilómetros en vacío');
    expect(vLine).toBeDefined();
    expect(vLine!.importe).toBeCloseTo(50 * 0.80);
  });

  it('aplica fallback 70% si no hay coste_km_vacio', () => {
    const ratesNoVacio: TransportRates = { ...baseRates, coste_km_vacio: null };
    const input: TripInput = {
      legs: [{ km_comercial: 100, horas: 2, km_vacio: 50 }],
      num_conductores: 1,
    };
    const r = estimateTripCost(input, ratesNoVacio);
    const vLine = r.lines.find(l => l.concepto?.includes('70%'));
    expect(vLine).toBeDefined();
    expect(vLine!.importe).toBeCloseTo(50 * 1.20 * 0.7);
    expect(r.warnings.some(w => w.code === 'KM_VACIO_FALLBACK')).toBe(true);
  });
});

// ── CE-8: Sin circulación (días sin tramos) ────────────────────────────────────

describe('CE-8: días sin circulación — pernoctación sin legs ese día', () => {
  it('incluye alojamiento sin km adicionales', () => {
    // Simulación: viaje con pernoctación pero 0 km ese día
    const input: TripInput = {
      legs: [{ km_comercial: 200, horas: 4 }],
      num_conductores: 1,
      pernoctaciones: [
        { a_cargo_de: 'empresa' },
        { a_cargo_de: 'empresa' },  // día sin conducir
      ],
    };
    const r = estimateTripCost(input, baseRates);
    // 2 noches alojamiento
    const alojTotal = r.lines
      .filter(l => l.concepto === 'Alojamiento conductor')
      .reduce((s, l) => s + l.importe, 0);
    expect(alojTotal).toBeCloseTo(2 * 80.0);
    // vehículo por 3 días (2 pernoctaciones + 1)
    const vLine = r.lines.find(l => l.concepto?.includes('vehículo'));
    expect(vLine!.cantidad).toBe(3);
  });
});

// ── CE-9: Advertencias por tarifas incompletas ────────────────────────────────

describe('CE-9: advertencias cuando faltan tarifas', () => {
  it('MISSING_KM_COST si no hay coste por km ni combustible', () => {
    const ratesVacias: TransportRates = {
      ...DEFAULT_TRANSPORT_RATES,
      coste_conductor_hora: 15.0,
      overhead_pct: 10,
      margin_pct: 20,
    };
    const r = estimateTripCost(oneDay, ratesVacias);
    expect(r.warnings.some(w => w.code === 'MISSING_KM_COST')).toBe(true);
  });

  it('MISSING_OVERHEAD si overhead_pct es null', () => {
    const ratesNoOverhead: TransportRates = { ...baseRates, overhead_pct: null };
    const r = estimateTripCost(oneDay, ratesNoOverhead);
    expect(r.warnings.some(w => w.code === 'MISSING_OVERHEAD')).toBe(true);
  });

  it('MISSING_MARGIN si margin_pct es null → precio_sugerido es null', () => {
    const ratesNoMargin: TransportRates = { ...baseRates, margin_pct: null };
    const r = estimateTripCost(oneDay, ratesNoMargin);
    expect(r.precio_sugerido).toBeNull();
    expect(r.warnings.some(w => w.code === 'MISSING_MARGIN')).toBe(true);
  });
});

// ── CE-10: Anti-doble-contabilización km ──────────────────────────────────────

describe('CE-10: no doble contabilización km comercial + combustible', () => {
  it('si hay coste_km_comercial NO añade línea de combustible', () => {
    const r = estimateTripCost(oneDay, baseRates);
    const lines = r.lines.map(l => l.concepto);
    expect(lines).not.toContain('Combustible (km comerciales)');
    expect(lines).toContain('Kilómetros comerciales');
  });

  it('si solo hay datos de combustible usa combustible como proxy', () => {
    const ratesFuel: TransportRates = {
      ...DEFAULT_TRANSPORT_RATES,
      coste_km_comercial: null,
      consumo_l_100km: 30,
      precio_combustible: 1.50,
      overhead_pct: 10,
      margin_pct: 20,
      coste_conductor_hora: 15.0,
    };
    const r = estimateTripCost(oneDay, ratesFuel);
    const lines = r.lines.map(l => l.concepto);
    expect(lines).toContain('Combustible (km comerciales)');
    expect(lines).not.toContain('Kilómetros comerciales');
    // coste por km = (30/100) * 1.50 = 0.45 €/km
    const fuelLine = r.lines.find(l => l.concepto === 'Combustible (km comerciales)');
    expect(fuelLine!.importe).toBeCloseTo(200 * 0.45);
  });
});

// ── CE-11: Cálculo de margen sobre precio final editado ───────────────────────

describe('CE-11: computeMargin y priceFromMargin', () => {
  it('computeMargin calcula % correcto sobre precio venta', () => {
    // coste empresa = 800, terceros = 100, precio final = 1100
    // margen = (1100 - 100 - 800) / 1100 * 100 = 18.18...%
    const m = computeMargin(800, 100, 1100);
    expect(m).toBeCloseTo(18.18, 1);
  });

  it('computeMargin devuelve null si precio_final <= 0', () => {
    expect(computeMargin(800, 0, 0)).toBeNull();
    expect(computeMargin(800, 0, -10)).toBeNull();
  });

  it('priceFromMargin invierte correctamente la fórmula', () => {
    // overhead 800, terceros 100, margin 20% → 800/0.8 + 100 = 1100
    const p = priceFromMargin(800, 100, 20);
    expect(p).toBeCloseTo(1100);
  });

  it('priceFromMargin devuelve null para margin >= 100', () => {
    expect(priceFromMargin(800, 0, 100)).toBeNull();
    expect(priceFromMargin(800, 0, 150)).toBeNull();
  });
});

// ── CE-12: Aislamiento de organización (tarifas por org) ──────────────────────

describe('CE-12: aislamiento por organización', () => {
  it('mismas entradas con tarifas diferentes producen resultados distintos', () => {
    const ratesOrg1: TransportRates = { ...baseRates, coste_km_comercial: 1.00 };
    const ratesOrg2: TransportRates = { ...baseRates, coste_km_comercial: 2.00 };
    const r1 = estimateTripCost(oneDay, ratesOrg1);
    const r2 = estimateTripCost(oneDay, ratesOrg2);
    expect(r1.coste_directo).not.toBeCloseTo(r2.coste_directo);
  });
});

// ── CE-13: missingRateFields ───────────────────────────────────────────────────

describe('CE-13: missingRateFields', () => {
  it('identifica campos faltantes en tarifas vacías', () => {
    const missing = missingRateFields(DEFAULT_TRANSPORT_RATES);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.some(m => m.includes('coste_km_comercial'))).toBe(true);
    expect(missing.some(m => m.includes('coste_conductor_hora'))).toBe(true);
  });

  it('no reporta campos faltantes con tarifas completas', () => {
    const missing = missingRateFields(baseRates);
    expect(missing.length).toBe(0);
  });
});

// ── CE-14: validateTripInput ──────────────────────────────────────────────────

describe('CE-14: validateTripInput', () => {
  it('acepta input válido', () => {
    expect(validateTripInput(oneDay)).toHaveLength(0);
  });

  it('rechaza input sin legs', () => {
    const errors = validateTripInput({ legs: [], num_conductores: 1 });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rechaza leg con km_comercial = 0', () => {
    const errors = validateTripInput({
      legs: [{ km_comercial: 0, horas: 2 }],
      num_conductores: 1,
    });
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ── CE-15: Gastos de terceros ─────────────────────────────────────────────────

describe('CE-15: gastos de terceros repercutibles', () => {
  it('separa gastos terceros de costes propios', () => {
    const input: TripInput = {
      legs: [{ km_comercial: 200, horas: 4 }],
      num_conductores: 1,
      gastos_terceros: [
        { concepto: 'Peaje autopista', importe: 45.0 },
        { concepto: 'Parking destino', importe: 20.0 },
      ],
    };
    const r = estimateTripCost(input, baseRates);
    expect(r.coste_terceros).toBeCloseTo(65.0);
    expect(r.lines_terceros).toHaveLength(2);
    // el precio sugerido incluye los terceros al final (no con overhead/margen)
    expect(r.precio_sugerido).toBeCloseTo(r.coste_con_overhead / 0.80 + 65.0);
  });
});
