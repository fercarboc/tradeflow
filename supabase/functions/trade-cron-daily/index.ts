import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET   = Deno.env.get('CRON_INVOICE_SECRET') ?? '';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401, headers: cors(req) });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  // Mark overdue invoices as Vencida
  const today = new Date().toISOString().split('T')[0];
  const { data: overdueInvoices, error } = await db
    .from('trade_invoices')
    .update({ estado: 'Vencida' })
    .lt('fecha_vencimiento', today)
    .in('estado', ['Emitida', 'Enviada', 'Pendiente'])
    .select('id, org_id, numero, cliente_nombre');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const updated = overdueInvoices?.length ?? 0;

  // Collect distinct org_ids
  const orgIds = [...new Set((overdueInvoices ?? []).map((i: { org_id: string }) => i.org_id))];

  // Fire push notification per org
  const pushResults = await Promise.allSettled(
    orgIds.map((orgId: string) => {
      const count = (overdueInvoices ?? []).filter((i: { org_id: string }) => i.org_id === orgId).length;
      const bodyText = count === 1
        ? 'Tienes una factura vencida pendiente de cobro'
        : `Tienes ${count} facturas vencidas pendientes de cobro`;
      return fetch(`${SUPABASE_URL}/functions/v1/trade-push-notify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: orgId,
          title: '⚠️ Facturas vencidas',
          body_text: bodyText,
          url: '/facturas',
        }),
      });
    })
  );

  const pushed = pushResults.filter(r => r.status === 'fulfilled').length;

  return new Response(JSON.stringify({ updated, orgs_notified: pushed }), {
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});



