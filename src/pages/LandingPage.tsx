import { ActivePage } from '../types';
import Navbar from '../components/landing/Navbar';
import HeroSection from '../components/landing/HeroSection';
import PlanificacionSection from '../components/landing/PlanificacionSection';
import FuncionesSection from '../components/landing/FuncionesSection';
import DashboardSection from '../components/landing/DashboardSection';
import PartnerDemoStrip from '../components/landing/PartnerDemoStrip';
import PartnersSection from '../components/landing/PartnersSection';
import BetaSection from '../components/landing/BetaSection';
import LandingFooter from '../components/landing/LandingFooter';

interface LandingPageProps {
  setCurrentPage: (page: ActivePage) => void;
}

export default function LandingPage({ setCurrentPage }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white">
      <Navbar setCurrentPage={setCurrentPage} />
      <HeroSection setCurrentPage={setCurrentPage} />
      <PlanificacionSection />
      <FuncionesSection />
      <DashboardSection />
      <PartnerDemoStrip setCurrentPage={setCurrentPage} />
      <PartnersSection setCurrentPage={setCurrentPage} />
      <BetaSection />
      <LandingFooter setCurrentPage={setCurrentPage} />
    </div>
  );
}
