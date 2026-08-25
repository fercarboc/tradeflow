import React, { Suspense, lazy } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ActivePage } from '../../types';
import { PortalProvider, usePortal, PortalTab } from './PortalContext';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';

const PortalActorSelector  = lazy(() => import('./PortalActorSelector'));
const PortalDashboard      = lazy(() => import('./PortalDashboard'));
const PortalCatalogo       = lazy(() => import('./PortalCatalogo'));
const PortalPedidos        = lazy(() => import('./PortalPedidos'));
const PortalEquipo         = lazy(() => import('./PortalEquipo'));
const PortalInformes       = lazy(() => import('./PortalInformes'));
const PortalIntegraciones  = lazy(() => import('./PortalIntegraciones'));
const PortalConfiguracion  = lazy(() => import('./PortalConfiguracion'));
const PortalTiendas        = lazy(() => import('./PortalTiendas'));
const PortalMarketing      = lazy(() => import('./PortalMarketing'));
const PortalFinance        = lazy(() => import('./finance/ProviderFinance'));

interface Props {
  setCurrentPage: (page: ActivePage) => void;
  session: Session | null;
  totalWorkspaces?: number;
  onChangeWorkspace?: () => void;
  onSignOut?: () => void;
}

export default function PortalProveedorView({ setCurrentPage, session, totalWorkspaces = 1, onChangeWorkspace, onSignOut }: Props) {
  return (
    <PortalProvider>
      <PortalShell
        setCurrentPage={setCurrentPage}
        session={session}
        totalWorkspaces={totalWorkspaces}
        onChangeWorkspace={onChangeWorkspace}
        onSignOut={onSignOut}
      />
    </PortalProvider>
  );
}

const ACTOR_ESTADO_LABELS: Record<string, string> = {
  active:    'Activo',
  pending:   'Pendiente',
  suspended: 'Suspendido',
  banned:    'Suspendido',
};

function PortalShell({ setCurrentPage, session, totalWorkspaces = 1, onChangeWorkspace, onSignOut }: Props) {
  const {
    memberships, activeActorId, activeMembership,
    activeTab, unreadCount, loading, error,
    setActiveActorId, setActiveTab, reloadMemberships,
  } = usePortal();

  const showToast = (_msg: string, _type?: 'success' | 'error' | 'info') => {
    // Conectado al sistema de toast del app principal vía prop
    // Para el portal usamos notificaciones inline — toast opcional
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 motion-safe:animate-spin text-teal-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-slate-400">Cargando portal...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <p className="text-slate-300 mb-4">Debes iniciar sesión para acceder al portal.</p>
          <button
            onClick={() => setCurrentPage(ActivePage.Login)}
            className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-500 transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-2 font-medium">Error al cargar el portal</p>
          <p className="text-slate-400 text-sm mb-4">{error}</p>
          <button
            onClick={reloadMemberships}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:border-teal-500 hover:text-teal-400 transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Sin actor seleccionado → Selector
  if (!activeActorId || !activeMembership) {
    return (
      <Suspense fallback={<PortalLoading />}>
        <PortalActorSelector
          memberships={memberships}
          onSelect={setActiveActorId}
          onBack={totalWorkspaces > 1 ? (onChangeWorkspace ?? (() => {})) : (onSignOut ?? (() => {}))}
        />
      </Suspense>
    );
  }

  const navItems: { tab: PortalTab; label: string; icon: React.ReactNode }[] = [
    {
      tab: 'dashboard',
      label: 'Inicio',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline strokeLinecap="round" strokeLinejoin="round" points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      tab: 'catalogo',
      label: 'Catálogo',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="3" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="14" y="14" width="7" height="7" rx="1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
    },
    {
      tab: 'pedidos',
      label: 'Pedidos',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      tab: 'equipo',
      label: 'Equipo',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100-8 4 4 0 000 8M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      ),
    },
    {
      tab: 'informes',
      label: 'Informes',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      tab: 'tiendas',
      label: 'Tiendas',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
        </svg>
      ),
    },
    {
      tab: 'marketing',
      label: 'Marketing',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      ),
    },
    {
      tab: 'integraciones',
      label: 'API',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M14.25 9.75L16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
        </svg>
      ),
    },
    {
      tab: 'finanzas',
      label: 'Finanzas',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      tab: 'config',
      label: 'Configuración',
      icon: (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      ),
    },
  ];

  const renderScreen = () => {
    const props = { actorId: activeActorId, membership: activeMembership };
    switch (activeTab) {
      case 'dashboard':  return <PortalDashboard    {...props} setActiveTab={setActiveTab} />;
      case 'catalogo':   return <PortalCatalogo     {...props} />;
      case 'pedidos':    return <PortalPedidos       {...props} />;
      case 'equipo':     return <PortalEquipo        {...props} />;
      case 'informes':        return <PortalInformes       {...props} />;
      case 'tiendas':         return <PortalTiendas         {...props} />;
      case 'marketing':       return <PortalMarketing       {...props} />;
      case 'integraciones':   return <PortalIntegraciones   actorId={activeActorId} />;
      case 'config':          return <PortalConfiguracion   {...props} />;
      case 'finanzas':        return <PortalFinance          actorId={activeActorId} membership={activeMembership} />;
      default:           return null;
    }
  };

  const estadoBadgeColor: Record<string, string> = {
    active:    'bg-emerald-500',
    pending:   'bg-amber-500',
    suspended: 'bg-red-500',
    banned:    'bg-red-700',
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* ── Mobile top bar ── */}
      <div className="sm:hidden fixed top-0 left-0 right-0 z-30 flex items-center gap-2 bg-slate-900 border-b border-slate-800 px-4 h-14">
        <button
          onClick={totalWorkspaces > 1 ? onChangeWorkspace : onSignOut}
          className="text-slate-400 hover:text-teal-400 motion-safe:transition-colors"
          aria-label={totalWorkspaces > 1 ? 'Cambiar de espacio' : 'Cerrar sesión'}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="flex-1 text-sm font-semibold text-slate-100 truncate">{activeMembership.actor_nombre}</p>
        <span className="text-xs font-bold text-teal-400 tracking-wide uppercase">Portal</span>
      </div>

      {/* ── Sidebar — visible solo en desktop ── */}
      <aside className="hidden sm:flex w-56 shrink-0 flex-col bg-slate-900 border-r border-slate-800">
        {/* Logo + volver */}
        <div className="flex items-center gap-2 px-4 py-4 border-b border-slate-800">
          <button
            onClick={() => setCurrentPage(ActivePage.AppDashboard)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-teal-400 transition-colors text-xs"
            title="Volver a TrabFlow"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            TrabFlow
          </button>
          <span className="ml-auto text-xs font-semibold text-teal-400 tracking-wide uppercase">Portal</span>
        </div>

        {/* Actor activo */}
        <div className="px-4 py-3 border-b border-slate-800">
          {activeMembership.actor_logo_url ? (
            <img
              src={activeMembership.actor_logo_url}
              alt={activeMembership.actor_nombre}
              className="h-8 w-8 rounded object-cover mb-2"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-teal-900 flex items-center justify-center mb-2">
              <span className="text-teal-300 font-bold text-sm">
                {activeMembership.actor_nombre.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <p className="text-sm font-semibold text-slate-100 leading-tight truncate">
            {activeMembership.actor_nombre}
          </p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${estadoBadgeColor[activeMembership.actor_estado] ?? 'bg-slate-500'}`} />
            <span className="text-xs text-slate-400">{ACTOR_ESTADO_LABELS[activeMembership.actor_estado] ?? activeMembership.actor_estado}</span>
            {activeMembership.actor_verificado && (
              <svg className="h-3 w-3 text-teal-400 ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{activeMembership.role_nombre}</p>
          {memberships.length > 1 && (
            <button
              onClick={() => setActiveActorId('')}
              className="mt-2 text-xs text-teal-400 hover:text-teal-300 transition-colors"
            >
              Cambiar empresa
            </button>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 px-3 py-3 space-y-0.5">
          {navItems.map(({ tab, label, icon }) => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-teal-900/50 text-teal-300'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <span className={isActive ? 'text-teal-400' : ''}>{icon}</span>
                {label}
                {tab === 'pedidos' && unreadCount > 0 && (
                  <span className="ml-auto flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Acciones de sesión */}
        <div className="border-t border-slate-800 px-3 py-3 space-y-0.5">
          {totalWorkspaces > 1 && (
            <button
              onClick={onChangeWorkspace}
              className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Cambiar de espacio
            </button>
          )}
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-xs text-slate-500 hover:bg-slate-800 hover:text-red-400 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto bg-slate-950 pt-14 sm:pt-0 pb-16 sm:pb-0">
        <Suspense fallback={<PortalLoading />}>
          {renderScreen()}
        </Suspense>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-30 flex bg-slate-900 border-t border-slate-800"
        aria-label="Navegación principal"
      >
        {navItems.map(({ tab, label, icon }) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium motion-safe:transition-colors relative ${
                isActive ? 'text-teal-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={isActive ? 'text-teal-400' : ''}>{icon}</span>
              {label}
              {tab === 'pedidos' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1/2 -mr-4 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[8px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function PortalLoading() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center">
      <svg className="h-6 w-6 motion-safe:animate-spin text-teal-500" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}
