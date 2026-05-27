import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@trabflow.com';
const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── VAPID JWT signing ─────────────────────────────────────────────────────────

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function buildVapidAuthHeader(audience: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const header  = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp, sub: VAPID_SUBJECT };
  const encode  = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsigned = `${encode(header)}.${encode(payload)}`;

  const keyData = urlBase64ToUint8Array(VAPID_PRIVATE);
  const key = await crypto.subtle.importKey(
    'raw', keyData,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const token = `${unsigned}.${sigB64}`;
  return `vapid t=${token},k=${VAPID_PUBLIC}`;
}

async function sendPush(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, payload: string): Promise<void> {
  const url      = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const auth     = await buildVapidAuthHeader(audience);

  const res = await fetch(sub.endpoint, {
    method:  'POST',
    headers: {
      'Authorization':  auth,
      'Content-Type':   'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':            '86400',
    },
    body: new TextEncoder().encode(payload),
  });

  if (!res.ok && res.status !== 201) {
    const body = await res.text();
    throw new Error(`Push failed ${res.status}: ${body}`);
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (!req.headers.get('Authorization')) {
    return new Response('Unauthorized', { status: 401, headers: CORS });
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
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  let query = supabase.from('trade_push_subscriptions').select('subscription');
  if (body.worker_ids?.length) {
    query = query.in('worker_id', body.worker_ids);
  } else if (body.org_id) {
    query = query.eq('org_id', body.org_id);
  } else {
    return new Response(JSON.stringify({ error: 'Indica worker_ids u org_id' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { data: subs } = await query;
  if (!subs?.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const payload = JSON.stringify({ title: body.title, body: body.body_text, url: body.url ?? '/' });
  const results = await Promise.allSettled(
    subs.map((s: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }) =>
      sendPush(s.subscription, payload)
    )
  );

  const sent   = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return new Response(JSON.stringify({ sent, failed }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
