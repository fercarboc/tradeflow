import {
  Droplets, Zap, Layers, Hammer, PaintBucket, Wind, Wrench, Flame,
  ArrowRight, Tag, Package,
} from 'lucide-react';

interface Props {
  onGoToCatalog: (oficio?: string | null) => void;
}

// ─── Oficios ──────────────────────────────────────────────────────────────────

const OFICIOS = [
  { id: 'fontaneria',    label: 'Fontanería',    Icon: Droplets,    color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'electricidad',  label: 'Electricidad',  Icon: Zap,         color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'albanileria',   label: 'Albañilería',   Icon: Layers,      color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'carpinteria',   label: 'Carpintería',   Icon: Hammer,      color: '#92400E', bg: '#FEF3C7' },
  { id: 'pintura',       label: 'Pintura',       Icon: PaintBucket, color: '#EC4899', bg: '#FDF2F8' },
  { id: 'climatizacion', label: 'Climatización', Icon: Wind,        color: '#06B6D4', bg: '#ECFEFF' },
  { id: null,            label: 'Herramientas',  Icon: Wrench,      color: '#6B7280', bg: '#F9FAFB' },
  { id: 'soldadura',     label: 'Soldadura',     Icon: Flame,       color: '#EF4444', bg: '#FEF2F2' },
];

// ─── Mayoristas ───────────────────────────────────────────────────────────────

const SUPPLIERS = [
  { name: 'OBRAMAT',             abbr: 'OBR', color: '#E63312', desc: 'Materiales de construcción y reforma',       oficio: null           },
  { name: 'STN',                 abbr: 'STN', color: '#1A5A96', desc: 'Suministros técnicos para profesionales',     oficio: 'fontaneria'   },
  { name: 'ElectroCantábrico',   abbr: 'ELC', color: '#F59E0B', desc: 'Electricidad e iluminación profesional',     oficio: 'electricidad' },
  { name: 'Saltoki',             abbr: 'SAL', color: '#E74C3C', desc: 'Fontanería, calefacción y climatización',    oficio: 'fontaneria'   },
  { name: 'BigMat',              abbr: 'BGM', color: '#004990', desc: 'Soluciones completas para la construcción',  oficio: 'albanileria'  },
  { name: 'Sonepar',             abbr: 'SNP', color: '#0076BE', desc: 'Distribución eléctrica industrial',          oficio: 'electricidad' },
  { name: 'Ariston',             abbr: 'ARS', color: '#CC0000', desc: 'Calefacción y agua caliente sanitaria',      oficio: 'climatizacion'},
];

// ─── Ofertas estáticas (slots publicitarios, sin facturación) ─────────────────

const DEALS = [
  {
    title:    'Descuentos en climatización',
    subtitle: 'Aprovecha las mejores ofertas en aire acondicionado y ventilación',
    badge:    '-20%',
    oficio:   'climatizacion',
    from:     '#1A5A96',
    to:       '#06B6D4',
  },
  {
    title:    'Fontanería profesional',
    subtitle: 'Todo lo que necesitas para tus instalaciones al mejor precio',
    badge:    '-15%',
    oficio:   'fontaneria',
    from:     '#0D7654',
    to:       '#10B981',
  },
];

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ onGoToCatalog }: { onGoToCatalog: (o?: string | null) => void }) {
  return (
    <div
      className="mx-4 mt-4 rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0d3d6b 0%, #1A5A96 60%, #00CFE8 100%)' }}
    >
      <div className="flex flex-col lg:flex-row items-center gap-8 px-8 py-10">
        {/* Text */}
        <div className="flex-1 text-white">
          <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-2">
            Solo para profesionales
          </p>
          <h1 className="text-3xl lg:text-4xl font-black leading-tight mb-3">
            Los mejores mayoristas,<br />en un solo lugar
          </h1>
          <p className="text-white/75 text-sm mb-6 max-w-sm">
            Precios exclusivos, stock real y entrega rápida para instaladores profesionales.
          </p>
          <button
            onClick={() => onGoToCatalog(null)}
            className="inline-flex items-center gap-2 bg-white text-[#1A5A96] font-bold text-sm px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            Ver ofertas
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Supplier logos grid */}
        <div className="grid grid-cols-3 gap-2 shrink-0">
          {SUPPLIERS.slice(0, 6).map(s => (
            <button
              key={s.name}
              onClick={() => onGoToCatalog(s.oficio)}
              className="w-24 h-12 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 flex items-center justify-center transition-all"
              title={s.name}
            >
              <span className="text-white font-black text-xs tracking-tight">{s.abbr}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Categorías ───────────────────────────────────────────────────────────────

function CategoryGrid({ onGoToCatalog }: { onGoToCatalog: (o: string | null) => void }) {
  return (
    <section className="px-4 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Categorías principales</h2>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
        {OFICIOS.map(o => (
          <button
            key={o.label}
            onClick={() => onGoToCatalog(o.id)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-gray-100 hover:border-gray-300 hover:shadow-sm transition-all group"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: o.bg }}
            >
              <o.Icon className="w-5 h-5" style={{ color: o.color }} />
            </div>
            <span className="text-[10px] font-semibold text-gray-700 text-center leading-tight group-hover:text-gray-900">
              {o.label}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Mayoristas ───────────────────────────────────────────────────────────────

function SuppliersRow({ onGoToCatalog }: { onGoToCatalog: (o: string | null) => void }) {
  return (
    <section className="px-4 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Mayoristas destacados</h2>
        <button
          onClick={() => onGoToCatalog(null)}
          className="text-xs font-semibold text-[#1A5A96] hover:underline"
        >
          Ver todos
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {SUPPLIERS.map(s => (
          <button
            key={s.name}
            onClick={() => onGoToCatalog(s.oficio)}
            className="flex flex-col items-center gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all text-center group"
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xs tracking-tight shrink-0"
              style={{ background: s.color }}
            >
              {s.abbr}
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 group-hover:text-[#1A5A96] transition-colors">
                {s.name}
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-tight line-clamp-2 hidden sm:block">
                {s.desc}
              </p>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onGoToCatalog(s.oficio); }}
              className="text-[10px] font-semibold text-[#1A5A96] border border-[#1A5A96]/30 px-3 py-1 rounded-lg hover:bg-[#1A5A96] hover:text-white transition-all hidden sm:inline-block"
            >
              Ver productos
            </button>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Ofertas destacadas ───────────────────────────────────────────────────────

function DealsSection({ onGoToCatalog }: { onGoToCatalog: (o: string | null) => void }) {
  return (
    <section className="px-4 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Ofertas destacadas</h2>
        <button
          onClick={() => onGoToCatalog(null)}
          className="text-xs font-semibold text-[#1A5A96] hover:underline"
        >
          Ver todas las ofertas
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {DEALS.map(d => (
          <button
            key={d.title}
            onClick={() => onGoToCatalog(d.oficio)}
            className="relative overflow-hidden rounded-2xl p-6 text-left hover:scale-[1.01] transition-transform"
            style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})` }}
          >
            <div className="flex justify-between items-start">
              <div className="text-white">
                <p className="font-bold text-base mb-1">{d.title}</p>
                <p className="text-white/75 text-sm max-w-[200px]">{d.subtitle}</p>
                <button
                  onClick={e => { e.stopPropagation(); onGoToCatalog(d.oficio); }}
                  className="mt-4 inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors border border-white/30"
                >
                  Ver ofertas
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="shrink-0 bg-white/20 border border-white/30 rounded-2xl px-4 py-3 text-white">
                <p className="text-xs font-semibold opacity-75">Hasta</p>
                <p className="text-3xl font-black">{d.badge}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── Banner informativo (slots patrocinados — sin facturación) ────────────────

function AdBanner({ onGoToCatalog }: { onGoToCatalog: (o: string | null) => void }) {
  return (
    <div className="mx-4 mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
        <Tag className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Espacio publicitario</p>
        <p className="text-sm text-gray-400">Posición disponible para campañas de proveedores</p>
      </div>
      <span className="text-[10px] font-bold text-gray-400 border border-gray-300 px-2 py-1 rounded-lg shrink-0">
        PRONTO
      </span>
    </div>
  );
}

// ─── CTA ver catálogo ─────────────────────────────────────────────────────────

function CatalogCta({ onGoToCatalog }: { onGoToCatalog: (o: string | null) => void }) {
  return (
    <div className="mx-4 mt-8 mb-4 bg-white border border-gray-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center">
          <Package className="w-5 h-5 text-[#1A5A96]" />
        </div>
        <div>
          <p className="font-bold text-gray-900 text-sm">Catálogo completo de materiales</p>
          <p className="text-xs text-gray-500">Todos los productos, todos los proveedores</p>
        </div>
      </div>
      <button
        onClick={() => onGoToCatalog(null)}
        className="inline-flex items-center gap-2 bg-[#1A5A96] hover:bg-[#1A5A96]/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-colors shrink-0"
      >
        Ver todos los productos
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MarketplaceHome({ onGoToCatalog }: Props) {
  return (
    <div className="pb-8">
      <Hero onGoToCatalog={onGoToCatalog} />
      <CategoryGrid onGoToCatalog={onGoToCatalog} />
      <SuppliersRow onGoToCatalog={onGoToCatalog} />
      <DealsSection onGoToCatalog={onGoToCatalog} />
      <AdBanner onGoToCatalog={onGoToCatalog} />
      <CatalogCta onGoToCatalog={onGoToCatalog} />
    </div>
  );
}
