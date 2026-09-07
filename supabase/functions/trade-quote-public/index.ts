import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
    'Vary': 'Origin',
  };
}

async function notifyOrgQuoteAccepted(orgId: string, quoteNumero: string, clientName: string | null) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/trade-push-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        org_id: orgId,
        title: '¡Presupuesto aceptado! 🎉',
        body_text: `${clientName ?? 'El cliente'} ha aceptado el presupuesto ${quoteNumero}`,
        url: '/',
      }),
    });
  } catch {
    // fire-and-forget — no bloquea la respuesta al cliente
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  let body: { token?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const { token, action } = body;

  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  if (action === 'get') {
    const { data, error } = await adminClient
      .from('trade_quote_tokens')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  if (action === 'accept' || action === 'reject') {
    // ── 1. Leer token (confirmar que está pendiente) ──────────────────────────
    const { data: tokenRow } = await adminClient
      .from('trade_quote_tokens')
      .select('org_id, quote_numero, client_name')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (!tokenRow) {
      // Token inexistente, ya procesado o expirado — respuesta idempotente.
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Para 'accept': validar estado del presupuesto ANTES de mutar nada ─
    // Estados terminales incompatibles: Rechazado, Expirado, Facturado.
    // El token NO se marca accepted si el quote no puede avanzar.
    const ACCEPT_ALLOWED = ['Borrador', 'Enviado', 'Aceptado'];
    if (action === 'accept') {
      const { data: quoteRow, error: quoteReadError } = await adminClient
        .from('trade_quotes')
        .select('estado')
        .eq('org_id', tokenRow.org_id)
        .eq('numero', tokenRow.quote_numero)
        .maybeSingle();

      if (quoteReadError) {
        return new Response(JSON.stringify({ error: 'error_reading_quote' }), {
          status: 500,
          headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      if (!quoteRow) {
        return new Response(JSON.stringify({ error: 'quote_not_found' }), {
          status: 404,
          headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      if (!ACCEPT_ALLOWED.includes(quoteRow.estado)) {
        // Quote en estado terminal incompatible: no escribir nada.
        return new Response(JSON.stringify({ error: 'quote_state_incompatible', quote_estado: quoteRow.estado }), {
          status: 409,
          headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }
    }

    // ── 3. Actualizar token (quote validado o acción = reject) ────────────────
    const { error: tokenError } = await adminClient
      .from('trade_quote_tokens')
      .update({
        status: action === 'accept' ? 'accepted' : 'rejected',
        accepted_at: action === 'accept' ? new Date().toISOString() : null,
      })
      .eq('token', token)
      .eq('status', 'pending');

    if (tokenError) {
      return new Response(JSON.stringify({ error: tokenError.message }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Sincronizar trade_quotes.estado (solo para accept) ─────────────────
    // ATOMIC DB TRANSACTION: NO — dos writes secuenciales sin RPC transaccional.
    // Si este write falla, el token ya está accepted pero el quote no avanza:
    // se devuelve error (no { ok: true }) para que el cliente sea consciente.
    // La inconsistencia queda visible y corregible manualmente o por soporte.
    if (action === 'accept') {
      const { error: quoteUpdateError } = await adminClient
        .from('trade_quotes')
        .update({ estado: 'Aceptado' })
        .eq('org_id', tokenRow.org_id)
        .eq('numero', tokenRow.quote_numero)
        .in('estado', ACCEPT_ALLOWED);

      if (quoteUpdateError) {
        console.error(`[${requestId}] INCONSISTENCY: token accepted but quote update failed`, {
          org_id: tokenRow.org_id,
          quote_numero: tokenRow.quote_numero,
          error: quoteUpdateError.message,
        });
        return new Response(JSON.stringify({ error: 'quote_update_failed', detail: quoteUpdateError.message }), {
          status: 500,
          headers: { ...cors(req), 'Content-Type': 'application/json' },
        });
      }

      notifyOrgQuoteAccepted(tokenRow.org_id, tokenRow.quote_numero, tokenRow.client_name);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});



