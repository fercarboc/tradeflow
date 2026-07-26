/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { ActivePage, TradeType } from './types';
import { supabase, loadWorkerByEmail } from './lib/supabase';
import { SessionProvider } from './context/SessionContext';
import type { WorkerProfile } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import {
  resolveWorkspaces,
  getRememberedWorkspace,
  isRememberedWorkspaceValid,
  clearRememberedWorkspace,
} from './lib/workspaceResolver';
import type { ResolvedWorkspaces } from './lib/workspaceResolver';
import { ADMIN_EMAIL } from './lib/constants';
import Header from './components/Header';
import HomeView from './components/HomeView';
import LandingPage from './pages/LandingPage';
import ComoFuncionaView from './components/ComoFuncionaView';
import PreciosView from './components/PreciosView';
import ContactoView from './components/ContactoView';
import LegalViews from './components/LegalViews';
import Footer from './components/Footer';
import { logError, setupGlobalErrorHandlers } from './lib/errorLogger';
const AppDashboardView = lazy(() => import('./components/AppDashboardView'));
const RegistroView = lazy(() => import('./components/RegistroView'));
const AdminView = lazy(() => import('./components/AdminView'));
const ScreenWorkerView = lazy(() => import('./components/ScreenWorkerView'));
const DemoView = lazy(() => import('./components/demo/DemoView'));
const AsistenteTecnicoPublicView = lazy(() => import('./components/AsistenteTecnicoPublicView'));
const HerramientasView = lazy(() => import('./pages/HerramientasView'));
import LoginView from './components/auth/LoginView';
import AuthActivateView from './components/auth/AuthActivateView';
import AuthCallbackView from './components/auth/AuthCallbackView';
import AuthResetPasswordView from './components/auth/AuthResetPasswordView';
import UpdatePasswordView from './components/auth/UpdatePasswordView';
import QuoteAcceptView from './components/QuoteAcceptView';
import InvoicePublicView from './components/InvoicePublicView';
const PartnerDemoView = lazy(() => import('./components/partner-demo/PartnerDemoView'));
const ReviewView = lazy(() => import('./pages/ReviewView'));
const ParteView = lazy(() => import('./pages/ParteView'));
const PortalProveedorView = lazy(() => import('./components/portal/PortalProveedorView'));
const MarketplaceComprarView      = lazy(() => import('./components/marketplace/MarketplaceComprarView'));
const ScreenSeguimientoMaterial   = lazy(() => import('./components/marketplace/ScreenSeguimientoMaterial'));
const WorkspaceSelectorView       = lazy(() => import('./components/workspace/WorkspaceSelectorView'));

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    logError(error, { page: window.location.pathname }).catch(() => {});
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
          <div className="w-full max-w-md text-center">
            <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
            <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
              <div className="flex justify-center mb-5">
                <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                  <svg className="h-8 w-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-display font-bold text-white mb-2">Algo salió mal</h2>
              <p className="text-white/40 text-sm mb-6">{this.state.message || 'Hubo un error inesperado. Por favor, recarga la página.'}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-[#00CFE8] hover:bg-[#00b8cf] text-[#020B16] font-semibold rounded-xl text-sm transition"
              >
                Recargar aplicación
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppLoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center">
      <svg className="animate-spin h-10 w-10 text-[#00CFE8]" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

const PAGE_PATHS: Partial<Record<ActivePage, string>> = {
  [ActivePage.Home]:              '/',
  [ActivePage.ComoFunciona]:      '/como-funciona',
  [ActivePage.Precios]:           '/precios',
  [ActivePage.Contacto]:          '/contacto',
  [ActivePage.AvisoLegal]:        '/aviso-legal',
  [ActivePage.Privacidad]:        '/privacidad',
  [ActivePage.Cookies]:           '/cookies',
  [ActivePage.Terminos]:          '/terminos',
  [ActivePage.Beta]:              '/beta',
  [ActivePage.IADisclaimer]:      '/ia-disclaimer',
  [ActivePage.AppDashboard]:      '/app',
  [ActivePage.Registro]:          '/registro',
  [ActivePage.Demo]:              '/demo',
  [ActivePage.AsisTecnico]:       '/asistente-tecnico',
  [ActivePage.Herramientas]:      '/herramientas',
  [ActivePage.Admin]:             '/admin',
  [ActivePage.Worker]:            '/worker',
  [ActivePage.Login]:             '/login',
  [ActivePage.AuthActivate]:      '/auth/activate',
  [ActivePage.AuthCallback]:      '/auth/callback',
  [ActivePage.AuthResetPassword]: '/auth/reset-password',
  [ActivePage.UpdatePassword]:    '/update-password',
  [ActivePage.PartnerDemo]:       '/demo-socios',
  [ActivePage.PortalProveedor]:     '/proveedor',
  [ActivePage.MarketplaceComprar]:  '/marketplace/comprar',
  [ActivePage.SeguimientoMaterial]: '/marketplace/seguimiento',
  [ActivePage.WorkspaceSelector]:   '/workspace',
  [ActivePage.NoWorkspace]:         '/sin-espacio',
};

function pageToPath(page: ActivePage): string {
  return PAGE_PATHS[page] ?? '/';
}

function pathToPage(path: string): ActivePage | null {
  for (const [page, p] of Object.entries(PAGE_PATHS) as [ActivePage, string][]) {
    if (p === path) return page;
  }
  return null;
}

const AUTH_FLOW_PAGES = new Set<ActivePage>([
  ActivePage.AuthActivate,
  ActivePage.AuthCallback,
  ActivePage.UpdatePassword,
  ActivePage.QuoteAccept,
  ActivePage.Parte,       // public viewer — don't override when user has session
  ActivePage.InvoiceView, // public viewer — idem
  ActivePage.Valorar,     // public viewer — idem
]);

// Pages where null-session must NOT redirect to Home/AppDashboard
const PUBLIC_OR_AUTH_PAGES = new Set<ActivePage>([
  ...AUTH_FLOW_PAGES,
  ActivePage.Login,
  ActivePage.AuthResetPassword,
  ActivePage.Registro,
  ActivePage.Home,
  ActivePage.ComoFunciona,
  ActivePage.Precios,
  ActivePage.Contacto,
  ActivePage.AvisoLegal,
  ActivePage.Privacidad,
  ActivePage.Cookies,
  ActivePage.Terminos,
  ActivePage.Beta,
  ActivePage.IADisclaimer,
  ActivePage.Demo,
  ActivePage.AsisTecnico,
  ActivePage.Herramientas,
  ActivePage.PartnerDemo,
  ActivePage.Valorar,
  ActivePage.Parte,
]);

function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false;

  const params = new URLSearchParams(window.location.search);

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;

  return params.get('app') === 'true' || isStandalone;
}

function detectAndClearCheckoutSuccess(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get('checkout') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    return true;
  }
  return false;
}

function detectAuthRoute(): ActivePage | null {
  const path = window.location.pathname;

  if (path === '/auth/activate') return ActivePage.AuthActivate;
  if (path === '/auth/callback') return ActivePage.AuthCallback;
  if (path === '/auth/reset-password') return ActivePage.AuthResetPassword;
  if (path === '/update-password') return ActivePage.UpdatePassword;
  if (path === '/login') return ActivePage.Login;
  if (path.startsWith('/p/')) return ActivePage.QuoteAccept;
  if (path.startsWith('/factura/')) return ActivePage.InvoiceView;
  if (path.startsWith('/valorar/')) return ActivePage.Valorar;
  if (path.startsWith('/parte/')) return ActivePage.Parte;

  return null;
}

function extractQuoteToken(): string {
  const parts = window.location.pathname.split('/');
  return parts[2] ?? '';
}

const PZ_COMMIT = 'e8a9d58';
console.log('[PZ_BUILD]', { commit: PZ_COMMIT, ts: new Date().toISOString() });

export default function App() {
  const pwa = isPWAMode();
  const [checkoutSuccess] = useState(() => detectAndClearCheckoutSuccess());
  const [quoteToken] = useState(() => extractQuoteToken());
  const [invoiceToken] = useState(() => {
    const path = window.location.pathname;
    if (path.startsWith('/factura/')) return path.split('/')[2] ?? '';
    return '';
  });

  const initialAuthRoute = detectAuthRoute();

  const [currentPage, _setCurrentPage] = useState<ActivePage>(
    // Si vuelve de Stripe checkout, ir directo al dashboard (evita flash de Home)
    checkoutSuccess ? ActivePage.AppDashboard :
    (initialAuthRoute ?? (pwa ? ActivePage.AppDashboard : ActivePage.Home)),
  );

  const [preselectedTrade, setPreselectedTrade] =
    useState<TradeType>('Fontanería');

  const [initialMobile, setInitialMobile] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 768 : true,
  );
  const [loginOnMount, setLoginOnMount] = useState<boolean>(
    pwa && !initialAuthRoute,
  );

  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);
  // true mientras se resuelve el workspace — bloquea el render para evitar flash del onboarding
  const [workspaceResolving, setWorkspaceResolving] = useState(false);
  // workspaces resueltos para el selector (solo cuando hay >1 opción)
  const [pendingWorkspaces, setPendingWorkspaces] = useState<ResolvedWorkspaces | null>(null);
  // workspaces del usuario activo — para que el portal sepa si existen otros espacios
  const [resolvedWorkspaces, setResolvedWorkspaces] = useState<ResolvedWorkspaces | null>(null);
  // evita que un evento auth tardío relance resolveAndRoute durante el signOut
  const signingOutRef = useRef(false);

  const setCurrentPage = useCallback((page: ActivePage) => {
    _setCurrentPage(page);
    const path = pageToPath(page);
    if (window.location.pathname !== path) {
      window.history.pushState({ page }, '', path);
    }
  }, []);

  // Sync browser back/forward to app state
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const page = (e.state?.page as ActivePage | undefined) ?? pathToPage(window.location.pathname);
      _setCurrentPage(page ?? (pwa ? ActivePage.AppDashboard : ActivePage.Home));
    };
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, [pwa]);

  // Wire global unhandled error → Supabase logger
  useEffect(() => {
    return setupGlobalErrorHandlers(() => ({
      userId: session?.user?.id,
      orgId: undefined,
      page: currentPageRef.current,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  // Aplica un workspace ya decidido sin pasar por el selector
  const applyWorkspace = useCallback((type: string, id: string, resolved?: ResolvedWorkspaces) => {
    if (type === 'marketplace_actor') {
      setCurrentPage(ActivePage.PortalProveedor);
    } else {
      setCurrentPage(ActivePage.AppDashboard);
    }
    if (resolved) setPendingWorkspaces(null);
  }, [setCurrentPage]);

  // Contador de generación para cancelar llamadas concurrentes a resolveAndRoute.
  const routingGenerationRef = useRef(0);

  // Resolución centralizada de workspace tras autenticación.
  // Debe llamarse siempre que se tenga sesión válida y no se esté en un flujo auth (UpdatePassword, etc).
  const resolveAndRoute = useCallback(async (s: Session) => {
    if (signingOutRef.current) {
      console.log('[PZ_ROUTING] resolveAndRoute abortado: signOut en curso');
      return;
    }
    const gen = ++routingGenerationRef.current;
    setWorkspaceResolving(true);
    console.log('[PZ_ROUTING] resolveAndRoute start', { userId: s.user.id, email: s.user.email, gen });

    try {
      const resolved = await resolveWorkspaces(s.user.id);
      setResolvedWorkspaces(resolved);

      // Llamada obsoleta: otra resolveAndRoute empezó después de esta
      if (gen !== routingGenerationRef.current) {
        console.log('[PZ_ROUTING] resolveAndRoute stale, abortando', { gen });
        return;
      }

      const { installers, suppliers } = resolved;
      console.log('[PZ_ROUTING] resolved', {
        installers: installers.map(i => ({ id: i.id, name: i.name })),
        suppliers: suppliers.map(sp => ({ id: sp.id, name: sp.name, activo: sp.activo, estado: sp.actorEstado })),
      });

      // Remembered workspace: validar contra membresías reales
      const remembered = getRememberedWorkspace();
      if (remembered && isRememberedWorkspaceValid(remembered, resolved)) {
        console.log('[PZ_ROUTING] remembered valid, aplicando', remembered);
        applyWorkspace(remembered.type, remembered.id, resolved);
        return;
      }
      // Si el remembered era inválido (membresía retirada, actor suspendido), limpiarlo
      if (remembered) clearRememberedWorkspace();

      if (installers.length === 0 && suppliers.length === 0) {
        console.log('[PZ_ROUTING] sin workspace → AppDashboard (onboarding ERP)');
        setCurrentPage(ActivePage.AppDashboard);
        return;
      }

      if (installers.length === 1 && suppliers.length === 0) {
        console.log('[PZ_ROUTING] solo instalador → AppDashboard');
        setCurrentPage(ActivePage.AppDashboard);
        return;
      }

      if (installers.length === 0 && suppliers.length === 1) {
        console.log('[PZ_ROUTING] solo proveedor → PortalProveedor');
        setCurrentPage(ActivePage.PortalProveedor);
        return;
      }

      console.log('[PZ_ROUTING] múltiples workspaces → WorkspaceSelector');
      setPendingWorkspaces(resolved);
      setCurrentPage(ActivePage.WorkspaceSelector);

    } catch (err) {
      console.error('[PZ_ROUTING] error en resolveAndRoute', err);
      setCurrentPage(ActivePage.AppDashboard);
    } finally {
      if (gen === routingGenerationRef.current) {
        setWorkspaceResolving(false);
      }
    }
  }, [applyWorkspace, setCurrentPage]);

  const routeSession = useCallback(async (s: Session | null, event?: string) => {
    setSession(s);

    if (!s) {
      setWorkerProfile(null);
      clearRememberedWorkspace();
      return;
    }

    if (AUTH_FLOW_PAGES.has(currentPageRef.current)) {
      console.log('[PZ_ROUTING] routeSession skip: auth flow page', { page: currentPageRef.current, event });
      return;
    }

    setLoginOnMount(false);

    console.log('[PZ_ROUTING] routeSession', { userId: s.user.id, email: s.user.email, page: currentPageRef.current, event });

    if (s.user.email === ADMIN_EMAIL) {
      setCurrentPage(ActivePage.Admin);
      return;
    }

    try {
      const wp = await loadWorkerByEmail(s.user.email ?? '');
      if (wp) {
        setWorkerProfile(wp);
        setCurrentPage(wp.rol === 'admin' ? ActivePage.AppDashboard : ActivePage.Worker);
        return;
      }
    } catch {
      // Usuario normal, no es worker
    }

    await resolveAndRoute(s);
  }, [resolveAndRoute, setCurrentPage]);

  // Callback para UpdatePasswordView: tras establecer contraseña vía invite,
  // obtiene la sesión actual y resuelve el workspace directamente.
  const handlePostPasswordUpdate = useCallback(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        resolveAndRoute(data.session);
      } else {
        setCurrentPage(ActivePage.Login);
      }
    });
  }, [resolveAndRoute, setCurrentPage]);

  useEffect(() => {
    // getSession() solo actualiza sessionChecked; el routing real lo hace onAuthStateChange(INITIAL_SESSION)
    // para evitar la doble llamada a resolveAndRoute que causaba condición de carrera.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setSessionChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[PZ_ROUTING] onAuthStateChange', { event, userId: s?.user?.id, email: s?.user?.email });

      if (event === 'INITIAL_SESSION') setSessionChecked(true);

      if (event === 'PASSWORD_RECOVERY') {
        setSession(s);
        setCurrentPage(ActivePage.UpdatePassword);
        return;
      }

      // TOKEN_REFRESHED y USER_UPDATED: solo actualizar sesión, nunca re-rutear
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(s);
        return;
      }

      if (s) {
        signingOutRef.current = false;
        routeSession(s, event);
      } else {
        // SIGNED_OUT: limpiar todo el estado de sesión
        signingOutRef.current = false;
        setSession(null);
        setWorkerProfile(null);
        setResolvedWorkspaces(null);
        clearRememberedWorkspace();

        if (!PUBLIC_OR_AUTH_PAGES.has(currentPageRef.current)) {
          setCurrentPage(ActivePage.Login);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [routeSession, pwa]);

  const renderActiveView = () => {
    switch (currentPage) {
      // Auth flow
      case ActivePage.Login:
        return <LoginView setCurrentPage={setCurrentPage} />;

      case ActivePage.AuthActivate:
        return <AuthActivateView setCurrentPage={setCurrentPage} />;

      case ActivePage.AuthCallback:
        return <AuthCallbackView setCurrentPage={setCurrentPage} />;

      case ActivePage.AuthResetPassword:
        return <AuthResetPasswordView setCurrentPage={setCurrentPage} />;

      case ActivePage.UpdatePassword:
        return (
          <UpdatePasswordView
            setCurrentPage={setCurrentPage}
            onAuthComplete={handlePostPasswordUpdate}
          />
        );

      // Páginas públicas
      case ActivePage.Home:
        return <LandingPage setCurrentPage={setCurrentPage} />;

      case ActivePage.ComoFunciona:
        return (
          <ComoFuncionaView
            setCurrentPage={setCurrentPage}
            setPreselectedTrade={setPreselectedTrade}
          />
        );

      case ActivePage.Precios:
        return (
          <PreciosView
            setCurrentPage={setCurrentPage}
            setPreselectedTrade={setPreselectedTrade}
          />
        );

      case ActivePage.Contacto:
        return <ContactoView />;

      // Páginas legales
      case ActivePage.AvisoLegal:
      case ActivePage.Privacidad:
      case ActivePage.Cookies:
      case ActivePage.Terminos:
      case ActivePage.Beta:
      case ActivePage.IADisclaimer:
        return (
          <LegalViews
            page={currentPage}
            setCurrentPage={setCurrentPage}
          />
        );

      // Demo interactiva
      case ActivePage.Demo:
        return <DemoView setCurrentPage={setCurrentPage} />;

      case ActivePage.AsisTecnico:
        return <AsistenteTecnicoPublicView setCurrentPage={setCurrentPage} />;

      case ActivePage.Herramientas:
        return <HerramientasView go={setCurrentPage} />;

      // App autenticada
      case ActivePage.AppDashboard:
        return (
          <AppDashboardView
            setCurrentPage={setCurrentPage}
            initialMobile={initialMobile}
            session={session}
            loginOnMount={loginOnMount}
            workerOrgId={workerProfile?.org_id ?? null}
            checkoutSuccess={checkoutSuccess}
          />
        );

      case ActivePage.Registro:
        return <RegistroView setCurrentPage={setCurrentPage} />;

      case ActivePage.Admin:
        return <AdminView setCurrentPage={setCurrentPage} session={session} />;

      case ActivePage.Worker:
        return (
          <ScreenWorkerView
            workerProfile={workerProfile}
            session={session}
            setCurrentPage={setCurrentPage}
          />
        );

      case ActivePage.QuoteAccept:
        return <QuoteAcceptView token={quoteToken} />;

      case ActivePage.InvoiceView:
        return <InvoicePublicView token={invoiceToken} />;

      case ActivePage.PartnerDemo:
        return <PartnerDemoView setCurrentPage={setCurrentPage} />;

      case ActivePage.Valorar:
        return <ReviewView />;

      case ActivePage.Parte:
        return <ParteView />;

      case ActivePage.PortalProveedor:
        return (
          <PortalProveedorView
            setCurrentPage={setCurrentPage}
            session={session}
            totalWorkspaces={
              (resolvedWorkspaces?.installers ?? []).length +
              (resolvedWorkspaces?.suppliers  ?? []).length
            }
            onChangeWorkspace={() => {
              if (resolvedWorkspaces) {
                setPendingWorkspaces(resolvedWorkspaces);
                setCurrentPage(ActivePage.WorkspaceSelector);
              }
            }}
            onSignOut={() => {
              signingOutRef.current = true;
              supabase.auth.signOut();
            }}
          />
        );

      case ActivePage.MarketplaceComprar:
        return <MarketplaceComprarView setCurrentPage={setCurrentPage} session={session} />;

      case ActivePage.SeguimientoMaterial:
        return <ScreenSeguimientoMaterial setCurrentPage={setCurrentPage} session={session} />;

      case ActivePage.WorkspaceSelector:
        return (
          <WorkspaceSelectorView
            workspaces={pendingWorkspaces ?? { installers: [], suppliers: [] }}
            onSelect={(type, id) => applyWorkspace(type, id)}
            setCurrentPage={setCurrentPage}
          />
        );

      case ActivePage.NoWorkspace:
        return (
          <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
            <div className="w-full max-w-md text-center">
              <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-8" />
              <div className="bg-[#0d1f38] rounded-2xl border border-white/10 p-10 shadow-2xl">
                <p className="text-white/60 text-sm mb-6">
                  Tu cuenta no tiene ningún espacio de trabajo activo. Contacta con el administrador
                  de tu organización o crea una cuenta de instalador.
                </p>
                <button
                  onClick={() => { supabase.auth.signOut(); setCurrentPage(ActivePage.Login); }}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-sm font-medium transition"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return <LandingPage setCurrentPage={setCurrentPage} />;
    }
  };

  const isAppView =
    currentPage === ActivePage.Home ||
    currentPage === ActivePage.PartnerDemo ||
    currentPage === ActivePage.AppDashboard ||
    currentPage === ActivePage.Demo ||
    currentPage === ActivePage.Registro ||
    currentPage === ActivePage.Admin ||
    currentPage === ActivePage.Worker ||
    currentPage === ActivePage.PortalProveedor ||
    currentPage === ActivePage.MarketplaceComprar ||
    currentPage === ActivePage.SeguimientoMaterial ||
    currentPage === ActivePage.WorkspaceSelector ||
    currentPage === ActivePage.NoWorkspace;

  const isAuthView =
    currentPage === ActivePage.Login ||
    currentPage === ActivePage.AuthActivate ||
    currentPage === ActivePage.AuthCallback ||
    currentPage === ActivePage.AuthResetPassword ||
    currentPage === ActivePage.UpdatePassword ||
    currentPage === ActivePage.QuoteAccept;

  // Spinner neutral mientras se resuelve el workspace — evita flash del onboarding ERP
  if (workspaceResolving) {
    return (
      <ErrorBoundary>
        <AppLoadingSpinner />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SessionProvider user={session?.user ?? null} sessionChecked={sessionChecked}>
      <div className="min-h-screen flex flex-col bg-[#020B16]">
        {!isAppView && !isAuthView && (
          <Header
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setInitialMobile={setInitialMobile}
            setLoginOnMount={setLoginOnMount}
          />
        )}

        <main className="flex-grow">
          <Suspense fallback={<AppLoadingSpinner />}>
            {renderActiveView()}
          </Suspense>
        </main>

        {!isAppView && !isAuthView && (
          <Footer setCurrentPage={setCurrentPage} />
        )}
      </div>
    </SessionProvider>
    </ErrorBoundary>
  );
}







