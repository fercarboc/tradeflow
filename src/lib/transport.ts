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

export function getVehicleImage(tipo: string): string | null {
  return (tipo in VEHICLE_IMAGES) ? VEHICLE_IMAGES[tipo] : null;
}
