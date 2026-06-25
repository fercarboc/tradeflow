import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM              = 'TRABFLOW <contacto@trabflow.com>';
const ADMIN_EMAIL       = 'contacto@trabflow.com';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

interface EmailPayload {
  type: 'waitlist_admin' | 'waitlist_confirm' | 'welcome' | 'contact_admin' | 'support_admin' | 'auth_confirm';
  nombre?: string;
  email?: string;
  telefono?: string;
  oficio?: string;
  ciudad?: string;
  presupuestos_al_mes?: string;
  mensaje?: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`[trade-email] Resend error ${res.status}:`, err);
    throw new Error(`Resend error ${res.status}: ${err}`);
  }
}

function row(label: string, value?: string) {
  if (!value) return '';
  return `<tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 12px;color:#f1f5f9;font-size:13px">${value}</td></tr>`;
}

function tableWrap(rows: string) {
  return `<table style="border-collapse:collapse;width:100%;background:#0d1f38;border-radius:8px;overflow:hidden;margin-top:16px">${rows}</table>`;
}

function emailWrap(title: string, body: string) {
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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  let payload: EmailPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY not set' }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  console.log(`[trade-email] type=${payload.type} email=${payload.email ?? '-'}`);

  try {
    switch (payload.type) {

      case 'auth_confirm': {
        if (!payload.email) {
          return new Response(JSON.stringify({ error: 'email requerido' }), {
            status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
          });
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
          return new Response(JSON.stringify({ error: 'Supabase service key not set' }), {
            status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
          });
        }

        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
          type: 'signup',
          email: payload.email,
          options: { redirectTo: 'https://www.trabflow.com/auth/callback' },
        });

        if (linkErr || !linkData?.properties?.action_link) {
          const msg = linkErr?.message ?? 'No se pudo generar el enlace';
          console.error('[trade-email] generateLink error:', msg);
          return new Response(JSON.stringify({ error: msg }), {
            status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
          });
        }

        const actionLink = linkData.properties.action_link;
        await sendEmail(
          payload.email,
          'Confirma tu cuenta de TRABFLOW',
          emailWrap('Activa tu cuenta', `
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Hola ${payload.nombre ?? 'instalador'}, gracias por registrarte en TRABFLOW.
              Pulsa el botón de abajo para confirmar tu dirección de email y acceder a tu panel.
            </p>
            <div style="margin:24px 0">
              <a href="${actionLink}" style="display:inline-block;background:#00CFE8;color:#020B16;font-weight:900;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:13px;text-transform:uppercase;letter-spacing:1px">
                Confirmar email →
              </a>
            </div>
            <p style="color:#475569;font-size:12px;line-height:1.5">
              Si no creaste esta cuenta puedes ignorar este mensaje.<br>
              El enlace caduca en 24 horas.
            </p>
            <p style="color:#334155;font-size:12px;margin-top:16px">
              ¿Necesitas ayuda? Escríbenos a <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
            </p>
          `),
        );
        console.log(`[trade-email] auth_confirm sent to ${payload.email}`);
        break;
      }

      case 'waitlist_admin':
        await sendEmail(
          ADMIN_EMAIL,
          `Nueva lista de espera: ${payload.nombre ?? 'Sin nombre'}`,
          emailWrap('Nuevo registro en lista de espera', tableWrap(
            row('Nombre', payload.nombre) +
            row('Email', payload.email) +
            row('Teléfono', payload.telefono) +
            row('Oficio', payload.oficio) +
            row('Ciudad', payload.ciudad) +
            row('Presupuestos/mes', payload.presupuestos_al_mes),
          )),
        );
        console.log('[trade-email] waitlist_admin sent');
        break;

      case 'waitlist_confirm':
        if (payload.email) {
          await sendEmail(
            payload.email,
            'Te hemos apuntado a la lista de espera de TRABFLOW',
            emailWrap('¡Gracias por tu interés!', `
              <p style="color:#94a3b8;font-size:14px;line-height:1.6">
                Hola ${payload.nombre ?? 'instalador'}, te hemos anotado en la lista de espera de TRABFLOW.
                Serás de los primeros en acceder cuando abramos tu zona.
              </p>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6">
                Si tienes cualquier pregunta puedes escribirnos a <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
                o llamarnos al <strong style="color:#fff">672 336 572</strong>.
              </p>
            `),
          );
          console.log(`[trade-email] waitlist_confirm sent to ${payload.email}`);
        }
        break;

      case 'welcome':
        if (payload.email) {
          await sendEmail(
            payload.email,
            '¡Bienvenido a TRABFLOW! Tu cuenta está lista',
            emailWrap('¡Cuenta creada con éxito!', `
              <p style="color:#94a3b8;font-size:14px;line-height:1.6">
                Hola ${payload.nombre ?? 'instalador'}, tu cuenta de TRABFLOW está lista.
                Tienes <strong style="color:#FFC400">15 días gratuitos</strong> para probarlo sin tarjeta de crédito.
              </p>
              <p style="color:#94a3b8;font-size:14px;line-height:1.6">
                Empieza creando tu primer presupuesto por voz o foto desde el panel.
              </p>
              <div style="margin-top:20px">
                <a href="https://www.trabflow.com/?app=true" style="display:inline-block;background:#FFC400;color:#020B16;font-weight:900;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;text-transform:uppercase;letter-spacing:1px">
                  Ir al panel →
                </a>
              </div>
              <p style="color:#334155;font-size:12px;margin-top:24px">
                ¿Necesitas ayuda? Escríbenos a <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
              </p>
            `),
          );
          console.log(`[trade-email] welcome sent to ${payload.email}`);
        }
        break;

      case 'contact_admin':
        await sendEmail(
          ADMIN_EMAIL,
          `Nuevo contacto web: ${payload.nombre ?? 'Sin nombre'} — ${payload.oficio ?? ''}`,
          emailWrap('Nuevo mensaje desde el formulario de contacto', tableWrap(
            row('Nombre', payload.nombre) +
            row('Teléfono', payload.telefono) +
            row('Email', payload.email) +
            row('Motivo', payload.oficio) +
            row('Mensaje', payload.ciudad),
          )),
        );
        console.log('[trade-email] contact_admin sent');
        break;

      case 'support_admin':
        await sendEmail(
          ADMIN_EMAIL,
          `Ticket de soporte: ${payload.oficio ?? 'Sin asunto'} — ${payload.nombre ?? ''}`,
          emailWrap('Nuevo ticket de soporte desde el panel', tableWrap(
            row('Usuario', payload.nombre) +
            row('Email', payload.email) +
            row('Asunto', payload.oficio) +
            row('Descripción', payload.ciudad) +
            row('Org ID', payload.presupuestos_al_mes),
          )),
        );
        console.log('[trade-email] support_admin sent');
        break;

      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${(payload as { type: string }).type}` }), {
          status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[trade-email] unhandled error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
});


