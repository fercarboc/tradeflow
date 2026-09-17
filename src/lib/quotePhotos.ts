import { supabase } from './supabase';

// ── Constants ─────────────────────────────────────────────────────────────────
export const MAX_QUOTE_PHOTOS = 8;
export const MAX_QUOTE_DOCUMENT_PHOTOS = 3;
export const SIGNED_URL_TTL_SECONDS = 3600; // 1 hora
export const BUCKET = 'trade-quote-photos' as const;

// HEIC/HEIF: declarados como MIME válidos en el bucket de Storage (servidor),
// pero excluidos aquí porque el soporte en navegadores móviles es heterogéneo.
// Gap documentado: usuario con HEIC debe convertir a JPEG antes de subir.
export const ALLOWED_QUOTE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedQuoteMimeType = (typeof ALLOWED_QUOTE_MIME_TYPES)[number];

// ── Types ─────────────────────────────────────────────────────────────────────
// Nota: NO existe campo photo_url. El bucket es privado.
// Las URLs se generan como signed URLs temporales via getQuotePhotoSignedUrl().
export interface TradeQuotePhoto {
  id: string;
  quote_id: string;
  org_id: string;
  storage_path: string;
  area_label: string | null;
  caption: string | null;
  display_order: number;
  include_in_document: boolean;
  created_by: string;
  created_at: string;
}

export interface UploadQuotePhotoParams {
  quoteId: string;
  orgId: string;
  file: File;
  areaLabel?: string;
  caption?: string;
  displayOrder?: number;
}

export interface UpdateQuotePhotoParams {
  area_label?: string | null;
  caption?: string | null;
  display_order?: number;
  include_in_document?: boolean;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

export function validateMimeType(file: File): void {
  if (file.type === 'image/heic' || file.type === 'image/heif') {
    throw new Error(
      'Formato HEIC/HEIF no compatible en este navegador. Convierte la foto a JPEG antes de subirla.',
    );
  }
  if (!ALLOWED_QUOTE_MIME_TYPES.includes(file.type as AllowedQuoteMimeType)) {
    throw new Error(
      `Formato no admitido: ${file.type || 'desconocido'}. Usa JPEG, PNG o WebP.`,
    );
  }
}

// Path grammar: {org_id}/quotes/{quote_id}/{uuid}.jpg
// uuid via crypto.randomUUID() — unicidad garantizada sin colisiones de timestamp.
export function buildStoragePath(orgId: string, quoteId: string): string {
  const filename = `${crypto.randomUUID()}.jpg`;
  return `${orgId}/quotes/${quoteId}/${filename}`;
}

// ── Compression (browser-only, Canvas API) ────────────────────────────────────
// Gap documentado: EXIF orientation no corregido (requeriría biblioteca externa).
// Gap documentado: HEIC no decodificable nativamente en la mayoría de navegadores.
// Parámetros por defecto: 1600px lado máximo, JPEG, calidad 0.82.
export async function compressQuotePhoto(
  file: File,
  maxPx = 1600,
  quality = 0.82,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width >= height) {
          height = Math.round((height * maxPx) / width);
          width = maxPx;
        } else {
          width = Math.round((width * maxPx) / height);
          height = maxPx;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas no disponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error('Error al comprimir la imagen')),
        'image/jpeg',
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          'No se pudo decodificar la imagen. Comprueba que el archivo no está corrupto.',
        ),
      );
    };
    img.src = objectUrl;
  });
}

// ── Async helpers ─────────────────────────────────────────────────────────────

export async function loadQuotePhotos(quoteId: string): Promise<TradeQuotePhoto[]> {
  const { data, error } = await supabase
    .from('trade_quote_photos')
    .select('*')
    .eq('quote_id', quoteId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TradeQuotePhoto[];
}

// ── Document photo types ──────────────────────────────────────────────────────

export interface PreparedDocumentPhoto {
  storage_path: string;
  area_label: string | null;
  caption: string | null;
  dataUrl: string;
}

export interface PreparedWordPhoto {
  storage_path: string;
  area_label: string | null;
  caption: string | null;
  arrayBuffer: ArrayBuffer;
  mimeType: string;
  naturalWidth: number;
  naturalHeight: number;
}

export async function loadQuoteDocumentPhotos(quoteId: string): Promise<TradeQuotePhoto[]> {
  const { data, error } = await supabase
    .from('trade_quote_photos')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('include_in_document', true)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(MAX_QUOTE_DOCUMENT_PHOTOS);
  if (error) throw error;
  return (data ?? []) as TradeQuotePhoto[];
}

export async function getQuotePhotoAsDataUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error ?? new Error('No se pudo descargar la foto');
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:')) {
        resolve(result);
      } else {
        reject(new Error('FileReader no devolvió un data URL válido'));
      }
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen'));
    reader.readAsDataURL(data);
  });
}

export async function getQuotePhotoAsArrayBuffer(storagePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error ?? new Error('No se pudo descargar la foto');
  return data.arrayBuffer();
}

export async function downloadQuotePhotoRaw(storagePath: string): Promise<{ arrayBuffer: ArrayBuffer; mimeType: string }> {
  const { data, error } = await supabase.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw error ?? new Error('No se pudo descargar la foto');
  const mimeType = data.type || 'image/jpeg';
  const arrayBuffer = await data.arrayBuffer();
  return { arrayBuffer, mimeType };
}

export async function getQuotePhotoSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('No se pudo generar la URL de la foto');
  }
  return data.signedUrl;
}

// uploadQuotePhoto: atómica — Storage primero, DB después.
// Si DB falla: se intenta limpiar el objeto de Storage (rollback).
// Si el cleanup de Storage también falla: se registra el Storage orphan (sin fila DB asociada).
export async function uploadQuotePhoto(
  params: UploadQuotePhotoParams,
  // Inyectable para pruebas unitarias (evita dependencia de Canvas/Image en jsdom)
  compress: (file: File) => Promise<Blob> = compressQuotePhoto,
): Promise<TradeQuotePhoto> {
  const { quoteId, orgId, file, areaLabel, caption, displayOrder = 0 } = params;

  validateMimeType(file);

  const compressed = await compress(file);
  const storagePath = buildStoragePath(orgId, quoteId);

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, compressed, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  try {
    const { data, error } = await supabase
      .from('trade_quote_photos')
      .insert({
        quote_id: quoteId,
        org_id: orgId,
        storage_path: storagePath,
        area_label: areaLabel ?? null,
        caption: caption ?? null,
        display_order: displayOrder,
        include_in_document: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as TradeQuotePhoto;
  } catch (err) {
    // Rollback: intento de eliminar el objeto ya subido a Storage
    await supabase.storage
      .from(BUCKET)
      .remove([storagePath])
      .catch(() => {
        // Storage orphan: el objeto existe en Storage pero no hay fila DB.
        // El bucket es privado; el orphan es inaccesible desde la app.
        // Gap documentado: limpieza periódica no implementada en PH0.
        console.warn('[quotePhotos] Storage orphan tras fallo de DB insert:', storagePath);
      });
    throw err;
  }
}

export async function updateQuotePhoto(
  id: string,
  patch: UpdateQuotePhotoParams,
): Promise<TradeQuotePhoto> {
  const { data, error } = await supabase
    .from('trade_quote_photos')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as TradeQuotePhoto;
}

// deleteQuotePhoto: DB primero, Storage después (orden inverso al de job photos).
// Razón: si DB falla → nada cambia (fila aún existe, foto visible en app) → seguro relanzar.
//        si Storage falla → fila ya eliminada, orphan en Storage inaccesible → no bloquea UX.
// El Storage orphan se registra como warn; no relanza para no bloquear al usuario.
export async function deleteQuotePhoto(photo: TradeQuotePhoto): Promise<void> {
  const { error: dbErr } = await supabase
    .from('trade_quote_photos')
    .delete()
    .eq('id', photo.id);
  if (dbErr) throw dbErr;

  const { error: stErr } = await supabase.storage
    .from(BUCKET)
    .remove([photo.storage_path]);
  if (stErr) {
    console.warn(
      '[quotePhotos] Storage delete falló tras DB delete:',
      photo.storage_path,
      stErr.message,
    );
    // No relanzar: la foto ya no existe en DB. El orphan es inaccesible desde la app.
  }
}
