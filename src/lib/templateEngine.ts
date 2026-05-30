// ── Template engine — resolución de variables y bloques condicionales ────────
// Syntax: {{variable}}, {{#if var}}...{{/if}}, {{#unless var}}...{{/unless}}

export function resolveTemplate(content: string, vars: Record<string, string>): string {
  // 1. Bloques {{#if variable}}...{{/if}}
  content = content.replace(
    /\{\{#if\s+([\w_]+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
    (_, varName, block) => {
      const val = vars[varName] ?? '';
      return val && val !== 'false' && val !== '0' && val.toLowerCase() !== 'no' ? block : '';
    },
  );

  // 2. Bloques {{#unless variable}}...{{/unless}}
  content = content.replace(
    /\{\{#unless\s+([\w_]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
    (_, varName, block) => {
      const val = vars[varName] ?? '';
      return !val || val === 'false' || val === '0' || val.toLowerCase() === 'no' ? block : '';
    },
  );

  // 3. Sustituir {{variable}} por valor
  content = content.replace(/\{\{([\w_]+)\}\}/g, (_, varName) => vars[varName] ?? '');

  return content.trim();
}

// ── Variable builder ──────────────────────────────────────────────────────────

export interface TemplateVarParams {
  empresa?: {
    nombre?: string; nif?: string; direccion?: string;
    telefono?: string; email?: string; logoUrl?: string;
  };
  cliente?: {
    nombre?: string; nif?: string; direccion?: string;
    telefono?: string; email?: string;
  };
  presupuesto?: {
    numero?: string; fecha?: string; total?: number;
    iva?: number; validez?: string; estado?: string;
  };
  factura?: {
    numero?: string; vencimiento?: string; estado?: string;
    metodoPago?: string; iban?: string; diasVencido?: number;
    importePendiente?: number;
  };
  visita?: {
    fecha?: string; hora?: string; tecnico?: string;
    telefonoTecnico?: string; tipoMantenimiento?: string;
  };
  ia?: {
    resumen?: string; descripcion?: string;
    materiales?: string; recomendaciones?: string;
  };
  enlaceAceptacion?: string;
  enlacePdf?: string;
  enlacePago?: string;
}

export function buildTemplateVars(p: TemplateVarParams): Record<string, string> {
  const v: Record<string, string> = {};

  v.fecha_actual = new Date().toLocaleDateString('es-ES');
  v.hora_actual = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  if (p.empresa) {
    const e = p.empresa;
    v.nombre_empresa     = e.nombre      ?? '';
    v.cif_empresa        = e.nif         ?? '';
    v.direccion_empresa  = e.direccion   ?? '';
    v.telefono_empresa   = e.telefono    ?? '';
    v.email_empresa      = e.email       ?? '';
    v.firma_empresa      = e.nombre      ?? '';
  }

  if (p.cliente) {
    const c = p.cliente;
    v.nombre_cliente    = c.nombre    ?? '';
    v.cif_cliente       = c.nif       ?? '';
    v.direccion_cliente = c.direccion ?? '';
    v.telefono_cliente  = c.telefono  ?? '';
    v.email_cliente     = c.email     ?? '';
  }

  if (p.presupuesto) {
    const q = p.presupuesto;
    const total  = q.total ?? 0;
    const iva    = q.iva   ?? 21;
    const totIva = total * (1 + iva / 100);
    v.numero_presupuesto = q.numero  ?? '';
    v.fecha_presupuesto  = q.fecha   ?? '';
    v.total              = totIva.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    v.subtotal           = total.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    v.iva_presupuesto    = (total * iva / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
    v.validez_presupuesto = q.validez ?? '30 días';
    v.estado_presupuesto  = q.estado  ?? '';
  }

  if (p.factura) {
    const f = p.factura;
    v.numero_factura    = f.numero    ?? '';
    v.fecha_vencimiento = f.vencimiento ?? '';
    v.estado_factura    = f.estado    ?? '';
    v.metodo_pago       = f.metodoPago ?? '';
    v.iban              = f.iban      ?? '';
    v.dias_vencido      = String(f.diasVencido ?? 0);
    v.importe_pendiente = f.importePendiente
      ? f.importePendiente.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : '';
  }

  if (p.visita) {
    const vis = p.visita;
    v.fecha_visita       = vis.fecha             ?? '';
    v.hora_visita        = vis.hora              ?? '';
    v.nombre_tecnico     = vis.tecnico           ?? '';
    v.telefono_tecnico   = vis.telefonoTecnico   ?? '';
    v.tipo_mantenimiento = vis.tipoMantenimiento ?? '';
  }

  if (p.ia) {
    v.resumen_trabajo_ia       = p.ia.resumen       ?? '';
    v.descripcion_tecnica_ia   = p.ia.descripcion   ?? '';
    v.materiales_detectados_ia = p.ia.materiales    ?? '';
    v.recomendaciones_ia       = p.ia.recomendaciones ?? '';
  }

  if (p.enlaceAceptacion) v.enlace_aceptacion = p.enlaceAceptacion;
  if (p.enlacePdf)        v.enlace_pdf        = p.enlacePdf;
  if (p.enlacePago)       v.enlace_pago       = p.enlacePago;

  return v;
}

// ── Contenido por defecto de cada plantilla (documento sección 4) ─────────────

export const DEFAULT_TEMPLATES = {
  whatsapp_presupuesto: `Hola {{nombre_cliente}},

Te adjunto el presupuesto nº *{{numero_presupuesto}}* de *{{nombre_empresa}}* por importe de *{{total}}*.
{{#if resumen_trabajo_ia}}
_Descripción del trabajo:_
{{resumen_trabajo_ia}}
{{/if}}
📄 Ver presupuesto: {{enlace_pdf}}
✅ Para aceptarlo: {{enlace_aceptacion}}

Validez: {{validez_presupuesto}}

Gracias. {{nombre_empresa}} · {{telefono_empresa}}`,

  email_presupuesto: `Estimado/a {{nombre_cliente}},

Me complace remitirle el presupuesto nº {{numero_presupuesto}} de {{nombre_empresa}} por un importe de {{total}} (IVA incluido).
{{#if resumen_trabajo_ia}}
Descripción del trabajo:
{{resumen_trabajo_ia}}
{{/if}}
Puede revisar el presupuesto completo aquí:
{{enlace_pdf}}

Para aceptarlo digitalmente:
{{enlace_aceptacion}}

Validez del presupuesto: {{validez_presupuesto}}

Quedamos a su disposición para cualquier consulta.

Un cordial saludo,
{{nombre_empresa}}
{{telefono_empresa}} · {{email_empresa}}`,

  email_factura: `Estimado/a {{nombre_cliente}},

Le remitimos la factura nº {{numero_factura}} por importe de {{total}}.

Fecha de vencimiento: {{fecha_vencimiento}}
Forma de pago: {{metodo_pago}}
{{#if iban}}Transferencia bancaria: {{iban}}
{{/if}}{{#if enlace_pago}}Puede realizar el pago aquí:
{{enlace_pago}}
{{/if}}
Si ya ha realizado el pago, ignore este mensaje. Para cualquier consulta, no dude en contactarnos.

Un cordial saludo,
{{nombre_empresa}}
{{telefono_empresa}} · {{email_empresa}}`,

  recordatorio_pago: `Hola {{nombre_cliente}},

Le recordamos que la factura nº *{{numero_factura}}* por importe de *{{importe_pendiente}}* venció hace *{{dias_vencido}} días*.
{{#if enlace_pago}}
Puede realizar el pago aquí:
{{enlace_pago}}
{{/if}}
Si ya ha realizado el pago, ignore este mensaje. Si tiene alguna consulta, no dude en contactarnos.

{{nombre_empresa}} · {{telefono_empresa}}`,

  aviso_visita: `Hola {{nombre_cliente}},

Le recordamos que mañana, {{fecha_visita}} a las {{hora_visita}}, realizaremos una visita de mantenimiento en sus instalaciones.

Tipo: {{tipo_mantenimiento}}
Técnico: {{nombre_tecnico}} ({{telefono_tecnico}})

Si necesita cancelar o cambiar la cita, contacte con nosotros lo antes posible.

{{nombre_empresa}} · {{telefono_empresa}}`,

  pie_presupuesto: `Validez del presupuesto: 30 días desde la fecha de emisión.
Forma de pago: 50% al inicio de los trabajos, 50% a la finalización.
Precios sin IVA salvo indicación expresa.
{{nombre_empresa}} · {{cif_empresa}} · {{email_empresa}}`,

  pie_factura: `Forma de pago: transferencia bancaria al número de cuenta indicado.
{{#if iban}}IBAN: {{iban}}{{/if}}
Pago a 30 días desde la fecha de factura.
{{nombre_empresa}} · {{cif_empresa}}`,

  contrato_mantenimiento: '',
} as const;

export type DefaultTemplateKey = keyof typeof DEFAULT_TEMPLATES;

// ── Variable catalog (doc sección 3) ─────────────────────────────────────────

export interface VarDef { key: string; label: string; example: string }
export interface VarGroup { id: string; label: string; emoji: string; vars: VarDef[] }

export const VARIABLE_GROUPS: VarGroup[] = [
  {
    id: 'empresa', label: 'Tu empresa', emoji: '🏢',
    vars: [
      { key: 'nombre_empresa',    label: 'Nombre empresa',    example: 'Instalaciones García SL' },
      { key: 'cif_empresa',       label: 'CIF/NIF empresa',   example: 'B-12345678' },
      { key: 'direccion_empresa', label: 'Dirección empresa', example: 'Calle Mayor 1, 28001 Madrid' },
      { key: 'telefono_empresa',  label: 'Teléfono',          example: '600 123 456' },
      { key: 'email_empresa',     label: 'Email empresa',     example: 'info@empresa.com' },
      { key: 'firma_empresa',     label: 'Firma / lema',      example: 'Tu instalador de confianza' },
    ],
  },
  {
    id: 'cliente', label: 'Cliente', emoji: '👤',
    vars: [
      { key: 'nombre_cliente',    label: 'Nombre cliente',    example: 'Industrias Pérez SA' },
      { key: 'cif_cliente',       label: 'CIF/NIF cliente',   example: 'A-87654321' },
      { key: 'direccion_cliente', label: 'Dirección cliente', example: 'Av. Industrial 4' },
      { key: 'telefono_cliente',  label: 'Teléfono cliente',  example: '911 234 567' },
      { key: 'email_cliente',     label: 'Email cliente',     example: 'contacto@cliente.com' },
    ],
  },
  {
    id: 'presupuesto', label: 'Presupuesto', emoji: '📋',
    vars: [
      { key: 'numero_presupuesto',  label: 'Nº presupuesto', example: 'TF-2026-0042' },
      { key: 'fecha_presupuesto',   label: 'Fecha',          example: '30/05/2026' },
      { key: 'total',               label: 'Total con IVA',  example: '1.452,30 €' },
      { key: 'subtotal',            label: 'Total sin IVA',  example: '1.200,00 €' },
      { key: 'iva_presupuesto',     label: 'Importe IVA',    example: '252,00 €' },
      { key: 'validez_presupuesto', label: 'Validez',        example: '30 días' },
      { key: 'estado_presupuesto',  label: 'Estado',         example: 'Enviado' },
      { key: 'enlace_pdf',          label: 'Enlace PDF',     example: 'https://trabflow.com/...' },
      { key: 'enlace_aceptacion',   label: 'Enlace aceptación', example: 'https://trabflow.com/p/...' },
    ],
  },
  {
    id: 'factura', label: 'Factura', emoji: '🧾',
    vars: [
      { key: 'numero_factura',    label: 'Nº factura',         example: 'FAC-2026-0042' },
      { key: 'fecha_vencimiento', label: 'Fecha vencimiento',  example: '30/06/2026' },
      { key: 'estado_factura',    label: 'Estado factura',     example: 'Emitida' },
      { key: 'metodo_pago',       label: 'Forma de pago',      example: 'Transferencia bancaria' },
      { key: 'iban',              label: 'IBAN',               example: 'ES00 0000 0000 00 0000000000' },
      { key: 'dias_vencido',      label: 'Días vencido',       example: '7' },
      { key: 'importe_pendiente', label: 'Importe pendiente',  example: '1.452,30 €' },
      { key: 'enlace_pago',       label: 'Enlace de pago',     example: 'https://pay.stripe.com/...' },
    ],
  },
  {
    id: 'visita', label: 'Visita / Trabajo', emoji: '🔧',
    vars: [
      { key: 'fecha_visita',       label: 'Fecha visita',      example: '02/06/2026' },
      { key: 'hora_visita',        label: 'Hora visita',       example: '09:00' },
      { key: 'nombre_tecnico',     label: 'Técnico asignado',  example: 'Antonio Ruiz' },
      { key: 'telefono_tecnico',   label: 'Teléfono técnico',  example: '600 987 654' },
      { key: 'tipo_mantenimiento', label: 'Tipo mantenimiento',example: 'Preventivo mensual' },
    ],
  },
  {
    id: 'ia', label: 'Variables IA', emoji: '🤖',
    vars: [
      { key: 'resumen_trabajo_ia',       label: 'Resumen trabajo (IA)',       example: 'Sustitución de caldera Baxi y revisión del circuito.' },
      { key: 'descripcion_tecnica_ia',   label: 'Descripción técnica (IA)',   example: 'Instalación de caldera de condensación...' },
      { key: 'materiales_detectados_ia', label: 'Materiales detectados (IA)', example: 'Caldera Baxi Luna 3, llave de paso, latiguillo.' },
      { key: 'recomendaciones_ia',       label: 'Recomendaciones (IA)',       example: 'Se recomienda revisar el colector.' },
    ],
  },
  {
    id: 'sistema', label: 'Sistema', emoji: '⚙️',
    vars: [
      { key: 'fecha_actual', label: 'Fecha actual', example: '30/05/2026' },
      { key: 'hora_actual',  label: 'Hora actual',  example: '10:30' },
    ],
  },
];
