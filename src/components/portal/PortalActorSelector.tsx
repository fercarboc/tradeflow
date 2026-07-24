import React from 'react';
import { MarketplaceMyMembership } from '../../lib/api/marketplace-actors';

interface Props {
  memberships: MarketplaceMyMembership[];
  onSelect:    (actorId: string) => void;
  onBack:      () => void;
}

const ESTADO_BADGE: Record<string, { label: string; cls: string }> = {
  active:    { label: 'Activo',     cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  pending:   { label: 'Pendiente',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  suspended: { label: 'Suspendido', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  banned:    { label: 'Vetado',     cls: 'bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
};

export default function PortalActorSelector({ memberships, onSelect, onBack }: Props) {
  if (memberships.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 px-4">
        <div className="text-center max-w-sm">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-slate-100 mb-2">
            Sin empresas proveedoras
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            No tienes acceso a ningún portal de proveedor. Pide una invitación al administrador de tu empresa,
            o crea tu propia cuenta de proveedor.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onBack}
              className="w-full rounded-lg border border-slate-700 px-4 py-2.5 text-sm text-slate-300 hover:border-slate-600 hover:text-slate-100 transition-colors"
            >
              Volver a TrabFlow
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="w-full max-w-2xl">
        <button
          onClick={onBack}
          className="mb-8 flex items-center gap-1.5 text-sm text-slate-400 hover:text-teal-400 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Volver a TrabFlow
        </button>

        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex items-center gap-2 rounded-full bg-teal-900/30 px-4 py-1.5 text-xs font-semibold tracking-wide text-teal-300 uppercase">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Portal del Proveedor
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            Selecciona tu empresa
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Tienes acceso a {memberships.length} {memberships.length === 1 ? 'empresa proveedora' : 'empresas proveedoras'}.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {memberships.map((m) => {
            const badge = ESTADO_BADGE[m.actor_estado] ?? ESTADO_BADGE.pending;
            const isBlocked = m.actor_estado === 'banned';
            return (
              <button
                key={m.actor_id}
                onClick={() => !isBlocked && onSelect(m.actor_id)}
                disabled={isBlocked}
                className={`group relative flex flex-col rounded-xl border p-5 text-left transition-all ${
                  isBlocked
                    ? 'cursor-not-allowed border-slate-800 opacity-50'
                    : 'cursor-pointer border-slate-800 hover:border-teal-600 hover:shadow-lg hover:shadow-teal-900/20 focus:outline-none focus:ring-2 focus:ring-teal-500'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-900 text-teal-300 font-bold text-lg shrink-0">
                    {m.actor_logo_url ? (
                      <img src={m.actor_logo_url} alt={m.actor_nombre} className="h-10 w-10 rounded-lg object-cover" />
                    ) : (
                      m.actor_nombre.charAt(0).toUpperCase()
                    )}
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="font-semibold text-slate-100 text-sm leading-tight">
                  {m.actor_nombre}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {m.actor_slug}
                </p>

                <div className="mt-3 flex items-center gap-1.5">
                  <span className="rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400 capitalize">
                    {m.role_nombre}
                  </span>
                  {m.actor_verificado && (
                    <span className="flex items-center gap-1 text-xs text-teal-400">
                      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                      </svg>
                      Verificado
                    </span>
                  )}
                </div>

                {!isBlocked && (
                  <svg
                    className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600 group-hover:text-teal-400 transition-colors"
                    fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
