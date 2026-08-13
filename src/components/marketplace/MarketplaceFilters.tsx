import { useState } from 'react';
import { ChevronDown, ChevronUp, X, SlidersHorizontal } from 'lucide-react';

export type SortBy = 'nombre' | 'precio_asc' | 'plazo_asc';

export const OFICIOS = [
  { id: 'fontaneria',    label: 'Fontanería',    color: '#3B82F6' },
  { id: 'electricidad',  label: 'Electricidad',  color: '#F59E0B' },
  { id: 'albanileria',   label: 'Albañilería',   color: '#8B5CF6' },
  { id: 'carpinteria',   label: 'Carpintería',   color: '#92400E' },
  { id: 'pintura',       label: 'Pintura',       color: '#EC4899' },
  { id: 'climatizacion', label: 'Climatización', color: '#06B6D4' },
  { id: 'soldadura',     label: 'Soldadura',     color: '#EF4444' },
];

interface Props {
  familias:        string[];
  familia:         string | null;
  onFamilia:       (f: string | null) => void;
  oficio:          string | null;
  onOficio:        (o: string | null) => void;
  actorNombres:    string[];
  selectedActores: string[];
  onActores:       (a: string[]) => void;
  onlyStock:       boolean;
  onOnlyStock:     (v: boolean) => void;
  sortBy:          SortBy;
  onSortBy:        (s: SortBy) => void;
  minPrice:        string;
  maxPrice:        string;
  onMinPrice:      (v: string) => void;
  onMaxPrice:      (v: string) => void;
  totalResults:    number;
  loading:         boolean;
}

export default function MarketplaceFilters({
  familias, familia, onFamilia,
  oficio, onOficio,
  actorNombres, selectedActores, onActores,
  onlyStock, onOnlyStock,
  sortBy, onSortBy,
  minPrice, maxPrice, onMinPrice, onMaxPrice,
  totalResults, loading,
}: Props) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    oficio: true, familia: false, mayorista: true, precio: false, sort: false,
  });

  const toggle = (key: string) =>
    setOpenSections(s => ({ ...s, [key]: !s[key] }));

  const hasFilters = oficio !== null || familia !== null || selectedActores.length > 0 || onlyStock || minPrice !== '' || maxPrice !== '';

  const clearAll = () => {
    onOficio(null); onFamilia(null); onActores([]); onOnlyStock(false);
    onMinPrice(''); onMaxPrice('');
  };

  const toggleActor = (name: string) => {
    if (selectedActores.includes(name)) {
      onActores(selectedActores.filter(a => a !== name));
    } else {
      onActores([...selectedActores, name]);
    }
  };

  return (
    <aside className="w-52 shrink-0 border-r border-gray-200 bg-white overflow-y-auto hidden lg:flex flex-col">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1.5 text-gray-700 text-xs font-bold uppercase tracking-wider">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Filtros
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 tabular-nums">
            {loading ? '…' : totalResults}
          </span>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="flex items-center gap-0.5 text-[10px] text-[#1A5A96] hover:underline font-semibold"
            >
              <X className="w-2.5 h-2.5" /> Limpiar
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {/* ── Categoría / Oficio ──────────────────────────────── */}
        <Section label="Categoría" open={openSections.oficio} onToggle={() => toggle('oficio')}>
          <div className="space-y-0.5 py-1">
            <OficioItem
              label="Todos"
              color="#1A5A96"
              active={oficio === null}
              onClick={() => onOficio(null)}
            />
            {OFICIOS.map(o => (
              <OficioItem
                key={o.id}
                label={o.label}
                color={o.color}
                active={oficio === o.id}
                onClick={() => onOficio(oficio === o.id ? null : o.id)}
              />
            ))}
          </div>
        </Section>

        {/* ── Proveedor ───────────────────────────────────────── */}
        {actorNombres.length > 0 && (
          <Section label="Proveedor" open={openSections.mayorista} onToggle={() => toggle('mayorista')}>
            <div className="space-y-1 py-1">
              {actorNombres.map(m => (
                <label key={m} className="flex items-center gap-2 cursor-pointer group px-1 py-0.5 rounded-lg hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selectedActores.includes(m)}
                    onChange={() => toggleActor(m)}
                    className="w-3.5 h-3.5 rounded border-gray-300 accent-[#1A5A96] shrink-0"
                  />
                  <span className={`text-xs transition-colors truncate ${
                    selectedActores.includes(m)
                      ? 'text-[#1A5A96] font-semibold'
                      : 'text-gray-600 group-hover:text-gray-900'
                  }`}>
                    {m}
                  </span>
                </label>
              ))}
            </div>
          </Section>
        )}

        {/* ── Familia ─────────────────────────────────────────── */}
        {familias.length > 0 && (
          <Section label="Familia" open={openSections.familia} onToggle={() => toggle('familia')}>
            <div className="space-y-0.5 py-1">
              <CheckItem
                label="Todas"
                checked={familia === null}
                onChange={() => onFamilia(null)}
                radio
              />
              {familias.map(f => (
                <CheckItem
                  key={f}
                  label={f}
                  checked={familia === f}
                  onChange={() => onFamilia(familia === f ? null : f)}
                  radio
                />
              ))}
            </div>
          </Section>
        )}

        {/* ── Precio ──────────────────────────────────────────── */}
        <Section label="Precio" open={openSections.precio} onToggle={() => toggle('precio')}>
          <div className="py-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Mín. (€)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minPrice}
                  onChange={e => onMinPrice(e.target.value)}
                  className="w-full mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96]"
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Máx. (€)</label>
                <input
                  type="number"
                  min={0}
                  placeholder="∞"
                  value={maxPrice}
                  onChange={e => onMaxPrice(e.target.value)}
                  className="w-full mt-0.5 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1A5A96]/30 focus:border-[#1A5A96]"
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Disponibilidad ──────────────────────────────────── */}
        <Section label="Disponibilidad" open onToggle={() => {}}>
          <div className="space-y-1 py-1">
            <CheckItem
              label="En stock"
              checked={onlyStock}
              onChange={v => onOnlyStock(v)}
            />
          </div>
        </Section>

        {/* ── Ordenar ─────────────────────────────────────────── */}
        <Section label="Ordenar por" open={openSections.sort} onToggle={() => toggle('sort')}>
          <div className="space-y-0.5 py-1">
            <CheckItem label="Nombre A–Z"    checked={sortBy === 'nombre'}     onChange={() => onSortBy('nombre')}     radio />
            <CheckItem label="Precio más bajo" checked={sortBy === 'precio_asc'} onChange={() => onSortBy('precio_asc')} radio />
            <CheckItem label="Entrega rápida" checked={sortBy === 'plazo_asc'}  onChange={() => onSortBy('plazo_asc')}  radio />
          </div>
        </Section>
      </div>
    </aside>
  );
}

// ─── Sub-componentes internos ─────────────────────────────────────────────────

function Section({
  label, open, onToggle, children,
}: { label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="px-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-2.5 text-xs font-bold text-gray-700 hover:text-gray-900"
      >
        {label}
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>
      {open && children}
    </div>
  );
}

function OficioItem({
  label, color, active, onClick,
}: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors text-xs ${
        active
          ? 'bg-[#EFF6FF] text-[#1A5A96] font-semibold'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: active ? '#1A5A96' : color }}
      />
      {label}
    </button>
  );
}

function CheckItem({
  label, checked, onChange, radio = false,
}: { label: string; checked: boolean; onChange: (v: boolean) => void; radio?: boolean }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group px-1 py-0.5 rounded-lg hover:bg-gray-50">
      <input
        type={radio ? 'radio' : 'checkbox'}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="w-3.5 h-3.5 border-gray-300 accent-[#1A5A96] shrink-0"
      />
      <span className={`text-xs transition-colors ${
        checked ? 'text-[#1A5A96] font-semibold' : 'text-gray-600 group-hover:text-gray-900'
      }`}>
        {label}
      </span>
    </label>
  );
}
