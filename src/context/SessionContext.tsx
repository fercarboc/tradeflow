import { createContext, useContext, useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, getOwnOrg, loadOrgById, loadOrgSubscription } from '../lib/supabase';
import type { TradeOrganization, TradeSubscription } from '../lib/supabase';

export type Rol = 'owner' | 'admin' | 'comercial' | 'tecnico' | 'visualizador';
export type Plan = 'basico' | 'pro' | 'empresa';

export const ROL_PERMISOS: Record<Rol, string[]> = {
  owner: [
    'quotes.create', 'quotes.edit', 'quotes.delete',
    'clients.manage',
    'invoices.create', 'invoices.manage',
    'jobs.view', 'jobs.manage',
    'catalog.manage',
    'team.manage',
    'ingresos.view',
    'settings.manage',
    'subscription.manage',
  ],
  admin: [
    'quotes.create', 'quotes.edit', 'quotes.delete',
    'clients.manage',
    'invoices.create', 'invoices.manage',
    'jobs.view', 'jobs.manage',
    'catalog.manage',
    'team.manage',
    'ingresos.view',
  ],
  comercial: [
    'quotes.create', 'quotes.edit',
    'clients.manage',
    'jobs.view', 'jobs.manage',
  ],
  tecnico: ['jobs.view'],
  visualizador: ['jobs.view'],
};

export interface SessionState {
  user: User | null;
  org: TradeOrganization | null;
  subscription: TradeSubscription | null;
  plan: Plan;
  rol: Rol;
  permisos: string[];
  isLoading: boolean;
}

const DEFAULT_STATE: SessionState = {
  user: null,
  org: null,
  subscription: null,
  plan: 'basico',
  rol: 'owner',
  permisos: [],
  isLoading: true,
};

const SessionContext = createContext<SessionState>(DEFAULT_STATE);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>(DEFAULT_STATE);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    async function load(user: User | null) {
      if (!user) {
        if (!cancelledRef.current) {
          setState({ ...DEFAULT_STATE, isLoading: false });
        }
        return;
      }

      // Activar invitaciones pendientes para este usuario al entrar
      await supabase
        .from('trade_org_members')
        .update({ activo: true })
        .eq('user_id', user.id)
        .eq('activo', false);

      let org: TradeOrganization | null = await getOwnOrg();
      let rol: Rol = 'owner';
      let memberId: string | null = null;

      if (!org) {
        // Usuario no es owner; buscar en trade_org_members
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

      // Calcular permisos efectivos del rol base
      let permisos = [...(ROL_PERMISOS[rol] ?? [])];

      // Aplicar overrides individuales si el usuario es miembro
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

      if (!cancelledRef.current) {
        setState({ user, org, subscription, plan, rol, permisos, isLoading: false });
      }
    }

    // Carga inicial
    supabase.auth.getSession().then(({ data }) => {
      load(data.session?.user ?? null);
    });

    // Re-carga al cambiar sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      load(session?.user ?? null);
    });

    return () => {
      cancelledRef.current = true;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SessionContext.Provider value={state}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
