import { useState, useEffect, useRef } from 'react';
import {
  FileText, Plus, CheckCircle, Clock, Trash2,
  Eye, Download, ArrowLeft, ChevronDown, ChevronUp,
  Building2, User, CalendarDays, DollarSign, Wrench, Shield,
} from 'lucide-react';
import { downloadContractAsDocx } from '../lib/exportWord';
import type { TradeOrganization, TradeContract, MaintenancePresupuesto } from '../lib/supabase';
import {
  loadContracts, createContract, updateContract, signContract, deleteContract,
  loadMaintenancePresupuestos, saveMaintenanceContrato, createMaintenanceInvoices,
  updateMaintenancePresupuesto,
} from '../lib/supabase';
import { buildContractHTML, defaultContractVars } from '../lib/contractTemplates';
import type { ContractVars } from '../lib/contractTemplates';

interface Props {
  orgId: string;
  orgData: TradeOrganization;
  clientes: Array<{ id: string; nombre: string; cif?: string; direccion?: string; telefono?: string; email?: string }>;
  oficio?: string;
  plan?: string;
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

// ── Estilos compartidos (módulo) ─────────────────────────────────────────────
const INP = 'w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';
const LBL = 'text-[9px] uppercase font-mono font-bold text-slate-400 block mb-1';

interface ContractFieldProps {
  field: keyof ContractVars;
  label: string;
  type?: string;
  placeholder?: string;
  vars: ContractVars;
  isSigned: boolean;
  setVars: React.Dispatch<React.SetStateAction<ContractVars>>;
}

function ContractField({ field, label, type = 'text', placeholder = '', vars, isSigned, setVars }: ContractFieldProps) {
  return (
    <div>
      <span className={LBL}>{label}</span>
      {type === 'textarea' ? (
        <textarea
          rows={4}
          className={`${INP} resize-y`}
          placeholder={placeholder}
          disabled={isSigned}
          value={vars[field] as string}
          onChange={e => setVars(p => ({ ...p, [field]: e.target.value }))}
        />
      ) : (
        <input
          type={type}
          className={INP}
          placeholder={placeholder}
          disabled={isSigned}
          value={vars[field] as string}
          onChange={e => setVars(p => ({ ...p, [field]: e.target.value }))}
        />
      )}
    </div>
  );
}

export default function ScreenContratos({ orgId, orgData, clientes, oficio, plan }: Props) {
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
  const [sourceMantId, setSourceMantId] = useState<string | null>(null);
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
    iban: orgData.iban ?? base.iban ?? '',
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
    setSourceMantId(mantId ?? null);
    setOpenSection('prestador');
    setView('editor');
  };

  const openContract = (c: TradeContract) => {
    setVars({ ...defaultContractVars, ...c.variables } as ContractVars);
    setSelectedOficio(c.oficio);
    setEditingId(c.id);
    setIsSigned(c.estado === 'firmado');
    setSourceMantId(null);
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
        // Mark the source presupuesto as 'convertido' so it disappears from the banner
        if (sourceMantId) {
          try {
            await updateMaintenancePresupuesto(sourceMantId, { estado: 'convertido' });
            setMantenimientos(prev => prev.map(m => m.id === sourceMantId ? { ...m, estado: 'convertido' as const } : m));
          } catch { /* non-critical */ }
          setSourceMantId(null);
        }
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

      // Crear registro en Mantenimientos
      const cuotaMensual = parseFloat((vars.cuota_mensual ?? '0').replace(',', '.')) || 0;
      const ivaPct = parseFloat(vars.iva_pct ?? '21') || 21;
      const duracionMeses = parseInt(vars.duracion_meses ?? '12', 10) || 12;
      const diaVenc = parseInt(vars.dia_vencimiento ?? '5', 10) || 5;

      // Fecha inicio desde vars (dd/mm/yyyy) → ISO
      const parseDateES = (s: string) => {
        const parts = s.split('/');
        if (parts.length === 3) return new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
        return new Date();
      };
      const fechaInicio = parseDateES(vars.fecha_inicio);
      const fechaFin = new Date(fechaInicio);
      fechaFin.setMonth(fechaFin.getMonth() + duracionMeses);

      const mantContrato = await saveMaintenanceContrato(orgId, {
        org_id: orgId,
        client_id: null,
        presupuesto_id: null,
        plantilla_id: null,
        numero: vars.referencia,
        estado: 'activo',
        oficio: selectedOficio,
        sector: null,
        nombre_cliente: vars.nombre_cliente,
        direccion_instalacion: vars.direccion_cliente,
        descripcion_servicios: vars.descripcion_instalaciones,
        cuota_mensual: cuotaMensual,
        tipo_facturacion: vars.periodo_facturacion,
        iva_pct: ivaPct,
        sla_nivel: null,
        tiempo_respuesta_h: null,
        incluye_preventivos: false,
        num_visitas_preventivo: 0,
        frecuencia_preventivo: 'mensual',
        incluye_guardia: false,
        materiales_incluidos: false,
        fecha_inicio: fechaInicio.toISOString().split('T')[0],
        fecha_fin: fechaFin.toISOString().split('T')[0],
        duracion_meses: duracionMeses,
        renovacion_automatica: true,
        preaviso_cancelacion_dias: 30,
        dia_facturacion: diaVenc,
        proxima_factura: null,
        ultima_factura: null,
        notas: `Generado desde contrato ${vars.referencia}`,
        contract_id: editingId,
      });

      // Generar facturas según período
      if (cuotaMensual > 0) {
        await createMaintenanceInvoices(orgId, editingId, {
          clientId: null,
          cuotaMensual,
          ivaPct,
          periodoFacturacion: vars.periodo_facturacion,
          duracionMeses,
          diaVencimiento: diaVenc,
          nombreCliente: vars.nombre_cliente,
          referencia: vars.referencia,
        });
      }

      showToast(`Contrato firmado ✓ — Mantenimiento ${mantContrato.numero} activado y facturas generadas`, 'success');
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

  // Field helper — definido a nivel de módulo como ContractField para evitar re-mount

  // ── Section content ───────────────────────────────────────────────────────

  const renderSectionContent = (id: Section) => {
    switch (id) {
      case 'prestador': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContractField field="empresa" label="Razón social / Nombre autónomo" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="cif_empresa" label="CIF / NIF empresa" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div className="sm:col-span-2"><ContractField field="direccion_empresa" label="Dirección completa" placeholder="Calle, número, CP, ciudad, provincia" vars={vars} isSigned={isSigned} setVars={setVars} /></div>
          <ContractField field="telefono_empresa" label="Teléfono" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="email_empresa" label="Email" type="email" vars={vars} isSigned={isSigned} setVars={setVars} />
        </div>
      );
      case 'cliente': return (
        <div className="space-y-3">
          <div>
            <span className={LBL}>Seleccionar cliente existente</span>
            <select
              className={INP}
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
            <ContractField field="nombre_cliente" label="Razón social / Nombre cliente" vars={vars} isSigned={isSigned} setVars={setVars} />
            <ContractField field="cif_cliente" label="CIF / NIF cliente" vars={vars} isSigned={isSigned} setVars={setVars} />
            <div className="sm:col-span-2"><ContractField field="direccion_cliente" label="Dirección completa" placeholder="Calle, número, CP, ciudad, provincia" vars={vars} isSigned={isSigned} setVars={setVars} /></div>
            <ContractField field="telefono_cliente" label="Teléfono" vars={vars} isSigned={isSigned} setVars={setVars} />
            <ContractField field="email_cliente" label="Email" type="email" vars={vars} isSigned={isSigned} setVars={setVars} />
            <ContractField field="representante_cliente" label="Nombre representante / interlocutor" vars={vars} isSigned={isSigned} setVars={setVars} />
            <ContractField field="cargo_representante" label="Cargo del representante" vars={vars} isSigned={isSigned} setVars={setVars} />
          </div>
        </div>
      );
      case 'contrato': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContractField field="referencia" label="Referencia del contrato" placeholder="TF-MANT-2026-0001" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div>
            <span className={LBL}>Oficio / Tipo de instalación</span>
            <select className={INP} disabled={isSigned} value={selectedOficio} onChange={e => setSelectedOficio(e.target.value)}>
              <option value="fontaneria">Fontanería</option>
              <option value="electricidad">Electricidad</option>
              <option value="climatizacion">Climatización</option>
              <option value="general">General / Otros</option>
            </select>
          </div>
          <ContractField field="fecha_inicio" label="Fecha de inicio (DD/MM/AAAA)" placeholder="01/06/2026" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="fecha_fin" label="Fecha de fin inicial (DD/MM/AAAA)" placeholder="31/05/2027" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="duracion_meses" label="Duración (meses)" type="number" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="ciudad_firma" label="Ciudad de firma" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div className="sm:col-span-2">
            <span className={LBL}>Pre-rellenar desde presupuesto de mantenimiento</span>
            <select
              className={INP}
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
              <option value="">— Selecciona un presupuesto de mantenimiento —</option>
              {mantenimientos.filter(m => m.estado !== 'convertido').map(m => (
                <option key={m.id} value={m.id}>{m.nombre_cliente ?? '?'} — {(m.descripcion_servicios ?? '').slice(0, 40)}</option>
              ))}
            </select>
          </div>
        </div>
      );
      case 'economico': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContractField field="cuota_mensual" label="Cuota mensual sin IVA (EUR)" placeholder="350,00" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="iva_pct" label="IVA (%)" type="number" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="cuota_mensual_con_iva" label="Cuota mensual con IVA (EUR)" placeholder="423,50" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="cuota_anual" label="Cuota anual sin IVA (EUR)" placeholder="4.200,00" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div>
            <span className={LBL}>Período de facturación</span>
            <select
              className={INP}
              disabled={isSigned}
              value={vars.periodo_facturacion}
              onChange={e => setVars(p => ({ ...p, periodo_facturacion: e.target.value as 'mensual' | 'trimestral' | 'anual' }))}
            >
              <option value="mensual">Mensual (12 facturas/año)</option>
              <option value="trimestral">Trimestral (4 facturas/año)</option>
              <option value="anual">Anual (1 factura/año)</option>
            </select>
            <p className="text-[9px] text-slate-400 mt-1">
              {vars.periodo_facturacion === 'mensual' && 'Se generarán 12 facturas. La 1ª al firmar, el resto con fecha de vencimiento.'}
              {vars.periodo_facturacion === 'trimestral' && 'Se generarán 4 facturas trimestrales. Aviso 15 días antes de cada vencimiento.'}
              {vars.periodo_facturacion === 'anual' && 'Se genera 1 factura anual. Aviso de renovación 1 mes antes del vencimiento.'}
            </p>
          </div>
          <ContractField field="forma_pago" label="Forma de pago" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="dia_vencimiento" label="Día de vencimiento" type="number" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div className="sm:col-span-2"><ContractField field="iban" label="IBAN para domiciliación" placeholder="ES00 0000 0000 00 0000000000" vars={vars} isSigned={isSigned} setVars={setVars} /></div>
        </div>
      );
      case 'sla': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContractField field="horario_guardia" label="Horario de guardia ordinaria" placeholder="Lunes a viernes de 08:00 a 18:00 h" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="servicio_urgencias" label="Servicio de urgencias" placeholder="24 horas / 7 días" vars={vars} isSigned={isSigned} setVars={setVars} />
          <div className="sm:col-span-2"><ContractField field="tiempo_respuesta" label="Tiempo máximo de respuesta" placeholder="Máximo 4 horas en días laborables, 8 horas en festivos" vars={vars} isSigned={isSigned} setVars={setVars} /></div>
          <div className="sm:col-span-2"><ContractField field="tiempo_resolucion" label="Tiempo máximo de resolución" placeholder="24 horas para averías críticas, 72 horas para incidencias menores" vars={vars} isSigned={isSigned} setVars={setVars} /></div>
          <ContractField field="disponibilidad" label="Disponibilidad garantizada" placeholder="99% mensual en horario de guardia" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="penalizacion_sla" label="Penalización por incumplimiento SLA" placeholder="5% del importe mensual por día de retraso" vars={vars} isSigned={isSigned} setVars={setVars} />
        </div>
      );
      case 'instalaciones': return (
        <div className="space-y-3">
          <p className="text-[10px] text-slate-500">Describe las instalaciones cubiertas por el contrato, una por línea. Al imprimir, el Anexo I se genera con filas en blanco para rellenar a mano.</p>
          <ContractField field="descripcion_instalaciones" label="Instalaciones / equipos (una por línea)" type="textarea" placeholder={"Caldera Baxi Luna 3, Sala técnica planta 1\nFan-coils zona oficinas (3 uds)\nCircuito ACS"} vars={vars} isSigned={isSigned} setVars={setVars} />
          <div className="grid grid-cols-2 gap-3">
            <ContractField field="limite_correctivo" label="Límite coste reparación incluida (EUR)" placeholder="500" vars={vars} isSigned={isSigned} setVars={setVars} />
          </div>
        </div>
      );
      case 'legal': return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ContractField field="ciudad_jurisdiccion" label="Ciudad de jurisdicción (fuero)" placeholder="Santander" vars={vars} isSigned={isSigned} setVars={setVars} />
          <ContractField field="cobertura_rc" label="Cobertura RC mínima (EUR)" placeholder="600.000" vars={vars} isSigned={isSigned} setVars={setVars} />
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
          <div className="flex gap-2">
            <button
              onClick={() => downloadContractAsDocx(vars, selectedOficio, vars.referencia || 'contrato')}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
              title="Descargar como Word editable"
            >
              <FileText className="w-3.5 h-3.5" /> Word / DOC
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Imprimir / PDF
            </button>
          </div>
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
              <>
                <button
                  onClick={() => downloadContractAsDocx(vars, selectedOficio, vars.referencia || 'contrato')}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                  title="Descargar como Word editable"
                >
                  <FileText className="w-3.5 h-3.5" /> Word
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
              </>
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

  const isEmpresaPlus = plan === 'empresa_plus';
  const activeCount = contracts.filter(c => c.estado === 'firmado').length;
  const CONTRACT_LIMIT = 2;
  const limitReached = !isEmpresaPlus && activeCount >= CONTRACT_LIMIT;

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">Contratos de Mantenimiento</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[10px] text-slate-400">{contracts.length} contrato{contracts.length !== 1 ? 's' : ''}</p>
            {!isEmpresaPlus && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${limitReached ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                {activeCount}/{CONTRACT_LIMIT} activos
              </span>
            )}
            {isEmpresaPlus && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">Ilimitados</span>
            )}
          </div>
        </div>
        <button
          onClick={() => { if (limitReached) { showToast(`Plan Empresa permite máximo ${CONTRACT_LIMIT} contratos activos. Actualiza a Empresa+ para contratos ilimitados.`, 'error'); return; } startNew(); }}
          className={`flex items-center gap-1.5 text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer transition-colors ${limitReached ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          <Plus className="w-3.5 h-3.5" /> Nuevo contrato
        </button>
      </div>

      {limitReached && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          Has alcanzado el límite de <strong>{CONTRACT_LIMIT} contratos activos</strong> del plan Empresa. Actualiza a <strong>Empresa+</strong> para contratos ilimitados.
        </div>
      )}

      {/* Quick-create from mantenimiento — only show non-converted ones */}
      {mantenimientos.filter(m => m.estado !== 'convertido').length > 0 && !limitReached && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-bold text-blue-800 mb-2">Crear contrato desde un presupuesto de mantenimiento</p>
          <div className="flex flex-wrap gap-2">
            {mantenimientos.filter(m => m.estado !== 'convertido').slice(0, 5).map(m => (
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
      ) : limitReached && contracts.every(c => c.estado === 'firmado') ? (
        <div className="text-center py-12 space-y-2">
          <p className="text-slate-500 text-xs font-semibold">Límite de {CONTRACT_LIMIT} contratos activos alcanzado.</p>
          <p className="text-slate-400 text-[10px]">Actualiza a Empresa+ para contratos ilimitados.</p>
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
