import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Image as ImageIcon, 
  FileText, 
  Send, 
  Smartphone, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  ArrowRight,
  ArrowLeft,
  Star, 
  ShieldCheck, 
  HelpCircle, 
  LogOut, 
  Settings as SettingsIcon, 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  Menu, 
  X, 
  Check, 
  Moon, 
  Sun, 
  Activity, 
  FilePlus, 
  Upload, 
  Volume2, 
  Sparkles, 
  FileCheck, 
  CheckCircle2, CalendarRange,
  Mail,
  Zap,
  Info,
  CornerDownRight,
  Monitor,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Shield,
  Package,
  Tag,
  Star as StarIcon,
  Edit3,
  RotateCcw,
  Calendar,
  Camera,
  UserPlus,
  Globe,
  Briefcase,
  BarChart2,
  Wrench,
  Filter,
  Navigation,
  Route,
  Receipt,
  Edit2,
  Layers,
  Building2,
  BookOpen,
  ArrowUpDown,
  Loader2,
  Truck,
  ShoppingCart,
  Bell,
  Home,
  MapPin,
  Eye,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ADMIN_EMAIL } from '../lib/constants';
import { ActivePage, Presupuesto, PartidaPresupuesto, Factura, Cliente } from '../types';
import { supabase, loadDashboard, getOrCreateOrg, getOwnOrg, loadOrgById, loadWorkers, loadTarifas, addWorker, addTarifa, deleteWorker, deleteTarifa, updateTarifaPrice, saveFiscalData, saveQuote, updateQuote, addClient, markInvoicePaid, markInvoiceDevuelta, convertToInvoice, loadCatalogProducts, matchProductForAI, updateCatalogVariant, setPreferredVariant, exportCatalog, loadJobs, createJob, updateJob, deleteJob, assignWorkerToJob, removeWorkerFromJob, loadOrgSubscription, getStripePortalUrl, getStripeCheckoutUrl, learnPriceToCatalog, submitContactMessage, sendTrabflowEmail, sendClientEmail, subscribePush, unsubscribePush, isPushSubscribed, applyReferralCode, createQuoteToken, getQuoteByToken, uploadOrgLogo, loadOrgTemplates, saveOrgTemplate, checkClientMaintenanceContract, loadInvoicesByJobId, saveAIFeedback, applyActuacionLearning, createActuacionFromLearning, updateOrgGeocoords, loadSubcontractors, createSubcontrataFromQuote, loadSubcontratasByQuote, loadActiveSupplierCatalogs } from '../lib/supabase';
import type { TradeSubcontractor, TradeSubcontrata, ActiveSupplierCatalog } from '../lib/supabase';
import { printTradeInvoice } from '../lib/printTradeInvoice';
import { geocodeAddress } from '../lib/geocoder';
import type { GeoLocation } from '../lib/routeOptimizer';
import type { TradeWorker, TradeTarifa, TradeCatalogProduct, TradeCatalogVariant, TradeJob, TradeSubscription, TemplateType } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { usePermissions } from '../hooks/usePermissions';
import { useSession } from '../context/SessionContext';
import { downloadAsWordDocx } from '../lib/exportWord';
import CatalogImportModal from './CatalogImportModal';
import GlobalCatalogModal from './GlobalCatalogModal';
import { generateExportWorkbook, generateTemplateWorkbook, downloadWorkbook } from '../lib/catalogExcel';
import ScreenPlanificacion from './ScreenPlanificacion';
import ScreenRutaDia from './ScreenRutaDia';
import ScreenParteTrabajo from './ScreenParteTrabajo';
import ScreenPresupuestoFoto from './ScreenPresupuestoFoto';
import ScreenPresupuestoIncremental from './ScreenPresupuestoIncremental';
import ScreenMantenimientoWizard from './ScreenMantenimientoWizard';
import ScreenEquipo from './ScreenEquipo';
import ScreenIngresos from './ScreenIngresos';
import ScreenMantenimiento from './ScreenMantenimiento';
import ScreenFacturas from './ScreenFacturas';
import ScreenContratos from './ScreenContratos';
import ScreenSubcontratas from './ScreenSubcontratas';
import ScreenValoraciones from './ScreenValoraciones';
import ScreenAsistenteTecnico from './ScreenAsistenteTecnico';
import { resolveTemplate, buildTemplateVars, DEFAULT_TEMPLATES, VARIABLE_GROUPS } from '../lib/templateEngine';
import {
  loadWorkCalendar, saveWorkCalendar, isWorkingDay,
  DAY_NAMES, FESTIVOS_NACIONALES,
  type WorkCalendar, type HolidayEntry,
} from '../lib/workCalendar';
import PlanUpgradeModal from './PlanUpgradeModal';
import OnboardingWizard from './OnboardingWizard';
import ChatbotWidget from './ChatbotWidget';
import ScreenProveedoresCliente from './ScreenProveedoresCliente';
import ScreenPedidosMaterial from './ScreenPedidosMaterial';
import ScreenPostConfirm from './ScreenPostConfirm';
import type { TradeOrganization, TradeQuote } from '../lib/supabase';

const InvoiceIcon = FileText;

interface AppDashboardViewProps {
  setCurrentPage: (page: ActivePage) => void;
  initialMobile?: boolean;
  session?: Session | null;
  loginOnMount?: boolean;
  workerOrgId?: string | null;
  checkoutSuccess?: boolean;
}

interface TrabajadorItem {
  id: string;
  nombre: string;
  telefono: string;
  email: string;
  rol: 'tecnico' | 'admin' | 'comercial';
  activo: boolean;
}

interface TarifaItem {
  id: string;
  codigo: string;
  familia: string;
  descripcion: string;
  precioBase: number;
  unidad: string;
  activo: boolean;
}

// ── MobileCatalogScreen ───────────────────────────────────────────────────────
interface MobileCatalogScreenProps {
  tarifas: TarifaItem[];
  isLiveMode: boolean;
  onUpdatePrice: (id: string, price: number) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function MobileCatalogScreen({ tarifas, isLiveMode, onUpdatePrice, showToast }: MobileCatalogScreenProps) {
  const [search, setSearch]             = React.useState('');
  const [familyFilter, setFamilyFilter] = React.useState('');
  const [editingId, setEditingId]       = React.useState<string | null>(null);
  const [editPrice, setEditPrice]       = React.useState('');
  const [saving, setSaving]             = React.useState(false);

  const active   = tarifas.filter(t => t.activo);
  const families = [...new Set(active.map(t => t.familia))].filter(Boolean).sort();
  const q        = search.toLowerCase();

  const filtered = active.filter(t => {
    const matchFamily = !familyFilter || t.familia === familyFilter;
    const matchSearch = !q ||
      t.descripcion.toLowerCase().includes(q) ||
      t.codigo.toLowerCase().includes(q) ||
      t.familia.toLowerCase().includes(q);
    return matchFamily && matchSearch;
  });

  const handleSave = async (id: string) => {
    const price = parseFloat(editPrice.replace(',', '.'));
    if (isNaN(price) || price < 0) return;
    setSaving(true);
    try {
      await onUpdatePrice(id, price);
      showToast('Precio actualizado ✓', 'success');
      setEditingId(null);
    } catch {
      showToast('Error al actualizar precio', 'error');
    }
    setSaving(false);
  };

  return (
    <div className="space-y-3 pb-4">
      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar material, servicio o referencia..."
          className="w-full pl-9 pr-3 py-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs placeholder-slate-400 text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 transition"
        />
      </div>

      {/* Filtros familia */}
      {families.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setFamilyFilter('')}
            className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase transition-colors cursor-pointer ${
              !familyFilter ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Todas
          </button>
          {families.map(f => (
            <button
              key={f}
              onClick={() => setFamilyFilter(f === familyFilter ? '' : f)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-[9px] font-bold transition-colors cursor-pointer ${
                f === familyFilter ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Lista artículos */}
      {active.length === 0 ? (
        <div className="text-center py-12">
          <Package className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Sin artículos en el catálogo</p>
          <p className="text-xs text-slate-400 mt-1">Importa tu catálogo desde Ajustes → Catálogo.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-xs text-slate-400 py-8">Sin resultados para "{search}"</p>
      ) : (
        <div className="space-y-1.5">
          {filtered.slice(0, 150).map(t => (
            <div key={t.id} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-mono font-bold text-blue-500 dark:text-blue-400 uppercase mb-0.5">{t.familia}</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-white leading-tight">{t.descripcion}</p>
                {t.codigo && <p className="text-[9px] text-slate-400 mt-0.5">Ref: {t.codigo}</p>}
              </div>
              <div className="shrink-0 text-right">
                {editingId === t.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={e => setEditPrice(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleSave(t.id); if (e.key === 'Escape') setEditingId(null); }}
                      className="w-20 text-xs text-right bg-white dark:bg-slate-700 border border-blue-400 rounded-lg px-2 py-1 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => handleSave(t.id)} disabled={saving} className="p-1 text-emerald-500 hover:text-emerald-400 cursor-pointer disabled:opacity-50">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      if (!isLiveMode) { showToast('Activa el modo real para editar precios', 'info'); return; }
                      setEditingId(t.id);
                      setEditPrice(t.precioBase.toFixed(2));
                    }}
                    className="text-right group cursor-pointer"
                  >
                    <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                      {t.precioBase.toFixed(2)} €
                    </p>
                    <p className="text-[9px] text-slate-400">/{t.unidad}</p>
                  </button>
                )}
              </div>
            </div>
          ))}
          {filtered.length > 150 && (
            <p className="text-center text-[9px] text-slate-400 py-2">
              Mostrando 150 de {filtered.length}. Usa el buscador para filtrar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface PresetPhoto {
  id: string;
  name: string;
  url: string;
  category: string;
  detections: { label: string; x: number; y: number; w: number; h: number; price: number; type: 'material' | 'mano_de_obra'; confidence: number }[];
}

// ── SendEmailModal ────────────────────────────────────────────────────────────
// Componente a nivel de módulo (nunca dentro del padre) para evitar re-mount

const EMAIL_TEMPLATE_OPTIONS: Array<{ tipo: TemplateType; label: string; defaultSubject: (nombre: string) => string }> = [
  { tipo: 'email_presupuesto',  label: 'Envío de Presupuesto',  defaultSubject: n => `Presupuesto de ${n}` },
  { tipo: 'email_factura',      label: 'Envío de Factura',      defaultSubject: n => `Factura de ${n}` },
  { tipo: 'recordatorio_pago',  label: 'Recordatorio de Pago',  defaultSubject: n => `Recordatorio de pago — ${n}` },
  { tipo: 'aviso_visita',       label: 'Aviso de Visita',       defaultSubject: n => `Aviso de visita — ${n}` },
];

interface SendEmailModalProps {
  cliente: Cliente;
  empresa: { nombre: string; nif: string; email: string; telefono: string };
  orgTemplates: Partial<Record<TemplateType, string>>;
  onClose: () => void;
  onSent: () => void;
}

function SendEmailModal({ cliente, empresa, orgTemplates, onClose, onSent }: SendEmailModalProps) {
  const [selectedTipo, setSelectedTipo] = useState<TemplateType | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const vars = buildTemplateVars({
    empresa: { nombre: empresa.nombre, nif: empresa.nif, telefono: empresa.telefono, email: empresa.email },
    cliente: { nombre: cliente.nombre, telefono: cliente.telefono, email: cliente.email, direccion: cliente.direccion },
  });

  function pickTemplate(tipo: TemplateType) {
    setSelectedTipo(tipo);
    const opt = EMAIL_TEMPLATE_OPTIONS.find(o => o.tipo === tipo)!;
    const rawContent = orgTemplates[tipo] ?? (DEFAULT_TEMPLATES as Record<string, string>)[tipo] ?? '';
    setBody(resolveTemplate(rawContent, vars));
    setSubject(opt.defaultSubject(empresa.nombre || 'TrabFlow'));
  }

  async function handleSend() {
    if (!selectedTipo || !cliente.email || !subject.trim() || !body.trim()) return;
    setSending(true);
    try {
      await sendClientEmail(cliente.email, subject, body);
      onSent();
      onClose();
    } catch {
      onSent();
    }
    setSending(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Cabecera */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">Enviar Email</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">{cliente.nombre} · {cliente.email ?? 'sin email registrado'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {!cliente.email && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400">
              Este cliente no tiene email guardado. Añade su email en el CRM antes de enviar.
            </div>
          )}

          {/* Selector de plantilla */}
          <div>
            <label className="text-[9px] font-mono uppercase text-slate-400 block mb-2">Selecciona una plantilla</label>
            <div className="space-y-2">
              {EMAIL_TEMPLATE_OPTIONS.map(opt => (
                <button
                  key={opt.tipo}
                  onClick={() => pickTemplate(opt.tipo)}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                    selectedTipo === opt.tipo
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {selectedTipo && (
            <>
              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Asunto</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Contenido del email</label>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500 resize-none font-mono"
                />
              </div>
            </>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
              Cancelar
            </button>
            <button
              disabled={sending || !selectedTipo || !cliente.email || !subject.trim() || !body.trim()}
              onClick={handleSend}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Mail className="w-3.5 h-3.5" />
              {sending ? 'Enviando...' : 'Enviar email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteItemDescInput({
  value, onChange, onVariantSelect, catalogProducts,
}: {
  value: string;
  onChange: (val: string) => void;
  onVariantSelect: (descripcion: string, precioVenta: number, supplierKey: string, supplierName: string, variantId: string) => void;
  catalogProducts: TradeCatalogProduct[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!value.trim() || value.length < 2) return [] as Array<{ product: TradeCatalogProduct; variant: TradeCatalogVariant }>;
    const q = value.toLowerCase();
    const results: Array<{ product: TradeCatalogProduct; variant: TradeCatalogVariant }> = [];
    for (const p of catalogProducts) {
      if (
        p.nombre_generico.toLowerCase().includes(q) ||
        p.familia.toLowerCase().includes(q) ||
        (p.subfamilia?.toLowerCase().includes(q) ?? false)
      ) {
        const variants = (p.trade_catalog_variants ?? []).filter(v => v.activo);
        if (variants.length === 0) {
          results.push({ product: p, variant: { id: '', marca: '', precio_material: 0, precio_mano_obra: 0, margen_pct: 0, precio_venta: 0, calidad: 'medio', is_preferred: false, activo: true } as TradeCatalogVariant });
        } else {
          for (const v of variants) results.push({ product: p, variant: v });
        }
      }
    }
    return results.slice(0, 10);
  }, [value, catalogProducts]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (product: TradeCatalogProduct, variant: TradeCatalogVariant) => {
    const desc = variant.marca ? `${product.nombre_generico} (${variant.marca})` : product.nombre_generico;
    const supplierKey = variant.proveedor?.toLowerCase().replace(/\s+/g, '_') ?? 'propio';
    const supplierName = variant.proveedor ?? variant.marca ?? 'Catálogo propio';
    onVariantSelect(desc, variant.precio_venta, supplierKey, supplierName, variant.id);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative flex-grow min-w-0">
      <input
        type="text"
        value={value}
        placeholder="Concepto..."
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { if (value.length >= 2) setOpen(true); }}
        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
          {filtered.map(({ product, variant }, i) => (
            <button
              key={`${product.id}-${variant.id || i}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(product, variant); }}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate">{product.nombre_generico}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {variant.marca && <span className="text-[10px] text-slate-500 truncate">{variant.marca}</span>}
                  {variant.proveedor && (
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0">
                      {variant.proveedor}
                    </span>
                  )}
                  <span className="text-[9px] text-slate-400 shrink-0">{product.familia}</span>
                </div>
              </div>
              {variant.precio_venta > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold font-mono text-slate-900">{variant.precio_venta.toFixed(2)} €</p>
                  {variant.precio_material > 0 && (
                    <p className="text-[9px] text-slate-400 font-mono">coste {variant.precio_material.toFixed(2)} €</p>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppDashboardView({ setCurrentPage, initialMobile = true, session, loginOnMount = false, workerOrgId, checkoutSuccess = false }: AppDashboardViewProps) {
  const { can, rol, plan: ctxPlan } = usePermissions();
  const { workerProfile } = useSession();
  const isTecnico = rol === 'tecnico';

  // Auth & data loading
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(loginOnMount && !session);
  const [isLiveMode, setIsLiveMode] = useState(false);

  const loadedUserRef = useRef<string | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Admin never belongs in AppDashboard — redirect immediately
  useEffect(() => {
    if (session?.user?.email === ADMIN_EMAIL) {
      setCurrentPage(ActivePage.Admin);
    }
  }, [session, setCurrentPage]);

  useEffect(() => {
    if (session) {
      setIsLiveMode(true);
      setShowLoginModal(false);
      // Avoid re-loading when the session token refreshes for the same user
      if (loadedUserRef.current !== session.user.id) {
        loadedUserRef.current = session.user.id;
        loadLiveData(session);
      }
    } else {
      setIsLiveMode(false);
      loadedUserRef.current = null;
    }
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [session]);

  const loadLiveData = async (s: Session) => {
    try {
      // Workers with admin role: they belong to an existing org (workerOrgId), never create a new one.
      // Regular installers: getOrCreateOrg may create one if it doesn't exist yet.
      let org = workerOrgId
        ? (await getOwnOrg() ?? await loadOrgById(workerOrgId))
        : await getOrCreateOrg();
      if (!org) {
        // Org creation failed (e.g. DB trigger error) — show wizard so user can configure
        if (!workerOrgId && s.user.email !== ADMIN_EMAIL) setShowOnboarding(true);
        return;
      }
      loadOrgSubscription(org.id).then(sub => setSubscription(sub)).catch(() => {});
      void (async () => {
        const { data: invData } = await supabase.from('trade_platform_invoices').select('*').eq('org_id', org.id).order('created_at', { ascending: false });
        if (invData) setPlatformInvoices(invData as typeof platformInvoices);
      })();
      // Apply pending referral code stored during registration
      void (async () => {
        const pendingCode = localStorage.getItem('trabflow_pending_referral');
        if (pendingCode) {
          localStorage.removeItem('trabflow_pending_referral');
          await applyReferralCode(pendingCode);
        }
      })();
      const data = await loadDashboard(org.id);
      // Always replace demo clients with real data (even if empty list)
      setClientes(data.clients.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono ?? '', email: c.email ?? '', direccion: c.direccion ?? '', obrasActivas: c.obras_activas, totalFacturado: c.total_facturado })));
      setPresupuestos(data.quotes.map(q => ({ id: q.numero, dbId: q.id, clientId: q.client_id ?? null, nombreCliente: q.client_id ? (data.clients.find(c => c.id === q.client_id)?.nombre ?? '') : '', descripcion: q.descripcion ?? '', partidas: (q.trade_quote_items ?? []).map(i => ({ descripcion: i.descripcion, tipo: i.tipo as 'material' | 'mano_de_obra', cantidad: i.cantidad, precioUnitario: i.precio_unitario, total: i.total })), total: q.total_neto, iva_pct: q.iva_pct, fecha: q.fecha, estado: q.estado as any, telefonoCliente: '', emailCliente: '', kbActuaciones: q.kb_actuaciones ?? undefined })));
      setFacturas(data.invoices.map(f => ({ id: f.id, numeroFactura: f.numero, nombreCliente: f.client_id ? (data.clients.find(c => c.id === f.client_id)?.nombre ?? '') : (f.concepto?.split('—')[1]?.trim() ?? ''), idPresupuesto: f.quote_id ?? '', importe: f.subtotal, fecha: f.fecha, fechaVencimiento: f.fecha_vencimiento ?? '', estado: f.estado as any, concepto: f.concepto ?? undefined, esMantenimineto: !!f.contract_id })));
      if (org) {
        setOrgId(org.id);
        setOrgData(org);
        if (!org.is_onboarded && session?.user?.email !== ADMIN_EMAIL) setShowOnboarding(true);
        isPushSubscribed().then(setPushEnabled).catch(() => {});
        setEmpresaAjustes(prev => ({
          ...prev,
          nombre:        org.nombre,
          nif:           (org as any).nif ?? prev.nif,
          email:         org.email ?? prev.email,
          telefonoFijo:  (org as any).telefono_fijo ?? prev.telefonoFijo,
          telefonoMovil: (org as any).telefono_movil ?? org.telefono ?? prev.telefonoMovil,
          direccion:     org.direccion ?? prev.direccion,
          localidad:     (org as any).localidad ?? prev.localidad,
          cp:            (org as any).cp ?? prev.cp,
          provincia:     (org as any).provincia ?? prev.provincia,
          pais:          (org as any).pais ?? prev.pais,
          iban:          org.iban ?? prev.iban,
          banco:         org.banco ?? prev.banco,
          titularCuenta: org.titular_cuenta ?? prev.titularCuenta,
        }));
        const [workersRes, tarifasRes, catalogRes, jobsRes] = await Promise.all([
          loadWorkers(org.id),
          loadTarifas(org.id),
          loadCatalogProducts(org.id),
          loadJobs(org.id),
        ]);
        supabase.from('trade_maintenance_contratos').select('id', { count: 'exact', head: true }).eq('org_id', org.id).eq('estado', 'activo').eq('incluye_guardia', true).then(({ count }) => setUrgentContratosCount(count ?? 0));
        setTrabajadores(workersRes.map((w: TradeWorker) => ({ id: w.id, nombre: w.nombre, telefono: w.telefono ?? '', email: w.email ?? '', rol: w.rol as TrabajadorItem['rol'], activo: w.activo })));
        setTarifas(tarifasRes.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo })));
        setCatalogProducts(catalogRes);
        loadActiveSupplierCatalogs(org.id).then(setActiveSupplierCatalogs).catch(() => {});
        setJobs(jobsRes);
        loadOrgTemplates(org.id).then(templates => {
          const map: Partial<Record<TemplateType, string>> = {};
          templates.forEach(t => { map[t.tipo] = t.contenido; });
          setOrgTemplates(map);
        }).catch(() => {});
        if (org.logo_url) setLogoPreview(org.logo_url);

        // Real-time sync: reload jobs when another device adds/updates one
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
        }
        realtimeChannelRef.current = supabase
          .channel(`jobs-${org.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trade_jobs', filter: `org_id=eq.${org.id}` }, () => {
            loadJobs(org.id).then(setJobs).catch(() => {});
          })
          .subscribe();
      }
    } catch (e) {
      console.error('Error cargando datos live:', e);
    }
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword });
    setLoginLoading(false);
    if (error) { setLoginError(error.message); return; }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: 'local' });
    setIsLiveMode(false);
    if (isNativeDevice) {
      setIsSessionClosed(true);
    } else {
      setCurrentPage(ActivePage.Home);
    }
  };

  // Simulador Config
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(initialMobile);
  const [activeTab, setActiveTab] = useState<string>(rol === 'tecnico' ? 'planificacion' : 'dashboard');
  const [newJobTrigger, setNewJobTrigger] = useState(0);
  const [prefillJobFromQuote, setPrefillJobFromQuote] = useState<import('../types').Presupuesto | null>(null);

  // Detectar si estamos en un dispositivo móvil real (PWA instalada o teléfono)
  const isNativeDevice = (() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const isPWAParam = params.get('app') === 'true';
    const isTouchPhone = window.innerWidth < 500 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    return isStandalone || isPWAParam || isTouchPhone;
  })();

  // Sincronizar prop con estado del simulador
  useEffect(() => {
    setIsMobileMode(initialMobile);
  }, [initialMobile]);

  // Tabs de navegación móvil
  const [mobileTab, setMobileTab] = useState<'inicio' | 'presupuestos' | 'clientes' | 'facturas' | 'ajustes' | 'trabajos' | 'catalogo' | 'mantenimiento' | 'contratos' | 'ruta' | 'asistente' | 'valoraciones'>(rol === 'tecnico' ? 'trabajos' : 'inicio');
  // Fix timing: session carga async, rol llega tarde — forzar tab correcto cuando cambia
  useEffect(() => {
    if (rol === 'tecnico') {
      setMobileTab('trabajos');
      setActiveTab(prev => prev === 'dashboard' ? 'planificacion' : prev);
    }
  }, [rol]);
  const [parteJob, setParteJob] = useState<import('../lib/supabase').TradeJob | null>(null);
  const [parteMantenimiento, setParteMantenimiento] = useState<{ activo: boolean; materialesIncluidos: boolean; nombre: string | null } | null>(null);
  const [parteMode, setParteMode] = useState<'edit' | 'view' | 'supplement'>('edit');
  const [parteJobInvoices, setParteJobInvoices] = useState<import('../lib/supabase').TradeInvoice[]>([]);
  const [mobileClienteId, setMobileClienteId] = useState<string | null>(null);
  const [isSessionClosed, setIsSessionClosed] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);
  const [showVisitaModal, setShowVisitaModal] = useState(false);
  const [visitaDraft, setVisitaDraft] = useState<{ titulo: string; client_id: string | null; fecha: string }>({ titulo: '', client_id: null, fecha: new Date().toISOString().split('T')[0] });
  const [showPresupuestoFoto, setShowPresupuestoFoto] = useState(false);
  const [showPresupuestoIncremental, setShowPresupuestoIncremental] = useState(false);
  const [showMantenimientoWizard, setShowMantenimientoWizard] = useState(false);
  const [mantenimientoReloadKey, setMantenimientoReloadKey] = useState(0);
  const [pendingPresupuestoJobId, setPendingPresupuestoJobId] = useState<string | null>(null);

  // Pasos del Asistente Móvil (Wizard)
  const [wizardActive, setWizardActive] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [wizardOrigin, setWizardOrigin] = useState<'voz' | 'foto' | 'manual'>('manual');
  const [wizardViewOnly, setWizardViewOnly] = useState<boolean>(false);
  const [wizardQuote, setWizardQuote] = useState<Partial<Presupuesto>>({
    id: '',
    nombreCliente: '',
    telefonoCliente: '',
    emailCliente: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    partidas: [],
    total: 0,
    estado: 'Borrador'
  });

  // Colapsar detalle partidas en el preview móvil
  const [itemsCollapsedMobile, setItemsCollapsedMobile] = useState<boolean>(true);

  // WhatsApp Simulation State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsAppStep, setWhatsAppStep] = useState<'confirm' | 'sending' | 'success'>('confirm');
  const [whatsAppProgress, setWhatsAppProgress] = useState<number>(0);
  const [targetQuoteForWhatsApp, setTargetQuoteForWhatsApp] = useState<Presupuesto | null>(null);

  // Modal de envío de presupuesto (elige canal)
  const [showEnviarModal, setShowEnviarModal] = useState(false);

  // CRM Mobile detail active
  const [expandedClientMobileId, setExpandedClientMobileId] = useState<string | null>(null);
  const [crmClientInvoices, setCrmClientInvoices] = useState<Record<string, { numero: string; fecha: string; total: number; estado: string; concepto?: string | null }[]>>({});
  // CRM desktop side panel
  const [crmPanelClientId, setCrmPanelClientId] = useState<string | null>(null);
  const [crmPanelTab, setCrmPanelTab] = useState<'facturas' | 'presupuestos' | 'trabajos'>('facturas');

  // Mobile filters
  const [presupuestoFilter, setPresupuestoFilter] = useState<'all' | 'month'>('month');
  const [presupuestoClientFilter, setPresupuestoClientFilter] = useState('');
  const [facturaFilter, setFacturaFilter] = useState<'all' | 'month'>('month');
  const [facturaClientFilter, setFacturaClientFilter] = useState('');

  // Pay method bottom sheet
  const [payMethodInvoiceId, setPayMethodInvoiceId] = useState<string | null>(null);

  // Notificaciones flotantes
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error'; id: number } | null>(null);
  const [notificationProgress, setNotificationProgress] = useState(100);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Date.now();
    setNotification({ message, type, id });
    setNotificationProgress(100);
  };

  useEffect(() => {
    if (!notification) return;
    const interval = setInterval(() => {
      setNotificationProgress(prev => {
        if (prev <= 0) {
          clearInterval(interval);
          setNotification(null);
          return 0;
        }
        return prev - 2;
      });
    }, 60);
    return () => clearInterval(interval);
  }, [notification]);

  // Datos base compartidos
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);

  const [facturas, setFacturas] = useState<Factura[]>([]);

  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgData, setOrgData] = useState<TradeOrganization | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [orgTemplates, setOrgTemplates] = useState<Partial<Record<TemplateType, string>>>({});
  const [savingTemplate, setSavingTemplate] = useState<TemplateType | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [openTemplateTipo, setOpenTemplateTipo] = useState<TemplateType | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [workCalendar, setWorkCalendar] = useState<WorkCalendar>(() => loadWorkCalendar());
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '', recurring: false });
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ name: '', date_from: '', date_to: '', recurring: false });
  const [urgentContratosCount, setUrgentContratosCount] = useState(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [subscription, setSubscription] = useState<TradeSubscription | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mantenimientoInitialText, setMantenimientoInitialText] = useState<string>('');
  const [presupuestoSearch, setPresupuestoSearch] = useState('');
  const [presupuestoEstado, setPresupuestoEstado] = useState('todos');
  const [presupuestoFechaDesde, setPresupuestoFechaDesde] = useState('');
  const [presupuestoFechaHasta, setPresupuestoFechaHasta] = useState('');
  const [presupuestoClienteFiltro, setPresupuestoClienteFiltro] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [quoteTokenStatus, setQuoteTokenStatus] = useState<{ status: string; accepted_at: string | null } | null>(null);
  const [platformInvoices, setPlatformInvoices] = useState<Array<{
    id: string; period_start: string; period_end: string; amount_cents: number;
    status: string; stripe_invoice_id: string | null; invoice_url: string | null;
    invoice_pdf_url: string | null; plan: string | null; paid_at: string | null;
  }>>([]);

  // Manejar retorno desde Stripe checkout
  useEffect(() => {
    if (!checkoutSuccess || !orgId) return;
    setActiveTab('settings');
    showToast('¡Plan actualizado correctamente! 🎉', 'success');
    // Esperar a que el webhook haya actualizado la BD, luego refrescar
    const t = setTimeout(() => {
      loadOrgSubscription(orgId).then(sub => {
        if (sub) setSubscription(sub);
      });
    }, 3000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutSuccess, orgId]);

  const [empresaAjustes, setEmpresaAjustes] = useState(() => {
    const saved = (() => { try { return JSON.parse(localStorage.getItem('tf_biz_config') || '{}'); } catch { return {}; } })();
    return {
      nombre: '',
      nif: '',
      email: '',
      telefonoFijo: '',
      telefonoMovil: '',
      direccion: '',
      localidad: '',
      cp: '',
      provincia: '',
      pais: 'España',
      ivaDefault: 21,
      planSuscripcion: '',
      valorHoraOperario: saved.valorHoraOperario ?? 45,
      margenMateriales: saved.margenMateriales ?? 0,
      descuentoCliente: saved.descuentoCliente ?? 0,
      iban: '',
      banco: '',
      titularCuenta: '',
    };
  });

  useEffect(() => {
    try {
      const current = JSON.parse(localStorage.getItem('tf_biz_config') || '{}');
      localStorage.setItem('tf_biz_config', JSON.stringify({
        ...current,
        valorHoraOperario: empresaAjustes.valorHoraOperario,
        margenMateriales: empresaAjustes.margenMateriales,
        descuentoCliente: empresaAjustes.descuentoCliente,
      }));
    } catch {}
  }, [empresaAjustes.valorHoraOperario, empresaAjustes.margenMateriales, empresaAjustes.descuentoCliente]);

  const [trabajadores, setTrabajadores] = useState<TrabajadorItem[]>([]);
  const [showAddWorker, setShowAddWorker] = useState(false);

  const [tarifas, setTarifas] = useState<TarifaItem[]>([
    { id: '1', codigo: 'MO-001', familia: 'Mano de Obra', descripcion: 'Hora oficial de primera', precioBase: 35, unidad: 'h', activo: true },
    { id: '2', codigo: 'MO-002', familia: 'Mano de Obra', descripcion: 'Hora ayudante', precioBase: 25, unidad: 'h', activo: true },
    { id: '3', codigo: 'FON-001', familia: 'Fontanería', descripcion: 'Grifo monomando cocina estándar', precioBase: 65, unidad: 'ud', activo: true },
    { id: '4', codigo: 'ELE-001', familia: 'Electricidad', descripcion: 'Punto de luz empotrado LED', precioBase: 45, unidad: 'ud', activo: true },
    { id: '5', codigo: 'REF-001', familia: 'Reformas', descripcion: 'Alicatado porcelánico', precioBase: 28, unidad: 'm²', activo: true },
  ]);
  const [catalogProducts, setCatalogProducts] = useState<TradeCatalogProduct[]>([]);
  const [activeSupplierCatalogs, setActiveSupplierCatalogs] = useState<ActiveSupplierCatalog[]>([]);
  const [jobs, setJobs] = useState<TradeJob[]>([]);
  const [orgBaseGeo, setOrgBaseGeo] = useState<GeoLocation | null>(null);

  // Geocodificar la dirección base de la organización una sola vez
  useEffect(() => {
    if (!orgId || !orgData) return;
    if (orgData.base_latitud != null && orgData.base_longitud != null) {
      setOrgBaseGeo({ lat: orgData.base_latitud, lng: orgData.base_longitud });
      return;
    }
    const dir = orgData.direccion;
    const ciu = (orgData as unknown as Record<string, unknown>).ciudad as string | undefined;
    if (!dir && !ciu) return;
    void geocodeAddress({ direccion: dir, localidad: ciu }).then(geo => {
      if (!geo) return;
      setOrgBaseGeo({ lat: geo.latitud, lng: geo.longitud });
      void updateOrgGeocoords(orgId, geo.latitud, geo.longitud).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const [showCatalogImport, setShowCatalogImport] = useState(false);
  const [showGlobalCatalog, setShowGlobalCatalog] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [editingVariant, setEditingVariant] = useState<{ id: string; field: 'precio_venta' | 'margen_pct'; value: string } | null>(null);
  const [savingVariant, setSavingVariant] = useState<string | null>(null);
  const [editingTarifaId, setEditingTarifaId] = useState<string | null>(null);
  const [savingTarifaId, setSavingTarifaId] = useState<string | null>(null);
  const [catalogFamilyFilter, setCatalogFamilyFilter] = useState<Set<string>>(new Set());
  const [showCatalogFamilyDropdown, setShowCatalogFamilyDropdown] = useState(false);
  const [catalogFamilySearch, setCatalogFamilySearch] = useState('');
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [addProductDraft, setAddProductDraft] = useState({ codigo: '', familia: '', descripcion: '', precio: '', unidad: 'ud' });
  const [savingAddProduct, setSavingAddProduct] = useState(false);

  // Support modal
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [supportAsunto, setSupportAsunto] = useState('Consulta general');
  const [supportMsg, setSupportMsg] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [filterEstado, setFilterEstado] = useState<'todas' | 'Pendiente' | 'Pagada' | 'Vencida' | 'Devuelta'>('todas');
  const [showAddTarifa, setShowAddTarifa] = useState(false);
  const [newWorkerDraft, setNewWorkerDraft] = useState({ nombre: '', telefono: '', email: '', rol: 'tecnico' as TrabajadorItem['rol'] });
  const [newTarifaDraft, setNewTarifaDraft] = useState({ codigo: '', familia: 'General', descripcion: '', precioBase: 0, unidad: 'ud' });
  const [tarifaFilter, setTarifaFilter] = useState('');

  // ================= SIMULACIONES DE IA =================
  const [voiceStep, setVoiceStep] = useState<'idle' | 'listening' | 'transcribing' | 'thinking' | 'done'>('idle');
  const [voiceText, setVoiceText] = useState('');
  const [audioWaveHeights, setAudioWaveHeights] = useState<number[]>([8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8, 8]);
  const audioIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamTimeoutRef = useRef<NodeJS.Timeout[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioMimeTypeRef = useRef<string>('audio/webm');

  const dictadoFicticio = [
    "Apunta", "instalación", "de", "caldera", "de", "gas", "Vaillant", "Turbomag", 
    "estanco", "de", "doce", "litros...", "y", "pon", "tres", "horas", "de", "mano", "de", 
    "obra", "de", "instalador", "certificado", "a", "cuarenta", "y", "cinco", "euros...", 
    "y", "añádele", "un", "latiguillo", "trenzado", "y", "llave", "de", "paso", "de", 
    "media", "pulgada", "por", "quince", "euros."
  ];

  const fasesPensamiento = [
    "Corrigiendo ruidos de fondo de la obra...",
    "Identificando vocablos técnicos de instalaciones...",
    "Verificando tarifas Saunier/Vaillant en Sevilla...",
    "Generando catálogo de partidas..."
  ];

  const startWaveform = () => {
    audioIntervalRef.current = setInterval(() => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const step = Math.floor(data.length / 14);
        setAudioWaveHeights(Array.from({ length: 14 }, (_, i) => {
          const val = data[i * step] ?? 0;
          return Math.max(4, Math.floor((val / 255) * 44) + 4);
        }));
      } else {
        setAudioWaveHeights(Array.from({ length: 14 }, () => Math.floor(Math.random() * 40) + 6));
      }
    }, 80);
  };

  const startVoiceRecording = async () => {
    setVoiceStep('listening');
    setVoiceText('');

    if (isLiveMode) {
      // Modo real: MediaRecorder
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4';
        audioMimeTypeRef.current = mimeType;
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onerror = () => {
          showToast('Error en la grabación de audio', 'error');
          setVoiceStep('idle');
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
        };
        recorder.start(250);
        // Web Audio API: niveles reales del micrófono
        try {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          ctx.createMediaStreamSource(stream).connect(analyser);
          audioContextRef.current = ctx;
          analyserRef.current = analyser;
        } catch {
          // Si Web Audio falla, el waveform cae a modo aleatorio (no es crítico)
        }
        startWaveform();
      } catch {
        showToast('No se puede acceder al micrófono — revisa los permisos del navegador', 'error');
        setVoiceStep('idle');
      }
    } else {
      // Modo demo: simulación
      startWaveform();
      let currentWordIndex = 0;
      let accumulatedText = '';
      const streamNextWord = () => {
        if (currentWordIndex < dictadoFicticio.length) {
          setVoiceStep('transcribing');
          accumulatedText += (currentWordIndex === 0 ? '' : ' ') + dictadoFicticio[currentWordIndex];
          setVoiceText(accumulatedText);
          currentWordIndex++;
          const t = setTimeout(streamNextWord, 130);
          streamTimeoutRef.current.push(t);
        } else {
          handleStartAIThinking();
        }
      };
      const tStart = setTimeout(streamNextWord, 1500);
      streamTimeoutRef.current.push(tStart);
    }
  };

  const handleStartAIThinking = () => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);
    stopAudioContext();
    setVoiceStep('thinking');
    
    let faseIdx = 0;
    const changeFase = () => {
      if (faseIdx < fasesPensamiento.length - 1) {
        faseIdx++;
        const t = setTimeout(changeFase, 1200);
        streamTimeoutRef.current.push(t);
      } else {
        handleFinishAIVoice();
      }
    };
    const tFirst = setTimeout(changeFase, 1200);
    streamTimeoutRef.current.push(tFirst);
  };

  const handleFinishAIVoice = () => {
    setVoiceStep('done');
    const partidasIA: PartidaPresupuesto[] = [
      { descripcion: 'Calentador Vaillant Turbomag Estanco 12L', tipo: 'material', cantidad: 1, precioUnitario: 395, total: 395 },
      { descripcion: 'Mano de obra oficial instalación gas certificado', tipo: 'mano_de_obra', cantidad: 3, precioUnitario: 45, total: 135 },
      { descripcion: 'Kit latiguillo inoxidable 1/2" y llave escuadra cromada', tipo: 'material', cantidad: 1, precioUnitario: 15, total: 15 }
    ];

    const totalIA = partidasIA.reduce((acc, curr) => acc + curr.total, 0);
    const descIA = 'Instalación de calentador Vaillant estanco';

    setWizardQuote(prev => ({ ...prev, descripcion: descIA, partidas: partidasIA, total: totalIA }));
    setEditingQuote(prev => ({ ...prev, descripcion: descIA, partidas: partidasIA, total: totalIA }));

    showToast('Voz procesada por IA con éxito');
    setTimeout(() => {
      setVoiceStep('idle');
      setIsVoiceModalOpen(false);
      setDesktopModalText('');
      setActiveTab('create_quote');
      setWizardActive(true);
      setWizardStep(4);
    }, 800);
  };

  interface AIQuotePartida {
    concepto: string;
    descripcion: string;
    oficio: string;
    tipo_partida: 'mano_obra' | 'material' | 'servicio';
    unidad: string;
    cantidad: number;
    precio_unitario: number;
    total: number;
    precio_origen: string;
    requiere_revision: boolean;
    motivo_revision: string;
    origen?: 'catalogo' | 'sugerida_ia' | 'proveedor';
    // Enriquecido por enrichWithSupplierProducts en el edge function
    supplier_key?: string;
    supplier_name?: string;
    supplier_ref?: string;
    supplier_precio_coste?: number;
    supplier_margen_pct?: number;
  }

  interface AIQuote {
    resumen: {
      texto_original: string;
      tipo_presupuesto: string;
      requiere_revision_general: boolean;
      alertas: string[];
    };
    oficios_detectados: Array<{
      oficio: string;
      existe_en_catalogo: boolean;
      nuevo_oficio: boolean;
      tarifa_hora: { min: number; recomendado: number; max: number };
      motivo: string;
    }>;
    partidas: AIQuotePartida[];
    calculos: {
      subtotal: number;
      iva_porcentaje: number;
      iva: number;
      total: number;
    };
    sugerencias_catalogo: Array<{
      oficio_sugerido: string;
      min: number;
      recomendado: number;
      max: number;
      motivo: string;
    }>;
    partidas_nuevas_detectadas?: Array<{
      concepto: string;
      oficio: string;
      fuente: string;
      motivo?: string;
    }>;
  }

  const quoteToPartidas = (quote: AIQuote): PartidaPresupuesto[] => {
    if (!Array.isArray(quote?.partidas)) return [];
    return quote.partidas.map(p => {
      const tipo: PartidaPresupuesto['tipo'] = p.tipo_partida === 'material' ? 'material' : 'mano_de_obra';

      // Determinar origen: proveedor (enriquecido por edge fn) > sugerida_ia (IA sin catálogo) > catalogo
      const origen: PartidaPresupuesto['origen'] =
        p.supplier_key ? 'proveedor' :
        (p.origen === 'sugerida_ia' || (p.requiere_revision && (p.precio_unitario ?? 0) === 0)) ? 'sugerida_ia' :
        'catalogo';

      // Para materiales sin precio sin proveedor: intentar match en catálogo propio
      if (p.tipo_partida === 'material' && (p.precio_unitario ?? 0) === 0 && !p.supplier_key && catalogProducts.length > 0) {
        const catalogMatch = matchProductForAI(p.concepto || p.descripcion, catalogProducts);
        if (catalogMatch) {
          const basePrice = catalogMatch.variant.precio_venta;
          const pu = basePrice * (1 + empresaAjustes.margenMateriales / 100);
          const qty = p.cantidad ?? 1;
          return {
            descripcion: `${catalogMatch.product.nombre_generico} (${catalogMatch.variant.marca})`,
            tipo,
            cantidad: qty,
            precioUnitario: pu,
            total: pu * qty,
            origen: 'catalogo',
          };
        }
      }

      return {
        descripcion: p.concepto || p.descripcion || '',
        tipo,
        cantidad: p.cantidad ?? 1,
        precioUnitario: p.precio_unitario ?? 0,
        total: p.total ?? 0,
        requiere_precio: p.requiere_revision,
        aviso: p.motivo_revision || undefined,
        origen,
        supplier_key: p.supplier_key,
        supplier_name: p.supplier_name,
        supplier_ref: p.supplier_ref,
        precioCoste: p.supplier_precio_coste,
      };
    });
  };

  const handleVoiceResult = (
    transcript: string,
    quote: AIQuote,
    actuacionIds: string[] = [],
    kbScore: number = 0,
    webSearchUsed: boolean = false,
  ) => {
    try {
      // Auto-detectar si es una solicitud de mantenimiento
      const isMaintenanceRequest = /mantenimiento|contrato\s*(de\s*)?(servicio|revisión|limpieza)|revisión\s*(mensual|anual|semestral|trimestral|periódic)|servicio\s*(de\s*)?mantenimiento/i.test(transcript);
      const canAccessMaintenance = subscription?.plan === 'empresa_plus' || subscription?.plan === 'empresa';

      if (isMaintenanceRequest && canAccessMaintenance) {
        setVoiceStep('done');
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        showToast('Solicitud de mantenimiento detectada — abriendo módulo', 'success');
        setTimeout(() => {
          setVoiceStep('idle');
          setIsVoiceModalOpen(false);
          setMantenimientoInitialText(transcript);
          setActiveTab('mantenimiento');
          setWizardActive(false);
        }, 900);
        return;
      }

      const partidas = quoteToPartidas(quote);
      if (partidas.length === 0) {
        if (transcript && transcript.trim().length > 2) {
          setDesktopModalText(transcript.trim());
          showToast('La IA no generó partidas — transcripción copiada al texto, corrígela y pulsa "Enviar con IA"', 'error');
        } else {
          showToast('La IA no detectó voz con claridad — acércate al micrófono e inténtalo de nuevo', 'error');
        }
        setVoiceStep('idle');
        mediaRecorderRef.current = null;
        audioChunksRef.current = [];
        return;
      }

      // Guardar datos para el sistema de aprendizaje
      const nuevosOficios = (quote.oficios_detectados ?? [])
        .filter(o => o.nuevo_oficio === true)
        .map(o => ({ oficio: o.oficio, motivo: o.motivo ?? '' }));
      setAiLearningData({
        transcript,
        actuacionIds,
        aiPartidas: partidas,
        nuevasPartidas: quote.partidas_nuevas_detectadas ?? [],
        kbScore,
        nuevosOficios,
      });
      setSavedActuacion(false);

      const total = quote.calculos?.total ?? partidas.reduce((s, p) => s + (p.total ?? 0), 0);
      const desc = (
        (typeof quote.resumen === 'string' ? quote.resumen : quote.resumen?.tipo_presupuesto || quote.resumen?.texto_original) || transcript
      ).slice(0, 80);

      // Informar fuente usada: Base Maestra > Web search > Solo IA
      const toastMsg = actuacionIds.length > 0
        ? `IA procesada ✓ — Base Maestra (${actuacionIds.length} actuación${actuacionIds.length > 1 ? 'es' : ''})`
        : webSearchUsed
        ? 'IA procesada ✓ — reforzada con búsqueda web'
        : 'Voz procesada por IA ✓';

      setWizardQuote(prev => ({ ...prev, descripcion: desc, partidas, total, estado: 'Borrador' as const }));
      setEditingQuote(prev => ({ ...prev, descripcion: desc, partidas, total }));
      setVoiceText(transcript);
      setVoiceStep('done');
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      showToast(toastMsg, 'success');
      setTimeout(() => {
        setVoiceStep('idle');
        setIsVoiceModalOpen(false);
        setDesktopModalText('');
        setActiveTab('create_quote');
        setWizardActive(true);
        setWizardStep(4);
      }, 900);
    } catch (err: unknown) {
      showToast('Error procesando respuesta IA: ' + (err instanceof Error ? err.message : String(err)), 'error');
      setVoiceStep('idle');
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  };

  // Parar grabación real y enviar a la edge function
  const stopVoiceRecording = async () => {
    if (!isLiveMode || !mediaRecorderRef.current) {
      // Demo: saltar a la fase de pensamiento
      streamTimeoutRef.current.forEach(t => clearTimeout(t));
      streamTimeoutRef.current = [];
      handleStartAIThinking();
      return;
    }

    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }
    setVoiceStep('thinking');
    setVoiceText('Transcribiendo con IA...');

    // Detener el MediaRecorder de forma segura con fallback por timeout
    await new Promise<void>(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve();
        return;
      }
      const fallback = setTimeout(resolve, 3000);
      recorder.onstop = () => { clearTimeout(fallback); resolve(); };
      try {
        recorder.stop();
      } catch {
        clearTimeout(fallback);
        resolve();
      }
    });

    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());

    const mimeType = audioMimeTypeRef.current;
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(audioChunksRef.current, { type: mimeType });
    if (blob.size < 100) {
      showToast('Audio demasiado corto — habla un poco más', 'error');
      setVoiceStep('idle');
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
      return;
    }
    const formData = new FormData();
    formData.append('audio', blob, `audio.${ext}`);

    const controller = new AbortController();
    const fetchTimeout = setTimeout(() => controller.abort(), 90000);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-voice-to-quote`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` },
          body: formData,
          signal: controller.signal,
        },
      );
      clearTimeout(fetchTimeout);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
        if (err.plan_restriction) {
          showToast(err.error ?? 'Tu plan no permite esta función', 'error');
          setVoiceStep('idle');
          mediaRecorderRef.current = null;
          audioChunksRef.current = [];
          setIsVoiceModalOpen(false);
          setShowUpgradeModal(true);
          return;
        }
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const result: { transcript: string; quote: AIQuote; actuacion_ids_matched?: string[]; kb_score?: number; web_search_used?: boolean } = await res.json();
      handleVoiceResult(result.transcript, result.quote, result.actuacion_ids_matched ?? [], result.kb_score ?? 0, result.web_search_used ?? false);
    } catch (e: any) {
      clearTimeout(fetchTimeout);
      const isAbort = e.name === 'AbortError';
      showToast(isAbort ? 'La IA tardó demasiado — inténtalo de nuevo' : 'Error al procesar audio: ' + e.message, 'error');
      setVoiceStep('idle');
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  };

  // Escaneo fotográfico
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState<PresetPhoto | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [realPhotoFile, setRealPhotoFile] = useState<File | null>(null);
  const [realPhotoPreviewUrl, setRealPhotoPreviewUrl] = useState<string | null>(null);
  const [photoScanPhase, setPhotoScanPhase] = useState<'idle' | 'scanning' | 'intent'>('idle');
  const [photoScene, setPhotoScene] = useState<{ descripcion: string; acciones: string[] } | null>(null);
  const [pendingPhotoQuote, setPendingPhotoQuote] = useState<AIQuote | null>(null);
  const scanProgressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoCameraRef = useRef<HTMLInputElement>(null);

  const presetPhotos: PresetPhoto[] = [
    {
      id: 'photo-1',
      name: 'Cuadro Eléctrico Principal',
      category: 'Electricidad',
      url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
      detections: [
        { label: 'Diferencial Schneider 2P 40A', x: 20, y: 20, w: 30, h: 40, price: 54.50, type: 'material', confidence: 99.1 },
        { label: 'PIA 1P+N 16A Schneider', x: 55, y: 20, w: 20, h: 40, price: 14.90, type: 'material', confidence: 97.4 }
      ]
    },
    {
      id: 'photo-2',
      name: 'Desagüe y Sifón Fregadero',
      category: 'Fontanería',
      url: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=600&q=80',
      detections: [
        { label: 'Sifón botella de desagüe PVC 40mm', x: 28, y: 38, w: 44, h: 42, price: 16.50, type: 'material', confidence: 98.9 },
        { label: 'Válvula escuadra cromada', x: 47, y: 22, w: 20, h: 18, price: 18.20, type: 'material', confidence: 96.5 }
      ]
    }
  ];

  const startPhotoAnalysis = async () => {
    // ── Modo real: foto real → edge function Claude Vision ──────────────
    if (isLiveMode && realPhotoFile) {
      setIsScanning(true);
      setPhotoScanPhase('scanning');
      setScanProgress(15);
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(realPhotoFile);
          img.onload = () => {
            URL.revokeObjectURL(url);
            const MAX_PX = 1280;
            let w = img.width; let h = img.height;
            if (w > MAX_PX || h > MAX_PX) {
              if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
              else { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
            }
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            let quality = 0.72;
            const tryExport = () => {
              const dataUrl = canvas.toDataURL('image/jpeg', quality);
              const b64 = dataUrl.split(',')[1];
              if (b64.length * 0.75 > 1.2 * 1024 * 1024 && quality > 0.35) {
                quality -= 0.12;
                tryExport();
              } else {
                resolve(b64);
              }
            };
            tryExport();
          };
          img.onerror = reject;
          img.src = url;
        });
        setScanProgress(40);
        // Animar lentamente de 40% → 88% mientras espera la respuesta de la API
        if (scanProgressIntervalRef.current) clearInterval(scanProgressIntervalRef.current);
        scanProgressIntervalRef.current = setInterval(() => {
          setScanProgress(prev => {
            if (prev >= 88) { clearInterval(scanProgressIntervalRef.current!); return prev; }
            return prev + 1;
          });
        }, 500);

        const { data: { session } } = await supabase.auth.getSession();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90_000);
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-photo-scan`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_base64: base64, mime_type: 'image/jpeg' }),
            signal: controller.signal,
          },
        ).finally(() => clearTimeout(timeoutId));

        if (scanProgressIntervalRef.current) clearInterval(scanProgressIntervalRef.current);
        setScanProgress(95);

        const json = await res.json().catch(() => ({})) as { quote?: AIQuote & { scene_detectada?: string; acciones_sugeridas?: string[] }; error?: string };
        if (!res.ok || !json.quote) {
          throw new Error(json.error ?? `HTTP ${res.status} — respuesta inesperada del servidor`);
        }
        const quote = json.quote;
        if (!Array.isArray(quote.partidas)) quote.partidas = [];
        setScanProgress(100);
        setIsScanning(false);

        // Guardar resultado y mostrar selección de intención
        setPendingPhotoQuote(quote as AIQuote);
        setPhotoScene({
          descripcion: quote.scene_detectada ?? (typeof quote.resumen === 'string' ? quote.resumen : (quote.resumen as any)?.texto_original ?? ''),
          acciones: quote.acciones_sugeridas ?? [],
        });
        setPhotoScanPhase('intent');
      } catch (e: unknown) {
        if (scanProgressIntervalRef.current) clearInterval(scanProgressIntervalRef.current);
        const err = e as Error;
        const msg = err.name === 'AbortError'
          ? 'Tiempo de espera agotado. Intenta de nuevo.'
          : 'Error al analizar foto: ' + err.message;
        showToast(msg, 'error');
        setIsScanning(false);
        setPhotoScanPhase('idle');
      }
      return;
    }

    // ── Modo demo: preset con barra de progreso fake ─────────────────────
    if (!selectedPhotoPreset) return;
    setIsScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          const resultItems: PartidaPresupuesto[] = selectedPhotoPreset.detections.map(det => ({
            descripcion: det.label,
            tipo: det.type as PartidaPresupuesto['tipo'],
            cantidad: 1,
            precioUnitario: det.price,
            total: det.price,
          }));
          const labor = selectedPhotoPreset.category === 'Electricidad'
            ? { descripcion: 'Mano de obra conexionado y montaje', tipo: 'mano_de_obra' as const, cantidad: 2, precioUnitario: 42, total: 84 }
            : { descripcion: 'Mano de obra fontanero instalación desagüe', tipo: 'mano_de_obra' as const, cantidad: 1, precioUnitario: 39, total: 39 };
          const finalItems = [...resultItems, labor];
          const addedTotal = finalItems.reduce((acc, curr) => acc + curr.total, 0);
          setWizardQuote(prev => ({
            ...prev,
            partidas: [...(prev.partidas || []), ...finalItems],
            total: (prev.total || 0) + addedTotal,
          }));
          showToast('Análisis fotográfico finalizado');
          setSelectedPhotoPreset(null);
          setWizardStep(4);
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  const handleApplyPhotoResult = (accion?: string) => {
    if (!pendingPhotoQuote) return;
    const partidas = quoteToPartidas(pendingPhotoQuote);
    const total = partidas.reduce((s, p) => s + p.total, 0);
    const descBase = typeof pendingPhotoQuote.resumen === 'string'
      ? pendingPhotoQuote.resumen
      : (pendingPhotoQuote.resumen as any)?.texto_original ?? '';
    setWizardQuote(prev => ({
      ...prev,
      descripcion: accion ?? descBase.slice(0, 120),
      partidas,
      total,
      estado: 'Borrador' as const,
    }));
    setPhotoScanPhase('idle');
    setPhotoScene(null);
    setPendingPhotoQuote(null);
    setRealPhotoFile(null);
    setRealPhotoPreviewUrl(null);
    setScanProgress(0);
    showToast(`${partidas.length} elementos detectados ✓`, 'success');
    setWizardStep(4);
    setActiveTab('create_quote');
  };

  // Iniciar asistente wizard
  const startWizard = (startingStep: number = 1) => {
    setWizardOrigin(startingStep === 2 ? 'voz' : startingStep === 3 ? 'foto' : 'manual');
    setWizardQuote({
      id: `P-2026-00${presupuestos.length + 1}`,
      nombreCliente: '',
      telefonoCliente: '',
      emailCliente: '',
      descripcion: '',
      fecha: new Date().toISOString().split('T')[0],
      partidas: [],
      total: 0,
      estado: 'Borrador'
    });
    setWizardStep(startingStep);
    setWizardActive(true);
    setShowFloatingMenu(false);
  };

  const [showQuickClientModal, setShowQuickClientModal] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientPhone, setQuickClientPhone] = useState('');
  const [quickClientEmail, setQuickClientEmail] = useState('');

  const finishWizardAndSave = async (clientName: string, clientPhone: string) => {
    const finalQuote = { ...wizardQuote, nombreCliente: clientName || 'Sin nombre', telefonoCliente: clientPhone } as Presupuesto;
    // Aprender precios rellenados por el usuario antes de guardar
    autoLearnPrices(finalQuote.partidas ?? [], wizardOrigin);

    // ── Aprendizaje IA: comparar partidas finales con propuesta original ──────
    let kbActuacionesSaved: string[] = [];
    if (aiLearningData && orgId && isLiveMode) {
      kbActuacionesSaved = aiLearningData.actuacionIds;
      const finalDescripciones = new Set((finalQuote.partidas ?? []).map(p => (p.descripcion ?? '').toLowerCase().trim()));
      const aiDescripciones = new Set(aiLearningData.aiPartidas.map(p => (p.descripcion ?? '').toLowerCase().trim()));

      // Partidas que el instalador AÑADIÓ (no estaban en la propuesta de la IA)
      const partidasNuevasInstalador = (finalQuote.partidas ?? [])
        .filter(p => p.descripcion && !aiDescripciones.has(p.descripcion.toLowerCase().trim()))
        .map(p => p.descripcion);

      // Partidas nuevas de internet que el instalador confirmó (las mantuvo)
      const partidasWebConfirmadas = aiLearningData.nuevasPartidas
        .filter(p => p.concepto && finalDescripciones.has(p.concepto.toLowerCase().trim()))
        .map(p => p.concepto);

      const todasNuevasPartidas = [...new Set([...partidasNuevasInstalador, ...partidasWebConfirmadas])];
      const transcript = aiLearningData.transcript;
      const keywords = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 8);

      // Guardar feedback en BD (fire-and-forget)
      saveAIFeedback(
        orgId, transcript,
        aiLearningData.actuacionIds,
        aiLearningData.aiPartidas as unknown[],
        (finalQuote.partidas ?? []) as unknown[],
        aiLearningData.nuevasPartidas as unknown[],
        aiLearningData.kbScore,
      ).catch(() => {});

      // Actualizar actuaciones existentes con nuevas partidas
      if (todasNuevasPartidas.length > 0) {
        for (const actuacionId of aiLearningData.actuacionIds) {
          applyActuacionLearning(actuacionId, todasNuevasPartidas, keywords).catch(() => {});
        }
        // Si no había actuaciones (trabajo desconocido), crear una nueva
        if (aiLearningData.actuacionIds.length === 0) {
          const oficio = (finalQuote.partidas?.[0] as PartidaPresupuesto & { oficio?: string } | undefined)?.oficio
            ?? 'multiservicio';
          const newActuacionId = `aprendido_${Date.now()}`;
          createActuacionFromLearning(
            oficio, newActuacionId, keywords,
            (finalQuote.partidas ?? []).map(p => p.descripcion),
            transcript,
          ).catch(() => {});
        }
      }

      setAiLearningData(null);
    }
    let savedQuote = finalQuote;
    if (isLiveMode && orgId && finalQuote.partidas?.length) {
      const phone = clientPhone.trim().replace(/\s/g, '');
      const existingClient = phone
        ? clientes.find(c => (c.telefono ?? '').replace(/\s/g, '') === phone)
        : clientes.find(c => c.nombre === clientName);
      let clientId = existingClient?.id;
      if (existingClient) {
        showToast(`Cliente existente: ${existingClient.nombre}`, 'info');
      } else if (clientName.trim()) {
        try {
          const nc = await addClient(orgId, { nombre: clientName.trim(), telefono: phone || undefined, email: quickClientEmail.trim() || undefined });
          if (nc) { clientId = nc.id; setClientes(prev => [nc as unknown as Cliente, ...prev]); }
        } catch { /* skip */ }
      }
      if (clientId) {
        try {
          const dbQuote = await saveQuote(
            orgId, clientId, finalQuote.descripcion ?? '',
            (finalQuote.partidas ?? []).map(p => ({
              descripcion: p.descripcion,
              tipo: p.tipo,
              cantidad: p.cantidad,
              precio_unitario: p.precioUnitario,
              precio_material: p.precioCoste ?? null,
              supplier_key: p.supplier_key ?? null,
              supplier_name: p.supplier_name ?? null,
              supplier_ref: p.supplier_ref ?? null,
              catalog_variant_id: p.catalog_variant_id ?? null,
            })),
            kbActuacionesSaved.length > 0 ? kbActuacionesSaved : undefined,
          );
          savedQuote = { ...finalQuote, id: dbQuote.numero, dbId: dbQuote.id, total: dbQuote.total_neto, iva_pct: dbQuote.iva_pct, fecha: dbQuote.fecha, estado: dbQuote.estado as Presupuesto['estado'], kbActuaciones: dbQuote.kb_actuaciones ?? undefined };
        } catch (e) { console.error('Error guardando presupuesto:', e); }
      }
    }
    setPresupuestos(prev => [savedQuote, ...prev]);

    // Vincular presupuesto al trabajo que lo originó
    if (pendingPresupuestoJobId && savedQuote.id) {
      const jid = pendingPresupuestoJobId;
      setPendingPresupuestoJobId(null);
      updateJob(jid, { quote_id: savedQuote.id }).catch(() => {});
      setJobs(prev => prev.map(j => j.id === jid ? { ...j, quote_id: savedQuote.id } : j));
    }

    setWizardActive(false);
    setShowQuickClientModal(false);
    if (isNativeDevice) {
      setPostConfirmQuote(savedQuote);
    } else {
      setTargetQuoteForWhatsApp(savedQuote);
      setWhatsAppStep('confirm');
      setShowWhatsAppModal(true);
      setMobileTab('presupuestos');
    }
  };

  const handleTextToAI = async (overrideText?: string) => {
    const text = overrideText ?? (wizardQuote.descripcion ?? '').trim();
    if (!text) { showToast('Escribe una descripción del trabajo primero', 'error'); return; }

    if (isLiveMode) {
      setVoiceStep('thinking');
      setVoiceText(text);
      const ctrl = new AbortController();
      const textTimeout = setTimeout(() => ctrl.abort(), 90000);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-voice-to-quote`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session?.access_token ?? ''}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text }),
            signal: ctrl.signal,
          },
        );
        clearTimeout(textTimeout);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
          if (err.limit_reached) { showToast(err.error ?? 'Límite alcanzado', 'error'); setVoiceStep('idle'); setShowUpgradeModal(true); return; }
          if (err.plan_restriction) { showToast(err.error ?? 'Tu plan no permite esta función', 'error'); setVoiceStep('idle'); setShowUpgradeModal(true); return; }
          throw new Error(err.error ?? `HTTP ${res.status}`);
        }
        const result: { transcript: string; quote: AIQuote; actuacion_ids_matched?: string[]; kb_score?: number; web_search_used?: boolean } = await res.json();
        handleVoiceResult(result.transcript || text, result.quote, result.actuacion_ids_matched ?? [], result.kb_score ?? 0, result.web_search_used ?? false);
      } catch (e: unknown) {
        clearTimeout(textTimeout);
        const isAbort = (e as Error).name === 'AbortError';
        showToast(isAbort ? 'La IA tardó demasiado — inténtalo de nuevo' : 'Error al procesar con IA: ' + (e instanceof Error ? e.message : String(e)), 'error');
        setVoiceStep('idle');
      }
    } else {
      setVoiceStep('thinking');
      setVoiceText(text);
      handleStartAIThinking();
    }
  };

  const handleSaveActuacion = async () => {
    if (!aiLearningData || !orgId || !isLiveMode) return;
    const oficio = aiLearningData.nuevosOficios[0]?.oficio ?? aiLearningData.aiPartidas[0]?.tipo ?? 'multiservicio';
    const transcript = aiLearningData.transcript;
    const actuacionId = transcript.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 50) + '_' + Date.now().toString(36);
    const keywords = transcript.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 10);
    const partidas = aiLearningData.aiPartidas.map(p => p.descripcion);
    const ok = await createActuacionFromLearning(oficio, actuacionId, keywords, partidas, transcript);
    if (ok) {
      setSavedActuacion(true);
      showToast('Plantilla guardada — se usará en futuros presupuestos', 'success');
    } else {
      showToast('Error al guardar la plantilla', 'error');
    }
  };

  const handleNextWizardStep = async () => {
    if (wizardStep === 4 && (!wizardQuote.partidas || wizardQuote.partidas.length === 0)) {
      showToast('Añada al menos una partida de presupuesto', 'error');
      return;
    }

    if (wizardStep < 5) {
      setWizardStep(prev => prev + 1);
    } else {
      if (wizardQuote.nombreCliente) {
        await finishWizardAndSave(wizardQuote.nombreCliente, wizardQuote.telefonoCliente ?? '');
      } else {
        setQuickClientName('');
        setQuickClientPhone('');
        setQuickClientEmail('');
        setShowQuickClientModal(true);
      }
    }
  };

  // Construir URL wa.me con mensaje pre-rellenado
  const buildWaLink = (phone: string | undefined | null, text: string) => {
    const clean = (phone ?? '').replace(/[\s\-\(\)]/g, '').replace(/^\+/, '');
    const num = clean ? (clean.startsWith('34') ? clean : `34${clean}`) : '';
    return num
      ? `https://wa.me/${num}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  const buildQuoteMessage = (q: Presupuesto, acceptanceUrl?: string, pdfUrl?: string) => {
    const iva = empresaAjustes.ivaDefault || 21;
    const ivaAmt = q.total * (iva / 100);
    const totalConIVA = q.total + ivaAmt;

    const savedTemplate = orgTemplates['whatsapp_presupuesto'];
    if (savedTemplate) {
      const vars = buildTemplateVars({
        empresa: {
          nombre: empresaAjustes.nombre,
          telefono: empresaAjustes.telefonoMovil,
          email: empresaAjustes.email,
          nif: empresaAjustes.nif,
          direccion: empresaAjustes.direccion,
        },
        cliente: { nombre: q.nombreCliente, telefono: q.telefonoCliente },
        presupuesto: {
          numero: q.id,
          fecha: q.fecha,
          total: q.total,
          iva,
        },
        enlaceAceptacion: acceptanceUrl,
        enlacePdf: pdfUrl,
      });
      return resolveTemplate(savedTemplate, vars);
    }

    const lines = q.partidas.map(p =>
      `• ${p.descripcion}: ${p.cantidad} × ${p.precioUnitario.toFixed(2)}€ = *${p.total.toFixed(2)}€*`
    );
    return [
      `Hola ${q.nombreCliente}, te envío el presupuesto *${q.id}*.`,
      `_${q.descripcion}_`,
      '',
      ...lines,
      '',
      `Base imponible: ${q.total.toFixed(2)}€`,
      `IVA (${iva}%): ${ivaAmt.toFixed(2)}€`,
      `*TOTAL: ${totalConIVA.toFixed(2)}€*`,
      '',
      ...(acceptanceUrl ? [`✅ *Acepta el presupuesto aquí:*\n${acceptanceUrl}`, ''] : []),
      'Quedo a tu disposición para cualquier consulta.',
      ...(empresaAjustes.nombre ? [empresaAjustes.nombre] : []),
      ...(empresaAjustes.telefonoMovil ? [empresaAjustes.telefonoMovil] : []),
    ].join('\n');
  };

  const handleSendWhatsAppNow = async () => {
    if (!targetQuoteForWhatsApp) return;
    let acceptanceUrl: string | undefined;
    if (orgId) {
      try {
        const quoteData = {
          id: targetQuoteForWhatsApp.id,
          nombreCliente: targetQuoteForWhatsApp.nombreCliente,
          descripcion: targetQuoteForWhatsApp.descripcion,
          partidas: targetQuoteForWhatsApp.partidas,
          total: targetQuoteForWhatsApp.total,
          fecha: targetQuoteForWhatsApp.fecha,
          empresa: empresaAjustes.nombre ?? '',
          emailEmpresa: empresaAjustes.email ?? '',
          telefonoEmpresa: empresaAjustes.telefonoMovil ?? '',
        };
        const record = await createQuoteToken(orgId, targetQuoteForWhatsApp.id, targetQuoteForWhatsApp.nombreCliente, quoteData as Record<string, unknown>);
        acceptanceUrl = `${window.location.origin}/p/${record.token}`;
      } catch { /* Si falla no bloqueamos el envío */ }
    }
    const msg = buildQuoteMessage(targetQuoteForWhatsApp, acceptanceUrl);
    window.open(buildWaLink(targetQuoteForWhatsApp.telefonoCliente, msg), '_blank');
    setPresupuestos(prev => prev.map(q =>
      q.id === targetQuoteForWhatsApp.id ? { ...q, estado: 'Enviado' as const } : q
    ));
    if (isLiveMode && orgId) {
      supabase.from('trade_quotes').update({ estado: 'enviado' }).eq('numero', targetQuoteForWhatsApp.id);
    }
    setShowWhatsAppModal(false);
    setTargetQuoteForWhatsApp(null);
    setWhatsAppStep('confirm');
    showToast('WhatsApp abierto — envía el mensaje al cliente ✓', 'success');
  };

  // Convertir a factura (one-tap — live: DB, demo: local)
  const handleQuickConvertInvoice = async (presupuesto: Presupuesto) => {
    if (isLiveMode && orgId) {
      // Buscar la quote en DB por número para obtener el objeto TradeQuote completo
      const { data: dbQuote } = await supabase
        .from('trade_quotes')
        .select('*, trade_quote_items(*)')
        .eq('org_id', orgId)
        .eq('numero', presupuesto.id)
        .single();

      if (dbQuote) {
        try {
          const inv = await convertToInvoice(dbQuote, orgId);
          const clienteNombre = clientes.find(c => c.id === inv.client_id)?.nombre ?? presupuesto.nombreCliente;
          setFacturas(prev => [{
            id: inv.id,
            numeroFactura: inv.numero,
            nombreCliente: clienteNombre,
            idPresupuesto: presupuesto.id,
            importe: inv.subtotal,
            fecha: inv.fecha,
            fechaVencimiento: inv.fecha_vencimiento ?? '',
            estado: inv.estado as Factura['estado'],
          }, ...prev]);
          setPresupuestos(prev => prev.map(p => p.id === presupuesto.id ? { ...p, estado: 'Facturado' } : p));
          showToast(`Factura ${inv.numero} creada ✓`, 'success');
          return;
        } catch (e: any) {
          showToast('Error al crear factura: ' + e.message, 'error');
          return;
        }
      }
    }
    // Demo / fallback local
    const nextNum = facturas.length + 1;
    const facNumber = `FAC-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    setPresupuestos(prev => prev.map(p => p.id === presupuesto.id ? { ...p, estado: 'Facturado' } : p));
    setFacturas(prev => [{
      id: `fac-${Date.now()}`,
      numeroFactura: facNumber,
      nombreCliente: presupuesto.nombreCliente,
      idPresupuesto: presupuesto.id,
      importe: presupuesto.total,
      fecha: today,
      fechaVencimiento: dueDate.toISOString().split('T')[0],
      estado: 'Pendiente',
    }, ...prev]);
    showToast(`Factura ${facNumber} creada`, 'success');
  };

  const handlePayInvoice = async (id: string) => {
    if (isLiveMode) {
      try {
        await markInvoicePaid(id);
      } catch (e: any) {
        showToast('Error al registrar pago: ' + e.message, 'error');
        return;
      }
    }
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado: 'Pagada' } : f));
    showToast('Pago registrado correctamente', 'success');
  };

  const handleMarkDevuelta = async (id: string, motivo?: string) => {
    if (isLiveMode) {
      try {
        await markInvoiceDevuelta(id, motivo);
      } catch (e: any) {
        showToast('Error al marcar devolución: ' + e.message, 'error');
        return;
      }
    }
    setFacturas(prev => prev.map(f => f.id === id ? { ...f, estado: 'Devuelta' } : f));
    showToast('Factura marcada como devuelta', 'info');
  };

  const handleRemindInvoice = (f: Factura) => {
    const totalConIVA = (f.importe * 1.21).toFixed(2);
    const msg = [
      `Hola ${f.nombreCliente}, te recuerdo el pago pendiente de la factura *${f.numeroFactura}*.`,
      '',
      `Importe: *${totalConIVA}€* (IVA incluido)`,
      ...(f.fechaVencimiento ? [`Vencimiento: ${f.fechaVencimiento}`] : []),
      '',
      'Por favor, confirma cuando realices el pago o contacta conmigo si tienes alguna consulta.',
      ...(empresaAjustes.nombre ? [empresaAjustes.nombre] : []),
      ...(empresaAjustes.telefonoMovil ? [empresaAjustes.telefonoMovil] : []),
    ].join('\n');
    const phone = clientes.find(c => c.nombre === f.nombreCliente)?.telefono;
    window.open(buildWaLink(phone, msg), '_blank');
    showToast('WhatsApp abierto para recordatorio ✓', 'info');
  };

  // --- Estado faltante completado ---

  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [desktopModalText, setDesktopModalText] = useState<string>('');
  // Aprendizaje IA: guardar propuesta original para detectar correcciones del instalador
  const [aiLearningData, setAiLearningData] = useState<{
    transcript: string;
    actuacionIds: string[];
    aiPartidas: PartidaPresupuesto[];
    nuevasPartidas: Array<{ concepto: string; oficio: string; fuente: string; motivo?: string }>;
    kbScore: number;
    nuevosOficios: Array<{ oficio: string; motivo: string }>;
  } | null>(null);
  const [savedActuacion, setSavedActuacion] = useState<boolean>(false);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<Presupuesto | null>(null);
  const [pedirMaterialQuote, setPedirMaterialQuote] = useState<TradeQuote | null>(null);
  const [pedirMaterialLoading, setPedirMaterialLoading] = useState(false);
  const [postConfirmQuote, setPostConfirmQuote] = useState<Presupuesto | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null); // null = crear nuevo, string = editar existente
  // Subcontratas vinculadas al presupuesto en preview
  const [previewSubcontratas, setPreviewSubcontratas] = useState<TradeSubcontrata[]>([]);
  const [previewProveedores, setPreviewProveedores] = useState<TradeSubcontractor[]>([]);
  const [showAddSubcontrataModal, setShowAddSubcontrataModal] = useState(false);
  const [draftSubcontrata, setDraftSubcontrata] = useState({ subcontractor_id: '', descripcion: '', coste: 0, precio_cliente: 0 });
  const [savingSubcontrata, setSavingSubcontrata] = useState(false);

  useEffect(() => {
    if (!selectedQuoteForPreview) { setQuoteTokenStatus(null); return; }
    supabase
      .from('trade_quote_tokens')
      .select('status, accepted_at')
      .eq('quote_numero', selectedQuoteForPreview.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setQuoteTokenStatus(data ? { status: data.status, accepted_at: data.accepted_at } : null));
  }, [selectedQuoteForPreview]);

  // Cargar subcontratas y proveedores al abrir preview de un presupuesto
  useEffect(() => {
    if (!selectedQuoteForPreview?.dbId) { setPreviewSubcontratas([]); return; }
    loadSubcontratasByQuote(selectedQuoteForPreview.dbId).then(setPreviewSubcontratas).catch(() => {});
    if (orgId && previewProveedores.length === 0) {
      loadSubcontractors(orgId).then(setPreviewProveedores).catch(() => {});
    }
  }, [selectedQuoteForPreview?.dbId]);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const filteredClientes = clientes.filter(c => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      c.nombre.toLowerCase().includes(q) ||
      (c.telefono ?? '').toLowerCase().includes(q) ||
      (c.email    ?? '').toLowerCase().includes(q) ||
      (c.direccion ?? '').toLowerCase().includes(q)
    );
  });

  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [newClient, setNewClient] = useState<Partial<Cliente>>({ nombre: '', telefono: '', email: '', direccion: '' });
  const [emailModalCliente, setEmailModalCliente] = useState<Cliente | null>(null);

  const TARIFA_SUGERIDA = 52;
  const [showPricingSuggestion, setShowPricingSuggestion] = useState<boolean>(
    () => !localStorage.getItem('tf_pricing_dismissed') && (empresaAjustes.valorHoraOperario < TARIFA_SUGERIDA)
  );

  interface CompareRow {
    catalog_key: string; supplier_name: string; product_id: string;
    ref_proveedor: string | null; descripcion: string;
    precio_coste: number; margen_pct: number; precio_venta: number;
    unidad: string; score: number;
  }
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [compareResults, setCompareResults] = useState<CompareRow[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const [editingQuote, setEditingQuote] = useState<Presupuesto>({
    id: 'P-2026-NEW',
    nombreCliente: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
    estado: 'Borrador',
    partidas: [],
    total: 0
  });

  const presupuestosPendientesCount = presupuestos.filter(p => p.estado === 'Borrador' || p.estado === 'Enviado').length;
  const totalPendienteFacturas = facturas.filter(f => f.estado !== 'Pagada').reduce((acc, f) => acc + f.importe, 0);
  const totalFacturadoFacturas = facturas.filter(f => f.estado === 'Pagada').reduce((acc, f) => acc + f.importe, 0);

  const stopAudioContext = () => {
    analyserRef.current = null;
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch { /* ignorar */ }
      audioContextRef.current = null;
    }
  };

  const cancelVoiceRecording = () => {
    streamTimeoutRef.current.forEach(t => clearTimeout(t));
    streamTimeoutRef.current = [];
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }
    stopAudioContext();
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* ignorar si ya parado */ }
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
    setVoiceStep('idle');
    setVoiceText('');
    setIsVoiceModalOpen(false);
  };

  const handleSelectPresetPhoto = (photo: PresetPhoto) => {
    setSelectedPhotoPreset(photo);
  };

  const applySuggestedPricing = () => {
    const prev = empresaAjustes.valorHoraOperario;
    setEmpresaAjustes(p => ({ ...p, valorHoraOperario: TARIFA_SUGERIDA }));
    try { localStorage.setItem('tf_pricing_dismissed', '1'); } catch {}
    setShowPricingSuggestion(false);
    showToast(`Tarifa hora actualizada: ${prev}€ → ${TARIFA_SUGERIDA}€/h en Ajustes`, 'success');
  };

  const dismissPricingSuggestion = () => {
    try { localStorage.setItem('tf_pricing_dismissed', '1'); } catch {}
    setShowPricingSuggestion(false);
  };

  const handleRemoveItem = (idx: number) => {
    if (isMobileMode) {
      setWizardQuote(prev => {
        const partidas = (prev.partidas || []).filter((_, i) => i !== idx);
        return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
      });
    } else {
      setEditingQuote(prev => {
        const partidas = prev.partidas.filter((_, i) => i !== idx);
        return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
      });
    }
  };

  const handleAddManualItem = () => {
    const newItem: PartidaPresupuesto = { descripcion: '', tipo: 'material', cantidad: 1, precioUnitario: 0, total: 0 };
    if (isMobileMode) {
      setWizardQuote(prev => ({ ...prev, partidas: [...(prev.partidas || []), newItem] }));
    } else {
      setEditingQuote(prev => ({ ...prev, partidas: [...prev.partidas, newItem] }));
    }
  };

  const handleUpdateItem = (idx: number, updates: Partial<PartidaPresupuesto>) => {
    setEditingQuote(prev => {
      const partidas = prev.partidas.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...updates };
        if ('cantidad' in updates || 'precioUnitario' in updates) {
          updated.total = (updated.cantidad || 0) * (updated.precioUnitario || 0);
        }
        return updated;
      });
      return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
    });
  };

  const handleOpenCompare = async (idx: number, descripcion: string) => {
    if (compareIdx === idx) { setCompareIdx(null); return; }
    setCompareIdx(idx);
    setCompareResults([]);
    setCompareLoading(true);
    try {
      const { data, error } = await supabase.rpc('search_supplier_products', {
        material_text: descripcion,
        p_org_id: orgId,
        limit_per_catalog: 5,
      });
      if (error) throw error;
      const rows = ((data ?? []) as Record<string, unknown>[]).map(r => ({
        catalog_key: r._catalog_key as string,
        supplier_name: r._supplier_name as string,
        product_id: r._product_id as string,
        ref_proveedor: (r._ref as string | null) ?? null,
        descripcion: r._desc as string,
        precio_coste: parseFloat(r._coste as string) || 0,
        margen_pct: parseFloat(r._margen as string) || 0,
        precio_venta: parseFloat(r._venta as string) || 0,
        unidad: r._unidad as string,
        score: r._score as number,
      }));
      setCompareResults(rows);
    } catch {
      setCompareResults([]);
    } finally {
      setCompareLoading(false);
    }
  };

  const handleSelectCompare = (idx: number, opt: CompareRow) => {
    handleUpdateItem(idx, {
      precioUnitario: opt.precio_venta,
      supplier_key: opt.catalog_key,
      supplier_name: opt.supplier_name,
      supplier_ref: opt.ref_proveedor ?? undefined,
      precioCoste: opt.precio_coste,
    });
    setCompareIdx(null);
    setCompareResults([]);
  };

  const handleUpdateWizardItem = (idx: number, updates: Partial<PartidaPresupuesto>) => {
    setWizardQuote(prev => {
      const partidas = (prev.partidas || []).map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, ...updates };
        if ('cantidad' in updates || 'precioUnitario' in updates) {
          updated.total = (updated.cantidad || 0) * (updated.precioUnitario || 0);
        }
        return updated;
      });
      return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
    });
  };

  const handleLearnPrice = async (idx: number) => {
    const part = wizardQuote.partidas?.[idx];
    if (!part?.requiere_precio || !part.precioUnitario || part.precioUnitario <= 0) return;
    if (!orgId) return;
    try {
      await learnPriceToCatalog(orgId, part.descripcion, part.precioUnitario, part.tipo, wizardOrigin);
      handleUpdateWizardItem(idx, { requiere_precio: false, aviso: '' });
      showToast('Precio guardado en catálogo ✓', 'success');
    } catch {
      // silencioso — no bloquear al usuario
    }
  };

  // Aprende automáticamente los precios de partidas que venían a 0 de la IA
  // y el usuario rellenó antes de guardar. Fire-and-forget.
  const autoLearnPrices = (partidas: PartidaPresupuesto[], origen: 'voz' | 'foto' | 'manual' = 'voz') => {
    if (!isLiveMode || !orgId) return;
    let nuevasAprendidas = 0;
    for (const p of partidas) {
      if (p.requiere_precio && p.precioUnitario > 0) {
        learnPriceToCatalog(orgId, p.descripcion, p.precioUnitario, p.tipo, origen).catch(() => {});
      }
      if (p.origen === 'sugerida_ia' && p.precioUnitario > 0) {
        void supabase.rpc('upsert_partida_aprendida', {
          p_org_id: orgId,
          p_descripcion: p.descripcion,
          p_tipo: p.tipo,
          p_precio_unitario: p.precioUnitario,
          p_oficio: null,
        });
        nuevasAprendidas++;
      }
    }
    if (nuevasAprendidas > 0) {
      showToast(`${nuevasAprendidas} partida${nuevasAprendidas > 1 ? 's' : ''} nueva${nuevasAprendidas > 1 ? 's' : ''} guardada${nuevasAprendidas > 1 ? 's' : ''} en tu catálogo IA`, 'success');
    }
  };

  const saveCurrentQuote = async () => {
    if (!editingQuote.nombreCliente) { showToast('Selecciona un cliente', 'error'); return; }
    if (editingQuote.partidas.length === 0) { showToast('Añade al menos una partida', 'error'); return; }

    const isEditing = !!editingQuoteId;
    let saved: Presupuesto;
    const partidasPayload = editingQuote.partidas.map(p => ({
      descripcion: p.descripcion,
      tipo: p.tipo,
      cantidad: p.cantidad,
      precio_unitario: p.precioUnitario,
      precio_material: p.precioCoste ?? null,
      supplier_key: p.supplier_key ?? null,
      supplier_name: p.supplier_name ?? null,
      supplier_ref: p.supplier_ref ?? null,
      catalog_variant_id: p.catalog_variant_id ?? null,
    }));

    if (isLiveMode && orgId) {
      const client = clientes.find(c => c.nombre === editingQuote.nombreCliente);
      if (!client) { showToast('Cliente no encontrado en CRM', 'error'); return; }
      try {
        if (isEditing) {
          const dbQuote = await updateQuote(editingQuoteId, client.id, editingQuote.descripcion, partidasPayload);
          saved = { ...editingQuote, id: dbQuote.numero, dbId: dbQuote.id, total: dbQuote.total_neto, iva_pct: dbQuote.iva_pct, fecha: dbQuote.fecha, estado: dbQuote.estado as Presupuesto['estado'] };
        } else {
          const dbQuote = await saveQuote(orgId, client.id, editingQuote.descripcion, partidasPayload);
          saved = { id: dbQuote.numero, dbId: dbQuote.id, nombreCliente: editingQuote.nombreCliente, descripcion: dbQuote.descripcion ?? '', partidas: editingQuote.partidas, total: dbQuote.total_neto, iva_pct: dbQuote.iva_pct, fecha: dbQuote.fecha, estado: dbQuote.estado as Presupuesto['estado'], telefonoCliente: editingQuote.telefonoCliente, emailCliente: editingQuote.emailCliente };
        }
      } catch (e: any) { showToast('Error al guardar: ' + e.message, 'error'); return; }
    } else {
      saved = { ...editingQuote, id: editingQuoteId ?? `P-2026-00${presupuestos.length + 1}` };
    }

    autoLearnPrices(editingQuote.partidas, 'manual');
    if (isEditing) {
      setPresupuestos(prev => prev.map(p => p.id === saved.id ? saved : p));
    } else {
      setPresupuestos(prev => [saved, ...prev]);
    }
    setEditingQuoteId(null);
    setSelectedQuoteForPreview(saved);
    setActiveTab('preview');
    showToast(isEditing ? 'Presupuesto actualizado' : 'Presupuesto guardado');
    if (!isEditing) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 3000); }
  };

  const convertQuoteToInvoice = (presupuesto: Presupuesto) => {
    handleQuickConvertInvoice(presupuesto);
    setActiveTab('invoices');
  };

  const triggerWhatsAppShare = (quote: Presupuesto) => {
    setTargetQuoteForWhatsApp(quote);
    setWhatsAppStep('confirm');
    setShowWhatsAppModal(true);
  };

  void setShowConfetti;
  void triggerWhatsAppShare;

  const markQuoteAs = async (quote: Presupuesto, newEstado: string) => {
    if (!isLiveMode) {
      setPresupuestos(prev => prev.map(p => p.id === quote.id ? { ...p, estado: newEstado as Presupuesto['estado'] } : p));
      if (selectedQuoteForPreview?.id === quote.id) setSelectedQuoteForPreview(prev => prev ? { ...prev, estado: newEstado as Presupuesto['estado'] } : null);
      showToast(`Presupuesto marcado como ${newEstado}`, 'success');
      return;
    }
    try {
      const { error } = await supabase.from('trade_quotes').update({ estado: newEstado }).eq('numero', quote.id);
      if (error) throw error;
      setPresupuestos(prev => prev.map(p => p.id === quote.id ? { ...p, estado: newEstado as Presupuesto['estado'] } : p));
      if (selectedQuoteForPreview?.id === quote.id) setSelectedQuoteForPreview(prev => prev ? { ...prev, estado: newEstado as Presupuesto['estado'] } : null);
      showToast(`Presupuesto marcado como ${newEstado} ✓`, 'success');
    } catch {
      showToast('Error al cambiar el estado', 'error');
    }
  };

  const generateAcceptanceLink = async (quote: Presupuesto) => {
    if (!orgId) return;
    setGeneratingLink(true);
    try {
      const quoteData = {
        id: quote.id,
        nombreCliente: quote.nombreCliente,
        descripcion: quote.descripcion,
        partidas: quote.partidas,
        total: quote.total,
        fecha: quote.fecha,
        empresa: empresaAjustes.nombre ?? '',
        emailEmpresa: empresaAjustes.email ?? '',
        telefonoEmpresa: empresaAjustes.telefonoMovil ?? '',
      };
      const record = await createQuoteToken(orgId, quote.id, quote.nombreCliente, quoteData as Record<string, unknown>);
      const url = `${window.location.origin}/p/${record.token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      showToast('Enlace copiado al portapapeles ✓', 'success');
    } catch {
      showToast('Error generando el enlace', 'error');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleAddClient = async () => {
    if (!newClient.nombre?.trim()) return;
    if (isLiveMode && orgId) {
      try {
        const saved = await addClient(orgId, { nombre: newClient.nombre!, telefono: newClient.telefono ?? '', email: newClient.email ?? '', direccion: newClient.direccion ?? '' });
        setClientes(prev => [...prev, { id: saved.id, nombre: saved.nombre, telefono: saved.telefono ?? '', email: saved.email ?? '', direccion: saved.direccion ?? '', obrasActivas: 0, totalFacturado: 0 }]);
        showToast('Cliente añadido ✓', 'success');
      } catch (e: any) { showToast('Error al guardar: ' + e.message, 'error'); return; }
    } else {
      setClientes(prev => [...prev, { id: Date.now().toString(), nombre: newClient.nombre!, telefono: newClient.telefono ?? '', email: newClient.email ?? '', direccion: newClient.direccion ?? '', obrasActivas: 0, totalFacturado: 0 }]);
      showToast('Cliente añadido (demo) ✓', 'success');
    }
    setNewClient({ nombre: '', telefono: '', email: '', direccion: '' });
    setIsClientModalOpen(false);
  };

  return (
    <div data-testid="dashboard" className={`font-sans ${
      isNativeDevice
        ? `fixed inset-0 overflow-hidden bg-white`
        : `w-full h-screen flex flex-col bg-white overflow-hidden`
    }`}>

      {/* ================= BARRA SUPERIOR — SOLO EN DESKTOP ================= */}
      {!isNativeDevice && (
        <div className="z-40 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between gap-4 select-none shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center font-black text-white text-xs shadow-sm">TF</div>
            <div>
              <span className="font-black text-sm text-slate-900 tracking-tight">TrabFlow <span className="text-blue-600">AI</span></span>
              <span className="text-[9px] text-slate-400 font-medium block -mt-0.5">Panel de gestión</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {session?.user?.email === ADMIN_EMAIL && (
              <button
                onClick={() => setCurrentPage(ActivePage.Admin)}
                className="flex items-center gap-1.5 border border-slate-200 hover:border-blue-300 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 hover:text-blue-600 transition-colors cursor-pointer"
              >
                <Shield className="w-3.5 h-3.5" />
                Admin
              </button>
            )}
            <button
              data-testid="btn-logout"
              onClick={handleLogout}
              className="flex items-center gap-1.5 border border-slate-200 hover:border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}


      {/* ================= NÚCLEO DEL CONTENEDOR DE LA APLICACIÓN ================= */}
      {isNativeDevice ? (
        /* ===== MODO NATIVO: fullscreen sin frame, sin console header ===== */
        AppContentMobile()
      ) : (
      <div className="flex-grow flex overflow-hidden">

        {isMobileMode ? (
          /* ================= SIMULADOR MÓVIL PREMIUM CON MARCO DE IPHONE ================= */
          <div className="relative mx-auto my-4 w-[360px] h-[730px] rounded-[48px] bg-slate-900 border-[10px] border-slate-800 shadow-2xl overflow-hidden flex flex-col ring-12 ring-slate-950/20">
            {/* Notch superior iPhone */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-900 rounded-full" />
            </div>

            {/* Barra de Estado superior del teléfono */}
            <div className="bg-slate-950 text-white h-9 px-6 pt-2.5 flex items-center justify-between text-[10px] font-mono z-40 select-none shrink-0">
              <span>09:41</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-emerald-400">5G LTE</span>
                <div className="w-5 h-2.5 border border-slate-400 rounded-xs p-0.5 flex items-center">
                  <div className="w-full h-full bg-white rounded-xs" />
                </div>
              </div>
            </div>

            {/* Pantalla del teléfono */}
            <div className="flex-grow overflow-y-auto flex flex-col bg-slate-50 dark:bg-slate-950 relative">
              {AppContentMobile()}
            </div>

            {/* Indicador de inicio inferior del iPhone */}
            <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-28 h-1 bg-slate-700 rounded-full z-50 animate-pulse" />
          </div>
        ) : (
          /* ================= VISTA COMPLETA DE ESCRITORIO ================= */
          <div className="w-full h-full bg-white flex overflow-hidden">
            {AppContentDesktop()}
          </div>
        )}
      </div>
      )}

      {/* ================= MODAL LOGIN MODO REAL ================= */}
      <AnimatePresence>
        {showLoginModal && !isLiveMode && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-7 w-full max-w-sm shadow-2xl"
            >
              <div className="flex justify-between items-start mb-5">
                <div>
                  <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase tracking-widest block mb-0.5">Acceso Instalador</span>
                  <h3 className="font-display font-bold text-white text-sm uppercase tracking-tight">Iniciar Sesión</h3>
                  <p className="text-[10.5px] text-slate-400 mt-0.5">Carga tus datos reales de Supabase</p>
                </div>
                <button onClick={() => setShowLoginModal(false)} className="text-slate-500 hover:text-white p-1 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>


              <form onSubmit={handleLogin} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="tu@email.com"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Contraseña</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                </div>

                {loginError && (
                  <p className="text-[10px] text-red-400 font-semibold">{loginError}</p>
                )}

                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 mt-1"
                >
                  {loginLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check className="w-3.5 h-3.5" /><span>Acceder con datos reales</span></>
                  )}
                </button>
              </form>

              <p className="text-center text-[9.5px] text-slate-500 mt-4 font-mono">
                Sin sesión → modo demo con datos ficticios
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notificación inteligente estilo iOS/Mac */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`fixed z-[9999] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden ${
              isNativeDevice
                ? 'left-3 right-3 w-auto'
                : 'bottom-4 right-4 w-80'
            }`}
            style={isNativeDevice ? { bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' } : {}}
          >
            <div className="p-4 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-500' :
                notification.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
              }`}>
                {notification.type === 'success' ? <CheckCircle className="w-4.5 h-4.5" /> :
                 notification.type === 'error' ? <AlertTriangle className="w-4.5 h-4.5" /> : <Info className="w-4.5 h-4.5" />}
              </div>
              <div className="flex-grow space-y-0.5">
                <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Notificación</span>
                <p className="text-xs font-semibold text-slate-800 dark:text-white leading-normal">{notification.message}</p>
              </div>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-850 w-full">
              <div className="h-full bg-blue-600" style={{ width: `${notificationProgress}%` }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================= MODAL FUTURISTA DE ENTRADA DE VOZ IA ================= */}
      <AnimatePresence>
        {isVoiceModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="bg-slate-900/95 backdrop-blur-xl text-white border border-slate-800 rounded-[32px] p-6 sm:p-8 max-w-sm w-full text-center space-y-5 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full bg-blue-600/10 blur-[60px] pointer-events-none" />

              <button 
                onClick={cancelVoiceRecording}
                className="absolute top-5 right-5 text-slate-400 hover:text-white bg-slate-850/60 p-1.5 rounded-full cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 px-3 py-0.5 text-[8px] font-bold text-blue-450 uppercase tracking-widest font-mono">
                  🎙️ AI Speech OS v2.6
                </div>
                <h3 className="text-md font-display font-bold uppercase tracking-tight">Dictado de Presupuesto</h3>
                <p className="text-[10.5px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                  "Habla como lo harías por WhatsApp" — La IA estructurará el presupuesto.
                </p>
              </div>

              {/* Animación Central de Sonido */}
              <div className="flex flex-col items-center justify-center py-4 relative">
                {voiceStep === 'listening' || voiceStep === 'transcribing' ? (
                  <div className="relative z-10">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping scale-125 pointer-events-none" />
                    <button
                      onClick={stopVoiceRecording}
                      title="Parar y procesar"
                      className="w-20 h-20 bg-gradient-to-r from-red-600 to-pink-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.3)] cursor-pointer"
                    >
                      <Mic className="w-8 h-8 text-white animate-pulse" />
                    </button>
                  </div>
                ) : voiceStep === 'thinking' ? (
                  <div className="relative z-10 w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center shadow-lg border border-slate-700">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-850 border-t-blue-500 animate-spin" />
                    <Sparkles className="w-7 h-7 text-blue-400 animate-pulse" />
                  </div>
                ) : (
                  <button 
                    onClick={startVoiceRecording}
                    className="relative z-10 w-20 h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.3)] cursor-pointer transition-transform hover:scale-102"
                  >
                    <Mic className="w-8 h-8 text-white" />
                  </button>
                )}

                {/* Espectro Siri */}
                {(voiceStep === 'listening' || voiceStep === 'transcribing') && (
                  <div className="flex items-center justify-center gap-1 mt-8 h-10 w-full px-6">
                    {audioWaveHeights.map((h, i) => (
                      <div 
                        key={i} 
                        className="w-1 rounded-full bg-gradient-to-t from-blue-600 via-indigo-500 to-emerald-400 shadow-[0_0_5px_rgba(59,130,246,0.3)] transition-all duration-100"
                        style={{ height: `${h * 0.8}px` }}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Transcripción por palabras tipo ChatGPT */}
              <div className="bg-slate-950/90 p-4 rounded-2xl border border-slate-850 text-left min-h-[100px] flex flex-col justify-between relative overflow-hidden">
                <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest block font-mono">
                  Transcripción IA:
                </span>
                
                {voiceStep === 'idle' && (
                  <div className="py-2 space-y-2">
                    <p className="text-[10px] text-slate-500 italic">Pulsa el micrófono o escribe aquí abajo...</p>
                    <p className="text-[9.5px] text-slate-400 font-medium bg-slate-900 p-2 rounded-lg border border-slate-800">
                      💡 <strong>Ejemplo:</strong> "Instalar termo estanco de gas Vaillant y dos latiguillos de cobre."
                    </p>
                    <textarea
                      rows={2}
                      placeholder="O escribe la descripción del trabajo..."
                      value={desktopModalText}
                      onChange={e => setDesktopModalText(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-2 text-[10px] placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500 mt-1"
                    />
                    {desktopModalText.trim().length > 10 && (
                      <button
                        onClick={() => handleTextToAI(desktopModalText.trim())}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        Generar partidas con IA →
                      </button>
                    )}
                  </div>
                )}

                {(voiceStep === 'listening' || voiceStep === 'transcribing') && (
                  <div className="text-[11px] text-slate-200 leading-relaxed font-sans italic py-1 min-h-[45px] relative">
                    {voiceText || "Escuchando voz..."}
                    <span className="inline-block w-1.5 h-3 bg-blue-450 animate-pulse ml-0.5" />
                  </div>
                )}

                {voiceStep === 'thinking' && (
                  <div className="space-y-1.5 py-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full border border-t-blue-500 animate-spin" />
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider font-mono animate-pulse">La IA prepara el presupuesto por ti...</span>
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      "{voiceText}"
                    </p>
                  </div>
                )}

                {voiceStep === 'done' && (
                  <div className="py-1 text-[10px] text-emerald-450 font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span>¡Sin escribir, sin perder tiempo! Creado.</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  {isLiveMode
                    ? <span className="text-emerald-400 font-bold">IA en directo</span>
                    : <span className="text-amber-400 font-bold">Modo demo</span>
                  }
                </span>
                {(voiceStep === 'listening' || voiceStep === 'transcribing') && (
                  <button
                    onClick={stopVoiceRecording}
                    className="bg-blue-600/20 hover:bg-blue-600 text-blue-450 hover:text-white border border-blue-500/20 px-3.5 py-1 rounded-full font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                  >
                    {isLiveMode ? 'Parar y procesar' : 'Procesar'}
                  </button>
                )}
                {voiceStep === 'listening' && isLiveMode && mediaRecorderRef.current && (
                  <span className="text-emerald-400 font-bold text-[9px] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                    Grabando
                  </span>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= ONBOARDING WIZARD — solo propietarios nuevos ================= */}
      {showOnboarding && rol === 'owner' && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          showToast={showToast}
        />
      )}

      {/* ================= MODAL UPGRADE PLAN ================= */}
      {showUpgradeModal && orgId && (
        <PlanUpgradeModal
          orgId={orgId}
          subscription={subscription}
          platformInvoices={platformInvoices}
          onClose={() => setShowUpgradeModal(false)}
          onUpgraded={() => {
            setShowUpgradeModal(false);
            showToast('¡Plan actualizado correctamente!', 'success');
            loadOrgSubscription(orgId).then(sub => { if (sub) setSubscription(sub); }).catch(() => {});
          }}
        />
      )}

      {/* ================= MODAL SOPORTE ================= */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowSupportModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">Contactar Soporte</h3>
              <button onClick={() => setShowSupportModal(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Asunto</label>
              <select
                value={supportAsunto}
                onChange={e => setSupportAsunto(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none"
              >
                {['Consulta general', 'Error en la aplicación', 'Problema con facturación', 'Cómo usar una función', 'Solicitar nueva función', 'Otro'].map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Descripción</label>
              <textarea
                rows={4}
                placeholder="Describe tu consulta o problema..."
                value={supportMsg}
                onChange={e => setSupportMsg(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowSupportModal(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">Cancelar</button>
              <button
                disabled={supportSending || !supportMsg.trim()}
                onClick={async () => {
                  if (!supportMsg.trim()) return;
                  setSupportSending(true);
                  try {
                    await submitContactMessage({
                      nombre: empresaAjustes.nombre || 'Usuario App',
                      telefono: empresaAjustes.telefonoMovil || '',
                      email: empresaAjustes.email || '',
                      motivo: `[SOPORTE] ${supportAsunto}`,
                      mensaje: supportMsg,
                    });
                    sendTrabflowEmail({
                      type: 'support_admin',
                      nombre: empresaAjustes.nombre,
                      email: empresaAjustes.email,
                      telefono: empresaAjustes.telefonoMovil,
                      oficio: supportAsunto,
                      ciudad: supportMsg,
                    });
                    showToast('Mensaje enviado al soporte ✓', 'success');
                    setShowSupportModal(false);
                    setSupportMsg('');
                    setSupportAsunto('Consulta general');
                  } catch {
                    showToast('Error al enviar. Escríbenos a info@trabflow.com', 'error');
                  }
                  setSupportSending(false);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50"
              >
                {supportSending ? 'Enviando...' : 'Enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ENVIAR EMAIL CLIENTE ================= */}
      {emailModalCliente && (
        <SendEmailModal
          cliente={emailModalCliente}
          empresa={{
            nombre: empresaAjustes.nombre,
            nif: empresaAjustes.nif,
            email: empresaAjustes.email,
            telefono: empresaAjustes.telefonoMovil,
          }}
          orgTemplates={orgTemplates}
          onClose={() => setEmailModalCliente(null)}
          onSent={() => showToast('Email enviado ✓', 'success')}
        />
      )}

      {/* ================= MODAL NUEVO CLIENTE ================= */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">Nuevo Cliente</h3>
              <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            {([['nombre','Nombre *','text','Juan García Instalaciones'],['telefono','Teléfono','tel','600 000 000'],['email','Email','email','cliente@email.com'],['direccion','Dirección','text','Calle Mayor 1, Madrid']] as const).map(([field, label, type, ph]) => (
              <div key={field}>
                <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">{label}</label>
                <input type={type} placeholder={ph} value={(newClient as any)[field] ?? ''} onChange={(e) => setNewClient(prev => ({ ...prev, [field]: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                  autoFocus={field === 'nombre'}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 cursor-pointer hover:border-slate-400">Cancelar</button>
              <button onClick={handleAddClient} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white cursor-pointer">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL VISITA / TRABAJO (GLOBAL — desktop + native) ================= */}
      {showVisitaModal && !isMobileMode && !isNativeDevice && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowVisitaModal(false)}>
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl p-6 space-y-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Anotar visita / llamada</h3>
              <p className="text-xs text-slate-400 mt-0.5">Se crea como trabajo pendiente en la agenda</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">¿Qué hay que ir a ver? *</label>
                <input
                  autoFocus
                  type="text"
                  value={visitaDraft.titulo}
                  onChange={e => setVisitaDraft(d => ({ ...d, titulo: e.target.value }))}
                  placeholder="Ej: Ver fuga de agua en baño de Conchy"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Fecha de visita</label>
                <input
                  type="date"
                  value={visitaDraft.fecha}
                  onChange={e => setVisitaDraft(d => ({ ...d, fecha: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                />
                {(() => {
                  const carga = jobs.filter(j => j.fecha_inicio === visitaDraft.fecha && j.estado !== 'cancelado').length;
                  if (carga === 0) return <p className="text-[10px] mt-1 text-emerald-600 font-medium">✓ Día libre — sin trabajos programados</p>;
                  if (carga <= 2) return <p className="text-[10px] mt-1 text-amber-500 font-medium">⚠ {carga} trabajo{carga > 1 ? 's' : ''} ya programado{carga > 1 ? 's' : ''} ese día</p>;
                  return <p className="text-[10px] mt-1 text-red-500 font-medium">✗ Día muy cargado ({carga} trabajos) — considera otra fecha</p>;
                })()}
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Cliente</label>
                <select
                  value={visitaDraft.client_id ?? ''}
                  onChange={e => setVisitaDraft(d => ({ ...d, client_id: e.target.value || null }))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                >
                  <option value="">— Sin cliente —</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVisitaModal(false)}
                className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-bold cursor-pointer hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!visitaDraft.titulo.trim()) { showToast('Describe qué hay que ir a ver', 'error'); return; }
                  if (!orgId) return;
                  try {
                    const saved = await createJob(orgId, {
                      titulo: visitaDraft.titulo.trim(),
                      tipo: 'visita',
                      estado: 'planificado',
                      prioridad: 'normal',
                      client_id: visitaDraft.client_id || null,
                      fecha_inicio: visitaDraft.fecha,
                    } as Parameters<typeof createJob>[1]);
                    if (trabajadores.length === 1) {
                      await assignWorkerToJob(saved.id, trabajadores[0].id, 'responsable', saved.titulo).catch(() => {});
                      (saved as any).trade_job_workers = [{ worker_id: trabajadores[0].id, rol: 'responsable', trade_workers: { nombre: trabajadores[0].nombre, rol: trabajadores[0].rol } }];
                    }
                    setJobs(prev => [...prev, saved]);
                    setShowVisitaModal(false);
                    showToast('Visita anotada ✓', 'success');
                  } catch {
                    showToast('Error al crear la visita', 'error');
                  }
                }}
                className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-bold py-3 rounded-xl text-sm cursor-pointer"
              >
                Anotar visita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL SIMULACIÓN ENVÍO DE WHATSAPP ================= */}
      <AnimatePresence>
        {showWhatsAppModal && targetQuoteForWhatsApp && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm overflow-hidden flex flex-col shadow-2xl"
            >
              {/* WhatsApp Mockup Header */}
              <div className="bg-[#075e54] text-white p-4 flex items-center gap-3 select-none">
                <div className="w-9 h-9 bg-teal-800 text-white rounded-full flex items-center justify-center font-bold font-mono">
                  {targetQuoteForWhatsApp.nombreCliente.charAt(0)}
                </div>
                <div>
                  <h4 className="font-bold text-xs">{targetQuoteForWhatsApp.nombreCliente}</h4>
                  <span className="text-[9px] opacity-80 block">En línea (TrabFlow WhatsApp Engine)</span>
                </div>
              </div>

              <div className="p-4 bg-[#ece5dd] text-slate-800 min-h-[180px] flex flex-col justify-between">
                
                {whatsAppStep === 'confirm' && (
                  <div className="space-y-4">
                    <div className="bg-white p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs max-w-[90%] self-start relative">
                      <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase mb-1.5">Vista previa del mensaje:</span>
                      <pre className="whitespace-pre-wrap font-sans text-[10px] text-slate-700 leading-relaxed">{buildQuoteMessage(targetQuoteForWhatsApp)}</pre>
                    </div>

                    {!targetQuoteForWhatsApp.telefonoCliente && (
                      <p className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 text-center">
                        Sin teléfono guardado — podrás elegir el contacto en WhatsApp
                      </p>
                    )}

                    <button
                      onClick={handleSendWhatsAppNow}
                      className="w-full bg-[#25d366] hover:bg-[#128c7e] text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center block cursor-pointer shadow-sm"
                    >
                      Abrir WhatsApp y Enviar 💬
                    </button>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ================= MODAL: AÑADIR PRODUCTO AL CATÁLOGO ================= */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4" onClick={() => setShowAddProductModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Nuevo producto</h3>
              <button onClick={() => setShowAddProductModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Descripción *</label>
              <input
                type="text"
                value={addProductDraft.descripcion}
                onChange={e => setAddProductDraft(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Pintura plástica interior blanca 15L"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Familia *</label>
                <input
                  type="text"
                  list="familias-list-root"
                  value={addProductDraft.familia}
                  onChange={e => setAddProductDraft(p => ({ ...p, familia: e.target.value }))}
                  placeholder="Ej: Pinturas"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
                <datalist id="familias-list-root">
                  {[...new Set(tarifas.map(t => t.familia))].sort().map(f => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Unidad</label>
                <select
                  value={addProductDraft.unidad}
                  onChange={e => setAddProductDraft(p => ({ ...p, unidad: e.target.value }))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 bg-white"
                >
                  {['ud', 'm', 'm²', 'm³', 'ml', 'kg', 'l', 'h', 'día', 'paq', 'jgo', 'par'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Precio (€)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={addProductDraft.precio}
                  onChange={e => setAddProductDraft(p => ({ ...p, precio: e.target.value }))}
                  placeholder="0.00"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Código (opcional)</label>
                <input
                  type="text"
                  value={addProductDraft.codigo}
                  onChange={e => setAddProductDraft(p => ({ ...p, codigo: e.target.value }))}
                  placeholder="Ej: PIN-001"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowAddProductModal(false)}
                className="flex-1 px-4 py-2.5 text-[11px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveNewProduct}
                disabled={savingAddProduct}
                className="flex-1 px-4 py-2.5 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl cursor-pointer transition-colors"
              >
                {savingAddProduct ? 'Guardando…' : 'Guardar producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CHATBOT WIDGET ================= */}
      {isLiveMode && (
        <ChatbotWidget
          context={{
            oficio: orgData?.oficio ?? '',
            plan: subscription?.plan ?? orgData?.plan ?? '',
            currentScreen: isNativeDevice ? mobileTab : activeTab,
            orgId: orgId ?? undefined,
          }}
          onNavigate={(page) => {
            if (isNativeDevice) {
              const mobilePageMap: Record<string, typeof mobileTab> = {
                presupuestos: 'presupuestos',
                facturas: 'facturas',
                clientes: 'clientes',
                ajustes: 'ajustes',
                mantenimientos: 'mantenimiento',
                planificacion: 'trabajos',
                catalogo: 'catalogo',
              };
              const t = mobilePageMap[page];
              if (t) setMobileTab(t);
            } else {
              const desktopPageMap: Record<string, string> = {
                presupuestos: 'quotes',
                facturas: 'invoices',
                clientes: 'crm',
                ajustes: 'settings',
                mantenimientos: 'mantenimiento',
                planificacion: 'planificacion',
                catalogo: 'catalogo',
              };
              const t = desktopPageMap[page];
              if (t) setActiveTab(t);
            }
          }}
        />
      )}

    </div>
  );

  // ================= RENDERIZADO MÓVIL REFACTORIZADO Y MEJORADO =================
  function AppContentMobile() {
    // En dispositivo nativo (PWA/móvil) nunca mostrar el modo demo — siempre login
    if (isNativeDevice && !isLiveMode) {
      return (
        <div
          className="fixed inset-0 bg-[#0B0F14] flex flex-col items-center justify-center p-8 gap-8"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/40">
            <img src="/tradeflow.png" alt="TF" className="h-9 w-auto" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-xl font-bold text-white">TrabFlow AI</h2>
            <p className="text-sm text-slate-400">Inicia sesión para continuar</p>
          </div>
          <div className="w-full max-w-xs space-y-3">
            <button
              onClick={() => { setIsSessionClosed(false); setShowLoginModal(true); }}
              className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-sm cursor-pointer active:opacity-80 transition-opacity"
              style={{ boxShadow: '0 0 30px rgba(37,99,235,0.4)' }}
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      );
    }

    // Si el Wizard paso a paso está activo
    if (wizardActive) {
      return MobileWizardView();
    }

    return (
      <div
        className={`flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none ${
          isNativeDevice ? 'fixed inset-0 overflow-hidden' : 'h-full'
        }`}
      >
        {/* ── APP HEADER ── */}
        <div
          className="bg-white border-b border-gray-100 flex items-center justify-between shrink-0 px-4"
          style={{ paddingTop: isNativeDevice ? 'calc(env(safe-area-inset-top, 0px) + 12px)' : '12px', paddingBottom: '12px' }}
        >
          <button
            onClick={() => setMobileTab('ajustes')}
            className="w-9 h-9 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="text-center">
            <div className="font-black text-lg tracking-tight text-gray-900 leading-none">
              TRAB<span className="text-blue-600">FLOW</span>
            </div>
            <div className="text-[10px] text-gray-400 font-medium mt-0.5 leading-none">
              {isTecnico ? (workerProfile?.nombre ?? 'Técnico') : (empresaAjustes.nombre || 'Instalaciones')}
            </div>
          </div>

          <div className="flex items-center gap-1">
            {isLiveMode && (
              <button
                onClick={handleLogout}
                className="w-9 h-9 flex items-center justify-center rounded-full text-gray-400 active:bg-gray-100 cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
            <button className="relative w-9 h-9 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100 cursor-pointer">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido dinámico según Pestaña Móvil */}
        <div
          className={`flex-grow overscroll-contain ${(mobileTab === 'trabajos' || mobileTab === 'ruta') ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={{
            padding: (mobileTab === 'trabajos' || mobileTab === 'ruta') ? '0' : (isNativeDevice ? '20px 16px 0' : '20px 16px'),
            paddingBottom: (mobileTab === 'trabajos' || mobileTab === 'ruta') ? '0' : (isNativeDevice
              ? 'calc(88px + env(safe-area-inset-bottom, 0px) + 8px)'
              : '88px'),
          }}
        >
          {mobileTab === 'inicio' && !isTecnico && MobileScreenInicio()}
          {mobileTab === 'presupuestos' && MobileScreenPresupuestos()}
          {mobileTab === 'clientes' && MobileScreenClientes()}
          {mobileTab === 'facturas' && MobileScreenFacturas()}
          {mobileTab === 'ajustes' && ScreenSettings()}
          {mobileTab === 'asistente' && (
            <ScreenAsistenteTecnico
              orgId={orgId ?? null}
              plan={subscription?.plan ?? orgData?.plan ?? 'basico'}
              session={session ?? null}
              showToast={showToast}
            />
          )}
          {mobileTab === 'catalogo' && (
            <MobileCatalogScreen
              tarifas={tarifas}
              isLiveMode={isLiveMode}
              onUpdatePrice={async (id, price) => {
                if (isLiveMode) await updateTarifaPrice(id, price);
                setTarifas(prev => prev.map(t => t.id === id ? { ...t, precioBase: price } : t));
              }}
              showToast={showToast}
            />
          )}
          {mobileTab === 'ruta' && orgId && (
            <ScreenRutaDia
              jobs={jobs.filter(j => {
                const hoy = new Date().toISOString().slice(0, 10);
                const isToday = j.fecha_inicio === hoy || !j.fecha_inicio;
                if (workerProfile) return isToday && j.trade_job_workers?.some(jw => jw.worker_id === workerProfile.id);
                return isToday;
              })}
              orgId={orgId}
              startLocation={
                orgBaseGeo ??
                (orgData?.direccion
                  ? `${orgData.direccion}${(orgData as unknown as Record<string, unknown>).ciudad ? `, ${(orgData as unknown as Record<string, unknown>).ciudad}` : ''}`.trim()
                  : 'Oficina')
              }
              horaInicio="08:00"
              onUpdateJob={async (id, updates) => {
                await updateJob(id, updates);
                setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
              }}
              showToast={showToast}
              onClose={() => setMobileTab('trabajos')}
            />
          )}
          {mobileTab === 'trabajos' && (
            <ScreenPlanificacion
              jobs={rol === 'tecnico' && workerProfile
                ? jobs.filter(j => j.trade_job_workers?.some(jw => jw.worker_id === workerProfile.id))
                : jobs}
              workers={trabajadores}
              clientes={clientes.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }))}
              orgId={orgId}
              isLiveMode={isLiveMode}
              isDarkMode={isDarkMode}
              onCreateJob={async (job) => {
                if (!orgId) throw new Error('Sin organizacion');
                const saved = await createJob(orgId, job);
                setJobs(prev => prev.some(j => j.id === saved.id) ? prev : [...prev, saved]);
                return saved;
              }}
              onUpdateJob={async (id, updates) => {
                await updateJob(id, updates);
                setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
              }}
              onDeleteJob={async (id) => {
                await deleteJob(id);
                setJobs(prev => prev.filter(j => j.id !== id));
              }}
              onAssignWorker={async (jobId, workerId, rol) => {
                const titulo = jobs.find(j => j.id === jobId)?.titulo;
                await assignWorkerToJob(jobId, workerId, rol as 'responsable' | 'asignado' | 'apoyo', titulo);
                await loadJobs(orgId!).then(setJobs);
              }}
              onRemoveWorker={async (jobId, workerId) => {
                await removeWorkerFromJob(jobId, workerId);
                await loadJobs(orgId!).then(setJobs);
              }}
              onOpenParte={async (job) => {
                setParteJob(job);
                setParteMantenimiento(null);
                setParteJobInvoices([]);

                const [mantenimientoInfo, jobInvoices] = await Promise.all([
                  (isLiveMode && orgId && job.client_id)
                    ? checkClientMaintenanceContract(orgId, job.client_id).catch(() => null)
                    : Promise.resolve(null),
                  isLiveMode
                    ? loadInvoicesByJobId(job.id).catch(() => [] as import('../lib/supabase').TradeInvoice[])
                    : Promise.resolve([] as import('../lib/supabase').TradeInvoice[]),
                ]);

                setParteMantenimiento(mantenimientoInfo);
                setParteJobInvoices(jobInvoices);

                const isCompleted = job.estado === 'completado';
                const hasInvoice = jobInvoices.length > 0;
                const isMant = mantenimientoInfo?.activo ?? false;

                if (!isCompleted) {
                  setParteMode('edit');
                } else if (hasInvoice) {
                  setParteMode('supplement');
                } else if (isMant) {
                  setParteMode('view');
                } else {
                  setParteMode('view');
                }
              }}
              onCreatePresupuesto={(job) => {
                const cliente = clientes.find(c => c.id === job.client_id);
                const nombreCliente = job.trade_clients?.nombre ?? cliente?.nombre ?? '';
                const telefonoCliente = job.trade_clients?.telefono ?? cliente?.telefono ?? '';
                const emailCliente = cliente?.email ?? '';
                setPendingPresupuestoJobId(job.id);
                setEditingQuote({
                  id: 'P-NEW',
                  nombreCliente,
                  telefonoCliente,
                  emailCliente,
                  descripcion: job.titulo,
                  fecha: new Date().toISOString().split('T')[0],
                  estado: 'Borrador',
                  partidas: [],
                  total: 0,
                });
                setWizardStep(1);
                setWizardActive(true);
              }}
              presupuestosPorId={Object.fromEntries(presupuestos.map(p => [p.id, { id: p.id, descripcion: p.descripcion, total: p.total, estado: p.estado, fecha: p.fecha }]))}
              showToast={showToast}
              triggerNew={newJobTrigger}
              prefillJobFromQuote={prefillJobFromQuote ? { id: prefillJobFromQuote.id, dbId: prefillJobFromQuote.dbId, nombreCliente: prefillJobFromQuote.nombreCliente, descripcion: prefillJobFromQuote.descripcion, total: prefillJobFromQuote.total ?? 0, client_id: prefillJobFromQuote.clientId ?? null } : null}
              onPrefillConsumed={() => setPrefillJobFromQuote(null)}
            />
          )}
          {mobileTab === 'mantenimiento' && orgId && (
            <ScreenMantenimiento
              key={mantenimientoReloadKey}
              orgId={orgId}
              showToast={showToast}
              initialText={mantenimientoInitialText}
              onInitialTextConsumed={() => setMantenimientoInitialText('')}
            />
          )}
          {mobileTab === 'contratos' && orgId && orgData && (
            <ScreenContratos
              orgId={orgId}
              orgData={orgData}
              clientes={clientes.map(c => ({ id: c.id, nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, email: c.email }))}
              oficio={orgData.oficio}
              plan={subscription?.plan ?? orgData?.plan ?? 'basico'}
            />
          )}
          {mobileTab === 'valoraciones' && orgId && (
            <ScreenValoraciones showToast={showToast} />
          )}
        </div>

        {/* BOTTOM TAB BAR */}
        <div className="absolute bottom-0 left-0 right-0 z-30">
          <div
            className="bg-white border-t border-gray-100 flex items-stretch select-none shadow-[0_-1px_8px_rgba(0,0,0,0.06)]"
            style={{
              paddingBottom: isNativeDevice ? 'env(safe-area-inset-bottom, 0px)' : '0px',
              minHeight: isNativeDevice ? 'calc(60px + env(safe-area-inset-bottom, 0px))' : '60px',
            }}
          >
            {isTecnico ? (
              <>
                {MobileTabButton({ tab: 'trabajos', icon: <Briefcase className="w-5 h-5" />, label: 'Trabajos' })}
                {MobileTabButton({ tab: 'ruta',     icon: <Navigation className="w-5 h-5" />, label: 'Mi Ruta' })}
                {MobileTabButton({ tab: 'asistente',icon: <BookOpen   className="w-5 h-5" />, label: 'Normativa' })}
              </>
            ) : (
              <>
                {MobileTabButton({ tab: 'inicio',       icon: <Home     className="w-5 h-5" />, label: 'Inicio' })}
                {MobileTabButton({ tab: 'presupuestos', icon: <FileText className="w-5 h-5" />, label: 'Presupuestos' })}
                {MobileTabButton({ tab: 'facturas',     icon: <Receipt  className="w-5 h-5" />, label: 'Facturas' })}
                {MobileTabButton({ tab: 'trabajos',     icon: <Briefcase className="w-5 h-5" />, label: 'Trabajos' })}
                {MobileTabButton({ tab: 'clientes',     icon: <Users    className="w-5 h-5" />, label: 'Clientes' })}
              </>
            )}
          </div>
        </div>


        {/* Presupuesto con Foto overlay */}
        {showPresupuestoFoto && (
          <ScreenPresupuestoFoto
            isLiveMode={isLiveMode}
            showToast={showToast}
            onClose={() => setShowPresupuestoFoto(false)}
            onConfirm={(q) => {
              setShowPresupuestoFoto(false);
              setWizardQuote({
                id: '',
                nombreCliente: '',
                telefonoCliente: '',
                emailCliente: '',
                descripcion: q.descripcion,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'Borrador',
                partidas: q.partidas.map(p => {
                  const match = catalogProducts.length > 0 ? matchProductForAI(p.descripcion, catalogProducts) : null;
                  const pu = match ? match.variant.precio_venta * (1 + empresaAjustes.margenMateriales / 100) : 0;
                  return {
                    descripcion: match ? `${match.product.nombre_generico} (${match.variant.marca})` : p.descripcion,
                    tipo: p.tipo,
                    cantidad: p.cantidad,
                    precioUnitario: pu,
                    total: pu * p.cantidad,
                  };
                }),
                total: 0,
              });
              setWizardOrigin('foto');
              setWizardStep(4);
              setWizardActive(true);
            }}
          />
        )}

        {/* Presupuesto por Pasos overlay */}
        {showPresupuestoIncremental && (
          <ScreenPresupuestoIncremental
            showToast={showToast}
            orgId={orgId ?? undefined}
            onClose={() => setShowPresupuestoIncremental(false)}
            onConfirm={(q) => {
              setShowPresupuestoIncremental(false);
              const partidasMobile = q.partidas.map(p => {
                if (p.supplier_key && p.precioUnitario > 0) {
                  return { descripcion: p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precioUnitario: p.precioUnitario, total: p.precioUnitario * p.cantidad, supplier_key: p.supplier_key, supplier_name: p.supplier_name, supplier_ref: p.supplier_ref };
                }
                const match = catalogProducts.length > 0 ? matchProductForAI(p.descripcion, catalogProducts) : null;
                const pu = match ? match.variant.precio_venta * (1 + empresaAjustes.margenMateriales / 100) : p.precioUnitario;
                return { descripcion: match ? `${match.product.nombre_generico} (${match.variant.marca})` : p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precioUnitario: pu, total: pu * p.cantidad };
              });
              setWizardQuote({
                id: '',
                nombreCliente: '',
                telefonoCliente: '',
                emailCliente: '',
                descripcion: q.descripcion,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'Borrador',
                partidas: partidasMobile,
                total: partidasMobile.reduce((s, p) => s + p.total, 0),
              });
              setWizardOrigin('voz');
              setWizardStep(4);
              setWizardActive(true);
            }}
          />
        )}

        {/* Post-confirm actions overlay (mobile) */}
        {postConfirmQuote && (
          <ScreenPostConfirm
            quote={postConfirmQuote}
            onClose={() => { setPostConfirmQuote(null); setMobileTab('presupuestos'); }}
            onWhatsApp={() => {
              setTargetQuoteForWhatsApp(postConfirmQuote);
              setWhatsAppStep('confirm');
              setShowWhatsAppModal(true);
              setPostConfirmQuote(null);
            }}
            onCobrar={() => {
              handleQuickConvertInvoice(postConfirmQuote);
              setPostConfirmQuote(null);
              setMobileTab('facturas');
            }}
            onCrearTrabajo={() => {
              setPrefillJobFromQuote(postConfirmQuote);
              setPostConfirmQuote(null);
              setMobileTab('trabajos');
              setNewJobTrigger(t => t + 1);
            }}
            onPedirMaterial={async () => {
              if (postConfirmQuote.dbId) {
                const { data } = await supabase
                  .from('trade_quotes')
                  .select('*, trade_quote_items(*)')
                  .eq('id', postConfirmQuote.dbId)
                  .single();
                if (data) {
                  const quote = data as TradeQuote;
                  const pendientes = (quote.trade_quote_items ?? []).filter(
                    i => i.tipo === 'material' && !i.material_order_placed,
                  );
                  if (pendientes.length > 0) setPedirMaterialQuote(quote);
                  else showToast('Todo el material de este presupuesto ya fue pedido', 'info');
                }
              }
              setPostConfirmQuote(null);
            }}
            onVerPresupuesto={() => {
              const q = postConfirmQuote;
              setPostConfirmQuote(null);
              setWizardQuote(q);
              setWizardStep(5);
              setWizardViewOnly(true);
              setWizardActive(true);
            }}
            onEditar={() => {
              const q = postConfirmQuote!;
              setPostConfirmQuote(null);
              setEditingQuoteId(q.dbId ?? q.id);
              setEditingQuote({ ...q });
              setWizardQuote(q);
              setWizardStep(4);
              setWizardViewOnly(false);
              setWizardActive(true);
            }}
          />
        )}

        {/* Pedir material overlay (mobile) */}
        {pedirMaterialQuote && orgId && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-white">
            <ScreenPedidosMaterial
              orgId={orgId}
              showToast={showToast}
              initialQuote={pedirMaterialQuote}
              onClose={() => setPedirMaterialQuote(null)}
              orgData={orgData}
            />
          </div>
        )}

        {/* Mantenimiento Wizard overlay (mobile) */}
        {showMantenimientoWizard && (
          <ScreenMantenimientoWizard
            showToast={showToast}
            orgId={orgId ?? ''}
            onClose={() => setShowMantenimientoWizard(false)}
            onConfirm={() => {
              setShowMantenimientoWizard(false);
              setMobileTab('mantenimiento');
              setMantenimientoReloadKey(k => k + 1);
            }}
          />
        )}

        {/* Modal Visita Rápida */}
        {showVisitaModal && (
          <div className="absolute inset-0 bg-black/70 z-50 flex items-end justify-center" onClick={() => setShowVisitaModal(false)}>
            <div
              className="w-full bg-white dark:bg-slate-900 rounded-t-[28px] p-5 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Anotar visita / llamada</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Se crea como trabajo pendiente de programar</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">¿Qué hay que ir a ver? *</label>
                  <input
                    autoFocus
                    type="text"
                    value={visitaDraft.titulo}
                    onChange={e => setVisitaDraft(d => ({ ...d, titulo: e.target.value }))}
                    placeholder="Ej: Ver fuga de agua en baño de Conchy"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Fecha de visita</label>
                  <input
                    type="date"
                    value={visitaDraft.fecha}
                    onChange={e => setVisitaDraft(d => ({ ...d, fecha: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  />
                  {(() => {
                    const cargaDia = jobs.filter(j => j.fecha_inicio === visitaDraft.fecha && j.estado !== 'cancelado').length;
                    if (cargaDia === 0) return (
                      <p className="text-[10px] mt-1 text-emerald-500 font-medium">✓ Día libre — sin trabajos programados</p>
                    );
                    if (cargaDia <= 2) return (
                      <p className="text-[10px] mt-1 text-amber-400 font-medium">⚠ {cargaDia} trabajo{cargaDia > 1 ? 's' : ''} ya programado{cargaDia > 1 ? 's' : ''} ese día</p>
                    );
                    return (
                      <p className="text-[10px] mt-1 text-red-400 font-medium">✗ Día muy cargado ({cargaDia} trabajos) — considera otra fecha</p>
                    );
                  })()}
                </div>
                <div>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">Cliente</label>
                  <select
                    value={visitaDraft.client_id ?? ''}
                    onChange={e => setVisitaDraft(d => ({ ...d, client_id: e.target.value || null }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="">— Sin cliente —</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (!visitaDraft.titulo.trim()) { showToast('Describe qué hay que ir a ver', 'error'); return; }
                  if (!orgId) return;
                  try {
                    const saved = await createJob(orgId, {
                      titulo: visitaDraft.titulo.trim(),
                      tipo: 'visita',
                      estado: 'planificado',
                      prioridad: 'normal',
                      client_id: visitaDraft.client_id || null,
                      fecha_inicio: visitaDraft.fecha,
                    } as Parameters<typeof createJob>[1]);
                    if (trabajadores.length === 1) {
                      await assignWorkerToJob(saved.id, trabajadores[0].id, 'responsable', saved.titulo).catch(() => {});
                      (saved as any).trade_job_workers = [{ worker_id: trabajadores[0].id, rol: 'responsable', trade_workers: { nombre: trabajadores[0].nombre, rol: trabajadores[0].rol } }];
                    }
                    setJobs(prev => [...prev, saved]);
                    setShowVisitaModal(false);
                    setMobileTab('trabajos');
                    showToast('Visita anotada', 'success');
                  } catch {
                    showToast('Error al crear la visita', 'error');
                  }
                }}
                className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-3.5 rounded-2xl text-sm cursor-pointer"
              >
                Anotar visita
              </button>
            </div>
          </div>
        )}

        {/* Parte de Trabajo overlay */}
        {parteJob && (() => {
          const clienteCompleto = clientes.find(c => c.id === parteJob.client_id);
          return (
            <ScreenParteTrabajo
              key={parteJob.id}
              job={parteJob}
              orgId={orgId ?? ''}
              tarifas={tarifas}
              isLiveMode={isLiveMode}
              mode={parteMode}
              mantenimiento={parteMantenimiento}
              existingInvoices={parteJobInvoices}
              clienteInfo={clienteCompleto ? {
                nombre: clienteCompleto.nombre,
                telefono: clienteCompleto.telefono,
                email: clienteCompleto.email,
              } : undefined}
              onComplete={async (jobId, notas, _materiales, horaFin) => {
                const now = new Date().toISOString();
                await updateJob(jobId, {
                  estado: 'completado',
                  notas_cierre: notas,
                  completado_at: now,
                  hora_fin: horaFin,
                });
                setJobs(prev => prev.map(j =>
                  j.id === jobId
                    ? { ...j, estado: 'completado', notas_cierre: notas, completado_at: now, hora_fin: horaFin }
                    : j,
                ));
              }}
              onInvoiceCreated={(inv) => setParteJobInvoices(prev => [...prev, inv])}
              onClose={() => { setParteJob(null); setParteMantenimiento(null); setParteJobInvoices([]); }}
              showToast={showToast}
            />
          );
        })()}

      </div>
    );

    // Helpers botones navegación móvil
    function MobileTabButton({ tab, icon, label }: { tab: 'inicio' | 'trabajos' | 'presupuestos' | 'catalogo' | 'clientes' | 'ruta' | 'asistente' | 'facturas'; icon: React.ReactNode; label: string }) {
      const isActive = mobileTab === tab;
      return (
        <button
          onClick={() => { setMobileTab(tab as typeof mobileTab); setShowFloatingMenu(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 cursor-pointer transition-all active:scale-95 relative"
        >
          {isActive && (
            <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
          )}
          <span className={`transition-colors ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{icon}</span>
          <span className={`text-[10px] font-semibold transition-colors leading-tight ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>{label}</span>
        </button>
      );
    }
  }

  // ================= MÓVIL: INICIO SCREEN =================
  function MobileScreenInicio() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour < 12 ? 'Buenos días' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';
    const shortName = empresaAjustes.nombre.split(' ')[0] || 'Instalador';
    const todayISO = now.toISOString().split('T')[0];
    const todayJobs = jobs.filter(j => j.fecha_inicio === todayISO && j.estado !== 'cancelado');
    const aceptados = presupuestos.filter(p => p.estado === 'Aceptado');

    return (
      <div className="pb-6">

        {/* Greeting */}
        <div className="pb-5">
          <h2 className="text-2xl font-black text-gray-900 leading-tight">{greeting}, {shortName}</h2>
          <p className="text-sm text-gray-400 mt-1">¿Qué quieres hacer hoy?</p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-black text-gray-900 leading-none">{todayJobs.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">hoy</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-black text-emerald-600 leading-none">{aceptados.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">aceptados</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-xl font-black text-blue-600 leading-none">{presupuestos.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">presup.</p>
          </div>
        </div>

        {/* Shortcuts 2×3 */}
        <div className="grid grid-cols-2 gap-3">

          {/* Crear presupuesto */}
          <button
            onClick={() => startWizard(2)}
            className="border-2 border-blue-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Mic className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Crear presupuesto</p>
              <p className="text-xs text-gray-400 mt-0.5">Voz o por pasos</p>
            </div>
          </button>

          {/* Trabajos de hoy */}
          <button
            onClick={() => setMobileTab('trabajos')}
            className="border-2 border-emerald-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Trabajos de hoy</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {todayJobs.length > 0 ? `${todayJobs.length} pendiente${todayJobs.length !== 1 ? 's' : ''}` : 'Agenda del día'}
              </p>
            </div>
          </button>

          {/* Clientes */}
          <button
            onClick={() => setMobileTab('clientes')}
            className="border-2 border-violet-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Clientes</p>
              <p className="text-xs text-gray-400 mt-0.5">Ver y gestionar</p>
            </div>
          </button>

          {/* Catálogo */}
          <button
            onClick={() => setMobileTab('catalogo')}
            className="border-2 border-amber-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Catálogo</p>
              <p className="text-xs text-gray-400 mt-0.5">Material y precios</p>
            </div>
          </button>

          {/* Normativa */}
          <button
            onClick={() => setMobileTab('asistente')}
            className="border-2 border-teal-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Normativa</p>
              <p className="text-xs text-gray-400 mt-0.5">REBT · RITE · GAS</p>
            </div>
          </button>

          {/* Contratos */}
          <button
            onClick={() => setMobileTab('contratos')}
            className="border-2 border-indigo-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Contratos</p>
              <p className="text-xs text-gray-400 mt-0.5">Mantenimiento activo</p>
            </div>
          </button>

          {/* Valoraciones */}
          <button
            onClick={() => setMobileTab('valoraciones')}
            className="border-2 border-rose-200 rounded-2xl p-4 flex flex-col gap-3 bg-white active:scale-95 transition-transform text-left"
          >
            <div className="w-10 h-10 bg-rose-50 rounded-xl flex items-center justify-center">
              <Star className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">Valoraciones</p>
              <p className="text-xs text-gray-400 mt-0.5">Opiniones de clientes</p>
            </div>
          </button>

        </div>
      </div>
    );
  }

  // ================= MÓVIL: PRESUPUESTOS LIST SCREEN =================
  function MobileScreenPresupuestos() {
    const now = new Date();
    const filtered = presupuestos.filter(p => {
      const matchClient = !presupuestoClientFilter || p.nombreCliente?.toLowerCase().includes(presupuestoClientFilter.toLowerCase());
      if (!matchClient) return false;
      if (presupuestoFilter === 'month') {
        const d = new Date(p.fecha ?? '');
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }
      return true;
    });

    return (
      <div className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-gray-900 leading-none">{presupuestos.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">total</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-emerald-600 leading-none">{presupuestos.filter(p => p.estado === 'Aceptado').length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">aceptados</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-blue-600 leading-none">{presupuestos.filter(p => p.estado === 'Enviado').length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">enviados</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por cliente..."
              value={presupuestoClientFilter}
              onChange={e => setPresupuestoClientFilter(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-8 pr-3 py-2 text-[11px] text-gray-800 focus:outline-none focus:border-blue-300"
            />
          </div>
          <button
            onClick={() => setPresupuestoFilter(f => f === 'month' ? 'all' : 'month')}
            className={`px-3 py-2 rounded-2xl text-[10px] font-bold uppercase border cursor-pointer shrink-0 ${presupuestoFilter === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {presupuestoFilter === 'month' ? 'Este mes' : 'Todos'}
          </button>
        </div>

        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono block">{filtered.length} presupuesto{filtered.length !== 1 ? 's' : ''}</span>

        {filtered.map(p => {
          const borderColor =
            p.estado === 'Facturado' ? 'border-l-indigo-400' :
            p.estado === 'Aceptado'  ? 'border-l-emerald-400' :
            p.estado === 'Enviado'   ? 'border-l-blue-400' :
                                       'border-l-gray-300';
          const badgeClass =
            p.estado === 'Facturado' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' :
            p.estado === 'Aceptado'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            p.estado === 'Enviado'   ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                       'bg-gray-50 text-gray-500 border-gray-200';
          return (
            <div
              key={p.id}
              data-testid="quote-row"
              onClick={() => setPostConfirmQuote(p)}
              className={`bg-white border border-gray-100 border-l-4 ${borderColor} p-4 rounded-2xl space-y-3 cursor-pointer active:scale-[0.99] transition-transform shadow-sm`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm text-gray-900 truncate leading-tight">{p.nombreCliente || 'Sin cliente'}</span>
                    {p.kbActuaciones && p.kbActuaciones.length > 0 && (
                      <span
                        title={`Generado con IA voz — ${p.kbActuaciones.length} actuación${p.kbActuaciones.length > 1 ? 'es' : ''} de la Base Maestra: ${p.kbActuaciones.join(', ')}`}
                        className="shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-violet-100 border border-violet-200 text-violet-600 leading-none cursor-help"
                      >
                        IA voz
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 block truncate mt-0.5">{p.descripcion}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 ${badgeClass}`}>
                  {p.estado}
                </span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wide block">Total c/IVA</span>
                  <span className="text-lg font-black font-mono text-gray-900">{(p.total * 1.21).toFixed(0)}€</span>
                </div>
                <span className="text-xs text-gray-400">{p.fecha}</span>
              </div>

              {/* Botones envío rápido */}
              {p.estado !== 'Borrador' && (
                <div className="grid grid-cols-3 gap-1.5 pt-1" onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://wa.me/${(p.telefonoCliente ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${p.nombreCliente ?? ''}, adjunto tu presupuesto TradeFlow:\n${p.descripcion ?? ''}\nTotal: ${(p.total * 1.21).toFixed(0)}€`)}`}
                    target="_blank" rel="noreferrer"
                    className="flex flex-col items-center gap-0.5 bg-emerald-50 border border-emerald-200 rounded-xl py-2 text-emerald-600 active:bg-emerald-100 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold">WhatsApp</span>
                  </a>
                  <a
                    href={`mailto:${p.emailCliente ?? ''}?subject=Presupuesto ${p.id}&body=${encodeURIComponent(`Hola ${p.nombreCliente ?? ''},\n\nAdjunto tu presupuesto.\n\nTotal: ${(p.total * 1.21).toFixed(0)}€\n\nGracias.`)}`}
                    className="flex flex-col items-center gap-0.5 bg-blue-50 border border-blue-200 rounded-xl py-2 text-blue-600 active:bg-blue-100 cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span className="text-[9px] font-bold">Email</span>
                  </a>
                  {p.estado !== 'Aceptado' && p.estado !== 'Facturado' && (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const qt = await createQuoteToken(orgId ?? '', p.id, p.nombreCliente ?? null, { total: p.total, descripcion: p.descripcion });
                          const url = `${window.location.origin}/presupuesto/${qt.token}`;
                          await navigator.clipboard.writeText(url);
                          showToast('Enlace copiado al portapapeles', 'success');
                        } catch {
                          showToast('Error al generar enlace', 'error');
                        }
                      }}
                      className="flex flex-col items-center gap-0.5 bg-gray-50 border border-gray-200 rounded-xl py-2 text-gray-500 active:bg-gray-100 cursor-pointer"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-bold">Enlace</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-[11px]">
            {presupuestoFilter === 'month' ? 'No hay presupuestos este mes' : 'No hay presupuestos'}
          </div>
        )}
      </div>
    );
  }

  // ================= MÓVIL: CLIENTES CRM SCREEN =================
  function MobileScreenClientes() {
    const selectedCliente = mobileClienteId ? clientes.find(c => c.id === mobileClienteId) : null;

    const avatarColors = [
      'bg-blue-100 text-blue-700',
      'bg-violet-100 text-violet-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-teal-100 text-teal-700',
      'bg-indigo-100 text-indigo-700',
      'bg-orange-100 text-orange-700',
    ];
    const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];

    // ── DETALLE DE CLIENTE ────────────────────────────────────────────────────
    if (selectedCliente) {
      const clientQuotes = presupuestos
        .filter(p => p.nombreCliente === selectedCliente.nombre)
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      const clientJobs = jobs.filter(j => j.client_id === selectedCliente.id);
      const totalFacturado = clientQuotes
        .filter(q => q.estado === 'Facturado')
        .reduce((s, q) => s + q.total * 1.21, 0);

      const estadoBadge = (estado: string) => {
        const map: Record<string, string> = {
          Facturado: 'bg-indigo-50 text-indigo-600 border-indigo-200',
          Aceptado:  'bg-emerald-50 text-emerald-700 border-emerald-200',
          Enviado:   'bg-blue-50 text-blue-600 border-blue-200',
          Borrador:  'bg-gray-50 text-gray-500 border-gray-200',
        };
        return `text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${map[estado] ?? map.Borrador}`;
      };

      const initial = selectedCliente.nombre.charAt(0).toUpperCase();
      const avatarColor = getAvatarColor(selectedCliente.nombre);

      return (
        <div className="space-y-4">
          {/* Back button */}
          <button
            onClick={() => setMobileClienteId(null)}
            className="flex items-center gap-1.5 text-blue-600 text-sm font-bold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Clientes
          </button>

          {/* Client header card */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
            {/* Avatar + name */}
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${avatarColor}`}>
                <span className="text-2xl font-black">{initial}</span>
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-base text-gray-900 leading-tight">{selectedCliente.nombre}</h2>
                {selectedCliente.telefono && <p className="text-sm text-gray-500 mt-0.5 font-mono">{selectedCliente.telefono}</p>}
                {selectedCliente.email && <p className="text-xs text-gray-400 truncate mt-0.5">{selectedCliente.email}</p>}
                {selectedCliente.direccion && <p className="text-xs text-gray-400 truncate mt-0.5">📍 {selectedCliente.direccion}</p>}
              </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 rounded-xl p-2.5 text-center">
                <p className="text-sm font-black text-emerald-700 leading-none">{totalFacturado.toFixed(0)}€</p>
                <p className="text-[9px] text-emerald-600 mt-1">facturado</p>
              </div>
              <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                <p className="text-sm font-black text-blue-700 leading-none">{clientQuotes.length}</p>
                <p className="text-[9px] text-blue-600 mt-1">presupuestos</p>
              </div>
              <div className="bg-violet-50 rounded-xl p-2.5 text-center">
                <p className="text-sm font-black text-violet-700 leading-none">{clientJobs.length}</p>
                <p className="text-[9px] text-violet-600 mt-1">trabajos</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <a
                href={`tel:${selectedCliente.telefono}`}
                className="bg-gray-900 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[10px] uppercase"
              >
                <Phone className="w-3.5 h-3.5" /> Llamar
              </a>
              <a
                href={`https://wa.me/${(selectedCliente.telefono ?? '').replace(/\D/g, '')}`}
                target="_blank" rel="noreferrer"
                className="bg-emerald-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[10px] uppercase"
              >
                <MessageSquare className="w-3.5 h-3.5" /> WA
              </a>
              <button
                onClick={() => setEmailModalCliente(selectedCliente)}
                className="bg-blue-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1.5 text-[10px] uppercase cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </button>
            </div>
          </div>

          {/* Facturas */}
          {(() => {
            const invoices = crmClientInvoices[selectedCliente.id];
            if (invoices === undefined) return null;
            return (
              <div className="space-y-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono block">
                  Facturas ({invoices.length})
                </span>
                {invoices.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Sin facturas</div>
                ) : (
                  invoices.map((inv, idx) => (
                    <div key={idx} className="bg-white border border-gray-100 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${
                            inv.estado === 'Pagada'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            inv.estado === 'Vencida' ? 'bg-red-50 text-red-600 border-red-200' :
                                                       'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>{inv.estado}</span>
                          <span className="text-[9px] text-gray-400 font-mono">{inv.fecha}</span>
                        </div>
                        <span className="text-[11px] text-gray-800 font-bold block">{inv.numero}</span>
                        {inv.concepto && <span className="text-[10px] text-gray-400 block truncate">{inv.concepto}</span>}
                      </div>
                      <span className="text-sm font-mono font-bold text-gray-900 shrink-0">{inv.total.toFixed(0)}€</span>
                    </div>
                  ))
                )}
              </div>
            );
          })()}

          {/* Presupuestos */}
          <div className="space-y-2">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono block">
              Presupuestos ({clientQuotes.length})
            </span>
            {clientQuotes.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">Sin presupuestos</div>
            ) : (
              clientQuotes.map(q => {
                const isFacturado = q.estado === 'Facturado';
                const borderColor =
                  q.estado === 'Facturado' ? 'border-l-indigo-400' :
                  q.estado === 'Aceptado'  ? 'border-l-emerald-400' :
                  q.estado === 'Enviado'   ? 'border-l-blue-400' :
                                             'border-l-gray-300';
                return (
                  <div
                    key={q.id}
                    onClick={!isFacturado ? () => { setWizardQuote(q); setWizardStep(5); setWizardActive(true); } : undefined}
                    className={`bg-white border border-gray-100 border-l-4 ${borderColor} rounded-2xl p-3 flex items-center justify-between gap-2 shadow-sm ${isFacturado ? 'opacity-60' : 'cursor-pointer active:scale-[0.98] transition-transform'}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={estadoBadge(q.estado)}>{q.estado}</span>
                        <span className="text-[9px] text-gray-400 font-mono">{q.fecha}</span>
                      </div>
                      <span className="text-[11px] text-gray-700 font-medium block truncate">
                        {q.descripcion || 'Sin descripción'}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-gray-900 block">{(q.total * 1.21).toFixed(0)}€</span>
                      {!isFacturado && <span className="text-[8px] text-blue-600 font-bold uppercase">Ver →</span>}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    // ── LISTA DE CLIENTES ─────────────────────────────────────────────────────
    return (
      <div className="space-y-3">
        {/* Buscador + botón nuevo cliente */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Nombre, teléfono, dirección..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:border-blue-300"
            />
          </div>
          <button
            onClick={() => { setNewClient({ nombre: '', telefono: '', email: '', direccion: '' }); setIsClientModalOpen(true); }}
            className="bg-blue-600 text-white rounded-2xl px-3.5 py-2.5 flex items-center justify-center cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono block">
          {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}
        </span>

        <div className="space-y-2.5">
          {filteredClientes.map(c => {
            const nQuotes = presupuestos.filter(p => p.nombreCliente === c.nombre).length;
            const hasFacturado = presupuestos.some(p => p.nombreCliente === c.nombre && p.estado === 'Facturado');
            const pendingClientJobs = jobs.filter(j => j.client_id === c.id && j.estado !== 'completado' && j.estado !== 'cancelado');
            const hasVisitaPendiente = pendingClientJobs.some(j => j.tipo === 'visita');
            const initial = c.nombre.charAt(0).toUpperCase();
            const avatarColor = getAvatarColor(c.nombre);
            return (
              <div
                key={c.id}
                onClick={() => {
                  setMobileClienteId(c.id);
                  if (!crmClientInvoices[c.id] && isLiveMode && orgId) {
                    supabase
                      .from('trade_invoices')
                      .select('numero, fecha, total, estado, concepto')
                      .eq('org_id', orgId)
                      .eq('client_id', c.id)
                      .order('fecha', { ascending: false })
                      .limit(20)
                      .then(({ data }) => setCrmClientInvoices(prev => ({ ...prev, [c.id]: data ?? [] })));
                  }
                }}
                className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform shadow-sm"
              >
                {/* Avatar */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${avatarColor}`}>
                  <span className="text-base font-black">{initial}</span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-sm text-gray-900 block truncate">{c.nombre}</span>
                  {c.telefono && (
                    <span className="text-[11px] text-gray-400 font-mono block">{c.telefono}</span>
                  )}
                  {c.direccion && !c.telefono && (
                    <span className="text-[11px] text-gray-400 block truncate">📍 {c.direccion}</span>
                  )}
                  {pendingClientJobs.length > 0 && (
                    <span className={`text-[10px] font-bold mt-0.5 block ${hasVisitaPendiente ? 'text-amber-600' : 'text-blue-600'}`}>
                      {hasVisitaPendiente ? '👁 Visita pendiente' : `🔧 ${pendingClientJobs.length} trabajo${pendingClientJobs.length > 1 ? 's' : ''}`}
                    </span>
                  )}
                  {c.totalFacturado > 0 && pendingClientJobs.length === 0 && (
                    <span className="text-[10px] font-mono text-emerald-600 font-bold mt-0.5 block">{c.totalFacturado.toFixed(0)}€ facturados</span>
                  )}
                </div>

                {/* Right */}
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  {nQuotes > 0 && (
                    <span className="text-[9px] font-mono text-gray-400">{nQuotes} pres.</span>
                  )}
                  {hasFacturado && (
                    <span className="text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-1.5 py-0.5 font-bold uppercase">Fact.</span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </div>
            );
          })}
          {filteredClientes.length === 0 && (
            <div className="text-center py-10 text-gray-400 text-xs">No hay clientes que coincidan</div>
          )}
        </div>
      </div>
    );
  }

  // ================= MÓVIL: FACTURAS SCREEN =================
  function MobileScreenFacturas() {
    const now = new Date();
    const in15 = new Date(now); in15.setDate(now.getDate() + 15);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Exclude future maintenance invoices (months 2–12); they live in Mantenimientos
    const facturasFacturacion = facturas.filter(f => {
      if (!f.esMantenimineto) return true;
      if (f.estado === 'Vencida' || f.estado === 'Devuelta' || f.estado === 'Pagada') return true;
      if (f.estado === 'Pendiente' && f.fechaVencimiento) {
        const v = new Date(f.fechaVencimiento);
        return v >= currentMonthStart && v <= currentMonthEnd;
      }
      return false;
    });

    const proximas = facturasFacturacion
      .filter(f => f.estado === 'Pendiente' && f.fechaVencimiento)
      .filter(f => { const v = new Date(f.fechaVencimiento); return v >= now && v <= in15; })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    const devueltas = facturasFacturacion.filter(f => f.estado === 'Devuelta');

    const sorted = [...facturasFacturacion]
      .filter(f => {
        const matchClient = !facturaClientFilter || f.nombreCliente?.toLowerCase().includes(facturaClientFilter.toLowerCase());
        if (!matchClient) return false;
        if (facturaFilter === 'month') {
          const d = new Date(f.fecha ?? '');
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
        return true;
      })
      .sort((a, b) => {
        const order: Record<string, number> = { Vencida: 0, Pendiente: 1, Devuelta: 2, Pagada: 3 };
        return (order[a.estado] ?? 1) - (order[b.estado] ?? 1);
      });

    const pendiente = sorted.filter(f => f.estado === 'Pendiente' || f.estado === 'Vencida').reduce((s, f) => s + f.importe * 1.21, 0);
    const pagadas = sorted.filter(f => f.estado === 'Pagada');

    return (
      <div className="space-y-3">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-gray-900 leading-none">{sorted.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">total</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-amber-600 leading-none">{sorted.filter(f => f.estado === 'Pendiente' || f.estado === 'Vencida').length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">pendientes</p>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center shadow-sm">
            <p className="text-lg font-black text-emerald-600 leading-none">{pagadas.length}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">cobradas</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filtrar por cliente..."
              value={facturaClientFilter}
              onChange={e => setFacturaClientFilter(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-2xl pl-8 pr-3 py-2 text-[11px] text-gray-800 focus:outline-none focus:border-blue-300"
            />
          </div>
          <button
            onClick={() => setFacturaFilter(f => f === 'month' ? 'all' : 'month')}
            className={`px-3 py-2 rounded-2xl text-[10px] font-bold uppercase border cursor-pointer shrink-0 ${facturaFilter === 'month' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-500 border-gray-200'}`}
          >
            {facturaFilter === 'month' ? 'Este mes' : 'Todas'}
          </button>
        </div>

        {pendiente > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2.5 flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase text-amber-700">Pendiente de cobro:</span>
            <span className="font-mono font-bold text-amber-700 text-sm">{pendiente.toFixed(0)}€</span>
          </div>
        )}

        {/* Próximas a cobrar */}
        {proximas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="text-[10px] font-bold uppercase text-amber-700">Próximas — {proximas.length} en 15 días</span>
            </div>
            {proximas.map(f => (
              <div key={f.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-amber-100">
                <span className="font-mono text-[9px] font-bold text-gray-700 flex-1 truncate">{f.numeroFactura} · {f.nombreCliente}</span>
                <span className="text-[9px] text-amber-600 font-semibold shrink-0">
                  {Math.ceil((new Date(f.fechaVencimiento).getTime() - now.getTime()) / 86400000)}d
                </span>
                <span className="font-mono text-[9px] font-bold text-gray-900 shrink-0">{(f.importe * 1.21).toFixed(0)}€</span>
              </div>
            ))}
          </div>
        )}

        {/* Devueltas */}
        {devueltas.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl px-3 py-3 space-y-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-[10px] font-bold uppercase text-orange-700">Facturas devueltas — {devueltas.length}</span>
            </div>
            {devueltas.map(f => (
              <div key={f.id} className="flex items-center gap-2 bg-white rounded-xl px-3 py-1.5 border border-orange-100">
                <span className="font-mono text-[9px] font-bold text-gray-700 flex-1 truncate">{f.numeroFactura} · {f.nombreCliente}</span>
                <span className="font-mono text-[9px] font-bold text-orange-600 shrink-0">{(f.importe * 1.21).toFixed(0)}€</span>
                <button onClick={() => handleRemindInvoice(f)} className="text-[8px] px-1.5 py-1 bg-green-100 text-green-700 rounded font-bold cursor-pointer">💬</button>
              </div>
            ))}
          </div>
        )}

        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest font-mono block">{sorted.length} factura{sorted.length !== 1 ? 's' : ''}</span>

        {sorted.map(f => {
          const borderColor =
            f.estado === 'Vencida'   ? 'border-l-red-400' :
            f.estado === 'Pendiente' ? 'border-l-amber-400' :
            f.estado === 'Devuelta'  ? 'border-l-orange-400' :
                                       'border-l-emerald-400';
          const badgeClass =
            f.estado === 'Pagada'    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
            f.estado === 'Pendiente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
            f.estado === 'Devuelta'  ? 'bg-orange-50 text-orange-600 border-orange-200' :
                                       'bg-red-50 text-red-600 border-red-200';
          return (
            <div key={f.id} className={`bg-white border border-gray-100 border-l-4 ${borderColor} p-4 rounded-2xl space-y-3 shadow-sm`}>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-xs text-gray-900">{f.numeroFactura}</span>
                    <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${badgeClass}`}>
                      {f.estado}
                    </span>
                  </div>
                  <span className="font-semibold text-xs text-gray-700 block mt-1">{f.nombreCliente}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-mono text-gray-400 block uppercase">Total cobro:</span>
                  <span className="text-sm font-mono font-bold text-gray-900">{(f.importe * 1.21).toFixed(0)}€</span>
                </div>
              </div>

              <div className={`pt-2 border-t border-gray-100 ${f.estado !== 'Pagada' && f.estado !== 'Devuelta' ? 'grid grid-cols-3 gap-2' : 'flex justify-between items-center'}`}>
                {f.estado !== 'Pagada' && f.estado !== 'Devuelta' ? (
                  <>
                    <button
                      onClick={() => setPayMethodInvoiceId(f.id)}
                      className="bg-emerald-600 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[9.5px] uppercase cursor-pointer active:opacity-80"
                    >
                      💰 Cobrar
                    </button>
                    <button
                      onClick={() => handleRemindInvoice(f)}
                      className="bg-gray-100 text-gray-700 font-bold p-2.5 rounded-xl flex items-center justify-center text-[9.5px] uppercase cursor-pointer active:bg-gray-200"
                    >
                      💬 WA
                    </button>
                    <button
                      onClick={() => printInvoice(f)}
                      className="bg-gray-100 text-gray-700 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[9.5px] uppercase cursor-pointer active:bg-gray-200"
                    >
                      <FileText className="w-3.5 h-3.5" />PDF
                    </button>
                  </>
                ) : f.estado === 'Devuelta' ? (
                  <>
                    <span className="text-[9.5px] font-mono text-orange-500 uppercase flex items-center gap-1">↩ Devuelta</span>
                    <button
                      onClick={() => handleRemindInvoice(f)}
                      className="bg-gray-100 text-gray-600 font-bold p-2 rounded-xl text-[9px] uppercase cursor-pointer active:bg-gray-200"
                    >
                      💬 WA
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-[9.5px] font-mono text-gray-400 uppercase flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      Cobrada · {f.fecha}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleMarkDevuelta(f.id)}
                        className="bg-orange-100 text-orange-600 font-bold p-2 rounded-xl text-[9px] uppercase cursor-pointer active:bg-orange-200"
                      >
                        ↩ Dev
                      </button>
                      <button
                        onClick={() => handleRemindInvoice(f)}
                        className="bg-gray-100 text-gray-600 font-bold p-2 rounded-xl flex items-center gap-1 text-[9px] uppercase cursor-pointer active:bg-gray-200"
                      >
                        💬 WA
                      </button>
                      <button
                        onClick={() => printInvoice(f)}
                        className="bg-gray-100 text-gray-600 font-bold p-2 rounded-xl flex items-center gap-1 text-[9px] uppercase cursor-pointer active:bg-gray-200"
                      >
                        <FileText className="w-3 h-3" />PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-[11px]">
            {facturaFilter === 'month' ? 'No hay facturas este mes' : 'No hay facturas'}
          </div>
        )}

        {/* Bottom sheet: método de cobro */}
        {payMethodInvoiceId && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center" onClick={() => setPayMethodInvoiceId(null)}>
            <div className="bg-white rounded-t-3xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-sm uppercase tracking-wider text-gray-900 text-center">¿Cómo se ha cobrado?</h3>
              {(['Efectivo', 'Bizum', 'Transferencia'] as const).map(method => (
                <button
                  key={method}
                  onClick={() => {
                    handlePayInvoice(payMethodInvoiceId);
                    showToast(`Factura cobrada por ${method} ✓`, 'success');
                    setPayMethodInvoiceId(null);
                  }}
                  className="w-full py-4 bg-gray-50 active:bg-gray-100 border border-gray-200 rounded-2xl text-sm font-bold text-gray-800 cursor-pointer transition-colors"
                >
                  {method === 'Efectivo' ? '💵' : method === 'Bizum' ? '📱' : '🏦'} {method}
                </button>
              ))}
              <button onClick={() => setPayMethodInvoiceId(null)} className="w-full py-3 text-gray-400 text-sm cursor-pointer">Cancelar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= MÓVIL: WIZARD DE CREACIÓN EN 5 PASOS =================
  function MobileWizardView() {
    return (
      <div className="flex flex-col h-full bg-gray-50 text-gray-900 select-none relative">
        
        {/* Progreso del Wizard */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
              {wizardViewOnly ? 'Vista del Presupuesto' : `Paso ${wizardStep} de 5`}
            </span>
            <button
              onClick={() => {
                setWizardActive(false);
                setWizardViewOnly(false);
                if (wizardViewOnly) setPostConfirmQuote(wizardQuote as Presupuesto);
                else setMobileTab('inicio');
              }}
              className="text-gray-500 hover:text-gray-700 p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Barra indicadora de progreso */}
          <div className="h-1 bg-gray-200 rounded-full w-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300" 
              style={{ width: `${(wizardStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Cuerpo del Wizard */}
        <div className="flex-grow p-4 overflow-y-auto pb-24">
          
          {/* PASO 1: CLIENTE */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-display font-bold uppercase">Paso 1: Selecciona el Cliente</h3>
                <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">Elige un cliente existente de tu lista o regístralo rápidamente.</p>
              </div>

              {/* Lista rápida de un toque */}
              <div className="space-y-2">
                {clientes.map(c => {
                  const isSelected = wizardQuote.nombreCliente === c.nombre;
                  return (
                    <div 
                      key={c.id}
                      onClick={() => setWizardQuote(prev => ({ 
                        ...prev, 
                        nombreCliente: c.nombre, 
                        telefonoCliente: c.telefono,
                        emailCliente: c.email
                      }))}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between text-xs font-semibold ${
                        isSelected 
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold block truncate">{c.nombre}</span>
                        <span className="text-[10px] text-gray-400 block truncate font-mono">{c.direccion}</span>
                      </div>
                      {isSelected && <Check className="w-4.5 h-4.5 text-blue-600 shrink-0 ml-2" />}
                    </div>
                  );
                })}
              </div>

              {/* Crear cliente rápido */}
              <button
                onClick={() => {
                  setNewClient({ nombre: '', telefono: '', email: '', direccion: '' });
                  setIsClientModalOpen(true);
                }}
                className="w-full bg-gray-100 text-gray-700 font-bold p-3.5 rounded-2xl border border-gray-200 text-center uppercase tracking-wider text-[10px] cursor-pointer"
              >
                + Alta rápida de nuevo cliente
              </button>
            </div>
          )}

          {/* PASO 2: DESCRIPCIÓN POR VOZ (VOICE-FIRST) */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h3 className="text-sm font-display font-bold uppercase">Paso 2: Describe el Trabajo</h3>
                <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">"Habla como lo harías por WhatsApp" — La IA estructurará las partidas y materiales por ti.</p>
              </div>

              <div className="flex flex-col items-center py-4">
                {voiceStep === 'listening' || voiceStep === 'transcribing' ? (
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/25 rounded-full animate-ping scale-125" />
                    <button
                      onClick={stopVoiceRecording}
                      title="Parar y procesar"
                      className="w-20 h-20 bg-gradient-to-r from-red-650 to-pink-500 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <Mic className="w-8 h-8 text-white animate-pulse" />
                    </button>
                  </div>
                ) : voiceStep === 'thinking' ? (
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center shadow-md border border-gray-200">
                    <div className="absolute inset-0 rounded-full border-2 border-gray-200 border-t-blue-600 animate-spin" />
                    <Sparkles className="w-7 h-7 text-blue-600" />
                  </div>
                ) : (
                  <button 
                    onClick={startVoiceRecording}
                    className="w-20 h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-102"
                  >
                    <Mic className="w-8 h-8 text-white" />
                  </button>
                )}

                <span className="text-[9.5px] font-bold text-gray-400 uppercase tracking-widest mt-6 font-mono block">
                  {voiceStep === 'listening' ? 'Grabando audio...' : voiceStep === 'transcribing' ? 'Transcribiendo...' : voiceStep === 'thinking' ? 'IA Procesando...' : 'Pulsa para dictar obra'}
                </span>
              </div>

              {/* Visualizador de texto */}
              <div className="bg-white border border-gray-200 p-4 rounded-2xl min-h-[90px] text-xs">
                {voiceText ? (
                  <p className="italic text-gray-700 leading-normal">
                    "{voiceText}"
                  </p>
                ) : (
                  <div className="space-y-2 text-gray-400 italic font-sans leading-normal">
                    <p>💡 <strong>Ejemplo de dictado:</strong></p>
                    <p>"Instalación de termo de doce litros Vaillant estanco, tres horas de mano de obra a cuarenta y cinco euros y latiguillos por quince euros."</p>
                  </div>
                )}
              </div>

              {/* Caja de edición manual alternativa */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider font-mono">O escribe la descripción aquí:</span>
                <textarea
                  value={wizardQuote.descripcion}
                  onChange={(e) => setWizardQuote(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Ej: instalar piscina de obra 8x4 en jardín de chalet con depuradora y luces..."
                  className="w-full bg-white border border-gray-200 rounded-xl p-3 text-xs focus:outline-none"
                  rows={3}
                />
                {(wizardQuote.descripcion ?? '').trim().length > 10 && (
                  <button
                    onClick={() => handleTextToAI()}
                    disabled={voiceStep === 'thinking'}
                    className="w-full bg-blue-600 active:bg-blue-700 text-white font-bold py-3 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
                  >
                    {voiceStep === 'thinking' ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Procesando con IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Generar partidas con IA →
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* PASO 3: AÑADIR FOTOS */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-display font-bold uppercase">Paso 3: Añadir Fotografía</h3>
                  <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">Opcional — Toma foto de equipos viejos o averías para que la IA identifique recambios.</p>
                </div>
                <button
                  onClick={() => setWizardStep(4)}
                  className="shrink-0 text-[9.5px] font-bold uppercase text-gray-400 hover:text-blue-600 cursor-pointer transition-colors whitespace-nowrap pt-0.5"
                >
                  Saltar →
                </button>
              </div>

              {/* Inputs ocultos: galería (sin capture) y cámara (con capture) */}
              {(() => {
                const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setRealPhotoFile(file);
                    setRealPhotoPreviewUrl(URL.createObjectURL(file));
                    setSelectedPhotoPreset(null);
                  }
                  e.target.value = '';
                };
                return (
                  <>
                    <input ref={photoInputRef}   type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
                    <input ref={photoCameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileSelected} />
                  </>
                );
              })()}

              {/* Live mode: botones cámara + galería */}
              {isLiveMode && !realPhotoFile && (
                <div className="space-y-2">
                  <button
                    onClick={() => photoCameraRef.current?.click()}
                    className="w-full bg-white border-2 border-blue-200 hover:border-blue-400 rounded-2xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3"
                  >
                    <Camera className="w-6 h-6 text-blue-600 shrink-0" />
                    <div className="text-left">
                      <span className="text-xs font-bold text-gray-900 block">Tomar foto con cámara</span>
                      <span className="text-[10px] text-gray-400">Abre la cámara directamente</span>
                    </div>
                  </button>
                  <button
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full bg-white border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-2xl p-4 text-center cursor-pointer transition-colors flex items-center justify-center gap-3"
                  >
                    <ImageIcon className="w-6 h-6 text-gray-400 shrink-0" />
                    <div className="text-left">
                      <span className="text-xs font-bold text-gray-900 block">Subir desde galería</span>
                      <span className="text-[10px] text-gray-400">Elige una foto ya tomada</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Preview foto real + botón analizar */}
              {isLiveMode && realPhotoFile && realPhotoPreviewUrl && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-blue-600 aspect-video bg-gray-100">
                    <img src={realPhotoPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    {isScanning && (
                      <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] z-20"
                        style={{ top: `${scanProgress}%`, transition: 'top 200ms linear' }} />
                    )}
                    <button
                      onClick={() => { setRealPhotoFile(null); setRealPhotoPreviewUrl(null); }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer"
                    >
                      ✕ Cambiar
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-gray-400 font-mono truncate max-w-[60%]">{realPhotoFile.name}</span>
                    {!isScanning ? (
                      <button onClick={startPhotoAnalysis}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer">
                        Analizar con IA 📷
                      </button>
                    ) : (
                      <span className="text-emerald-400 font-bold font-mono text-[9px] animate-pulse">Analizando... {scanProgress}%</span>
                    )}
                  </div>
                </div>
              )}

              {/* Demo mode: preset selector */}
              {!isLiveMode && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {presetPhotos.map(p => (
                      <div key={p.id} onClick={() => handleSelectPresetPhoto(p)}
                        className={`p-2 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 bg-white ${selectedPhotoPreset?.id === p.id ? 'border-blue-600' : 'border-gray-200'}`}>
                        <img src={p.url} alt={p.name} className="w-full h-16 rounded-xl object-cover" />
                        <span className="font-bold text-[9.5px] text-gray-900 block text-center truncate w-full">{p.name}</span>
                      </div>
                    ))}
                  </div>
                  {selectedPhotoPreset ? (
                    <div className="space-y-3 pt-2">
                      <div className="relative rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 aspect-video flex items-center justify-center">
                        <img src={selectedPhotoPreset.url} alt="Scan preview" className="max-h-full max-w-full object-contain" />
                        {isScanning && (
                          <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] z-20"
                            style={{ top: `${scanProgress}%`, transition: 'top 100ms linear' }} />
                        )}
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-400 font-mono text-[9px]">{selectedPhotoPreset.name}</span>
                        {!isScanning ? (
                          <button onClick={startPhotoAnalysis}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer">
                            Analizar con IA 📷
                          </button>
                        ) : (
                          <span className="text-emerald-600 font-bold font-mono text-[9px] animate-pulse">Escaneando... {scanProgress}%</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-3">
                      <div className="w-10 h-10 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto border border-gray-200">
                        <Upload className="w-5 h-5 text-gray-400" />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-gray-900 block">Selecciona un preset de ejemplo</span>
                        <span className="text-[10px] text-gray-400 block mt-1 leading-normal">Modo demo — activa modo real para usar tu cámara.</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* PASO 4: REVISAR PARTIDAS IA */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-display font-bold uppercase">Paso 4: Revisa el Presupuesto</h3>
                <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">Añade o modifica cantidades y precios sugeridos de los componentes detectados.</p>
              </div>

              {/* Botón sugerencia precio */}
              {showPricingSuggestion && empresaAjustes.valorHoraOperario < TARIFA_SUGERIDA && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-[11px] flex justify-between items-center gap-2 text-left">
                  <div>
                    <span className="font-bold text-blue-600 block font-mono text-[8.5px] uppercase">Recomendación IA</span>
                    <p className="text-gray-600 mt-0.5 leading-normal">Tu zona: tarifa media {TARIFA_SUGERIDA}€/h. Ahora cobras {empresaAjustes.valorHoraOperario}€/h.</p>
                  </div>
                  <button
                    onClick={applySuggestedPricing}
                    className="bg-blue-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-[8.5px] uppercase shrink-0"
                  >
                    Aplicar
                  </button>
                </div>
              )}

              {/* Banner si se usó búsqueda web */}
              {aiLearningData && aiLearningData.nuevasPartidas.length > 0 && (
                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 text-[10px] text-emerald-700">
                  <span className="text-base leading-none">🌐</span>
                  <span><strong>{aiLearningData.nuevasPartidas.length} partida{aiLearningData.nuevasPartidas.length > 1 ? 's' : ''} nueva{aiLearningData.nuevasPartidas.length > 1 ? 's' : ''}</strong> encontrada{aiLearningData.nuevasPartidas.length > 1 ? 's' : ''} en internet y añadida{aiLearningData.nuevasPartidas.length > 1 ? 's' : ''} al presupuesto</span>
                </div>
              )}

              {/* Banner: guardar nueva actuación detectada */}
              {aiLearningData && aiLearningData.nuevosOficios.length > 0 && isLiveMode && (
                savedActuacion ? (
                  <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-[10px] text-blue-700">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-blue-500" />
                    <span><strong>Plantilla guardada</strong> — la próxima vez se detectará automáticamente</span>
                  </div>
                ) : (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl px-3 py-2.5 text-[10px]">
                    <div className="flex items-start gap-2 mb-2">
                      <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-500" />
                      <div>
                        <span className="font-bold text-violet-700 block">Trabajo nuevo detectado: <em>{aiLearningData.nuevosOficios[0].oficio}</em></span>
                        <span className="text-violet-600 leading-relaxed">¿Guardar estas partidas como plantilla para futuros presupuestos?</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveActuacion}
                        className="flex-1 bg-violet-600 active:bg-violet-700 text-white font-bold py-2 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer"
                      >
                        Guardar plantilla
                      </button>
                      <button
                        onClick={() => setSavedActuacion(true)}
                        className="px-3 bg-gray-100 text-gray-500 font-bold py-2 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer"
                      >
                        Ignorar
                      </button>
                    </div>
                  </div>
                )
              )}

              {/* Listado editable de partidas */}
              <div className="space-y-2">
                {wizardQuote.partidas?.map((part, idx) => {
                  const esDeInternet = aiLearningData?.nuevasPartidas.some(
                    np => np.concepto && part.descripcion && np.concepto.toLowerCase().trim() === part.descripcion.toLowerCase().trim()
                  ) ?? false;
                  const cardBg =
                    part.origen === 'sugerida_ia' ? 'bg-amber-50 border-amber-200' :
                    part.origen === 'proveedor' ? 'bg-blue-50 border-blue-200' :
                    esDeInternet ? 'bg-white border-emerald-200' :
                    'bg-white border-gray-200';

                  return (
                  <div
                    key={idx}
                    className={`border p-3 rounded-2xl space-y-2 text-xs ${cardBg}`}
                  >
                    {/* Descripción editable */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] shrink-0">{part.tipo === 'material' ? '📦' : '🛠️'}</span>
                      <input
                        type="text"
                        value={part.descripcion}
                        onChange={e => handleUpdateWizardItem(idx, { descripcion: e.target.value })}
                        className={`flex-1 border rounded-lg px-2.5 py-1.5 text-xs text-gray-900 focus:outline-none ${
                          part.origen === 'sugerida_ia' ? 'bg-amber-50 border-amber-200 focus:border-amber-400' :
                          part.origen === 'proveedor' ? 'bg-blue-50 border-blue-200 focus:border-blue-400' :
                          'bg-gray-50 border-gray-200 focus:border-blue-500'
                        }`}
                      />
                      {part.origen === 'sugerida_ia' && (
                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-1.5 py-0.5 leading-none whitespace-nowrap">
                          Nueva — pon precio
                        </span>
                      )}
                      {part.origen === 'proveedor' && part.supplier_name && (
                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 border border-blue-300 rounded-full px-1.5 py-0.5 leading-none whitespace-nowrap">
                          {part.supplier_name}
                        </span>
                      )}
                      {esDeInternet && part.origen !== 'sugerida_ia' && part.origen !== 'proveedor' && (
                        <span className="shrink-0 text-[8px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5 leading-none">
                          Web
                        </span>
                      )}
                      <button onClick={() => handleRemoveItem(idx)} className="text-gray-400 hover:text-red-500 p-1 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Aviso sin precio en catálogo */}
                    {part.requiere_precio && (
                      <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 text-[10px] text-amber-700">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Sin precio en catálogo — asigna el precio y se guardará automáticamente</span>
                      </div>
                    )}

                    {/* Controles cantidad / precio / total */}
                    <div className="flex items-center gap-2">
                      {part.tipo === 'mano_de_obra' ? (
                        <>
                          <div className="flex items-center bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => handleUpdateWizardItem(idx, { cantidad: Math.max(0.5, Math.round((part.cantidad - 0.5) * 2) / 2), precioUnitario: empresaAjustes.valorHoraOperario })}
                              className="w-7 h-8 flex items-center justify-center text-amber-600 font-bold text-base cursor-pointer hover:bg-amber-100 active:scale-90 transition-transform shrink-0"
                            >−</button>
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={part.cantidad}
                              onChange={e => handleUpdateWizardItem(idx, {
                                cantidad: parseFloat(e.target.value) || 1,
                                precioUnitario: empresaAjustes.valorHoraOperario,
                              })}
                              className="w-10 bg-transparent text-center text-xs font-bold text-amber-700 focus:outline-none"
                            />
                            <button
                              onClick={() => handleUpdateWizardItem(idx, { cantidad: Math.round((part.cantidad + 0.5) * 2) / 2, precioUnitario: empresaAjustes.valorHoraOperario })}
                              className="w-7 h-8 flex items-center justify-center text-amber-600 font-bold text-base cursor-pointer hover:bg-amber-100 active:scale-90 transition-transform shrink-0"
                            >+</button>
                          </div>
                          <span className="text-[9px] text-amber-600 font-mono whitespace-nowrap">h × {empresaAjustes.valorHoraOperario}€/h</span>
                          <span className="text-[9px] text-gray-400">o manual:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={part.precioUnitario || ''}
                            placeholder="€/h"
                            onChange={e => handleUpdateWizardItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                            onBlur={() => handleLearnPrice(idx)}
                            className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">Cant.</span>
                            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                              <button
                                onClick={() => handleUpdateWizardItem(idx, { cantidad: Math.max(1, (part.cantidad || 1) - 1) })}
                                className="w-7 h-8 flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-base cursor-pointer hover:bg-gray-200 active:scale-90 transition-transform shrink-0"
                              >−</button>
                              <input
                                type="number"
                                min="1"
                                step="1"
                                value={part.cantidad}
                                onChange={e => handleUpdateWizardItem(idx, { cantidad: Math.max(1, parseFloat(e.target.value) || 1) })}
                                className="w-9 bg-white text-center text-xs font-bold text-gray-900 focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdateWizardItem(idx, { cantidad: (part.cantidad || 1) + 1 })}
                                className="w-7 h-8 flex items-center justify-center bg-gray-100 text-gray-600 font-bold text-base cursor-pointer hover:bg-gray-200 active:scale-90 transition-transform shrink-0"
                              >+</button>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-gray-400 whitespace-nowrap">P/ud</span>
                            <input
                              type="number"
                              step="0.01"
                              value={part.precioUnitario || ''}
                              placeholder="0.00"
                              onChange={e => handleUpdateWizardItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                              onBlur={() => handleLearnPrice(idx)}
                              className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-right text-xs font-mono text-gray-900 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </>
                      )}
                      <span className="ml-auto font-bold font-mono text-gray-900 whitespace-nowrap">
                        {(part.total ?? 0).toFixed(2)}€
                      </span>
                    </div>

                    {/* Comparar precios de proveedores — solo materiales */}
                    {part.tipo === 'material' && orgId && (
                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleOpenCompare(idx, part.descripcion)}
                          className="flex items-center gap-1.5 text-blue-600 font-bold text-[9.5px] uppercase tracking-wider cursor-pointer hover:text-blue-700 active:opacity-70"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                          {compareIdx === idx ? 'Ocultar proveedores' : 'Ver precios proveedor'}
                        </button>

                        {compareIdx === idx && (
                          <div className="space-y-1.5 pt-1 border-t border-gray-100">
                            {compareLoading ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <div className="w-3 h-3 border border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                                <span>Buscando en catálogos...</span>
                              </div>
                            ) : compareResults.length === 0 ? (
                              <p className="text-[10px] text-gray-400 italic">Sin opciones en catálogos de proveedores</p>
                            ) : (
                              compareResults.map((opt, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    handleUpdateWizardItem(idx, {
                                      precioUnitario: opt.precio_venta,
                                      supplier_key: opt.catalog_key,
                                      supplier_name: opt.supplier_name,
                                      supplier_ref: opt.ref_proveedor ?? undefined,
                                      precioCoste: opt.precio_coste,
                                    });
                                    setCompareIdx(null);
                                    setCompareResults([]);
                                  }}
                                  className="w-full text-left bg-blue-50 active:bg-blue-100 border border-blue-200 rounded-xl px-3 py-2 text-[10px] cursor-pointer"
                                >
                                  <div className="flex justify-between items-center gap-2">
                                    <div className="min-w-0">
                                      <span className="font-bold text-blue-800 block truncate">{opt.supplier_name}</span>
                                      <span className="text-blue-600 block truncate">{opt.descripcion}</span>
                                    </div>
                                    <span className="font-black text-blue-900 whitespace-nowrap shrink-0">{opt.precio_venta.toFixed(2)}€/{opt.unidad}</span>
                                  </div>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
                })}
              </div>

              <button
                onClick={handleAddManualItem}
                className="w-full bg-gray-100 text-gray-700 font-bold p-3 rounded-xl border border-gray-200 text-[10px] uppercase tracking-wider text-center cursor-pointer"
              >
                + Añadir Partida Manual
              </button>
            </div>
          )}

          {/* PASO 5: PREVISUALIZADOR Y ENVÍO */}
          {wizardStep === 5 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-display font-bold uppercase">Paso 5: Resumen y Envío</h3>
                <p className="text-[10.5px] text-gray-400 leading-relaxed font-sans">"Revisa y envía" — Hemos preparado el borrador. Envíaselo por WhatsApp al cliente en un tap.</p>
              </div>

              {/* Ficha colapsada simplificada */}
              <div className="bg-white border border-gray-200 p-4 rounded-[24px] space-y-4 shadow-sm text-xs">

                {/* Cabecera */}
                <div className="flex justify-between items-start gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-gray-400 block uppercase">CLIENTE:</span>
                    <span className="font-bold text-sm text-gray-900 uppercase tracking-wide block">{wizardQuote.nombreCliente}</span>
                    <span className="text-[10.5px] text-gray-500 block truncate">{wizardQuote.descripcion}</span>
                  </div>
                  <span className="bg-amber-100 border border-amber-200 text-amber-700 font-bold px-2 py-0.5 rounded-full text-[8.5px] font-mono uppercase">
                    {wizardQuote.estado}
                  </span>
                </div>

                {/* Importe destacado */}
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider font-mono">Importe Final (IVA Incl.):</span>
                  <span className="text-lg font-bold font-mono text-blue-600">
                    {((wizardQuote.total || 0) * 1.21).toFixed(2)}€
                  </span>
                </div>

                {/* Partidas colapsables */}
                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <button
                    onClick={() => setItemsCollapsedMobile(!itemsCollapsedMobile)}
                    className="flex justify-between items-center w-full text-gray-500 font-bold text-[10px] uppercase font-mono tracking-wide"
                  >
                    <span>Detalle de partidas ({wizardQuote.partidas?.length || 0})</span>
                    {itemsCollapsedMobile ? <ChevronDown className="w-4.5 h-4.5" /> : <ChevronUp className="w-4.5 h-4.5" />}
                  </button>

                  {!itemsCollapsedMobile && (
                    <div className="space-y-1.5 pt-1.5 animate-fadeIn">
                      {wizardQuote.partidas?.map((part, idx) => (
                        <div key={idx} className="flex justify-between items-baseline text-[10.5px] text-gray-500">
                          <span className="truncate pr-2">✓ {part.descripcion} x{part.cantidad}</span>
                          <span className="font-mono font-semibold shrink-0">{(part.total ?? 0).toFixed(0)}€</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100 my-1" />

                {/* Badges de cumplimiento */}
                <div className="flex items-center gap-2 text-[9px] text-gray-400 leading-relaxed font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Presupuesto timbrado digitalmente</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* BOTÓN CTAs ADHERIDO EN BASE (STICKY BOTTOM) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shrink-0 z-30 select-none flex gap-2">
          {wizardViewOnly ? (
            <button
              onClick={() => { setWizardActive(false); setWizardViewOnly(false); setPostConfirmQuote(wizardQuote as Presupuesto); }}
              className="flex-grow bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[10px] cursor-pointer text-center"
            >
              ← Volver a acciones
            </button>
          ) : (
            <>
              {wizardStep > 1 && (
                <button
                  onClick={() => setWizardStep(prev => prev - 1)}
                  className="px-4 bg-gray-100 text-gray-700 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[10px] cursor-pointer"
                >
                  Atrás
                </button>
              )}
              <button
                onClick={handleNextWizardStep}
                className="flex-grow bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl text-[10px] uppercase tracking-wider text-center block cursor-pointer shadow-sm transition-transform active:scale-99"
              >
                {wizardStep === 5 ? 'Guardar y enviar 💬' : 'Siguiente ➔'}
              </button>
            </>
          )}
        </div>

        {/* Modal: asignar cliente al finalizar */}
        {showQuickClientModal && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/50">
            <div className="w-full bg-white rounded-t-3xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide">¿A quién va este presupuesto?</h3>
                <p className="text-[10.5px] text-gray-400 mt-0.5">Añade nombre y teléfono para enviarlo por WhatsApp.</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del cliente *"
                  value={quickClientName}
                  onChange={e => setQuickClientName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Teléfono (WhatsApp)"
                  value={quickClientPhone}
                  onChange={e => setQuickClientPhone(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email (opcional)"
                  value={quickClientEmail}
                  onChange={e => setQuickClientEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => finishWizardAndSave('Sin nombre', '')}
                  className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase text-gray-500 border border-gray-200 cursor-pointer"
                >
                  Saltar
                </button>
                <button
                  onClick={() => finishWizardAndSave(quickClientName || 'Sin nombre', quickClientPhone)}
                  className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase bg-blue-600 text-white cursor-pointer"
                >
                  Guardar y enviar 💬
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ================= RENDERIZADO ESCRITORIO CLÁSICO =================
  function AppContentDesktop() {
    return (
      <React.Fragment>
        {/* SIDEBAR NAVEGACIÓN */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-850 text-slate-300 shrink-0 select-none">
          <div className="p-5 border-b border-slate-850 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md shrink-0 ${isTecnico ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/10' : 'bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-blue-500/10'}`}>
              {isTecnico ? (workerProfile?.nombre?.[0] ?? 'T').toUpperCase() : (empresaAjustes.nombre?.[0] ?? orgData?.nombre?.[0] ?? 'T').toUpperCase()}
            </div>
            <div className="overflow-hidden">
              {isTecnico ? (
                <>
                  <span className="font-bold text-xs text-white block uppercase tracking-wide truncate">{workerProfile?.nombre ?? 'Técnico'}</span>
                  <span className="text-[10px] text-emerald-500 block font-mono truncate">Técnico · {empresaAjustes.nombre}</span>
                </>
              ) : (
                <>
                  <span className="font-bold text-xs text-white block uppercase tracking-wide truncate">{empresaAjustes.nombre}</span>
                  <span className="text-[10px] text-slate-500 block font-mono truncate">{empresaAjustes.nif}</span>
                </>
              )}
            </div>
          </div>

          {/* Enlaces sidebar */}
          <nav className="flex-grow p-4 space-y-1 overflow-y-auto min-h-0 scrollbar-hide">
            {!isTecnico && SidebarBtn({ id: 'dashboard', icon: <TrendingUp className="w-4 h-4" />, label: 'Panel Control' })}
            {can('quotes.create') && SidebarBtn({ id: 'quotes', icon: <FileText className="w-4 h-4" />, label: 'Presupuestos' })}
            {can('clients.manage') && SidebarBtn({ id: 'crm', icon: <Users className="w-4 h-4" />, label: 'Clientes CRM' })}
            {can('invoices.manage') && SidebarBtn({ id: 'invoices', icon: <Receipt className="w-4 h-4" />, label: 'Facturas' })}
            {can('catalog.manage') && SidebarBtn({ id: 'catalog', icon: <Package className="w-4 h-4" />, label: 'Catálogo' })}
            {can('jobs.view') && SidebarBtn({ id: 'planificacion', icon: <Calendar className="w-4 h-4" />, label: 'Planificación' })}
            {can('jobs.view') && SidebarBtn({ id: 'ruta_dia', icon: <Navigation className="w-4 h-4" />, label: 'Ruta del Día' })}
            {can('ingresos.view') && SidebarBtn({ id: 'ingresos', icon: <BarChart2 className="w-4 h-4" />, label: 'Ingresos/Gastos' })}
            {can('team.manage') && SidebarBtn({ id: 'equipo', icon: <Users className="w-4 h-4" />, label: 'Equipo' })}
            {can('mantenimiento.view') && (['empresa', 'empresa_plus'].includes(subscription?.plan ?? orgData?.plan ?? ctxPlan) || subscription?.status === 'trial') && SidebarBtn({ id: 'mantenimiento', icon: <Wrench className="w-4 h-4" />, label: 'Mantenimientos' })}
            {can('mantenimiento.view') && (['empresa', 'empresa_plus'].includes(subscription?.plan ?? orgData?.plan ?? ctxPlan) || subscription?.status === 'trial') && SidebarBtn({ id: 'contratos', icon: <FileText className="w-4 h-4" />, label: 'Contratos' })}
            {can('jobs.view') && orgId && SidebarBtn({ id: 'subcontratas', icon: <Layers className="w-4 h-4" />, label: 'Externalizados' })}
            {can('catalog.manage') && orgId && SidebarBtn({ id: 'suppliers', icon: <Truck className="w-4 h-4" />, label: 'Proveedores' })}
            {can('catalog.manage') && orgId && SidebarBtn({ id: 'pedidos_material', icon: <ShoppingCart className="w-4 h-4" />, label: 'Pedidos Material' })}
            {SidebarBtn({ id: 'asistente', icon: <BookOpen className="w-4 h-4" />, label: 'Asistente Técnico' })}
            {can('jobs.view') && SidebarBtn({ id: 'valoraciones', icon: <Star className="w-4 h-4" />, label: 'Valoraciones' })}
            {can('settings.manage') && SidebarBtn({ id: 'settings', icon: <SettingsIcon className="w-4 h-4" />, label: 'Ajustes y Tarifas' })}
          </nav>

          <div className="p-4 border-t border-slate-800 bg-slate-950/20 space-y-2">
            {isTecnico ? (
              <button
                data-testid="btn-logout"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-red-400 hover:text-red-300 border border-red-900/40 hover:border-red-500/50 rounded-lg py-1.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-3 h-3" />Cerrar sesión
              </button>
            ) : (() => {
              const sub = subscription;
              const effectivePlan = sub?.plan ?? orgData?.plan ?? null;
              const planNames: Record<string, string> = { basico: 'Básico', profesional: 'Profesional', empresa: 'Empresa', empresa_plus: 'Empresa+' };
              const planLabel = effectivePlan ? (planNames[effectivePlan] ?? effectivePlan) : null;
              const isTrialing = sub?.status === 'trial';
              const daysLeft = isTrialing && sub?.trial_end
                ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000))
                : null;
              const showUpgradeBtn = !sub || sub.status !== 'active' || (effectivePlan !== 'empresa' && effectivePlan !== 'empresa_plus');
              return (
                <>
                  <div className="flex items-center justify-between">
                    {planLabel && (
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        effectivePlan === 'empresa_plus' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                        effectivePlan === 'empresa'      ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30' :
                        effectivePlan === 'profesional'  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' :
                                                           'bg-slate-700 text-slate-400 border border-slate-600'
                      }`}>
                        {planLabel}
                      </span>
                    )}
                    {isTrialing && daysLeft !== null && (
                      <span className="text-[9px] text-amber-400 font-bold">{daysLeft}d trial</span>
                    )}
                    {sub?.status === 'active' && (
                      <span className="text-[9px] text-emerald-400 font-bold">Activo</span>
                    )}
                  </div>
                  {showUpgradeBtn && (
                    <button
                      data-testid="btn-upgrade"
                      onClick={() => setShowUpgradeModal(true)}
                      className="w-full text-[10px] font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-lg py-1.5 cursor-pointer transition-all"
                    >
                      Ver planes
                    </button>
                  )}
                  <button
                    onClick={() => setShowSupportModal(true)}
                    className="w-full text-[9px] font-bold uppercase tracking-wider text-slate-400 hover:text-blue-400 border border-slate-700 hover:border-blue-500 rounded-lg py-1.5 cursor-pointer transition-colors"
                  >
                    Soporte
                  </button>
                </>
              );
            })()}
          </div>
        </aside>


        {/* CUERPO CENTRAL DE LA CONSOLA DESKTOP */}
        <div className="flex-grow flex flex-col min-w-0 bg-slate-50">

          {/* Header de la sección */}
          <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest block">
                TrabFlow AI Operating System
              </span>
              <h2 className="text-md sm:text-lg font-black font-bold text-slate-900 uppercase tracking-tight">
                {activeTab === 'dashboard' && 'Panel de Control'}
                {activeTab === 'quotes' && 'Presupuestos'}
                {activeTab === 'create_quote' && 'Nuevo Presupuesto'}
                {activeTab === 'ai_scan' && 'Escáner Fotográfico IA'}
                {activeTab === 'crm' && 'Clientes CRM'}
                {activeTab === 'invoices' && 'Gestión de Facturas'}
                {activeTab === 'catalog' && 'Catálogo de Productos'}
                {activeTab === 'planificacion' && 'Planificación de Trabajos'}
                {activeTab === 'ruta_dia' && 'Ruta del Día'}
                {activeTab === 'ingresos' && 'Ingresos, Gastos y Rentabilidad'}
                {activeTab === 'facturas' && 'Gestión de Facturas'}
                {activeTab === 'equipo' && 'Equipo y Trabajadores'}
                {activeTab === 'mantenimiento' && 'Contratos de Mantenimiento'}
                {activeTab === 'subcontratas' && 'Trabajos Externalizados'}
                {activeTab === 'suppliers' && 'Catálogos de Proveedores'}
                {activeTab === 'pedidos_material' && 'Pedidos de Material'}
                {activeTab === 'asistente' && 'Asistente Técnico de Normativa'}
                {activeTab === 'valoraciones' && 'Valoraciones de Clientes'}
                {activeTab === 'settings' && 'Ajustes y Tarifas'}
                {activeTab === 'preview' && 'Ficha de Presupuesto'}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'dashboard' && (
                <button
                  onClick={() => setIsVoiceModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-750 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-101"
                >
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                  <span>Presupuesto por Voz</span>
                </button>
              )}
              {activeTab === 'quotes' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsVoiceModalOpen(true)}
                    className="flex items-center gap-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/30 text-blue-400 font-bold uppercase tracking-wider text-[10px] px-3 py-2.5 rounded-xl cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Voz IA</span>
                  </button>
                  <button
                    onClick={() => { setEditingQuoteId(null); setActiveTab('create_quote'); }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Nuevo Presupuesto</span>
                  </button>
                </div>
              )}
              {activeTab === 'create_quote' && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('quotes')}
                    className="text-slate-500 hover:text-slate-700 font-bold text-[10px] uppercase tracking-wider px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer"
                  >
                    ← Presupuestos
                  </button>
                  <button
                    onClick={saveCurrentQuote}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-101"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Guardar Presupuesto</span>
                  </button>
                </div>
              )}
              {activeTab === 'preview' && selectedQuoteForPreview && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setActiveTab('quotes')}
                    className="text-slate-500 hover:text-slate-700 font-bold text-[10px] uppercase tracking-wider px-3 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 cursor-pointer"
                  >
                    ← Presupuestos
                  </button>
                  {isLiveMode && selectedQuoteForPreview.dbId && (
                    <button
                      disabled={pedirMaterialLoading}
                      onClick={async () => {
                        setPedirMaterialLoading(true);
                        try {
                          const { data } = await supabase
                            .from('trade_quotes')
                            .select('*, trade_quote_items(*)')
                            .eq('id', selectedQuoteForPreview.dbId)
                            .single();
                          if (data) {
                            const quote = data as TradeQuote;
                            const pendientes = (quote.trade_quote_items ?? []).filter(
                              i => i.tipo === 'material' && !i.material_order_placed,
                            );
                            if (pendientes.length === 0) {
                              showToast('Todo el material de este presupuesto ya fue pedido', 'info');
                            } else {
                              setPedirMaterialQuote(quote);
                              setActiveTab('pedidos_material');
                            }
                          }
                        } finally {
                          setPedirMaterialLoading(false);
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingCart className={`w-3.5 h-3.5 ${pedirMaterialLoading ? 'animate-spin' : ''}`} />
                      <span>{pedirMaterialLoading ? 'Cargando...' : 'Pedir material'}</span>
                    </button>
                  )}
                  {selectedQuoteForPreview.estado !== 'Facturado' ? (
                    <button
                      onClick={() => convertQuoteToInvoice(selectedQuoteForPreview)}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-101"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Facturar Presupuesto</span>
                    </button>
                  ) : (
                    <span className="bg-indigo-100 text-indigo-700 font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Ya facturado
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Área de Pantallas - Con animación de transiciones fluidas */}
          <div className="flex-grow p-4 sm:p-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="h-full"
              >
                {activeTab === 'dashboard' && ScreenDashboard()}
                {activeTab === 'quotes' && ScreenPresupuestos()}
                {activeTab === 'create_quote' && ScreenCreateQuote()}
                {activeTab === 'ai_scan' && ScreenAIScan()}
                {activeTab === 'crm' && ScreenCRM()}
                {activeTab === 'invoices' && <ScreenFacturas showToast={showToast} isLiveMode={isLiveMode} />}
                {activeTab === 'catalog' && ScreenCatalog()}
                {activeTab === 'planificacion' && (
                  <ScreenPlanificacion
                    jobs={rol === 'tecnico' && workerProfile
                      ? jobs.filter(j => j.trade_job_workers?.some(jw => jw.worker_id === workerProfile.id))
                      : jobs}
                    workers={trabajadores}
                    clientes={clientes.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono }))}
                    orgId={orgId}
                    isLiveMode={isLiveMode}
                    isDarkMode={isDarkMode}
                    presupuestosAceptados={presupuestos
                      .filter(p => p.estado === 'Aceptado')
                      .map(p => ({ id: p.id, dbId: p.dbId, nombreCliente: p.nombreCliente, descripcion: p.descripcion, total: p.total ?? 0, client_id: p.clientId ?? null }))
                    }
                    onCreateJob={async (job) => {
                      if (!orgId) throw new Error('Sin organización');
                      const saved = await createJob(orgId, job);
                      setJobs(prev => prev.some(j => j.id === saved.id) ? prev : [...prev, saved]);
                      return saved;
                    }}
                    onUpdateJob={async (id, updates) => {
                      await updateJob(id, updates);
                      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
                    }}
                    onDeleteJob={async (id) => {
                      await deleteJob(id);
                      setJobs(prev => prev.filter(j => j.id !== id));
                    }}
                    onAssignWorker={async (jobId, workerId, rol) => {
                      const jobTitulo = jobs.find(j => j.id === jobId)?.titulo;
                      await assignWorkerToJob(jobId, workerId, rol as 'responsable' | 'asignado' | 'apoyo', jobTitulo);
                      await loadJobs(orgId!).then(setJobs);
                    }}
                    onRemoveWorker={async (jobId, workerId) => {
                      await removeWorkerFromJob(jobId, workerId);
                      await loadJobs(orgId!).then(setJobs);
                    }}
                    onViewRoute={() => setActiveTab('ruta_dia')}
                    showToast={showToast}
                    triggerNew={newJobTrigger}
                    prefillJobFromQuote={prefillJobFromQuote ? { id: prefillJobFromQuote.id, dbId: prefillJobFromQuote.dbId, nombreCliente: prefillJobFromQuote.nombreCliente, descripcion: prefillJobFromQuote.descripcion, total: prefillJobFromQuote.total ?? 0, client_id: prefillJobFromQuote.clientId ?? null } : null}
                    onPrefillConsumed={() => setPrefillJobFromQuote(null)}
                  />
                )}
                {activeTab === 'ruta_dia' && orgId && (
                  <ScreenRutaDia
                    jobs={jobs.filter(j => {
                      const hoy = new Date().toISOString().slice(0, 10);
                      const isToday = j.fecha_inicio === hoy || !j.fecha_inicio;
                      if (rol === 'tecnico' && workerProfile) {
                        return isToday && j.trade_job_workers?.some(jw => jw.worker_id === workerProfile.id);
                      }
                      return isToday;
                    })}
                    orgId={orgId}
                    startLocation={
                      orgBaseGeo ??
                      (orgData?.direccion
                        ? `${orgData.direccion}${(orgData as unknown as Record<string, unknown>).ciudad ? `, ${(orgData as unknown as Record<string, unknown>).ciudad}` : ''}`.trim()
                        : 'Oficina')
                    }
                    horaInicio="08:00"
                    onUpdateJob={async (id, updates) => {
                      await updateJob(id, updates);
                      setJobs(prev => prev.map(j => j.id === id ? { ...j, ...updates } : j));
                    }}
                    showToast={showToast}
                    onClose={() => setActiveTab('planificacion')}
                  />
                )}
                {activeTab === 'ingresos' && (
                  <ScreenIngresos showToast={showToast} />
                )}
                {activeTab === 'equipo' && (
                  <ScreenEquipo showToast={showToast} isLiveMode={isLiveMode} />
                )}
                {activeTab === 'mantenimiento' && orgId && (
                  <ScreenMantenimiento
                    key={mantenimientoReloadKey}
                    orgId={orgId}
                    showToast={showToast}
                    initialText={mantenimientoInitialText}
                    onInitialTextConsumed={() => setMantenimientoInitialText('')}
                  />
                )}
                {activeTab === 'contratos' && orgId && orgData && (
                  <ScreenContratos
                    orgId={orgId}
                    orgData={orgData}
                    clientes={clientes.map(c => ({ id: c.id, nombre: c.nombre, direccion: c.direccion, telefono: c.telefono, email: c.email }))}
                    oficio={orgData.oficio}
                    plan={subscription?.plan ?? orgData?.plan ?? 'basico'}
                  />
                )}
                {activeTab === 'subcontratas' && orgId && (
                  <ScreenSubcontratas orgId={orgId} showToast={showToast} />
                )}
                {activeTab === 'suppliers' && orgId && (
                  <ScreenProveedoresCliente orgId={orgId} showToast={showToast} />
                )}
                {activeTab === 'pedidos_material' && orgId && (
                  <ScreenPedidosMaterial
                    orgId={orgId}
                    showToast={showToast}
                    initialQuote={pedirMaterialQuote}
                    onClose={() => setPedirMaterialQuote(null)}
                    orgData={orgData}
                  />
                )}
                {activeTab === 'asistente' && (
                  <ScreenAsistenteTecnico
                    orgId={orgId ?? null}
                    plan={subscription?.plan ?? orgData?.plan ?? 'basico'}
                    session={session ?? null}
                    showToast={showToast}
                  />
                )}
                {activeTab === 'valoraciones' && orgId && (
                  <ScreenValoraciones showToast={showToast} />
                )}
                {activeTab === 'settings' && ScreenSettings()}
                {activeTab === 'preview' && ScreenPreview()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Presupuesto por Pasos overlay */}
        {showPresupuestoIncremental && (
          <ScreenPresupuestoIncremental
            showToast={showToast}
            orgId={orgId ?? undefined}
            onClose={() => setShowPresupuestoIncremental(false)}
            onConfirm={(q) => {
              setShowPresupuestoIncremental(false);
              const partidasDesktop = q.partidas.map(p => {
                if (p.supplier_key && p.precioUnitario > 0) {
                  return { descripcion: p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precioUnitario: p.precioUnitario, total: p.precioUnitario * p.cantidad, supplier_key: p.supplier_key, supplier_name: p.supplier_name, supplier_ref: p.supplier_ref };
                }
                const match = catalogProducts.length > 0 ? matchProductForAI(p.descripcion, catalogProducts) : null;
                const pu = match ? match.variant.precio_venta * (1 + empresaAjustes.margenMateriales / 100) : p.precioUnitario;
                return { descripcion: match ? `${match.product.nombre_generico} (${match.variant.marca})` : p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precioUnitario: pu, total: pu * p.cantidad };
              });
              const quoteBase = {
                id: '',
                nombreCliente: '',
                telefonoCliente: '',
                emailCliente: '',
                descripcion: q.descripcion,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'Borrador' as const,
                partidas: partidasDesktop,
                total: partidasDesktop.reduce((s, p) => s + p.total, 0),
              };
              setWizardQuote(quoteBase);
              setEditingQuote(quoteBase);
              setEditingQuoteId(null);
              setWizardOrigin('voz');
              setWizardStep(4);
              setWizardActive(true);
              setActiveTab('create_quote');
            }}
          />
        )}

        {/* Mantenimiento Wizard overlay (desktop) */}
        {showMantenimientoWizard && (
          <ScreenMantenimientoWizard
            showToast={showToast}
            orgId={orgId ?? ''}
            onClose={() => setShowMantenimientoWizard(false)}
            onConfirm={() => {
              setShowMantenimientoWizard(false);
              setActiveTab('mantenimiento');
              setMantenimientoReloadKey(k => k + 1);
            }}
          />
        )}

      </React.Fragment>
    );

    function SidebarBtn({ id, icon, label }: { id: string; icon: React.ReactNode; label: string }) {
      const isActive = activeTab === id || (id === 'quotes' && (activeTab === 'create_quote' || activeTab === 'preview'));
      return (
        <button
          data-testid={`nav-${id}`}
          onClick={() => setActiveTab(id)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer relative ${
            isActive
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
              : 'text-slate-455 hover:text-white hover:bg-slate-800/40'
          }`}
        >
          {icon}
          <span>{label}</span>
          {isActive && (
            <span className="absolute right-2 w-1.5 h-1.5 bg-white rounded-full" />
          )}
        </button>
      );
    }
  }

  // ================= DESKTOP: DASHBOARD SCREEN =================
  function ScreenDashboard() {
    // ── Tasa de aceptación real ────────────────────────────────────────────
    const presupuestosNoborrador = presupuestos.filter(p => p.estado !== 'Borrador');
    const presupuestosAceptados  = presupuestos.filter(p => p.estado === 'Aceptado' || p.estado === 'Facturado');
    const tasaAceptacion = presupuestosNoborrador.length > 0
      ? Math.round((presupuestosAceptados.length / presupuestosNoborrador.length) * 100)
      : null;

    // ── Gráfico ingresos reales últimos 6 meses ───────────────────────────
    const chartMeses = Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      return { label: d.toLocaleString('es-ES', { month: 'short' }), year: d.getFullYear(), month: d.getMonth() };
    });
    const chartData = chartMeses.map(m => ({
      mes: m.label,
      total: facturas
        .filter(f => f.estado === 'Pagada' && f.fecha)
        .filter(f => { const d = new Date(f.fecha); return d.getFullYear() === m.year && d.getMonth() === m.month; })
        .reduce((sum, f) => sum + (f.importe || 0), 0),
    }));
    const chartMax = Math.max(...chartData.map(d => d.total), 1);

    // ── Pasos de configuración pendientes ─────────────────────────────────
    const pendingSetup: { label: string; action: string; onClick: () => void }[] = [];
    if (isLiveMode && orgData) {
      const orgAny = orgData as unknown as Record<string, unknown>;
      if (!orgAny.nif && !(orgAny.nombre as string)?.trim()) {
        pendingSetup.push({ label: 'Datos fiscales de la empresa (NIF, nombre, dirección)', action: 'Completar', onClick: () => setActiveTab('settings') });
      }
      if (!orgAny.logo_url) {
        pendingSetup.push({ label: 'Logo para presupuestos y facturas', action: 'Subir logo', onClick: () => setActiveTab('settings') });
      }
      if (tarifas.length === 0) {
        pendingSetup.push({ label: 'Catálogo de productos/servicios (sin catálogo la IA no funciona bien)', action: 'Ir a Catálogo', onClick: () => setActiveTab('catalog') });
      }
    }

    return (
      <div className="space-y-6">

        {/* ── Banner de configuración pendiente ─────────────────────── */}
        {pendingSetup.length > 0 && rol === 'owner' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-bold text-amber-900 text-sm">Configuración incompleta</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Faltan {pendingSetup.length} paso{pendingSetup.length !== 1 ? 's' : ''} para que la aplicación funcione correctamente.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {pendingSetup.map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-3 bg-white border border-amber-200 rounded-xl px-4 py-2.5">
                  <span className="text-xs text-slate-700 flex-1">{item.label}</span>
                  <button
                    onClick={item.onClick}
                    className="text-[11px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                  >
                    {item.action} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={async () => {
                if (orgId) await supabase.from('trade_organizations').update({ is_onboarded: false }).eq('id', orgId);
                setShowOnboarding(true);
              }}
              className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Configurar con el asistente paso a paso
            </button>
          </div>
        )}

        {/* ── Banner festivos con contratos urgencia/24×7 ─────────────── */}
        {urgentContratosCount > 0 && (() => {
          const today = new Date().toISOString().split('T')[0];
          const upcomingHolidays: { date: string; name: string }[] = [];
          for (let i = 0; i < 14; i++) {
            const d = new Date(today + 'T12:00:00');
            d.setDate(d.getDate() + i);
            const ds = d.toISOString().split('T')[0];
            if (!isWorkingDay(ds, workCalendar)) {
              const mmdd = ds.slice(5);
              const holiday = workCalendar.holidays.find(h => (h.recurring && h.date === mmdd) || (!h.recurring && h.date === ds));
              const dowCfg = workCalendar.workDays[d.getDay()];
              if (holiday) upcomingHolidays.push({ date: ds, name: holiday.name });
              else if (!dowCfg?.active) upcomingHolidays.push({ date: ds, name: DAY_NAMES[d.getDay()] + ' (día de descanso)' });
            }
          }
          if (upcomingHolidays.length === 0) return null;
          const isTodayHoliday = !isWorkingDay(today, workCalendar);
          return (
            <div className="bg-orange-50 border border-orange-300 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5">⚡</span>
              <div className="flex-1">
                <p className="font-bold text-orange-900 text-sm">
                  {isTodayHoliday ? 'Hoy es festivo — contratos de urgencia activos' : `Próximos días festivos — contratos urgencia/24×7 activos`}
                </p>
                <p className="text-xs text-orange-700 mt-0.5 leading-relaxed">
                  Tienes <strong>{urgentContratosCount} contrato{urgentContratosCount !== 1 ? 's' : ''} de mantenimiento con cobertura urgencia/24×7</strong>. Estos seguirán activos en los siguientes días no laborables:
                  {' '}<span className="font-semibold">{upcomingHolidays.slice(0, 5).map(h => `${h.name} (${new Date(h.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })})`).join(', ')}</span>.
                </p>
                <p className="text-[10px] text-orange-600 mt-1">Recuerda comunicar a tus técnicos la disponibilidad requerida esos días.</p>
              </div>
            </div>
          );
        })()}

        {/* Recomendador IA flotante */}
        {showPricingSuggestion && (
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-gradient-to-r from-blue-600/10 via-indigo-600/5 to-transparent border border-blue-500/35 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-left shadow-lg relative overflow-hidden"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-blue-500/20 text-blue-450 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                <Sparkles className="w-5 h-5 text-blue-400 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-bold text-blue-455 uppercase tracking-widest">TrabFlow Smart Pricing</span>
                  <span className="bg-emerald-500/15 text-emerald-450 font-bold px-1.5 py-0.5 rounded text-[8px] uppercase tracking-wider font-mono">Recomendado</span>
                </div>
                <span className="font-bold text-xs text-slate-800">Optimizar tarifa hora en {orgData?.ciudad || 'tu zona'}</span>
                <p className="text-[11px] text-slate-500 leading-normal max-w-lg">
                  Tu tarifa actual es <strong>{empresaAjustes.valorHoraOperario}€/h</strong>. El promedio verificado de mercado en {orgData?.ciudad || 'tu zona'} es de <strong>{TARIFA_SUGERIDA}€/h</strong>. Al aplicar, se actualizará en Ajustes y en todos los presupuestos nuevos.
                </p>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button
                onClick={applySuggestedPricing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Aplicar {TARIFA_SUGERIDA}€/h (+{TARIFA_SUGERIDA - empresaAjustes.valorHoraOperario}€)
              </button>
              <button
                onClick={dismissPricingSuggestion}
                className="bg-slate-200 text-slate-655 hover:bg-slate-250 font-bold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Ignorar
              </button>
            </div>
          </motion.div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Trimestre Facturado</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 tracking-tight">
              {totalFacturadoFacturas.toFixed(2)}€
            </div>
            <span className="text-[10px] text-slate-400 block">✓ Cobro confirmado</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pendiente Cobro</span>
            <div className="text-xl sm:text-2xl font-black text-amber-500 tracking-tight">
              {totalPendienteFacturas.toFixed(2)}€
            </div>
            <span className="text-[10px] text-slate-400 block">⚠ En plazo de vencimiento</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Borradores en Espera</span>
            <div className="text-xl sm:text-2xl font-black text-blue-500 tracking-tight">
              {presupuestosPendientesCount}
            </div>
            <span className="text-[10px] text-slate-400 block">Presupuestos por firmar</span>
          </div>

          <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Tasa de Aceptación</span>
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {tasaAceptacion !== null ? `${tasaAceptacion}%` : '—'}
            </div>
            <span className="text-[10px] text-slate-400 block">
              {tasaAceptacion !== null ? `${presupuestosAceptados.length} de ${presupuestosNoborrador.length} enviados` : 'Sin presupuestos enviados'}
            </span>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <button
            onClick={() => setIsVoiceModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-5 text-center shadow-lg hover:shadow-blue-500/10 space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101 border border-blue-500"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <span className="font-black uppercase tracking-wider text-xs block">Presupuesto por Voz IA</span>
            <p className="text-[10px] text-blue-105 leading-normal max-w-xs">Dicta en la furgoneta o en obra; creamos el presupuesto estructurado.</p>
          </button>

          <button
            onClick={() => { setActiveTab('planificacion'); setNewJobTrigger(p => p + 1); }}
            className="bg-violet-600 hover:bg-violet-700 text-white rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101 border border-violet-500"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="font-black uppercase tracking-wider text-xs block">Añadir Trabajo / Visita</span>
            <p className="text-[10px] text-violet-200 leading-normal max-w-xs">Anota una visita o llamada pendiente para ir a ver la obra.</p>
          </button>


          <button
            onClick={() => {
              setNewClient({ nombre: '', telefono: '', email: '', direccion: '' });
              setIsClientModalOpen(true);
            }}
            className="bg-white border border-slate-200 text-slate-800 rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101"
          >
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
              <Plus className="w-6 h-6 text-slate-600" />
            </div>
            <span className="font-black uppercase tracking-wider text-xs block">Registrar Cliente CRM</span>
            <p className="text-[10px] text-slate-455 leading-normal max-w-xs">Da de alta un cliente y guarda sus datos fiscales para futuros cobros.</p>
          </button>

          <button
            onClick={() => setShowPresupuestoIncremental(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101 border border-amber-400"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">📋</span>
            </div>
            <span className="font-black uppercase tracking-wider text-xs block">Presupuesto por Pasos</span>
            <p className="text-[10px] text-amber-100 leading-normal max-w-xs">Añade partidas poco a poco: mudanzas, reformas, trabajos complejos.</p>
          </button>

          <button
            onClick={() => setShowMantenimientoWizard(true)}
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101 border border-blue-600"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔧</span>
            </div>
            <span className="font-black uppercase tracking-wider text-xs block">Contrato Mantenimiento</span>
            <p className="text-[10px] text-blue-200 leading-normal max-w-xs">23 sectores, SLA, cláusulas y voz IA. Catálogo se actualiza automáticamente.</p>
          </button>
        </div>

        {/* Visitas y trabajos pendientes en desktop */}
        {jobs.filter(j => j.estado !== 'completado' && j.estado !== 'cancelado').length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Visitas pendientes */}
            {jobs.filter(j => j.tipo === 'visita' && j.estado !== 'completado' && j.estado !== 'cancelado').length > 0 && (
              <div className="bg-white border border-violet-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">👁 Visitas pendientes</h3>
                  <span className="text-[9px] text-slate-400">{jobs.filter(j => j.tipo === 'visita' && j.estado !== 'completado' && j.estado !== 'cancelado').length} pendientes</span>
                </div>
                <div className="space-y-2">
                  {jobs.filter(j => j.tipo === 'visita' && j.estado !== 'completado' && j.estado !== 'cancelado').slice(0, 4).map(j => (
                    <div key={j.id} className="flex items-center gap-3 p-2.5 bg-violet-50 border border-violet-100 rounded-xl">
                      <div className="w-1.5 h-8 bg-violet-500 rounded-full shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-800 truncate">{j.titulo}</p>
                        {j.trade_clients?.nombre && <p className="text-[10px] text-slate-500 truncate">{j.trade_clients.nombre}</p>}
                      </div>
                      {j.fecha_inicio && (
                        <span className="text-[10px] font-mono text-violet-600 shrink-0">
                          {new Date(j.fecha_inicio + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trabajos activos hoy */}
            {(() => {
              const todayISO = new Date().toISOString().split('T')[0];
              const todayJobs = jobs.filter(j => j.fecha_inicio === todayISO && j.estado !== 'cancelado' && j.tipo !== 'visita');
              if (todayJobs.length === 0) return null;
              return (
                <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">🔧 Trabajos hoy</h3>
                    <span className="text-[9px] text-slate-400">{todayJobs.length} programados</span>
                  </div>
                  <div className="space-y-2">
                    {todayJobs.slice(0, 4).map(j => (
                      <div key={j.id} className="flex items-center gap-3 p-2.5 bg-blue-50 border border-blue-100 rounded-xl">
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${j.estado === 'en_curso' ? 'bg-amber-400' : j.estado === 'completado' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">{j.titulo}</p>
                          {j.trade_clients?.nombre && <p className="text-[10px] text-slate-500 truncate">{j.trade_clients.nombre}</p>}
                        </div>
                        {j.hora_inicio && <span className="text-[10px] font-mono text-blue-600 shrink-0">{j.hora_inicio}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Evolución gráfica SVG */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="bg-white border border-slate-200 p-5 rounded-xl lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Historial</span>
                <h3 className="text-sm font-black text-slate-900 uppercase">Ingresos Recientes</h3>
              </div>
            </div>

            <div className="h-44 w-full flex items-end justify-between pt-6 gap-2">
              {chartData.map((item, idx) => {
                const pct = chartMax > 0 ? (item.total / chartMax) * 100 : 0;
                const isLast = idx === chartData.length - 1;
                return (
                  <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
                    <div className="text-[9px] font-bold text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">
                      {item.total > 0 ? `${item.total.toFixed(0)}€` : ''}
                    </div>
                    {pct > 0 ? (
                      isLast ? (
                        <div className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-emerald-400 rounded-t-lg shadow-md" style={{ height: `${pct}%` }} />
                      ) : (
                        <div className="w-full bg-blue-200 rounded-t-lg" style={{ height: `${pct}%` }} />
                      )
                    ) : (
                      <div className="w-full bg-slate-100 rounded-t-lg" style={{ height: '4px' }} />
                    )}
                    <span className="text-[9px] mt-2 font-mono text-slate-400">{item.mes}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ultimos Presupuestos */}
          <div className="bg-white border border-slate-200 p-5 rounded-xl lg:col-span-5 space-y-4">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Lista</span>
              <h3 className="text-sm font-black text-slate-900 uppercase">Presupuestos Recientes</h3>
            </div>

            <div className="space-y-3">
              {presupuestos.slice(0, 3).map(p => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    setSelectedQuoteForPreview(p);
                    setActiveTab('preview');
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer"
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <span className="text-xs font-bold text-slate-800 block truncate">{p.nombreCliente}</span>
                    <span className="text-[10px] text-slate-450 block truncate">{p.descripcion}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-slate-800">{(p.total ?? 0).toFixed(0)}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ================= DESKTOP: LISTA PRESUPUESTOS SCREEN =================
  function ScreenPresupuestos() {
    const estadoColor: Record<string, string> = {
      Borrador:  'bg-slate-100 text-slate-500 border-slate-200',
      Pendiente: 'bg-amber-50 text-amber-600 border-amber-200',
      Enviado:   'bg-blue-50 text-blue-600 border-blue-200',
      Aceptado:  'bg-emerald-50 text-emerald-700 border-emerald-200',
      Rechazado: 'bg-red-50 text-red-500 border-red-200',
      Facturado: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      enviado:   'bg-blue-50 text-blue-600 border-blue-200',
      aceptado:  'bg-emerald-50 text-emerald-700 border-emerald-200',
      rechazado: 'bg-red-50 text-red-500 border-red-200',
      facturado: 'bg-indigo-100 text-indigo-700 border-indigo-200',
      borrador:  'bg-slate-100 text-slate-500 border-slate-200',
    };
    const rowBg: Record<string, string> = {
      Borrador:  '',
      Pendiente: 'bg-amber-50/30',
      Enviado:   'bg-blue-50/30',
      Aceptado:  'bg-emerald-50/50',
      Rechazado: 'bg-red-50/30',
      Facturado: 'bg-indigo-50/40',
    };

    return (
      <div className="space-y-4">
        {presupuestos.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
            <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm font-bold text-slate-500">No hay presupuestos todavía</p>
            <p className="text-xs text-slate-400 mt-1 mb-4">Crea tu primer presupuesto con voz IA o manualmente</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setIsVoiceModalOpen(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                Voz IA
              </button>
              <button
                onClick={() => { setEditingQuoteId(null); setActiveTab('create_quote'); }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl cursor-pointer border border-slate-200"
              >
                <FilePlus className="w-4 h-4" />
                Manual
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Chips rápidos por estado */}
            <div className="flex flex-wrap gap-1.5">
              {([
                ['todos',     'Todos',      'bg-slate-700 text-white',             'bg-white border-slate-200 text-slate-500 hover:border-slate-400'],
                ['borrador',  'Borrador',   'bg-slate-600 text-white',             'bg-white border-slate-200 text-slate-500 hover:border-slate-400'],
                ['enviado',   'Enviado',    'bg-blue-600 text-white',              'bg-blue-50 border-blue-200 text-blue-600 hover:border-blue-400'],
                ['aceptado',  'Aceptado',   'bg-emerald-600 text-white',           'bg-emerald-50 border-emerald-200 text-emerald-600 hover:border-emerald-400'],
                ['rechazado', 'Rechazado',  'bg-red-500 text-white',               'bg-red-50 border-red-200 text-red-500 hover:border-red-400'],
                ['facturado', 'Facturado',  'bg-violet-600 text-white',            'bg-violet-50 border-violet-200 text-violet-600 hover:border-violet-400'],
                ['vencido',   'Vencido',    'bg-orange-500 text-white',            'bg-orange-50 border-orange-200 text-orange-500 hover:border-orange-400'],
              ] as [string, string, string, string][]).map(([val, label, activeClass, inactiveClass]) => {
                const count = val === 'todos'
                  ? presupuestos.length
                  : presupuestos.filter(p => p.estado.toLowerCase() === val).length;
                if (val !== 'todos' && count === 0) return null;
                const isActive = presupuestoEstado === val;
                return (
                  <button
                    key={val}
                    onClick={() => setPresupuestoEstado(val)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${isActive ? activeClass + ' border-transparent' : inactiveClass + ' border'}`}
                  >
                    {label}
                    <span className={`text-[9px] font-black rounded-full px-1.5 py-0 ${isActive ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Filtros — fila 1: búsqueda + cliente */}
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Buscar número, descripción…"
                value={presupuestoSearch}
                onChange={e => setPresupuestoSearch(e.target.value)}
                className="flex-1 min-w-[180px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none"
              />
              <select
                value={presupuestoClienteFiltro}
                onChange={e => setPresupuestoClienteFiltro(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none cursor-pointer"
              >
                <option value="">Todos los clientes</option>
                {[...new Set(presupuestos.map(p => p.nombreCliente).filter(Boolean))].sort().map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {/* Filtros — fila 2: rango de fechas */}
            <div className="flex flex-wrap gap-2 items-center">
              <CalendarRange className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="date"
                value={presupuestoFechaDesde}
                onChange={e => setPresupuestoFechaDesde(e.target.value)}
                title="Desde"
                className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-400 text-slate-600"
              />
              <span className="text-xs text-slate-400">—</span>
              <input
                type="date"
                value={presupuestoFechaHasta}
                onChange={e => setPresupuestoFechaHasta(e.target.value)}
                title="Hasta"
                className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-blue-400 text-slate-600"
              />
              {(presupuestoFechaDesde || presupuestoFechaHasta || presupuestoClienteFiltro || presupuestoEstado !== 'todos' || presupuestoSearch) && (
                <button
                  onClick={() => { setPresupuestoFechaDesde(''); setPresupuestoFechaHasta(''); setPresupuestoClienteFiltro(''); setPresupuestoEstado('todos'); setPresupuestoSearch(''); }}
                  className="text-[10px] text-red-500 hover:text-red-700 font-semibold cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3 h-3" />Limpiar filtros
                </button>
              )}
              <span className="ml-auto text-[10px] text-slate-400">
                {presupuestos.filter(p => {
                  const q = presupuestoSearch.toLowerCase().trim();
                  const matchSearch = !q || p.nombreCliente.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
                  const matchEstado = presupuestoEstado === 'todos' || p.estado.toLowerCase() === presupuestoEstado;
                  const matchCliente = !presupuestoClienteFiltro || p.nombreCliente === presupuestoClienteFiltro;
                  const matchDesde = !presupuestoFechaDesde || p.fecha >= presupuestoFechaDesde;
                  const matchHasta = !presupuestoFechaHasta || p.fecha <= presupuestoFechaHasta;
                  return matchSearch && matchEstado && matchCliente && matchDesde && matchHasta;
                }).length} resultados
              </span>
            </div>
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Nº</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Cliente</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Descripción</th>
                  <th className="text-left px-4 py-3 font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Fecha</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Total</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-400 uppercase tracking-wider">Estado</th>
                  <th className="px-2 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {presupuestos.filter(p => {
                  const q = presupuestoSearch.toLowerCase().trim();
                  const matchSearch = !q || p.nombreCliente.toLowerCase().includes(q) || p.descripcion.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
                  const matchEstado = presupuestoEstado === 'todos' || p.estado.toLowerCase() === presupuestoEstado;
                  const matchCliente = !presupuestoClienteFiltro || p.nombreCliente === presupuestoClienteFiltro;
                  const matchDesde = !presupuestoFechaDesde || p.fecha >= presupuestoFechaDesde;
                  const matchHasta = !presupuestoFechaHasta || p.fecha <= presupuestoFechaHasta;
                  return matchSearch && matchEstado && matchCliente && matchDesde && matchHasta;
                }).map(p => (
                  <tr
                    key={p.id}
                    data-testid="quote-row"
                    onClick={() => { setSelectedQuoteForPreview(p); setActiveTab('preview'); }}
                    className={`cursor-pointer transition-colors hover:brightness-95 ${rowBg[p.estado] ?? ''}`}
                  >
                    <td className="px-4 py-3 font-mono font-bold text-slate-600 whitespace-nowrap">{p.id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 truncate max-w-[120px]">{p.nombreCliente}</td>
                    <td className="px-4 py-3 text-slate-500 truncate max-w-[200px] hidden sm:table-cell">{p.descripcion}</td>
                    <td className="px-4 py-3 text-slate-400 hidden md:table-cell whitespace-nowrap">{p.fecha}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{(p.total ?? 0).toFixed(2)}€</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${estadoColor[p.estado] ?? 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        title="Descargar PDF"
                        onClick={() => printQuote(p)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer transition-colors"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    );
  }

  // ================= DESKTOP: CREAR/EDITAR PRESUPUESTO SCREEN =================
  function ScreenCreateQuote() {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            {editingQuoteId && (
              <button
                onClick={() => { setEditingQuoteId(null); setActiveTab('preview'); }}
                className="flex items-center gap-1 text-slate-400 hover:text-slate-700 cursor-pointer text-xs"
              >
                ← Volver
              </button>
            )}
            <div>
              <h3 className="text-md font-black uppercase text-slate-900">
                {editingQuoteId ? `Editar ${editingQuote.id}` : 'Borrador de Presupuesto'}
              </h3>
              {editingQuoteId && (
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Editando presupuesto existente — estado: {editingQuote.estado}</p>
              )}
            </div>
          </div>
          {!editingQuoteId && (
            <button
              onClick={() => setIsVoiceModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-650/20 border border-blue-500/30 text-blue-450 font-bold uppercase tracking-wider text-[10px] py-2.5 px-4 rounded-xl cursor-pointer"
            >
              <Mic className="w-4 h-4 animate-pulse text-blue-400" />
              <span>Asistente por Voz 🎙️</span>
            </button>
          )}
        </div>

        {/* Banner IA: aviso visual cuando se acaban de generar partidas */}
        {aiLearningData && !editingQuoteId && editingQuote.partidas.length > 0 && (
          <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-xs text-blue-700">
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span><strong>{editingQuote.partidas.length} partidas generadas por IA</strong> — selecciona el cliente y revisa precios antes de guardar</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cliente CRM</label>
            <div className="flex gap-2">
              <select
                value={editingQuote.nombreCliente}
                onChange={(e) => {
                  const cli = clientes.find(c => c.nombre === e.target.value);
                  setEditingQuote(prev => ({
                    ...prev,
                    nombreCliente: e.target.value,
                    telefonoCliente: cli?.telefono || '',
                    emailCliente: cli?.email || ''
                  }));
                }}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 focus:outline-none"
              >
                <option value="">-- Seleccionar cliente --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.nombre}>{c.nombre} {c.telefono ? `· ${c.telefono}` : ''}</option>
                ))}
              </select>
              <button
                onClick={() => { setNewClient({ nombre: '', telefono: '', email: '', direccion: '' }); setIsClientModalOpen(true); }}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-3 flex items-center justify-center cursor-pointer shrink-0"
                title="Añadir nuevo cliente"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nombre Obra</label>
            <input
              type="text"
              placeholder="Instalación termo, grifo..."
              value={editingQuote.descripcion}
              onChange={(e) => setEditingQuote(prev => ({ ...prev, descripcion: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Fecha</label>
            <input
              type="date"
              value={editingQuote.fecha}
              onChange={(e) => setEditingQuote(prev => ({ ...prev, fecha: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          {/* Banner desktop: guardar nueva actuación */}
          {aiLearningData && aiLearningData.nuevosOficios.length > 0 && isLiveMode && (
            savedActuacion ? (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-blue-500" />
                <span><strong>Plantilla guardada</strong> — la próxima vez se detectará automáticamente</span>
              </div>
            ) : (
              <div className="bg-violet-50 border border-violet-200 rounded-xl px-4 py-3 text-xs">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-4 h-4 shrink-0 text-violet-500" />
                    <div>
                      <span className="font-bold text-violet-800 block">Trabajo nuevo: <em>{aiLearningData.nuevosOficios[0].oficio}</em></span>
                      <span className="text-violet-600 text-[10px]">¿Guardar estas partidas como plantilla para futuros presupuestos?</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={handleSaveActuacion}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold py-1.5 px-3 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer"
                    >
                      Guardar plantilla
                    </button>
                    <button
                      onClick={() => setSavedActuacion(true)}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold py-1.5 px-3 rounded-lg text-[9.5px] uppercase tracking-wider cursor-pointer"
                    >
                      Ignorar
                    </button>
                  </div>
                </div>
              </div>
            )
          )}

          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Partidas de Obra</h4>
            <button
              onClick={handleAddManualItem}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 font-bold uppercase tracking-wider text-[9px] py-1.5 px-3 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Fila</span>
            </button>
          </div>

          <div className="space-y-2">
            {editingQuote.partidas.map((item, idx) => (
              <React.Fragment key={idx}>
              <div className={`border p-3 rounded-xl flex flex-wrap md:flex-nowrap gap-3 items-center transition-colors ${
                compareIdx === idx ? 'border-blue-300 bg-blue-50/50' :
                item.origen === 'sugerida_ia' ? 'bg-amber-50 border-amber-200' :
                'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex-grow flex items-center gap-1.5 min-w-0">
                  <QuoteItemDescInput
                    value={item.descripcion}
                    onChange={val => handleUpdateItem(idx, { descripcion: val })}
                    onVariantSelect={(desc, precio, sKey, sName, variantId) =>
                      handleUpdateItem(idx, { descripcion: desc, precioUnitario: precio, total: precio * item.cantidad, supplier_key: sKey, supplier_name: sName, catalog_variant_id: variantId })
                    }
                    catalogProducts={catalogProducts}
                  />
                  {item.origen === 'sugerida_ia' && (
                    <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-300 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      Nueva — pon precio
                    </span>
                  )}
                  {item.supplier_key === 'obramat' && (
                    <img src="/articuloobramat.png" alt="OBRAMAT" className="h-4 shrink-0 opacity-80" title={item.supplier_ref ?? 'OBRAMAT'} />
                  )}
                  {item.supplier_key && item.supplier_key !== 'obramat' && item.supplier_name && (
                    <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                      {item.supplier_name}
                    </span>
                  )}
                  {item.tipo === 'material' && orgId && (
                    <button
                      onClick={() => handleOpenCompare(idx, item.descripcion)}
                      title="Comparar proveedores"
                      className={`shrink-0 p-1 rounded-md transition-colors cursor-pointer ${compareIdx === idx ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-blue-500 hover:bg-blue-50'}`}
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={item.tipo}
                  onChange={(e) => handleUpdateItem(idx, { tipo: e.target.value as any })}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800"
                >
                  <option value="material">Material 📦</option>
                  <option value="mano_de_obra">Mano Obra 🛠️</option>
                </select>

                <input
                  type="number"
                  value={item.cantidad}
                  min="1"
                  onChange={(e) => handleUpdateItem(idx, { cantidad: parseInt(e.target.value) || 1 })}
                  className="w-16 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-center text-xs text-slate-800"
                />

                <input
                  type="number"
                  step="0.01"
                  value={item.precioUnitario || ''}
                  placeholder="0.00"
                  onChange={(e) => handleUpdateItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-right text-xs text-slate-800"
                />

                <span className="w-16 text-right text-xs font-mono font-bold text-slate-900">{(item.total ?? 0).toFixed(0)}€</span>

                <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Panel comparador de proveedores */}
              {compareIdx === idx && (
                <div className="mt-1 bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowUpDown className="h-3 w-3" /> Opciones de proveedor
                    </span>
                    <button onClick={() => setCompareIdx(null)} className="text-blue-400 hover:text-blue-700 cursor-pointer">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {compareLoading && (
                    <div className="flex items-center justify-center gap-2 py-5 text-slate-400 text-xs">
                      <Loader2 className="h-4 w-4 animate-spin" /> Buscando en catálogos…
                    </div>
                  )}

                  {!compareLoading && compareResults.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-5">
                      No se encontraron alternativas en los catálogos activos
                    </p>
                  )}

                  {!compareLoading && compareResults.map((opt, oi) => (
                    <button
                      key={oi}
                      onClick={() => handleSelectCompare(idx, opt)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50 transition-colors cursor-pointer ${oi < compareResults.length - 1 ? 'border-b border-slate-100' : ''} ${item.supplier_key === opt.catalog_key && item.supplier_ref === opt.ref_proveedor ? 'bg-blue-50' : ''}`}
                    >
                      <div className="shrink-0 w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center">
                        {opt.catalog_key === 'obramat'
                          ? <img src="/logoobramat.png" alt="OB" className="h-4 object-contain" />
                          : <Package className="h-3.5 w-3.5 text-slate-500" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-slate-700 font-medium truncate">{opt.descripcion}</p>
                        <p className="text-[9px] text-slate-400 truncate">
                          {opt.supplier_name}{opt.ref_proveedor ? ` · ${opt.ref_proveedor}` : ''} · {opt.unidad}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-bold font-mono text-slate-900">{opt.precio_venta.toFixed(2)} €</p>
                        <p className="text-[9px] text-slate-400 font-mono">coste {opt.precio_coste.toFixed(2)} €</p>
                      </div>
                      {item.supplier_key === opt.catalog_key && item.precioUnitario === opt.precio_venta && (
                        <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-mono">Total Neto</span>
            <div className="text-xl font-bold font-mono text-slate-900">{(editingQuote.total ?? 0).toFixed(2)}€</div>
          </div>
          <button
            onClick={saveCurrentQuote}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold uppercase tracking-wider text-[10px] cursor-pointer shadow-md"
          >
            Guardar y Previsualizar PDF ➔
          </button>
        </div>
      </div>
    );
  }

  // ================= DESKTOP: ESCANER FOTO SCREEN =================
  function ScreenAIScan() {
    const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setRealPhotoFile(file);
        setRealPhotoPreviewUrl(URL.createObjectURL(file));
        setSelectedPhotoPreset(null);
        setPhotoScanPhase('idle');
        setPhotoScene(null);
        setPendingPhotoQuote(null);
        setScanProgress(0);
      }
      e.target.value = '';
    };

    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
        <style>{`@keyframes scanBeam{0%,100%{top:3%}50%{top:90%}}`}</style>
        <div className="flex items-center justify-between">
          <h3 className="text-md font-black uppercase text-slate-900">Escáner Fotográfico IA</h3>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isLiveMode ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>
            {isLiveMode ? '● REAL' : '● DEMO'}
          </span>
        </div>

        {/* ── MODO REAL ── */}
        {isLiveMode && (
          <div className="space-y-4">
            <input ref={photoInputRef}  type="file" accept="image/*" className="hidden" onChange={onFileSelected} />
            <input ref={photoCameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileSelected} />

            {/* Estado: sin foto */}
            {!realPhotoFile && photoScanPhase === 'idle' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => photoCameraRef.current?.click()}
                  className="bg-slate-50 border-2 border-blue-600/40 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
                  <Camera className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-800 block">Tomar foto</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Abre la cámara</span>
                </button>
                <button onClick={() => photoInputRef.current?.click()}
                  className="bg-slate-50 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors">
                  <ImageIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-800 block">Subir imagen</span>
                  <span className="text-[10px] text-slate-400 block mt-1">Desde tu equipo</span>
                </button>
              </div>
            )}

            {/* Estado: foto cargada — pendiente de analizar o analizando */}
            {realPhotoFile && photoScanPhase !== 'intent' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
                  <img src={realPhotoPreviewUrl!} alt="Preview" className="max-h-full max-w-full object-contain" />
                  {isScanning && (
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] z-20"
                      style={{ animation: 'scanBeam 2.5s ease-in-out infinite', position: 'absolute' }} />
                  )}
                  {!isScanning && (
                    <button onClick={() => { setRealPhotoFile(null); setRealPhotoPreviewUrl(null); setScanProgress(0); }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white text-[9px] font-bold px-2 py-1 rounded-lg cursor-pointer">
                      ✕ Cambiar
                    </button>
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block font-mono uppercase mb-2">Claude AI Vision</span>
                    {isScanning ? (
                      <div className="space-y-3">
                        <p className="text-xs text-emerald-600 font-semibold animate-pulse">Analizando imagen…</p>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div className="bg-emerald-500 h-2 transition-all duration-500 rounded-full" style={{ width: `${scanProgress}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-400">Detectando elementos, trabajos y materiales…</p>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">Pulsa <strong>Analizar</strong> para que la IA detecte qué hay en la imagen y sugiera los trabajos.</p>
                    )}
                  </div>
                  {!isScanning && (
                    <button onClick={startPhotoAnalysis}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl text-[10px] uppercase cursor-pointer transition-colors">
                      Analizar con IA 📷
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Estado: análisis completado — selección de intención */}
            {photoScanPhase === 'intent' && photoScene && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Miniatura de la foto */}
                  <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
                    {realPhotoPreviewUrl && <img src={realPhotoPreviewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />}
                    <div className="absolute inset-0 bg-emerald-950/20 flex items-end p-3">
                      <span className="text-[10px] text-emerald-300 font-bold bg-emerald-900/70 px-2 py-1 rounded-lg">✓ Análisis completado</span>
                    </div>
                  </div>
                  {/* Descripción detectada */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">Claude AI Vision — Detectado</span>
                    <p className="text-xs text-slate-700 font-semibold leading-relaxed">{photoScene.descripcion}</p>
                    <button
                      onClick={() => { setRealPhotoFile(null); setRealPhotoPreviewUrl(null); setPhotoScanPhase('idle'); setPhotoScene(null); setPendingPhotoQuote(null); setScanProgress(0); }}
                      className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors mt-auto text-left"
                    >
                      ✕ Analizar otra foto
                    </button>
                  </div>
                </div>

                {/* Selección de acción */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-blue-900">¿Qué trabajo quieres presupuestar?</p>
                  <div className="flex flex-wrap gap-2">
                    {photoScene.acciones.map(accion => (
                      <button
                        key={accion}
                        onClick={() => handleApplyPhotoResult(accion)}
                        className="text-[11px] bg-white border border-blue-300 text-blue-800 font-semibold px-3 py-2 rounded-xl hover:bg-blue-600 hover:text-white hover:border-blue-600 cursor-pointer transition-colors"
                      >
                        {accion}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handleApplyPhotoResult()}
                    className="w-full text-[10px] text-blue-600 hover:text-blue-800 cursor-pointer transition-colors text-left pt-1 border-t border-blue-200"
                  >
                    Usar el análisis completo sin filtrar →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── MODO DEMO ── */}
        {!isLiveMode && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {presetPhotos.map(p => (
                <div key={p.id} onClick={() => handleSelectPresetPhoto(p)}
                  className={`p-2 bg-slate-50 border rounded-xl cursor-pointer ${selectedPhotoPreset?.id === p.id ? 'border-blue-600' : 'border-slate-200'}`}>
                  <img src={p.url} alt={p.name} className="w-full h-24 rounded-xl object-cover" />
                  <span className="text-[10px] font-bold mt-1.5 block text-center truncate">{p.name}</span>
                </div>
              ))}
            </div>

            {selectedPhotoPreset && (
              <div className="grid grid-cols-2 gap-4">
                <div className="relative rounded-xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
                  <img src={selectedPhotoPreset.url} alt="Worksite" className="max-h-full max-w-full object-contain" />
                  {isScanning && (
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-400 shadow-[0_0_12px_#34d399] z-20"
                      style={{ animation: 'scanBeam 2.5s ease-in-out infinite', position: 'absolute' }} />
                  )}
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block font-mono uppercase">Materiales extraídos por IA</span>
                    <p className="text-xs text-slate-400 italic mt-4">Por favor, inicia el escaneo con IA.</p>
                  </div>
                  <button onClick={startPhotoAnalysis} className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl text-[10px] uppercase cursor-pointer">
                    Iniciar Escaneo Láser IA
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ================= DESKTOP: PDF PREVIEW SCREEN =================
  function ScreenPreview() {
    if (!selectedQuoteForPreview) return null;
    const isMaintenanceQuote = /mantenimiento|limpieza.*recurrente|recurrente|contrato/i.test(selectedQuoteForPreview.descripcion);
    const canAccessMaintenance = subscription?.plan === 'empresa_plus' || subscription?.plan === 'empresa';
    const jobForQuote = jobs.find(j => j.quote_id === selectedQuoteForPreview.dbId && j.parte_token);
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 p-4 rounded-xl flex justify-between items-center flex-wrap gap-3">
          <div className="flex gap-2 flex-wrap">
            {jobForQuote?.parte_token && (
              <button
                onClick={() => window.open(`/parte/${jobForQuote.parte_token}`, '_blank')}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                Ver Parte
              </button>
            )}
            <button onClick={() => triggerWhatsAppShare(selectedQuoteForPreview)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer flex items-center gap-1.5">
              💬 WhatsApp
            </button>
            <button onClick={() => printQuote(selectedQuoteForPreview)} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              onClick={() => {
                const cliente = clientes.find(c => c.nombre === selectedQuoteForPreview.nombreCliente);
                downloadAsWordDocx({
                  tipo: 'presupuesto',
                  numero: selectedQuoteForPreview.id,
                  fecha: selectedQuoteForPreview.fecha,
                  clienteNombre: selectedQuoteForPreview.nombreCliente,
                  clienteDireccion: cliente?.direccion,
                  clienteEmail: cliente?.email,
                  clienteTelefono: cliente?.telefono,
                  empresa: empresaAjustes,
                  partidas: selectedQuoteForPreview.partidas,
                  total: selectedQuoteForPreview.total,
                  iva: empresaAjustes.ivaDefault || 21,
                  estado: selectedQuoteForPreview.estado,
                }, selectedQuoteForPreview.id);
              }}
              className="flex items-center gap-1.5 bg-blue-100 hover:bg-blue-200 text-blue-700 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
              title="Descargar como Word editable"
            >
              <FileText className="w-3.5 h-3.5" />
              Word
            </button>
            {selectedQuoteForPreview.estado !== 'Facturado' && (
              <button
                onClick={() => {
                  // Cargar presupuesto en el editor para editar
                  const q = selectedQuoteForPreview;
                  setEditingQuoteId(q.dbId ?? q.id); // usar UUID real para la BD
                  setEditingQuote({
                    id: q.id,
                    nombreCliente: q.nombreCliente,
                    telefonoCliente: q.telefonoCliente ?? '',
                    emailCliente: q.emailCliente ?? '',
                    descripcion: q.descripcion,
                    fecha: q.fecha,
                    partidas: q.partidas ?? [],
                    total: q.total ?? 0,
                    estado: q.estado,
                  });
                  setActiveTab('create_quote');
                }}
                className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            {selectedQuoteForPreview.estado !== 'Facturado' && (
              <button onClick={() => convertQuoteToInvoice(selectedQuoteForPreview)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Convertir en Factura
              </button>
            )}
            {selectedQuoteForPreview.estado !== 'Aceptado' && selectedQuoteForPreview.estado !== 'Facturado' && (
              <button
                onClick={() => generateAcceptanceLink(selectedQuoteForPreview)}
                disabled={generatingLink}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer disabled:opacity-60"
              >
                {generatingLink
                  ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span>🔗</span>}
                Enlace aceptación
              </button>
            )}
            {/* Cambio rápido de estado — el cliente llama y acepta/rechaza */}
            {!['Aceptado','Facturado','Rechazado'].includes(selectedQuoteForPreview.estado) && (
              <button
                onClick={() => markQuoteAs(selectedQuoteForPreview, 'Aceptado')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
                title="El cliente ha llamado y acepta el presupuesto"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aceptado por cliente
              </button>
            )}
            {!['Aceptado','Facturado','Rechazado','Borrador'].includes(selectedQuoteForPreview.estado) && (
              <button
                onClick={() => markQuoteAs(selectedQuoteForPreview, 'Rechazado')}
                className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
                title="El cliente rechaza el presupuesto"
              >
                <X className="w-3.5 h-3.5" />
                Rechazado
              </button>
            )}
            {selectedQuoteForPreview.estado === 'Borrador' && (
              <button
                onClick={() => setShowEnviarModal(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                Enviar al cliente
              </button>
            )}
          </div>
          {/* Estado de aceptación del cliente */}
          {quoteTokenStatus && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide ${
              quoteTokenStatus.status === 'accepted'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : quoteTokenStatus.status === 'rejected'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : 'bg-amber-50 text-amber-600 border border-amber-200'
            }`}>
              {quoteTokenStatus.status === 'accepted' && '✅ Cliente aceptó'}
              {quoteTokenStatus.status === 'rejected' && '❌ Cliente rechazó'}
              {quoteTokenStatus.status === 'pending' && '⏳ Pendiente respuesta'}
              {quoteTokenStatus.accepted_at && (
                <span className="font-normal normal-case ml-1">
                  — {new Date(quoteTokenStatus.accepted_at).toLocaleDateString('es-ES')}
                </span>
              )}
              <button
                onClick={() => {
                  supabase.from('trade_quote_tokens').select('status, accepted_at')
                    .eq('quote_numero', selectedQuoteForPreview.id)
                    .order('created_at', { ascending: false }).limit(1).maybeSingle()
                    .then(({ data }) => setQuoteTokenStatus(data ?? null));
                }}
                className="ml-1 underline font-normal normal-case cursor-pointer hover:no-underline"
              >
                Actualizar
              </button>
            </div>
          )}
          {isMaintenanceQuote && (
            <button
              onClick={() => {
                if (!canAccessMaintenance) { setShowUpgradeModal(true); return; }
                const q = selectedQuoteForPreview!;
                const lineas = q.partidas.map(p => `- ${p.descripcion}`).join('\n');
                const text = `Cliente: ${q.nombreCliente}\n${q.descripcion}\n\nServicios:\n${lineas}\n\nTotal presupuestado: ${q.total?.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) ?? ''}`;
                setMantenimientoInitialText(text);
                setActiveTab('mantenimiento');
              }}
              className={`flex items-center gap-1.5 font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer ${
                canAccessMaintenance
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-200'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              {canAccessMaintenance ? 'Contratar Mantenimiento' : 'Contratar Mantenimiento (Empresa+)'}
            </button>
          )}
        </div>

        {/* Trabajos externalizados vinculados al presupuesto */}
        {orgId && selectedQuoteForPreview.dbId && (
          <div className="bg-white border border-violet-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-wider text-violet-600 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Trabajos externalizados ({previewSubcontratas.length})
              </h3>
              {selectedQuoteForPreview.estado !== 'Facturado' && (
                <button
                  onClick={() => { setDraftSubcontrata({ subcontractor_id: '', descripcion: '', coste: 0, precio_cliente: 0 }); setShowAddSubcontrataModal(true); }}
                  className="flex items-center gap-1 text-[10px] font-bold text-violet-700 border border-violet-200 px-3 py-1.5 rounded-lg hover:bg-violet-50 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Añadir trabajo externalizado
                </button>
              )}
            </div>
            {previewSubcontratas.length === 0 ? (
              <p className="text-xs text-slate-400 italic">{selectedQuoteForPreview.estado === 'Facturado' ? 'Presupuesto ya facturado — sin trabajos externalizados vinculados.' : 'Sin trabajos externalizados en este presupuesto. Añade uno si vas a delegar alguna parte a un proveedor.'}</p>
            ) : (
              <div className="space-y-2">
                {previewSubcontratas.map(s => {
                  const mg = s.precio_cliente > 0 ? ((s.precio_cliente - s.coste) / s.precio_cliente * 100).toFixed(1) : '0';
                  return (
                    <div key={s.id} className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-xl px-3 py-2.5 text-xs gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-800 truncate">{s.descripcion}</p>
                        <p className="text-slate-500 flex items-center gap-1 mt-0.5">
                          <Building2 className="w-2.5 h-2.5" />
                          {s.trade_subcontractors?.nombre ?? '—'}
                          {s.numero && <span className="font-mono text-violet-500 ml-1">{s.numero}</span>}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-slate-700">{s.precio_cliente.toFixed(2)}€</p>
                        <p className="text-[9px] text-slate-400">Coste: {s.coste.toFixed(2)}€ · Margen: {mg}%</p>
                      </div>
                      <button onClick={() => { setActiveTab('subcontratas'); }} className="text-violet-400 hover:text-violet-700 cursor-pointer shrink-0" title="Ver en Externalizados">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <div className="flex justify-between pt-1 text-xs text-slate-500 border-t border-violet-100">
                  <span>Total externalizado (tu coste)</span>
                  <span className="font-bold text-red-600">−{previewSubcontratas.reduce((a, s) => a + s.coste, 0).toFixed(2)}€</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal añadir trabajo externalizado desde presupuesto */}
        {showAddSubcontrataModal && orgId && selectedQuoteForPreview?.dbId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddSubcontrataModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-800">Añadir trabajo externalizado al presupuesto</h3>
                <button onClick={() => setShowAddSubcontrataModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proveedor *</p>
                  <select value={draftSubcontrata.subcontractor_id}
                    onChange={e => setDraftSubcontrata(d => ({ ...d, subcontractor_id: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-400">
                    <option value="">— Selecciona proveedor —</option>
                    {previewProveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.especialidad ? ` · ${p.especialidad}` : ''}</option>)}
                  </select>
                  {previewProveedores.length === 0 && <p className="text-[10px] text-amber-600 mt-1">Sin proveedores — ve a Externalizados › Proveedores para añadir uno</p>}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Descripción del trabajo *</p>
                  <input type="text" value={draftSubcontrata.descripcion}
                    onChange={e => setDraftSubcontrata(d => ({ ...d, descripcion: e.target.value }))}
                    placeholder="Ej: Instalación unidades interiores A/A"
                    className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lo que te cobran (coste)</p>
                    <input type="number" min="0" step="0.01" value={draftSubcontrata.coste}
                      onChange={e => setDraftSubcontrata(d => ({ ...d, coste: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lo que cobras al cliente</p>
                    <input type="number" min="0" step="0.01" value={draftSubcontrata.precio_cliente}
                      onChange={e => setDraftSubcontrata(d => ({ ...d, precio_cliente: parseFloat(e.target.value) || 0 }))}
                      className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-violet-400" />
                  </div>
                </div>
                {(draftSubcontrata.precio_cliente > 0 || draftSubcontrata.coste > 0) && (
                  <div className={`rounded-xl px-4 py-2.5 flex justify-between items-center text-xs ${draftSubcontrata.precio_cliente >= draftSubcontrata.coste ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <span className="font-bold text-slate-600">Tu margen</span>
                    <span className={`font-black ${draftSubcontrata.precio_cliente >= draftSubcontrata.coste ? 'text-emerald-700' : 'text-red-700'}`}>
                      {(draftSubcontrata.precio_cliente - draftSubcontrata.coste).toFixed(2)}€
                      {draftSubcontrata.precio_cliente > 0 && ` (${((draftSubcontrata.precio_cliente - draftSubcontrata.coste) / draftSubcontrata.precio_cliente * 100).toFixed(1)}%)`}
                    </span>
                  </div>
                )}
                <p className="text-[10px] text-slate-400 italic">Se añadirá una línea al presupuesto con el importe al cliente. El coste es solo interno y no aparece en el documento.</p>
              </div>
              <div className="flex gap-3 px-5 py-4 border-t border-slate-100">
                <button onClick={() => setShowAddSubcontrataModal(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
                <button
                  disabled={savingSubcontrata || !draftSubcontrata.subcontractor_id || !draftSubcontrata.descripcion.trim()}
                  onClick={async () => {
                    if (!orgId || !selectedQuoteForPreview?.dbId) return;
                    setSavingSubcontrata(true);
                    try {
                      const saved = await createSubcontrataFromQuote(orgId, selectedQuoteForPreview.dbId, selectedQuoteForPreview.id, {
                        subcontractor_id: draftSubcontrata.subcontractor_id,
                        job_id: null, contract_id: null, quote_id: selectedQuoteForPreview.dbId,
                        descripcion: draftSubcontrata.descripcion,
                        coste: draftSubcontrata.coste,
                        precio_cliente: draftSubcontrata.precio_cliente,
                        estado: 'pendiente',
                        fecha_inicio: null, fecha_fin_prevista: null,
                        importe_factura_recibida: null, fecha_factura_recibida: null,
                        referencia_factura_subcontrata: null, pagado: false, pagado_at: null,
                      });
                      setPreviewSubcontratas(prev => [...prev, saved]);
                      // Actualizar total del presupuesto en el estado local
                      const newTotal = selectedQuoteForPreview.total + draftSubcontrata.precio_cliente;
                      const updatedQuote = { ...selectedQuoteForPreview, total: newTotal, partidas: [...selectedQuoteForPreview.partidas, { descripcion: `Trabajo externalizado — ${draftSubcontrata.descripcion}`, tipo: 'mano_de_obra' as const, cantidad: 1, precioUnitario: draftSubcontrata.precio_cliente, total: draftSubcontrata.precio_cliente }] };
                      setSelectedQuoteForPreview(updatedQuote);
                      setPresupuestos(prev => prev.map(p => p.id === updatedQuote.id ? updatedQuote : p));
                      setShowAddSubcontrataModal(false);
                      showToast(`Trabajo externalizado ${saved.numero ?? ''} añadido al presupuesto`);
                    } catch (e: unknown) { showToast('Error: ' + (e as Error).message, 'error'); }
                    setSavingSubcontrata(false);
                  }}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {savingSubcontrata ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Añadir al presupuesto
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white text-slate-900 p-8 rounded-2xl max-w-2xl mx-auto border shadow-sm">
          <h3 className="font-bold text-sm uppercase text-slate-900 mb-4">{empresaAjustes.nombre}</h3>
          <p className="text-xs text-slate-500 font-mono">Presupuesto {selectedQuoteForPreview.id}</p>
          <div className="h-px bg-slate-200 my-4" />
          <p className="text-xs font-bold text-slate-805">Cliente: {selectedQuoteForPreview.nombreCliente}</p>
          <p className="text-[11px] text-slate-500 mt-2">{selectedQuoteForPreview.descripcion}</p>
          <table className="w-full text-xs text-left border-collapse mt-4">
            <thead>
              <tr className="border-b border-slate-200 font-mono text-[9px] uppercase text-slate-400">
                <th className="py-2">Concepto</th>
                <th className="py-2 text-right w-16">Cant.</th>
                <th className="py-2 text-right w-20">P. Unit.</th>
                <th className="py-2 text-right w-20">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedQuoteForPreview.partidas.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 text-slate-700">
                  <td className="py-2.5">{item.descripcion}</td>
                  <td className="py-2.5 text-right font-mono text-slate-500">{item.cantidad}</td>
                  <td className="py-2.5 text-right font-mono text-slate-500">{Number(item.precioUnitario).toFixed(2)}€</td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">{Number(item.total).toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(() => {
            const ivaPct = selectedQuoteForPreview.iva_pct ?? 21;
            const base = selectedQuoteForPreview.total;
            const ivaImporte = Math.round(base * ivaPct) / 100;
            const totalConIva = Math.round((base + ivaImporte) * 100) / 100;
            return (
              <div className="mt-6 border-t border-slate-200 pt-4 space-y-1 text-xs font-mono">
                <div className="flex justify-between text-slate-500">
                  <span>Base imponible</span>
                  <span>{base.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>IVA {ivaPct}%</span>
                  <span>{ivaImporte.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>TOTAL</span>
                  <span>{totalConIva.toFixed(2)}€</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Modal enviar presupuesto al cliente */}
        {showEnviarModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEnviarModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-800">Enviar presupuesto al cliente</h3>
                <p className="text-xs text-slate-400 mt-0.5">{selectedQuoteForPreview.nombreCliente} — {selectedQuoteForPreview.id}</p>
              </div>
              <div className="p-4 space-y-2">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    setShowEnviarModal(false);
                    triggerWhatsAppShare(selectedQuoteForPreview);
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-200 hover:bg-emerald-50 cursor-pointer text-left transition-all group"
                >
                  <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0 text-white text-base">💬</div>
                  <div>
                    <p className="text-sm font-black text-slate-800">WhatsApp</p>
                    <p className="text-[10px] text-slate-400">Abre WhatsApp con el mensaje y el presupuesto</p>
                    {selectedQuoteForPreview.telefonoCliente && <p className="text-[10px] text-emerald-600 font-bold mt-0.5">{selectedQuoteForPreview.telefonoCliente}</p>}
                  </div>
                </button>

                {/* Email */}
                {selectedQuoteForPreview.emailCliente ? (
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent(`Presupuesto ${selectedQuoteForPreview.id} — ${empresaAjustes.nombre ?? ''}`);
                      const body = encodeURIComponent(
                        `Hola ${selectedQuoteForPreview.nombreCliente},\n\nAdjunto encontrarás el presupuesto ${selectedQuoteForPreview.id} por importe de ${selectedQuoteForPreview.total.toFixed(2)}€.\n\n${selectedQuoteForPreview.descripcion}\n\nQuedo a tu disposición para cualquier consulta.\n\nSaludos,\n${empresaAjustes.nombre ?? ''}`
                      );
                      window.open(`mailto:${selectedQuoteForPreview.emailCliente}?subject=${subject}&body=${body}`, '_blank');
                      markQuoteAs(selectedQuoteForPreview, 'Enviado');
                      setShowEnviarModal(false);
                      showToast('Email abierto — recuerda adjuntar el PDF');
                    }}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-blue-200 hover:bg-blue-50 cursor-pointer text-left transition-all"
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0 text-white">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800">Email</p>
                      <p className="text-[10px] text-slate-400">Abre tu cliente de correo con el mensaje redactado</p>
                      <p className="text-[10px] text-blue-600 font-bold mt-0.5">{selectedQuoteForPreview.emailCliente}</p>
                    </div>
                  </button>
                ) : (
                  <div className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-slate-100 bg-slate-50 text-left opacity-60">
                    <div className="w-9 h-9 rounded-xl bg-slate-300 flex items-center justify-center shrink-0 text-white">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-400">Email</p>
                      <p className="text-[10px] text-slate-400">Sin email registrado para este cliente</p>
                    </div>
                  </div>
                )}

                {/* Solo registrar */}
                <button
                  onClick={() => {
                    markQuoteAs(selectedQuoteForPreview, 'Enviado');
                    setShowEnviarModal(false);
                    showToast('Presupuesto marcado como enviado');
                  }}
                  className="w-full flex items-center gap-3 p-4 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer text-left transition-all"
                >
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-600">Solo registrar como enviado</p>
                    <p className="text-[10px] text-slate-400">Lo envié por otro canal (teléfono, en persona…)</p>
                  </div>
                </button>
              </div>
              <div className="px-5 pb-4">
                <button onClick={() => setShowEnviarModal(false)} className="w-full py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-400">Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= DESKTOP: CRM SCREEN =================
  function ScreenCRM() {
    const avatarColors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-indigo-500', 'bg-teal-500', 'bg-orange-500'];
    const getAvatarColor = (name: string) => avatarColors[name.charCodeAt(0) % avatarColors.length];
    const getInitials = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase();

    const panelClient = crmPanelClientId ? clientes.find(c => c.id === crmPanelClientId) ?? null : null;
    const panelInvoices = crmPanelClientId ? (crmClientInvoices[crmPanelClientId] ?? null) : null;
    const panelQuotes = panelClient ? presupuestos.filter(p => p.nombreCliente === panelClient.nombre) : [];
    const panelJobs = panelClient ? jobs.filter(j => j.client_id === panelClient.id) : [];

    const openPanel = (clientId: string) => {
      setCrmPanelClientId(clientId);
      setCrmPanelTab('facturas');
      if (!crmClientInvoices[clientId] && isLiveMode && orgId) {
        supabase
          .from('trade_invoices')
          .select('numero, fecha, total, estado, concepto')
          .eq('org_id', orgId)
          .eq('client_id', clientId)
          .order('fecha', { ascending: false })
          .limit(30)
          .then(({ data }) => setCrmClientInvoices(prev => ({ ...prev, [clientId]: data ?? [] })));
      }
    };

    return (
      <div className="space-y-4">
        {/* Cabecera: buscador + botón nuevo cliente */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => { setNewClient({ nombre: '', telefono: '', email: '', direccion: '' }); setIsClientModalOpen(true); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2.5 font-bold uppercase tracking-wider text-[10px] cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Cliente
          </button>
        </div>

        {/* Contador */}
        <p className="text-xs text-slate-400">{filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}</p>

        {/* Lista compacta */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {filteredClientes.length === 0 ? (
            <div className="text-center py-14 text-slate-400 text-sm">
              {searchQuery ? 'Sin resultados para esa búsqueda.' : 'No hay clientes todavía. Crea el primero arriba.'}
            </div>
          ) : (
            filteredClientes.map((c, idx) => {
              const clientJobs = jobs.filter(j => j.client_id === c.id);
              const clientInvoiceCount = crmClientInvoices[c.id]?.length ?? null;
              const totalCobrado = (crmClientInvoices[c.id] ?? []).filter(i => i.estado === 'Pagada').reduce((s, i) => s + i.total, 0);
              return (
                <div
                  key={c.id}
                  onClick={() => openPanel(c.id)}
                  className={`flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${idx > 0 ? 'border-t border-slate-100' : ''}`}
                >
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(c.nombre)} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-xs font-black">{getInitials(c.nombre)}</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{c.nombre}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      {c.telefono && <span className="text-xs text-slate-500">{c.telefono}</span>}
                      {c.email && <span className="text-xs text-slate-400 truncate">{c.email}</span>}
                    </div>
                  </div>
                  {/* Stats */}
                  <div className="flex items-center gap-5 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold font-mono text-emerald-600">{c.totalFacturado > 0 ? `${c.totalFacturado.toFixed(0)}€` : '—'}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">facturado</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-700">{clientJobs.length}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">trabajos</p>
                    </div>
                    {clientInvoiceCount !== null && (
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-700">{clientInvoiceCount}</p>
                        <p className="text-[9px] text-slate-400 uppercase tracking-wider">facturas</p>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── PANEL LATERAL ───────────────────────────────────────────────────── */}
        {crmPanelClientId && panelClient && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/25 z-40" onClick={() => setCrmPanelClientId(null)} />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200">

              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 shrink-0">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full ${getAvatarColor(panelClient.nombre)} flex items-center justify-center shrink-0`}>
                      <span className="text-white text-sm font-black">{getInitials(panelClient.nombre)}</span>
                    </div>
                    <div>
                      <h2 className="font-black text-base text-slate-900 leading-tight">{panelClient.nombre}</h2>
                      {panelClient.direccion && <p className="text-xs text-slate-500 mt-0.5">{panelClient.direccion}</p>}
                    </div>
                  </div>
                  <button onClick={() => setCrmPanelClientId(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 cursor-pointer">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Contacto */}
                <div className="flex gap-2 mb-4">
                  {panelClient.telefono && (
                    <a href={`tel:${panelClient.telefono}`} className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                      <Phone className="w-3.5 h-3.5" /> Llamar
                    </a>
                  )}
                  {panelClient.telefono && (
                    <a href={`https://wa.me/${panelClient.telefono.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-white text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      style={{ backgroundColor: '#25D366' }}>
                      <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                  {panelClient.email && (
                    <button onClick={() => setEmailModalCliente(panelClient)}
                      className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl cursor-pointer transition-colors">
                      <Mail className="w-3.5 h-3.5" /> Email
                    </button>
                  )}
                </div>

                {/* Acciones principales */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => { setEditingQuote(prev => ({ ...prev, nombreCliente: panelClient.nombre, telefonoCliente: panelClient.telefono, emailCliente: panelClient.email })); setActiveTab('create_quote'); setCrmPanelClientId(null); }}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <FilePlus className="w-3.5 h-3.5" /> Nuevo presupuesto
                  </button>
                  <button
                    onClick={() => { setActiveTab('planificacion'); setCrmPanelClientId(null); }}
                    className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-colors"
                  >
                    <Briefcase className="w-3.5 h-3.5" /> Nuevo trabajo
                  </button>
                </div>
              </div>

              {/* Resumen stats */}
              <div className="flex border-b border-slate-100 shrink-0">
                <div className="flex-1 px-4 py-3 text-center">
                  <p className="text-sm font-black text-emerald-600 font-mono">{panelClient.totalFacturado > 0 ? `${panelClient.totalFacturado.toFixed(0)}€` : '—'}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Total facturado</p>
                </div>
                <div className="flex-1 px-4 py-3 text-center border-l border-slate-100">
                  <p className="text-sm font-black text-slate-700">{panelJobs.length}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Trabajos</p>
                </div>
                <div className="flex-1 px-4 py-3 text-center border-l border-slate-100">
                  <p className="text-sm font-black text-slate-700">{panelQuotes.length}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Presupuestos</p>
                </div>
                <div className="flex-1 px-4 py-3 text-center border-l border-slate-100">
                  <p className="text-sm font-black text-slate-700">{panelInvoices?.length ?? '…'}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-0.5">Facturas</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-100 shrink-0">
                {(['facturas', 'presupuestos', 'trabajos'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setCrmPanelTab(tab)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                      crmPanelTab === tab
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Facturas ── */}
                {crmPanelTab === 'facturas' && (
                  <div className="divide-y divide-slate-100">
                    {panelInvoices === null ? (
                      <div className="py-10 text-center text-sm text-slate-400">Cargando…</div>
                    ) : panelInvoices.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-400">Sin facturas todavía</div>
                    ) : (
                      panelInvoices.map((inv, idx) => {
                        const estadoDot: Record<string, string> = {
                          Pagada: 'bg-emerald-500', Vencida: 'bg-red-500',
                          Emitida: 'bg-blue-500', Pendiente: 'bg-amber-400',
                          Borrador: 'bg-slate-300', Cancelada: 'bg-slate-300',
                        };
                        const estadoText: Record<string, string> = {
                          Pagada: 'text-emerald-600', Vencida: 'text-red-600',
                          Emitida: 'text-blue-600', Pendiente: 'text-amber-600',
                          Borrador: 'text-slate-400', Cancelada: 'text-slate-400',
                        };
                        return (
                          <div key={idx} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${estadoDot[inv.estado] ?? 'bg-amber-400'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-bold text-slate-800 font-mono">{inv.estado === 'Borrador' ? '—' : inv.numero}</span>
                                <span className="text-xs text-slate-400">{inv.fecha}</span>
                              </div>
                              {inv.concepto && <p className="text-xs text-slate-500 truncate mt-0.5">{inv.concepto}</p>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-bold text-slate-900 font-mono">{inv.total.toFixed(0)}€</p>
                                <span className={`text-[9px] font-bold uppercase ${estadoText[inv.estado] ?? 'text-amber-600'}`}>{inv.estado}</span>
                              </div>
                              {inv.estado !== 'Borrador' && (
                                <button
                                  onClick={() => printTradeInvoice(
                                    { ...inv, numero: inv.numero ?? '', subtotal: inv.total / 1.21, iva_pct: 21, iva_importe: inv.total - inv.total / 1.21 } as Parameters<typeof printTradeInvoice>[0],
                                    [],
                                    { nombre: orgData?.nombre, nif: orgData?.nif, direccion: orgData?.direccion, ciudad: (orgData as unknown as Record<string, unknown>)?.ciudad as string, telefono: orgData?.telefono, email: orgData?.email, logo_url: orgData?.logo_url },
                                  )}
                                  className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                                  title="Ver / Imprimir PDF"
                                >
                                  <FileText className="w-3 h-3" /> PDF
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ── Presupuestos ── */}
                {crmPanelTab === 'presupuestos' && (
                  <div className="divide-y divide-slate-100">
                    {panelQuotes.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-400">Sin presupuestos todavía</div>
                    ) : (
                      panelQuotes.map(p => (
                        <div
                          key={p.id}
                          onClick={() => { setSelectedQuoteForPreview(p as Presupuesto); setActiveTab('preview'); setCrmPanelClientId(null); }}
                          className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                p.estado === 'Aceptado'  ? 'bg-emerald-100 text-emerald-700' :
                                p.estado === 'Facturado' ? 'bg-blue-100 text-blue-700' :
                                p.estado === 'Enviado'   ? 'bg-amber-100 text-amber-700' :
                                                           'bg-slate-100 text-slate-500'
                              }`}>{p.estado}</span>
                              <span className="text-xs text-slate-400">{p.fecha}</span>
                            </div>
                            <p className="text-sm text-slate-800 truncate">{p.descripcion || p.id}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900 font-mono">{(p.total * 1.21).toFixed(0)}€</p>
                            <span className="text-[9px] text-blue-500 font-bold">Ver →</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* ── Trabajos ── */}
                {crmPanelTab === 'trabajos' && (
                  <div className="divide-y divide-slate-100">
                    {panelJobs.length === 0 ? (
                      <div className="py-10 text-center text-sm text-slate-400">Sin trabajos registrados</div>
                    ) : (
                      panelJobs.map(j => (
                        <div key={j.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{j.titulo}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              {j.fecha_inicio && <span className="text-xs text-slate-400">{j.fecha_inicio}</span>}
                              {j.localidad && <span className="text-xs text-slate-400">· {j.localidad}</span>}
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg shrink-0 ${
                            j.estado === 'completado'        ? 'bg-emerald-100 text-emerald-700' :
                            j.estado === 'en_curso'          ? 'bg-blue-100 text-blue-700' :
                            j.estado === 'pendiente_material'? 'bg-orange-100 text-orange-700' :
                            j.estado === 'cancelado'         ? 'bg-red-100 text-red-700' :
                                                               'bg-slate-100 text-slate-500'
                          }`}>{j.estado.replace('_', ' ')}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    );
  }

  // ================= DESKTOP: INVOICES SCREEN =================
  // ── Generador de PDF (HTML nativo + window.print) ────────────────────────────
  function buildDocumentHTML(opts: {
    tipo: 'presupuesto' | 'factura';
    numero: string;
    fecha: string;
    fechaVencimiento?: string;
    clienteNombre: string;
    clienteDireccion?: string;
    clienteEmail?: string;
    clienteTelefono?: string;
    empresa: typeof empresaAjustes;
    logoUrl?: string;
    partidas: PartidaPresupuesto[];
    total: number;
    iva: number;
    estado?: string;
    notas?: string;
  }) {
    const totalIVA = opts.total * (opts.iva / 100);
    const totalConIVA = opts.total + totalIVA;
    const esFactura = opts.tipo === 'factura';
    const accentColor = esFactura ? '#7c3aed' : '#2563eb';
    const rows = opts.partidas.map((p, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
        <td style="padding:9px 8px;font-size:11.5px;color:#334155;border-bottom:1px solid #f1f5f9">${p.descripcion}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:center;color:#64748b;border-bottom:1px solid #f1f5f9">${p.cantidad}</td>
        <td style="padding:9px 8px;font-size:11px;text-align:right;color:#475569;border-bottom:1px solid #f1f5f9">${p.precioUnitario.toFixed(2)}€</td>
        <td style="padding:9px 8px;font-size:11.5px;text-align:right;font-weight:700;color:#0f172a;border-bottom:1px solid #f1f5f9">${p.total.toFixed(2)}€</td>
      </tr>`).join('');

    const logoHtml = opts.logoUrl
      ? `<img src="${opts.logoUrl}" alt="Logo" style="max-height:64px;max-width:200px;object-fit:contain;display:block;margin-bottom:8px" />`
      : '';

    const clienteLines = [
      `<div style="font-size:12.5px;font-weight:700;color:#0f172a">${opts.clienteNombre}</div>`,
      opts.clienteDireccion ? `<div style="font-size:11px;color:#64748b;margin-top:2px">${opts.clienteDireccion}</div>` : '',
      opts.clienteEmail ? `<div style="font-size:11px;color:#64748b">${opts.clienteEmail}</div>` : '',
      opts.clienteTelefono ? `<div style="font-size:11px;color:#64748b">Tel: ${opts.clienteTelefono}</div>` : '',
    ].filter(Boolean).join('');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>${esFactura ? 'Factura' : 'Presupuesto'} ${opts.numero}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;padding:48px 56px;max-width:800px;margin:auto;font-size:12px}
        @media print{body{padding:24px 32px}button{display:none!important}.page-break{page-break-before:always}}
        .print-btn{position:fixed;top:16px;right:16px;background:${accentColor};color:#fff;border:none;padding:10px 22px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
        .top-bar{height:6px;background:linear-gradient(90deg,${accentColor},${esFactura ? '#a855f7' : '#06b6d4'});margin:-48px -56px 40px;border-radius:0}
        @media print{.top-bar{margin:-24px -32px 32px}}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
        .company-name{font-size:18px;font-weight:800;color:#0f172a;letter-spacing:-0.3px}
        .company-sub{font-size:11px;color:#64748b;line-height:1.6;margin-top:4px}
        .doc-pill{background:${accentColor};color:#fff;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;padding:4px 14px;border-radius:99px;display:inline-block;margin-bottom:8px}
        .doc-number{font-size:22px;font-weight:900;color:#0f172a;font-family:monospace;letter-spacing:-0.5px}
        .doc-meta{font-size:10.5px;color:#94a3b8;margin-top:4px;line-height:1.7}
        .divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
        .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
        .info-box{background:#f8fafc;border-radius:10px;padding:14px 16px}
        .info-label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:800;letter-spacing:1.2px;margin-bottom:6px}
        table{width:100%;border-collapse:collapse;margin-bottom:20px;border-radius:10px;overflow:hidden}
        thead{background:${accentColor}}
        thead th{padding:10px 8px;font-size:9.5px;text-transform:uppercase;color:rgba(255,255,255,.9);font-weight:700;letter-spacing:1px}
        .totals-box{background:#f8fafc;border-radius:12px;padding:16px 20px;width:260px;margin-left:auto;margin-bottom:32px}
        .totals-row{display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#475569}
        .totals-row.final{border-top:1px solid #e2e8f0;margin-top:8px;padding-top:10px;font-size:15px;font-weight:900;color:#0f172a}
        .badge{display:inline-block;padding:3px 12px;border-radius:99px;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px}
        .badge-pending{background:#fef3c7;color:#92400e}
        .badge-paid{background:#d1fae5;color:#065f46}
        .badge-overdue{background:#fee2e2;color:#991b1b}
        .badge-draft{background:#f1f5f9;color:#475569}
        .footer{text-align:center;font-size:10px;color:#cbd5e1;padding-top:20px;border-top:1px solid #f1f5f9}
        .notes-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:11px;color:#78350f}
      </style>
    </head><body>
      <button class="print-btn" onclick="window.print()">Descargar PDF</button>
      <div class="top-bar"></div>

      <div class="header">
        <div>
          ${logoHtml}
          <div class="company-name">${opts.empresa.nombre || 'Mi Empresa'}</div>
          <div class="company-sub">
            ${opts.empresa.nif ? `NIF: ${opts.empresa.nif}<br>` : ''}
            ${opts.empresa.direccion ? `${opts.empresa.direccion}${opts.empresa.localidad ? `, ${opts.empresa.localidad}` : ''}${opts.empresa.cp ? ` ${opts.empresa.cp}` : ''}<br>` : ''}
            ${opts.empresa.email ? `${opts.empresa.email}` : ''}${opts.empresa.telefonoMovil ? ` · Tel: ${opts.empresa.telefonoMovil}` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div class="doc-pill">${esFactura ? 'Factura' : 'Presupuesto'}</div>
          <div class="doc-number">${opts.numero}</div>
          <div class="doc-meta">
            Fecha: ${opts.fecha}<br>
            ${opts.fechaVencimiento ? `Vencimiento: ${opts.fechaVencimiento}<br>` : ''}
            ${opts.estado ? `<span class="badge ${opts.estado === 'Pagada' ? 'badge-paid' : opts.estado === 'Pendiente' ? 'badge-pending' : opts.estado === 'Vencida' ? 'badge-overdue' : 'badge-draft'}">${opts.estado}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">Emisor</div>
          <div style="font-size:12.5px;font-weight:700;color:#0f172a">${opts.empresa.nombre || '—'}</div>
          ${opts.empresa.nif ? `<div style="font-size:11px;color:#64748b">NIF: ${opts.empresa.nif}</div>` : ''}
          ${opts.empresa.provincia ? `<div style="font-size:11px;color:#64748b">${opts.empresa.provincia}</div>` : ''}
        </div>
        <div class="info-box">
          <div class="info-label">Cliente</div>
          ${clienteLines || '<div style="font-size:12px;color:#64748b">—</div>'}
        </div>
      </div>

      ${opts.notas ? `<div class="notes-box"><strong>Notas:</strong> ${opts.notas}</div>` : ''}

      <table>
        <thead><tr>
          <th style="text-align:left;width:48%">Descripción</th>
          <th style="text-align:center;width:10%">Cant.</th>
          <th style="text-align:right;width:20%">Precio unit.</th>
          <th style="text-align:right;width:22%">Subtotal</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-box">
        <div class="totals-row"><span>Base imponible</span><span>${opts.total.toFixed(2)}€</span></div>
        <div class="totals-row"><span>IVA ${opts.iva}%</span><span>${totalIVA.toFixed(2)}€</span></div>
        <div class="totals-row final"><span>TOTAL</span><span>${totalConIVA.toFixed(2)}€</span></div>
      </div>

      <div class="footer">
        Generado con TradeFlow AI · ${opts.empresa.nombre || ''}${opts.empresa.email ? ` · ${opts.empresa.email}` : ''}
      </div>
    </body></html>`;
  }

  function printDocument(html: string) {
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { showToast('Permite ventanas emergentes para generar el PDF', 'error'); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }

  function printQuote(presupuesto: Presupuesto) {
    const cliente = clientes.find(c => c.nombre === presupuesto.nombreCliente);
    const html = buildDocumentHTML({
      tipo: 'presupuesto',
      numero: presupuesto.id,
      fecha: presupuesto.fecha,
      clienteNombre: presupuesto.nombreCliente,
      clienteDireccion: cliente?.direccion,
      clienteEmail: cliente?.email || presupuesto.emailCliente,
      clienteTelefono: cliente?.telefono || presupuesto.telefonoCliente,
      empresa: empresaAjustes,
      logoUrl: orgData?.logo_url ?? undefined,
      partidas: presupuesto.partidas,
      total: presupuesto.total,
      iva: empresaAjustes.ivaDefault || 21,
      estado: presupuesto.estado,
    });
    printDocument(html);
  }

  function printInvoice(factura: Factura) {
    const cliente = clientes.find(c => c.nombre === factura.nombreCliente);
    const quotePartidas = presupuestos.find(p => p.id === factura.idPresupuesto)?.partidas ?? [];
    const partidas: PartidaPresupuesto[] = quotePartidas.length > 0
      ? quotePartidas
      : factura.concepto
        ? [{ descripcion: factura.concepto, tipo: 'mano_de_obra', cantidad: 1, precioUnitario: factura.importe, total: factura.importe }]
        : [];
    const html = buildDocumentHTML({
      tipo: 'factura',
      numero: factura.numeroFactura,
      fecha: factura.fecha,
      fechaVencimiento: factura.fechaVencimiento,
      clienteNombre: factura.nombreCliente,
      clienteDireccion: cliente?.direccion,
      clienteEmail: cliente?.email,
      clienteTelefono: cliente?.telefono,
      empresa: empresaAjustes,
      logoUrl: orgData?.logo_url ?? undefined,
      partidas,
      total: factura.importe,
      iva: empresaAjustes.ivaDefault || 21,
      estado: factura.estado,
    });
    printDocument(html);
  }

  // ── Pantalla Facturas (desktop) ───────────────────────────────────────────────
  function ScreenInvoices() {
    const today = new Date();
    const in15 = new Date(today); in15.setDate(today.getDate() + 15);
    const in30 = new Date(today); in30.setDate(today.getDate() + 30);
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd   = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Maintenance future invoices belong in Mantenimientos, not Facturación.
    // Show maintenance invoices here only if: overdue, devuelta, or due within current month.
    const facturasFacturacion = facturas.filter(f => {
      if (!f.esMantenimineto) return true;
      if (f.estado === 'Vencida' || f.estado === 'Devuelta' || f.estado === 'Pagada') return true;
      if (f.estado === 'Pendiente' && f.fechaVencimiento) {
        const v = new Date(f.fechaVencimiento);
        return v >= currentMonthStart && v <= currentMonthEnd;
      }
      return false;
    });

    const pendiente = facturasFacturacion.filter(f => f.estado === 'Pendiente' || f.estado === 'Vencida').reduce((s, f) => s + f.importe * 1.21, 0);
    const cobradoTotal = facturasFacturacion.filter(f => f.estado === 'Pagada').reduce((s, f) => s + f.importe * 1.21, 0);
    const vencidas = facturasFacturacion.filter(f => f.estado === 'Vencida').length;
    const devueltas = facturasFacturacion.filter(f => f.estado === 'Devuelta');

    // Próximas a cobrar: pendientes con vencimiento en los próximos 15 días
    const proximas = facturasFacturacion
      .filter(f => f.estado === 'Pendiente' && f.fechaVencimiento)
      .filter(f => {
        const v = new Date(f.fechaVencimiento);
        return v >= today && v <= in15;
      })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    // Próximas renovaciones anuales: dentro de 30 días
    const renovaciones = facturasFacturacion
      .filter(f => f.estado === 'Pendiente' && f.fechaVencimiento)
      .filter(f => {
        const v = new Date(f.fechaVencimiento);
        return v > in15 && v <= in30;
      })
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));

    const filtered = filterEstado === 'todas' ? facturasFacturacion : facturasFacturacion.filter(f => f.estado === filterEstado);
    const sorted = [...filtered].sort((a, b) => {
      const order: Record<string, number> = { Vencida: 0, Pendiente: 1, Devuelta: 2, Pagada: 3 };
      return (order[a.estado] ?? 1) - (order[b.estado] ?? 1);
    });

    const estadoBadge = (estado: string) => {
      if (estado === 'Pagada') return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      if (estado === 'Vencida') return 'bg-red-500/10 text-red-500 border border-red-500/20';
      if (estado === 'Devuelta') return 'bg-orange-500/10 text-orange-600 border border-orange-500/20';
      return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
    };

    const diasHasta = (dateStr: string) => {
      const diff = Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000);
      return diff;
    };

    return (
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Pendiente de cobro', value: `${pendiente.toFixed(0)}€`, color: 'text-amber-600' },
            { label: 'Total cobrado', value: `${cobradoTotal.toFixed(0)}€`, color: 'text-emerald-600' },
            { label: 'Vencidas', value: String(vencidas), color: vencidas > 0 ? 'text-red-500' : 'text-slate-400' },
            { label: 'Devueltas', value: String(devueltas.length), color: devueltas.length > 0 ? 'text-orange-500' : 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">{s.label}</span>
              <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Próximas a cobrar — 15 días */}
        {proximas.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                Próximas a cobrar — {proximas.length} factura{proximas.length !== 1 ? 's' : ''} en 15 días
              </span>
              <span className="ml-auto text-xs font-bold font-mono text-amber-700">
                {proximas.reduce((s, f) => s + f.importe * 1.21, 0).toFixed(0)}€
              </span>
            </div>
            <div className="space-y-2">
              {proximas.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-white border border-amber-100 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-slate-700">{f.numeroFactura}</span>
                    <span className="text-[10px] text-slate-500 ml-2 truncate">{f.nombreCliente}</span>
                  </div>
                  <span className="text-[10px] text-amber-700 font-semibold shrink-0">
                    Vence en {diasHasta(f.fechaVencimiento)} días
                  </span>
                  <span className="text-[11px] font-bold font-mono text-slate-800 shrink-0">
                    {(f.importe * 1.21).toFixed(0)}€
                  </span>
                  <button
                    onClick={() => handleRemindInvoice(f)}
                    className="text-[9px] px-2 py-1 bg-green-100 text-green-700 rounded font-bold cursor-pointer hover:bg-green-200 transition-colors shrink-0"
                  >
                    💬 WA
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertas renovación 30 días */}
        {renovaciones.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Próximas renovaciones — {renovaciones.length} factura{renovaciones.length !== 1 ? 's' : ''} en 30 días
              </span>
            </div>
            <div className="space-y-1.5">
              {renovaciones.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-white border border-blue-100 rounded-lg px-3 py-1.5">
                  <span className="font-mono text-[10px] font-bold text-slate-700 flex-1">{f.numeroFactura} — {f.nombreCliente}</span>
                  <span className="text-[10px] text-blue-700 font-semibold shrink-0">en {diasHasta(f.fechaVencimiento)} días</span>
                  <span className="text-[11px] font-bold font-mono text-slate-800 shrink-0">{(f.importe * 1.21).toFixed(0)}€</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Devueltas */}
        {devueltas.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
                Facturas devueltas — {devueltas.length}
              </span>
            </div>
            <div className="space-y-2">
              {devueltas.map(f => (
                <div key={f.id} className="flex items-center gap-3 bg-white border border-orange-100 rounded-lg px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-[10px] font-bold text-slate-700">{f.numeroFactura}</span>
                    <span className="text-[10px] text-slate-500 ml-2">{f.nombreCliente}</span>
                  </div>
                  <span className="text-[11px] font-bold font-mono text-orange-700">{(f.importe * 1.21).toFixed(0)}€</span>
                  <button
                    onClick={() => handleRemindInvoice(f)}
                    className="text-[9px] px-2 py-1 bg-green-100 text-green-700 rounded font-bold cursor-pointer hover:bg-green-200 transition-colors"
                  >
                    💬 WA
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-2 flex-wrap">
          {(['todas', 'Pendiente', 'Pagada', 'Vencida', 'Devuelta'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterEstado(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                filterEstado === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-slate-500 hover:text-slate-900'
              }`}
            >
              {f === 'todas' ? `Todas (${facturas.length})` : `${f} (${facturas.filter(x => x.estado === f).length})`}
            </button>
          ))}
        </div>

        {/* Lista */}
        {sorted.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            {filterEstado === 'todas' ? 'No hay facturas aún. Convierte un presupuesto aceptado en factura.' : `No hay facturas con estado "${filterEstado}".`}
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(f => (
              <div key={f.id} className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-slate-900">{f.numeroFactura}</span>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${estadoBadge(f.estado)}`}>{f.estado}</span>
                    </div>
                    <span className="font-semibold text-xs text-slate-700 block truncate">{f.nombreCliente}</span>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>Emitida: {f.fecha}</span>
                      {f.fechaVencimiento && <span>Vence: {f.fechaVencimiento}</span>}
                    </div>
                  </div>
                  {/* Importe */}
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-mono uppercase">Total c/IVA</span>
                    <span className="text-lg font-bold font-mono text-slate-900">{(f.importe * 1.21).toFixed(2)}€</span>
                    <span className="text-[9px] text-slate-400 block font-mono">{f.importe.toFixed(2)}€ + IVA</span>
                  </div>
                </div>
                {/* Acciones */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 flex-wrap">
                  <button
                    onClick={() => printInvoice(f)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => {
                      const cliente = clientes.find(c => c.nombre === f.nombreCliente);
                      const quotePartidas = presupuestos.find(p => p.id === f.idPresupuesto)?.partidas ?? [];
                      const partidas = quotePartidas.length > 0 ? quotePartidas : f.concepto ? [{ descripcion: f.concepto, tipo: 'mano_de_obra' as const, cantidad: 1, precioUnitario: f.importe, total: f.importe }] : [];
                      downloadAsWordDocx({ tipo: 'factura', numero: f.numeroFactura, fecha: f.fecha, fechaVencimiento: f.fechaVencimiento, clienteNombre: f.nombreCliente, clienteDireccion: cliente?.direccion, clienteEmail: cliente?.email, empresa: empresaAjustes, partidas, total: f.importe, iva: empresaAjustes.ivaDefault || 21, estado: f.estado }, f.numeroFactura);
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 text-[9px] font-bold uppercase tracking-wider hover:bg-blue-200 cursor-pointer transition-colors"
                    title="Descargar como Word editable"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Word
                  </button>
                  <button
                    onClick={() => handleRemindInvoice(f)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    💬 WhatsApp
                  </button>
                  {f.estado !== 'Pagada' && f.estado !== 'Devuelta' && (
                    <button
                      onClick={() => handlePayInvoice(f.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ml-auto"
                    >
                      💰 Registrar Pago
                    </button>
                  )}
                  {f.estado === 'Pagada' && (
                    <button
                      onClick={() => handleMarkDevuelta(f.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ml-auto"
                    >
                      ↩ Devuelta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  async function handleSaveNewProduct() {
    if (!addProductDraft.descripcion.trim() || !addProductDraft.familia.trim()) {
      showToast('Descripción y familia son obligatorias', 'error');
      return;
    }
    setSavingAddProduct(true);
    try {
      const precio = parseFloat(addProductDraft.precio) || 0;
      if (isLiveMode && orgId) {
        const saved = await addTarifa(orgId, {
          codigo: addProductDraft.codigo.trim() || undefined,
          familia: addProductDraft.familia.trim(),
          descripcion: addProductDraft.descripcion.trim(),
          precio_base: precio,
          unidad: addProductDraft.unidad,
        });
        setTarifas(prev => [...prev, {
          id: saved.id,
          codigo: saved.codigo ?? '',
          familia: saved.familia,
          descripcion: saved.descripcion,
          precioBase: saved.precio_base,
          unidad: saved.unidad,
          activo: saved.activo,
        }]);
      }
      setShowAddProductModal(false);
      setAddProductDraft({ codigo: '', familia: '', descripcion: '', precio: '', unidad: 'ud' });
      showToast('Producto añadido al catálogo ✓', 'success');
    } catch (e: unknown) {
      showToast('Error al guardar: ' + (e as Error).message, 'error');
    }
    setSavingAddProduct(false);
  }

  // ================= DESKTOP: CATALOG SCREEN =================
  function ScreenCatalog() {
    const calidades: Record<TradeCatalogVariant['calidad'], { label: string; cls: string }> = {
      economico: { label: 'Económico', cls: 'bg-slate-100 text-slate-600' },
      medio:     { label: 'Preferido', cls: 'bg-blue-100 text-blue-700' },
      premium:   { label: 'Premium',   cls: 'bg-amber-100 text-amber-700' },
    };

    const filtered = catalogProducts.filter(p =>
      p.nombre_generico.toLowerCase().includes(catalogFilter.toLowerCase()) ||
      p.familia.toLowerCase().includes(catalogFilter.toLowerCase()) ||
      (p.subfamilia ?? '').toLowerCase().includes(catalogFilter.toLowerCase())
    );

    const byFamily = filtered.reduce<Record<string, TradeCatalogProduct[]>>((acc, p) => {
      const key = `${p.oficio} › ${p.familia}`;
      (acc[key] = acc[key] ?? []).push(p);
      return acc;
    }, {});

    const handleSetPreferred = async (variantId: string, productId: string) => {
      setSavingVariant(variantId);
      try {
        if (isLiveMode && orgId) {
          await setPreferredVariant(variantId, productId, orgId);
        }
        setCatalogProducts(prev => prev.map(p => {
          if (p.id !== productId) return p;
          return {
            ...p,
            trade_catalog_variants: p.trade_catalog_variants?.map(v => ({
              ...v, is_preferred: v.id === variantId,
            })),
          };
        }));
        showToast('Variante preferida actualizada ✓', 'success');
      } catch (e: any) {
        showToast('Error: ' + e.message, 'error');
      }
      setSavingVariant(null);
    };

    const handleSaveVariantPrice = async (variant: TradeCatalogVariant, newPrice: number) => {
      setSavingVariant(variant.id);
      try {
        if (isLiveMode) {
          await updateCatalogVariant(variant.id, { precio_material: newPrice });
        }
        setCatalogProducts(prev => prev.map(p => ({
          ...p,
          trade_catalog_variants: p.trade_catalog_variants?.map(v =>
            v.id === variant.id ? { ...v, precio_venta: newPrice } : v
          ),
        })));
        setEditingVariant(null);
        showToast('Precio actualizado ✓', 'success');
      } catch (e: any) {
        showToast('Error al guardar: ' + e.message, 'error');
      }
      setSavingVariant(null);
    };

    const handleSaveTarifaPrice = async (id: string, newPrice: number) => {
      setSavingTarifaId(id);
      try {
        if (isLiveMode) await updateTarifaPrice(id, newPrice);
        setTarifas(prev => prev.map(t => t.id === id ? { ...t, precioBase: newPrice } : t));
        showToast('Precio actualizado ✓', 'success');
      } catch (e: any) {
        showToast('Error al guardar: ' + e.message, 'error');
      }
      setEditingTarifaId(null);
      setSavingTarifaId(null);
    };

    if (!isLiveMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16 space-y-4 text-center px-8">
          <Package className="h-12 w-12 text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Catálogo de productos</h3>
          <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
            Inicia sesión con tus datos reales para ver y gestionar tu catálogo de productos y precios.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase px-5 py-2.5 rounded-lg cursor-pointer"
          >
            Acceder con datos reales
          </button>
        </div>
      );
    }

    // User's custom price list (trade_tarifas — imported via Excel)
    const activeTarifas = tarifas.filter(t => t.activo);
    const allFamilies = [...new Set(activeTarifas.map(t => t.familia))].sort();
    const filteredTarifas = activeTarifas.filter(t => {
      const matchText = !catalogFilter ||
        t.descripcion.toLowerCase().includes(catalogFilter.toLowerCase()) ||
        t.familia.toLowerCase().includes(catalogFilter.toLowerCase()) ||
        (t.codigo ?? '').toLowerCase().includes(catalogFilter.toLowerCase());
      const matchFamily = catalogFamilyFilter.size === 0 || catalogFamilyFilter.has(t.familia);
      return matchText && matchFamily;
    });
    const tarifasByFamily = filteredTarifas.reduce<Record<string, TarifaItem[]>>((acc, t) => {
      (acc[t.familia] = acc[t.familia] ?? []).push(t);
      return acc;
    }, {});
    const hasTarifas = activeTarifas.length > 0;

    const toggleFamily = (f: string) => {
      setCatalogFamilyFilter(prev => {
        const next = new Set(prev);
        if (next.has(f)) next.delete(f); else next.add(f);
        return next;
      });
    };

    // Helpers inline
    const flattenCatalog = (): TradeTarifa[] =>
      catalogProducts.map(p => {
        const pref = p.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
          ?? p.trade_catalog_variants?.find(v => v.activo);
        return {
          id: p.id, org_id: p.org_id, codigo: undefined,
          familia: `${p.oficio} — ${p.familia}`,
          descripcion: p.nombre_generico,
          precio_base: pref?.precio_venta ?? 0,
          unidad: p.unidad, activo: p.activo,
          created_at: p.created_at, updated_at: p.updated_at,
        };
      });

    const handleExportCatalogFromTab = async () => {
      let items: TradeTarifa[];
      if (hasTarifas) {
        items = activeTarifas.map(t => ({
          id: t.id, org_id: orgId ?? '', codigo: t.codigo || undefined,
          familia: t.familia, descripcion: t.descripcion,
          precio_base: t.precioBase, unidad: t.unidad, activo: t.activo,
          created_at: '', updated_at: '',
        }));
      } else {
        items = catalogProducts.length > 0 ? flattenCatalog() : [];
      }
      if (items.length === 0) { showToast('No hay productos para exportar', 'info'); return; }
      const wb = generateExportWorkbook(items);
      downloadWorkbook(wb, `catalogo-trabflow-${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast(`Catálogo exportado: ${items.length} productos ✓`, 'success');
    };

    return (
      <div className="p-5 space-y-5 overflow-y-auto h-full">

        {/* Header barra */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto, familia..."
              value={catalogFilter}
              onChange={e => setCatalogFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            {hasTarifas
              ? `${filteredTarifas.length} referencias`
              : `${filtered.length} productos · ${catalogProducts.reduce((s, p) => s + (p.trade_catalog_variants?.length ?? 0), 0)} variantes`}
          </span>
          {catalogFamilyFilter.size > 0 && (
            <button onClick={() => setCatalogFamilyFilter(new Set())} className="text-[9px] text-blue-400 hover:text-blue-300 font-bold uppercase cursor-pointer underline whitespace-nowrap">
              Limpiar filtro ({catalogFamilyFilter.size})
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => isLiveMode ? setShowGlobalCatalog(true) : showToast('Disponible solo con cuenta activa', 'info')}
              className="flex items-center gap-1 bg-[#FFC400] hover:brightness-110 text-[#020B16] text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              title="Importar desde catálogo base TradeFlow"
            >
              <Globe className="h-3 w-3" />
              Catálogo Base
            </button>
            <button
              onClick={() => {
                setAddProductDraft({ codigo: '', familia: catalogFamilyFilter.size === 1 ? [...catalogFamilyFilter][0] : '', descripcion: '', precio: '', unidad: 'ud' });
                setShowAddProductModal(true);
              }}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              title="Añadir producto manualmente"
            >
              <Plus className="h-3 w-3" />
              Añadir
            </button>
            <button
              onClick={() => setShowCatalogImport(true)}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              title="Importar desde Excel"
            >
              <Upload className="h-3 w-3" />
              Importar
            </button>
            <button
              onClick={handleExportCatalogFromTab}
              className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              title="Exportar a Excel"
            >
              <FileText className="h-3 w-3" />
              Exportar
            </button>
            <button
              onClick={() => { const wb = generateTemplateWorkbook(); downloadWorkbook(wb, 'plantilla-catalogo-trabflow.xlsx'); showToast('Plantilla descargada ✓', 'success'); }}
              className="flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-100 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              title="Descargar plantilla Excel vacía"
            >
              <FilePlus className="h-3 w-3" />
              Plantilla
            </button>
          </div>
        </div>

        {/* Filtro por familia/sector — dropdown multiselect */}
        {hasTarifas && allFamilies.length > 1 && (
          <div className="relative">
            <button
              onClick={() => { setShowCatalogFamilyDropdown(p => !p); setCatalogFamilySearch(''); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-all w-full sm:w-auto"
            >
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <span>
                {catalogFamilyFilter.size === 0
                  ? `Todos los sectores (${allFamilies.length})`
                  : catalogFamilyFilter.size === 1
                    ? `${[...catalogFamilyFilter][0]}`
                    : `${catalogFamilyFilter.size} sectores seleccionados`}
              </span>
              {catalogFamilyFilter.size > 0 && (
                <span className="bg-blue-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-bold">
                  {catalogFamilyFilter.size}
                </span>
              )}
              <ChevronDown className={`h-3 w-3 ml-auto text-slate-400 transition-transform ${showCatalogFamilyDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showCatalogFamilyDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCatalogFamilyDropdown(false)} />
                <div className="absolute top-full left-0 mt-1 z-50 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden">
                  {/* Search */}
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Buscar sector..."
                      value={catalogFamilySearch}
                      onChange={e => setCatalogFamilySearch(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-[11px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:border-blue-400 text-slate-700 dark:text-slate-200"
                    />
                  </div>
                  {/* Todos */}
                  <div className="max-h-64 overflow-y-auto">
                    <button
                      onClick={() => setCatalogFamilyFilter(new Set())}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-700 ${catalogFamilyFilter.size === 0 ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${catalogFamilyFilter.size === 0 ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'}`}>
                        {catalogFamilyFilter.size === 0 && <Check className="h-2.5 w-2.5 text-white" />}
                      </div>
                      <span className="flex-1">Todos los sectores</span>
                      <span className="text-slate-400 text-[10px]">{activeTarifas.length}</span>
                    </button>
                    {allFamilies
                      .filter(f => !catalogFamilySearch || f.toLowerCase().includes(catalogFamilySearch.toLowerCase()))
                      .map(f => {
                        const count = activeTarifas.filter(t => t.familia === f).length;
                        const active = catalogFamilyFilter.has(f);
                        return (
                          <button
                            key={f}
                            onClick={() => toggleFamily(f)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-[11px] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${active ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20' : 'text-slate-600 dark:text-slate-300'}`}
                          >
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${active ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-500'}`}>
                              {active && <Check className="h-2.5 w-2.5 text-white" />}
                            </div>
                            <span className="flex-1 truncate">{f}</span>
                            <span className="text-slate-400 text-[10px] flex-shrink-0">{count}</span>
                          </button>
                        );
                      })}
                  </div>
                  {/* Footer */}
                  {catalogFamilyFilter.size > 0 && (
                    <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => { setCatalogFamilyFilter(new Set()); setShowCatalogFamilyDropdown(false); }}
                        className="w-full text-[10px] text-slate-400 hover:text-red-500 cursor-pointer transition-colors py-1"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Modales importación */}
        {showCatalogImport && (
          <CatalogImportModal
            orgId={orgId}
            isLiveMode={isLiveMode}
            onDone={(inserted, updated, errors) => {
              setShowCatalogImport(false);
              showToast(`Catálogo importado: ${inserted} nuevos, ${updated} actualizados${errors > 0 ? `, ${errors} errores` : ''}`, errors > 0 ? 'info' : 'success');
              if (isLiveMode && orgId) {
                loadTarifas(orgId).then(data => setTarifas(data.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo }))));
              }
            }}
            onClose={() => setShowCatalogImport(false)}
          />
        )}
        {showGlobalCatalog && orgId && (
          <GlobalCatalogModal
            orgId={orgId}
            onDone={(imported) => {
              setShowGlobalCatalog(false);
              showToast(imported > 0 ? `${imported} productos importados al catálogo ✓` : 'Todos los productos ya estaban en tu catálogo', imported > 0 ? 'success' : 'info');
              if (imported > 0 && isLiveMode) {
                loadTarifas(orgId).then(data => setTarifas(data.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo }))));
              }
            }}
            onClose={() => setShowGlobalCatalog(false)}
          />
        )}

        {/* Mi catálogo de precios — productos importados vía Excel (trade_tarifas) */}
        {hasTarifas && Object.entries(tarifasByFamily).map(([family, items]) => (
          <div key={family} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{family}</span>
              <span className="ml-auto text-[9px] text-slate-400 font-mono">{items.length} referencias</span>
            </div>
            <div className="divide-y divide-slate-100">
              {items.map(t => (
                <div key={t.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                  {t.codigo && <span className="text-[9px] font-mono text-slate-400 w-20 shrink-0 truncate">{t.codigo}</span>}
                  <span className="flex-1 text-xs text-slate-800 truncate">{t.descripcion}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {editingTarifaId === t.id ? (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          defaultValue={t.precioBase}
                          onBlur={e => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val !== t.precioBase) handleSaveTarifaPrice(t.id, val);
                            else setEditingTarifaId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setEditingTarifaId(null);
                          }}
                          className="w-24 bg-white border border-blue-400 rounded px-2 py-1 text-xs font-bold font-mono text-slate-800 focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-400">€</span>
                      </>
                    ) : (
                      <>
                        <span className="font-bold font-mono text-sm text-slate-900 whitespace-nowrap">{t.precioBase.toFixed(2)} €</span>
                        {savingTarifaId === t.id
                          ? <RotateCcw className="h-3 w-3 text-blue-400 animate-spin" />
                          : <button onClick={() => setEditingTarifaId(t.id)} className="text-slate-300 hover:text-blue-500 cursor-pointer transition-colors p-0.5" title="Editar precio"><Edit3 className="h-3 w-3" /></button>
                        }
                      </>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-400 w-8 text-right shrink-0">{t.unidad}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Catálogo base IA TradeFlow (trade_catalog_products) — sección colapsable */}
        {catalogProducts.length > 0 && (
          <details className="group">
            {hasTarifas && (
              <summary className="cursor-pointer list-none flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono py-2 select-none hover:text-slate-600 border-t border-slate-200 pt-4">
                <Sparkles className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                Catálogo base IA TradeFlow ({catalogProducts.length} productos con variantes)
                <span className="ml-auto text-[9px] normal-case font-normal">Mostrar / ocultar ▾</span>
              </summary>
            )}
            <div className="space-y-3 mt-2">
              {Object.entries(byFamily).map(([family, products]) => (
                <div key={family} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
                    <Tag className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{family}</span>
                    <span className="ml-auto text-[9px] text-slate-400 font-mono">{products.length} productos</span>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {products.map(product => {
                      const variants = product.trade_catalog_variants ?? [];
                      return (
                        <div key={product.id} className="px-4 py-3">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="font-semibold text-xs text-slate-800">{product.nombre_generico}</span>
                              {product.subfamilia && (
                                <span className="ml-2 text-[9px] text-slate-400 font-mono">{product.subfamilia}</span>
                              )}
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">{product.unidad}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {(['economico', 'medio', 'premium'] as TradeCatalogVariant['calidad'][]).map(cal => {
                              const v = variants.find(vv => vv.calidad === cal);
                              if (!v) return null;
                              const { label, cls } = calidades[cal];
                              const isEditing = editingVariant?.id === v.id;
                              const isSaving = savingVariant === v.id;
                              return (
                                <div
                                  key={v.id}
                                  className={`border rounded-lg p-2.5 space-y-1.5 transition-all ${
                                    v.is_preferred
                                      ? 'border-blue-400 bg-blue-50/50'
                                      : 'border-slate-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className={`text-[8.5px] font-bold uppercase px-1.5 py-0.5 rounded ${cls}`}>{label}</span>
                                    {v.is_preferred && (
                                      <span className="flex items-center gap-0.5 text-[8px] text-blue-500 font-bold">
                                        <StarIcon className="h-2.5 w-2.5 fill-blue-500" /> Preferido
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-slate-400 truncate font-mono">{v.marca}{v.modelo ? ` · ${v.modelo}` : ''}</div>
                                  <div className="flex items-center gap-1.5">
                                    {isEditing ? (
                                      <>
                                        <input
                                          type="number"
                                          step="0.01"
                                          autoFocus
                                          defaultValue={v.precio_venta}
                                          onBlur={e => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val !== v.precio_venta) handleSaveVariantPrice(v, val);
                                            else setEditingVariant(null);
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                            if (e.key === 'Escape') setEditingVariant(null);
                                          }}
                                          className="w-20 bg-white border border-blue-400 rounded px-2 py-1 text-xs font-bold font-mono text-slate-800 focus:outline-none"
                                        />
                                        <span className="text-[9px] text-slate-400">€</span>
                                      </>
                                    ) : (
                                      <>
                                        <span className="font-bold font-mono text-sm text-slate-900">
                                          {v.precio_venta.toFixed(2)}€
                                        </span>
                                        <button
                                          onClick={() => setEditingVariant({ id: v.id, field: 'precio_venta', value: String(v.precio_venta) })}
                                          className="text-slate-400 hover:text-blue-500 cursor-pointer transition-colors p-0.5"
                                          title="Editar precio"
                                        >
                                          <Edit3 className="h-3 w-3" />
                                        </button>
                                      </>
                                    )}
                                    {isSaving && <RotateCcw className="h-3 w-3 text-blue-400 animate-spin" />}
                                  </div>
                                  <div className="text-[8.5px] text-slate-400 space-y-0.5">
                                    <div className="flex justify-between">
                                      <span>Material</span>
                                      <span className="font-mono">{v.precio_material.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Mano obra</span>
                                      <span className="font-mono">{v.precio_mano_obra.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>Margen</span>
                                      <span className="font-mono">{v.margen_pct}%</span>
                                    </div>
                                  </div>
                                  {!v.is_preferred && (
                                    <button
                                      onClick={() => handleSetPreferred(v.id, product.id)}
                                      disabled={!!savingVariant}
                                      className="w-full text-[8.5px] font-bold uppercase text-slate-400 hover:text-blue-500 border border-slate-200 hover:border-blue-400 rounded py-1 cursor-pointer transition-all disabled:opacity-40"
                                    >
                                      Usar como preferido
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}

        {/* Catálogos de proveedores activados (trade_supplier_products) */}
        {activeSupplierCatalogs.filter(sc => sc.products.length > 0).map(sc => {
          const filtered = sc.products.filter(p =>
            !catalogFilter ||
            p.descripcion.toLowerCase().includes(catalogFilter.toLowerCase()) ||
            (p.familia ?? '').toLowerCase().includes(catalogFilter.toLowerCase()) ||
            (p.ref_proveedor ?? '').toLowerCase().includes(catalogFilter.toLowerCase()) ||
            (p.marca ?? '').toLowerCase().includes(catalogFilter.toLowerCase())
          );
          if (filtered.length === 0) return null;
          const byFam = filtered.reduce<Record<string, typeof filtered>>((acc, p) => {
            const key = p.familia ?? 'Sin familia';
            (acc[key] = acc[key] ?? []).push(p);
            return acc;
          }, {});
          return (
            <details key={sc.catalog_id} className="group" open>
              <summary className="cursor-pointer list-none flex items-center gap-2 py-2 select-none hover:opacity-80">
                <div className="flex items-center gap-2 flex-1">
                  <Truck className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 font-mono">
                    {sc.supplier_name}
                  </span>
                  <span className="bg-emerald-100 text-emerald-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Activo
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    +{sc.margen_pct}% margen
                  </span>
                  <span className="ml-auto text-[9px] text-slate-400 font-mono">{filtered.length} referencias</span>
                  <ChevronDown className="h-3 w-3 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                </div>
              </summary>
              <div className="space-y-3 mt-2">
                {Object.entries(byFam).map(([fam, items]) => (
                  <div key={fam} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200">
                      <Tag className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">{fam}</span>
                      <span className="ml-auto text-[9px] text-slate-400 font-mono">{items.length} referencias</span>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {items.map(p => {
                        const precioVenta = p.precio_coste * (1 + sc.margen_pct / 100);
                        return (
                          <div key={p.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50/50 transition-colors">
                            {p.ref_proveedor && (
                              <span className="text-[9px] font-mono text-slate-400 w-20 shrink-0 truncate">{p.ref_proveedor}</span>
                            )}
                            <span className="flex-1 text-xs text-slate-800 truncate">{p.descripcion}</span>
                            {p.marca && (
                              <span className="text-[9px] text-slate-400 shrink-0">{p.marca}</span>
                            )}
                            <div className="flex flex-col items-end shrink-0">
                              <span className="font-bold font-mono text-sm text-slate-900 whitespace-nowrap">{precioVenta.toFixed(2)} €</span>
                              <span className="text-[9px] text-slate-400 font-mono">coste {p.precio_coste.toFixed(2)} €</span>
                            </div>
                            <span className="text-[9px] text-slate-400 w-8 text-right shrink-0">{p.unidad}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          );
        })}

        {/* Estado vacío */}
        {!hasTarifas && catalogProducts.length === 0 && activeSupplierCatalogs.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-xs">No hay productos en el catálogo todavía.</p>
          </div>
        )}
      </div>
    );
  }

  // ================= DESKTOP: SETTINGS SCREEN =================
  function ScreenSettings() {
    const inp = "w-full bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const lbl = "text-[9px] uppercase font-mono block text-slate-400 mb-1";
    const sec = "bg-white border border-slate-200 p-5 rounded-xl space-y-4";
    const secTitle = "font-black uppercase text-xs text-slate-400 pb-2 border-b border-slate-100";

    const FAMILIAS = ['Mano de Obra','Fontanería','Electricidad','Reformas','Climatización','Madera / Carpintería','Cerrajería','Pintura','Albañilería','General'];
    const UNIDADES = ['ud','h','m','m²','m³','kg','l','ml','par','jgo'];
    const ROL_LABELS: Record<TrabajadorItem['rol'], string> = { tecnico: 'Técnico', admin: 'Admin', comercial: 'Comercial' };

    const filteredTarifas = tarifas.filter(t =>
      t.descripcion.toLowerCase().includes(tarifaFilter.toLowerCase()) ||
      t.familia.toLowerCase().includes(tarifaFilter.toLowerCase()) ||
      t.codigo.toLowerCase().includes(tarifaFilter.toLowerCase())
    );

    const handleSaveFiscal = async () => {
      if (!isLiveMode || !orgId) { showToast('Datos guardados (demo)', 'success'); return; }
      const { error } = await supabase.from('trade_organizations').update({
        nombre: empresaAjustes.nombre,
        nif: empresaAjustes.nif,
        email: empresaAjustes.email,
        telefono_fijo: empresaAjustes.telefonoFijo,
        telefono_movil: empresaAjustes.telefonoMovil,
        direccion: empresaAjustes.direccion,
        localidad: empresaAjustes.localidad,
        cp: empresaAjustes.cp,
        provincia: empresaAjustes.provincia,
        pais: empresaAjustes.pais,
        iva_default: empresaAjustes.ivaDefault,
        iban: empresaAjustes.iban || null,
        banco: empresaAjustes.banco || null,
        titular_cuenta: empresaAjustes.titularCuenta || null,
      }).eq('id', orgId);
      if (error) { showToast('Error al guardar: ' + error.message, 'error'); return; }
      setOrgData(prev => prev ? {
        ...prev,
        iban: empresaAjustes.iban || null,
        banco: empresaAjustes.banco || null,
        titular_cuenta: empresaAjustes.titularCuenta || null,
      } as typeof prev : prev);
      showToast('Datos fiscales y bancarios guardados ✓', 'success');
    };

    const handleAddWorker = async () => {
      if (!newWorkerDraft.nombre.trim()) return;
      if (isLiveMode && orgId) {
        try {
          const saved = await addWorker(orgId, newWorkerDraft);
          setTrabajadores(prev => [...prev, { id: saved.id, nombre: saved.nombre, telefono: saved.telefono ?? '', email: saved.email ?? '', rol: saved.rol as TrabajadorItem['rol'], activo: true }]);
          showToast('Trabajador añadido ✓', 'success');
        } catch (e: any) {
          showToast('Error al guardar: ' + e.message, 'error');
          return;
        }
      } else {
        setTrabajadores(prev => [...prev, { id: Date.now().toString(), ...newWorkerDraft, activo: true }]);
        showToast('Trabajador añadido (demo) ✓', 'success');
      }
      setNewWorkerDraft({ nombre: '', telefono: '', email: '', rol: 'tecnico' });
      setShowAddWorker(false);
    };

    const handleDeleteWorker = async (id: string) => {
      setTrabajadores(prev => prev.filter(w => w.id !== id));
      if (isLiveMode) {
        try { await deleteWorker(id); } catch { /* ignorar */ }
      }
    };

    const handleAddTarifa = async () => {
      if (!newTarifaDraft.descripcion.trim()) return;
      if (isLiveMode && orgId) {
        try {
          const saved = await addTarifa(orgId, { codigo: newTarifaDraft.codigo, familia: newTarifaDraft.familia, descripcion: newTarifaDraft.descripcion, precio_base: newTarifaDraft.precioBase, unidad: newTarifaDraft.unidad });
          setTarifas(prev => [...prev, { id: saved.id, codigo: saved.codigo ?? '', familia: saved.familia, descripcion: saved.descripcion, precioBase: saved.precio_base, unidad: saved.unidad, activo: true }]);
          showToast('Tarifa añadida ✓', 'success');
        } catch (e: any) {
          showToast('Error al guardar: ' + e.message, 'error');
          return;
        }
      } else {
        setTarifas(prev => [...prev, { id: Date.now().toString(), ...newTarifaDraft, activo: true }]);
        showToast('Tarifa añadida (demo) ✓', 'success');
      }
      setNewTarifaDraft({ codigo: '', familia: 'General', descripcion: '', precioBase: 0, unidad: 'ud' });
      setShowAddTarifa(false);
    };

    const handleDeleteTarifa = async (id: string) => {
      setTarifas(prev => prev.filter(t => t.id !== id));
      if (isLiveMode) {
        try { await deleteTarifa(id); } catch { /* ignorar */ }
      }
    };

    const handleExportCatalog = async () => {
      let items: TradeTarifa[];
      if (catalogProducts.length > 0) {
        items = catalogProducts.map(p => {
          const pref = p.trade_catalog_variants?.find(v => v.is_preferred && v.activo)
            ?? p.trade_catalog_variants?.find(v => v.activo);
          return {
            id: p.id, org_id: p.org_id, codigo: undefined,
            familia: `${p.oficio} — ${p.familia}`,
            descripcion: p.nombre_generico,
            precio_base: pref?.precio_venta ?? 0,
            unidad: p.unidad, activo: p.activo,
            created_at: p.created_at, updated_at: p.updated_at,
          };
        });
      } else if (isLiveMode && orgId) {
        items = await exportCatalog(orgId);
      } else {
        items = tarifas.map(t => ({
          id: t.id, org_id: orgId ?? '', codigo: t.codigo || undefined,
          familia: t.familia, descripcion: t.descripcion, precio_base: t.precioBase,
          unidad: t.unidad, activo: t.activo,
          created_at: '', updated_at: '',
        }));
      }
      const wb = generateExportWorkbook(items);
      downloadWorkbook(wb, `catalogo-trabflow-${new Date().toISOString().split('T')[0]}.xlsx`);
      showToast('Catálogo exportado ✓', 'success');
    };

    const handleDownloadTemplate = () => {
      const wb = generateTemplateWorkbook();
      downloadWorkbook(wb, 'plantilla-catalogo-trabflow.xlsx');
      showToast('Plantilla descargada ✓', 'success');
    };

    const handleCatalogImportDone = async (inserted: number, updated: number, errors: number) => {
      setShowCatalogImport(false);
      showToast(`Catálogo importado: ${inserted} nuevos, ${updated} actualizados${errors > 0 ? `, ${errors} errores` : ''}`, errors > 0 ? 'info' : 'success');
      if (isLiveMode && orgId) {
        try {
          const data = await loadTarifas(orgId);
          setTarifas(data.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo })));
        } catch { /* no bloquear */ }
      }
    };

    return (
      <div className="space-y-5">

        {/* ── 1. Datos fiscales ── */}
        <div className={sec}>
          <h3 className={secTitle}>Datos Fiscales y de Empresa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={lbl}>Razón Social / Nombre autónomo</span>
              <input type="text" className={inp} value={empresaAjustes.nombre}
                onChange={e => setEmpresaAjustes(p => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>NIF / CIF</span>
              <input type="text" className={`${inp} font-mono uppercase`} value={empresaAjustes.nif}
                onChange={e => setEmpresaAjustes(p => ({ ...p, nif: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>Email de contacto</span>
              <input type="email" className={inp} value={empresaAjustes.email}
                onChange={e => setEmpresaAjustes(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>IVA por defecto (%)</span>
              <input type="number" min={0} max={100} className={`${inp} font-mono`} value={empresaAjustes.ivaDefault}
                onChange={e => setEmpresaAjustes(p => ({ ...p, ivaDefault: Number(e.target.value) }))} />
            </div>
            <div>
              <span className={lbl}>Teléfono fijo</span>
              <input type="tel" className={inp} placeholder="954 000 000" value={empresaAjustes.telefonoFijo}
                onChange={e => setEmpresaAjustes(p => ({ ...p, telefonoFijo: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>Teléfono móvil (WhatsApp)</span>
              <input type="tel" className={inp} placeholder="600 000 000" value={empresaAjustes.telefonoMovil}
                onChange={e => setEmpresaAjustes(p => ({ ...p, telefonoMovil: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <span className={lbl}>Dirección (calle y número)</span>
              <input type="text" className={inp} placeholder="Calle Mayor 1" value={empresaAjustes.direccion}
                onChange={e => setEmpresaAjustes(p => ({ ...p, direccion: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>Localidad</span>
              <input type="text" className={inp} value={empresaAjustes.localidad}
                onChange={e => setEmpresaAjustes(p => ({ ...p, localidad: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>Código Postal</span>
              <input type="text" className={`${inp} font-mono`} maxLength={5} value={empresaAjustes.cp}
                onChange={e => setEmpresaAjustes(p => ({ ...p, cp: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>Provincia</span>
              <input type="text" className={inp} value={empresaAjustes.provincia}
                onChange={e => setEmpresaAjustes(p => ({ ...p, provincia: e.target.value }))} />
            </div>
            <div>
              <span className={lbl}>País</span>
              <input type="text" className={inp} value={empresaAjustes.pais}
                onChange={e => setEmpresaAjustes(p => ({ ...p, pais: e.target.value }))} />
            </div>
          </div>
          <button onClick={handleSaveFiscal}
            className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
            Guardar datos fiscales y bancarios
          </button>
        </div>

        {/* ── 1b. Datos bancarios ── */}
        <div className={sec}>
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2 8.5A2.5 2.5 0 014.5 6h15A2.5 2.5 0 0122 8.5v1H2v-1zM2 11h20v7a2 2 0 01-2 2H4a2 2 0 01-2-2v-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 15h3M6 18h2" />
              </svg>
            </div>
            <div>
              <h3 className="font-black uppercase text-xs text-slate-700 tracking-wide">Datos de cobro</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">Cuenta bancaria que aparecerá automáticamente en contratos de mantenimiento</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-3">
              <span className={lbl}>IBAN (para domiciliación bancaria)</span>
              <input
                type="text"
                className={inp}
                placeholder="ES00 0000 0000 00 0000000000"
                value={empresaAjustes.iban}
                onChange={e => setEmpresaAjustes(p => ({ ...p, iban: e.target.value.toUpperCase() }))}
                maxLength={34}
              />
            </div>
            <div>
              <span className={lbl}>Entidad bancaria</span>
              <input type="text" className={inp} placeholder="Ej. CaixaBank" value={empresaAjustes.banco}
                onChange={e => setEmpresaAjustes(p => ({ ...p, banco: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <span className={lbl}>Titular de la cuenta</span>
              <input type="text" className={inp} placeholder="Nombre del titular (si difiere del nombre fiscal)" value={empresaAjustes.titularCuenta}
                onChange={e => setEmpresaAjustes(p => ({ ...p, titularCuenta: e.target.value }))} />
            </div>
          </div>
          <p className="text-[9px] text-slate-400">
            💡 Estos datos se usan al generar contratos de mantenimiento. Se guardan con el botón de arriba.
          </p>
        </div>

        {/* ── 2. Precios & Márgenes ── */}
        <div className={sec}>
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-black uppercase text-xs text-slate-700 tracking-wide">Precios & Márgenes</h3>
              <p className="text-[9px] text-slate-400 mt-0.5">Variables globales aplicadas automáticamente a todos los presupuestos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Valor hora operario */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Hora operario</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} step={0.5}
                  value={empresaAjustes.valorHoraOperario}
                  onChange={e => setEmpresaAjustes(p => ({ ...p, valorHoraOperario: parseFloat(e.target.value) || 0 }))}
                  className="w-20 bg-white border border-amber-300 rounded-lg px-2.5 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-500 font-mono">€ / hora</span>
              </div>
              <p className="text-[9px] text-slate-500">Coste de mano de obra. El asistente de voz lo aplica automáticamente.</p>
            </div>

            {/* Margen materiales */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-emerald-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Margen piezas</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={200} step={1}
                  value={empresaAjustes.margenMateriales}
                  onChange={e => setEmpresaAjustes(p => ({ ...p, margenMateriales: parseFloat(e.target.value) || 0 }))}
                  className="w-20 bg-white border border-emerald-300 rounded-lg px-2.5 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-slate-500 font-mono">%</span>
              </div>
              <p className="text-[9px] text-slate-500">Porcentaje añadido al precio de catálogo en todos los presupuestos.</p>
              {empresaAjustes.margenMateriales > 0 && (
                <p className="text-[9px] text-emerald-700 font-mono font-bold bg-emerald-100 rounded px-2 py-1">
                  Ej: grifo 75€ → {(75 * (1 + empresaAjustes.margenMateriales / 100)).toFixed(2)}€
                </p>
              )}
            </div>

            {/* Descuento cliente habitual */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">Dto. habitual</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number" min={0} max={100} step={1}
                  value={empresaAjustes.descuentoCliente}
                  onChange={e => setEmpresaAjustes(p => ({ ...p, descuentoCliente: parseFloat(e.target.value) || 0 }))}
                  className="w-20 bg-white border border-blue-300 rounded-lg px-2.5 py-2 text-sm font-bold font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs text-slate-500 font-mono">%</span>
              </div>
              <p className="text-[9px] text-slate-500">Descuento disponible para clientes habituales. Lo aplicas en cada presupuesto.</p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-1.5">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase block">¿Cómo se aplican?</span>
            <ul className="text-[10px] text-slate-500 space-y-1 leading-relaxed">
              <li>• <span className="font-bold text-amber-600">Hora operario:</span> el asistente de voz usa {empresaAjustes.valorHoraOperario}€/h para calcular mano de obra</li>
              <li>• <span className="font-bold text-emerald-600">Margen piezas:</span> precio catálogo × (1 + {empresaAjustes.margenMateriales}%) — se aplica en todos los presupuestos al hacer matching con tu catálogo</li>
              <li>• <span className="font-bold text-blue-600">Descuento habitual:</span> -{empresaAjustes.descuentoCliente}% — lo aplicas manualmente en el paso de revisión cuando convenga</li>
            </ul>
          </div>
          <p className="text-[9px] text-slate-400 italic">Los cambios se guardan automáticamente en este dispositivo.</p>
        </div>

        {/* ── 3. Trabajadores ── */}
        <div className={sec}>
          <div className="flex items-center justify-between">
            <h3 className={secTitle}>Trabajadores y Técnicos</h3>
            <button onClick={() => setShowAddWorker(p => !p)}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors">
              <Plus className="h-3 w-3" />
              {showAddWorker ? 'Cancelar' : 'Añadir'}
            </button>
          </div>

          {trabajadores.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Nombre','Móvil','Email','Rol','Estado',''].map(h => (
                      <th key={h} className="text-left text-[9px] uppercase font-mono text-slate-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {trabajadores.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50">
                      <td className="py-2 pr-3 font-semibold text-slate-800 whitespace-nowrap">{w.nombre}</td>
                      <td className="py-2 pr-3 text-slate-500 font-mono whitespace-nowrap">{w.telefono || '—'}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[140px] truncate">{w.email || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap">
                          {ROL_LABELS[w.rol]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap ${w.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                          {w.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="py-2">
                        <button onClick={() => handleDeleteWorker(w.id)} className="text-red-400 hover:text-red-300 cursor-pointer transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {trabajadores.length === 0 && !showAddWorker && (
            <p className="text-slate-400 text-xs text-center py-4">No hay trabajadores registrados. Añade el primer técnico.</p>
          )}

          {showAddWorker && (
            <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
              <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Nuevo trabajador</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className={lbl}>Nombre completo *</span>
                  <input type="text" className={inp} placeholder="Ej. Antonio Ruiz"
                    value={newWorkerDraft.nombre} onChange={e => setNewWorkerDraft(p => ({ ...p, nombre: e.target.value }))} />
                </div>
                <div>
                  <span className={lbl}>Teléfono móvil (app)</span>
                  <input type="tel" className={inp} placeholder="600 000 000"
                    value={newWorkerDraft.telefono} onChange={e => setNewWorkerDraft(p => ({ ...p, telefono: e.target.value }))} />
                </div>
                <div>
                  <span className={lbl}>Email (login TrabFlow)</span>
                  <input type="email" className={inp} placeholder="tecnico@empresa.com"
                    value={newWorkerDraft.email} onChange={e => setNewWorkerDraft(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <span className={lbl}>Rol</span>
                  <select className={inp} value={newWorkerDraft.rol}
                    onChange={e => setNewWorkerDraft(p => ({ ...p, rol: e.target.value as TrabajadorItem['rol'] }))}>
                    <option value="tecnico">Técnico (en obra)</option>
                    <option value="admin">Administrador</option>
                    <option value="comercial">Comercial</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddWorker} disabled={!newWorkerDraft.nombre.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer">
                  Añadir trabajador
                </button>
                <button onClick={() => setShowAddWorker(false)}
                  className="border border-slate-200 text-slate-500 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Catálogo de precios ── */}
        <div className={sec}>
          <h3 className={secTitle}>Catálogo de Productos</h3>

          {/* Banner explicativo */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4">
            <Package className="h-8 w-8 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs font-bold text-slate-800">
                {catalogProducts.length > 0
                  ? `${catalogProducts.length} productos · ${catalogProducts.reduce((s, p) => s + (p.trade_catalog_variants?.length ?? 0), 0)} variantes cargados`
                  : isLiveMode
                    ? 'Catálogo vacío — importa tus productos o créalos desde el tab Catálogo'
                    : '33 productos · 99 variantes (demo)'}
              </p>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Tu catálogo IA tiene productos con <strong>3 variantes de calidad</strong> (Económico · Preferido · Premium).
                La IA usa el catálogo al generar presupuestos por voz — los precios que ves son los que se aplican automáticamente.
                Gestiona precios, variante preferida e importa/exporta desde el tab <strong>Catálogo</strong>.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('catalog')}
              className="shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-bold uppercase tracking-wider px-3 py-2 rounded-lg cursor-pointer transition-colors"
            >
              Ir al catálogo →
            </button>
          </div>

          {/* Accesos rápidos import/export */}
          <div>
            <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block mb-2">Importar / Exportar</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => isLiveMode ? setShowGlobalCatalog(true) : showToast('Disponible solo con cuenta activa', 'info')}
                className={`flex items-center gap-1 text-[#020B16] text-[9px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-colors ${isLiveMode ? 'bg-[#FFC400] hover:brightness-110 cursor-pointer' : 'bg-[#FFC400]/40 cursor-not-allowed'}`}
              >
                <Globe className="h-3 w-3" />
                Catálogo Base
              </button>
              <button
                onClick={() => isLiveMode ? setShowCatalogImport(true) : showToast('Disponible solo con cuenta activa', 'info')}
                className={`flex items-center gap-1 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-colors ${isLiveMode ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer' : 'bg-emerald-600/40 cursor-not-allowed'}`}
              >
                <Upload className="h-3 w-3" />
                Importar Excel
              </button>
              <button
                onClick={() => isLiveMode ? handleExportCatalog() : showToast('Disponible solo con cuenta activa', 'info')}
                className={`flex items-center gap-1 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg transition-colors ${isLiveMode ? 'bg-slate-700 hover:bg-slate-600 cursor-pointer' : 'bg-slate-700/40 cursor-not-allowed'}`}
              >
                <FileText className="h-3 w-3" />
                Exportar Excel
              </button>
              <button
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 border border-slate-300 text-slate-600 hover:bg-slate-50 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <FilePlus className="h-3 w-3" />
                Plantilla Excel
              </button>
            </div>
          </div>

          {showCatalogImport && (
            <CatalogImportModal
              orgId={orgId}
              isLiveMode={isLiveMode}
              onDone={handleCatalogImportDone}
              onClose={() => setShowCatalogImport(false)}
            />
          )}
          {showGlobalCatalog && orgId && (
            <GlobalCatalogModal
              orgId={orgId}
              onDone={(imported) => {
                setShowGlobalCatalog(false);
                showToast(`${imported > 0 ? `${imported} productos importados al catálogo ✓` : 'Todos los productos ya estaban en tu catálogo'}`, imported > 0 ? 'success' : 'info');
                if (imported > 0 && isLiveMode) loadTarifas(orgId).then(data => setTarifas(data.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo }))));
              }}
              onClose={() => setShowGlobalCatalog(false)}
            />
          )}
        </div>

        {/* ── 4. Suscripción ── */}
        <div className={sec}>
          <h3 className={secTitle}>Suscripción</h3>
          {subscription ? (() => {
            const PLAN_META: Record<string, { label: string; price_monthly: number; price_yearly: number; colorText: string; colorBg: string; colorBorder: string; badgeBg: string }> = {
              basico:       { label: 'Básico',      price_monthly: 29,  price_yearly: 23,  colorText: 'text-slate-700',  colorBg: 'bg-slate-50',   colorBorder: 'border-slate-200', badgeBg: 'bg-slate-100 text-slate-600' },
              profesional:  { label: 'Profesional', price_monthly: 49,  price_yearly: 39,  colorText: 'text-blue-700',   colorBg: 'bg-blue-50',    colorBorder: 'border-blue-200',  badgeBg: 'bg-blue-100 text-blue-700' },
              empresa:      { label: 'Empresa',     price_monthly: 89,  price_yearly: 71,  colorText: 'text-purple-700', colorBg: 'bg-purple-50',  colorBorder: 'border-purple-200',badgeBg: 'bg-purple-100 text-purple-700' },
              empresa_plus: { label: 'Empresa+',    price_monthly: 179, price_yearly: 143, colorText: 'text-amber-700',  colorBg: 'bg-amber-50',   colorBorder: 'border-amber-200', badgeBg: 'bg-amber-100 text-amber-700' },
            };
            const STATUS_CFG: Record<string, { label: string; cls: string }> = {
              trial:     { label: 'Prueba',    cls: 'bg-blue-100 text-blue-700' },
              active:    { label: 'Activo',    cls: 'bg-emerald-100 text-emerald-700' },
              cancelled: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-500' },
              expired:   { label: 'Expirado',  cls: 'bg-red-100 text-red-600' },
            };
            const meta = PLAN_META[subscription.plan] ?? PLAN_META.basico;
            const cfg = STATUS_CFG[subscription.status] ?? STATUS_CFG.trial;
            const isYearly = subscription.billing_cycle === 'yearly';
            const price = isYearly ? meta.price_yearly : meta.price_monthly;
            const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;
            const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86400000)) : null;
            const nextBillingDate = subscription.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
              : trialEnd
              ? trialEnd.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
              : null;
            const isUpgradeable = subscription.status !== 'active' || subscription.plan !== 'empresa_plus';
            const PLAN_LABEL_MAP: Record<string, string> = { basico: 'Básico', pro: 'Profesional', profesional: 'Profesional', empresa: 'Empresa', empresa_plus: 'Empresa+' };
            const scheduledPlanLabel = subscription.scheduled_plan ? (PLAN_LABEL_MAP[subscription.scheduled_plan] ?? subscription.scheduled_plan) : null;
            const scheduledAtDate = subscription.scheduled_at
              ? new Date(subscription.scheduled_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
              : null;

            return (
              <div className={`rounded-xl border ${meta.colorBorder} ${meta.colorBg} p-4 space-y-3`}>
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-base font-black ${meta.colorText}`}>Plan {meta.label}</span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${meta.badgeBg}`}>
                      {isYearly ? 'Facturación anual (-20%)' : 'Facturación mensual'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-baseline gap-0.5 justify-end">
                      <span className={`text-2xl font-black ${meta.colorText}`}>{price}€</span>
                      <span className="text-[10px] text-slate-400">/mes</span>
                    </div>
                    {isYearly && <p className="text-[10px] text-slate-400">{price * 12}€/año</p>}
                  </div>
                </div>

                {/* Fechas info */}
                <div className="bg-white/80 rounded-lg divide-y divide-slate-100">
                  {subscription.status === 'trial' && daysLeft !== null && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-[11px] text-slate-500">Período de prueba</span>
                      <span className="text-[11px] font-bold text-amber-600">{daysLeft > 0 ? `${daysLeft} días restantes` : 'Finalizado'}</span>
                    </div>
                  )}
                  {nextBillingDate && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-[11px] text-slate-500">
                        {subscription.status === 'active' ? 'Próximo cobro' : 'Fin de prueba'}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700">{nextBillingDate}</span>
                    </div>
                  )}
                  {subscription.status === 'active' && (
                    <div className="flex justify-between items-center px-3 py-2">
                      <span className="text-[11px] text-slate-500">Importe a cobrar</span>
                      <span className="text-[11px] font-bold text-slate-700">
                        {isYearly ? `${price * 12}€` : `${price}€`}
                      </span>
                    </div>
                  )}
                  {subscription.status === 'cancelled' && (
                    <div className="px-3 py-2"><p className="text-[11px] text-slate-500">Suscripción cancelada — el acceso continúa hasta el fin del período</p></div>
                  )}
                  {subscription.status === 'expired' && (
                    <div className="px-3 py-2"><p className="text-[11px] text-red-500 font-semibold">Acceso expirado — reactiva tu plan para continuar</p></div>
                  )}
                </div>

                {/* Cambio de plan programado */}
                {scheduledPlanLabel && scheduledAtDate && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-amber-500 text-base leading-none mt-0.5">⏳</span>
                    <p className="text-[11px] text-amber-700 leading-snug">
                      <span className="font-semibold">Cambio programado:</span> el {scheduledAtDate} pasarás al plan <span className="font-semibold">{scheduledPlanLabel}</span>.
                      Hasta entonces conservas tu acceso actual.
                    </p>
                  </div>
                )}

                {/* Últimos pagos inline */}
                {isLiveMode && platformInvoices.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Últimos pagos</p>
                    <div className="bg-white/80 rounded-lg divide-y divide-slate-100">
                      {platformInvoices.slice(0, 3).map(inv => {
                        const date = new Date(inv.paid_at ?? inv.period_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                        const amount = (inv.amount_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                        return (
                          <div key={inv.id} className="flex items-center justify-between px-3 py-2 gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-slate-700 truncate">
                                {inv.plan ? `Plan ${PLAN_LABEL_MAP[inv.plan] ?? inv.plan}` : 'Suscripción'}
                              </p>
                              <p className="text-[10px] text-slate-400">{date}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[11px] font-bold text-slate-900">{amount}</span>
                              {(inv.invoice_pdf_url || inv.invoice_url) && (
                                <a href={inv.invoice_pdf_url ?? inv.invoice_url ?? '#'} target="_blank" rel="noopener noreferrer"
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-blue-600 hover:bg-blue-50 transition">
                                  PDF
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className="flex gap-2 flex-wrap pt-1">
                  {subscription.stripe_customer_id && (subscription.status === 'active' || subscription.status === 'trial') && (
                    <button
                      onClick={async () => {
                        setStripeLoading(true);
                        try { window.open(await getStripePortalUrl(subscription.org_id), '_blank', 'noopener'); }
                        catch { /* silent */ }
                        finally { setStripeLoading(false); }
                      }}
                      disabled={stripeLoading}
                      className="text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                    >
                      {stripeLoading ? 'Cargando…' : 'Gestionar suscripción'}
                    </button>
                  )}
                  {isUpgradeable && (
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white transition"
                    >
                      {subscription.status === 'trial' ? 'Ver planes y activar' :
                       subscription.status === 'active' ? 'Cambiar plan' : 'Ver planes y reactivar'}
                    </button>
                  )}
                </div>
              </div>
            );
          })() : isLiveMode ? (
            <p className="text-[10px] text-slate-400">Cargando información de suscripción…</p>
          ) : (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-black text-blue-700">Plan Profesional</span>
                    <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Activo</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-blue-100 text-blue-700">Demo — activa tu cuenta</span>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black text-blue-700">49€</span>
                  <span className="text-[10px] text-slate-400">/mes</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 5. Historial de pagos completo (> 3 facturas) ── */}
        {isLiveMode && platformInvoices.length > 3 && (
          <div className={sec}>
            <h3 className={secTitle}>Historial completo de pagos</h3>
            <div className="divide-y divide-slate-100">
              {platformInvoices.slice(3).map(inv => {
                const PLM: Record<string, string> = { basico: 'Básico', pro: 'Profesional', profesional: 'Profesional', empresa: 'Empresa', empresa_plus: 'Empresa+' };
                const date = new Date(inv.paid_at ?? inv.period_start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
                const amount = (inv.amount_cents / 100).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
                return (
                  <div key={inv.id} className="flex items-center justify-between py-2.5 gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {inv.plan ? `Plan ${PLM[inv.plan] ?? inv.plan}` : 'Suscripción'}
                        <span className="ml-2 text-[10px] font-normal text-slate-400">{date}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-slate-900">{amount}</span>
                      {(inv.invoice_pdf_url || inv.invoice_url) && (
                        <a href={inv.invoice_pdf_url ?? inv.invoice_url ?? '#'} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2.5 py-1 rounded border border-slate-200 text-blue-600 hover:bg-blue-50 transition">
                          PDF
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 6. Código de invitación ── */}
        {isLiveMode && orgData?.referral_code && (
          <div className={sec}>
            <h3 className={secTitle}>Invita a un colega — 1 mes gratis</h3>
            <p className="text-[11px] text-slate-500 mb-3">Comparte tu código con otro instalador. Cuando se registre con él, ganaréis un mes gratis cada uno.</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
                <span className="font-mono text-lg font-black tracking-[0.2em] text-slate-900">{orgData.referral_code}</span>
              </div>
              <button
                onClick={() => {
                  void navigator.clipboard.writeText(orgData!.referral_code!);
                  showToast('Código copiado al portapapeles', 'success');
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-700 transition-colors"
              >
                Copiar
              </button>
            </div>
          </div>
        )}

        {/* ── Logo de empresa ── */}
        {isLiveMode && orgId && (
          <div className={sec}>
            <h3 className={secTitle}>Logo de Empresa</h3>
            <p className="text-[11px] text-slate-500">
              Aparecerá en tus presupuestos PDF, contratos y correos.
            </p>
            <div className="flex items-center gap-4 mt-2">
              {logoPreview ? (
                <div className="w-24 h-16 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
                  <img src={logoPreview} alt="Logo empresa" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <div className="w-24 h-16 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center bg-slate-50">
                  <ImageIcon className="h-6 w-6 text-slate-300" />
                </div>
              )}
              <div className="space-y-1.5">
                <label className={`inline-flex items-center gap-2 cursor-pointer ${uploadingLogo ? 'opacity-50 cursor-not-allowed' : ''} bg-slate-900 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors`}>
                  <Upload className="h-3 w-3" />
                  {uploadingLogo ? 'Subiendo…' : logoPreview ? 'Cambiar logo' : 'Subir logo'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    disabled={uploadingLogo}
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file || !orgId) return;
                      setUploadingLogo(true);
                      try {
                        const url = await uploadOrgLogo(orgId, file);
                        setLogoPreview(url);
                        setOrgData(prev => prev ? { ...prev, logo_url: url } : prev);
                        showToast('Logo guardado ✓', 'success');
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : String(err);
                        showToast('Error al subir logo: ' + msg, 'error');
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                </label>
                {logoPreview && (
                  <button
                    className="text-[10px] text-red-400 hover:text-red-600 cursor-pointer transition-colors block"
                    onClick={async () => {
                      if (!orgId) return;
                      await supabase.from('trade_organizations').update({ logo_url: null }).eq('id', orgId);
                      setLogoPreview(null);
                      setOrgData(prev => prev ? { ...prev, logo_url: undefined } : prev);
                      showToast('Logo eliminado', 'info');
                    }}
                  >
                    Eliminar logo
                  </button>
                )}
                <p className="text-[9px] text-slate-400">PNG, JPG o SVG · Max 2 MB · Fondo transparente recomendado</p>
              </div>
            </div>
          </div>
        )}


        {/* ── Plantillas ── */}
        {isLiveMode && orgId && (() => {
          const TEMPLATES: Array<{ tipo: TemplateType; label: string; icon: string; rows: number; varGroups: string[] }> = [
            { tipo: 'whatsapp_presupuesto', label: 'WhatsApp — Presupuesto', icon: '💬', rows: 7, varGroups: ['empresa', 'cliente', 'presupuesto', 'sistema'] },
            { tipo: 'email_presupuesto',    label: 'Email — Presupuesto',    icon: '📧', rows: 10, varGroups: ['empresa', 'cliente', 'presupuesto', 'ia', 'sistema'] },
            { tipo: 'email_factura',        label: 'Email — Factura',        icon: '📧', rows: 10, varGroups: ['empresa', 'cliente', 'factura', 'sistema'] },
            { tipo: 'recordatorio_pago',    label: 'Recordatorio de pago',   icon: '🔔', rows: 7,  varGroups: ['empresa', 'cliente', 'factura'] },
            { tipo: 'aviso_visita',         label: 'Aviso de visita',        icon: '🗓️', rows: 7,  varGroups: ['empresa', 'cliente', 'visita'] },
            { tipo: 'pie_presupuesto',      label: 'Pie de página — Presupuesto', icon: '📄', rows: 4, varGroups: ['empresa', 'presupuesto'] },
            { tipo: 'pie_factura',          label: 'Pie de página — Factura',     icon: '🧾', rows: 4, varGroups: ['empresa', 'factura'] },
            { tipo: 'contrato_mantenimiento', label: 'Contrato de Mantenimiento', icon: '📋', rows: 10, varGroups: ['empresa', 'cliente'] },
          ];

          return (
            <div className={sec}>
              <h3 className={secTitle}>Plantillas de Comunicación</h3>
              <p className="text-[11px] text-slate-500 mb-3">
                Personaliza los textos que se usan al enviar presupuestos, facturas y avisos. Usa <span className="font-mono bg-slate-100 px-1 rounded">{'{{variable}}'}</span> — se rellenan automáticamente. Soporta <span className="font-mono bg-slate-100 px-1 rounded">{'{{#if var}}...{{/if}}'}</span> para bloques condicionales.
              </p>
              <div className="space-y-2">
                {TEMPLATES.map(tpl => {
                  const defaultContent = DEFAULT_TEMPLATES[tpl.tipo as keyof typeof DEFAULT_TEMPLATES] ?? '';
                  const currentContent = orgTemplates[tpl.tipo] ?? '';
                  const relevantGroups = VARIABLE_GROUPS.filter(g => tpl.varGroups.includes(g.id));
                  return (
                    <div key={tpl.tipo} className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setOpenTemplateTipo(p => p === tpl.tipo ? null : tpl.tipo)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{tpl.icon}</span>
                          <span className="text-xs font-bold text-slate-700">{tpl.label}</span>
                          {currentContent && (
                            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Personalizada</span>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${openTemplateTipo === tpl.tipo ? 'rotate-180' : ''}`} />
                      </button>
                      {openTemplateTipo === tpl.tipo && (
                        <div className="p-4 space-y-3 bg-white">
                          {relevantGroups.length > 0 && (
                            <div className="space-y-2">
                              {relevantGroups.map(group => (
                                <div key={group.id}>
                                  <span className="text-[9px] font-bold uppercase text-slate-400 block mb-1">{group.emoji} {group.label}</span>
                                  <div className="flex flex-wrap gap-1">
                                    {group.vars.map(v => (
                                      <button
                                        key={v.key}
                                        title={`Ejemplo: ${v.example}`}
                                        onClick={() => {
                                          const tag = `{{${v.key}}}`;
                                          setOrgTemplates(prev => ({
                                            ...prev,
                                            [tpl.tipo]: (prev[tpl.tipo] ?? defaultContent) + tag,
                                          }));
                                        }}
                                        className="font-mono text-[9px] bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-100 transition-colors"
                                      >
                                        {`{{${v.key}}}`}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <textarea
                            rows={tpl.rows}
                            placeholder={defaultContent || `Escribe tu plantilla aquí…`}
                            value={currentContent}
                            onChange={e => setOrgTemplates(prev => ({ ...prev, [tpl.tipo]: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-y"
                          />
                          {!currentContent && defaultContent && (
                            <button
                              onClick={() => setOrgTemplates(prev => ({ ...prev, [tpl.tipo]: defaultContent }))}
                              className="text-[10px] text-blue-600 hover:text-blue-800 cursor-pointer transition-colors"
                            >
                              Cargar plantilla predeterminada
                            </button>
                          )}
                          <div className="flex gap-2 items-center">
                            <button
                              disabled={savingTemplate === tpl.tipo}
                              onClick={async () => {
                                if (!orgId) return;
                                setSavingTemplate(tpl.tipo);
                                try {
                                  await saveOrgTemplate(orgId, tpl.tipo, currentContent, tpl.label);
                                  showToast('Plantilla guardada ✓', 'success');
                                } catch (err: unknown) {
                                  const msg = err instanceof Error ? err.message : String(err);
                                  showToast('Error: ' + msg, 'error');
                                } finally {
                                  setSavingTemplate(null);
                                }
                              }}
                              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer"
                            >
                              {savingTemplate === tpl.tipo ? 'Guardando…' : 'Guardar plantilla'}
                            </button>
                            {currentContent && (
                              <button
                                onClick={async () => {
                                  setOrgTemplates(prev => ({ ...prev, [tpl.tipo]: '' }));
                                  if (orgId) {
                                    try { await saveOrgTemplate(orgId, tpl.tipo, '', tpl.label); } catch { /* ignore */ }
                                  }
                                }}
                                className="text-[10px] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                              >
                                Restaurar predeterminado
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* ── 7. Calendario laboral ── */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const updateDay = (dow: number, patch: Partial<WorkCalendar['workDays'][0]>) => {
            const updated = { ...workCalendar, workDays: { ...workCalendar.workDays, [dow]: { ...workCalendar.workDays[dow], ...patch } } };
            setWorkCalendar(updated);
            saveWorkCalendar(updated);
          };
          const removeHoliday = (id: string) => {
            const updated = { ...workCalendar, holidays: workCalendar.holidays.filter(h => h.id !== id) };
            setWorkCalendar(updated);
            saveWorkCalendar(updated);
          };
          const addHoliday = (entry: Omit<HolidayEntry, 'id'>) => {
            const updated = { ...workCalendar, holidays: [...workCalendar.holidays, { ...entry, id: crypto.randomUUID() }] };
            setWorkCalendar(updated);
            saveWorkCalendar(updated);
            setNewHoliday({ date: '', name: '', recurring: false });
            setShowAddHoliday(false);
          };
          const addNacionales = () => {
            const existing = new Set(workCalendar.holidays.map(h => h.date));
            const nuevos = FESTIVOS_NACIONALES.filter(f => !existing.has(f.date)).map(f => ({ ...f, id: crypto.randomUUID() }));
            if (!nuevos.length) { showToast('Ya están todos los festivos nacionales añadidos', 'info'); return; }
            const updated = { ...workCalendar, holidays: [...workCalendar.holidays, ...nuevos] };
            setWorkCalendar(updated);
            saveWorkCalendar(updated);
            showToast(`${nuevos.length} festivos nacionales añadidos ✓`, 'success');
          };

          return (
            <div className={sec}>
              <h3 className={secTitle}>Calendario laboral</h3>
              <p className="text-[11px] text-slate-400 mb-4">Define tu horario semanal, festivos y vacaciones. Los trabajos atrasados se reprogramarán al siguiente día laborable.</p>

              {/* Horario semanal */}
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Horario semanal</p>
              <div className="space-y-1 mb-5">
                {[1,2,3,4,5,6,0].map(dow => {
                  const cfg = workCalendar.workDays[dow];
                  return (
                    <div key={dow} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${cfg.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100'}`}>
                      {/* Toggle activo */}
                      <button
                        onClick={() => updateDay(dow, { active: !cfg.active })}
                        className={`w-8 h-4.5 rounded-full transition-colors shrink-0 cursor-pointer flex items-center px-0.5 ${cfg.active ? 'bg-blue-600' : 'bg-slate-200'}`}
                        style={{ width: 32, height: 18 }}
                      >
                        <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${cfg.active ? 'translate-x-3.5' : 'translate-x-0'}`} style={{ width: 14, height: 14 }} />
                      </button>
                      {/* Nombre del día */}
                      <span className={`text-xs font-bold w-20 ${cfg.active ? 'text-slate-800' : 'text-slate-400'}`}>{DAY_NAMES[dow]}</span>
                      {/* Horario */}
                      {cfg.active ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input type="time" value={cfg.start} onChange={e => updateDay(dow, { start: e.target.value })}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white text-slate-700 w-24" />
                          <span className="text-[10px] text-slate-400">—</span>
                          <input type="time" value={cfg.end} onChange={e => updateDay(dow, { end: e.target.value })}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white text-slate-700 w-24" />
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic flex-1">Cerrado</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Festivos y cierres */}
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Festivos, puentes y vacaciones</p>
                <div className="flex gap-1.5 flex-wrap">
                  <button onClick={addNacionales} className="text-[10px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer border border-blue-200 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors">
                    + Festivos ES
                  </button>
                  <button
                    onClick={() => { setShowAddPeriod(v => !v); setShowAddHoliday(false); }}
                    className={`text-[10px] font-semibold cursor-pointer border px-2.5 py-1 rounded-lg transition-colors ${showAddPeriod ? 'bg-violet-600 text-white border-violet-600' : 'text-violet-700 border-violet-200 bg-violet-50 hover:bg-violet-100'}`}>
                    + Período / Vacaciones
                  </button>
                  <button
                    onClick={() => { setShowAddHoliday(v => !v); setShowAddPeriod(false); }}
                    className={`text-[10px] font-semibold cursor-pointer border px-2.5 py-1 rounded-lg transition-colors ${showAddHoliday ? 'bg-slate-700 text-white border-slate-700' : 'text-slate-600 border-slate-200 bg-white hover:bg-slate-50'}`}>
                    + Día suelto
                  </button>
                </div>
              </div>

              {/* Formulario: período / vacaciones */}
              {showAddPeriod && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3 space-y-3">
                  <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider">Nuevo período de cierre</p>
                  <input type="text" placeholder="Nombre: Semana Santa, Vacaciones verano, Puente mayo…"
                    value={newPeriod.name} onChange={e => setNewPeriod(v => ({ ...v, name: e.target.value }))}
                    className="w-full text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold shrink-0">Desde:</span>
                      <input type="date" value={newPeriod.date_from} onChange={e => setNewPeriod(v => ({ ...v, date_from: e.target.value }))}
                        className="text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500 font-semibold shrink-0">Hasta:</span>
                      <input type="date" value={newPeriod.date_to}
                        min={newPeriod.date_from || undefined}
                        onChange={e => setNewPeriod(v => ({ ...v, date_to: e.target.value }))}
                        className="text-xs border border-violet-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-violet-400 bg-white" />
                    </div>
                  </div>
                  {newPeriod.date_from && newPeriod.date_to && newPeriod.date_from <= newPeriod.date_to && (
                    <p className="text-[10px] text-violet-600 bg-white border border-violet-100 rounded-lg px-2.5 py-1.5">
                      {(() => {
                        const days = Math.round((new Date(newPeriod.date_to).getTime() - new Date(newPeriod.date_from).getTime()) / 86400000) + 1;
                        const fmtOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' };
                        return `${days} día${days !== 1 ? 's' : ''} · del ${new Date(newPeriod.date_from + 'T12:00:00').toLocaleDateString('es-ES', fmtOpts)} al ${new Date(newPeriod.date_to + 'T12:00:00').toLocaleDateString('es-ES', fmtOpts)}`;
                      })()}
                    </p>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newPeriod.recurring} onChange={e => setNewPeriod(v => ({ ...v, recurring: e.target.checked }))} className="rounded accent-violet-600" />
                    <span className="text-[10px] text-slate-600">Se repite cada año (ej. vacaciones de verano siempre en agosto)</span>
                  </label>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setShowAddPeriod(false); setNewPeriod({ name: '', date_from: '', date_to: '', recurring: false }); }}
                      className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 px-2 py-1">Cancelar</button>
                    <button
                      onClick={() => {
                        if (!newPeriod.name.trim() || !newPeriod.date_from || !newPeriod.date_to) { showToast('Indica nombre y fechas de inicio y fin', 'error'); return; }
                        if (newPeriod.date_from > newPeriod.date_to) { showToast('La fecha de inicio debe ser anterior a la de fin', 'error'); return; }
                        const from = newPeriod.recurring ? newPeriod.date_from.slice(5) : newPeriod.date_from;
                        const to   = newPeriod.recurring ? newPeriod.date_to.slice(5)   : newPeriod.date_to;
                        addHoliday({ date: from, date_to: to, name: newPeriod.name.trim(), recurring: newPeriod.recurring });
                        setShowAddPeriod(false);
                        setNewPeriod({ name: '', date_from: '', date_to: '', recurring: false });
                        showToast('Período añadido al calendario ✓', 'success');
                      }}
                      className="text-[10px] bg-violet-600 hover:bg-violet-700 text-white font-bold px-3 py-1 rounded-lg cursor-pointer">
                      Guardar período
                    </button>
                  </div>
                </div>
              )}

              {/* Formulario: día suelto */}
              {showAddHoliday && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nuevo día festivo / cierre</p>
                  <div className="flex gap-2 flex-wrap">
                    <input type="date" value={newHoliday.date} onChange={e => setNewHoliday(v => ({ ...v, date: e.target.value }))}
                      className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white" />
                    <input type="text" placeholder="Nombre: Día de la Hispanidad, Puente…" value={newHoliday.name} onChange={e => setNewHoliday(v => ({ ...v, name: e.target.value }))}
                      className="flex-1 min-w-[160px] text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-400 bg-white" />
                  </div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={newHoliday.recurring} onChange={e => setNewHoliday(v => ({ ...v, recurring: e.target.checked }))} className="rounded" />
                      <span className="text-[10px] text-slate-600">Se repite cada año</span>
                    </label>
                    <div className="flex gap-2">
                      <button onClick={() => { setShowAddHoliday(false); setNewHoliday({ date: '', name: '', recurring: false }); }}
                        className="text-[10px] text-slate-500 cursor-pointer hover:text-slate-700 px-2 py-1">Cancelar</button>
                      <button
                        onClick={() => {
                          if (!newHoliday.date || !newHoliday.name.trim()) { showToast('Indica fecha y nombre', 'error'); return; }
                          const dateToSave = newHoliday.recurring ? newHoliday.date.slice(5) : newHoliday.date;
                          addHoliday({ date: dateToSave, name: newHoliday.name.trim(), recurring: newHoliday.recurring });
                          showToast('Día añadido al calendario ✓', 'success');
                        }}
                        className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded-lg cursor-pointer">
                        Guardar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de festivos */}
              {workCalendar.holidays.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic py-2">No hay festivos configurados. Pulsa "+ Festivos ES" para cargar los festivos de España.</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {[...workCalendar.holidays]
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(h => {
                      const isPeriod = !!h.date_to;
                      const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                      const fmtMmdd = (mmdd: string) => { const [m, d] = mmdd.split('-'); return `${d}/${m}`; };
                      const displayDate = h.recurring
                        ? isPeriod
                          ? `Cada año: ${fmtMmdd(h.date)} — ${fmtMmdd(h.date_to!)}`
                          : `Cada año: ${fmtMmdd(h.date)}`
                        : isPeriod
                          ? `${fmtDay(h.date)} — ${fmtDay(h.date_to!)}`
                          : new Date(h.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                      const isFestivo = !h.recurring && !isPeriod && h.date >= today && isWorkingDay(h.date, { ...workCalendar, holidays: workCalendar.holidays.filter(x => x.id !== h.id) });
                      return (
                        <div key={h.id} className={`flex items-center gap-2 px-3 py-2 border rounded-lg ${isPeriod ? 'bg-violet-50 border-violet-100' : 'bg-white border-slate-100'}`}>
                          <span className="text-sm">{h.recurring ? '🔁' : isPeriod ? '🏖️' : '📅'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{h.name}</p>
                            <p className="text-[10px] text-slate-400">{displayDate}</p>
                          </div>
                          {isFestivo && <span className="text-[9px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">próximo</span>}
                          <button onClick={() => removeHoliday(h.id)} className="p-1 text-slate-300 hover:text-red-500 cursor-pointer transition-colors rounded"><X className="w-3 h-3" /></button>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* Nota urgencias 24/7 */}
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex gap-2">
                <span className="text-sm mt-0.5">⚡</span>
                <p className="text-[10px] text-amber-700 leading-relaxed">
                  <strong>Contratos de urgencia / 24×7:</strong> Los trabajos vinculados a contratos de mantenimiento con cobertura de urgencia o 24×7 sí se programan en festivos. Aparecerán con aviso naranja en el Panel de Control.
                </p>
              </div>
            </div>
          );
        })()}

        {/* ── 8. Notificaciones push ── */}
        {isLiveMode && 'Notification' in window && (
          <div className={sec}>
            <h3 className={secTitle}>Notificaciones</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-700">Notificaciones en este dispositivo</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {pushEnabled ? 'Activadas — recibirás alertas de trabajos y presupuestos.' : 'Desactivadas — no recibirás alertas en este dispositivo.'}
                </p>
              </div>
              <button
                onClick={async () => {
                  if (!orgId) return;
                  setPushLoading(true);
                  try {
                    if (pushEnabled) {
                      const { data: { session: s } } = await supabase.auth.getSession();
                      if (s?.user) await unsubscribePush(s.user.id);
                      setPushEnabled(false);
                      showToast('Notificaciones desactivadas', 'info');
                    } else {
                      const permission = await Notification.requestPermission();
                      if (permission !== 'granted') { showToast('Permiso denegado por el navegador', 'error'); return; }
                      const { data: { session: s } } = await supabase.auth.getSession();
                      if (!s?.user) return;
                      const ok = await subscribePush(s.user.id, orgId);
                      setPushEnabled(ok);
                      showToast(ok ? 'Notificaciones activadas ✓' : 'No se pudieron activar las notificaciones', ok ? 'success' : 'error');
                    }
                  } catch { showToast('Error al configurar notificaciones', 'error'); }
                  finally { setPushLoading(false); }
                }}
                disabled={pushLoading}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition cursor-pointer disabled:opacity-50 ${
                  pushEnabled
                    ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    : 'bg-blue-600 hover:bg-blue-500 text-white'
                }`}
              >
                {pushLoading ? '...' : pushEnabled ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        )}

      </div>
    );
  }
}
