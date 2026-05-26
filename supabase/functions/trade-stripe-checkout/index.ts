import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_TRABFLOW_SECRET_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// Price IDs se leen de trade_stripe_prices en BD — actualizables sin redesplegar

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!req.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
  }

  const body = await req.json() as {
    org_id: string;
    plan?: string;
    billing_cycle?: string;
    success_url?: string;
    cancel_url?: string;
  };
  const { org_id, success_url, cancel_url } = body;

  if (!org_id) {
    return new Response(JSON.stringify({ error: 'org_id requerido' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const [orgRes, subRes] = await Promise.all([
    supabase.from('trade_organizations').select('nombre, email').eq('id', org_id).single(),
    supabase.from('trade_subscriptions').select('stripe_customer_id, plan, billing_cycle').eq('org_id', org_id).single(),
  ]);

  const org = orgRes.data;
  const sub = subRes.data;

  let customerId = sub?.stripe_customer_id ?? null;

  // Crear cliente Stripe si no existe
  if (!customerId) {
    const cp = new URLSearchParams();
    if (org?.nombre) cp.set('name', org.nombre);
    if (org?.email)  cp.set('email', org.email);
    cp.set('metadata[org_id]', org_id);

    const cr = await fetch('https://api.stripe.com/v1/customers', {
      method:  'POST',
      headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    cp.toString(),
    });
    const customer = await cr.json() as { id?: string; error?: { message: string } };
    if (!cr.ok) {
      return new Response(JSON.stringify({ error: customer.error?.message ?? 'Error creando cliente Stripe' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    customerId = customer.id ?? null;
    if (customerId) {
      await supabase.from('trade_subscriptions')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('org_id', org_id);
    }
  }

  const plan  = body.plan          ?? sub?.plan          ?? 'pro';
  const cycle = body.billing_cycle ?? sub?.billing_cycle ?? 'monthly';

  // Leer price ID desde BD — si cambia el precio en Stripe, solo actualizar la tabla
  const { data: priceRow } = await supabase
    .from('trade_stripe_prices')
    .select('stripe_price_id')
    .eq('plan', plan)
    .eq('billing_cycle', cycle)
    .eq('active', true)
    .single();

  if (!priceRow?.stripe_price_id) {
    return new Response(JSON.stringify({ error: `Price ID no encontrado para ${plan}/${cycle}. Revisar tabla trade_stripe_prices.` }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const sp = new URLSearchParams();
  sp.set('customer',                            customerId!);
  sp.set('mode',                                'subscription');
  sp.set('line_items[0][price]',                priceRow.stripe_price_id);
  sp.set('line_items[0][quantity]',             '1');
  sp.set('success_url',                         success_url ?? 'https://trabflow.com/?checkout=success');
  sp.set('cancel_url',                          cancel_url  ?? 'https://trabflow.com/');
  sp.set('metadata[org_id]',                   org_id);
  sp.set('subscription_data[metadata][org_id]', org_id);

  const sr      = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method:  'POST',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    sp.toString(),
  });
  const session = await sr.json() as { url?: string; error?: { message: string } };

  if (!sr.ok) {
    return new Response(JSON.stringify({ error: session.error?.message ?? 'Error Stripe Checkout' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ url: session.url }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
