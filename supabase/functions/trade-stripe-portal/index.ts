import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_TRABFLOW_SECRET_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!req.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const { org_id, return_url } = await req.json() as { org_id: string; return_url?: string };
  if (!org_id) {
    return new Response(JSON.stringify({ error: 'org_id requerido' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: sub } = await supabase
    .from('trade_subscriptions')
    .select('stripe_customer_id')
    .eq('org_id', org_id)
    .single();

  if (!sub?.stripe_customer_id) {
    return new Response(JSON.stringify({ error: 'No hay cliente Stripe para esta organización' }), {
      status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams({
    customer:   sub.stripe_customer_id,
    return_url: return_url ?? 'https://trabflow.com',
  });

  const res  = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  const data = await res.json() as { url?: string; error?: { message: string } };

  if (!res.ok) {
    return new Response(JSON.stringify({ error: data.error?.message ?? 'Error Stripe' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: data.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
