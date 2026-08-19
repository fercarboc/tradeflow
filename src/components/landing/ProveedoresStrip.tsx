import { ArrowRight, Store, Package, BarChart3, Megaphone } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

const PORTAL_CAPS = [
  { icon: Package,    label: 'Catálogo',    desc: 'Gestiona productos y precios' },
  { icon: Store,      label: 'Pedidos',     desc: 'Recibe pedidos del Marketplace' },
  { icon: BarChart3,  label: 'Informes',    desc: 'Actividad y visibilidad' },
  { icon: Megaphone,  label: 'Promociones', desc: 'Ofertas y visibilidad Marketplace' },
];

export default function ProveedoresStrip({ setCurrentPage }: Props) {
  return (
    <section className="bg-[#0F1A2E] py-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Texto izquierda */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/20 border border-[#1A5A96]/30 text-[#5B9BD5] text-[11px] font-bold px-3 py-1.5 rounded-full mb-5">
              <Store className="w-3.5 h-3.5" />
              Portal para proveedores
            </div>

            <h2 className="text-2xl lg:text-3xl font-black text-white leading-snug mb-4">
              ¿Eres distribuidor,{' '}
              <span className="text-[#5B9BD5]">mayorista o fabricante?</span>
            </h2>

            <p className="text-white/60 text-base leading-relaxed mb-6 max-w-lg">
              TrabFlow dispone de un portal para proveedores. Gestiona tu catálogo, recibe pedidos, crea promociones y controla tu visibilidad dentro del Marketplace desde un único panel.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-8">
              {PORTAL_CAPS.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 bg-white/5 border border-white/8 rounded-xl px-3 py-2.5"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#1A5A96]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[#5B9BD5]" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{label}</p>
                    <p className="text-[10px] text-white/40">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                onClick={() => setCurrentPage(ActivePage.Proveedores)}
                className="inline-flex items-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors cursor-pointer group"
              >
                Descubre TrabFlow para proveedores
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-white/30 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5]/60" />
                Marketplace en fase de validación
              </span>
            </div>
          </div>

          {/* Visual derecha: mockup de flujo instalador→proveedor */}
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">
              Cómo llega un pedido al proveedor
            </p>

            {[
              { label: 'Instalador gestiona un trabajo', color: '#1A5A96' },
              { label: 'Detecta materiales necesarios', color: '#1A5A96' },
              { label: 'Busca en el Marketplace TrabFlow', color: '#5B9BD5' },
              { label: 'Selecciona tu catálogo y tus precios', color: '#5B9BD5' },
              { label: 'Genera el pedido', color: '#4A6741' },
              { label: 'Tú lo recibes en tu portal', color: '#4A6741' },
            ].map((item, i, arr) => (
              <div key={item.label} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 bg-white/5 border border-white/8 rounded-xl px-4 py-2.5">
                  <p className="text-sm text-white/75 font-medium">{item.label}</p>
                </div>
                {i < arr.length - 1 && (
                  <span className="text-white/20 text-xs shrink-0">↓</span>
                )}
              </div>
            ))}

            <p className="text-[11px] text-white/20 mt-2 leading-relaxed">
              Flujo validado técnicamente con proveedores y catálogos de prueba.
              La siguiente fase incorpora proveedores comerciales reales.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
