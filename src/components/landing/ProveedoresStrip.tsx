import { ShoppingCart, ArrowRight, Package } from 'lucide-react';
import { ActivePage } from '../../types';

interface Props {
  setCurrentPage: (page: ActivePage) => void;
}

const SUPPLIERS = [
  { name: 'Material Eléctrico', sector: 'Electricidad e iluminación' },
  { name: 'Fontanería y Agua', sector: 'Sanitarios, tuberías, griferías' },
  { name: 'Climatización', sector: 'HVAC, frío, calefacción' },
  { name: 'Reformas y Obra', sector: 'Construcción en general' },
  { name: 'Gas e Industrial', sector: 'Gas natural, propano, calefacción' },
];

export default function ProveedoresStrip({ setCurrentPage }: Props) {
  return (
    <section className="bg-[#0F1A2E] py-14 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">

          {/* Texto izquierda */}
          <div>
            <div className="inline-flex items-center gap-2 bg-[#1A5A96]/20 border border-[#1A5A96]/30 text-[#5B9BD5] text-[11px] font-bold px-3 py-1.5 rounded-full mb-5">
              <Package className="w-3.5 h-3.5" />
              Central de Compras — Integración con proveedores
            </div>

            <h2 className="text-2xl lg:text-3xl font-black text-white leading-snug mb-4">
              Tu catálogo de proveedor,<br />
              <span className="text-[#5B9BD5]">dentro del presupuesto.</span>
            </h2>

            <p className="text-white/60 text-base leading-relaxed mb-6 max-w-lg">
              Genera presupuestos y convierte automáticamente los materiales en pedidos para tus proveedores habituales.
            </p>

            <ul className="space-y-2.5 mb-8">
              {[
                'El instalador selecciona materiales directamente desde tu catálogo',
                'El pedido se genera con un toque, con referencia y precio acordado',
                'El margen del instalador se aplica automáticamente',
                'Trazabilidad completa: presupuesto → pedido → factura',
              ].map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5] mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setCurrentPage(ActivePage.Contacto)}
              className="inline-flex items-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/80 text-white font-bold text-sm px-5 py-3 rounded-xl transition-colors cursor-pointer group"
            >
              Integrar mi catálogo
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          {/* Proveedores derecha */}
          <div className="flex flex-col gap-4">

            {/* Cabecera */}
            <div className="flex items-center gap-2 mb-1">
              <ShoppingCart className="w-4 h-4 text-white/30" />
              <p className="text-xs font-bold text-white/30 uppercase tracking-widest">Proveedores integrados o en negociación</p>
            </div>

            {/* Cards de proveedores */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SUPPLIERS.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3 bg-white/5 border border-white/8 hover:border-[#1A5A96]/50 hover:bg-white/8 rounded-xl px-4 py-3.5 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#1A5A96]/20 flex items-center justify-center shrink-0 group-hover:bg-[#1A5A96]/30 transition-colors">
                    <span className="text-[10px] font-black text-[#5B9BD5]">{s.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{s.name}</p>
                    <p className="text-[11px] text-white/40">{s.sector}</p>
                  </div>
                </div>
              ))}

              {/* "Tu empresa" placeholder */}
              <div className="flex items-center gap-3 bg-[#1A5A96]/10 border border-[#1A5A96]/25 border-dashed rounded-xl px-4 py-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#1A5A96]/15 flex items-center justify-center shrink-0">
                  <span className="text-lg text-[#1A5A96]/60 font-black leading-none">+</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-[#5B9BD5]/70">Tu empresa</p>
                  <p className="text-[11px] text-white/30">Hablemos de la integración</p>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-white/25 mt-1 leading-relaxed">
              La integración permite que tus productos aparezcan como sugerencia cuando el instalador
              añade materiales al presupuesto, vinculando directamente con tu portal de pedidos.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}
