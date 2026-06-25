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
import LoginView from './components/auth/LoginView';
import AuthActivateView from './components/auth/AuthActivateView';
import AuthCallbackView from './components/auth/AuthCallbackView';
import AuthResetPasswordView from './components/auth/AuthResetPasswordView';
import UpdatePasswordView from './components/auth/UpdatePasswordView';
import QuoteAcceptView from './components/QuoteAcceptView';
import InvoicePublicView from './components/InvoicePublicView';
const PartnerDemoView = lazy(() => import('./components/partner-demo/PartnerDemoView'));

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
  [ActivePage.Admin]:             '/admin',
  [ActivePage.Worker]:            '/worker',
  [ActivePage.Login]:             '/login',
  [ActivePage.AuthActivate]:      '/auth/activate',
  [ActivePage.AuthCallback]:      '/auth/callback',
  [ActivePage.AuthResetPassword]: '/auth/reset-password',
  [ActivePage.UpdatePassword]:    '/update-password',
  [ActivePage.PartnerDemo]:       '/demo-socios',
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
  ActivePage.PartnerDemo,
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

  return null;
}

function extractQuoteToken(): string {
  const parts = window.location.pathname.split('/');
  return parts[2] ?? '';
}

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

  const routeSession = useCallback(async (s: Session | null) => {
    setSession(s);

    if (!s) {
      setWorkerProfile(null);
      return;
    }

    if (AUTH_FLOW_PAGES.has(currentPageRef.current)) {
      return;
    }

    setLoginOnMount(false);

    if (s.user.email === ADMIN_EMAIL) {
      setCurrentPage(ActivePage.Admin);
      return;
    }

    try {
      const wp = await loadWorkerByEmail(s.user.email ?? '');

      if (wp) {
        setWorkerProfile(wp);

        if (wp.rol === 'admin') {
          setCurrentPage(ActivePage.AppDashboard);
        } else {
          setCurrentPage(ActivePage.Worker);
        }

        return;
      }
    } catch {
      // Usuario normal, no es worker
    }

    setCurrentPage(ActivePage.AppDashboard);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSessionChecked(true);
      if (data.session) {
        routeSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'INITIAL_SESSION') setSessionChecked(true);

      if (event === 'PASSWORD_RECOVERY') {
        setSession(s);
        setCurrentPage(ActivePage.UpdatePassword);
        return;
      }

      if (s) {
        routeSession(s);
      } else {
        setSession(null);
        setWorkerProfile(null);

        if (!PUBLIC_OR_AUTH_PAGES.has(currentPageRef.current)) {
          setCurrentPage(pwa ? ActivePage.AppDashboard : ActivePage.Home);

          if (pwa) {
            setLoginOnMount(true);
          }
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
        return <UpdatePasswordView setCurrentPage={setCurrentPage} />;

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
    currentPage === ActivePage.Worker;

  const isAuthView =
    currentPage === ActivePage.Login ||
    currentPage === ActivePage.AuthActivate ||
    currentPage === ActivePage.AuthCallback ||
    currentPage === ActivePage.AuthResetPassword ||
    currentPage === ActivePage.UpdatePassword ||
    currentPage === ActivePage.QuoteAccept;

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







