import React, { useEffect, useState } from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';
import {
  SupplierConfig, getSupplierConfig, upsertSupplierConfig,
  getSupplierHealthScore, SupplierHealthScore,
} from '../../lib/api/marketplace-portal';

interface Props {
  actorId:    string;
  membership: MarketplaceMyMembership;
}

export default function PortalConfiguracion({ actorId, membership }: Props) {
  const [config,  setConfig]  = useState<SupplierConfig | null>(null);
  const [health,  setHealth]  = useState<SupplierHealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const canEdit = membership.permissions.includes('actor:settings');

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getSupplierConfig(actorId),
      getSupplierHealthScore(actorId),
    ]).then(([cfg, hs]) => {
      setConfig(cfg ?? createDefaultConfig(actorId));
      setHealth(hs);
    }).catch((e) => {
      setError(e.message ?? 'Error al cargar configuración');
    }).finally(() => setLoading(false));
  }, [actorId]);

  const handleSave = async () => {
    if (!config || !canEdit || saving) return;
    setSaving(true);
    setError(null);
    try {
      await upsertSupplierConfig(actorId, {
        permite_recogida:       config.permite_recogida,
        permite_entrega:        config.permite_entrega,
        radio_entrega_km:       config.radio_entrega_km,
        pedido_minimo:          config.pedido_minimo,
        portes_gratis_desde:    config.portes_gratis_desde,
        coste_portes:           config.coste_portes,
        permite_urgencias:      config.permite_urgencias,
        coste_urgencia:         config.coste_urgencia,
        plazo_confirmacion_h:   config.plazo_confirmacion_h,
        plazo_preparacion_dias: config.plazo_preparacion_dias,
        plazo_entrega_dias:     config.plazo_entrega_dias,
        mensaje_instaladores:   config.mensaje_instaladores,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof SupplierConfig>(key: K, value: SupplierConfig[K]) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />)}
      </div>
    );
  }

  return (
    <div className="min-h-full p-6 space-y-6 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Configuración</h1>
          <p className="text-sm text-slate-500 mt-0.5">{membership.actor_nombre}</p>
        </div>
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-teal-600 text-white hover:bg-teal-500'
            } disabled:opacity-50`}
          >
            {saved ? (
              <>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Guardado
              </>
            ) : saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 px-4 py-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Health Score */}
      {health && (
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Supplier Health Score</h2>
              <p className="text-xs text-slate-400 mt-0.5">Puntuación calculada automáticamente cada 24h</p>
            </div>
            <div className="text-right">
              <p className={`text-3xl font-black tabular-nums ${
                health.score >= 75 ? 'text-emerald-500'
                : health.score >= 50 ? 'text-amber-500'
                : 'text-red-500'
              }`}>{health.score}</p>
              <p className="text-xs text-slate-400">/ 100</p>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden mb-5">
            <div
              className={`h-full rounded-full transition-all ${
                health.score >= 75 ? 'bg-emerald-500'
                : health.score >= 50 ? 'bg-amber-500'
                : 'bg-red-500'
              }`}
              style={{ width: `${health.score}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Cobertura catálogo', pts: health.cobertura_pts, max: 30, pct: health.cobertura_pct },
              { label: 'Stock disponible',   pts: health.stock_pts,     max: 20, pct: health.stock_pct },
              { label: 'Tiempo respuesta',   pts: health.respuesta_pts, max: 25, pct: health.avg_confirm_h != null ? null : null },
              { label: 'Tasa completado',    pts: health.completado_pts, max: 25, pct: health.completion_rate },
            ].map((dim) => (
              <div key={dim.label} className="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
                <p className="text-xs text-slate-400 mb-1.5 leading-tight">{dim.label}</p>
                <div className="flex items-end gap-1">
                  <span className="text-xl font-bold tabular-nums text-slate-800 dark:text-slate-200">
                    {dim.pts}
                  </span>
                  <span className="text-xs text-slate-400 mb-0.5">/{dim.max}</span>
                </div>
                <div className="w-full h-1 rounded-full bg-slate-100 dark:bg-slate-700 mt-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500"
                    style={{ width: `${(dim.pts / dim.max) * 100}%` }}
                  />
                </div>
                {dim.pct != null && (
                  <p className="text-xs text-slate-400 mt-1">{dim.pct}%</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {config && (
        <>
          {/* Información de la cuenta */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">Información de la cuenta</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">Nombre</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">{membership.actor_nombre}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Estado</p>
                <p className="text-sm capitalize text-slate-800 dark:text-slate-200">{membership.actor_estado}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Verificado</p>
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  {membership.actor_verificado ? '✓ Verificado' : 'Pendiente de verificación'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Tu rol</p>
                <p className="text-sm capitalize text-slate-800 dark:text-slate-200">{membership.role_nombre}</p>
              </div>
            </div>
            {!membership.actor_verificado && (
              <div className="mt-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10 px-4 py-3">
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Tu cuenta está pendiente de verificación por el equipo de TrabFlow. Una vez verificada, tus productos aparecerán en los resultados de búsqueda.
                </p>
              </div>
            )}
          </section>

          {/* Configuración Marketplace */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Marketplace</h2>
            <p className="text-xs text-slate-400 mb-4">Opciones de logística y condiciones para los instaladores.</p>

            <div className="space-y-5">
              {/* Modalidades */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Modalidades de entrega</p>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.permite_entrega}
                      onChange={(e) => set('permite_entrega', e.target.checked)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Servicio de entrega</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.permite_recogida}
                      onChange={(e) => set('permite_recogida', e.target.checked)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Recogida en almacén</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.permite_urgencias}
                      onChange={(e) => set('permite_urgencias', e.target.checked)}
                      disabled={!canEdit}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Entregas urgentes</span>
                  </label>
                </div>
              </div>

              {/* Condiciones numéricas */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <FieldNum
                  label="Radio entrega (km)"
                  value={config.radio_entrega_km}
                  disabled={!canEdit || !config.permite_entrega}
                  onChange={(v) => set('radio_entrega_km', v)}
                />
                <FieldNum
                  label="Pedido mínimo (€)"
                  value={config.pedido_minimo}
                  disabled={!canEdit}
                  onChange={(v) => set('pedido_minimo', v)}
                />
                <FieldNum
                  label="Coste de portes (€)"
                  value={config.coste_portes}
                  disabled={!canEdit || !config.permite_entrega}
                  onChange={(v) => set('coste_portes', v)}
                />
                <FieldNum
                  label="Portes gratis desde (€)"
                  value={config.portes_gratis_desde}
                  disabled={!canEdit || !config.permite_entrega}
                  onChange={(v) => set('portes_gratis_desde', v)}
                />
                {config.permite_urgencias && (
                  <FieldNum
                    label="Coste urgencia (€)"
                    value={config.coste_urgencia}
                    disabled={!canEdit}
                    onChange={(v) => set('coste_urgencia', v)}
                  />
                )}
              </div>

              {/* Plazos operativos */}
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Plazos operativos</p>
                <div className="grid grid-cols-3 gap-4">
                  <FieldNum
                    label="Confirmación (h)"
                    value={config.plazo_confirmacion_h}
                    disabled={!canEdit}
                    onChange={(v) => set('plazo_confirmacion_h', v ?? 24)}
                  />
                  <FieldNum
                    label="Preparación (días)"
                    value={config.plazo_preparacion_dias}
                    disabled={!canEdit}
                    onChange={(v) => set('plazo_preparacion_dias', v ?? 2)}
                  />
                  <FieldNum
                    label="Entrega (días)"
                    value={config.plazo_entrega_dias}
                    disabled={!canEdit}
                    onChange={(v) => set('plazo_entrega_dias', v ?? 5)}
                  />
                </div>
              </div>

              {/* Mensaje para instaladores */}
              <div>
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                  Mensaje para instaladores (opcional)
                </label>
                <textarea
                  value={config.mensaje_instaladores ?? ''}
                  onChange={(e) => set('mensaje_instaladores', e.target.value || null)}
                  disabled={!canEdit}
                  rows={3}
                  placeholder="Condiciones especiales, horario de almacén, zonas de entrega..."
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none disabled:opacity-50"
                />
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

interface FieldNumProps {
  label:    string;
  value:    number | null | undefined;
  disabled: boolean;
  onChange: (v: number | null) => void;
}

function FieldNum({ label, value, disabled, onChange }: FieldNumProps) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-40"
      />
    </div>
  );
}

function createDefaultConfig(actorId: string): SupplierConfig {
  return {
    id:                     '',
    actor_id:               actorId,
    permite_recogida:       false,
    permite_entrega:        true,
    radio_entrega_km:       null,
    pedido_minimo:          null,
    portes_gratis_desde:    null,
    coste_portes:           null,
    permite_urgencias:      false,
    coste_urgencia:         null,
    horario_recogida:       null,
    horario_entrega:        null,
    plazo_confirmacion_h:   24,
    plazo_preparacion_dias: 2,
    plazo_entrega_dias:     5,
    mensaje_instaladores:   null,
    created_at:             '',
    updated_at:             '',
  };
}
