import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Plus, Mic, Loader2, CheckCircle, Clock, AlertTriangle,
  XCircle, ChevronRight, ClipboardList, Wrench, Zap,
  TrendingUp, Euro, TriangleAlert, RefreshCw, X, Check,
  Droplets, Wind, Sparkles, Leaf, Wifi, ArrowUpDown,
  Eye, Edit2, ArrowRight, BookOpen, Shield, ChevronDown, ChevronUp,
  BookmarkPlus, Send, Receipt, BadgeEuro, Search, Filter, MessageSquare, Download, FileDown,
} from 'lucide-react';
import { downloadMaintenanceDocAsDocx } from '../lib/exportWord';
import {
  loadMaintenanceCatalogs, loadMaintenancePresupuestos, loadMaintenanceContratos,
  loadMaintenanceIncidencias, detectMaintenanceContract, saveMaintenancePresupuesto,
  updateMaintenancePresupuesto, deleteMaintenancePresupuesto,
  generateMaintenanceDocument, convertPresupuestoToContrato,
  loadMaintenanceModelos, saveMaintenanceModelo, deleteMaintenanceModelo, useMaintenanceModelo,
  loadMaintenanceInvoicesByOrg, markInvoicePaid, sendMaintenanceNotification,
  saveMaintenanceIncidencia, updateMaintenanceIncidencia, sendParteTrabajo,
  loadOrgMembers,
} from '../lib/supabase';
import type {
  MaintenancePlantilla, MaintenancePresupuesto, MaintenanceContrato,
  MaintenanceIncidencia, MaintenanceDetectResult, MaintenanceDocumento,
  MaintenanceSLA, MaintenanceSector, MaintenanceOficio, MaintenanceModelo,
  TradeInvoice, OrgMember,
} from '../lib/supabase';

interface Props {
  orgId: string;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  initialText?: string;
  onInitialTextConsumed?: () => void;
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
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return String(e);
}

// ── Modal: Nuevo contrato por IA ──────────────────────────────────────────────

interface NuevoContratoModalProps {
  plantillas: MaintenancePlantilla[];
  onClose: () => void;
  onSaved: (p: MaintenancePresupuesto) => void;
  orgId: string;
  showToast: Props['showToast'];
  initialText?: string;
}

function NuevoContratoModal({ plantillas, onClose, onSaved, orgId, showToast, initialText }: NuevoContratoModalProps) {
  const [texto, setTexto] = useState(initialText ?? '');
  const [detecting, setDetecting] = useState(false);
  const [result, setResult] = useState<MaintenanceDetectResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const toggleVoice = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRec) { showToast('Tu navegador no soporta dictado por voz', 'error'); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SpeechRec();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = true;
    let finalTranscript = texto;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
        else interim = e.results[i][0].transcript;
      }
      setTexto(finalTranscript + interim);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const handleDetect = async () => {
    if (!texto.trim()) return;
    setDetecting(true);
    setResult(null);
    try {
      const r = await detectMaintenanceContract(texto);
      setResult(r);
    } catch (e) {
      showToast(errMsg(e), 'error');
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
        oficio: result.oficio ?? 'mantenimiento',
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
      showToast(errMsg(e), 'error');
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Describe el contrato en tu propio lenguaje
              </label>
              <button
                type="button"
                onClick={toggleVoice}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  listening
                    ? 'bg-red-500 text-white shadow-md shadow-red-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Mic className={`w-3.5 h-3.5 ${listening ? 'animate-pulse' : ''}`} />
                {listening ? 'Detener' : 'Dictar'}
              </button>
            </div>
            {listening && (
              <div className="mb-2 flex items-center gap-2 text-[10px] text-red-500 font-bold">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Escuchando… habla con libertad
              </div>
            )}
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
                <span className="ml-auto text-[10px] text-slate-400">{result.confianza != null ? Math.round(result.confianza * 100) : '–'}% confianza</span>
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
      showToast(errMsg(e), 'error');
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

// ── Modal: Detalle del presupuesto (sin IA) ───────────────────────────────────

interface PresupuestoDetalleModalProps {
  presupuesto: MaintenancePresupuesto;
  onClose: () => void;
  onEdit: () => void;
  onConvert: () => void;
}

interface ClausulaItem {
  descripcion: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number;
  total: number;
}

function PresupuestoDetalleModal({ presupuesto, onClose, onEdit, onConvert }: PresupuestoDetalleModalProps) {
  const iaJson = presupuesto.ia_json as Record<string, unknown> | null;
  const clausulas: ClausulaItem[] = (iaJson?.clausulas as ClausulaItem[] | undefined) ?? [];
  const total = clausulas.reduce((s, c) => s + c.precioUnitario * c.cantidad, 0);
  const est = ESTADO_PRESUP[presupuesto.estado] ?? ESTADO_PRESUP.borrador;

  function buildTextoEnvio() {
    const lines: string[] = [
      `PRESUPUESTO DE MANTENIMIENTO`,
      presupuesto.nombre_cliente ? `Cliente: ${presupuesto.nombre_cliente}` : '',
      `Sector: ${presupuesto.sector ?? presupuesto.oficio}`,
      presupuesto.sla_nivel ? `SLA: ${presupuesto.sla_nivel}` : '',
      presupuesto.num_visitas_preventivo ? `Visitas preventivas/año: ${presupuesto.num_visitas_preventivo}` : '',
      ``,
      `SERVICIOS INCLUIDOS:`,
    ].filter(v => v !== null && v !== undefined);
    clausulas.forEach(c => {
      if (c.precioUnitario > 0) lines.push(`- ${c.descripcion}: ${c.cantidad} ${c.unidad} × ${c.precioUnitario.toFixed(2)}€ = ${(c.precioUnitario * c.cantidad).toFixed(2)}€`);
      else lines.push(`- ${c.descripcion}`);
    });
    if (presupuesto.descripcion_servicios && clausulas.length === 0) lines.push(presupuesto.descripcion_servicios);
    if (total > 0) {
      lines.push('', `TOTAL BASE: ${total.toFixed(2)} €`);
      lines.push(`TOTAL CON IVA (21%): ${(total * 1.21).toFixed(2)} €`);
    }
    if (presupuesto.cuota_mensual) lines.push(`Cuota mensual: ${presupuesto.cuota_mensual.toFixed(2)} €/mes`);
    lines.push('', '---', 'Generado con TrabFlow · www.trabflow.com');
    return lines.join('\n');
  }

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildTextoEnvio())}`, '_blank');
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`Presupuesto Mantenimiento — ${presupuesto.nombre_cliente ?? presupuesto.sector ?? ''}`);
    window.open(`mailto:?subject=${subject}&body=${encodeURIComponent(buildTextoEnvio())}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              {OFICIO_ICON[presupuesto.oficio] ?? <Wrench className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-sm">{presupuesto.nombre_cliente ?? 'Sin cliente'}</h2>
              <p className="text-[11px] text-slate-400">{presupuesto.sector ?? presupuesto.oficio}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${est.cls}`}>{est.label}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4 text-slate-500" /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Condiciones */}
          <div className="grid grid-cols-3 gap-2">
            {presupuesto.sla_nivel && (
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">SLA</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{presupuesto.sla_nivel}</p>
              </div>
            )}
            {(presupuesto.num_visitas_preventivo ?? 0) > 0 && (
              <div className="bg-slate-50 rounded-xl p-2.5 text-center">
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Visitas/año</p>
                <p className="text-xs font-black text-slate-900 mt-0.5">{presupuesto.num_visitas_preventivo}</p>
              </div>
            )}
            <div className="bg-slate-50 rounded-xl p-2.5 text-center">
              <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Materiales</p>
              <p className="text-xs font-black text-slate-900 mt-0.5">{presupuesto.materiales_incluidos ? 'Incluidos' : 'Excluidos'}</p>
            </div>
          </div>

          {/* Partidas */}
          {clausulas.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Partidas del presupuesto</p>
              <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                {clausulas.map((c, i) => (
                  <div key={i} className="px-3 py-2.5 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{c.descripcion}</p>
                      <p className="text-[10px] text-slate-400">{c.cantidad} {c.unidad}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {c.precioUnitario > 0
                        ? <p className="text-xs font-black text-slate-900 font-mono">{(c.precioUnitario * c.cantidad).toFixed(2)} €</p>
                        : <p className="text-[10px] text-slate-400 italic">P. a definir</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : presupuesto.descripcion_servicios ? (
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Servicios incluidos</p>
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3">{presupuesto.descripcion_servicios}</p>
            </div>
          ) : null}

          {/* Totales */}
          {(total > 0 || presupuesto.cuota_mensual) && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-1.5">
              {total > 0 && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Base imponible</span>
                    <span className="text-sm font-black text-slate-900 font-mono">{total.toFixed(2)} €</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-500">Total con IVA (21%)</span>
                    <span className="text-base font-black text-blue-700 font-mono">{(total * 1.21).toFixed(2)} €</span>
                  </div>
                </>
              )}
              {presupuesto.cuota_mensual && (
                <div className="flex justify-between items-center pt-1.5 border-t border-blue-100">
                  <span className="text-xs text-slate-500 font-semibold">Cuota mensual</span>
                  <span className="text-sm font-black text-slate-900 font-mono">{presupuesto.cuota_mensual.toFixed(2)} €/mes</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleWhatsApp}
              className="py-2.5 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
              style={{ backgroundColor: '#25D366' }}>
              <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
            </button>
            <button onClick={handleEmail}
              className="py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200">
              <Send className="w-3.5 h-3.5" /> Email
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { onClose(); onEdit(); }}
              className="py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-700">
              <Edit2 className="w-3.5 h-3.5" /> Editar partidas
            </button>
            <button onClick={() => { onClose(); onConvert(); }}
              className="py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-blue-700">
              <ArrowRight className="w-3.5 h-3.5" /> Crear contrato
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Documento legal del contrato (con IA, cacheado) ────────────────────

interface ContratoDocModalProps {
  presupuestoId: string;
  onClose: () => void;
  showToast: Props['showToast'];
}

function ContratoDocModal({ presupuestoId, onClose, showToast }: ContratoDocModalProps) {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<MaintenanceDocumento | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ servicios: true, sla: true });

  const toggle = (k: string) => setExpandedSections(prev => ({ ...prev, [k]: !prev[k] }));

  useEffect(() => {
    void (async () => {
      try {
        const d = await generateMaintenanceDocument(presupuestoId);
        setDoc(d);
      } catch (e) {
        showToast(errMsg(e), 'error');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [presupuestoId, showToast, onClose]);

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

        <div className="p-4 border-t border-slate-100 space-y-2">
          {doc && (
            <button
              onClick={() => void downloadMaintenanceDocAsDocx(doc, `contrato-mantenimiento-${(doc.partes.cliente ?? 'cliente').toLowerCase().replace(/\s+/g, '-')}`)}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <FileDown className="w-4 h-4" /> Descargar contrato Word (.docx)
            </button>
          )}
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
      showToast(errMsg(e), 'error');
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

// ── Modal: Nueva incidencia ───────────────────────────────────────────────────

interface NuevaIncidenciaModalProps {
  contratos: MaintenanceContrato[];
  orgId: string;
  members: OrgMember[];
  onClose: () => void;
  onSaved: (i: MaintenanceIncidencia) => void;
  showToast: Props['showToast'];
}

function NuevaIncidenciaModal({ contratos, orgId, members, onClose, onSaved, showToast }: NuevaIncidenciaModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [prioridad, setPrioridad] = useState<MaintenanceIncidencia['prioridad']>('normal');
  const [contratoId, setContratoId] = useState<string>('');
  const [tecnicoUserId, setTecnicoUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const tecnicosMember = members.filter(m => m.rol === 'tecnico' || m.rol === 'admin' || m.rol === 'owner');

  const handleSave = async () => {
    if (!titulo.trim()) { showToast('El título es obligatorio', 'error'); return; }
    setSaving(true);
    const tecnico = tecnicosMember.find(m => m.user_id === tecnicoUserId) ?? null;
    try {
      const saved = await saveMaintenanceIncidencia(orgId, {
        contrato_id: contratoId || null,
        client_id: null,
        titulo: titulo.trim(),
        descripcion: descripcion.trim() || null,
        estado: 'abierta',
        prioridad,
        fecha_reporte: new Date().toISOString(),
        fecha_asignacion: tecnico ? new Date().toISOString() : null,
        fecha_inicio_intervencion: null,
        fecha_resolucion: null,
        tiempo_respuesta_min: null,
        tiempo_resolucion_min: null,
        sla_cumplido: null,
        es_extra_contrato: false,
        importe_extra: null,
        notas_resolucion: null,
        tecnico_user_id: tecnico?.user_id ?? null,
        tecnico_email: tecnico?.email ?? null,
      });
      showToast('Incidencia registrada', 'success');
      onSaved(saved);
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setSaving(false); }
  };

  const PRIO = [
    { value: 'critica',  label: 'Crítica',  cls: 'border-red-400 text-red-700 bg-red-50' },
    { value: 'urgente',  label: 'Urgente',  cls: 'border-orange-400 text-orange-700 bg-orange-50' },
    { value: 'normal',   label: 'Normal',   cls: 'border-blue-400 text-blue-700 bg-blue-50' },
    { value: 'baja',     label: 'Baja',     cls: 'border-slate-300 text-slate-500 bg-slate-50' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wide">Nueva incidencia</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Título *</label>
            <input
              value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ej: Fuga de agua en cuarto de baño"
              className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Prioridad</label>
            <div className="flex gap-2 flex-wrap">
              {PRIO.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPrioridad(p.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-all ${prioridad === p.value ? p.cls : 'border-slate-200 text-slate-400 bg-white'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Contrato (opcional)</label>
            <select
              value={contratoId} onChange={e => setContratoId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
            >
              <option value="">— Sin vincular —</option>
              {contratos.filter(c => c.estado === 'activo').map(c => (
                <option key={c.id} value={c.id}>{c.nombre_cliente} · {c.oficio}</option>
              ))}
            </select>
          </div>

          {tecnicosMember.length > 0 && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Técnico asignado (opcional)</label>
              <select
                value={tecnicoUserId} onChange={e => setTecnicoUserId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                <option value="">— Sin asignar —</option>
                {tecnicosMember.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.email} ({m.rol})</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Descripción</label>
            <textarea
              value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Descripción detallada de la incidencia..."
              className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-100">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold cursor-pointer hover:bg-slate-50">Cancelar</button>
          <button
            onClick={() => void handleSave()} disabled={saving || !titulo.trim()}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Registrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: Detalle incidencia ─────────────────────────────────────────────────

interface DetalleIncidenciaModalProps {
  incidencia: MaintenanceIncidencia;
  members: OrgMember[];
  onClose: () => void;
  onUpdated: (i: MaintenanceIncidencia) => void;
  showToast: Props['showToast'];
}

function DetalleIncidenciaModal({ incidencia, members, onClose, onUpdated, showToast }: DetalleIncidenciaModalProps) {
  const [notas, setNotas] = useState(incidencia.notas_resolucion ?? '');
  const [esExtra, setEsExtra] = useState(incidencia.es_extra_contrato);
  const [importe, setImporte] = useState(String(incidencia.importe_extra ?? ''));
  const [tecnicoUserId, setTecnicoUserId] = useState(incidencia.tecnico_user_id ?? '');
  const [saving, setSaving] = useState(false);
  const [sendingParte, setSendingParte] = useState(false);

  const tecnicosMember = members.filter(m => m.rol === 'tecnico' || m.rol === 'admin' || m.rol === 'owner');

  const handleAsignarTecnico = async (userId: string) => {
    setTecnicoUserId(userId);
    const tecnico = tecnicosMember.find(m => m.user_id === userId) ?? null;
    try {
      await updateMaintenanceIncidencia(incidencia.id, {
        tecnico_user_id: tecnico?.user_id ?? null,
        tecnico_email: tecnico?.email ?? null,
        fecha_asignacion: tecnico ? new Date().toISOString() : null,
      });
      onUpdated({ ...incidencia, tecnico_user_id: tecnico?.user_id ?? null, tecnico_email: tecnico?.email ?? null });
    } catch (e) { showToast(errMsg(e), 'error'); }
  };

  const calcMinutos = (desde: string, hasta: string) =>
    Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000);

  const handleAvanzar = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      let updates: Parameters<typeof updateMaintenanceIncidencia>[1] = {};

      if (incidencia.estado === 'abierta') {
        updates = {
          estado: 'en_curso',
          fecha_inicio_intervencion: now,
          tiempo_respuesta_min: calcMinutos(incidencia.fecha_reporte, now),
        };
      } else if (incidencia.estado === 'en_curso') {
        const tiempoResolucion = incidencia.fecha_inicio_intervencion
          ? calcMinutos(incidencia.fecha_inicio_intervencion, now)
          : null;
        updates = {
          estado: 'resuelta',
          fecha_resolucion: now,
          tiempo_resolucion_min: tiempoResolucion,
          notas_resolucion: notas.trim() || null,
          es_extra_contrato: esExtra,
          importe_extra: esExtra && importe ? Number(importe) : null,
          sla_cumplido: null,
        };
      }

      await updateMaintenanceIncidencia(incidencia.id, updates);
      const updated = { ...incidencia, ...updates };
      onUpdated(updated as MaintenanceIncidencia);
      showToast('Incidencia actualizada', 'success');
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setSaving(false); }
  };

  const handleSaveNotas = async () => {
    setSaving(true);
    try {
      await updateMaintenanceIncidencia(incidencia.id, {
        notas_resolucion: notas.trim() || null,
        es_extra_contrato: esExtra,
        importe_extra: esExtra && importe ? Number(importe) : null,
      });
      onUpdated({ ...incidencia, notas_resolucion: notas.trim() || null, es_extra_contrato: esExtra, importe_extra: esExtra && importe ? Number(importe) : null });
      showToast('Notas guardadas', 'success');
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setSaving(false); }
  };

  const handleSendParte = async () => {
    setSendingParte(true);
    try {
      await sendParteTrabajo(incidencia.id);
      showToast('Parte de trabajo enviado por email', 'success');
    } catch (e) { showToast(errMsg(e), 'error'); }
    finally { setSendingParte(false); }
  };

  const fmtMin = (m: number | null) => {
    if (m == null) return '—';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60); const min = m % 60;
    return min > 0 ? `${h}h ${min}min` : `${h}h`;
  };

  const PRIO_CLS: Record<string, string> = {
    critica: 'bg-red-100 text-red-700', urgente: 'bg-orange-100 text-orange-700',
    normal: 'bg-blue-100 text-blue-700', baja: 'bg-slate-100 text-slate-500',
  };
  const ESTADO_CLS: Record<string, string> = {
    abierta: 'bg-red-100 text-red-700', en_curso: 'bg-amber-100 text-amber-700',
    resuelta: 'bg-emerald-100 text-emerald-700', cerrada: 'bg-slate-100 text-slate-500',
  };
  const ESTADO_LABEL: Record<string, string> = {
    abierta: 'Abierta', en_curso: 'En curso', resuelta: 'Resuelta', cerrada: 'Cerrada',
  };

  const contrato = incidencia.trade_maintenance_contratos;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ESTADO_CLS[incidencia.estado] ?? ''}`}>
                {ESTADO_LABEL[incidencia.estado] ?? incidencia.estado}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${PRIO_CLS[incidencia.prioridad] ?? ''}`}>
                {incidencia.prioridad.toUpperCase()}
              </span>
            </div>
            <h2 className="font-black text-slate-900 text-base leading-tight">{incidencia.titulo}</h2>
            {contrato && <p className="text-xs text-slate-500 mt-0.5">{contrato.nombre_cliente} · {contrato.oficio}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer shrink-0"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {incidencia.descripcion && (
            <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600">{incidencia.descripcion}</div>
          )}

          {/* Tiempos */}
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Registro de tiempos</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Reporte', val: fmtDate(incidencia.fecha_reporte) },
                { label: 'Inicio intervención', val: fmtDate(incidencia.fecha_inicio_intervencion) },
                { label: 'T. respuesta', val: fmtMin(incidencia.tiempo_respuesta_min) },
                { label: 'T. resolución', val: fmtMin(incidencia.tiempo_resolucion_min) },
              ].map(({ label, val }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 font-semibold">{label}</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Técnico asignado */}
          {tecnicosMember.length > 0 && incidencia.estado !== 'cerrada' && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Técnico asignado</label>
              <select
                value={tecnicoUserId}
                onChange={e => void handleAsignarTecnico(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 bg-white"
              >
                <option value="">— Sin asignar —</option>
                {tecnicosMember.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.email} ({m.rol})</option>
                ))}
              </select>
            </div>
          )}
          {incidencia.estado === 'cerrada' && incidencia.tecnico_email && (
            <div className="bg-slate-50 rounded-xl p-3 flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico</span>
              <span className="text-sm font-semibold text-slate-700 ml-auto">{incidencia.tecnico_email}</span>
            </div>
          )}

          {/* Notas de resolución */}
          {incidencia.estado !== 'cerrada' && (
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Notas de resolución</label>
              <textarea
                value={notas} onChange={e => setNotas(e.target.value)}
                rows={3}
                placeholder="Describe el trabajo realizado..."
                className="w-full text-sm border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-none"
              />
            </div>
          )}
          {incidencia.estado === 'cerrada' && incidencia.notas_resolucion && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Trabajo realizado</p>
              <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-600 whitespace-pre-wrap">{incidencia.notas_resolucion}</div>
            </div>
          )}

          {/* Extra contrato */}
          {incidencia.estado !== 'cerrada' && (
            <div className={`rounded-xl border p-4 space-y-3 ${esExtra ? 'border-amber-200 bg-amber-50' : 'border-slate-100 bg-white'}`}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={esExtra} onChange={e => setEsExtra(e.target.checked)} className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm font-semibold text-slate-700">Intervención extra-contrato</span>
              </label>
              {esExtra && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Importe a facturar (neto, €)</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={importe} onChange={e => setImporte(e.target.value)}
                    placeholder="0.00"
                    className="w-full text-sm border border-amber-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                  />
                </div>
              )}
            </div>
          )}
          {incidencia.es_extra_contrato && incidencia.estado === 'cerrada' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Extra-contrato</p>
              <p className="text-xl font-black text-amber-700">{fmtEur(incidencia.importe_extra)}</p>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 space-y-2">
          {/* Avanzar estado */}
          {incidencia.estado === 'abierta' && (
            <button
              onClick={() => void handleAvanzar()} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-bold cursor-pointer hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
              Iniciar intervención
            </button>
          )}
          {incidencia.estado === 'en_curso' && (
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveNotas()} disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-40"
              >
                Guardar notas
              </button>
              <button
                onClick={() => void handleAvanzar()} disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold cursor-pointer hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Marcar resuelta
              </button>
            </div>
          )}
          {incidencia.estado === 'resuelta' && (
            <div className="flex gap-2">
              <button
                onClick={() => void handleSaveNotas()} disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold cursor-pointer hover:bg-slate-50 disabled:opacity-40"
              >
                Actualizar notas
              </button>
              <button
                onClick={() => void handleSendParte()} disabled={sendingParte}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-700 disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sendingParte ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Enviar parte
              </button>
            </div>
          )}
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
      showToast(errMsg(e), 'error');
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

export default function ScreenMantenimiento({ orgId, showToast, initialText, onInitialTextConsumed }: Props) {
  const [tab, setTab] = useState<'presupuestos' | 'contratos' | 'incidencias' | 'modelos' | 'facturas'>('presupuestos');
  const [loading, setLoading] = useState(true);
  const [presupuestos, setPresupuestos] = useState<MaintenancePresupuesto[]>([]);
  const [contratos, setContratos] = useState<MaintenanceContrato[]>([]);
  const [incidencias, setIncidencias] = useState<MaintenanceIncidencia[]>([]);
  const [plantillas, setPlantillas] = useState<MaintenancePlantilla[]>([]);
  const [slaList, setSlaList] = useState<MaintenanceSLA[]>([]);
  const [sectores, setSectores] = useState<MaintenanceSector[]>([]);
  const [oficios, setOficios] = useState<MaintenanceOficio[]>([]);

  const [modelos, setModelos] = useState<MaintenanceModelo[]>([]);
  const [facturas, setFacturas] = useState<TradeInvoice[]>([]);
  const [markingPagada, setMarkingPagada] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const [filterText, setFilterText]     = useState('');
  const [filterOficio, setFilterOficio] = useState('');

  const [showNuevoModal, setShowNuevoModal] = useState(false);
  const [editPresup, setEditPresup] = useState<MaintenancePresupuesto | null>(null);
  const [detallePresup, setDetallePresup] = useState<MaintenancePresupuesto | null>(null);
  const [convertPresup, setConvertPresup] = useState<MaintenancePresupuesto | null>(null);
  const [contratoDocPresupId, setContratoDocPresupId] = useState<string | null>(null);
  const [guardarModelo, setGuardarModelo] = useState<MaintenancePresupuesto | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [usandoModelo, setUsandoModelo] = useState<string | null>(null);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [showNuevaIncidencia, setShowNuevaIncidencia] = useState(false);
  const [detalleIncidencia, setDetalleIncidencia] = useState<MaintenanceIncidencia | null>(null);
  const [nuevoModalInitialText, setNuevoModalInitialText] = useState<string>('');

  useEffect(() => {
    if (initialText) {
      setNuevoModalInitialText(initialText);
      setShowNuevoModal(true);
      onInitialTextConsumed?.();
    }
  }, [initialText, onInitialTextConsumed]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogs, presups, contratos_, incids, mods, facts, members] = await Promise.all([
        loadMaintenanceCatalogs(),
        loadMaintenancePresupuestos(orgId),
        loadMaintenanceContratos(orgId),
        loadMaintenanceIncidencias(orgId),
        loadMaintenanceModelos(orgId),
        loadMaintenanceInvoicesByOrg(orgId),
        loadOrgMembers(orgId),
      ]);
      setPlantillas(catalogs.plantillas);
      setSlaList(catalogs.sla);
      setSectores(catalogs.sectores);
      setOficios(catalogs.oficios);
      setPresupuestos(presups);
      setContratos(contratos_);
      setIncidencias(incids);
      setModelos(mods);
      setFacturas(facts);
      setOrgMembers(members);
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
  const pendienteCobro = facturas.filter(f => f.estado === 'Pendiente' || f.estado === 'Vencida').reduce((s, f) => s + Number(f.total), 0);

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
      if (estado === 'enviado') {
        void sendMaintenanceNotification('presupuesto_enviado', id);
      }
    } catch { showToast('Error al actualizar estado', 'error'); }
  };

  const handleMarkPagada = async (id: string) => {
    setMarkingPagada(id);
    try {
      await markInvoicePaid(id);
      setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado: 'Pagada' as const, paid_at: new Date().toISOString() } : f));
      showToast('Factura marcada como pagada', 'success');
    } catch { showToast('Error al marcar como pagada', 'error'); }
    finally { setMarkingPagada(null); }
  };

  const handleSendEmail = async (type: 'presupuesto_enviado' | 'contrato_activado' | 'factura_pendiente', id: string) => {
    setSendingEmail(id);
    try {
      await sendMaintenanceNotification(type, id);
      showToast('Email enviado', 'success');
    } catch { showToast('Error al enviar email', 'error'); }
    finally { setSendingEmail(null); }
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
      showToast(errMsg(e), 'error');
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

  const oficiosUnicos = Array.from(new Set([
    ...presupuestos.map(p => p.oficio).filter(Boolean),
    ...contratos.map(c => c.oficio).filter(Boolean),
  ])).sort();

  const presupuestosFiltrados = presupuestos.filter(p => {
    const txt = filterText.toLowerCase();
    const matchText = !txt || (p.nombre_cliente ?? '').toLowerCase().includes(txt) || (p.sector ?? '').toLowerCase().includes(txt);
    const matchOficio = !filterOficio || p.oficio === filterOficio;
    return matchText && matchOficio;
  });

  const contratosFiltrados = contratos.filter(c => {
    const txt = filterText.toLowerCase();
    const matchText = !txt || (c.nombre_cliente ?? '').toLowerCase().includes(txt) || (c.sector ?? '').toLowerCase().includes(txt);
    const matchOficio = !filterOficio || c.oficio === filterOficio;
    return matchText && matchOficio;
  });

  const sec = 'bg-white rounded-2xl border border-slate-100 shadow-sm p-5';
  const tabCls = (t: typeof tab) =>
    `px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer transition-all ${
      tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
    }`;

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Contratos activos',   value: contratosActivos,        icon: <CheckCircle className="w-5 h-5 text-emerald-500" />, cls: 'border-emerald-100' },
          { label: 'MRR contratos',        value: fmtEur(mrrContratos),    icon: <Euro className="w-5 h-5 text-blue-500" />,          cls: 'border-blue-100' },
          { label: 'Pendiente cobro',      value: fmtEur(pendienteCobro),  icon: <BadgeEuro className="w-5 h-5 text-orange-500" />,   cls: 'border-orange-100' },
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
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto shrink-0">
          <button onClick={() => setTab('presupuestos')} className={tabCls('presupuestos')}>Presupuestos ({presupuestos.length})</button>
          <button onClick={() => setTab('contratos')} className={tabCls('contratos')}>Contratos ({contratos.length})</button>
          <button onClick={() => setTab('facturas')} className={tabCls('facturas')}>Facturas ({facturas.length})</button>
          <button onClick={() => setTab('incidencias')} className={tabCls('incidencias')}>Incidencias ({incidenciasAbiertas})</button>
          <button onClick={() => setTab('modelos')} className={tabCls('modelos')}>Modelos ({modelos.length})</button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void loadData()} className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer" title="Recargar">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>
          <button onClick={() => setShowNuevoModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Nuevo por IA
          </button>
        </div>
      </div>

      {/* ── Filtros (presupuestos + contratos) ── */}
      {(tab === 'presupuestos' || tab === 'contratos') && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Buscar por cliente o sector…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 transition-colors"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <select
              value={filterOficio}
              onChange={e => setFilterOficio(e.target.value)}
              className="pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 focus:outline-none focus:border-blue-400 cursor-pointer appearance-none transition-colors min-w-[160px]"
            >
              <option value="">Todos los tipos</option>
              {oficiosUnicos.map(o => (
                <option key={o} value={o}>{OFICIO_ICON[o] ? '' : ''}{o.charAt(0).toUpperCase() + o.slice(1)}</option>
              ))}
            </select>
          </div>
          {(filterText || filterOficio) && (
            <button
              onClick={() => { setFilterText(''); setFilterOficio(''); }}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer flex items-center gap-1.5 transition-colors"
            >
              <X className="w-3 h-3" /> Limpiar
            </button>
          )}
        </div>
      )}

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
          ) : presupuestosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-slate-400 text-sm font-semibold">Sin resultados para este filtro</p>
              <button onClick={() => { setFilterText(''); setFilterOficio(''); }} className="mt-3 text-xs text-blue-500 hover:underline cursor-pointer">Limpiar filtros</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {presupuestosFiltrados.map(p => {
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
                      <button onClick={() => setDetallePresup(p)} title="Ver detalle" className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer">
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
          ) : contratosFiltrados.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Search className="w-8 h-8 text-slate-200 mb-2" />
              <p className="text-slate-400 text-sm font-semibold">Sin contratos para este filtro</p>
              <button onClick={() => { setFilterText(''); setFilterOficio(''); }} className="mt-3 text-xs text-blue-500 hover:underline cursor-pointer">Limpiar filtros</button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {contratosFiltrados.map(c => {
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
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900">{fmtEur(c.cuota_mensual)}</span>
                        <span className="text-[10px] text-slate-400 block">/mes + IVA</span>
                      </div>
                      {c.presupuesto_id && (
                        <button
                          onClick={() => setContratoDocPresupId(c.presupuesto_id!)}
                          title="Ver documento del contrato"
                          className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => void handleSendEmail('contrato_activado', c.id)}
                        disabled={sendingEmail === c.id}
                        title="Enviar email de contrato"
                        className="p-1.5 rounded-lg text-slate-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer disabled:opacity-40 transition-colors"
                      >
                        {sendingEmail === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Facturas ── */}
      {tab === 'facturas' && (
        <div className={sec}>
          {facturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="w-10 h-10 text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin facturas de mantenimiento</p>
              <p className="text-slate-300 text-xs mt-1">Las facturas se generan automáticamente al firmar un contrato de mantenimiento</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {facturas.map(f => {
                const isPendiente = f.estado === 'Pendiente';
                const isVencida = f.estado === 'Vencida' || (isPendiente && !!f.fecha_vencimiento && new Date(f.fecha_vencimiento) < new Date());
                const isPagada = f.estado === 'Pagada';
                // Extract client name from concepto: "Mantenimiento REF — NOMBRE — periodo"
                const clientName = f.concepto?.split('—')[1]?.trim() ?? '—';
                const periodo = f.concepto?.split('—').slice(2).join('—').trim() ?? '';
                return (
                  <div key={f.id} className="py-3.5 flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${isPagada ? 'bg-emerald-50 text-emerald-500' : isVencida ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{clientName}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isPagada ? 'bg-emerald-100 text-emerald-700' :
                          isVencida ? 'bg-red-100 text-red-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {isPagada ? 'Pagada' : isVencida ? 'Vencida' : 'Pendiente'}
                        </span>
                        {f.numero && <span className="text-[10px] text-slate-400 font-mono">{f.numero}</span>}
                      </div>
                      {periodo && <p className="text-xs text-slate-500 mt-0.5">{periodo}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        {f.fecha_vencimiento && !isPagada && (
                          <span className={`text-[10px] font-semibold ${isVencida ? 'text-red-500' : 'text-slate-400'}`}>
                            Vto: {fmtDate(f.fecha_vencimiento)}
                          </span>
                        )}
                        {f.paid_at && (
                          <span className="text-[10px] text-emerald-600 font-semibold">Pagada {fmtDate(f.paid_at)}</span>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <div className="text-right mr-1">
                        <span className="text-sm font-black text-slate-900">{fmtEur(f.total)}</span>
                        <span className="text-[10px] text-slate-400 block">IVA {f.iva_pct}%</span>
                      </div>
                      {(isPendiente || isVencida) && (
                        <button
                          onClick={() => void handleMarkPagada(f.id)}
                          disabled={markingPagada === f.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-bold hover:bg-emerald-100 cursor-pointer disabled:opacity-40 flex items-center gap-1 transition-colors"
                        >
                          {markingPagada === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Cobrada
                        </button>
                      )}
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {incidencias.length} incidencia{incidencias.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={() => setShowNuevaIncidencia(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider cursor-pointer hover:bg-slate-700 transition-colors"
            >
              <Plus className="w-3 h-3" /> Nueva incidencia
            </button>
          </div>
          {incidencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-200 mb-3" />
              <p className="text-slate-400 text-sm font-semibold">Sin incidencias registradas</p>
              <p className="text-slate-300 text-xs mt-1">Registra incidencias de tus contratos activos</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {incidencias.map(i => {
                const contrato = i.trade_maintenance_contratos;
                return (
                  <div
                    key={i.id}
                    className="py-3.5 flex items-start gap-3 cursor-pointer hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                    onClick={() => setDetalleIncidencia(i)}
                  >
                    <div className="shrink-0 pt-0.5">
                      {i.prioridad === 'critica' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
                       i.prioridad === 'urgente' ? <AlertTriangle className="w-3.5 h-3.5 text-orange-500" /> :
                       i.prioridad === 'normal'  ? <Clock className="w-3.5 h-3.5 text-blue-400" /> :
                       <Clock className="w-3.5 h-3.5 text-slate-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-sm">{i.titulo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          i.estado === 'abierta'   ? 'bg-red-100 text-red-700' :
                          i.estado === 'en_curso'  ? 'bg-amber-100 text-amber-700' :
                          i.estado === 'resuelta'  ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {i.estado === 'en_curso' ? 'En curso' : i.estado.charAt(0).toUpperCase() + i.estado.slice(1)}
                        </span>
                      </div>
                      {contrato && (
                        <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{contrato.nombre_cliente} · {contrato.oficio}</p>
                      )}
                      {i.descripcion && <p className="text-xs text-slate-500 mt-0.5 truncate">{i.descripcion}</p>}
                      <p className="text-[10px] text-slate-400 mt-0.5">{fmtDate(i.fecha_reporte)}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {i.es_extra_contrato && i.importe_extra != null && (
                        <div className="text-right">
                          <span className="text-sm font-black text-amber-600">{fmtEur(i.importe_extra)}</span>
                          <span className="text-[10px] text-slate-400 block">extra</span>
                        </div>
                      )}
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                );
              })}
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
          initialText={nuevoModalInitialText}
          onClose={() => { setShowNuevoModal(false); setNuevoModalInitialText(''); }}
          onSaved={saved => { setPresupuestos(prev => [saved, ...prev]); setShowNuevoModal(false); setNuevoModalInitialText(''); }}
        />
      )}

      {editPresup && (
        <EditPresupuestoModal
          presupuesto={editPresup} slaList={slaList} sectores={sectores} oficios={oficios} showToast={showToast}
          onClose={() => setEditPresup(null)}
          onSaved={updated => { setPresupuestos(prev => prev.map(p => p.id === updated.id ? updated : p)); setEditPresup(null); }}
        />
      )}

      {detallePresup && (
        <PresupuestoDetalleModal
          presupuesto={detallePresup}
          onClose={() => setDetallePresup(null)}
          onEdit={() => setEditPresup(detallePresup)}
          onConvert={() => setConvertPresup(detallePresup)}
        />
      )}

      {contratoDocPresupId && (
        <ContratoDocModal
          presupuestoId={contratoDocPresupId}
          showToast={showToast}
          onClose={() => setContratoDocPresupId(null)}
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
            void sendMaintenanceNotification('contrato_activado', c.id);
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

      {showNuevaIncidencia && (
        <NuevaIncidenciaModal
          contratos={contratos}
          orgId={orgId}
          members={orgMembers}
          showToast={showToast}
          onClose={() => setShowNuevaIncidencia(false)}
          onSaved={saved => {
            setIncidencias(prev => [saved, ...prev]);
            setShowNuevaIncidencia(false);
          }}
        />
      )}

      {detalleIncidencia && (
        <DetalleIncidenciaModal
          incidencia={detalleIncidencia}
          members={orgMembers}
          showToast={showToast}
          onClose={() => setDetalleIncidencia(null)}
          onUpdated={updated => {
            setIncidencias(prev => prev.map(i => i.id === updated.id ? updated : i));
            setDetalleIncidencia(updated);
          }}
        />
      )}
    </div>
  );
}
