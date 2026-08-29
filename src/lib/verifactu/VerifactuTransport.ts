/**
 * VerifactuTransport — Interfaz de transporte para envío SOAP a la AEAT
 *
 * En VF-1 solo existe DisabledVerifactuTransport (stub fail-closed).
 * El transporte real (SoapVerifactuTransport con Sello Electrónico Cualificado)
 * se implementará en fases posteriores, una vez obtenidos:
 *   - NIF definitivo de TrabFlow Technologies, S.L.
 *   - Acuerdo de Colaboración Social Tipo 17 (AEAT)
 *   - Sello Electrónico Cualificado (FNMT)
 *   - NumeroInstalacion confirmado por AEAT
 */

export type TransmissionResult =
  | { ok: true;  csv: string; rawResponse: string }
  | { ok: false; error: TransmissionError; rawResponse?: string };

export type TransmissionError =
  | 'TRANSMISSION_DISABLED'    // kill switch activo (siempre en VF-1)
  | 'CERT_NOT_CONFIGURED'      // certificado no disponible
  | 'AEAT_UNREACHABLE'         // error de red
  | 'AEAT_REJECTED'            // AEAT rechazó el registro
  | 'AEAT_INVALID_RESPONSE'    // respuesta inesperada
  | 'XML_VALIDATION_ERROR';    // XML no válido contra XSD

/**
 * Interfaz que deben implementar todos los transportes VeriFactu.
 * El XML ya viene construido (buildVerifactuXml). El transporte
 * solo firma y envía.
 */
export interface VerifactuTransport {
  send(signedXml: string): Promise<TransmissionResult>;
}

/**
 * Stub fail-closed usado en VF-1.
 * Devuelve siempre TRANSMISSION_DISABLED sin realizar ninguna llamada.
 * Permite que el resto de la infraestructura (outbox, worker) funcione
 * sin activar transmisión real.
 */
export class DisabledVerifactuTransport implements VerifactuTransport {
  async send(_signedXml: string): Promise<TransmissionResult> {
    return {
      ok: false,
      error: 'TRANSMISSION_DISABLED',
    };
  }
}

/**
 * Devuelve el transporte activo según la configuración del sistema.
 * En VF-1 siempre devuelve DisabledVerifactuTransport.
 *
 * transmissionEnabled debe leerse de trade_verifactu_system_config
 * en el worker Edge Function — nunca desde el cliente.
 */
export function createVerifactuTransport(transmissionEnabled: boolean): VerifactuTransport {
  if (!transmissionEnabled) {
    return new DisabledVerifactuTransport();
  }
  // VF-2+: SoapVerifactuTransport(cert, endpoint)
  // Por ahora, aunque transmission_enabled sea true, usamos el stub
  // hasta que exista implementación real. Fail-closed.
  return new DisabledVerifactuTransport();
}
