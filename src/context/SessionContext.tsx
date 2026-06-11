import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, getOwnOrg, loadOrgById, loadOrgSubscription, loadMyWorkerProfile } from '../lib/supabase';
import type { TradeOrganization, TradeSubscription, TradeWorker } from '../lib/supabase';

export type Rol = 'owner' | 'admin' | 'oficina' | 'comercial' | 'tecnico' | 'visualizador';
export type Plan = 'basico' | 'pro' | 'empresa';

export const ROL_PERMISOS: Record<Rol, string[]> = {
  // Propietario: acceso total
  owner: [
    'quotes.create', 'quotes.edit', 'quotes.delete',
    'clients.manage',
    'invoices.create', 'invoices.manage',
    'jobs.view', 'jobs.manage',
    'catalog.manage',
    'team.manage',
    'ingresos.view',
    'mantenimiento.view',
    'settings.manage',
    'subscription.manage',
  ],
  // Admin: todo igual que owner, sin gestión de suscripción
  admin: [
    'quotes.create', 'quotes.edit', 'quotes.delete',
    'clients.manage',
    'invoices.create', 'invoices.manage',
    'jobs.view', 'jobs.manage',
    'catalog.manage',
    'team.manage',
    'ingresos.view',
    'mantenimiento.view',
    'settings.manage',
    'field_notes.create',
  ],
  // Oficina: todo excepto ajustes de empresa
  oficina: [
    'quotes.create', 'quotes.edit', 'quotes.delete',
    'clients.manage',
    'invoices.create', 'invoices.manage',
    'jobs.view', 'jobs.manage',
    'catalog.manage',
    'team.manage',
    'ingresos.view',
    'mantenimiento.view',
  ],
  // Comercial: presupuestos + clientes, sin facturas ni contratos
  comercial: [
    'quotes.create', 'quotes.edit',
    'clients.manage',
  ],
  // Técnico de campo: solo sus trabajos y notas. Sin facturas, presupuestos ni clientes.
  tecnico: [
    'jobs.view', 'jobs.manage',
    'field_notes.create',
  ],
  // Visualizador: solo lectura de trabajos
  visualizador: ['jobs.view'],
};

export interface SessionState {
  user: User | null;
  org: TradeOrganization | null;
  subscription: TradeSubscription | null;
  plan: Plan;
  rol: Rol;
  permisos: string[];
  workerProfile: TradeWorker | null;
  isLoading: boolean;
  refreshSubscription: () => Promise<void>;
}

const DEFAULT_STATE: SessionState = {
  user: null,
  org: null,
  subscription: null,
  plan: 'basico',
  rol: 'owner',
  permisos: [],
  workerProfile: null,
  isLoading: true,
  refreshSubscription: async () => {},
};

const SessionContext = createContext<SessionState>(DEFAULT_STATE);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(DEFAULT_STATE);
  const cancelledRef = useRef(false);
  const orgIdRef = useRef<string | null>(null);

  const refreshSubscription = useCallback(async () => {
    if (!orgIdRef.current) return;
    const subscription = await loadOrgSubscription(orgIdRef.current);
    const plan: Plan = (subscription?.plan as Plan) ?? 'basico';
    setState(prev => ({ ...prev, subscription, plan }));
  }, []);

  useEffect(() => {
    cancelledRef.current = false;

    async function load(user: User | null) {
      if (!user) {
        if (!cancelledRef.current) {
          orgIdRef.current = null;
          setState({ ...DEFAULT_STATE, isLoading: false, refreshSubscription });
        }
        return;
      }

      // Activar invitaciones pendientes
      await supabase
        .from('trade_org_members')
        .update({ activo: true })
        .eq('user_id', user.id)
        .eq('activo', false);

      let org: TradeOrganization | null = await getOwnOrg();
      let rol: Rol = 'owner';
      let memberId: string | null = null;

      if (!org) {
        const { data: member } = await supabase
          .from('trade_org_members')
          .select('id, rol, org_id')
          .eq('user_id', user.id)
          .eq('activo', true)
          .maybeSingle();

        if (member) {
          rol = member.rol as Rol;
          memberId = member.id;
          org = await loadOrgById(member.org_id);
        }
      }

      let permisos = [...(ROL_PERMISOS[rol] ?? [])];

      if (memberId) {
        const { data: overrides } = await supabase
          .from('trade_org_permissions')
          .select('permiso, granted')
          .eq('member_id', memberId);

        if (overrides) {
          for (const o of overrides) {
            if (o.granted && !permisos.includes(o.permiso)) {
              permisos.push(o.permiso);
            } else if (!o.granted) {
              permisos = permisos.filter(p => p !== o.permiso);
            }
          }
        }
      }

      const subscription = org ? await loadOrgSubscription(org.id) : null;
      const plan: Plan = (subscription?.plan as Plan) ?? 'basico';

      // Cargar perfil de trabajador de campo si el usuario es técnico
      let workerProfile: TradeWorker | null = null;
      if (rol === 'tecnico' && org) {
        workerProfile = await loadMyWorkerProfile(user.id, org.id).catch(() => null);
      }

      orgIdRef.current = org?.id ?? null;

      if (!cancelledRef.current) {
        setState({ user, org, subscription, plan, rol, permisos, workerProfile, isLoading: false, refreshSubscription });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });

    return () => {
      cancelledRef.current = true;
      subscription.unsubscribe();
    };
  }, [refreshSubscription]);

  return (
    <SessionContext.Provider value={state}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
