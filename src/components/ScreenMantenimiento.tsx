import { useState, useEffect, useCallback } from 'react';
import {
  FileText, Plus, Mic, Loader2, CheckCircle, Clock, AlertTriangle,
  XCircle, ChevronRight, ClipboardList, Wrench, Zap,
  TrendingUp, Euro, TriangleAlert, RefreshCw, X, Check,
  Droplets, Wind, Sparkles, Leaf, Wifi, ArrowUpDown,
  Eye, Edit2, ArrowRight, BookOpen, Shield, ChevronDown, ChevronUp,
  BookmarkPlus,
} from 'lucide-react';
import {
  loadMaintenanceCatalogs, loadMaintenancePresupuestos, loadMaintenanceContratos,
  loadMaintenanceIncidencias, detectMaintenanceContract, saveMaintenancePresupuesto,
  updateMaintenancePresupuesto, deleteMaintenancePresupuesto,
  generateMaintenanceDocument, convertPresupuestoToContrato,
  loadMaintenanceModelos, saveMaintenanceModelo, deleteMaintenanceModelo, useMaintenanceModelo,
} from '../lib/supabase';
import type {
  MaintenancePlantilla, MaintenancePresupuesto, MaintenanceContrato,
  MaintenanceIncidencia, MaintenanceDetectResult, MaintenanceDocumento,
  MaintenanceSLA, MaintenanceSector, MaintenanceOficio, MaintenanceModelo,
} from '../lib/supabase';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const OFICIO_ICON: Record<string, React.ReactNode> = {
  fontaneria:    <Droplets className="w-4 h-4" />,
  electricidad:  <Zap className="w-4 h-4" />,
  climatizacion: <Wind className="w-4 h-4" />,
  limpieza:      <Sparkles className="w-4 h-4" />,
  jardineria:    <Leaf className="w-4 h-4" />,
  informatica:   <Wifi className="w-4 h-4" />,
  ascensores:    <ArrowUpDown className="w-4 h-4" />,
};

const SLA_COLOR: Record<string, string> = {
  critico:    'bg-red-100 text-red-700 border-red-200',
  urgente:    'bg-orange-100 text-orange-700 border-orange-200',
  normal:     'bg-blue-100 text-blue-700 border-blue-200',
  preventivo: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};
const SLA_LABEL: Record<string, string> = {
  critico: 'Crítico', urgente: 'Urgente', normal: 'Normal', preventivo: 'Preventivo',
};

const ESTADO_PRESUP: Record<string, { label: string; cls: string }> = {
  borrador:   { label: 'Borrador',   cls: 'bg-slate-100 text-slate-600' },
  enviado:    { label: 'Enviado',    cls: 'bg-blue-100 text-blue-700' },
  aceptado:   { label: 'Aceptado',  cls: 'bg-emerald-100 text-emerald-700' },
  rechazado:  { label: 'Rechazado', cls: 'bg-red-100 text-red-700' },
  convertido: { label: 'Convertido',cls: 'bg-purple-100 text-purple-700' },
};

const ESTADO_CONTRATO: Record<string, { label: string; cls: string }> = {
  activo:    { label: 'Activo',    cls: 'bg-emerald-100 text-emerald-700' },
  pausado:   { label: 'Pausado',   cls: 'bg-amber-100 text-amber-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
  vencido:   { label: 'Vencido',   cls: 'bg-slate-100 text-slate-500' },
  renovando: { label: 'Renovando', cls: 'bg-blue-100 text-blue-700' },
};

function fmtEur(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}
function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Modal: Nuevo contrato por IA ──────────────────────────────────────────────

interface NuevoContratoModalProps {
  plantillas: MaintenancePlantilla[];
  onClose: () => void;
  onSaved: (p: MaintenancePresupuesto) => void;
  orgId: string;
  showToast: Props['showToast'];
}

function NuevoContratoModal({ plantillas, onClose, onSaved, orgId, showToast }: NuevoContratoModalProps) {
  const [texto, setTexto] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<MaintenanceDetectResult | null>(null);
  const [saving, setSaving] = useState(false);

  const handleDetect = async () => {
    if (!texto.trim()) return;
    setDetecting(true);
    setResult(null);
    try {
      const r = await detectMaintenanceContract(texto);
      setResult(r);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setDetecting(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const plantilla = plantillas.find(p => p.codigo === result.plantilla_codigo) ?? null;
      const saved = await saveMaintenancePresupuesto(orgId, {
        oficio: result.oficio,
        sector: result.sector,
        plantilla_id: plantilla?.id ?? null,
        nombre_cliente: result.nombre_cliente,
        direccion_instalacion: result.direccion_instalacion,
        descripcion_servicios: result.descripcion_servicios,
        cuota_mensual: result.cuota_mensual_sugerida,
        tipo_facturacion: result.tipo_facturacion,
        sla_nivel: result.sla_nivel,
        incluye_preventivos: result.incluye_preventivos,
        num_visitas_preventivo: result.num_visitas_preventivo,
        incluye_guardia: result.incluye_guardia,
        materiales_incluidos: false,
        texto_libre: texto,
        ia_json: result as unknown as Record<string, unknown>,
        generado_por_ia: true,
        estado: 'borrador',
      });
      showToast('Presupuesto guardado como borrador', 'success');
      onSaved(saved);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-blue-600" />
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Nuevo contrato por IA</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
              Describe el contrato en tu propio lenguaje
            </label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder='Ej: "Necesito un contrato de mantenimiento de fontanería para un restaurante en Barcelona, revisión bimensual, respuesta en 2 horas..."'
              rows={5}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:bg-white transition-all resize-none"
            />
          </div>

          <button
            onClick={handleDetect}
            disabled={!texto.trim() || detecting}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {detecting ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizando...</> : <><Zap className="w-4 h-4" /> Analizar con IA</>}
          </button>

          {result && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs font-semibold text-slate-700">{result.resumen}</p>
                <span className="ml-auto text-[10px] text-slate-400">{Math.round(result.confianza * 100)}% confianza</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Oficio</div>
                  <div className="flex items-center gap-1 text-slate-800 font-semibold capitalize">
                    {OFICIO_ICON[result.oficio] ?? <Wrench className="w-4 h-4" />} {result.oficio}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">SLA</div>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${SLA_COLOR[result.sla_nivel] ?? 'bg-slate-100 text-slate-600'}`}>
                    {SLA_LABEL[result.sla_nivel] ?? result.sla_nivel}
                  </span>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Cuota mensual</div>
                  <div className="font-black text-slate-900 text-base">
                    {result.cuota_mensual_sugerida ? fmtEur(result.cuota_mensual_sugerida) : `${fmtEur(result.cuota_min)} – ${fmtEur(result.cuota_max)}`}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Plantilla</div>
                  <div className="text-slate-700 font-semibold text-[11px]">
                    {result.plantilla_codigo ? (plantillas.find(p => p.codigo === result.plantilla_codigo)?.nombre ?? result.plantilla_codigo) : 'Personalizado'}
                  </div>
                </div>
              </div>
              {result.descripcion_servicios && (
                <div className="bg-white rounded-lg p-2.5 border border-slate-100">
                  <div className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Servicios</div>
                  <p className="text-xs text-slate-700 leading-relaxed">{result.descripcion_servicios}</p>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {result.incluye_guardia && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">Guardia 24h</span>}
                {result.incluye_preventivos && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">Preventivos</span>}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!result || saving}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar borrador
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Editar presupuesto ─────────────────────────────────────────────────

interface EditPresupuestoModalProps {
  presupuesto: MaintenancePresupuesto;
  slaList: MaintenanceSLA[];
  sectores: MaintenanceSector[];
  oficios: MaintenanceOficio[];
  onClose: () => void;
  onSaved: (p: MaintenancePresupuesto) => void;
  showToast: Props['showToast'];
}

function EditPresupuestoModal({ presupuesto, slaList, sectores, oficios, onClose, onSaved, showToast }: EditPresupuestoModalProps) {
  const [form, setForm] = useState({
    nombre_cliente:        presupuesto.nombre_cliente ?? '',
    direccion_instalacion: presupuesto.direccion_instalacion ?? '',
    oficio:                presupuesto.oficio,
    sector:                presupuesto.sector ?? '',
    sla_nivel:             presupuesto.sla_nivel ?? 'normal',
    cuota_mensual:         presupuesto.cuota_mensual ?? 0,
    tipo_facturacion:      presupuesto.tipo_facturacion,
    incluye_preventivos:   presupuesto.incluye_preventivos,
    num_visitas_preventivo:presupuesto.num_visitas_preventivo,
    incluye_guardia:       presupuesto.incluye_guardia,
    descripcion_servicios: presupuesto.descripcion_servicios ?? '',
    notas:                 presupuesto.notas ?? '',
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateMaintenancePresupuesto(presupuesto.id, {
        ...form,
        cuota_mensual: Number(form.cuota_mensual),
        num_visitas_preventivo: Number(form.num_visitas_preventivo),
      });
      onSaved({ ...presupuesto, ...form, cuota_mensual: Number(form.cuota_mensual) });
      showToast('Presupuesto actualizado', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-all';
  const labelCls = 'text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-slate-600" />
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Editar presupuesto</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Oficio</label>
              <select value={form.oficio} onChange={e => set('oficio', e.target.value)} className={inputCls}>
                {oficios.map(o => <option key={o.codigo} value={o.codigo}>{o.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Sector</label>
              <select value={form.sector} onChange={e => set('sector', e.target.value)} className={inputCls}>
                <option value="">— Sin sector —</option>
                {sectores.map(s => <option key={s.codigo} value={s.codigo}>{s.nombre}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Cliente</label>
            <input type="text" value={form.nombre_cliente} onChange={e => set('nombre_cliente', e.target.value)} placeholder="Nombre del cliente" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Dirección del servicio</label>
            <input type="text" value={form.direccion_instalacion} onChange={e => set('direccion_instalacion', e.target.value)} placeholder="Calle, número, ciudad" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nivel SLA</label>
              <select value={form.sla_nivel} onChange={e => set('sla_nivel', e.target.value)} className={inputCls}>
                {slaList.map(s => <option key={s.nivel} value={s.nivel}>{s.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Facturación</label>
              <select value={form.tipo_facturacion} onChange={e => set('tipo_facturacion', e.target.value as typeof form.tipo_facturacion)} className={inputCls}>
                <option value="mensual">Mensual</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cuota mensual (€ neto)</label>
              <input type="number" min={0} value={form.cuota_mensual} onChange={e => set('cuota_mensual', Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Visitas preventivas/año</label>
              <input type="number" min={0} value={form.num_visitas_preventivo} onChange={e => set('num_visitas_preventivo', Number(e.target.value))} className={inputCls} />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.incluye_preventivos} onChange={e => set('incluye_preventivos', e.target.checked)} className="accent-blue-600" />
              <span className="text-sm text-slate-700 font-semibold">Preventivos</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.incluye_guardia} onChange={e => set('incluye_guardia', e.target.checked)} className="accent-purple-600" />
              <span className="text-sm text-slate-700 font-semibold">Guardia 24h</span>
            </label>
          </div>

          <div>
            <label className={labelCls}>Descripción de servicios</label>
            <textarea value={form.descripcion_servicios} onChange={e => set('descripcion_servicios', e.target.value)} rows={3} className={inputCls + ' resize-none'} />
          </div>

          <div>
            <label className={labelCls}>Notas internas</label>
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)} rows={2} placeholder="Notas solo visibles internamente" className={inputCls + ' resize-none'} />
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer">Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Vista previa documento ─────────────────────────────────────────────

interface DocumentoPreviewModalProps {
  presupuesto: MaintenancePresupuesto;
  onClose: () => void;
  showToast: Props['showToast'];
}

function DocumentoPreviewModal({ presupuesto, onClose, showToast }: DocumentoPreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<MaintenanceDocumento | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ servicios: true, sla: true });

  const toggle = (k: string) => setExpandedSections(prev => ({ ...prev, [k]: !prev[k] }));

  useEffect(() => {
    void (async () => {
      try {
        const d = await generateMaintenanceDocument(presupuesto.id);
        setDoc(d);
      } catch (e) {
        showToast(String(e), 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [presupuesto.id, showToast, onClose]);

  const secCls = 'border border-slate-100 rounded-xl overflow-hidden';
  const secHeaderCls = 'flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Documento del contrato</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-slate-500 text-sm font-semibold">Generando documento con IA...</p>
              <p className="text-slate-400 text-xs">Redactando cláusulas adaptadas al sector y SLA</p>
            </div>
          ) : doc ? (
            <div className="space-y-3">
              {/* Título */}
              <div className="text-center pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-base">{doc.titulo}</h3>
                <p className="text-xs text-slate-400 mt-1">{doc.num_clausulas} cláusulas generadas</p>
              </div>

              {/* Partes */}
              <div className={secCls}>
                <div className={secHeaderCls} onClick={() => toggle('partes')}>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Partes del contrato</span>
                  {expandedSections.partes ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedSections.partes && (
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-xs text-slate-600"><span className="font-bold">Prestador:</span> {doc.partes.prestador}</p>
                    <p className="text-xs text-slate-600"><span className="font-bold">Cliente:</span> {doc.partes.cliente}</p>
                    <p className="text-xs text-slate-600"><span className="font-bold">Dirección:</span> {doc.partes.direccion_servicio}</p>
                  </div>
                )}
              </div>

              {/* Objeto */}
              <div className={secCls}>
                <div className={secHeaderCls} onClick={() => toggle('objeto')}>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Objeto del contrato</span>
                  {expandedSections.objeto ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedSections.objeto && (
                  <p className="px-4 py-3 text-xs text-slate-600 leading-relaxed">{doc.objeto}</p>
                )}
              </div>

              {/* Servicios */}
              <div className={secCls}>
                <div className={secHeaderCls} onClick={() => toggle('servicios')}>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Servicios incluidos / excluidos</span>
                  {expandedSections.servicios ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedSections.servicios && (
                  <div className="px-4 py-3 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-2">✓ Incluidos</p>
                      <ul className="space-y-1">
                        {doc.servicios_incluidos.map((s, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-1.5"><Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />{s}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-2">✗ Excluidos</p>
                      <ul className="space-y-1">
                        {doc.servicios_excluidos.map((s, i) => (
                          <li key={i} className="text-xs text-slate-500 flex gap-1.5"><X className="w-3 h-3 text-red-400 shrink-0 mt-0.5" />{s}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* SLA */}
              <div className={secCls}>
                <div className={secHeaderCls} onClick={() => toggle('sla')}>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">SLA y tiempos de respuesta</span>
                  {expandedSections.sla ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedSections.sla && (
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-xs text-slate-600"><span className="font-bold">Nivel:</span> {doc.sla.nivel}</p>
                    <p className="text-xs text-slate-600"><span className="font-bold">Tiempo respuesta:</span> {doc.sla.tiempo_respuesta}</p>
                    <p className="text-xs text-slate-600"><span className="font-bold">Resolución:</span> {doc.sla.tiempo_resolucion}</p>
                    <p className="text-xs text-slate-600"><span className="font-bold">Cobertura:</span> {doc.sla.horario_cobertura}</p>
                    {doc.sla.penalizacion && <p className="text-xs text-amber-600"><span className="font-bold">Penalización:</span> {doc.sla.penalizacion}</p>}
                  </div>
                )}
              </div>

              {/* Precio */}
              <div className={secCls}>
                <div className={secHeaderCls} onClick={() => toggle('precio')}>
                  <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Precio y facturación</span>
                  {expandedSections.precio ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
                {expandedSections.precio && (
                  <div className="px-4 py-3 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-semibold">Mensual neto</p>
                      <p className="text-lg font-black text-slate-900">{fmtEur(doc.precio.cuota_mensual_neto)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-semibold">Mensual + IVA</p>
                      <p className="text-lg font-black text-blue-600">{fmtEur(doc.precio.cuota_mensual_total)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-400 font-semibold">Anual + IVA</p>
                      <p className="text-lg font-black text-slate-900">{fmtEur(doc.precio.cuota_anual_total)}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-xs text-slate-500">{doc.precio.forma_pago}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Cláusulas adicionales */}
              {doc.clausulas_adicionales.length > 0 && (
                <div className={secCls}>
                  <div className={secHeaderCls} onClick={() => toggle('clausulas')}>
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Cláusulas adicionales ({doc.clausulas_adicionales.length})</span>
                    {expandedSections.clausulas ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                  {expandedSections.clausulas && (
                    <ul className="px-4 py-3 space-y-2">
                      {doc.clausulas_adicionales.map((c, i) => (
                        <li key={i} className="text-xs text-slate-600 leading-relaxed flex gap-2">
                          <span className="text-slate-300 font-mono shrink-0">{i + 1}.</span>{c}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Jurisdicción */}
              <div className="rounded-xl bg-slate-50 px-4 py-3 flex gap-2">
                <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 leading-relaxed">{doc.jurisdiccion}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="p-4 border-t border-slate-100">
          <button onClick={onClose} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer transition-colors">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Confirmar conversión a contrato ────────────────────────────────────

interface ConvertirModalProps {
  presupuesto: MaintenancePresupuesto;
  onClose: () => void;
  onConverted: (c: MaintenanceContrato, updatedPresup: MaintenancePresupuesto) => void;
  showToast: Props['showToast'];
}

function ConvertirModal({ presupuesto, onClose, onConverted, showToast }: ConvertirModalProps) {
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    setConverting(true);
    try {
      const contrato = await convertPresupuestoToContrato(presupuesto);
      showToast('¡Contrato creado y activado!', 'success');
      onConverted(contrato, { ...presupuesto, estado: 'convertido' });
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 mb-4">
            <ArrowRight className="w-7 h-7 text-emerald-600" />
          </div>
          <h2 className="font-black text-slate-900 text-lg">Convertir a contrato</h2>
          <p className="text-slate-500 text-sm mt-2">
            Se creará un contrato activo para <strong>{presupuesto.nombre_cliente ?? 'este cliente'}</strong> con una cuota mensual de <strong>{fmtEur(presupuesto.cuota_mensual)}</strong>.
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-4 space-y-2 text-xs text-slate-600">
          <p><span className="font-bold">Inicio:</span> {fmtDate(new Date().toISOString())}</p>
          <p><span className="font-bold">Duración:</span> 12 meses con renovación automática</p>
          <p><span className="font-bold">Primera factura:</span> el 1 del próximo mes</p>
          <p><span className="font-bold">El presupuesto</span> quedará marcado como "Convertido"</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleConvert}
            disabled={converting}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {converting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Activar contrato
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Guardar como modelo ────────────────────────────────────────────────

interface GuardarModeloModalProps {
  presupuesto: MaintenancePresupuesto;
  orgId: string;
  onClose: () => void;
  onSaved: (m: MaintenanceModelo) => void;
  showToast: Props['showToast'];
}

function GuardarModeloModal({ presupuesto, orgId, onClose, onSaved, showToast }: GuardarModeloModalProps) {
  const oficio = presupuesto.oficio.charAt(0).toUpperCase() + presupuesto.oficio.slice(1);
  const [nombre, setNombre] = useState(oficio + (presupuesto.sector ? ' · ' + presupuesto.sector : ''));
  const [descripcion, setDescripcion] = useState(presupuesto.descripcion_servicios?.slice(0, 200) ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!nombre.trim()) return;
    setSaving(true);
    try {
      const modelo = await saveMaintenanceModelo(orgId, {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        basado_en_plantilla_id: presupuesto.plantilla_id,
        datos_json: {
          oficio:                 presupuesto.oficio,
          sector:                 presupuesto.sector,
          sla_nivel:              presupuesto.sla_nivel,
          cuota_mensual:          presupuesto.cuota_mensual,
          tipo_facturacion:       presupuesto.tipo_facturacion,
          incluye_preventivos:    presupuesto.incluye_preventivos,
          num_visitas_preventivo: presupuesto.num_visitas_preventivo,
          incluye_guardia:        presupuesto.incluye_guardia,
          descripcion_servicios:  presupuesto.descripcion_servicios,
          plantilla_id:           presupuesto.plantilla_id,
          notas:                  presupuesto.notas,
        },
      });
      showToast('Modelo guardado correctamente', 'success');
      onSaved(modelo);
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookmarkPlus className="w-5 h-5 text-blue-600" />
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Guardar como modelo</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <p className="text-xs text-slate-500">
          Los modelos guardan la configuración del contrato (oficio, SLA, cuota…) para reutilizarla rápidamente con nuevos clientes.
        </p>

        <div className="rounded-xl bg-slate-50 p-3 flex items-center gap-2 text-xs text-slate-700">
          <span className="text-slate-400">{OFICIO_ICON[presupuesto.oficio] ?? <Wrench className="w-4 h-4" />}</span>
          <span className="capitalize font-semibold">{presupuesto.oficio}</span>
          {presupuesto.sla_nivel && (
            <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${SLA_COLOR[presupuesto.sla_nivel] ?? ''}`}>
              {SLA_LABEL[presupuesto.sla_nivel]}
            </span>
          )}
          {presupuesto.cuota_mensual != null && (
            <span className="ml-auto font-black text-slate-900">{fmtEur(presupuesto.cuota_mensual)}/mes</span>
          )}
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nombre del modelo *</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none transition-all"
            placeholder="Ej: Fontanería Restaurantes SLA Urgente"
            maxLength={80}
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Descripción (opcional)</label>
          <textarea
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-400 focus:outline-none resize-none transition-all"
            placeholder="Breve descripción de cuándo usar este modelo"
            maxLength={300}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 cursor-pointer">
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!nombre.trim() || saving}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookmarkPlus className="w-4 h-4" />}
            Guardar modelo
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function ScreenMantenimiento({ orgId, showToast }: Props) {
  const [tab, setTab] = useState<'presupuestos' | 'contratos' | 'incidencias' | 'modelos'>('presupuestos');
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<MaintenancePresupuesto[]>([]);
  const [contratos, setContratos] = useState<MaintenanceContrato[]>([]);
  const [incidencias, setIncidencias] = useState<MaintenanceIncidencia[]>([]);
  const [plantillas, setPlantillas] = useState<MaintenancePlantilla[]>([]);
  const [slaList, setSlaList] = useState<MaintenanceSLA[]>([]);
  const [sectores, setSectores] = useState<MaintenanceSector[]>([]);
  const [oficios, setOficios] = useState<MaintenanceOficio[]>([]);

  const [modelos, setModelos] = useState<MaintenanceModelo[]>([]);

  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [editPresup, setEditPresup] = useState<MaintenancePresupuesto | null>(null);
  const [previewPresup, setPreviewPresup] = useState<MaintenancePresupuesto | null>(null);
  const [convertPresup, setConvertPresup] = useState<MaintenancePresupuesto | null>(null);
  const [guardarModelo, setGuardarModelo] = useState<MaintenancePresupuesto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usandoModelo, setUsandoModelo] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogs, presups, contratos_, incids, mods] = await Promise.all([
        loadMaintenanceCatalogs(),
        loadMaintenancePresupuestos(orgId),
        loadMaintenanceContratos(orgId),
        loadMaintenanceIncidencias(orgId),
        loadMaintenanceModelos(orgId),
      ]);
      setPlantillas(catalogs.plantillas);
      setSlaList(catalogs.sla);
      setSectores(catalogs.sectores);
      setOficios(catalogs.oficios);
      setPresupuestos(presups);
      setContratos(contratos_);
      setIncidencias(incids);
      setModelos(mods);
    } catch {
      showToast('Error cargando datos de mantenimiento', 'error');
    } finally {
      setLoading(false);
    }
  }, [orgId, showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const contratosActivos = contratos.filter(c => c.estado === 'activo').length;
  const mrrContratos = contratos.filter(c => c.estado === 'activo').reduce((s, c) => s + (c.cuota_mensual ?? 0), 0);
  const incidenciasAbiertas = incidencias.filter(i => i.estado === 'abierta' || i.estado === 'en_curso').length;
  const presupuestosPendientes = presupuestos.filter(p => p.estado === 'borrador' || p.estado === 'enviado').length;

  const handleDeletePresup = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMaintenancePresupuesto(id);
      setPresupuestos(prev => prev.filter(p => p.id !== id));
      showToast('Presupuesto eliminado', 'info');
    } catch { showToast('Error al eliminar', 'error'); }
    finally { setDeletingId(null); }
  };

  const handleEstadoChange = async (id: string, estado: MaintenancePresupuesto['estado']) => {
    try {
      await updateMaintenancePresupuesto(id, { estado });
      setPresupuestos(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    } catch { showToast('Error al actualizar estado', 'error'); }
  };

  const handleUsarModelo = async (modelo: MaintenanceModelo) => {
    setUsandoModelo(modelo.id);
    try {
      const saved = await useMaintenanceModelo(modelo, orgId);
      setModelos(prev => prev.map(m => m.id === modelo.id ? { ...m, veces_usado: m.veces_usado + 1 } : m));
      setPresupuestos(prev => [saved, ...prev]);
      setTab('presupuestos');
      setEditPresup(saved);
      showToast('Presupuesto creado desde modelo', 'success');
    } catch (e) {
      showToast(String(e), 'error');
    } finally {
      setUsandoModelo(null);
    }
  };

  const handleDeleteModelo = async (id: string) => {
    try {
      await deleteMaintenanceModelo(id);
      setModelos(prev => prev.filter(m => m.id !== id));
      showToast('Modelo eliminado', 'info');
    } catch { showToast('Error al eliminar modelo', 'error'); }
  };

  const sec = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
  const tabCls = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
      tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
    }`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contratos activos',   value: contratosActivos,        icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, cls: 'border-emerald-100' },
          { label: 'MRR contratos',        value: fmtEur(mrrContratos),    icon: <Euro className="w-5 h-5 text-blue-500" />,          cls: 'border-blue-100' },
          { label: 'Incidencias abiertas', value: incidenciasAbiertas,     icon: <TriangleAlert className="w-5 h-5 text-amber-500" />, cls: 'border-amber-100' },
          { label: 'Presupuestos pdte.',   value: presupuestosPendientes,  icon: <FileText className="w-5 h-5 text-purple-500" />,    cls: 'border-purple-100' },
        ].map(({ label, value, icon, cls }) => (
          <div key={label} className={`bg-white rounded-2xl border ${cls} shadow-sm p-4 flex items-center gap-3`}>
            <div className="shrink-0">{icon}</div>
            <div>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
              <p className="text-xl font-black text-slate-900 leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + acciones */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <button onClick={() => setTab('presupuestos')} className={tabCls('presupuestos')}>Presupuestos ({presupuestos.length})</button>
          <button onClick={() => setTab('contratos')} className={tabCls('contratos')}>Contratos ({contratos.length})</button>
          <button onClick={() => setTab('incidencias')} className={tabCls('incidencias')}>Incidencias ({incidenciasAbiertas})</button>
          <button onClick={() => setTab('modelos')} className={tabCls('modelos')}>Modelos ({modelos.length})</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadData()} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer" title="Recargar">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowNuevoModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo por IA
          </button>
        </div>
      </div>

      {/* ── Tab: Presupuestos ── */}
      {tab === 'presupuestos' && (
        <div className={sec}>
          {presupuestos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin presupuestos de mantenimiento</p>
              <p className="text-slate-300 text-xs mt-1">Usa "Nuevo por IA" para crear el primero</p>
              <button onClick={() => setShowNuevoModal(true)} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors">
                <Mic className="w-4 h-4" /> Crear con IA
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {presupuestos.map(p => {
                const est = ESTADO_PRESUP[p.estado] ?? ESTADO_PRESUP.borrador;
                return (
                  <div key={p.id} className="py-3.5 flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      {OFICIO_ICON[p.oficio] ?? <Wrench className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{p.nombre_cliente ?? 'Sin cliente'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${est.cls}`}>{est.label}</span>
                        {p.sla_nivel && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SLA_COLOR[p.sla_nivel] ?? ''}`}>{SLA_LABEL[p.sla_nivel]}</span>
                        )}
                        {p.generado_por_ia && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">IA</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{p.direccion_instalacion ?? p.sector ?? p.oficio}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(p.fecha)}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5">
                      {p.cuota_mensual != null && (
                        <span className="text-sm font-black text-slate-900 mr-1">{fmtEur(p.cuota_mensual)}<span className="text-[10px] font-normal text-slate-400">/mes</span></span>
                      )}
                      {/* Acciones según estado */}
                      {p.estado === 'borrador' && (
                        <button onClick={() => handleEstadoChange(p.id, 'enviado')} className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 cursor-pointer">Enviar</button>
                      )}
                      {p.estado === 'enviado' && (
                        <button onClick={() => handleEstadoChange(p.id, 'aceptado')} className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer">Aceptado</button>
                      )}
                      {p.estado === 'aceptado' && (
                        <button onClick={() => setConvertPresup(p)} className="px-2.5 py-1 rounded-lg bg-purple-50 text-purple-600 text-[10px] font-bold hover:bg-purple-100 cursor-pointer flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" />Contrato
                        </button>
                      )}
                      {/* Iconos: guardar modelo, ver doc, editar, eliminar */}
                      <button onClick={() => setGuardarModelo(p)} title="Guardar como modelo" className="p-1.5 rounded-lg text-slate-300 hover:text-amber-500 hover:bg-amber-50 cursor-pointer">
                        <BookmarkPlus className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setPreviewPresup(p)} title="Ver documento" className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setEditPresup(p)} title="Editar" className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 cursor-pointer">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeletePresup(p.id)} disabled={deletingId === p.id} className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer disabled:opacity-40">
                        {deletingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Contratos ── */}
      {tab === 'contratos' && (
        <div className={sec}>
          {contratos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin contratos activos</p>
              <p className="text-slate-300 text-xs mt-1">Los contratos se crean al convertir un presupuesto aceptado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {contratos.map(c => {
                const est = ESTADO_CONTRATO[c.estado] ?? ESTADO_CONTRATO.activo;
                return (
                  <div key={c.id} className="py-3.5 flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      {OFICIO_ICON[c.oficio] ?? <Wrench className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{c.nombre_cliente ?? 'Sin cliente'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${est.cls}`}>{est.label}</span>
                        {c.sla_nivel && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SLA_COLOR[c.sla_nivel] ?? ''}`}>{SLA_LABEL[c.sla_nivel]}</span>}
                        {c.incluye_guardia && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">Guardia</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{c.direccion_instalacion ?? c.sector ?? c.oficio}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-slate-400">Desde {fmtDate(c.fecha_inicio)}</span>
                        {c.proxima_factura && <span className="text-[10px] text-blue-500 font-semibold">Próx. factura: {fmtDate(c.proxima_factura)}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-base font-black text-slate-900">{fmtEur(c.cuota_mensual)}</span>
                      <span className="text-[10px] text-slate-400 block">/mes + IVA</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Incidencias ── */}
      {tab === 'incidencias' && (
        <div className={sec}>
          {incidencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin incidencias abiertas</p>
              <p className="text-slate-300 text-xs mt-1">Las incidencias vinculadas a contratos aparecerán aquí</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidencias.map(i => (
                <div key={i.id} className="py-3.5 flex items-start gap-3">
                  <div className="shrink-0 pt-0.5">
                    {i.prioridad === 'critica' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
                     i.prioridad === 'urgente' ? <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> :
                     <Clock className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{i.titulo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        i.estado === 'abierta' ? 'bg-red-100 text-red-700' :
                        i.estado === 'en_curso' ? 'bg-amber-100 text-amber-700' :
                        i.estado === 'resuelta' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}>{i.estado}</span>
                    </div>
                    {i.descripcion && <p className="text-xs text-slate-500 mt-0.5 truncate">{i.descripcion}</p>}
                    <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(i.fecha_reporte)}</p>
                  </div>
                  {i.es_extra_contrato && i.importe_extra && (
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-black text-amber-600">{fmtEur(i.importe_extra)}</span>
                      <span className="text-[10px] text-slate-400 block">extra-contrato</span>
                    </div>
                  )}
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0 self-center" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Modelos ── */}
      {tab === 'modelos' && (
        <div className={sec}>
          {modelos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BookmarkPlus className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin modelos guardados</p>
              <p className="text-slate-300 text-xs mt-1">Pulsa el icono <BookmarkPlus className="inline w-3 h-3" /> en un presupuesto para guardarlo como modelo reutilizable</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {modelos.map(m => {
                const d = m.datos_json ?? {};
                const oficio = (d.oficio as string) ?? '';
                const sla    = (d.sla_nivel as string) ?? '';
                const cuota  = d.cuota_mensual as number | null | undefined;
                return (
                  <div key={m.id} className="py-3.5 flex items-start gap-3">
                    <div className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                      {OFICIO_ICON[oficio] ?? <Wrench className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{m.nombre}</span>
                        {sla && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${SLA_COLOR[sla] ?? ''}`}>
                            {SLA_LABEL[sla] ?? sla}
                          </span>
                        )}
                        {m.veces_usado > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                            Usado {m.veces_usado}×
                          </span>
                        )}
                      </div>
                      {m.descripcion && <p className="text-xs text-slate-500 mt-0.5 truncate">{m.descripcion}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{oficio}{d.sector ? ` · ${d.sector as string}` : ''}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {cuota != null && (
                        <span className="text-sm font-black text-slate-900 mr-1">
                          {fmtEur(cuota)}<span className="text-[10px] font-normal text-slate-400">/mes</span>
                        </span>
                      )}
                      <button
                        onClick={() => void handleUsarModelo(m)}
                        disabled={usandoModelo === m.id}
                        className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold hover:bg-blue-100 cursor-pointer disabled:opacity-40 flex items-center gap-1 transition-colors"
                      >
                        {usandoModelo === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
                        Usar
                      </button>
                      <button
                        onClick={() => void handleDeleteModelo(m.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                        title="Eliminar modelo"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state global */}
      {contratosActivos === 0 && presupuestos.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center space-y-3">
          <TrendingUp className="w-8 h-8 text-slate-200 mx-auto" />
          <div>
            <p className="font-bold text-slate-500 text-sm">Empieza a gestionar tus contratos de mantenimiento</p>
            <p className="text-slate-400 text-xs mt-1">Dicta o escribe el tipo de contrato y la IA lo estructurará en segundos.</p>
          </div>
          <button onClick={() => setShowNuevoModal(true)} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wide cursor-pointer hover:bg-slate-700 transition-colors">
            <Mic className="w-4 h-4" /> Crear primer contrato con IA
          </button>
        </div>
      )}

      {/* Modales */}
      {showNuevoModal && (
        <NuevoContratoModal
          plantillas={plantillas} orgId={orgId} showToast={showToast}
          onClose={() => setShowNuevoModal(false)}
          onSaved={saved => { setPresupuestos(prev => [saved, ...prev]); setShowNuevoModal(false); }}
        />
      )}

      {editPresup && (
        <EditPresupuestoModal
          presupuesto={editPresup} slaList={slaList} sectores={sectores} oficios={oficios} showToast={showToast}
          onClose={() => setEditPresup(null)}
          onSaved={updated => { setPresupuestos(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditPresup(null); }}
        />
      )}

      {previewPresup && (
        <DocumentoPreviewModal
          presupuesto={previewPresup} showToast={showToast}
          onClose={() => setPreviewPresup(null)}
        />
      )}

      {convertPresup && (
        <ConvertirModal
          presupuesto={convertPresup} showToast={showToast}
          onClose={() => setConvertPresup(null)}
          onConverted={(c, updatedP) => {
            setContratos(prev => [c, ...prev]);
            setPresupuestos(prev => prev.map(p => p.id === updatedP.id ? updatedP : p));
            setConvertPresup(null);
            setTab('contratos');
          }}
        />
      )}

      {guardarModelo && (
        <GuardarModeloModal
          presupuesto={guardarModelo}
          orgId={orgId}
          showToast={showToast}
          onClose={() => setGuardarModelo(null)}
          onSaved={modelo => {
            setModelos(prev => [modelo, ...prev]);
            setGuardarModelo(null);
          }}
        />
      )}
    </div>
  );
}
