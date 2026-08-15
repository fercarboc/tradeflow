import { Truck, ShieldCheck, Headphones, Tag, ShoppingBag } from 'lucide-react';

const BENEFITS = [
  { Icon: Truck,       label: 'Envío rápido',          sub: 'A toda la Península' },
  { Icon: ShieldCheck, label: 'Pagos seguros',          sub: 'Transacción garantizada' },
  { Icon: Headphones,  label: 'Soporte profesional',    sub: 'Atención especializada' },
  { Icon: Tag,         label: 'Precios profesionales',  sub: 'Solo para instaladores' },
  { Icon: ShoppingBag, label: 'Compra centralizada',    sub: 'Un pedido, varios mayoristas' },
];

interface Props {
  className?: string;
}

export default function MarketplaceBenefitsBar({ className = '' }: Props) {
  return (
    <div className={`bg-white border border-gray-100 rounded-2xl px-4 py-3 ${className}`}>
      <div className="flex items-center justify-around gap-2 overflow-x-auto scrollbar-none">
        {BENEFITS.map(({ Icon, label, sub }) => (
          <div key={label} className="flex flex-col items-center gap-1 shrink-0 px-2">
            <div className="w-8 h-8 rounded-xl bg-[#1A5A96]/8 flex items-center justify-center">
              <Icon className="w-4 h-4 text-[#1A5A96]" />
            </div>
            <p className="text-[10px] font-bold text-gray-700 whitespace-nowrap text-center">
              {label}
            </p>
            <p className="text-[9px] text-gray-400 whitespace-nowrap text-center hidden sm:block">
              {sub}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
