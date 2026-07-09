import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY     = Deno.env.get('STRIPE_TRABFLOW_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_TRABFLOW_SECRET') ?? '';
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ALLOWED_ORIGINS = ['https://trabflow.com', 'https://www.trabflow.com', 'http://localhost:5173', 'http://localhost:4173'];
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Vary': 'Origin',
  };
}

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  if (!secret) return false;
  try {
    const parts     = sigHeader.split(',');
    const timestamp = parts.find(p => p.startsWith('t='))?.slice(2);
    const signatures = parts.filter(p => p.startsWith('v1=')).map(p => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    if (Math.abs(Date.now() / 1000 - parseInt(timestamp, 10)) > 300) return false;

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`));
    const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return signatures.some(s => s === expected);
  } catch (e) {
    console.error('[webhook] Error en verificación de firma:', e);
    return false;
  }
}

async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.error('[webhook] Error cancelando suscripción antigua:', subscriptionId, body);
  }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] CRÍTICO: STRIPE_WEBHOOK_TRABFLOW_SECRET no está configurado en los secrets de Supabase');
    return new Response(JSON.stringify({ error: 'Webhook secret not configured. Set STRIPE_WEBHOOK_TRABFLOW_SECRET via: supabase secrets set STRIPE_WEBHOOK_TRABFLOW_SECRET=whsec_...' }), {
      status: 500,
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  const body      = await req.text();
  const sigHeader = req.headers.get('stripe-signature') ?? '';

  if (!(await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET))) {
    console.error('[webhook] Firma inválida. Verifica que STRIPE_WEBHOOK_TRABFLOW_SECRET coincide con el signing secret del endpoint en Stripe Dashboard.');
    return new Response('Invalid signature', { status: 400 });
  }

  let event: { type: string; data: { object: unknown } };
  try {
    event = JSON.parse(body);
  } catch (e) {
    console.error('[webhook] JSON inválido:', e);
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log('[webhook] Evento recibido:', event.type);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // ── checkout.session.completed ───────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: Record<string, string>;
        customer?: string;
        subscription?: string;
        payment_status?: string;
      };
      const orgId        = session.metadata?.org_id;
      const plan         = session.metadata?.plan;
      const billingCycle = session.metadata?.billing_cycle;
      const newSubId     = session.subscription;
      // no_payment_required → trial (trial gratuito configurado con trial_period_days)
      const isTrialCheckout = session.payment_status === 'no_payment_required';

      console.log('[webhook] checkout.session.completed — org_id:', orgId, 'plan:', plan, 'sub_id:', newSubId, 'payment_status:', session.payment_status);

      if (orgId && plan) {
        // Cancelar cualquier suscripción anterior diferente a la nueva
        if (newSubId) {
          const { data: existing } = await supabase
            .from('trade_subscriptions')
            .select('stripe_subscription_id')
            .eq('org_id', orgId)
            .maybeSingle();

          const oldSubId = existing?.stripe_subscription_id;
          if (oldSubId && oldSubId !== newSubId) {
            console.log('[webhook] Cancelando suscripción antigua:', oldSubId);
            await cancelStripeSubscription(oldSubId);
          }
        }

        const updates: Record<string, string> = {
          plan,
          billing_cycle: billingCycle ?? 'monthly',
          status:        isTrialCheckout ? 'trial' : 'active',
          updated_at:    new Date().toISOString(),
        };
        if (session.customer) updates.stripe_customer_id     = session.customer;
        if (newSubId)         updates.stripe_subscription_id = newSubId;

        const { error: updateErr } = await supabase
          .from('trade_subscriptions')
          .update(updates)
          .eq('org_id', orgId);

        if (updateErr) console.error('[webhook] Error actualizando trade_subscriptions:', updateErr);

        const { error: orgErr } = await supabase
          .from('trade_organizations')
          .update({ plan })
          .eq('id', orgId);

        if (orgErr) console.error('[webhook] Error actualizando trade_organizations:', orgErr);

        console.log('[webhook] checkout.session.completed procesado OK');
      } else {
        console.warn('[webhook] checkout.session.completed sin org_id o plan en metadata');
      }
    }

    // ── customer.subscription.created ────────────────────────────────────────
    if (event.type === 'customer.subscription.created') {
      const sub = event.data.object as {
        id: string;
        customer: string;
        status: string;
        metadata?: Record<string, string>;
        current_period_start: number;
        current_period_end: number;
        trial_end?: number | null;
      };
      const plan = sub.metadata?.plan;

      console.log('[webhook] customer.subscription.created — sub_id:', sub.id, 'customer:', sub.customer, 'plan:', plan, 'status:', sub.status);

      if (plan) {
        // Stripe 'trialing' → DB 'trial' (compatible con CHECK constraint y frontend)
        // trial_end se actualiza con la fecha real de Stripe para el countdown
        const status = sub.status === 'trialing' ? 'trial' : 'active';
        const updates: Record<string, unknown> = {
          plan,
          status,
          stripe_subscription_id: sub.id,
          current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
          updated_at:             new Date().toISOString(),
        };
        if (sub.trial_end) updates.trial_end = new Date(sub.trial_end * 1000).toISOString();

        const { error: updateErr } = await supabase.from('trade_subscriptions').update(updates).eq('stripe_customer_id', sub.customer);

        if (updateErr) console.error('[webhook] Error en subscription.created update:', updateErr);

        const { data: orgSub } = await supabase
          .from('trade_subscriptions').select('org_id')
          .eq('stripe_customer_id', sub.customer).maybeSingle();

        if (orgSub?.org_id) {
          await supabase.from('trade_organizations').update({ plan }).eq('id', orgSub.org_id);
        }
        console.log('[webhook] customer.subscription.created procesado OK');
      } else {
        console.warn('[webhook] subscription.created sin plan en metadata — sub_id:', sub.id);
      }
    }

    // ── customer.subscription.updated ────────────────────────────────────────
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as {
        id: string;
        customer: string;
        status: string;
        metadata?: Record<string, string>;
        current_period_start: number;
        current_period_end: number;
        items?: { data: Array<{ price: { id: string; metadata?: Record<string, string> } }> };
      };

      const plan = sub.metadata?.plan ?? sub.items?.data[0]?.price?.metadata?.plan;

      const updates: Record<string, unknown> = {
        stripe_subscription_id: sub.id,
        current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
        updated_at:             new Date().toISOString(),
      };

      // Stripe 'trialing' → DB 'trial' (compatible con CHECK constraint y frontend)
      if (sub.status === 'active')   updates.status = 'active';
      if (sub.status === 'trialing') updates.status = 'trial';
      if (sub.status === 'canceled') updates.status = 'cancelled';
      if (sub.status === 'past_due') updates.status = 'expired';
      if (plan) updates.plan = plan;

      await supabase.from('trade_subscriptions').update(updates).eq('stripe_customer_id', sub.customer);

      if (plan) {
        const { data: orgSub } = await supabase
          .from('trade_subscriptions').select('org_id')
          .eq('stripe_customer_id', sub.customer).maybeSingle();
        if (orgSub?.org_id) {
          await supabase.from('trade_organizations').update({ plan }).eq('id', orgSub.org_id);
        }
      }
      console.log('[webhook] customer.subscription.updated procesado OK — status:', sub.status, 'plan:', plan);
    }

    // ── invoice.paid ─────────────────────────────────────────────────────────
    if (event.type === 'invoice.paid') {
      const inv = event.data.object as {
        id: string;
        customer: string;
        subscription: string;
        amount_paid: number;
        period_start: number;
        period_end: number;
        hosted_invoice_url?: string;
        invoice_pdf?: string;
        lines?: { data: Array<{ plan?: { metadata?: Record<string, string> } }> };
      };

      const plan = inv.lines?.data[0]?.plan?.metadata?.plan;
      const isPaidInvoice = inv.amount_paid > 0;

      // maybeSingle evita error cuando no hay filas (vs .single() que devuelve error)
      const { data: sub } = await supabase
        .from('trade_subscriptions')
        .select('id, org_id')
        .eq('stripe_customer_id', inv.customer)
        .maybeSingle();

      if (sub) {
        // Para invoices de $0 (setup de trial), solo vinculamos el stripe_subscription_id.
        // No tocamos status ni period dates: las gestiona customer.subscription.created con los datos reales.
        const subUpdates: Record<string, unknown> = {
          stripe_subscription_id: inv.subscription,
          updated_at:             new Date().toISOString(),
        };
        if (isPaidInvoice) {
          subUpdates.status               = 'active';
          subUpdates.current_period_start = new Date(inv.period_start * 1000).toISOString();
          subUpdates.current_period_end   = new Date(inv.period_end   * 1000).toISOString();
        }
        const { error: subErr } = await supabase.from('trade_subscriptions').update(subUpdates).eq('id', sub.id);

        if (subErr) console.error('[webhook] Error actualizando subscription en invoice.paid:', subErr);

        const { data: existingInv } = await supabase
          .from('trade_platform_invoices')
          .select('id')
          .eq('stripe_invoice_id', inv.id)
          .maybeSingle();

        if (existingInv) {
          console.log('[webhook] invoice.paid ya procesado (idempotente) — invoice_id:', inv.id);
        } else {
          const { error: invErr } = await supabase.from('trade_platform_invoices').insert({
            org_id:            sub.org_id,
            period_start:      new Date(inv.period_start * 1000).toISOString().split('T')[0],
            period_end:        new Date(inv.period_end   * 1000).toISOString().split('T')[0],
            amount_cents:      inv.amount_paid,
            status:            'paid',
            stripe_invoice_id: inv.id,
            invoice_url:       inv.hosted_invoice_url ?? null,
            invoice_pdf_url:   inv.invoice_pdf ?? null,
            plan:              plan ?? null,
            paid_at:           new Date().toISOString(),
          });
          if (invErr) console.error('[webhook] Error insertando trade_platform_invoices:', invErr);
        }
        console.log('[webhook] invoice.paid procesado OK — org:', sub.org_id);
      } else {
        console.warn('[webhook] invoice.paid: no se encontró trade_subscriptions para customer:', inv.customer);
      }
    }

    // ── customer.subscription.deleted ────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const customerId = (event.data.object as { customer: string }).customer;
      await supabase.from('trade_subscriptions').update({
        status:       'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq('stripe_customer_id', customerId);
      console.log('[webhook] customer.subscription.deleted — customer:', customerId);
    }

    // ── invoice.payment_failed ────────────────────────────────────────────────
    if (event.type === 'invoice.payment_failed') {
      const customerId = (event.data.object as { customer: string }).customer;
      await supabase.from('trade_subscriptions').update({
        status:     'expired',
        updated_at: new Date().toISOString(),
      }).eq('stripe_customer_id', customerId);
      console.log('[webhook] invoice.payment_failed — customer:', customerId);
    }

    // ── customer.subscription.trial_will_end ─────────────────────────────────
    if (event.type === 'customer.subscription.trial_will_end') {
      const sub = event.data.object as {
        id: string;
        customer: string;
        trial_end?: number | null;
      };
      const trialEndDate = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;
      // No cambiamos status: el frontend ya muestra el aviso basándose en trial_end - Date.now()
      // Solo logueamos para visibilidad operacional
      console.log('[webhook] trial_will_end — customer:', sub.customer, 'trial_end:', trialEndDate, '— el frontend mostrará aviso por fecha');
    }

  } catch (e: unknown) {
    const msg = (e as Error)?.message ?? String(e);
    console.error('[webhook] Error no capturado procesando evento', event.type, ':', msg);
    // Retornar 200 igualmente para que Stripe no reintente indefinidamente
    // (el error está logueado y será visible en los logs de la función)
    return new Response(JSON.stringify({ received: true, warning: msg }), {
      headers: { ...cors(req), 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  });
});



