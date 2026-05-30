import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, CheckCircle, Clock, Trash2,
  Eye, Download, ArrowLeft, ChevronDown, ChevronUp,
  Building2, User, CalendarDays, DollarSign, Wrench, Shield,
} from 'lucide-react';
import type { TradeOrganization, TradeContract, MaintenancePresupuesto } from '../lib/supabase';
import {
  loadContracts, createContract, updateContract, signContract, deleteContract,
  loadMaintenancePresupuestos,
} from '../lib/supabase';
import { buildContractHTML, defaultContractVars } from '../lib/contractTemplates';
import type { ContractVars } from '../lib/contractTemplates';

interface Props {
  orgId: string;
  orgData: TradeOrganization;
  clientes: Array<{ id: string; nombre: string; cif?: string; direccion?: string; telefono?: string; email?: string }>;
  oficio?: string;
}

function fmtDate(s: string): string {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function nextRef(existing: TradeContract[]): string {
  const year = new Date().getFullYear();
  const nums = existing
    .map(c => parseInt(c.referencia.split('-').at(-1) ?? '0', 10))
    .filter(n => !isNaN(n));
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `TF-MANT-${year}-${String(next).padStart(4, '0')}`;
}

type Section = 'prestador' | 'cliente' | 'contrato' | 'economico' | 'sla' | 'instalaciones' | 'legal';
const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'prestador', label: 'Datos del prestador', icon: <Building2 className="w-4 h-4" /> },
  { id: 'cliente', label: 'Datos del cliente', icon: <User className="w-4 h-4" /> },
  { id: 'contrato', label: 'Duración y condiciones', icon: <CalendarDays className="w-4 h-4" /> },
  { id: 'economico', label: 'Importe y pago', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'sla', label: 'Horario y SLA', icon: <Wrench className="w-4 h-4" /> },
  { id: 'instalaciones', label: 'Instalaciones', icon: <Building2 className="w-4 h-4" /> },
  { id: 'legal', label: 'Datos legales', icon: <Shield className="w-4 h-4" /> },
];

export default function ScreenContratos({ orgId, orgData, clientes, oficio }: Props) {
  const [contracts, setContracts] = useState<TradeContract[]>([]);
  const [mantenimientos, setMantenimientos] = useState<MaintenancePresupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'editor' | 'preview'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSigned, setIsSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [openSection, setOpenSection] = useState<Section>('prestador');
  const [vars, setVars] = useState<ContractVars>({ ...defaultContractVars });
  const [selectedOficio, setSelectedOficio] = useState(oficio ?? orgData.oficio ?? 'fontaneria');
  const previewRef = useRef<HTMLIFrameElement>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    Promise.all([
      loadContracts(orgId),
      loadMaintenancePresupuestos(orgId),
    ])
      .then(([cs, ms]) => { setContracts(cs); setMantenimientos(ms); })
      .catch(() => showToast('Error cargando datos', 'error'))
      .finally(() => setLoading(false));
  }, [orgId]);

  const prefillFromOrg = (base: ContractVars): ContractVars => ({
    ...base,
    empresa: orgData.nombre ?? '',
    cif_empresa: (orgData as any).nif ?? '',
    direccion_empresa: [orgData.direccion, (orgData as any).localidad, (orgData as any).provincia].filter(Boolean).join(', '),
    telefono_empresa: (orgData as any).telefono_movil ?? orgData.telefono ?? '',
    email_empresa: orgData.email ?? '',
    logo_url: orgData.logo_url ?? undefined,
    iva_pct: String(orgData.iva_default ?? 21),
    ciudad_firma: (orgData as any).localidad ?? (orgData as any).ciudad ?? '',
    ciudad_jurisdiccion: (orgData as any).localidad ?? '',
  });

  const prefillFromMant = (base: ContractVars, mantId: string): ContractVars => {
    const m = mantenimientos.find(m => m.id === mantId);
    if (!m) return base;
    const nombreCliente = m.nombre_cliente ?? '';
    const cliente = clientes.find(c => c.nombre === nombreCliente);
    const cuota = m.cuota_mensual ?? 0;
    const iva = parseFloat(base.iva_pct || '21');
    const duracion = m.duracion_meses ?? 12;
    const fechaInicio = new Date();
    const fechaFin = new Date(fechaInicio);
    fechaFin.setMonth(fechaFin.getMonth() + duracion);
    return {
      ...base,
      nombre_cliente: nombreCliente,
      cif_cliente: cliente ? (cliente as any).nif ?? '' : '',
      direccion_cliente: m.direccion_instalacion ?? cliente?.direccion ?? '',
      telefono_cliente: cliente?.telefono ?? '',
      email_cliente: cliente?.email ?? '',
      descripcion_instalaciones: m.descripcion_servicios ?? '',
      duracion_meses: String(duracion),
      fecha_inicio: fechaInicio.toLocaleDateString('es-ES'),
      fecha_fin: fechaFin.toLocaleDateString('es-ES'),
      cuota_mensual: cuota > 0 ? cuota.toFixed(2).replace('.', ',') : base.cuota_mensual,
      cuota_mensual_con_iva: cuota > 0 ? (cuota * (1 + iva / 100)).toFixed(2).replace('.', ',') : base.cuota_mensual_con_iva,
      cuota_anual: cuota > 0 ? (cuota * 12).toFixed(2).replace('.', ',') : base.cuota_anual,
      iva_pct: String(m.iva_pct ?? 21),
      horario_guardia: m.incluye_guardia ? '24 horas / 7 días' : 'Lunes a viernes de 08:00 a 18:00 h',
      servicio_urgencias: m.incluye_guardia ? '24 horas / 7 días' : 'No incluido',
      tiempo_respuesta: m.tiempo_respuesta_h ? `Máximo ${m.tiempo_respuesta_h} horas` : base.tiempo_respuesta,
    };
  };

  const startNew = (mantId?: string) => {
    let base = prefillFromOrg({ ...defaultContractVars });
    if (mantId) {
      const m = mantenimientos.find(m => m.id === mantId);
      base = prefillFromMant(base, mantId);
      if (m?.oficio) setSelectedOficio(m.oficio);
    }
    base.referencia = nextRef(contracts);
    const today = new Date();
    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + 12);
    base.fecha_inicio = today.toLocaleDateString('es-ES');
    base.fecha_fin = endDate.toLocaleDateString('es-ES');
    setVars(base);
    setEditingId(null);
    setIsSigned(false);
    setOpenSection('prestador');
    setView('editor');
  };

  const openContract = (c: TradeContract) => {
    setVars({ ...defaultContractVars, ...c.variables } as ContractVars);
    setSelectedOficio(c.oficio);
    setEditingId(c.id);
    setIsSigned(c.estado === 'firmado');
    setOpenSection('prestador');
    setView('editor');
  };

  const getPreviewHTML = () => buildContractHTML(vars, selectedOficio);

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const html = getPreviewHTML();
      if (editingId) {
        await updateContract(editingId, { variables: vars as unknown as Record<string, string>, contenido_html: html });
        setContracts(prev => prev.map(c => c.id === editingId ? { ...c, variables: vars as unknown as Record<string, string>, contenido_html: html } : c));
        showToast('Borrador actualizado ✓', 'success');
      } else {
        const saved = await createContract(orgId, {
          referencia: vars.referencia,
          oficio: selectedOficio,
          variables: vars as unknown as Record<string, string>,
          contenido_html: html,
        });
        setContracts(prev => [saved, ...prev]);
        setEditingId(saved.id);
        showToast('Borrador guardado ✓', 'success');
      }
    } catch (e: unknown) {
      showToast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSign = async () => {
    if (!editingId) {
      showToast('Guarda el borrador primero', 'info');
      return;
    }
    if (!confirm('¿Firmar y cerrar el contrato? Una vez firmado no podrá modificarse.')) return;
    setSaving(true);
    try {
      const html = getPreviewHTML();
      await signContract(editingId, html);
      setContracts(prev => prev.map(c => c.id === editingId
        ? { ...c, estado: 'firmado', contenido_html: html, firmado_at: new Date().toISOString() }
        : c,
      ));
      setIsSigned(true);
      showToast('Contrato firmado y cerrado ✓', 'success');
    } catch (e: unknown) {
      showToast('Error: ' + (e instanceof Error ? e.message : String(e)), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const c = contracts.find(x => x.id === id);
    if (c?.estado === 'firmado') { showToast('No se puede eliminar un contrato firmado', 'error'); return; }
    if (!confirm('¿Eliminar este borrador?')) return;
    try {
      await deleteContract(id);
      setContracts(prev => prev.filter(x => x.id !== id));
    } catch { showToast('Error al eliminar', 'error'); }
  };

  const handlePrint = () => {
    const html = isSigned
      ? (contracts.find(c => c.id === editingId)?.contenido_html ?? getPreviewHTML())
      : getPreviewHTML();
    const win = window.open('', '_blank');
    if (!win) { showToast('Permite ventanas emergentes para imprimir', 'info'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── Field helper ──────────────────────────────────────────────────────────

  const inp = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
  const lbl = 'text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1';

  const Field = ({ field, label, type = 'text', placeholder = '' }: {
    field: keyof ContractVars; label: string; type?: string; placeholder?: string;
  }) => (
    <div>
      <span className={lbl}>{label}</span>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          className={`${inp} resize-y`}
          placeholder={placeholder}
          disabled={isSigned}
          value={vars[field] as string}
          onChange={e => setVars(p => ({ ...p, [field]: e.target.value }))}
        />
      ) : (
        <input
          type={type}
          className={inp}
          placeholder={placeholder}
          disabled={isSigned}
          value={vars[field] as string}
          onChange={e => setVars(p => ({ ...p, [field]: e.target.value }))}
        />
      )}
    </div>
  );

  // ── Section content ───────────────────────────────────────────────────────

  const renderSectionContent = (id: Section) => {
    switch (id) {
      case 'prestador': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="empresa" label="Razón social / Nombre autónomo" />
          <Field field="cif_empresa" label="CIF / NIF empresa" />
          <div className="sm:col-span-2"><Field field="direccion_empresa" label="Dirección completa" placeholder="Calle, número, CP, ciudad, provincia" /></div>
          <Field field="telefono_empresa" label="Teléfono" />
          <Field field="email_empresa" label="Email" type="email" />
        </div>
      );
      case 'cliente': return (
        <div className="space-y-3">
          <div>
            <span className={lbl}>Seleccionar cliente existente</span>
            <select
              className={inp}
              disabled={isSigned}
              value=""
              onChange={e => {
                const c = clientes.find(x => x.id === e.target.value);
                if (!c) return;
                setVars(p => ({
                  ...p,
                  nombre_cliente: c.nombre,
                  cif_cliente: (c as any).nif ?? '',
                  direccion_cliente: c.direccion ?? '',
                  telefono_cliente: c.telefono ?? '',
                  email_cliente: c.email ?? '',
                }));
              }}
            >
              <option value="">— Cargar datos de un cliente —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field field="nombre_cliente" label="Razón social / Nombre cliente" />
            <Field field="cif_cliente" label="CIF / NIF cliente" />
            <div className="sm:col-span-2"><Field field="direccion_cliente" label="Dirección completa" placeholder="Calle, número, CP, ciudad, provincia" /></div>
            <Field field="telefono_cliente" label="Teléfono" />
            <Field field="email_cliente" label="Email" type="email" />
            <Field field="representante_cliente" label="Nombre representante / interlocutor" />
            <Field field="cargo_representante" label="Cargo del representante" />
          </div>
        </div>
      );
      case 'contrato': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="referencia" label="Referencia del contrato" placeholder="TF-MANT-2026-0001" />
          <div>
            <span className={lbl}>Oficio / Tipo de instalación</span>
            <select className={inp} disabled={isSigned} value={selectedOficio} onChange={e => setSelectedOficio(e.target.value)}>
              <option value="fontaneria">Fontanería</option>
              <option value="electricidad">Electricidad</option>
              <option value="climatizacion">Climatización</option>
              <option value="general">General / Otros</option>
            </select>
          </div>
          <Field field="fecha_inicio" label="Fecha de inicio (DD/MM/AAAA)" placeholder="01/06/2026" />
          <Field field="fecha_fin" label="Fecha de fin inicial (DD/MM/AAAA)" placeholder="31/05/2027" />
          <Field field="duracion_meses" label="Duración (meses)" type="number" />
          <Field field="ciudad_firma" label="Ciudad de firma" />
          <div className="sm:col-span-2">
            <div>
              <span className={lbl}>Pre-rellenar desde mantenimiento</span>
              <select
                className={inp}
                disabled={isSigned}
                value=""
                onChange={e => {
                  if (!e.target.value) return;
                  const updated = prefillFromMant(vars, e.target.value);
                  setVars(updated);
                  const m = mantenimientos.find(m => m.id === e.target.value);
                  if (m?.oficio) setSelectedOficio(m.oficio);
                  showToast('Datos cargados del presupuesto de mantenimiento ✓', 'info');
                }}
              >
                <option value="">— Cargar datos de un mantenimiento —</option>
                {mantenimientos.map(m => (
                  <option key={m.id} value={m.id}>{m.nombre_cliente ?? '?'} — {(m.descripcion_servicios ?? '').slice(0, 40)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      );
      case 'economico': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="cuota_mensual" label="Cuota mensual sin IVA (EUR)" placeholder="350,00" />
          <Field field="iva_pct" label="IVA (%)" type="number" />
          <Field field="cuota_mensual_con_iva" label="Cuota mensual con IVA (EUR)" placeholder="423,50" />
          <Field field="cuota_anual" label="Cuota anual sin IVA (EUR)" placeholder="4.200,00" />
          <Field field="forma_pago" label="Forma de pago" />
          <Field field="dia_vencimiento" label="Día de vencimiento" type="number" />
          <div className="sm:col-span-2"><Field field="iban" label="IBAN para domiciliación" placeholder="ES00 0000 0000 00 0000000000" /></div>
        </div>
      );
      case 'sla': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="horario_guardia" label="Horario de guardia ordinaria" placeholder="Lunes a viernes de 08:00 a 18:00 h" />
          <Field field="servicio_urgencias" label="Servicio de urgencias" placeholder="24 horas / 7 días" />
          <div className="sm:col-span-2"><Field field="tiempo_respuesta" label="Tiempo máximo de respuesta" placeholder="Máximo 4 horas en días laborables, 8 horas en festivos" /></div>
          <div className="sm:col-span-2"><Field field="tiempo_resolucion" label="Tiempo máximo de resolución" placeholder="24 horas para averías críticas, 72 horas para incidencias menores" /></div>
          <Field field="disponibilidad" label="Disponibilidad garantizada" placeholder="99% mensual en horario de guardia" />
          <Field field="penalizacion_sla" label="Penalización por incumplimiento SLA" placeholder="5% del importe mensual por día de retraso" />
        </div>
      );
      case 'instalaciones': return (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-500">Describe las instalaciones cubiertas por el contrato, una por línea.</p>
          <Field field="descripcion_instalaciones" label="Instalaciones (una por línea)" type="textarea" placeholder={"Planta de producción, Nave A, C/ Industrial 4\nAlmacén exterior, Polígono Norte"} />
          <div className="grid grid-cols-2 gap-3">
            <Field field="limite_correctivo" label="Límite coste reparación incluida (EUR)" placeholder="500" />
          </div>
        </div>
      );
      case 'legal': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field field="ciudad_jurisdiccion" label="Ciudad de jurisdicción (fuero)" placeholder="Santander" />
          <Field field="cobertura_rc" label="Cobertura RC mínima (EUR)" placeholder="600.000" />
        </div>
      );
    }
  };

  // ── VIEWS ─────────────────────────────────────────────────────────────────

  if (view === 'preview') {
    const html = isSigned
      ? (contracts.find(c => c.id === editingId)?.contenido_html ?? getPreviewHTML())
      : getPreviewHTML();
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 p-4 border-b border-slate-200 bg-white shrink-0">
          <button onClick={() => setView('editor')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors text-xs">
            <ArrowLeft className="w-4 h-4" /> Volver al editor
          </button>
          <span className="flex-1 font-bold text-sm text-slate-800 truncate">{vars.referencia}</span>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Imprimir / PDF
          </button>
        </div>
        <iframe
          ref={previewRef}
          srcDoc={html}
          className="flex-1 w-full border-0"
          title="Vista previa del contrato"
        />
        {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-white text-xs font-bold shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  if (view === 'editor') {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 bg-white shrink-0 sticky top-0 z-10">
          <button onClick={() => setView('list')} className="flex items-center gap-1 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors text-xs">
            <ArrowLeft className="w-4 h-4" /> Contratos
          </button>
          <div className="flex-1">
            <p className="font-bold text-sm text-slate-900">{vars.referencia || 'Nuevo contrato'}</p>
            {isSigned && <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold uppercase px-2 py-0.5 rounded-full">FIRMADO · INMUTABLE</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('preview')}
              className="flex items-center gap-1.5 border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <Eye className="w-3.5 h-3.5" /> Vista previa
            </button>
            {!isSigned && (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  {saving ? 'Guardando…' : 'Guardar borrador'}
                </button>
                <button
                  onClick={handleSign}
                  disabled={saving || !editingId}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Firmar contrato
                </button>
              </>
            )}
            {isSigned && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Imprimir / PDF
              </button>
            )}
          </div>
        </div>

        {isSigned && (
          <div className="mx-5 mt-4 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700 font-semibold">
            Este contrato está firmado y cerrado. Para modificaciones, crea un nuevo contrato.
          </div>
        )}

        {/* Accordion sections */}
        <div className="p-5 space-y-2">
          {SECTIONS.map(section => (
            <div key={section.id} className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setOpenSection(p => p === section.id ? ('prestador' as Section) : section.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 text-slate-700">
                  {section.icon}
                  <span className="text-xs font-bold">{section.label}</span>
                </div>
                {openSection === section.id
                  ? <ChevronUp className="w-4 h-4 text-slate-400" />
                  : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>
              {openSection === section.id && (
                <div className="p-4 bg-white">
                  {renderSectionContent(section.id)}
                </div>
              )}
            </div>
          ))}
        </div>

        {toast && (
          <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-white text-xs font-bold shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Contratos de Mantenimiento</h2>
          <p className="text-[10px] text-slate-400 mt-0.5">{contracts.length} contrato{contracts.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => startNew()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo contrato
        </button>
      </div>

      {/* Quick-create from mantenimiento */}
      {mantenimientos.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-2">Crear contrato desde un presupuesto de mantenimiento</p>
          <div className="flex flex-wrap gap-2">
            {mantenimientos.slice(0, 5).map(m => (
              <button
                key={m.id}
                onClick={() => startNew(m.id)}
                className="text-[10px] bg-white border border-blue-200 text-blue-700 font-bold px-3 py-1.5 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
              >
                {m.nombre_cliente ?? '?'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contract list */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">Cargando contratos…</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-10 h-10 text-slate-200 mx-auto" />
          <p className="text-slate-400 text-xs">No hay contratos todavía. Crea el primero.</p>
          <button
            onClick={() => startNew()}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Crear primer contrato
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map(c => (
            <div
              key={c.id}
              onClick={() => openContract(c)}
              className="bg-white border border-slate-200 rounded-xl px-5 py-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {c.estado === 'firmado'
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                      : <Clock className="w-4 h-4 text-amber-500 shrink-0" />}
                    <span className="font-bold text-sm text-slate-900 font-mono truncate">{c.referencia}</span>
                    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 ${c.estado === 'firmado' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {c.estado === 'firmado' ? 'Firmado' : 'Borrador'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 truncate">{(c.variables as any).nombre_cliente || '—'}</p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {(c.variables as any).cuota_mensual ? `${(c.variables as any).cuota_mensual} EUR/mes · ` : ''}
                    {fmtDate(c.created_at)}
                    {c.firmado_at ? ` · Firmado ${fmtDate(c.firmado_at)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={e => { e.stopPropagation(); openContract(c); setView('preview'); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                    title="Vista previa"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {c.estado !== 'firmado' && (
                    <button
                      onClick={e => handleDelete(c.id, e)}
                      className="p-1.5 rounded-lg text-red-300 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                      title="Eliminar borrador"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-xl text-white text-xs font-bold shadow-lg z-50 ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-blue-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
