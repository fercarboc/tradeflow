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

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors(req) });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  let body: { token?: string };
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const { token } = body;
  if (!token || typeof token !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing token' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const { data: inv, error: invErr } = await adminClient
    .from('trade_invoices')
    .select('*, trade_clients(nombre, nif, telefono, direccion, ciudad), trade_invoice_lines(*)')
    .eq('view_token', token)
    .maybeSingle();

  if (invErr) {
    return new Response(JSON.stringify({ error: invErr.message }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }
  if (!inv) {
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const { data: org } = await adminClient
    .from('trade_organizations')
    .select('nombre, razon_social, nif, direccion, ciudad, telefono, email, logo_url')
    .eq('id', inv.org_id)
    .maybeSingle();

  // Fetch fiscal snapshot for QR AEAT (service_role bypasses RLS on fiscal ledger)
  let fiscalSnapshot = null;
  if (inv.fiscal_record_id) {
    const { data: fr } = await adminClient
      .from('trade_fiscal_records')
      .select('nif_emisor, numero_factura, fecha_expedicion_vf, importe_total')
      .eq('id', inv.fiscal_record_id)
      .maybeSingle();
    fiscalSnapshot = fr ?? null;
  }

  return new Response(JSON.stringify({ invoice: inv, org: org ?? {}, fiscalSnapshot }), {
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});



