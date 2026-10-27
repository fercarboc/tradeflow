/**
 * vehicleKm.ts — Gestión de lecturas de odómetro de vehículos (TX-FLEET-ODO-1)
 * Cubre: historial de lecturas, correcciones INSERT-only.
 * Las lecturas de inicio/final de servicio se generan desde startTransportService
 * y completeTransportService respectivamente.
 */

import { supabase } from './supabase';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type KmReadingTipo =
  | 'inicio_servicio'
  | 'final_servicio'
  | 'manual'
  | 'sustitucion'
  | 'correccion';

export type KmReadingFuente = 'rpc' | 'manual' | 'importacion';

export interface VehicleKmReading {
  id: string;
  org_id: string;
  vehicle_id: string;
  tipo: KmReadingTipo;
  km: number;
  leido_en: string;
  servicio_id: string | null;
  fuente: KmReadingFuente;
  notas: string | null;
  corrige_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface VehicleKmReadingWithAnulada extends VehicleKmReading {
  /** true si esta lectura ha sido corregida por otra */
  anulada: boolean;
}

export interface KmCorrectionInput {
  corrige_id: string;
  km_correcto: number;
  leido_en?: string;
  notas?: string;
}

// ── Funciones ─────────────────────────────────────────────────────────────────

/**
 * Carga el historial de lecturas de un vehículo, ordenado por leido_en DESC.
 * Marca las lecturas anuladas (corregidas por otra lectura).
 */
export async function loadVehicleKmHistory(
  orgId: string,
  vehicleId: string,
  limit = 50,
): Promise<VehicleKmReadingWithAnulada[]> {
  const { data, error } = await supabase
    .from('trade_vehicle_km_readings')
    .select('*')
    .eq('org_id', orgId)
    .eq('vehicle_id', vehicleId)
    .order('leido_en', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const rows: VehicleKmReading[] = data ?? [];

  // Determinar qué lecturas están anuladas (tienen una corrección)
  const corregidas = new Set(
    rows
      .filter(r => r.corrige_id !== null)
      .map(r => r.corrige_id as string),
  );

  return rows.map(r => ({
    ...r,
    anulada: corregidas.has(r.id),
  }));
}

/**
 * Corrige una lectura errónea de odómetro.
 * Crea una nueva lectura de tipo 'correccion' que apunta a la errónea.
 * La lectura original NO se modifica (compliance).
 */
export async function correctVehicleKmReading(
  orgId: string,
  vehicleId: string,
  input: KmCorrectionInput,
): Promise<{ ok: boolean; correccion_id: string; km_correcto: number }> {
  const { data, error } = await supabase.rpc('correct_vehicle_km_reading', {
    p_org_id:      orgId,
    p_vehicle_id:  vehicleId,
    p_corrige_id:  input.corrige_id,
    p_km_correcto: input.km_correcto,
    p_leido_en:    input.leido_en ?? null,
    p_notas:       input.notas ?? null,
  });

  if (error) throw error;
  return data as { ok: boolean; correccion_id: string; km_correcto: number };
}
