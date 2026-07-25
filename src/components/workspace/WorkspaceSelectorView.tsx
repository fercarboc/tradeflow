import { ActivePage } from '../../types';
import type { ResolvedWorkspaces, InstallerWorkspace, SupplierWorkspace } from '../../lib/workspaceResolver';
import { rememberWorkspace } from '../../lib/workspaceResolver';

interface Props {
  workspaces: ResolvedWorkspaces;
  onSelect: (type: 'installer_org' | 'marketplace_actor', id: string) => void;
  setCurrentPage: (page: ActivePage) => void;
}

export default function WorkspaceSelectorView({ workspaces, onSelect }: Props) {
  const { installers, suppliers } = workspaces;
  const total = installers.length + suppliers.length;

  function handleSelect(type: 'installer_org' | 'marketplace_actor', id: string) {
    rememberWorkspace({ type, id });
    onSelect(type, id);
  }

  return (
    <div className="min-h-screen bg-[#020B16] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src="/tradeflow.png" alt="TrabFlow" className="h-10 mx-auto mb-4" />
          <h1 className="text-2xl font-display font-bold text-white">¿Dónde quieres trabajar?</h1>
          <p className="text-white/40 mt-1 text-sm">
            Tu cuenta tiene acceso a {total} espacio{total !== 1 ? 's' : ''}.
          </p>
        </div>

        <div className="space-y-3">
          {installers.map(ws => (
            <InstallerCard key={ws.id} ws={ws} onSelect={handleSelect} />
          ))}
          {suppliers.map(ws => (
            <SupplierCard key={ws.id} ws={ws} onSelect={handleSelect} />
          ))}
        </div>

        <p className="text-center text-white/25 text-xs mt-8">
          Tu elección se recordará para próximos accesos. Puedes cambiarla desde el menú de usuario.
        </p>
      </div>
    </div>
  );
}

function InstallerCard({
  ws,
  onSelect,
}: {
  ws: InstallerWorkspace;
  onSelect: (type: 'installer_org', id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect('installer_org', ws.id)}
      className="w-full text-left bg-[#0d1f38] hover:bg-[#0f2a50] border border-white/10 hover:border-[#00CFE8]/40 rounded-2xl p-5 transition group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-[#00CFE8]/10 flex items-center justify-center shrink-0">
          <svg className="h-6 w-6 text-[#00CFE8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{ws.name}</p>
          <p className="text-white/40 text-sm mt-0.5">Empresa instaladora</p>
          {!ws.isOnboarded && (
            <span className="inline-block mt-1 text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
              Configuración pendiente
            </span>
          )}
        </div>
        <svg
          className="h-5 w-5 text-white/20 group-hover:text-[#00CFE8] transition shrink-0"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function SupplierCard({
  ws,
  onSelect,
}: {
  ws: SupplierWorkspace;
  onSelect: (type: 'marketplace_actor', id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect('marketplace_actor', ws.id)}
      className="w-full text-left bg-[#0d1f38] hover:bg-[#0f2a50] border border-white/10 hover:border-teal-400/40 rounded-2xl p-5 transition group"
    >
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-teal-400/10 flex items-center justify-center shrink-0 overflow-hidden">
          {ws.logoUrl ? (
            <img src={ws.logoUrl} alt={ws.name} className="h-10 w-10 object-contain" />
          ) : (
            <svg className="h-6 w-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold truncate">{ws.name}</p>
          <p className="text-white/40 text-sm mt-0.5">Proveedor · {ws.roleName}</p>
        </div>
        <svg
          className="h-5 w-5 text-white/20 group-hover:text-teal-400 transition shrink-0"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}
