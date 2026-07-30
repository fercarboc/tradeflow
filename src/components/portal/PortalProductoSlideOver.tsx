import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  PortalOffering, PortalOfferingIAEstado, MatchCandidate, OfferingEvent,
  updateSupplierOffering, updateOfferingImage, uploadOfferingImage,
  deleteOfferingImageFile, getOfferingEvents,
  matchOfferingToUP, unmatchOffering, getOfferingMatchCandidates,
  recordOfferingEvent,
  IA_ESTADO_LABELS, IA_ESTADO_COLORS,
} from '../../lib/api/marketplace-portal';

type SlideTab = 'datos' | 'imagen' | 'estado' | 'ia' | 'historial';

interface Props {
  actorId:   string;
  offering:  PortalOffering;
  canWrite:  boolean;
  canMatch:  boolean;
  onClose:   () => void;
  onUpdated: (patch: Partial<PortalOffering>) => void;
  initialTab?: SlideTab;
}

const FMT_EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const FMT_DATE = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ── Tab: Datos ────────────────────────────────────────────────────────────────

interface DatosProps {
  offering:  PortalOffering;
  actorId:   string;
  canWrite:  boolean;
  onUpdated: (patch: Partial<PortalOffering>) => void;
}

function SlideOverDatos({ offering, actorId, canWrite, onUpdated }: DatosProps) {
  const [form, setForm] = useState({
    descripcion_comercial: offering.descripcion_comercial ?? '',
    supplier_ref:          offering.supplier_ref ?? '',
    unidad:                offering.unidad ?? 'ud',
    precio_coste:          offering.precio_coste?.toString() ?? '',
    precio_venta:          offering.precio_venta?.toString() ?? '',
    stock_cantidad:        offering.stock_cantidad?.toString() ?? '',
    plazo_entrega_dias:    offering.plazo_entrega_dias?.toString() ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (k: keyof typeof form, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    setSaved(false);
    setError(null);
  };

  const handleSave = async () => {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    try {
      const coste  = form.precio_coste    ? parseFloat(form.precio_coste.replace(',', '.'))    : null;
      const venta  = form.precio_venta    ? parseFloat(form.precio_venta.replace(',', '.'))    : null;
      const stock  = form.stock_cantidad  ? parseInt(form.stock_cantidad)                      : null;
      const plazo  = form.plazo_entrega_dias ? parseInt(form.plazo_entrega_dias)               : undefined;

      await updateSupplierOffering(offering.id, {
        descripcion_comercial: form.descripcion_comercial || undefined,
        unidad:                form.unidad || undefined,
        precio_coste:          coste,
        precio_venta:          venta,
        stock_cantidad:        stock,
        plazo_entrega_dias:    plazo,
      }, actorId);

      onUpdated({
        descripcion_comercial: form.descripcion_comercial || offering.descripcion_comercial,
        unidad:                form.unidad || offering.unidad,
        precio_coste:          coste,
        precio_venta:          venta,
        stock_cantidad:        stock,
        plazo_entrega_dias:    plazo ?? offering.plazo_entrega_dias,
      });

      setSaved(true);
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Referencia
        </label>
        <p className="font-mono text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          {form.supplier_ref || <span className="text-slate-400">—</span>}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">Identificador único del proveedor. No editable.</p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
          Descripción comercial
        </label>
        <textarea
          rows={2}
          value={form.descripcion_comercial}
          onChange={e => handleChange('descripcion_comercial', e.target.value)}
          disabled={!canWrite}
          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none disabled:opacity-60"
        />
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Precios</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Coste (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.precio_coste}
              onChange={e => handleChange('precio_coste', e.target.value)}
              disabled={!canWrite}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Venta (€)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.precio_venta}
              onChange={e => handleChange('precio_venta', e.target.value)}
              disabled={!canWrite}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Logística</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Unidad
            </label>
            <input
              type="text"
              value={form.unidad}
              onChange={e => handleChange('unidad', e.target.value)}
              disabled={!canWrite}
              placeholder="ud, m2, kg..."
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Stock (uds)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.stock_cantidad}
              onChange={e => handleChange('stock_cantidad', e.target.value)}
              disabled={!canWrite}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Plazo (días)
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={form.plazo_entrega_dias}
              onChange={e => handleChange('plazo_entrega_dias', e.target.value)}
              disabled={!canWrite}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {canWrite && (
        <button
          onClick={handleSave}
          disabled={saving}
          className={`w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
            saved
              ? 'bg-emerald-500 text-white cursor-default'
              : 'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-60'
          }`}
        >
          {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      )}

      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-400 space-y-0.5">
        <p>Creado: {FMT_DATE.format(new Date(offering.created_at))}</p>
        <p>Actualizado: {FMT_DATE.format(new Date(offering.updated_at))}</p>
      </div>
    </div>
  );
}

// ── Tab: Imagen ───────────────────────────────────────────────────────────────

interface ImagenProps {
  offering:  PortalOffering;
  actorId:   string;
  canWrite:  boolean;
  onUpdated: (patch: Partial<PortalOffering>) => void;
}

function SlideOverImagen({ offering, actorId, canWrite, onUpdated }: ImagenProps) {
  const [imageUrl,   setImageUrl]   = useState<string | null>(offering.image_url);
  const [uploading,  setUploading]  = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const MAX = 5 * 1024 * 1024;
    if (file.size > MAX) { setError('La imagen no puede superar 5 MB.'); return; }
    if (!file.type.startsWith('image/')) { setError('El archivo debe ser una imagen (JPG, PNG, WebP).'); return; }
    setError(null);
    setUploading(true);
    try {
      const url = await uploadOfferingImage(actorId, offering.id, file);
      await updateOfferingImage(actorId, offering.id, url);
      setImageUrl(url);
      onUpdated({ image_url: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!imageUrl || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteOfferingImageFile(actorId, offering.id);
      await updateOfferingImage(actorId, offering.id, null);
      setImageUrl(null);
      onUpdated({ image_url: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al eliminar la imagen.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Preview */}
      <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden"
           style={{ minHeight: 220 }}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Imagen del producto"
            className="max-h-64 w-full object-contain p-2"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-slate-400">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
            </svg>
            <p className="text-sm">Sin imagen</p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {canWrite && (
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
          />
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || deleting}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:border-teal-500 hover:text-teal-600 dark:hover:text-teal-400 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Subiendo...' : imageUrl ? 'Sustituir imagen' : 'Subir imagen'}
          </button>
          {imageUrl && (
            <button
              onClick={handleDelete}
              disabled={uploading || deleting}
              className="rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {deleting ? '...' : 'Eliminar'}
            </button>
          )}
        </div>
      )}

      <p className="text-xs text-slate-400">Formatos admitidos: JPG, PNG, WebP. Tamaño máximo: 5 MB.</p>
    </div>
  );
}

// ── Tab: Estado ───────────────────────────────────────────────────────────────

interface EstadoProps {
  offering:  PortalOffering;
  actorId:   string;
  canWrite:  boolean;
  onUpdated: (patch: Partial<PortalOffering>) => void;
}

function SlideOverEstado({ offering, actorId, canWrite, onUpdated }: EstadoProps) {
  const [activa, setActiva]   = useState(offering.activa);
  const [saving, setSaving]   = useState(false);
  const [error,  setError]    = useState<string | null>(null);

  const toggle = async () => {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    const newActiva = !activa;
    try {
      await updateSupplierOffering(offering.id, { activa: newActiva }, actorId);
      setActiva(newActiva);
      onUpdated({ activa: newActiva });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cambiar el estado');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toggle card */}
      <div className={`rounded-xl border-2 p-6 transition-colors ${
        activa
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
      }`}>
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-lg font-bold ${activa ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {activa ? 'Activo' : 'Inactivo'}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {activa ? 'Visible en pedidos y catálogo TrabFlow' : 'Oculto para instaladores'}
            </p>
          </div>
          {canWrite && (
            <button
              onClick={toggle}
              disabled={saving}
              aria-label="Cambiar estado"
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                activa ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
              } ${saving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                activa ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          )}
        </div>
      </div>

      {/* Aviso inactivo */}
      {!activa && (
        <div className="flex gap-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 p-3">
          <svg className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
          </svg>
          <div className="text-xs text-amber-800 dark:text-amber-300">
            <p className="font-medium mb-1">Producto inactivo</p>
            <ul className="space-y-0.5 list-disc list-inside">
              <li>No aparece en búsquedas de instaladores</li>
              <li>No puede recibir pedidos nuevos</li>
              <li>No se incluye en cotizaciones automáticas</li>
              <li>No afecta a pedidos ya existentes</li>
            </ul>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}

// ── Tab: Motor IA ─────────────────────────────────────────────────────────────

interface IAProps {
  offering:  PortalOffering;
  actorId:   string;
  canMatch:  boolean;
  onUpdated: (patch: Partial<PortalOffering>) => void;
}

function SlideOverIA({ offering, actorId, canMatch, onUpdated }: IAProps) {
  const [current,    setCurrent]    = useState(offering);
  const [candidates, setCandidates] = useState<MatchCandidate[]>([]);
  const [query,      setQuery]      = useState('');
  const [loading,    setLoading]    = useState(true);
  const [matching,   setMatching]   = useState<string | null>(null);
  const [unmatching, setUnmatching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(current.match_state !== 'matched');
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadCandidates = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await getOfferingMatchCandidates(current.id, q || undefined, 8);
      setCandidates(res);
    } finally {
      setLoading(false);
    }
  }, [current.id]);

  useEffect(() => { loadCandidates(''); }, [loadCandidates]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => loadCandidates(v), 300);
  };

  const handleMatch = async (c: MatchCandidate) => {
    if (!canMatch || matching) return;
    setMatching(c.up_id);
    try {
      await matchOfferingToUP(current.id, c.up_id, 'supplier');
      await recordOfferingEvent({
        actorId,
        offeringId: current.id,
        tipo: 'ia_vinculado',
        datosDespues: { up_id: c.up_id, nombre_canonico: c.nombre_canonico, score: c.score },
      });
      const patch: Partial<PortalOffering> = {
        match_state:          'matched',
        universal_product_id: c.up_id,
        up_nombre_canonico:   c.nombre_canonico,
        up_familia:           c.familia,
        match_confidence:     c.score / 100,
        ia_estado:            'compatible',
        ia_explicacion:       'Vinculado al catálogo TrabFlow',
      };
      setCurrent(prev => ({ ...prev, ...patch }));
      onUpdated(patch);
      setSearchOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al vincular');
    } finally {
      setMatching(null);
    }
  };

  const handleUnmatch = async () => {
    if (!canMatch || unmatching) return;
    setUnmatching(true);
    try {
      await unmatchOffering(current.id);
      await recordOfferingEvent({
        actorId,
        offeringId: current.id,
        tipo: 'ia_desvinculado',
        datosDespues: {},
      });
      const patch: Partial<PortalOffering> = {
        match_state:          'pending_review',
        universal_product_id: null,
        up_nombre_canonico:   null,
        up_familia:           null,
        match_confidence:     null,
        ia_estado:            'revisar',
        ia_explicacion:       'Pendiente de revisión',
      };
      setCurrent(prev => ({ ...prev, ...patch }));
      onUpdated(patch);
      setSearchOpen(true);
      loadCandidates('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al desvincular');
    } finally {
      setUnmatching(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Estado actual */}
      <div className={`rounded-xl border p-4 ${
        current.match_state === 'matched'
          ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
      }`}>
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Motor IA</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Producto universal</p>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
              {current.up_nombre_canonico ?? <span className="text-slate-400 font-normal">Sin vincular</span>}
            </p>
            {current.up_familia && (
              <p className="text-xs text-slate-400">{current.up_familia}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Confianza</p>
            {current.match_confidence != null ? (
              <div>
                <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {Math.round(current.match_confidence * 100)}%
                </p>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-1 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      current.match_confidence >= 0.8
                        ? 'bg-emerald-500'
                        : current.match_confidence >= 0.5
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round(current.match_confidence * 100)}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Estado</p>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${IA_ESTADO_COLORS[current.ia_estado as PortalOfferingIAEstado] ?? ''}`}>
              {IA_ESTADO_LABELS[current.ia_estado as PortalOfferingIAEstado] ?? current.ia_estado}
            </span>
          </div>
          {current.match_state === 'matched' && (
            <div>
              <p className="text-xs text-slate-400 mb-0.5">Método</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 capitalize">
                {current.match_method ?? 'supplier'}
              </p>
            </div>
          )}
        </div>

        {canMatch && (
          <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={() => { setSearchOpen(o => !o); if (!searchOpen) loadCandidates(query); }}
              className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-teal-500 hover:text-teal-600 transition-colors"
            >
              {searchOpen ? 'Ocultar búsqueda' : current.match_state === 'matched' ? 'Seleccionar otro' : 'Buscar producto'}
            </button>
            {current.match_state === 'matched' && (
              <button
                onClick={handleUnmatch}
                disabled={unmatching}
                className="rounded-md border border-red-200 dark:border-red-800 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                {unmatching ? '...' : 'Desvincular'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Panel de búsqueda */}
      {searchOpen && canMatch && (
        <div className="space-y-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
              fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Nombre, EAN, familia..."
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <svg className="h-5 w-5 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : candidates.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">
                {query ? 'Sin resultados.' : 'Sin candidatos automáticos.'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Prueba con el nombre, EAN o familia.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {candidates.map(c => (
                <div key={c.up_id} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{c.nombre_canonico}</p>
                      {c.familia && <p className="text-xs text-slate-400">{c.familia}</p>}
                    </div>
                    <span className={`text-sm font-bold tabular-nums shrink-0 ${
                      c.score >= 80 ? 'text-emerald-600' : c.score >= 50 ? 'text-amber-600' : 'text-slate-500'
                    }`}>
                      {c.score}%
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.match_ean      && <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">EAN</span>}
                    {c.match_mpn      && <span className="rounded bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 text-xs text-emerald-700 dark:text-emerald-300">MPN</span>}
                    {c.match_marca    && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">Marca</span>}
                    {c.match_familia  && <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-1.5 py-0.5 text-xs text-blue-700 dark:text-blue-300">Familia</span>}
                    {c.match_descripcion && <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 text-xs text-slate-600 dark:text-slate-300">Descripción</span>}
                  </div>
                  <button
                    onClick={() => handleMatch(c)}
                    disabled={!!matching}
                    className={`w-full rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      matching === c.up_id
                        ? 'bg-teal-500 text-white cursor-wait'
                        : 'bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50'
                    }`}
                  >
                    {matching === c.up_id ? 'Vinculando...' : 'Vincular'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Tab: Historial ────────────────────────────────────────────────────────────

const TIPO_ICONS: Record<string, string> = {
  importado:      '📥',
  editado:        '✏️',
  precio:         '💰',
  stock:          '📦',
  imagen:         '🖼️',
  estado:         '🔘',
  ia_vinculado:   '🔗',
  ia_desvinculado: '🔓',
};

const TIPO_LABELS: Record<string, string> = {
  importado:      'Importado desde CSV',
  editado:        'Datos editados',
  precio:         'Precio actualizado',
  stock:          'Stock modificado',
  imagen:         'Imagen cambiada',
  estado:         'Estado cambiado',
  ia_vinculado:   'Vinculado al catálogo TrabFlow',
  ia_desvinculado: 'Desvinculado del catálogo TrabFlow',
};

interface HistorialProps {
  actorId:   string;
  offering:  PortalOffering;
}

function SlideOverHistorial({ actorId, offering }: HistorialProps) {
  const [events,  setEvents]  = useState<OfferingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getOfferingEvents(actorId, offering.id).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, [actorId, offering.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <svg className="h-5 w-5 animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-100 dark:bg-slate-800" />
        <ul className="space-y-4">
          {events.map(ev => (
            <li key={ev.id} className="relative pl-10">
              <div className="absolute left-2 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
                {TIPO_ICONS[ev.tipo] ?? '•'}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  {TIPO_LABELS[ev.tipo] ?? ev.tipo}
                </p>
                {ev.datos_despues && Object.keys(ev.datos_despues).length > 0 && (
                  <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                    {Object.entries(ev.datos_despues).map(([k, v]) => {
                      const antes = ev.datos_antes?.[k];
                      if (k === 'image_url') return null;
                      const fmt = (val: unknown) => {
                        if (val == null) return '—';
                        if (typeof val === 'boolean') return val ? 'Sí' : 'No';
                        if (k === 'precio_coste' || k === 'precio_venta') return FMT_EUR.format(Number(val));
                        return String(val);
                      };
                      return (
                        <p key={k}>
                          <span className="text-slate-400">{k.replace(/_/g, ' ')}: </span>
                          {antes !== undefined && antes !== v ? (
                            <><span className="line-through text-red-400">{fmt(antes)}</span> → <span className="text-emerald-600 dark:text-emerald-400">{fmt(v)}</span></>
                          ) : (
                            <span>{fmt(v)}</span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-0.5">
                  {FMT_DATE.format(new Date(ev.created_at))}
                </p>
              </div>
            </li>
          ))}

          {/* Entrada sintética: creación del producto */}
          <li className="relative pl-10">
            <div className="absolute left-2 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs">
              {TIPO_ICONS['importado']}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                Añadido al catálogo
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {FMT_DATE.format(new Date(offering.created_at))}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── SlideOver principal ───────────────────────────────────────────────────────

const TABS: { id: SlideTab; label: string }[] = [
  { id: 'datos',    label: 'Datos' },
  { id: 'imagen',   label: 'Imagen' },
  { id: 'estado',   label: 'Estado' },
  { id: 'ia',       label: 'Motor IA' },
  { id: 'historial', label: 'Historial' },
];

export default function PortalProductoSlideOver({
  actorId, offering: initialOffering, canWrite, canMatch, onClose, onUpdated, initialTab = 'datos',
}: Props) {
  const [offering, setOffering] = useState(initialOffering);
  const [tab, setTab] = useState<SlideTab>(initialTab);

  const handlePatch = useCallback((patch: Partial<PortalOffering>) => {
    setOffering(prev => ({ ...prev, ...patch }));
    onUpdated(patch);
  }, [onUpdated]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[440px] flex flex-col bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 py-4 flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {offering.image_url && (
              <img
                src={offering.image_url}
                alt=""
                className="h-8 w-8 rounded-md object-cover shrink-0 border border-slate-200 dark:border-slate-700"
              />
            )}
            {!offering.activa && (
              <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Inactivo
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-400 truncate">{offering.supplier_ref ?? '—'}</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug mt-0.5 line-clamp-2">
            {offering.descripcion_comercial ?? 'Producto sin descripción'}
          </p>
          {offering.precio_venta != null && (
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {FMT_EUR.format(offering.precio_venta)} / {offering.unidad}
            </p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 px-5 flex gap-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              tab === t.id
                ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {tab === 'datos' && (
          <SlideOverDatos
            offering={offering}
            actorId={actorId}
            canWrite={canWrite}
            onUpdated={handlePatch}
          />
        )}
        {tab === 'imagen' && (
          <SlideOverImagen
            offering={offering}
            actorId={actorId}
            canWrite={canWrite}
            onUpdated={handlePatch}
          />
        )}
        {tab === 'estado' && (
          <SlideOverEstado
            offering={offering}
            actorId={actorId}
            canWrite={canWrite}
            onUpdated={handlePatch}
          />
        )}
        {tab === 'ia' && (
          <SlideOverIA
            offering={offering}
            actorId={actorId}
            canMatch={canMatch}
            onUpdated={handlePatch}
          />
        )}
        {tab === 'historial' && (
          <SlideOverHistorial
            actorId={actorId}
            offering={offering}
          />
        )}
      </div>
    </div>
  );
}
