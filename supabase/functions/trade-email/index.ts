import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY       = Deno.env.get('RESEND2_API_KEY') ?? Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const FROM                 = 'TRABFLOW <contacto@trabflow.com>';
const ADMIN_EMAIL          = 'contacto@trabflow.com';

const ALLOWED_ORIGINS = [
  'https://trabflow.com',
  'https://www.trabflow.com',
  'http://localhost:5173',
  'http://localhost:4173',
];

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

interface EmailPayload {
  type:
    | 'waitlist_admin' | 'waitlist_confirm'
    | 'welcome'
    | 'contact_admin'
    | 'support_admin'
    | 'provider_admin' | 'provider_confirm'
    | 'ad_document'
    | 'send_to_client';
  nombre?: string;
  email?: string;
  telefono?: string;
  oficio?: string;
  ciudad?: string;
  presupuestos_al_mes?: string;
  mensaje?: string;
  // Proveedor
  empresa?: string;
  company_type?: string;
  website?: string;
  province?: string;
  interests?: string[];
  advertising_interest?: boolean;
  founding_provider_interest?: boolean;
  // Ad document
  to_email?: string;
  doc_number?: string;
  customer_name?: string;
  concept?: string;
  period_start?: string;
  period_end?: string;
  slot_nombre?: string;
  commercial_value?: number;
  custom_message?: string;
  doc_url?: string;
  // send_to_client
  client_id?: string;
  org_id?: string;
  subject?: string;
  body?: string;
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

// row() escapes value to prevent HTML injection in admin email tables
function row(label: string, value?: string) {
  if (!value) return '';
  return `<tr><td style="padding:6px 12px;color:#94a3b8;font-size:13px;white-space:nowrap">${label}</td><td style="padding:6px 12px;color:#f1f5f9;font-size:13px">${escapeHtml(value)}</td></tr>`;
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

// Verifica el JWT del header Authorization usando supabase.auth.getUser() (verificación criptográfica).
async function verifyJwt(req: Request): Promise<{ userId: string; email: string } | null> {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  if (!token || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;

  const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { userId: data.user.id, email: data.user.email ?? '' };
}

// cf-connecting-ip es establecida por Cloudflare en la infraestructura de Supabase Edge Functions
// y no puede ser falsificada por el cliente. x-real-ip puede ser confiable dependiendo del proxy.
// NO se usa x-forwarded-for porque es controlable por el cliente en rutas que bypaseen Cloudflare.
// Si ambas cabeceras están ausentes se usa 'unknown': todas las solicitudes sin IP conocida
// comparten el mismo bucket de rate limiting, lo cual es conservador y no permite evasión.
function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

async function hashIdentifier(identifier: string): Promise<string> {
  const data = new TextEncoder().encode(identifier);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 'allowed'  → dentro del límite, proceder
// 'exceeded' → límite superado, devolver 429
// 'error'    → fallo interno (DB caída, función no existe, timeout)
//              TODOS los tipos son fail-closed: 'error' → 503 sin envío.
//              Esto garantiza que ningún fallo de BD convierte el endpoint en relay abierto.
type RateLimitResult = 'allowed' | 'exceeded' | 'error';

async function checkRateLimit(
  identifier: string,
  emailType: string,
  maxPerHour: number,
): Promise<RateLimitResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return 'error';
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await adminClient.rpc('check_and_increment_email_rate', {
    p_ip_hash: identifier,
    p_type:    emailType,
    p_max:     maxPerHour,
  });
  if (error) {
    console.error('[trade-email] rate limit error:', error.message);
    return 'error';
  }
  return data === true ? 'allowed' : 'exceeded';
}

function json400(req: Request, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}
function json401(req: Request, msg = 'No autorizado'): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401, headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}
function json403(req: Request, msg: string): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403, headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}
function json429(req: Request): Response {
  return new Response(JSON.stringify({ error: 'Demasiados intentos. Espera un momento.' }), {
    status: 429, headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}
function json503(req: Request, msg = 'Servicio temporalmente no disponible'): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 503, headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
}

// Aplica rate limit fail-closed para tipos públicos:
// 'exceeded' → 429, 'error' → 503 (no se envía el email), 'allowed' → null (continuar)
function publicRateCheck(result: RateLimitResult, req: Request): Response | null {
  if (result === 'exceeded') return json429(req);
  if (result === 'error')    return json503(req, 'Control de frecuencia no disponible. Inténtalo más tarde.');
  return null;
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

  console.log(`[trade-email] requestId=${requestId} type=${payload.type}`);

  try {
    switch (payload.type) {

      // ── TIPOS PÚBLICOS — rate limiting fail-closed ─────────────────────────────
      // Si el control de frecuencia falla, se devuelve 503 y NO se envía el email.
      // Esto evita que una caída de BD convierta el endpoint en relay abierto.

      case 'waitlist_admin': {
        const ipHash = await hashIdentifier(getClientIp(req));
        const rl = await checkRateLimit(ipHash, 'waitlist_admin', 5);
        const rlErr = publicRateCheck(rl, req);
        if (rlErr) return rlErr;
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
      }

      case 'waitlist_confirm': {
        if (!payload.email) break;
        const ipHash = await hashIdentifier(getClientIp(req));
        const rl = await checkRateLimit(ipHash, 'waitlist_confirm', 5);
        const rlErr = publicRateCheck(rl, req);
        if (rlErr) return rlErr;
        await sendEmail(
          payload.email,
          'Te hemos apuntado a la lista de espera de TRABFLOW',
          emailWrap('¡Gracias por tu interés!', `
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Hola ${escapeHtml(payload.nombre ?? 'instalador')}, te hemos anotado en la lista de espera de TRABFLOW.
              Serás de los primeros en acceder cuando abramos tu zona.
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Si tienes cualquier pregunta puedes escribirnos a <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
              o llamarnos al <strong style="color:#fff">672 336 572</strong>.
            </p>
          `),
        );
        console.log(`[trade-email] waitlist_confirm sent to ${payload.email}`);
        break;
      }

      case 'contact_admin': {
        const ipHash = await hashIdentifier(getClientIp(req));
        const rl = await checkRateLimit(ipHash, 'contact_admin', 10);
        const rlErr = publicRateCheck(rl, req);
        if (rlErr) return rlErr;
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
      }

      case 'provider_admin': {
        const ipHash = await hashIdentifier(getClientIp(req));
        const rl = await checkRateLimit(ipHash, 'provider_admin', 5);
        const rlErr = publicRateCheck(rl, req);
        if (rlErr) return rlErr;
        const interestsList = (payload.interests ?? []).join(', ') || '—';
        const flags: string[] = [];
        if (payload.advertising_interest) flags.push('Publicidad');
        if (payload.founding_provider_interest) flags.push('Proveedor Fundador');
        await sendEmail(
          ADMIN_EMAIL,
          `Nuevo proveedor: ${payload.empresa ?? payload.nombre ?? 'Sin nombre'}`,
          emailWrap('Nuevo lead de proveedor', tableWrap(
            row('Nombre', payload.nombre) +
            row('Empresa', payload.empresa) +
            row('Tipo empresa', payload.company_type) +
            row('Email', payload.email) +
            row('Teléfono', payload.telefono) +
            row('Web', payload.website) +
            row('Provincia', payload.province) +
            row('Intereses', interestsList) +
            row('Flags', flags.length ? flags.join(' · ') : undefined),
          )),
        );
        console.log('[trade-email] provider_admin sent');
        break;
      }

      case 'provider_confirm': {
        if (!payload.email) break;
        const ipHash = await hashIdentifier(getClientIp(req));
        const rl = await checkRateLimit(ipHash, 'provider_confirm', 5);
        const rlErr = publicRateCheck(rl, req);
        if (rlErr) return rlErr;
        await sendEmail(
          payload.email,
          'Hemos recibido tu solicitud — TRABFLOW Proveedores',
          emailWrap('¡Gracias por tu interés!', `
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Hola ${escapeHtml(payload.nombre ?? '')},<br>
              hemos recibido tu solicitud para conectar <strong style="color:#fff">${escapeHtml(payload.empresa ?? 'tu empresa')}</strong> con TrabFlow.
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Nos pondremos en contacto contigo en menos de 24h para continuar la conversación y explicarte cómo funciona el portal de proveedores.
            </p>
            <p style="color:#334155;font-size:12px;margin-top:24px">
              ¿Tienes alguna pregunta urgente? Escríbenos a <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
            </p>
          `),
        );
        console.log(`[trade-email] provider_confirm sent to ${payload.email}`);
        break;
      }

      // ── TIPOS PRIVADOS (requieren JWT válido) ──────────────────────────────────

      case 'welcome': {
        // El usuario acaba de registrarse y tiene sesión activa — JWT obligatorio
        const user = await verifyJwt(req);
        if (!user) return json401(req);
        if (!payload.email) break;
        await sendEmail(
          payload.email,
          '¡Bienvenido a TRABFLOW! Tu cuenta está lista',
          emailWrap('¡Cuenta creada con éxito!', `
            <p style="color:#94a3b8;font-size:14px;line-height:1.6">
              Hola ${escapeHtml(payload.nombre ?? 'instalador')}, tu cuenta de TRABFLOW está lista.
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
        break;
      }

      case 'support_admin': {
        // Solo usuarios autenticados pueden abrir tickets desde el panel
        const user = await verifyJwt(req);
        if (!user) return json401(req);
        await sendEmail(
          ADMIN_EMAIL,
          `Ticket de soporte: ${payload.oficio ?? 'Sin asunto'} — ${payload.nombre ?? ''}`,
          emailWrap('Nuevo ticket de soporte desde el panel', tableWrap(
            row('Usuario', payload.nombre) +
            row('Email', payload.email) +
            row('Auth UID', user.userId) +
            row('Asunto', payload.oficio) +
            row('Descripción', payload.ciudad) +
            row('Org ID', payload.presupuestos_al_mes),
          )),
        );
        console.log('[trade-email] support_admin sent');
        break;
      }

      case 'ad_document': {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json503(req);

        // Solo administradores del actor de tipo 'platform' (TrabFlow).
        // Un proveedor o distribuidor con membresía en su propio actor NO tiene este permiso.
        const user = await verifyJwt(req);
        if (!user) return json401(req);

        const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Paso 1: obtener IDs de actores con actor_type = 'platform'
        const { data: platformActors, error: paErr } = await adminDb
          .from('trade_marketplace_actors')
          .select('id')
          .eq('actor_type', 'platform');

        if (paErr || !platformActors || platformActors.length === 0) {
          console.error('[trade-email] platform actors query error:', paErr?.message);
          return json503(req, 'Error al verificar permisos de plataforma');
        }

        // Paso 2: verificar que el usuario es miembro activo de algún actor de plataforma
        const { data: platformMember } = await adminDb
          .from('trade_marketplace_actor_members')
          .select('id')
          .eq('user_id', user.userId)
          .eq('activo', true)
          .in('actor_id', platformActors.map((a: { id: string }) => a.id))
          .limit(1)
          .maybeSingle();

        if (!platformMember) return json403(req, 'Sin permisos de administrador de plataforma');

        const toAddr = payload.to_email;
        if (!toAddr) return json400(req, 'to_email requerido');

        const docNum    = payload.doc_number    ?? '—';
        const customer  = payload.customer_name ?? '';
        const concept   = payload.concept       ?? 'Publicidad Marketplace TrabFlow';
        const slotName  = payload.slot_nombre   ?? '';
        const comValue  = payload.commercial_value != null ? `${payload.commercial_value.toFixed(2)} €` : '';
        const periodStr = [payload.period_start, payload.period_end].filter(Boolean).join(' – ');

        const rawMsg = payload.custom_message
          ? escapeHtml(payload.custom_message).replace(/\n/g, '<br>')
          : `Hola ${escapeHtml(customer)},<br><br>Te adjuntamos el resumen correspondiente a tu reserva publicitaria en TrabFlow Marketplace.`;

        // Validar URL del documento: solo https:// para evitar javascript: u otros esquemas
        const safeDocUrl = (payload.doc_url ?? '').startsWith('https://') ? payload.doc_url! : '';
        const docLink = safeDocUrl
          ? `<div style="margin:20px 0"><a href="${safeDocUrl}" style="display:inline-block;background:#7c3aed;color:#fff;font-weight:700;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px">Ver documento →</a></div>`
          : '';

        await sendEmail(
          toAddr,
          `Documento de publicidad TrabFlow — ${docNum}`,
          emailWrap(`Publicidad TrabFlow — ${escapeHtml(docNum)}`, `
            <p style="color:#94a3b8;font-size:14px;line-height:1.7">${rawMsg}</p>
            ${tableWrap(
              row('Documento',       docNum)                 +
              row('Espacio',         slotName || undefined)  +
              row('Concepto',        concept)                +
              row('Periodo',         periodStr || undefined) +
              row('Valor comercial', comValue  || undefined) +
              row('Estado',          'BONIFICADA — Fase validación comercial'),
            )}
            ${docLink}
            <p style="color:#475569;font-size:12px;margin-top:24px">
              ¿Tienes preguntas? Escríbenos a
              <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
            </p>
          `),
        );
        console.log(`[trade-email] ad_document sent to ${toAddr} doc=${docNum}`);
        break;
      }

      // ── send_to_client: email de org a su cliente ──────────────────────────────
      // JWT obligatorio + verificación de membresía + email obtenido de BD (nunca del payload).
      // Rate limit: fail-closed — si la RPC falla se devuelve 503, igual que los tipos públicos.

      case 'send_to_client': {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return json503(req);

        const user = await verifyJwt(req);
        if (!user) return json401(req, 'No autorizado. Inicia sesión de nuevo.');

        if (!payload.client_id || !payload.org_id || !payload.subject?.trim() || !payload.body?.trim()) {
          return json400(req, 'Campos requeridos: client_id, org_id, subject, body');
        }

        const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Verificar que el usuario es propietario o miembro activo de la org
        const { data: orgRow } = await adminDb
          .from('trade_organizations')
          .select('owner_id, nombre')
          .eq('id', payload.org_id)
          .maybeSingle();

        if (!orgRow) return json403(req, 'Organización no encontrada');

        let isMember = orgRow.owner_id === user.userId;
        if (!isMember) {
          const { data: memberRow } = await adminDb
            .from('trade_org_members')
            .select('id')
            .eq('org_id', payload.org_id)
            .eq('user_id', user.userId)
            .eq('activo', true)
            .maybeSingle();
          isMember = !!memberRow;
        }
        if (!isMember) return json403(req, 'Sin permisos para esta organización');

        // Email del cliente obtenido de BD — nunca del payload del cliente
        const { data: clientRow } = await adminDb
          .from('trade_clients')
          .select('email, nombre')
          .eq('id', payload.client_id)
          .eq('org_id', payload.org_id)
          .maybeSingle();

        if (!clientRow) return json403(req, 'Cliente no encontrado o sin permisos');
        if (!clientRow.email) return json400(req, 'El cliente no tiene email registrado');

        // Rate limit por usuario autenticado (20 por hora). Fail-closed: si la RPC falla → 503.
        const userHash = await hashIdentifier(user.userId);
        const rl = await checkRateLimit(userHash, 'send_to_client', 20);
        if (rl === 'exceeded') return json429(req);
        if (rl === 'error')    return json503(req, 'Control de frecuencia no disponible. Inténtalo más tarde.');

        const safeSubject = payload.subject.trim().slice(0, 200);
        const safeBody    = escapeHtml(payload.body.trim().slice(0, 4000)).replace(/\n/g, '<br>');
        const orgName     = escapeHtml(orgRow.nombre ?? 'TrabFlow');

        await sendEmail(
          clientRow.email,
          safeSubject,
          emailWrap(escapeHtml(safeSubject), `
            <p style="color:#475569;font-size:12px;margin-bottom:16px">
              Mensaje de <strong style="color:#f1f5f9">${orgName}</strong>
            </p>
            <p style="color:#94a3b8;font-size:14px;line-height:1.7">${safeBody}</p>
            <p style="color:#334155;font-size:11px;margin-top:24px">
              Este email ha sido enviado a través de TrabFlow ·
              <a href="mailto:contacto@trabflow.com" style="color:#00CFE8">contacto@trabflow.com</a>
            </p>
          `),
        );
        console.log(`[trade-email] send_to_client sent to ${clientRow.email} org=${payload.org_id}`);
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown type: ${(payload as { type: string }).type}` }),
          { status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' } },
        );
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
