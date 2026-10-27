/**
 * Utilidades puras para el cálculo y validación del odómetro de vehículos.
 * Separadas del componente para permitir testing unitario sin React.
 */

/**
 * Calcula la lectura estimada del cuentakilómetros al llegar.
 * Retorna null si alguno de los valores es inválido o falta.
 */
export function calcOdoEstimado(
  odometroInicio: number | null | undefined,
  kmRealesStr: string,
): number | null {
  if (odometroInicio == null) return null;
  const km = parseFloat(kmRealesStr);
  if (isNaN(km) || km < 0 || kmRealesStr.trim() === '') return null;
  return odometroInicio + Math.round(km);
}

/**
 * Calcula la distancia registrada por odómetro (final - inicio).
 * Retorna null si alguno de los valores es inválido o falta.
 */
export function calcDistanciaOdo(
  odometroInicio: number | null | undefined,
  odometroFinalStr: string,
): number | null {
  if (odometroInicio == null) return null;
  if (odometroFinalStr.trim() === '') return null;
  const final = parseInt(odometroFinalStr, 10);
  if (isNaN(final)) return null;
  return final - odometroInicio;
}

/**
 * Valida que la lectura final del odómetro sea consistente con la inicial.
 * Retorna un mensaje de error, o null si es válido (incluyendo vacío).
 */
export function validateOdometroFinal(
  odometroInicio: number | null | undefined,
  odometroFinalStr: string,
): string | null {
  if (odometroFinalStr.trim() === '') return null;
  const final = parseInt(odometroFinalStr, 10);
  if (isNaN(final) || final < 0) {
    return 'La lectura del cuentakilómetros debe ser un número entero positivo';
  }
  if (odometroInicio != null && final < odometroInicio) {
    return (
      `La lectura final (${fmtKm(final)} km) es menor que la inicial ` +
      `(${fmtKm(odometroInicio)} km). Si hubo sustitución del cuentakilómetros, ` +
      `contacta con el administrador para registrarlo correctamente.`
    );
  }
  return null;
}

/** Formatea un número entero con separadores de millares en español. */
export function fmtKm(n: number): string {
  return n.toLocaleString('es-ES');
}

/**
 * Determina el valor a enviar como odometro_final al completar el servicio.
 * Solo retorna un valor numérico si el usuario confirmó expresamente la lectura.
 * Si no está confirmada, retorna null aunque el campo tenga contenido.
 */
export function resolveOdometroFinal(
  odoFinalStr: string,
  confirmado: boolean,
): number | null {
  if (!confirmado) return null;
  if (odoFinalStr.trim() === '') return null;
  const val = parseInt(odoFinalStr, 10);
  if (isNaN(val) || val < 0) return null;
  return val;
}
