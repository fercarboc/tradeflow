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
  CheckCircle2,
  Mail,
  Zap,
  Info,
  CornerDownRight,
  Monitor,
  Phone,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Shield,
  Package,
  Tag,
  Star as StarIcon,
  Edit3,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ActivePage, Presupuesto, PartidaPresupuesto, Factura, Cliente } from '../types';
import { supabase, loadDashboard, getOrCreateOrg, loadWorkers, loadTarifas, addWorker, addTarifa, deleteWorker, deleteTarifa, saveFiscalData, saveQuote, addClient, markInvoicePaid, convertToInvoice, loadCatalogProducts, matchProductForAI, updateCatalogVariant, setPreferredVariant } from '../lib/supabase';
import type { TradeWorker, TradeTarifa, TradeCatalogProduct, TradeCatalogVariant } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

const InvoiceIcon = FileText;

interface AppDashboardViewProps {
  setCurrentPage: (page: ActivePage) => void;
  initialMobile?: boolean;
  session?: Session | null;
  loginOnMount?: boolean;
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

interface PresetPhoto {
  id: string;
  name: string;
  url: string;
  category: string;
  detections: { label: string; x: number; y: number; w: number; h: number; price: number; type: 'material' | 'mano_de_obra'; confidence: number }[];
}

export default function AppDashboardView({ setCurrentPage, initialMobile = true, session, loginOnMount = false }: AppDashboardViewProps) {
  // Auth & data loading
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(loginOnMount && !session);
  const [isLiveMode, setIsLiveMode] = useState(false);

  useEffect(() => {
    if (session) {
      setIsLiveMode(true);
      setShowLoginModal(false);
      loadLiveData(session);
    } else {
      setIsLiveMode(false);
    }
  }, [session]);

  const loadLiveData = async (s: Session) => {
    try {
      const org = await getOrCreateOrg();
      if (!org) return;
      const data = await loadDashboard(org.id);
      if (data.clients.length)  setClientes(data.clients.map(c => ({ id: c.id, nombre: c.nombre, telefono: c.telefono ?? '', email: c.email ?? '', direccion: c.direccion ?? '', obrasActivas: c.obras_activas, totalFacturado: c.total_facturado })));
      if (data.quotes.length)   setPresupuestos(data.quotes.map(q => ({ id: q.numero, nombreCliente: q.client_id ? (data.clients.find(c => c.id === q.client_id)?.nombre ?? '') : '', descripcion: q.descripcion ?? '', partidas: (q.trade_quote_items ?? []).map(i => ({ descripcion: i.descripcion, tipo: i.tipo as 'material' | 'mano_de_obra', cantidad: i.cantidad, precioUnitario: i.precio_unitario, total: i.total })), total: q.total_neto, fecha: q.fecha, estado: q.estado as any, telefonoCliente: '', emailCliente: '' })));
      if (data.invoices.length) setFacturas(data.invoices.map(f => ({ id: f.id, numeroFactura: f.numero, nombreCliente: f.client_id ? (data.clients.find(c => c.id === f.client_id)?.nombre ?? '') : '', idPresupuesto: f.quote_id ?? '', importe: f.subtotal, fecha: f.fecha, fechaVencimiento: f.fecha_vencimiento ?? '', estado: f.estado as any })));
      if (org) {
        setOrgId(org.id);
        setEmpresaAjustes(prev => ({
          ...prev,
          nombre:       org.nombre,
          nif:          (org as any).nif ?? prev.nif,
          email:        org.email ?? prev.email,
          telefonoFijo: (org as any).telefono_fijo ?? prev.telefonoFijo,
          telefonoMovil:(org as any).telefono_movil ?? org.telefono ?? prev.telefonoMovil,
          direccion:    org.direccion ?? prev.direccion,
          localidad:    (org as any).localidad ?? prev.localidad,
          cp:           (org as any).cp ?? prev.cp,
          provincia:    (org as any).provincia ?? prev.provincia,
          pais:         (org as any).pais ?? prev.pais,
        }));
        const [workersRes, tarifasRes, catalogRes] = await Promise.all([
          loadWorkers(org.id),
          loadTarifas(org.id),
          loadCatalogProducts(org.id),
        ]);
        setTrabajadores(workersRes.map((w: TradeWorker) => ({ id: w.id, nombre: w.nombre, telefono: w.telefono ?? '', email: w.email ?? '', rol: w.rol as TrabajadorItem['rol'], activo: w.activo })));
        setTarifas(tarifasRes.map((t: TradeTarifa) => ({ id: t.id, codigo: t.codigo ?? '', familia: t.familia, descripcion: t.descripcion, precioBase: t.precio_base, unidad: t.unidad, activo: t.activo })));
        setCatalogProducts(catalogRes);
      }
      showToast(`Datos reales cargados ✓`, 'success');
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
    if (error) setLoginError(error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsLiveMode(false);
    showToast('Sesión cerrada — volviendo a modo demo', 'info');
  };

  // Simulador Config
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(initialMobile);
  const [activeTab, setActiveTab] = useState<string>('dashboard');

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
  const [mobileTab, setMobileTab] = useState<'inicio' | 'presupuestos' | 'clientes' | 'facturas'>('inicio');
  const [showFloatingMenu, setShowFloatingMenu] = useState<boolean>(false);

  // Pasos del Asistente Móvil (Wizard)
  const [wizardActive, setWizardActive] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
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

  // CRM Mobile detail active
  const [expandedClientMobileId, setExpandedClientMobileId] = useState<string | null>(null);

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
  const [clientes, setClientes] = useState<Cliente[]>([
    {
      id: 'cli-1',
      nombre: 'Juan Lorenzo',
      telefono: '612 345 678',
      email: 'juan@lorenzoreformas.com',
      direccion: 'Calle de los Álamos 14, Sevilla',
      obrasActivas: 1,
      totalFacturado: 1250
    },
    {
      id: 'cli-2',
      nombre: 'María Gómez',
      telefono: '678 901 234',
      email: 'maria.gomez@gmail.com',
      direccion: 'Av. Constitución 8, Madrid',
      obrasActivas: 0,
      totalFacturado: 187
    },
    {
      id: 'cli-3',
      nombre: 'Restaurante La Mamma',
      telefono: '915 234 567',
      email: 'admin@lamamma.es',
      direccion: 'Plaza de la Alfalfa 3, Sevilla',
      obrasActivas: 1,
      totalFacturado: 2850
    },
    {
      id: 'cli-4',
      nombre: 'Constructora Hércules S.A.',
      telefono: '605 112 233',
      email: 'obras@hercules.es',
      direccion: 'Polígono Industrial Giralda, Nave 4, Sevilla',
      obrasActivas: 2,
      totalFacturado: 9200
    }
  ]);

  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([
    {
      id: 'P-2026-001',
      nombreCliente: 'María Gómez',
      telefonoCliente: '678 901 234',
      emailCliente: 'maria.gomez@gmail.com',
      descripcion: 'Reparación de fuga de cobre en baño principal',
      fecha: '2026-05-20',
      estado: 'Aceptado',
      partidas: [
        { descripcion: 'Localización de fuga térmica en tubería de cobre', tipo: 'mano_de_obra', cantidad: 1, precioUnitario: 45, total: 45 },
        { descripcion: 'Tubería de cobre recocido 15mm y racores', tipo: 'material', cantidad: 2, precioUnitario: 12.5, total: 25 },
        { descripcion: 'Sifón botella PVC alta resistencia 40mm', tipo: 'material', cantidad: 1, precioUnitario: 38.5, total: 38.5 },
        { descripcion: 'Mano de obra fontanero especialista', tipo: 'mano_de_obra', cantidad: 2, precioUnitario: 39, total: 78 }
      ],
      total: 186.5
    },
    {
      id: 'P-2026-002',
      nombreCliente: 'Restaurante La Mamma',
      telefonoCliente: '915 234 567',
      emailCliente: 'admin@lamamma.es',
      descripcion: 'Instalación split Daikin climatización comedor',
      fecha: '2026-05-18',
      estado: 'Facturado',
      partidas: [
        { descripcion: 'Aire acondicionado Split Daikin ADEAS71A', tipo: 'material', cantidad: 1, precioUnitario: 1850, total: 1850 },
        { descripcion: 'Conductos y rejillas impulsión aluminio anodizado', tipo: 'material', cantidad: 1, precioUnitario: 320, total: 320 },
        { descripcion: 'Mano de obra oficial instalación HVAC', tipo: 'mano_de_obra', cantidad: 12, precioUnitario: 42, total: 504 },
        { descripcion: 'Gas refrigerante ecológico R32 y soldaduras', tipo: 'material', cantidad: 1, precioUnitario: 176, total: 176 }
      ],
      total: 2850
    },
    {
      id: 'P-2026-003',
      nombreCliente: 'Constructora Hércules S.A.',
      telefonoCliente: '605 112 233',
      emailCliente: 'obras@hercules.es',
      descripcion: 'Montaje de cuadro y acometida trifásica oficinas',
      fecha: '2026-05-22',
      estado: 'Enviado',
      partidas: [
        { descripcion: 'Cuadro estanco precableado Schneider 36 módulos', tipo: 'material', cantidad: 1, precioUnitario: 890, total: 890 },
        { descripcion: 'Cable de cobre libre de halógenos RZ1-K 5G6', tipo: 'material', cantidad: 80, precioUnitario: 4.8, total: 384 },
        { descripcion: 'Mano de obra electricista oficial autorizado', tipo: 'mano_de_obra', cantidad: 20, precioUnitario: 45, total: 900 },
        { descripcion: 'Canalizaciones protectoras y cajas estancas', tipo: 'material', cantidad: 1, precioUnitario: 150, total: 150 }
      ],
      total: 2324
    }
  ]);

  const [facturas, setFacturas] = useState<Factura[]>([
    {
      id: 'F-2026-001',
      numeroFactura: 'F-2026-001',
      nombreCliente: 'Restaurante La Mamma',
      idPresupuesto: 'P-2026-002',
      importe: 2850,
      fecha: '2026-05-18',
      fechaVencimiento: '2026-06-18',
      estado: 'Pagada'
    },
    {
      id: 'F-2026-002',
      numeroFactura: 'F-2026-002',
      nombreCliente: 'María Gómez',
      idPresupuesto: 'P-2026-001',
      importe: 186.5,
      fecha: '2026-05-21',
      fechaVencimiento: '2026-06-21',
      estado: 'Pendiente'
    },
    {
      id: 'F-2026-003',
      numeroFactura: 'F-2026-003',
      nombreCliente: 'Juan Lorenzo',
      idPresupuesto: 'Previo',
      importe: 1250,
      fecha: '2026-04-15',
      fechaVencimiento: '2026-05-15',
      estado: 'Vencida'
    }
  ]);

  const [orgId, setOrgId] = useState<string | null>(null);

  const [empresaAjustes, setEmpresaAjustes] = useState({
    nombre: 'Sanz Instalaciones Técnicas',
    nif: 'B-87654321',
    email: 'info@sanzinstalaciones.com',
    telefonoFijo: '954 123 456',
    telefonoMovil: '611 222 333',
    direccion: 'Calle Ingenieros de Obra 12',
    localidad: 'Sevilla',
    cp: '41001',
    provincia: 'Sevilla',
    pais: 'España',
    ivaDefault: 21,
    planSuscripcion: 'Profesional (Pro)',
    valorHoraOperario: 45,
  });

  const [trabajadores, setTrabajadores] = useState<TrabajadorItem[]>([
    { id: '1', nombre: 'Carlos Martínez', telefono: '612 345 678', email: 'carlos@empresa.com', rol: 'tecnico', activo: true },
  ]);
  const [showAddWorker, setShowAddWorker] = useState(false);

  const [tarifas, setTarifas] = useState<TarifaItem[]>([
    { id: '1', codigo: 'MO-001', familia: 'Mano de Obra', descripcion: 'Hora oficial de primera', precioBase: 35, unidad: 'h', activo: true },
    { id: '2', codigo: 'MO-002', familia: 'Mano de Obra', descripcion: 'Hora ayudante', precioBase: 25, unidad: 'h', activo: true },
    { id: '3', codigo: 'FON-001', familia: 'Fontanería', descripcion: 'Grifo monomando cocina estándar', precioBase: 65, unidad: 'ud', activo: true },
    { id: '4', codigo: 'ELE-001', familia: 'Electricidad', descripcion: 'Punto de luz empotrado LED', precioBase: 45, unidad: 'ud', activo: true },
    { id: '5', codigo: 'REF-001', familia: 'Reformas', descripcion: 'Alicatado porcelánico', precioBase: 28, unidad: 'm²', activo: true },
  ]);
  const [catalogProducts, setCatalogProducts] = useState<TradeCatalogProduct[]>([]);
  const [catalogFilter, setCatalogFilter] = useState('');
  const [editingVariant, setEditingVariant] = useState<{ id: string; field: 'precio_venta' | 'margen_pct'; value: string } | null>(null);
  const [savingVariant, setSavingVariant] = useState<string | null>(null);
  const [filterEstado, setFilterEstado] = useState<'todas' | 'Pendiente' | 'Pagada' | 'Vencida'>('todas');
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
      setAudioWaveHeights(Array.from({ length: 14 }, () => Math.floor(Math.random() * 40) + 6));
    }, 110);
  };

  const startVoiceRecording = async () => {
    setVoiceStep('listening');
    setVoiceText('');

    if (isLiveMode) {
      // Modo real: MediaRecorder
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.start(250);
        startWaveform();
      } catch {
        showToast('No se puede acceder al micrófono', 'error');
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

    setWizardQuote(prev => ({
      ...prev,
      descripcion: 'Instalación de calentador Vaillant estanco',
      partidas: partidasIA,
      total: totalIA
    }));

    showToast('Voz procesada por IA con éxito');
    setTimeout(() => {
      setVoiceStep('idle');
      setWizardStep(3);
    }, 800);
  };

  // Resultado real de la IA: mapea items al catálogo y actualiza el presupuesto
  const handleVoiceResult = (
    transcript: string,
    items: Array<{ descripcion: string; tipo: string; cantidad: number; unidad?: string; source_type?: string; confidence_score?: number; requires_review?: boolean }>,
  ) => {
    const partidas: PartidaPresupuesto[] = items.map(item => {
      const cantidad = item.cantidad ?? 1;

      // Buscar primero en el catálogo con variantes preferidas
      const catalogMatch = catalogProducts.length > 0
        ? matchProductForAI(item.descripcion, catalogProducts)
        : null;

      if (catalogMatch) {
        const precioUnitario = catalogMatch.variant.precio_venta;
        return {
          descripcion: `${catalogMatch.product.nombre_generico} (${catalogMatch.variant.marca})`,
          tipo: 'material' as PartidaPresupuesto['tipo'],
          cantidad,
          precioUnitario,
          total: precioUnitario * cantidad,
        };
      }

      // Fallback: buscar en tarifas manuales
      const lowerDesc = item.descripcion.toLowerCase();
      const matched = tarifas.find(t => {
        const lowerT = t.descripcion.toLowerCase();
        return lowerDesc.includes(lowerT.slice(0, 6)) || lowerT.includes(lowerDesc.slice(0, 6));
      });
      const precioUnitario = matched?.precioBase ?? 0;
      return {
        descripcion: item.descripcion,
        tipo: (item.tipo === 'mano_de_obra' ? 'mano_de_obra' : 'material') as PartidaPresupuesto['tipo'],
        cantidad,
        precioUnitario,
        total: precioUnitario * cantidad,
      };
    });
    const total = partidas.reduce((s, p) => s + p.total, 0);
    const desc = transcript.slice(0, 80);

    setWizardQuote(prev => ({ ...prev, descripcion: desc, partidas, total, estado: 'Borrador' as const }));
    setEditingQuote(prev => ({ ...prev, descripcion: desc, partidas, total }));
    setVoiceText(transcript);
    setVoiceStep('done');
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    showToast('Voz procesada por IA ✓');
    setTimeout(() => {
      setVoiceStep('idle');
      setIsVoiceModalOpen(false);
      setWizardStep(3);
    }, 900);
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

    await new Promise<void>(resolve => {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = () => resolve();
        mediaRecorderRef.current.stop();
      } else { resolve(); }
    });

    mediaRecorderRef.current?.stream.getTracks().forEach(t => t.stop());

    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/trade-voice-to-quote`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${session?.access_token ?? ''}` }, body: formData },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Error del servidor' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const result: { transcript: string; template_code?: string; items: Array<{ descripcion: string; tipo: string; cantidad: number; source_type?: string; confidence_score?: number; requires_review?: boolean }> } = await res.json();
      handleVoiceResult(result.transcript, result.items);
    } catch (e: any) {
      showToast('Error al procesar audio: ' + e.message, 'error');
      setVoiceStep('idle');
      mediaRecorderRef.current = null;
      audioChunksRef.current = [];
    }
  };

  // Escaneo fotográfico
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState<PresetPhoto | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

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

  const startPhotoAnalysis = () => {
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
            tipo: det.type,
            quantity: 1, // compatible
            cantidad: 1,
            precioUnitario: det.price,
            total: det.price
          }));
          
          const labor = selectedPhotoPreset.category === 'Electricidad' 
            ? { descripcion: 'Mano de obra conexionado y montaje', tipo: 'mano_de_obra' as const, cantidad: 2, precioUnitario: 42, total: 84 }
            : { descripcion: 'Mano de obra fontanero instalación desagüe', tipo: 'mano_de_obra' as const, cantidad: 1, precioUnitario: 39, total: 39 };

          const finalItems = [...resultItems, labor];
          const addedTotal = finalItems.reduce((acc, curr) => acc + curr.total, 0);

          setWizardQuote(prev => ({
            ...prev,
            partidas: [...(prev.partidas || []), ...finalItems],
            total: (prev.total || 0) + addedTotal
          }));

          showToast('Análisis fotográfico finalizado');
          setSelectedPhotoPreset(null);
          setWizardStep(4); // Avanzar a revisión
          return 100;
        }
        return prev + 10;
      });
    }, 100);
  };

  // Iniciar asistente wizard
  const startWizard = (startingStep: number = 1) => {
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
    let savedQuote = finalQuote;
    if (isLiveMode && orgId && finalQuote.partidas?.length) {
      const existingClient = clientes.find(c => c.nombre === clientName);
      let clientId = existingClient?.id;
      if (!clientId && clientName.trim()) {
        try {
          const nc = await addClient(orgId, { nombre: clientName.trim(), telefono: clientPhone.trim() || undefined, email: quickClientEmail.trim() || undefined });
          if (nc) { clientId = nc.id; setClientes(prev => [nc as unknown as Cliente, ...prev]); }
        } catch { /* skip */ }
      }
      if (clientId) {
        try {
          const dbQuote = await saveQuote(
            orgId, clientId, finalQuote.descripcion ?? '',
            (finalQuote.partidas ?? []).map(p => ({ descripcion: p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precio_unitario: p.precioUnitario })),
          );
          savedQuote = { ...finalQuote, id: dbQuote.numero, total: dbQuote.total_neto, fecha: dbQuote.fecha, estado: dbQuote.estado as Presupuesto['estado'] };
        } catch (e) { console.error('Error guardando presupuesto:', e); }
      }
    }
    setPresupuestos(prev => [savedQuote, ...prev]);
    setTargetQuoteForWhatsApp(savedQuote);
    setWhatsAppStep('confirm');
    setShowWhatsAppModal(true);
    setWizardActive(false);
    setShowQuickClientModal(false);
    setMobileTab('presupuestos');
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

  // Simulación de WhatsApp envio
  const handleSendWhatsAppNow = () => {
    setWhatsAppStep('sending');
    setWhatsAppProgress(0);

    const interval = setInterval(() => {
      setWhatsAppProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setWhatsAppStep('success');
          
          // Actualizar estado del presupuesto a 'Enviado'
          if (targetQuoteForWhatsApp) {
            setPresupuestos(prevQ => prevQ.map(q => q.id === targetQuoteForWhatsApp.id ? { ...q, estado: 'Enviado' } : q));
          }
          return 100;
        }
        return prev + 10;
      });
    }, 120);
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

  const handleRemindInvoice = (f: Factura) => {
    showToast(`Recordatorio de cobro enviado por WhatsApp a ${f.nombreCliente}`, 'info');
  };

  // --- Estado faltante completado ---

  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<Presupuesto | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const filteredClientes = clientes.filter(c =>
    c.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.telefono.includes(searchQuery)
  );

  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false);
  const [newClient, setNewClient] = useState<Partial<Cliente>>({ nombre: '', telefono: '', email: '', direccion: '' });

  const [showPricingSuggestion, setShowPricingSuggestion] = useState<boolean>(true);
  const suggestedPricingInfo = { diff: 21 };

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

  const cancelVoiceRecording = () => {
    streamTimeoutRef.current.forEach(t => clearTimeout(t));
    streamTimeoutRef.current = [];
    if (audioIntervalRef.current) { clearInterval(audioIntervalRef.current); audioIntervalRef.current = null; }
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
    const applyFn = (partidas: PartidaPresupuesto[]) =>
      partidas.map(item =>
        item.tipo === 'mano_de_obra' && item.precioUnitario === 45
          ? { ...item, precioUnitario: 52, total: item.cantidad * 52 }
          : item
      );
    if (isMobileMode) {
      setWizardQuote(prev => {
        const partidas = applyFn(prev.partidas || []);
        return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
      });
    } else {
      setEditingQuote(prev => {
        const partidas = applyFn(prev.partidas);
        return { ...prev, partidas, total: partidas.reduce((s, p) => s + p.total, 0) };
      });
    }
    setShowPricingSuggestion(false);
    showToast('Tarifa optimizada aplicada', 'success');
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

  const saveCurrentQuote = async () => {
    if (!editingQuote.nombreCliente) { showToast('Selecciona un cliente', 'error'); return; }
    if (editingQuote.partidas.length === 0) { showToast('Añade al menos una partida', 'error'); return; }

    let saved: Presupuesto;

    if (isLiveMode && orgId) {
      const client = clientes.find(c => c.nombre === editingQuote.nombreCliente);
      if (!client) { showToast('Cliente no encontrado en CRM', 'error'); return; }
      try {
        const dbQuote = await saveQuote(
          orgId, client.id, editingQuote.descripcion,
          editingQuote.partidas.map(p => ({ descripcion: p.descripcion, tipo: p.tipo, cantidad: p.cantidad, precio_unitario: p.precioUnitario })),
        );
        saved = { id: dbQuote.numero, nombreCliente: editingQuote.nombreCliente, descripcion: dbQuote.descripcion ?? '', partidas: editingQuote.partidas, total: dbQuote.total_neto, fecha: dbQuote.fecha, estado: dbQuote.estado as Presupuesto['estado'], telefonoCliente: editingQuote.telefonoCliente, emailCliente: editingQuote.emailCliente };
      } catch (e: any) { showToast('Error al guardar: ' + e.message, 'error'); return; }
    } else {
      saved = { ...editingQuote, id: `P-2026-00${presupuestos.length + 1}` };
    }

    setPresupuestos(prev => [saved, ...prev]);
    setSelectedQuoteForPreview(saved);
    setActiveTab('preview');
    showToast('Presupuesto guardado');
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 3000);
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
    <div className={`font-sans transition-colors duration-300 ${
      isNativeDevice
        ? `fixed inset-0 overflow-hidden ${isDarkMode ? 'dark bg-slate-950' : 'bg-white'}`
        : `w-full min-h-screen flex flex-col ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'}`
    }`}>

      {/* ================= BARRA SUPERIOR DE SIMULACIÓN — SOLO EN DESKTOP ================= */}
      {!isNativeDevice && <div className="z-40 bg-slate-900 border-b border-slate-850 px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-white text-xs select-none shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-inner">TF</div>
          <span className="font-display font-bold tracking-tight uppercase">
            Console TrabFlow <span className="text-blue-500">AI</span>
          </span>
          <span className="bg-blue-500/10 border border-blue-500/30 text-blue-450 font-bold px-2 py-0.5 rounded-full text-[9px] uppercase tracking-wide flex items-center gap-1 animate-pulse">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>AI OS v2.6</span>
          </span>
        </div>

        {/* Toggles del Entorno de Demostración */}
        <div className="flex items-center gap-3">
          
          {/* Selector de Dispositivo */}
          <div className="bg-slate-800 p-0.5 rounded border border-slate-700 flex text-[10px]">
            <button 
              onClick={() => setIsMobileMode(false)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                !isMobileMode ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Escritorio</span>
            </button>
            <button 
              onClick={() => setIsMobileMode(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all cursor-pointer ${
                isMobileMode ? 'bg-blue-600 text-white font-bold shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Móvil (Obra)</span>
            </button>
          </div>

          {/* Selector de Color */}
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="bg-slate-800 border border-slate-700 hover:bg-slate-750 p-2 rounded text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-blue-400" />}
          </button>

          {/* Botón Login / Live */}
          {isLiveMode ? (
            <div className="flex items-center gap-2">
              <span className="hidden sm:flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold px-2.5 py-1 rounded-full text-[9px] uppercase tracking-wider font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Datos Reales
              </span>
              {session?.user?.email === 'fercarboc@gmail.com' && (
                <button
                  onClick={() => setCurrentPage(ActivePage.Admin)}
                  className="flex items-center gap-1.5 bg-blue-700/80 hover:bg-blue-600 px-3 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] text-white transition-colors cursor-pointer"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] text-slate-300 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Cerrar sesión</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLoginModal(true)}
              className="flex items-center gap-1.5 bg-emerald-600/90 hover:bg-emerald-600 px-3.5 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] text-white transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Modo Real</span>
            </button>
          )}

          {/* Botón Salir */}
          <button
            onClick={() => {
              setCurrentPage(ActivePage.Home);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-1.5 bg-red-600/90 hover:bg-red-650 px-3.5 py-1.5 rounded font-bold uppercase tracking-wider text-[10px] text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </div>}

      {/* Confeti flotante */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden flex items-center justify-center">
          {Array.from({ length: 45 }).map((_, i) => {
            const left = Math.random() * 100;
            const top = -10 - Math.random() * 20;
            const size = Math.random() * 8 + 6;
            const color = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-pink-500', 'bg-amber-500'][Math.floor(Math.random() * 5)];
            const rotation = Math.random() * 360;
            const delay = Math.random() * 2.5;
            
            return (
              <div 
                key={i} 
                className={`absolute rounded-xs opacity-75 ${color}`}
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  transform: `rotate(${rotation}deg)`,
                  animation: `fall 2.8s linear infinite`,
                  animationDelay: `${delay}s`
                }}
              />
            );
          })}
        </div>
      )}

      {/* ================= NÚCLEO DEL CONTENEDOR DE LA APLICACIÓN ================= */}
      {isNativeDevice ? (
        /* ===== MODO NATIVO: fullscreen sin frame, sin console header ===== */
        AppContentMobile()
      ) : (
      <div className="flex-grow flex items-center justify-center p-0 md:p-6 overflow-hidden">

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
          <div className="w-full max-w-7xl h-[calc(100vh-120px)] min-h-[580px] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-850 shadow-lg flex overflow-hidden">
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

      <style>{`
        @keyframes fall {
          0% { top: -10%; transform: translateX(0) rotate(0deg); }
          50% { transform: translateX(80px) rotate(180deg); }
          100% { top: 110%; transform: translateX(-40px) rotate(360deg); }
        }
      `}</style>

      {/* Notificación inteligente estilo iOS/Mac */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`fixed z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden ${
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
                  <div className="py-2">
                    <p className="text-[10px] text-slate-500 italic">Pulsa el micrófono...</p>
                    <p className="text-[9.5px] text-slate-400 mt-2 font-medium bg-slate-900 p-2 rounded-lg border border-slate-800">
                      💡 <strong>Ejemplo:</strong> "Instalar termo estanco de gas Vaillant y dos latiguillos de cobre."
                    </p>
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
                <span>Obra: <strong className="text-slate-350 tracking-wider font-mono">TrabFlow Voice</strong></span>
                
                {(voiceStep === 'listening' || voiceStep === 'transcribing') && (
                  <button
                    onClick={stopVoiceRecording}
                    className="bg-blue-600/20 hover:bg-blue-600 text-blue-450 hover:text-white border border-blue-500/20 px-3.5 py-1 rounded-full font-bold uppercase tracking-wider text-[9px] cursor-pointer"
                  >
                    {isLiveMode ? 'Parar y procesar' : 'Procesar'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <div className="bg-white p-3 rounded-2xl rounded-tl-xs shadow-xs text-xs max-w-[85%] self-start relative">
                      <span className="text-[8px] font-mono font-bold text-slate-400 block uppercase mb-1">Previsualización mensaje:</span>
                      <p className="leading-relaxed">
                        Hola <strong>{targetQuoteForWhatsApp.nombreCliente}</strong>, te adjunto el presupuesto <strong>{targetQuoteForWhatsApp.id}</strong> para <em>{targetQuoteForWhatsApp.descripcion}</em>.
                      </p>
                      <p className="mt-1 leading-relaxed">
                        Importe: <strong>{(targetQuoteForWhatsApp.total * 1.21).toFixed(2)}€ (IVA incl.)</strong>. Puedes firmar online aquí:
                      </p>
                      <p className="text-blue-600 underline font-semibold mt-1">
                        trabflow.com/p/{(targetQuoteForWhatsApp.id).toLowerCase()}
                      </p>
                    </div>

                    <div className="text-[10px] text-slate-500 text-center italic py-2">
                      "Revisa y envía" — ¿Listo para enviar por chat?
                    </div>

                    <button 
                      onClick={handleSendWhatsAppNow}
                      className="w-full bg-[#25d366] hover:bg-[#128c7e] text-white font-bold py-3.5 rounded-2xl text-xs uppercase tracking-wider text-center block cursor-pointer shadow-sm"
                    >
                      Enviar Ahora 💬
                    </button>
                  </div>
                )}

                {whatsAppStep === 'sending' && (
                  <div className="space-y-4 py-8 text-center">
                    <div className="w-10 h-10 border-2 border-t-[#075e54] border-slate-350 rounded-full animate-spin mx-auto" />
                    <span className="text-xs font-bold text-slate-650 uppercase font-mono block">Enviando presupuesto a través de WhatsApp Cloud...</span>
                  </div>
                )}

                {whatsAppStep === 'success' && (
                  <div className="space-y-5 py-4 text-center">
                    <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <Check className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-slate-905 uppercase">¡Enviado con Éxito!</h4>
                      <p className="text-[10px] text-slate-500 leading-normal">Tu cliente ha recibido el presupuesto para firmarlo.</p>
                    </div>

                    <button 
                      onClick={() => {
                        setShowWhatsAppModal(false);
                        setTargetQuoteForWhatsApp(null);
                        setWhatsAppStep('confirm');
                      }}
                      className="w-full bg-slate-900 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider block cursor-pointer"
                    >
                      Volver a Inicio
                    </button>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );

  // ================= RENDERIZADO MÓVIL REFACTORIZADO Y MEJORADO =================
  function AppContentMobile() {
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
          className={`bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 ${
            isNativeDevice ? 'px-5 pb-3' : 'px-4 py-3'
          }`}
          style={isNativeDevice ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' } : {}}
        >
          {/* Logo + nombre */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
              <span className="text-white font-black text-[10px]">TF</span>
            </div>
            <span className={`font-display font-black tracking-tight uppercase text-slate-900 dark:text-white ${isNativeDevice ? 'text-base' : 'text-sm'}`}>
              TrabFlow <span className="text-blue-500">AI</span>
            </span>
          </div>

          {/* Derecha: estado sesión + ajustes */}
          <div className="flex items-center gap-2">
            {isLiveMode ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-1 rounded-full text-[9px] uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                En vivo
              </span>
            ) : (
              <span className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold px-2 py-1 rounded-full text-[9px] uppercase tracking-wider font-mono">
                Demo
              </span>
            )}
            {isNativeDevice && (
              <button
                onClick={() => { setActiveTab('settings'); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 active:bg-slate-200 dark:active:bg-slate-700"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Contenido dinámico según Pestaña Móvil */}
        <div
          className="flex-grow overflow-y-auto overscroll-contain"
          style={{
            padding: isNativeDevice ? '16px 16px 0' : '16px',
            paddingBottom: isNativeDevice
              ? 'calc(80px + env(safe-area-inset-bottom, 0px) + 8px)'
              : '80px',
          }}
        >
          {mobileTab === 'inicio' && MobileScreenInicio()}
          {mobileTab === 'presupuestos' && MobileScreenPresupuestos()}
          {mobileTab === 'clientes' && MobileScreenClientes()}
          {mobileTab === 'facturas' && MobileScreenFacturas()}
          {activeTab === 'settings' && isNativeDevice && ScreenSettings()}
        </div>

        {/* BOTTOM TAB BAR + FAB */}
        <div
          className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 select-none z-30"
          style={{
            paddingBottom: isNativeDevice ? 'env(safe-area-inset-bottom, 0px)' : '0px',
            minHeight: isNativeDevice ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : '64px',
          }}
        >
          
          {MobileTabButton({ tab: 'inicio', icon: <TrendingUp className="w-5 h-5" />, label: 'Inicio' })}
          {MobileTabButton({ tab: 'presupuestos', icon: <FileText className="w-5 h-5" />, label: 'Presupuestos' })}
          
          {/* Botón Flotante + Nuevo */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-5">
            <button 
              onClick={() => setShowFloatingMenu(!showFloatingMenu)}
              className="w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-950 transition-transform active:scale-95 cursor-pointer"
            >
              {showFloatingMenu ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
            </button>
          </div>

          <div /> {/* Spacer para el botón flotante */}

          {MobileTabButton({ tab: 'clientes', icon: <Users className="w-5 h-5" />, label: 'Clientes' })}
          {MobileTabButton({ tab: 'facturas', icon: <InvoiceIcon className="w-5 h-5" />, label: 'Facturas' })}
        </div>

        {/* Menú Flotante inferior (Bottom Sheet) */}
        <AnimatePresence>
          {showFloatingMenu && (
            <React.Fragment>
              <div 
                className="absolute inset-0 bg-black/60 z-40 backdrop-blur-xs" 
                onClick={() => setShowFloatingMenu(false)}
              />
              <motion.div 
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                className="absolute bottom-16 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 rounded-t-[28px] p-5 space-y-3.5 z-50 text-xs shadow-2xl"
              >
                <div className="w-10 h-1 bg-slate-350 dark:bg-slate-700 rounded-full mx-auto mb-1" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono block text-center">Nuevo Presupuesto Rápido</span>
                
                <div className="space-y-2">
                  <button 
                    onClick={() => startWizard(2)} // Salta a Dictado
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
                  >
                    <Mic className="w-4.5 h-4.5" />
                    <span>🎙️ Dictado por voz IA</span>
                  </button>
                  <button 
                    onClick={() => startWizard(3)} // Salta a Fotos
                    className="w-full bg-slate-900 dark:bg-slate-800 text-white font-bold p-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
                  >
                    <ImageIcon className="w-4.5 h-4.5" />
                    <span>📷 Escanear con Foto</span>
                  </button>
                  <button 
                    onClick={() => startWizard(1)} // Flujo desde paso 1
                    className="w-full bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200 font-bold p-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-800 cursor-pointer"
                  >
                    <Plus className="w-4.5 h-4.5" />
                    <span>✍️ Crear manualmente</span>
                  </button>
                </div>
              </motion.div>
            </React.Fragment>
          )}
        </AnimatePresence>

      </div>
    );

    // Helpers botones navegación móvil
    function MobileTabButton({ tab, icon, label }: { tab: any; icon: React.ReactNode; label: string }) {
      const isActive = mobileTab === tab;
      return (
        <button
          onClick={() => {
            setMobileTab(tab);
            setShowFloatingMenu(false);
          }}
          className={`flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors ${
            isActive ? 'text-blue-500' : 'text-slate-450 dark:text-slate-500'
          }`}
        >
          {icon}
          <span className="text-[8.5px] font-bold uppercase tracking-wider">{label}</span>
        </button>
      );
    }
  }

  // ================= MÓVIL: INICIO SCREEN =================
  function MobileScreenInicio() {
    return (
      <div className="space-y-4">
        
        {/* Cabecera / Bienvenida */}
        <div className="space-y-0.5">
          <span className="text-[9.5px] text-blue-500 font-bold uppercase tracking-widest font-mono block">Instalador Activo</span>
          <h3 className="text-md font-display font-bold uppercase text-slate-905 dark:text-white truncate">
            {empresaAjustes.nombre.split(' ')[0]} Obra
          </h3>
        </div>

        {/* 3 KPIs principales simplificados */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-3 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Pendientes</span>
            <span className="text-sm font-bold text-blue-500 font-mono block">{presupuestosPendientesCount}</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-3 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Por cobrar</span>
            <span className="text-sm font-bold text-amber-500 font-mono block">{totalPendienteFacturas.toFixed(0)}€</span>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-3 rounded-2xl text-center space-y-1">
            <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 font-mono block">Activos</span>
            <span className="text-sm font-bold text-emerald-500 font-mono block">2</span>
          </div>
        </div>

        {/* Tarjeta de Progreso Simplificada */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-3 shadow-xs">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Objetivo Mensual</span>
            <span className="font-bold text-emerald-555 font-mono">77.5%</span>
          </div>
          <div className="h-2 bg-slate-100 dark:bg-slate-850 rounded-full w-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-600 to-emerald-400" style={{ width: '77.5%' }} />
          </div>
          <div className="flex justify-between text-[9px] text-slate-450 font-mono uppercase tracking-wider">
            <span>Facturado: 3,100€</span>
            <span>Objetivo: 4,000€</span>
          </div>
        </div>

        {/* Botón Gigante: Crear Presupuesto */}
        <button
          onClick={() => startWizard(2)} // Inicia directamente con Dictado
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-3xl p-5 text-center shadow-lg shadow-blue-500/10 space-y-2 flex flex-col items-center justify-center cursor-pointer transition-transform active:scale-99 border border-blue-500"
        >
          <div className="w-11 h-11 bg-white/10 rounded-full flex items-center justify-center">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold uppercase tracking-wider text-xs block">Crear Presupuesto</span>
          <p className="text-[9.5px] text-blue-150 leading-relaxed font-medium">Pulsa e inicia el dictado rápido en el tajo.</p>
        </button>

        {/* Microcopy Motivador */}
        <div className="text-center py-2">
          <p className="text-[10px] text-slate-455 italic uppercase tracking-wider font-mono">
            “Sin escribir, sin perder tiempo”
          </p>
        </div>

      </div>
    );
  }

  // ================= MÓVIL: PRESUPUESTOS LIST SCREEN =================
  function MobileScreenPresupuestos() {
    return (
      <div className="space-y-3">
        <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block">Presupuestos Generados:</span>
        
        {presupuestos.map(p => (
          <div
            key={p.id}
            onClick={() => {
              setSelectedQuoteForPreview(p);
              // Activar visualización móvil del PDF
              setWizardQuote(p);
              setWizardStep(5);
              setWizardActive(true);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-3 cursor-pointer hover:border-slate-350 transition-colors"
          >
            <div className="flex justify-between items-start gap-2">
              <div className="truncate">
                <span className="font-bold text-xs text-slate-900 dark:text-white block truncate">{p.nombreCliente}</span>
                <span className="text-[10px] text-slate-450 block truncate">{p.descripcion}</span>
              </div>
              <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
                p.estado === 'Facturado' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                p.estado === 'Aceptado' ? 'bg-blue-500/10 text-blue-450 border border-blue-500/20' :
                p.estado === 'Enviado' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                'bg-slate-500/10 text-slate-450 border border-slate-500/20'
              }`}>
                {p.estado}
              </span>
            </div>

            <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 dark:border-slate-850 text-xs">
              <span className="text-slate-400 font-mono text-[9px] uppercase">Importe (+IVA):</span>
              <span className="font-bold font-mono text-slate-905 dark:text-white">{(p.total * 1.21).toFixed(2)}€</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ================= MÓVIL: CLIENTES CRM SCREEN =================
  function MobileScreenClientes() {
    return (
      <div className="space-y-3">
        {/* Buscador + botón nuevo cliente */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 rounded-2xl pl-9 pr-4 py-2.5 text-xs text-slate-800 dark:text-white focus:outline-none"
            />
          </div>
          <button
            onClick={() => { setNewClient({ nombre: '', telefono: '', email: '', direccion: '' }); setIsClientModalOpen(true); }}
            className="bg-blue-600 text-white rounded-2xl px-3.5 py-2.5 flex items-center justify-center cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block">Libreta de Contactos:</span>

        {/* Modal nuevo cliente (accesible desde móvil) */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">Nuevo Cliente</h3>
                <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              {([['nombre','Nombre *','text','Juan García'],['telefono','Teléfono','tel','600 000 000'],['email','Email','email','cliente@email.com'],['direccion','Dirección','text','Calle Mayor 1']] as const).map(([field, label, type, ph]) => (
                <div key={field}>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">{label}</label>
                  <input type={type} placeholder={ph} value={(newClient as any)[field] ?? ''} onChange={(e) => setNewClient(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div className="flex gap-3">
                <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 cursor-pointer">Cancelar</button>
                <button onClick={handleAddClient} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-bold text-white cursor-pointer">Guardar</button>
              </div>
            </div>
          </div>
        )}



        {/* Lista expandible */}
        <div className="space-y-2">
          {filteredClientes.map(c => {
            const isExpanded = expandedClientMobileId === c.id;
            return (
              <div 
                key={c.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl overflow-hidden transition-all shadow-xs"
              >
                <div 
                  onClick={() => setExpandedClientMobileId(isExpanded ? null : c.id)}
                  className="p-4 flex items-center justify-between cursor-pointer"
                >
                  <div className="truncate pr-2">
                    <span className="font-bold text-xs text-slate-900 dark:text-white block uppercase tracking-wide truncate">{c.nombre}</span>
                    <span className="text-[9.5px] text-slate-450 block font-mono truncate">{c.telefono}</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-850 pt-3 bg-slate-50/50 dark:bg-slate-950/20 text-xs space-y-3">
                    <div className="text-[10px] text-slate-500 leading-normal space-y-1">
                      <p>📍 Dirección: {c.direccion}</p>
                      <p>✉️ Email: {c.email}</p>
                      <p>💼 Obras Activas: {c.obrasActivas}</p>
                      <p>💰 Cobros Totales: <strong className="font-mono text-emerald-500">{c.totalFacturado}€</strong></p>
                    </div>

                    {/* Botones de acción grandes a un toque */}
                    <div className="grid grid-cols-2 gap-2">
                      <a 
                        href={`tel:${c.telefono}`} 
                        className="bg-slate-900 dark:bg-slate-800 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[10px] uppercase cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>Llamar</span>
                      </a>
                      <button 
                        onClick={() => showToast('Mensaje de contacto iniciado por WhatsApp')}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[10px] uppercase cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ================= MÓVIL: FACTURAS SCREEN =================
  function MobileScreenFacturas() {
    // Ordenar facturas por cobro pendiente primero
    const sortedFacturas = [...facturas].sort((a, b) => {
      if (a.estado !== 'Pagada' && b.estado === 'Pagada') return -1;
      if (a.estado === 'Pagada' && b.estado !== 'Pagada') return 1;
      return 0;
    });

    return (
      <div className="space-y-3">
        <span className="text-[9px] font-bold text-slate-450 uppercase tracking-widest font-mono block">Facturas y Vencimientos:</span>
        
        {sortedFacturas.map(f => (
          <div
            key={f.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-2xl space-y-3 shadow-xs"
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{f.numeroFactura}</span>
                  <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                    f.estado === 'Pagada' ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20' :
                    f.estado === 'Pendiente' ? 'bg-amber-500/10 text-amber-450 border border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {f.estado}
                  </span>
                </div>
                <span className="font-semibold text-xs text-slate-800 dark:text-slate-350 block mt-1">{f.nombreCliente}</span>
              </div>

              <div className="text-right">
                <span className="text-[8px] font-mono text-slate-400 block uppercase">Total cobro:</span>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{(f.importe * 1.21).toFixed(0)}€</span>
              </div>
            </div>

            {/* Acciones One-tap */}
            <div className={`pt-2 border-t border-slate-100 dark:border-slate-850 ${f.estado !== 'Pagada' ? 'grid grid-cols-3 gap-2' : 'flex justify-between items-center'}`}>
              {f.estado !== 'Pagada' ? (
                <>
                  <button
                    onClick={() => handlePayInvoice(f.id)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[9.5px] uppercase cursor-pointer"
                  >
                    💰 Cobrar
                  </button>
                  <button
                    onClick={() => handleRemindInvoice(f)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold p-2.5 rounded-xl flex items-center justify-center text-[9.5px] uppercase cursor-pointer"
                  >
                    💬 WA
                  </button>
                  <button
                    onClick={() => printInvoice(f)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold p-2.5 rounded-xl flex items-center justify-center gap-1 text-[9.5px] uppercase cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />PDF
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[9.5px] font-mono text-slate-450 uppercase flex items-center gap-1">
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    Cobrada · {f.fecha}
                  </span>
                  <button
                    onClick={() => printInvoice(f)}
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold p-2 rounded-xl flex items-center gap-1 text-[9px] uppercase cursor-pointer"
                  >
                    <FileText className="w-3 h-3" />PDF
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ================= MÓVIL: WIZARD DE CREACIÓN EN 5 PASOS =================
  function MobileWizardView() {
    return (
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 select-none relative">
        
        {/* Progreso del Wizard */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 px-4 py-3 shrink-0">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-mono font-bold text-blue-500 uppercase tracking-widest">
              Paso {wizardStep} de 5
            </span>
            <button 
              onClick={() => {
                setWizardActive(false);
                setMobileTab('inicio');
              }}
              className="text-slate-400 hover:text-slate-905 p-0.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Barra indicadora de progreso */}
          <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full w-full overflow-hidden">
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
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">Elige un cliente existente de tu lista o regístralo rápidamente.</p>
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
                          ? 'border-blue-600 bg-blue-500/5' 
                          : 'border-slate-200 dark:border-slate-850 bg-white dark:bg-slate-900 hover:border-slate-350'
                      }`}
                    >
                      <div className="truncate">
                        <span className="font-bold block truncate">{c.nombre}</span>
                        <span className="text-[10px] text-slate-450 block truncate font-mono">{c.direccion}</span>
                      </div>
                      {isSelected && <Check className="w-4.5 h-4.5 text-blue-500 shrink-0 ml-2" />}
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
                className="w-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-center uppercase tracking-wider text-[10px] cursor-pointer"
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
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">"Habla como lo harías por WhatsApp" — La IA estructurará las partidas y materiales por ti.</p>
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
                  <div className="w-20 h-20 bg-slate-850 rounded-full flex items-center justify-center shadow-md border border-slate-700">
                    <div className="absolute inset-0 rounded-full border-2 border-slate-900 border-t-blue-500 animate-spin" />
                    <Sparkles className="w-7 h-7 text-blue-400" />
                  </div>
                ) : (
                  <button 
                    onClick={startVoiceRecording}
                    className="w-20 h-20 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform hover:scale-102"
                  >
                    <Mic className="w-8 h-8 text-white" />
                  </button>
                )}

                <span className="text-[9.5px] font-bold text-slate-450 uppercase tracking-widest mt-6 font-mono block">
                  {voiceStep === 'listening' ? 'Grabando audio...' : voiceStep === 'transcribing' ? 'Transcribiendo...' : voiceStep === 'thinking' ? 'IA Procesando...' : 'Pulsa para dictar obra'}
                </span>
              </div>

              {/* Visualizador de texto */}
              <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 p-4 rounded-2xl min-h-[90px] text-xs">
                {voiceText ? (
                  <p className="italic text-slate-700 dark:text-slate-200 leading-normal">
                    "{voiceText}"
                  </p>
                ) : (
                  <div className="space-y-2 text-slate-450 italic font-sans leading-normal">
                    <p>💡 <strong>Ejemplo de dictado:</strong></p>
                    <p>"Instalación de termo de doce litros Vaillant estanco, tres horas de mano de obra a cuarenta y cinco euros y latiguillos por quince euros."</p>
                  </div>
                )}
              </div>

              {/* Caja de edición manual alternativa */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">O escribe la descripción aquí:</span>
                <textarea
                  value={wizardQuote.descripcion}
                  onChange={(e) => setWizardQuote(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Detalla la avería o el trabajo..."
                  className="w-full bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 rounded-xl p-3 text-xs focus:outline-none"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* PASO 3: AÑADIR FOTOS */}
          {wizardStep === 3 && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-display font-bold uppercase">Paso 3: Añadir Fotografía</h3>
                  <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">Opcional — Toma foto de equipos viejos o averías para que la IA identifique recambios.</p>
                </div>
                <button
                  onClick={() => setWizardStep(4)}
                  className="shrink-0 text-[9.5px] font-bold uppercase text-slate-400 hover:text-blue-500 cursor-pointer transition-colors whitespace-nowrap pt-0.5"
                >
                  Saltar →
                </button>
              </div>

              {/* Preset selector */}
              <div className="grid grid-cols-2 gap-2">
                {presetPhotos.map(p => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectPresetPhoto(p)}
                    className={`p-2 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center gap-2 bg-white dark:bg-slate-900 ${
                      selectedPhotoPreset?.id === p.id ? 'border-blue-600' : 'border-slate-200 dark:border-slate-850'
                    }`}
                  >
                    <img src={p.url} alt={p.name} className="w-full h-16 rounded-xl object-cover" />
                    <span className="font-bold text-[9.5px] text-slate-800 dark:text-slate-200 block text-center truncate w-full">{p.name}</span>
                  </div>
                ))}
              </div>

              {selectedPhotoPreset ? (
                <div className="space-y-3 pt-2">
                  <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video flex items-center justify-center">
                    <img src={selectedPhotoPreset.url} alt="Scan preview" className="max-h-full max-w-full object-contain" />
                    {isScanning && (
                      <div 
                        className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] z-20"
                        style={{ top: `${scanProgress}%`, transition: 'top 100ms linear' }}
                      />
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-450 font-mono text-[9px]">{selectedPhotoPreset.name}</span>
                    {!isScanning ? (
                      <button
                        onClick={startPhotoAnalysis}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] uppercase cursor-pointer"
                      >
                        Analizar con IA 📷
                      </button>
                    ) : (
                      <span className="text-emerald-450 font-bold font-mono text-[9px] animate-pulse">Escaneando... {scanProgress}%</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-850 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-slate-850 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-200 dark:border-slate-800">
                    <Upload className="w-5 h-5 text-slate-500" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-800 dark:text-white block">Haz foto o selecciona un preset</span>
                    <span className="text-[10px] text-slate-450 block mt-1 leading-normal">Optimizado para operar en obra con la cámara del móvil.</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PASO 4: REVISAR PARTIDAS IA */}
          {wizardStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h3 className="text-sm font-display font-bold uppercase">Paso 4: Revisa el Presupuesto</h3>
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">Añade o modifica cantidades y precios sugeridos de los componentes detectados.</p>
              </div>

              {/* Botón sugerencia precio */}
              {showPricingSuggestion && suggestedPricingInfo && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 text-[11px] flex justify-between items-center gap-2 text-left">
                  <div>
                    <span className="font-bold text-blue-400 block font-mono text-[8.5px] uppercase">Recomendación IA</span>
                    <p className="text-slate-350 mt-0.5 leading-normal">Sevilla precio de mano de obra medio: 52€/h (cobrando 45€/h).</p>
                  </div>
                  <button 
                    onClick={applySuggestedPricing}
                    className="bg-blue-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-[8.5px] uppercase shrink-0"
                  >
                    Optimizar
                  </button>
                </div>
              )}

              {/* Listado editable de partidas */}
              <div className="space-y-2">
                {wizardQuote.partidas?.map((part, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl space-y-2 text-xs"
                  >
                    {/* Descripción editable */}
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] shrink-0">{part.tipo === 'material' ? '📦' : '🛠️'}</span>
                      <input
                        type="text"
                        value={part.descripcion}
                        onChange={e => handleUpdateWizardItem(idx, { descripcion: e.target.value })}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                      />
                      <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 p-1 shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Controles cantidad / precio / total */}
                    <div className="flex items-center gap-2">
                      {part.tipo === 'mano_de_obra' ? (
                        <>
                          <div className="flex-1 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg px-2.5 py-1.5">
                            <input
                              type="number"
                              min="0.5"
                              step="0.5"
                              value={part.cantidad}
                              onChange={e => handleUpdateWizardItem(idx, {
                                cantidad: parseFloat(e.target.value) || 1,
                                precioUnitario: empresaAjustes.valorHoraOperario,
                              })}
                              className="w-12 bg-transparent text-center text-xs font-bold text-amber-700 dark:text-amber-300 focus:outline-none"
                            />
                            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono whitespace-nowrap">h × {empresaAjustes.valorHoraOperario}€/h</span>
                          </div>
                          <span className="text-[9px] text-slate-400">o precio manual:</span>
                          <input
                            type="number"
                            step="0.01"
                            value={part.precioUnitario || ''}
                            placeholder="€/h"
                            onChange={e => handleUpdateWizardItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                            className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-right text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 whitespace-nowrap">Cant.</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={part.cantidad}
                              onChange={e => handleUpdateWizardItem(idx, { cantidad: parseFloat(e.target.value) || 1 })}
                              className="w-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-center text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-slate-400 whitespace-nowrap">P/ud</span>
                            <input
                              type="number"
                              step="0.01"
                              value={part.precioUnitario || ''}
                              placeholder="0.00"
                              onChange={e => handleUpdateWizardItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                              className="w-20 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-right text-xs font-mono text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                        </>
                      )}
                      <span className="ml-auto font-bold font-mono text-slate-900 dark:text-white whitespace-nowrap">
                        {part.total.toFixed(2)}€
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleAddManualItem}
                className="w-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-[10px] uppercase tracking-wider text-center cursor-pointer"
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
                <p className="text-[10.5px] text-slate-450 leading-relaxed font-sans">"Revisa y envía" — Hemos preparado el borrador. Envíaselo por WhatsApp al cliente en un tap.</p>
              </div>

              {/* Ficha colapsada simplificada */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-[24px] space-y-4 shadow-sm text-xs">
                
                {/* Cabecera */}
                <div className="flex justify-between items-start gap-2 border-b border-slate-100 dark:border-slate-850 pb-3">
                  <div>
                    <span className="text-[9px] font-mono font-bold text-slate-400 block uppercase">CLIENTE:</span>
                    <span className="font-bold text-sm text-slate-900 dark:text-white uppercase tracking-wide block">{wizardQuote.nombreCliente}</span>
                    <span className="text-[10.5px] text-slate-500 block truncate">{wizardQuote.descripcion}</span>
                  </div>
                  <span className="bg-amber-500/10 border border-amber-500/30 text-amber-450 font-bold px-2 py-0.5 rounded-full text-[8.5px] font-mono uppercase">
                    {wizardQuote.estado}
                  </span>
                </div>

                {/* Importe destacado */}
                <div className="flex justify-between items-baseline py-1">
                  <span className="text-[10px] text-slate-450 font-semibold uppercase tracking-wider font-mono">Importe Final (IVA Incl.):</span>
                  <span className="text-lg font-bold font-mono text-blue-650 dark:text-blue-400">
                    {((wizardQuote.total || 0) * 1.21).toFixed(2)}€
                  </span>
                </div>

                {/* Partidas colapsables */}
                <div className="border-t border-slate-100 dark:border-slate-850 pt-3 space-y-2">
                  <button 
                    onClick={() => setItemsCollapsedMobile(!itemsCollapsedMobile)}
                    className="flex justify-between items-center w-full text-slate-500 font-bold text-[10px] uppercase font-mono tracking-wide"
                  >
                    <span>Detalle de partidas ({wizardQuote.partidas?.length || 0})</span>
                    {itemsCollapsedMobile ? <ChevronDown className="w-4.5 h-4.5" /> : <ChevronUp className="w-4.5 h-4.5" />}
                  </button>

                  {!itemsCollapsedMobile && (
                    <div className="space-y-1.5 pt-1.5 animate-fadeIn">
                      {wizardQuote.partidas?.map((part, idx) => (
                        <div key={idx} className="flex justify-between items-baseline text-[10.5px] text-slate-650 dark:text-slate-400">
                          <span className="truncate pr-2">✓ {part.descripcion} x{part.cantidad}</span>
                          <span className="font-mono font-semibold shrink-0">{part.total.toFixed(0)}€</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-px bg-slate-100 dark:bg-slate-850 my-1" />

                {/* Badges de cumplimiento */}
                <div className="flex items-center gap-2 text-[9px] text-slate-400 dark:text-slate-550 leading-relaxed font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Presupuesto timbrado digitalmente</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* BOTÓN CTAs ADHERIDO EN BASE (STICKY BOTTOM) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-850 p-4 shrink-0 z-30 select-none flex gap-2">
          {wizardStep > 1 && (
            <button
              onClick={() => setWizardStep(prev => prev - 1)}
              className="px-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-350 py-3.5 rounded-2xl font-bold uppercase tracking-wider text-[10px] cursor-pointer"
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
        </div>

        {/* Modal: asignar cliente al finalizar */}
        {showQuickClientModal && (
          <div className="absolute inset-0 z-50 flex items-end bg-black/50">
            <div className="w-full bg-white dark:bg-slate-900 rounded-t-3xl p-5 space-y-4">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wide">¿A quién va este presupuesto?</h3>
                <p className="text-[10.5px] text-slate-450 mt-0.5">Añade nombre y teléfono para enviarlo por WhatsApp.</p>
              </div>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Nombre del cliente *"
                  value={quickClientName}
                  onChange={e => setQuickClientName(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="tel"
                  placeholder="Teléfono (WhatsApp)"
                  value={quickClientPhone}
                  onChange={e => setQuickClientPhone(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email (opcional)"
                  value={quickClientEmail}
                  onChange={e => setQuickClientEmail(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => finishWizardAndSave('Sin nombre', '')}
                  className="flex-1 py-3 rounded-xl text-[10px] font-bold uppercase text-slate-500 border border-slate-200 dark:border-slate-700 cursor-pointer"
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
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/10 shrink-0">
              SI
            </div>
            <div className="overflow-hidden">
              <span className="font-bold text-xs text-white block uppercase tracking-wide truncate">{empresaAjustes.nombre}</span>
              <span className="text-[10px] text-slate-500 block font-mono truncate">{empresaAjustes.nif}</span>
            </div>
          </div>

          {/* Enlaces sidebar */}
          <nav className="flex-grow p-4 space-y-1">
            {SidebarBtn({ id: 'dashboard', icon: <TrendingUp className="w-4 h-4" />, label: 'Panel Control' })}
            {SidebarBtn({ id: 'create_quote', icon: <FilePlus className="w-4 h-4" />, label: 'Crear Presupuesto' })}
            {SidebarBtn({ id: 'ai_scan', icon: <ImageIcon className="w-4 h-4" />, label: 'Escaneo Foto IA' })}
            {SidebarBtn({ id: 'crm', icon: <Users className="w-4 h-4" />, label: 'Clientes CRM' })}
            {SidebarBtn({ id: 'invoices', icon: <FileText className="w-4 h-4" />, label: 'Facturación' })}
            {SidebarBtn({ id: 'catalog', icon: <Package className="w-4 h-4" />, label: 'Catálogo' })}
            {SidebarBtn({ id: 'settings', icon: <SettingsIcon className="w-4 h-4" />, label: 'Ajustes y Tarifas' })}
          </nav>

          <div className="p-4 border-t border-slate-855 bg-slate-950/20 text-center space-y-2">
            <div className="inline-block bg-blue-500/10 border border-blue-500/30 text-blue-450 text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider animate-pulse font-mono">
              Pro Beta Mode
            </div>
            <p className="text-[10px] text-slate-500 leading-normal font-sans">Facturación electrónica y presupuestos seguros.</p>
          </div>
        </aside>

        {/* CUERPO CENTRAL DE LA CONSOLA DESKTOP */}
        <div className="flex-grow flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950">
          
          {/* Header de la sección */}
          <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-850 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block font-mono">
                TrabFlow AI Operating System
              </span>
              <h2 className="text-md sm:text-lg font-display font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                {activeTab === 'dashboard' && 'Panel de Control'}
                {activeTab === 'create_quote' && 'Crear Presupuesto'}
                {activeTab === 'ai_scan' && 'Escáner Fotográfico IA'}
                {activeTab === 'crm' && 'Clientes CRM'}
                {activeTab === 'invoices' && 'Facturación'}
                {activeTab === 'catalog' && 'Catálogo de Productos'}
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
              {activeTab === 'create_quote' && (
                <button 
                  onClick={saveCurrentQuote}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-101"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Presupuesto</span>
                </button>
              )}
              {activeTab === 'preview' && selectedQuoteForPreview && (
                <button 
                  onClick={() => convertQuoteToInvoice(selectedQuoteForPreview)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-wider text-[10px] px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-101"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Facturar Presupuesto</span>
                </button>
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
                {activeTab === 'create_quote' && ScreenCreateQuote()}
                {activeTab === 'ai_scan' && ScreenAIScan()}
                {activeTab === 'crm' && ScreenCRM()}
                {activeTab === 'invoices' && ScreenInvoices()}
                {activeTab === 'catalog' && ScreenCatalog()}
                {activeTab === 'settings' && ScreenSettings()}
                {activeTab === 'preview' && ScreenPreview()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </React.Fragment>
    );

    // Helpers botones navegación escritorio
    function SidebarBtn({ id, icon, label }: { id: string; icon: React.ReactNode; label: string }) {
      const isActive = activeTab === id || (id === 'create_quote' && activeTab === 'preview');
      return (
        <button
          onClick={() => setActiveTab(id)}
          className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative ${
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
    return (
      <div className="space-y-6">
        
        {/* Recomendador IA flotante */}
        {showPricingSuggestion && suggestedPricingInfo && (
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
                <span className="font-bold text-xs text-slate-800 dark:text-white">Optimizar coste mano de obra en Sevilla</span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal max-w-lg">
                  Has presupuestado la mano de obra a 45€/h. El promedio verificado de mercado para calderas Vaillant en Sevilla es de <strong>52€/h</strong>. ¿Deseas aplicar la tarifa recomendada?
                </p>
              </div>
            </div>

            <div className="flex gap-2 shrink-0">
              <button 
                onClick={applySuggestedPricing}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Aplicar 52€/h (+{suggestedPricingInfo.diff}€)
              </button>
              <button 
                onClick={() => setShowPricingSuggestion(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-655 dark:text-slate-400 hover:bg-slate-250 dark:hover:bg-slate-750 font-bold text-[10px] uppercase tracking-wider py-2.5 px-4 rounded-xl cursor-pointer"
              >
                Ignorar
              </button>
            </div>
          </motion.div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 p-4 rounded-2xl space-y-1">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Trimestre Facturado</span>
            <div className="text-xl sm:text-2xl font-display font-bold text-emerald-600 dark:text-emerald-450 tracking-tight">
              {totalFacturadoFacturas.toFixed(2)}€
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">✓ Cobro confirmado</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 p-4 rounded-2xl space-y-1">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Pendiente Cobro</span>
            <div className="text-xl sm:text-2xl font-display font-bold text-amber-500 tracking-tight">
              {totalPendienteFacturas.toFixed(2)}€
            </div>
            <span className="text-[10px] text-slate-400 block font-mono">⚠ En plazo de vencimiento</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 p-4 rounded-2xl space-y-1">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Borradores en Espera</span>
            <div className="text-xl sm:text-2xl font-display font-bold text-blue-500 tracking-tight">
              {presupuestosPendientesCount}
            </div>
            <span className="text-[10px] text-slate-400 block">Presupuestos por firmar</span>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-205 dark:border-slate-850 p-4 rounded-2xl space-y-1">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Tasa de Aceptación</span>
            <div className="text-xl sm:text-2xl font-display font-bold text-slate-905 dark:text-white tracking-tight">
              82.4%
            </div>
            <span className="text-[10px] text-slate-400 block">Optimizado por rapidez</span>
          </div>
        </div>

        {/* Acciones */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button 
            onClick={() => {
              setEditingQuote({
                id: 'P-2026-NEW',
                nombreCliente: '',
                descripcion: '',
                fecha: new Date().toISOString().split('T')[0],
                estado: 'Borrador',
                partidas: [],
                total: 0
              });
              startVoiceRecording();
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl p-5 text-center shadow-lg hover:shadow-blue-500/10 space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101 border border-blue-500"
          >
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <Mic className="w-6 h-6 text-white" />
            </div>
            <span className="font-display font-bold uppercase tracking-wider text-xs block">Presupuesto por Voz IA</span>
            <p className="text-[10px] text-blue-105 leading-normal max-w-xs">Dicta en la furgoneta o en obra; creamos el presupuesto estructurado.</p>
          </button>

          <button 
            onClick={() => setActiveTab('ai_scan')}
            className="bg-slate-900 dark:bg-slate-900 hover:bg-slate-850 dark:hover:bg-slate-850 border border-slate-250 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101"
          >
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/25">
              <ImageIcon className="w-6 h-6 text-emerald-450" />
            </div>
            <span className="font-display font-bold uppercase tracking-wider text-xs block">Escaneo Foto de Obra</span>
            <p className="text-[10px] text-slate-400 leading-normal max-w-xs">Identifica materiales y precios detectando calderas, tubos y componentes.</p>
          </button>

          <button 
            onClick={() => {
              setNewClient({ nombre: '', telefono: '', email: '', direccion: '' });
              setIsClientModalOpen(true);
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white rounded-2xl p-5 text-center space-y-2 cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-101"
          >
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-750">
              <Plus className="w-6 h-6 text-slate-600 dark:text-slate-400" />
            </div>
            <span className="font-display font-bold uppercase tracking-wider text-xs block">Registrar Cliente CRM</span>
            <p className="text-[10px] text-slate-455 leading-normal max-w-xs">Da de alta un cliente y guarda sus datos fiscales para futuros cobros.</p>
          </button>
        </div>

        {/* Evolución gráfica SVG */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl lg:col-span-7 space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block font-mono">Historial</span>
                <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white uppercase">Ingresos Recientes</h3>
              </div>
            </div>

            <div className="h-44 w-full flex items-end justify-between pt-6 gap-2">
              {[
                { mes: 'Ene', valor: '820€', altura: '30%' },
                { mes: 'Feb', valor: '1,150€', altura: '45%' },
                { mes: 'Mar', valor: '1,400€', altura: '55%' },
                { mes: 'Abr', valor: '2,100€', altura: '75%' },
                { mes: 'May', valor: '2,850€', altura: '100%' }
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col items-center flex-1 h-full justify-end group">
                  <div className="text-[9px] font-bold text-slate-500 dark:text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity mb-1 font-mono">{item.valor}</div>
                  {idx === 4 ? (
                    <div className="w-full bg-gradient-to-t from-blue-600 via-indigo-500 to-emerald-400 rounded-t-lg shadow-md" style={{ height: item.altura }} />
                  ) : (
                    <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-t-lg" style={{ height: item.altura }} />
                  )}
                  <span className="text-[9px] mt-2 font-mono text-slate-400">{item.mes}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Ultimos Presupuestos */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-5 rounded-2xl lg:col-span-5 space-y-4">
            <div>
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">Lista</span>
              <h3 className="text-sm font-display font-bold text-slate-900 dark:text-white uppercase">Presupuestos Recientes</h3>
            </div>

            <div className="space-y-3">
              {presupuestos.slice(0, 3).map(p => (
                <div 
                  key={p.id} 
                  onClick={() => {
                    setSelectedQuoteForPreview(p);
                    setActiveTab('preview');
                  }}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-850 cursor-pointer"
                >
                  <div className="space-y-0.5 truncate pr-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-white block truncate">{p.nombreCliente}</span>
                    <span className="text-[10px] text-slate-450 block truncate">{p.descripcion}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">{p.total.toFixed(0)}€</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    );
  }

  // ================= DESKTOP: CREAR PRESUPUESTO SCREEN =================
  function ScreenCreateQuote() {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-850">
          <div>
            <h3 className="text-md font-display font-bold uppercase text-slate-900 dark:text-white">Borrador de Presupuesto</h3>
          </div>
          <button 
            onClick={() => setIsVoiceModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-650/20 border border-blue-500/30 text-blue-450 font-bold uppercase tracking-wider text-[10px] py-2.5 px-4 rounded-xl cursor-pointer"
          >
            <Mic className="w-4 h-4 animate-pulse text-blue-400" />
            <span>Asistente por Voz 🎙️</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Cliente CRM</label>
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
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-855 dark:text-white focus:outline-none"
            >
              <option value="">-- Buscar cliente --</option>
              {clientes.map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nombre Obra</label>
            <input
              type="text"
              placeholder="Instalación termo, grifo..."
              value={editingQuote.descripcion}
              onChange={(e) => setEditingQuote(prev => ({ ...prev, descripcion: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">Fecha</label>
            <input
              type="date"
              value={editingQuote.fecha}
              onChange={(e) => setEditingQuote(prev => ({ ...prev, fecha: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Partidas de Obra</h4>
            <button 
              onClick={handleAddManualItem}
              className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-750 font-bold uppercase tracking-wider text-[9px] py-1.5 px-3 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Añadir Fila</span>
            </button>
          </div>

          <div className="space-y-2">
            {editingQuote.partidas.map((item, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 p-3 rounded-xl flex flex-wrap md:flex-nowrap gap-3 items-center">
                <input
                  type="text"
                  value={item.descripcion}
                  placeholder="Concepto..."
                  onChange={(e) => handleUpdateItem(idx, { descripcion: e.target.value })}
                  className="flex-grow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white"
                />
                
                <select
                  value={item.tipo}
                  onChange={(e) => handleUpdateItem(idx, { tipo: e.target.value as any })}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-white"
                >
                  <option value="material">Material 📦</option>
                  <option value="mano_de_obra">Mano Obra 🛠️</option>
                </select>

                <input
                  type="number"
                  value={item.cantidad}
                  min="1"
                  onChange={(e) => handleUpdateItem(idx, { cantidad: parseInt(e.target.value) || 1 })}
                  className="w-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-center text-xs text-slate-800 dark:text-white"
                />

                <input
                  type="number"
                  step="0.01"
                  value={item.precioUnitario || ''}
                  placeholder="0.00"
                  onChange={(e) => handleUpdateItem(idx, { precioUnitario: parseFloat(e.target.value) || 0 })}
                  className="w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-right text-xs text-slate-800 dark:text-white"
                />

                <span className="w-16 text-right text-xs font-mono font-bold text-slate-900 dark:text-white">{item.total.toFixed(0)}€</span>

                <button onClick={() => handleRemoveItem(idx)} className="text-slate-400 hover:text-red-500 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-850 pt-4 flex justify-between items-center">
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-wider block font-mono">Total Neto</span>
            <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{editingQuote.total.toFixed(2)}€</div>
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
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-2xl p-5 space-y-6">
        <div>
          <h3 className="text-md font-display font-bold uppercase text-slate-905 dark:text-white">Escaneo de Foto con IA (Escritorio)</h3>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {presetPhotos.map(p => (
            <div key={p.id} onClick={() => handleSelectPresetPhoto(p)} className={`p-2 bg-slate-50 dark:bg-slate-950 border rounded-2xl cursor-pointer ${selectedPhotoPreset?.id === p.id ? 'border-blue-600' : 'border-slate-200 dark:border-slate-800'}`}>
              <img src={p.url} alt={p.name} className="w-full h-24 rounded-xl object-cover" />
              <span className="text-[10px] font-bold mt-1.5 block text-center truncate">{p.name}</span>
            </div>
          ))}
        </div>

        {selectedPhotoPreset && (
          <div className="grid grid-cols-2 gap-4">
            <div className="relative rounded-2xl overflow-hidden aspect-video bg-slate-950 flex items-center justify-center">
              <img src={selectedPhotoPreset.url} alt="Worksite" className="max-h-full max-w-full object-contain" />
              {isScanning && (
                <div className="absolute left-0 right-0 h-1 bg-emerald-400 shadow-[0_0_15px_#34d399] z-20" style={{ top: `${scanProgress}%` }} />
              )}
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block font-mono uppercase">Materiales extraídos por IA</span>
                <p className="text-xs text-slate-400 italic mt-4">Por favor, inicia el escaneo con IA.</p>
              </div>
              <button onClick={startPhotoAnalysis} className="w-full bg-emerald-600 text-white font-bold p-3 rounded-xl text-[10px] uppercase">
                Iniciar Escaneo Láser IA
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= DESKTOP: PDF PREVIEW SCREEN =================
  function ScreenPreview() {
    if (!selectedQuoteForPreview) return null;
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border p-4 rounded-2xl flex justify-between items-center">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => triggerWhatsAppShare(selectedQuoteForPreview)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer flex items-center gap-1.5">
              💬 WhatsApp
            </button>
            <button onClick={() => printQuote(selectedQuoteForPreview)} className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer">
              <FileText className="w-3.5 h-3.5" />
              PDF
            </button>
            {selectedQuoteForPreview.estado !== 'Facturado' && (
              <button onClick={() => convertQuoteToInvoice(selectedQuoteForPreview)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-[10px] uppercase cursor-pointer flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Convertir en Factura
              </button>
            )}
          </div>
        </div>

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
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {selectedQuoteForPreview.partidas.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 text-slate-700">
                  <td className="py-2.5">{item.descripcion}</td>
                  <td className="py-2.5 text-right font-mono font-bold text-slate-900">{item.total}€</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-right mt-6 text-xs space-y-1 font-mono">
            <p className="text-slate-550">Subtotal: {selectedQuoteForPreview.total.toFixed(2)}€</p>
            <p className="text-slate-905 font-bold">Total (+IVA): {(selectedQuoteForPreview.total * 1.21).toFixed(2)}€</p>
          </div>
        </div>
      </div>
    );
  }

  // ================= DESKTOP: CRM SCREEN =================
  function ScreenCRM() {
    return (
      <div className="space-y-4">
        {/* Cabecera: buscador + botón nuevo cliente */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => { setNewClient({ nombre: '', telefono: '', email: '', direccion: '' }); setIsClientModalOpen(true); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 font-bold uppercase tracking-wider text-[10px] cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo Cliente
          </button>
        </div>

        {/* Lista de clientes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredClientes.map(c => (
            <div key={c.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-2">
              <div className="flex justify-between items-start gap-2">
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wide truncate">{c.nombre}</h4>
                <button
                  onClick={() => { setEditingQuote(prev => ({ ...prev, nombreCliente: c.nombre, telefonoCliente: c.telefono, emailCliente: c.email })); setActiveTab('create_quote'); }}
                  className="text-[9px] text-blue-600 hover:underline font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap"
                >
                  + Presupuesto
                </button>
              </div>
              <div className="text-[10px] text-slate-500 space-y-0.5">
                {c.telefono && <p>📞 {c.telefono}</p>}
                {c.email && <p>✉ {c.email}</p>}
                {c.direccion && <p>📍 {c.direccion}</p>}
              </div>
              <div className="flex gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">Obras activas</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-white">{c.obrasActivas}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase font-mono block">Total facturado</span>
                  <span className="text-xs font-bold font-mono text-emerald-600">{c.totalFacturado.toFixed(0)}€</span>
                </div>
              </div>
            </div>
          ))}
          {filteredClientes.length === 0 && (
            <div className="col-span-2 text-center py-10 text-slate-400 text-xs">
              {searchQuery ? 'No se encontraron clientes con ese criterio.' : 'No hay clientes aún. Crea el primero con el botón de arriba.'}
            </div>
          )}
        </div>

        {/* Modal nuevo cliente */}
        {isClientModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-sm uppercase tracking-wider text-slate-900 dark:text-white">Nuevo Cliente</h3>
                <button onClick={() => setIsClientModalOpen(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              {([['nombre','Nombre *','text','Juan García Instalaciones'],['telefono','Teléfono','tel','600 000 000'],['email','Email','email','cliente@email.com'],['direccion','Dirección','text','Calle Mayor 1, Madrid']] as const).map(([field, label, type, ph]) => (
                <div key={field}>
                  <label className="text-[9px] font-mono uppercase text-slate-400 block mb-1">{label}</label>
                  <input type={type} placeholder={ph} value={(newClient as any)[field] ?? ''} onChange={(e) => setNewClient(prev => ({ ...prev, [field]: e.target.value }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer hover:border-slate-400">Cancelar</button>
                <button onClick={handleAddClient} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-xl text-xs font-bold text-white cursor-pointer">Guardar Cliente</button>
              </div>
            </div>
          </div>
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
    empresa: typeof empresaAjustes;
    partidas: PartidaPresupuesto[];
    total: number;
    iva: number;
    estado?: string;
  }) {
    const totalIVA = opts.total * (opts.iva / 100);
    const totalConIVA = opts.total + totalIVA;
    const rows = opts.partidas.map(p => `
      <tr>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;color:#334155">${p.descripcion}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;color:#64748b">${p.cantidad}</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;color:#334155">${p.precioUnitario.toFixed(2)}€</td>
        <td style="padding:8px 4px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:right;font-weight:700;color:#0f172a">${p.total.toFixed(2)}€</td>
      </tr>`).join('');

    return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
      <title>${opts.tipo === 'presupuesto' ? 'Presupuesto' : 'Factura'} ${opts.numero}</title>
      <style>
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:Arial,sans-serif;color:#0f172a;background:#fff;padding:40px;max-width:760px;margin:auto}
        @media print{body{padding:20px}button{display:none!important}}
        .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:24px;border-bottom:2px solid #2563eb}
        .brand{font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#0f172a}
        .brand span{color:#2563eb}
        .doc-type{font-size:28px;font-weight:700;color:#2563eb;text-align:right}
        .doc-num{font-size:12px;color:#64748b;text-align:right;font-family:monospace}
        .cols{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:28px}
        .label{font-size:9px;text-transform:uppercase;color:#94a3b8;font-weight:700;letter-spacing:1px;margin-bottom:4px}
        .val{font-size:12px;color:#1e293b;line-height:1.5}
        table{width:100%;border-collapse:collapse;margin-bottom:24px}
        thead th{background:#f8fafc;padding:8px 4px;font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;letter-spacing:1px;border-bottom:2px solid #e2e8f0}
        .totals{text-align:right}
        .totals table{width:240px;margin-left:auto}
        .totals td{padding:4px 0;font-size:12px;color:#475569}
        .totals td:last-child{font-family:monospace;font-weight:600;text-align:right;padding-left:16px}
        .total-final{font-size:16px!important;font-weight:800!important;color:#0f172a!important}
        .footer{margin-top:48px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
        .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
        .badge-pending{background:#fef9c3;color:#854d0e}
        .badge-paid{background:#dcfce7;color:#166534}
        .badge-draft{background:#f1f5f9;color:#475569}
        .print-btn{position:fixed;top:16px;right:16px;background:#2563eb;color:#fff;border:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer}
      </style>
    </head><body>
      <button class="print-btn" onclick="window.print()">Descargar PDF</button>
      <div class="header">
        <div>
          <div class="brand">Trab<span>Flow</span> AI</div>
          <div style="font-size:13px;font-weight:700;margin-top:6px">${opts.empresa.nombre || 'Mi Empresa'}</div>
          ${opts.empresa.nif ? `<div style="font-size:11px;color:#64748b">NIF: ${opts.empresa.nif}</div>` : ''}
          ${opts.empresa.direccion ? `<div style="font-size:11px;color:#64748b">${opts.empresa.direccion}${opts.empresa.localidad ? `, ${opts.empresa.localidad}` : ''}</div>` : ''}
          ${opts.empresa.email ? `<div style="font-size:11px;color:#64748b">${opts.empresa.email}</div>` : ''}
          ${opts.empresa.telefonoMovil ? `<div style="font-size:11px;color:#64748b">Tel: ${opts.empresa.telefonoMovil}</div>` : ''}
        </div>
        <div>
          <div class="doc-type">${opts.tipo === 'presupuesto' ? 'PRESUPUESTO' : 'FACTURA'}</div>
          <div class="doc-num">${opts.numero}</div>
          <div style="font-size:11px;color:#64748b;text-align:right;margin-top:4px">Fecha: ${opts.fecha}</div>
          ${opts.fechaVencimiento ? `<div style="font-size:11px;color:#64748b;text-align:right">Vencimiento: ${opts.fechaVencimiento}</div>` : ''}
          ${opts.estado ? `<div style="text-align:right;margin-top:6px"><span class="badge ${opts.estado === 'Pagada' ? 'badge-paid' : opts.estado === 'Pendiente' ? 'badge-pending' : 'badge-draft'}">${opts.estado}</span></div>` : ''}
        </div>
      </div>
      <div class="cols">
        <div>
          <div class="label">Datos del Emisor</div>
          <div class="val">${opts.empresa.nombre || '—'}</div>
          ${opts.empresa.nif ? `<div class="val" style="color:#64748b">NIF: ${opts.empresa.nif}</div>` : ''}
        </div>
        <div>
          <div class="label">Cliente</div>
          <div class="val">${opts.clienteNombre}</div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="text-align:left;width:50%">Descripción</th>
          <th style="text-align:center;width:10%">Cant.</th>
          <th style="text-align:right;width:20%">Precio unit.</th>
          <th style="text-align:right;width:20%">Total</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="totals">
        <table>
          <tr><td>Base imponible</td><td>${opts.total.toFixed(2)}€</td></tr>
          <tr><td>IVA (${opts.iva}%)</td><td>${totalIVA.toFixed(2)}€</td></tr>
          <tr><td class="total-final">TOTAL</td><td class="total-final">${totalConIVA.toFixed(2)}€</td></tr>
        </table>
      </div>
      <div class="footer">Documento generado por TrabFlow AI · trabflow.com</div>
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
    const html = buildDocumentHTML({
      tipo: 'presupuesto',
      numero: presupuesto.id,
      fecha: presupuesto.fecha,
      clienteNombre: presupuesto.nombreCliente,
      empresa: empresaAjustes,
      partidas: presupuesto.partidas,
      total: presupuesto.total,
      iva: empresaAjustes.ivaDefault || 21,
      estado: presupuesto.estado,
    });
    printDocument(html);
  }

  function printInvoice(factura: Factura) {
    const html = buildDocumentHTML({
      tipo: 'factura',
      numero: factura.numeroFactura,
      fecha: factura.fecha,
      fechaVencimiento: factura.fechaVencimiento,
      clienteNombre: factura.nombreCliente,
      empresa: empresaAjustes,
      partidas: presupuestos.find(p => p.id === factura.idPresupuesto)?.partidas ?? [],
      total: factura.importe,
      iva: empresaAjustes.ivaDefault || 21,
      estado: factura.estado,
    });
    printDocument(html);
  }

  // ── Pantalla Facturas (desktop) ───────────────────────────────────────────────
  function ScreenInvoices() {
    const pendiente = facturas.filter(f => f.estado !== 'Pagada').reduce((s, f) => s + f.importe * 1.21, 0);
    const cobradoMes = facturas
      .filter(f => f.estado === 'Pagada')
      .reduce((s, f) => s + f.importe * 1.21, 0);
    const vencidas = facturas.filter(f => f.estado === 'Vencida').length;

    const filtered = filterEstado === 'todas' ? facturas : facturas.filter(f => f.estado === filterEstado);
    const sorted = [...filtered].sort((a, b) => {
      const order: Record<string, number> = { Vencida: 0, Pendiente: 1, Pagada: 2 };
      return (order[a.estado] ?? 1) - (order[b.estado] ?? 1);
    });

    const estadoBadge = (estado: string) => {
      if (estado === 'Pagada') return 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
      if (estado === 'Vencida') return 'bg-red-500/10 text-red-500 border border-red-500/20';
      return 'bg-amber-500/10 text-amber-600 border border-amber-500/20';
    };

    return (
      <div className="space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Pendiente de cobro', value: `${pendiente.toFixed(0)}€`, color: 'text-amber-600' },
            { label: 'Total cobrado', value: `${cobradoMes.toFixed(0)}€`, color: 'text-emerald-600' },
            { label: 'Vencidas', value: String(vencidas), color: vencidas > 0 ? 'text-red-500' : 'text-slate-400' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
              <span className="text-[9px] font-mono font-bold uppercase text-slate-400 block mb-1">{s.label}</span>
              <span className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2">
          {(['todas', 'Pendiente', 'Pagada', 'Vencida'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterEstado(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                filterEstado === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border text-slate-500 hover:text-slate-900 dark:hover:text-white'
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
              <div key={f.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">{f.numeroFactura}</span>
                      <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full ${estadoBadge(f.estado)}`}>{f.estado}</span>
                    </div>
                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 block truncate">{f.nombreCliente}</span>
                    <div className="flex gap-3 mt-1 text-[10px] text-slate-400 font-mono">
                      <span>Emitida: {f.fecha}</span>
                      {f.fechaVencimiento && <span>Vence: {f.fechaVencimiento}</span>}
                    </div>
                  </div>
                  {/* Importe */}
                  <div className="text-right shrink-0">
                    <span className="text-[9px] text-slate-400 block font-mono uppercase">Total c/IVA</span>
                    <span className="text-lg font-bold font-mono text-slate-900 dark:text-white">{(f.importe * 1.21).toFixed(2)}€</span>
                    <span className="text-[9px] text-slate-400 block font-mono">{f.importe.toFixed(2)}€ + IVA</span>
                  </div>
                </div>
                {/* Acciones */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => printInvoice(f)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    PDF
                  </button>
                  <button
                    onClick={() => handleRemindInvoice(f)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-bold uppercase tracking-wider hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
                  >
                    💬 WhatsApp
                  </button>
                  {f.estado !== 'Pagada' && (
                    <button
                      onClick={() => handlePayInvoice(f.id)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ml-auto"
                    >
                      💰 Registrar Pago
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

  // ================= DESKTOP: CATALOG SCREEN =================
  function ScreenCatalog() {
    const calidades: Record<TradeCatalogVariant['calidad'], { label: string; cls: string }> = {
      economico: { label: 'Económico', cls: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
      medio:     { label: 'Preferido', cls: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
      premium:   { label: 'Premium',   cls: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400' },
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

    if (!isLiveMode) {
      return (
        <div className="flex flex-col items-center justify-center h-full py-16 space-y-4 text-center px-8">
          <Package className="h-12 w-12 text-slate-300 dark:text-slate-700" />
          <h3 className="font-bold text-slate-700 dark:text-white text-sm uppercase tracking-wider">Catálogo de productos</h3>
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

    return (
      <div className="p-5 space-y-5 overflow-y-auto h-full">

        {/* Header barra */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar producto, familia..."
              value={catalogFilter}
              onChange={e => setCatalogFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono">{filtered.length} productos · {catalogProducts.reduce((s, p) => s + (p.trade_catalog_variants?.length ?? 0), 0)} variantes</span>
        </div>

        {catalogProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="h-10 w-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-slate-400 text-xs">No hay productos en el catálogo todavía.</p>
          </div>
        )}

        {Object.entries(byFamily).map(([family, products]) => (
          <div key={family} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {/* Cabecera familia */}
            <div className="bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
              <Tag className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-mono">{family}</span>
              <span className="ml-auto text-[9px] text-slate-400 font-mono">{products.length} productos</span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {products.map(product => {
                const variants = product.trade_catalog_variants ?? [];
                return (
                  <div key={product.id} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="font-semibold text-xs text-slate-800 dark:text-white">{product.nombre_generico}</span>
                        {product.subfamilia && (
                          <span className="ml-2 text-[9px] text-slate-400 font-mono">{product.subfamilia}</span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">{product.unidad}</span>
                    </div>

                    {/* Variantes */}
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
                                ? 'border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                                : 'border-slate-200 dark:border-slate-700'
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

                            {/* Precio editable */}
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
                                    className="w-20 bg-white dark:bg-slate-800 border border-blue-400 rounded px-2 py-1 text-xs font-bold font-mono text-slate-800 dark:text-white focus:outline-none"
                                  />
                                  <span className="text-[9px] text-slate-400">€</span>
                                </>
                              ) : (
                                <>
                                  <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
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

                            {/* Desglose */}
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

                            {/* Botón preferido */}
                            {!v.is_preferred && (
                              <button
                                onClick={() => handleSetPreferred(v.id, product.id)}
                                disabled={!!savingVariant}
                                className="w-full text-[8.5px] font-bold uppercase text-slate-400 hover:text-blue-500 border border-slate-200 dark:border-slate-700 hover:border-blue-400 rounded py-1 cursor-pointer transition-all disabled:opacity-40"
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
    );
  }

  // ================= DESKTOP: SETTINGS SCREEN =================
  function ScreenSettings() {
    const inp = "w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg text-slate-800 dark:text-white text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500";
    const lbl = "text-[9px] uppercase font-mono block text-slate-400 mb-1";
    const sec = "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 rounded-xl space-y-4";
    const secTitle = "font-display font-bold uppercase text-xs text-slate-400 font-mono pb-2 border-b border-slate-100 dark:border-slate-800";

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
      }).eq('id', orgId);
      if (error) showToast('Error al guardar: ' + error.message, 'error');
      else showToast('Datos fiscales guardados ✓', 'success');
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
            Guardar datos fiscales
          </button>
        </div>

        {/* ── 2. Tarifas de mano de obra ── */}
        <div className={sec}>
          <h3 className={secTitle}>Tarifas de Mano de Obra</h3>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            El asistente de voz usa estas tarifas para calcular automáticamente el coste de mano de obra en cada presupuesto. Puedes ajustar las horas y el importe manualmente en cada presupuesto.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 space-y-2">
              <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase block">Tarifa hora operario</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={empresaAjustes.valorHoraOperario}
                  onChange={e => setEmpresaAjustes(p => ({ ...p, valorHoraOperario: parseFloat(e.target.value) || 0 }))}
                  className="w-20 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-2 text-sm font-bold font-mono text-slate-800 dark:text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-xs text-slate-500 font-mono">€ / hora</span>
              </div>
              <p className="text-[9px] text-slate-400">Aplicado automáticamente a partidas de mano de obra en el asistente de voz.</p>
            </div>
            <div className="sm:col-span-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2">
              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase block">Cómo funciona</span>
              <ul className="text-[10px] text-slate-500 space-y-1.5 leading-relaxed">
                <li>• Dices "instalar grifo, 2 horas" → el asistente calcula <span className="font-mono font-bold text-amber-600 dark:text-amber-400">2 h × {empresaAjustes.valorHoraOperario}€ = {empresaAjustes.valorHoraOperario * 2}€</span></li>
                <li>• En el paso 4 del presupuesto puedes ajustar las horas o poner un importe fijo manualmente.</li>
                <li>• El precio del material siempre viene de tu catálogo de productos.</li>
              </ul>
            </div>
          </div>
          <button onClick={handleSaveFiscal}
            className="mt-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg transition-colors cursor-pointer">
            Guardar tarifa hora
          </button>
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
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {['Nombre','Móvil','Email','Rol','Estado',''].map(h => (
                      <th key={h} className="text-left text-[9px] uppercase font-mono text-slate-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {trabajadores.map(w => (
                    <tr key={w.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-white whitespace-nowrap">{w.nombre}</td>
                      <td className="py-2 pr-3 text-slate-500 font-mono whitespace-nowrap">{w.telefono || '—'}</td>
                      <td className="py-2 pr-3 text-slate-500 max-w-[140px] truncate">{w.email || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap">
                          {ROL_LABELS[w.rol]}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase whitespace-nowrap ${w.activo ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
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
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-700">
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
                  className="border border-slate-200 dark:border-slate-600 text-slate-500 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 3. Tarifas ── */}
        <div className={sec}>
          <div className="flex items-center justify-between">
            <h3 className={secTitle}>Tarifas / Catálogo de Precios</h3>
            <button onClick={() => setShowAddTarifa(p => !p)}
              className="flex items-center gap-1 text-blue-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-colors">
              <Plus className="h-3 w-3" />
              {showAddTarifa ? 'Cancelar' : 'Añadir tarifa'}
            </button>
          </div>

          {tarifas.length > 4 && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input type="text" placeholder="Buscar por código, familia o descripción..."
                className={`${inp} pl-8`} value={tarifaFilter}
                onChange={e => setTarifaFilter(e.target.value)} />
            </div>
          )}

          {filteredTarifas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800">
                    {['Código','Familia','Descripción','Precio base','Ud.',''].map(h => (
                      <th key={h} className="text-left text-[9px] uppercase font-mono text-slate-400 pb-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredTarifas.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2 pr-3 font-mono text-blue-600 dark:text-blue-400 whitespace-nowrap">{t.codigo || '—'}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold">{t.familia}</span>
                      </td>
                      <td className="py-2 pr-3 text-slate-700 dark:text-slate-300">{t.descripcion}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-slate-800 dark:text-white whitespace-nowrap">{t.precioBase.toFixed(2)} €</td>
                      <td className="py-2 pr-3 text-slate-400 font-mono whitespace-nowrap">{t.unidad}</td>
                      <td className="py-2">
                        <button onClick={() => handleDeleteTarifa(t.id)} className="text-red-400 hover:text-red-300 cursor-pointer transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredTarifas.length === 0 && !showAddTarifa && (
            <p className="text-slate-400 text-xs text-center py-4">
              {tarifaFilter ? 'Sin resultados para ese filtro.' : 'Sin tarifas definidas. Añade materiales y mano de obra.'}
            </p>
          )}

          {showAddTarifa && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-3 border border-slate-200 dark:border-slate-700">
              <span className="text-[9px] uppercase font-mono text-slate-400 font-bold">Nueva tarifa</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <span className={lbl}>Código</span>
                  <input type="text" className={`${inp} font-mono`} placeholder="FON-001"
                    value={newTarifaDraft.codigo}
                    onChange={e => setNewTarifaDraft(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <span className={lbl}>Familia *</span>
                  <select className={inp} value={newTarifaDraft.familia}
                    onChange={e => setNewTarifaDraft(p => ({ ...p, familia: e.target.value }))}>
                    {FAMILIAS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <span className={lbl}>Unidad</span>
                  <select className={inp} value={newTarifaDraft.unidad}
                    onChange={e => setNewTarifaDraft(p => ({ ...p, unidad: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <span className={lbl}>Descripción *</span>
                  <input type="text" className={inp} placeholder="Ej. Grifo monomando cocina premium"
                    value={newTarifaDraft.descripcion}
                    onChange={e => setNewTarifaDraft(p => ({ ...p, descripcion: e.target.value }))} />
                </div>
                <div>
                  <span className={lbl}>Precio base (€)</span>
                  <input type="number" step="0.01" min="0" className={`${inp} font-mono`}
                    value={newTarifaDraft.precioBase}
                    onChange={e => setNewTarifaDraft(p => ({ ...p, precioBase: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAddTarifa} disabled={!newTarifaDraft.descripcion.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-colors cursor-pointer">
                  Añadir tarifa
                </button>
                <button onClick={() => setShowAddTarifa(false)}
                  className="border border-slate-200 dark:border-slate-600 text-slate-500 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {tarifas.length > 0 && (
            <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-[10px] text-slate-400 font-mono">
              <span>{tarifas.length} tarifa{tarifas.length !== 1 ? 's' : ''}</span>
              <span>{[...new Set(tarifas.map(t => t.familia))].length} familia{[...new Set(tarifas.map(t => t.familia))].length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* ── 4. Suscripción ── */}
        <div className={sec}>
          <h3 className={secTitle}>Suscripción</h3>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-white">{empresaAjustes.planSuscripcion}</span>
              <p className="text-[10px] text-slate-400 mt-0.5">Período de prueba activo — sin cargo hasta el 4º mes</p>
            </div>
            <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold uppercase px-2 py-1 rounded">
              Activo
            </span>
          </div>
        </div>

      </div>
    );
  }
}
