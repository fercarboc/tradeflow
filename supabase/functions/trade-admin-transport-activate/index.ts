import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const RESEND_API_KEY       = Deno.env.get('RESEND2_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const FROM                 = 'TRABFLOW <contacto@trabflow.com>';

const TRANSPORT_OFICIOS = ['Transporte de Viajeros', 'Transporte de Mercancías'];
const VALID_LICENSES    = ['none', 'demo', 'pilot', 'production'] as const;
type TransportLicense = typeof VALID_LICENSES[number];

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

function reply(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailWrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><body style="margin:0;padding:32px 16px;background:#020B16;font-family:sans-serif">
<div style="max-width:560px;margin:0 auto">
  <div style="margin-bottom:24px">
    <span style="font-size:22px;font-weight:900;color:#FFC400;letter-spacing:2px;text-transform:uppercase">TRABFLOW</span>
  </div>
  <h2 style="color:#fff;font-size:18px;font-weight:700;margin:0 0 8px">${title}</h2>
  ${body}
  <p style="color:#334155;font-size:11px;margin-top:32px">trabflow.com · contacto@trabflow.com</p>
</div></body></html>`;
}

// Returns true if email was sent successfully, false on error.
// Errors are logged but not thrown — DB state must not depend on Resend availability.
async function sendResend(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[transport-activate] RESEND_API_KEY not set — skipping email');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[transport-activate] Resend error ${res.status}:`, err);
      return false;
    }
    return true;
  } catch (e: unknown) {
    console.error('[transport-activate] Resend fetch failed:', (e as Error).message);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return reply(req, { ok: false, error: 'Sin autorización' }, 401);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return reply(req, { ok: false, error: 'Configuración de servicio incompleta' }, 503);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = authHeader.replace('Bearer ', '').trim();

  // Verificar identidad del llamante
  const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
  if (authErr || !caller) return reply(req, { ok: false, error: 'Token inválido' }, 401);

  // Verificar que el caller es admin activo según admin_users (tabla específica TrabFlow)
  const { data: adminRow, error: adminErr } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', caller.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminErr || !adminRow) {
    return reply(req, { ok: false, error: 'Acceso denegado: se requiere administrador TrabFlow' }, 403);
  }

  // Parsear body
  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return reply(req, { ok: false, error: 'Body JSON inválido' }, 400); }

  const { org_id, action, license } = body as {
    org_id?: string;
    action?: string;
    license?: string;
  };

  if (!org_id || typeof org_id !== 'string') {
    return reply(req, { ok: false, error: 'org_id requerido' }, 400);
  }
  if (action !== 'activate' && action !== 'deactivate') {
    return reply(req, { ok: false, error: 'action debe ser "activate" o "deactivate"' }, 400);
  }

  const targetLicense: TransportLicense =
    action === 'activate'
      ? (VALID_LICENSES.includes(license as TransportLicense) ? (license as TransportLicense) : 'pilot')
      : 'none';

  // Obtener la org para validar oficio y estado actual
  const { data: org, error: orgErr } = await admin
    .from('trade_organizations')
    .select('id, oficio, transport_enabled, transport_license, is_onboarded, nombre, owner_id')
    .eq('id', org_id)
    .maybeSingle();

  if (orgErr || !org) return reply(req, { ok: false, error: 'Organización no encontrada' }, 404);

  if (!TRANSPORT_OFICIOS.includes(org.oficio)) {
    return reply(req, { ok: false, error: `Oficio inválido para transporte: "${org.oficio}"` }, 422);
  }

  // Idempotencia: no actuar si ya está en el estado pedido
  if (action === 'activate' && org.transport_enabled === true && org.transport_license === targetLicense) {
    return reply(req, { ok: true, already: true, message: 'Ya activada con esa licencia' });
  }
  if (action === 'deactivate' && org.transport_enabled === false) {
    return reply(req, { ok: true, already: true, message: 'Ya desactivada' });
  }

  // Aplicar cambio via service_role (bypasa trigger trg_protect_transport_enabled)
  const updatePayload = action === 'activate'
    ? { transport_enabled: true,  transport_license: targetLicense }
    : { transport_enabled: false, transport_license: 'none' };

  const { error: updateErr } = await admin
    .from('trade_organizations')
    .update(updatePayload)
    .eq('id', org_id);

  if (updateErr) {
    console.error('[transport-activate] update error:', updateErr.message);
    return reply(req, { ok: false, error: updateErr.message }, 500);
  }

  // Email al transportista solo al activar
  let emailSent = false;
  if (action === 'activate') {
    const { data: ownerData } = await admin.auth.admin.getUserById(org.owner_id);
    const ownerEmail = ownerData?.user?.email;

    if (ownerEmail) {
      const orgName  = escapeHtml(org.nombre ?? 'Tu empresa');
      const modalidad = org.oficio === 'Transporte de Viajeros' ? 'viajeros' : 'mercancías';
      const licLabel  = targetLicense === 'pilot'      ? 'Piloto'
                      : targetLicense === 'production' ? 'Producción'
                      : targetLicense === 'demo'       ? 'Demo'
                      : 'Básico';

      emailSent = await sendResend(
        ownerEmail,
        '¡Tu acceso a TrabFlow Transporte está activo!',
        emailWrap('Acceso activado — TrabFlow Transporte', `
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin-bottom:16px">
            Hola, <strong style="color:#f1f5f9">${orgName}</strong>.
          </p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin-bottom:24px">
            Tu solicitud de acceso a <strong style="color:#FFC400">TrabFlow Transporte</strong>
            (modalidad <em>${modalidad}</em>) ha sido <strong style="color:#22c55e">aprobada</strong>.
            Ya puedes iniciar sesión y configurar tu operativa.
          </p>
          <table style="border-collapse:collapse;width:100%;background:#0d1f38;border-radius:8px;overflow:hidden;margin-bottom:24px">
            <tr>
              <td style="padding:8px 12px;color:#94a3b8;font-size:13px">Empresa</td>
              <td style="padding:8px 12px;color:#f1f5f9;font-size:13px">${orgName}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#94a3b8;font-size:13px">Modalidad</td>
              <td style="padding:8px 12px;color:#f1f5f9;font-size:13px">${escapeHtml(org.oficio)}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px;color:#94a3b8;font-size:13px">Licencia</td>
              <td style="padding:8px 12px;color:#FFC400;font-size:13px;font-weight:700">${licLabel}</td>
            </tr>
          </table>
          <a href="https://trabflow.com/transporte" style="display:inline-block;background:#FFC400;color:#020B16;font-weight:900;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;letter-spacing:0.5px">
            Acceder ahora →
          </a>
          <p style="color:#475569;font-size:12px;margin-top:24px">
            ¿Tienes dudas? Escríbenos a
            <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
            o llámanos al <strong>672 336 572</strong>.
          </p>
        `),
      );
      if (emailSent) console.log(`[transport-activate] access_granted email sent to ${ownerEmail}`);
    }
  }

  // Audit log — siempre, incluye si el email falló (visible para el admin en la BD)
  const auditAction = action === 'activate' ? 'transport_activated' : 'transport_deactivated';
  await admin.from('admin_activity_log').insert({
    admin_email: caller.email ?? 'unknown',
    action: auditAction,
    target_org_id: org_id,
    metadata: {
      license:     targetLicense,
      oficio:      org.oficio,
      actor_id:    caller.id,
      email_sent:  emailSent,
    },
  });

  console.log(`[transport-activate] org=${org_id} action=${action} license=${targetLicense} by=${caller.email} email_sent=${emailSent}`);
  return reply(req, { ok: true, action, license: targetLicense, email_sent: emailSent });
});
