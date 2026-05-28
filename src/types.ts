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

// Internal
Admin = 'admin',
Worker = 'worker',

// Auth flow
Login = 'login',
AuthActivate = 'auth-activate',
AuthCallback = 'auth-callback',
AuthResetPassword = 'auth-reset-password',
UpdatePassword = 'update-password',
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
}

export interface Presupuesto {
id: string;
nombreCliente: string;
descripcion: string;
partidas: PartidaPresupuesto[];
total: number;
fecha: string;
estado: 'Borrador' | 'Enviado' | 'Aceptado' | 'Facturado';
telefonoCliente?: string;
emailCliente?: string;
}

export interface Factura {
id: string;
numeroFactura: string;
nombreCliente: string;
idPresupuesto: string;
importe: number;
fecha: string;
fechaVencimiento: string;
estado: 'Pagada' | 'Pendiente' | 'Vencida';
}

export interface Cliente {
id: string;
nombre: string;
telefono: string;
email: string;
direccion: string;
obrasActivas: number;
totalFacturado: number;
}
