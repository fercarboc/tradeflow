/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ActivePage, TradeType } from './types';
import { supabase, loadWorkerByEmail } from './lib/supabase';
import type { WorkerProfile } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import Header from './components/Header';
import HomeView from './components/HomeView';
import ComoFuncionaView from './components/ComoFuncionaView';
import PreciosView from './components/PreciosView';
import ContactoView from './components/ContactoView';
import LegalViews from './components/LegalViews';
import Footer from './components/Footer';
import AppDashboardView from './components/AppDashboardView';
import RegistroView from './components/RegistroView';
import AdminView from './components/AdminView';
import ScreenWorkerView from './components/ScreenWorkerView';
import LoginView from './components/auth/LoginView';
import AuthActivateView from './components/auth/AuthActivateView';
import AuthCallbackView from './components/auth/AuthCallbackView';
import AuthResetPasswordView from './components/auth/AuthResetPasswordView';
import UpdatePasswordView from './components/auth/UpdatePasswordView';

const ADMIN_EMAIL = 'fercarboc@gmail.com';

// Páginas que pertenecen al flujo de autenticación — no deben ser sobreescritas por onAuthStateChange
const AUTH_FLOW_PAGES = new Set<ActivePage>([
  ActivePage.AuthActivate,
  ActivePage.AuthCallback,
  ActivePage.UpdatePassword,
]);

function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return params.get('app') === 'true' || isStandalone;
}

// Detecta si la URL actual corresponde a una página de auth y devuelve la página a mostrar.
// Retorna null si es una ruta pública normal.
function detectAuthRoute(): ActivePage | null {
  const path = window.location.pathname;
  if (path === '/auth/activate') return ActivePage.AuthActivate;
  if (path === '/auth/callback') return ActivePage.AuthCallback;
  if (path === '/auth/reset-password') return ActivePage.AuthResetPassword;
  if (path === '/update-password') return ActivePage.UpdatePassword;
  if (path === '/login') return ActivePage.Login;
  return null;
}

export default function App() {
  const pwa = isPWAMode();

  // Determinar página inicial: rutas de auth tienen prioridad sobre todo lo demás
  const initialAuthRoute = detectAuthRoute();
  const [currentPage, setCurrentPage] = useState<ActivePage>(
    initialAuthRoute ?? (pwa ? ActivePage.AppDashboard : ActivePage.Home),
  );

  const [preselectedTrade, setPreselectedTrade] = useState<TradeType>('Fontanería');
  const [initialMobile, setInitialMobile] = useState<boolean>(true);
  const [loginOnMount, setLoginOnMount] = useState<boolean>(pwa && !initialAuthRoute);
  const [session, setSession] = useState<Session | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);

  // Ref para que routeSession siempre vea la página actual sin crear dependencias circulares
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;

  const routeSession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (!s) {
      setWorkerProfile(null);
      return;
    }

    // Si estamos en medio de un flujo de auth (activate, callback, update-password),
    // no sobreescribir la página — el componente de auth gestiona su propia navegación.
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
        // Admin/owner role → full dashboard; field workers → limited worker view
        if (wp.rol === 'admin') {
          setCurrentPage(ActivePage.AppDashboard);
        } else {
          setCurrentPage(ActivePage.Worker);
        }
        return;
      }
    } catch { /* usuario normal, no es worker */ }

    setCurrentPage(ActivePage.AppDashboard);
  }, []);

  useEffect(() => {
    // Sesión existente al cargar (p.ej. usuario ya logueado)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        routeSession(data.session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // El evento PASSWORD_RECOVERY llega cuando Supabase procesa el hash de un reset link.
      // Lo manejamos aquí directamente para ir a la página de cambio de contraseña.
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
        if (!AUTH_FLOW_PAGES.has(currentPageRef.current)) {
          setCurrentPage(pwa ? ActivePage.AppDashboard : ActivePage.Home);
          if (pwa) setLoginOnMount(true);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [routeSession, pwa]);

  const renderActiveView = () => {
    switch (currentPage) {
      // ── Auth flow ────────────────────────────────────────────────────────
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

      // ── Páginas públicas ─────────────────────────────────────────────────
      case ActivePage.Home:
        return (
          <HomeView
            setCurrentPage={setCurrentPage}
            setPreselectedTrade={setPreselectedTrade}
            setInitialMobile={setInitialMobile}
          />
        );
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
        return <ContactoView initialPreselectedTrade={preselectedTrade} />;
      case ActivePage.AvisoLegal:
      case ActivePage.Privacidad:
      case ActivePage.Cookies:
        return <LegalViews page={currentPage} setCurrentPage={setCurrentPage} />;

      // ── App autenticada ──────────────────────────────────────────────────
      case ActivePage.AppDashboard:
        return (
          <AppDashboardView
            setCurrentPage={setCurrentPage}
            initialMobile={initialMobile}
            session={session}
            loginOnMount={loginOnMount}
            workerOrgId={workerProfile?.org_id ?? null}
          />
        );
      case ActivePage.Registro:
        return <RegistroView setCurrentPage={setCurrentPage} />;
      case ActivePage.Admin:
        return <AdminView setCurrentPage={setCurrentPage} session={session} />;
      case ActivePage.Worker:
        return <ScreenWorkerView workerProfile={workerProfile} session={session} setCurrentPage={setCurrentPage} />;

      default:
        return (
          <HomeView
            setCurrentPage={setCurrentPage}
            setPreselectedTrade={setPreselectedTrade}
            setInitialMobile={setInitialMobile}
          />
        );
    }
  };

  const isAppView = currentPage === ActivePage.AppDashboard
    || currentPage === ActivePage.Registro
    || currentPage === ActivePage.Admin
    || currentPage === ActivePage.Worker;

  const isAuthView = currentPage === ActivePage.Login
    || currentPage === ActivePage.AuthActivate
    || currentPage === ActivePage.AuthCallback
    || currentPage === ActivePage.AuthResetPassword
    || currentPage === ActivePage.UpdatePassword;

  return (
    <div className="min-h-screen flex flex-col bg-[#020B16]">
      {!isAppView && !isAuthView && (
        <Header
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          setInitialMobile={setInitialMobile}
          setLoginOnMount={setLoginOnMount}
        />
      )}
      <main className="flex-grow">{renderActiveView()}</main>
      {!isAppView && !isAuthView && <Footer setCurrentPage={setCurrentPage} />}
    </div>
  );
}
