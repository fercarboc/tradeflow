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
    // Obtener datos del token antes de actualizar (para la notificación)
    const { data: tokenRow } = await adminClient
      .from('trade_quote_tokens')
      .select('org_id, quote_numero, client_name')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    const { error } = await adminClient
      .from('trade_quote_tokens')
      .update({
        status: action === 'accept' ? 'accepted' : 'rejected',
        accepted_at: action === 'accept' ? new Date().toISOString() : null,
      })
      .eq('token', token)
      .eq('status', 'pending');

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // Notificar al org si el cliente aceptó
    if (action === 'accept' && tokenRow?.org_id) {
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



