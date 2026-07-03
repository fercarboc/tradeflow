import { useState, useEffect, useCallback, type ElementType } from 'react';
import {
  Activity, Brain, CheckCircle, XCircle, AlertTriangle, Clock,
  RefreshCw, ChevronRight, Plus, BarChart2, Layers,
  TrendingUp, TrendingDown, Minus, AlertCircle, Database,
  GitBranch, Cpu, Zap, Eye, Edit2, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

type Semaforo = 'verde' | 'amarillo' | 'rojo' | null;
type RunEstado = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
type BenchmarkTipo = 'oficial' | 'proveedor' | 'cliente' | 'interno';
type SubScreen = 'dashboard' | 'benchmarks' | 'versiones' | 'ejecuciones';

interface BenchmarkRun {
  id: string;
  benchmark_id: string;
  version_tag: string;
  descripcion: string | null;
  estado: RunEstado;
  completado_at: string | null;
  total_queries: number;
  queries_ok: number;
  queries_vacio: number;
  queries_truncado: number;
  queries_error: number;
  queries_solo_sug: number;
  queries_precio_inv: number;
  ok_rate: number | null;
  coin_rate: number | null;
  lat_mean_ms: number | null;
  lat_p95_ms: number | null;
  tok_mean: number | null;
  tok_max: number | null;
  semaforo: Semaforo;
  notas: string | null;
  created_at: string;
}

interface AiVersion {
  id: string;
  version_tag: string;
  git_commit: string | null;
  git_tag: string | null;
  model_id: string;
  prompt_version: string | null;
  desplegado_at: string | null;
  rolled_back_at: string | null;
  es_produccion: boolean;
  es_baseline: boolean;
  benchmark_run_id: string | null;
  semaforo: Semaforo;
  notas: string | null;
  created_at: string;
  run?: BenchmarkRun;
}

interface Benchmark {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: BenchmarkTipo;
  activo: boolean;
  es_baseline: boolean;
  total_queries: number;
  created_at: string;
}

interface ToastFn {
  (type: 'success' | 'error' | 'info', msg: string): void;
}

interface Props {
  toast: ToastFn;
}

// ─── Helpers visuales ────────────────────────────────────────────────────────

function SemaforoBadge({ val }: { val: Semaforo }) {
  if (!val) return <span className="text-gray-400 text-xs">—</span>;
  const cfg = {
    verde:    { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500',  label: 'Apto'     },
    amarillo: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'Revisar'  },
    rojo:     { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500',    label: 'Rollback' },
  }[val];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TipoBadge({ tipo }: { tipo: BenchmarkTipo }) {
  const cfg: Record<BenchmarkTipo, string> = {
    oficial:    'bg-blue-100 text-blue-700',
    proveedor:  'bg-purple-100 text-purple-700',
    cliente:    'bg-orange-100 text-orange-700',
    interno:    'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium capitalize ${cfg[tipo]}`}>
      {tipo}
    </span>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, trend, color = 'gray',
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ElementType;
  trend?: 'up' | 'down' | 'flat' | null;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'gray';
}) {
  const colors = {
    green:  { bg: 'bg-green-50',  icon: 'text-green-500',  val: 'text-green-700'  },
    red:    { bg: 'bg-red-50',    icon: 'text-red-500',    val: 'text-red-700'    },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-500', val: 'text-yellow-700' },
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-500',   val: 'text-blue-700'   },
    gray:   { bg: 'bg-gray-50',   icon: 'text-gray-500',   val: 'text-gray-900'   },
  }[color];
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  return (
    <div className={`rounded-xl p-4 ${colors.bg} border border-white`}>
      <div className="flex items-start justify-between mb-2">
        <Icon size={16} className={colors.icon} />
        {trend && <TrendIcon size={12} className={trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400'} />}
      </div>
      <div className={`text-2xl font-bold ${colors.val}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function pct(n: number, total: number) {
  return total > 0 ? ((n / total) * 100).toFixed(1) + '%' : '—';
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Screen: Dashboard ───────────────────────────────────────────────────────

function DashboardScreen({ versions, runs }: { versions: AiVersion[]; runs: BenchmarkRun[] }) {
  const prodVersion = versions.find(v => v.es_produccion) ?? versions.find(v => v.version_tag === 'v57b');
  const baseline    = versions.find(v => v.es_baseline);
  const lastRun     = runs.find(r => r.version_tag === prodVersion?.version_tag);
  const baselineRun = runs.find(r => r.version_tag === baseline?.version_tag);

  const sortedRuns = [...runs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  return (
    <div className="space-y-6">

      {/* Versión activa + baseline */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Versión en producción */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={16} className="text-blue-500" />
            <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Versión en producción</span>
          </div>
          {prodVersion ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-bold text-gray-900">{prodVersion.version_tag}</span>
                <SemaforoBadge val={prodVersion.semaforo} />
              </div>
              {prodVersion.notas && (
                <p className="text-sm text-gray-500 mb-3 line-clamp-2">{prodVersion.notas}</p>
              )}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-green-700">{lastRun?.ok_rate?.toFixed(1) ?? '—'}%</div>
                  <div className="text-xs text-gray-500">OK rate</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-700">{lastRun?.queries_vacio ?? '—'}</div>
                  <div className="text-xs text-gray-500">VACIO</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-700">{lastRun?.queries_truncado ?? '—'}</div>
                  <div className="text-xs text-gray-500">TRUNCADO</div>
                </div>
              </div>
              {prodVersion.desplegado_at && (
                <div className="mt-3 text-xs text-gray-400">Desplegado {fmtDate(prodVersion.desplegado_at)}</div>
              )}
            </>
          ) : (
            <p className="text-gray-400 text-sm">Sin versión marcada como producción</p>
          )}
        </div>

        {/* Baseline */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Database size={16} className="text-purple-500" />
            <span className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Baseline oficial</span>
          </div>
          {baseline ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl font-bold text-gray-900">{baseline.version_tag}</span>
                <SemaforoBadge val={baseline.semaforo} />
              </div>
              <p className="text-xs text-gray-400 mb-3">Referencia permanente para todas las comparativas. No se modifica.</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-purple-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-purple-700">{baselineRun?.ok_rate?.toFixed(1) ?? '—'}%</div>
                  <div className="text-xs text-gray-500">OK rate</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-700">{baselineRun?.queries_vacio ?? '—'}</div>
                  <div className="text-xs text-gray-500">VACIO</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="text-lg font-bold text-gray-700">{baselineRun?.queries_truncado ?? '—'}</div>
                  <div className="text-xs text-gray-500">TRUNCADO</div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-gray-400 text-sm">Sin baseline definido</p>
          )}
        </div>
      </div>

      {/* KPI Grid — última ejecución en producción */}
      {lastRun && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            KPIs — {lastRun.version_tag} · {fmtDate(lastRun.completado_at)}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KpiCard label="OK rate"     value={`${lastRun.ok_rate?.toFixed(1) ?? '—'}%`}  icon={CheckCircle} color="green" />
            <KpiCard label="Coincide of." value={`${lastRun.coin_rate?.toFixed(1) ?? '—'}%`} icon={Brain}       color="blue"  />
            <KpiCard label="VACIO"       value={lastRun.queries_vacio}    icon={XCircle}       color={lastRun.queries_vacio > 0 ? 'red' : 'green'} />
            <KpiCard label="TRUNCADO"    value={lastRun.queries_truncado} icon={AlertTriangle}  color={lastRun.queries_truncado > 4 ? 'red' : 'yellow'} />
            <KpiCard label="SOLO_SUG"    value={lastRun.queries_solo_sug}  icon={AlertCircle}   color="gray" />
            <KpiCard label="P.INVÁLIDO"  value={lastRun.queries_precio_inv} icon={XCircle}      color={lastRun.queries_precio_inv > 0 ? 'red' : 'green'} />
            <KpiCard label="Lat. media"  value={lastRun.lat_mean_ms ? `${(lastRun.lat_mean_ms / 1000).toFixed(1)}s` : '—'} icon={Clock} color="gray" />
            <KpiCard label="Lat. P95"    value={lastRun.lat_p95_ms  ? `${(lastRun.lat_p95_ms  / 1000).toFixed(1)}s` : '—'} icon={Clock} color="gray" />
          </div>
        </div>
      )}

      {/* Histórico de ejecuciones */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <BarChart2 size={15} className="text-gray-400" />
            Histórico de benchmarks
          </h3>
          <span className="text-xs text-gray-400">{sortedRuns.length} ejecuciones</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2.5">Versión</th>
                <th className="text-center px-3 py-2.5">Estado</th>
                <th className="text-right px-3 py-2.5">OK%</th>
                <th className="text-right px-3 py-2.5">Coinc.%</th>
                <th className="text-right px-3 py-2.5">VACIO</th>
                <th className="text-right px-3 py-2.5">TRUNC.</th>
                <th className="text-right px-3 py-2.5">P.INV.</th>
                <th className="text-right px-3 py-2.5">Lat.med</th>
                <th className="text-right px-3 py-2.5">Tok.med</th>
                <th className="text-right px-3 py-2.5">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sortedRuns.map((r, i) => {
                const v = versions.find(v => v.version_tag === r.version_tag);
                const isBaseline = v?.es_baseline;
                const isProd     = v?.es_produccion;
                return (
                  <tr key={r.id} className={`border-t border-gray-50 ${isBaseline ? 'bg-purple-50/40' : isProd ? 'bg-blue-50/30' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-gray-800">{r.version_tag}</span>
                        {isBaseline && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">baseline</span>}
                        {isProd     && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">producción</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <SemaforoBadge val={r.semaforo} />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-800">
                      {r.ok_rate?.toFixed(1) ?? '—'}%
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600">
                      {r.coin_rate?.toFixed(1) ?? '—'}%
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${r.queries_vacio > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {r.queries_vacio}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${r.queries_truncado > 4 ? 'text-yellow-600' : 'text-gray-600'}`}>
                      {r.queries_truncado}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-medium ${r.queries_precio_inv > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                      {r.queries_precio_inv}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">
                      {r.lat_mean_ms ? `${(r.lat_mean_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500 tabular-nums">
                      {r.tok_mean ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-400 text-xs whitespace-nowrap">
                      {fmtDate(r.completado_at ?? r.created_at)}
                    </td>
                  </tr>
                );
              })}
              {sortedRuns.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-gray-400">Sin ejecuciones registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick actions (Sprint 3) */}
      <div className="bg-gray-50 rounded-2xl border border-gray-200 border-dashed p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={15} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-500">Acciones rápidas — disponibles en Sprint 3</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {['Ejecutar benchmark oficial', 'Deploy nueva versión', 'Comparar 2 versiones', 'Exportar informe CSV'].map(a => (
            <button key={a} disabled className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-400 cursor-not-allowed select-none">
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Crear/Editar Benchmark ───────────────────────────────────────────

interface BenchmarkForm {
  nombre: string;
  descripcion: string;
  tipo: BenchmarkTipo;
}

function BenchmarkModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: Benchmark;
  onSave: (form: BenchmarkForm) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<BenchmarkForm>({
    nombre:      initial?.nombre      ?? '',
    descripcion: initial?.descripcion ?? '',
    tipo:        initial?.tipo        ?? 'interno',
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-gray-800">{initial ? 'Editar benchmark' : 'Nuevo benchmark'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Ej: Benchmark OBRAMAT 50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <select
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as BenchmarkTipo }))}
            >
              <option value="oficial">Oficial (TrabFlow)</option>
              <option value="proveedor">Proveedor</option>
              <option value="cliente">Cliente</option>
              <option value="interno">Interno</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
            <textarea
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Describe el propósito de este benchmark..."
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.nombre.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium disabled:opacity-50 hover:bg-blue-700"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Screen: Benchmarks ──────────────────────────────────────────────────────

function BenchmarksScreen({
  benchmarks,
  onRefresh,
  toast,
}: {
  benchmarks: Benchmark[];
  onRefresh: () => void;
  toast: ToastFn;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing,   setEditing]   = useState<Benchmark | undefined>(undefined);
  const [saving,    setSaving]    = useState(false);

  const handleSave = async (form: BenchmarkForm) => {
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from('trade_benchmarks')
          .update({ nombre: form.nombre, descripcion: form.descripcion || null, tipo: form.tipo, updated_at: new Date().toISOString() })
          .eq('id', editing.id);
        if (error) throw error;
        toast('success', 'Benchmark actualizado');
      } else {
        const { error } = await supabase
          .from('trade_benchmarks')
          .insert({ nombre: form.nombre, descripcion: form.descripcion || null, tipo: form.tipo });
        if (error) throw error;
        toast('success', 'Benchmark creado');
      }
      setShowModal(false);
      setEditing(undefined);
      onRefresh();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Benchmarks</h2>
          <p className="text-sm text-gray-500 mt-0.5">Conjuntos de consultas para evaluar el motor IA</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 shadow-sm"
        >
          <Plus size={15} />
          Nuevo benchmark
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <th className="text-left px-5 py-3">Nombre</th>
              <th className="text-center px-3 py-3">Tipo</th>
              <th className="text-right px-3 py-3">Consultas</th>
              <th className="text-center px-3 py-3">Estado</th>
              <th className="text-center px-3 py-3">Baseline</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {benchmarks.map((b, i) => (
              <tr key={b.id} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                <td className="px-5 py-3">
                  <div className="font-medium text-gray-800">{b.nombre}</div>
                  {b.descripcion && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{b.descripcion}</div>}
                </td>
                <td className="px-3 py-3 text-center"><TipoBadge tipo={b.tipo} /></td>
                <td className="px-3 py-3 text-right font-mono text-gray-700">{b.total_queries}</td>
                <td className="px-3 py-3 text-center">
                  {b.activo
                    ? <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Activo</span>
                    : <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactivo</span>}
                </td>
                <td className="px-3 py-3 text-center">
                  {b.es_baseline && <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">Baseline</span>}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    onClick={() => { setEditing(b); setShowModal(true); }}
                    disabled={b.es_baseline}
                    className="text-gray-400 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={b.es_baseline ? 'El baseline no puede modificarse' : 'Editar'}
                  >
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {benchmarks.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">Sin benchmarks registrados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <BenchmarkModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          saving={saving}
        />
      )}
    </div>
  );
}

// ─── Screen: Versiones ───────────────────────────────────────────────────────

function VersionesScreen({
  versions,
  onRefresh,
  toast,
}: {
  versions: AiVersion[];
  onRefresh: () => void;
  toast: ToastFn;
}) {
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSetProd = async (v: AiVersion) => {
    if (v.es_produccion) return;
    setTogglingId(v.id);
    try {
      // Clear current prod flag
      const { error: e1 } = await supabase
        .from('trade_ai_versions')
        .update({ es_produccion: false })
        .eq('es_produccion', true);
      if (e1) throw e1;
      // Set new prod
      const { error: e2 } = await supabase
        .from('trade_ai_versions')
        .update({ es_produccion: true, desplegado_at: new Date().toISOString() })
        .eq('id', v.id);
      if (e2) throw e2;
      toast('success', `${v.version_tag} marcada como producción`);
      onRefresh();
    } catch (e) {
      toast('error', 'Error: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setTogglingId(null);
    }
  };

  const sorted = [...versions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Versiones del motor IA</h2>
        <p className="text-sm text-gray-500 mt-0.5">Historial completo de versiones con resultados de benchmark</p>
      </div>

      <div className="space-y-2">
        {sorted.map(v => {
          const run = v.run;
          const isExpanded = expandedId === v.id;
          return (
            <div key={v.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${v.es_produccion ? 'border-blue-300' : v.es_baseline ? 'border-purple-200' : 'border-gray-200'}`}>
              {/* Header row */}
              <div className="flex items-center gap-3 px-5 py-3.5">
                {/* Semáforo dot */}
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${v.semaforo === 'verde' ? 'bg-green-500' : v.semaforo === 'rojo' ? 'bg-red-500' : v.semaforo === 'amarillo' ? 'bg-yellow-500' : 'bg-gray-300'}`} />

                {/* Version tag */}
                <span className="font-mono font-bold text-gray-900 text-base w-24 flex-shrink-0">{v.version_tag}</span>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {v.es_produccion && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">producción</span>}
                  {v.es_baseline   && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">baseline</span>}
                  {v.rolled_back_at && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">rollback</span>}
                </div>

                {/* KPIs inline */}
                {run && (
                  <div className="hidden sm:flex items-center gap-4 ml-2 text-sm text-gray-600">
                    <span className="font-semibold text-green-700">{run.ok_rate?.toFixed(1)}%</span>
                    <span className="text-gray-400">|</span>
                    <span>VAC <span className={run.queries_vacio > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>{run.queries_vacio}</span></span>
                    <span>TRUNC <span className={run.queries_truncado > 4 ? 'text-yellow-600 font-medium' : 'text-gray-500'}>{run.queries_truncado}</span></span>
                    {run.queries_precio_inv > 0 && (
                      <span className="text-red-600 text-xs">PINV+{run.queries_precio_inv}</span>
                    )}
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Date */}
                <span className="text-xs text-gray-400 hidden md:block">{fmtDate(v.desplegado_at ?? v.created_at)}</span>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {!v.es_produccion && !v.rolled_back_at && (
                    <button
                      onClick={() => handleSetProd(v)}
                      disabled={!!togglingId}
                      className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 disabled:opacity-50 font-medium"
                    >
                      {togglingId === v.id ? '…' : 'Marcar producción'}
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded"
                  >
                    {isExpanded ? <ChevronRight size={15} className="rotate-90 transition-transform" /> : <ChevronRight size={15} />}
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-3">
                  {v.notas && <p className="text-sm text-gray-600">{v.notas}</p>}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div><span className="text-gray-400">Modelo</span><br /><span className="font-mono text-gray-700">{v.model_id}</span></div>
                    {v.prompt_version && <div><span className="text-gray-400">Prompt</span><br /><span className="font-mono text-gray-700">{v.prompt_version}</span></div>}
                    {v.git_commit && <div><span className="text-gray-400">Commit</span><br /><span className="font-mono text-gray-700">{v.git_commit}</span></div>}
                    {v.git_tag    && <div><span className="text-gray-400">Git tag</span><br /><span className="font-mono text-gray-700">{v.git_tag}</span></div>}
                  </div>
                  {run && (
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-1">
                      {[
                        { l: 'OK%',    v: `${run.ok_rate?.toFixed(1)}%`  },
                        { l: 'Coinc%', v: `${run.coin_rate?.toFixed(1)}%` },
                        { l: 'VACIO',  v: run.queries_vacio   },
                        { l: 'TRUNC',  v: run.queries_truncado },
                        { l: 'P.INV',  v: run.queries_precio_inv },
                        { l: 'Lat.med',v: run.lat_mean_ms ? `${(run.lat_mean_ms/1000).toFixed(1)}s` : '—' },
                        { l: 'Lat.P95',v: run.lat_p95_ms  ? `${(run.lat_p95_ms /1000).toFixed(1)}s` : '—' },
                        { l: 'Tok.med',v: run.tok_mean ?? '—' },
                      ].map(kpi => (
                        <div key={kpi.l} className="bg-white rounded-lg p-2 text-center border border-gray-100">
                          <div className="font-semibold text-gray-800 text-sm">{kpi.v}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{kpi.l}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">
            Sin versiones registradas
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screen: Ejecuciones ─────────────────────────────────────────────────────

function EjecucionesScreen({ runs }: { runs: BenchmarkRun[] }) {
  const sorted = [...runs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">Ejecuciones de benchmark</h2>
        <p className="text-sm text-gray-500 mt-0.5">{sorted.length} ejecuciones registradas</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Versión / Descripción</th>
                <th className="text-center px-3 py-3">Estado</th>
                <th className="text-right px-3 py-3">Total</th>
                <th className="text-right px-3 py-3">OK</th>
                <th className="text-right px-3 py-3">OK%</th>
                <th className="text-right px-3 py-3">VACIO</th>
                <th className="text-right px-3 py-3">TRUNC</th>
                <th className="text-right px-3 py-3">PINV</th>
                <th className="text-right px-3 py-3">Lat.med</th>
                <th className="text-right px-3 py-3">Coinc%</th>
                <th className="text-right px-3 py-3">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}`}>
                  <td className="px-5 py-3">
                    <div className="font-mono font-semibold text-gray-800">{r.version_tag}</div>
                    {r.descripcion && <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{r.descripcion}</div>}
                  </td>
                  <td className="px-3 py-3 text-center"><SemaforoBadge val={r.semaforo} /></td>
                  <td className="px-3 py-3 text-right text-gray-600 tabular-nums">{r.total_queries}</td>
                  <td className="px-3 py-3 text-right text-green-700 font-medium tabular-nums">{r.queries_ok}</td>
                  <td className="px-3 py-3 text-right font-semibold text-gray-800 tabular-nums">{r.ok_rate?.toFixed(1) ?? '—'}%</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-medium ${r.queries_vacio > 0 ? 'text-red-600' : 'text-gray-500'}`}>{r.queries_vacio}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-medium ${r.queries_truncado > 4 ? 'text-yellow-600' : 'text-gray-500'}`}>{r.queries_truncado}</td>
                  <td className={`px-3 py-3 text-right tabular-nums font-medium ${r.queries_precio_inv > 0 ? 'text-red-600' : 'text-gray-500'}`}>{r.queries_precio_inv}</td>
                  <td className="px-3 py-3 text-right text-gray-500 tabular-nums">
                    {r.lat_mean_ms ? `${(r.lat_mean_ms / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-3 py-3 text-right text-gray-600 tabular-nums">
                    {r.coin_rate?.toFixed(1) ?? '—'}%
                  </td>
                  <td className="px-3 py-3 text-right text-gray-400 text-xs whitespace-nowrap">
                    {fmtDate(r.completado_at ?? r.created_at)}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-gray-400">Sin ejecuciones</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Root component ──────────────────────────────────────────────────────────

export default function AdminAIValidationSection({ toast }: Props) {
  const [screen, setScreen]       = useState<SubScreen>('dashboard');
  const [loading, setLoading]     = useState(true);
  const [versions, setVersions]   = useState<AiVersion[]>([]);
  const [runs, setRuns]           = useState<BenchmarkRun[]>([]);
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, rRes, vRes] = await Promise.all([
        supabase.from('trade_benchmarks').select('*').order('created_at'),
        supabase.from('trade_benchmark_runs').select('*').order('created_at'),
        supabase.from('trade_ai_versions').select('*').order('created_at'),
      ]);
      if (bRes.error) throw bRes.error;
      if (rRes.error) throw rRes.error;
      if (vRes.error) throw vRes.error;

      const runsMap = new Map<string, BenchmarkRun>((rRes.data as BenchmarkRun[]).map(r => [r.id, r]));

      const versionsWithRuns: AiVersion[] = (vRes.data as AiVersion[]).map(v => ({
        ...v,
        run: v.benchmark_run_id ? runsMap.get(v.benchmark_run_id) : undefined,
      }));

      setBenchmarks(bRes.data as Benchmark[]);
      setRuns(rRes.data as BenchmarkRun[]);
      setVersions(versionsWithRuns);
    } catch (e) {
      toast('error', 'Error cargando datos: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const SUB_NAV: { id: SubScreen; label: string; Icon: ElementType }[] = [
    { id: 'dashboard',   label: 'Dashboard',    Icon: BarChart2 },
    { id: 'benchmarks',  label: 'Benchmarks',   Icon: Layers    },
    { id: 'versiones',   label: 'Versiones',    Icon: GitBranch },
    { id: 'ejecuciones', label: 'Ejecuciones',  Icon: Activity  },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <Brain size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-gray-900">AI Validation Center</h1>
            <p className="text-xs text-gray-400">Control y validación del motor IA de presupuestos</p>
          </div>
        </div>
        <button
          onClick={loadData}
          className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Recargar"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 px-6 py-2 bg-gray-50 border-b border-gray-100">
        {SUB_NAV.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setScreen(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              screen === id
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                : 'text-gray-500 hover:text-gray-700 hover:bg-white/60'
            }`}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5">
        {loading ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <RefreshCw size={20} className="animate-spin mr-2" />
            Cargando datos…
          </div>
        ) : (
          <>
            {screen === 'dashboard'   && <DashboardScreen   versions={versions} runs={runs} />}
            {screen === 'benchmarks'  && <BenchmarksScreen  benchmarks={benchmarks} onRefresh={loadData} toast={toast} />}
            {screen === 'versiones'   && <VersionesScreen   versions={versions} onRefresh={loadData} toast={toast} />}
            {screen === 'ejecuciones' && <EjecucionesScreen runs={runs} />}
          </>
        )}
      </div>
    </div>
  );
}
