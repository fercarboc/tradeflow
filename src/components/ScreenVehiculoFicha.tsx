import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Edit2, FileText, Gauge, Clock,
  Plus, Trash2, Download, CheckCircle, AlertCircle,
  XCircle, HelpCircle, Loader2, Bus, History, X,
} from 'lucide-react';
import type { TradeVehicle, VehicleEstado } from '../lib/transport';
import { updateVehicle, VEHICLE_TIPOS, VEHICLE_MODALIDADES, VEHICLE_ESTADOS, getVehicleDisplayImage } from '../lib/transport';
import {
  loadVehicleDocs, createVehicleDoc, deleteVehicleDoc,
  getVehicleDocSignedUrl, uploadVehicleDocFile, removeVehicleDocFile,
  VEHICLE_DOC_TIPO_LABELS,
  type VehicleDoc, type VehicleDocTipo,
} from '../lib/vehicleDocs';
import { loadVehicleKmHistory } from '../lib/vehicleKm';
import type { VehicleKmReadingWithAnulada } from '../lib/vehicleKm';
import { loadPartesCompletados } from '../lib/transportServices';
import type { TradeTransportService } from '../lib/transportServices';
import {
  getVencimientoState, VENCIMIENTO_DISPLAY, fmtDate,
} from '../lib/vencimientoUtils';

// ── Tipos ─────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'documentacion' | 'kilometraje' | 'historial';

interface Props {
  vehicle: TradeVehicle;
  orgId: string;
  canWrite: boolean;
  onClose: () => void;
  onVehicleUpdated: (v: TradeVehicle) => void;
  onEditVehicle: (v: TradeVehicle) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : 'Error desconocido';
}

function tipoLabel(tipo: string) {
  return VEHICLE_TIPOS.find(t => t.value === tipo)?.label ?? tipo;
}

function modalidadCfg(modalidad: string) {
  return VEHICLE_MODALIDADES.find(m => m.value === modalidad) ?? VEHICLE_MODALIDADES[0];
}

function estadoCfg(estado: VehicleEstado) {
  return VEHICLE_ESTADOS.find(e => e.value === estado) ?? VEHICLE_ESTADOS[0];
}

const KM_TIPO_LABELS: Record<string, string> = {
  inicio_servicio: 'Inicio de servicio',
  final_servicio:  'Final de servicio',
  manual:          'Lectura manual',
  correccion:      'Corrección',
};

const TABS: { id: Tab; label: string }[] = [
  { id: 'general',       label: 'Datos generales' },
  { id: 'documentacion', label: 'Documentación' },
  { id: 'kilometraje',   label: 'Kilometraje' },
  { id: 'historial',     label: 'Historial' },
];

const EMPTY_TIPOS = Object.keys(VEHICLE_DOC_TIPO_LABELS) as VehicleDocTipo[];

// ── Componente ────────────────────────────────────────────────────────────────

export default function ScreenVehiculoFicha({
  vehicle,
  orgId,
  canWrite,
  onClose,
  onVehicleUpdated,
  onEditVehicle,
  showToast,
}: Props) {
  const [tab, setTab] = useState<Tab>('general');
  const [vehicleLocal, setVehicleLocal] = useState<TradeVehicle>(vehicle);

  // Sync local copy when parent passes a new vehicle (e.g. after edit)
  useEffect(() => { setVehicleLocal(vehicle); }, [vehicle]);

  // ── TAB: Documentación ──────────────────────────────────────────────────────

  const [docs, setDocs] = useState<VehicleDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const docsLoadedRef = useRef(false);

  // ITV/seguro inline edit
  const [editingITV, setEditingITV] = useState(false);
  const [itvFechaUltima, setItvFechaUltima] = useState(vehicleLocal.itv_fecha_ultima ?? '');
  const [itvVencimiento, setItvVencimiento] = useState(vehicleLocal.itv_fecha_vencimiento ?? '');
  const [savingITV, setSavingITV] = useState(false);

  const [editingSeguro, setEditingSeguro] = useState(false);
  const [seguroCompania, setSeguroCompania] = useState(vehicleLocal.seguro_compania ?? '');
  const [seguroRef, setSeguroRef] = useState(vehicleLocal.seguro_referencia ?? '');
  const [seguroVencimiento, setSeguroVencimiento] = useState(vehicleLocal.seguro_vencimiento ?? '');
  const [savingSeguro, setSavingSeguro] = useState(false);

  // Add doc form
  const [addingDoc, setAddingDoc] = useState(false);
  const [newDocTipo, setNewDocTipo] = useState<VehicleDocTipo>('otro');
  const [newDocTitulo, setNewDocTitulo] = useState('');
  const [newDocFecha, setNewDocFecha] = useState('');
  const [newDocVencimiento, setNewDocVencimiento] = useState('');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingDocConfirm, setDeletingDocConfirm] = useState<string | null>(null);

  // ── TAB: Kilometraje ────────────────────────────────────────────────────────

  const [kmReadings, setKmReadings] = useState<VehicleKmReadingWithAnulada[]>([]);
  const [kmLoading, setKmLoading] = useState(false);
  const kmLoadedRef = useRef(false);

  // ── TAB: Historial ──────────────────────────────────────────────────────────

  const [partes, setPartes] = useState<TradeTransportService[]>([]);
  const [partesLoading, setPartesLoading] = useState(false);
  const partesLoadedRef = useRef(false);

  // ── Efectos de carga por tab ─────────────────────────────────────────────────

  useEffect(() => {
    if (tab === 'documentacion' && !docsLoadedRef.current) {
      docsLoadedRef.current = true;
      setDocsLoading(true);
      loadVehicleDocs(orgId, vehicleLocal.id)
        .then(setDocs)
        .catch(e => showToast(errMsg(e), 'error'))
        .finally(() => setDocsLoading(false));
    }
    if (tab === 'kilometraje' && !kmLoadedRef.current) {
      kmLoadedRef.current = true;
      setKmLoading(true);
      loadVehicleKmHistory(orgId, vehicleLocal.id)
        .then(setKmReadings)
        .catch(e => showToast(errMsg(e), 'error'))
        .finally(() => setKmLoading(false));
    }
    if (tab === 'historial' && !partesLoadedRef.current) {
      partesLoadedRef.current = true;
      setPartesLoading(true);
      loadPartesCompletados(orgId, { vehicleId: vehicleLocal.id })
        .then(r => setPartes(r.partes))
        .catch(e => showToast(errMsg(e), 'error'))
        .finally(() => setPartesLoading(false));
    }
  }, [tab, orgId, vehicleLocal.id, showToast]);

  // ── Acciones ITV ────────────────────────────────────────────────────────────

  async function handleSaveITV() {
    setSavingITV(true);
    try {
      const updated = await updateVehicle(vehicleLocal.id, orgId, {
        itv_fecha_ultima:      itvFechaUltima || null,
        itv_fecha_vencimiento: itvVencimiento || null,
      });
      setVehicleLocal(updated);
      onVehicleUpdated(updated);
      setEditingITV(false);
      showToast('ITV actualizada', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSavingITV(false);
    }
  }

  function handleCancelITV() {
    setItvFechaUltima(vehicleLocal.itv_fecha_ultima ?? '');
    setItvVencimiento(vehicleLocal.itv_fecha_vencimiento ?? '');
    setEditingITV(false);
  }

  // ── Acciones Seguro ─────────────────────────────────────────────────────────

  async function handleSaveSeguro() {
    setSavingSeguro(true);
    try {
      const updated = await updateVehicle(vehicleLocal.id, orgId, {
        seguro_compania:    seguroCompania || null,
        seguro_referencia:  seguroRef || null,
        seguro_vencimiento: seguroVencimiento || null,
      });
      setVehicleLocal(updated);
      onVehicleUpdated(updated);
      setEditingSeguro(false);
      showToast('Seguro actualizado', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSavingSeguro(false);
    }
  }

  function handleCancelSeguro() {
    setSeguroCompania(vehicleLocal.seguro_compania ?? '');
    setSeguroRef(vehicleLocal.seguro_referencia ?? '');
    setSeguroVencimiento(vehicleLocal.seguro_vencimiento ?? '');
    setEditingSeguro(false);
  }

  // ── Acciones documentos ─────────────────────────────────────────────────────

  async function handleAddDoc() {
    if (!newDocTitulo.trim()) { showToast('El título es obligatorio', 'error'); return; }
    setSavingDoc(true);
    try {
      let storagePath: string | null = null;
      if (newDocFile) {
        storagePath = await uploadVehicleDocFile(orgId, vehicleLocal.id, newDocFile);
      }
      const doc = await createVehicleDoc(orgId, vehicleLocal.id, {
        tipo:             newDocTipo,
        titulo:           newDocTitulo.trim(),
        fecha_doc:        newDocFecha || null,
        fecha_vencimiento: newDocVencimiento || null,
        storage_path:     storagePath,
      });
      setDocs(prev => [doc, ...prev]);
      setAddingDoc(false);
      setNewDocTitulo('');
      setNewDocFecha('');
      setNewDocVencimiento('');
      setNewDocFile(null);
      setNewDocTipo('otro');
      showToast('Documento añadido', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setSavingDoc(false);
    }
  }

  async function handleDeleteDoc(doc: VehicleDoc) {
    if (deletingDocConfirm !== doc.id) { setDeletingDocConfirm(doc.id); return; }
    setDeletingDocId(doc.id);
    try {
      if (doc.storage_path) {
        await removeVehicleDocFile(doc.storage_path).catch(() => {});
      }
      await deleteVehicleDoc(doc.id, orgId);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
      showToast('Documento eliminado', 'success');
    } catch (e) {
      showToast(errMsg(e), 'error');
    } finally {
      setDeletingDocId(null);
      setDeletingDocConfirm(null);
    }
  }

  async function handleDownloadDoc(doc: VehicleDoc) {
    if (!doc.storage_path) return;
    try {
      const url = await getVehicleDocSignedUrl(doc.storage_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      showToast('No se pudo obtener el enlace de descarga', 'error');
    }
  }

  // ── Render helpers (llamados como funciones, no como componentes) ─────────────

  function renderVencimientoBadge(fecha: string | null | undefined) {
    const state = getVencimientoState(fecha);
    const cfg = VENCIMIENTO_DISPLAY[state];
    const IconMap = {
      no_informado: HelpCircle,
      vigente:      CheckCircle,
      proximo:      AlertCircle,
      vencido:      XCircle,
    };
    const Icon = IconMap[state];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${cfg.colorClass}`}>
        <Icon size={11} />
        {cfg.label}
      </span>
    );
  }

  // ── JSX ───────────────────────────────────────────────────────────────────────

  const ec = estadoCfg(vehicleLocal.estado);
  const imgSrc = getVehicleDisplayImage(vehicleLocal.tipo, vehicleLocal.image_path);

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button onClick={onClose}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 shrink-0">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Flota</span>
          </button>

          <div className="w-px h-5 bg-slate-200 shrink-0" />

          <div className="flex items-center gap-3 flex-1 min-w-0">
            {imgSrc
              ? <img src={imgSrc} alt={tipoLabel(vehicleLocal.tipo)}
                  className="w-10 h-7 object-contain shrink-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : <div className="w-10 h-7 bg-slate-100 rounded flex items-center justify-center shrink-0">
                  <Bus size={16} className="text-slate-400" />
                </div>
            }
            <div className="min-w-0 flex-1">
              <div className="font-bold text-slate-900 truncate text-sm">{vehicleLocal.nombre}</div>
              <div className="text-xs text-slate-400 font-mono">{vehicleLocal.matricula}</div>
            </div>
            <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${ec.color}`}>
              {ec.label}
            </span>
          </div>

          {canWrite && (
            <button onClick={() => onEditVehicle(vehicleLocal)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 shrink-0">
              <Edit2 size={14} />
              <span className="hidden sm:inline">Editar</span>
            </button>
          )}
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex gap-0 overflow-x-auto scrollbar-none -mb-px">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors
                  ${tab === t.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">

        {/* ── TAB: Datos generales ─────────────────────────────────────────── */}
        {tab === 'general' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card izquierda: identidad */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Identificación</h3>

              {imgSrc && (
                <div className="flex justify-center py-2">
                  <img src={imgSrc} alt={tipoLabel(vehicleLocal.tipo)}
                    className="h-24 object-contain"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}

              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Nombre</dt>
                  <dd className="font-medium text-slate-900 text-right">{vehicleLocal.nombre}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Matrícula</dt>
                  <dd className="font-mono font-semibold text-slate-900">{vehicleLocal.matricula}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Tipo</dt>
                  <dd className="text-slate-900">{tipoLabel(vehicleLocal.tipo)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Modalidad</dt>
                  <dd>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${modalidadCfg(vehicleLocal.modalidad).color}`}>
                      {modalidadCfg(vehicleLocal.modalidad).label}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-slate-500">Estado</dt>
                  <dd>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${ec.color}`}>
                      {ec.label}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Card derecha: detalles */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Detalles técnicos</h3>
              <dl className="space-y-3 text-sm">
                {(vehicleLocal.marca || vehicleLocal.modelo_vehiculo) && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Marca / Modelo</dt>
                    <dd className="text-slate-900 text-right">
                      {[vehicleLocal.marca, vehicleLocal.modelo_vehiculo].filter(Boolean).join(' ')}
                    </dd>
                  </div>
                )}
                {vehicleLocal.anno && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Año</dt>
                    <dd className="text-slate-900">{vehicleLocal.anno}</dd>
                  </div>
                )}
                {vehicleLocal.color && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Color</dt>
                    <dd className="text-slate-900">{vehicleLocal.color}</dd>
                  </div>
                )}
                {vehicleLocal.capacidad_viajeros != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Capacidad viajeros</dt>
                    <dd className="font-medium text-slate-900">{vehicleLocal.capacidad_viajeros} plazas</dd>
                  </div>
                )}
                {vehicleLocal.capacidad_carga_kg != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Carga máx.</dt>
                    <dd className="font-medium text-slate-900">{vehicleLocal.capacidad_carga_kg.toLocaleString('es-ES')} kg</dd>
                  </div>
                )}
                {vehicleLocal.km_actual != null && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Odómetro actual</dt>
                    <dd className="font-bold text-emerald-700">{vehicleLocal.km_actual.toLocaleString('es-ES')} km</dd>
                  </div>
                )}
              </dl>

              {vehicleLocal.notas && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notas</p>
                  <p className="text-sm text-slate-600 leading-relaxed">{vehicleLocal.notas}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Documentación ──────────────────────────────────────────── */}
        {tab === 'documentacion' && (
          <div className="space-y-5">

            {/* ITV */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">ITV</h3>
                  {!editingITV && renderVencimientoBadge(vehicleLocal.itv_fecha_vencimiento)}
                </div>
                {canWrite && !editingITV && (
                  <button onClick={() => {
                    setItvFechaUltima(vehicleLocal.itv_fecha_ultima ?? '');
                    setItvVencimiento(vehicleLocal.itv_fecha_vencimiento ?? '');
                    setEditingITV(true);
                  }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Edit2 size={12} /> Editar
                  </button>
                )}
              </div>

              {!editingITV ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Última inspección</dt>
                    <dd className="font-medium text-slate-800">{fmtDate(vehicleLocal.itv_fecha_ultima)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Próxima revisión</dt>
                    <dd className="font-medium text-slate-800">{fmtDate(vehicleLocal.itv_fecha_vencimiento)}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Última inspección</label>
                      <input type="date" value={itvFechaUltima}
                        onChange={e => setItvFechaUltima(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Próxima revisión</label>
                      <input type="date" value={itvVencimiento}
                        onChange={e => setItvVencimiento(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={handleCancelITV} disabled={savingITV}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button onClick={handleSaveITV} disabled={savingITV}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                      {savingITV && <Loader2 size={13} className="animate-spin" />}
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Seguro */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900 text-sm">Seguro</h3>
                  {!editingSeguro && renderVencimientoBadge(vehicleLocal.seguro_vencimiento)}
                </div>
                {canWrite && !editingSeguro && (
                  <button onClick={() => {
                    setSeguroCompania(vehicleLocal.seguro_compania ?? '');
                    setSeguroRef(vehicleLocal.seguro_referencia ?? '');
                    setSeguroVencimiento(vehicleLocal.seguro_vencimiento ?? '');
                    setEditingSeguro(true);
                  }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1">
                    <Edit2 size={12} /> Editar
                  </button>
                )}
              </div>

              {!editingSeguro ? (
                <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Compañía</dt>
                    <dd className="font-medium text-slate-800">{vehicleLocal.seguro_compania || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Referencia / Póliza</dt>
                    <dd className="font-medium text-slate-800">{vehicleLocal.seguro_referencia || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-400 mb-0.5">Vencimiento</dt>
                    <dd className="font-medium text-slate-800">{fmtDate(vehicleLocal.seguro_vencimiento)}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Compañía</label>
                      <input type="text" value={seguroCompania}
                        onChange={e => setSeguroCompania(e.target.value)}
                        placeholder="Mapfre, Mutua..."
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Referencia / Póliza</label>
                      <input type="text" value={seguroRef}
                        onChange={e => setSeguroRef(e.target.value)}
                        placeholder="Nº de póliza"
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Vencimiento</label>
                      <input type="date" value={seguroVencimiento}
                        onChange={e => setSeguroVencimiento(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={handleCancelSeguro} disabled={savingSeguro}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button onClick={handleSaveSeguro} disabled={savingSeguro}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                      {savingSeguro && <Loader2 size={13} className="animate-spin" />}
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Documentos adjuntos */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 text-sm">Documentos adjuntos</h3>
                {canWrite && !addingDoc && (
                  <button onClick={() => setAddingDoc(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <Plus size={13} /> Añadir
                  </button>
                )}
              </div>

              {/* Formulario de nuevo documento */}
              {addingDoc && (
                <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Tipo de documento *</label>
                      <select value={newDocTipo}
                        onChange={e => setNewDocTipo(e.target.value as VehicleDocTipo)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {EMPTY_TIPOS.map(t => (
                          <option key={t} value={t}>{VEHICLE_DOC_TIPO_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Título *</label>
                      <input type="text" value={newDocTitulo}
                        onChange={e => setNewDocTitulo(e.target.value)}
                        placeholder="ej. ITV 2025, Seguro Mapfre..."
                        maxLength={120}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Fecha del documento</label>
                      <input type="date" value={newDocFecha}
                        onChange={e => setNewDocFecha(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Fecha de vencimiento</label>
                      <input type="date" value={newDocVencimiento}
                        onChange={e => setNewDocVencimiento(e.target.value)}
                        className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Archivo (opcional, máx. 20 MB)</label>
                    <input type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                      onChange={e => setNewDocFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setAddingDoc(false); setNewDocFile(null); }} disabled={savingDoc}
                      className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
                      Cancelar
                    </button>
                    <button onClick={handleAddDoc} disabled={savingDoc}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                      {savingDoc && <Loader2 size={13} className="animate-spin" />}
                      Guardar documento
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de documentos */}
              {docsLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" /><span className="text-sm">Cargando…</span>
                </div>
              ) : docs.length === 0 ? (
                <div className="text-center py-10">
                  <FileText size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No hay documentos adjuntos</p>
                  {canWrite && (
                    <p className="text-xs text-slate-400 mt-1">Usa el botón "Añadir" para subir permisos, autorizaciones y más</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div key={doc.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                        <FileText size={15} className="text-indigo-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="font-medium text-slate-900 text-sm">{doc.titulo}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                            {VEHICLE_DOC_TIPO_LABELS[doc.tipo]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          {doc.fecha_doc && (
                            <span className="text-xs text-slate-400">{fmtDate(doc.fecha_doc)}</span>
                          )}
                          {doc.fecha_vencimiento && (
                            <span className="flex items-center gap-1">
                              {renderVencimientoBadge(doc.fecha_vencimiento)}
                              <span className="text-xs text-slate-400">{fmtDate(doc.fecha_vencimiento)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {doc.storage_path && (
                          <button onClick={() => handleDownloadDoc(doc)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                            title="Descargar">
                            <Download size={14} />
                          </button>
                        )}
                        {canWrite && (
                          deletingDocConfirm === doc.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-red-600 font-medium">¿Eliminar?</span>
                              <button onClick={() => handleDeleteDoc(doc)} disabled={deletingDocId === doc.id}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded font-medium disabled:opacity-50">
                                {deletingDocId === doc.id ? '…' : 'Sí'}
                              </button>
                              <button onClick={() => setDeletingDocConfirm(null)}
                                className="text-xs px-2 py-1 border border-slate-200 rounded text-slate-600">
                                No
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => handleDeleteDoc(doc)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Eliminar">
                              <Trash2 size={14} />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Kilometraje ─────────────────────────────────────────────── */}
        {tab === 'kilometraje' && (
          <div className="space-y-5">
            {/* Odómetro actual */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Odómetro actual</p>
                  {vehicleLocal.km_actual != null ? (
                    <p className="text-3xl font-black text-emerald-700">
                      {vehicleLocal.km_actual.toLocaleString('es-ES')}
                      <span className="text-base font-semibold text-slate-500 ml-1">km</span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400 italic">Sin lecturas registradas</p>
                  )}
                  {vehicleLocal.km_actualizado_at && (
                    <p className="text-xs text-slate-400 mt-1">
                      Actualizado: {new Date(vehicleLocal.km_actualizado_at).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  )}
                </div>
                <History size={28} className="text-slate-100" />
              </div>
            </div>

            {/* Historial de lecturas */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Historial de lecturas</h3>

              {kmLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" /><span className="text-sm">Cargando…</span>
                </div>
              ) : kmReadings.length === 0 ? (
                <div className="text-center py-10">
                  <Gauge size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No hay lecturas registradas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {kmReadings.map(r => (
                    <div key={r.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border text-sm
                        ${r.anulada ? 'bg-red-50 border-red-100 opacity-60' : 'bg-white border-slate-100'}`}>
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${r.anulada ? 'bg-red-400' : 'bg-emerald-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-bold text-slate-800">{r.km.toLocaleString('es-ES')} km</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium">
                            {KM_TIPO_LABELS[r.tipo] ?? r.tipo}
                          </span>
                          {r.anulada && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">Anulada</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(r.leido_en).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                        {r.notas && <p className="text-xs text-slate-500 mt-0.5 italic">{r.notas}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Historial de servicios ─────────────────────────────────── */}
        {tab === 'historial' && (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                Partes de servicio completados
              </h3>

              {partesLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 size={16} className="animate-spin" /><span className="text-sm">Cargando…</span>
                </div>
              ) : partes.length === 0 ? (
                <div className="text-center py-10">
                  <Clock size={32} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">Sin partes completados para este vehículo</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {partes.map(p => (
                    <div key={p.id}
                      className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                      <div className="w-2 h-2 rounded-full mt-2 bg-slate-300 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-slate-900 text-sm truncate">
                            {p.titulo || 'Servicio sin título'}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-medium shrink-0">
                            Completado
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(p.fecha_inicio).toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                          {(p as any).km_reales != null && ` · ${(p as any).km_reales} km declarados`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
