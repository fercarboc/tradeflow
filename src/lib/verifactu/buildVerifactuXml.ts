/**
 * buildVerifactuXml — Generador XML VERI*FACTU
 *
 * ESTADO VF-1: XML builder estructural implementado.
 * PENDIENTE VALIDACIÓN XSD OFICIAL — no afirmar conformidad AEAT hasta
 * ejecutar xmllint/Saxon contra los XSD de la Orden HAC/1177/2024.
 * Ver scripts/test-verifactu/README.md para el proceso de validación.
 *
 * Todos los campos de producción son configurables:
 *   - producer_nif: NULL hasta NIF definitivo TrabFlow Technologies, S.L.
 *   - installation_number: NULL hasta respuesta AEAT (SaaS cloud ≠ físico)
 *   - multiple_ot_indicator: NULL hasta confirmación AEAT
 *
 * IMPORTANTE: función pura (sin efectos de red). El transporte es
 * responsabilidad de VerifactuTransport (ver VerifactuTransport.ts).
 */

export interface VerifactuSystemConfig {
  producerNif: string;                     // NULL en DB hasta NIF definitivo — no pasar NULL al builder
  producerNombreRazon: string;
  sistemaNombre: string;                   // NombreSistemaInformatico (max 30)
  sistemaId: string;                       // IdSistemaInformatico (max 2)
  sistemaVersion: string;                  // Version (max 50)
  installationNumber: string;              // NULL en DB hasta confirmación AEAT — pendiente
  multipleOtIndicator: 'S' | 'N';         // NULL en DB hasta confirmación AEAT — pendiente
}

export interface VerifactuRegistroAlta {
  // Identificación de la factura
  nifEmisor: string;
  nombreEmisor: string;
  numSerie: string;
  fechaExpedicion: string;   // DD-MM-YYYY
  tipoFactura: 'F1' | 'F2' | 'R1' | 'R2' | 'R3' | 'R4' | 'R5';
  // Para rectificativas
  numSerieFacturaRectificada?: string;
  fechaExpedicionRectificada?: string;
  // Importes
  baseImponible: number;
  cuotaIva: number;
  importeTotal: number;
  // Hash chain
  hash: string;
  hashAnterior: string | null;  // null = primer registro
  generatedAtStr: string;        // YYYY-MM-DDTHH:MM:SS±HH:MM
}

export interface BuildVerifactuXmlOptions {
  config: VerifactuSystemConfig;
  registros: VerifactuRegistroAlta[];
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtImporte(n: number): string {
  return n.toFixed(2);
}

/**
 * Construye el XML SuministroLR para uno o más registros de alta.
 * El XML resultante debe validarse contra el XSD de la AEAT antes
 * de enviarlo al WebService.
 */
export function buildVerifactuXml(opts: BuildVerifactuXmlOptions): string {
  const { config, registros } = opts;

  if (registros.length === 0) {
    throw new Error('buildVerifactuXml: se requiere al menos un registro');
  }

  const registrosXml = registros.map((r) => {
    const prevHuella = r.hashAnterior
      ? `<sum:Encadenamiento>
          <sum:RegistroAnterior>
            <sum:IDEmisorFactura>${escapeXml(r.nifEmisor)}</sum:IDEmisorFactura>
            <sum:NumSerieFactura>${escapeXml(r.numSerie)}</sum:NumSerieFactura>
            <sum:FechaExpedicionFactura>${escapeXml(r.fechaExpedicion)}</sum:FechaExpedicionFactura>
            <sum:Huella>${escapeXml(r.hashAnterior)}</sum:Huella>
          </sum:RegistroAnterior>
        </sum:Encadenamiento>`
      : `<sum:Encadenamiento>
          <sum:PrimerRegistro>S</sum:PrimerRegistro>
        </sum:Encadenamiento>`;

    const rectificativaXml = r.numSerieFacturaRectificada
      ? `<sum:FacturasRectificadas>
          <sum:IDFacturaRectificada>
            <sum:IDEmisorFactura>${escapeXml(r.nifEmisor)}</sum:IDEmisorFactura>
            <sum:NumSerieFactura>${escapeXml(r.numSerieFacturaRectificada)}</sum:NumSerieFactura>
            <sum:FechaExpedicionFactura>${escapeXml(r.fechaExpedicionRectificada ?? r.fechaExpedicion)}</sum:FechaExpedicionFactura>
          </sum:IDFacturaRectificada>
        </sum:FacturasRectificadas>`
      : '';

    return `<sum:RegistroFactura>
      <sum:IDVersion>1.0</sum:IDVersion>
      <sum:IDFactura>
        <sum:IDEmisorFactura>${escapeXml(r.nifEmisor)}</sum:IDEmisorFactura>
        <sum:NumSerieFactura>${escapeXml(r.numSerie)}</sum:NumSerieFactura>
        <sum:FechaExpedicionFactura>${escapeXml(r.fechaExpedicion)}</sum:FechaExpedicionFactura>
      </sum:IDFactura>
      <sum:NombreRazonEmisor>${escapeXml(r.nombreEmisor)}</sum:NombreRazonEmisor>
      <sum:TipoFactura>${escapeXml(r.tipoFactura)}</sum:TipoFactura>
      <sum:TipoRectificativa>${r.tipoFactura.startsWith('R') ? 'S' : ''}</sum:TipoRectificativa>
      ${rectificativaXml}
      <sum:DesgloseDetallado>
        <sum:DetalleIVA>
          <sum:TipoImpositivo>21.00</sum:TipoImpositivo>
          <sum:BaseImponibleOImporteNoSujeto>${fmtImporte(r.baseImponible)}</sum:BaseImponibleOImporteNoSujeto>
          <sum:CuotaRepercutida>${fmtImporte(r.cuotaIva)}</sum:CuotaRepercutida>
        </sum:DetalleIVA>
      </sum:DesgloseDetallado>
      <sum:CuotaTotal>${fmtImporte(r.cuotaIva)}</sum:CuotaTotal>
      <sum:ImporteTotal>${fmtImporte(r.importeTotal)}</sum:ImporteTotal>
      ${prevHuella}
      <sum:Huella>${escapeXml(r.hash)}</sum:Huella>
      <sum:FechaHoraHusoGenRegistro>${escapeXml(r.generatedAtStr)}</sum:FechaHoraHusoGenRegistro>
    </sum:RegistroFactura>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeX/cont/ws/SuministroLR.xsd"
  xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeX/cont/ws/SuministroInformacion.xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <sum:SuministroLRFacturasEmitidas>
      <sum:Cabecera>
        <sum1:IDVersion>1.0</sum1:IDVersion>
        <sum1:ObligadoEmision>
          <sum1:NombreRazon>${escapeXml(config.producerNombreRazon)}</sum1:NombreRazon>
          <sum1:NIF>${escapeXml(config.producerNif)}</sum1:NIF>
        </sum1:ObligadoEmision>
        <sum1:SistemaInformatico>
          <sum1:NombreRazon>${escapeXml(config.producerNombreRazon)}</sum1:NombreRazon>
          <sum1:NIF>${escapeXml(config.producerNif)}</sum1:NIF>
          <sum1:NombreSistemaInformatico>${escapeXml(config.sistemaNombre.slice(0, 30))}</sum1:NombreSistemaInformatico>
          <sum1:IdSistemaInformatico>${escapeXml(config.sistemaId.slice(0, 2))}</sum1:IdSistemaInformatico>
          <sum1:Version>${escapeXml(config.sistemaVersion.slice(0, 50))}</sum1:Version>
          <sum1:NumeroInstalacion>${escapeXml(config.installationNumber)}</sum1:NumeroInstalacion>
          <sum1:TipoUsoPosibleSoloVerifactu>S</sum1:TipoUsoPosibleSoloVerifactu>
          <sum1:TipoUsoPosibleMultiOT>S</sum1:TipoUsoPosibleMultiOT>
          <sum1:IndicadorMultiplesOT>${escapeXml(config.multipleOtIndicator)}</sum1:IndicadorMultiplesOT>
        </sum1:SistemaInformatico>
      </sum:Cabecera>
      <sum:RegistroLRFacturasEmitidas>
        ${registrosXml}
      </sum:RegistroLRFacturasEmitidas>
    </sum:SuministroLRFacturasEmitidas>
  </soapenv:Body>
</soapenv:Envelope>`;
}
