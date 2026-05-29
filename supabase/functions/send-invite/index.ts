import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL           = Deno.env.get('APP_URL') ?? 'https://tradeflow.es';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const VALID_ROLES = new Set(['admin', 'comercial', 'tecnico', 'visualizador']);

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Sin autorizacion' }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Verificar JWT del llamante
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (authErr || !caller) return json({ error: 'Token invalido' }, 401);

  try {
    const { email, rol, org_id } = await req.json() as { email: string; rol: string; org_id: string };

    if (!email || !rol || !org_id) return json({ error: 'Faltan campos requeridos' }, 400);
    if (!VALID_ROLES.has(rol)) return json({ error: 'Rol no valido' }, 400);

    const normalEmail = email.trim().toLowerCase();
    if (caller.email === normalEmail) return json({ error: 'No puedes invitarte a ti mismo' }, 400);

    // Límite de miembros según plan
    const PLAN_MEMBER_LIMITS: Record<string, number> = {
      basico:       0,
      profesional:  0,
      empresa:      5,
      empresa_plus: 15,
    };

    // Verificar que el llamante es owner o admin de la org
    const { data: org } = await supabase
      .from('trade_organizations')
      .select('id, owner_id')
      .eq('id', org_id)
      .maybeSingle();

    if (!org) return json({ error: 'Organizacion no encontrada' }, 404);

    const isOwner = org.owner_id === caller.id;

    if (!isOwner) {
      const { data: callerMember } = await supabase
        .from('trade_org_members')
        .select('rol')
        .eq('org_id', org_id)
        .eq('user_id', caller.id)
        .maybeSingle();

      if (!callerMember || !['owner', 'admin'].includes(callerMember.rol)) {
        return json({ error: 'Sin permisos para invitar' }, 403);
      }
    }

    // Comprobar plan y límite de miembros según el mismo
    const { data: sub } = await supabase
      .from('trade_subscriptions')
      .select('plan')
      .eq('org_id', org_id)
      .maybeSingle();

    const plan = sub?.plan ?? 'basico';
    const memberLimit = PLAN_MEMBER_LIMITS[plan] ?? 0;

    if (memberLimit === 0) {
      return json({
        error: `Tu plan ${plan === 'basico' ? 'Básico' : 'Profesional'} no permite añadir miembros al equipo. Actualiza al Plan Empresa o superior.`,
        plan_restriction: true,
        plan,
      }, 403);
    }

    const { count } = await supabase
      .from('trade_org_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', org_id)
      .eq('activo', true);

    if ((count ?? 0) >= memberLimit) {
      return json({
        error: `Has alcanzado el límite de ${memberLimit} miembro${memberLimit !== 1 ? 's' : ''} para el plan ${plan === 'empresa' ? 'Empresa' : 'Empresa+'}. ${plan === 'empresa' ? 'Actualiza a Empresa+ para hasta 15 miembros.' : ''}`.trim(),
        plan_restriction: true,
        plan,
        limit: memberLimit,
        used: count ?? 0,
      }, 403);
    }

    // Invitar usuario via Supabase admin (crea cuenta si no existe, envía magic link si ya existe)
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(
      normalEmail,
      {
        redirectTo: `${APP_URL}/auth/callback`,
        data: { invited_to_org: org_id, invited_rol: rol },
      },
    );

    if (inviteErr) return json({ error: inviteErr.message }, 400);

    const invitedUserId = inviteData.user.id;

    // Guardar registro en trade_org_members (activo = false hasta que acepte)
    const { error: upsertErr } = await supabase
      .from('trade_org_members')
      .upsert({
        org_id,
        user_id: invitedUserId,
        email: normalEmail,
        rol,
        activo: false,
        invited_at: new Date().toISOString(),
      }, { onConflict: 'org_id,user_id' });

    if (upsertErr) throw upsertErr;

    return json({ success: true });

  } catch (e: unknown) {
    const msg = (e as Error).message ?? 'Error desconocido';
    console.error('[send-invite]', msg);
    return json({ error: msg }, 500);
  }
});
