import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

  const token = authHeader.replace('Bearer ', '').trim();
  const isServiceRole = jwtRole(token) === 'service_role';

  if (!isServiceRole) {
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) return reply({ ok: false, error: 'Token inválido' }, 401);

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

  const { user_id, email, new_password } = body as Record<string, string>;

  if (!new_password || new_password.length < 8) {
    return reply({ ok: false, error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
  }

  let targetId = user_id;

  // Resolve user_id from email if needed
  if (!targetId && email) {
    const normalEmail = email.trim().toLowerCase();
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users?.find(u => u.email === normalEmail);
    if (!found) return reply({ ok: false, error: `Usuario no encontrado: ${normalEmail}` }, 404);
    targetId = found.id;
  }

  if (!targetId) {
    return reply({ ok: false, error: 'Se requiere user_id o email' }, 400);
  }

  const { error: updateErr } = await admin.auth.admin.updateUserById(targetId, {
    password: new_password,
  });

  if (updateErr) return reply({ ok: false, error: updateErr.message }, 500);

  return reply({ ok: true, user_id: targetId });
});

function jwtRole(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch { return null; }
}
