import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL           = Deno.env.get('APP_URL') ?? 'https://www.trabflow.com';

const ALLOWED_ORIGINS = [
  'https://trabflow.com', 'https://www.trabflow.com',
  'http://localhost:5173', 'http://localhost:4173',
];

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply({ ok: false, error: 'Sin autorización' }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Accept a service_role JWT (scripts) or a valid platform-admin user JWT (UI)
  const token = authHeader.replace('Bearer ', '').trim();
  const isServiceRole = jwtRole(token) === 'service_role';

  if (!isServiceRole) {
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return reply({ ok: false, error: 'Token inválido' }, 401);

    // Verify caller has any active marketplace actor membership (= platform admin)
    const { count } = await admin
      .from('trade_marketplace_actor_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', caller.id)
      .eq('activo', true);

    if (!count || count === 0) {
      return reply({ ok: false, error: 'Permisos insuficientes: se requiere administrador de plataforma' }, 403);
    }
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply({ ok: false, error: 'Body JSON inválido' }, 400); }

  const {
    email, password, nombre, company_name,
    oficio, plan, billing_cycle, telefono, trial_days,
    // Phase 0 / Founding Installer internal fields
    phase, pilot, founding_installer, founding_installer_number,
  } = body as Record<string, unknown>;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return reply({ ok: false, error: 'Email requerido y debe ser válido' }, 400);
  }
  if (!nombre || typeof nombre !== 'string') {
    return reply({ ok: false, error: 'nombre requerido' }, 400);
  }

  const normalEmail     = (email as string).trim().toLowerCase();
  const resolvedPlan    = (plan as string) || 'empresa_plus';
  const resolvedCycle   = (billing_cycle as string) || 'monthly';
  const resolvedOficio  = (oficio as string) || 'Construcción';
  const resolvedDays    = Number(trial_days) > 0 ? Number(trial_days) : 90;
  const trialEnd        = new Date(Date.now() + resolvedDays * 86_400_000).toISOString();
  const orgName         = (company_name as string) || (nombre as string);

  // ── 1. Create auth user via Admin API ────────────────────────────────────────
  const createParams: Record<string, unknown> = {
    email: normalEmail,
    email_confirm: true,          // confirmed administratively — no email required
    user_metadata: {
      full_name:    nombre,
      company_name: orgName,
      phone:        telefono ?? null,
      trade_types:  resolvedOficio,
      plan:         resolvedPlan,
      billing_cycle: resolvedCycle,
      admin_created: true,
      phase:        phase ?? null,
    },
  };

  // Only set password if provided and non-empty; otherwise user must use recovery link
  if (password && typeof password === 'string' && password.length >= 6) {
    createParams.password = password;
  }

  const { data: userData, error: userError } = await admin.auth.admin.createUser(
    createParams as Parameters<typeof admin.auth.admin.createUser>[0],
  );

  if (userError) {
    const isExisting = /already registered|already exists|duplicate/i.test(userError.message);
    return reply({
      ok: false,
      error: isExisting
        ? `El email ${normalEmail} ya existe en Supabase Auth. Usa "Extender trial" o "Cambiar contraseña" desde el panel Admin.`
        : userError.message,
    }, isExisting ? 409 : 400);
  }

  const userId = userData.user.id;

  // ── 2. Create trade_organizations ────────────────────────────────────────────
  const orgInsert: Record<string, unknown> = {
    owner_id:               userId,
    nombre:                 orgName,
    oficio:                 resolvedOficio,
    email:                  normalEmail,
    telefono:               telefono ?? null,
    plan:                   resolvedPlan,
    is_onboarded:           false,
    force_password_change:  false,
    phase:                  phase ?? null,
    pilot:                  pilot === true,
    founding_installer:     founding_installer === true,
    founding_installer_number: founding_installer_number ?? null,
    internal_notes:         buildNotes({ nombre, phase, pilot, founding_installer, founding_installer_number }),
  };

  const { data: orgData, error: orgError } = await admin
    .from('trade_organizations')
    .insert(orgInsert)
    .select('id')
    .single();

  if (orgError) {
    // Best-effort rollback of auth user
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return reply({ ok: false, error: `Error creando organización: ${orgError.message}` }, 500);
  }

  const orgId = orgData.id;

  // ── 3. Create trade_subscriptions ────────────────────────────────────────────
  const { error: subError } = await admin.from('trade_subscriptions').insert({
    org_id:        orgId,
    plan:          resolvedPlan,
    billing_cycle: resolvedCycle,
    status:        'trial',
    trial_start:   new Date().toISOString(),
    trial_end:     trialEnd,
  });
  if (subError) {
    console.error('[trade-admin-create-installer] subscription error:', subError.message);
  }

  // ── 4. Seed org catalog ───────────────────────────────────────────────────────
  await admin.rpc('seed_org_catalog', { new_org_id: orgId }).catch((e: unknown) => {
    console.error('[trade-admin-create-installer] seed_org_catalog error:', e);
  });

  // ── 5. Generate password recovery link (when no password was set) ─────────────
  let recoveryLink: string | null = null;
  if (!createParams.password) {
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: normalEmail,
      options: { redirectTo: `${APP_URL}/auth/callback` },
    });
    if (!linkError) {
      recoveryLink = linkData?.properties?.action_link ?? null;
    } else {
      console.error('[trade-admin-create-installer] generateLink error:', linkError.message);
    }
  }

  return reply({
    ok: true,
    user_id:                   userId,
    org_id:                    orgId,
    email:                     normalEmail,
    email_confirmed:           true,
    recovery_link:             recoveryLink,
    phase:                     phase ?? null,
    pilot:                     pilot === true,
    founding_installer:        founding_installer === true,
    founding_installer_number: founding_installer_number ?? null,
    trial_end:                 trialEnd,
  });
});

function jwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch { return null; }
}

function buildNotes(p: Record<string, unknown>): string {
  const lines: string[] = ['Cuenta creada administrativamente por TrabFlow Admin.'];
  if (p.phase)             lines.push(`Fase: ${p.phase}.`);
  if (p.pilot)             lines.push('Piloto: sí.');
  if (p.founding_installer) {
    lines.push(
      `Instalador Fundador Nº ${p.founding_installer_number ?? '?'} de un máximo de 10.`,
      'Derecho futuro a acceso permanente sin coste al plan base de TrabFlow (sujeto a definición comercial futura).',
    );
  }
  return lines.join(' ');
}
