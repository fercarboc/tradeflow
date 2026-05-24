/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ActivePage, TradeType } from './types';
import { supabase } from './lib/supabase';
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

export default function App() {
  const [currentPage, setCurrentPage] = useState<ActivePage>(ActivePage.Home);
  const [preselectedTrade, setPreselectedTrade] = useState<TradeType>('Fontanería');
  const [initialMobile, setInitialMobile] = useState<boolean>(true);
  const [loginOnMount, setLoginOnMount] = useState<boolean>(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

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
    || currentPage === ActivePage.Admin;

  return (
    <div className={`min-h-screen flex flex-col ${isAppView ? 'bg-slate-900' : 'bg-slate-50/30'}`}>
      {!isAppView && (
        <Header currentPage={currentPage} setCurrentPage={setCurrentPage} setInitialMobile={setInitialMobile} setLoginOnMount={setLoginOnMount} />
      )}
      <main className="flex-grow">{renderActiveView()}</main>
      {!isAppView && <Footer setCurrentPage={setCurrentPage} />}
    </div>
  );
}
