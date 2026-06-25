import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@trabflow.com';
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  if (!req.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401, headers: cors(req) });
  }

  const body = await req.json() as {
    worker_ids?: string[];
    org_id?: string;
    title: string;
    body_text: string;
    url?: string;
  };

  if (!body.title) {
    return new Response(JSON.stringify({ error: 'title requerido' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const db = createClient(SUPABASE_URL, SERVICE_KEY);

  let query = db.from('trade_push_subscriptions').select('subscription');
  if (body.worker_ids?.length) {
    query = query.in('worker_id', body.worker_ids);
  } else if (body.org_id) {
    query = query.eq('org_id', body.org_id);
  } else {
    return new Response(JSON.stringify({ error: 'Indica worker_ids u org_id' }), {
      status: 400, headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const { data: subs } = await query;
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify({
    title: body.title,
    body:  body.body_text,
    url:   body.url ?? '/',
  });

  const results = await Promise.allSettled(
    subs.map((s: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }) =>
      webpush.sendNotification(s.subscription, payload)
    )
  );

  // Eliminar suscripciones caducadas (410 Gone del push service)
  const expired: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 410 || status === 404) {
        expired.push((subs[i] as { subscription: { endpoint: string } }).subscription.endpoint);
      }
    }
  });
  if (expired.length) {
    await db.from('trade_push_subscriptions').delete().in('endpoint', expired);
  }

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});


