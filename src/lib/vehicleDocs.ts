import { supabase } from './supabase';

export type VehicleDocTipo =
  | 'itv'
  | 'seguro'
  | 'permiso_circulacion'
  | 'autorizacion_vvc'
  | 'autorizacion_mdp'
  | 'autorizacion_vde'
  | 'autorizacion_tpc'
  | 'certificado_tacografo'
  | 'otro';

export const VEHICLE_DOC_TIPO_LABELS: Record<VehicleDocTipo, string> = {
  itv:                   'Ficha ITV',
  seguro:                'Documento de seguro',
  permiso_circulacion:   'Permiso de circulación',
  autorizacion_vvc:      'Autorización VVC',
  autorizacion_mdp:      'Autorización MDP',
  autorizacion_vde:      'Autorización VDE',
  autorizacion_tpc:      'Autorización TPC',
  certificado_tacografo: 'Certificado tacógrafo',
  otro:                  'Otro documento',
};

export interface VehicleDoc {
  id: string;
  org_id: string;
  vehicle_id: string;
  tipo: VehicleDocTipo;
  titulo: string;
  descripcion: string | null;
  fecha_doc: string | null;
  fecha_vencimiento: string | null;
  storage_path: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleDocInput {
  tipo: VehicleDocTipo;
  titulo: string;
  descripcion?: string | null;
  fecha_doc?: string | null;
  fecha_vencimiento?: string | null;
  storage_path?: string | null;
}

export const VEHICLE_DOCS_BUCKET = 'vehicle-docs';

/** Construye la ruta de Storage para un documento de vehículo: {org_id}/{vehicle_id}/{filename} */
export function vehicleDocStoragePath(
  orgId: string,
  vehicleId: string,
  filename: string,
): string {
  return `${orgId}/${vehicleId}/${filename}`;
}

/**
 * Verifica que un storage_path tenga el formato correcto y pertenezca
 * a la organización y vehículo indicados.
 * Lanza si no cumple (protección contra borrados/accesos fuera de scope).
 */
export function assertStoragePathOwnership(
  storagePath: string,
  orgId: string,
  vehicleId: string,
): void {
  const parts = storagePath.split('/');
  if (
    parts.length < 3
    || parts[0] !== orgId
    || parts[1] !== vehicleId
    || !parts[2]
  ) {
    throw new Error(
      `VEHICLE_DOCS_INVALID_PATH: ruta "${storagePath}" no corresponde a ` +
      `org "${orgId}" / vehículo "${vehicleId}"`,
    );
  }
}

/**
 * Elimina el objeto de Storage verificando previamente que pertenece a la
 * organización y vehículo autorizados.
 * Lanza si la ruta es inválida o si la eliminación falla.
 */
export async function removeVehicleDocFileSafe(
  storagePath: string,
  orgId: string,
  vehicleId: string,
): Promise<void> {
  assertStoragePathOwnership(storagePath, orgId, vehicleId);
  await removeVehicleDocFile(storagePath);
}

export async function loadVehicleDocs(
  orgId: string,
  vehicleId: string,
): Promise<VehicleDoc[]> {
  const { data, error } = await supabase
    .from('trade_vehicle_docs')
    .select('*')
    .eq('org_id', orgId)
    .eq('vehicle_id', vehicleId)
    .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as VehicleDoc[];
}

export async function createVehicleDoc(
  orgId: string,
  vehicleId: string,
  input: VehicleDocInput,
): Promise<VehicleDoc> {
  const { data, error } = await supabase
    .from('trade_vehicle_docs')
    .insert([{ ...input, org_id: orgId, vehicle_id: vehicleId }])
    .select()
    .single();
  if (error) throw error;
  return data as VehicleDoc;
}

export async function deleteVehicleDoc(id: string, orgId: string): Promise<void> {
  const { error } = await supabase
    .from('trade_vehicle_docs')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId);
  if (error) throw error;
}

/** Obtiene una URL firmada (temporal) para descargar un documento privado. */
export async function getVehicleDocSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VEHICLE_DOCS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Sube un archivo al bucket privado de documentos de vehículos.
 * Devuelve el storage_path del objeto creado.
 */
export async function uploadVehicleDocFile(
  orgId: string,
  vehicleId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const path = vehicleDocStoragePath(orgId, vehicleId, filename);
  const { error } = await supabase.storage
    .from(VEHICLE_DOCS_BUCKET)
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/** Elimina el objeto de Storage asociado a un documento. */
export async function removeVehicleDocFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(VEHICLE_DOCS_BUCKET)
    .remove([storagePath]);
  if (error) throw error;
}
