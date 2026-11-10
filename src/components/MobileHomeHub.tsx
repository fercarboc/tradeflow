import { useState } from 'react';
import {
  Briefcase, FileText, Receipt, Users, CalendarDays,
  MoreHorizontal, ChevronRight, Wrench, Package, MessageSquare,
  X, FileCheck, Truck, PlusCircle, Clock, Navigation, Mic,
} from 'lucide-react';

interface NextJob {
  id: string;
  title: string;
  clientName: string;
  location?: string;
  scheduledTime?: string;
}

interface MobileHomeHubProps {
  // legacy counters
  jobsCount: number;
  jobsActiveCount: number;
  presupuestosCount: number;
  presupuestosPendingCount: number;
  facturasCount: number;
  facturasPendingCount: number;
  clientesCount: number;
  hasTransport: boolean;
  hasSuppliers: boolean;
  // new: hero + greeting
  userName?: string;
  oficioOrg?: string;
  todayJobsCount?: number;
  nextJob?: NextJob;
  // navigation
  onNavigate: (tab: string) => void;
  onGoPartes: () => void;
  onGoSuppliers: () => void;
  onCreateQuote?: () => void;
  onVoiceQuote?: () => void;
  onGoAgenda?: () => void;
  onGoTrabajo?: (jobId: string) => void;
  onGoRuta?: () => void;
  onGoAsistente?: () => void;
  showMoreSheetExternal?: boolean;
  onMoreSheetChange?: (open: boolean) => void;
}

function getOficioImage(oficio?: string): string {
  const o = (oficio ?? '').toLowerCase();
  if (o.includes('pint')) return '/pintor.png';
  if (o.includes('elec')) return '/electricista.png';
  if (o.includes('font') || o.includes('plom')) return '/fontanero.png';
  if (o.includes('reform') || o.includes('carp') || o.includes('albañil') || o.includes('construct')) return '/reformas.png';
  if (o.includes('climat') || o.includes('aire') || o.includes('frigoríf') || o.includes('termico')) return '/climatizacion.png';
  return '/servicios.png';
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 13) return '¡Buenos días';
  if (h < 20) return '¡Buenas tardes';
  return '¡Buenas noches';
}

function getSunEmoji(): string {
  const h = new Date().getHours();
  if (h < 6) return '🌙';
  if (h < 13) return '☀️';
  if (h < 20) return '🌤️';
  return '🌙';
}

export default function MobileHomeHub({
  jobsActiveCount,
  presupuestosPendingCount,
  facturasCount: _facturasCount,
  facturasPendingCount,
  clientesCount: _clientesCount,
  hasTransport,
  hasSuppliers,
  userName,
  oficioOrg,
  todayJobsCount = 0,
  nextJob,
  onNavigate,
  onGoPartes,
  onGoSuppliers,
  onCreateQuote,
  onVoiceQuote,
  onGoAgenda,
  onGoTrabajo,
  onGoRuta,
  onGoAsistente,
  showMoreSheetExternal,
  onMoreSheetChange,
}: MobileHomeHubProps) {
  const [showMoreSheetInternal, setShowMoreSheetInternal] = useState(false);
  const showMoreSheet = showMoreSheetExternal ?? showMoreSheetInternal;
  const setShowMoreSheet = (v: boolean) => { setShowMoreSheetInternal(v); onMoreSheetChange?.(v); };

  const moreItems = [
    { id: 'mantenimiento', label: 'Mantenimiento', icon: <Wrench className="w-5 h-5" />, onClick: () => { onNavigate('mantenimiento'); setShowMoreSheet(false); } },
    { id: 'partes', label: 'Partes firmados', icon: <FileCheck className="w-5 h-5" />, onClick: () => { onGoPartes(); setShowMoreSheet(false); } },
    ...(hasSuppliers ? [{ id: 'suppliers', label: 'Proveedores', icon: <Package className="w-5 h-5" />, onClick: () => { onGoSuppliers(); setShowMoreSheet(false); } }] : []),
    ...(hasTransport ? [{ id: 'transporte', label: 'Transporte', icon: <Truck className="w-5 h-5" />, onClick: () => { onNavigate('transporte'); setShowMoreSheet(false); } }] : []),
    { id: 'asistente', label: 'Normativa', icon: <MessageSquare className="w-5 h-5" />, onClick: () => { onGoAsistente ? onGoAsistente() : onNavigate('asistente'); setShowMoreSheet(false); } },
  ];

  const modules = [
    {
      label: 'Trabajos',
      desc: jobsActiveCount > 0 ? `${jobsActiveCount} en curso` : 'Organiza tu jornada',
      icon: <Briefcase className="w-5 h-5" />,
      iconBg: 'bg-blue-50 dark:bg-blue-900/40',
      iconColor: 'text-blue-600 dark:text-blue-400',
      badge: jobsActiveCount > 0,
      badgeDot: 'bg-blue-500',
      action: () => onNavigate('trabajos'),
    },
    {
      label: 'Presupuestos',
      desc: presupuestosPendingCount > 0 ? `${presupuestosPendingCount} pendiente${presupuestosPendingCount > 1 ? 's' : ''} de envío` : 'Prepara y envía en minutos',
      icon: <FileText className="w-5 h-5" />,
      iconBg: 'bg-violet-50 dark:bg-violet-900/40',
      iconColor: 'text-violet-600 dark:text-violet-400',
      badge: presupuestosPendingCount > 0,
      badgeDot: 'bg-violet-500',
      action: () => onNavigate('presupuestos'),
    },
    {
      label: 'Facturas',
      desc: facturasPendingCount > 0 ? `${facturasPendingCount} pendiente${facturasPendingCount > 1 ? 's' : ''} de cobro` : 'Gestiona tu facturación',
      icon: <Receipt className="w-5 h-5" />,
      iconBg: 'bg-emerald-50 dark:bg-emerald-900/40',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      badge: facturasPendingCount > 0,
      badgeDot: 'bg-orange-500',
      action: () => onNavigate('facturas'),
    },
    {
      label: 'Clientes',
      desc: 'Tus contactos, siempre a mano',
      icon: <Users className="w-5 h-5" />,
      iconBg: 'bg-amber-50 dark:bg-amber-900/40',
      iconColor: 'text-amber-600 dark:text-amber-400',
      badge: false,
      badgeDot: '',
      action: () => onNavigate('clientes'),
    },
  ];

  return (
    <>
      <div className="flex flex-col h-full min-h-0 overflow-y-auto pb-20 bg-gray-50 dark:bg-gray-900">

        {/* ── Saludo ── */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none">{getSunEmoji()}</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
                {getGreeting()}, {userName || 'profesional'}!
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Vamos a por un buen día</p>
            </div>
          </div>
        </div>

        {/* ── KPI pills ── */}
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 rounded-full px-3 py-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-700 dark:text-cyan-300">
              {todayJobsCount} trabajo{todayJobsCount !== 1 ? 's' : ''} hoy
            </span>
          </div>
          {facturasPendingCount > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 rounded-full px-3 py-1.5">
              <Receipt className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-300">
                {facturasPendingCount} factura{facturasPendingCount !== 1 ? 's' : ''} pendiente{facturasPendingCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ── Hero: próximo trabajo ── */}
        {nextJob && (
          <div className="mx-4 mb-4 rounded-2xl bg-blue-600 overflow-hidden relative min-h-[148px]">
            <div className="p-4 pr-32">
              <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider">Tu próximo trabajo</span>
              {nextJob.scheduledTime && (
                <div className="inline-flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 mt-1.5 mb-2">
                  <Clock className="h-3 w-3 text-white" />
                  <span className="text-xs text-white font-bold">{nextJob.scheduledTime}</span>
                </div>
              )}
              <h2 className="text-white font-bold text-lg leading-tight mb-1 line-clamp-2">
                {nextJob.title}
              </h2>
              <p className="text-blue-100 text-xs">
                {nextJob.clientName}{nextJob.location ? ` · ${nextJob.location}` : ''}
              </p>
              <div className="flex gap-2 mt-3">
                {onGoTrabajo && (
                  <button
                    onClick={() => onGoTrabajo(nextJob.id)}
                    className="bg-white text-blue-600 text-xs font-bold px-3 py-1.5 rounded-lg active:opacity-80"
                  >
                    Ver trabajo
                  </button>
                )}
                {onGoRuta && (
                  <button
                    onClick={onGoRuta}
                    className="bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 active:opacity-80"
                  >
                    <Navigation className="h-3 w-3" /> Cómo llegar
                  </button>
                )}
              </div>
            </div>
            <img
              src={getOficioImage(oficioOrg)}
              alt=""
              aria-hidden="true"
              className="absolute right-0 bottom-0 h-full w-32 object-cover object-bottom"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/oficio-generic.svg'; }}
            />
          </div>
        )}

        {/* ── CTA: Crear presupuesto ── */}
        {onCreateQuote && (
          <button
            onClick={onCreateQuote}
            className="mx-4 mb-3 flex items-center gap-3 p-4 rounded-2xl bg-blue-600 text-white shadow-sm active:opacity-80 transition-opacity cursor-pointer"
          >
            <PlusCircle className="h-6 w-6 flex-shrink-0" />
            <div className="text-left flex-1">
              <div className="font-semibold text-sm">Crear presupuesto</div>
              <div className="text-xs text-blue-100">Presupuesto guiado</div>
            </div>
            <ChevronRight className="h-5 w-5 opacity-70" />
          </button>
        )}

        {/* ── Asistente IA voz — presupuesto por voz ── */}
        <button
          onClick={() => { onVoiceQuote ? onVoiceQuote() : (onGoAsistente ? onGoAsistente() : onNavigate('asistente')); }}
          className="mx-4 mb-4 flex items-center gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 active:opacity-80 cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Mic className="h-5 w-5 text-white" />
          </div>
          <div className="text-left flex-1 min-w-0">
            <div className="font-semibold text-sm text-gray-900 dark:text-white">¿Qué necesitas hacer?</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">Presupuesto por voz con IA</div>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
        </button>

        {/* ── Sección "Todo a mano" ── */}
        <div className="px-4 pb-2">
          <h2 className="font-bold text-gray-800 dark:text-white text-base">Todo a mano</h2>
        </div>

        {/* ── Lista vertical de módulos ── */}
        <div className="px-4 flex flex-col gap-2 pb-2">
          {modules.map(item => (
            <button
              key={item.label}
              onClick={item.action}
              className="flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:opacity-80 text-left w-full cursor-pointer"
            >
              <div className={`p-2.5 rounded-xl flex-shrink-0 ${item.iconBg}`}>
                <span className={item.iconColor}>{item.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 dark:text-white">{item.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</div>
              </div>
              {item.badge && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.badgeDot}`} />}
              <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
            </button>
          ))}

          {/* Agenda item */}
          <button
            onClick={onGoAgenda ?? (() => onNavigate('trabajos'))}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:opacity-80 text-left w-full cursor-pointer"
          >
            <div className="p-2.5 rounded-xl flex-shrink-0 bg-sky-50 dark:bg-sky-900/40">
              <span className="text-sky-600 dark:text-sky-400"><CalendarDays className="w-5 h-5" /></span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 dark:text-white">Agenda</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Calendario mensual</div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </button>

          {/* Más módulos */}
          <button
            onClick={() => setShowMoreSheet(true)}
            className="flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:opacity-80 text-left w-full cursor-pointer"
          >
            <div className="p-2.5 rounded-xl flex-shrink-0 bg-gray-50 dark:bg-gray-700">
              <span className="text-gray-500"><MoreHorizontal className="w-5 h-5" /></span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 dark:text-white">Más módulos</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Mantenimiento, Partes y más</div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
          </button>
        </div>
      </div>

      {/* ── More sheet overlay ── */}
      {showMoreSheet && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setShowMoreSheet(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-gray-700">
              <span className="text-base font-bold text-slate-900 dark:text-white">Más módulos</span>
              <button
                onClick={() => setShowMoreSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700 text-slate-500 cursor-pointer active:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-2">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left active:bg-slate-50 dark:active:bg-gray-800 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500 dark:text-gray-400">{item.icon}</span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-gray-600" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
