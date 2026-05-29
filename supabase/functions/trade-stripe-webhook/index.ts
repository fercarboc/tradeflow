import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_SECRET_KEY   = Deno.env.get('STRIPE_TRABFLOW_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_TRABFLOW_SECRET') ?? '';
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

async function verifyStripeSignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
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
}

async function cancelStripeSubscription(subscriptionId: string): Promise<void> {
  await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const body      = await req.text();
  const sigHeader = req.headers.get('stripe-signature') ?? '';

  if (!(await verifyStripeSignature(body, sigHeader, STRIPE_WEBHOOK_SECRET))) {
    return new Response('Invalid signature', { status: 400 });
  }

  const event    = JSON.parse(body);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // ── checkout.session.completed ────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      metadata?: Record<string, string>;
      customer?: string;
      subscription?: string;
    };
    const orgId        = session.metadata?.org_id;
    const plan         = session.metadata?.plan;
    const billingCycle = session.metadata?.billing_cycle;
    const newSubId     = session.subscription;

    if (orgId && plan) {
      // Cancel any existing subscription that differs from the new one
      if (newSubId) {
        const { data: existing } = await supabase
          .from('trade_subscriptions')
          .select('stripe_subscription_id')
          .eq('org_id', orgId)
          .maybeSingle();

        const oldSubId = existing?.stripe_subscription_id;
        if (oldSubId && oldSubId !== newSubId) {
          await cancelStripeSubscription(oldSubId);
        }
      }

      const updates: Record<string, string> = {
        plan,
        billing_cycle: billingCycle ?? 'monthly',
        status:        'active',
        updated_at:    new Date().toISOString(),
      };
      if (session.customer) updates.stripe_customer_id     = session.customer;
      if (newSubId)         updates.stripe_subscription_id = newSubId;

      await supabase.from('trade_subscriptions').update(updates).eq('org_id', orgId);
      await supabase.from('trade_organizations').update({ plan }).eq('id', orgId);
    }
  }

  // ── customer.subscription.created ─────────────────────────────────────────
  if (event.type === 'customer.subscription.created') {
    const sub = event.data.object as {
      id: string;
      customer: string;
      metadata?: Record<string, string>;
      current_period_start: number;
      current_period_end: number;
    };
    const plan = sub.metadata?.plan;

    if (plan) {
      await supabase.from('trade_subscriptions').update({
        plan,
        status:                 'active',
        stripe_subscription_id: sub.id,
        current_period_start:   new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end:     new Date(sub.current_period_end   * 1000).toISOString(),
        updated_at:             new Date().toISOString(),
      }).eq('stripe_customer_id', sub.customer);

      const { data: orgSub } = await supabase
        .from('trade_subscriptions').select('org_id')
        .eq('stripe_customer_id', sub.customer).maybeSingle();
      if (orgSub?.org_id) {
        await supabase.from('trade_organizations').update({ plan }).eq('id', orgSub.org_id);
      }
    }
  }

  // ── customer.subscription.updated ─────────────────────────────────────────
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

    if (sub.status === 'active')   updates.status = 'active';
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
  }

  // ── invoice.paid ──────────────────────────────────────────────────────────
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

    const { data: sub } = await supabase
      .from('trade_subscriptions')
      .select('id, org_id')
      .eq('stripe_customer_id', inv.customer)
      .single();

    if (sub) {
      await supabase.from('trade_subscriptions').update({
        status:                 'active',
        stripe_subscription_id: inv.subscription,
        current_period_start:   new Date(inv.period_start * 1000).toISOString(),
        current_period_end:     new Date(inv.period_end   * 1000).toISOString(),
        updated_at:             new Date().toISOString(),
      }).eq('id', sub.id);

      await supabase.from('trade_platform_invoices').insert({
        org_id:          sub.org_id,
        period_start:    new Date(inv.period_start * 1000).toISOString().split('T')[0],
        period_end:      new Date(inv.period_end   * 1000).toISOString().split('T')[0],
        amount_cents:    inv.amount_paid,
        status:          'paid',
        stripe_invoice_id: inv.id,
        invoice_url:     inv.hosted_invoice_url ?? null,
        invoice_pdf_url: inv.invoice_pdf ?? null,
        plan:            plan ?? null,
        paid_at:         new Date().toISOString(),
      });
    }
  }

  // ── customer.subscription.deleted ─────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const customerId = (event.data.object as { customer: string }).customer;
    await supabase.from('trade_subscriptions').update({
      status:       'cancelled',
      cancelled_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('stripe_customer_id', customerId);
  }

  // ── invoice.payment_failed ────────────────────────────────────────────────
  if (event.type === 'invoice.payment_failed') {
    const customerId = (event.data.object as { customer: string }).customer;
    await supabase.from('trade_subscriptions').update({
      status:     'expired',
      updated_at: new Date().toISOString(),
    }).eq('stripe_customer_id', customerId);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
