import { supabase } from '../client';

export interface ActuacionAdminRow {
  id: string;
  actuacion_id: string;
  oficio: string;
  observaciones: string;
  palabras_clave: string[];
  partidas_obligatorias: string[];
  partidas_auxiliares: string[];
  reglas_calculo: string;
  unidad: string;
  activo: boolean;
  precio_min: number | null;
  precio_max: number | null;
  usage_count: number | null;
  last_used_at: string | null;
}

export async function adminLoadActuaciones(oficio?: string, q?: string): Promise<ActuacionAdminRow[]> {
  let query = supabase
    .from('trade_actuaciones')
    .select('id,actuacion_id,oficio,observaciones,palabras_clave,partidas_obligatorias,partidas_auxiliares,reglas_calculo,unidad,activo,precio_min,precio_max,usage_count,last_used_at')
    .order('oficio', { ascending: true })
    .order('actuacion_id', { ascending: true })
    .limit(500);

  if (oficio && oficio !== 'all') query = query.eq('oficio', oficio);
  if (q) query = query.ilike('actuacion_id', `%${q}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ActuacionAdminRow[];
}

export async function adminToggleActuacionActivo(id: string, activo: boolean): Promise<void> {
  const { error } = await supabase
    .from('trade_actuaciones')
    .update({ activo, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adminUpdateActuacionPrecios(
  id: string,
  precio_min: number | null,
  precio_max: number | null,
): Promise<void> {
  const { error } = await supabase
    .from('trade_actuaciones')
    .update({ precio_min, precio_max, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adminUpdateActuacionObservaciones(id: string, observaciones: string): Promise<void> {
  const { error } = await supabase
    .from('trade_actuaciones')
    .update({ observaciones, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adminGetActuacionesStats(): Promise<{ oficio: string; total: number; activas: number; con_precio: number }[]> {
  const { data, error } = await supabase
    .from('trade_actuaciones')
    .select('oficio,activo,precio_min');
  if (error) throw error;

  const map = new Map<string, { total: number; activas: number; con_precio: number }>();
  for (const row of (data ?? [])) {
    const cur = map.get(row.oficio) ?? { total: 0, activas: 0, con_precio: 0 };
    cur.total++;
    if (row.activo) cur.activas++;
    if (row.precio_min != null) cur.con_precio++;
    map.set(row.oficio, cur);
  }
  return Array.from(map.entries())
    .map(([oficio, s]) => ({ oficio, ...s }))
    .sort((a, b) => b.total - a.total);
}
