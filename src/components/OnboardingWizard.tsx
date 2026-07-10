import React, { useState, useRef } from 'react';
import {
  Building2, Euro, Package, CreditCard, Image, MessageSquare,
  Bell, ChevronRight, ChevronLeft, Check, X, Loader2,
  Wrench, Zap, Thermometer, Hammer, PaintBucket, Layers,
  Wifi, KeyRound, Scissors, Truck, Leaf, Shield,
  Upload, Star, Info, ArrowRight, CalendarDays,
} from 'lucide-react';
import { supabase, importCatalogItems, saveOrgTemplate, uploadOrgLogo } from '../lib/supabase';
import type { TemplateType } from '../lib/supabase';
import { useSession } from '../context/SessionContext';
import {
  loadWorkCalendar, saveWorkCalendar, DAY_NAMES, FESTIVOS_NACIONALES,
  type WorkCalendar, type HolidayEntry,
} from '../lib/workCalendar';

// ─── Catálogo base por área ───────────────────────────────────────────────────

const AREAS: { id: string; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'fontaneria',        label: 'Fontanería',           icon: <Wrench className="w-5 h-5" />,       color: 'bg-blue-50 border-blue-300 text-blue-700' },
  { id: 'electricidad',      label: 'Electricidad',         icon: <Zap className="w-5 h-5" />,          color: 'bg-yellow-50 border-yellow-300 text-yellow-700' },
  { id: 'climatizacion',     label: 'Climatización',        icon: <Thermometer className="w-5 h-5" />,  color: 'bg-cyan-50 border-cyan-300 text-cyan-700' },
  { id: 'carpinteria',       label: 'Carpintería',          icon: <Hammer className="w-5 h-5" />,       color: 'bg-amber-50 border-amber-300 text-amber-700' },
  { id: 'pintura',           label: 'Pintura',              icon: <PaintBucket className="w-5 h-5" />,  color: 'bg-pink-50 border-pink-300 text-pink-700' },
  { id: 'albanileria',       label: 'Albañilería',          icon: <Layers className="w-5 h-5" />,        color: 'bg-orange-50 border-orange-300 text-orange-700' },
  { id: 'telecomunicaciones', label: 'Telecomunicaciones',  icon: <Wifi className="w-5 h-5" />,         color: 'bg-purple-50 border-purple-300 text-purple-700' },
  { id: 'cerrajeria',        label: 'Cerrajería',           icon: <KeyRound className="w-5 h-5" />,     color: 'bg-slate-50 border-slate-300 text-slate-700' },
  { id: 'jardineria',        label: 'Jardinería',           icon: <Leaf className="w-5 h-5" />,         color: 'bg-green-50 border-green-300 text-green-700' },
  { id: 'seguridad',         label: 'Seguridad',            icon: <Shield className="w-5 h-5" />,       color: 'bg-red-50 border-red-300 text-red-700' },
  { id: 'reformas',          label: 'Reformas integrales',  icon: <Scissors className="w-5 h-5" />,     color: 'bg-indigo-50 border-indigo-300 text-indigo-700' },
  { id: 'mudanzas',          label: 'Mudanzas / Transporte', icon: <Truck className="w-5 h-5" />,       color: 'bg-teal-50 border-teal-300 text-teal-700' },
];

const CATALOG_BASE: Record<string, { codigo: string; descripcion: string; precio_base: number; unidad: string }[]> = {
  fontaneria: [
    { codigo: 'F001', descripcion: 'Mano de obra fontanería (hora)', precio_base: 45, unidad: 'h' },
    { codigo: 'F002', descripcion: 'Grifo monomando cocina', precio_base: 65, unidad: 'ud' },
    { codigo: 'F003', descripcion: 'Grifo monomando baño', precio_base: 55, unidad: 'ud' },
    { codigo: 'F004', descripcion: 'Inodoro completo instalado', precio_base: 280, unidad: 'ud' },
    { codigo: 'F005', descripcion: 'Bote sifónico', precio_base: 18, unidad: 'ud' },
    { codigo: 'F006', descripcion: 'Tubo PVC desagüe Ø40 (ml)', precio_base: 4, unidad: 'ml' },
    { codigo: 'F007', descripcion: 'Llave de corte 1/2"', precio_base: 12, unidad: 'ud' },
    { codigo: 'F008', descripcion: 'Latiguillo flexible 1/2"', precio_base: 6, unidad: 'ud' },
    { codigo: 'F009', descripcion: 'Bomba de circulación calefacción', precio_base: 180, unidad: 'ud' },
    { codigo: 'F010', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  electricidad: [
    { codigo: 'E001', descripcion: 'Mano de obra electricidad (hora)', precio_base: 45, unidad: 'h' },
    { codigo: 'E002', descripcion: 'Punto de luz (mecanismo + caja)', precio_base: 55, unidad: 'ud' },
    { codigo: 'E003', descripcion: 'Toma de corriente 16A', precio_base: 40, unidad: 'ud' },
    { codigo: 'E004', descripcion: 'Cuadro eléctrico hasta 10 elementos', precio_base: 320, unidad: 'ud' },
    { codigo: 'E005', descripcion: 'Cable eléctrico 2.5mm² (ml)', precio_base: 1.8, unidad: 'ml' },
    { codigo: 'E006', descripcion: 'Interruptor diferencial 40A/30mA', precio_base: 55, unidad: 'ud' },
    { codigo: 'E007', descripcion: 'Magnetotérmico 10A', precio_base: 18, unidad: 'ud' },
    { codigo: 'E008', descripcion: 'Luminaria LED techo 18W', precio_base: 45, unidad: 'ud' },
    { codigo: 'E009', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  climatizacion: [
    { codigo: 'C001', descripcion: 'Mano de obra climatización (hora)', precio_base: 50, unidad: 'h' },
    { codigo: 'C002', descripcion: 'Split 1x1 inverter 2.500 frig. instalado', precio_base: 750, unidad: 'ud' },
    { codigo: 'C003', descripcion: 'Split 1x1 inverter 3.500 frig. instalado', precio_base: 950, unidad: 'ud' },
    { codigo: 'C004', descripcion: 'Radiador aluminio (por elemento)', precio_base: 22, unidad: 'ud' },
    { codigo: 'C005', descripcion: 'Purgador automático', precio_base: 15, unidad: 'ud' },
    { codigo: 'C006', descripcion: 'Caldera de gas condensación instalada', precio_base: 1400, unidad: 'ud' },
    { codigo: 'C007', descripcion: 'Termostato digital programable', precio_base: 85, unidad: 'ud' },
    { codigo: 'C008', descripcion: 'Recarga gas refrigerante R-410A', precio_base: 95, unidad: 'ud' },
    { codigo: 'C009', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  carpinteria: [
    { codigo: 'CA001', descripcion: 'Mano de obra carpintería (hora)', precio_base: 40, unidad: 'h' },
    { codigo: 'CA002', descripcion: 'Puerta interior lisa con marco instalada', precio_base: 320, unidad: 'ud' },
    { codigo: 'CA003', descripcion: 'Puerta corredera con guías', precio_base: 450, unidad: 'ud' },
    { codigo: 'CA004', descripcion: 'Ventana PVC doble cristal 1x1.2m', precio_base: 280, unidad: 'ud' },
    { codigo: 'CA005', descripcion: 'Suelo laminado instalado (m²)', precio_base: 28, unidad: 'm²' },
    { codigo: 'CA006', descripcion: 'Zócalo MDF pintado (ml)', precio_base: 6, unidad: 'ml' },
    { codigo: 'CA007', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  pintura: [
    { codigo: 'P001', descripcion: 'Mano de obra pintura (hora)', precio_base: 35, unidad: 'h' },
    { codigo: 'P002', descripcion: 'Pintura plástica interior (m²)', precio_base: 7, unidad: 'm²' },
    { codigo: 'P003', descripcion: 'Pintura exterior monocapa (m²)', precio_base: 12, unidad: 'm²' },
    { codigo: 'P004', descripcion: 'Imprimación fijadora (m²)', precio_base: 3, unidad: 'm²' },
    { codigo: 'P005', descripcion: 'Gotelé fino (m²)', precio_base: 9, unidad: 'm²' },
    { codigo: 'P006', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  albanileria: [
    { codigo: 'AL001', descripcion: 'Mano de obra albañilería (hora)', precio_base: 40, unidad: 'h' },
    { codigo: 'AL002', descripcion: 'Tabique ladrillo hueco doble (m²)', precio_base: 55, unidad: 'm²' },
    { codigo: 'AL003', descripcion: 'Enfoscado de mortero (m²)', precio_base: 18, unidad: 'm²' },
    { codigo: 'AL004', descripcion: 'Alicatado azulejo (m²)', precio_base: 45, unidad: 'm²' },
    { codigo: 'AL005', descripcion: 'Solado gres (m²)', precio_base: 50, unidad: 'm²' },
    { codigo: 'AL006', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  telecomunicaciones: [
    { codigo: 'T001', descripcion: 'Mano de obra telecomunicaciones (hora)', precio_base: 45, unidad: 'h' },
    { codigo: 'T002', descripcion: 'Punto de datos RJ45 Cat.6', precio_base: 65, unidad: 'ud' },
    { codigo: 'T003', descripcion: 'Punto de TV/SAT', precio_base: 55, unidad: 'ud' },
    { codigo: 'T004', descripcion: 'Router WiFi instalado y configurado', precio_base: 120, unidad: 'ud' },
    { codigo: 'T005', descripcion: 'Cable FTP Cat.6 (ml)', precio_base: 1.5, unidad: 'ml' },
    { codigo: 'T006', descripcion: 'Desplazamiento y visita', precio_base: 35, unidad: 'ud' },
  ],
  cerrajeria: [
    { codigo: 'CE001', descripcion: 'Mano de obra cerrajería (hora)', precio_base: 45, unidad: 'h' },
    { codigo: 'CE002', descripcion: 'Apertura de puerta sin daños', precio_base: 120, unidad: 'ud' },
    { codigo: 'CE003', descripcion: 'Bombín de seguridad con 5 llaves', precio_base: 85, unidad: 'ud' },
    { codigo: 'CE004', descripcion: 'Cerradura embutir 3 puntos', precio_base: 180, unidad: 'ud' },
    { codigo: 'CE005', descripcion: 'Desplazamiento urgente', precio_base: 55, unidad: 'ud' },
  ],
  jardineria: [
    { codigo: 'J001', descripcion: 'Mano de obra jardinería (hora)', precio_base: 30, unidad: 'h' },
    { codigo: 'J002', descripcion: 'Poda de setos (hora)', precio_base: 35, unidad: 'h' },
    { codigo: 'J003', descripcion: 'Siembra césped (m²)', precio_base: 8, unidad: 'm²' },
    { codigo: 'J004', descripcion: 'Instalación riego automático', precio_base: 450, unidad: 'ud' },
    { codigo: 'J005', descripcion: 'Desplazamiento y visita', precio_base: 25, unidad: 'ud' },
  ],
  seguridad: [
    { codigo: 'S001', descripcion: 'Mano de obra seguridad (hora)', precio_base: 45, unidad: 'h' },
    { codigo: 'S002', descripcion: 'Cámara IP exterior instalada', precio_base: 180, unidad: 'ud' },
    { codigo: 'S003', descripcion: 'Alarma perimetral (zona)', precio_base: 120, unidad: 'ud' },
    { codigo: 'S004', descripcion: 'Central alarma con monitoreo', precio_base: 850, unidad: 'ud' },
    { codigo: 'S005', descripcion: 'Desplazamiento y visita', precio_base: 40, unidad: 'ud' },
  ],
  reformas: [
    { codigo: 'R001', descripcion: 'Gestión y dirección de obra (hora)', precio_base: 60, unidad: 'h' },
    { codigo: 'R002', descripcion: 'Demolición tabique (m²)', precio_base: 25, unidad: 'm²' },
    { codigo: 'R003', descripcion: 'Reforma baño completo', precio_base: 3500, unidad: 'ud' },
    { codigo: 'R004', descripcion: 'Reforma cocina completa', precio_base: 5000, unidad: 'ud' },
    { codigo: 'R005', descripcion: 'Desplazamiento y valoración', precio_base: 50, unidad: 'ud' },
  ],
  mudanzas: [
    { codigo: 'M001', descripcion: 'Mano de obra mudanza (hora)', precio_base: 30, unidad: 'h' },
    { codigo: 'M002', descripcion: 'Camión 20m³ (media jornada)', precio_base: 280, unidad: 'ud' },
    { codigo: 'M003', descripcion: 'Camión 20m³ (jornada completa)', precio_base: 480, unidad: 'ud' },
    { codigo: 'M004', descripcion: 'Servicio embalaje completo', precio_base: 150, unidad: 'ud' },
    { codigo: 'M005', descripcion: 'Desplazamiento de valoración', precio_base: 0, unidad: 'ud' },
  ],
};

// ─── Plantillas por defecto ───────────────────────────────────────────────────

const DEFAULT_TEMPLATES: { tipo: TemplateType; nombre: string; contenido: string; preview: string }[] = [
  {
    tipo: 'whatsapp_presupuesto',
    nombre: 'WhatsApp — Envío presupuesto',
    contenido: 'Hola {nombre},\n\nAdjunto el presupuesto {numero} por importe de {total}€.\n\n¿Podría confirmarnos si está de acuerdo para proceder?\n\nQuedamos a su disposición para cualquier duda.\n\nSaludos,\n{empresa}',
    preview: 'Hola Juan García,\n\nAdjunto el presupuesto P-2026-0042 por importe de 485,00€.\n\n¿Podría confirmarnos si está de acuerdo para proceder?\n\nQuedamos a su disposición para cualquier duda.\n\nSaludos,\nInstalaciones García',
  },
  {
    tipo: 'email_presupuesto',
    nombre: 'Email — Envío presupuesto',
    contenido: 'Estimado/a {nombre},\n\nNos complace enviarle el presupuesto {numero} con fecha {fecha}.\n\nImporte total: {total}€ (IVA incluido)\n\nEste presupuesto tiene validez de 30 días. Para aceptarlo, responda a este email o contáctenos por teléfono.\n\nAtentamente,\n{empresa}',
    preview: 'Estimado/a Juan García,\n\nNos complace enviarle el presupuesto P-2026-0042 con fecha 11/06/2026.\n\nImporte total: 485,00€ (IVA incluido)...',
  },
  {
    tipo: 'email_factura',
    nombre: 'Email — Envío factura',
    contenido: 'Estimado/a {nombre},\n\nAdjunto la factura {numero} de fecha {fecha} por importe de {total}€.\n\nFecha de vencimiento: {vencimiento}\nMétodo de pago: {metodo_pago}\n\nPara cualquier consulta, no dude en contactarnos.\n\nAtentamente,\n{empresa}',
    preview: 'Estimado/a Juan García,\n\nAdjunto la factura FAC-2026-0039 de fecha 05/05/2027 por importe de 313,09€...',
  },
  {
    tipo: 'recordatorio_pago',
    nombre: 'Recordatorio de pago',
    contenido: 'Hola {nombre},\n\nLe recordamos que tiene pendiente de pago la factura {numero} por importe de {total}€ con vencimiento el {vencimiento}.\n\nSi ya ha realizado el pago, ignore este mensaje.\n\nGracias,\n{empresa}',
    preview: 'Hola Juan García,\n\nLe recordamos que tiene pendiente de pago la factura FAC-2026-0039 por importe de 313,09€...',
  },
  {
    tipo: 'aviso_visita',
    nombre: 'Aviso de visita programada',
    contenido: 'Hola {nombre},\n\nLe confirmamos la visita programada para {fecha} a las {hora}.\n\nEl técnico acudirá a {direccion}.\n\nSi necesita cambiar la fecha, contáctenos con antelación.\n\nSaludos,\n{empresa}',
    preview: 'Hola Juan García,\n\nLe confirmamos la visita programada para el 15/06/2026 a las 10:00...',
  },
  {
    tipo: 'pie_presupuesto',
    nombre: 'Pie de página — Presupuestos',
    contenido: 'Este presupuesto tiene validez de 30 días naturales desde su fecha de emisión. Precios con IVA al {iva}%. Forma de pago: 50% a la aceptación y 50% a la finalización de los trabajos.',
    preview: 'Este presupuesto tiene validez de 30 días naturales desde su fecha de emisión. Precios con IVA al 21%...',
  },
  {
    tipo: 'pie_factura',
    nombre: 'Pie de página — Facturas',
    contenido: 'Factura emitida conforme a la normativa fiscal vigente. En caso de discrepancia dispone de 10 días hábiles para reclamar. {empresa} — CIF: {cif} — {direccion}',
    preview: 'Factura emitida conforme a la normativa fiscal vigente. En caso de discrepancia...',
  },
];

// ─── Steps metadata ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, title: 'Tu empresa',  icon: <Building2 className="w-4 h-4" /> },
  { id: 2, title: 'Tarifas',     icon: <Euro className="w-4 h-4" /> },
  { id: 3, title: 'Catálogo',    icon: <Package className="w-4 h-4" /> },
  { id: 4, title: 'Plan',        icon: <CreditCard className="w-4 h-4" /> },
  { id: 5, title: 'Logo',        icon: <Image className="w-4 h-4" /> },
  { id: 6, title: 'Plantillas',  icon: <MessageSquare className="w-4 h-4" /> },
  { id: 7, title: 'Calendario',  icon: <CalendarDays className="w-4 h-4" /> },
  { id: 8, title: 'Finalizar',   icon: <Bell className="w-4 h-4" /> },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onComplete: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function OnboardingWizard({ onComplete, showToast }: Props) {
  const { org } = useSession();
  const orgId = org?.id ?? '';
  const orgAny = org as unknown as Record<string, unknown>;

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [empresa, setEmpresa] = useState({
    nombre:         (orgAny?.nombre as string) ?? '',
    nif:            (orgAny?.nif as string) ?? '',
    direccion:      (orgAny?.direccion as string) ?? '',
    localidad:      ((orgAny?.localidad ?? orgAny?.ciudad) as string) ?? '',
    cp:             (orgAny?.cp as string) ?? '',
    provincia:      (orgAny?.provincia as string) ?? '',
    telefono_movil: ((orgAny?.telefono_movil ?? orgAny?.telefono) as string) ?? '',
    email:          (orgAny?.email as string) ?? '',
    iban:           (orgAny?.iban as string) ?? '',
    banco:          (orgAny?.banco as string) ?? '',
    titular_cuenta: (orgAny?.titular_cuenta as string) ?? '',
  });

  // Step 2
  const [tarifas, setTarifas] = useState({
    precio_hora:       45,
    margen_materiales: 20,
    iva_default:       21,
    descuento_default: 0,
  });

  // Step 3
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  // Step 5
  const [logoPreview, setLogoPreview] = useState<string | null>(
    (orgAny?.logo_url as string) ?? null
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 6
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);

  // Step 7 — Calendario
  const [wizCalendar, setWizCalendar] = useState<WorkCalendar>(() => loadWorkCalendar());
  const [calNacionalesLoaded, setCalNacionalesLoaded] = useState(false);

  // Step 8
  const [notificaciones, setNotificaciones] = useState(true);

  // Skip confirmation
  const [confirmSkip, setConfirmSkip] = useState(false);

  // ── Save helpers ───────────────────────────────────────────────────────────

  async function saveStep1() {
    if (!orgId) return;
    const { error } = await supabase.from('trade_organizations').update({
      nombre:         empresa.nombre,
      nif:            empresa.nif,
      direccion:      empresa.direccion,
      localidad:      empresa.localidad,
      cp:             empresa.cp,
      provincia:      empresa.provincia,
      telefono_movil: empresa.telefono_movil,
      telefono:       empresa.telefono_movil,
      email:          empresa.email,
      iban:           empresa.iban || null,
      banco:          empresa.banco || null,
      titular_cuenta: empresa.titular_cuenta || null,
    }).eq('id', orgId);
    if (error) console.error('[saveStep1]', error.message);
    const stored = JSON.parse(localStorage.getItem('tf_biz_config') ?? '{}');
    localStorage.setItem('tf_biz_config', JSON.stringify({
      ...stored,
      nombre: empresa.nombre,
      nif: empresa.nif,
      direccion: empresa.direccion,
      localidad: empresa.localidad,
      cp: empresa.cp,
      provincia: empresa.provincia,
      telefonoMovil: empresa.telefono_movil,
      email: empresa.email,
      iban: empresa.iban,
      banco: empresa.banco,
      titularCuenta: empresa.titular_cuenta,
    }));
  }

  async function saveStep2() {
    if (!orgId) return;
    const stored = JSON.parse(localStorage.getItem('tf_biz_config') ?? '{}');
    localStorage.setItem('tf_biz_config', JSON.stringify({
      ...stored,
      valorHoraOperario:  tarifas.precio_hora,
      margenMateriales:   tarifas.margen_materiales,
      ivaDefault:         tarifas.iva_default,
      descuentoCliente:   tarifas.descuento_default,
    }));
    await supabase.from('trade_organizations')
      .update({ iva_default: tarifas.iva_default })
      .eq('id', orgId);
  }

  async function handleLoadCatalog() {
    if (!orgId || selectedAreas.size === 0) return;
    setSaving(true);
    try {
      const items = Array.from(selectedAreas).flatMap(area =>
        (CATALOG_BASE[area] ?? []).map(item => ({ ...item, familia: area }))
      );
      const result = await importCatalogItems(orgId, items, 'add');
      await supabase.from('trade_organizations')
        .update({ oficio: Array.from(selectedAreas).join(',') })
        .eq('id', orgId);
      setCatalogLoaded(true);
      showToast(`${result.inserted} artículos de catálogo cargados ✓`, 'success');
    } catch {
      showToast('Error al cargar el catálogo', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function saveStep5() {
    if (!logoFile) return;
    if (!orgId) { showToast('Error: organización no cargada aún, espera un momento', 'error'); return; }
    const url = await uploadOrgLogo(orgId, logoFile);
    setLogoPreview(url);
    setLogoFile(null);
    showToast('Logo guardado ✓', 'success');
  }

  async function handleLoadTemplates() {
    if (!orgId) return;
    setSaving(true);
    try {
      await Promise.all(
        DEFAULT_TEMPLATES.map(t => saveOrgTemplate(orgId, t.tipo, t.contenido, t.nombre))
      );
      setTemplatesLoaded(true);
      showToast('Plantillas cargadas ✓', 'success');
    } catch {
      showToast('Error al cargar plantillas', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    setSaving(true);
    try {
      if (step === 1) await saveStep1();
      if (step === 2) await saveStep2();
      if (step === 5 && logoFile) await saveStep5();
      if (step === 7) saveWorkCalendar(wizCalendar);
      setStep(s => Math.min(s + 1, STEPS.length));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('Error al guardar: ' + msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handlePrev() { setStep(s => Math.max(s - 1, 1)); }

  function handleSkip() {
    setConfirmSkip(true);
  }

  function doSkip() {
    localStorage.setItem(`onboarding_v1_${orgId}`, '1');
    if (orgId) supabase.from('trade_organizations').update({ is_onboarded: true }).eq('id', orgId).then(() => {});
    onComplete();
  }

  async function handleComplete() {
    setSaving(true);
    try {
      localStorage.setItem(`onboarding_v1_${orgId}`, '1');
      // Mark org as onboarded in DB so wizard doesn't re-show
      if (orgId) {
        await supabase.from('trade_organizations')
          .update({ is_onboarded: true })
          .eq('id', orgId);
      }
      if (notificaciones && 'Notification' in window) {
        Notification.requestPermission().catch(() => {});
      }
      onComplete();
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLast = step === STEPS.length;

  return (
    <>
    <div className="fixed inset-0 z-[200] bg-white flex overflow-hidden">

      {/* Sidebar */}
      <div className="w-56 shrink-0 bg-slate-900 flex flex-col p-6">
        <div className="mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center mb-3">
            <span className="text-white font-black text-xs">TF</span>
          </div>
          <p className="text-white font-black text-sm">TrabFlow AI</p>
          <p className="text-slate-400 text-xs">Configuración inicial</p>
        </div>

        <div className="flex-1 flex flex-col gap-1.5">
          {STEPS.map(s => {
            const done   = s.id < step;
            const active = s.id === step;
            return (
              <div key={s.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active ? 'bg-blue-600' : done ? 'bg-slate-800' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${active ? 'bg-white text-blue-600' : done ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                  {done ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <p className={`text-xs font-semibold ${active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-500'}`}>{s.title}</p>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-800">
          <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5">Paso {step} de {STEPS.length}</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2 text-slate-500">
            {STEPS[step - 1].icon}
            <span className="text-sm font-semibold">{STEPS[step - 1].title}</span>
          </div>
          <button onClick={handleSkip} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 cursor-pointer transition-colors">
            <X className="w-3.5 h-3.5" />Saltar configuración
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-7">
          <div className="max-w-2xl space-y-6">

            {/* ── Step 1: Empresa ─────────────────────────────────── */}
            {step === 1 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Datos de tu empresa</h2>
                  <p className="text-sm text-slate-500 mt-1">Aparecerán en presupuestos y facturas. Puedes completarlos o modificarlos después en Ajustes.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre comercial / Razón social *</label>
                    <input type="text" value={empresa.nombre} onChange={e => setEmpresa(p => ({ ...p, nombre: e.target.value }))} placeholder="Instalaciones García S.L." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">NIF / CIF *</label>
                    <input type="text" value={empresa.nif} onChange={e => setEmpresa(p => ({ ...p, nif: e.target.value }))} placeholder="B-12345678" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono móvil</label>
                    <input type="text" value={empresa.telefono_movil} onChange={e => setEmpresa(p => ({ ...p, telefono_movil: e.target.value }))} placeholder="666 123 456" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Email</label>
                    <input type="text" value={empresa.email} onChange={e => setEmpresa(p => ({ ...p, email: e.target.value }))} placeholder="info@miempresa.com" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección (calle y número)</label>
                    <input type="text" value={empresa.direccion} onChange={e => setEmpresa(p => ({ ...p, direccion: e.target.value }))} placeholder="Calle Mayor 12" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Localidad</label>
                    <input type="text" value={empresa.localidad} onChange={e => setEmpresa(p => ({ ...p, localidad: e.target.value }))} placeholder="Sevilla" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">C.P.</label>
                    <input type="text" value={empresa.cp} onChange={e => setEmpresa(p => ({ ...p, cp: e.target.value }))} placeholder="41001" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Provincia</label>
                    <input type="text" value={empresa.provincia} onChange={e => setEmpresa(p => ({ ...p, provincia: e.target.value }))} placeholder="Sevilla" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Datos bancarios (para facturas)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">IBAN</label>
                      <input type="text" value={empresa.iban} onChange={e => setEmpresa(p => ({ ...p, iban: e.target.value }))} placeholder="ES12 3456 7890 1234 5678 9012" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Banco</label>
                      <input type="text" value={empresa.banco} onChange={e => setEmpresa(p => ({ ...p, banco: e.target.value }))} placeholder="CaixaBank" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Titular de la cuenta</label>
                      <input type="text" value={empresa.titular_cuenta} onChange={e => setEmpresa(p => ({ ...p, titular_cuenta: e.target.value }))} placeholder="García Instalaciones S.L." className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* ── Step 2: Tarifas ─────────────────────────────────── */}
            {step === 2 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tarifas y márgenes</h2>
                  <p className="text-sm text-slate-500 mt-1">La IA los usa para generar presupuestos automáticamente. Modifícalos cuando quieras en Ajustes.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Precio hora mano de obra', key: 'precio_hora', suffix: '€/h', color: 'blue', hint: 'Base para calcular mano de obra en presupuestos por voz.' },
                    { label: 'Margen sobre materiales', key: 'margen_materiales', suffix: '%', color: 'amber', hint: 'Se aplica sobre el precio de coste de las piezas del catálogo.' },
                    { label: 'IVA por defecto', key: 'iva_default', suffix: '%', color: 'emerald', hint: 'Se aplica automáticamente a todos los presupuestos y facturas.' },
                    { label: 'Descuento por defecto', key: 'descuento_default', suffix: '%', color: 'slate', hint: 'Opcional. Puedes aplicarlo o no en cada presupuesto individualmente.' },
                  ].map(f => (
                    <div key={f.key} className={`bg-${f.color}-50 border border-${f.color}-100 rounded-xl p-4`}>
                      <label className={`text-xs font-bold text-${f.color}-600 uppercase tracking-wider block mb-2`}>{f.label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          value={tarifas[f.key as keyof typeof tarifas]}
                          onChange={e => setTarifas(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                          className={`flex-1 bg-white border border-${f.color}-200 rounded-lg px-3 py-2 text-xl font-bold text-slate-900 focus:outline-none focus:border-${f.color}-500`}
                        />
                        <span className="text-slate-500 font-semibold text-sm">{f.suffix}</span>
                      </div>
                      <p className={`text-[11px] text-${f.color}-500 mt-1.5`}>{f.hint}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Step 3: Catálogo ─────────────────────────────────── */}
            {step === 3 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Áreas de trabajo</h2>
                  <p className="text-sm text-slate-500 mt-1">Selecciona en qué áreas trabajas y cargaremos artículos con precios orientativos. Podrás modificarlos o añadir más después.</p>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {AREAS.map(area => {
                    const sel = selectedAreas.has(area.id);
                    return (
                      <button
                        key={area.id}
                        onClick={() => setSelectedAreas(prev => {
                          const next = new Set(prev);
                          sel ? next.delete(area.id) : next.add(area.id);
                          return next;
                        })}
                        className={`relative flex flex-col items-center gap-2 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${sel ? area.color + ' shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'}`}
                      >
                        {sel && <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white" /></div>}
                        {area.icon}
                        <span className="text-[11px] font-semibold text-center leading-tight">{area.label}</span>
                        {selectedAreas.has(area.id) && (
                          <span className="text-[10px] opacity-70">{CATALOG_BASE[area.id]?.length ?? 0} artículos</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedAreas.size > 0 && !catalogLoaded && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-blue-800">{selectedAreas.size} área{selectedAreas.size !== 1 ? 's' : ''} seleccionada{selectedAreas.size !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-blue-600 mt-0.5">
                        ~{Array.from(selectedAreas).reduce((s, a) => s + (CATALOG_BASE[a]?.length ?? 0), 0)} artículos con precios orientativos.
                        Podrás modificar precios en Catálogo.
                      </p>
                    </div>
                    <button
                      onClick={handleLoadCatalog}
                      disabled={saving}
                      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50 shrink-0"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                      Cargar catálogo
                    </button>
                  </div>
                )}

                {catalogLoaded && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-emerald-600" /></div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">¡Catálogo cargado correctamente!</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Ve a <strong>Catálogo</strong> para ajustar precios o añadir más artículos cuando hagas presupuestos.</p>
                    </div>
                  </div>
                )}

                {selectedAreas.size === 0 && (
                  <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Sin áreas seleccionadas, la app funciona igual. Ve a <strong>Catálogo</strong> cuando quieras para añadir artículos manualmente o importar desde CSV/Excel.</span>
                  </div>
                )}
              </>
            )}

            {/* ── Step 4: Plan ─────────────────────────────────────── */}
            {step === 4 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Tu plan actual</h2>
                  <p className="text-sm text-slate-500 mt-1">Durante la Beta puedes explorar todos los planes y funcionalidades sin coste.</p>
                </div>
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Star className="w-5 h-5 text-yellow-300" />
                    <span className="font-black text-lg">Periodo Beta — Acceso gratuito completo</span>
                  </div>
                  <p className="text-blue-100 text-sm leading-relaxed">
                    Estás en el periodo de prueba. Puedes subir y bajar de plan libremente para explorar todas las funcionalidades.
                    <strong className="text-white"> No se realizará ningún cargo</strong> hasta que finalice el periodo Beta.
                  </p>
                </div>
                <div className="space-y-3">
                  {[
                    { plan: 'Básico', price: 'Gratis', features: ['Presupuestos y trabajos ilimitados', 'Facturación', 'Catálogo y clientes CRM', 'Sin miembros del equipo'], color: 'border-slate-200' },
                    { plan: 'Empresa', price: '49€/mes', features: ['Todo lo del Básico', 'Hasta 5 miembros del equipo', 'Contratos de mantenimiento', 'Ingresos y rentabilidad'], color: 'border-blue-200 bg-blue-50' },
                    { plan: 'Empresa+', price: '89€/mes', features: ['Todo lo de Empresa', 'Hasta 15 miembros', 'Módulos avanzados', 'Soporte prioritario'], color: 'border-purple-200 bg-purple-50' },
                  ].map(p => (
                    <div key={p.plan} className={`border-2 rounded-xl p-4 ${p.color}`}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-slate-900">{p.plan}</span>
                        <span className="font-black text-slate-900">{p.price}</span>
                      </div>
                      <ul className="space-y-1">
                        {p.features.map(f => <li key={f} className="flex items-center gap-1.5 text-xs text-slate-600"><Check className="w-3 h-3 text-emerald-500 shrink-0" />{f}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Cuando finalice la Beta: <strong>Ajustes y Tarifas → Plan</strong> → selecciona y contrata el plan deseado. La app se actualiza automáticamente.</span>
                </div>
              </>
            )}

            {/* ── Step 5: Logo ─────────────────────────────────────── */}
            {step === 5 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Logo de tu empresa</h2>
                  <p className="text-sm text-slate-500 mt-1">Aparecerá en la cabecera de todos tus presupuestos y facturas. PNG, JPG, WebP o SVG (máx. 2 MB).</p>
                </div>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-10 text-center cursor-pointer transition-colors group"
                >
                  {logoPreview ? (
                    <div className="space-y-3">
                      <img src={logoPreview} alt="Logo" className="max-h-28 max-w-sm mx-auto object-contain" />
                      <p className="text-xs text-slate-400 group-hover:text-blue-500 transition-colors">Click para cambiar el logo</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto group-hover:bg-blue-50 transition-colors">
                        <Upload className="w-7 h-7 text-slate-400 group-hover:text-blue-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-600">Haz click para subir tu logo</p>
                        <p className="text-xs text-slate-400 mt-0.5">o arrastra el archivo aquí</p>
                      </div>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setLogoFile(f);
                  setLogoPreview(URL.createObjectURL(f));
                }} />
                <p className="text-xs text-slate-400 text-center">Puedes cambiar el logo en cualquier momento desde <strong>Ajustes → Datos de empresa</strong>. Si prefieres, puedes saltar este paso.</p>
              </>
            )}

            {/* ── Step 6: Plantillas ───────────────────────────────── */}
            {step === 6 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Plantillas de comunicación</h2>
                  <p className="text-sm text-slate-500 mt-1">Textos automáticos para WhatsApp, email y documentos. Carga las plantillas base con un clic y personalízalas después.</p>
                </div>
                <div className="flex gap-4">
                  <div className="w-44 shrink-0 space-y-1">
                    {DEFAULT_TEMPLATES.map((t, i) => (
                      <button
                        key={t.tipo}
                        onClick={() => setPreviewIdx(i)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer leading-tight ${previewIdx === i ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                      >
                        {t.nombre.includes('—') ? t.nombre.split('—').slice(1).join('—').trim() : t.nombre}
                      </button>
                    ))}
                  </div>
                  <div className="flex-1 bg-slate-900 rounded-xl p-4 overflow-hidden">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{DEFAULT_TEMPLATES[previewIdx].nombre}</p>
                    <pre className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{DEFAULT_TEMPLATES[previewIdx].preview}</pre>
                  </div>
                </div>

                {!templatesLoaded ? (
                  <button
                    onClick={handleLoadTemplates}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-3.5 rounded-xl cursor-pointer transition-colors disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                    Cargar {DEFAULT_TEMPLATES.length} plantillas base
                  </button>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0"><Check className="w-4 h-4 text-emerald-600" /></div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800">Plantillas cargadas ✓</p>
                      <p className="text-xs text-emerald-600 mt-0.5">Para editar: <strong>Ajustes y Tarifas → Plantillas → selecciona → despliega → edita → Guardar plantilla</strong>.</p>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 rounded-xl p-3">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Si más adelante quieres cambiar el texto de una plantilla, ve a <strong>Ajustes y Tarifas → Plantillas de comunicación</strong>, selecciona la plantilla, despliégala, modifica el texto y pulsa <strong>Guardar plantilla</strong>. La app se actualiza al momento.</span>
                </div>
              </>
            )}

            {/* ── Step 7: Calendario laboral ───────────────────────── */}
            {step === 7 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">Calendario laboral</h2>
                  <p className="text-sm text-slate-500 mt-1">Define cuándo trabajas. La app reprogramará automáticamente los trabajos pendientes al siguiente día laborable.</p>
                </div>

                {/* Horario semanal */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Días y horas de trabajo</p>
                  {[1,2,3,4,5,6,0].map(dow => {
                    const cfg = wizCalendar.workDays[dow];
                    return (
                      <div key={dow} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${cfg.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                        <button
                          type="button"
                          onClick={() => setWizCalendar(c => ({ ...c, workDays: { ...c.workDays, [dow]: { ...c.workDays[dow], active: !c.workDays[dow].active } } }))}
                          className={`rounded-full transition-colors shrink-0 cursor-pointer flex items-center px-0.5 ${cfg.active ? 'bg-blue-600' : 'bg-slate-200'}`}
                          style={{ width: 32, height: 18 }}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${cfg.active ? 'translate-x-3.5' : 'translate-x-0'}`} style={{ width: 14, height: 14 }} />
                        </button>
                        <span className={`text-xs font-bold w-20 ${cfg.active ? 'text-slate-800' : 'text-slate-400'}`}>{DAY_NAMES[dow]}</span>
                        {cfg.active ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input type="time" value={cfg.start}
                              onChange={e => setWizCalendar(c => ({ ...c, workDays: { ...c.workDays, [dow]: { ...c.workDays[dow], start: e.target.value } } }))}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white w-24" />
                            <span className="text-[10px] text-slate-400">—</span>
                            <input type="time" value={cfg.end}
                              onChange={e => setWizCalendar(c => ({ ...c, workDays: { ...c.workDays, [dow]: { ...c.workDays[dow], end: e.target.value } } }))}
                              className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white w-24" />
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic flex-1">Cerrado</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Festivos nacionales */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <CalendarDays className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-900">Festivos nacionales de España</p>
                    <p className="text-xs text-blue-700 mt-0.5">Carga automáticamente los 10 festivos nacionales recurrentes (Año Nuevo, Reyes, 1 de mayo, etc.)</p>
                    {calNacionalesLoaded ? (
                      <p className="text-xs text-emerald-700 font-semibold mt-2 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {FESTIVOS_NACIONALES.length} festivos cargados</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const existing = new Set(wizCalendar.holidays.map(h => h.date));
                          const nuevos = FESTIVOS_NACIONALES.filter(f => !existing.has(f.date)).map(f => ({ ...f, id: crypto.randomUUID() })) as HolidayEntry[];
                          setWizCalendar(c => ({ ...c, holidays: [...c.holidays, ...nuevos] }));
                          setCalNacionalesLoaded(true);
                        }}
                        className="mt-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
                      >
                        Cargar festivos nacionales
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                  <p className="text-xs text-slate-500 flex items-start gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                    Puedes añadir festivos regionales, vacaciones y días cerrados en cualquier momento desde <strong>Ajustes y Tarifas → Calendario laboral</strong>.
                  </p>
                </div>
              </>
            )}

            {/* ── Step 8: Finalizar ────────────────────────────────── */}
            {step === 8 && (
              <>
                <div>
                  <h2 className="text-xl font-black text-slate-900">¡Todo listo para empezar!</h2>
                  <p className="text-sm text-slate-500 mt-1">Tu aplicación está configurada. Pulsa "Empezar a trabajar" para ir al panel principal.</p>
                </div>

                {/* Notification toggle */}
                <div
                  onClick={() => setNotificaciones(n => !n)}
                  className={`border-2 rounded-xl p-4 flex items-center gap-4 cursor-pointer transition-all select-none ${notificaciones ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}
                >
                  <div className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${notificaciones ? 'bg-blue-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${notificaciones ? 'left-6' : 'left-0.5'}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">Activar notificaciones push</p>
                    <p className="text-xs text-slate-500 mt-0.5">Recibe avisos de nuevos trabajos, cobros pendientes y recordatorios.</p>
                  </div>
                  <Bell className={`w-5 h-5 shrink-0 ${notificaciones ? 'text-blue-600' : 'text-slate-400'}`} />
                </div>

                {/* Summary */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Resumen de lo configurado</p>
                  {[
                    { label: 'Nombre empresa', val: empresa.nombre || '—', ok: !!empresa.nombre },
                    { label: 'NIF / CIF',      val: empresa.nif || '—',    ok: !!empresa.nif },
                    { label: 'Precio hora',    val: `${tarifas.precio_hora}€/h`, ok: tarifas.precio_hora > 0 },
                    { label: 'Catálogo',       val: catalogLoaded ? `${Array.from(selectedAreas).reduce((s, a) => s + (CATALOG_BASE[a]?.length ?? 0), 0)} artículos` : selectedAreas.size === 0 ? 'Sin seleccionar' : 'Pendiente de cargar', ok: catalogLoaded },
                    { label: 'Logo',           val: logoPreview ? 'Subido' : 'Sin logo', ok: !!logoPreview },
                    { label: 'Plantillas',     val: templatesLoaded ? `${DEFAULT_TEMPLATES.length} cargadas` : 'Sin cargar', ok: templatesLoaded },
                  { label: 'Calendario',     val: calNacionalesLoaded ? `${FESTIVOS_NACIONALES.length} festivos + horario semanal` : 'Horario semanal configurado', ok: true },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">{item.label}</span>
                      <span className={`flex items-center gap-1.5 font-semibold text-xs ${item.ok ? 'text-emerald-600' : 'text-amber-500'}`}>
                        {item.ok ? <Check className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                        {item.val}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-slate-400 text-center">
                  Puedes modificar cualquier opción en <strong>Ajustes y Tarifas</strong> en cualquier momento.
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 shrink-0 bg-white">
          <button
            onClick={handlePrev}
            disabled={step === 1}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold disabled:opacity-30 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />Anterior
          </button>
          {!isLast ? (
            <button
              onClick={handleNext}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors cursor-pointer disabled:opacity-50"
              style={{ boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Empezar a trabajar
            </button>
          )}
        </div>
      </div>
    </div>

    {/* ── Confirmación saltar ───────────────────────────────────────────── */}
    {confirmSkip && (
      <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
              <Info className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">¿Saltar la configuración?</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Este asistente <strong className="text-slate-900">no volverá a aparecer</strong>.
              </p>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Sin completar la configuración la aplicación <strong className="text-red-600">no funcionará correctamente</strong>:
                los presupuestos no tendrán datos de empresa, las facturas irán sin logo, la IA no tendrá catálogo configurado, etc.
              </p>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Puedes completar la configuración manualmente en <strong>Ajustes y Tarifas</strong> en cualquier momento.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmSkip(false)}
              className="flex-1 py-2.5 rounded-xl border-2 border-blue-600 text-blue-600 font-bold text-sm hover:bg-blue-50 transition-colors cursor-pointer"
            >
              Continuar configurando
            </button>
            <button
              onClick={doSkip}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-500 font-semibold text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Sí, saltar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
