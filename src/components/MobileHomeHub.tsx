import { useState } from 'react';
import {
  Briefcase, FileText, Receipt, Users, CalendarDays,
  MoreHorizontal, ChevronRight, Wrench, Package, MessageSquare,
  X, FileCheck, Truck,
} from 'lucide-react';

interface MobileHomeHubProps {
  jobsCount: number;
  jobsActiveCount: number;
  presupuestosCount: number;
  presupuestosPendingCount: number;
  facturasCount: number;
  facturasPendingCount: number;
  clientesCount: number;
  hasTransport: boolean;
  hasSuppliers: boolean;
  onNavigate: (tab: string) => void;
  onGoPartes: () => void;
  onGoSuppliers: () => void;
  showMoreSheetExternal?: boolean;
  onMoreSheetChange?: (open: boolean) => void;
}

interface HubCard {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  badgeColor?: string;
  bgColor: string;
  iconColor: string;
  borderColor: string;
  onClick: () => void;
}

export default function MobileHomeHub({
  jobsCount,
  jobsActiveCount,
  presupuestosCount,
  presupuestosPendingCount,
  facturasCount,
  facturasPendingCount,
  clientesCount,
  hasTransport,
  hasSuppliers,
  onNavigate,
  onGoPartes,
  onGoSuppliers,
  showMoreSheetExternal,
  onMoreSheetChange,
}: MobileHomeHubProps) {
  const [showMoreSheetInternal, setShowMoreSheetInternal] = useState(false);
  const showMoreSheet = showMoreSheetExternal ?? showMoreSheetInternal;
  const setShowMoreSheet = (v: boolean) => { setShowMoreSheetInternal(v); onMoreSheetChange?.(v); };

  const mainCards: HubCard[] = [
    {
      id: 'trabajos',
      label: 'Trabajos',
      icon: <Briefcase className="w-7 h-7" />,
      badge: jobsActiveCount > 0 ? jobsActiveCount : undefined,
      badgeColor: 'bg-amber-500',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-100',
      onClick: () => onNavigate('trabajos'),
    },
    {
      id: 'presupuestos',
      label: 'Presupuestos',
      icon: <FileText className="w-7 h-7" />,
      badge: presupuestosPendingCount > 0 ? presupuestosPendingCount : undefined,
      badgeColor: 'bg-blue-500',
      bgColor: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-100',
      onClick: () => onNavigate('presupuestos'),
    },
    {
      id: 'facturas',
      label: 'Facturas',
      icon: <Receipt className="w-7 h-7" />,
      badge: facturasPendingCount > 0 ? facturasPendingCount : undefined,
      badgeColor: 'bg-rose-500',
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      borderColor: 'border-emerald-100',
      onClick: () => onNavigate('facturas'),
    },
    {
      id: 'clientes',
      label: 'Clientes',
      icon: <Users className="w-7 h-7" />,
      badge: clientesCount > 0 ? clientesCount : undefined,
      badgeColor: 'bg-slate-400',
      bgColor: 'bg-violet-50',
      iconColor: 'text-violet-600',
      borderColor: 'border-violet-100',
      onClick: () => onNavigate('clientes'),
    },
    {
      id: 'agenda',
      label: 'Agenda',
      icon: <CalendarDays className="w-7 h-7" />,
      badge: jobsCount > 0 ? jobsCount : undefined,
      badgeColor: 'bg-blue-500',
      bgColor: 'bg-sky-50',
      iconColor: 'text-sky-600',
      borderColor: 'border-sky-100',
      onClick: () => onNavigate('trabajos'),
    },
    {
      id: 'mas',
      label: 'Más',
      icon: <MoreHorizontal className="w-7 h-7" />,
      bgColor: 'bg-slate-50',
      iconColor: 'text-slate-500',
      borderColor: 'border-slate-100',
      onClick: () => setShowMoreSheet(true),
    },
  ];

  const moreItems = [
    { id: 'mantenimiento', label: 'Mantenimiento', icon: <Wrench className="w-5 h-5" />, onClick: () => { onNavigate('mantenimiento'); setShowMoreSheet(false); } },
    { id: 'partes', label: 'Partes firmados', icon: <FileCheck className="w-5 h-5" />, onClick: () => { onGoPartes(); setShowMoreSheet(false); } },
    ...(hasSuppliers ? [{ id: 'suppliers', label: 'Proveedores', icon: <Package className="w-5 h-5" />, onClick: () => { onGoSuppliers(); setShowMoreSheet(false); } }] : []),
    ...(hasTransport ? [{ id: 'transporte', label: 'Transporte', icon: <Truck className="w-5 h-5" />, onClick: () => { onNavigate('transporte'); setShowMoreSheet(false); } }] : []),
    { id: 'asistente', label: 'Normativa', icon: <MessageSquare className="w-5 h-5" />, onClick: () => { onNavigate('asistente'); setShowMoreSheet(false); } },
  ];

  return (
    <>
      {/* Hub grid */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {mainCards.map(card => (
            <button
              key={card.id}
              onClick={card.onClick}
              className={`relative flex flex-col items-center justify-center gap-3 min-h-[120px] rounded-2xl border ${card.bgColor} ${card.borderColor} active:scale-[0.97] transition-transform cursor-pointer`}
            >
              {card.badge !== undefined && (
                <span className={`absolute top-3 right-3 ${card.badgeColor} text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center leading-none`}>
                  {card.badge > 99 ? '99+' : card.badge}
                </span>
              )}
              <span className={card.iconColor}>{card.icon}</span>
              <span className="text-sm font-bold text-slate-700">{card.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* More sheet overlay */}
      {showMoreSheet && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={() => setShowMoreSheet(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-t-2xl shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <span className="text-base font-bold text-slate-900">Más módulos</span>
              <button
                onClick={() => setShowMoreSheet(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 cursor-pointer active:bg-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-2">
              {moreItems.map(item => (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  className="w-full flex items-center gap-4 px-5 py-3.5 text-left active:bg-slate-50 cursor-pointer transition-colors"
                >
                  <span className="text-slate-500">{item.icon}</span>
                  <span className="text-sm font-semibold text-slate-800 flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
