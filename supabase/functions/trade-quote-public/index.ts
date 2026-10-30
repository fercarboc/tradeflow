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

  // ── GET ──────────────────────────────────────────────────────────────────────
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

  // ── ACCEPT (transaccional) ───────────────────────────────────────────────────
  // Una única RPC PostgreSQL realiza de forma atómica:
  //   1. SELECT FOR UPDATE en token (idempotencia concurrente)
  //   2. SELECT FOR UPDATE en quote (estado, vertical)
  //   3. UPDATE token → 'accepted'
  //   4. UPDATE quote → 'Aceptado'
  //   5. Si vertical='transporte': create_transport_service_from_quote (mismo TX)
  //      Si el servicio falla: error en metadata.transport_service_error,
  //      la aceptación permanece comprometida.
  if (action === 'accept') {
    const { data: acceptResult, error: acceptError } = await adminClient.rpc(
      'accept_quote_public',
      { p_token: token },
    );

    if (acceptError) {
      console.error(`[${requestId}] accept_quote_public RPC error`, {
        error: acceptError.message,
      });
      return new Response(JSON.stringify({ error: acceptError.message }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    if (!acceptResult) {
      return new Response(JSON.stringify({ error: 'no_result_from_rpc' }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // Token ya procesado (idempotente)
    if ((acceptResult as Record<string, unknown>)['already_processed']) {
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    // Error de validación devuelto por la RPC (quote no encontrado, estado incompatible)
    if ((acceptResult as Record<string, unknown>)['error']) {
      const rpcError = (acceptResult as Record<string, unknown>)['error'] as string;
      const status = rpcError === 'quote_not_found' ? 404
                   : rpcError === 'quote_state_incompatible' ? 409
                   : 500;
      return new Response(JSON.stringify(acceptResult), {
        status,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const result = acceptResult as Record<string, unknown>;

    // Notificación push (fire-and-forget — no bloquea la respuesta al cliente)
    notifyOrgQuoteAccepted(
      result['org_id'] as string,
      result['quote_numero'] as string,
      result['client_name'] as string | null,
    );

    // Loguear si la creación del servicio tuvo un error interno (para monitoring)
    if (result['service_result']) {
      const svcResult = result['service_result'] as Record<string, unknown>;
      if (svcResult['ok'] === false) {
        console.warn(`[${requestId}] transport service creation error recorded in metadata`, {
          org_id:       result['org_id'],
          quote_numero: result['quote_numero'],
          code:         svcResult['code'],
          message:      svcResult['message'],
        });
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      transport_service_id: result['transport_service_id'] ?? null,
    }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  // ── REJECT ───────────────────────────────────────────────────────────────────
  // Flujo simple: leer token pendiente → marcar rechazado.
  // No toca trade_quotes (el presupuesto permanece en su estado previo).
  if (action === 'reject') {
    const { data: tokenRow } = await adminClient
      .from('trade_quote_tokens')
      .select('org_id, quote_numero, client_name')
      .eq('token', token)
      .eq('status', 'pending')
      .maybeSingle();

    if (!tokenRow) {
      return new Response(JSON.stringify({ ok: true, already_processed: true }), {
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    const { error: tokenError } = await adminClient
      .from('trade_quote_tokens')
      .update({ status: 'rejected', accepted_at: null })
      .eq('token', token)
      .eq('status', 'pending');

    if (tokenError) {
      return new Response(JSON.stringify({ error: tokenError.message }), {
        status: 500,
        headers: { ...cors(req), 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, transport_service_id: null }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ error: 'Unknown action' }), {
    status: 400,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});
