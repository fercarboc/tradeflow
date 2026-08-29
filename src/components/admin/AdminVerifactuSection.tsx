import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2,
  Clock, Lock, Globe, Server, RefreshCw, FileText,
} from 'lucide-react';

interface SystemConfig {
  enabled: boolean;
  transmission_enabled: boolean;
  environment: string;
  sistema_nombre: string;
  sistema_id: string;
  sistema_version: string;
  producer_nombre_razon: string;
  producer_nif: string | null;
  installation_number: string | null;
  multiple_ot_indicator: string | null;
  collaboration_agreement_status: string;
  certificate_status: string;
  soap_endpoint: string;
  retry_max_attempts: number;
  retry_backoff_seconds: number;
  notes: string | null;
  updated_at: string;
}

interface OutboxStats {
  pending: number;
  retry_pending: number;
  accepted: number;
  rejected: number;
  failed_permanent: number;
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
      ok
        ? 'bg-emerald-900/40 text-emerald-300 border-emerald-800'
        : 'bg-red-900/40 text-red-300 border-red-800'
    }`}>
      {ok ? <CheckCircle2 size={10} /> : <ShieldOff size={10} />}
      {label}
    </span>
  );
}

function PendingBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-yellow-900/40 text-yellow-300 border-yellow-800">
      <Clock size={10} />
      {label}
    </span>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        {badge}
        <span className="text-[11px] text-slate-200 font-mono">{value}</span>
      </div>
    </div>
  );
}

export default function AdminVerifactuSection() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [outboxStats, setOutboxStats] = useState<OutboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // RPC admin: bypasea RLS (SECURITY DEFINER). La tabla directa
      // devuelve 0 rows para tenants normales (sin policy SELECT).
      const { data: cfg, error: cfgErr } = await supabase
        .rpc('admin_get_verifactu_system_config');

      if (cfgErr) throw new Error(cfgErr.message);
      if (!cfg) throw new Error('Configuración no encontrada');
      setConfig(cfg as SystemConfig);

      const { data: outbox, error: outboxErr } = await supabase
        .from('trade_verifactu_outbox')
        .select('status');

      if (!outboxErr && outbox) {
        const stats: OutboxStats = {
          pending: 0, retry_pending: 0, accepted: 0,
          rejected: 0, failed_permanent: 0,
        };
        for (const row of outbox) {
          const s = row.status as keyof OutboxStats;
          if (s in stats) stats[s]++;
        }
        setOutboxStats(stats);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500 text-sm gap-2">
        <RefreshCw size={16} className="animate-spin" />
        Cargando configuración VeriFactu…
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 rounded-xl text-red-300 text-sm">
        <AlertTriangle size={16} className="inline mr-2" />
        {error ?? 'No se pudo cargar la configuración'}
      </div>
    );
  }

  const allKillSwitchPass =
    config.enabled &&
    config.transmission_enabled &&
    config.environment === 'production' &&
    !!config.producer_nif &&
    !!config.installation_number &&
    config.certificate_status === 'active' &&
    config.collaboration_agreement_status === 'active';

  const pendingRequirements = [
    !config.producer_nif            && 'NIF/CIF TrabFlow Technologies, S.L.',
    !config.installation_number     && 'NumeroInstalacion (pendiente AEAT)',
    !config.multiple_ot_indicator   && 'IndicadorMultiplesOT (pendiente AEAT)',
    config.collaboration_agreement_status !== 'active' && 'Acuerdo Tipo 17 (comunicacion.sepri@correo.aeat.es)',
    config.certificate_status !== 'active'             && 'Sello Electrónico Cualificado (FNMT)',
    !config.transmission_enabled    && 'transmission_enabled = true',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">VERI*FACTU — Infraestructura</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            RD 1007/2023 · Orden HAC/1177/2024 · VF-1 (configuración, no transmisión)
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-700 rounded-lg hover:border-slate-600"
        >
          <RefreshCw size={12} />
          Recargar
        </button>
      </div>

      {/* Kill switch global */}
      <div className={`rounded-xl border p-5 ${
        allKillSwitchPass
          ? 'bg-emerald-900/20 border-emerald-800'
          : 'bg-red-900/20 border-red-800'
      }`}>
        <div className="flex items-center gap-3 mb-3">
          {allKillSwitchPass
            ? <ShieldCheck size={20} className="text-emerald-400" />
            : <ShieldOff size={20} className="text-red-400" />
          }
          <div>
            <p className="text-sm font-bold text-white">
              {allKillSwitchPass ? 'Transmisión ACTIVA' : 'Kill switch — Transmisión DESACTIVADA'}
            </p>
            <p className="text-[11px] text-slate-400">
              {allKillSwitchPass
                ? 'Todos los requisitos cumplidos. El worker envía a la AEAT.'
                : 'Ningún registro se envía a la AEAT hasta que todos los requisitos estén activos.'}
            </p>
          </div>
        </div>
        {pendingRequirements.length > 0 && (
          <div className="mt-3 pt-3 border-t border-red-800/50">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Requisitos pendientes
            </p>
            <ul className="space-y-1">
              {pendingRequirements.map((req) => (
                <li key={req} className="flex items-center gap-2 text-[11px] text-yellow-300">
                  <Clock size={10} className="flex-shrink-0" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Configuración SIF */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Server size={14} className="text-blue-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Sistema Informático (SIF)
            </h3>
          </div>
          <div>
            <Row label="NombreSistemaInformatico" value={config.sistema_nombre} />
            <Row label="IdSistemaInformatico" value={config.sistema_id} />
            <Row label="Version" value={config.sistema_version} />
            <Row
              label="NumeroInstalacion"
              value={config.installation_number ?? '—'}
              badge={!config.installation_number ? <PendingBadge label="Pendiente AEAT" /> : undefined}
            />
            <Row
              label="IndicadorMultiplesOT"
              value={config.multiple_ot_indicator ?? '—'}
              badge={!config.multiple_ot_indicator ? <PendingBadge label="Pendiente AEAT" /> : undefined}
            />
          </div>
        </div>

        {/* Configuración productor */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={14} className="text-purple-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Productor TrabFlow
            </h3>
          </div>
          <div>
            <Row label="NombreRazon" value={config.producer_nombre_razon} />
            <Row
              label="NIF"
              value={config.producer_nif || '—'}
              badge={!config.producer_nif ? <PendingBadge label="Pendiente" /> : undefined}
            />
          </div>
          <div className="mt-4 border-t border-slate-700 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={14} className="text-orange-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Requisitos legales
              </h3>
            </div>
            <div>
              <Row
                label="Acuerdo Tipo 17"
                value={config.collaboration_agreement_status}
                badge={<StatusBadge ok={config.collaboration_agreement_status === 'active'} label={config.collaboration_agreement_status} />}
              />
              <Row
                label="Certificado electrónico"
                value={config.certificate_status}
                badge={<StatusBadge ok={config.certificate_status === 'active'} label={config.certificate_status} />}
              />
            </div>
          </div>
        </div>

        {/* Estado de transmisión */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-emerald-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Transmisión AEAT
            </h3>
          </div>
          <div>
            <Row
              label="enabled"
              value={String(config.enabled)}
              badge={<StatusBadge ok={config.enabled} label={config.enabled ? 'ON' : 'OFF'} />}
            />
            <Row
              label="transmission_enabled"
              value={String(config.transmission_enabled)}
              badge={<StatusBadge ok={config.transmission_enabled} label={config.transmission_enabled ? 'ON' : 'OFF'} />}
            />
            <Row
              label="environment"
              value={config.environment}
              badge={<StatusBadge ok={config.environment === 'production'} label={config.environment} />}
            />
            <Row label="SOAP endpoint" value={config.soap_endpoint || '—'} />
            <Row label="Reintentos máx." value={String(config.retry_max_attempts)} />
            <Row label="Backoff (seg)" value={String(config.retry_backoff_seconds)} />
          </div>
        </div>

        {/* Outbox stats */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-slate-400" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Outbox (trade_verifactu_outbox)
            </h3>
          </div>
          {outboxStats ? (
            <div>
              <Row
                label="Pendientes"
                value={String(outboxStats.pending)}
                badge={outboxStats.pending > 0 ? <PendingBadge label="Cola" /> : undefined}
              />
              <Row label="Reintentando" value={String(outboxStats.retry_pending)} />
              <Row label="Aceptados" value={String(outboxStats.accepted)} />
              <Row label="Rechazados" value={String(outboxStats.rejected)} />
              <Row label="Fallidos perm." value={String(outboxStats.failed_permanent)} />
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 py-2">Sin datos de outbox</p>
          )}
          <p className="text-[10px] text-slate-600 mt-3 italic">
            En VF-1 los registros pendientes no se transmiten (kill switch activo).
          </p>
        </div>
      </div>

      {/* Nota informativa */}
      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4">
        <p className="text-[11px] text-slate-500 leading-relaxed">
          <span className="font-bold text-slate-400">VF-1 — Solo infraestructura.</span>{' '}
          Las tablas, el outbox y el worker están activos, pero{' '}
          <span className="font-bold text-yellow-400">transmission_enabled = false</span> hasta completar los requisitos legales.
          La modificación de la configuración requiere acceso service_role (no disponible desde esta UI).
          Actualización estimada: VF-2 (tras NIF + Acuerdo Tipo 17 + Certificado FNMT).
        </p>
      </div>
    </div>
  );
}
