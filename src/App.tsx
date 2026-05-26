/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
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

const ADMIN_EMAIL = 'fercarboc@gmail.com';

function isPWAMode(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return params.get('app') === 'true' || isStandalone;
}


export default function App() {
  const pwa = isPWAMode();
  const [currentPage, setCurrentPage] = useState<ActivePage>(
    pwa ? ActivePage.AppDashboard : ActivePage.Home,
  );
  const [preselectedTrade, setPreselectedTrade] = useState<TradeType>('Fontanería');
  const [initialMobile, setInitialMobile] = useState<boolean>(true);
  const [loginOnMount, setLoginOnMount] = useState<boolean>(pwa);
  const [session, setSession] = useState<Session | null>(null);
  const [workerProfile, setWorkerProfile] = useState<WorkerProfile | null>(null);

  const routeSession = useCallback(async (s: Session | null) => {
    setSession(s);
    if (s) {
      setLoginOnMount(false);
      if (s.user.email === ADMIN_EMAIL) {
        setCurrentPage(ActivePage.Admin);
        return;
      }
      try {
        const wp = await loadWorkerByEmail(s.user.email ?? '');
        if (wp) {
          setWorkerProfile(wp);
          setCurrentPage(ActivePage.Worker);
          return;
        }
      } catch { /* no worker — normal instalador */ }
      setCurrentPage(ActivePage.AppDashboard);
    } else {
      setWorkerProfile(null);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        routeSession(data.session);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) {
        routeSession(s);
      } else {
        setSession(null);
        setCurrentPage(pwa ? ActivePage.AppDashboard : ActivePage.Home);
        if (pwa) setLoginOnMount(true);
      }
    });
    return () => subscription.unsubscribe();
  }, [routeSession, pwa]);

  const renderActiveView = () => {
    switch (currentPage) {
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
      case ActivePage.AppDashboard:
        return (
          <AppDashboardView
            setCurrentPage={setCurrentPage}
            initialMobile={initialMobile}
            session={session}
            loginOnMount={loginOnMount}
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

  return (
    <div className={`min-h-screen flex flex-col ${isAppView ? 'bg-slate-900' : 'bg-slate-50/30'}`}>
      {!isAppView && (
        <Header
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          setInitialMobile={setInitialMobile}
          setLoginOnMount={setLoginOnMount}
        />
      )}
      <main className="flex-grow">{renderActiveView()}</main>
      {!isAppView && <Footer setCurrentPage={setCurrentPage} />}
    </div>
  );
}
