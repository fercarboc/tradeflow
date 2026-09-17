import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Plus, X, ChevronLeft, ChevronRight, Trash2,
  Edit3, ImageIcon, Check, Loader2, AlertCircle, FileImage,
} from 'lucide-react';
import {
  loadQuotePhotos, uploadQuotePhoto, updateQuotePhoto, deleteQuotePhoto,
  getQuotePhotoSignedUrl,
  MAX_QUOTE_PHOTOS, MAX_QUOTE_DOCUMENT_PHOTOS, ALLOWED_QUOTE_MIME_TYPES,
  type TradeQuotePhoto,
} from '../lib/quotePhotos';
import { useToast, ToastContainer } from './ui/Toast';

// ── Props ─────────────────────────────────────────────────────────────────────

interface QuotePhotosPanelProps {
  quoteId: string | null;
  orgId: string;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PhotoWithUrl extends TradeQuotePhoto {
  signedUrl: string | null;
  urlLoading: boolean;
}

interface UploadState {
  name: string;
  status: 'preparing' | 'uploading' | 'done' | 'error';
  error?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('QUOTE_PHOTOS_LIMIT')) return 'Has alcanzado el máximo de 8 fotografías para este presupuesto.';
  if (msg.includes('QUOTE_DOC_PHOTOS_LIMIT')) return 'Solo puedes incluir un máximo de 3 fotos en el documento del presupuesto.';
  if (msg.includes('violates row-level security') || msg.includes('new row violates'))
    return 'Sin permiso para añadir fotos a este presupuesto.';
  return msg || 'Error desconocido.';
}

function isMobileDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function QuotePhotosPanel({ quoteId, orgId }: QuotePhotosPanelProps) {
  const { toasts, toast, dismiss } = useToast();

  const [photos, setPhotos] = useState<PhotoWithUrl[]>([]);
  const [loading, setLoading] = useState(false);

  const [uploadQueue, setUploadQueue] = useState<UploadState[]>([]);
  const uploading = uploadQueue.some(u => u.status === 'preparing' || u.status === 'uploading');

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<TradeQuotePhoto | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCaption, setEditCaption] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<TradeQuotePhoto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const isMobile = isMobileDevice();

  // ── Load photos ─────────────────────────────────────────────────────────────

  const loadPhotos = useCallback(async () => {
    if (!quoteId) return;
    setLoading(true);
    try {
      const raw = await loadQuotePhotos(quoteId);
      const withUrls: PhotoWithUrl[] = raw.map(p => ({ ...p, signedUrl: null, urlLoading: true }));
      setPhotos(withUrls);
      // Load signed URLs in parallel
      withUrls.forEach((p, idx) => {
        getQuotePhotoSignedUrl(p.storage_path)
          .then(url => setPhotos(prev => prev.map((x, i) => i === idx ? { ...x, signedUrl: url, urlLoading: false } : x)))
          .catch(() => setPhotos(prev => prev.map((x, i) => i === idx ? { ...x, urlLoading: false } : x)));
      });
    } catch (e) {
      toast('error', 'Error al cargar las fotografías.');
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (quoteId) loadPhotos();
    else setPhotos([]);
  }, [quoteId, loadPhotos]);

  // ── Lightbox keyboard ────────────────────────────────────────────────────────

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      else if (e.key === 'ArrowRight') setLightboxIndex(i => i !== null && i < photos.length - 1 ? i + 1 : i);
      else if (e.key === 'ArrowLeft') setLightboxIndex(i => i !== null && i > 0 ? i - 1 : i);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, photos.length]);

  // ── Upload ───────────────────────────────────────────────────────────────────

  const handleFiles = async (files: FileList | null) => {
    if (!files || !quoteId) return;
    const available = MAX_QUOTE_PHOTOS - photos.length;
    if (available <= 0) {
      toast('error', `Has alcanzado el máximo de ${MAX_QUOTE_PHOTOS} fotografías.`);
      return;
    }
    const accepted = Array.from(files).slice(0, available);
    const skipped = files.length - accepted.length;
    if (skipped > 0) toast('info', `Solo puedes añadir ${available} foto${available !== 1 ? 's' : ''} más. Las demás no se subirán.`);

    const queue: UploadState[] = accepted.map(f => ({ name: f.name, status: 'preparing' as const }));
    setUploadQueue(queue);

    let refreshNeeded = false;
    for (let i = 0; i < accepted.length; i++) {
      const file = accepted[i];

      // MIME validation
      if (!ALLOWED_QUOTE_MIME_TYPES.includes(file.type as typeof ALLOWED_QUOTE_MIME_TYPES[number])) {
        const msg = file.type === 'image/heic' || file.type === 'image/heif'
          ? 'Formato HEIC/HEIF no compatible. Convierte la foto a JPEG antes de subirla.'
          : `Formato "${file.type || 'desconocido'}" no compatible. Usa JPG, PNG o WebP.`;
        setUploadQueue(q => q.map((u, j) => j === i ? { ...u, status: 'error', error: msg } : u));
        continue;
      }

      setUploadQueue(q => q.map((u, j) => j === i ? { ...u, status: 'uploading' } : u));
      try {
        await uploadQuotePhoto({ quoteId, orgId, file, displayOrder: photos.length + i });
        setUploadQueue(q => q.map((u, j) => j === i ? { ...u, status: 'done' } : u));
        refreshNeeded = true;
      } catch (e) {
        const msg = friendlyError(e);
        setUploadQueue(q => q.map((u, j) => j === i ? { ...u, status: 'error', error: msg } : u));
        toast('error', msg);
      }
    }

    if (refreshNeeded) await loadPhotos();
    setTimeout(() => setUploadQueue([]), 3000);
  };

  // ── Include in document ──────────────────────────────────────────────────────

  const handleToggleDocument = async (photo: PhotoWithUrl) => {
    const docCount = photos.filter(p => p.include_in_document && p.id !== photo.id).length;
    if (!photo.include_in_document && docCount >= MAX_QUOTE_DOCUMENT_PHOTOS) {
      toast('error', `Puedes incluir un máximo de ${MAX_QUOTE_DOCUMENT_PHOTOS} fotos en el documento del presupuesto.`);
      return;
    }
    try {
      const updated = await updateQuotePhoto(photo.id, { include_in_document: !photo.include_in_document });
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, ...updated } : p));
    } catch (e) {
      toast('error', friendlyError(e));
    }
  };

  // ── Edit ─────────────────────────────────────────────────────────────────────

  const openEdit = (photo: TradeQuotePhoto) => {
    setEditingPhoto(photo);
    setEditLabel(photo.area_label ?? '');
    setEditCaption(photo.caption ?? '');
  };

  const handleSaveEdit = async () => {
    if (!editingPhoto) return;
    setSavingEdit(true);
    try {
      const updated = await updateQuotePhoto(editingPhoto.id, {
        area_label: editLabel.trim() || null,
        caption: editCaption.trim() || null,
      });
      setPhotos(prev => prev.map(p => p.id === editingPhoto.id ? { ...p, ...updated } : p));
      setEditingPhoto(null);
      toast('success', 'Foto actualizada.');
    } catch (e) {
      toast('error', friendlyError(e));
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await deleteQuotePhoto(confirmDelete);
      setPhotos(prev => prev.filter(p => p.id !== confirmDelete.id));
      if (lightboxIndex !== null) setLightboxIndex(null);
      toast('success', 'Fotografía eliminada.');
    } catch (e) {
      toast('error', friendlyError(e));
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  // ── Counters ─────────────────────────────────────────────────────────────────

  const photoCount = photos.length;
  const docCount = photos.filter(p => p.include_in_document).length;
  const atMax = photoCount >= MAX_QUOTE_PHOTOS;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
      <ToastContainer toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" aria-hidden />
            Fotos de referencia
          </h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Añade imágenes de la zona o elementos relacionados con el trabajo.
          </p>
        </div>

        {/* Counters */}
        <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
          <span className={photoCount >= MAX_QUOTE_PHOTOS ? 'text-red-500' : ''}>
            {photoCount} de {MAX_QUOTE_PHOTOS} fotos
          </span>
          <span className="text-slate-300">·</span>
          <span className={docCount >= MAX_QUOTE_DOCUMENT_PHOTOS ? 'text-amber-600' : ''}>
            {docCount} de {MAX_QUOTE_DOCUMENT_PHOTOS} para documento
          </span>
        </div>
      </div>

      {/* No quoteId guard */}
      {!quoteId ? (
        <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
          <FileImage className="w-5 h-5 text-slate-300 shrink-0" aria-hidden />
          <p className="text-xs text-slate-400">
            Guarda primero el presupuesto para poder añadir fotografías de referencia.
          </p>
        </div>
      ) : (
        <>
          {/* Upload buttons */}
          <div className="flex flex-wrap gap-2">
            {isMobile ? (
              <>
                <button
                  type="button"
                  disabled={atMax || uploading}
                  onClick={() => cameraInputRef.current?.click()}
                  aria-label="Hacer foto con la cámara"
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" aria-hidden />
                  Cámara
                </button>
                <button
                  type="button"
                  disabled={atMax || uploading}
                  onClick={() => galleryInputRef.current?.click()}
                  aria-label="Elegir fotos de la galería"
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden />
                  Galería
                </button>
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleFiles(e.target.files)} />
                <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFiles(e.target.files)} />
              </>
            ) : (
              <>
                <button
                  type="button"
                  disabled={atMax || uploading}
                  onClick={() => desktopInputRef.current?.click()}
                  aria-label="Añadir fotos"
                  className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700 border border-slate-200 px-3 py-2 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden />
                  Añadir fotos
                </button>
                <input ref={desktopInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={e => handleFiles(e.target.files)} />
              </>
            )}

            {atMax && (
              <p className="text-[10px] text-red-500 font-bold self-center" role="alert">
                Has alcanzado el máximo de {MAX_QUOTE_PHOTOS} fotografías.
              </p>
            )}
          </div>

          {/* Upload queue feedback */}
          {uploadQueue.length > 0 && (
            <div className="space-y-1" role="status" aria-live="polite">
              {uploadQueue.map((u, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] py-1">
                  {u.status === 'preparing' || u.status === 'uploading' ? (
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500 shrink-0" aria-hidden />
                  ) : u.status === 'done' ? (
                    <Check className="w-3 h-3 text-emerald-500 shrink-0" aria-hidden />
                  ) : (
                    <AlertCircle className="w-3 h-3 text-red-500 shrink-0" aria-hidden />
                  )}
                  <span className={`truncate flex-1 ${u.status === 'error' ? 'text-red-500' : 'text-slate-500'}`}>
                    {u.status === 'preparing' ? 'Preparando imagen...' :
                     u.status === 'uploading' ? 'Subiendo...' :
                     u.status === 'done' ? 'Subida completada' :
                     u.error || 'Error al subir'}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center gap-2 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-hidden />
              <span className="text-xs text-slate-400">Cargando fotografías...</span>
            </div>
          )}

          {/* Empty state */}
          {!loading && photos.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-slate-400">
              <ImageIcon className="w-10 h-10 text-slate-200" aria-hidden />
              <p className="text-xs">Sin fotografías todavía.</p>
              <p className="text-[10px] text-slate-300">
                Consejo: selecciona una foto representativa de cada zona o elemento.
              </p>
            </div>
          )}

          {/* Photo grid */}
          {!loading && photos.length > 0 && (
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}
            >
              {photos.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="relative group bg-slate-100 rounded-xl overflow-hidden border border-slate-200"
                >
                  {/* Thumbnail */}
                  <button
                    type="button"
                    aria-label={`Ver foto ${idx + 1}${photo.area_label ? `: ${photo.area_label}` : ''}`}
                    onClick={() => setLightboxIndex(idx)}
                    className="block w-full aspect-square focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {photo.urlLoading ? (
                      <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-300" aria-hidden />
                      </div>
                    ) : photo.signedUrl ? (
                      <img
                        src={photo.signedUrl}
                        alt={photo.area_label || `Foto ${idx + 1} del presupuesto`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-slate-300" aria-hidden />
                      </div>
                    )}
                  </button>

                  {/* Overlay: labels + actions */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    {photo.area_label && (
                      <p className="text-[9px] font-bold text-white truncate leading-tight">{photo.area_label}</p>
                    )}
                    {photo.caption && (
                      <p className="text-[9px] text-white/70 truncate leading-tight">{photo.caption}</p>
                    )}
                  </div>

                  {/* Document badge */}
                  <button
                    type="button"
                    onClick={() => handleToggleDocument(photo)}
                    aria-label={photo.include_in_document ? 'Quitar del documento' : 'Incluir en presupuesto'}
                    aria-pressed={photo.include_in_document}
                    className={`absolute top-1.5 left-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-black border transition-colors cursor-pointer ${
                      photo.include_in_document
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'bg-white/80 border-white/60 text-slate-400 hover:bg-white'
                    }`}
                    title={photo.include_in_document ? 'Incluida en documento' : 'Incluir en documento'}
                  >
                    {photo.include_in_document ? '✓' : 'D'}
                  </button>

                  {/* Action buttons (visible on hover / always on touch) */}
                  <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => openEdit(photo)}
                      aria-label="Editar etiqueta y descripción"
                      className="w-6 h-6 rounded-lg bg-white/90 hover:bg-white flex items-center justify-center shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <Edit3 className="w-3 h-3 text-slate-600" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(photo)}
                      aria-label="Eliminar fotografía"
                      className="w-6 h-6 rounded-lg bg-white/90 hover:bg-red-50 flex items-center justify-center shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" aria-hidden />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Doc photos counter note */}
          {photos.length > 0 && (
            <p className="text-[10px] text-slate-400">
              Las fotos marcadas con <strong>D</strong> se incluirán en el documento del presupuesto cuando se genere (PDF/Word).{' '}
              {docCount >= MAX_QUOTE_DOCUMENT_PHOTOS && (
                <span className="text-amber-600 font-bold">Límite de {MAX_QUOTE_DOCUMENT_PHOTOS} alcanzado.</span>
              )}
            </p>
          )}
        </>
      )}

      {/* ── Lightbox ──────────────────────────────────────────────────────────── */}
      {lightboxIndex !== null && photos.length > 0 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista de fotografía ampliada"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Prev */}
          {lightboxIndex > 0 && (
            <button
              type="button"
              aria-label="Fotografía anterior"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 1) - 1); }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
            >
              <ChevronLeft className="w-5 h-5" aria-hidden />
            </button>
          )}

          {/* Image */}
          <div className="max-w-[90vw] max-h-[90vh] flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            {photos[lightboxIndex].signedUrl ? (
              <img
                src={photos[lightboxIndex].signedUrl!}
                alt={photos[lightboxIndex].area_label ?? `Foto ${lightboxIndex + 1} del presupuesto`}
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center text-white/40">
                <ImageIcon className="w-12 h-12" aria-hidden />
              </div>
            )}
            <div className="text-center">
              {photos[lightboxIndex].area_label && (
                <p className="text-white text-sm font-bold">{photos[lightboxIndex].area_label}</p>
              )}
              {photos[lightboxIndex].caption && (
                <p className="text-white/60 text-xs mt-0.5">{photos[lightboxIndex].caption}</p>
              )}
              <p className="text-white/40 text-xs font-mono mt-1">
                {lightboxIndex + 1} / {photos.length}
              </p>
            </div>
          </div>

          {/* Next */}
          {lightboxIndex < photos.length - 1 && (
            <button
              type="button"
              aria-label="Fotografía siguiente"
              onClick={e => { e.stopPropagation(); setLightboxIndex(i => (i ?? 0) + 1); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
            >
              <ChevronRight className="w-5 h-5" aria-hidden />
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            aria-label="Cerrar vista de fotografía"
            onClick={() => setLightboxIndex(null)}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────────── */}
      {editingPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Editar fotografía"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditingPhoto(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <h4 className="font-black text-slate-800 text-sm">Editar fotografía</h4>
              <button type="button" aria-label="Cerrar" onClick={() => setEditingPhoto(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="qp-label" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Zona / elemento
                </label>
                <input
                  id="qp-label"
                  type="text"
                  value={editLabel}
                  onChange={e => setEditLabel(e.target.value)}
                  maxLength={120}
                  placeholder="Ej. Cocina, cuadro eléctrico, jardín norte..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label htmlFor="qp-caption" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Descripción
                </label>
                <input
                  id="qp-caption"
                  type="text"
                  value={editCaption}
                  onChange={e => setEditCaption(e.target.value)}
                  maxLength={240}
                  placeholder="Ej. Humedad visible junto a la ventana"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button type="button" onClick={() => setEditingPhoto(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-300">
                Cancelar
              </button>
              <button type="button" onClick={handleSaveEdit} disabled={savingEdit}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setConfirmDelete(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" aria-hidden />
              <div>
                <p className="text-sm font-bold text-slate-800">¿Eliminar esta fotografía?</p>
                {confirmDelete.area_label && (
                  <p className="text-xs text-slate-500 mt-0.5">{confirmDelete.area_label}</p>
                )}
                <p className="text-xs text-slate-400 mt-1">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-300">
                Cancelar
              </button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
