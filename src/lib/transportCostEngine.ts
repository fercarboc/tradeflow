/**
 * transportCostEngine.ts — Motor de estimación de costes para viajes de transporte
 *
 * Funciones puras (sin side effects, sin llamadas a API).
 * Entrada: TripInput + TransportRates → Salida: TripCostResult
 *
 * Regla anti-doble-contabilización:
 *   Si coste_km_comercial está configurado → NO añadir línea de combustible.
 *   Si solo hay datos de combustible → el combustible ES el proxy del coste por km.
 *   Nunca ambos simultáneamente para los mismos km.
 */

import { TransportRates, isPositive, isPct, hasFuelData, hasKmCostMethod } from './transportRates';

// ── Tipos de entrada ─────────────────────────────────────────────────────────

export interface TripLeg {
  /** Kilómetros del tramo con viajeros. */
  km_comercial: number;
  /** Duración estimada del tramo en horas. */
  horas: number;
  /** Kilómetros en vacío asociados a este tramo (salida/regreso/reposicionamiento). */
  km_vacio?: number;
}

export interface TripPernoctacion {
  /** Quién corre con el coste del alojamiento. */
  a_cargo_de: 'empresa' | 'cliente' | 'incluido_tarifa';
  /**
   * Importe real del alojamiento en €/noche.
   * Si no se proporciona y a_cargo_de === 'empresa', se usa alojamiento_conductor_noche de las tarifas.
   */
  importe_empresa?: number;
}

export interface TripInput {
  /** Tramos del viaje (uno por trayecto o etapa). */
  legs: TripLeg[];
  /** Número de conductores en el servicio. */
  num_conductores: number;
  /**
   * Pernoctaciones reales del viaje.
   * NUNCA inferir automáticamente como numDays - 1.
   * Solo las que el usuario define explícitamente.
   */
  pernoctaciones?: TripPernoctacion[];
  /** Gastos de terceros que la empresa adelanta pero no son coste operativo propio. */
  gastos_terceros?: TripGastoTercero[];
  /**
   * Si es true y las tarifas tienen precio_km configurado,
   * usar precio_km como tarifa de venta directa en vez de calcular precio_sugerido.
   */
  usar_tarifa_venta_km?: boolean;
}

export interface TripGastoTercero {
  concepto: string;
  /** €. Lo paga la empresa y se repercute al cliente. */
  importe: number;
}

// ── Tipos de salida ──────────────────────────────────────────────────────────

export interface CostLine {
  concepto: string;
  /** Cantidad de unidades (km, horas, noches, …). */
  cantidad?: number;
  /** Unidad de medida. */
  unidad?: string;
  /** Coste unitario en €. */
  coste_unitario?: number;
  /** Importe total en €. */
  importe: number;
  /** Si true, es un gasto de tercero (no coste operativo propio). */
  es_tercero?: boolean;
}

export interface CostWarning {
  code: string;
  message: string;
}

export interface TripCostResult {
  /** Desglose línea a línea de costes operativos propios. */
  lines: CostLine[];
  /** Desglose de gastos de terceros repercutibles. */
  lines_terceros: CostLine[];
  /** Suma de todos los costes operativos propios (sin overhead ni margen). */
  coste_directo: number;
  /** coste_directo × (1 + overhead_pct/100). */
  coste_con_overhead: number;
  /** Suma de gastos de terceros. */
  coste_terceros: number;
  /**
   * Precio de venta sugerido = coste_con_overhead / (1 - margin_pct/100) + coste_terceros.
   * null si faltan datos suficientes para calcularlo.
   */
  precio_sugerido: number | null;
  /**
   * Margen estimado sobre precio de venta final (editable por el usuario).
   * null si precio_final no está fijado.
   */
  margen_estimado: number | null;
  /** Advertencias que no bloquean el cálculo pero el usuario debe revisar. */
  warnings: CostWarning[];
}

// ── Motor principal ──────────────────────────────────────────────────────────

/**
 * Estima el coste total de un viaje dados los tramos y las tarifas de la organización.
 * Devuelve un desglose completo con advertencias.
 */
export function estimateTripCost(input: TripInput, rates: TransportRates): TripCostResult {
  const lines: CostLine[] = [];
  const warnings: CostWarning[] = [];

  const legs = input.legs ?? [];
  const numConductores = Math.max(1, input.num_conductores ?? 1);
  const pernoctaciones = input.pernoctaciones ?? [];
  const gastosTerceros = input.gastos_terceros ?? [];

  // ── Kilómetros totales ────────────────────────────────────────────────────
  const totalKmComercial = legs.reduce((s, l) => s + (l.km_comercial ?? 0), 0);
  const totalKmVacio = legs.reduce((s, l) => s + (l.km_vacio ?? 0), 0);
  const totalHoras = legs.reduce((s, l) => s + (l.horas ?? 0), 0);

  // ── Coste por km comercial (anti-doble-contabilización) ───────────────────
  if (totalKmComercial > 0) {
    if (isPositive(rates.coste_km_comercial)) {
      // Modo A: coste km directo (incluye combustible implícitamente)
      lines.push({
        concepto: 'Kilómetros comerciales',
        cantidad: totalKmComercial,
        unidad: 'km',
        coste_unitario: rates.coste_km_comercial,
        importe: totalKmComercial * rates.coste_km_comercial,
      });
    } else if (hasFuelData(rates)) {
      // Modo B: combustible como proxy (sin coste_km_comercial configurado)
      const costePorKm = (rates.consumo_l_100km! / 100) * rates.precio_combustible!;
      lines.push({
        concepto: 'Combustible (km comerciales)',
        cantidad: totalKmComercial,
        unidad: 'km',
        coste_unitario: costePorKm,
        importe: totalKmComercial * costePorKm,
      });
    } else {
      warnings.push({
        code: 'MISSING_KM_COST',
        message: `No hay método de coste por km configurado. Los ${totalKmComercial} km comerciales no tienen coste asignado.`,
      });
    }
  }

  // ── Kilómetros en vacío ───────────────────────────────────────────────────
  if (totalKmVacio > 0) {
    const costeVacio = isPositive(rates.coste_km_vacio)
      ? rates.coste_km_vacio
      : isPositive(rates.coste_km_comercial)
        ? rates.coste_km_comercial * 0.7  // fallback razonable: 70% del coste comercial
        : hasFuelData(rates)
          ? (rates.consumo_l_100km! / 100) * rates.precio_combustible! * 0.7
          : null;

    if (costeVacio !== null && costeVacio > 0) {
      const usandoFallback = !isPositive(rates.coste_km_vacio);
      lines.push({
        concepto: usandoFallback
          ? 'Kilómetros en vacío (estimado al 70% del coste comercial)'
          : 'Kilómetros en vacío',
        cantidad: totalKmVacio,
        unidad: 'km',
        coste_unitario: costeVacio,
        importe: totalKmVacio * costeVacio,
      });
      if (usandoFallback) {
        warnings.push({
          code: 'KM_VACIO_FALLBACK',
          message: 'coste_km_vacio no configurado. Se ha estimado al 70% del coste por km comercial.',
        });
      }
    } else {
      warnings.push({
        code: 'MISSING_KM_VACIO_COST',
        message: `Hay ${totalKmVacio} km en vacío pero no hay coste por km configurado.`,
      });
    }
  }

  // ── Coste del conductor ───────────────────────────────────────────────────
  if (totalHoras > 0) {
    if (isPositive(rates.coste_conductor_hora)) {
      const horasNormales = Math.min(totalHoras, 8 * (pernoctaciones.length + 1));
      const horasExtra = Math.max(0, totalHoras - horasNormales);
      const importeNormal = horasNormales * rates.coste_conductor_hora * numConductores;

      lines.push({
        concepto: numConductores > 1
          ? `Horas conductor × ${numConductores} conductores`
          : 'Horas conductor',
        cantidad: horasNormales * numConductores,
        unidad: 'h',
        coste_unitario: rates.coste_conductor_hora,
        importe: importeNormal,
      });

      if (horasExtra > 0 && isPositive(rates.coste_conductor_hora_extra)) {
        lines.push({
          concepto: 'Horas extra conductor',
          cantidad: horasExtra * numConductores,
          unidad: 'h',
          coste_unitario: rates.coste_conductor_hora_extra,
          importe: horasExtra * rates.coste_conductor_hora_extra * numConductores,
        });
      }
    } else {
      warnings.push({
        code: 'MISSING_CONDUCTOR_HORA',
        message: 'coste_conductor_hora no configurado. No se han calculado costes de conductor.',
      });
    }
  }

  // ── Dietas ────────────────────────────────────────────────────────────────
  // Solo cuando hay pernoctaciones o viajes de más de un día
  const numDiasConDieta = pernoctaciones.length;
  if (numDiasConDieta > 0 && isPositive(rates.dieta_conductor_dia)) {
    lines.push({
      concepto: 'Dietas conductor',
      cantidad: numDiasConDieta * numConductores,
      unidad: 'día',
      coste_unitario: rates.dieta_conductor_dia,
      importe: numDiasConDieta * rates.dieta_conductor_dia * numConductores,
    });
  } else if (numDiasConDieta > 0 && !isPositive(rates.dieta_conductor_dia)) {
    warnings.push({
      code: 'MISSING_DIETA',
      message: `Hay ${numDiasConDieta} pernoctaciones pero dieta_conductor_dia no está configurada.`,
    });
  }

  // ── Alojamiento (solo noches a cargo de la empresa) ───────────────────────
  // INVARIANTE: usar pernoctaciones explícitas, NUNCA numDias - 1
  const nochesEmpresa = pernoctaciones.filter(p => p.a_cargo_de === 'empresa');
  for (const noche of nochesEmpresa) {
    const importe = isPositive(noche.importe_empresa)
      ? noche.importe_empresa
      : isPositive(rates.alojamiento_conductor_noche)
        ? rates.alojamiento_conductor_noche
        : null;

    if (importe !== null && importe > 0) {
      lines.push({
        concepto: 'Alojamiento conductor',
        cantidad: numConductores,
        unidad: 'noche',
        coste_unitario: importe,
        importe: importe * numConductores,
      });
    } else {
      warnings.push({
        code: 'MISSING_ALOJAMIENTO',
        message: 'Hay una noche a cargo de la empresa pero no hay importe de alojamiento configurado.',
      });
    }
  }

  // ── Coste fijo del vehículo ───────────────────────────────────────────────
  const numDiasVehiculo = Math.max(1, pernoctaciones.length + 1);
  if (isPositive(rates.coste_vehiculo_dia)) {
    lines.push({
      concepto: 'Coste vehículo (amortización + seguro)',
      cantidad: numDiasVehiculo,
      unidad: 'día',
      coste_unitario: rates.coste_vehiculo_dia,
      importe: numDiasVehiculo * rates.coste_vehiculo_dia,
    });
  }

  // ── Gastos de terceros ────────────────────────────────────────────────────
  const linesTerceros: CostLine[] = gastosTerceros.map(g => ({
    concepto: g.concepto,
    importe: g.importe,
    es_tercero: true,
  }));

  // ── Totales ───────────────────────────────────────────────────────────────
  const costeDirecto = lines.reduce((s, l) => s + l.importe, 0);
  const costeConOverhead = isPositive(rates.overhead_pct)
    ? costeDirecto * (1 + rates.overhead_pct / 100)
    : costeDirecto;
  const costeTerceros = linesTerceros.reduce((s, l) => s + l.importe, 0);

  // Si no hay overhead configurado y hay costes, avisar
  if (costeDirecto > 0 && !isPct(rates.overhead_pct)) {
    warnings.push({
      code: 'MISSING_OVERHEAD',
      message: 'overhead_pct no configurado. No se han aplicado gastos generales al coste.',
    });
  }

  // ── Precio sugerido ───────────────────────────────────────────────────────
  let precioSugerido: number | null = null;
  if (costeConOverhead > 0 && isPct(rates.margin_pct) && rates.margin_pct! < 100) {
    precioSugerido = costeConOverhead / (1 - rates.margin_pct! / 100) + costeTerceros;
  } else if (costeConOverhead > 0) {
    if (!isPct(rates.margin_pct)) {
      warnings.push({
        code: 'MISSING_MARGIN',
        message: 'margin_pct no configurado. No se puede calcular precio sugerido automáticamente.',
      });
    }
  }

  return {
    lines,
    lines_terceros: linesTerceros,
    coste_directo: costeDirecto,
    coste_con_overhead: costeConOverhead,
    coste_terceros: costeTerceros,
    precio_sugerido: precioSugerido,
    margen_estimado: null,
    warnings,
  };
}

/**
 * Calcula el margen sobre precio de venta dado un coste total y un precio final.
 * margen = (precio_final - coste_empresa) / precio_final * 100
 * Devuelve null si precio_final es 0 o negativo.
 */
export function computeMargin(
  costeConOverhead: number,
  costeTerceros: number,
  precioFinal: number,
): number | null {
  if (precioFinal <= 0) return null;
  const costeEmpresa = costeConOverhead;
  const margen = ((precioFinal - costeTerceros - costeEmpresa) / precioFinal) * 100;
  return margen;
}

/**
 * Recalcula el precio sugerido a partir de un coste y un margen deseado.
 * precio_sugerido = coste_con_overhead / (1 - margin_pct/100) + coste_terceros
 * Devuelve null si margin_pct >= 100.
 */
export function priceFromMargin(
  costeConOverhead: number,
  costeTerceros: number,
  marginPct: number,
): number | null {
  if (marginPct >= 100) return null;
  return costeConOverhead / (1 - marginPct / 100) + costeTerceros;
}

/**
 * Valida que un TripInput tiene los campos mínimos para calcular.
 * Devuelve array de mensajes de error (vacío = válido).
 */
export function validateTripInput(input: TripInput): string[] {
  const errors: string[] = [];
  if (!input.legs || input.legs.length === 0) {
    errors.push('Se requiere al menos un tramo (leg).');
  }
  for (const leg of input.legs ?? []) {
    if (!isPositive(leg.km_comercial)) {
      errors.push('Cada tramo debe tener km_comercial > 0.');
      break;
    }
    if (!isPositive(leg.horas)) {
      errors.push('Cada tramo debe tener horas > 0.');
      break;
    }
  }
  if (input.num_conductores != null && input.num_conductores < 1) {
    errors.push('num_conductores debe ser al menos 1.');
  }
  return errors;
}

/**
 * Comprueba si las tarifas son suficientes para una estimación completa.
 * Devuelve los campos que faltan.
 */
export function missingRateFields(rates: TransportRates): string[] {
  const missing: string[] = [];
  if (!hasKmCostMethod(rates)) missing.push('coste_km_comercial (o consumo_l_100km + precio_combustible)');
  if (!isPositive(rates.coste_conductor_hora)) missing.push('coste_conductor_hora');
  if (!isPct(rates.overhead_pct)) missing.push('overhead_pct');
  if (!isPct(rates.margin_pct)) missing.push('margin_pct');
  return missing;
}
