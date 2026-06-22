import { ArrowRight, Handshake, TrendingUp, Download, Building2, Truck, GraduationCap, Wrench } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

const PARTNER_TYPES = [
  { icon: Building2, label: 'Fabricantes de equipos' },
  { icon: Truck, label: 'Distribuidores del sector' },
  { icon: GraduationCap, label: 'Asociaciones de instaladores' },
  { icon: Wrench, label: 'Empresas de formación técnica' },
];

export default function PartnersSection({ setCurrentPage }: Props) {
  return (
    <section className="bg-white py-16 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Col 1: Partners */}
          <div className="border border-gray-200 rounded-2xl p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Handshake className="w-5 h-5 text-[#1A5A96]" />
              <h3 className="font-black text-[#1C2535] text-lg">Colaboradores y Partners</h3>
            </div>
            <p className="text-[#1C2535]/55 text-sm mb-5 leading-relaxed">
              Trabajamos con asociaciones, distribuidores y empresas que impulsan el sector instalador en España.
            </p>

            <div className="bg-[#F5F6F8] rounded-xl p-4 mb-5 flex-1">
              <p className="text-xs font-bold text-[#1C2535]/50 uppercase tracking-wider mb-3">Buscamos partners</p>
              <ul className="space-y-2.5">
                {PARTNER_TYPES.map(({ icon: Icon, label }) => (
                  <li key={label} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-[#1A5A96]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-[#1A5A96]" />
                    </div>
                    <span className="text-sm text-[#1C2535]/70">{label}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-[#1C2535]/45 leading-relaxed">
                Si representas a una asociación, distribuidor o fabricante del sector y quieres ofrecer valor añadido a tus clientes instaladores, hablemos.
              </p>
            </div>

            <button
              onClick={() => setCurrentPage(ActivePage.Contacto)}
              className="flex items-center justify-between border border-[#1C2535]/15 rounded-xl px-4 py-3 text-sm font-semibold text-[#1C2535] hover:bg-gray-50 transition-colors cursor-pointer group"
            >
              Quiero ser partner
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Col 2: Investors stats */}
          <div className="border border-gray-200 rounded-2xl p-7 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#C8922A]" />
              <h3 className="font-black text-[#1C2535] text-lg">Para inversores</h3>
            </div>
            <p className="text-[#1C2535]/55 text-sm mb-6 leading-relaxed">
              Estamos construyendo la infraestructura digital del sector de instalaciones en España y LATAM.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { val: '650K+', label: 'Instaladores en España' },
                { val: '€480M', label: 'TAM España + LATAM' },
                { val: '1–2%', label: 'Penetración objetivo' },
              ].map(({ val, label }) => (
                <div key={val} className="bg-[#F5F6F8] rounded-xl p-3 text-center">
                  <p className="text-base font-black text-[#1C2535]">{val}</p>
                  <p className="text-[10px] text-[#1C2535]/45 mt-0.5 leading-tight">{label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2 mt-auto">
              <button
                onClick={() => setCurrentPage(ActivePage.Contacto)}
                className="w-full flex items-center justify-between border border-[#1C2535]/15 rounded-xl px-4 py-3 text-sm font-semibold text-[#1C2535] hover:bg-gray-50 transition-colors cursor-pointer group"
              >
                Ver pitch deck
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => setCurrentPage(ActivePage.Contacto)}
                className="w-full text-sm font-semibold text-[#1A5A96] hover:underline cursor-pointer py-2"
              >
                Contactar con el equipo de inversión →
              </button>
            </div>
          </div>

          {/* Col 3: Pitch deck card */}
          <div className="border border-[#1A5A96]/25 bg-gradient-to-br from-[#F0F6FF] to-white rounded-2xl p-7 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-[#1C2535] text-lg">Pitch Deck</h3>
              <span className="text-[10px] font-bold bg-[#1A5A96]/10 text-[#1A5A96] px-2.5 py-1 rounded-full border border-[#1A5A96]/15">
                NUEVO
              </span>
            </div>
            <p className="text-[#1C2535]/55 text-sm mb-5 leading-relaxed">
              Descarga nuestro pitch deck completo y conoce la oportunidad de inversión en TradeFlow.
            </p>

            {/* Deck preview */}
            <div className="bg-[#1C2535] rounded-xl p-5 mb-5 flex-1 flex flex-col justify-between min-h-[120px] shadow-lg">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-4 h-4 bg-[#1A5A96] rounded flex items-center justify-center">
                    <span className="text-white text-[8px] font-black">TF</span>
                  </div>
                  <span className="text-white/50 text-[9px] font-semibold tracking-wider uppercase">TradeFlow AI</span>
                </div>
                <p className="text-white font-black text-xl leading-tight">Pitch Deck</p>
              </div>
              <p className="text-white/30 text-[10px]">Junio 2026 · Confidencial</p>
            </div>

            <button
              onClick={() => setCurrentPage(ActivePage.Contacto)}
              className="w-full bg-[#1A5A96] hover:bg-[#1A5A96]/90 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              Descargar pitch deck (PDF)
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
