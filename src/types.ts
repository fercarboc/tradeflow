/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum ActivePage {
Home = 'home',
ComoFunciona = 'como-funciona',
Precios = 'precios',
Contacto = 'contacto',

// Legal
AvisoLegal = 'aviso-legal',
Privacidad = 'privacidad',
Cookies = 'cookies',
Terminos = 'terminos',
Beta = 'beta',
IADisclaimer = 'ia-disclaimer',

// Product
AppDashboard = 'app-dashboard',
Registro = 'registro',

// Demo interactiva
Demo = 'demo',

// Asistente Técnico — página pública
AsisTecnico = 'asis-tecnico',

// Herramientas gratuitas — calculadoras de obra
Herramientas = 'herramientas',

// Internal
Admin = 'admin',
Worker = 'worker',

// Auth flow
Login = 'login',
AuthActivate = 'auth-activate',
AuthCallback = 'auth-callback',
AuthResetPassword = 'auth-reset-password',
UpdatePassword = 'update-password',

// Public quote acceptance
QuoteAccept = 'quote-accept',

// Public invoice view
InvoiceView = 'invoice-view',

// Demo interactiva para socios / partners
PartnerDemo = 'partner-demo',

// Encuesta de satisfacción post-trabajo (pública)
Valorar = 'valorar',

// Parte de trabajo firmado (público)
Parte = 'parte',

// Portal del Proveedor — Marketplace
PortalProveedor = 'portal-proveedor',

// Compra de materiales vía Marketplace
MarketplaceComprar = 'marketplace-comprar',

// Seguimiento de pedidos de material (instalador)
SeguimientoMaterial = 'seguimiento-material',

// Selector de espacio de trabajo (usuario con múltiples membresías)
WorkspaceSelector = 'workspace-selector',

// Cuenta sin espacio asignado (sin org ni actor activo)
NoWorkspace = 'no-workspace',

// Aceptar invitación de portal proveedor (ruta pública)
MarketplaceInvitationAccept = 'marketplace-invitation-accept',

// Marketplace — catálogo navegable del instalador (panel privado)
Marketplace = 'marketplace',

// Marketplace público — acceso sin login desde web pública
MarketplacePublico = 'marketplace-publico',

// Página pública para proveedores / distribuidores / mayoristas
Proveedores = 'proveedores',

// Vista pública de documento financiero por token (publicidad)
FinDocPublic = 'fin-doc-public',

// Documentos del comprador — Marketplace
DocumentosMarketplace = 'marketplace-documentos',
}

export type TradeType =
| 'Fontanería'
| 'Electricidad'
| 'Reformas'
| 'Climatización / HVAC'
| 'Madera / Carpintería'
| 'Cerrajería'
| 'Pintura'
| 'Albañilería'
| 'Otros';

export interface WaitlistFormInput {
nombre: string;
telefono: string;
email: string;
oficio: TradeType;
ciudad: string;
presupuestosAlMes: string;
}

export interface Testimonial {
id: string;
nombre: string;
oficio: string;
ciudad: string;
texto: string;
avatarUrl?: string;
rating: number;
}

export interface PartidaPresupuesto {
descripcion: string;
tipo: 'material' | 'mano_de_obra';
cantidad: number;
precioUnitario: number;
total: number;
requiere_precio?: boolean;
aviso?: string;
supplier_key?: string;
supplier_name?: string;
supplier_ref?: string;
familia?: string;
precioCoste?: number;
catalog_variant_id?: string;
dbItemId?: string;
material_order_placed?: boolean;
origen?: 'catalogo' | 'sugerida_ia' | 'proveedor';
}

export interface Presupuesto {
id: string;
dbId?: string; // UUID real en BD; id es el número visible PRE-XXXX-XXX
clientId?: string | null;
nombreCliente: string;
descripcion: string;
partidas: PartidaPresupuesto[];
total: number;
iva_pct?: number;
fecha: string;
estado: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado';
telefonoCliente?: string;
emailCliente?: string;
kbActuaciones?: string[];
}

export interface Factura {
id: string;
numeroFactura: string;
nombreCliente: string;
idPresupuesto: string;
job_id?: string | null;
importe: number;     // subtotal (base imponible, sin IVA)
iva_pct?: number;    // snapshot fiscal — no leer de empresaAjustes para PDFs/Word
fecha: string;
fechaVencimiento: string;
estado: 'Borrador' | 'Emitida' | 'Pagada' | 'Pendiente' | 'Vencida' | 'Devuelta';
concepto?: string;
esMantenimineto?: boolean;
}

export interface Cliente {
id: string;
nombre: string;
telefono: string;
email: string;
direccion: string;
nif?: string;
ciudad?: string;
cp?: string;
provincia?: string;
pais?: string;
obrasActivas: number;
totalFacturado: number;
}
