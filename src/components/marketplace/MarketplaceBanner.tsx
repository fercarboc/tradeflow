import { ArrowRight, Tag, Zap, Droplets, Wind } from 'lucide-react';

interface Props {
  onCategory: (oficio: string | null) => void;
}

const QUICK = [
  { label: 'Fontanería',    oficio: 'fontaneria',    Icon: Droplets, color: '#3B82F6' },
  { label: 'Electricidad',  oficio: 'electricidad',  Icon: Zap,      color: '#F59E0B' },
  { label: 'Climatización', oficio: 'climatizacion', Icon: Wind,     color: '#06B6D4' },
  { label: 'Oferta -20%',   oficio: 'climatizacion', Icon: Tag,      color: '#EF4444' },
];

export default function MarketplaceBanner({ onCategory }: Props) {
  return (
    <div className="shrink-0 px-4 pt-4 pb-2 space-y-2">
      {/* Banner principal */}
      <div
        className="rounded-2xl overflow-hidden flex items-center gap-6 px-6 py-4"
        style={{ background: 'linear-gradient(120deg, #0d3d6b 0%, #1A5A96 65%, #00CFE8 100%)' }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">
            Solo para profesionales
          </p>
          <p className="text-white font-black text-base leading-tight">
            Los mejores mayoristas, en un solo lugar
          </p>
          <p className="text-white/70 text-xs mt-0.5">
            Precios exclusivos · Stock real · Entrega rápida
          </p>
        </div>

        {/* Chips de acceso rápido a categorías */}
        <div className="flex flex-wrap gap-1.5 shrink-0 max-w-xs justify-end">
          {QUICK.map(q => (
            <button
              key={q.label}
              onClick={() => onCategory(q.oficio)}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/25 text-white text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-all"
            >
              <q.Icon className="w-3 h-3" />
              {q.label}
            </button>
          ))}
          <button
            onClick={() => onCategory(null)}
            className="flex items-center gap-1 bg-white text-[#1A5A96] text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-white/90 transition-all"
          >
            Ver todo <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
