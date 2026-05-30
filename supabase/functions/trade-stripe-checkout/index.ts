import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY    = Deno.env.get('STRIPE_TRABFLOW_SECRET_KEY') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const stripe = (path: string, method: string, params?: URLSearchParams) =>
  fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params?.toString(),
  });

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
    supabase.from('trade_subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, plan, billing_cycle, status')
      .eq('org_id', org_id).single(),
  ]);

  const org = orgRes.data;
  const sub = subRes.data;

  const plan  = body.plan          ?? sub?.plan          ?? 'profesional';
  const cycle = body.billing_cycle ?? sub?.billing_cycle ?? 'monthly';

  // Leer price ID desde BD
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

  // ── CASO A: ya tiene suscripción activa → Subscription Update (sin nueva Checkout) ──
  let existingSubId = sub?.stripe_subscription_id;

  // Si no tenemos el ID en BD pero sí el customer_id, consultamos Stripe directamente
  // (esto ocurre cuando los webhooks fallaron y no guardaron stripe_subscription_id)
  if (!existingSubId && sub?.stripe_customer_id) {
    const listRes = await stripe(
      `/subscriptions?customer=${sub.stripe_customer_id}&status=active&limit=1`,
      'GET',
    );
    if (listRes.ok) {
      const listJson = await listRes.json() as { data?: Array<{ id: string }> };
      const found = listJson.data?.[0]?.id;
      if (found) {
        existingSubId = found;
        // Sincronizar en BD para próximas llamadas
        await supabase.from('trade_subscriptions').update({
          stripe_subscription_id: found,
          status: 'active',
          updated_at: new Date().toISOString(),
        }).eq('org_id', org_id);
      }
    }
  }

  if (existingSubId) {
    // Obtener el item actual de la suscripción
    const getRes  = await stripe(`/subscriptions/${existingSubId}`, 'GET');
    const getJson = await getRes.json() as {
      items?: { data: Array<{ id: string }> };
      error?: { message: string };
    };

    if (!getRes.ok) {
      return new Response(JSON.stringify({ error: getJson.error?.message ?? 'Error obteniendo suscripción Stripe' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const itemId = getJson.items?.data?.[0]?.id;
    if (!itemId) {
      return new Response(JSON.stringify({ error: 'No se encontró el item de la suscripción' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Actualizar la suscripción existente con el nuevo precio
    const up = new URLSearchParams();
    up.set(`items[0][id]`,    itemId);
    up.set(`items[0][price]`, priceRow.stripe_price_id);
    up.set('proration_behavior',         'create_prorations');
    up.set('metadata[org_id]',           org_id);
    up.set('metadata[plan]',             plan);
    up.set('metadata[billing_cycle]',    cycle);

    const upRes  = await stripe(`/subscriptions/${existingSubId}`, 'POST', up);
    const upJson = await upRes.json() as {
      id?: string;
      current_period_start?: number;
      current_period_end?: number;
      error?: { message: string };
    };

    if (!upRes.ok) {
      return new Response(JSON.stringify({ error: upJson.error?.message ?? 'Error actualizando suscripción' }), {
        status: 502, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Actualizar BD inmediatamente (el webhook también lo hará, pero esto da feedback instantáneo)
    await supabase.from('trade_subscriptions').update({
      plan,
      billing_cycle:        cycle,
      current_period_start: upJson.current_period_start
        ? new Date(upJson.current_period_start * 1000).toISOString()
        : undefined,
      current_period_end:   upJson.current_period_end
        ? new Date(upJson.current_period_end * 1000).toISOString()
        : undefined,
      updated_at: new Date().toISOString(),
    }).eq('org_id', org_id);

    // También actualizar plan en trade_organizations para consistencia
    await supabase.from('trade_organizations').update({ plan }).eq('id', org_id);

    return new Response(JSON.stringify({ ok: true, upgraded: true, plan, billing_cycle: cycle }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // ── CASO B: sin suscripción activa → nueva Checkout Session ──────────────────
  let customerId = sub?.stripe_customer_id ?? null;

  if (!customerId) {
    const cp = new URLSearchParams();
    if (org?.nombre) cp.set('name', org.nombre);
    if (org?.email)  cp.set('email', org.email);
    cp.set('metadata[org_id]', org_id);

    const cr   = await stripe('/customers', 'POST', cp);
    const cust = await cr.json() as { id?: string; error?: { message: string } };
    if (!cr.ok) {
      return new Response(JSON.stringify({ error: cust.error?.message ?? 'Error creando cliente Stripe' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    customerId = cust.id ?? null;
    if (customerId) {
      await supabase.from('trade_subscriptions')
        .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
        .eq('org_id', org_id);
    }
  }

  const sp = new URLSearchParams();
  sp.set('customer',                                customerId!);
  sp.set('mode',                                    'subscription');
  sp.set('line_items[0][price]',                    priceRow.stripe_price_id);
  sp.set('line_items[0][quantity]',                 '1');
  sp.set('success_url',                             success_url ?? 'https://trabflow.com/?checkout=success');
  sp.set('cancel_url',                              cancel_url  ?? 'https://trabflow.com/');
  sp.set('metadata[org_id]',                        org_id);
  sp.set('metadata[plan]',                          plan);
  sp.set('metadata[billing_cycle]',                 cycle);
  sp.set('subscription_data[metadata][org_id]',     org_id);
  sp.set('subscription_data[metadata][plan]',       plan);
  sp.set('subscription_data[metadata][billing_cycle]', cycle);
  sp.set('automatic_tax[enabled]',                  'true');
  sp.set('billing_address_collection',              'required');
  sp.set('customer_update[address]',                'auto');
  sp.set('customer_update[name]',                   'auto');
  sp.set('tax_id_collection[enabled]',              'true');
  sp.set('allow_promotion_codes',                   'true');

  const sr      = await stripe('/checkout/sessions', 'POST', sp);
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
