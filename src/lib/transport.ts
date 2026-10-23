/**
 * transport.ts — Módulo de Transporte de Viajeros
 * TRANSPORT-CORE-1A: flota de vehículos por organización.
 * Sin rutas recurrentes, sin fiscal, sin contratos.
 */

import { supabase } from './supabase';

// ── Catálogos ─────────────────────────────────────────────────────────────────

export const VEHICLE_TIPOS = [
  { value: 'furgoneta',  label: 'Furgoneta' },
  { value: 'microbus',   label: 'Microbús' },
  { value: 'autocar',    label: 'Autocar' },
  { value: 'sedan',      label: 'Turismo/Sedan' },
  { value: 'minivan',    label: 'Monovolumen' },
  { value: 'otro',       label: 'Otro' },
] as const;

export const VEHICLE_ESTADOS = [
  { value: 'disponible',       label: 'Disponible',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'en_servicio',      label: 'En servicio',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'en_mantenimiento', label: 'En mantenimiento', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'baja',             label: 'Baja',            color: 'bg-red-100 text-red-700 border-red-200' },
] as const;

export type VehicleTipo   = typeof VEHICLE_TIPOS[number]['value'];
export type VehicleEstado = typeof VEHICLE_ESTADOS[number]['value'];

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TradeVehicle {
  id: string;
  org_id: string;
  nombre: string;
  matricula: string;
  tipo: VehicleTipo;
  capacidad_viajeros: number;
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
 *  Mínimo 5 caracteres, máximo 10, solo letras, números y guión/espacio. */
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
  if (input.capacidad_viajeros < 1 || input.capacidad_viajeros > 90) {
    throw new Error('La capacidad debe estar entre 1 y 90 viajeros');
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
  if (updates.capacidad_viajeros !== undefined &&
      (updates.capacidad_viajeros < 1 || updates.capacidad_viajeros > 90)) {
    throw new Error('La capacidad debe estar entre 1 y 90 viajeros');
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
