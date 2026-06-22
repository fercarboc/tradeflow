import { useState, useEffect } from 'react';
import { Package, ToggleLeft, ToggleRight, RefreshCw, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CatalogRow {
  id: string;
  supplier_key: string;
  supplier_name: string;
  margen_pct_default: number;
  prioridad: number;
  productos: number;
}

interface OrgSetting {
  catalog_id: string;
  enabled: boolean;
  margen_override: number | null;
}

const SUPPLIER_META: Record<string, { color: string; descripcion: string }> = {
  obramat:  { color: '#E87722', descripcion: 'Materiales de construcción e instalaciones' },
  saltoki:  { color: '#1A5A96', descripcion: 'Fontanería, calefacción y climatización' },
  sonepar:  { color: '#6366f1', descripcion: 'Distribución eléctrica e industrial' },
  novelec:  { color: '#f59e0b', descripcion: 'Material eléctrico y automatización' },
  rexel:    { color: '#ef4444', descripcion: 'Distribución eléctrica global' },
  vaillant: { color: '#10b981', descripcion: 'Calefacción, ACS y climatización' },
  junkers:  { color: '#ec4899', descripcion: 'Calderas, calentadores y ACS' },
  ariston:  { color: '#14b8a6', descripcion: 'Calentadores y acumuladores ACS' },
  baxi:     { color: '#8b5cf6', descripcion: 'Calderas y calentadores residenciales' },
  ferroli:  { color: '#f97316', descripcion: 'Calefacción, climatización y ACS' },
};

interface Props {
  orgId: string;
  toast: (type: 'success' | 'error' | 'info', msg: string) => void;
}

export default function SettingsSuppliers({ orgId, toast }: Props) {
  const [catalogs, setCatalogs] = useState<CatalogRow[]>([]);
  const [settings, setSettings] = useState<Record<string, OrgSetting>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editMargen, setEditMargen] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [catRes, settRes, countRes] = await Promise.all([
          supabase
            .from('trade_supplier_catalogs')
            .select('id, supplier_key, supplier_name, margen_pct_default, prioridad')
            .is('org_id', null)
            .eq('is_active', true)
            .order('prioridad'),
          supabase
            .from('trade_org_suppliers')
            .select('catalog_id, enabled, margen_override')
            .eq('org_id', orgId),
          supabase
            .from('trade_supplier_products')
            .select('catalog_id'),
        ]);

        const countMap = new Map<string, number>();
        for (const r of (countRes.data ?? []) as Array<{ catalog_id: string }>) {
          countMap.set(r.catalog_id, (countMap.get(r.catalog_id) ?? 0) + 1);
        }

        const rows: CatalogRow[] = (catRes.data ?? []).map((c: {
          id: string; supplier_key: string; supplier_name: string;
          margen_pct_default: number; prioridad: number;
        }) => ({
          ...c,
          productos: countMap.get(c.id) ?? 0,
        }));
        setCatalogs(rows);

        const sMap: Record<string, OrgSetting> = {};
        for (const s of (settRes.data ?? []) as OrgSetting[]) {
          sMap[s.catalog_id] = s;
        }
        setSettings(sMap);

        const margenes: Record<string, string> = {};
        for (const c of rows) {
          const s = sMap[c.id];
          margenes[c.id] = String(s?.margen_override ?? c.margen_pct_default);
        }
        setEditMargen(margenes);
      } catch (e) {
        toast('error', 'Error cargando proveedores');
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [orgId]);

  const isEnabled = (catId: string) => settings[catId]?.enabled ?? false;

  const handleToggle = async (cat: CatalogRow) => {
    const current = isEnabled(cat.id);
    const newEnabled = !current;
    setSaving(cat.id);

    // Optimistic update
    setSettings(prev => ({
      ...prev,
      [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: newEnabled, margen_override: prev[cat.id]?.margen_override ?? null },
    }));

    const { error } = await supabase
      .from('trade_org_suppliers')
      .upsert(
        { org_id: orgId, catalog_id: cat.id, enabled: newEnabled, margen_override: settings[cat.id]?.margen_override ?? null },
        { onConflict: 'org_id,catalog_id' },
      );

    if (error) {
      setSettings(prev => ({
        ...prev,
        [cat.id]: { ...prev[cat.id], enabled: current },
      }));
      toast('error', `Error al ${newEnabled ? 'activar' : 'desactivar'} ${cat.supplier_name}`);
    } else {
      toast('success', `${cat.supplier_name} ${newEnabled ? 'activado' : 'desactivado'}`);
    }
    setSaving(null);
  };

  const handleSaveMargen = async (cat: CatalogRow) => {
    const val = parseFloat(editMargen[cat.id] ?? '');
    if (isNaN(val) || val < 0 || val > 200) { toast('error', 'Margen inválido (0–200%)'); return; }
    setSaving(cat.id + '_m');

    const { error } = await supabase
      .from('trade_org_suppliers')
      .upsert(
        { org_id: orgId, catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val },
        { onConflict: 'org_id,catalog_id' },
      );

    if (error) {
      toast('error', 'Error al guardar el margen');
    } else {
      setSettings(prev => ({
        ...prev,
        [cat.id]: { ...prev[cat.id], catalog_id: cat.id, enabled: isEnabled(cat.id), margen_override: val },
      }));
      toast('success', `Margen de ${cat.supplier_name} actualizado a ${val}%`);
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-xs">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Cargando catálogos…
      </div>
    );
  }

  const activeCount = Object.values(settings).filter(s => s.enabled).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          La IA usa estos catálogos para sugerir materiales con precio real en tus presupuestos.
          Activa los proveedores con los que trabajas y ajusta el margen.
        </p>
        {activeCount > 0 && (
          <span className="shrink-0 ml-3 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
            {activeCount} activo{activeCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {catalogs.map(cat => {
          const meta = SUPPLIER_META[cat.supplier_key];
          const enabled = isEnabled(cat.id);
          const isOpen = expanded === cat.id;
          const isSavingToggle = saving === cat.id;
          const isSavingMargen = saving === cat.id + '_m';
          const margenActual = settings[cat.id]?.margen_override ?? cat.margen_pct_default;

          return (
            <div
              key={cat.id}
              className={`rounded-xl border transition-all ${
                enabled
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-slate-200 bg-white'
              }`}
            >
              {/* Row principal */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Icono color */}
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black"
                  style={{ backgroundColor: (meta?.color ?? '#64748b') + '20', border: `1px solid ${meta?.color ?? '#64748b'}30` }}
                >
                  <span style={{ color: meta?.color ?? '#64748b' }}>
                    {cat.supplier_name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{cat.supplier_name}</span>
                    {cat.productos > 0 && (
                      <span className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                        {cat.productos} prods
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">{meta?.descripcion ?? ''}</p>
                </div>

                {/* Margen label */}
                <span className="text-[10px] text-slate-500 shrink-0 hidden sm:block">
                  Margen: <strong className="text-slate-700">{margenActual}%</strong>
                </span>

                {/* Expand para editar margen */}
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.id)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Configurar margen"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Toggle */}
                <button
                  onClick={() => handleToggle(cat)}
                  disabled={isSavingToggle}
                  className="cursor-pointer shrink-0 disabled:opacity-50"
                  title={enabled ? 'Desactivar' : 'Activar'}
                >
                  {isSavingToggle
                    ? <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                    : enabled
                      ? <ToggleRight className="h-7 w-7 text-emerald-500" />
                      : <ToggleLeft className="h-7 w-7 text-slate-300" />
                  }
                </button>
              </div>

              {/* Panel de margen expandible */}
              {isOpen && (
                <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-2">
                    Margen sobre precio de compra (%)
                  </p>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min={0} max={200} step={0.5}
                      value={editMargen[cat.id] ?? ''}
                      onChange={e => setEditMargen(prev => ({ ...prev, [cat.id]: e.target.value }))}
                      className="w-24 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-sm font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => handleSaveMargen(cat)}
                      disabled={isSavingMargen}
                      className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isSavingMargen ? <RefreshCw className="h-3 w-3 animate-spin" /> : null}
                      Guardar
                    </button>
                    <span className="text-[10px] text-slate-400">
                      Precio coste 100€ → venta{' '}
                      <strong className="text-slate-600">
                        {(100 * (1 + (parseFloat(editMargen[cat.id] ?? '0') || 0) / 100)).toFixed(2)} €
                      </strong>
                    </span>
                  </div>
                  {(settings[cat.id]?.margen_override != null) && (
                    <p className="text-[9px] text-blue-500 mt-1">
                      Margen personalizado activo (global: {cat.margen_pct_default}%)
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {catalogs.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-xs">
          <Package className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          No hay catálogos disponibles todavía
        </div>
      )}
    </div>
  );
}
