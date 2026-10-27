/**
 * transport.ts — Módulo de Transporte Multimodal
 * TRANSPORT-CORE-1A/1C: flota de vehículos por organización.
 * Soporta viajeros, mercancías, reparto y uso mixto.
 * Sin rutas recurrentes, sin fiscal, sin contratos.
 */

import { supabase } from './supabase';

// ── Catálogos ─────────────────────────────────────────────────────────────────

export const VEHICLE_TIPOS = [
  { value: 'furgoneta',       label: 'Furgoneta' },
  { value: 'microbus',        label: 'Microbús' },
  { value: 'autocar',         label: 'Autocar/Autobús' },
  { value: 'sedan',           label: 'Turismo/Sedán' },
  { value: 'minivan',         label: 'Monovolumen' },
  { value: 'camion_rigido',   label: 'Camión rígido' },
  { value: 'cabeza_tractora', label: 'Cabeza tractora' },
  { value: 'otro',            label: 'Otro' },
] as const;

export const VEHICLE_ESTADOS = [
  { value: 'disponible',       label: 'Disponible',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'en_servicio',      label: 'En servicio',      color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'en_mantenimiento', label: 'En mantenimiento', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'baja',             label: 'Baja',             color: 'bg-red-100 text-red-700 border-red-200' },
] as const;

export const VEHICLE_MODALIDADES = [
  { value: 'viajeros',   label: 'Transporte de viajeros',   color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { value: 'mercancias', label: 'Transporte de mercancías', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'reparto',    label: 'Reparto y distribución',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'mixto',      label: 'Uso mixto',                color: 'bg-purple-100 text-purple-700 border-purple-200' },
] as const;

export type VehicleTipo      = typeof VEHICLE_TIPOS[number]['value'];
export type VehicleEstado    = typeof VEHICLE_ESTADOS[number]['value'];
export type VehicleModalidad = typeof VEHICLE_MODALIDADES[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TradeVehicle {
  id: string;
  org_id: string;
  nombre: string;
  matricula: string;
  tipo: VehicleTipo;
  modalidad: VehicleModalidad;
  /** Requerido cuando modalidad = 'viajeros' | 'mixto'; null para mercancías/reparto puros. */
  capacidad_viajeros: number | null;
  /** Opcional para mercancías, reparto y mixto; null para viajeros puros. */
  capacidad_carga_kg: number | null;
  estado: VehicleEstado;
  marca?: string | null;
  modelo_vehiculo?: string | null;
  anno?: number | null;
  color?: string | null;
  notas?: string | null;
  /** Ruta pública de imagen asignada explícitamente. Si null, se usa mapping automático por tipo. */
  image_path?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export type TradeVehicleInput = Omit<TradeVehicle, 'id' | 'org_id' | 'activo' | 'created_at' | 'updated_at'>;

// ── Validación ────────────────────────────────────────────────────────────────

/** Valida una matrícula española. Acepta formatos comunes: "1234-ABC", "1234 ABC", "1234ABC",
 *  matrículas antiguas provinciales ("B-1234-CD") y matrículas especiales (PMM, etc.).
 *  Mínimo 4 caracteres, máximo 10, solo letras y números. */
export function validateMatricula(matricula: string): boolean {
  if (!matricula.trim()) return false;
  const clean = matricula.trim().toUpperCase().replace(/[\s-]/g, '');
  if (clean.length < 4 || clean.length > 10) return false;
  return /^[A-Z0-9]+$/.test(clean);
}

/** Normaliza la matrícula a mayúsculas sin espacios extra. */
export function normalizeMatricula(matricula: string): string {
  return matricula.trim().toUpperCase();
}

/** True cuando la modalidad incluye transporte de personas,
 *  lo que hace obligatoria la capacidad_viajeros. */
export function needsPassengerCapacity(modalidad: VehicleModalidad): boolean {
  return modalidad === 'viajeros' || modalidad === 'mixto';
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/** Carga todos los vehículos activos de la organización. */
export async function loadVehicles(orgId: string): Promise<TradeVehicle[]> {
  const { data, error } = await supabase
    .from('trade_vehicles')
    .select('*')
    .eq('org_id', orgId)
    .eq('activo', true)
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeVehicle[];
}

/** Carga todos los vehículos (activos e inactivos) — para gestión completa. */
export async function loadVehiclesAll(orgId: string): Promise<TradeVehicle[]> {
  const { data, error } = await supabase
    .from('trade_vehicles')
    .select('*')
    .eq('org_id', orgId)
    .order('activo', { ascending: false })
    .order('nombre', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeVehicle[];
}

/** Crea un nuevo vehículo para la organización. */
export async function createVehicle(
  orgId: string,
  input: TradeVehicleInput,
): Promise<TradeVehicle> {
  if (!validateMatricula(input.matricula)) {
    throw new Error('Matrícula inválida');
  }
  if (needsPassengerCapacity(input.modalidad)) {
    if (input.capacidad_viajeros == null || input.capacidad_viajeros < 1 || input.capacidad_viajeros > 90) {
      throw new Error('La capacidad de viajeros debe estar entre 1 y 90 para esta modalidad');
    }
  }
  if (input.capacidad_carga_kg != null) {
    if (input.capacidad_carga_kg < 1 || input.capacidad_carga_kg > 50000) {
      throw new Error('La capacidad de carga debe estar entre 1 y 50.000 kg');
    }
  }
  const { data, error } = await supabase
    .from('trade_vehicles')
    .insert([{
      ...input,
      matricula: normalizeMatricula(input.matricula),
      org_id: orgId,
      activo: true,
    }])
    .select()
    .single();
  if (error) throw error;
  return data as TradeVehicle;
}

/** Actualiza los campos de un vehículo existente. Requiere que pertenezca a la org. */
export async function updateVehicle(
  id: string,
  orgId: string,
  updates: Partial<TradeVehicleInput>,
): Promise<TradeVehicle> {
  if (updates.matricula !== undefined && !validateMatricula(updates.matricula)) {
    throw new Error('Matrícula inválida');
  }
  if (updates.capacidad_viajeros !== undefined && updates.capacidad_viajeros !== null &&
      (updates.capacidad_viajeros < 1 || updates.capacidad_viajeros > 90)) {
    throw new Error('La capacidad de viajeros debe estar entre 1 y 90');
  }
  if (updates.capacidad_carga_kg !== undefined && updates.capacidad_carga_kg !== null &&
      (updates.capacidad_carga_kg < 1 || updates.capacidad_carga_kg > 50000)) {
    throw new Error('La capacidad de carga debe estar entre 1 y 50.000 kg');
  }
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.matricula) patch.matricula = normalizeMatricula(updates.matricula);

  const { data, error } = await supabase
    .from('trade_vehicles')
    .update(patch)
    .eq('id', id)
    .eq('org_id', orgId)     // RLS guard at application level
    .select()
    .single();
  if (error) throw error;
  return data as TradeVehicle;
}

/** Desactiva un vehículo (soft delete). No elimina el registro. */
export async function deactivateVehicle(id: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_vehicles')
    .update({ activo: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

/** Establece o quita el indicador de conductor de un trabajador.
 *  Incluye org_id como filtro defensivo en la capa de aplicación;
 *  la DB protege además mediante RLS (workers_owner_all). */
export async function setWorkerConductor(
  workerId: string,
  orgId: string,
  esConductor: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('trade_workers')
    .update({ es_conductor: esConductor, updated_at: new Date().toISOString() })
    .eq('id', workerId)
    .eq('org_id', orgId);
  if (error) throw error;
}

// ── Conductor CRUD (TX-COND-1A) ───────────────────────────────────────────────

/** Carga todos los conductores (es_conductor=true) de la org, activos e inactivos. */
export async function loadConductores(orgId: string): Promise<import('./supabase').TradeWorker[]> {
  const { data, error } = await supabase
    .from('trade_workers')
    .select('*')
    .eq('org_id', orgId)
    .eq('es_conductor', true)
    .order('nombre');
  if (error) throw error;
  return (data ?? []) as import('./supabase').TradeWorker[];
}

/** Crea un nuevo trabajador conductor en la organización. */
export async function createConductor(
  orgId: string,
  payload: Pick<import('./supabase').TradeWorker, 'nombre'> &
    Partial<Pick<import('./supabase').TradeWorker,
      'telefono' | 'email' | 'identificador_interno' |
      'categorias_permiso' | 'permiso_caducidad' | 'cap_caducidad' |
      'fecha_incorporacion' | 'observaciones_profesionales'
    >>,
): Promise<import('./supabase').TradeWorker> {
  const { data: row, error } = await supabase
    .from('trade_workers')
    .insert({ org_id: orgId, rol: 'tecnico', es_conductor: true, activo: true, ...payload })
    .select()
    .single();
  if (error) throw error;
  return row as import('./supabase').TradeWorker;
}

/** Actualiza campos de un trabajador. Incluye org_id como filtro defensivo. */
export async function updateWorker(
  id: string,
  orgId: string,
  updates: Partial<Omit<import('./supabase').TradeWorker, 'id' | 'org_id' | 'created_at' | 'updated_at'>>,
): Promise<import('./supabase').TradeWorker> {
  const { data: row, error } = await supabase
    .from('trade_workers')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();
  if (error) throw error;
  return row as import('./supabase').TradeWorker;
}

/** Cambia el estado operativo de un vehículo. */
export async function setVehicleEstado(
  id: string,
  orgId: string,
  estado: VehicleEstado,
): Promise<void> {
  const { error } = await supabase
    .from('trade_vehicles')
    .update({ estado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

// ── Vehicle image assets ──────────────────────────────────────────────────────

// null → no photo available; caller should render a neutral icon placeholder
export const VEHICLE_IMAGES: Record<string, string | null> = {
  autocar:         '/autocar.png',
  microbus:        '/minibus.png',
  furgoneta:       '/furgonetatrabajo.png',
  sedan:           null,   // no matching photo — show neutral icon
  minivan:         '/minibus.png',
  camion_rigido:   '/camionreparto.png',
  cabeza_tractora: '/camionarticulado.png',
  otro:            null,   // catch-all — show neutral icon
};

/** Todas las imágenes de vehículo disponibles en /public para selección manual. */
export const VEHICLE_SELECTABLE_IMAGES = [
  { path: '/autocar.png',           label: 'Autocar / Autobús' },
  { path: '/autocarpremium.png',    label: 'Autocar premium' },
  { path: '/minibus.png',           label: 'Microbús / Minibús' },
  { path: '/busescolar.png',        label: 'Bus escolar' },
  { path: '/furgonetatrabajo.png',  label: 'Furgoneta de trabajo' },
  { path: '/furgonetareparto.png',  label: 'Furgoneta de reparto' },
  { path: '/furgonetagranvolumen.png', label: 'Furgoneta gran volumen' },
  { path: '/camionreparto.png',     label: 'Camión rígido / reparto' },
  { path: '/camionarticulado.png',  label: 'Camión articulado' },
  { path: '/camionobras.png',       label: 'Camión de obras' },
] as const;

export function getVehicleImage(tipo: string): string | null {
  return (tipo in VEHICLE_IMAGES) ? VEHICLE_IMAGES[tipo] : null;
}

/** Devuelve la imagen a mostrar: image_path explícita > mapping por tipo > null. */
export function getVehicleDisplayImage(tipo: string, image_path?: string | null): string | null {
  if (image_path) return image_path;
  return getVehicleImage(tipo);
}
