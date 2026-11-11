import React, { useState } from 'react';
import {
  Briefcase, FileText, Receipt, Users, CalendarDays,
  MoreHorizontal, ChevronRight, Wrench, Package, MessageSquare,
  X, FileCheck, Truck, PlusCircle, Clock, Navigation, Mic, Settings,
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
  /** Importe (IVA incl.) de presupuestos enviados o aceptados */
  quotesInProgressAmount?: number;
  quotesInProgressCount?: number;
  /** Importe (IVA incl.) de facturas pendientes de cobro */
  pendingInvoicesAmount?: number;
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
  quotesInProgressAmount = 0,
  quotesInProgressCount = 0,
  pendingInvoicesAmount = 0,
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

  const go = (fn: () => void) => () => { fn(); setShowMoreSheet(false); };
  // Rejilla «Más»: todo lo que no está en la barra inferior, visual y con avisos
  const moreItems: { id: string; label: string; icon: React.ReactNode; tone: string; badge?: number; onClick: () => void }[] = [
    { id: 'trabajos', label: 'Trabajos', icon: <Briefcase className="w-7 h-7" />, tone: 'bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300', badge: jobsActiveCount, onClick: go(() => onNavigate('trabajos')) },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-7 h-7" />, tone: 'bg-teal-50 text-teal-600 dark:bg-teal-900/40 dark:text-teal-300', onClick: go(() => onNavigate('clientes')) },
    { id: 'facturas', label: 'Facturas', icon: <Receipt className="w-7 h-7" />, tone: 'bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300', badge: facturasPendingCount, onClick: go(() => onNavigate('facturas')) },
    { id: 'mantenimiento', label: 'Mantenimiento', icon: <Wrench className="w-7 h-7" />, tone: 'bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-300', onClick: go(() => onNavigate('mantenimiento')) },
    { id: 'partes', label: 'Partes firmados', icon: <FileCheck className="w-7 h-7" />, tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300', onClick: go(onGoPartes) },
    ...(hasSuppliers ? [{ id: 'suppliers', label: 'Proveedores', icon: <Package className="w-7 h-7" />, tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300', onClick: go(onGoSuppliers) }] : []),
    ...(hasTransport ? [{ id: 'transporte', label: 'Transporte', icon: <Truck className="w-7 h-7" />, tone: 'bg-orange-50 text-orange-600 dark:bg-orange-900/40 dark:text-orange-300', onClick: go(() => onNavigate('transporte')) }] : []),
    { id: 'asistente', label: 'Normativa', icon: <MessageSquare className="w-7 h-7" />, tone: 'bg-sky-50 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300', onClick: go(() => { if (onGoAsistente) onGoAsistente(); else onNavigate('asistente'); }) },
    { id: 'ajustes', label: 'Configuración', icon: <Settings className="w-7 h-7" />, tone: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300', onClick: go(() => onNavigate('ajustes')) },
  ];
  const eur = (n: number) => n.toLocaleString('es-ES', { maximumFractionDigits: 0 }) + ' €';

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
            <div className="p-4 pr-36">
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
              className="absolute right-0 top-0 h-full w-36 object-cover object-top"
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

        {/* ── Resumen: dinero pendiente y en proceso ── */}
        <div className="mx-4 mb-4 grid grid-cols-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm divide-x divide-gray-100 dark:divide-gray-700">
          <button onClick={() => onNavigate('facturas')} className="p-4 text-center active:opacity-80 cursor-pointer" data-testid="home-pending-invoices">
            <span className="flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">Por cobrar <ChevronRight className="w-3.5 h-3.5" /></span>
            <span className="block text-2xl font-black text-orange-600 mt-1">{eur(pendingInvoicesAmount)}</span>
            <span className="block text-xs text-gray-400 mt-0.5">{facturasPendingCount} factura{facturasPendingCount !== 1 ? 's' : ''}</span>
          </button>
          <button onClick={() => onNavigate('presupuestos')} className="p-4 text-center active:opacity-80 cursor-pointer" data-testid="home-quotes-in-progress">
            <span className="flex items-center justify-center gap-1 text-sm text-gray-500 dark:text-gray-400">En proceso <ChevronRight className="w-3.5 h-3.5" /></span>
            <span className="block text-2xl font-black text-gray-900 dark:text-white mt-1">{eur(quotesInProgressAmount)}</span>
            <span className="block text-xs text-gray-400 mt-0.5">{quotesInProgressCount} presupuesto{quotesInProgressCount !== 1 ? 's' : ''}</span>
          </button>
        </div>
        {presupuestosPendingCount > 0 && (
          <button
            onClick={() => onNavigate('presupuestos')}
            className="mx-4 mb-4 flex items-center gap-3 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm active:opacity-80 text-left cursor-pointer"
          >
            <div className="p-2.5 rounded-xl flex-shrink-0 bg-violet-50 dark:bg-violet-900/40"><FileText className="w-5 h-5 text-violet-600" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 dark:text-white">{presupuestosPendingCount} presupuesto{presupuestosPendingCount !== 1 ? 's' : ''} esperando respuesta</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Revisa quién lo ha visto y recuérdaselo</div>
            </div>
            <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
          </button>
        )}
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
            <div className="flex justify-center pt-3 pb-1"><span className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" /></div>
            <div className="flex items-center justify-between px-5 pb-1">
              <span className="text-base font-bold text-slate-900 dark:text-white">Más opciones</span>
              <button
                onClick={() => setShowMoreSheet(false)}
                aria-label="Cerrar"
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-gray-700 text-slate-500 cursor-pointer active:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-y-5 gap-x-2 px-4 pt-3 pb-6" data-testid="more-grid">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                >
                  <span className={`relative w-16 h-16 rounded-2xl flex items-center justify-center ${item.tone}`}>
                    {item.icon}
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full bg-amber-400 text-gray-900 text-xs font-bold flex items-center justify-center">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
