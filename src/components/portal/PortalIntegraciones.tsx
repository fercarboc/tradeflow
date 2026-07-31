import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ApiCredential,
  ApiCredentialCreated,
  ApiSyncLogEntry,
  getApiCredentials,
  createApiCredential,
  revokeApiCredential,
  rotateApiCredential,
  getApiSyncLog,
} from '../../lib/api/marketplace-portal';

// ── Tipos ──────────────────────────────────────────────────────────────────────

type Section = 'credentials' | 'logs';

const ALL_SCOPES = [
  { id: 'catalog:write',  label: 'Catálogo: escritura',  desc: 'Upsert de productos' },
  { id: 'catalog:read',   label: 'Catálogo: lectura',    desc: 'Listado de productos' },
  { id: 'stock:write',    label: 'Stock: actualización', desc: 'Actualizar disponibilidad' },
  { id: 'prices:write',   label: 'Precios: actualización', desc: 'Actualizar precios' },
  { id: 'imports:read',   label: 'Imports: lectura',     desc: 'Consultar estado de sync' },
];

const EXPIRY_OPTIONS = [
  { label: '30 días',   days: 30 },
  { label: '90 días',   days: 90 },
  { label: '6 meses',   days: 180 },
  { label: '1 año',     days: 365 },
  { label: '2 años',    days: 730 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
    + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function durationMs(from: string | null, to: string | null): string {
  if (!from || !to) return '—';
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function isExpired(iso: string): boolean {
  return new Date(iso) < new Date();
}

function isExpiringSoon(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d > now && d < new Date(now.getTime() + 30 * 24 * 3600 * 1000);
}

function credStatus(c: ApiCredential): { label: string; color: string } {
  if (!c.activa && !c.grace_until)  return { label: 'Revocada', color: 'bg-red-100 text-red-700' };
  if (c.grace_until)                 return { label: 'En rotación', color: 'bg-amber-100 text-amber-700' };
  if (isExpired(c.expires_at))      return { label: 'Expirada', color: 'bg-red-100 text-red-700' };
  if (isExpiringSoon(c.expires_at)) return { label: 'Expira pronto', color: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Activa', color: 'bg-emerald-100 text-emerald-700' };
}

function syncStatusChip(status: string) {
  const map: Record<string, string> = {
    completed:  'bg-emerald-100 text-emerald-700',
    failed:     'bg-red-100 text-red-700',
    processing: 'bg-blue-100 text-blue-700',
    duplicate:  'bg-slate-100 text-slate-600',
  };
  const labels: Record<string, string> = {
    completed: 'Completado', failed: 'Error', processing: 'Procesando', duplicate: 'Duplicado',
  };
  return { cls: map[status] ?? 'bg-slate-100 text-slate-600', label: labels[status] ?? status };
}

function endpointLabel(ep: string): string {
  const m: Record<string, string> = {
    'catalog/upsert':   'Catálogo upsert',
    'stock/update':     'Stock',
    'prices/update':    'Precios',
    'catalog/products': 'Listado catálogo',
    'imports/status':   'Estado import',
  };
  return m[ep] ?? ep;
}

// ── Subcomponentes de nivel módulo ────────────────────────────────────────────

function SectionTab({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
        active
          ? 'bg-white text-slate-900 shadow-sm'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      {label}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function ErrorBanner({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
      <svg className="w-5 h-5 flex-none" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd"/>
      </svg>
      <span className="flex-1">{msg}</span>
      <button onClick={onRetry} className="underline hover:no-underline">Reintentar</button>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd"/>
          </svg>
          Copiado
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/>
            <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/>
          </svg>
          Copiar
        </>
      )}
    </button>
  );
}

// ── Modal: secreto mostrado una vez ───────────────────────────────────────────

function SecretModal({
  result,
  onClose,
}: {
  result: ApiCredentialCreated;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-none">
              <svg className="w-5 h-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Guarda tu API Key ahora</h3>
              <p className="text-sm text-slate-500 mt-0.5">Este secreto no se puede recuperar. Cópialo y guárdalo en un lugar seguro.</p>
            </div>
          </div>

          <div className="bg-slate-900 rounded-xl p-4 mb-4">
            <p className="text-xs text-slate-400 mb-1.5">API Key</p>
            <p className="font-mono text-sm text-emerald-400 break-all leading-relaxed">{result.raw_key}</p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            <CopyButton text={result.raw_key} />
            <span className="text-xs text-slate-500">Prefijo: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">tsf_v1_{result.key_prefix}...</code></span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors text-sm"
          >
            He guardado la API Key, cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: crear credencial ───────────────────────────────────────────────────

function CreateCredentialModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (nombre: string, scopes: string[], expiresAt: Date) => Promise<void>;
}) {
  const [nombre, setNombre]   = useState('');
  const [scopes, setScopes]   = useState<string[]>(['catalog:write', 'catalog:read', 'stock:write', 'prices:write']);
  const [expDays, setExpDays] = useState(365);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const toggleScope = (id: string) => {
    setScopes(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    if (scopes.length === 0) { setError('Selecciona al menos un scope.'); return; }
    setLoading(true); setError(null);
    const expiresAt = new Date(Date.now() + expDays * 24 * 3600 * 1000);
    try {
      await onCreate(nombre.trim(), scopes, expiresAt);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-slate-900">Nueva credencial API</h3>
              <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombre</label>
                <input
                  autoFocus
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: ERP producción, Integración Holded..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Permisos (scopes)</label>
                <div className="space-y-2">
                  {ALL_SCOPES.map(s => (
                    <label key={s.id} className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={scopes.includes(s.id)}
                        onChange={() => toggleScope(s.id)}
                        className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>
                        <span className="text-sm text-slate-800">{s.label}</span>
                        <span className="block text-xs text-slate-400">{s.desc}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Caducidad</label>
                <select
                  value={expDays}
                  onChange={e => setExpDays(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {EXPIRY_OPTIONS.map(o => (
                    <option key={o.days} value={o.days}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 rounded-xl transition-colors"
            >
              {loading ? 'Creando...' : 'Crear credencial'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: confirmar acción destructiva ───────────────────────────────────────

function ConfirmModal({
  title,
  description,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const handle = async () => {
    setLoading(true); setError(null);
    try { await onConfirm(); }
    catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-500 mb-5">{description}</p>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
            Cancelar
          </button>
          <button
            onClick={handle}
            disabled={loading}
            className={`flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sección credenciales ──────────────────────────────────────────────────────

function CredentialsSection({
  actorId,
  apiBaseUrl,
}: {
  actorId: string;
  apiBaseUrl: string;
}) {
  const [creds, setCreds]         = useState<ApiCredential[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [secretResult, setSecretResult] = useState<ApiCredentialCreated | null>(null);
  const [confirm, setConfirm]     = useState<null | {
    type: 'revoke' | 'rotate';
    credId: string;
    nombre: string;
  }>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setCreds(await getApiCredentials(actorId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error cargando credenciales');
    } finally {
      setLoading(false);
    }
  }, [actorId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (nombre: string, scopes: string[], expiresAt: Date) => {
    const result = await createApiCredential(actorId, nombre, scopes, expiresAt);
    setShowCreate(false);
    setSecretResult(result);
    await load();
  };

  const handleRevoke = async () => {
    if (!confirm || confirm.type !== 'revoke') return;
    await revokeApiCredential(confirm.credId, actorId);
    setConfirm(null);
    await load();
  };

  const handleRotate = async () => {
    if (!confirm || confirm.type !== 'rotate') return;
    const result = await rotateApiCredential(confirm.credId, actorId);
    setConfirm(null);
    setSecretResult(result);
    await load();
  };

  const activeCreds   = creds.filter(c => c.activa && !c.revoked_at);
  const inactiveCreds = creds.filter(c => !c.activa || c.revoked_at);

  return (
    <div>
      {/* Info box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6 flex gap-3">
        <svg className="w-5 h-5 text-indigo-600 flex-none mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd"/>
        </svg>
        <div className="text-sm text-indigo-800">
          <p className="font-medium mb-0.5">URL base de la API</p>
          <code className="font-mono text-xs bg-indigo-100 px-1.5 py-0.5 rounded break-all">{apiBaseUrl}</code>
          <p className="mt-1.5 text-indigo-700">Autenticación: <code className="font-mono">Authorization: Bearer tsf_v1_...</code></p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Credenciales activas
          {activeCreds.length > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-500">({activeCreds.length})</span>
          )}
        </h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z"/>
          </svg>
          Nueva credencial
        </button>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorBanner msg={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {activeCreds.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <svg className="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"/>
              </svg>
              <p className="text-sm">Sin credenciales activas</p>
              <p className="text-xs mt-1">Crea una para empezar a usar la API</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeCreds.map(cred => {
                const st = credStatus(cred);
                return (
                  <div key={cred.id} className="border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors bg-white">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-slate-900 text-sm">{cred.nombre}</span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                          {cred.grace_until && (
                            <span className="text-xs text-amber-600">Válida hasta {fmtDate(cred.grace_until)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mb-2.5">
                          <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">tsf_v1_{cred.key_prefix}...</code>
                          <span>Expira {fmtDate(cred.expires_at)}</span>
                          {cred.last_used_at && <span>Último uso {fmtDateTime(cred.last_used_at)}</span>}
                          {cred.last_ip && <span>desde {cred.last_ip}</span>}
                        </div>
                        <div className="flex gap-1.5 flex-wrap">
                          {cred.scopes.map(s => (
                            <span key={s} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">{s}</span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-none">
                        <button
                          onClick={() => setConfirm({ type: 'rotate', credId: cred.id, nombre: cred.nombre })}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Rotar (genera nueva key con gracia de 24h)"
                        >
                          Rotar
                        </button>
                        <button
                          onClick={() => setConfirm({ type: 'revoke', credId: cred.id, nombre: cred.nombre })}
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                          title="Revocar inmediatamente"
                        >
                          Revocar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {inactiveCreds.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-slate-500 mb-3">Historial de credenciales revocadas / expiradas</h3>
              <div className="space-y-2">
                {inactiveCreds.map(cred => {
                  const st = credStatus(cred);
                  return (
                    <div key={cred.id} className="border border-slate-100 rounded-xl px-4 py-3 bg-slate-50 flex items-center gap-3">
                      <span className="flex-1 text-sm text-slate-500">{cred.nombre}</span>
                      <code className="font-mono text-xs text-slate-400">tsf_v1_{cred.key_prefix}...</code>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-slate-400">{fmtDate(cred.revoked_at ?? cred.expires_at)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreateCredentialModal onClose={() => setShowCreate(false)} onCreate={handleCreate} />
      )}

      {secretResult && (
        <SecretModal
          result={secretResult}
          onClose={() => { setSecretResult(null); }}
        />
      )}

      {confirm && confirm.type === 'revoke' && (
        <ConfirmModal
          title="Revocar credencial"
          description={`¿Revocar "${confirm.nombre}"? Cualquier sistema que la use dejará de funcionar inmediatamente.`}
          confirmLabel="Sí, revocar"
          danger
          onConfirm={handleRevoke}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm && confirm.type === 'rotate' && (
        <ConfirmModal
          title="Rotar credencial"
          description={`Se generará una nueva key para "${confirm.nombre}". La actual seguirá válida 24h para que puedas actualizar tus sistemas.`}
          confirmLabel="Rotar"
          onConfirm={handleRotate}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

// ── Sección logs de sincronización ────────────────────────────────────────────

function SyncLogsSection({ actorId }: { actorId: string }) {
  const [logs, setLogs]       = useState<ApiSyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [filter, setFilter]   = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setLogs(await getApiSyncLog(actorId, 100)); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); }
    finally { setLoading(false); }
  }, [actorId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          Historial de sincronizaciones
          {!loading && <span className="ml-2 text-sm font-normal text-slate-500">({visible.length})</span>}
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="text-sm px-3 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">Todos</option>
            <option value="completed">Completado</option>
            <option value="failed">Error</option>
            <option value="processing">Procesando</option>
            <option value="duplicate">Duplicado</option>
          </select>
          <button onClick={load} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors" title="Actualizar">
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0V5.36l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389A5.5 5.5 0 0113.89 6.11l.311.31h-2.432a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.219z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

      {loading && <Spinner />}
      {!loading && error && <ErrorBanner msg={error} onRetry={load} />}

      {!loading && !error && (
        <>
          {visible.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <p className="text-sm">Sin registros de sincronización</p>
              {filter !== 'all' && <p className="text-xs mt-1">Prueba cambiando el filtro</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-medium text-slate-500 border-b border-slate-200">
                    <th className="text-left py-2 pr-4">Endpoint</th>
                    <th className="text-left py-2 pr-4">Estado</th>
                    <th className="text-right py-2 pr-4">Filas</th>
                    <th className="text-left py-2 pr-4">Duración</th>
                    <th className="text-left py-2 pr-4">Credencial</th>
                    <th className="text-left py-2 pr-4">IP</th>
                    <th className="text-left py-2">Inicio</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map(log => {
                    const chip = syncStatusChip(log.status);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50 group">
                        <td className="py-2.5 pr-4 font-medium text-slate-700 whitespace-nowrap">
                          {endpointLabel(log.endpoint)}
                          {log.source_system && (
                            <span className="ml-1.5 text-xs text-slate-400">({log.source_system})</span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 whitespace-nowrap">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${chip.cls}`}>
                            {chip.label}
                          </span>
                          {log.status === 'failed' && log.error_detail && (
                            <span className="ml-2 text-xs text-red-600 truncate max-w-[120px] inline-block align-middle" title={log.error_detail}>
                              {log.error_detail.slice(0, 40)}…
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                          {log.rows_received != null ? (
                            <span>
                              <span className="text-emerald-600">+{log.rows_inserted ?? 0}</span>
                              {' / '}
                              <span className="text-blue-600">↑{log.rows_updated ?? 0}</span>
                              {(log.rows_rejected ?? 0) > 0 && (
                                <span className="text-red-500"> ✕{log.rows_rejected}</span>
                              )}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-500 whitespace-nowrap">
                          {durationMs(log.started_at, log.finished_at)}
                        </td>
                        <td className="py-2.5 pr-4 text-xs whitespace-nowrap">
                          <code className="font-mono text-slate-500 bg-slate-100 px-1 rounded">
                            {log.credential_nombre.slice(0, 16)}{log.credential_nombre.length > 16 ? '…' : ''}
                          </code>
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-slate-400 font-mono whitespace-nowrap">
                          {log.ip ?? '—'}
                        </td>
                        <td className="py-2.5 text-xs text-slate-400 whitespace-nowrap">
                          {fmtDateTime(log.started_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function PortalIntegraciones({
  actorId,
  supabaseUrl,
}: {
  actorId: string;
  supabaseUrl?: string;
}) {
  const [section, setSection] = useState<Section>('credentials');

  const apiBaseUrl = `${supabaseUrl ?? 'https://dqqjaujnulutinskmqsu.supabase.co'}/functions/v1/supplier-api-v1/api/v1/supplier`;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Integraciones API</h2>
        <p className="text-sm text-slate-500 mt-1">
          Conecta tu ERP o sistema de gestión para sincronizar catálogo, stock y precios automáticamente.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-6">
        <SectionTab active={section === 'credentials'} label="Credenciales" onClick={() => setSection('credentials')} />
        <SectionTab active={section === 'logs'} label="Historial de syncs" onClick={() => setSection('logs')} />
      </div>

      {/* Content */}
      {section === 'credentials' && (
        <CredentialsSection actorId={actorId} apiBaseUrl={apiBaseUrl} />
      )}
      {section === 'logs' && (
        <SyncLogsSection actorId={actorId} />
      )}
    </div>
  );
}
